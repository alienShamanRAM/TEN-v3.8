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
                    entry.naturalWidth = slide.naturalWidth || 0;
                    entry.naturalHeight = slide.naturalHeight || 0;
                }
                return entry;
            }

            function createProjectMediaContext() {
                return {
                    mediaAssets: [],
                    async serializeSlide(slide) {
                        const entry = serializeSlideEntry(slide);
                        return stripEmbeddedVideoFromSlideEntry(entry);
                    }
                };
            }

            function addVideoLookupEntry(map, key, slide) {
                const normalized = String(key || '').trim();
                if (normalized && !map.has(normalized)) map.set(normalized, slide);
            }

            function buildCurrentVideoSlideLookup() {
                const lookup = new Map();
                slides.forEach(slide => {
                    if (slide?.type !== 'video') return;
                    addVideoLookupEntry(lookup, slide.name, slide);
                    addVideoLookupEntry(lookup, slide.fileName, slide);
                    addVideoLookupEntry(lookup, slide.videoFileName, slide);
                });
                return lookup;
            }

            function findVideoSlideForEntry(entry, lookup) {
                return lookup.get(String(entry?.videoFileName || '').trim())
                    || lookup.get(String(entry?.fileName || '').trim())
                    || lookup.get(String(entry?.name || '').trim())
                    || null;
            }

            function serializeSpecialOverlayEntry(overlay) {
                return {
                    type: 'special-svg',
                    name: overlay.name || overlay.fileName || 'Special SVG',
                    fileName: overlay.fileName || overlay.name || 'Special SVG',
                    svg: overlay.svg || '',
                    enabled: overlay.enabled !== false,
                    assignedSlides: normalizeSpecialOverlaySlideList(overlay.assignedSlides || [])
                };
            }

            function isLoadablePresetSlideEntry(slide) {
                if (!slide) return false;
                if (slide.type === 'image') return !!slide.svg && !!slide.imageSrc;
                if (slide.type === 'video') return !!slide.svg && !!(slide.videoSrc || slide.videoDataUrl);
                return !!slide.svg;
            }

            function createSlideFromPresetEntry(slide) {
                const name = slide.name || slide.fileName || (slide.type === 'video' ? 'Imported Video' : (slide.type === 'image' ? 'Imported Image' : 'Imported SVG'));
                if (slide.type === 'image') {
                    return createSlide(name, slide.svg || '', { type: 'image', imageSrc: slide.imageSrc || '' });
                }
                if (slide.type === 'video') {
                    const videoSrc = slide.videoSrc || slide.videoDataUrl || '';
                    const width = parseInt(slide.naturalWidth, 10) || STUDIO_WIDTH;
                    const height = parseInt(slide.naturalHeight, 10) || STUDIO_HEIGHT;
                    const duration = parseFloat(slide.duration);
                    return createSlide(name, slide.svg || createImageRectSvg(width, height), {
                        type: 'video',
                        videoSrc,
                        duration: Number.isFinite(duration) ? duration : 4,
                        naturalWidth: width,
                        naturalHeight: height
                    });
                }
                return createSlide(name, slide.svg || '', { type: 'svg' });
            }

            function buildProjectMediaAssetMap(mediaAssets = []) {
                return (Array.isArray(mediaAssets) ? mediaAssets : []).reduce((map, asset) => {
                    if (asset?.id) map.set(asset.id, asset);
                    return map;
                }, new Map());
            }

            function hydrateProjectSlideMedia(slide, mediaAssetMap) {
                if (!slide || slide.type !== 'video' || slide.videoSrc || slide.videoDataUrl || !slide.videoAssetId) {
                    return slide;
                }
                const asset = mediaAssetMap.get(slide.videoAssetId);
                if (!asset?.src) return slide;
                return {
                    ...slide,
                    videoSrc: asset.src,
                    videoMissing: false,
                    duration: slide.duration || asset.duration || 0,
                    naturalWidth: slide.naturalWidth || asset.naturalWidth || 0,
                    naturalHeight: slide.naturalHeight || asset.naturalHeight || 0
                };
            }

            function hydrateProjectStateMedia(state, mediaAssetMap) {
                const next = cloneSerializable(state || {});
                if (Array.isArray(next.slides)) {
                    next.slides = next.slides.map(slide => hydrateProjectSlideMedia(slide, mediaAssetMap));
                }
                return next;
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
                    mouse: getMouseInteractionControlState(),
                    blink: forceBlinkRespawnState(getBlinkStateFromControls()),
                    randomRanges: getRandomRangeState(),
                    randomLocks: getRandomLockState(),
                    stage: getStageState(),
                    view: typeof getViewOptionState === 'function' ? getViewOptionState() : {},
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
                    specialOverlays: specialOverlays.map(serializeSpecialOverlayEntry),
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

            const LAYER_PRESET_CONFIG_LAYER_KEYS = [
                'visibilityEnabled',
                'visibilityOn',
                'visibilityOff',
                'visibilityRandomness',
                'visibilityProbability',
                'visibilityGridProximity',
                'visibilityRespawn'
            ];

            function stripConfigFieldsFromLayerState(layer = {}) {
                const next = { ...layer };
                LAYER_PRESET_CONFIG_LAYER_KEYS.forEach(key => delete next[key]);
                return next;
            }

            function getLayerPresetControlPrefix(layerKey) {
                return `dot-${layerKey}-`;
            }

            function isLayerPresetControlId(id, layerOrder = ALL_DOT_LAYER_KEYS) {
                if (typeof id !== 'string' || !id) return false;
                return layerOrder.some(layerKey => id.startsWith(getLayerPresetControlPrefix(layerKey)));
            }

            function remapLayerPresetControlId(id, sourceToTarget = {}) {
                if (typeof id !== 'string' || !id) return '';
                const entries = Object.entries(sourceToTarget)
                    .filter(([sourceKey, targetKey]) => sourceKey && targetKey)
                    .sort((a, b) => b[0].length - a[0].length);
                for (const [sourceKey, targetKey] of entries) {
                    const sourcePrefix = getLayerPresetControlPrefix(sourceKey);
                    if (id.startsWith(sourcePrefix)) {
                        return `${getLayerPresetControlPrefix(targetKey)}${id.slice(sourcePrefix.length)}`;
                    }
                }
                return id;
            }

            function filterLayerPresetRandomRanges(state = {}, layerOrder = ALL_DOT_LAYER_KEYS, sourceToTarget = {}) {
                if (!state || typeof state !== 'object') return {};
                return Object.entries(state).reduce((acc, [id, range]) => {
                    const remappedId = remapLayerPresetControlId(id, sourceToTarget);
                    if (!isLayerPresetControlId(remappedId, layerOrder)) return acc;
                    if (!range || range.randomMin === undefined || range.randomMax === undefined) return acc;
                    acc[remappedId] = {
                        randomMin: String(range.randomMin),
                        randomMax: String(range.randomMax)
                    };
                    return acc;
                }, {});
            }

            function filterLayerPresetRandomLocks(state = [], layerOrder = ALL_DOT_LAYER_KEYS, sourceToTarget = {}) {
                const source = Array.isArray(state)
                    ? state
                    : Object.entries(state || {}).filter(([, locked]) => locked).map(([id]) => id);
                return Array.from(new Set(source
                    .map(id => remapLayerPresetControlId(id, sourceToTarget))
                    .filter(id => isLayerPresetControlId(id, layerOrder))));
            }

            function clampLayerPresetStackIndex(value, layerOrder = []) {
                const numeric = Number.isFinite(parseFloat(value)) ? Math.round(parseFloat(value)) : layerOrder.length;
                return Math.max(0, Math.min(layerOrder.length, numeric));
            }

            function createLayerPresetState(state = {}) {
                const sourceState = state && typeof state === 'object' ? state : {};
                const incomingLayers = sourceState.dotLayers || buildLegacyLayerState(sourceState);
                let normalizedLayers = normalizeLayerCollection(incomingLayers, sourceState.layerOrder);
                if (!normalizedLayers.layerOrder.length) {
                    normalizedLayers = normalizeLayerCollection({
                        [DEFAULT_LAYER_KEY]: createDefaultLayerState(DEFAULT_LAYER_KEY, { name: 'Grid 1' })
                    }, [DEFAULT_LAYER_KEY]);
                }
                const layerOrder = normalizedLayers.layerOrder.length ? normalizedLayers.layerOrder : [DEFAULT_LAYER_KEY];
                const dotLayers = layerOrder.reduce((acc, layerKey) => {
                    const incoming = normalizedLayers.dotLayers[layerKey] || {};
                    const coerced = coerceLayerStateForV12(createDefaultLayerState(layerKey, incoming), incoming);
                    acc[layerKey] = stripConfigFieldsFromLayerState(coerced);
                    return acc;
                }, {});
                const mappedActiveLayerKey = normalizedLayers.sourceToTarget[sourceState.activeLayerKey] || sourceState.activeLayerKey;
                const activePresetLayerKey = layerOrder.includes(mappedActiveLayerKey) ? mappedActiveLayerKey : layerOrder[0];
                return {
                    presetType: 'layers',
                    activeLayerKey: activePresetLayerKey || DEFAULT_LAYER_KEY,
                    layerOrder,
                    svgMediaStackIndex: clampLayerPresetStackIndex(sourceState.svgMediaStackIndex ?? layerOrder.length, layerOrder),
                    dotLayers,
                    randomRanges: filterLayerPresetRandomRanges(sourceState.randomRanges || {}, layerOrder, normalizedLayers.sourceToTarget),
                    randomLocks: filterLayerPresetRandomLocks(sourceState.randomLocks || [], layerOrder, normalizedLayers.sourceToTarget)
                };
            }

            function getCurrentLayerPresetState() {
                return createLayerPresetState(getCurrentState());
            }

            function applyLayerPresetRandomState(layerPreset = {}) {
                const preservedRanges = Object.entries(getRandomRangeState())
                    .filter(([id]) => !isLayerPresetControlId(id))
                    .reduce((acc, [id, range]) => {
                        acc[id] = range;
                        return acc;
                    }, {});
                applyRandomRangeState({
                    ...preservedRanges,
                    ...(layerPreset.randomRanges || {})
                });

                const preservedLocks = getRandomLockState().filter(id => !isLayerPresetControlId(id));
                applyRandomLockState([
                    ...preservedLocks,
                    ...(layerPreset.randomLocks || [])
                ]);
            }

            function applyLayerPresetState(state) {
                if (!state) return;
                const layerPreset = createLayerPresetState(state);
                const blinkState = forceBlinkRespawnState(getBlinkStateFromControls());
                const layerOrder = layerPreset.layerOrder.length ? layerPreset.layerOrder : [DEFAULT_LAYER_KEY];
                DOT_LAYER_KEYS = layerOrder;
                svgMediaStackIndex = clampSvgMediaStackIndex(layerPreset.svgMediaStackIndex ?? DOT_LAYER_KEYS.length);
                dotLayerStates = ALL_DOT_LAYER_KEYS.reduce((acc, layerKey) => {
                    const incoming = {
                        ...(layerPreset.dotLayers[layerKey] || {}),
                        ...blinkState
                    };
                    acc[layerKey] = coerceLayerStateForV12(createDefaultLayerState(layerKey, incoming), incoming);
                    return acc;
                }, {});
                invalidateLayerRuntimeConfig();
                activeLayerKey = DOT_LAYER_KEYS.includes(layerPreset.activeLayerKey) ? layerPreset.activeLayerKey : DOT_LAYER_KEYS[0];
                pendingSlideIndex = null;
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
                resetDotMaskScales(1);
                loadActiveLayerIntoUi();
                applyLayerPresetRandomState(layerPreset);
                syncLayerRegistryUi();
                renderCurrentSlide();
                if (typeof precomputeAllTransitionAssetsSync === 'function') precomputeAllTransitionAssetsSync();
                if (state.view && typeof applyViewOptionState === 'function') applyViewOptionState(state.view);
                document.querySelectorAll('input[type="range"]').forEach(updateRangeIndicator);
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
                applyMouseInteractionControlState(state.mouse || {});
                mediaMode = state.mediaMode === 'videos' ? 'videos' : 'images';
                updateMediaModeUi();

                if (hasOwnValue(state, 'imageLayer')) {
                    const image = state.imageLayer || {};
                    const hasEmbeddedImageSource = hasOwnValue(image, 'src');
                    const previousImageState = imageState || {};
                    const previousImageName = previousImageState.name || previousImageState.fileName || '';
                    const imageName = image.name || image.fileName || (hasEmbeddedImageSource ? '' : previousImageName);
                    imageState = {
                        name: imageName,
                        fileName: image.fileName || imageName,
                        src: hasEmbeddedImageSource ? (image.src || '') : (previousImageState.src || ''),
                        hidden: image.hidden === true,
                        naturalWidth: hasEmbeddedImageSource ? (image.naturalWidth || 0) : (previousImageState.naturalWidth || 0),
                        naturalHeight: hasEmbeddedImageSource ? (image.naturalHeight || 0) : (previousImageState.naturalHeight || 0)
                    };
                    setControlValue(imageControls.scale, image.scale || '100');
                    setControlValue(imageControls.offsetX, image.offsetX || '0');
                    setControlValue(imageControls.offsetY, image.offsetY || '0');
                    updateImageLayer();
                }

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
                        .filter(slide => slide && slide.type === 'video' && !isLoadablePresetSlideEntry(slide) && (slide.name || slide.fileName || slide.videoFileName))
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
                    const nextSlideIndex = hasOwnValue(state, 'currentSlideIndex') ? state.currentSlideIndex : currentSlideIndex;
                    currentSlideIndex = clamp(nextSlideIndex || 0, 0, Math.max(0, slides.length - 1));
                }
                applySpecialOverlayState(Array.isArray(state.specialOverlays) ? state.specialOverlays : []);
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
                resetDotMaskScales(1);
                loadActiveLayerIntoUi();
                applyRandomRangeState(state.randomRanges || {});
                applyRandomLockState(state.randomLocks || []);
                syncLayerRegistryUi();
                renderCurrentSlide();
                if (typeof precomputeAllTransitionAssetsSync === 'function') precomputeAllTransitionAssetsSync();
                document.querySelectorAll('input[type="range"]').forEach(updateRangeIndicator);
            }

            function getSvgState() {
                return {
                    slides: slides.map(serializeSlideEntry),
                    specialOverlays: specialOverlays.map(serializeSpecialOverlayEntry),
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
                    .filter(slide => slide && slide.type === 'video' && !isLoadablePresetSlideEntry(slide) && (slide.name || slide.fileName || slide.videoFileName))
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
                applySpecialOverlayState(Array.isArray(state.specialOverlays) ? state.specialOverlays : []);
                pendingSlideIndex = null;
                slideOpacity = slides.length ? 1 : 0;
                slideFade = null;
                holdState = 'idle';
                activeHoldMode = null;
                activeHoldCode = null;
                autoTransition = null;
                resetForcesToGrid();
                DOT_LAYER_KEYS.forEach(layerKey => dotGroups[layerKey].returnToGrid());
                resetDotMaskScales(1);
                clearMaskCache();
                renderCurrentSlide();
                if (typeof precomputeAllTransitionAssetsSync === 'function') precomputeAllTransitionAssetsSync();
                refreshAttractorTargetsIfNeeded();
                document.querySelectorAll('input[type="range"]').forEach(updateRangeIndicator);
            }

            let presets = [];
            let savedSettings = [];
            let builtInPresetNames = new Set();
            const APP_VERSION = 'ten26-layer-presets-v1';
            const PRESET_STORAGE_KEY = 'ten26.savedCustomPresets.v4.jsonStartup';
            const PRESET_STORAGE_MODE = 'layer-preset-list';
            const SETTINGS_VERSION = 'ten26-settings-v1';
            const SETTINGS_STORAGE_KEY = 'ten26.savedSettings.v2.jsonStartup';
            const SETTINGS_STORAGE_MODE = 'settings-list';
            const PROJECT_VERSION = 'ten26-project-v1';
            const PROJECT_STORAGE_MODE = 'full-project';
            let bundledStartupPresets = null;
            let bundledStartupSettings = null;

            function getDefaultAssetBundle() {
                return window.TEN26_DEFAULT_ASSETS || {};
            }

            function getBundledStartupPresets() {
                if (bundledStartupPresets === null) {
                    bundledStartupPresets = normalizePresetCollection(window.TEN26_STARTUP_PRESETS || []);
                }
                return bundledStartupPresets.map(preset => ({
                    name: preset.name,
                    state: cloneSerializable(preset.state)
                }));
            }

            function getBundledStartupSettings() {
                if (bundledStartupSettings === null) {
                    bundledStartupSettings = normalizeSettingsCollection(window.TEN26_STARTUP_SETTINGS || []);
                }
                return bundledStartupSettings.map(setting => ({
                    name: setting.name,
                    state: cloneSerializable(setting.state)
                }));
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
                        globalSpeed: '100',
                        currentTime: '3',
                        nextTime: '2',
                        returnGridTime: '0',
                        flickerBias: '6',
                        flickerSpeed: '10',
                        overlayFlickerSpeed: '10',
                        flickerBalance: '75',
                        flickerWildness: '100',
                        autoDuration: '4'
                    },
                    mouse: {
                        enabled: false,
                        repelStrength: '300',
                        svgTargetCount: '400',
                        radius: '520',
                        softness: '3',
                        scrollStep: '20'
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
                    specialOverlays: [],
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

            function setSettingsStatus(text) {
                if (settingsStatus) settingsStatus.textContent = text;
                if (typeof setOverlayStatus === 'function') setOverlayStatus(text);
            }

            function setProjectStatus(text) {
                if (projectStatus) projectStatus.textContent = text;
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

            function hasOwnValue(source, key) {
                return Object.prototype.hasOwnProperty.call(source || {}, key);
            }

            const SETTINGS_STATE_KEYS = [
                'autoTransition',
                'mouse',
                'blink',
                'stage',
                'view',
                'imageLayer',
                'bg',
                'appBackdrop',
                'slides',
                'specialOverlays',
                'mediaMode',
                'currentSlideIndex',
                'slide',
                'mask',
                'imageSlide',
                'imageMask'
            ];
            const SETTINGS_OBJECT_STATE_KEYS = [
                'autoTransition',
                'mouse',
                'blink',
                'stage',
                'view',
                'imageLayer',
                'bg',
                'appBackdrop',
                'slide',
                'mask',
                'imageSlide',
                'imageMask'
            ];

            function createSettingsState(state) {
                const captureCurrentState = state === undefined;
                const source = captureCurrentState
                    ? getCurrentState()
                    : (state && typeof state === 'object' ? state : {});
                const next = { settingsType: 'non-layer-settings' };
                SETTINGS_STATE_KEYS.forEach(key => {
                    if (hasOwnValue(source, key)) next[key] = cloneSerializable(source[key]);
                });
                if (captureCurrentState && !hasOwnValue(next, 'view') && typeof getViewOptionState === 'function') {
                    next.view = getViewOptionState();
                }
                return next;
            }

            function stripEmbeddedVideoFromSlideEntry(slide) {
                if (!slide || slide.type !== 'video') return slide;
                const next = { ...slide };
                delete next.videoSrc;
                delete next.videoDataUrl;
                delete next.videoAssetId;
                next.videoMissing = true;
                next.videoFileName = next.videoFileName || next.fileName || next.name || '';
                return next;
            }

            function stripEmbeddedVideosFromSettingsSource(state = {}) {
                if (!state || typeof state !== 'object' || !Array.isArray(state.slides)) return state;
                return {
                    ...state,
                    slides: state.slides.map(stripEmbeddedVideoFromSlideEntry)
                };
            }

            function hasEmbeddedVideoSourceInSettings(settingsList = []) {
                return settingsList.some(setting => Array.isArray(setting?.state?.slides)
                    && setting.state.slides.some(slide => slide?.type === 'video' && (slide.videoSrc || slide.videoDataUrl || slide.videoAssetId)));
            }

            function createSettingsStateForStorage(state) {
                const next = createSettingsState(state === undefined
                    ? state
                    : stripEmbeddedVideosFromSettingsSource(state));
                if (Array.isArray(next.slides)) {
                    next.slides = next.slides.map(stripEmbeddedVideoFromSlideEntry);
                }
                return next;
            }

            function applySettingsState(state = {}) {
                const current = getCurrentState();
                const layerPreset = createLayerPresetState(current);
                const settingsState = createSettingsState(state);
                const merged = {
                    ...current,
                    ...settingsState,
                    ...layerPreset
                };
                SETTINGS_OBJECT_STATE_KEYS.forEach(key => {
                    if (
                        settingsState[key] &&
                        typeof settingsState[key] === 'object' &&
                        !Array.isArray(settingsState[key]) &&
                        current[key] &&
                        typeof current[key] === 'object' &&
                        !Array.isArray(current[key])
                    ) {
                        merged[key] = {
                            ...current[key],
                            ...settingsState[key]
                        };
                    }
                });
                applyState(merged);
            }

            function createValuesOnlyImageLayerState(imageLayer = {}) {
                return {
                    hidden: imageLayer.hidden === true,
                    scale: imageLayer.scale || '100',
                    offsetX: imageLayer.offsetX || '0',
                    offsetY: imageLayer.offsetY || '0'
                };
            }

            function createValuesOnlyPresetState(state = {}) {
                const compact = cloneSerializable(state || {});
                delete compact.slides;
                if (compact.imageLayer && typeof compact.imageLayer === 'object') {
                    compact.imageLayer = createValuesOnlyImageLayerState(compact.imageLayer);
                }
                return compact;
            }

            function serializePresetForValuesOnlySave(preset) {
                return {
                    name: preset.name,
                    state: createValuesOnlyPresetState(preset.state)
                };
            }

            function serializePresetForLayerSave(preset) {
                return {
                    name: preset.name,
                    state: createLayerPresetState(preset.state)
                };
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

            function serializeSettingsForSave(setting) {
                return {
                    name: setting.name,
                    state: createSettingsStateForStorage(setting.state)
                };
            }

            async function serializeSettingsForProject(setting, mediaContext, videoLookup) {
                const next = {
                    name: setting.name,
                    state: createSettingsState(setting.state)
                };
                if (!Array.isArray(next.state.slides)) return next;
                next.state.slides = await Promise.all(next.state.slides.map(async slide => {
                    if (!slide || slide.type !== 'video') return slide;
                    const sourceSlide = (slide.videoSrc || slide.videoDataUrl)
                        ? slide
                        : findVideoSlideForEntry(slide, videoLookup);
                    if (!sourceSlide) return stripEmbeddedVideoFromSlideEntry(slide);
                    const projectSlide = await mediaContext.serializeSlide({
                        ...sourceSlide,
                        name: slide.name || sourceSlide.name,
                        fileName: slide.fileName || sourceSlide.fileName,
                        svg: slide.svg || sourceSlide.svg,
                        duration: slide.duration || sourceSlide.duration,
                        naturalWidth: slide.naturalWidth || sourceSlide.naturalWidth,
                        naturalHeight: slide.naturalHeight || sourceSlide.naturalHeight
                    });
                    return {
                        ...stripEmbeddedVideoFromSlideEntry(slide),
                        videoAssetId: projectSlide.videoAssetId,
                        videoMissing: projectSlide.videoMissing === true,
                        duration: slide.duration || projectSlide.duration || 0,
                        naturalWidth: slide.naturalWidth || projectSlide.naturalWidth || 0,
                        naturalHeight: slide.naturalHeight || projectSlide.naturalHeight || 0
                    };
                }));
                return next;
            }

            function normalizeSettingsCollection(payload) {
                const source = Array.isArray(payload)
                    ? payload
                    : (Array.isArray(payload?.settings) ? payload.settings : (payload?.name && payload?.state ? [payload] : []));
                const usedNames = new Set();
                return source.reduce((list, setting, index) => {
                    if (!setting || typeof setting !== 'object' || !setting.state || typeof setting.state !== 'object') return list;
                    try {
                        const fallback = `Imported Settings ${index + 1}`;
                        const name = getUniquePresetName(normalizePresetName(setting.name, fallback), usedNames);
                        usedNames.add(name);
                        list.push({
                            name,
                            state: createSettingsState(setting.state)
                        });
                    } catch (error) {
                        console.warn('Skipped invalid settings:', error);
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
                        assetMode: 'layers-only',
                        savedAt: new Date().toISOString(),
                        presets: source.map(serializePresetForLayerSave)
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

            function saveSettingsToStorage(source = savedSettings) {
                try {
                    const payload = {
                        app: 'TEN26',
                        version: SETTINGS_VERSION,
                        storageMode: SETTINGS_STORAGE_MODE,
                        assetMode: 'settings-without-layers',
                        savedAt: new Date().toISOString(),
                        settings: source.map(serializeSettingsForSave)
                    };
                    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
                    return true;
                } catch (error) {
                    console.warn('Settings storage failed:', error);
                    return false;
                }
            }

            function loadSettingsFromStorage() {
                try {
                    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
                    if (!raw) return [];
                    const payload = JSON.parse(raw);
                    return normalizeSettingsCollection(payload);
                } catch (error) {
                    console.warn('Settings storage could not be read:', error);
                    return [];
                }
            }

            function getEntriesInSelectOrder(select, source = []) {
                const options = Array.from(select?.options || []);
                if (!options.length) return source.slice();
                const ordered = options.reduce((list, option) => {
                    const index = parseInt(option.value, 10);
                    if (Number.isInteger(index) && source[index]) list.push(source[index]);
                    return list;
                }, []);
                return ordered.length || !source.length ? ordered : source.slice();
            }

            function getPresetExportItems() {
                return getEntriesInSelectOrder(presetSelect, presets).map(serializePresetForLayerSave);
            }

            function getSettingsExportItems() {
                return getEntriesInSelectOrder(settingsSelect, savedSettings).map(serializeSettingsForSave);
            }

            function buildPresetCollectionPayload(date = new Date()) {
                return {
                    app: 'TEN26',
                    version: APP_VERSION,
                    storageMode: PRESET_STORAGE_MODE,
                    assetMode: 'layers-only',
                    exportedAt: date.toISOString(),
                    presets: getPresetExportItems()
                };
            }

            function buildSettingsCollectionPayload(date = new Date()) {
                return {
                    app: 'TEN26',
                    version: SETTINGS_VERSION,
                    storageMode: SETTINGS_STORAGE_MODE,
                    assetMode: 'settings-without-layers',
                    exportedAt: date.toISOString(),
                    settings: getSettingsExportItems()
                };
            }

            async function buildProjectCollectionPayload(date = new Date()) {
                const mediaContext = createProjectMediaContext();
                const videoLookup = buildCurrentVideoSlideLookup();
                const state = getCurrentState();
                state.slides = await Promise.all(slides.map(slide => mediaContext.serializeSlide(slide)));
                const settings = await Promise.all(getEntriesInSelectOrder(settingsSelect, savedSettings)
                    .map(setting => serializeSettingsForProject(setting, mediaContext, videoLookup)));
                return {
                    app: 'TEN26',
                    version: PROJECT_VERSION,
                    storageMode: PROJECT_STORAGE_MODE,
                    assetMode: 'complete-project',
                    exportedAt: date.toISOString(),
                    mediaAssets: mediaContext.mediaAssets,
                    state,
                    presets: getPresetExportItems(),
                    settings
                };
            }

            function normalizeProjectPayload(payload) {
                if (!payload || typeof payload !== 'object') throw new Error('Invalid project payload.');
                const hasProjectShape = payload.storageMode === PROJECT_STORAGE_MODE || payload.assetMode === 'complete-project' || payload.state;
                if (!hasProjectShape || !payload.state || typeof payload.state !== 'object') {
                    throw new Error('No TEN26 project state found.');
                }
                const mediaAssetMap = buildProjectMediaAssetMap(payload.mediaAssets || []);
                return {
                    state: hydrateProjectStateMedia(payload.state, mediaAssetMap),
                    presets: normalizeVisiblePresetList(payload.presets || []),
                    settings: normalizeSettingsCollection((payload.settings || []).map(setting => ({
                        ...setting,
                        state: hydrateProjectStateMedia(setting?.state || {}, mediaAssetMap)
                    })))
                };
            }

            function applyProjectPayload(payload) {
                const project = normalizeProjectPayload(payload);
                if (project.presets.length) {
                    presets = project.presets;
                    savePresetsToStorage();
                    updatePresetDropdown(0);
                }
                savedSettings = project.settings;
                const settingsHaveEmbeddedMedia = hasEmbeddedVideoSourceInSettings(savedSettings);
                const settingsSaved = settingsHaveEmbeddedMedia ? false : saveSettingsToStorage();
                updateSettingsDropdown(0);
                if (settingsHaveEmbeddedMedia) {
                    setSettingsStatus('Imported project settings with embedded video media for this session. Project export will save videos as references only.');
                } else if (!settingsSaved && savedSettings.length) {
                    setSettingsStatus('Imported project settings for this session. Browser storage is full, so export to keep this list.');
                }
                applyState(project.state);
                setProjectStatus(`Imported project with ${project.presets.length || presets.length} preset${(project.presets.length || presets.length) === 1 ? '' : 's'} and ${project.settings.length} settings item${project.settings.length === 1 ? '' : 's'}.`);
                if (typeof showUiToast === 'function') showUiToast('Project imported.');
            }

            function updateSettingsActionState() {
                const index = parseInt(settingsSelect?.value, 10);
                const setting = savedSettings[index];
                const hasSettings = Boolean(setting);
                if (settingsSelect) settingsSelect.disabled = !savedSettings.length;
                if (settingsApplyBtn) {
                    settingsApplyBtn.disabled = !hasSettings;
                    settingsApplyBtn.classList.toggle('is-muted-action', !hasSettings);
                    if (typeof setNativeTooltip === 'function') {
                        setNativeTooltip(settingsApplyBtn, hasSettings ? `Apply "${setting.name}" without changing layer values.` : 'No saved settings to apply.');
                    }
                }
                if (settingsDeleteBtn) {
                    settingsDeleteBtn.disabled = !hasSettings;
                    settingsDeleteBtn.classList.toggle('is-muted-action', !hasSettings);
                    const deleteTitle = hasSettings ? `Delete "${setting.name}"` : 'No saved settings to delete.';
                    if (typeof setNativeTooltip === 'function') setNativeTooltip(settingsDeleteBtn, deleteTitle);
                    else settingsDeleteBtn.title = deleteTitle;
                }
                if (settingsExportBtn) {
                    settingsExportBtn.disabled = !savedSettings.length;
                    settingsExportBtn.classList.toggle('is-muted-action', !savedSettings.length);
                }
            }

            function updateSettingsDropdown(selectedIndex = 0) {
                if (!settingsSelect) return;
                settingsSelect.innerHTML = savedSettings.length
                    ? savedSettings.map((setting, index) => `<option value="${index}">${escapeHtml(setting.name)}</option>`).join('')
                    : '<option value="" disabled>No saved settings</option>';
                if (savedSettings.length) settingsSelect.value = String(clamp(selectedIndex, 0, savedSettings.length - 1));
                updateSettingsActionState();
            }

            function addCurrentSettings() {
                const usedNames = new Set(savedSettings.map(setting => setting.name));
                const defaultName = getUniquePresetName(`Settings ${savedSettings.length + 1}`, usedNames);
                const rawName = prompt('Settings name:', defaultName);
                if (rawName === null) return;
                const name = getUniquePresetName(rawName, usedNames);
                savedSettings.push({
                    name,
                    state: createSettingsState()
                });
                const saved = saveSettingsToStorage();
                updateSettingsDropdown(savedSettings.length - 1);
                setSettingsStatus(saved ? `Saved settings "${name}". Layer values are not included.` : `Saved settings "${name}" for this session. Browser storage is full, so export to keep it.`);
                if (typeof showUiToast === 'function') {
                    showUiToast(saved ? `Settings saved: ${name}.` : `Settings saved: ${name}. Export to keep it.`, saved ? 'info' : 'warning');
                }
            }

            function applySelectedSettings() {
                const index = parseInt(settingsSelect?.value, 10);
                const setting = savedSettings[index];
                if (!setting) return;
                applySettingsState(setting.state);
                setSettingsStatus(`Applied settings "${setting.name}". Layer values kept.`);
                if (typeof showUiToast === 'function') showUiToast(`Settings applied: ${setting.name}.`);
            }

            function deleteSelectedSettings() {
                const index = parseInt(settingsSelect?.value, 10);
                const setting = savedSettings[index];
                if (!setting) return;
                if (!confirm(`Delete settings "${setting.name}"?`)) return;
                const [deleted] = savedSettings.splice(index, 1);
                const saved = saveSettingsToStorage();
                const nextIndex = savedSettings.length ? clamp(Math.min(index, savedSettings.length - 1), 0, savedSettings.length - 1) : 0;
                updateSettingsDropdown(nextIndex);
                setSettingsStatus(saved
                    ? `Deleted settings "${deleted.name}".`
                    : `Deleted settings "${deleted.name}" for this session. Browser storage could not be updated.`);
                if (typeof showUiToast === 'function') {
                    showUiToast(saved ? `Settings deleted: ${deleted.name}.` : `Settings deleted: ${deleted.name}. Export to keep this list.`, saved ? 'info' : 'warning');
                }
            }

            function getPresetWarnings(preset) {
                const state = preset?.state || {};
                const warnings = [];
                const normalizedLayers = state.dotLayers
                    ? normalizeLayerCollection(state.dotLayers, state.layerOrder)
                    : normalizeLayerCollection(buildLegacyLayerState(state), state.layerOrder);
                const presetLayerOrder = normalizedLayers?.layerOrder?.length ? normalizedLayers.layerOrder : [];
                if (!presetLayerOrder.length) warnings.push('grid layer values');
                return warnings;
            }

            function styleDefaultPreset(preset) {
                const state = createLayerPresetState(preset.state || {});
                return { ...preset, state };
            }

            function normalizeVisiblePresetList(source = []) {
                const usedNames = new Set();
                return normalizePresetCollection(source).reduce((list, preset) => {
                    if (isRetiredBuiltInPresetName(preset.name)) return list;
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
                    const storedPresets = normalizeVisiblePresetList(stored);
                    const visibleBuiltInCount = storedPresets.filter(preset => builtInPresetNames.has(preset.name)).length;
                    const retiredCount = normalizePresetCollection(stored).filter(preset => isRetiredBuiltInPresetName(preset.name)).length;
                    return {
                        presets: storedPresets.length ? storedPresets : builtIns,
                        customCount: storedPresets.filter(preset => !builtInPresetNames.has(preset.name)).length,
                        builtInCount: storedPresets.length ? visibleBuiltInCount : builtIns.length,
                        retiredCount
                    };
                }
                const usedNames = new Set(builtInPresetNames);
                const storedPresets = normalizePresetCollection(stored);
                let retiredCount = 0;
                const customPresets = storedPresets.reduce((list, preset) => {
                    if (builtInPresetNames.has(preset.name) || isRetiredBuiltInPresetName(preset.name)) {
                        if (isRetiredBuiltInPresetName(preset.name)) retiredCount += 1;
                        return list;
                    }
                    const name = getUniquePresetName(preset.name, usedNames);
                    usedNames.add(name);
                    list.push(styleDefaultPreset({ name, state: preset.state }));
                    return list;
                }, []);
                return {
                    presets: [...builtIns, ...customPresets],
                    customCount: customPresets.length,
                    builtInCount: builtIns.length,
                    retiredCount
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
                    state: getCurrentLayerPresetState()
                };
                presets.push(styleDefaultPreset(preset));
                const saved = savePresetsToStorage();
                updatePresetDropdown(presets.length - 1);
                setPresetStatus(saved ? `Added layer preset "${name}".` : `Added layer preset "${name}" for this session. Browser storage is full, so export to keep it.`);
                if (typeof showUiToast === 'function') {
                    showUiToast(saved ? `Layer preset added: ${name}.` : `Layer preset added: ${name}. Export to keep it.`, saved ? 'info' : 'warning');
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
                const payload = buildPresetCollectionPayload();
                const stamp = getLocalDateStamp();
                downloadTextFile(`ten26-presets-${stamp}.json`, `${JSON.stringify(payload, null, 2)}\n`);
                setPresetStatus(`Exported ${payload.presets.length} layer preset${payload.presets.length === 1 ? '' : 's'}.`);
                if (typeof showUiToast === 'function') showUiToast(`Exported ${payload.presets.length} layer preset${payload.presets.length === 1 ? '' : 's'}.`);
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
                        setPresetStatus(`Imported ${presets.length} layer preset${presets.length === 1 ? '' : 's'}.${saved ? '' : ' Browser storage is full, so export to keep this list.'}`);
                        if (typeof showUiToast === 'function') {
                            showUiToast(`Imported ${presets.length} layer preset${presets.length === 1 ? '' : 's'}.`, saved ? 'info' : 'warning');
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

            function exportSettingsCollection() {
                const payload = buildSettingsCollectionPayload();
                const stamp = getLocalDateStamp();
                downloadTextFile(`ten26-settings-${stamp}.json`, `${JSON.stringify(payload, null, 2)}\n`);
                setSettingsStatus(`Exported ${payload.settings.length} saved settings item${payload.settings.length === 1 ? '' : 's'}.`);
                if (typeof showUiToast === 'function') showUiToast(`Exported ${payload.settings.length} settings item${payload.settings.length === 1 ? '' : 's'}.`);
            }

            function importSettingsCollectionFile(file) {
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const imported = normalizeSettingsCollection(JSON.parse(String(reader.result || '{}')));
                        if (!imported.length) throw new Error('No valid settings found.');
                        savedSettings = imported;
                        const saved = saveSettingsToStorage();
                        updateSettingsDropdown(0);
                        setSettingsStatus(`Imported ${savedSettings.length} settings item${savedSettings.length === 1 ? '' : 's'}.${saved ? '' : ' Browser storage is full, so export to keep this list.'}`);
                        if (typeof showUiToast === 'function') {
                            showUiToast(`Imported ${savedSettings.length} settings item${savedSettings.length === 1 ? '' : 's'}.`, saved ? 'info' : 'warning');
                        }
                    } catch (error) {
                        console.error('Settings import failed:', error);
                        setSettingsStatus('Settings import failed. Choose a TEN26 settings JSON file.');
                        if (typeof showUiToast === 'function') showUiToast('Settings import failed.', 'warning');
                    } finally {
                        if (settingsImportFile) settingsImportFile.value = '';
                    }
                };
                reader.onerror = () => {
                    setSettingsStatus('Settings import failed. The file could not be read.');
                    if (typeof showUiToast === 'function') showUiToast('Settings import failed.', 'warning');
                    if (settingsImportFile) settingsImportFile.value = '';
                };
                reader.readAsText(file);
            }

            async function exportProjectCollection() {
                const previousDisabled = projectExportBtn?.disabled === true;
                if (projectExportBtn) projectExportBtn.disabled = true;
                setProjectStatus('Preparing complete project export...');
                try {
                    const payload = await buildProjectCollectionPayload();
                    const stamp = getLocalDateStamp();
                    downloadTextFile(`ten26-project-${stamp}.json`, `${JSON.stringify(payload, null, 2)}\n`);
                    const videoReferences = payload.state.slides.filter(slide => slide.type === 'video').length;
                    setProjectStatus(`Exported complete project with ${payload.presets.length} preset${payload.presets.length === 1 ? '' : 's'}, ${payload.settings.length} settings item${payload.settings.length === 1 ? '' : 's'}, and ${payload.state.slides.length} slide${payload.state.slides.length === 1 ? '' : 's'}.${videoReferences ? ` ${videoReferences} video${videoReferences === 1 ? '' : 's'} saved as references only.` : ''}`);
                    if (typeof showUiToast === 'function') {
                        showUiToast(videoReferences
                            ? `Project exported. ${videoReferences} video${videoReferences === 1 ? '' : 's'} saved as references only.`
                            : 'Project exported.');
                    }
                } catch (error) {
                    console.error('Project export failed:', error);
                    setProjectStatus('Project export failed. Check the console for details.');
                    if (typeof showUiToast === 'function') showUiToast('Project export failed.', 'warning');
                } finally {
                    if (projectExportBtn) projectExportBtn.disabled = previousDisabled;
                }
            }

            function importProjectCollectionFile(file) {
                if (!file) return;
                const reader = new FileReader();
                setProjectStatus('Reading project file...');
                reader.onload = () => {
                    try {
                        applyProjectPayload(JSON.parse(String(reader.result || '{}')));
                    } catch (error) {
                        console.error('Project import failed:', error);
                        setProjectStatus('Project import failed. Choose a TEN26 project JSON file.');
                        if (typeof showUiToast === 'function') showUiToast('Project import failed.', 'warning');
                    } finally {
                        if (projectImportFile) projectImportFile.value = '';
                    }
                };
                reader.onerror = () => {
                    setProjectStatus('Project import failed. The file could not be read.');
                    if (typeof showUiToast === 'function') showUiToast('Project import failed.', 'warning');
                    if (projectImportFile) projectImportFile.value = '';
                };
                reader.readAsText(file);
            }

            const RETIRED_BUILT_IN_PRESET_NAMES = new Set([
                'Space Mod',
                'ram1',
                'ram3',
                'ram22',
                'Ram4',
                'ram0',
                'ram00',
                'ram5',
                'ram7',
                'ram S',
                'ram O',
                'ram X',
                'eraser',
                'ram'
            ]);

            function isRetiredBuiltInPresetName(name) {
                return RETIRED_BUILT_IN_PRESET_NAMES.has(name);
            }

            // Bundled startup presets come from the exported preset asset; generated samples stay as fallback.
            function buildDefaultPresets() {
                const startupPresets = getBundledStartupPresets();
                if (startupPresets.length) return startupPresets;

                const WHITE = '#ffffff';
                const PINK = '#ffc5f4';
                const BLUE = '#02006c';
                const TARGET_TYPES = ['fill', 'path', 'anchor'];

                const layerKeysForCount = count => ALL_DOT_LAYER_KEYS.slice(0, clamp(count, 1, 3));
                const controlId = (layerKey, suffix) => `dot-${layerKey}-${suffix}`;
                const addRange = (ranges, layerKey, suffix, randomMin, randomMax) => {
                    ranges[controlId(layerKey, suffix)] = {
                        randomMin: String(randomMin),
                        randomMax: String(randomMax)
                    };
                };
                const addLock = (locks, layerKey, suffix) => locks.push(controlId(layerKey, suffix));
                const makeBlinkState = (overrides = {}) => forceBlinkRespawnState({
                    ...getDefaultBlinkState(true),
                    ...overrides
                });

                const buildPresetRandomRules = layerKeys => {
                    const ranges = {};
                    const locks = [];
                    layerKeys.forEach((layerKey, index) => {
                        const isTop = index === 0;
                        const isBottom = layerKeys.length > 1 && index === layerKeys.length - 1;
                        addRange(ranges, layerKey, 'grid-size', isTop ? 3 : 1, isTop ? 3 : 4);
                        addRange(ranges, layerKey, 'mid-size', isTop ? 3 : 1, isTop ? 3 : 4);
                        addRange(ranges, layerKey, 'target-size', isTop ? 3 : 1, 3);
                        addLock(locks, layerKey, 'target-color-hex');
                        if (isTop) {
                            ['grid-size', 'mid-size', 'target-size', 'grid-color-hex', 'mid-color-hex'].forEach(suffix => addLock(locks, layerKey, suffix));
                        }
                        if (isBottom) {
                            ['grid-color-hex', 'mid-color-hex'].forEach(suffix => addLock(locks, layerKey, suffix));
                        }
                    });
                    return { ranges, locks };
                };

                const makeLayerState = (layerKey, layerIndex, layerCount, blink, overrides = {}) => {
                    const isTop = layerIndex === 0;
                    const isBottom = layerCount > 1 && layerIndex === layerCount - 1;
                    const middleColor = overrides.gridColor || (layerIndex % 2 ? PINK : WHITE);
                    const targetColor = isTop ? WHITE : (overrides.targetColor || (layerIndex % 2 ? PINK : WHITE));
                    const targetSize = isTop
                        ? '3'
                        : String(clamp(readStateFloat(overrides.targetSize, 2.2), 1, 3));
                    const incoming = {
                        name: overrides.name || (isTop ? 'Top Target' : (isBottom ? 'Blue Base' : 'Mid Target')),
                        targetType: overrides.targetType || TARGET_TYPES[layerIndex % TARGET_TYPES.length],
                        cols: '25',
                        rows: '7',
                        spacing: PRESET_GRID_SPACING,
                        offsetX: '0',
                        offsetY: PRESET_GRID_OFFSET_Y,
                        mass: '1',
                        friction: '34',
                        speedLimit: '80',
                        elasticity: '45',
                        shuffle: '0',
                        variation: '0',
                        returnPull: '0.38',
                        pull: '0.7',
                        svgRadius: '320',
                        gridRadius: PRESET_GRID_RADIUS,
                        orbit: '0',
                        sizeMidpoint: '0.5',
                        speedSize: '0',
                        ...overrides,
                        ...blink,
                        gridColor: isTop ? WHITE : (isBottom ? BLUE : middleColor),
                        midColor: isTop ? WHITE : (isBottom ? BLUE : (overrides.midColor || middleColor)),
                        targetColor,
                        gridSize: isTop ? '3' : (overrides.gridSize || '2.5'),
                        midSize: isTop ? '3' : (overrides.midSize || overrides.gridSize || '2.5'),
                        targetSize
                    };
                    return coerceLayerStateForV12(createDefaultLayerState(layerKey, incoming), incoming);
                };

                const makePreset = config => {
                    const state = defaultState();
                    const layerKeys = layerKeysForCount(config.layerCount);
                    const blink = makeBlinkState(config.blink);
                    const dotLayers = layerKeys.reduce((acc, layerKey, index) => {
                        const layerConfig = config.layers?.[index] || {};
                        acc[layerKey] = makeLayerState(layerKey, index, layerKeys.length, blink, {
                            targetType: config.targets?.[index] || TARGET_TYPES[index % TARGET_TYPES.length],
                            ...layerConfig
                        });
                        return acc;
                    }, {});
                    const normalizedLayers = normalizeLayerCollection(dotLayers, layerKeys);
                    const defaultSlides = cloneDefaultSlidesState();
                    const randomRules = buildPresetRandomRules(normalizedLayers.layerOrder);
                    state.activeLayerKey = normalizedLayers.layerOrder[0] || DEFAULT_LAYER_KEY;
                    state.layerOrder = normalizedLayers.layerOrder;
                    state.svgMediaStackIndex = normalizedLayers.layerOrder.length;
                    state.dotLayers = normalizedLayers.dotLayers;
                    state.autoTransition = {
                        ...state.autoTransition,
                        ...(config.autoTransition || {})
                    };
                    state.blink = blink;
                    state.randomRanges = randomRules.ranges;
                    state.randomLocks = randomRules.locks;
                    state.imageLayer = cloneDefaultImageLayerState();
                    state.slides = defaultSlides;
                    state.currentSlideIndex = clamp(getDefaultAssetBundle().currentSlideIndex || 0, 0, Math.max(0, defaultSlides.length - 1));
                    state.slide = getDefaultSlideState();
                    state.mask = getDefaultMaskState();
                    state.imageSlide = getDefaultImageSlideState();
                    state.imageMask = getDefaultImageMaskState();
                    if (config.bg) state.bg = { ...state.bg, ...config.bg };
                    return { name: config.name, state };
                };

                const presetConfigs = [
                    {
                        name: 'Solo Slow Constellation',
                        layerCount: 1,
                        targets: ['anchor'],
                        autoTransition: { currentTime: '4.5', nextTime: '4.5', returnGridTime: '1.2', flickerBias: '1.4', flickerSpeed: '4', flickerBalance: '58', flickerWildness: '18', autoDuration: '5' },
                        blink: { visibilityOn: '4.6', visibilityOff: '1.2', visibilityRandomness: '18', visibilityProbability: '55' },
                        layers: [
                            { cols: '31', rows: '9', spacing: '42', pull: '0.38', svgRadius: '660', returnPull: '0.24', gridRadius: '900', speedLimit: '28', mass: '3.6', friction: '68', elasticity: '22', orbit: '0.06', shuffle: '3', variation: '8', sizeMidpoint: '0.68', speedSize: '-0.4' }
                        ]
                    },
                    {
                        name: 'Solo Fast Bubbles',
                        layerCount: 1,
                        targets: ['fill'],
                        autoTransition: { currentTime: '1.1', nextTime: '1.2', returnGridTime: '0.25', flickerBias: '0.35', flickerSpeed: '15', flickerBalance: '66', flickerWildness: '42', autoDuration: '2.4' },
                        blink: { visibilityOn: '1.1', visibilityOff: '0.22', visibilityRandomness: '62', visibilityProbability: '78' },
                        layers: [
                            { cols: '24', rows: '8', spacing: '50', pull: '0.88', svgRadius: '330', returnPull: '0.54', gridRadius: '620', speedLimit: '110', mass: '1', friction: '18', elasticity: '72', orbit: '0.42', shuffle: '22', variation: '34', sizeMidpoint: '0.44', speedSize: '2.6' }
                        ],
                        bg: { mode: 'cycle2', staticColor: '#02006c', color2: '#ffc5f4' }
                    },
                    {
                        name: 'Solo Chaotic Swarm',
                        layerCount: 1,
                        targets: ['path'],
                        autoTransition: { currentTime: '1.7', nextTime: '1.55', returnGridTime: '0.45', flickerBias: '0.5', flickerSpeed: '18', flickerBalance: '72', flickerWildness: '86', autoDuration: '2.8' },
                        blink: { visibilityOn: '0.72', visibilityOff: '0.18', visibilityRandomness: '94', visibilityProbability: '86' },
                        layers: [
                            { cols: '29', rows: '10', spacing: '39', pull: '0.94', svgRadius: '470', returnPull: '0.62', gridRadius: '760', speedLimit: '118', mass: '1.2', friction: '16', elasticity: '88', orbit: '-1.2', shuffle: '78', variation: '84', sizeMidpoint: '0.37', speedSize: '4.2' }
                        ]
                    },
                    {
                        name: 'Duo Geometric Drift',
                        layerCount: 2,
                        targets: ['fill', 'path'],
                        autoTransition: { currentTime: '2.9', nextTime: '3.1', returnGridTime: '0.8', flickerBias: '1', flickerSpeed: '6', flickerBalance: '48', flickerWildness: '20', autoDuration: '4.2' },
                        blink: { visibilityOn: '3.2', visibilityOff: '0.8', visibilityRandomness: '20', visibilityProbability: '58' },
                        layers: [
                            { cols: '28', rows: '8', spacing: '45', pull: '0.62', svgRadius: '390', returnPull: '0.36', gridRadius: '940', speedLimit: '48', mass: '1.8', friction: '48', elasticity: '40', orbit: '0', shuffle: '0', variation: '4', sizeMidpoint: '0.52' },
                            { cols: '18', rows: '6', spacing: '70', offsetY: '-36', pull: '0.52', svgRadius: '520', returnPull: '0.32', gridRadius: '1000', speedLimit: '38', mass: '2.8', friction: '56', elasticity: '28', orbit: '0', shuffle: '0', variation: '2', gridSize: '2.2', midSize: '2.4', targetSize: '2.1', targetColor: PINK, sizeMidpoint: '0.58' }
                        ]
                    },
                    {
                        name: 'Duo Organic Flock',
                        layerCount: 2,
                        targets: ['path', 'anchor'],
                        autoTransition: { currentTime: '2.4', nextTime: '2.7', returnGridTime: '0.65', flickerBias: '0.8', flickerSpeed: '8', flickerBalance: '60', flickerWildness: '38', autoDuration: '3.8' },
                        blink: { visibilityOn: '2.4', visibilityOff: '0.42', visibilityRandomness: '46', visibilityProbability: '68' },
                        layers: [
                            { cols: '30', rows: '9', spacing: '40', pull: '0.68', svgRadius: '430', returnPull: '0.42', gridRadius: '860', speedLimit: '64', mass: '1.4', friction: '36', elasticity: '56', orbit: '0.18', shuffle: '16', variation: '24', sizeMidpoint: '0.46', speedSize: '0.8' },
                            { cols: '22', rows: '8', spacing: '58', offsetX: '28', pull: '0.46', svgRadius: '610', returnPull: '0.28', gridRadius: '1000', speedLimit: '42', mass: '3.2', friction: '62', elasticity: '20', orbit: '-0.12', shuffle: '10', variation: '22', gridSize: '2', midSize: '2.2', targetSize: '1.8', targetColor: WHITE, sizeMidpoint: '0.64' }
                        ]
                    },
                    {
                        name: 'Duo Fast Swarm',
                        layerCount: 2,
                        targets: ['anchor', 'fill'],
                        autoTransition: { currentTime: '1.25', nextTime: '1.35', returnGridTime: '0.25', flickerBias: '0.25', flickerSpeed: '16', flickerBalance: '70', flickerWildness: '76', autoDuration: '2.6' },
                        blink: { visibilityOn: '0.85', visibilityOff: '0.2', visibilityRandomness: '86', visibilityProbability: '82' },
                        layers: [
                            { cols: '34', rows: '9', spacing: '36', pull: '0.9', svgRadius: '360', returnPull: '0.58', gridRadius: '700', speedLimit: '106', mass: '1', friction: '22', elasticity: '84', orbit: '0.86', shuffle: '58', variation: '70', sizeMidpoint: '0.4', speedSize: '3.4' },
                            { cols: '20', rows: '7', spacing: '64', offsetY: '32', pull: '0.72', svgRadius: '460', returnPull: '0.46', gridRadius: '880', speedLimit: '86', mass: '1.6', friction: '30', elasticity: '68', orbit: '-0.55', shuffle: '44', variation: '56', gridSize: '1.7', midSize: '2', targetSize: '2.7', targetColor: PINK, sizeMidpoint: '0.45', speedSize: '2.2' }
                        ]
                    },
                    {
                        name: 'Trio Space Constellation',
                        layerCount: 3,
                        targets: ['anchor', 'path', 'fill'],
                        autoTransition: { currentTime: '3.8', nextTime: '4', returnGridTime: '1.1', flickerBias: '1.35', flickerSpeed: '5', flickerBalance: '52', flickerWildness: '22', autoDuration: '5' },
                        blink: { visibilityOn: '3.8', visibilityOff: '0.95', visibilityRandomness: '32', visibilityProbability: '62' },
                        layers: [
                            { cols: '33', rows: '9', spacing: '38', pull: '0.44', svgRadius: '650', returnPull: '0.28', gridRadius: '920', speedLimit: '34', mass: '3', friction: '64', elasticity: '26', orbit: '0.1', shuffle: '4', variation: '14', sizeMidpoint: '0.66' },
                            { cols: '25', rows: '7', spacing: '50', offsetX: '-20', pull: '0.54', svgRadius: '520', returnPull: '0.34', gridRadius: '960', speedLimit: '42', mass: '2.2', friction: '54', elasticity: '34', orbit: '-0.08', shuffle: '8', variation: '16', gridSize: '1.8', midSize: '2.1', targetSize: '1.6', targetColor: PINK, sizeMidpoint: '0.58' },
                            { cols: '19', rows: '6', spacing: '72', offsetY: '-42', pull: '0.36', svgRadius: '720', returnPull: '0.22', gridRadius: '1000', speedLimit: '28', mass: '4', friction: '72', elasticity: '18', orbit: '0.04', shuffle: '0', variation: '8', gridSize: '1.6', midSize: '1.8', targetSize: '2.1', targetColor: WHITE, sizeMidpoint: '0.7' }
                        ]
                    },
                    {
                        name: 'Trio Bubbly Orbit',
                        layerCount: 3,
                        targets: ['fill', 'anchor', 'path'],
                        autoTransition: { currentTime: '1.8', nextTime: '2', returnGridTime: '0.45', flickerBias: '0.55', flickerSpeed: '12', flickerBalance: '66', flickerWildness: '52', autoDuration: '3.1' },
                        blink: { visibilityOn: '1.6', visibilityOff: '0.32', visibilityRandomness: '68', visibilityProbability: '76' },
                        layers: [
                            { cols: '28', rows: '8', spacing: '44', pull: '0.76', svgRadius: '380', returnPull: '0.5', gridRadius: '700', speedLimit: '82', mass: '1.1', friction: '26', elasticity: '76', orbit: '0.66', shuffle: '34', variation: '44', sizeMidpoint: '0.42', speedSize: '2.8' },
                            { cols: '24', rows: '8', spacing: '52', offsetX: '24', pull: '0.64', svgRadius: '520', returnPull: '0.4', gridRadius: '850', speedLimit: '62', mass: '1.7', friction: '38', elasticity: '54', orbit: '-0.38', shuffle: '24', variation: '36', gridColor: PINK, midColor: PINK, gridSize: '2.3', midSize: '2.7', targetSize: '2.4', targetColor: PINK, sizeMidpoint: '0.5', speedSize: '1.4' },
                            { cols: '17', rows: '6', spacing: '78', offsetY: '40', pull: '0.5', svgRadius: '610', returnPull: '0.34', gridRadius: '960', speedLimit: '54', mass: '2.4', friction: '48', elasticity: '38', orbit: '0.2', shuffle: '18', variation: '28', gridSize: '1.8', midSize: '2.1', targetSize: '2.8', targetColor: WHITE, sizeMidpoint: '0.62', speedSize: '0.8' }
                        ]
                    },
                    {
                        name: 'Trio Chaotic Flock',
                        layerCount: 3,
                        targets: ['path', 'fill', 'anchor'],
                        autoTransition: { currentTime: '1.4', nextTime: '1.55', returnGridTime: '0.3', flickerBias: '0.35', flickerSpeed: '18', flickerBalance: '74', flickerWildness: '92', autoDuration: '2.7' },
                        blink: { visibilityOn: '0.78', visibilityOff: '0.16', visibilityRandomness: '98', visibilityProbability: '88' },
                        layers: [
                            { cols: '35', rows: '10', spacing: '34', pull: '0.96', svgRadius: '400', returnPull: '0.64', gridRadius: '720', speedLimit: '118', mass: '1', friction: '14', elasticity: '90', orbit: '-1.35', shuffle: '84', variation: '88', sizeMidpoint: '0.34', speedSize: '4.6' },
                            { cols: '28', rows: '8', spacing: '46', offsetX: '-30', pull: '0.82', svgRadius: '500', returnPull: '0.5', gridRadius: '860', speedLimit: '92', mass: '1.5', friction: '24', elasticity: '74', orbit: '0.92', shuffle: '62', variation: '78', gridColor: PINK, midColor: PINK, gridSize: '2.1', midSize: '2.5', targetSize: '2', targetColor: PINK, sizeMidpoint: '0.42', speedSize: '2.8' },
                            { cols: '21', rows: '7', spacing: '62', offsetY: '-34', pull: '0.66', svgRadius: '620', returnPull: '0.44', gridRadius: '1000', speedLimit: '74', mass: '2.1', friction: '34', elasticity: '58', orbit: '-0.5', shuffle: '48', variation: '64', gridSize: '1.7', midSize: '2', targetSize: '1.5', targetColor: WHITE, sizeMidpoint: '0.58', speedSize: '1.7' }
                        ],
                        bg: { mode: 'cycle3', staticColor: '#02006c', color2: '#ffc5f4', color3: '#00002a' }
                    }
                ];

                return presetConfigs.map(makePreset);
            }

            function createDefaultPresets() {
                const stored = loadPresetsFromStorage();
                const merged = mergePresetsWithBuiltIns(stored?.presets || [], { fullList: stored?.isFullList });
                presets = merged.presets;
                if (merged.retiredCount > 0) savePresetsToStorage(presets);
                updatePresetDropdown();
                const builtInLabel = `${merged.builtInCount} startup layer preset${merged.builtInCount === 1 ? '' : 's'}`;
                setPresetStatus(merged.customCount
                    ? `${builtInLabel} loaded with ${merged.customCount} custom layer preset${merged.customCount === 1 ? '' : 's'}.`
                    : `${builtInLabel} loaded. Add, export, or import presets here.`);
            }

            function loadSavedSettings() {
                const stored = loadSettingsFromStorage();
                savedSettings = stored.length ? stored : getBundledStartupSettings();
                updateSettingsDropdown(0);
                setSettingsStatus(savedSettings.length
                    ? `${savedSettings.length} saved settings item${savedSettings.length === 1 ? '' : 's'} loaded.`
                    : 'No saved settings yet.');
            }

            function getStartupPresetState() {
                const preset = presets.find(entry => builtInPresetNames.has(entry?.name)) || buildDefaultPresets()[0] || presets[0];
                return cloneSerializable(preset?.state || defaultState());
            }
