// TEN26 state serialization, default presets, and import/export helpers.
function getActiveLayerStateFromControls() {
                const current = dotLayerStates[activeLayerKey] || {};
                const gridState = getGridLayerStateFromControls(activeLayerKey);
                const motionState = getMotionLayerStateFromControls(activeLayerKey);
                return {
                    name: current.name || getLayerLabel(activeLayerKey),
                    hidden: current.hidden,
                    cols: gridState.cols,
                    rows: gridState.rows,
                    spacing: gridState.spacing,
                    offsetX: gridState.offsetX,
                    offsetY: gridState.offsetY,
                    targetType: motionState.targetType,
                    targetTypes: motionState.targetTypes,
                    mass: motionState.mass,
                    friction: motionState.friction,
                    speedLimit: motionState.speedLimit,
                    elasticity: motionState.elasticity,
                    returnPull: motionState.returnPull,
                    pull: motionState.pull,
                    svgRadius: motionState.svgRadius,
                    gridRadius: motionState.gridRadius,
                    orbit: motionState.orbit,
                    shuffle: motionState.shuffle,
                    variation: motionState.variation,
                    gridSize: motionState.gridSize,
                    midSize: motionState.midSize,
                    targetSize: motionState.targetSize,
                    sizeMidpoint: motionState.sizeMidpoint,
                    speedSize: motionState.speedSize,
                    visibilityEnabled: motionState.visibilityEnabled,
                    visibilityOn: motionState.visibilityOn,
                    visibilityOff: motionState.visibilityOff,
                    visibilityRandomness: motionState.visibilityRandomness,
                    visibilityProbability: motionState.visibilityProbability,
                    visibilityGridProximity: motionState.visibilityGridProximity,
                    gridColor: motionState.gridColor,
                    midColor: motionState.midColor,
                    targetColor: motionState.targetColor
                };
            }

            function persistActiveLayerControls(options = {}) {
                const { rebuildGrid = true, retarget = true } = options;
                const nextState = getActiveLayerStateFromControls();
                dotLayerStates[activeLayerKey] = coerceLayerStateForV12(createDefaultLayerState(activeLayerKey, nextState), nextState);
                invalidateLayerRuntimeConfig(activeLayerKey);
                if (rebuildGrid) dotGroups[activeLayerKey].rebuildGrid();
                if (retarget) applyActiveLayerTargetsIfNeeded();
                updateLayerSelectionUi();
            }

            function getMaskControlState() {
                return {
                    expansion: maskControls.expansion.value,
                    scaleTime: maskControls.scaleTime?.value || '4'
                };
            }

            function applyMaskControlState(state = {}) {
                setControlValue(maskControls.expansion, state.expansion || '32');
                setControlValue(maskControls.scaleTime, state.scaleTime || '4');
                clearMaskCache();
                updateMaskStatus();
            }

            function getImageSlideControlState() {
                return {
                    scale: imageSlideControls.scale?.value || '100',
                    offsetX: imageSlideControls.offsetX?.value || '0',
                    offsetY: imageSlideControls.offsetY?.value || '0',
                    duration: mediaControls.duration?.value || '4',
                    transitionMode: getMediaTransitionMode()
                };
            }

            function applyImageSlideControlState(state = {}) {
                setControlValue(imageSlideControls.scale, state.scale || '100');
                setControlValue(imageSlideControls.offsetX, state.offsetX || '0');
                setControlValue(imageSlideControls.offsetY, state.offsetY || '0');
                setControlValue(mediaControls.duration, state.duration || '4');
                if (mediaControls.transitionMode) {
                    mediaControls.transitionMode.value = ['full', 'flicker', 'cut'].includes(state.transitionMode)
                        ? state.transitionMode
                        : 'full';
                }
            }

            function getImageMaskControlState() {
                return {
                    expansion: imageMaskControls.expansion?.value || '32',
                    scaleTime: imageMaskControls.scaleTime?.value || '4'
                };
            }

            function applyImageMaskControlState(state = {}) {
                setControlValue(imageMaskControls.expansion, state.expansion || '32');
                setControlValue(imageMaskControls.scaleTime, state.scaleTime || '4');
                clearMaskCache();
                if (typeof updateImageMaskStatus === 'function') updateImageMaskStatus();
            }

            function serializeSlideEntry(slide) {
                const type = slide?.type === 'video'
                    ? 'video'
                    : slide?.type === 'image'
                        ? 'image'
                        : 'svg';
                const entry = {
                    type,
                    name: slide.name || slide.fileName,
                    fileName: slide.fileName || slide.name,
                    svg: slide.svg
                };
                if (type === 'image') entry.imageSrc = slide.imageSrc || '';
                if (type === 'video') {
                    entry.videoMissing = true;
                    entry.duration = slide.duration || 0;
                    entry.videoFileName = slide.fileName || slide.name || '';
                }
                return entry;
            }

            function isLoadablePresetSlideEntry(slide) {
                if (!slide) return false;
                if (slide.type === 'image') return !!slide.svg && !!slide.imageSrc;
                if (slide.type === 'video') return false;
                return !!slide.svg;
            }

            function createSlideFromPresetEntry(slide) {
                const name = slide.name || slide.fileName || (slide.type === 'image' ? 'Imported Image' : 'Imported SVG');
                if (slide.type === 'image') {
                    return createSlide(name, slide.svg || '', { type: 'image', imageSrc: slide.imageSrc || '' });
                }
                return createSlide(name, slide.svg || '', { type: 'svg' });
            }

            function cloneDotLayerStates() {
                return DOT_LAYER_KEYS.reduce((acc, layerKey) => {
                    acc[layerKey] = { ...dotLayerStates[layerKey] };
                    return acc;
                }, {});
            }

            function switchActiveLayer(layerKey) {
                if (!DOT_LAYER_KEYS.includes(layerKey)) return;
                persistActiveLayerControls({ rebuildGrid: false, retarget: false });
                activeLayerKey = layerKey;
                loadActiveLayerIntoUi();
            }

            function copyActiveGridToAllLayers() {
                copyGridLayerToAllLayers(activeLayerKey);
            }

            function copyGridLayerToAllLayers(sourceLayerKey = activeLayerKey) {
                persistGridLayerControls(sourceLayerKey, { rebuildGrid: false, retarget: false });
                const source = dotLayerStates[sourceLayerKey];
                DOT_LAYER_KEYS.forEach(layerKey => {
                    dotLayerStates[layerKey] = {
                        ...dotLayerStates[layerKey],
                        cols: source.cols,
                        rows: source.rows,
                        spacing: source.spacing,
                        offsetX: source.offsetX,
                        offsetY: source.offsetY
                    };
                    invalidateLayerRuntimeConfig(layerKey);
                    dotGroups[layerKey].rebuildGrid();
                });
                if (typeof scheduleMaskWarmup === 'function') scheduleMaskWarmup();
                if (typeof scheduleTargetWarmup === 'function') scheduleTargetWarmup();
                refreshAttractorTargetsIfNeeded();
                loadActiveLayerIntoUi();
            }

            function normalizeLayerCollection(incomingLayers = {}, preferredOrder = null) {
                const sourceLayers = incomingLayers || {};
                const sourceKeys = [];
                const addSourceKey = key => {
                    if (!key || sourceKeys.includes(key) || !sourceLayers[key]) return;
                    sourceKeys.push(key);
                };
                const hasPreferredOrder = Array.isArray(preferredOrder) && preferredOrder.length > 0;
                if (hasPreferredOrder) preferredOrder.forEach(addSourceKey);
                if (!hasPreferredOrder || !sourceKeys.length) {
                    ALL_DOT_LAYER_KEYS.forEach(addSourceKey);
                    LEGACY_DOT_LAYER_KEYS.forEach(addSourceKey);
                    Object.keys(sourceLayers).forEach(addSourceKey);
                }

                const dotLayers = {};
                const layerOrder = [];
                const sourceToTarget = {};
                const usedTargets = new Set();
                const nextAvailableLayerKey = () => ALL_DOT_LAYER_KEYS.find(layerKey => !usedTargets.has(layerKey)) || '';

                sourceKeys.slice(0, ALL_DOT_LAYER_KEYS.length).forEach(sourceKey => {
                    let targetKey = ALL_DOT_LAYER_KEYS.includes(sourceKey) && !usedTargets.has(sourceKey)
                        ? sourceKey
                        : nextAvailableLayerKey();
                    if (!targetKey) return;
                    usedTargets.add(targetKey);
                    sourceToTarget[sourceKey] = targetKey;
                    const source = sourceLayers[sourceKey] || {};
                    const sourceName = String(source.name || '').trim();
                    const keepSourceName = sourceName && (!LEGACY_DOT_LAYER_KEYS.includes(sourceKey) || !/^Layer \d+$/i.test(sourceName));
                    dotLayers[targetKey] = {
                        ...source,
                        name: keepSourceName ? sourceName : (DOT_LAYER_META[targetKey]?.label || `Grid ${layerOrder.length + 1}`)
                    };
                    layerOrder.push(targetKey);
                });

                return { dotLayers, layerOrder, sourceToTarget };
            }

            function coerceLayerStateForV12(layer, source = {}) {
                const targetSeed = source.targetTypes !== undefined ? source.targetTypes : (source.targetType !== undefined ? source.targetType : layer.targetType);
                layer.targetType = normalizeTargetType(targetSeed, source.targetType || layer.targetType || 'fill');
                layer.targetTypes = [layer.targetType];
                if (source.speedLimit === undefined) layer.speedLimit = String(readStateFloat(layer.speedLimit, 80));
                if (source.friction === undefined) layer.friction = String(readStateFloat(layer.friction, 34));
                if (source.svgRadius === undefined) layer.svgRadius = String(readStateFloat(layer.svgRadius, 320));
                if (source.gridRadius === undefined) layer.gridRadius = String(readStateFloat(layer.gridRadius, 1000));
                if (source.elasticity === undefined && source.friction !== undefined) {
                    layer.elasticity = String(Math.round(clamp(58 - readStateFloat(source.friction, 0.45) * 18, 0, 100)));
                }
                layer.returnPull = String(clamp(readStateFloat(source.returnPull, readStateFloat(layer.returnPull, 0.38)), 0.1, 1));
                layer.pull = String(clamp(readStateFloat(source.pull, readStateFloat(layer.pull, 0.7)), 0.1, 1));
                layer.svgRadius = String(clamp(readStateFloat(source.svgRadius, readStateFloat(layer.svgRadius, 320)), 100, 1000));
                layer.gridRadius = String(clamp(readStateFloat(source.gridRadius, readStateFloat(layer.gridRadius, 1000)), 100, 1000));
                if (source.shuffle === undefined) layer.shuffle = '0';
                if (source.variation === undefined) layer.variation = '0';
                if (source.midSize === undefined) layer.midSize = String(readStateFloat(layer.midSize, readStateFloat(layer.gridSize, 2.5)));
                if (source.sizeMidpoint === undefined) layer.sizeMidpoint = '0.5';
                if (source.speedSize === undefined) layer.speedSize = '0';
                if (source.visibilityEnabled === undefined) layer.visibilityEnabled = true;
                if (source.visibilityOn === undefined) layer.visibilityOn = '7';
                if (source.visibilityOff === undefined) layer.visibilityOff = '3';
                if (source.visibilityRandomness === undefined) layer.visibilityRandomness = '100';
                if (source.visibilityProbability === undefined) layer.visibilityProbability = '70';
                if (source.visibilityGridProximity === undefined) layer.visibilityGridProximity = '0';
                const fallbackColor = normalizeHexColor(source.dotColor || source.gridColor || layer.gridColor || '#ffffff');
                layer.gridColor = normalizeHexColor(source.gridColor || source.dotColor || layer.gridColor, fallbackColor);
                layer.midColor = normalizeHexColor(source.midColor || source.dotColor || layer.midColor, layer.gridColor);
                layer.targetColor = normalizeHexColor(source.targetColor || source.dotColor || layer.targetColor, layer.midColor);
                layer.motionStyle = 'direct';
                layer.motionEnergy = '0';
                layer.flickerAmount = '0';
                layer.flickerSpeed = '1';
                layer.flickerFade = '0.25';
                Object.keys(layer).forEach(key => {
                    if (key.toLowerCase() === 'blendmode') delete layer[key];
                });
                // Strip old private knobs so imported states normalize to the current visible layer model.
                [
                    'motionStyle', 'motionEnergy', 'bounce', 'targetSpeed', 'gridSpeed',
                    'drift', 'wobble', 'stickiness', 'targetWobble', 'wobbleSpeed',
                    'sizeMode', 'sizeRandom', 'sizeRandomSpeed', 'sizePulseAmp', 'sizePulseFreq',
                    'gridSizeRandom', 'gridSizeBoost', 'targetSizeBoost', 'targetSwitch', 'switchSoftness',
                    'colorVariation', 'midColorMode', 'targetColorMode', 'dotColor', 'dotColorMode',
                    'dotGridColor', 'dotTargetColor', 'gridColorMode',
                    'capture', 'svgRadiusMotion', 'gridRadiusMotion', 'snapDistance', 'colorMidpoint',
                    'visibilityRespawn', 'idleMotion', 'idleSteps', 'idleSpeed', 'idleRandom',
                    'flickerAmount', 'flickerSpeed', 'flickerFade'
                ].forEach(key => delete layer[key]);
                return layer;
            }

            function buildLegacyLayerState(state) {
                const layerKey = DEFAULT_LAYER_KEY;
                const layers = {
                    [layerKey]: createDefaultLayerState(layerKey)
                };
                if (state.grid) {
                    layers[layerKey].cols = state.grid.cols || layers[layerKey].cols;
                    layers[layerKey].rows = state.grid.rows || layers[layerKey].rows;
                    layers[layerKey].spacing = state.grid.spacing || layers[layerKey].spacing;
                    layers[layerKey].offsetX = state.grid.offsetX || layers[layerKey].offsetX;
                    layers[layerKey].offsetY = state.grid.offsetY || layers[layerKey].offsetY;
                }
                if (state.motion) {
                    const motion = state.motion;
                    layers[layerKey].targetType = motion.targetType || motion['dot-target-type'] || layers[layerKey].targetType;
                    layers[layerKey].mass = motion['dot-mass'] || layers[layerKey].mass;
                    layers[layerKey].svgRadius = motion['dot-svg-radius'] || motion.svgRadius || layers[layerKey].svgRadius;
                    layers[layerKey].gridRadius = motion['dot-grid-radius'] || motion.gridRadius || layers[layerKey].gridRadius;
                    layers[layerKey].elasticity = motion['dot-elasticity'] || motion.elasticity || layers[layerKey].elasticity;
                    layers[layerKey].shuffle = motion['dot-shuffle'] || motion.shuffle || layers[layerKey].shuffle;
                    layers[layerKey].variation = motion['dot-variation'] || motion.variation || layers[layerKey].variation;
                    layers[layerKey].friction = motion['dot-friction'] || layers[layerKey].friction;
                    layers[layerKey].bounce = motion['dot-bounce'] || layers[layerKey].bounce;
                    layers[layerKey].speedLimit = motion['dot-speed-limit'] || layers[layerKey].speedLimit;
                    layers[layerKey].wobble = motion['dot-wobble'] || layers[layerKey].wobble;
                    layers[layerKey].returnPull = motion['dot-return-pull'] || layers[layerKey].returnPull;
                    layers[layerKey].pull = motion['dot-pull'] || layers[layerKey].pull;
                    layers[layerKey].stickiness = motion['dot-stickiness'] || layers[layerKey].stickiness;
                    layers[layerKey].targetWobble = motion['dot-target-wobble'] || layers[layerKey].targetWobble;
                    layers[layerKey].wobbleSpeed = motion['dot-wobble-speed'] || layers[layerKey].wobbleSpeed;
                    layers[layerKey].orbit = motion['dot-orbit'] || layers[layerKey].orbit;
                    layers[layerKey].sizeMode = motion['dot-size-mode'] || layers[layerKey].sizeMode;
                    layers[layerKey].gridSize = motion['dot-grid-size'] || layers[layerKey].gridSize;
                    layers[layerKey].midSize = motion['dot-mid-size'] || layers[layerKey].midSize;
                    layers[layerKey].targetSize = motion['dot-target-size'] || layers[layerKey].targetSize;
                    layers[layerKey].sizeMidpoint = motion['dot-size-midpoint'] || layers[layerKey].sizeMidpoint;
                    layers[layerKey].speedSize = motion['dot-speed-size'] || layers[layerKey].speedSize;
                    layers[layerKey].gridColor = motion.gridColor || motion.dotColor || motion.dotGridColor || motion.dotTargetColor || layers[layerKey].gridColor;
                    layers[layerKey].targetColor = motion.targetColor || motion.dotTargetColor || motion.dotColor || motion.dotGridColor || layers[layerKey].targetColor;
                    layers[layerKey].flickerAmount = motion['dot-flicker-amount'] || layers[layerKey].flickerAmount;
                    layers[layerKey].flickerSpeed = motion['dot-flicker-speed'] || layers[layerKey].flickerSpeed;
                    layers[layerKey].flickerFade = motion['dot-flicker-fade'] || layers[layerKey].flickerFade;
                }
                return layers;
            }

            function syncControlsBeforePresetCapture() {
                applyBlinkControlsToAllLayers();
                DOT_LAYER_KEYS.forEach(layerKey => {
                    persistGridLayerControls(layerKey, { rebuildGrid: false, retarget: false });
                    persistMotionLayerControls(layerKey, { retarget: false });
                });
            }

            function getCurrentState() {
                syncControlsBeforePresetCapture();
                return {
                    activeLayerKey,
                    layerOrder: [...DOT_LAYER_KEYS],
                    svgMediaStackIndex: clampSvgMediaStackIndex(),
                    autoTransition: getAutoTransitionControlState(),
                    blink: forceBlinkRespawnState(getBlinkStateFromControls()),
                    randomRanges: getRandomRangeState(),
                    stage: getStageState(),
                    dotLayers: cloneDotLayerStates(),
                    imageLayer: {
                        ...imageState,
	                        fileName: imageState.fileName || imageState.name || '',
	                        hidden: !!imageState.hidden,
	                        scale: imageControls.scale.value,
                        offsetX: imageControls.offsetX.value,
                        offsetY: imageControls.offsetY.value
                    },
                    bg: {
                        mode: bgControls.mode?.value || 'static',
                        staticColor: bgControls.staticPicker.value,
                        color2: bgControls.color2Picker?.value || '#ffd4f5',
                        color3: bgControls.color3Picker?.value || '#00002a',
                        cycleSpeed: bgControls.cycleSpeed?.value || '0.18'
                    },
                    appBackdrop: getAppBackdropState(),
                    slides: slides.map(serializeSlideEntry),
                    mediaMode,
                    currentSlideIndex,
                    slide: {
                        scale: slideControls.scale.value,
                        offsetX: slideControls.offsetX.value,
                        offsetY: slideControls.offsetY.value
                    },
                    mask: getMaskControlState(),
                    imageSlide: getImageSlideControlState(),
                    imageMask: getImageMaskControlState()
                };
            }

            function applyState(state) {
                if (!state) return;
                const stage = state.stage || {};
                setStudioSize(stage.width || DEFAULT_STUDIO_WIDTH, stage.height || DEFAULT_STUDIO_HEIGHT, { force: true });
                applyAppBackdropState(state.appBackdrop || {});
                if (state.slide) {
                    const slideState = state.slide || {};
                    slideControls.scale.value = slideState.scale || '100';
                    slideControls.offsetX.value = slideState.offsetX || '0';
                    slideControls.offsetY.value = slideState.offsetY || '0';
                }
                applyImageSlideControlState(state.imageSlide || {});
                if (state.mask) applyMaskControlState(state.mask || {});
                applyImageMaskControlState(state.imageMask || {});
                applyAutoTransitionControlState(state.autoTransition || {});
                mediaMode = state.mediaMode === 'videos' ? 'videos' : 'images';
                updateMediaModeUi();

                const image = state.imageLayer || {};
                const imageName = image.name || image.fileName || '';
                imageState = {
	                    name: imageName,
	                    fileName: image.fileName || imageName,
	                    src: image.src || '',
	                    hidden: image.hidden === true,
	                    naturalWidth: image.naturalWidth || 0,
                    naturalHeight: image.naturalHeight || 0
                };
                setControlValue(imageControls.scale, image.scale || '100');
                setControlValue(imageControls.offsetX, image.offsetX || '0');
                setControlValue(imageControls.offsetY, image.offsetY || '0');
                updateImageLayer();

                const bg = state.bg || {};
                const cycleColors = Array.isArray(bg.cycleColors) ? bg.cycleColors : [];
                const bgMode = ['static', 'cycle2', 'cycle3'].includes(bg.mode)
                    ? bg.mode
                    : (cycleColors.length >= 3 ? 'cycle3' : (cycleColors.length >= 2 ? 'cycle2' : 'static'));
                setControlValue(bgControls.mode, bgMode);
                setColorPairValue(bgControls.staticPicker, bgControls.staticHex, normalizeHexColor(bg.staticColor || cycleColors[0], '#02006c'));
                setColorPairValue(bgControls.color2Picker, bgControls.color2Hex, normalizeHexColor(bg.color2 || cycleColors[1], '#ffd4f5'));
                setColorPairValue(bgControls.color3Picker, bgControls.color3Hex, normalizeHexColor(bg.color3 || cycleColors[2], '#00002a'));
                setControlValue(bgControls.cycleSpeed, bg.cycleSpeed || '0.18');
                updateBackgroundControls();
                updateBackground();
                if (typeof pauseAllVideos === 'function') pauseAllVideos(true);
                if (typeof disposeVideoSlide === 'function') {
                    slides.forEach(slide => {
                        if (slide?.type === 'video') disposeVideoSlide(slide);
                    });
                }

                const incomingLayers = state.dotLayers || buildLegacyLayerState(state);
                const normalizedLayers = normalizeLayerCollection(incomingLayers, state.layerOrder);
                DOT_LAYER_KEYS = normalizedLayers.layerOrder.length ? normalizedLayers.layerOrder : [DEFAULT_LAYER_KEY];
                svgMediaStackIndex = clampSvgMediaStackIndex(state.svgMediaStackIndex ?? DOT_LAYER_KEYS.length);
                const blinkOverride = state.blink ? forceBlinkRespawnState(state.blink) : null;
                dotLayerStates = ALL_DOT_LAYER_KEYS.reduce((acc, layerKey) => {
                    const incoming = {
                        ...(normalizedLayers.dotLayers[layerKey] || {}),
                        ...(blinkOverride || {})
                    };
                    acc[layerKey] = coerceLayerStateForV12(createDefaultLayerState(layerKey, incoming), incoming);
                    return acc;
                }, {});
                invalidateLayerRuntimeConfig();
                const mappedActiveLayerKey = normalizedLayers.sourceToTarget[state.activeLayerKey] || state.activeLayerKey;
                activeLayerKey = DOT_LAYER_KEYS.includes(mappedActiveLayerKey) ? mappedActiveLayerKey : DOT_LAYER_KEYS[0];
                const slideEntries = Array.isArray(state.slides) ? state.slides : null;
                const incomingSlides = slideEntries
                    ? slideEntries.filter(isLoadablePresetSlideEntry)
                    : [];
                if (slideEntries) {
                    missingSlideNames = slideEntries
                        .filter(slide => slide && slide.type === 'svg' && !slide.svg && (slide.name || slide.fileName))
                        .map(slide => slide.name || slide.fileName);
                    const missingVideoNames = slideEntries
                        .filter(slide => slide && slide.type === 'video' && (slide.name || slide.fileName || slide.videoFileName))
                        .map(slide => slide.videoFileName || slide.name || slide.fileName);
                    if (missingVideoNames.length && typeof showUiToast === 'function') {
                        showUiToast(`Preset references video slides that must be re-uploaded: ${missingVideoNames.join(', ')}.`, 'warning');
                    }
                    if (incomingSlides.length) {
                        slides = incomingSlides.map(createSlideFromPresetEntry);
                        currentSlideIndex = clamp(state.currentSlideIndex || 0, 0, Math.max(0, slides.length - 1));
                    } else {
                        slides = [];
                        currentSlideIndex = 0;
                    }
                } else {
                    currentSlideIndex = clamp(currentSlideIndex || 0, 0, Math.max(0, slides.length - 1));
                }
                pendingSlideIndex = null;
                slideOpacity = slides.length ? 1 : 0;
                slideFade = null;
                holdState = 'idle';
                activeHoldMode = null;
                activeHoldCode = null;
                autoTransition = null;
                resetForcesToGrid();
	                setAutoStatus(INTERACTION_HELP_TEXT);
                ALL_DOT_LAYER_KEYS.forEach(layerKey => {
                    dotGroups[layerKey].rebuildGrid();
                    dotGroups[layerKey].returnToGrid();
                });
                resetDotMaskAlphas(1);
                loadActiveLayerIntoUi();
                applyRandomRangeState(state.randomRanges || {});
                syncLayerRegistryUi();
                renderCurrentSlide();
                if (typeof precomputeAllTransitionAssetsSync === 'function') precomputeAllTransitionAssetsSync();
                document.querySelectorAll('input[type="range"]').forEach(updateRangeIndicator);
            }

            function getSvgState() {
                return {
                    slides: slides.map(serializeSlideEntry),
                    mediaMode,
                    currentSlideIndex,
                    slide: {
                        scale: slideControls.scale.value,
                        offsetX: slideControls.offsetX.value,
                        offsetY: slideControls.offsetY.value
                    },
                    mask: getMaskControlState(),
                    imageSlide: getImageSlideControlState(),
                    imageMask: getImageMaskControlState()
                };
            }

            function applySvgState(state = {}) {
                const slideState = state.slide || {};
                slideControls.scale.value = slideState.scale || '100';
                slideControls.offsetX.value = slideState.offsetX || '0';
                slideControls.offsetY.value = slideState.offsetY || '0';
                applyMaskControlState(state.mask || {});
                applyImageSlideControlState(state.imageSlide || {});
                applyImageMaskControlState(state.imageMask || {});
                mediaMode = state.mediaMode === 'videos' ? 'videos' : 'images';
                updateMediaModeUi();
                if (typeof pauseAllVideos === 'function') pauseAllVideos(true);
                if (typeof disposeVideoSlide === 'function') {
                    slides.forEach(slide => {
                        if (slide?.type === 'video') disposeVideoSlide(slide);
                    });
                }
                const slideEntries = Array.isArray(state.slides) ? state.slides : [];
                const incomingSlides = slideEntries.filter(isLoadablePresetSlideEntry);
                missingSlideNames = slideEntries
                    .filter(slide => slide && slide.type === 'svg' && !slide.svg && (slide.name || slide.fileName))
                    .map(slide => slide.name || slide.fileName);
                const missingVideoNames = slideEntries
                    .filter(slide => slide && slide.type === 'video' && (slide.name || slide.fileName || slide.videoFileName))
                    .map(slide => slide.videoFileName || slide.name || slide.fileName);
                if (missingVideoNames.length && typeof showUiToast === 'function') {
                    showUiToast(`Preset references video slides that must be re-uploaded: ${missingVideoNames.join(', ')}.`, 'warning');
                }
                if (incomingSlides.length) {
                    slides = incomingSlides.map(createSlideFromPresetEntry);
                    currentSlideIndex = clamp(state.currentSlideIndex || 0, 0, Math.max(0, slides.length - 1));
                } else if (Array.isArray(state.slides)) {
                    slides = [];
                    currentSlideIndex = 0;
                }
                pendingSlideIndex = null;
                slideOpacity = slides.length ? 1 : 0;
                slideFade = null;
                holdState = 'idle';
                activeHoldMode = null;
                activeHoldCode = null;
                autoTransition = null;
                resetForcesToGrid();
                DOT_LAYER_KEYS.forEach(layerKey => dotGroups[layerKey].returnToGrid());
                resetDotMaskAlphas(1);
                clearMaskCache();
                renderCurrentSlide();
                if (typeof precomputeAllTransitionAssetsSync === 'function') precomputeAllTransitionAssetsSync();
                refreshAttractorTargetsIfNeeded();
                document.querySelectorAll('input[type="range"]').forEach(updateRangeIndicator);
            }

            let presets = [];
            let builtInPresetNames = new Set();
            const APP_VERSION = 'ten26-presets-v2';
            const PRESET_STORAGE_KEY = 'ten26.savedCustomPresets.v2';
            const PRESET_STORAGE_MODE = 'full-preset-list';

            function getDefaultAssetBundle() {
                return window.TEN26_DEFAULT_ASSETS || {};
            }

            function cloneDefaultImageLayerState() {
                const image = getDefaultAssetBundle().image || {};
                return {
	                    name: image.name || '',
	                    fileName: image.fileName || image.name || '',
	                    src: image.src || '',
	                    hidden: image.hidden === true,
	                    naturalWidth: image.naturalWidth || 0,
                    naturalHeight: image.naturalHeight || 0,
                    scale: image.scale || '100',
                    offsetX: image.offsetX || '0',
                    offsetY: image.offsetY || '0'
                };
            }

            function mergeImageLayerWithDefault(source = {}) {
                const base = cloneDefaultImageLayerState();
                const imageName = source.name || source.fileName || '';
                const hasIncomingImage = Boolean(source.src || imageName);
                if (!hasIncomingImage) return base;
                return {
                    ...base,
                    ...source,
                    name: imageName || base.name,
                    fileName: source.fileName || imageName || base.fileName,
	                    src: source.src || base.src,
	                    hidden: source.hidden === true,
	                    naturalWidth: source.naturalWidth || base.naturalWidth,
                    naturalHeight: source.naturalHeight || base.naturalHeight,
                    scale: source.scale || base.scale,
                    offsetX: source.offsetX || base.offsetX,
                    offsetY: source.offsetY || base.offsetY
                };
            }

            function cloneSlidesState(slideEntries = []) {
                return slideEntries
                    .filter(slide => slide && (slide.svg || slide.type === 'video'))
                    .map(slide => {
                        const type = slide?.type === 'video'
                            ? 'video'
                            : slide?.type === 'image'
                                ? 'image'
                                : 'svg';
                        const name = slide.name || slide.fileName || (type === 'video' ? 'Preloaded Video' : 'Preloaded SVG');
                        return {
                            type,
                            name,
                            fileName: slide.fileName || slide.name || name,
                            svg: slide.svg || '',
                            ...(type === 'image' ? { imageSrc: slide.imageSrc || '' } : {}),
                            ...(type === 'video' ? {
                                videoMissing: true,
                                duration: slide.duration || 0,
                                videoFileName: slide.videoFileName || slide.fileName || slide.name || name
                            } : {})
                        };
                    });
            }

            function cloneDefaultSlidesState() {
                return cloneSlidesState(getDefaultAssetBundle().slides || []);
            }

            function getDefaultSlideState() {
                const slide = getDefaultAssetBundle().slide || {};
                return {
                    scale: slide.scale || '67',
                    offsetX: slide.offsetX || '0',
                    offsetY: slide.offsetY || '0'
                };
            }

            function getDefaultMaskState() {
                const mask = getDefaultAssetBundle().mask || {};
                return {
                    expansion: mask.expansion || '32',
                    scaleTime: mask.scaleTime || '4'
                };
            }

            function getDefaultImageSlideState() {
                const imageSlide = getDefaultAssetBundle().imageSlide || {};
                return {
                    scale: imageSlide.scale || '100',
                    offsetX: imageSlide.offsetX || '0',
                    offsetY: imageSlide.offsetY || '0',
                    duration: imageSlide.duration || '4'
                };
            }

            function getDefaultImageMaskState() {
                const imageMask = getDefaultAssetBundle().imageMask || {};
                return {
                    expansion: imageMask.expansion || '32',
                    scaleTime: imageMask.scaleTime || '4'
                };
            }

            function getDefaultBlinkState(enabled = false) {
                return {
                    visibilityEnabled: enabled,
                    visibilityOn: '7',
                    visibilityOff: '3',
                    visibilityRandomness: '100',
                    visibilityProbability: '70',
                    visibilityGridProximity: '0'
                };
            }

            function defaultState() {
                const defaultSlides = cloneDefaultSlidesState();
                return {
                    activeLayerKey: DEFAULT_LAYER_KEY,
                    layerOrder: [DEFAULT_LAYER_KEY],
                    svgMediaStackIndex: 1,
                    autoTransition: {
                        currentTime: '3',
                        nextTime: '2',
                        returnGridTime: '0',
                        flickerBias: '6',
                        flickerSpeed: '10',
                        flickerBalance: '75',
                        flickerWildness: '100',
                        autoDuration: '4'
                    },
                    stage: {
                        width: String(DEFAULT_STUDIO_WIDTH),
                        height: String(DEFAULT_STUDIO_HEIGHT)
                    },
                    dotLayers: {
                        [DEFAULT_LAYER_KEY]: createDefaultLayerState(DEFAULT_LAYER_KEY, { name: 'Grid 1' })
                    },
                    blink: getDefaultBlinkState(true),
                    imageLayer: cloneDefaultImageLayerState(),
                    bg: {
                        mode: 'static',
                        staticColor: '#02006c',
                        color2: '#ffd4f5',
                        color3: '#00002a',
                        cycleSpeed: '0.18'
                    },
                    appBackdrop: {
                        mode: 'gradient',
                        color: '#02006c'
                    },
                    slides: defaultSlides,
                    mediaMode: getDefaultAssetBundle().mediaMode === 'videos' ? 'videos' : 'images',
                    currentSlideIndex: clamp(getDefaultAssetBundle().currentSlideIndex || 0, 0, Math.max(0, defaultSlides.length - 1)),
                    slide: getDefaultSlideState(),
                    mask: getDefaultMaskState(),
                    imageSlide: getDefaultImageSlideState(),
                    imageMask: getDefaultImageMaskState()
                };
            }

            function setPresetStatus(text) {
                if (presetStatus) presetStatus.textContent = text;
                if (typeof setOverlayStatus === 'function') setOverlayStatus(text);
            }

            function escapeHtml(value = '') {
                return String(value)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            }

            function cloneSerializable(value) {
                return JSON.parse(JSON.stringify(value));
            }

            function normalizePresetName(value, fallback = 'Custom Preset') {
                const name = String(value || '').replace(/\s+/g, ' ').trim();
                return (name || fallback).slice(0, 80);
            }

            function getUniquePresetName(name, usedNames = new Set()) {
                const baseName = normalizePresetName(name);
                if (!usedNames.has(baseName)) return baseName;
                let index = 2;
                let nextName = `${baseName} ${index}`;
                while (usedNames.has(nextName)) {
                    index += 1;
                    nextName = `${baseName} ${index}`;
                }
                return nextName;
            }

            function normalizePresetCollection(payload) {
                const source = Array.isArray(payload)
                    ? payload
                    : (Array.isArray(payload?.presets) ? payload.presets : (payload?.name && payload?.state ? [payload] : []));
                return source.reduce((list, preset, index) => {
                    if (!preset || typeof preset !== 'object' || !preset.state || typeof preset.state !== 'object') return list;
                    try {
                        list.push({
                            name: normalizePresetName(preset.name, `Imported Preset ${index + 1}`),
                            state: cloneSerializable(preset.state)
                        });
                    } catch (error) {
                        console.warn('Skipped invalid preset:', error);
                    }
                    return list;
                }, []);
            }

            function getCustomPresets(source = presets) {
                return source.filter(preset => preset && !builtInPresetNames.has(preset.name));
            }

            function savePresetsToStorage(source = presets) {
                try {
                    const payload = {
                        app: 'TEN26',
                        version: APP_VERSION,
                        storageMode: PRESET_STORAGE_MODE,
                        savedAt: new Date().toISOString(),
                        presets: source.map(preset => ({
                            name: preset.name,
                            state: cloneSerializable(preset.state)
                        }))
                    };
                    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(payload));
                    return true;
                } catch (error) {
                    console.warn('Preset storage failed:', error);
                    return false;
                }
            }

            function loadPresetsFromStorage() {
                try {
                    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
                    if (!raw) return null;
                    const payload = JSON.parse(raw);
                    const storedPresets = normalizePresetCollection(payload);
                    if (!storedPresets.length) return null;
                    return {
                        presets: storedPresets,
                        isFullList: payload?.storageMode === PRESET_STORAGE_MODE
                    };
                } catch (error) {
                    console.warn('Preset storage could not be read:', error);
                    return null;
                }
            }

            function getPresetWarnings(preset) {
                const state = preset?.state || {};
                const warnings = [];
                if (!state.dotLayers && state.autoTransition !== undefined) warnings.push('grid layer values');
                const normalizedLayers = state.dotLayers ? normalizeLayerCollection(state.dotLayers, state.layerOrder) : null;
                const presetLayerOrder = normalizedLayers?.layerOrder?.length ? normalizedLayers.layerOrder : [];
                if (state.dotLayers && !presetLayerOrder.length) warnings.push('one or more grid layers');
                if (state.dotLayers && !state.blink && presetLayerOrder.some(layerKey => normalizedLayers.dotLayers[layerKey]?.visibilityEnabled === undefined)) warnings.push('blink values');
                if (state.autoTransition === undefined && state.dotLayers) warnings.push('flicker values');
                if (state.bg === undefined && state.dotLayers) warnings.push('background values');
                if (state.slide === undefined && state.slides !== undefined) warnings.push('SVG placement');
                if (state.mask === undefined && state.slides !== undefined) warnings.push('mask values');
                const missingSlides = (state.slides || [])
                    .filter(slide => slide?.type === 'svg' && (slide?.name || slide?.fileName) && !slide.svg)
                    .map(slide => slide.fileName || slide.name);
                if (missingSlides.length) warnings.push(`missing SVG: ${missingSlides.join(', ')}`);
                const missingImageSlides = (state.slides || [])
                    .filter(slide => slide?.type === 'image' && (slide.name || slide.fileName) && !slide.imageSrc)
                    .map(slide => slide.fileName || slide.name);
                if (missingImageSlides.length) warnings.push(`missing image slide: ${missingImageSlides.join(', ')}`);
                const missingVideoSlides = (state.slides || [])
                    .filter(slide => slide?.type === 'video' && (slide.name || slide.fileName || slide.videoFileName))
                    .map(slide => slide.videoFileName || slide.fileName || slide.name);
                if (missingVideoSlides.length) warnings.push(`missing media: ${missingVideoSlides.join(', ')}`);
                const imageName = state.imageLayer?.fileName || state.imageLayer?.name || '';
                if (imageName && !state.imageLayer?.src) warnings.push(`missing image: ${imageName}`);
                return warnings;
            }

            function styleDefaultPreset(preset) {
                const state = preset.state || {};
                if (state.blink) state.blink = forceBlinkRespawnState(state.blink);
                if (state.dotLayers) {
                    const normalizedLayers = normalizeLayerCollection(state.dotLayers, state.layerOrder);
                    state.layerOrder = normalizedLayers.layerOrder;
                    state.activeLayerKey = normalizedLayers.sourceToTarget[state.activeLayerKey] || state.activeLayerKey;
                    if (!state.layerOrder.includes(state.activeLayerKey)) state.activeLayerKey = state.layerOrder[0] || DEFAULT_LAYER_KEY;
                    state.dotLayers = normalizedLayers.dotLayers;
                    state.layerOrder.forEach(layerKey => {
                        state.dotLayers[layerKey] = coerceLayerStateForV12(
                            createDefaultLayerState(layerKey, state.dotLayers[layerKey]),
                            state.dotLayers[layerKey]
                        );
                    });
                }
                return { ...preset, state };
            }

            function normalizeVisiblePresetList(source = []) {
                const usedNames = new Set();
                return normalizePresetCollection(source).reduce((list, preset) => {
                    const name = getUniquePresetName(preset.name, usedNames);
                    usedNames.add(name);
                    list.push(styleDefaultPreset({ name, state: preset.state }));
                    return list;
                }, []);
            }

            function mergePresetsWithBuiltIns(stored = [], options = {}) {
                const builtIns = buildDefaultPresets().map(styleDefaultPreset);
                builtInPresetNames = new Set(builtIns.map(preset => preset.name));
                if (options.fullList) {
                    const visiblePresets = normalizeVisiblePresetList(stored);
                    const safePresets = visiblePresets.length ? visiblePresets : builtIns;
                    return {
                        presets: safePresets,
                        customCount: safePresets.filter(preset => !builtInPresetNames.has(preset.name)).length,
                        builtInCount: safePresets.filter(preset => builtInPresetNames.has(preset.name)).length
                    };
                }
                const usedNames = new Set(builtInPresetNames);
                const customPresets = normalizePresetCollection(stored).reduce((list, preset) => {
                    if (builtInPresetNames.has(preset.name)) return list;
                    const name = getUniquePresetName(preset.name, usedNames);
                    usedNames.add(name);
                    list.push(styleDefaultPreset({ name, state: preset.state }));
                    return list;
                }, []);
                return {
                    presets: [...builtIns, ...customPresets],
                    customCount: customPresets.length,
                    builtInCount: builtIns.length
                };
            }

            function updatePresetDropdown(selectedIndex = 0) {
                presetSelect.innerHTML = presets.map((preset, index) => {
                    const warnings = getPresetWarnings(preset);
                    const warningClass = warnings.length ? ' class="preset-warning-option"' : '';
                    const warningTitle = warnings.length ? ` title="${escapeHtml(warnings.join(' · '))}"` : '';
                    const label = `${warnings.length ? '! ' : ''}${preset.name}`;
                    return `<option value="${index}"${warningClass}${warningTitle}>${escapeHtml(label)}</option>`;
                }).join('');
                if (!presets.length) presetSelect.innerHTML = '<option disabled>No presets</option>';
                if (presets.length) presetSelect.value = clamp(selectedIndex, 0, presets.length - 1);
                updatePresetActionState();
            }

            function updatePresetActionState() {
                const index = parseInt(presetSelect.value, 10);
                const preset = presets[index];
                const canDelete = Boolean(preset && presets.length > 1);
                if (presetDeleteBtn) {
                    presetDeleteBtn.disabled = !canDelete;
                    presetDeleteBtn.classList.toggle('is-muted-action', !canDelete);
                    const deleteTitle = canDelete
                        ? `Delete "${preset.name}"`
                        : 'Keep at least one preset.';
                    if (typeof setNativeTooltip === 'function') setNativeTooltip(presetDeleteBtn, deleteTitle);
                    else presetDeleteBtn.title = deleteTitle;
                }
            }

            function updatePresetWarningStatus() {
                updatePresetActionState();
                const index = parseInt(presetSelect.value, 10);
                const preset = presets[index];
                const warnings = getPresetWarnings(preset);
                if (warnings.length) setPresetStatus(`"${preset.name}" needs attention: ${warnings.join(' · ')}.`);
            }

            function addCurrentPreset() {
                const usedNames = new Set(presets.map(preset => preset.name));
                const defaultName = getUniquePresetName(`Custom Preset ${getCustomPresets().length + 1}`, usedNames);
                const rawName = prompt('Preset name:', defaultName);
                if (rawName === null) return;
                const name = getUniquePresetName(rawName, usedNames);
                const preset = {
                    name,
                    state: cloneSerializable(getCurrentState())
                };
                presets.push(styleDefaultPreset(preset));
                const saved = savePresetsToStorage();
                updatePresetDropdown(presets.length - 1);
                setPresetStatus(saved ? `Added "${name}".` : `Added "${name}" for this session. Browser storage is full, so export to keep it.`);
                if (typeof showUiToast === 'function') {
                    showUiToast(saved ? `Preset added: ${name}.` : `Preset added: ${name}. Export to keep it.`, saved ? 'info' : 'warning');
                }
            }

            function deleteSelectedPreset() {
                const index = parseInt(presetSelect.value, 10);
                const preset = presets[index];
                if (!preset) return;
                if (presets.length <= 1) {
                    setPresetStatus('Keep at least one preset.');
                    if (typeof showUiToast === 'function') showUiToast('Keep at least one preset.', 'warning');
                    updatePresetActionState();
                    return;
                }
                if (!confirm(`Delete preset "${preset.name}"?`)) return;
                const [deleted] = presets.splice(index, 1);
                const saved = savePresetsToStorage();
                const nextIndex = clamp(Math.min(index, presets.length - 1), 0, Math.max(0, presets.length - 1));
                updatePresetDropdown(nextIndex);
                setPresetStatus(saved ? `Deleted "${deleted.name}".` : `Deleted "${deleted.name}" for this session. Browser storage could not be updated.`);
                if (typeof showUiToast === 'function') {
                    showUiToast(saved ? `Preset deleted: ${deleted.name}.` : `Preset deleted: ${deleted.name}. Export to keep this list.`, saved ? 'info' : 'warning');
                }
            }

            function downloadTextFile(fileName, text, mimeType = 'application/json') {
                const blob = new Blob([text], { type: mimeType });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 0);
            }

            function getLocalDateStamp(date = new Date()) {
                const pad = value => String(value).padStart(2, '0');
                return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
            }

            function exportPresetCollection() {
                const payload = {
                    app: 'TEN26',
                    version: APP_VERSION,
                    exportedAt: new Date().toISOString(),
                    presets: presets.map(preset => ({
                        name: preset.name,
                        state: cloneSerializable(preset.state)
                    }))
                };
                const stamp = getLocalDateStamp();
                downloadTextFile(`ten26-presets-${stamp}.json`, `${JSON.stringify(payload, null, 2)}\n`);
                setPresetStatus(`Exported ${payload.presets.length} preset${payload.presets.length === 1 ? '' : 's'}.`);
                if (typeof showUiToast === 'function') showUiToast(`Exported ${payload.presets.length} preset${payload.presets.length === 1 ? '' : 's'}.`);
            }

            function importPresetCollectionFile(file) {
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const imported = normalizeVisiblePresetList(JSON.parse(String(reader.result || '{}')));
                        if (!imported.length) throw new Error('No valid presets found.');
                        presets = imported;
                        const saved = savePresetsToStorage();
                        updatePresetDropdown(0);
                        setPresetStatus(`Imported ${presets.length} preset${presets.length === 1 ? '' : 's'}.${saved ? '' : ' Browser storage is full, so export to keep this list.'}`);
                        if (typeof showUiToast === 'function') {
                            showUiToast(`Imported ${presets.length} preset${presets.length === 1 ? '' : 's'}.`, saved ? 'info' : 'warning');
                        }
                    } catch (error) {
                        console.error('Preset import failed:', error);
                        setPresetStatus('Preset import failed. Choose a TEN26 preset JSON file.');
                        if (typeof showUiToast === 'function') showUiToast('Preset import failed.', 'warning');
                    } finally {
                        if (presetImportFile) presetImportFile.value = '';
                    }
                };
                reader.onerror = () => {
                    setPresetStatus('Preset import failed. The file could not be read.');
                    if (typeof showUiToast === 'function') showUiToast('Preset import failed.', 'warning');
                    if (presetImportFile) presetImportFile.value = '';
                };
                reader.readAsText(file);
            }

            // Final build ships one curated global scene preset.
            function buildDefaultPresets() {
                const makeLayerState = (layerKey, blink, overrides = {}) => {
                    const incoming = {
                        ...overrides,
                        ...blink,
                        gridSize: '3',
                        midSize: String(clamp(readStateFloat(overrides.midSize, 3.6), 0.5, 5)),
                        targetSize: String(clamp(readStateFloat(overrides.targetSize, 4), 0.5, 5))
                    };
                    return coerceLayerStateForV12(createDefaultLayerState(layerKey, incoming), incoming);
                };
                const state = defaultState();
                const defaultSlides = cloneDefaultSlidesState();
                const blink = {
                    visibilityEnabled: true,
                    visibilityOn: '1.6',
                    visibilityOff: '0.28',
                    visibilityRandomness: '28',
                    visibilityProbability: '42',
                    visibilityGridProximity: '0'
                };
                const legacyLayers = {
                    top: makeLayerState('top', blink, { targetType: 'fill', mass: '1', friction: '34', speedLimit: '58', elasticity: '48', pull: '0.72', svgRadius: '360', returnPull: '0.38', gridRadius: '1600', orbit: '0', shuffle: '8', variation: '12', midSize: '3.4', targetSize: '4' }),
                    mid: makeLayerState('mid', blink, { targetType: 'path', mass: '1.5', friction: '42', speedLimit: '44', elasticity: '42', pull: '0.58', svgRadius: '460', returnPull: '0.34', gridRadius: '1700', orbit: '0.18', shuffle: '12', variation: '18', midSize: '3.6', targetSize: '3.8' }),
                    bottom: makeLayerState('bottom', blink, { targetType: 'anchor', mass: '2.2', friction: '48', speedLimit: '36', elasticity: '30', pull: '0.48', svgRadius: '540', returnPull: '0.3', gridRadius: '1800', orbit: '-0.12', shuffle: '0', variation: '10', midSize: '3.2', targetSize: '3.6' })
                };
                const normalizedLayers = normalizeLayerCollection(legacyLayers, ['top', 'mid', 'bottom']);
                state.activeLayerKey = normalizedLayers.sourceToTarget.top || normalizedLayers.layerOrder[0] || DEFAULT_LAYER_KEY;
                state.layerOrder = normalizedLayers.layerOrder;
                state.dotLayers = normalizedLayers.dotLayers;
                state.autoTransition = {
                    ...state.autoTransition,
                    currentTime: '0.9',
                    nextTime: '1.35',
                    returnGridTime: '0',
                    flickerBias: '8',
                    flickerSpeed: '8',
                    flickerBalance: '56',
                    flickerWildness: '34'
                };
                state.blink = blink;
                state.imageLayer = cloneDefaultImageLayerState();
                state.slides = defaultSlides;
                state.currentSlideIndex = clamp(getDefaultAssetBundle().currentSlideIndex || 0, 0, Math.max(0, defaultSlides.length - 1));
                state.slide = getDefaultSlideState();
                state.mask = getDefaultMaskState();
                return [{ name: 'Space Mod', state }];
            }

            function createDefaultPresets() {
                const stored = loadPresetsFromStorage();
                const merged = mergePresetsWithBuiltIns(stored?.presets || [], { fullList: stored?.isFullList });
                presets = merged.presets;
                updatePresetDropdown();
                setPresetStatus(stored?.isFullList
                    ? `${presets.length} preset${presets.length === 1 ? '' : 's'} loaded.`
                    : (merged.customCount
                        ? `Space Mod loaded with ${merged.customCount} custom preset${merged.customCount === 1 ? '' : 's'}.`
                        : 'Space Mod loaded. Add, export, or import presets here.'));
            }

            function getStartupPresetState() {
                const preset = presets.find(entry => entry?.name === 'Space Mod') || buildDefaultPresets()[0] || presets[0];
                return cloneSerializable(preset?.state || defaultState());
            }
