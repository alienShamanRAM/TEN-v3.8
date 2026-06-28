// TEN26 rendering engine: masks, images, SVG geometry, dots, forces, and transitions.
            function getMaskState(slideType = 'svg') {
                const controls = getMaskControlsForType(slideType);
                return {
                    enabled: true,
                    expansion: read(controls.expansion)
                };
            }

            function getMaskScaleDuration(slideType = 'svg') {
                const controls = getMaskControlsForType(slideType);
                const value = parseFloat(controls.scaleTime?.value);
                return clamp(Number.isFinite(value) ? value : 5, 0, 10);
            }

            function getMaskCacheKey(slide, mask, slideIndex = currentSlideIndex) {
                const controls = getSlideControlsForType(slide?.type);
                return [
                    slide?.id || 'slide',
                    slide?.type || 'svg',
                    slideIndex,
                    STUDIO_WIDTH,
                    STUDIO_HEIGHT,
                    controls.scale?.value,
                    controls.offsetX?.value,
                    controls.offsetY?.value,
                    mask.expansion
                ].join('|');
            }

            function studioToSlidePoint(slide, x, y) {
                const placement = getSlidePlacement(slide);
                return new slide.geometry.scope.Point(
                    placement.frame.minX + ((x - placement.left) / placement.widthPx) * placement.frame.width,
                    placement.frame.minY + ((y - placement.top) / placement.heightPx) * placement.frame.height
                );
            }

            function getSlideUnitsPerStudioPixel(slide) {
                const placement = getSlidePlacement(slide);
                if (!placement.widthPx || !placement.heightPx) return 1;
                const xScale = placement.frame.width / placement.widthPx;
                const yScale = placement.frame.height / placement.heightPx;
                return Math.max(xScale, yScale);
            }

            function getVisibleStrokeWidth(item) {
                let cursor = item;
                while (cursor) {
                    if (cursor.strokeColor && cursor.strokeColor.alpha !== 0) {
                        return Math.max(0, cursor.strokeWidth || 1);
                    }
                    cursor = cursor.parent;
                }
                return 0;
            }

            function distanceToPaintedItem(item, point) {
                try {
                    const nearest = item.getNearestPoint?.(point);
                    return nearest ? nearest.getDistance(point) : Infinity;
                } catch (error) {
                    return Infinity;
                }
            }

            function isSlidePointInPaintedStroke(slide, point, expansionSlideUnits = 0) {
                return slide.geometry.strokeItems.some(item => {
                    const strokeRadius = getVisibleStrokeWidth(item) / 2;
                    return distanceToPaintedItem(item, point) <= strokeRadius + expansionSlideUnits;
                });
            }

            function isSlidePointNearPaintedGeometry(slide, point, expansionSlideUnits) {
                if (expansionSlideUnits <= 0) return false;
                return slide.geometry.maskOffsetItems.some(item =>
                    distanceToPaintedItem(item, point) <= expansionSlideUnits
                );
            }

            function isStudioPointInsideExpandedMask(slide, x, y, mask, key = getMaskCacheKey(slide, mask)) {
                if (!slide || !slide.geometry.maskOffsetItems.length) return false;
                if (maskHitCache.key !== key) {
                    maskHitCache.key = key;
                    maskHitCache.points.clear();
                }
                const pointKey = `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
                if (maskHitCache.points.has(pointKey)) return maskHitCache.points.get(pointKey);

                const point = studioToSlidePoint(slide, x, y);
                const expansionSlideUnits = Math.max(0, mask.expansion || 0) * getSlideUnitsPerStudioPixel(slide);
                const inside = isInsideSlideFill(slide, point) ||
                    isSlidePointInPaintedStroke(slide, point, expansionSlideUnits) ||
                    isSlidePointNearPaintedGeometry(slide, point, expansionSlideUnits);
                maskHitCache.points.set(pointKey, inside);
                return inside;
            }

            function resetDotMaskScales(value = 1) {
                maskScaleTransition = null;
                DOT_LAYER_KEYS.forEach(layerKey => {
                    dotGroups[layerKey].dots.forEach(dot => {
                        dot.maskScale = value;
                        clearDotMaskTweenState(dot);
                    });
                });
                if (typeof markAllDotLayersDirty === 'function') markAllDotLayersDirty({ update: false, render: true });
            }

            function updateMaskStatus() {
                const svgSlides = slides.filter(slide => isSvgSlideType(slide.type));
                if (!svgSlides.length) {
                    maskControls.status.textContent = 'Load an SVG slide to build an SVG mask.';
                    return;
                }
                const slide = slides[currentSlideIndex];
                if (!slide) {
                    maskControls.status.textContent = 'Load a slide to build a mask.';
                    return;
                }
                if (!isSvgSlideType(slide.type)) {
                    maskControls.status.textContent = `SVG mask ready for ${svgSlides.length} SVG slide${svgSlides.length === 1 ? '' : 's'}.`;
                    return;
                }
                const activeSpecialOverlay = getActiveSpecialOverlayForSlide(currentSlideIndex);
                if (!slide.geometry.maskOffsetItems.length && !activeSpecialOverlay?.geometry.maskOffsetItems.length) {
                    maskControls.status.textContent = 'Current slide has no readable painted mask.';
                    return;
                }
                const maskLabel = activeMaskLabel || `slide ${currentSlideIndex + 1}`;
                maskControls.status.textContent = `Painted mask hides grid homes for ${maskLabel}.`;
            }

            function scheduleIdleWork(callback) {
                if (window.requestIdleCallback) {
                    return window.requestIdleCallback(callback, { timeout: 160 });
                }
                return window.setTimeout(() => callback({ timeRemaining: () => 0 }), 0);
            }

            let maskWarmupToken = 0;
            let maskWarmupActive = false;
            let pendingMaskWarmup = false;
            let pendingTargetWarmup = false;
            let activeMaskSlideIndex = null;
            let activeMaskLabel = '';
            let maskScaleTransition = null;
            let returnSettleCheckElapsed = 0;
            const RETURN_SETTLE_CHECK_INTERVAL = 0.08;
            const SCREEN_TARGET_CACHE_LIMIT = 24;
            const GEOMETRY_POINT_CACHE_LIMIT = 16;
            const COMBINED_MASK_CACHE_LIMIT = 48;
            const combinedMaskCache = new Map();

            function isPerformanceCriticalMotionActive() {
                return !!autoTransition || activeHoldMode !== null || holdState === 'return';
            }

            function getGridMaskSignature() {
                if (typeof dotGroups === 'undefined') return '';
                return DOT_LAYER_KEYS.map(layerKey => {
                    const cfg = getLayerRuntimeConfig(layerKey);
                    const dots = dotGroups[layerKey]?.dots || [];
                    return [
                        layerKey,
                        cfg.cols,
                        cfg.rows,
                        cfg.spacing,
                        cfg.offsetX,
                        cfg.offsetY,
                        dots.length
                    ].join(':');
                }).join('|');
            }

            function getMaskWarmupSlideIndexes() {
                if (!slides.length) return [];
                return slides.map((_, index) => index);
            }

            function pruneMapCache(cache, limit) {
                if (!cache || !Number.isFinite(limit)) return;
                while (cache.size > limit) {
                    const firstKey = cache.keys().next().value;
                    if (firstKey === undefined) break;
                    cache.delete(firstKey);
                }
            }

            function setBoundedCacheEntry(cache, key, value, limit) {
                if (!cache) return value;
                if (cache.has(key)) cache.delete(key);
                cache.set(key, value);
                pruneMapCache(cache, limit);
                return value;
            }

            function getReadyMaskCacheForSlideLike(slide, cacheIndex, mask = null) {
                if (!slide || !slide.geometry.maskOffsetItems.length || typeof dotGroups === 'undefined') return null;
                const effectiveMask = mask || getMaskState(slide.type);
                const key = getMaskCacheKey(slide, effectiveMask, cacheIndex);
                const signature = getGridMaskSignature();
                const cache = slide.gridMaskCache;
                if (
                    cache &&
                    cache.key === key &&
                    cache.version === maskHitCache.version &&
                    cache.signature === signature
                ) {
                    return cache;
                }
                return null;
            }

            function getReadySlideMaskCache(slideIndex, mask = null) {
                return getReadyMaskCacheForSlideLike(slides[slideIndex], slideIndex, mask);
            }

            function isSlideMaskReadyForTransition(slideIndex) {
                const slide = slides[slideIndex];
                const overlay = getActiveSpecialOverlayForSlide(slideIndex);
                if (!slide && !overlay) return true;
                if (slide?.geometry.maskOffsetItems.length && !getReadySlideMaskCache(slideIndex, getMaskState(slide.type))) return false;
                if (overlay?.geometry.maskOffsetItems.length && !getSpecialOverlayMaskCache(overlay)) return false;
                return true;
            }

            function getMaskDotCountFromCache(cache) {
                if (!cache) return null;
                if (Number.isFinite(cache.maskDotCount)) return cache.maskDotCount;
                let count = 0;
                DOT_LAYER_KEYS.forEach(layerKey => {
                    (cache.layers[layerKey] || []).forEach(hidden => {
                        if (hidden) count++;
                    });
                });
                cache.maskDotCount = count;
                return count;
            }

            function getMaskCacheLabel(cache) {
                if (cache?.maskLabel) return cache.maskLabel;
                return Number.isFinite(cache?.slideIndex) ? `slide ${cache.slideIndex + 1}` : 'special overlay';
            }

            function createEmptyMaskCache(cacheIndex, label = '') {
                if (typeof dotGroups === 'undefined') return null;
                const signature = getGridMaskSignature();
                const cache = {
                    slideIndex: cacheIndex,
                    key: `empty-mask|${cacheIndex}|${signature}`,
                    version: maskHitCache.version,
                    signature,
                    slideType: 'svg',
                    maskLabel: label,
                    layers: {},
                    maskDotCount: 0
                };
                DOT_LAYER_KEYS.forEach(layerKey => {
                    cache.layers[layerKey] = dotGroups[layerKey].dots.map(() => false);
                });
                return cache;
            }

            function createEmptySlideMaskCache(slideIndex) {
                return createEmptyMaskCache(slideIndex, Number.isFinite(slideIndex) ? `slide ${slideIndex + 1}` : '');
            }

            function buildMaskCacheSyncForSlideLike(slide, cacheIndex, mask = null, label = '') {
                if (!slide || !slide.geometry.maskOffsetItems.length || typeof dotGroups === 'undefined') return null;
                const effectiveMask = mask || getMaskState(slide.type);
                const key = getMaskCacheKey(slide, effectiveMask, cacheIndex);
                const cache = {
                    slideIndex: cacheIndex,
                    key,
                    version: maskHitCache.version,
                    signature: getGridMaskSignature(),
                    slideType: slide.type || 'svg',
                    maskLabel: label,
                    layers: {}
                };
                DOT_LAYER_KEYS.forEach(layerKey => {
                    cache.layers[layerKey] = dotGroups[layerKey].dots.map(dot =>
                        isStudioPointInsideExpandedMask(slide, dot.gridX, dot.gridY, effectiveMask, key)
                    );
                });
                getMaskDotCountFromCache(cache);
                slide.gridMaskCache = cache;
                return cache;
            }

            function buildSlideMaskCacheSync(slideIndex) {
                return buildMaskCacheSyncForSlideLike(slides[slideIndex], slideIndex, getMaskState(slides[slideIndex]?.type || 'svg'), Number.isFinite(slideIndex) ? `slide ${slideIndex + 1}` : '');
            }

            function combineMaskCaches(caches = [], cacheIndex = currentSlideIndex, label = '') {
                const validCaches = caches.filter(Boolean);
                if (!validCaches.length) return null;
                if (validCaches.length === 1) return validCaches[0];
                const key = validCaches.map(cache => cache.key).join('+');
                const signature = getGridMaskSignature();
                const combinedKey = [
                    cacheIndex,
                    maskHitCache.version,
                    signature,
                    key,
                    label
                ].join('|');
                if (combinedMaskCache.has(combinedKey)) return combinedMaskCache.get(combinedKey);
                const cache = {
                    slideIndex: cacheIndex,
                    key: `combined-mask|${key}`,
                    version: maskHitCache.version,
                    signature,
                    slideType: validCaches.some(item => item.slideType === 'special-svg') ? 'svg' : (validCaches[0].slideType || 'svg'),
                    maskLabel: label,
                    layers: {}
                };
                DOT_LAYER_KEYS.forEach(layerKey => {
                    const dotCount = dotGroups[layerKey]?.dots?.length || 0;
                    cache.layers[layerKey] = Array.from({ length: dotCount }, (_, index) =>
                        validCaches.some(item => !!item.layers[layerKey]?.[index])
                    );
                });
                getMaskDotCountFromCache(cache);
                return setBoundedCacheEntry(combinedMaskCache, combinedKey, cache, COMBINED_MASK_CACHE_LIMIT);
            }

            function getSpecialOverlayMaskCache(overlay, options = {}) {
                const { sync = false } = options;
                if (!overlay || !overlay.geometry.maskOffsetItems.length) return null;
                const cacheIndex = getSpecialOverlayCacheIndex(overlay);
                const mask = getMaskState('svg');
                return getReadyMaskCacheForSlideLike(overlay, cacheIndex, mask) ||
                    (sync ? buildMaskCacheSyncForSlideLike(overlay, cacheIndex, mask, getSpecialOverlayName(overlay)) : null);
            }

            function getVisualMaskCacheForSlide(slideIndex, options = {}) {
                const { sync = false, fromVisible = false } = options;
                const slide = slides[slideIndex];
                const overlay = getActiveSpecialOverlayForSlide(slideIndex);
                const caches = [];
                if (fromVisible) {
                    caches.push(createEmptySlideMaskCache(slideIndex));
                } else if (slide?.geometry.maskOffsetItems.length) {
                    const mask = getMaskState(slide.type);
                    caches.push(getReadySlideMaskCache(slideIndex, mask) ||
                        (sync ? buildSlideMaskCacheSync(slideIndex) : null));
                } else if (slide) {
                    caches.push(createEmptySlideMaskCache(slideIndex));
                }
                if (overlay) {
                    caches.push(getSpecialOverlayMaskCache(overlay, { sync }));
                }
                const validCaches = caches.filter(Boolean);
                if (!validCaches.length) return null;
                const labelParts = [];
                if (slide) labelParts.push(`slide ${slideIndex + 1}`);
                if (overlay) labelParts.push(getSpecialOverlayName(overlay));
                return combineMaskCaches(validCaches, slideIndex, labelParts.join(' + '));
            }

            function clearDotMaskTweenState(dot) {
                delete dot.maskScaleFrom;
                delete dot.maskScaleTo;
            }

            function applySlideMaskCache(cache) {
                maskScaleTransition = null;
                if (!cache || typeof dotGroups === 'undefined') {
                    resetDotMaskScales(1);
                    activeMaskSlideIndex = null;
                    activeMaskLabel = '';
                    return false;
                }
                DOT_LAYER_KEYS.forEach(layerKey => {
                    const layerMask = cache.layers[layerKey] || [];
                    dotGroups[layerKey].dots.forEach((dot, index) => {
                        const insideFill = !!layerMask[index];
                        dot.maskInsideFill = insideFill;
                        dot.maskCacheKey = cache.key;
                        dot.maskScale = insideFill ? 0 : 1;
                        clearDotMaskTweenState(dot);
                    });
                });
                activeMaskSlideIndex = cache.slideIndex;
                activeMaskLabel = getMaskCacheLabel(cache);
                if (typeof markAllDotLayersDirty === 'function') markAllDotLayersDirty({ update: false, render: true });
                return true;
            }

            function clearAppliedSlideMask() {
                maskScaleTransition = null;
                activeMaskSlideIndex = null;
                activeMaskLabel = '';
                resetDotMaskScales(1);
            }

            function startSlideMaskScaleTransition(fromCache, toCache, duration = getMaskScaleDuration(toCache?.slideType || 'svg')) {
                if (!toCache || typeof dotGroups === 'undefined') return false;
                if (duration <= 0.001) return applySlideMaskCache(toCache);
                DOT_LAYER_KEYS.forEach(layerKey => {
                    const fromLayer = fromCache?.layers[layerKey] || null;
                    const toLayer = toCache.layers[layerKey] || [];
                    dotGroups[layerKey].dots.forEach((dot, index) => {
                        const fromScale = Number.isFinite(dot.maskScale) ? dot.maskScale : 1;
                        const fromHidden = fromLayer ? !!fromLayer[index] : fromScale <= 0.5;
                        const toHidden = !!toLayer[index];
                        dot.maskInsideFill = toHidden;
                        dot.maskCacheKey = toCache.key;
                        dot.maskScaleFrom = fromHidden ? 0 : 1;
                        dot.maskScaleTo = toHidden ? 0 : 1;
                        dot.maskScale = dot.maskScaleFrom;
                    });
                });
                activeMaskSlideIndex = toCache.slideIndex;
                activeMaskLabel = getMaskCacheLabel(toCache);
                maskScaleTransition = {
                    elapsed: 0,
                    duration,
                    cache: toCache
                };
                if (typeof markAllDotLayersDirty === 'function') markAllDotLayersDirty({ update: false, render: true });
                return true;
            }

            function transitionSlideMask(fromSlideIndex, toSlideIndex, options = {}) {
                const { fromVisible = false } = options;
                const targetCache = getVisualMaskCacheForSlide(toSlideIndex);
                const fromCache = getVisualMaskCacheForSlide(fromSlideIndex, { fromVisible });
                if (!targetCache) return activateSlideMask(toSlideIndex, { sync: false });
                if (!fromCache && fromSlideIndex !== toSlideIndex && !isSlideMaskReadyForTransition(fromSlideIndex)) {
                    return false;
                }
                return startSlideMaskScaleTransition(fromCache, targetCache);
            }

            function updateMaskScaleTransitions(deltaTime) {
                if (!maskScaleTransition) return;
                maskScaleTransition.elapsed += deltaTime;
                const progress = clamp(maskScaleTransition.elapsed / Math.max(0.001, maskScaleTransition.duration), 0, 1);
                const eased = smoothstep(0, 1, progress);
                DOT_LAYER_KEYS.forEach(layerKey => {
                    dotGroups[layerKey].dots.forEach(dot => {
                        const from = Number.isFinite(dot.maskScaleFrom) ? dot.maskScaleFrom : (Number.isFinite(dot.maskScale) ? dot.maskScale : 1);
                        const to = Number.isFinite(dot.maskScaleTo) ? dot.maskScaleTo : from;
                        dot.maskScale = from + (to - from) * eased;
                    });
                });
                if (progress >= 1) {
                    const cache = maskScaleTransition.cache;
                    maskScaleTransition = null;
                    if (cache) {
                        DOT_LAYER_KEYS.forEach(layerKey => {
                            const layerMask = cache.layers[layerKey] || [];
                            dotGroups[layerKey].dots.forEach((dot, index) => {
                                const insideFill = !!layerMask[index];
                                dot.maskInsideFill = insideFill;
                                dot.maskCacheKey = cache.key;
                                dot.maskScale = insideFill ? 0 : 1;
                                clearDotMaskTweenState(dot);
                            });
                        });
                        activeMaskSlideIndex = cache.slideIndex;
                        activeMaskLabel = getMaskCacheLabel(cache);
                    }
                }
                if (typeof markAllDotLayersDirty === 'function') markAllDotLayersDirty({ update: false, render: true });
            }

            function activateSlideMask(slideIndex = currentSlideIndex, options = {}) {
                const { sync = false } = options;
                if (typeof dotGroups === 'undefined') {
                    clearAppliedSlideMask();
                    return false;
                }
                let cache = getVisualMaskCacheForSlide(slideIndex, { sync });
                if (cache) return applySlideMaskCache(cache);
                if (activeMaskSlideIndex !== slideIndex) resetDotMaskScales(1);
                activeMaskSlideIndex = slideIndex;
                activeMaskLabel = Number.isFinite(slideIndex) ? `slide ${slideIndex + 1}` : '';
                if (!maskWarmupActive) scheduleMaskWarmup();
                return false;
            }

            function createMaskWarmupJobForSlideLike(slide, cacheIndex, mask, signature, label = '') {
                if (!mask?.enabled) return null;
                if (!slide || !slide.geometry.maskOffsetItems.length || getReadyMaskCacheForSlideLike(slide, cacheIndex, mask)) return null;
                const cache = {
                    slideIndex: cacheIndex,
                    key: getMaskCacheKey(slide, mask, cacheIndex),
                    version: maskHitCache.version,
                    signature,
                    slideType: slide.type || 'svg',
                    maskLabel: label,
                    layers: {}
                };
                return {
                    slide,
                    mask,
                    cache,
                    layerPosition: 0,
                    dotPosition: 0
                };
            }

            function createMaskWarmupJob(slideIndex, mask, signature) {
                return createMaskWarmupJobForSlideLike(
                    slides[slideIndex],
                    slideIndex,
                    mask,
                    signature,
                    Number.isFinite(slideIndex) ? `slide ${slideIndex + 1}` : ''
                );
            }

            function advanceMaskWarmupJob(job, start, deadline) {
                while (job.layerPosition < DOT_LAYER_KEYS.length) {
                    const layerKey = DOT_LAYER_KEYS[job.layerPosition];
                    const dots = dotGroups[layerKey].dots;
                    const layerMask = job.cache.layers[layerKey] || (job.cache.layers[layerKey] = []);
                    while (job.dotPosition < dots.length) {
                        const dot = dots[job.dotPosition];
                        layerMask[job.dotPosition] = isStudioPointInsideExpandedMask(
                            job.slide,
                            dot.gridX,
                            dot.gridY,
                            job.mask,
                            job.cache.key
                        );
                        job.dotPosition++;
                        const timeRemaining = deadline?.timeRemaining?.() ?? 0;
                        if (performance.now() - start > 4 && timeRemaining < 2) return false;
                    }
                    job.layerPosition++;
                    job.dotPosition = 0;
                }
                return true;
            }

            function requestDeferredWarmups({ mask = false, target = false } = {}) {
                if (mask) {
                    pendingMaskWarmup = true;
                    maskWarmupActive = false;
                    maskWarmupToken++;
                }
                if (target) {
                    pendingTargetWarmup = true;
                    targetWarmupToken++;
                }
            }

            function flushDeferredWarmups() {
                if (isPerformanceCriticalMotionActive() || holdState !== 'idle') return;
                const runMaskWarmup = pendingMaskWarmup;
                const runTargetWarmup = pendingTargetWarmup;
                pendingMaskWarmup = false;
                pendingTargetWarmup = false;
                if (runMaskWarmup) scheduleMaskWarmup();
                if (runTargetWarmup) scheduleTargetWarmup();
            }

            function scheduleMaskWarmup() {
                if (isPerformanceCriticalMotionActive()) {
                    requestDeferredWarmups({ mask: true });
                    return;
                }
                const token = ++maskWarmupToken;
                pendingMaskWarmup = false;
                maskWarmupActive = false;
                if (!slides.length || typeof dotGroups === 'undefined') return;
                if (activeMaskSlideIndex === null && slides[currentSlideIndex]) {
                    activeMaskSlideIndex = currentSlideIndex;
                }
                const signature = getGridMaskSignature();
                const jobs = getMaskWarmupSlideIndexes()
                    .map(slideIndex => {
                        const slide = slides[slideIndex];
                        if (!slide) return null;
                        return createMaskWarmupJob(slideIndex, getMaskState(slide.type), signature);
                    })
                    .filter(Boolean);
                specialOverlays.forEach(overlay => {
                    if (!overlay.assignedSlides?.length || overlay.enabled === false) return;
                    const mask = getMaskState('svg');
                    const job = createMaskWarmupJobForSlideLike(
                        overlay,
                        getSpecialOverlayCacheIndex(overlay),
                        mask,
                        signature,
                        getSpecialOverlayName(overlay)
                    );
                    if (job) jobs.push(job);
                });
                const readyActiveCache = Number.isFinite(activeMaskSlideIndex)
                    ? getVisualMaskCacheForSlide(activeMaskSlideIndex)
                    : null;
                if (!jobs.length) {
                    if (readyActiveCache) applySlideMaskCache(readyActiveCache);
                    updateViewStatus();
                    return;
                }
                maskWarmupActive = true;
                let index = 0;
                const run = deadline => {
                    if (token !== maskWarmupToken) return;
                    if (isPerformanceCriticalMotionActive()) {
                        maskWarmupActive = false;
                        pendingMaskWarmup = true;
                        return;
                    }
                    const start = performance.now();
                    while (index < jobs.length) {
                        const job = jobs[index];
                        if (job.cache.version !== maskHitCache.version || job.cache.signature !== getGridMaskSignature()) {
                            maskWarmupActive = false;
                            pendingMaskWarmup = true;
                            return;
                        }
                        const complete = advanceMaskWarmupJob(job, start, deadline);
                        if (!complete) break;
                        getMaskDotCountFromCache(job.cache);
                        job.slide.gridMaskCache = job.cache;
                        if (Number.isFinite(activeMaskSlideIndex)) {
                            const activeCache = getVisualMaskCacheForSlide(activeMaskSlideIndex);
                            if (activeCache) applySlideMaskCache(activeCache);
                        }
                        index++;
                    }
                    if (index < jobs.length) {
                        scheduleIdleWork(run);
                    } else {
                        maskWarmupActive = false;
                        updateViewStatus();
                    }
                };
                scheduleIdleWork(run);
            }

            let targetWarmupToken = 0;

            function getSlideScreenTargetCacheKey(slide, targetType, totalDots, scaleMultiplier = 1) {
                const controls = getSlideControlsForType(slide?.type);
                return [
                    slide?.id || 'slide',
                    slide?.type || 'svg',
                    STUDIO_WIDTH,
                    STUDIO_HEIGHT,
                    controls.scale?.value,
                    controls.offsetX?.value,
                    controls.offsetY?.value,
                    normalizeTargetTypes(targetType).join('+'),
                    totalDots,
                    scaleMultiplier
                ].join('|');
            }

            function hasReadySlideScreenTargets(slideIndex, targetType, totalDots, scaleMultiplier = 1) {
                const slide = slides[slideIndex];
                if (!slide || totalDots <= 0) return true;
                return !!slide.screenTargetCache?.has(getSlideScreenTargetCacheKey(slide, targetType, totalDots, scaleMultiplier));
            }

            function hasReadyScreenTargetsForSlideLike(slide, targetType, totalDots, scaleMultiplier = 1) {
                if (!slide || totalDots <= 0) return true;
                return !!slide.screenTargetCache?.has(getSlideScreenTargetCacheKey(slide, targetType, totalDots, scaleMultiplier));
            }

            function areSlideTargetsReadyForTransition(slideIndex, scaleMultiplier = 1) {
                if (!slides[slideIndex] || typeof dotGroups === 'undefined') return true;
                return DOT_LAYER_KEYS.every(layerKey => {
                    const cfg = getLayerRuntimeConfig(layerKey);
                    if (cfg.hidden) return true;
                    return hasReadySlideScreenTargets(slideIndex, cfg.targetTypes, getTotalGridDots(cfg), scaleMultiplier);
                });
            }

            function areSlideLikeTargetsReadyForTransition(slide, scaleMultiplier = 1) {
                if (!slide || typeof dotGroups === 'undefined') return true;
                return DOT_LAYER_KEYS.every(layerKey => {
                    const cfg = getLayerRuntimeConfig(layerKey);
                    if (cfg.hidden) return true;
                    return hasReadyScreenTargetsForSlideLike(slide, cfg.targetTypes, getTotalGridDots(cfg), scaleMultiplier);
                });
            }

            function prepareSlideRenderNode(slide) {
                ensureSlideDomNode(slide);
            }

            function ensureSlideDomNode(slide) {
                if (!slide) return null;
                if (!slide.domNode) {
                    if (slide.type === 'image') {
                        const img = document.createElement('img');
                        img.src = slide.imageSrc;
                        img.alt = slide.name || slide.fileName || 'Image slide';
                        img.className = 'image-slide-node';
                        img.dataset.slideId = String(slide.id);
                        img.decoding = 'async';
                        img.draggable = false;
                        img.style.display = 'block';
                        slide.domNode = img;
                        return slide.domNode;
                    }
                    if (slide.type === 'video') {
                        const video = slide.videoElement || document.createElement('video');
                        if (!slide.videoElement) {
                            video.src = slide.videoSrc;
                            video.muted = true;
                            video.preload = 'metadata';
                            video.playsInline = true;
                            video.controls = false;
                            slide.videoElement = video;
                        }
                        video.className = 'image-slide-node video-slide-node';
                        video.dataset.slideId = String(slide.id);
                        video.style.display = 'block';
                        video.draggable = false;
                        slide.domNode = video;
                        return slide.domNode;
                    }
                    const fragment = ensureSlideTemplate(slide).content.cloneNode(true);
                    const svg = fragment.querySelector('svg');
                    if (!svg) return null;
                    svg.classList.add('svg-slide-node');
                    svg.dataset.slideId = String(slide.id);
                    const frame = slide.frame;
                    svg.setAttribute('width', frame.displayWidth);
                    svg.setAttribute('height', frame.displayHeight);
                    svg.style.width = `${frame.displayWidth}px`;
                    svg.style.height = `${frame.displayHeight}px`;
                    svg.style.overflow = 'visible';
                    slide.domNode = svg;
                }
                return slide.domNode;
            }

            function isSlideRenderReadyForTransition(slideIndex) {
                const slide = slides[slideIndex];
                return !slide || !!slide.domNode;
            }

            function isSpecialOverlayRenderReadyForSlide(slideIndex) {
                const overlay = getActiveSpecialOverlayForSlide(slideIndex);
                return !overlay || !!overlay.domNode;
            }

            function getSpecialTransitionPlan(fromIndex, targetIndex) {
                const sourceSpecial = getActiveSpecialOverlayForSlide(fromIndex);
                const targetSpecial = getActiveSpecialOverlayForSlide(targetIndex);
                return {
                    sourceSpecial,
                    targetSpecial,
                    currentTarget: sourceSpecial && !targetSpecial ? sourceSpecial : null,
                    nextTarget: targetSpecial && !sourceSpecial ? targetSpecial : null
                };
            }

            function areTransitionAssetsReady(targetIndex) {
                const plan = getSpecialTransitionPlan(currentSlideIndex, targetIndex);
                return isSlideMaskReadyForTransition(currentSlideIndex) &&
                    isSlideMaskReadyForTransition(targetIndex) &&
                    isSlideRenderReadyForTransition(targetIndex) &&
                    isSpecialOverlayRenderReadyForSlide(currentSlideIndex) &&
                    isSpecialOverlayRenderReadyForSlide(targetIndex) &&
                    areSlideTargetsReadyForTransition(currentSlideIndex) &&
                    areSlideTargetsReadyForTransition(targetIndex) &&
                    areSlideLikeTargetsReadyForTransition(plan.currentTarget) &&
                    areSlideLikeTargetsReadyForTransition(plan.nextTarget);
            }

            function clearSlideScreenTargetCaches() {
                slides.forEach(slide => slide.screenTargetCache?.clear());
                specialOverlays.forEach(overlay => overlay.screenTargetCache?.clear());
                targetWarmupToken++;
            }

            function scheduleTransitionPrewarm() {
                scheduleMaskWarmup();
                scheduleTargetWarmup();
            }

            function precomputeAllTransitionAssetsSync() {
                scheduleTransitionPrewarm();
            }

            function getPriorityWarmupSlideIndexes() {
                if (!slides.length) return [];
                const priority = [
                    currentSlideIndex,
                    pendingSlideIndex,
                    slides.length > 1 ? getWrappedSlideIndex(1) : currentSlideIndex,
                    slides.length > 1 ? getWrappedSlideIndex(-1) : currentSlideIndex,
                    autoTransition?.targetIndex
                ];
                const seen = new Set();
                const ordered = [];
                priority.concat(slides.map((_, index) => index)).forEach(index => {
                    const numeric = Math.round(parseFloat(index));
                    if (!Number.isFinite(numeric) || numeric < 0 || numeric >= slides.length || seen.has(numeric)) return;
                    seen.add(numeric);
                    ordered.push(numeric);
                });
                return ordered;
            }

            function scheduleTargetWarmup() {
                if (isPerformanceCriticalMotionActive()) {
                    requestDeferredWarmups({ target: true });
                    return;
                }
                const token = ++targetWarmupToken;
                pendingTargetWarmup = false;
                if (!slides.length || activeHoldMode || autoTransition || typeof dotGroups === 'undefined') return;
                const jobs = [];
                getPriorityWarmupSlideIndexes().forEach(slideIndex => {
                    const slide = slides[slideIndex];
                    if (!slide) return;
                    if (!slide.domTemplate) jobs.push(() => ensureSlideTemplate(slide));
                    if (!slide.domNode) jobs.push(() => prepareSlideRenderNode(slide));
                    DOT_LAYER_KEYS.forEach(layerKey => {
                        const cfg = getLayerRuntimeConfig(layerKey);
                        const total = getTotalGridDots(cfg);
                        if (!cfg.hidden && total > 0) {
                            if (!hasReadySlideScreenTargets(slideIndex, cfg.targetTypes, total)) {
                                jobs.push(() => getSlideScreenTargets(slideIndex, cfg.targetTypes, total));
                            }
                        }
                    });
                });
                const prioritySlides = new Set(getPriorityWarmupSlideIndexes().slice(0, 4));
                specialOverlays
                    .map((overlay, index) => ({
                        overlay,
                        index,
                        priority: overlay.assignedSlides?.some(slideIndex => prioritySlides.has(slideIndex)) ? 0 : 1
                    }))
                    .sort((a, b) => a.priority - b.priority || a.index - b.index)
                    .forEach(({ overlay }) => {
                        if (!overlay.assignedSlides?.length || overlay.enabled === false) return;
                        if (!overlay.domTemplate) jobs.push(() => ensureSlideTemplate(overlay));
                        if (!overlay.domNode) jobs.push(() => prepareSlideRenderNode(overlay));
                        DOT_LAYER_KEYS.forEach(layerKey => {
                            const cfg = getLayerRuntimeConfig(layerKey);
                            const total = getTotalGridDots(cfg);
                            if (!cfg.hidden && total > 0) {
                                if (!hasReadyScreenTargetsForSlideLike(overlay, cfg.targetTypes, total)) {
                                    jobs.push(() => getScreenTargetsForSlideLike(overlay, cfg.targetTypes, total));
                                }
                            }
                        });
                    });
                let index = 0;
                const run = deadline => {
                    if (token !== targetWarmupToken || activeHoldMode || autoTransition) return;
                    const start = performance.now();
                    while (index < jobs.length) {
                        jobs[index++]();
                        const timeRemaining = deadline?.timeRemaining?.() ?? 0;
                        if (performance.now() - start > 6 && timeRemaining < 2) break;
                    }
                    if (index < jobs.length) scheduleIdleWork(run);
                };
                scheduleIdleWork(run);
            }

            function ensureSlideTemplate(slide) {
                if (slide?.type === 'image') {
                    if (!slide.domTemplate) slide.domTemplate = document.createElement('template');
                    return slide.domTemplate;
                }
                if (!slide.domTemplate) {
                    const template = document.createElement('template');
                    template.innerHTML = slide.svg;
                    slide.domTemplate = template;
                }
                return slide.domTemplate;
            }

            function getBackgroundMode() {
                return bgControls.mode?.value || 'static';
            }

            function getBackgroundPalette() {
                const color1 = normalizeHexColor(bgControls.staticPicker?.value, '#02006c');
                const color2 = normalizeHexColor(bgControls.color2Picker?.value, '#ffd4f5');
                const color3 = normalizeHexColor(bgControls.color3Picker?.value, '#00002a');
                const mode = getBackgroundMode();
                if (mode === 'cycle3') return [color1, color2, color3];
                if (mode === 'cycle2') return [color1, color2];
                return [color1];
            }

            function syncBackgroundRuntime() {
                const palette = getBackgroundPalette();
                backgroundRuntime = {
                    palette,
                    rgbs: palette.map(hexToRgb),
                    speed: Math.max(0.01, read(bgControls.cycleSpeed))
                };
            }

            function updateBackgroundControls() {
                const mode = getBackgroundMode();
                bgControls.color2Row?.classList.toggle('hidden-ui-node', mode === 'static');
                bgControls.color3Row?.classList.toggle('hidden-ui-node', mode !== 'cycle3');
                bgControls.cycleSpeedRow?.classList.toggle('hidden-ui-node', mode === 'static');
                syncBackgroundRuntime();
            }

            function updateBackground() {
                if (!backgroundRuntime) syncBackgroundRuntime();
                const { palette, rgbs, speed } = backgroundRuntime;
                if (palette.length <= 1) {
                    currentBackgroundColor = palette[0];
                } else {
                    const phase = (performance.now() / 1000 * speed) % palette.length;
                    const index = Math.floor(phase);
                    const nextIndex = (index + 1) % palette.length;
                    currentBackgroundColor = interpolateRgbColor(
                        rgbs[index],
                        rgbs[nextIndex],
                        smoothstep(0, 1, phase - index)
                    );
                }
                if (currentBackgroundColor !== appliedBackgroundColor) {
                    viewport.style.background = currentBackgroundColor;
                    appliedBackgroundColor = currentBackgroundColor;
                }
            }

            function isBackgroundAnimated() {
                if (!backgroundRuntime) syncBackgroundRuntime();
                return (backgroundRuntime?.palette?.length || 0) > 1;
            }

            let imageState = {
                name: '',
                fileName: '',
                src: '',
                hidden: false,
                naturalWidth: 0,
                naturalHeight: 0
            };

            function updateImageVisibilityUi() {
                const hidden = !!imageState.hidden;
                imageLayer.classList.toggle('hidden', hidden);
                imageControls.toggle?.classList.toggle('hidden-state', hidden);
                if (imageControls.toggle) {
                    setIconButton(imageControls.toggle, hidden ? 'eyeOff' : 'eye', `Background image ${hidden ? 'hidden' : 'visible'}`);
                    imageControls.toggle.setAttribute('aria-pressed', String(!hidden));
                }
            }

            function clearUploadWarning(label, status) {
                label?.classList.remove('upload-missing');
                status?.classList.remove('upload-missing');
            }

            function setUploadWarning(label, status, type, fileName) {
                const name = fileName || `missing ${type}`;
                if (label) {
                    label.textContent = `Missing: ${name}`;
                    label.classList.add('upload-missing');
                }
                if (status) {
                    status.textContent = `Missing ${type}: ${name}. Re-upload it or apply a preset with embedded data.`;
                    status.classList.add('upload-missing');
                }
            }

            function updateImageLayer() {
                imageLayer.innerHTML = '';
                updateImageVisibilityUi();
                const imageName = imageState.name || imageState.fileName || '';
                clearUploadWarning(imageControls.label, imageControls.status);
                if (!imageState.src) {
                    if (imageName) {
                        setUploadWarning(imageControls.label, imageControls.status, 'image', imageName);
                    } else {
                        imageControls.label.textContent = 'Upload PNG/JPG';
                        imageControls.status.textContent = 'No image loaded.';
                    }
                    return;
                }
                const img = document.createElement('img');
                img.alt = imageName;
                img.onerror = () => {
                    imageLayer.innerHTML = '';
                    imageState = { ...imageState, src: '', naturalWidth: 0, naturalHeight: 0 };
                    setUploadWarning(imageControls.label, imageControls.status, 'image', imageName);
                };
                img.src = imageState.src;
                const scale = read(imageControls.scale) / 100;
                const w = (imageState.naturalWidth || STUDIO_WIDTH) * scale;
                const h = (imageState.naturalHeight || STUDIO_HEIGHT) * scale;
                img.style.left = `${STUDIO_CENTER_X + read(imageControls.offsetX) - w / 2}px`;
                img.style.top = `${STUDIO_CENTER_Y + read(imageControls.offsetY) - h / 2}px`;
                img.style.width = `${w}px`;
                img.style.height = `${h}px`;
                imageLayer.appendChild(img);
                imageControls.label.textContent = imageName || 'Image loaded';
                imageControls.status.textContent = `Image: ${imageName || 'Loaded image'}${imageState.hidden ? ' · hidden' : ''}`;
                updateImageVisibilityUi();
            }

            function loadImageFile(file) {
                if (!file) return;
                const isSupportedImage = /^image\/(png|jpeg)$/.test(file.type) || /\.(png|jpe?g)$/i.test(file.name);
                if (!isSupportedImage) {
                    imageState = { name: file.name, fileName: file.name, src: '', hidden: false, naturalWidth: 0, naturalHeight: 0 };
                    updateImageLayer();
                    return;
                }
                const reader = new FileReader();
                reader.onerror = () => {
                    imageState = { name: file.name, fileName: file.name, src: '', hidden: false, naturalWidth: 0, naturalHeight: 0 };
                    updateImageLayer();
                };
                reader.onload = () => {
                    const img = new Image();
                    img.onload = () => {
                        imageState = {
                            name: file.name,
                            fileName: file.name,
                            src: reader.result,
                            hidden: false,
                            naturalWidth: img.naturalWidth,
                            naturalHeight: img.naturalHeight
                        };
                        updateImageLayer();
                    };
                    img.onerror = () => {
                        imageState = { name: file.name, fileName: file.name, src: '', hidden: false, naturalWidth: 0, naturalHeight: 0 };
                        updateImageLayer();
                    };
                    img.src = reader.result;
                };
                reader.readAsDataURL(file);
            }

            function clearImageLayer() {
                imageState = { name: '', fileName: '', src: '', hidden: false, naturalWidth: 0, naturalHeight: 0 };
                imageControls.file.value = '';
                updateImageLayer();
            }

            function updateDrawerTitleStates() {
                const hasSvgSlides = slides.some(slide => isSvgSlideType(slide.type));
                const hasMediaSlides = slides.some(slide => isMediaSlideType(slide.type));
                document.getElementById('drawer-trigger-slides')?.classList.toggle('inactive-title', !hasSvgSlides);
                document.getElementById('drawer-trigger-image-slides')?.classList.toggle('inactive-title', !hasMediaSlides);
                document.getElementById('drawer-trigger-special-overlays')?.classList.toggle('inactive-title', !specialOverlays.length);
                document.getElementById('drawer-trigger-blink-mode')?.classList.toggle('inactive-title', !blinkControls.enabled?.checked);
                document.getElementById('drawer-trigger-mouse-interaction')?.classList.toggle('inactive-title', !mouseControls.enabled?.checked);
            }

            function parseSvgDimension(value) {
                if (!value || String(value).includes('%')) return null;
                const parsed = parseFloat(value);
                return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
            }

            function parseViewBox(value) {
                if (!value) return null;
                const parts = value.trim().split(/[\s,]+/).map(Number);
                if (parts.length !== 4 || parts.some(part => !Number.isFinite(part))) return null;
                return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
            }

            function readSvgFrameFromText(svgText) {
                const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
                const svg = doc.querySelector('svg');
                if (!svg) {
                    return { minX: 0, minY: 0, width: 300, height: 150, displayWidth: 300, displayHeight: 150 };
                }
                const viewBox = parseViewBox(svg.getAttribute('viewBox'));
                const displayWidth = parseSvgDimension(svg.getAttribute('width')) || (viewBox ? viewBox.width : 300);
                const displayHeight = parseSvgDimension(svg.getAttribute('height')) || (viewBox ? viewBox.height : 150);
                return {
                    minX: viewBox ? viewBox.x : 0,
                    minY: viewBox ? viewBox.y : 0,
                    width: viewBox ? viewBox.width : displayWidth,
                    height: viewBox ? viewBox.height : displayHeight,
                    displayWidth,
                    displayHeight
                };
            }

            function createGeometryState() {
                const scope = new paper.PaperScope();
                scope.setup(document.createElement('canvas'));
                return {
                    scope,
                    root: null,
                    paths: [],
                    fillItems: [],
                    strokeItems: [],
                    maskOffsetItems: [],
                    bounds: null,
                    frame: null,
                    anchorPoints: [],
                    pathPointCache: new Map(),
                    fillPointCache: new Map(),
                    dirty: true
                };
            }

            function hasVisibleFill(item) {
                let cursor = item;
                while (cursor) {
                    if (cursor.visible === false || cursor.opacity === 0) return false;
                    cursor = cursor.parent;
                }
                cursor = item;
                while (cursor) {
                    if (cursor.fillColor) return cursor.fillColor.alpha !== 0;
                    cursor = cursor.parent;
                }
                return false;
            }

            function hasVisibleStroke(item) {
                let cursor = item;
                while (cursor) {
                    if (cursor.visible === false || cursor.opacity === 0) return false;
                    cursor = cursor.parent;
                }
                cursor = item;
                while (cursor) {
                    if (cursor.strokeColor) return cursor.strokeColor.alpha !== 0 && (cursor.strokeWidth || 1) > 0;
                    cursor = cursor.parent;
                }
                return false;
            }

            function addMaskGeometryItem(state, item) {
                if (item && !state.maskOffsetItems.includes(item)) state.maskOffsetItems.push(item);
            }

            function collectPaperGeometry(item, state) {
                if (!item) return;
                if (item.className === 'Path' && item.length > 0) {
                    const visibleFill = hasVisibleFill(item);
                    const visibleStroke = hasVisibleStroke(item);
                    state.paths.push(item);
                    item.segments.forEach(segment => state.anchorPoints.push(segment.point.clone()));
                    if (item.closed && (!item.parent || item.parent.className !== 'CompoundPath') && visibleFill) {
                        state.fillItems.push(item);
                    }
                    if (visibleStroke) state.strokeItems.push(item);
                    if (visibleFill || visibleStroke) addMaskGeometryItem(state, item);
                } else if (item.className === 'CompoundPath') {
                    const visibleFill = hasVisibleFill(item);
                    const visibleStroke = hasVisibleStroke(item);
                    if (visibleFill) state.fillItems.push(item);
                    if (visibleStroke) state.strokeItems.push(item);
                    if (visibleFill || visibleStroke) addMaskGeometryItem(state, item);
                }
                if (item.children) item.children.forEach(child => collectPaperGeometry(child, state));
            }

            function rebuildSlideGeometry(slide) {
                const state = slide.geometry;
                state.root = null;
                state.paths = [];
                state.fillItems = [];
                state.strokeItems = [];
                state.maskOffsetItems = [];
                state.bounds = null;
                state.anchorPoints = [];
                state.pathPointCache = new Map();
                state.fillPointCache = new Map();
                state.scope.project.clear();

                try {
                    const imported = state.scope.project.importSVG(slide.svg, {
                        insert: true,
                        expandShapes: true
                    });
                    state.root = imported;
                    state.bounds = imported.bounds ? imported.bounds.clone() : null;
                    state.frame = slide.frame;
                    collectPaperGeometry(imported, state);
                    state.dirty = false;
                } catch (error) {
                    state.dirty = false;
                }
            }

            function pointAtCombinedPathDistance(pathLengths, distance) {
                let cursor = distance;
                for (const entry of pathLengths) {
                    if (cursor <= entry.length) return entry.path.getPointAt(Math.max(0, cursor));
                    cursor -= entry.length;
                }
                const last = pathLengths[pathLengths.length - 1];
                return last ? last.path.getPointAt(last.length) : null;
            }

            function buildPathPoints(slide, total) {
                const state = slide.geometry;
                const pathLengths = state.paths.map(path => ({ path, length: path.length || 0 })).filter(entry => entry.length > 0);
                const totalLength = pathLengths.reduce((sum, entry) => sum + entry.length, 0);
                if (!total || !totalLength) return [];
                const points = [];
                for (let i = 0; i < total; i++) {
                    const point = pointAtCombinedPathDistance(pathLengths, totalLength * ((i + 0.5) / total));
                    if (point) points.push(point.clone());
                }
                return points;
            }

            function isInsideSlideFill(slide, point) {
                return slide.geometry.fillItems.some(item => {
                    try {
                        return item.contains(point);
                    } catch (error) {
                        return false;
                    }
                });
            }

            function selectEvenly(points, total) {
                if (points.length <= total) return points;
                if (total === 1) return [points[Math.floor(points.length / 2)]];
                const selected = [];
                for (let i = 0; i < total; i++) {
                    const index = Math.round(i * (points.length - 1) / (total - 1));
                    selected.push(points[index]);
                }
                return selected;
            }

            function buildFillPoints(slide, total) {
                const state = slide.geometry;
                const bounds = state.bounds;
                if (!state.root || !total || !state.fillItems.length || !bounds || bounds.width <= 0 || bounds.height <= 0) return [];
                let candidates = [];
                const area = Math.max(1, bounds.width * bounds.height);
                for (let density = 2; density <= 128; density *= 2) {
                    candidates = [];
                    const step = Math.max(0.1, Math.sqrt(area / (total * density)));
                    let row = 0;
                    for (let y = bounds.top + step / 2; y <= bounds.bottom; y += step) {
                        const stagger = row % 2 ? step / 2 : 0;
                        for (let x = bounds.left + step / 2 + stagger; x <= bounds.right; x += step) {
                            const point = new state.scope.Point(x, y);
                            if (isInsideSlideFill(slide, point)) candidates.push(point);
                        }
                        row++;
                    }
                    if (candidates.length >= total) break;
                }
                return selectEvenly(candidates, total);
            }

            function cyclePoints(points, total) {
                if (!points.length || total <= 0) return [];
                return Array.from({ length: total }, (_, index) => points[index % points.length]);
            }

            function getGeometryPointsForSingleTarget(slide, targetType, totalDots) {
                const state = slide.geometry;
                if (targetType === 'anchor') return cyclePoints(state.anchorPoints, totalDots);
                if (targetType === 'path') {
                    if (!state.pathPointCache.has(totalDots)) {
                        setBoundedCacheEntry(state.pathPointCache, totalDots, buildPathPoints(slide, totalDots), GEOMETRY_POINT_CACHE_LIMIT);
                    }
                    return state.pathPointCache.get(totalDots);
                }
                if (!state.fillPointCache.has(totalDots)) {
                    setBoundedCacheEntry(state.fillPointCache, totalDots, buildFillPoints(slide, totalDots), GEOMETRY_POINT_CACHE_LIMIT);
                }
                return state.fillPointCache.get(totalDots);
            }

            function getGeometryPointsForTarget(slide, targetType, totalDots) {
                const state = slide.geometry;
                if (state.dirty) rebuildSlideGeometry(slide);
                if (!state.root) return [];
                const targetTypes = normalizeTargetTypes(targetType);
                if (!targetTypes.length) return [];
                if (targetTypes.length === 1) return getGeometryPointsForSingleTarget(slide, targetTypes[0], totalDots);
                const perTypeTotal = Math.max(1, Math.ceil(totalDots / targetTypes.length));
                const combined = targetTypes.flatMap(type => getGeometryPointsForSingleTarget(slide, type, perTypeTotal));
                return cyclePoints(selectEvenly(combined, totalDots), totalDots);
            }

            function downscaleImageToDataUrl(img, maxWidth, maxHeight, mimeType = 'image/jpeg') {
                const scale = Math.min(maxWidth / img.naturalWidth, maxHeight / img.naturalHeight, 1);
                const width = Math.max(1, Math.round(img.naturalWidth * scale));
                const height = Math.max(1, Math.round(img.naturalHeight * scale));
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d', { alpha: mimeType === 'image/png' });
                ctx.drawImage(img, 0, 0, width, height);
                const src = mimeType === 'image/png'
                    ? canvas.toDataURL('image/png')
                    : canvas.toDataURL('image/jpeg', 0.86);
                return { src, width, height };
            }

            function createImageRectSvg(width, height) {
                const safeWidth = Math.max(1, Math.round(width));
                const safeHeight = Math.max(1, Math.round(height));
                return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${safeWidth} ${safeHeight}" width="${safeWidth}" height="${safeHeight}"><rect x="0" y="0" width="${safeWidth}" height="${safeHeight}" fill="white" stroke="white" stroke-width="1"/></svg>`;
            }

            function isSupportedImageFile(file) {
                return file && (/^image\/(png|jpeg)$/.test(file.type) || /\.(png|jpe?g)$/i.test(file.name));
            }

            function isSupportedVideoFile(file) {
                return file && (/^video\//.test(file.type) || /\.(mp4|webm|mov)$/i.test(file.name));
            }

            let slideIdCounter = 0;

            function createSlide(name, svg, options = {}) {
                const {
                    type = 'svg',
                    imageSrc = '',
                    videoSrc = '',
                    videoElement = null,
                    duration = 0,
                    naturalWidth = 0,
                    naturalHeight = 0
                } = options;
                const slide = {
                    id: ++slideIdCounter,
                    type,
                    name,
                    fileName: name,
                    svg,
                    imageSrc,
                    videoSrc,
                    videoElement,
                    duration: Number.isFinite(duration) ? duration : 0,
                    naturalWidth: naturalWidth || 0,
                    naturalHeight: naturalHeight || 0,
                    frame: readSvgFrameFromText(svg),
                    geometry: createGeometryState(),
                    screenTargetCache: new Map(),
                    domNode: null,
                    domTemplate: null,
                    gridMaskCache: null,
                    maskBehavior: isMediaSlideType(type) ? 'deferred' : 'immediate'
                };
                rebuildSlideGeometry(slide);
                return slide;
            }

            async function createImageSlideFromFile(file) {
                return new Promise((resolve, reject) => {
                    if (!isSupportedImageFile(file)) {
                        reject(new Error('Unsupported image type'));
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                        const img = new Image();
                        img.onload = () => {
                            const mimeType = /^image\/png$/i.test(file.type) || /\.png$/i.test(file.name) ? 'image/png' : 'image/jpeg';
                            const downscaled = downscaleImageToDataUrl(img, STUDIO_WIDTH, STUDIO_HEIGHT, mimeType);
                            const svg = createImageRectSvg(downscaled.width, downscaled.height);
                            resolve(createSlide(file.name, svg, {
                                type: 'image',
                                imageSrc: downscaled.src,
                                naturalWidth: downscaled.width,
                                naturalHeight: downscaled.height
                            }));
                        };
                        img.onerror = () => reject(new Error('Failed to load image'));
                        img.src = reader.result;
                    };
                    reader.onerror = () => reject(new Error('Failed to read file'));
                    reader.readAsDataURL(file);
                });
            }

            async function createVideoSlideFromFile(file) {
                return new Promise((resolve, reject) => {
                    if (!isSupportedVideoFile(file)) {
                        reject(new Error('Unsupported video type'));
                        return;
                    }
                    const objectURL = URL.createObjectURL(file);
                    const video = document.createElement('video');
                    video.src = objectURL;
                    video.muted = true;
                    video.preload = 'metadata';
                    video.playsInline = true;
                    video.controls = false;
                    video.addEventListener('loadedmetadata', () => {
                        const width = video.videoWidth || STUDIO_WIDTH;
                        const height = video.videoHeight || STUDIO_HEIGHT;
                        const svg = createImageRectSvg(width, height);
                        const slide = createSlide(file.name, svg, {
                            type: 'video',
                            videoSrc: objectURL,
                            videoElement: video,
                            duration: Number.isFinite(video.duration) ? video.duration : 4,
                            naturalWidth: width,
                            naturalHeight: height
                        });
                        resolve(slide);
                    }, { once: true });
                    video.addEventListener('error', () => {
                        URL.revokeObjectURL(objectURL);
                        reject(new Error('Failed to load video'));
                    }, { once: true });
                });
            }

            let slides = [];
            const MAX_SPECIAL_OVERLAYS = 15;
            let specialOverlays = [];
            let specialOverlayBaseOpacity = 1;
            let lastSpecialOverlayOpacity = '';
            let activeSpecialOverlayId = null;
            let missingSlideNames = [];
            let currentSlideIndex = 0;
            let pendingSlideIndex = null;
            let slideOpacity = 0;
            let slideFade = null;
            let holdState = 'idle';
            let activeHoldMode = null;
            let activeHoldCode = null;
            let autoTransition = null;
            let forceState = {
                svgAlpha: 0,
                gridAlpha: 1
            };

            function setForceState(next = {}) {
                const previousSvgAlpha = forceState.svgAlpha;
                const previousGridAlpha = forceState.gridAlpha;
                forceState = {
                    svgAlpha: clamp(next.svgAlpha ?? forceState.svgAlpha, 0, 1),
                    gridAlpha: clamp(next.gridAlpha ?? forceState.gridAlpha, 0, 1)
                };
                if (
                    (Math.abs(forceState.svgAlpha - previousSvgAlpha) > 0.0001 ||
                    Math.abs(forceState.gridAlpha - previousGridAlpha) > 0.0001) &&
                    typeof markAllDotLayersDirty === 'function'
                ) {
                    markAllDotLayersDirty({ update: true, render: false });
                }
            }

            function resetForcesToGrid() {
                setForceState({ svgAlpha: 0, gridAlpha: 1 });
            }

            function getSpecialOverlayName(overlay) {
                return overlay?.name || overlay?.fileName || 'Special SVG';
            }

            function getSpecialOverlayCacheIndex(overlay) {
                return `special:${overlay?.id || overlay?.specialId || 'overlay'}`;
            }

            function normalizeSpecialOverlaySlideList(slideIndexes = []) {
                const seen = new Set();
                return (Array.isArray(slideIndexes) ? slideIndexes : [])
                    .map(value => Math.round(parseFloat(value)))
                    .filter(index => Number.isFinite(index) && index >= 0 && index < slides.length)
                    .filter(index => {
                        if (seen.has(index)) return false;
                        seen.add(index);
                        return true;
                    })
                    .sort((a, b) => a - b);
            }

            function normalizeSpecialOverlayAssignments() {
                const usedSlides = new Set();
                specialOverlays.forEach(overlay => {
                    overlay.assignedSlides = normalizeSpecialOverlaySlideList(overlay.assignedSlides)
                        .filter(slideIndex => {
                            if (usedSlides.has(slideIndex)) return false;
                            usedSlides.add(slideIndex);
                            return true;
                        });
                });
            }

            function getSpecialOverlayAssignedOwner(slideIndex) {
                return specialOverlays.find(overlay => overlay.assignedSlides?.includes(slideIndex)) || null;
            }

            function getActiveSpecialOverlayForSlide(slideIndex) {
                const owner = getSpecialOverlayAssignedOwner(slideIndex);
                return owner && owner.enabled !== false ? owner : null;
            }

            function createSpecialOverlay(name, svg, options = {}) {
                const overlay = createSlide(name, svg, { type: 'special-svg' });
                overlay.specialId = overlay.id;
                overlay.enabled = options.enabled !== false;
                overlay.assignedSlides = normalizeSpecialOverlaySlideList(options.assignedSlides || options.slides || []);
                return overlay;
            }

            function createSpecialOverlayFromState(entry = {}) {
                const overlay = createSpecialOverlay(entry.name || entry.fileName || 'Special SVG', entry.svg || '', {
                    enabled: entry.enabled !== false,
                    assignedSlides: entry.assignedSlides || entry.slides || []
                });
                overlay.fileName = entry.fileName || entry.name || overlay.fileName;
                return overlay;
            }

            function applySpecialOverlayState(entries = []) {
                specialOverlays = (Array.isArray(entries) ? entries : [])
                    .filter(entry => entry && entry.svg)
                    .slice(0, MAX_SPECIAL_OVERLAYS)
                    .map(createSpecialOverlayFromState);
                normalizeSpecialOverlayAssignments();
                clearMaskCache();
                specialOverlays.forEach(overlay => overlay.screenTargetCache?.clear());
                if (typeof targetWarmupToken !== 'undefined') targetWarmupToken++;
                renderCurrentSpecialOverlay();
                renderSpecialOverlayList();
                updateDrawerTitleStates();
            }

            function getSpecialOverlayAssignedSlideCount() {
                return specialOverlays.reduce((sum, overlay) => sum + (overlay.assignedSlides?.length || 0), 0);
            }

            function updateSpecialOverlayStatus() {
                if (!specialOverlayControls?.label || !specialOverlayControls?.status) return;
                const count = specialOverlays.length;
                const assignedCount = getSpecialOverlayAssignedSlideCount();
                specialOverlayControls.label.textContent = count
                    ? `${count}/${MAX_SPECIAL_OVERLAYS} Special SVG${count === 1 ? '' : 's'}`
                    : 'Upload Special SVGs';
                if (specialOverlayControls.file) {
                    specialOverlayControls.file.disabled = count >= MAX_SPECIAL_OVERLAYS;
                }
                if (!count) {
                    specialOverlayControls.status.textContent = 'No special overlays loaded.';
                    return;
                }
                specialOverlayControls.status.textContent =
                    `${count}/${MAX_SPECIAL_OVERLAYS} special overlay${count === 1 ? '' : 's'} · ${assignedCount} slide assignment${assignedCount === 1 ? '' : 's'} · global flicker.`;
            }

            function renderSpecialOverlayList() {
                const list = specialOverlayControls?.list;
                if (!list) return;
                normalizeSpecialOverlayAssignments();
                list.replaceChildren();
                if (!specialOverlays.length) {
                    const empty = document.createElement('div');
                    empty.className = 'special-overlay-empty';
                    empty.textContent = 'Upload SVGs, then assign slide numbers.';
                    list.appendChild(empty);
                    updateSpecialOverlayStatus();
                    return;
                }

                specialOverlays.forEach(overlay => {
                    const row = document.createElement('div');
                    row.className = 'special-overlay-row';
                    row.classList.toggle('hidden-special-overlay', overlay.enabled === false);
                    row.dataset.specialOverlayId = String(overlay.id);

                    const eye = document.createElement('button');
                    eye.type = 'button';
                    eye.className = 'motion-layer-icon-btn layer-visibility-btn special-overlay-eye-btn';
                    setIconButton(eye, overlay.enabled === false ? 'eyeOff' : 'eye', `${getSpecialOverlayName(overlay)} ${overlay.enabled === false ? 'hidden' : 'visible'}`);
                    eye.setAttribute('aria-pressed', String(overlay.enabled !== false));
                    eye.addEventListener('click', event => {
                        event.stopPropagation();
                        setSpecialOverlayEnabled(overlay.id, overlay.enabled === false);
                    });

                    const name = document.createElement('div');
                    name.className = 'special-overlay-file';
                    name.textContent = getSpecialOverlayName(overlay);
                    setNativeTooltip(name, getSpecialOverlayName(overlay));

                    const del = document.createElement('button');
                    del.type = 'button';
                    del.className = 'motion-layer-icon-btn special-overlay-delete-btn';
                    del.textContent = 'X';
                    setNativeTooltip(del, `Delete ${getSpecialOverlayName(overlay)}.`);
                    del.addEventListener('click', event => {
                        event.stopPropagation();
                        deleteSpecialOverlay(overlay.id);
                    });

                    const slideGrid = document.createElement('div');
                    slideGrid.className = 'special-overlay-slide-grid';
                    if (!slides.length) {
                        const empty = document.createElement('div');
                        empty.className = 'special-overlay-empty';
                        empty.textContent = 'No slides.';
                        slideGrid.appendChild(empty);
                    } else {
                        slides.forEach((slide, slideIndex) => {
                            const owner = getSpecialOverlayAssignedOwner(slideIndex);
                            const checked = owner === overlay;
                            const disabled = !!owner && owner !== overlay;
                            const button = document.createElement('button');
                            button.type = 'button';
                            button.className = 'special-slide-check';
                            button.textContent = String(slideIndex + 1);
                            button.disabled = disabled;
                            button.classList.toggle('current-slide', slideIndex === currentSlideIndex);
                            button.setAttribute('role', 'checkbox');
                            button.setAttribute('aria-checked', String(checked));
                            const slideName = slide?.name || slide?.fileName || `Slide ${slideIndex + 1}`;
                            const ownerText = disabled ? ` Assigned to ${getSpecialOverlayName(owner)}.` : '';
                            setNativeTooltip(button, `Slide ${slideIndex + 1}: ${slideName}.${ownerText}`);
                            button.addEventListener('click', event => {
                                event.stopPropagation();
                                setSpecialOverlaySlideAssignment(overlay.id, slideIndex, !checked);
                            });
                            slideGrid.appendChild(button);
                        });
                    }

                    row.append(eye, name, del, slideGrid);
                    list.appendChild(row);
                });
                updateSpecialOverlayStatus();
            }

            function handleSpecialOverlayConfigChanged() {
                normalizeSpecialOverlayAssignments();
                clearMaskCache();
                specialOverlays.forEach(overlay => overlay.screenTargetCache?.clear());
                if (typeof targetWarmupToken !== 'undefined') targetWarmupToken++;
                renderCurrentSpecialOverlay();
                renderSpecialOverlayList();
                updateDrawerTitleStates();
                scheduleMaskWarmup();
                scheduleTargetWarmup();
                refreshAttractorTargetsIfNeeded();
                updateViewStatus();
            }

            function setSpecialOverlayEnabled(overlayId, enabled) {
                const overlay = specialOverlays.find(item => item.id === overlayId);
                if (!overlay) return;
                overlay.enabled = !!enabled;
                handleSpecialOverlayConfigChanged();
            }

            function setSpecialOverlaySlideAssignment(overlayId, slideIndex, selected) {
                const target = specialOverlays.find(item => item.id === overlayId);
                if (!target) return;
                specialOverlays.forEach(overlay => {
                    overlay.assignedSlides = (overlay.assignedSlides || []).filter(index => index !== slideIndex);
                });
                if (selected) {
                    target.assignedSlides = normalizeSpecialOverlaySlideList([...(target.assignedSlides || []), slideIndex]);
                }
                handleSpecialOverlayConfigChanged();
            }

            function deleteSpecialOverlay(overlayId) {
                const index = specialOverlays.findIndex(item => item.id === overlayId);
                if (index < 0) return;
                const [removed] = specialOverlays.splice(index, 1);
                removed.domNode?.remove?.();
                removed.domTemplate = null;
                handleSpecialOverlayConfigChanged();
                if (typeof showUiToast === 'function') showUiToast(`Deleted special overlay: ${getSpecialOverlayName(removed)}.`);
            }

            async function loadSpecialOverlayFiles(fileList) {
                const selectedFiles = Array.from(fileList || []);
                const files = selectedFiles.filter(file => file.type === 'image/svg+xml' || /\.svg$/i.test(file.name));
                const remaining = Math.max(0, MAX_SPECIAL_OVERLAYS - specialOverlays.length);
                const nextFiles = files.slice(0, remaining);
                let loaded = 0;
                for (const file of nextFiles) {
                    try {
                        const svg = await file.text();
                        if (!svg.trim()) throw new Error('Empty SVG');
                        specialOverlays.push(createSpecialOverlay(file.name, svg, { enabled: true }));
                        loaded++;
                    } catch (error) {
                        console.warn('Special overlay failed to load:', error);
                    }
                }
                handleSpecialOverlayConfigChanged();
                return {
                    selected: selectedFiles.length,
                    supported: files.length,
                    loaded,
                    ignored: Math.max(0, selectedFiles.length - files.length),
                    atLimit: files.length > remaining
                };
            }

            function getSlideMapper(slide) {
                const placement = getSlidePlacement(slide);
                const { frame, widthPx, heightPx, left, top } = placement;
                return point => ({
                    x: left + ((point.x - frame.minX) / frame.width) * widthPx,
                    y: top + ((point.y - frame.minY) / frame.height) * heightPx
                });
            }

            function getSlidePlacement(slide) {
                const frame = slide.frame || { minX: 0, minY: 0, width: 300, height: 150, displayWidth: 300, displayHeight: 150 };
                const controls = getSlideControlsForType(slide?.type);
                const scale = read(controls.scale) / 100;
                const widthPx = frame.displayWidth * scale;
                const heightPx = frame.displayHeight * scale;
                return {
                    frame,
                    scale,
                    widthPx,
                    heightPx,
                    left: STUDIO_CENTER_X + read(controls.offsetX) - widthPx / 2,
                    top: STUDIO_CENTER_Y + read(controls.offsetY) - heightPx / 2
                };
            }

            function getScreenTargetsForSlideLike(slide, targetType, totalDots, scaleMultiplier = 1) {
                if (!slide) return [];
                if (!slide.screenTargetCache) slide.screenTargetCache = new Map();
                const cacheKey = getSlideScreenTargetCacheKey(slide, targetType, totalDots, scaleMultiplier);
                if (slide.screenTargetCache.has(cacheKey)) return slide.screenTargetCache.get(cacheKey);
                const mapper = getSlideMapper(slide);
                const placement = getSlidePlacement(slide);
                const centerX = placement.left + placement.widthPx / 2;
                const centerY = placement.top + placement.heightPx / 2;
                const targets = getGeometryPointsForTarget(slide, targetType, totalDots).map(point => {
                    const mapped = mapper(point);
                    if (scaleMultiplier === 1) return mapped;
                    return {
                        x: centerX + (mapped.x - centerX) * scaleMultiplier,
                        y: centerY + (mapped.y - centerY) * scaleMultiplier
                    };
                });
                return setBoundedCacheEntry(slide.screenTargetCache, cacheKey, targets, SCREEN_TARGET_CACHE_LIMIT);
            }

            function getSlideScreenTargets(index, targetType, totalDots, scaleMultiplier = 1) {
                return getScreenTargetsForSlideLike(slides[index], targetType, totalDots, scaleMultiplier);
            }

            function applySlideTransform() {
                slideLayer.style.opacity = slideOpacity;
                setSpecialOverlayBaseOpacity(slideOpacity);
                const slide = slides[currentSlideIndex];
                const node = slide ? ensureSlideDomNode(slide) : null;
                if (!node || !slide) return;
                const placement = getSlidePlacement(slide);
                node.style.position = 'absolute';
                node.style.left = `${placement.left}px`;
                node.style.top = `${placement.top}px`;
                node.style.width = `${placement.frame.displayWidth}px`;
                node.style.height = `${placement.frame.displayHeight}px`;
                node.style.maxWidth = 'none';
                node.style.maxHeight = 'none';
                node.style.transformOrigin = '0 0';
                node.style.transform = `scale(${placement.scale})`;
                node.style.opacity = '1';
                node.style.visibility = 'visible';
                applySpecialOverlayTransform();
            }

            function setSpecialOverlayBaseOpacity(value) {
                specialOverlayBaseOpacity = value > 0.5 ? 1 : 0;
                updateSpecialOverlayOpacity(performance.now());
            }

            function getContinuousSpecialOverlayFlicker(timestamp = performance.now(), overlay = null) {
                if (!overlay) return 0;
                const settings = getAutoSettings();
                const onSeconds = Math.max(0.015, settings.flickerOn / 1000);
                const offSeconds = Math.max(0.015, settings.flickerOff / 1000);
                const cycle = Math.max(0.03, onSeconds + offSeconds);
                const time = timestamp / 1000;
                const cycleIndex = Math.floor(time / cycle);
                const jitter = clamp(settings.flickerRandom, 0, 100) / 100;
                const seed = (overlay.id || 1) * 19.73 + cycleIndex * 37.19;
                const phase = (time + (pseudoRandom(seed) - 0.5) * cycle * 0.18 * jitter) % cycle;
                const balance = clamp(onSeconds / cycle + (pseudoRandom(seed + 11.7) - 0.5) * 0.18 * jitter, 0.05, 0.95);
                return phase / cycle <= balance ? 1 : 0;
            }

            function updateSpecialOverlayOpacity(timestamp = performance.now()) {
                if (!specialSvgLayer) return;
                const overlay = getActiveSpecialOverlayForSlide(currentSlideIndex);
                if (!overlay || activeSpecialOverlayId !== overlay.id) {
                    if (lastSpecialOverlayOpacity !== '0') {
                        specialSvgLayer.style.opacity = '0';
                        lastSpecialOverlayOpacity = '0';
                    }
                    return;
                }
                const flicker = autoTransition ? 1 : getContinuousSpecialOverlayFlicker(timestamp, overlay);
                const nextOpacity = String(specialOverlayBaseOpacity * flicker);
                if (nextOpacity !== lastSpecialOverlayOpacity) {
                    specialSvgLayer.style.opacity = nextOpacity;
                    lastSpecialOverlayOpacity = nextOpacity;
                }
            }

            function applySpecialOverlayTransform() {
                if (!specialSvgLayer) return;
                const overlay = getActiveSpecialOverlayForSlide(currentSlideIndex);
                const node = overlay ? ensureSlideDomNode(overlay) : null;
                if (!node || !overlay || activeSpecialOverlayId !== overlay.id) return;
                const placement = getSlidePlacement(overlay);
                node.style.position = 'absolute';
                node.style.left = `${placement.left}px`;
                node.style.top = `${placement.top}px`;
                node.style.width = `${placement.frame.displayWidth}px`;
                node.style.height = `${placement.frame.displayHeight}px`;
                node.style.maxWidth = 'none';
                node.style.maxHeight = 'none';
                node.style.transformOrigin = '0 0';
                node.style.transform = `scale(${placement.scale})`;
                node.style.opacity = '1';
                node.style.visibility = 'visible';
            }

            function renderCurrentSpecialOverlay() {
                if (!specialSvgLayer) return;
                const overlay = getActiveSpecialOverlayForSlide(currentSlideIndex);
                if (!overlay) {
                    activeSpecialOverlayId = null;
                    specialSvgLayer.replaceChildren();
                    specialSvgLayer.style.opacity = '0';
                    lastSpecialOverlayOpacity = '0';
                    return;
                }
                const node = ensureSlideDomNode(overlay);
                activeSpecialOverlayId = overlay.id;
                if (node && specialSvgLayer.firstElementChild !== node) {
                    specialSvgLayer.replaceChildren(node);
                }
                applySpecialOverlayTransform();
                updateSpecialOverlayOpacity(performance.now());
            }

            function updateSpecialOverlayFrame(timestamp = performance.now()) {
                if (!specialSvgLayer) return;
                updateSpecialOverlayOpacity(timestamp);
            }

            function pauseVideoSlide(slide, reset = false) {
                if (slide?.type !== 'video') return;
                const video = slide.videoElement || slide.domNode;
                if (!video) return;
                try {
                    video.pause();
                    if (reset) video.currentTime = 0;
                } catch (error) {
                }
            }

            function playVideoSlide(slide, reset = false) {
                if (slide?.type !== 'video') return;
                const video = ensureSlideDomNode(slide);
                if (!video) return;
                try {
                    if (reset) video.currentTime = 0;
                    video.muted = true;
                    video.playsInline = true;
                    video.preload = 'auto';
                    const playPromise = video.play();
                    if (playPromise && typeof playPromise.catch === 'function') {
                        playPromise.catch(() => {});
                    }
                } catch (error) {
                }
            }

            function pauseAllVideos(reset = false) {
                slides.forEach(slide => pauseVideoSlide(slide, reset));
            }

            function renderCurrentSlide(options = {}) {
                pauseAllVideos(false);
                if (!slides.length) {
                    slideLayer.replaceChildren();
                    specialSvgLayer?.replaceChildren();
                    activeSpecialOverlayId = null;
                    slideOpacity = 0;
                    slideLayer.style.opacity = 0;
                    if (specialSvgLayer) {
                        specialSvgLayer.style.opacity = 0;
                        lastSpecialOverlayOpacity = '0';
                    }
                    clearAppliedSlideMask();
                    updateSlideStatus();
                    updateMediaSlideStatus();
                    updateMaskStatus();
                    updateImageMaskStatus();
                    updateDrawerTitleStates();
                    updateSlideControlStatus();
                    renderSpecialOverlayList();
                    return;
                }
                const slide = slides[currentSlideIndex];
                const node = ensureSlideDomNode(slide);
                if (node && slideLayer.firstElementChild !== node) {
                    slideLayer.replaceChildren(node);
                }
                applySlideTransform();
                renderCurrentSpecialOverlay();
                if (!autoTransition && options.autoplayVideo !== false && slide?.type === 'video') {
                    playVideoSlide(slide, false);
                }
                updateSlideStatus();
                updateMediaSlideStatus();
                updateMaskStatus();
                updateImageMaskStatus();
                updateDrawerTitleStates();
                const deferMaskActivation = autoTransition &&
                    autoTransition.deferredMaskTo !== null &&
                    autoTransition.targetIndex === currentSlideIndex &&
                    !autoTransition.deferredMaskApplied;
                if (!maskScaleTransition && !deferMaskActivation) activateSlideMask(currentSlideIndex, { sync: !isPerformanceCriticalMotionActive() });
                scheduleMaskWarmup();
                scheduleTargetWarmup();
                updateViewStatus();
                updateSlideControlStatus();
                renderSpecialOverlayList();
            }

            function getSlideTypeLabel(type) {
                if (type === 'video') return 'Video';
                if (type === 'image') return 'Image';
                return 'SVG';
            }

            function renderSlideButtonGrid() {
                const grid = slideControlControls?.grid;
                if (!grid) return;
                grid.replaceChildren();
                slides.forEach((slide, index) => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'slide-jump-button';
                    if (isSvgSlideType(slide.type)) {
                        button.classList.add('slide-jump-button-svg');
                    } else if (isMediaSlideType(slide.type)) {
                        button.classList.add('slide-jump-button-media');
                    }
                    if (index === currentSlideIndex) {
                        button.classList.add('active-slide-jump-button');
                        button.setAttribute('aria-current', 'true');
                    }
                    button.textContent = String(index + 1);
                    const buttonTitle = `${index + 1}. ${getSlideTypeLabel(slide.type)} · ${slide.name || slide.fileName || 'Untitled slide'}`;
                    if (typeof setNativeTooltip === 'function') setNativeTooltip(button, buttonTitle);
                    else button.title = buttonTitle;
                    button.addEventListener('click', () => {
                        jumpToSlide(index, { autoplayVideo: true });
                    });
                    grid.appendChild(button);
                });
            }

            function updateSlideControlStatus() {
                const controls = slideControlControls;
                if (!controls || !controls.grid) return;
                const current = slides[currentSlideIndex];
                if (!slides.length || !current) {
                    controls.grid.replaceChildren();
                    return;
                }
                renderSlideButtonGrid();
            }

            function jumpToSlide(index, options = {}) {
                pauseAllVideos(true);
                if (autoTransition && typeof stopAutoTransition === 'function') {
                    stopAutoTransition();
                    pauseAllVideos(true);
                } else {
                    autoTransition = null;
                }
                if (!slides.length) {
                    currentSlideIndex = 0;
                    pendingSlideIndex = null;
                    slideOpacity = 0;
                    slideFade = null;
                    holdState = 'idle';
                    activeHoldMode = null;
                    activeHoldCode = null;
                    renderCurrentSlide();
                    updateSlideControlStatus();
                    return;
                }
                const targetIndex = clamp(Math.round(index), 0, slides.length - 1);
                currentSlideIndex = targetIndex;
                pendingSlideIndex = null;
                slideOpacity = 1;
                slideFade = null;
                holdState = 'idle';
                activeHoldMode = null;
                activeHoldCode = null;
                returnSettleCheckElapsed = 0;
                resetForcesToGrid();
                if (typeof dotGroups !== 'undefined') {
                    DOT_LAYER_KEYS.forEach(layerKey => dotGroups[layerKey]?.returnToGrid());
                }
                clearAppliedSlideMask();
                clearMaskCache();
                renderCurrentSlide({ autoplayVideo: false });
                updateSlideStatus();
                updateMediaSlideStatus();
                updateImageSlideStatus();
                updateMaskStatus();
                updateImageMaskStatus();
                updateDrawerTitleStates();
                updateSlideControlStatus();
                const selectedSlide = slides[currentSlideIndex];
                if (options.autoplayVideo !== false && selectedSlide?.type === 'video') {
                    playVideoSlide(selectedSlide, true);
                }
                updateViewStatus();
            }

            function updateSlideStatus() {
                clearUploadWarning(slideControls.label, slideControls.status);
                const svgSlides = slides.filter(slide => isSvgSlideType(slide.type));
                const mediaSlides = slides.filter(slide => isMediaSlideType(slide.type));
                if (!svgSlides.length) {
                    if (missingSlideNames.length) {
                        setUploadWarning(slideControls.label, slideControls.status, 'SVG', missingSlideNames.join(', '));
                    } else {
                        slideControls.label.textContent = 'Upload SVGs';
                        slideControls.status.textContent = slides.length
                            ? `No SVG slides loaded. ${mediaSlides.length} media slide${mediaSlides.length === 1 ? '' : 's'} in sequence.`
                            : 'No SVG slides loaded.';
                    }
                    return;
                }
                slideControls.label.textContent = `${svgSlides.length} SVG slide${svgSlides.length === 1 ? '' : 's'}`;
                const slide = slides[currentSlideIndex];
                const typeLabel =
                    slide?.type === 'image' ? '[IMG] ' :
                    slide?.type === 'video' ? '[VID] ' :
                    '[SVG] ';
                slideControls.status.textContent = `Sequence ${currentSlideIndex + 1}/${slides.length}: ${typeLabel}${slide.name || slide.fileName || 'Untitled slide'}`;
                if (missingSlideNames.length) {
                    slideControls.status.textContent += ` · Missing: ${missingSlideNames.join(', ')}`;
                    slideControls.status.classList.add('upload-missing');
                }
            }

            function updateImageMaskStatus() {
                if (!imageMaskControls.status) return;
                const mediaSlides = slides.filter(slide => isMediaSlideType(slide.type));
                if (!mediaSlides.length) {
                    imageMaskControls.status.textContent = 'Load a media slide to build a media mask.';
                    return;
                }
                const slide = slides[currentSlideIndex];
                if (isMediaSlideType(slide?.type)) {
                    imageMaskControls.status.textContent = `Media mask hides grid homes for slide ${currentSlideIndex + 1}.`;
                    return;
                }
                imageMaskControls.status.textContent = `Media mask ready for ${mediaSlides.length} media slide${mediaSlides.length === 1 ? '' : 's'}.`;
            }

            function updateMediaSlideStatus() {
                if (!mediaControls.label || !mediaControls.status) return;
                clearUploadWarning(mediaControls.label, mediaControls.status);
                const mediaSlides = slides.filter(slide => isMediaSlideType(slide.type));
                updateMediaModeUi();
                if (!mediaSlides.length) {
                    mediaControls.label.textContent = 'Upload Images / Videos';
                    mediaControls.status.textContent = 'No media slides loaded.';
                    updateImageMaskStatus();
                    return;
                }
                const imageCount = mediaSlides.filter(slide => slide.type === 'image').length;
                const videoCount = mediaSlides.filter(slide => slide.type === 'video').length;
                mediaControls.label.textContent =
                    mediaMode === 'videos'
                        ? `${videoCount} video slide${videoCount === 1 ? '' : 's'}`
                        : `${imageCount} image slide${imageCount === 1 ? '' : 's'}`;
                const slide = slides[currentSlideIndex];
                if (isMediaSlideType(slide?.type)) {
                    const label = slide.type === 'video' ? 'video' : 'image';
                    mediaControls.status.textContent =
                        `Sequence ${currentSlideIndex + 1}/${slides.length}: ${slide.name || slide.fileName || `Untitled ${label}`}`;
                } else {
                    mediaControls.status.textContent =
                        `${mediaSlides.length} media slide${mediaSlides.length === 1 ? '' : 's'} in the shared sequence.`;
                }
                updateImageMaskStatus();
            }
            function updateImageSlideStatus() {
                return updateMediaSlideStatus();
            }

            async function loadSlideFiles(fileList) {
                const selectedFiles = Array.from(fileList || []);
                const files = selectedFiles.filter(file => file.type === 'image/svg+xml' || /\.svg$/i.test(file.name));
                if (!files.length) {
                    missingSlideNames = selectedFiles.map(file => file.name).filter(Boolean);
                    updateSlideStatus();
                    updateMediaSlideStatus();
                    updateDrawerTitleStates();
                    updateSlideControlStatus();
                    return;
                }
                const existingMediaSlides = slides.filter(slide => isMediaSlideType(slide.type));
                const nextSlides = [];
                const nextMissing = selectedFiles
                    .filter(file => !files.includes(file))
                    .map(file => file.name)
                    .filter(Boolean);
                for (const file of files) {
                    try {
                        const svg = await file.text();
                        if (!svg.trim()) throw new Error('Empty SVG');
                        nextSlides.push(createSlide(file.name, svg, { type: 'svg' }));
                    } catch (error) {
                        nextMissing.push(file.name);
                    }
                }
                missingSlideNames = nextMissing;
                if (!nextSlides.length) {
                    slides = existingMediaSlides;
                    currentSlideIndex = clamp(currentSlideIndex || 0, 0, Math.max(0, slides.length - 1));
                    renderCurrentSlide();
                    return;
                }
                slides = nextSlides.concat(existingMediaSlides);
                currentSlideIndex = 0;
                pendingSlideIndex = null;
                slideOpacity = 1;
                slideFade = null;
                holdState = 'idle';
                activeHoldMode = null;
                activeHoldCode = null;
                autoTransition = null;
                resetForcesToGrid();
                DOT_LAYER_KEYS.forEach(layerKey => dotGroups[layerKey].returnToGrid());
                clearMaskCache();
                renderCurrentSlide();
                precomputeAllTransitionAssetsSync();
                setAutoStatus(INTERACTION_HELP_TEXT);
                setMorphStatus(`Loaded ${slides.length} slide${slides.length === 1 ? '' : 's'}. Flicker is ready.`);
            }

            async function loadMediaSlideFiles(fileList) {
                const selectedFiles = Array.from(fileList || []);
                const supportedFiles = selectedFiles.filter(file =>
                    isSupportedImageFile(file) || isSupportedVideoFile(file)
                );
                if (!supportedFiles.length) {
                    updateMediaSlideStatus();
                    updateDrawerTitleStates();
                    updateSlideControlStatus();
                    return;
                }
                const first = supportedFiles[0];
                const nextMode = isSupportedVideoFile(first) ? 'videos' : 'images';
                const files = supportedFiles.filter(file =>
                    nextMode === 'videos' ? isSupportedVideoFile(file) : isSupportedImageFile(file)
                );
                const ignoredCount = supportedFiles.length - files.length;
                if (ignoredCount && typeof showUiToast === 'function') {
                    showUiToast(`Mixed media selected. Loaded only ${nextMode}; ignored ${ignoredCount} file${ignoredCount === 1 ? '' : 's'}.`, 'warning');
                }
                const newSlides = [];
                for (const file of files) {
                    try {
                        if (nextMode === 'videos') {
                            newSlides.push(await createVideoSlideFromFile(file));
                        } else {
                            newSlides.push(await createImageSlideFromFile(file));
                        }
                    } catch (error) {
                        console.warn(error);
                    }
                }
                if (!newSlides.length) {
                    updateMediaSlideStatus();
                    updateDrawerTitleStates();
                    updateSlideControlStatus();
                    return;
                }
                mediaMode = nextMode;
                updateMediaModeUi();
                if (nextMode === 'images') {
                    slides
                        .filter(slide => slide.type === 'video')
                        .forEach(slide => disposeVideoSlide(slide));
                }
                slides = slides.filter(slide => {
                    if (nextMode === 'images') return slide.type !== 'video';
                    if (nextMode === 'videos') return slide.type !== 'image';
                    return true;
                });
                const hadSlides = slides.length > 0;
                slides = slides.concat(newSlides);
                if (!hadSlides) currentSlideIndex = 0;
                else currentSlideIndex = clamp(currentSlideIndex || 0, 0, Math.max(0, slides.length - 1));
                pendingSlideIndex = null;
                slideOpacity = 1;
                slideFade = null;
                holdState = 'idle';
                activeHoldMode = null;
                activeHoldCode = null;
                if (autoTransition) stopAutoTransition();
                pauseAllVideos(true);
                resetForcesToGrid();
                DOT_LAYER_KEYS.forEach(layerKey => dotGroups[layerKey].returnToGrid());
                clearMaskCache();
                renderCurrentSlide();
                precomputeAllTransitionAssetsSync();
                setAutoStatus(INTERACTION_HELP_TEXT);
                setMorphStatus(`Loaded ${newSlides.length} ${nextMode === 'videos' ? 'video' : 'image'} slide${newSlides.length === 1 ? '' : 's'}. Flicker is ready.`);
            }
            function loadImageSlideFiles(fileList) {
                return loadMediaSlideFiles(fileList);
            }

            function clearSlides() {
                maskWarmupToken++;
                targetWarmupToken++;
                pauseAllVideos(true);
                slides = slides.filter(slide => isMediaSlideType(slide.type));
                currentSlideIndex = clamp(currentSlideIndex || 0, 0, Math.max(0, slides.length - 1));
                pendingSlideIndex = null;
                missingSlideNames = [];
                slideOpacity = slides.length ? 1 : 0;
                slideFade = null;
                slideControls.file.value = '';
                activeHoldMode = null;
                activeHoldCode = null;
                autoTransition = null;
                resetForcesToGrid();
                DOT_LAYER_KEYS.forEach(layerKey => dotGroups[layerKey].returnToGrid());
                clearAppliedSlideMask();
                clearMaskCache();
                renderCurrentSlide();
                setAutoStatus(INTERACTION_HELP_TEXT);
                setMorphStatus('Load slides, then perform with Left, Right, Space, or Up.');
            }

            function disposeVideoSlide(slide) {
                if (slide?.type !== 'video') return;
                try {
                    slide.videoElement?.pause();
                    slide.videoElement?.removeAttribute('src');
                    slide.videoElement?.load?.();
                } catch (error) {
                }
                if (slide.videoSrc && slide.videoSrc.startsWith('blob:')) {
                    URL.revokeObjectURL(slide.videoSrc);
                }
                slide.videoElement = null;
                slide.domNode = null;
            }

            function clearMediaSlides() {
                maskWarmupToken++;
                targetWarmupToken++;
                pauseAllVideos(true);
                slides.forEach(slide => {
                    if (slide.type === 'video') disposeVideoSlide(slide);
                });
                slides = slides.filter(slide => !isMediaSlideType(slide.type));
                mediaMode = 'images';
                updateMediaModeUi();
                currentSlideIndex = clamp(currentSlideIndex || 0, 0, Math.max(0, slides.length - 1));
                pendingSlideIndex = null;
                slideOpacity = slides.length ? 1 : 0;
                slideFade = null;
                if (mediaControls.file) mediaControls.file.value = '';
                activeHoldMode = null;
                activeHoldCode = null;
                autoTransition = null;
                resetForcesToGrid();
                DOT_LAYER_KEYS.forEach(layerKey => dotGroups[layerKey].returnToGrid());
                clearAppliedSlideMask();
                clearMaskCache();
                renderCurrentSlide();
                setAutoStatus(INTERACTION_HELP_TEXT);
                setMorphStatus('Media slides cleared.');
            }
            function clearImageSlides() {
                return clearMediaSlides();
            }

            class DotGroup {
                constructor(layerKey) {
                    this.layerKey = layerKey;
                    this.dots = [];
                    this.mode = 'grid';
                    this.targets = [];
                    this.updateDirty = true;
                    this.renderDirty = true;
                    this.staticCanvasValid = false;
                    this.rebuildGrid();
                }

                markDirty(options = {}) {
                    const { update = true, render = true } = options;
                    if (update) this.updateDirty = true;
                    if (render) {
                        this.renderDirty = true;
                        this.staticCanvasValid = false;
                    }
                }

                decorateDotRuntimeConstants(dot, index) {
                    const sharedSeed = index + 1;
                    dot.variationPullJitter = (pseudoRandom(dot.seed + 11) - 0.5) * 1.2;
                    dot.variationMassJitter = (pseudoRandom(dot.seed + 17) - 0.5) * 1.4;
                    dot.shuffleEligibility = pseudoRandom(dot.seed + 311);
                    dot.shuffleInitialPhase = pseudoRandom(dot.seed + 97);
                    dot.blinkAffectedSeed = pseudoRandom(sharedSeed + 911);
                    dot.blinkPhaseSeed = pseudoRandom(sharedSeed + 809);
                    dot.blinkOnSeed = sharedSeed * 1.71;
                    dot.blinkOffSeed = sharedSeed * 2.13;
                }

                rebuildGrid() {
                    const cfg = getLayerRuntimeConfig(this.layerKey);
                    const oldDots = this.dots;
                    const points = buildGridPoints(cfg);
                    this.dots = points.map((point, index) => {
                        const old = oldDots[index];
                        const dot = {
                            x: old ? old.x : point.x,
                            y: old ? old.y : point.y,
                            vx: old ? old.vx : 0,
                            vy: old ? old.vy : 0,
                            gridX: point.x,
                            gridY: point.y,
                            size: old ? old.size : cfg.gridSize,
                            targetInfluence: old ? old.targetInfluence : 0,
                            displayInfluence: old ? old.displayInfluence : 0,
                            maskScale: old ? old.maskScale : 1,
                            idleAlpha: old ? old.idleAlpha : 1,
                            targetSlot: old && Number.isFinite(old.targetSlot) ? old.targetSlot : index,
                            shuffleAt: old ? old.shuffleAt : 0,
                            seed: old ? old.seed : Math.random() * 1000
                        };
                        this.decorateDotRuntimeConstants(dot, index);
                        return dot;
                    });
                    this.markDirty();
                }

                updateIdleAlpha(dot, index, cfg, nowSeconds) {
                    if (!cfg.visibilityEnabled || cfg.visibilityProbability <= 0) {
                        dot.idleAlpha = 1;
                        return;
                    }
                    if (cfg.visibilityGridProximity > 0) {
                        const gridDx = dot.x - dot.gridX;
                        const gridDy = dot.y - dot.gridY;
                        if (gridDx * gridDx + gridDy * gridDy > cfg.visibilityGridProximitySq) {
                            dot.idleAlpha = 1;
                            return;
                        }
                    }
                    const affected = dot.blinkAffectedSeed < clamp(cfg.visibilityProbability, 0, 100) / 100;
                    if (!affected) {
                        dot.idleAlpha = 1;
                        return;
                    }
                    const randomness = clamp(cfg.visibilityRandomness, 0, 100) / 100;
                    const baseOn = Math.max(0.03, cfg.visibilityOn);
                    const baseOff = Math.max(0.03, cfg.visibilityOff);
                    const baseCycle = baseOn + baseOff;
                    const phaseSeed = dot.blinkPhaseSeed * baseCycle;
                    const cycleIndex = Math.floor((nowSeconds + phaseSeed) / baseCycle);
                    const onJitter = 1 + (pseudoRandom(dot.blinkOnSeed + cycleIndex * 17.31) - 0.5) * 1.5 * randomness;
                    const offJitter = 1 + (pseudoRandom(dot.blinkOffSeed + cycleIndex * 23.83) - 0.5) * 1.5 * randomness;
                    const onPeriod = Math.max(0.03, baseOn * onJitter);
                    const offPeriod = Math.max(0.03, baseOff * offJitter);
                    const cycle = onPeriod + offPeriod;
                    const phase = (nowSeconds + phaseSeed) % cycle;
                    const hidden = phase > onPeriod;
                    dot.idleAlpha = hidden ? 0 : 1;
                }

                updateDotLook(dot, cfg) {
                    dot.displayInfluence = clamp(dot.targetInfluence, 0, 1);
                    dot.color = cfg.sameColor
                        ? cfg.gridColor
                        : interpolateMidRgbColor(cfg.gridRgb, cfg.midRgb, cfg.targetRgb, dot.displayInfluence, cfg.sizeMidpoint);
                    const midPoint = clamp(cfg.sizeMidpoint, 0.05, 0.95);
                    const t = clamp(dot.displayInfluence, 0, 1);
                    const firstLeg = t <= midPoint;
                    const legT = firstLeg ? t / midPoint : (t - midPoint) / (1 - midPoint);
                    const startSize = firstLeg ? cfg.gridSize : cfg.midSize;
                    const endSize = firstLeg ? cfg.midSize : cfg.targetSize;
                    const baseSize = startSize + (endSize - startSize) * smoothstep(0, 1, legT);
                    let speedResponse = 0;
                    if (cfg.speedSize !== 0) {
                        const speed = Math.sqrt(dot.vx * dot.vx + dot.vy * dot.vy);
                        speedResponse = smoothstep(0, cfg.speedSizeLimit, speed) * cfg.speedSize;
                    }
                    dot.size = clamp(baseSize + speedResponse, 0.5, MAX_DOT_SIZE);
                }

                setAttractorTargets(targets) {
                    this.targets = targets || [];
                    this.mode = 'attract';
                    this.markDirty();
                    const count = this.targets.length;
                    this.dots.forEach((dot, index) => {
                        dot.targetSlot = count ? index % count : index;
                        dot.shuffleAt = 0;
                    });
                }

                getDotTargetIndex(dot, index, targetCount, cfg, nowSeconds) {
                    if (!targetCount) return 0;
                    if (!Number.isFinite(dot.targetSlot)) dot.targetSlot = index % targetCount;
                    const shuffleAmount = clamp(cfg.shuffle, 0, 100) / 100;
                    if (shuffleAmount > 0 && dot.shuffleEligibility < shuffleAmount) {
                        const swapsPerSecond = 0.12 + shuffleAmount * 1.35;
                        if (!dot.shuffleAt) dot.shuffleAt = nowSeconds + dot.shuffleInitialPhase / swapsPerSecond;
                        if (nowSeconds >= dot.shuffleAt) {
                            dot.targetSlot = Math.floor(pseudoRandom(nowSeconds * 13.7 + dot.seed * 19.11) * targetCount);
                            dot.shuffleAt = nowSeconds + (0.28 + pseudoRandom(nowSeconds + dot.seed * 5.71) * 1.8) / swapsPerSecond;
                        }
                    }
                    return Math.abs(Math.floor(dot.targetSlot)) % targetCount;
                }

                returnToGrid() {
                    this.mode = 'grid';
                    this.markDirty({ update: true, render: false });
                }

                isSettledToGrid() {
                    const cfg = getLayerRuntimeConfig(this.layerKey);
                    const settleDistanceSq = cfg.settleDistance * cfg.settleDistance;
                    return this.dots.every(dot => {
                        const dx = dot.x - dot.gridX;
                        const dy = dot.y - dot.gridY;
                        const velocitySq = dot.vx * dot.vx + dot.vy * dot.vy;
                        return dx * dx + dy * dy <= settleDistanceSq && velocitySq <= 0.0064;
                    });
                }

                hasActiveBlink(cfg) {
                    return cfg.visibilityEnabled && cfg.visibilityProbability > 0;
                }

                isRuntimeStaticEligible(cfg, mouseForce) {
                    return !mouseForce &&
                        !this.hasActiveBlink(cfg) &&
                        !maskScaleTransition &&
                        !slideFade &&
                        !autoTransition &&
                        !activeHoldMode &&
                        holdState === 'idle' &&
                        forceState.svgAlpha <= 0.0001 &&
                        forceState.gridAlpha >= 0.9999;
                }

                areDotsGridStatic(cfg) {
                    const settleDistanceSq = cfg.settleDistance * cfg.settleDistance;
                    return this.dots.every(dot => {
                        const dx = dot.x - dot.gridX;
                        const dy = dot.y - dot.gridY;
                        const velocitySq = dot.vx * dot.vx + dot.vy * dot.vy;
                        const targetInfluence = Number.isFinite(dot.targetInfluence) ? Math.abs(dot.targetInfluence) : 0;
                        return dx * dx + dy * dy <= settleDistanceSq &&
                            velocitySq <= 0.0064 &&
                            targetInfluence <= 0.0015 &&
                            !Number.isFinite(dot.maskScaleFrom) &&
                            !Number.isFinite(dot.maskScaleTo);
                    });
                }

                canSkipUpdate(cfg, mouseForce) {
                    if (!this.updateDirty && this.staticCanvasValid && this.isRuntimeStaticEligible(cfg, mouseForce)) return true;
                    return !this.updateDirty && this.isRuntimeStaticEligible(cfg, mouseForce) && this.areDotsGridStatic(cfg);
                }

                canReuseStaticCanvas(cfg) {
                    return this.isRuntimeStaticEligible(cfg, null) && this.areDotsGridStatic(cfg);
                }

                update(deltaTime, nowMs = performance.now(), mouseFrameState = null) {
                    const baseConfig = getLayerRuntimeConfig(this.layerKey);
                    const cfg = baseConfig;
                    if (cfg.hidden) return;
                    const mouseForce = mouseFrameState && (mouseFrameState.strength > 0 || mouseFrameState.svgTargetActive) ? mouseFrameState : null;
                    if (this.canSkipUpdate(cfg, mouseForce)) return;
                    const frameDt = Math.min(deltaTime * 60, 3);
                    const now = nowMs * 0.012;
                    const nowSeconds = nowMs / 1000;
                    const boundaryElasticity = cfg.boundaryElasticity;
                    const gridElasticity = cfg.gridElasticityNormalized;
                    const gridCapture = cfg.gridCapture;
                    const variation = cfg.variationNormalized;
                    const hasVariation = cfg.hasVariation;
                    const svgAlpha = clamp(forceState.svgAlpha, 0, 1);
                    const gridAlpha = clamp(forceState.gridAlpha, 0, 1);
                    this.mode = svgAlpha > 0.02 ? 'attract' : 'grid';
                    const frictionFactor = Math.max(0, 1 - cfg.baseDrag * frameDt);
                    const svgRadius = Math.max(1, cfg.svgRadius);
                    const svgRadiusSq = cfg.svgRadiusSq;
                    const gridRadius = Math.max(1, cfg.gridRadius);
                    const gridRadiusSq = cfg.gridRadiusSq;
                    const settleDistanceSq = cfg.settleDistance * cfg.settleDistance;
                    const svgMouseTarget = mouseForce?.svgTargetActive && mouseForce.svgTargetStrength > 0 ? mouseForce : null;
                    this.dots.forEach((dot, index) => {
                        let fx = 0;
                        let fy = 0;
                        let desiredInfluence = 0;
                        let pullScale = 1;
                        let massScale = 1;
                        let gridHomeX = dot.gridX;
                        let gridHomeY = dot.gridY;
                        if (hasVariation) {
                            pullScale += dot.variationPullJitter * variation;
                            massScale += dot.variationMassJitter * variation;
                        }

                        if ((svgAlpha > 0 || svgMouseTarget) && this.targets && this.targets.length) {
                            const targetIndex = this.getDotTargetIndex(dot, index, this.targets.length, cfg, nowSeconds);
                            const mouseTargetCount = svgMouseTarget
                                ? clamp(Math.round(svgMouseTarget.svgTargetCount || 0), 0, this.targets.length)
                                : 0;
                            const useMouseTarget = mouseTargetCount > 0 && targetIndex < mouseTargetCount;
                            const targetAlpha = useMouseTarget ? Math.max(svgAlpha, svgMouseTarget.svgTargetStrength) : svgAlpha;
                            const baseTarget = useMouseTarget ? svgMouseTarget : this.targets[targetIndex];
                            const dx = baseTarget.x - dot.x;
                            const dy = baseTarget.y - dot.y;
                            const distanceSq = dx * dx + dy * dy;
                            let influence = 0;

                            if (distanceSq < svgRadiusSq) {
                                const distance = Math.max(0.0001, Math.sqrt(distanceSq));
                                const near = clamp(1 - distance / svgRadius, 0, 1);
                                influence = smoothstep(0, 1, near) * targetAlpha;

                                if (influence > 0) {
                                    fx += dx * cfg.pull * 0.04 * influence * Math.max(0.15, pullScale);
                                    fy += dy * cfg.pull * 0.04 * influence * Math.max(0.15, pullScale);

                                    if (cfg.orbit !== 0) {
                                        const nx = dx / distance;
                                        const ny = dy / distance;
                                        const orbitForce = cfg.orbit * (0.16 + near * 0.42) * targetAlpha;
                                        fx += -ny * orbitForce;
                                        fy += nx * orbitForce;
                                    }

                                    if (cfg.targetDampingNormalized > 0) {
                                        const stickyDamp = Math.max(0, 1 - cfg.targetDampingNormalized * near * near * targetAlpha * (0.2 - boundaryElasticity * 0.08) * frameDt);
                                        dot.vx *= stickyDamp;
                                        dot.vy *= stickyDamp;
                                    }
                                }
                            }

                            desiredInfluence = influence;
                        }

                        if (gridAlpha > 0) {
                            const homeX = dot.gridX;
                            const homeY = dot.gridY;
                            gridHomeX = homeX;
                            gridHomeY = homeY;
                            const dx = homeX - dot.x;
                            const dy = homeY - dot.y;
                            const distanceSq = dx * dx + dy * dy;
                            let near = 0;
                            let catchInfluence = 0.18;
                            if (distanceSq <= gridRadiusSq) {
                                const distance = Math.max(0.0001, Math.sqrt(distanceSq));
                                near = clamp(1 - distance / gridRadius, 0, 1);
                                catchInfluence = 0.08;
                            }
                            const influence = (catchInfluence + smoothstep(0, 1, near) * (1 - catchInfluence)) * gridAlpha;
                            fx += dx * cfg.returnPull * 0.065 * influence * Math.max(0.15, pullScale);
                            fy += dy * cfg.returnPull * 0.065 * influence * Math.max(0.15, pullScale);
                            if (gridCapture > 0) {
                                const stickyDamp = Math.max(0, 1 - gridCapture * near * near * gridAlpha * (0.2 - gridElasticity * 0.08) * frameDt);
                                dot.vx *= stickyDamp;
                                dot.vy *= stickyDamp;
                            }
                        }

                        if (mouseForce) {
                            const mdx = mouseForce.x - dot.x;
                            const mdy = mouseForce.y - dot.y;
                            const mouseDistanceSq = mdx * mdx + mdy * mdy;
                            if (mouseDistanceSq < mouseForce.radiusSq) {
                                const mouseDistance = Math.max(0.0001, Math.sqrt(mouseDistanceSq));
                                const near = clamp(1 - mouseDistance / mouseForce.radius, 0, 1);
                                const influence = Math.pow(smoothstep(0, 1, near), mouseForce.softness) * mouseForce.strength;
                                if (influence > 0.0001) {
                                    const direction = mouseForce.mode === 'repel' ? -1 : 1;
                                    const forceScale = mouseForce.mode === 'repel' ? 0.045 : 0.032;
                                    fx += mdx * direction * forceScale * influence;
                                    fy += mdy * direction * forceScale * influence;
                                }
                            }
                        }

                        const invMass = 1 / Math.max(0.1, cfg.mass * Math.max(0.2, massScale));
                        dot.vx = (dot.vx + fx * invMass * frameDt) * frictionFactor;
                        dot.vy = (dot.vy + fy * invMass * frameDt) * frictionFactor;
                        const speedSq = dot.vx * dot.vx + dot.vy * dot.vy;
                        if (speedSq > cfg.maxSpeedSq) {
                            const speed = Math.sqrt(speedSq);
                            dot.vx = dot.vx / speed * cfg.maxSpeed;
                            dot.vy = dot.vy / speed * cfg.maxSpeed;
                        }

                        dot.x += dot.vx * frameDt;
                        dot.y += dot.vy * frameDt;

                        if (dot.x < 0 || dot.x > STUDIO_WIDTH) {
                            dot.x = clamp(dot.x, 0, STUDIO_WIDTH);
                            dot.vx *= -boundaryElasticity * 0.55;
                        }
                        if (dot.y < 0 || dot.y > STUDIO_HEIGHT) {
                            dot.y = clamp(dot.y, 0, STUDIO_HEIGHT);
                            dot.vy *= -boundaryElasticity * 0.55;
                        }

                        if (this.mode === 'grid') {
                            const gridDx = dot.x - gridHomeX;
                            const gridDy = dot.y - gridHomeY;
                            const velocitySq = dot.vx * dot.vx + dot.vy * dot.vy;
                            if (gridDx * gridDx + gridDy * gridDy <= settleDistanceSq && velocitySq <= 0.0064) {
                                dot.x = gridHomeX;
                                dot.y = gridHomeY;
                                dot.vx = 0;
                                dot.vy = 0;
                            }
                        }

                        dot.targetInfluence += (desiredInfluence - dot.targetInfluence) * clamp(0.08 * frameDt, 0, 1);
                        this.updateIdleAlpha(dot, index, cfg, nowSeconds);
                        this.updateDotLook(dot, cfg);
                    });
                    this.updateDirty = false;
                    this.renderDirty = true;
                    this.staticCanvasValid = false;
                }
            }

            const dotGroups = ALL_DOT_LAYER_KEYS.reduce((acc, layerKey) => {
                acc[layerKey] = new DotGroup(layerKey);
                return acc;
            }, {});

            function markDotLayerDirty(layerKey = null, options = {}) {
                const mark = group => group?.markDirty(options);
                if (layerKey) {
                    mark(dotGroups[layerKey]);
                    return;
                }
                DOT_LAYER_KEYS.forEach(key => mark(dotGroups[key]));
            }

            function markAllDotLayersDirty(options = {}) {
                markDotLayerDirty(null, options);
            }

            function setMorphStatus(text) {
                if (morphControls.status) morphControls.status.textContent = text;
                else if (motionLayerControls.status) motionLayerControls.status.textContent = text;
                if (typeof setOverlayStatus === 'function') setOverlayStatus(text);
                else updateViewStatus();
            }

            function startSlideFade(to, duration, purpose) {
                slideFade = {
                    from: slideOpacity,
                    to,
                    elapsed: 0,
                    duration: Math.max(0.01, duration),
                    purpose
                };
            }

            function updateSlideFade(deltaTime) {
                if (!slideFade) return null;
                slideFade.elapsed += deltaTime;
                const progress = clamp(slideFade.elapsed / slideFade.duration, 0, 1);
                setSlideOpacity(slideFade.from + (slideFade.to - slideFade.from) * progress);
                if (progress >= 1) {
                    const completed = slideFade.purpose;
                    slideFade = null;
                    return completed;
                }
                return null;
            }

            function setAutoStatus(text) {
                autoControls.status.textContent = text;
                if (typeof setOverlayStatus === 'function') setOverlayStatus(text);
                else updateViewStatus();
            }

            function getAutoTransitionControlState() {
                return {
                    currentTime: autoControls.currentTime.value,
                    currentFlickerStart: autoControls.currentFlickerStart?.value || '0',
                    nextTime: autoControls.nextTime.value,
                    nextFlickerStart: autoControls.nextFlickerStart?.value || '0',
                    returnGridTime: autoControls.returnGridTime?.value || '0',
                    flickerBias: autoControls.flickerBias.value,
                    flickerSpeed: autoControls.flickerSpeed.value,
                    flickerBalance: autoControls.flickerBalance.value,
                    flickerWildness: autoControls.flickerWildness.value,
                    autoDuration: slideControls.autoDuration?.value || '4'
                };
            }

            function pickAutoStateValue(...values) {
                const picked = values.find(value => value !== undefined && value !== null && value !== '');
                return picked === undefined ? '' : picked;
            }

            function legacyRateToIntervalMs(rate, fallback) {
                const parsed = parseFloat(rate);
                if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
                return String(Math.round(clamp(1000 / parsed, 15, 900) / 5) * 5);
            }

            function deriveFlickerBias(state = {}) {
                const direct = readStateFloat(state.flickerBias, NaN);
                if (Number.isFinite(direct)) return String(direct);
                const outTime = readStateFloat(pickAutoStateValue(state.outFlicker, state.currentFadeDur, state.simpleFadeOutDur), NaN);
                const inTime = readStateFloat(pickAutoStateValue(state.inFlicker, state.newFadeDur, state.simpleFadeInDur), NaN);
                if (!Number.isFinite(outTime) || !Number.isFinite(inTime) || outTime + inTime <= 0) return '6';
                return String(Math.round(clamp(((inTime - outTime) / (outTime + inTime)) * 140, -100, 100)));
            }

            function deriveFlickerSpeed(state = {}) {
                const direct = readStateFloat(state.flickerSpeed, NaN);
                if (Number.isFinite(direct)) return String(direct);
                const onMs = readStateFloat(pickAutoStateValue(state.flickerOn, state.onHold, legacyRateToIntervalMs(state.flickerRate, '75')), 75);
                const offMs = readStateFloat(pickAutoStateValue(state.flickerOff, state.offHold, legacyRateToIntervalMs(state.flickerRate, '25')), 25);
                return String(clamp(1000 / Math.max(30, onMs + offMs), 1, 30).toFixed(1));
            }

            function deriveFlickerBalance(state = {}) {
                const direct = readStateFloat(state.flickerBalance, NaN);
                if (Number.isFinite(direct)) return String(direct);
                const onMs = readStateFloat(pickAutoStateValue(state.flickerOn, state.onHold, legacyRateToIntervalMs(state.flickerRate, '75')), 75);
                const offMs = readStateFloat(pickAutoStateValue(state.flickerOff, state.offHold, legacyRateToIntervalMs(state.flickerRate, '25')), 25);
                return String(Math.round(clamp((onMs / Math.max(1, onMs + offMs)) * 100, 10, 90)));
            }

            function deriveLegacyFlickerStart(phaseDuration, state = {}) {
                const flickerTime = readStateFloat(state.flickerTime, NaN);
                const duration = readStateFloat(phaseDuration, NaN);
                if (!Number.isFinite(flickerTime) || !Number.isFinite(duration)) return '';
                return String(clamp(duration - flickerTime, 0, duration));
            }

            function applyAutoTransitionControlState(state = {}) {
                const currentTime = pickAutoStateValue(state.currentTime, state.manualSvgTime, state.hold, '3');
                const nextTime = pickAutoStateValue(state.nextTime, state.travelTime, '2');
                setControlValue(autoControls.currentTime, currentTime);
                setControlValue(autoControls.currentFlickerStart, pickAutoStateValue(state.currentFlickerStart, state.flickerDelay, deriveLegacyFlickerStart(currentTime, state), '0'));
                setControlValue(autoControls.nextTime, nextTime);
                setControlValue(autoControls.nextFlickerStart, pickAutoStateValue(state.nextFlickerStart, state.flickerDelay, deriveLegacyFlickerStart(nextTime, state), '0'));
                setControlValue(autoControls.returnGridTime, pickAutoStateValue(state.returnGridTime, state.gridTime, '0'));
                setControlValue(autoControls.flickerBias, deriveFlickerBias(state));
                setControlValue(autoControls.flickerSpeed, deriveFlickerSpeed(state));
                setControlValue(autoControls.flickerBalance, deriveFlickerBalance(state));
                setControlValue(autoControls.flickerWildness, pickAutoStateValue(state.flickerWildness, state.flickerRandom, '100'));
                setControlValue(slideControls.autoDuration, pickAutoStateValue(state.autoDuration, state.slideAutoDuration, '4'));
                syncTimingControlRanges();
                invalidateAutoSettingsCache();
            }

            let cachedAutoSettingsKey = '';
            let cachedAutoSettings = null;

            function getAutoSettingsCacheKey() {
                return [
                    getControlValue(autoControls.currentTime),
                    getControlValue(autoControls.currentFlickerStart),
                    getControlValue(autoControls.nextTime),
                    getControlValue(autoControls.nextFlickerStart),
                    getControlValue(autoControls.returnGridTime),
                    getControlValue(autoControls.flickerBias),
                    getControlValue(autoControls.flickerSpeed),
                    getControlValue(autoControls.flickerBalance),
                    getControlValue(autoControls.flickerWildness)
                ].join('|');
            }

            function invalidateAutoSettingsCache() {
                cachedAutoSettingsKey = '';
                cachedAutoSettings = null;
            }

            function getAutoSettings() {
                const cacheKey = getAutoSettingsCacheKey();
                if (cachedAutoSettings && cachedAutoSettingsKey === cacheKey) return cachedAutoSettings;
                const flickerBias = read(autoControls.flickerBias) / 100;
                const flickerSpeed = read(autoControls.flickerSpeed);
                const flickerBalance = read(autoControls.flickerBalance) / 100;
                const flickerWildness = read(autoControls.flickerWildness);
                const cycleMs = clamp(1000 / Math.max(0.01, flickerSpeed), 30, 1800);
                const rawCurrentTime = Math.max(0.1, read(autoControls.currentTime));
                const rawNextTime = Math.max(0.1, read(autoControls.nextTime));
                const returnGridTime = clamp(readStateFloat(getControlValue(autoControls.returnGridTime), 0), 0, 8);
                const currentTime = rawCurrentTime;
                const nextTime = rawNextTime;
                const currentFlickerStart = clamp(read(autoControls.currentFlickerStart), 0, rawCurrentTime);
                const nextFlickerStart = clamp(read(autoControls.nextFlickerStart), 0, rawNextTime);
                const currentFlickerWindow = Math.max(0.05, currentTime - currentFlickerStart);
                const nextFlickerWindow = Math.max(0.05, nextTime - nextFlickerStart);
                cachedAutoSettingsKey = cacheKey;
                cachedAutoSettings = {
                    currentTime,
                    currentFlickerStart,
                    nextTime,
                    nextFlickerStart,
                    returnGridTime,
                    outFlicker: Math.max(0.05, currentFlickerWindow * (1 - flickerBias * 0.35)),
                    inFlicker: Math.max(0.05, nextFlickerWindow * (1 + flickerBias * 0.35)),
                    flickerOn: clamp(cycleMs * flickerBalance, 15, 900),
                    flickerOff: clamp(cycleMs * (1 - flickerBalance), 15, 900),
                    flickerRandom: flickerWildness,
                    flickerResolve: clamp(98 - flickerWildness * 0.62, 25, 98)
                };
                return cachedAutoSettings;
            }

            function buildFlickerTimeline(duration, mode, settings, seed = 0) {
                const finalState = mode === 'out' ? 0 : 1;
                const jitter = clamp(settings.flickerRandom, 0, 100) / 100;
                const resolve = clamp(settings.flickerResolve, 0, 100) / 100;
                const onBase = Math.max(0.015, settings.flickerOn / 1000);
                const offBase = Math.max(0.015, settings.flickerOff / 1000);
                const total = Math.max(0.001, duration);
                const timeline = [];
                let cursor = 0;
                let cycle = 0;
                let visible = mode === 'out' ? 1 : 0;
                while (cursor < total && cycle < 1000) {
                    const base = visible ? onBase : offBase;
                    const noise = (pseudoRandom(seed + cycle * 37.719 + (visible ? 11.3 : 19.7)) - 0.5) * 1.8 * jitter;
                    const interval = Math.max(0.012, base * (1 + noise));
                    const end = Math.min(total, cursor + interval);
                    const progress = phaseProgress(end, total);
                    const resolveWindow = smoothstep(0.18, 1, progress);
                    const resolveChance = resolve * resolveWindow;
                    let output = visible;
                    if (pseudoRandom(seed + cycle * 71.13 + Math.floor(progress * 12) * 3.7) < resolveChance) output = finalState;
                    if (progress > 0.88 + (1 - resolve) * 0.1) output = finalState;
                    timeline.push({ end, visible: output ? 1 : 0 });
                    cursor = end;
                    visible = visible ? 0 : 1;
                    cycle++;
                }
                timeline.push({ end: total + 1, visible: finalState });
                return timeline;
            }

            function sampleFlickerTimeline(time, duration, timeline, mode) {
                const finalState = mode === 'out' ? 0 : 1;
                if (phaseProgress(time, duration) >= 0.995) return finalState;
                if (time <= 0.001) return mode === 'out' ? 1 : 0;
                for (let i = 0; i < timeline.length; i++) {
                    if (time <= timeline[i].end) return timeline[i].visible;
                }
                return finalState;
            }

            function setAutoPhase(phase, phaseTargetIndex = null) {
                if (!autoTransition) return;
                autoTransition.phase = phase;
                autoTransition.timer = 0;
                autoTransition.flags = {};
                autoTransition.phaseTargetIndex = phaseTargetIndex;
                autoTransition.phaseStarted = false;
            }

            function stopAutoTransition(resetDots = true) {
                pauseAllVideos(false);
                autoTransition = null;
                activeHoldMode = null;
                activeHoldCode = null;
                pendingSlideIndex = null;
                slideFade = null;
                if (resetDots) {
                    holdState = 'return';
                    DOT_LAYER_KEYS.forEach(layerKey => dotGroups[layerKey].returnToGrid());
                    resetDotMaskScales(1);
                    resetForcesToGrid();
                }
                if (slides.length) {
                    slideOpacity = 1;
                    renderCurrentSlide();
                    pauseAllVideos(false);
                }
                setAutoStatus(INTERACTION_HELP_TEXT);
            }

            function startAutoTransition(direction = 1, options = {}) {
                if (!slides.length) {
                    setAutoStatus('Upload at least one slide first.');
                    return;
                }
                if (activeHoldMode && activeHoldMode !== 'auto') {
                    setAutoStatus('Release Space or Up hold before running Flicker.');
                    return;
                }
                if (autoTransition) {
                    if (options.interruptActive) {
                        stopAutoTransition(false);
                    } else {
                        setAutoStatus('Flicker is already running. Press Esc to stop.');
                        return;
                    }
                }

                const fromIndex = currentSlideIndex;
                const targetIndex = getWrappedSlideIndex(direction);
                const skipCurrentLock = options.skipCurrentLock === true;
                if (!areTransitionAssetsReady(targetIndex)) {
                    scheduleTransitionPrewarm();
                    setAutoStatus(`Preparing slide ${targetIndex + 1} before transition. Try again in a moment.`);
                    setMorphStatus('Preparing the next slide mask and targets before animation starts.');
                    return;
                }
                const sourceSlide = slides[fromIndex];
                const targetSlide = slides[targetIndex];
                const specialTransitionPlan = getSpecialTransitionPlan(fromIndex, targetIndex);
                const mediaTransitionMode = isMediaSlideType(sourceSlide?.type) ? getMediaTransitionMode() : 'full';
                const needsDeferredMask = sourceSlide?.maskBehavior === 'deferred' || targetSlide?.maskBehavior === 'deferred';
                let deferredMaskFrom = null;
                let deferredMaskTo = null;
                if (needsDeferredMask) {
                    deferredMaskFrom = fromIndex;
                    deferredMaskTo = targetIndex;
                } else {
                    transitionSlideMask(fromIndex, targetIndex);
                }
                const settings = getAutoSettings();
                const flickerSeed = Math.random() * 10000;
                autoTransition = {
                    type: 'flicker',
                    phase: 'currentPhase',
                    timer: 0,
                    flags: {},
                    fromIndex,
                    targetIndex,
                    settings,
                    skipCurrentForceRamp: skipCurrentLock,
                    flickerSeed,
                    outTimeline: buildFlickerTimeline(settings.outFlicker, 'out', settings, flickerSeed),
                    inTimeline: buildFlickerTimeline(settings.inFlicker, 'in', settings, flickerSeed + 193.7),
                    phaseStarted: false,
                    deferredMaskFrom,
                    deferredMaskTo,
                    travelMaskCleared: false,
                    deferredMaskApplied: false,
                    mediaTransitionMode,
                    specialCurrentTarget: specialTransitionPlan.currentTarget,
                    specialNextTarget: specialTransitionPlan.nextTarget
                };
                activeHoldMode = 'auto';
                activeHoldCode = direction > 0 ? 'next' : 'previous';
                pendingSlideIndex = targetIndex;
                slideFade = null;
                slideOpacity = 1;
                applySlideTransform();
                holdState = 'attract';
                resetForcesToGrid();
                beginAutoDotTarget(currentSlideIndex, `Flicker: dots locking to current slide ${currentSlideIndex + 1}.`);
                setMorphStatus(`Flicker started: slide ${currentSlideIndex + 1} to ${targetIndex + 1}.`);
                setAutoStatus(`Flicker from slide ${currentSlideIndex + 1} to slide ${targetIndex + 1}.`);
                if (sourceSlide?.type === 'video') {
                    playVideoSlide(sourceSlide, true);
                }
                if (skipCurrentLock) {
                    pauseVideoSlide(slides[autoTransition.fromIndex], false);
                    if (autoTransition.mediaTransitionMode === 'cut') {
                        finishMediaFrameCutTransition();
                        return;
                    }
                    setForceState({ svgAlpha: 1, gridAlpha: 0 });
                    setAutoStatus('Current slide phase.');
                }
                updateViewStatus();
            }

            function applyDeferredAutoMask(fromVisible = true) {
                if (!autoTransition || autoTransition.deferredMaskTo === null || autoTransition.deferredMaskApplied) return false;
                const applied = transitionSlideMask(autoTransition.deferredMaskFrom, autoTransition.deferredMaskTo, { fromVisible });
                autoTransition.deferredMaskApplied = true;
                return applied;
            }

            function beginAutoDotTarget(slideIndex, statusText, scaleMultiplier = 1) {
                if (!autoTransition || slideIndex === null || slideIndex === undefined) return 0;
                autoTransition.targetSlideIndex = slideIndex;
                autoTransition.dynamicTargetScale = scaleMultiplier;
                holdState = 'attract';
                const targetSource =
                    slideIndex === autoTransition.fromIndex && autoTransition.specialCurrentTarget
                        ? autoTransition.specialCurrentTarget
                        : (slideIndex === autoTransition.targetIndex && autoTransition.specialNextTarget
                            ? autoTransition.specialNextTarget
                            : slideIndex);
                const activeLayers = applyVisibleLayerTargetsForSlide(targetSource, scaleMultiplier, { activateMask: false });
                setAutoStatus(activeLayers ? statusText : 'Transition running; all dot layers are hidden.');
                return activeLayers;
            }

            function revealAutoTargetSlide(statusText = '') {
                if (!autoTransition || autoTransition.revealedNew) return;
                currentSlideIndex = autoTransition.targetIndex;
                pendingSlideIndex = null;
                slideOpacity = 0;
                slideFade = null;
                renderCurrentSlide();
                holdState = 'attract';
                autoTransition.targetSlideIndex = currentSlideIndex;
                autoTransition.revealedNew = true;
                if (statusText) setAutoStatus(statusText);
                updateViewStatus();
            }

            function finishMediaFrameCutTransition() {
                if (!autoTransition) return;
                const transition = autoTransition;
                pauseVideoSlide(slides[transition.fromIndex], false);
                currentSlideIndex = transition.targetIndex;
                pendingSlideIndex = null;
                slideFade = null;
                slideOpacity = 1;
                if (transition.deferredMaskTo !== null && !transition.deferredMaskApplied) {
                    applyDeferredAutoMask(true);
                }
                renderCurrentSlide({ autoplayVideo: false });
                finishAutoTransition();
            }

            function finishAutoTransition() {
                autoTransition = null;
                activeHoldMode = null;
                activeHoldCode = null;
                pendingSlideIndex = null;
                holdState = 'return';
                returnSettleCheckElapsed = 0;
                DOT_LAYER_KEYS.forEach(layerKey => dotGroups[layerKey].returnToGrid());
                resetForcesToGrid();
                slideOpacity = slides.length ? 1 : 0;
                applySlideTransform();
                pauseAllVideos(false);
                if (slides[currentSlideIndex]?.type === 'video') {
                    playVideoSlide(slides[currentSlideIndex], false);
                }
                setAutoStatus(`Flicker complete. Slide ${currentSlideIndex + 1}/${slides.length}.`);
                requestDeferredWarmups({ mask: true, target: true });
                updateViewStatus();
                updateSlideControlStatus();
            }

            function startAutoNextPhase() {
                if (!autoTransition) return;
                if (autoTransition.mediaTransitionMode !== 'flicker') {
                    beginAutoDotTarget(autoTransition.targetIndex, `Dots moving to slide ${autoTransition.targetIndex + 1}.`);
                }
                revealAutoTargetSlide();
                setSlideOpacity(0);
                applyDeferredAutoMask(true);
                if (autoTransition.deferredMaskTo !== null && !autoTransition.travelMaskCleared) {
                    resetDotMaskScales(1);
                    autoTransition.travelMaskCleared = true;
                }
                setForceState({ svgAlpha: 0, gridAlpha: 0 });
                setAutoPhase('nextPhase');
                setAutoStatus('Next slide phase.');
            }

            function startAutoReturnPhase() {
                if (!autoTransition) return;
                DOT_LAYER_KEYS.forEach(layerKey => dotGroups[layerKey].returnToGrid());
                holdState = 'return';
                setSlideOpacity(1);
                setForceState({ svgAlpha: 1, gridAlpha: 0 });
                setAutoPhase('returnPhase');
                setAutoStatus('Returning dots to grid.');
            }

            function phaseProgress(time, duration) {
                return clamp(time / Math.max(0.001, duration), 0, 1);
            }

            function forceFadeProgress(progress, speed = 1) {
                const safeSpeed = clamp(speed, 0.25, 4);
                return smoothstep(0, 1, Math.pow(clamp(progress, 0, 1), 1 / safeSpeed));
            }

            function samplePhaseFlicker(time, phaseDuration, flickerStart, timeline, flickerDuration, mode) {
                const finalState = mode === 'out' ? 0 : 1;
                if (time >= phaseDuration) return finalState;
                if (time < flickerStart) return mode === 'out' ? 1 : 0;
                return sampleFlickerTimeline(time - flickerStart, flickerDuration, timeline, mode);
            }

            function setSlideOpacity(value) {
                const next = value > 0.5 ? 1 : 0;
                if (Math.abs(next - slideOpacity) < 0.001) {
                    setSpecialOverlayBaseOpacity(next);
                    return;
                }
                slideOpacity = next;
                slideLayer.style.opacity = slideOpacity;
                setSpecialOverlayBaseOpacity(slideOpacity);
            }

            function updateFlickerTransition(deltaTime, settings) {
                autoTransition.timer += deltaTime;
                if (autoTransition.phase === 'currentPhase') {
                    const progress = phaseProgress(autoTransition.timer, settings.currentTime);
                    const eased = autoTransition.skipCurrentForceRamp ? 1 : forceFadeProgress(progress);
                    setSlideOpacity(samplePhaseFlicker(
                        autoTransition.timer,
                        settings.currentTime,
                        settings.currentFlickerStart,
                        autoTransition.outTimeline,
                        settings.outFlicker,
                        'out'
                    ));
                    setForceState({ svgAlpha: eased, gridAlpha: 0 });
                    if (autoTransition.timer >= settings.currentTime) {
                        pauseVideoSlide(slides[autoTransition.fromIndex], false);
                        if (autoTransition.mediaTransitionMode === 'cut') {
                            finishMediaFrameCutTransition();
                            return;
                        }
                        startAutoNextPhase();
                    }
                    return;
                }

                if (autoTransition.phase === 'nextPhase') {
                    const progress = phaseProgress(autoTransition.timer, settings.nextTime);
                    const eased = forceFadeProgress(progress);
                    setSlideOpacity(samplePhaseFlicker(
                        autoTransition.timer,
                        settings.nextTime,
                        settings.nextFlickerStart,
                        autoTransition.inTimeline,
                        settings.inFlicker,
                        'in'
                    ));
                    setForceState({ svgAlpha: eased, gridAlpha: 0 });
                    if (autoTransition.timer >= settings.nextTime) {
                        setSlideOpacity(1);
                        if (settings.returnGridTime > 0.001) {
                            startAutoReturnPhase();
                            return;
                        }
                        finishAutoTransition();
                    }
                    return;
                }

                if (autoTransition.phase === 'returnPhase') {
                    const progress = phaseProgress(autoTransition.timer, settings.returnGridTime);
                    const eased = forceFadeProgress(progress);
                    setSlideOpacity(1);
                    setForceState({ svgAlpha: 1 - eased, gridAlpha: eased });
                    if (autoTransition.timer >= settings.returnGridTime) {
                        finishAutoTransition();
                    }
                    return;
                }
            }

            function updateAutoTransition(deltaTime) {
                if (!autoTransition) return;
                updateFlickerTransition(deltaTime, autoTransition.settings || getAutoSettings());
            }

            function getWrappedSlideIndex(direction) {
                return (currentSlideIndex + direction + slides.length) % slides.length;
            }

            function formatOverlayCount(value) {
                return Number.isFinite(value) ? String(value) : '-';
            }

            function getOverlayRuntimeInfo() {
                const slide = slides[currentSlideIndex];
                const rawName = slide ? (slide.name || slide.fileName || `Slide ${currentSlideIndex + 1}`) : 'No slide';
                const typePrefix = slide?.type === 'image'
                    ? 'IMG '
                    : slide?.type === 'video'
                        ? 'VID '
                        : (slide ? 'SVG ' : '');
                const typeLabel = slide?.type === 'video'
                    ? 'Video'
                    : slide?.type === 'image'
                    ? 'Image'
                    : (slide ? 'SVG' : 'None');
                const slideNameRaw = `${typePrefix}${rawName}`;
                const slideName = slideNameRaw.length > 24 ? `${slideNameRaw.slice(0, 21)}...` : slideNameRaw;
                const imageNameRaw = imageState.name || imageState.fileName || '';
                const imageName = imageNameRaw ? `${imageNameRaw.length > 22 ? `${imageNameRaw.slice(0, 19)}...` : imageNameRaw}${imageState.hidden ? ' hidden' : ''}` : '';
                const action = autoTransition
                    ? `auto ${autoTransition.phase}${autoTransition.mediaTransitionMode && autoTransition.mediaTransitionMode !== 'full' ? `:${autoTransition.mediaTransitionMode}` : ''}`
                    : activeHoldMode
                    ? `hold ${activeHoldMode}`
                    : holdState;
                const transitionState = autoTransition
                    ? 'Moving'
                    : holdState === 'attract' || activeHoldMode
                    ? 'Holding'
                    : holdState === 'return'
                    ? 'Returning'
                    : 'Idle';
                const phaseDuration = autoTransition?.settings
                    ? autoTransition.phase === 'currentPhase'
                        ? autoTransition.settings.currentTime
                        : autoTransition.phase === 'nextPhase'
                        ? autoTransition.settings.nextTime
                        : autoTransition.phase === 'returnPhase'
                        ? autoTransition.settings.returnGridTime
                        : 0
                    : 0;
                const timer = autoTransition
                    ? `${autoTransition.timer.toFixed(1)}/${Math.max(0, phaseDuration).toFixed(1)}s`
                    : '-';
                const maskProgress = maskScaleTransition
                    ? `${Math.round(clamp(maskScaleTransition.elapsed / Math.max(0.001, maskScaleTransition.duration), 0, 1) * 100)}%`
                    : '';
                const mask = maskScaleTransition
                    ? `scaling ${maskProgress}`
                    : activeMaskSlideIndex !== null
                    ? (activeMaskLabel || (Number.isFinite(activeMaskSlideIndex) ? `slide ${activeMaskSlideIndex + 1}` : 'special overlay'))
                    : 'clear';
                const visibleLayerCount = DOT_LAYER_KEYS.filter(layerKey => !dotLayerStates[layerKey]?.hidden).length;
                const dotCount = typeof dotGroups === 'undefined'
                    ? '-'
                    : DOT_LAYER_KEYS.reduce((sum, layerKey) => sum + (dotGroups[layerKey]?.dots?.length || 0), 0);
                const statusSources = [
                    autoControls.status?.textContent,
                    maskControls.status?.textContent,
                    imageMaskControls.status?.textContent,
                    slideControls.status?.textContent,
                    imageSlideControls.status?.textContent,
                    imageControls.status?.textContent,
                    gridControls.status?.textContent,
                    blinkControls.status?.textContent,
                    motionLayerControls.status?.textContent,
                    presetStatus?.textContent
                ].filter(Boolean);
                const rawStatus = overlayStatusText || statusSources.find(text => text && !/^No image loaded\.$/.test(text)) || '';
                const status = rawStatus.length > 52 ? `${rawStatus.slice(0, 49)}...` : rawStatus;
                const oldIndex = autoTransition?.fromIndex ?? currentSlideIndex;
                const newIndex = autoTransition?.targetIndex ?? (slides.length > 1 ? getWrappedSlideIndex(1) : currentSlideIndex);
                const cacheTargetIndex = autoTransition?.targetIndex ?? currentSlideIndex;
                const cache = !slides.length
                    ? 'Missing'
                    : areTransitionAssetsReady(cacheTargetIndex)
                    ? 'Ready'
                    : (maskWarmupActive || pendingMaskWarmup || pendingTargetWarmup ? 'Warming' : 'Missing');
                const readMaskCount = slideIndex => {
                    const targetSlide = slides[slideIndex];
                    if (!targetSlide) return null;
                    const cache = getVisualMaskCacheForSlide(slideIndex);
                    return getMaskDotCountFromCache(cache) ?? 0;
                };
                const oldMaskDots = readMaskCount(oldIndex);
                const newMaskDots = readMaskCount(newIndex);
                const svgCount = slides.filter(item => isSvgSlideType(item.type)).length;
                const imageCount = slides.filter(item => item.type === 'image').length;
                const videoCount = slides.filter(item => item.type === 'video').length;
                return {
                    slideIndex: slides.length ? currentSlideIndex + 1 : 0,
                    slideTotal: slides.length,
                    slideName,
                    typeLabel,
                    autoplay: headerAutoplayActive ? 'On' : 'Off',
                    transitionState,
                    activeLayer: typeof getLayerLabel === 'function' ? getLayerLabel(activeLayerKey) : activeLayerKey,
                    action,
                    timer,
                    mask,
                    dotCount,
                    layers: `${visibleLayerCount}/${DOT_LAYER_KEYS.length}`,
                    mediaMode: `${mediaMode === 'videos' ? 'video' : 'image'}:${getMediaTransitionModeLabel()}`,
                    cache,
                    svgCount,
                    imageCount,
                    videoCount,
                    anchorCount: slide?.geometry?.anchorPoints?.length || 0,
                    oldMaskDots: formatOverlayCount(oldMaskDots),
                    newMaskDots: formatOverlayCount(newMaskDots),
                    imageName,
                    status
                };
            }

            function beginHoldAdvance(direction = 1, code = 'button-next', options = {}) {
                pauseAllVideos(true);
                const manualAdvance = code !== 'header-auto';
                const skipCurrentLock = options.skipCurrentLock !== undefined
                    ? options.skipCurrentLock
                    : manualAdvance;
                startAutoTransition(direction, {
                    skipCurrentLock,
                    interruptActive: manualAdvance
                });
            }

            function releaseHoldAdvance(code = null) {
                if (activeHoldMode === 'auto') {
                    setMorphStatus('Flicker is timed; Esc stops it.');
                }
            }

            function beginHoldCurrentSlide(code = 'Space') {
                if (!slides.length) {
                    setMorphStatus('Upload at least one slide first.');
                    return;
                }
                if (activeHoldMode) return;
                activeHoldMode = 'current';
                activeHoldCode = code;
                pendingSlideIndex = null;
                slideFade = null;
                slideOpacity = 1;
                applySlideTransform();
                activateSlideMask(currentSlideIndex, { sync: true });
                const activeLayers = applyVisibleLayerTargetsForSlide(currentSlideIndex);
                setForceState({ svgAlpha: 1, gridAlpha: 0 });
                holdState = 'attract';
                const slide = slides[currentSlideIndex];
                setMorphStatus(activeLayers
                    ? `Holding: visible layers attracted to current slide ${currentSlideIndex + 1}${slide ? ` (${slide.name})` : ''}.`
                    : 'All dot layers are hidden.');
            }

            function releaseHoldCurrentSlide(code = null) {
                if (activeHoldMode !== 'current') return;
                if (code && activeHoldCode && code !== activeHoldCode) return;
                activeHoldMode = null;
                activeHoldCode = null;
                pendingSlideIndex = null;
                holdState = 'return';
                returnSettleCheckElapsed = 0;
                DOT_LAYER_KEYS.forEach(layerKey => dotGroups[layerKey].returnToGrid());
                resetForcesToGrid();
                activateSlideMask(currentSlideIndex, { sync: true });
                slideOpacity = 1;
                applySlideTransform();
                setMorphStatus(`Returning dots to grid; slide ${currentSlideIndex + 1} stays visible.`);
            }

            function updateHoldMachine(deltaTime) {
                updateSlideFade(deltaTime);
                if (!autoTransition && holdState === 'return' && !slideFade) {
                    returnSettleCheckElapsed += deltaTime;
                    if (returnSettleCheckElapsed >= RETURN_SETTLE_CHECK_INTERVAL) {
                        returnSettleCheckElapsed = 0;
                        if (DOT_LAYER_KEYS.every(layerKey => {
                            const cfg = getLayerRuntimeConfig(layerKey);
                            return cfg.hidden || dotGroups[layerKey].isSettledToGrid();
                        })) {
                            holdState = 'idle';
                            setMorphStatus(`Slide ${currentSlideIndex + 1}/${slides.length || 1}. Left/Right run Flicker; Space pulls current; Up hides UI; Down restores it.`);
                            flushDeferredWarmups();
                        }
                    }
                }
                if (holdState === 'idle') flushDeferredWarmups();
            }

            function drawDotLayer(layerKey) {
                const group = dotGroups[layerKey];
                if (!group) return;
                if (!group.renderDirty && group.staticCanvasValid) return;
                const canvas = dotLayerCanvases.get(layerKey);
                const ctx = dotLayerContexts.get(layerKey);
                if (!canvas || !ctx) return;
                resizeCanvas(canvas, ctx);
                const cfg = getLayerRuntimeConfig(layerKey);
                if (cfg.hidden) return;
                ctx.save();
                ctx.globalCompositeOperation = 'source-over';
                let lastFillStyle = null;
                const twoPi = Math.PI * 2;
                const minMaskRadius = 0.1;
                dotGroups[layerKey].dots.forEach(dot => {
                    const maskScale = Number.isFinite(dot.maskScale) ? dot.maskScale : 1;
                    if (maskScale <= 0.001) return;
                    const idleVisible = !Number.isFinite(dot.idleAlpha) || dot.idleAlpha > 0.5;
                    if (!idleVisible) return;
                    const fillStyle = dot.color || cfg.gridColor;
                    const scale = clamp(maskScale, 0, 1);
                    const radius = scale >= 1 ? dot.size : Math.max(minMaskRadius, dot.size * scale);
                    if (radius <= 0.05) return;
                    if (fillStyle !== lastFillStyle) {
                        ctx.fillStyle = fillStyle;
                        lastFillStyle = fillStyle;
                    }
                    ctx.beginPath();
                    ctx.arc(dot.x, dot.y, radius, 0, twoPi);
                    ctx.fill();
                });
                ctx.restore();
                group.renderDirty = false;
                group.staticCanvasValid = group.canReuseStaticCanvas(cfg);
            }

            function drawMorphDots() {
                DOT_LAYER_KEYS.forEach(drawDotLayer);
            }
