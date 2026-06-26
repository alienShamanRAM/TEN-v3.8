window.installTen26Hardening?.();
// TEN26 UI event binding and render-loop startup.
function bindEvents() {
                setupDenseSizeSliders();
                bindAllRangeDisplays();
                setupRandomLockUi();
                setupRandomRangeUi();
                installDotColorPaletteUi();
                applySliderTooltips();
                applyNativeTooltips();
                enableSliderValueEditing();
                const headerLoadingSpinner = document.getElementById('header-loading-spinner');
                let rightPanelLoadingCount = 0;
                const syncRightPanelLoading = () => {
                    headerLoadingSpinner?.classList.toggle('hidden-ui-node', rightPanelLoadingCount <= 0);
                };
                const setRightPanelLoading = active => {
                    rightPanelLoadingCount = Math.max(0, rightPanelLoadingCount + (active ? 1 : -1));
                    syncRightPanelLoading();
                };
                const trackRightPanelLoading = promise => {
                    setRightPanelLoading(true);
                    return Promise.resolve(promise).finally(() => setRightPanelLoading(false));
                };
                fullscreenEnterBtn.addEventListener('click', async () => {
                    try {
                        await document.documentElement.requestFullscreen();
                    } catch (error) {
                    }
                });
                fullscreenExitBtn.addEventListener('click', async () => {
                    if (!document.fullscreenElement) return;
                    try {
                        await document.exitFullscreen();
                    } catch (error) {
                    }
                });
                document.addEventListener('fullscreenchange', updateFullscreenUi);
                viewControls.scale?.addEventListener('input', () => {
                    setViewScale(parseInt(viewControls.scale.value, 10), 'manual');
                });
                viewControls.frameRate?.addEventListener('input', () => {
                    syncFrameInterval();
                    updateViewStatus();
                });
                viewControls.scaleButtons.forEach(button => {
                    button.addEventListener('click', () => {
                        setViewScale(parseInt(button.dataset.viewScale, 10), 'manual');
                    });
                });
                viewControls.fit?.addEventListener('click', () => {
                    setViewScale(getFitViewScale(), 'fit');
                });
                viewControls.overlayOpacity?.addEventListener('input', () => {
                    updateViewStatus();
                });
                helpControls.tooltipsEnabled?.addEventListener('change', syncTooltipPreference);
                mediaControls.transitionMode?.addEventListener('change', updateMediaModeUi);
                presetSelect?.addEventListener('change', updatePresetWarningStatus);
                window.addEventListener('resize', () => {
                    if (viewScaleMode === 'fit') setViewScale(getFitViewScale(), 'fit');
                    else updateViewStatus();
                });
                let headerAutoTimer = null;
                const getHeaderAutoSeconds = () => {
                    const raw = parseFloat(slideControls.autoDuration?.value || '4');
                    return Math.min(8, Math.max(1, Number.isFinite(raw) ? raw : 4));
                };
                const formatHeaderAutoSeconds = () => {
                    const seconds = getHeaderAutoSeconds();
                    return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)} second${seconds === 1 ? '' : 's'}`;
                };
                const startHeaderAutoTimer = () => {
                    if (headerAutoTimer) window.clearInterval(headerAutoTimer);
                    headerAutoTimer = window.setInterval(runHeaderAutoStep, getHeaderAutoSeconds() * 1000);
                };
                const setHeaderAutoState = active => {
                    if (typeof setHeaderAutoplayStatus === 'function') setHeaderAutoplayStatus(active);
                    performanceControlGroups.forEach(controls => {
                        controls.auto?.classList.toggle('active', active);
                        controls.auto?.setAttribute('aria-pressed', String(active));
                        const autoTitle = active ? 'Stop automatic slide advance' : `Automatically advance to the next slide every ${formatHeaderAutoSeconds()}`;
                        if (typeof setNativeTooltip === 'function') setNativeTooltip(controls.auto, autoTitle);
                        else controls.auto?.setAttribute('title', autoTitle);
                    });
                };
                const stopHeaderAuto = () => {
                    if (headerAutoTimer) window.clearInterval(headerAutoTimer);
                    headerAutoTimer = null;
                    setHeaderAutoState(false);
                };
                const runHeaderAutoStep = () => {
                    if (!slides.length || autoTransition || activeHoldMode || holdState !== 'idle') return;
                    beginHoldAdvance(1, 'header-auto');
                };
                performanceControlGroups.forEach(controls => {
                    const sourcePrefix = 'header';
                    controls.prev?.addEventListener('click', event => {
                        event.preventDefault();
                        beginHoldAdvance(-1, `${sourcePrefix}-prev`);
                    });
                    controls.next?.addEventListener('click', event => {
                        event.preventDefault();
                        beginHoldAdvance(1, `${sourcePrefix}-next`);
                    });
                    controls.auto?.addEventListener('click', event => {
                        event.preventDefault();
                        if (headerAutoTimer) {
                            stopHeaderAuto();
                            if (typeof showUiToast === 'function') showUiToast('Automatic slide advance stopped.');
                            return;
                        }
                        setHeaderAutoState(true);
                        runHeaderAutoStep();
                        startHeaderAutoTimer();
                        if (typeof showUiToast === 'function') showUiToast(`Automatic slide advance: every ${formatHeaderAutoSeconds()}.`);
                    });
                    let headerHoldActive = false;
                    const startHeaderHold = event => {
                        event.preventDefault();
                        if (headerHoldActive) return;
                        headerHoldActive = true;
                        controls.hold?.classList.add('active');
                        try {
                            controls.hold?.setPointerCapture?.(event.pointerId);
                        } catch (error) {
                        }
                        beginHoldCurrentSlide(`${sourcePrefix}-hold`);
                    };
                    const endHeaderHold = event => {
                        if (!headerHoldActive) return;
                        headerHoldActive = false;
                        controls.hold?.classList.remove('active');
                        releaseHoldCurrentSlide(`${sourcePrefix}-hold`);
                        try {
                            controls.hold?.releasePointerCapture?.(event.pointerId);
                        } catch (error) {
                        }
                    };
                    controls.hold?.addEventListener('pointerdown', startHeaderHold);
                    controls.hold?.addEventListener('pointerup', endHeaderHold);
                    controls.hold?.addEventListener('pointercancel', endHeaderHold);
                    controls.hold?.addEventListener('lostpointercapture', event => {
                        if (headerHoldActive) endHeaderHold(event);
                    });
                });
                const syncBackground = () => {
                    updateBackgroundControls();
                    updateBackground();
                };
                bindColorPair(bgControls.staticPicker, bgControls.staticHex, syncBackground);
                bindColorPair(bgControls.color2Picker, bgControls.color2Hex, syncBackground);
                bindColorPair(bgControls.color3Picker, bgControls.color3Hex, syncBackground);
                bgControls.mode?.addEventListener('change', syncBackground);
                bgControls.cycleSpeed?.addEventListener('input', syncBackground);
                syncBackground();
                const syncStageSize = () => {
                    setStudioSize(stageControls.width?.value, stageControls.height?.value);
                };
                stageControls.width?.addEventListener('input', syncStageSize);
                stageControls.height?.addEventListener('input', syncStageSize);
                bindColorPair(appBgControls.picker, appBgControls.hex, updateAppBackdrop);
                appBgControls.mode?.addEventListener('change', updateAppBackdrop);
                updateAppBackdrop();
                Object.entries(motionLayerControls.layers).forEach(([layerKey, controls]) => {
                    bindColorPair(controls.gridColor, controls.gridColorHex, () => {
                        persistMotionLayerControls(layerKey, { retarget: false });
                    });
                    bindColorPair(controls.midColor, controls.midColorHex, () => {
                        persistMotionLayerControls(layerKey, { retarget: false });
                    });
                    bindColorPair(controls.targetColor, controls.targetColorHex, () => {
                        persistMotionLayerControls(layerKey, { retarget: false });
                    });
                });

                slideControls.file.addEventListener('change', event => {
                    const selectedFiles = Array.from(event.target.files || []);
                    const selectedCount = selectedFiles.length;
                    const svgCount = selectedFiles.filter(file => file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)).length;
                    trackRightPanelLoading(loadSlideFiles(event.target.files)).then(() => {
                        if (!selectedCount || typeof showUiToast !== 'function') return;
                        if (!svgCount || !slides.length) {
                            showUiToast('No slides loaded. Choose one or more SVG files.', 'warning');
                            return;
                        }
                        const svgSlides = slides.filter(slide => isSvgSlideType(slide.type)).length;
                        showUiToast(`${svgSlides} SVG slide${svgSlides === 1 ? '' : 's'} loaded.`, svgSlides ? 'info' : 'warning');
                    }).catch(() => {
                        if (typeof showUiToast === 'function') showUiToast('Slides could not be loaded.', 'warning');
                    });
                });
                slideControls.clear.addEventListener('click', () => {
                    clearSlides();
                    if (typeof showUiToast === 'function') showUiToast('SVG slides cleared.');
                });
                imageSlideControls.file?.addEventListener('change', event => {
                    const selectedFiles = Array.from(event.target.files || []);
                    const imageCount = selectedFiles.filter(isSupportedImageFile).length;
                    const videoCount = selectedFiles.filter(isSupportedVideoFile).length;
                    trackRightPanelLoading(loadMediaSlideFiles(event.target.files)).then(() => {
                        if (!selectedFiles.length || typeof showUiToast !== 'function') return;
                        if (!imageCount && !videoCount) {
                            showUiToast('No supported media. Choose PNG, JPG, MP4, WebM, or MOV files.', 'warning');
                            return;
                        }
                        const mediaSlides = slides.filter(slide => isMediaSlideType(slide.type));
                        showUiToast(`${mediaSlides.length} media slide${mediaSlides.length === 1 ? '' : 's'} loaded.`, mediaSlides.length ? 'info' : 'warning');
                    }).catch(() => {
                        if (typeof showUiToast === 'function') showUiToast('Media slides could not be loaded.', 'warning');
                    });
                });
                imageSlideControls.clear?.addEventListener('click', () => {
                    clearMediaSlides();
                    if (typeof showUiToast === 'function') showUiToast('Media slides cleared.');
                });
                [imageSlideControls.scale, imageSlideControls.offsetX, imageSlideControls.offsetY].forEach(control => {
                    control?.addEventListener('input', () => {
                        slides.forEach(slide => {
                            if (isMediaSlideType(slide.type)) slide.screenTargetCache?.clear();
                        });
                        targetWarmupToken++;
                        if (isMediaSlideType(slides[currentSlideIndex]?.type)) {
                            applySlideTransform();
                            refreshAttractorTargetsIfNeeded();
                        }
                        clearMaskCache();
                        scheduleMaskWarmup();
                        scheduleTargetWarmup();
                        updateSlideControlStatus();
                    });
                });
                [slideControls.scale, slideControls.offsetX, slideControls.offsetY].forEach(control => {
                    control.addEventListener('input', () => {
                        clearMaskCache();
                        clearSlideScreenTargetCaches();
                        applySlideTransform();
                        refreshAttractorTargetsIfNeeded();
                        scheduleMaskWarmup();
                        scheduleTargetWarmup();
                        updateSlideControlStatus();
                    });
                });
                mediaControls.duration?.addEventListener('input', () => {
                    updateSlideControlStatus();
                });
                slideControls.autoDuration?.addEventListener('input', () => {
                    setHeaderAutoState(!!headerAutoTimer);
                    if (headerAutoTimer) startHeaderAutoTimer();
                });

                Object.entries(gridControls.layers).forEach(([layerKey, controls]) => {
                    [controls.cols, controls.rows, controls.spacing, controls.offsetX, controls.offsetY].forEach(control => {
                        control?.addEventListener('input', () => {
                            persistGridLayerControls(layerKey);
                            if (activeLayerKey !== layerKey) switchActiveLayer(layerKey);
                        });
                    });
                });
                gridControls.applyAll.addEventListener('click', () => {
                    copyActiveGridToAllLayers();
                    if (typeof showUiToast === 'function') showUiToast('Current grid layout applied to all layers.');
                });

                motionLayerControls.openAll?.addEventListener('click', event => {
                    event.stopPropagation();
                    DOT_LAYER_KEYS.forEach(layerKey => motionLayerControls.layers[layerKey].drawer?.classList.remove('collapsed'));
                    syncLeftPanels();
                    updateActionAvailability();
                    if (motionLayerControls.status) motionLayerControls.status.textContent = 'All Grid Layer drawers opened.';
                });
                motionLayerControls.collapseAll?.addEventListener('click', event => {
                    event.stopPropagation();
                    DOT_LAYER_KEYS.forEach(layerKey => motionLayerControls.layers[layerKey].drawer?.classList.add('collapsed'));
                    syncLeftPanels();
                    updateActionAvailability();
                    if (motionLayerControls.status) motionLayerControls.status.textContent = 'All Grid Layer drawers collapsed.';
                });
                motionLayerControls.randomizeAll?.addEventListener('click', event => {
                    event.stopPropagation();
                    randomizeAllMotionLayers();
                });
                motionLayerControls.copyAbove?.addEventListener('click', event => {
                    event.stopPropagation();
                    addLayerRelative('above', activeLayerKey);
                });
                motionLayerControls.copyBelow?.addEventListener('click', event => {
                    event.stopPropagation();
                    addLayerRelative('below', activeLayerKey);
                });
                svgMediaStackControls.moveUp?.addEventListener('click', event => {
                    event.stopPropagation();
                    moveSvgMediaStack(-1);
                });
                svgMediaStackControls.moveDown?.addEventListener('click', event => {
                    event.stopPropagation();
                    moveSvgMediaStack(1);
                });
                blinkControls.enabled?.addEventListener('change', () => {
                    applyBlinkControlsToAllLayers();
                    updateDrawerTitleStates();
                });
                BLINK_RANDOM_CONTROL_KEYS.map(key => blinkControls[key]).forEach(control => {
                    control?.addEventListener('input', applyBlinkControlsToAllLayers);
                });
                blinkControls.randomize?.addEventListener('click', event => {
                    event.stopPropagation();
                    randomizeAllBlinkLayers();
                });
                blinkControls.unlock?.addEventListener('click', event => {
                    event.stopPropagation();
                    unlockAllBlinkLayers();
                });
                blinkControls.reset?.addEventListener('click', event => {
                    event.stopPropagation();
                    resetBlinkRandomRanges();
                });

                Object.entries(motionLayerControls.layers).forEach(([layerKey, controls]) => {
                    const toggleLayerDrawer = () => {
                        controls.drawer?.classList.toggle('collapsed');
                        syncLeftPanels();
                        updateActionAvailability();
                        if (activeLayerKey !== layerKey) switchActiveLayer(layerKey);
                    };
                    controls.trigger?.addEventListener('click', event => {
                        event.stopPropagation();
                        toggleLayerDrawer();
                    });
                    controls.drawer?.querySelector('.motion-layer-header')?.addEventListener('click', event => {
                        if (event.target.closest('button, input, select, textarea, label')) return;
                        toggleLayerDrawer();
                    });
                    controls.toggle?.addEventListener('click', event => {
                        event.stopPropagation();
                        setLayerVisibility(layerKey, !dotLayerStates[layerKey].hidden);
                    });
                    controls.randomize?.addEventListener('click', event => {
                        event.stopPropagation();
                        randomizeMotionLayer(layerKey);
                        if (activeLayerKey !== layerKey) switchActiveLayer(layerKey);
                    });
                    controls.randomizeText?.addEventListener('click', event => {
                        event.stopPropagation();
                        randomizeMotionLayer(layerKey);
                        if (activeLayerKey !== layerKey) switchActiveLayer(layerKey);
                    });
                    controls.unlock?.addEventListener('click', event => {
                        event.stopPropagation();
                        unlockMotionLayer(layerKey);
                    });
                    controls.lock?.addEventListener('click', event => {
                        event.stopPropagation();
                        lockMotionLayer(layerKey);
                    });
                    controls.reset?.addEventListener('click', event => {
                        event.stopPropagation();
                        resetMotionLayerRanges(layerKey);
                    });
                    controls.deleteLayer?.addEventListener('click', event => {
                        event.stopPropagation();
                        deleteActiveLayer(layerKey);
                    });
                    controls.moveUp?.addEventListener('click', event => {
                        event.stopPropagation();
                        moveLayer(layerKey, -1);
                    });
                    controls.moveDown?.addEventListener('click', event => {
                        event.stopPropagation();
                        moveLayer(layerKey, 1);
                    });
                    controls.trigger?.addEventListener('dblclick', event => {
                        if (!event.target.closest('.motion-layer-name')) return;
                        event.stopPropagation();
                        if (DOT_LAYER_KEYS.includes(layerKey)) {
                            activeLayerKey = layerKey;
                            renameActiveLayer();
                        }
                    });
                    controls.targetType?.addEventListener('change', () => {
                        persistMotionLayerControls(layerKey, { retarget: true });
                        if (activeLayerKey !== layerKey) switchActiveLayer(layerKey);
                    });
                    [
                        controls.mass, controls.friction, controls.returnPull, controls.pull, controls.svgRadius, controls.gridRadius,
                        controls.speedLimit, controls.elasticity, controls.orbit, controls.shuffle, controls.variation,
                        controls.gridSize, controls.midSize, controls.targetSize, controls.sizeMidpoint, controls.speedSize
                    ].forEach(control => {
                        control?.addEventListener('input', () => {
                            persistMotionLayerControls(layerKey, { retarget: false });
                            if (activeLayerKey !== layerKey) switchActiveLayer(layerKey);
                        });
                    });
                });

                maskControls.enabled.addEventListener('change', () => {
                    clearMaskCache();
                    updateMaskStatus();
                    scheduleMaskWarmup();
                    if (isSvgSlideType(slides[currentSlideIndex]?.type)) activateSlideMask(currentSlideIndex, { sync: true });
                });
                [maskControls.expansion].forEach(control => {
                    control.addEventListener('input', () => {
                        clearMaskCache();
                        updateMaskStatus();
                        scheduleMaskWarmup();
                        if (isSvgSlideType(slides[currentSlideIndex]?.type)) activateSlideMask(currentSlideIndex, { sync: true });
                    });
                });
                maskControls.scaleTime?.addEventListener('input', () => {
                    updateMaskStatus();
                });
                imageMaskControls.enabled?.addEventListener('change', () => {
                    clearMaskCache();
                    updateImageMaskStatus();
                    scheduleMaskWarmup();
                    if (isMediaSlideType(slides[currentSlideIndex]?.type)) activateSlideMask(currentSlideIndex, { sync: true });
                });
                imageMaskControls.expansion?.addEventListener('input', () => {
                    clearMaskCache();
                    updateImageMaskStatus();
                    scheduleMaskWarmup();
                    if (isMediaSlideType(slides[currentSlideIndex]?.type)) activateSlideMask(currentSlideIndex, { sync: true });
                });
                imageMaskControls.scaleTime?.addEventListener('input', () => {
                    updateImageMaskStatus();
                });

                imageControls.file.addEventListener('change', event => {
                    const file = event.target.files[0];
                    if (file) {
                        setRightPanelLoading(true);
                        window.setTimeout(() => setRightPanelLoading(false), 180);
                    }
                    loadImageFile(file);
                    if (file && typeof showUiToast === 'function') {
                        const supported = /^image\/(png|jpeg)$/.test(file.type) || /\.(png|jpe?g)$/i.test(file.name);
                        showUiToast(supported ? `Image selected: ${file.name}.` : `Unsupported image file: ${file.name}.`, supported ? 'info' : 'warning');
                    }
                });
                imageControls.toggle?.addEventListener('click', () => {
                    imageState = { ...imageState, hidden: !imageState.hidden };
                    updateImageLayer();
                    if (typeof showUiToast === 'function') showUiToast(`Background image ${imageState.hidden ? 'hidden' : 'visible'}.`);
                });
                imageControls.clear.addEventListener('click', () => {
                    clearImageLayer();
                    if (typeof showUiToast === 'function') showUiToast('Background image cleared.');
                });
                [imageControls.scale, imageControls.offsetX, imageControls.offsetY].forEach(control => {
                    control.addEventListener('input', () => {
                        updateImageLayer();
                    });
                });

                document.addEventListener('keydown', event => {
                    if (event.repeat || isTypingTarget(event.target)) return;
                    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Escape'].includes(event.code)) return;
                    event.preventDefault();
                    if (event.code === 'ArrowLeft') beginHoldAdvance(-1, event.code);
                    if (event.code === 'ArrowRight') beginHoldAdvance(1, event.code);
                    if (event.code === 'ArrowUp') {
                        hideControlPanels();
                        if (typeof showUiToast === 'function') showUiToast('UI collapsed.');
                    }
                    if (event.code === 'ArrowDown') {
                        showControlPanels();
                        if (typeof showUiToast === 'function') showUiToast('UI restored.');
                    }
                    if (event.code === 'Space') beginHoldCurrentSlide(event.code);
                    if (event.code === 'Escape' && autoTransition) {
                        stopAutoTransition();
                    }
                });
                document.addEventListener('keyup', event => {
                    if (isTypingTarget(event.target)) return;
                    if (!['Space'].includes(event.code)) return;
                    event.preventDefault();
                    if (event.code === 'Space') releaseHoldCurrentSlide(event.code);
                });

                presetApplyBtn?.addEventListener('click', () => {
                    const index = parseInt(presetSelect.value, 10);
                    if (!Number.isNaN(index) && presets[index]) {
                        applyState(presets[index].state);
                        setPresetStatus(`Applied "${presets[index].name}".`);
                        if (typeof showUiToast === 'function') showUiToast(`Preset applied: ${presets[index].name}.`);
                    }
                });
                presetAddBtn?.addEventListener('click', () => {
                    addCurrentPreset();
                });
                presetDeleteBtn?.addEventListener('click', () => {
                    deleteSelectedPreset();
                });
                presetExportBtn?.addEventListener('click', () => {
                    exportPresetCollection();
                });
                presetImportBtn?.addEventListener('click', () => {
                    presetImportFile?.click();
                });
                presetImportFile?.addEventListener('change', event => {
                    importPresetCollectionFile(event.target.files?.[0]);
                });

            }

            let lastFrameTime = null;
            let cachedFrameIntervalMs = 1000 / 60;

            function syncFrameInterval() {
                const cap = clamp(parseInt(viewControls.frameRate?.value, 10) || 60, 5, 60);
                cachedFrameIntervalMs = 1000 / cap;
                lastFrameTime = null;
            }

            function getFrameIntervalMs() {
                return cachedFrameIntervalMs;
            }

            function renderFrame(timestamp) {
                requestAnimationFrame(renderFrame);
                const frameInterval = getFrameIntervalMs();
                if (lastFrameTime !== null && timestamp - lastFrameTime < frameInterval - 0.5) return;
                const deltaTime = lastFrameTime === null ? 1 / 60 : Math.min((timestamp - lastFrameTime) / 1000, 0.05);
                lastFrameTime = timestamp;
                updateBackground();
                updateHoldMachine(deltaTime);
                updateAutoTransition(deltaTime);
                updateMaskAlphaTransitions(deltaTime);
                DOT_LAYER_KEYS.forEach(layerKey => dotGroups[layerKey].update(deltaTime, timestamp));
                updateOverlayRuntimeTick(deltaTime);
                drawMorphDots();
            }

            try {
                bindEvents();
            } catch (error) {
                console.error('TEN26 startup binding failed:', error);
                if (typeof showUiToast === 'function') {
                    showUiToast('Some controls could not start. The canvas will keep running.', 'warning');
                }
            }
            createDefaultPresets();
            applyState(getStartupPresetState());
            syncFrameInterval();
            updateDrawerTitleStates();
            updateFullscreenUi();
            setViewScale(100, 'manual');
            staticGridCanvas.classList.add('hidden-ui-node');
            geometryCanvas.classList.add('hidden-ui-node');
            requestAnimationFrame(renderFrame);
