window.installTen26Hardening?.();
// TEN26 UI event binding and render-loop startup.
function bindEvents() {
                bindAllRangeDisplays();
                setupRandomLockUi();
                applySliderTooltips();
                applyNativeTooltips();
                enableSliderValueEditing();
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
                    performanceControlGroups.forEach(controls => {
                        controls.auto?.classList.toggle('active', active);
                        controls.auto?.setAttribute('aria-pressed', String(active));
                        controls.auto?.setAttribute('title', active ? 'Stop automatic slide advance' : `Automatically advance to the next slide every ${formatHeaderAutoSeconds()}`);
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
                    loadSlideFiles(event.target.files).then(() => {
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
                    loadMediaSlideFiles(event.target.files).then(() => {
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

                Object.entries(gridControls.selectButtons).forEach(([layerKey, button]) => {
                    button?.addEventListener('click', () => {
                        switchActiveLayer(layerKey);
                        syncLeftPanels();
                    });
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
                motionLayerControls.randomizeLayer?.addEventListener('click', event => {
                    event.stopPropagation();
                    randomizeMotionLayer(activeLayerKey);
                });
                motionLayerControls.unlockAll?.addEventListener('click', event => {
                    event.stopPropagation();
                    unlockAllMotionLayers();
                });
                motionLayerControls.unlockLayer?.addEventListener('click', event => {
                    event.stopPropagation();
                    unlockMotionLayer(activeLayerKey);
                });
                motionLayerControls.addAbove?.addEventListener('click', event => {
                    event.stopPropagation();
                    addLayerRelative('above');
                });
                motionLayerControls.addBelow?.addEventListener('click', event => {
                    event.stopPropagation();
                    addLayerRelative('below');
                });
                motionLayerControls.rename?.addEventListener('click', event => {
                    event.stopPropagation();
                    renameActiveLayer();
                });
                motionLayerControls.delete?.addEventListener('click', event => {
                    event.stopPropagation();
                    deleteActiveLayer();
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

                Object.entries(motionLayerControls.layers).forEach(([layerKey, controls]) => {
                    controls.trigger?.addEventListener('click', () => {
                        controls.drawer?.classList.toggle('collapsed');
                        syncLeftPanels();
                        updateActionAvailability();
                        if (activeLayerKey !== layerKey) switchActiveLayer(layerKey);
                    });
                    controls.toggle?.addEventListener('click', () => {
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
                        controls.gridSize, controls.midSize, controls.targetSize, controls.speedSize
                    ].forEach(control => {
                        control?.addEventListener('input', () => {
                            persistMotionLayerControls(layerKey, { retarget: false });
                            if (activeLayerKey !== layerKey) switchActiveLayer(layerKey);
                        });
                    });
                });

                autoControls.randomize?.addEventListener('click', event => {
                    event.stopPropagation();
                    randomizeFlickerMorph();
                });
                autoControls.unlock?.addEventListener('click', event => {
                    event.stopPropagation();
                    unlockFlickerMorph();
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
                const cap = clamp(parseInt(viewControls.frameRate?.value, 10) || 60, 30, 120);
                cachedFrameIntervalMs = 1000 / cap;
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

            bindEvents();
            createDefaultPresets();
            applyState(getStartupPresetState());
            syncFrameInterval();
            updateDrawerTitleStates();
            updateFullscreenUi();
            setBrowserZoom(80);
            setViewScale(100, 'manual');
            staticGridCanvas.classList.add('hidden-ui-node');
            geometryCanvas.classList.add('hidden-ui-node');
            requestAnimationFrame(renderFrame);
