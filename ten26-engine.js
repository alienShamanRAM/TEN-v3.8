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

            function resetDotMaskAlphas(value = 1) {
                maskAlphaTransition = null;
                DOT_LAYER_KEYS.forEach(layerKey => {
                    dotGroups[layerKey].dots.forEach(dot => {
                        dot.maskAlpha = value;
                        clearDotMaskTweenState(dot);
                    });
                });
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
                if (!slide.geometry.maskOffsetItems.length) {
                    maskControls.status.textContent = 'Current slide has no readable painted mask.';
                    return;
                }
                const activeIndex = activeMaskSlideIndex ?? currentSlideIndex;
                maskControls.status.textContent = `Painted slide mask hides grid homes for slide ${activeIndex + 1}.`;
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
            let maskAlphaTransition = null;
            let returnSettleCheckElapsed = 0;
            const RETURN_SETTLE_CHECK_INTERVAL = 0.08;

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

            function getReadySlideMaskCache(slideIndex, mask = null) {
                const slide = slides[slideIndex];
                if (!slide || !slide.geometry.maskOffsetItems.length || typeof dotGroups === 'undefined') return null;
                const effectiveMask = mask || getMaskState(slide.type);
                const key = getMaskCacheKey(slide, effectiveMask, slideIndex);
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

            function isSlideMaskReadyForTransition(slideIndex) {
                const slide = slides[slideIndex];
                if (!slide) return true;
                if (!getMaskState(slide.type).enabled) return true;
                if (!slide || !slide.geometry.maskOffsetItems.length) return true;
                return !!getReadySlideMaskCache(slideIndex);
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

            function createEmptySlideMaskCache(slideIndex) {
                if (typeof dotGroups === 'undefined') return null;
                const signature = getGridMaskSignature();
                const cache = {
                    slideIndex,
                    key: `empty-mask|${slideIndex}|${signature}`,
                    version: maskHitCache.version,
                    signature,
                    layers: {},
                    maskDotCount: 0
                };
                DOT_LAYER_KEYS.forEach(layerKey => {
                    cache.layers[layerKey] = dotGroups[layerKey].dots.map(() => false);
                });
                return cache;
            }

            function buildSlideMaskCacheSync(slideIndex) {
                const slide = slides[slideIndex];
                if (!slide || !slide.geometry.maskOffsetItems.length || typeof dotGroups === 'undefined') return null;
                const mask = getMaskState(slide.type);
                const key = getMaskCacheKey(slide, mask, slideIndex);
                const cache = {
                    slideIndex,
                    key,
                    version: maskHitCache.version,
                    signature: getGridMaskSignature(),
                    layers: {}
                };
                DOT_LAYER_KEYS.forEach(layerKey => {
                    cache.layers[layerKey] = dotGroups[layerKey].dots.map(dot =>
                        isStudioPointInsideExpandedMask(slide, dot.gridX, dot.gridY, mask, key)
                    );
                });
                getMaskDotCountFromCache(cache);
                slide.gridMaskCache = cache;
                return cache;
            }

            function clearDotMaskTweenState(dot) {
                delete dot.maskAlphaFrom;
                delete dot.maskAlphaTo;
            }

            function applySlideMaskCache(cache) {
                maskAlphaTransition = null;
                if (!cache || typeof dotGroups === 'undefined') {
                    resetDotMaskAlphas(1);
                    activeMaskSlideIndex = null;
                    return false;
                }
                DOT_LAYER_KEYS.forEach(layerKey => {
                    const layerMask = cache.layers[layerKey] || [];
                    dotGroups[layerKey].dots.forEach((dot, index) => {
                        const insideFill = !!layerMask[index];
                        dot.maskInsideFill = insideFill;
                        dot.maskCacheKey = cache.key;
                        dot.maskAlpha = insideFill ? 0 : 1;
                        clearDotMaskTweenState(dot);
                    });
                });
                activeMaskSlideIndex = cache.slideIndex;
                return true;
            }

            function clearAppliedSlideMask() {
                maskAlphaTransition = null;
                activeMaskSlideIndex = null;
                resetDotMaskAlphas(1);
            }

            function startSlideMaskScaleTransition(fromCache, toCache, duration = getMaskScaleDuration(slides[toCache?.slideIndex]?.type || 'svg')) {
                if (!toCache || typeof dotGroups === 'undefined') return false;
                if (duration <= 0.001) return applySlideMaskCache(toCache);
                DOT_LAYER_KEYS.forEach(layerKey => {
                    const fromLayer = fromCache?.layers[layerKey] || null;
                    const toLayer = toCache.layers[layerKey] || [];
                    dotGroups[layerKey].dots.forEach((dot, index) => {
                        const fromAlpha = Number.isFinite(dot.maskAlpha) ? dot.maskAlpha : 1;
                        const fromHidden = fromLayer ? !!fromLayer[index] : fromAlpha <= 0.5;
                        const toHidden = !!toLayer[index];
                        dot.maskInsideFill = toHidden;
                        dot.maskCacheKey = toCache.key;
                        dot.maskAlphaFrom = fromHidden ? 0 : 1;
                        dot.maskAlphaTo = toHidden ? 0 : 1;
                        dot.maskAlpha = dot.maskAlphaFrom;
                    });
                });
                activeMaskSlideIndex = toCache.slideIndex;
                maskAlphaTransition = {
                    elapsed: 0,
                    duration,
                    cache: toCache
                };
                return true;
            }

            function transitionSlideMask(fromSlideIndex, toSlideIndex, options = {}) {
                const { fromVisible = false } = options;
                const targetSlide = slides[toSlideIndex];
                const sourceSlide = slides[fromSlideIndex];
                const targetMask = getMaskState(targetSlide?.type || 'svg');
                const sourceMask = getMaskState(sourceSlide?.type || 'svg');
                const targetCache = getReadySlideMaskCache(toSlideIndex, targetMask) ||
                    (!targetSlide || !targetSlide.geometry.maskOffsetItems.length ? createEmptySlideMaskCache(toSlideIndex) : null);
                const fromCache = fromVisible
                    ? createEmptySlideMaskCache(fromSlideIndex)
                    : (getReadySlideMaskCache(fromSlideIndex, sourceMask) ||
                        (!sourceSlide || !sourceSlide.geometry.maskOffsetItems.length ? createEmptySlideMaskCache(fromSlideIndex) : null))
                if (!targetCache) return activateSlideMask(toSlideIndex, { sync: false });
                if (!fromCache && fromSlideIndex !== toSlideIndex && !isSlideMaskReadyForTransition(fromSlideIndex)) {
                    return false;
                }
                return startSlideMaskScaleTransition(fromCache, targetCache);
            }

            function updateMaskAlphaTransitions(deltaTime) {
                if (!maskAlphaTransition) return;
                maskAlphaTransition.elapsed += deltaTime;
                const progress = clamp(maskAlphaTransition.elapsed / Math.max(0.001, maskAlphaTransition.duration), 0, 1);
                const eased = smoothstep(0, 1, progress);
                DOT_LAYER_KEYS.forEach(layerKey => {
                    dotGroups[layerKey].dots.forEach(dot => {
                        const from = Number.isFinite(dot.maskAlphaFrom) ? dot.maskAlphaFrom : (Number.isFinite(dot.maskAlpha) ? dot.maskAlpha : 1);
                        const to = Number.isFinite(dot.maskAlphaTo) ? dot.maskAlphaTo : from;
                        dot.maskAlpha = from + (to - from) * eased;
                    });
                });
                if (progress >= 1) {
                    const cache = maskAlphaTransition.cache;
                    maskAlphaTransition = null;
                    if (cache) {
                        DOT_LAYER_KEYS.forEach(layerKey => {
                            const layerMask = cache.layers[layerKey] || [];
                            dotGroups[layerKey].dots.forEach((dot, index) => {
                                const insideFill = !!layerMask[index];
                                dot.maskInsideFill = insideFill;
                                dot.maskCacheKey = cache.key;
                                dot.maskAlpha = insideFill ? 0 : 1;
                                clearDotMaskTweenState(dot);
                            });
                        });
                        activeMaskSlideIndex = cache.slideIndex;
                    }
                }
            }

            function activateSlideMask(slideIndex = currentSlideIndex, options = {}) {
                const { sync = false } = options;
                const slide = slides[slideIndex];
                const mask = getMaskState(slide?.type || 'svg');
                if (!slide || !slide.geometry.maskOffsetItems.length || typeof dotGroups === 'undefined') {
                    clearAppliedSlideMask();
                    return false;
                }
                let cache = getReadySlideMaskCache(slideIndex, mask);
                if (!cache && sync) cache = buildSlideMaskCacheSync(slideIndex);
                if (cache) return applySlideMaskCache(cache);
                if (activeMaskSlideIndex !== slideIndex) resetDotMaskAlphas(1);
                activeMaskSlideIndex = slideIndex;
                if (!maskWarmupActive) scheduleMaskWarmup();
                return false;
            }

            function createMaskWarmupJob(slideIndex, mask, signature) {
                const slide = slides[slideIndex];
                if (!mask?.enabled) return null;
                if (!slide || !slide.geometry.maskOffsetItems.length || getReadySlideMaskCache(slideIndex, mask)) return null;
                const cache = {
                    slideIndex,
                    key: getMaskCacheKey(slide, mask, slideIndex),
                    version: maskHitCache.version,
                    signature,
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
                const activeSlide = slides[activeMaskSlideIndex];
                const activeMask = activeSlide ? getMaskState(activeSlide.type) : null;
                const readyActiveCache = activeMask?.enabled ? getReadySlideMaskCache(activeMaskSlideIndex, activeMask) : null;
                if (!jobs.length) {
                    if (readyActiveCache) applySlideMaskCache(readyActiveCache);
                    else if (!activeMask?.enabled) clearAppliedSlideMask();
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
                        if (activeMaskSlideIndex === job.cache.slideIndex) applySlideMaskCache(job.cache);
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

            function areSlideTargetsReadyForTransition(slideIndex, scaleMultiplier = 1) {
                if (!slides[slideIndex] || typeof dotGroups === 'undefined') return true;
                return DOT_LAYER_KEYS.every(layerKey => {
                    const cfg = getLayerRuntimeConfig(layerKey);
                    if (cfg.hidden) return true;
                    return hasReadySlideScreenTargets(slideIndex, cfg.targetTypes, getTotalGridDots(cfg), scaleMultiplier);
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

            function areTransitionAssetsReady(targetIndex) {
                return isSlideMaskReadyForTransition(currentSlideIndex) &&
                    isSlideMaskReadyForTransition(targetIndex) &&
                    isSlideRenderReadyForTransition(targetIndex) &&
                    areSlideTargetsReadyForTransition(currentSlideIndex) &&
                    areSlideTargetsReadyForTransition(targetIndex);
            }

            function clearSlideScreenTargetCaches() {
                slides.forEach(slide => slide.screenTargetCache?.clear());
                targetWarmupToken++;
            }

            function scheduleTransitionPrewarm() {
                scheduleMaskWarmup();
                scheduleTargetWarmup();
            }

            function precomputeAllTransitionAssetsSync() {
                scheduleTransitionPrewarm();
            }

            function scheduleTargetWarmup() {
                if (isPerformanceCriticalMotionActive()) {
                    requestDeferredWarmups({ target: true });
                    return;
                }
                const token = ++targetWarmupToken;
                pendingTargetWarmup = false;
                if (!slides.length || activeHoldMode || autoTransition || typeof dotGroups === 'undefined') return;
                const indexes = slides.map((_, slideIndex) => slideIndex);
                const jobs = [];
                indexes.forEach(slideIndex => {
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
                document.getElementById('drawer-trigger-blink-mode')?.classList.toggle('inactive-title', !blinkControls.enabled?.checked);
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
                        state.pathPointCache.set(totalDots, buildPathPoints(slide, totalDots));
                    }
                    return state.pathPointCache.get(totalDots);
                }
                if (!state.fillPointCache.has(totalDots)) {
                    state.fillPointCache.set(totalDots, buildFillPoints(slide, totalDots));
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
                forceState = {
                    svgAlpha: clamp(next.svgAlpha ?? forceState.svgAlpha, 0, 1),
                    gridAlpha: clamp(next.gridAlpha ?? forceState.gridAlpha, 0, 1)
                };
            }

            function resetForcesToGrid() {
                setForceState({ svgAlpha: 0, gridAlpha: 1 });
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

            function getSlideScreenTargets(index, targetType, totalDots, scaleMultiplier = 1) {
                const slide = slides[index];
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
                slide.screenTargetCache.set(cacheKey, targets);
                return targets;
            }

            function applySlideTransform() {
                slideLayer.style.opacity = slideOpacity;
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
                    slideOpacity = 0;
                    slideLayer.style.opacity = 0;
                    clearAppliedSlideMask();
                    updateSlideStatus();
                    updateMediaSlideStatus();
                    updateMaskStatus();
                    updateImageMaskStatus();
                    updateDrawerTitleStates();
                    updateSlideControlStatus();
                    return;
                }
                const slide = slides[currentSlideIndex];
                const node = ensureSlideDomNode(slide);
                if (node && slideLayer.firstElementChild !== node) {
                    slideLayer.replaceChildren(node);
                }
                applySlideTransform();
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
                if (!maskAlphaTransition && !deferMaskActivation) activateSlideMask(currentSlideIndex, { sync: !isPerformanceCriticalMotionActive() });
                scheduleMaskWarmup();
                scheduleTargetWarmup();
                updateViewStatus();
                updateSlideControlStatus();
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
                    this.rebuildGrid();
                }

                rebuildGrid() {
                    const cfg = getLayerRuntimeConfig(this.layerKey);
                    const oldDots = this.dots;
                    const points = buildGridPoints(cfg);
                    this.dots = points.map((point, index) => {
                        const old = oldDots[index];
                        return {
                            x: old ? old.x : point.x,
                            y: old ? old.y : point.y,
                            vx: old ? old.vx : 0,
                            vy: old ? old.vy : 0,
                            gridX: point.x,
                            gridY: point.y,
                            size: old ? old.size : cfg.gridSize,
                            targetInfluence: old ? old.targetInfluence : 0,
                            displayInfluence: old ? old.displayInfluence : 0,
                            maskAlpha: old ? old.maskAlpha : 1,
                            idleAlpha: old ? old.idleAlpha : 1,
                            targetSlot: old && Number.isFinite(old.targetSlot) ? old.targetSlot : index,
                            shuffleAt: old ? old.shuffleAt : 0,
                            seed: old ? old.seed : Math.random() * 1000
                        };
                    });
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
                    const sharedSeed = index + 1;
                    const affected = pseudoRandom(sharedSeed + 911) < clamp(cfg.visibilityProbability, 0, 100) / 100;
                    if (!affected) {
                        dot.idleAlpha = 1;
                        return;
                    }
                    const randomness = clamp(cfg.visibilityRandomness, 0, 100) / 100;
                    const baseOn = Math.max(0.03, cfg.visibilityOn);
                    const baseOff = Math.max(0.03, cfg.visibilityOff);
                    const baseCycle = baseOn + baseOff;
                    const phaseSeed = pseudoRandom(sharedSeed + 809) * baseCycle;
                    const cycleIndex = Math.floor((nowSeconds + phaseSeed) / baseCycle);
                    const onJitter = 1 + (pseudoRandom(sharedSeed * 1.71 + cycleIndex * 17.31) - 0.5) * 1.5 * randomness;
                    const offJitter = 1 + (pseudoRandom(sharedSeed * 2.13 + cycleIndex * 23.83) - 0.5) * 1.5 * randomness;
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
                        const speed = Math.hypot(dot.vx, dot.vy);
                        speedResponse = smoothstep(0, Math.max(0.1, cfg.speedLimit), speed) * cfg.speedSize;
                    }
                    dot.size = clamp(baseSize + speedResponse, 0.5, MAX_DOT_SIZE);
                }

                setAttractorTargets(targets) {
                    this.targets = targets || [];
                    this.mode = 'attract';
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
                    if (shuffleAmount > 0 && pseudoRandom(dot.seed + 311) < shuffleAmount) {
                        const swapsPerSecond = 0.12 + shuffleAmount * 1.35;
                        if (!dot.shuffleAt) dot.shuffleAt = nowSeconds + pseudoRandom(dot.seed + 97) / swapsPerSecond;
                        if (nowSeconds >= dot.shuffleAt) {
                            dot.targetSlot = Math.floor(pseudoRandom(nowSeconds * 13.7 + dot.seed * 19.11) * targetCount);
                            dot.shuffleAt = nowSeconds + (0.28 + pseudoRandom(nowSeconds + dot.seed * 5.71) * 1.8) / swapsPerSecond;
                        }
                    }
                    return Math.abs(Math.floor(dot.targetSlot)) % targetCount;
                }

                returnToGrid() {
                    this.mode = 'grid';
                }

                isSettledToGrid() {
                    const cfg = getLayerRuntimeConfig(this.layerKey);
                    const settleDistance = cfg.settleDistance;
                    return this.dots.every(dot => {
                        const distance = Math.hypot(dot.x - dot.gridX, dot.y - dot.gridY);
                        const velocity = Math.hypot(dot.vx, dot.vy);
                        return distance <= settleDistance && velocity <= 0.08;
                    });
                }

                update(deltaTime, nowMs = performance.now()) {
                    const baseConfig = getLayerRuntimeConfig(this.layerKey);
                    const cfg = baseConfig;
                    if (cfg.hidden) return;
                    const frameDt = Math.min(deltaTime * 60, 3);
                    const now = nowMs * 0.012;
                    const nowSeconds = nowMs / 1000;
                    const boundaryElasticity = clamp(cfg.elasticity, 0, 100) / 100;
                    const gridElasticity = clamp(cfg.gridElasticity ?? cfg.elasticity, 0, 100) / 100;
                    const gridCapture = 1 - gridElasticity;
                    const variation = clamp(cfg.variation, 0, 100) / 100;
                    const hasVariation = variation > 0.001;
                    const svgAlpha = clamp(forceState.svgAlpha, 0, 1);
                    const gridAlpha = clamp(forceState.gridAlpha, 0, 1);
                    this.mode = svgAlpha > 0.02 ? 'attract' : 'grid';
                    const baseDrag = 0.006 + clamp(cfg.friction, 0, 100) * 0.0018;
                    const frictionFactor = Math.max(0, 1 - baseDrag * frameDt);
                    const svgRadius = Math.max(1, cfg.svgRadius);
                    const gridRadius = Math.max(1, cfg.gridRadius);
                    const settleDistanceSq = cfg.settleDistance * cfg.settleDistance;
                    this.dots.forEach((dot, index) => {
                        let fx = 0;
                        let fy = 0;
                        let desiredInfluence = 0;
                        let pullScale = 1;
                        let massScale = 1;
                        let gridHomeX = dot.gridX;
                        let gridHomeY = dot.gridY;
                        if (hasVariation) {
                            pullScale += (pseudoRandom(dot.seed + 11) - 0.5) * 1.2 * variation;
                            massScale += (pseudoRandom(dot.seed + 17) - 0.5) * 1.4 * variation;
                        }

                        if (svgAlpha > 0 && this.targets && this.targets.length) {
                            const targetIndex = this.getDotTargetIndex(dot, index, this.targets.length, cfg, nowSeconds);
                            const baseTarget = this.targets[targetIndex];
                            const dx = baseTarget.x - dot.x;
                            const dy = baseTarget.y - dot.y;
                            const distance = Math.max(0.0001, Math.hypot(dx, dy));
                            const nx = dx / distance;
                            const ny = dy / distance;
                            const near = clamp(1 - distance / svgRadius, 0, 1);
                            const influence = smoothstep(0, 1, near) * svgAlpha;

                            if (influence > 0) {
                                fx += dx * cfg.pull * 0.04 * influence * Math.max(0.15, pullScale);
                                fy += dy * cfg.pull * 0.04 * influence * Math.max(0.15, pullScale);

                                if (cfg.orbit !== 0) {
                                    const orbitForce = cfg.orbit * (0.16 + near * 0.42) * svgAlpha;
                                    fx += -ny * orbitForce;
                                    fy += nx * orbitForce;
                                }

                                if (cfg.targetDamping > 0) {
                                    const targetDamping = clamp(cfg.targetDamping, 0, 100) / 100;
                                    const stickyDamp = Math.max(0, 1 - targetDamping * near * near * svgAlpha * (0.2 - boundaryElasticity * 0.08) * frameDt);
                                    dot.vx *= stickyDamp;
                                    dot.vy *= stickyDamp;
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
                            const distance = Math.max(0.0001, Math.hypot(dx, dy));
                            const near = clamp(1 - distance / gridRadius, 0, 1);
                            const catchInfluence = distance > gridRadius ? 0.18 : 0.08;
                            const influence = (catchInfluence + smoothstep(0, 1, near) * (1 - catchInfluence)) * gridAlpha;
                            fx += dx * cfg.returnPull * 0.065 * influence * Math.max(0.15, pullScale);
                            fy += dy * cfg.returnPull * 0.065 * influence * Math.max(0.15, pullScale);
                            if (gridCapture > 0) {
                                const stickyDamp = Math.max(0, 1 - gridCapture * near * near * gridAlpha * (0.2 - gridElasticity * 0.08) * frameDt);
                                dot.vx *= stickyDamp;
                                dot.vy *= stickyDamp;
                            }
                        }

                        const invMass = 1 / Math.max(0.1, cfg.mass * Math.max(0.2, massScale));
                        dot.vx = (dot.vx + fx * invMass * frameDt) * frictionFactor;
                        dot.vy = (dot.vy + fy * invMass * frameDt) * frictionFactor;
                        const maxSpeed = Math.max(0.05, cfg.speedLimit);
                        const speedSq = dot.vx * dot.vx + dot.vy * dot.vy;
                        const maxSpeedSq = maxSpeed * maxSpeed;
                        if (speedSq > maxSpeedSq) {
                            const speed = Math.sqrt(speedSq);
                            dot.vx = dot.vx / speed * maxSpeed;
                            dot.vy = dot.vy / speed * maxSpeed;
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
                }
            }

            const dotGroups = ALL_DOT_LAYER_KEYS.reduce((acc, layerKey) => {
                acc[layerKey] = new DotGroup(layerKey);
                return acc;
            }, {});

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

            function applyAutoTransitionControlState(state = {}) {
                setControlValue(autoControls.currentTime, pickAutoStateValue(state.currentTime, state.manualSvgTime, state.hold, '3'));
                setControlValue(autoControls.currentFlickerStart, pickAutoStateValue(state.currentFlickerStart, state.flickerDelay, '0'));
                setControlValue(autoControls.nextTime, pickAutoStateValue(state.nextTime, '2'));
                setControlValue(autoControls.nextFlickerStart, pickAutoStateValue(state.nextFlickerStart, state.flickerDelay, '0'));
                setControlValue(autoControls.returnGridTime, pickAutoStateValue(state.returnGridTime, '0'));
                setControlValue(autoControls.flickerBias, deriveFlickerBias(state));
                setControlValue(autoControls.flickerSpeed, deriveFlickerSpeed(state));
                setControlValue(autoControls.flickerBalance, deriveFlickerBalance(state));
                setControlValue(autoControls.flickerWildness, pickAutoStateValue(state.flickerWildness, state.flickerRandom, '100'));
                setControlValue(slideControls.autoDuration, pickAutoStateValue(state.autoDuration, state.slideAutoDuration, '4'));
                syncTimingControlRanges();
            }

            function getAutoSettings() {
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
                return {
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
                    resetDotMaskAlphas(1);
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
                    mediaTransitionMode
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
                const activeLayers = applyVisibleLayerTargetsForSlide(slideIndex, scaleMultiplier, { activateMask: false });
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
                    resetDotMaskAlphas(1);
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
                const next = clamp(value, 0, 1);
                if (Math.abs(next - slideOpacity) < 0.001) return;
                slideOpacity = next;
                slideLayer.style.opacity = slideOpacity;
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
                const maskProgress = maskAlphaTransition
                    ? `${Math.round(clamp(maskAlphaTransition.elapsed / Math.max(0.001, maskAlphaTransition.duration), 0, 1) * 100)}%`
                    : '';
                const mask = maskAlphaTransition
                    ? `scaling ${maskProgress}`
                    : activeMaskSlideIndex !== null
                    ? `slide ${activeMaskSlideIndex + 1}`
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
                    if (!targetSlide.geometry.maskOffsetItems.length) return 0;
                    return getMaskDotCountFromCache(getReadySlideMaskCache(slideIndex, getMaskState(targetSlide.type)));
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
                const canvas = dotLayerCanvases.get(layerKey);
                const ctx = dotLayerContexts.get(layerKey);
                if (!canvas || !ctx) return;
                resizeCanvas(canvas, ctx);
                const cfg = getLayerRuntimeConfig(layerKey);
                if (cfg.hidden) return;
                ctx.save();
                ctx.globalCompositeOperation = 'source-over';
                let lastAlpha = null;
                let lastFillStyle = null;
                const twoPi = Math.PI * 2;
                dotGroups[layerKey].dots.forEach(dot => {
                    const maskAlpha = Number.isFinite(dot.maskAlpha) ? dot.maskAlpha : 1;
                    const idleAlpha = Number.isFinite(dot.idleAlpha) ? dot.idleAlpha : 1;
                    const alpha = maskAlpha * idleAlpha;
                    if (alpha <= 0.01) return;
                    const fillStyle = dot.color || cfg.gridColor;
                    const scale = clamp(maskAlpha, 0, 1);
                    const radius = dot.size * scale;
                    if (radius <= 0.05) return;
                    if (alpha !== lastAlpha) {
                        ctx.globalAlpha = alpha;
                        lastAlpha = alpha;
                    }
                    if (fillStyle !== lastFillStyle) {
                        ctx.fillStyle = fillStyle;
                        lastFillStyle = fillStyle;
                    }
                    ctx.beginPath();
                    ctx.arc(dot.x, dot.y, Math.max(0.1, radius), 0, twoPi);
                    ctx.fill();
                });
                ctx.restore();
            }

            function drawMorphDots() {
                DOT_LAYER_KEYS.forEach(drawDotLayer);
            }
