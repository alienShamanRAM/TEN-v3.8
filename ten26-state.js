// TEN26 app state, DOM references, controls, helpers, and grid-layer setup.
const viewport = document.getElementById('canvas-viewport');
            const controlPanel = document.getElementById('control-panel');
            const gridControlPanel = document.getElementById('grid-control-panel');
            const panelToggle = document.getElementById('panel-toggle');
            const minimizeBtn = document.getElementById('minimize-btn');
            const motionMatrixPanel = document.getElementById('motion-matrix-panel');
            const toastRegion = document.getElementById('ui-toast-region');
            const helpControls = {
                tooltipsEnabled: document.getElementById('help-tooltips-enabled')
            };
            let tooltipsEnabled = helpControls.tooltipsEnabled?.checked !== false;
            let uiToastTimer = null;
            let overlayStatusText = '';
            const TEN26_DOT_RANDOM_COLORS = [
                '#02006c',
                '#ffffff',
                '#ffc5f4'
            ];
            let headerAutoplayActive = false;

            function setOverlayStatus(text) {
                overlayStatusText = text || '';
                if (typeof updateViewStatus === 'function') updateViewStatus();
            }

            function setHeaderAutoplayStatus(active) {
                headerAutoplayActive = !!active;
                if (typeof updateViewStatus === 'function') updateViewStatus();
            }

            function showUiToast(message, tone = 'info') {
                if (!toastRegion || !message) return;
                if (uiToastTimer) window.clearTimeout(uiToastTimer);
                toastRegion.textContent = message;
                toastRegion.className = `ui-toast-region visible${tone === 'warning' ? ' toast-warning' : ''}`;
                setOverlayStatus(message);
                uiToastTimer = window.setTimeout(() => {
                    toastRegion.className = 'ui-toast-region';
                    uiToastTimer = null;
                }, 2400);
            }

            function forceBlinkRespawnState(state = {}) {
                return {
                    ...state,
                    visibilityGridProximity: state.visibilityGridProximity ?? '0'
                };
            }

            function createRangeGroup(label, id, min, max, value, step = '1', options = {}) {
                const group = document.createElement('div');
                group.className = 'slider-group';
                const labelNode = document.createElement('span');
                labelNode.textContent = label;
                const input = document.createElement('input');
                input.type = 'range';
                input.id = id;
                input.min = min;
                input.max = max;
                input.value = value;
                input.step = step;
                if (options.snapValue !== undefined) input.dataset.snapValue = String(options.snapValue);
                const indicator = document.createElement('span');
                indicator.className = 'val-indicator';
                indicator.id = `val-${id}`;
                indicator.textContent = value;
                group.append(labelNode, input, indicator);
                return group;
            }

            function createCompactColorControl(layerKey, label, suffix, value = '#ffffff') {
                const wrap = document.createElement('div');
                wrap.className = 'compact-color';
                const labelNode = document.createElement('span');
                labelNode.className = 'compact-color-label';
                labelNode.textContent = label;
                const pickerWrap = document.createElement('div');
                pickerWrap.className = 'color-picker-wrapper';
                const picker = document.createElement('input');
                picker.type = 'color';
                picker.id = `dot-${layerKey}-${suffix}-color`;
                picker.value = value;
                const hex = document.createElement('input');
                hex.type = 'text';
                hex.id = `dot-${layerKey}-${suffix}-color-hex`;
                hex.value = value;
                hex.maxLength = 7;
                pickerWrap.appendChild(picker);
                wrap.append(labelNode, pickerWrap, hex);
                return wrap;
            }

            function createMotionLayerDrawer(layerKey) {
                const drawer = document.createElement('div');
                drawer.className = 'motion-layer-drawer collapsed';
                drawer.id = `motion-drawer-${layerKey}`;
                drawer.dataset.layer = layerKey;

                const header = document.createElement('div');
                header.className = 'motion-layer-header';
                const toggle = document.createElement('button');
                toggle.className = 'motion-layer-icon-btn layer-visibility-btn';
                toggle.id = `motion-toggle-layer-${layerKey}`;
                toggle.type = 'button';
                setNativeTooltip(toggle, 'Show or hide this grid layer.');
                toggle.textContent = 'Eye';
                const trigger = document.createElement('button');
                trigger.className = 'motion-layer-trigger';
                trigger.id = `motion-trigger-${layerKey}`;
                trigger.type = 'button';
                const triggerText = document.createElement('span');
                triggerText.className = 'motion-layer-name';
                triggerText.textContent = 'Grid';
                trigger.appendChild(triggerText);
                header.append(toggle, trigger);

                const content = document.createElement('div');
                content.className = 'motion-layer-content';

                const targetSelect = document.createElement('select');
                targetSelect.id = `dot-${layerKey}-target-type`;
                setNativeTooltip(targetSelect, 'Choose the SVG target points for this grid layer.');
                [
                    ['fill', 'Fill'],
                    ['path', 'Path'],
                    ['anchor', 'Anchor']
                ].forEach(([value, text]) => {
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = text;
                    if (value === 'fill') option.selected = true;
                    targetSelect.appendChild(option);
                });
                content.appendChild(targetSelect);

                [
                    ['Slide Pull', 'pull', '0.1', '1', '0.7', '0.01'],
                    ['Slide Reach', 'svg-radius', '100', '1000', '320', '5'],
                    ['Grid Pull', 'return-pull', '0.1', '1', '0.38', '0.01'],
                    ['Grid Reach', 'grid-radius', '100', '1000', '1000', '10'],
                    ['Speed Cap', 'speed-limit', '0.5', '120', '80', '0.5'],
                    ['Weight', 'mass', '1', '10', '1', '0.1'],
                    ['Damping', 'friction', '0', '100', '34', '1'],
                    ['Stick / Fly-By', 'elasticity', '0', '100', '45', '1'],
                    ['Swirl', 'orbit', '-2', '2', '0', '0.01', { snapValue: 0 }],
                    ['Shuffle', 'shuffle', '0', '100', '0', '1'],
                    ['Motion Var', 'variation', '0', '100', '0', '1'],
                    ['Grid Size', 'grid-size', '1', '100', '2.5', '0.1'],
                    ['Mid Size', 'mid-size', '1', '100', '2.5', '0.1'],
                    ['Target Size', 'target-size', '1', '100', '2.5', '0.1'],
                    ['Speed Size', 'speed-size', '-10', '10', '0', '0.1', { snapValue: 0 }]
                ].forEach(([label, suffix, min, max, value, step, options]) => {
                    content.appendChild(createRangeGroup(label, `dot-${layerKey}-${suffix}`, min, max, value, step, options));
                });

                const colorRow = document.createElement('div');
                colorRow.className = 'color-pair-row';
                colorRow.append(
                    createCompactColorControl(layerKey, 'Grid', 'grid'),
                    createCompactColorControl(layerKey, 'Mid', 'mid'),
                    createCompactColorControl(layerKey, 'Target', 'target')
                );
                content.appendChild(colorRow);
                content.appendChild(createRangeGroup('Mid Point', `dot-${layerKey}-size-midpoint`, '0.05', '0.95', '0.5', '0.01'));

                const actions = document.createElement('div');
                actions.className = 'drawer-bottom-actions';
                const randomize = document.createElement('button');
                randomize.className = 'preset-action-btn pink-action';
                randomize.id = `motion-randomize-text-${layerKey}`;
                randomize.type = 'button';
                randomize.textContent = 'Random';
                const lock = document.createElement('button');
                lock.className = 'preset-action-btn';
                lock.id = `motion-lock-${layerKey}`;
                lock.type = 'button';
                lock.textContent = 'Lock';
                const unlock = document.createElement('button');
                unlock.className = 'preset-action-btn';
                unlock.id = `motion-unlock-${layerKey}`;
                unlock.type = 'button';
                unlock.textContent = 'Unlock';
                const reset = document.createElement('button');
                reset.className = 'preset-action-btn';
                reset.id = `motion-reset-${layerKey}`;
                reset.type = 'button';
                reset.textContent = 'Reset';
                actions.append(randomize, lock, unlock, reset);
                content.appendChild(actions);

                drawer.append(header, content);
                return drawer;
            }

            function createSvgMediaStackDrawer() {
                const drawer = document.createElement('div');
                drawer.className = 'motion-layer-drawer svg-media-stack-drawer';
                drawer.id = 'svg-media-stack-drawer';
                drawer.dataset.stack = 'svg-media';

                const header = document.createElement('div');
                header.className = 'motion-layer-header svg-media-stack-header';
                const reorderActions = document.createElement('div');
                reorderActions.className = 'motion-layer-reorder-actions svg-media-stack-actions';
                [
                    ['up', 'Move SVG/media above grid layers', '▲'],
                    ['down', 'Move SVG/media below grid layers', '▼']
                ].forEach(([direction, title, text]) => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.id = `svg-media-stack-${direction}`;
                    button.className = 'motion-layer-icon-btn motion-layer-reorder-btn svg-media-stack-btn';
                    button.textContent = text;
                    setNativeTooltip(button, title);
                    reorderActions.appendChild(button);
                });
                header.appendChild(reorderActions);
                drawer.appendChild(header);
                return drawer;
            }

            function createGridLayerContent(layerKey) {
                const content = document.createElement('div');
                content.className = 'grid-layer-content';
                content.id = `grid-content-${layerKey}`;
                content.dataset.layer = layerKey;
                [
                    ['Columns', 'cols', '1', '60', '25', '1'],
                    ['Rows', 'rows', '1', '40', '7', '1'],
                    ['Spacing', 'spacing', '5', '120', '42', '1'],
                    ['Offset X', 'offset-x', '-640', '640', '0', '1'],
                    ['Offset Y', 'offset-y', '-360', '360', '110', '1']
                ].forEach(([label, suffix, min, max, value, step]) => {
                    content.appendChild(createRangeGroup(label, `grid-${layerKey}-${suffix}`, min, max, value, step));
                });
                return content;
            }

            function installDynamicLayerControls() {
                if (motionMatrixPanel) {
                    motionMatrixPanel.querySelectorAll('.motion-layer-drawer').forEach(node => node.remove());
                    ALL_DOT_LAYER_KEYS.forEach(layerKey => {
                        motionMatrixPanel.appendChild(createMotionLayerDrawer(layerKey));
                    });
                    motionMatrixPanel.appendChild(createSvgMediaStackDrawer());
                }
                const gridDrawer = document.getElementById('drawer-grid');
                const gridStatus = document.getElementById('grid-layout-status');
                if (gridDrawer && gridStatus?.parentElement) {
                    gridDrawer.querySelectorAll('.grid-layer-content').forEach(node => node.remove());
                    ALL_DOT_LAYER_KEYS.forEach(layerKey => {
                        gridStatus.parentElement.insertBefore(createGridLayerContent(layerKey), gridStatus);
                    });
                }
            }

            // The Grid Layers drawer controls the companion layer editor surface.
            const LEFT_PANEL_DRAWER_IDS = ['drawer-dot-matrix'];

            function getLeftPanelForDrawer(drawerId) {
                if (drawerId === 'drawer-dot-matrix') return motionMatrixPanel;
                return null;
            }

            function buildDrawerGroup(drawerId, triggerId, label, childDrawerIds) {
                if (!controlPanel) return null;
                let drawer = document.getElementById(drawerId);
                if (!drawer) {
                    drawer = document.createElement('div');
                    drawer.className = 'drawer drawer-group';
                    drawer.id = drawerId;
                    const trigger = document.createElement('button');
                    trigger.className = 'drawer-trigger';
                    trigger.id = triggerId;
                    trigger.type = 'button';
                    trigger.textContent = label;
                    const content = document.createElement('div');
                    content.className = 'drawer-content drawer-group-content';
                    drawer.append(trigger, content);
                }
                drawer.classList.add('drawer-group');
                const trigger = drawer.querySelector('.drawer-trigger');
                if (trigger) {
                    trigger.id = triggerId;
                    trigger.type = 'button';
                    trigger.textContent = label;
                }
                let content = drawer.querySelector('.drawer-group-content');
                if (!content) {
                    content = drawer.querySelector('.drawer-content');
                    if (!content) {
                        content = document.createElement('div');
                        content.className = 'drawer-content';
                        drawer.appendChild(content);
                    }
                    content.classList.add('drawer-group-content');
                }
                const firstChildDrawer = childDrawerIds
                    .map(childId => document.getElementById(childId))
                    .find(Boolean);
                if (!drawer.isConnected && firstChildDrawer?.parentElement) {
                    firstChildDrawer.parentElement.insertBefore(drawer, firstChildDrawer);
                }
                childDrawerIds.forEach(childId => {
                    const childDrawer = document.getElementById(childId);
                    if (!childDrawer || childDrawer.parentElement === content) return;
                    childDrawer.classList.add('nested-drawer');
                    content.appendChild(childDrawer);
                });
                return drawer;
            }

            function installRightPanelDrawers() {
                gridControlPanel?.classList.add('minimized', 'retired-panel');
                buildDrawerGroup('drawer-upload-media', 'drawer-trigger-upload-media', 'Upload Media', [
                    'drawer-slides',
                    'drawer-image-slides',
                    'drawer-special-overlays',
                    'drawer-masks'
                ]);
                buildDrawerGroup('drawer-advanced-options', 'drawer-trigger-advanced-options', 'Advanced Options', [
                    'drawer-grid',
                    'drawer-flicker',
                    'drawer-blink-mode'
                ]);
            }

            function collapseLeftPanelDrawers(drawerId) {
                getLeftPanelForDrawer(drawerId)?.querySelectorAll('.motion-layer-drawer:not(.svg-media-stack-drawer)').forEach(drawer => drawer.classList.add('collapsed'));
            }

            // The GRID drawer owns the embedded layer controls while the left panel is open.
            function syncLeftPanels() {
                const panelIsHidden = controlPanel.classList.contains('minimized');
                LEFT_PANEL_DRAWER_IDS.forEach(drawerId => {
                    const drawer = document.getElementById(drawerId);
                    const panel = getLeftPanelForDrawer(drawerId);
                    if (!panel) return;
                    const isVisible = !panelIsHidden && drawer && !drawer.classList.contains('collapsed');
                    panel.classList.toggle('matrix-hidden', !isVisible);
                    panel.classList.toggle('left-panel-active', isVisible);
                    if (!isVisible) {
                        collapseLeftPanelDrawers(drawerId);
                    }
                });
            }

            function collapseDrawer(drawer) {
                drawer?.classList.add('collapsed');
                if (drawer?.dataset.leftPanel) collapseLeftPanelDrawers(drawer.id);
            }

            function toggleDrawer(drawer) {
                if (!drawer) return;
                const shouldOpen = drawer.classList.contains('collapsed');
                if (shouldOpen) {
                    drawer.classList.remove('collapsed');
                    if (drawer.id === 'drawer-dot-matrix') {
                        motionMatrixPanel?.querySelectorAll('.motion-layer-drawer').forEach(layerDrawer => layerDrawer.classList.remove('collapsed'));
                    }
                } else {
                    collapseDrawer(drawer);
                }
                syncLeftPanels();
                updateActionAvailability();
            }

            installRightPanelDrawers();
            document.querySelectorAll('.drawer').forEach(drawer => drawer.classList.add('collapsed'));
            LEFT_PANEL_DRAWER_IDS.forEach(collapseLeftPanelDrawers);
            document.querySelectorAll('.drawer-trigger').forEach(trigger => {
                trigger.addEventListener('click', event => {
                    event.stopPropagation();
                    toggleDrawer(trigger.closest('.drawer'));
                });
            });
            syncLeftPanels();
            function hideControlPanels() {
                controlPanel.classList.add('minimized');
                syncLeftPanels();
            }

            function showControlPanels() {
                controlPanel.classList.remove('minimized');
                syncLeftPanels();
            }

            minimizeBtn.addEventListener('click', () => {
                hideControlPanels();
            });
            panelToggle.addEventListener('click', () => {
                showControlPanels();
            });
            window.addEventListener('resize', syncLeftPanels);

            const imageLayer = document.getElementById('image-layer');
            const slideLayer = document.getElementById('svg-slide-layer');
            const specialSvgLayer = document.getElementById('special-svg-layer');
            const staticGridCanvas = document.getElementById('grid-canvas-primary');
            const geometryCanvas = document.getElementById('svg-geometry-canvas');
            const morphCanvas = document.getElementById('morph-canvas');
            const morphCtx = morphCanvas.getContext('2d');
            const dotLayerCanvases = new Map();
            const dotLayerContexts = new Map();

            const MAX_DOT_LAYERS = 9;
            const DEFAULT_LAYER_KEY = 'layer-1';
            const LEGACY_DOT_LAYER_KEYS = ['top', 'mid', 'bottom'];
            const ALL_DOT_LAYER_KEYS = Array.from({ length: MAX_DOT_LAYERS }, (_, index) => `layer-${index + 1}`);
            let DOT_LAYER_KEYS = [DEFAULT_LAYER_KEY];
            let svgMediaStackIndex = DOT_LAYER_KEYS.length;
            const TARGET_TYPE_KEYS = ['anchor', 'path', 'fill'];
            const DOT_LAYER_META = ALL_DOT_LAYER_KEYS.reduce((acc, layerKey, index) => {
                acc[layerKey] = { label: `Grid ${index + 1}`, defaultOffsetY: '110', defaultColor: '#ffffff' };
                return acc;
            }, {});
            function registerDotLayerCanvas(layerKey, canvas, ctx = null) {
                if (!layerKey || !canvas) return;
                canvas.dataset.layerCanvas = layerKey;
                canvas.classList.add('dot-layer-canvas');
                dotLayerCanvases.set(layerKey, canvas);
                dotLayerContexts.set(layerKey, ctx || canvas.getContext('2d'));
            }

            function installDotLayerCanvases() {
                registerDotLayerCanvas(DEFAULT_LAYER_KEY, morphCanvas, morphCtx);
                ALL_DOT_LAYER_KEYS.forEach(layerKey => {
                    if (layerKey === DEFAULT_LAYER_KEY) return;
                    let canvas = document.getElementById(`dot-canvas-${layerKey}`);
                    if (!canvas) {
                        canvas = document.createElement('canvas');
                        canvas.id = `dot-canvas-${layerKey}`;
                        canvas.className = 'grid-canvas-instance dot-layer-canvas';
                        viewport.appendChild(canvas);
                    }
                    registerDotLayerCanvas(layerKey, canvas);
                });
            }

            installDotLayerCanvases();
            installDynamicLayerControls();
            organizeMotionLayerLayouts();
            const DEFAULT_STUDIO_WIDTH = 1280;
            const DEFAULT_STUDIO_HEIGHT = 720;
            const STUDIO_WIDTH_MIN = 640;
            const STUDIO_WIDTH_MAX = 3840;
            const STUDIO_HEIGHT_MIN = 360;
            const STUDIO_HEIGHT_MAX = 2160;
            let STUDIO_WIDTH = DEFAULT_STUDIO_WIDTH;
            let STUDIO_HEIGHT = DEFAULT_STUDIO_HEIGHT;
            let STUDIO_CENTER_X = STUDIO_WIDTH / 2;
            let STUDIO_CENTER_Y = STUDIO_HEIGHT / 2;
            const PRESET_GRID_SPACING = '42';
            const PRESET_GRID_OFFSET_Y = '110';
            const PRESET_GRID_RADIUS = '1000';
            const MAX_DOT_SIZE = 100;
            const INTERACTION_HELP_TEXT = 'Left/Right change slides. Space holds the current slide. Up hides the UI. Down restores it. Esc stops flicker.';

            const UI_ICONS = {
                eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c5.2 0 8.8 4.5 9.7 5.8.2.3.2.6 0 .9C20.8 13 17.2 17.5 12 17.5S3.2 13 2.3 11.7a.8.8 0 0 1 0-.9C3.2 9.5 6.8 5 12 5Zm0 2C8.4 7 5.6 9.6 4.4 11.2 5.6 12.9 8.4 15.5 12 15.5s6.4-2.6 7.6-4.3C18.4 9.6 15.6 7 12 7Zm0 1.5a2.7 2.7 0 1 1 0 5.4 2.7 2.7 0 0 1 0-5.4Z"/></svg>',
                eyeOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.3 2.4 21.6 20.7l-1.3 1.3-3.2-3.2A10.8 10.8 0 0 1 12 20C6.8 20 3.2 15.5 2.3 14.2a.8.8 0 0 1 0-.9 17 17 0 0 1 4-4.1L2 4l1.3-1.6Zm6.1 9.3a2.7 2.7 0 0 0 3.4 3.4l-3.4-3.4Zm2.6-6.2c5.2 0 8.8 4.5 9.7 5.8.2.3.2.6 0 .9a16.8 16.8 0 0 1-2.6 3.1l-2.2-2.2a5 5 0 0 0-6-6L9.1 5.4c.9-.2 1.9-.4 2.9-.4Z"/></svg>',
                dice: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3h11A3.5 3.5 0 0 1 21 6.5v11a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 17.5v-11A3.5 3.5 0 0 1 6.5 3Zm0 2A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19h11a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 17.5 5h-11ZM8 8.2a1.2 1.2 0 1 1 2.4 0A1.2 1.2 0 0 1 8 8.2Zm5.6 0a1.2 1.2 0 1 1 2.4 0 1.2 1.2 0 0 1-2.4 0ZM8 15.8a1.2 1.2 0 1 1 2.4 0 1.2 1.2 0 0 1-2.4 0Zm5.6 0a1.2 1.2 0 1 1 2.4 0 1.2 1.2 0 0 1-2.4 0Zm-2.8-3.8a1.2 1.2 0 1 1 2.4 0 1.2 1.2 0 0 1-2.4 0Z"/></svg>',
                lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3h1.2c.7 0 1.3.6 1.3 1.3v7.4c0 .7-.6 1.3-1.3 1.3H5.8c-.7 0-1.3-.6-1.3-1.3v-7.4c0-.7.6-1.3 1.3-1.3H7Zm2 0h6V7a3 3 0 0 0-6 0v3Z"/></svg>',
                unlock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10V7a5 5 0 0 1 9.4-2.4l-1.8.9A3 3 0 0 0 10 7v3h8.2c.7 0 1.3.6 1.3 1.3v7.4c0 .7-.6 1.3-1.3 1.3H5.8c-.7 0-1.3-.6-1.3-1.3v-7.4c0-.7.6-1.3 1.3-1.3H8Z"/></svg>',
                mouse: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8a5.2 5.2 0 0 1 5.2 5.2v8a5.2 5.2 0 0 1-10.4 0V8A5.2 5.2 0 0 1 12 2.8Zm0 2A3.2 3.2 0 0 0 8.8 8v8a3.2 3.2 0 0 0 6.4 0V8A3.2 3.2 0 0 0 12 4.8Zm-.9 1.4h1.8v4.1h-1.8V6.2Z"/></svg>',
                minimize: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11h14v2H5v-2Z"/></svg>'
            };

            function setIconButton(button, iconName, label) {
                if (!button) return;
                button.innerHTML = UI_ICONS[iconName] || '';
                button.setAttribute('aria-label', label);
                setNativeTooltip(button, label);
            }

            function createMotionCategoryColumn(label) {
                const column = document.createElement('div');
                column.className = 'motion-category-column';
                column.dataset.category = label;
                const heading = document.createElement('span');
                heading.className = 'motion-category-title';
                heading.textContent = label;
                column.appendChild(heading);
                return column;
            }

            function organizeMotionLayerLayouts() {
                const categoryMap = {
                    Target: ['pull', 'svg-radius', 'speed-size'],
                    Grid: ['return-pull', 'grid-radius', 'speed-limit'],
                    Dynamics: ['mass', 'friction', 'elasticity'],
                    Drift: ['orbit', 'shuffle', 'variation'],
                    Size: ['grid-size', 'mid-size', 'target-size']
                };

                ALL_DOT_LAYER_KEYS.forEach(layerKey => {
                    const drawer = document.getElementById(`motion-drawer-${layerKey}`);
                    const header = drawer?.querySelector('.motion-layer-header');
                    const content = drawer?.querySelector('.motion-layer-content');
                    if (!drawer || !header || !content || content.querySelector('.motion-layer-top-row')) return;

                    const reorderActions = document.createElement('div');
                    reorderActions.className = 'motion-layer-reorder-actions';
                    ['up', 'down'].forEach(direction => {
                        const button = document.createElement('button');
                        button.type = 'button';
                        button.id = `motion-move-${direction}-${layerKey}`;
                        button.className = 'motion-layer-icon-btn motion-layer-reorder-btn';
                        button.textContent = direction === 'up' ? '▲' : '▼';
                        setNativeTooltip(button, `${direction === 'up' ? 'Move layer up' : 'Move layer down'}.`);
                        reorderActions.appendChild(button);
                    });
                    if (reorderActions.children.length) header.appendChild(reorderActions);

                    const actions = document.createElement('div');
                    actions.className = 'motion-layer-actions';
                    ['randomize-text', 'lock', 'unlock', 'reset'].forEach(actionKey => {
                        let button = document.getElementById(`motion-${actionKey}-${layerKey}`);
                        if (!button && actionKey === 'reset') {
                            button = document.createElement('button');
                            button.id = `motion-reset-${layerKey}`;
                            button.type = 'button';
                            button.className = 'preset-action-btn';
                            button.textContent = 'Reset';
                        }
                        if (!button) return;
                        button.classList.add('preset-action-btn', 'motion-layer-text-action');
                        button.classList.remove('pink-action');
                        button.textContent = actionKey === 'randomize-text'
                            ? 'Random'
                            : (actionKey === 'lock'
                                ? 'Lock'
                                : (actionKey === 'unlock' ? 'Unlock' : 'Reset'));
                        actions.appendChild(button);
                    });
                    const deleteButton = document.createElement('button');
                    deleteButton.type = 'button';
                    deleteButton.id = `motion-delete-${layerKey}`;
                    deleteButton.className = 'motion-layer-icon-btn motion-layer-delete-btn';
                    deleteButton.textContent = 'X';
                    setNativeTooltip(deleteButton, 'Delete layer.');
                    if (actions.children.length) header.appendChild(actions);
                    header.appendChild(deleteButton);

                    content.querySelectorAll('.drawer-bottom-actions').forEach(node => {
                        if (!node.children.length) node.remove();
                    });

                    const topRow = document.createElement('div');
                    topRow.className = 'motion-layer-top-row';

                    const targetSelect = document.getElementById(`dot-${layerKey}-target-type`);
                    if (targetSelect) {
                        const targetWrap = document.createElement('label');
                        targetWrap.className = 'motion-target-control';
                        const label = document.createElement('span');
                        label.textContent = 'Target';
                        targetWrap.append(label, targetSelect);
                        topRow.appendChild(targetWrap);
                    }

                    const colorRow = content.querySelector('.color-pair-row');
                    colorRow?.querySelectorAll('.compact-color').forEach(colorControl => topRow.appendChild(colorControl));
                    const midpointControl = document.getElementById(`dot-${layerKey}-size-midpoint`)?.closest('.slider-group');
                    if (midpointControl) topRow.appendChild(midpointControl);

                    content.prepend(topRow);

                    const columns = document.createElement('div');
                    columns.className = 'motion-category-grid';
                    Object.entries(categoryMap).forEach(([label, suffixes]) => {
                        const column = createMotionCategoryColumn(label);
                        suffixes.forEach(suffix => {
                            const group = document.getElementById(`dot-${layerKey}-${suffix}`)?.closest('.slider-group');
                            if (group) column.appendChild(group);
                        });
                        if (column.children.length > 1) columns.appendChild(column);
                    });
                    topRow.insertAdjacentElement('afterend', columns);

                    colorRow?.remove();
                    content.querySelectorAll('.section-spacer').forEach(spacer => spacer.remove());
                    const speedSize = document.getElementById(`dot-${layerKey}-speed-size`)?.closest('.slider-group');
                    speedSize?.classList.add('accent-slider-label');
                    const speedLimit = document.getElementById(`dot-${layerKey}-speed-limit`)?.closest('.slider-group');
                    speedLimit?.classList.add('accent-slider-label');
                    const elasticityLabel = document.getElementById(`dot-${layerKey}-elasticity`)?.closest('.slider-group')?.querySelector('span');
                    if (elasticityLabel) elasticityLabel.textContent = 'Stick / Fly-By';
                });
            }

            function normalizeTargetTypes(value, fallback = ['fill']) {
                const explicit = value !== undefined && value !== null;
                let raw = [];
                if (Array.isArray(value)) {
                    raw = value;
                } else if (typeof value === 'string') {
                    raw = value.split(/[,\s|]+/);
                } else if (value && typeof value === 'object') {
                    raw = TARGET_TYPE_KEYS.filter(key => value[key]);
                }
                const normalized = TARGET_TYPE_KEYS.filter(key => raw.includes(key));
                if (explicit) return normalized;
                return TARGET_TYPE_KEYS.filter(key => fallback.includes(key));
            }

            function normalizeTargetType(value, fallback = 'fill') {
                return normalizeTargetTypes(value, [fallback])[0] || fallback;
            }

            const slideControls = {
                file: document.getElementById('file-slides'),
                label: document.getElementById('label-slides'),
                clear: document.getElementById('clear-slides'),
                status: document.getElementById('slide-status'),
                scale: document.getElementById('slide-scale'),
                offsetX: document.getElementById('slide-offset-x'),
                offsetY: document.getElementById('slide-offset-y'),
                autoDuration: document.getElementById('slide-auto-duration')
            };

            const gridControls = {
                applyAll: document.getElementById('grid-apply-all'),
                status: document.getElementById('grid-layout-status'),
                layers: ALL_DOT_LAYER_KEYS.reduce((acc, layerKey) => {
                    acc[layerKey] = {
                        content: document.getElementById(`grid-content-${layerKey}`),
                        cols: document.getElementById(`grid-${layerKey}-cols`),
                        rows: document.getElementById(`grid-${layerKey}-rows`),
                        spacing: document.getElementById(`grid-${layerKey}-spacing`),
                        offsetX: document.getElementById(`grid-${layerKey}-offset-x`),
                        offsetY: document.getElementById(`grid-${layerKey}-offset-y`)
                    };
                    return acc;
                }, {})
            };

            const motionLayerControls = {
                panel: motionMatrixPanel,
                openAll: document.getElementById('matrix-open-all'),
                collapseAll: document.getElementById('matrix-collapse-all'),
                randomizeAll: document.getElementById('matrix-randomize-all'),
                copyAbove: document.getElementById('matrix-copy-above'),
                copyBelow: document.getElementById('matrix-copy-below'),
                status: document.getElementById('matrix-status'),
                layers: ALL_DOT_LAYER_KEYS.reduce((acc, layerKey) => {
                    acc[layerKey] = {
                        drawer: document.getElementById(`motion-drawer-${layerKey}`),
                        trigger: document.getElementById(`motion-trigger-${layerKey}`),
                        toggle: document.getElementById(`motion-toggle-layer-${layerKey}`),
                        randomize: document.getElementById(`motion-randomize-${layerKey}`),
                        randomizeText: document.getElementById(`motion-randomize-text-${layerKey}`),
                        lock: document.getElementById(`motion-lock-${layerKey}`),
                        unlock: document.getElementById(`motion-unlock-${layerKey}`),
                        reset: document.getElementById(`motion-reset-${layerKey}`),
                        deleteLayer: document.getElementById(`motion-delete-${layerKey}`),
                        moveUp: document.getElementById(`motion-move-up-${layerKey}`),
                        moveDown: document.getElementById(`motion-move-down-${layerKey}`),
                        status: document.getElementById(`motion-status-${layerKey}`),
                        targetType: document.getElementById(`dot-${layerKey}-target-type`),
                        mass: document.getElementById(`dot-${layerKey}-mass`),
                        friction: document.getElementById(`dot-${layerKey}-friction`),
                        returnPull: document.getElementById(`dot-${layerKey}-return-pull`),
                        pull: document.getElementById(`dot-${layerKey}-pull`),
                        svgRadius: document.getElementById(`dot-${layerKey}-svg-radius`),
                        gridRadius: document.getElementById(`dot-${layerKey}-grid-radius`),
                        speedLimit: document.getElementById(`dot-${layerKey}-speed-limit`),
                        elasticity: document.getElementById(`dot-${layerKey}-elasticity`),
                        orbit: document.getElementById(`dot-${layerKey}-orbit`),
                        shuffle: document.getElementById(`dot-${layerKey}-shuffle`),
                        variation: document.getElementById(`dot-${layerKey}-variation`),
                        gridSize: document.getElementById(`dot-${layerKey}-grid-size`),
                        midSize: document.getElementById(`dot-${layerKey}-mid-size`),
                        targetSize: document.getElementById(`dot-${layerKey}-target-size`),
                        sizeMidpoint: document.getElementById(`dot-${layerKey}-size-midpoint`),
                        speedSize: document.getElementById(`dot-${layerKey}-speed-size`),
                        gridColor: document.getElementById(`dot-${layerKey}-grid-color`),
                        gridColorHex: document.getElementById(`dot-${layerKey}-grid-color-hex`),
                        midColor: document.getElementById(`dot-${layerKey}-mid-color`),
                        midColorHex: document.getElementById(`dot-${layerKey}-mid-color-hex`),
                        targetColor: document.getElementById(`dot-${layerKey}-target-color`),
                        targetColorHex: document.getElementById(`dot-${layerKey}-target-color-hex`)
                    };
                    return acc;
                }, {})
            };
            const svgMediaStackControls = {
                drawer: document.getElementById('svg-media-stack-drawer'),
                moveUp: document.getElementById('svg-media-stack-up'),
                moveDown: document.getElementById('svg-media-stack-down')
            };
            const blinkControls = {
                enabled: document.getElementById('blink-enabled'),
                visibilityOn: document.getElementById('blink-visibility-on'),
                visibilityOff: document.getElementById('blink-visibility-off'),
                visibilityRandomness: document.getElementById('blink-visibility-randomness'),
                visibilityProbability: document.getElementById('blink-visibility-probability'),
                gridProximity: document.getElementById('blink-grid-proximity'),
                status: document.getElementById('blink-status')
            };
            let morphControls = motionLayerControls.layers[DEFAULT_LAYER_KEY];

            const imageControls = {
                file: document.getElementById('file-image'),
                label: document.getElementById('label-image'),
                toggle: document.getElementById('image-visibility-toggle'),
                clear: document.getElementById('clear-image'),
                status: document.getElementById('image-status'),
                scale: document.getElementById('image-scale'),
                offsetX: document.getElementById('image-offset-x'),
                offsetY: document.getElementById('image-offset-y')
            };

            const bgControls = {
                staticWrap: document.getElementById('bg-static-node-wrapper'),
                mode: document.getElementById('bg-mode'),
                staticPicker: document.getElementById('bg-static-picker'),
                staticHex: document.getElementById('bg-static-hex'),
                color2Row: document.getElementById('bg-color-2-row'),
                color2Picker: document.getElementById('bg-color-2-picker'),
                color2Hex: document.getElementById('bg-color-2-hex'),
                color3Row: document.getElementById('bg-color-3-row'),
                color3Picker: document.getElementById('bg-color-3-picker'),
                color3Hex: document.getElementById('bg-color-3-hex'),
                cycleSpeedRow: document.getElementById('bg-cycle-speed-row'),
                cycleSpeed: document.getElementById('bg-cycle-speed')
            };
            const stageControls = {
                width: document.getElementById('stage-width'),
                height: document.getElementById('stage-height')
            };
            const appBgControls = {
                mode: document.getElementById('app-bg-mode'),
                picker: document.getElementById('app-bg-picker'),
                hex: document.getElementById('app-bg-hex')
            };
            let currentBackgroundColor = bgControls.staticPicker?.value || '#02006c';
            let appliedBackgroundColor = '';
            let backgroundRuntime = null;
            let mediaMode = 'images';

            const maskControls = {
                status: document.getElementById('mask-status'),
                expansion: document.getElementById('mask-expansion'),
                scaleTime: document.getElementById('mask-scale-time')
            };

            const mediaControls = {
                file: document.getElementById('file-image-slides'),
                label: document.getElementById('label-image-slides'),
                clear: document.getElementById('clear-image-slides'),
                status: document.getElementById('image-slides-status'),
                scale: document.getElementById('image-slide-scale'),
                offsetX: document.getElementById('image-slide-offset-x'),
                offsetY: document.getElementById('image-slide-offset-y'),
                duration: document.getElementById('media-slide-duration'),
                durationRow: document.getElementById('media-duration-row'),
                modeStatus: document.getElementById('media-mode-status'),
                transitionMode: document.getElementById('media-transition-mode')
            };
            const imageSlideControls = mediaControls;

            const specialOverlayControls = {
                file: document.getElementById('file-special-overlays'),
                label: document.getElementById('label-special-overlays'),
                list: document.getElementById('special-overlay-list'),
                status: document.getElementById('special-overlays-status')
            };

            const slideControlControls = {
                grid: document.getElementById('slide-button-grid')
            };

            const imageMaskControls = {
                status: document.getElementById('image-mask-status'),
                expansion: document.getElementById('image-mask-expansion'),
                scaleTime: document.getElementById('image-mask-scale-time')
            };

            function isSvgSlideType(type) {
                return type === 'svg';
            }

            function isMediaSlideType(type) {
                return type === 'image' || type === 'video';
            }

            function getSlideControlsForType(slideType) {
                return isMediaSlideType(slideType) ? mediaControls : slideControls;
            }

            function getMaskControlsForType(slideType) {
                return isMediaSlideType(slideType) ? imageMaskControls : maskControls;
            }

            function getMediaTransitionMode() {
                const value = mediaControls.transitionMode?.value || 'full';
                return ['full', 'flicker', 'cut'].includes(value) ? value : 'full';
            }

            function getMediaTransitionModeLabel(value = getMediaTransitionMode()) {
                if (value === 'flicker') return 'Media Flicker';
                if (value === 'cut') return 'Frame To Frame';
                return 'Full Dot';
            }

            function updateMediaModeUi() {
                if (mediaControls.modeStatus) {
                    mediaControls.modeStatus.textContent =
                        `Mode: ${mediaMode === 'videos' ? 'Video Sequence' : 'Image Sequence'} · ${getMediaTransitionModeLabel()}`;
                }
                if (mediaControls.durationRow) {
                    mediaControls.durationRow.classList.toggle('hidden-ui-node', mediaMode === 'videos');
                }
            }
            updateMediaModeUi();

            const autoControls = {
                status: document.getElementById('auto-transition-status'),
                currentTime: document.getElementById('transition-current-time'),
                currentFlickerStart: document.getElementById('transition-current-flicker-start'),
                nextTime: document.getElementById('transition-next-time'),
                nextFlickerStart: document.getElementById('transition-next-flicker-start'),
                returnGridTime: document.getElementById('transition-return-grid-time'),
                flickerBias: document.getElementById('transition-flicker-bias'),
                flickerSpeed: document.getElementById('transition-flicker-speed'),
                flickerBalance: document.getElementById('transition-flicker-balance'),
                flickerWildness: document.getElementById('transition-flicker-wildness')
            };
            const mouseControls = {
                enabled: document.getElementById('mouse-interaction-enabled'),
                status: document.getElementById('mouse-interaction-status'),
                repelStrength: document.getElementById('mouse-repel-strength'),
                svgTargetCount: document.getElementById('mouse-svg-target-count'),
                radius: document.getElementById('mouse-interaction-radius'),
                softness: document.getElementById('mouse-interaction-softness'),
                scrollStep: document.getElementById('mouse-scroll-step')
            };
            const MOUSE_ACTION_LABELS = {
                'svg-target': 'SVG Target',
                repel: 'Repel'
            };
            const MOUSE_ACTION_SCROLL_LABELS = {
                'svg-target': 'SVG Targets',
                repel: 'Radius'
            };
            const mouseInteractionState = {
                pointerInside: false,
                x: 0,
                y: 0,
                leftHeld: false,
                rightHeld: false,
                activeAction: null
            };
            let cachedMouseInteractionConfig = null;
            let cachedMouseViewportRect = null;

            const presetSelect = document.getElementById('preset-select');
            const presetApplyBtn = document.getElementById('preset-apply-btn');
            const presetAddBtn = document.getElementById('preset-add-btn');
            const presetDeleteBtn = document.getElementById('preset-delete-btn');
            const presetExportBtn = document.getElementById('preset-export-btn');
            const presetImportBtn = document.getElementById('preset-import-btn');
            const presetImportFile = document.getElementById('preset-import-file');
            const presetStatus = document.getElementById('preset-status');
            const settingsSelect = document.getElementById('settings-select');
            const settingsApplyBtn = document.getElementById('settings-apply-btn');
            const settingsAddBtn = document.getElementById('settings-add-btn');
            const settingsDeleteBtn = document.getElementById('settings-delete-btn');
            const settingsExportBtn = document.getElementById('settings-export-btn');
            const settingsImportBtn = document.getElementById('settings-import-btn');
            const settingsImportFile = document.getElementById('settings-import-file');
            const settingsStatus = document.getElementById('settings-status');
            const fullscreenEnterBtn = document.getElementById('fullscreen-enter-btn');
            const fullscreenExitBtn = document.getElementById('fullscreen-exit-btn');
            const viewControls = {
                scale: document.getElementById('view-scale'),
                frameRate: document.getElementById('view-frame-rate'),
                fit: document.getElementById('view-fit-btn'),
                status: document.getElementById('view-status'),
                overlayOpacity: document.getElementById('view-overlay-opacity'),
                overlay: document.getElementById('view-resolution-overlay'),
                scaleButtons: Array.from(document.querySelectorAll('[data-view-scale]'))
            };
            const headerControls = {
                prev: document.getElementById('header-prev-btn'),
                hold: document.getElementById('header-hold-btn'),
                next: document.getElementById('header-next-btn'),
                auto: document.getElementById('header-auto-btn')
            };
            const performanceControlGroups = [headerControls].filter(group => (
                group.prev || group.hold || group.next || group.auto
            ));

            const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
            const DENSE_SIZE_MIN = 1;
            const DENSE_SIZE_CENTER = 4;
            const DENSE_SIZE_MAX = 100;
            const DENSE_SIZE_UI_CENTER = 50;
            const DOT_SETTLE_DISTANCE = 1.5;

            function isDenseSizeSlider(control) {
                const id = control?.id || '';
                return control?.type === 'range' &&
                    /^dot-.+-(grid|mid|target)-size$/.test(id);
            }

            function denseSizeActualToUi(value) {
                const numeric = clamp(parseFloat(value), DENSE_SIZE_MIN, DENSE_SIZE_MAX);
                if (numeric <= DENSE_SIZE_CENTER) {
                    return ((numeric - DENSE_SIZE_MIN) / (DENSE_SIZE_CENTER - DENSE_SIZE_MIN)) * DENSE_SIZE_UI_CENTER;
                }
                return DENSE_SIZE_UI_CENTER +
                    ((numeric - DENSE_SIZE_CENTER) / (DENSE_SIZE_MAX - DENSE_SIZE_CENTER)) * DENSE_SIZE_UI_CENTER;
            }

            function denseSizeUiToActual(value) {
                const numeric = clamp(parseFloat(value), 0, 100);
                if (numeric <= DENSE_SIZE_UI_CENTER) {
                    return DENSE_SIZE_MIN +
                        (numeric / DENSE_SIZE_UI_CENTER) * (DENSE_SIZE_CENTER - DENSE_SIZE_MIN);
                }
                return DENSE_SIZE_CENTER +
                    ((numeric - DENSE_SIZE_UI_CENTER) / DENSE_SIZE_UI_CENTER) * (DENSE_SIZE_MAX - DENSE_SIZE_CENTER);
            }

            function formatDenseSizeValue(value) {
                const numeric = clamp(parseFloat(value), DENSE_SIZE_MIN, DENSE_SIZE_MAX);
                const precision = numeric < 10 ? 1 : 0;
                return String(Number(numeric.toFixed(precision)));
            }

            function getControlValue(control) {
                if (!control) return '';
                if (isDenseSizeSlider(control) && control.dataset.denseSizeScale === 'true') {
                    const stored = parseFloat(control.dataset.actualValue);
                    if (Number.isFinite(stored)) return formatDenseSizeValue(stored);
                    return formatDenseSizeValue(denseSizeUiToActual(control.value));
                }
                return control.value;
            }

            function setDenseSizeControlValue(control, value) {
                if (!control) return;
                const actual = clamp(readStateFloat(value, DENSE_SIZE_CENTER), DENSE_SIZE_MIN, DENSE_SIZE_MAX);
                control.dataset.actualValue = formatDenseSizeValue(actual);
                control.value = String(Number(denseSizeActualToUi(actual).toFixed(3)));
                control.setAttribute('aria-valuemin', String(DENSE_SIZE_MIN));
                control.setAttribute('aria-valuemax', String(DENSE_SIZE_MAX));
                control.setAttribute('aria-valuenow', control.dataset.actualValue);
            }

            function setupDenseSizeSliders() {
                document.querySelectorAll('input[type="range"]').forEach(control => {
                    if (!isDenseSizeSlider(control) || control.dataset.denseSizeScale === 'true') return;
                    const actual = control.value || control.getAttribute('value') || String(DENSE_SIZE_CENTER);
                    control.dataset.denseSizeScale = 'true';
                    control.dataset.actualMin = String(DENSE_SIZE_MIN);
                    control.dataset.actualCenter = String(DENSE_SIZE_CENTER);
                    control.dataset.actualMax = String(DENSE_SIZE_MAX);
                    control.min = '0';
                    control.max = '100';
                    control.step = '0.5';
                    setDenseSizeControlValue(control, actual);
                    control.addEventListener('input', () => {
                        control.dataset.actualValue = formatDenseSizeValue(denseSizeUiToActual(control.value));
                        control.setAttribute('aria-valuenow', control.dataset.actualValue);
                    });
                });
            }

            const read = input => parseFloat(getControlValue(input));
            const readInt = input => parseInt(input.value, 10);
            const readStateFloat = (value, fallback) => {
                const parsed = parseFloat(value);
                return Number.isFinite(parsed) ? parsed : fallback;
            };
            function isTypingTarget(el) {
                if (!el) return false;
                if (el.isContentEditable || el.closest?.('[contenteditable="true"]')) return true;
                if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
                if (el.tagName !== 'INPUT') return false;
                const type = (el.type || 'text').toLowerCase();
                return !['range', 'button', 'checkbox', 'color', 'file', 'radio', 'reset', 'submit'].includes(type);
            }

            function invalidateMouseInteractionConfig() {
                cachedMouseInteractionConfig = null;
            }

            function invalidateMouseViewportRect() {
                cachedMouseViewportRect = null;
            }

            function getMouseViewportRect(forceRefresh = false) {
                if (!viewport) return null;
                if (forceRefresh || !cachedMouseViewportRect) {
                    cachedMouseViewportRect = viewport.getBoundingClientRect();
                }
                return cachedMouseViewportRect;
            }

            function readClampedControl(control, fallback) {
                if (!control) return fallback;
                const min = readStateFloat(control.min, fallback);
                const max = readStateFloat(control.max, fallback);
                return clamp(readStateFloat(getControlValue(control), fallback), min, max);
            }

            function setClampedControlValue(control, value, fallback) {
                if (!control) return;
                const min = readStateFloat(control.min, fallback);
                const max = readStateFloat(control.max, fallback);
                const step = readStateFloat(control.step, 0);
                let next = clamp(readStateFloat(value, fallback), min, max);
                if (step > 0) next = min + Math.round((next - min) / step) * step;
                setControlValue(control, clamp(next, min, max));
            }

            function getMouseInteractionConfig() {
                if (cachedMouseInteractionConfig) return cachedMouseInteractionConfig;
                const radius = readClampedControl(mouseControls.radius, 520);
                cachedMouseInteractionConfig = {
                    enabled: mouseControls.enabled?.checked === true,
                    repelStrength: readClampedControl(mouseControls.repelStrength, 300) / 100,
                    svgTargetCount: clamp(Math.round(readClampedControl(mouseControls.svgTargetCount, 400)), 1, 400),
                    radius,
                    radiusSq: radius * radius,
                    softness: readClampedControl(mouseControls.softness, 3),
                    scrollStep: readClampedControl(mouseControls.scrollStep, 20)
                };
                return cachedMouseInteractionConfig;
            }

            function getMouseInteractionControlState() {
                const config = getMouseInteractionConfig();
                return {
                    enabled: config.enabled,
                    repelStrength: getControlValue(mouseControls.repelStrength) || '300',
                    svgTargetCount: getControlValue(mouseControls.svgTargetCount) || '400',
                    radius: getControlValue(mouseControls.radius) || '520',
                    softness: getControlValue(mouseControls.softness) || '3',
                    scrollStep: getControlValue(mouseControls.scrollStep) || '20'
                };
            }

            function applyMouseInteractionControlState(state = {}) {
                if (mouseControls.enabled) mouseControls.enabled.checked = state.enabled === true;
                mouseInteractionState.leftHeld = false;
                mouseInteractionState.rightHeld = false;
                mouseInteractionState.activeAction = null;
                setClampedControlValue(mouseControls.repelStrength, state.repelStrength ?? state.repel ?? '300', 300);
                setClampedControlValue(mouseControls.svgTargetCount, state.svgTargetCount ?? '400', 400);
                setClampedControlValue(mouseControls.radius, state.radius ?? '520', 520);
                setClampedControlValue(mouseControls.softness, state.softness ?? '3', 3);
                setClampedControlValue(mouseControls.scrollStep, state.scrollStep ?? '20', 20);
                invalidateMouseInteractionConfig();
                [
                    mouseControls.repelStrength,
                    mouseControls.svgTargetCount,
                    mouseControls.radius,
                    mouseControls.softness,
                    mouseControls.scrollStep
                ].forEach(control => {
                    if (control) updateRangeIndicator(control);
                });
                syncMouseInteractionStatus();
            }

            function isMouseInteractionEnabled() {
                return getMouseInteractionConfig().enabled;
            }

            function getActiveMouseInteractionAction() {
                if (mouseInteractionState.activeAction === 'svg-target' && mouseInteractionState.leftHeld) return 'svg-target';
                if (mouseInteractionState.activeAction === 'repel' && mouseInteractionState.rightHeld) return 'repel';
                if (mouseInteractionState.rightHeld) return 'repel';
                if (mouseInteractionState.leftHeld) return 'svg-target';
                return null;
            }

            function getMouseActionLabel(action) {
                return MOUSE_ACTION_LABELS[action] || MOUSE_ACTION_LABELS['svg-target'];
            }

            function clearMouseHeldState() {
                mouseInteractionState.leftHeld = false;
                mouseInteractionState.rightHeld = false;
                mouseInteractionState.activeAction = null;
            }

            function refreshMouseHeldButtonsFromMask(buttons) {
                const leftHeld = (buttons & 1) !== 0;
                const rightHeld = (buttons & 2) !== 0;
                const leftChanged = mouseInteractionState.leftHeld !== leftHeld;
                const rightChanged = mouseInteractionState.rightHeld !== rightHeld;
                mouseInteractionState.leftHeld = leftHeld;
                mouseInteractionState.rightHeld = rightHeld;
                if (leftChanged && leftHeld) mouseInteractionState.activeAction = 'svg-target';
                if (rightChanged && rightHeld) mouseInteractionState.activeAction = 'repel';
                if (mouseInteractionState.activeAction === 'svg-target' && !leftHeld) {
                    mouseInteractionState.activeAction = rightHeld ? 'repel' : null;
                }
                if (mouseInteractionState.activeAction === 'repel' && !rightHeld) {
                    mouseInteractionState.activeAction = leftHeld ? 'svg-target' : null;
                }
                if (!leftHeld && !rightHeld) mouseInteractionState.activeAction = null;
                return leftChanged || rightChanged;
            }

            function setMouseHeldAction(action, held) {
                const isSvgTarget = action === 'svg-target';
                if (isSvgTarget) mouseInteractionState.leftHeld = held;
                else mouseInteractionState.rightHeld = held;
                if (held) {
                    mouseInteractionState.activeAction = action;
                    return;
                }
                if (mouseInteractionState.activeAction === action) {
                    mouseInteractionState.activeAction = isSvgTarget
                        ? (mouseInteractionState.rightHeld ? 'repel' : null)
                        : (mouseInteractionState.leftHeld ? 'svg-target' : null);
                }
            }

            function syncMouseInteractionStatus(message = '') {
                if (mouseControls.status) {
                    const action = getActiveMouseInteractionAction();
                    const scrollLabel = MOUSE_ACTION_SCROLL_LABELS[action || 'svg-target'] || 'value';
                    if (message) mouseControls.status.textContent = message;
                    else mouseControls.status.textContent = isMouseInteractionEnabled()
                        ? (action
                            ? `${getMouseActionLabel(action)} active. Wheel controls ${scrollLabel}.`
                            : 'Left: SVG targets. Right: repel. Wheel follows held action.')
                        : 'Mouse forces off.';
                }
                document.getElementById('drawer-trigger-mouse-interaction')?.classList.toggle('inactive-title', !isMouseInteractionEnabled());
                if (typeof updateDrawerTitleStates === 'function') updateDrawerTitleStates();
            }

            function eventPathIncludes(event, node) {
                if (!node) return false;
                const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
                return path.includes(node) || node.contains?.(event.target);
            }

            function isMouseInteractionUiTarget(event) {
                return eventPathIncludes(event, controlPanel) ||
                    eventPathIncludes(event, gridControlPanel) ||
                    eventPathIncludes(event, motionMatrixPanel) ||
                    eventPathIncludes(event, panelToggle);
            }

            function getStudioPointFromPointerEvent(event, options = {}) {
                if (!viewport || isMouseInteractionUiTarget(event)) return null;
                const rect = getMouseViewportRect(options.refreshRect === true);
                if (!rect.width || !rect.height) return null;
                if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return null;
                return {
                    x: clamp((event.clientX - rect.left) / rect.width * STUDIO_WIDTH, 0, STUDIO_WIDTH),
                    y: clamp((event.clientY - rect.top) / rect.height * STUDIO_HEIGHT, 0, STUDIO_HEIGHT)
                };
            }

            function updateMouseInteractionPointer(event, options = {}) {
                const point = getStudioPointFromPointerEvent(event, options);
                mouseInteractionState.pointerInside = !!point;
                if (!point) return false;
                mouseInteractionState.x = point.x;
                mouseInteractionState.y = point.y;
                return true;
            }

            function prepareMouseSvgTargetTargets() {
                if (!slides.length || typeof dotGroups === 'undefined') return 0;
                const slideIndex = clamp(Math.round(currentSlideIndex || 0), 0, slides.length - 1);
                if (!slides[slideIndex]) return 0;
                return applyVisibleLayerTargetsForSlide(slideIndex, 1, { activateMask: false });
            }

            function getMouseScrollEntryForAction(action = getActiveMouseInteractionAction() || 'svg-target') {
                if (action === 'repel') return { control: mouseControls.radius, label: 'Radius' };
                return { control: mouseControls.svgTargetCount, label: 'SVG Targets' };
            }

            function adjustMouseInteractionScrollValues(direction) {
                const entry = getMouseScrollEntryForAction();
                const control = entry.control;
                if (!control) return;
                const config = getMouseInteractionConfig();
                const current = readClampedControl(control, readStateFloat(control.value, 0));
                setClampedControlValue(control, current + config.scrollStep * direction, current);
                updateRangeIndicator(control);
                invalidateMouseInteractionConfig();
                syncMouseInteractionStatus(`Mouse wheel ${direction > 0 ? 'up' : 'down'}: ${entry.label} ${getControlValue(control)}.`);
            }

            function bindMouseInteractionEvents() {
                mouseControls.enabled?.addEventListener('change', () => {
                    clearMouseHeldState();
                    invalidateMouseInteractionConfig();
                    if (isMouseInteractionEnabled()) prepareMouseSvgTargetTargets();
                    syncMouseInteractionStatus();
                });
                [
                    mouseControls.repelStrength,
                    mouseControls.svgTargetCount,
                    mouseControls.radius,
                    mouseControls.softness,
                    mouseControls.scrollStep
                ].forEach(control => {
                    control?.addEventListener('input', () => {
                        invalidateMouseInteractionConfig();
                        syncMouseInteractionStatus();
                    });
                });
                window.addEventListener('mousemove', event => {
                    updateMouseInteractionPointer(event);
                    if (typeof event.buttons === 'number' && refreshMouseHeldButtonsFromMask(event.buttons)) {
                        syncMouseInteractionStatus();
                    }
                }, { passive: true });
                window.addEventListener('mousedown', event => {
                    const overCanvas = updateMouseInteractionPointer(event, { refreshRect: true });
                    if (!overCanvas || !isMouseInteractionEnabled()) return;
                    if (event.button === 0) {
                        event.preventDefault();
                        const preparedTargets = prepareMouseSvgTargetTargets();
                        setMouseHeldAction('svg-target', true);
                        syncMouseInteractionStatus(preparedTargets ? 'SVG Target active.' : 'Load a slide for SVG target mode.');
                    }
                    if (event.button === 2) {
                        event.preventDefault();
                        setMouseHeldAction('repel', true);
                        syncMouseInteractionStatus('Repel active.');
                    }
                }, { passive: false });
                window.addEventListener('mouseup', event => {
                    if (event.button === 0 && mouseInteractionState.leftHeld) {
                        setMouseHeldAction('svg-target', false);
                        syncMouseInteractionStatus();
                    }
                    if (event.button === 2 && mouseInteractionState.rightHeld) {
                        setMouseHeldAction('repel', false);
                        syncMouseInteractionStatus();
                    }
                }, { passive: true });
                window.addEventListener('blur', () => {
                    clearMouseHeldState();
                    mouseInteractionState.pointerInside = false;
                    syncMouseInteractionStatus();
                });
                window.addEventListener('resize', invalidateMouseViewportRect, { passive: true });
                window.addEventListener('scroll', invalidateMouseViewportRect, { passive: true, capture: true });
                window.addEventListener('contextmenu', event => {
                    if (!isMouseInteractionUiTarget(event)) event.preventDefault();
                });
                window.addEventListener('wheel', event => {
                    if (!isMouseInteractionEnabled() || !updateMouseInteractionPointer(event, { refreshRect: true })) return;
                    event.preventDefault();
                    adjustMouseInteractionScrollValues(event.deltaY < 0 ? 1 : -1);
                }, { passive: false });
                syncMouseInteractionStatus();
            }

            function getMouseInteractionFrameState(nowMs = performance.now()) {
                const config = getMouseInteractionConfig();
                const action = getActiveMouseInteractionAction();
                if (!config.enabled || !mouseInteractionState.pointerInside || !action) return null;
                if (action === 'svg-target') {
                    return {
                        x: mouseInteractionState.x,
                        y: mouseInteractionState.y,
                        radius: config.radius,
                        radiusSq: config.radiusSq,
                        softness: config.softness,
                        mode: 'attract',
                        strength: 0,
                        svgTargetActive: true,
                        svgTargetCount: config.svgTargetCount,
                        svgTargetStrength: 1
                    };
                }
                const strength = config.repelStrength;
                if (strength <= 0) return null;
                return {
                    x: mouseInteractionState.x,
                    y: mouseInteractionState.y,
                    radius: config.radius,
                    radiusSq: config.radiusSq,
                    softness: config.softness,
                    mode: 'repel',
                    strength,
                    svgTargetActive: false,
                    svgTargetCount: config.svgTargetCount,
                    svgTargetStrength: 0
                };
            }

            function syncTimingControlRanges() {
                if (typeof invalidateAutoSettingsCache === 'function') invalidateAutoSettingsCache();
                [
                    [autoControls.currentTime, autoControls.currentFlickerStart, 3],
                    [autoControls.nextTime, autoControls.nextFlickerStart, 2]
                ].forEach(([timeControl, startControl, fallback]) => {
                    if (!startControl) return;
                    const phaseTime = clamp(readStateFloat(getControlValue(timeControl), fallback), 0.1, 12);
                    startControl.max = String(phaseTime);
                    const start = clamp(readStateFloat(getControlValue(startControl), 0), 0, phaseTime);
                    if (start !== readStateFloat(getControlValue(startControl), 0)) {
                        setControlValue(startControl, start);
                    }
                    updateRangeIndicator(startControl);
                });
            }

            function updateFullscreenUi() {
                const active = !!document.fullscreenElement;
                if (fullscreenEnterBtn) {
                    fullscreenEnterBtn.disabled = active;
                    fullscreenEnterBtn.classList.toggle('pink-action', !active);
                }
                if (fullscreenExitBtn) {
                    fullscreenExitBtn.disabled = !active;
                    fullscreenExitBtn.classList.toggle('pink-action', active);
                }
            }

            let viewScaleMode = 'manual';
            const VIEW_SCALE_MIN = 25;
            const VIEW_SCALE_MAX = 200;
            let browserZoomPercent = 100;

            function setBrowserZoom(percent) {
                browserZoomPercent = clamp(Math.round(percent), 50, 150);
                document.documentElement.style.zoom = `${browserZoomPercent}%`;
            }

            function getFitViewScale() {
                const xScale = window.innerWidth / STUDIO_WIDTH;
                const yScale = window.innerHeight / STUDIO_HEIGHT;
                return clamp(Math.floor(Math.min(xScale, yScale) * 100), VIEW_SCALE_MIN, VIEW_SCALE_MAX);
            }

            function syncViewportSize() {
                viewport.style.width = `${STUDIO_WIDTH}px`;
                viewport.style.height = `${STUDIO_HEIGHT}px`;
            }

            function getStageState() {
                return {
                    width: String(STUDIO_WIDTH),
                    height: String(STUDIO_HEIGHT)
                };
            }

            function setStudioSize(width, height, options = {}) {
                const nextWidth = clamp(Math.round(parseFloat(width) || DEFAULT_STUDIO_WIDTH), STUDIO_WIDTH_MIN, STUDIO_WIDTH_MAX);
                const nextHeight = clamp(Math.round(parseFloat(height) || DEFAULT_STUDIO_HEIGHT), STUDIO_HEIGHT_MIN, STUDIO_HEIGHT_MAX);
                const changed = nextWidth !== STUDIO_WIDTH || nextHeight !== STUDIO_HEIGHT;
                STUDIO_WIDTH = nextWidth;
                STUDIO_HEIGHT = nextHeight;
                STUDIO_CENTER_X = STUDIO_WIDTH / 2;
                STUDIO_CENTER_Y = STUDIO_HEIGHT / 2;
                syncViewportSize();
                if (typeof invalidateMouseViewportRect === 'function') invalidateMouseViewportRect();
                setControlValue(stageControls.width, STUDIO_WIDTH);
                setControlValue(stageControls.height, STUDIO_HEIGHT);
                if (!changed && !options.force) {
                    updateViewStatus();
                    return;
                }
                if (viewScaleMode === 'fit') setViewScale(getFitViewScale(), 'fit');
                if (typeof clearSlideScreenTargetCaches === 'function') clearSlideScreenTargetCaches();
                if (typeof clearMaskCache === 'function') clearMaskCache();
                if (typeof resetForcesToGrid === 'function') resetForcesToGrid();
                if (typeof dotGroups !== 'undefined') {
                    DOT_LAYER_KEYS.forEach(layerKey => {
                        dotGroups[layerKey]?.rebuildGrid();
                        dotGroups[layerKey]?.returnToGrid();
                    });
                }
                if (typeof updateImageLayer === 'function') updateImageLayer();
                if (typeof renderCurrentSlide === 'function') renderCurrentSlide();
                if (typeof scheduleTransitionPrewarm === 'function') scheduleTransitionPrewarm();
                if (typeof refreshAttractorTargetsIfNeeded === 'function') refreshAttractorTargetsIfNeeded();
                updateViewStatus();
            }

            function setViewScale(percent, mode = 'manual') {
                const next = clamp(Math.round(percent), VIEW_SCALE_MIN, VIEW_SCALE_MAX);
                viewScaleMode = mode;
                viewport.style.setProperty('--view-scale', String(next / 100));
                if (typeof invalidateMouseViewportRect === 'function') invalidateMouseViewportRect();
                if (viewControls.scale) {
                    viewControls.scale.value = String(next);
                    updateRangeIndicator(viewControls.scale);
                }
                updateViewStatus();
            }

            function getViewOptionState() {
                return {
                    scale: viewControls.scale?.value || '100',
                    scaleMode: viewScaleMode === 'fit' ? 'fit' : 'manual',
                    frameRate: viewControls.frameRate?.value || '60',
                    overlayOpacity: viewControls.overlayOpacity?.value || '0'
                };
            }

            function applyViewOptionState(state = {}) {
                setControlValue(viewControls.frameRate, state.frameRate || '60');
                setControlValue(viewControls.overlayOpacity, state.overlayOpacity || '0');
                if (state.scaleMode === 'fit') {
                    setViewScale(getFitViewScale(), 'fit');
                } else {
                    setViewScale(state.scale || '100', 'manual');
                }
                if (typeof syncFrameInterval === 'function') syncFrameInterval();
                updateViewStatus();
            }

            function readOverlayOpacity() {
                return clamp(parseInt(viewControls.overlayOpacity?.value, 10) || 0, 0, 100);
            }

            function escapeOverlayText(value) {
                return String(value ?? '').replace(/[&<>"']/g, character => ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;'
                })[character]);
            }

            function overlayMetric(label, value, options = {}) {
                const emphasisClass = options.important ? ' overlay-value-important' : '';
                return `<span>${escapeOverlayText(label)}</span> <span class="overlay-value${emphasisClass}">${escapeOverlayText(value)}</span>`;
            }

            function renderOverlayLine(label, value, options = {}) {
                return `<div class="overlay-line">${overlayMetric(label, value, options)}</div>`;
            }

            function renderOverlayMarkup(realtimeParts, staticParts) {
                return [
                    `<div class="overlay-realtime">${realtimeParts.filter(Boolean).join('')}</div>`,
                    `<div class="overlay-static">${staticParts.filter(Boolean).join(' <span class="overlay-divider">·</span> ')}</div>`
                ].join('');
            }

            function getSelectedPresetOverlayName() {
                const label = presetSelect?.selectedOptions?.[0]?.textContent || 'Space Mod';
                return label.replace(/^!\s*/, '').trim() || 'Space Mod';
            }

            function updateViewStatus() {
                const scale = Math.round((parseFloat(viewControls.scale?.value) || 100));
                const frameCap = clamp(parseInt(viewControls.frameRate?.value, 10) || 60, 5, 60);
                const dpr = Math.round((window.devicePixelRatio || 1) * 100) / 100;
                const text = `Canvas ${STUDIO_WIDTH} x ${STUDIO_HEIGHT} · Window ${window.innerWidth} x ${window.innerHeight} · View ${scale}% · Browser ${browserZoomPercent}% · Frame cap ${frameCap} fps · Device pixel ratio ${dpr}`;
                if (viewControls.status) viewControls.status.textContent = text;
                if (viewControls.overlay) {
                    const overlayOpacity = readOverlayOpacity();
                    if (overlayOpacity <= 0) {
                        viewControls.overlay.classList.add('hidden-ui-node');
                        viewControls.overlay.textContent = '';
                    } else {
                        const info = typeof getOverlayRuntimeInfo === 'function' ? getOverlayRuntimeInfo() : null;
                        const realtimeParts = [];
                        if (info) {
                            realtimeParts.push(renderOverlayLine('Slide', `${info.slideIndex}/${info.slideTotal}`));
                            realtimeParts.push(renderOverlayLine('Type', info.typeLabel || 'None'));
                            realtimeParts.push(renderOverlayLine('Autoplay', info.autoplay || 'Off'));
                            realtimeParts.push(renderOverlayLine('Transition', info.transitionState || 'Idle'));
                            realtimeParts.push(renderOverlayLine('Active Layer', info.activeLayer || '-'));
                            realtimeParts.push(renderOverlayLine('Dots', info.dotCount));
                            realtimeParts.push(renderOverlayLine('FPS', `${overlayFrameStats.fps} / worst ${overlayFrameStats.worst}`, { important: true }));
                            realtimeParts.push(renderOverlayLine('Cache', info.cache || 'Ready'));
                            realtimeParts.push(renderOverlayLine('Action', info.action || '-'));
                            realtimeParts.push(renderOverlayLine('Mask', info.mask || 'clear'));
                            if (info.status) realtimeParts.push(renderOverlayLine('Status', info.status));
                        }
                        const staticParts = [
                            overlayMetric('Canvas', `${STUDIO_WIDTH}x${STUDIO_HEIGHT}`),
                            overlayMetric('View', `${scale}%`),
                            overlayMetric('Browser', `${browserZoomPercent}%`),
                            overlayMetric('Cap', `${frameCap}`),
                            overlayMetric('DPR', dpr),
                            overlayMetric('SVG', info?.svgCount ?? 0),
                            overlayMetric('Images', info?.imageCount ?? 0),
                            overlayMetric('Videos', info?.videoCount ?? 0),
                            overlayMetric('Preset', getSelectedPresetOverlayName()),
                            overlayMetric('Runtime', 'Local')
                        ];
                        viewControls.overlay.innerHTML = renderOverlayMarkup(realtimeParts, staticParts);
                        viewControls.overlay.style.opacity = String(overlayOpacity / 100);
                        viewControls.overlay.classList.remove('hidden-ui-node');
                    }
                }
                viewControls.scaleButtons.forEach(button => {
                    button.classList.toggle('active', parseInt(button.dataset.viewScale, 10) === scale && viewScaleMode !== 'fit');
                });
                viewControls.fit?.classList.toggle('active', viewScaleMode === 'fit');
            }

            let overlayRuntimeRefreshElapsed = 0;
            let overlayFrameSampleElapsed = 0;
            let overlayFrameSampleCount = 0;
            let overlayWorstFrameMs = 0;
            let overlayFrameStats = { fps: '-', worst: '-' };
            const OVERLAY_RUNTIME_REFRESH_INTERVAL = 0.5;

            function updateOverlayRuntimeTick(deltaTime) {
                if (!viewControls.overlay || readOverlayOpacity() <= 0) {
                    overlayRuntimeRefreshElapsed = 0;
                    overlayFrameSampleElapsed = 0;
                    overlayFrameSampleCount = 0;
                    overlayWorstFrameMs = 0;
                    return;
                }
                const frameMs = Math.max(0, deltaTime * 1000);
                overlayFrameSampleElapsed += deltaTime;
                overlayFrameSampleCount += 1;
                overlayWorstFrameMs = Math.max(overlayWorstFrameMs, frameMs);
                overlayRuntimeRefreshElapsed += deltaTime;
                if (overlayRuntimeRefreshElapsed < OVERLAY_RUNTIME_REFRESH_INTERVAL) return;
                overlayFrameStats = {
                    fps: overlayFrameSampleElapsed > 0 ? Math.round(overlayFrameSampleCount / overlayFrameSampleElapsed) : '-',
                    worst: overlayFrameSampleCount ? `${Math.round(overlayWorstFrameMs)}ms` : '-'
                };
                overlayFrameSampleElapsed = 0;
                overlayFrameSampleCount = 0;
                overlayWorstFrameMs = 0;
                overlayRuntimeRefreshElapsed = 0;
                updateViewStatus();
            }

            function normalizeHexColor(value, fallback = '#ffffff') {
                const color = String(value || '').trim();
                return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
            }

            function hexToRgb(value) {
                const color = normalizeHexColor(value);
                return {
                    r: parseInt(color.slice(1, 3), 16),
                    g: parseInt(color.slice(3, 5), 16),
                    b: parseInt(color.slice(5, 7), 16)
                };
            }

            function interpolateRgbColor(start, end, amount) {
                const t = clamp(amount, 0, 1);
                const r = Math.round(start.r + (end.r - start.r) * t);
                const g = Math.round(start.g + (end.g - start.g) * t);
                const b = Math.round(start.b + (end.b - start.b) * t);
                return `rgb(${r},${g},${b})`;
            }

            function interpolateMidRgbColor(start, mid, end, amount, midpoint = 0.5) {
                const t = clamp(amount, 0, 1);
                const split = clamp(midpoint, 0.05, 0.95);
                if (t <= split) return interpolateRgbColor(start, mid, smoothstep(0, 1, t / split));
                return interpolateRgbColor(mid, end, smoothstep(0, 1, (t - split) / (1 - split)));
            }

            function getAppBackdropState() {
                return {
                    mode: appBgControls.mode?.value === 'solid' ? 'solid' : 'gradient',
                    color: normalizeHexColor(appBgControls.picker?.value, '#02006c')
                };
            }

            function buildAppBackdropBackground(mode, color) {
                if (mode === 'solid') return color;
                return `radial-gradient(circle at 48% 45%, ${color} 0%, #00001e 52%, #00000a 100%)`;
            }

            function updateAppBackdrop() {
                const state = getAppBackdropState();
                const background = buildAppBackdropBackground(state.mode, state.color);
                document.documentElement.style.background = background;
                document.body.style.background = background;
            }

            function applyAppBackdropState(state = {}) {
                const mode = state.mode === 'solid' ? 'solid' : 'gradient';
                setControlValue(appBgControls.mode, mode);
                setColorPairValue(appBgControls.picker, appBgControls.hex, normalizeHexColor(state.color, '#02006c'));
                updateAppBackdrop();
            }

            function smoothstep(edge0, edge1, value) {
                const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
                return t * t * (3 - 2 * t);
            }

            function pseudoRandom(seed) {
                const x = Math.sin(seed * 12.9898) * 43758.5453;
                return x - Math.floor(x);
            }

            function updateRangeIndicator(slider) {
                const valueIdAliases = {};
                const indicator = document.getElementById(valueIdAliases[slider.id] || `val-${slider.id}`);
                if (!indicator) return;
                const suffix = slider.id.includes('opacity') || slider.id === 'slide-scale' || slider.id === 'image-slide-scale' || slider.id === 'view-scale' ? '%' : '';
                indicator.textContent = getControlValue(slider) + suffix;
                indicator.dataset.prevValue = indicator.textContent;
            }

            function snapRangeToMarkedValue(slider) {
                if (!slider?.dataset || slider.dataset.snapValue === undefined) return;
                const snapValue = parseFloat(slider.dataset.snapValue);
                const current = parseFloat(slider.value);
                const min = parseFloat(slider.min);
                const max = parseFloat(slider.max);
                const step = parseFloat(slider.step) || 1;
                if (![snapValue, current, min, max].every(Number.isFinite)) return;
                const threshold = Math.max(step * 1.5, Math.abs(max - min) * 0.012);
                if (Math.abs(current - snapValue) <= threshold) {
                    slider.value = String(snapControlNumber(slider, snapValue));
                }
            }

            function bindAllRangeDisplays() {
                document.querySelectorAll('input[type="range"]').forEach(slider => {
                    slider.addEventListener('input', () => {
                        snapRangeToMarkedValue(slider);
                        updateRangeIndicator(slider);
                    });
                    updateRangeIndicator(slider);
                });
            }

            const SLIDER_TOOLTIPS = {
                'slide-scale': 'SVG target size on the canvas.',
                'slide-offset-x': 'Move SVG targets left or right.',
                'slide-offset-y': 'Move SVG targets up or down.',
                'image-slide-scale': 'Image slide target size on the canvas.',
                'image-slide-offset-x': 'Move image slide targets left or right.',
                'image-slide-offset-y': 'Move image slide targets up or down.',
                'view-scale': 'Preview zoom only. It does not resize the canvas, grid, image, or SVG coordinates.',
                'stage-width': 'Canvas width in shared stage coordinates.',
                'stage-height': 'Canvas height in shared stage coordinates.',
                'mask-expansion': 'Expand the painted SVG mask outward.',
                'mask-scale-time': 'Seconds used for masked dots to shrink out or grow back during slide changes.',
                'image-mask-expansion': 'Expand the image slide mask outward from the rectangle edges.',
                'image-mask-scale-time': 'Seconds used for image-slide masked dots to shrink out or grow back.',
                'slide-auto-duration': 'Seconds between automatic slide advances.',
                'transition-current-time': 'Length of the current-slide phase.',
                'transition-current-flicker-start': 'When current-slide flicker starts inside the current phase. The max follows Current Time.',
                'transition-next-time': 'Length of the next-slide phase.',
                'transition-next-flicker-start': 'When next-slide flicker starts inside the next phase. The max follows Next Time.',
                'transition-return-grid-time': 'Seconds used to fade from the revealed slide target back to grid homes.',
                'transition-flicker-bias': 'Favor old-out or new-in.',
                'transition-flicker-speed': 'Visual flicker pulses per second.',
                'transition-flicker-balance': 'Visible vs hidden ratio.',
                'transition-flicker-wildness': 'Randomness in flicker timing.',
                'mouse-interaction-enabled': 'Enable pointer forces on the canvas.',
                'mouse-repel-strength': 'Force used by right hold.',
                'mouse-svg-target-count': 'How many SVG target slots move to the mouse while left is held.',
                'mouse-interaction-radius': 'Right-hold repel radius in canvas pixels.',
                'mouse-interaction-softness': 'Higher values make pointer falloff softer near the edge.',
                'mouse-scroll-step': 'Amount changed by mouse wheel for the active mouse action.',
                'image-scale': 'Image size behind the dots.',
                'image-offset-x': 'Move image left or right.',
                'image-offset-y': 'Move image up or down.',
                'bg-cycle-speed': 'Canvas color cycle speed.',
                'view-frame-rate': 'Animation frame cap.',
                'blink-visibility-on': 'Visible time per blink cycle.',
                'blink-visibility-off': 'Hidden time per blink cycle.',
                'blink-visibility-randomness': 'Timing variation per dot.',
                'blink-visibility-probability': 'Dots included in blink.',
                'blink-grid-proximity': 'Distance from grid where blink begins. 0 keeps blink active through motion.'
            };

            const MODULE_TOOLTIPS = {
                'drawer-trigger-dot-matrix': 'Per-layer target, colors, midpoint, and motion settings.',
                'drawer-trigger-upload-media': 'Load vector and raster slide sources, plus shared grid masking.',
                'drawer-trigger-timing': 'Current/next phase timing, flicker start delays, and auto duration.',
                'drawer-trigger-mouse-interaction': 'Left mouse targets SVG dots; right mouse repels dots.',
                'drawer-trigger-advanced-options': 'Grid layout, flicker visuals, and shared blink behavior.',
                'drawer-trigger-grid': 'Dot count, spacing, and layer offsets.',
                'drawer-trigger-masks': 'Vector and raster grid-mask expansion and timing.',
                'drawer-trigger-blink-mode': 'Shared dot visibility across all grids.',
                'drawer-trigger-slides': 'Vector SVG artwork used as dot targets.',
                'drawer-trigger-image-slides': 'Raster images and videos used as rectangular dot targets.',
                'drawer-trigger-special-overlays': 'Top-layer SVG overlays assigned to individual slide numbers.',
                'drawer-trigger-slide-control': 'Direct slide navigation and current slide inspection.',
                'drawer-trigger-flicker': 'Visual flicker rhythm, balance, wildness, and old/new bias.',
                'drawer-trigger-background': 'Canvas color, canvas size, app backdrop, and optional image layer.',
                'drawer-trigger-help': 'Manual for controls, shortcuts, and workflow.',
                'drawer-trigger-presets': 'Save and restore layer stacks, random limits, and layer locks.',
                'drawer-trigger-save-settings': 'Save and restore non-layer settings while keeping layer values untouched.',
                'drawer-trigger-view-options': 'Preview scale, frame cap, fullscreen, and info overlay.'
            };

            const SECTION_TOOLTIPS = {
                'SVG Mask': 'Hide grid homes inside or near painted SVG artwork.',
                'Image Mask': 'Hide grid homes inside the active media rectangle.',
                'Media Mask': 'Hide grid homes inside the active media rectangle.',
                'Transition Path': 'Dot movement phases for the current slide and next slide.',
                'Flicker Shape': 'Binary on/off behavior during slide swaps.',
                'Canvas Color': 'Static or cycling canvas palette.',
                'Background Color': 'Backdrop outside the canvas.',
                'View Scale': 'Preview zoom and frame pacing.'
            };

            const CONTROL_TOOLTIPS = {
                'file-slides': 'Load SVG files as slide artwork.',
                'label-slides': 'Load SVG files as slide artwork.',
                'file-image-slides': 'Load PNG, JPG, or supported video files as media slide targets.',
                'label-image-slides': 'Load PNG, JPG, or supported video files as media slide targets.',
                'file-special-overlays': 'Load special SVG overlays that flicker above every grid and slide layer.',
                'label-special-overlays': 'Load special SVG overlays that flicker above every grid and slide layer.',
                'file-image': 'Load an image behind the dots.',
                'label-image': 'Load an image behind the dots.',
                'image-visibility-toggle': 'Show or hide the background image without removing it.',
                'clear-slides': 'Remove all loaded SVG slides from the current scene.',
                'clear-image-slides': 'Remove all loaded media slides from the current scene.',
                'clear-image': 'Remove the current background image from the scene.',
                'media-slide-duration': 'Set hold time for image sequences. Video sequences use each video duration.',
                'bg-mode': 'Static, 2-color, or 3-color canvas color.',
                'app-bg-mode': 'Backdrop style outside the canvas.',
                'app-bg-picker': 'Backdrop color outside the canvas.',
                'app-bg-hex': 'Backdrop color outside the canvas.',
                'blink-enabled': 'Turn shared grid blink on or off.',
                'view-overlay-opacity': 'Set info overlay opacity. 0% hides it and stops overlay runtime refresh.',
                'media-transition-mode': 'Choose how transitions behave when the current slide is media.',
                'panel-toggle': 'Open both control panels.',
                'minimize-btn': 'Hide both control panels.',
                'header-prev-btn': 'Previous slide.',
                'header-hold-btn': 'Hold to attract dots to the current slide.',
                'header-next-btn': 'Next slide.',
                'header-auto-btn': 'Automatically advance using the current slide source duration.',
                'matrix-open-all': 'Expand all grid-layer drawers.',
                'matrix-collapse-all': 'Collapse all grid-layer drawers.',
                'matrix-randomize-all': 'Randomize only unlocked values inside the grid-layer stack.',
                'matrix-copy-above': 'Copy the selected grid layer above its current position.',
                'matrix-copy-below': 'Copy the selected grid layer below its current position.',
                'svg-media-stack-up': 'Move SVG/media above the next grid layer.',
                'svg-media-stack-down': 'Move SVG/media below the next grid layer.',
                'grid-apply-all': 'Apply the selected grid layout to every active layer.',
                'preset-apply-btn': 'Apply the selected layer preset without changing timing, masks, blink, mouse, media, or background.',
                'preset-add-btn': 'Save the current layer stack as a new preset.',
                'preset-delete-btn': 'Delete the selected preset unless it is the last one.',
                'preset-export-btn': 'Export the current preset list to JSON.',
                'preset-import-btn': 'Import a saved TEN26 preset JSON file.',
                'preset-import-file': 'Import a saved TEN26 preset JSON file.',
                'settings-apply-btn': 'Apply the selected settings without changing grid layer values.',
                'settings-add-btn': 'Save timing, media, masks, background, mouse, blink, stage, and view settings.',
                'settings-delete-btn': 'Delete the selected saved settings.',
                'settings-export-btn': 'Export the saved settings list to JSON.',
                'settings-import-btn': 'Import a saved TEN26 settings JSON file.',
                'settings-import-file': 'Import a saved TEN26 settings JSON file.',
                'view-fit-btn': 'Fit the full canvas inside the current browser window.',
                'fullscreen-enter-btn': 'Enter browser fullscreen mode.',
                'fullscreen-exit-btn': 'Exit browser fullscreen mode.',
                'help-tooltips-enabled': 'Show native browser tooltips.'
            };

            ALL_DOT_LAYER_KEYS.forEach(layerKey => {
                const label = DOT_LAYER_META[layerKey].label;
                Object.entries({
                    cols: 'Number of columns in this grid layer.',
                    rows: 'Number of rows in this grid layer.',
                    spacing: 'Distance between dots in this grid layer.',
                    'offset-x': 'Moves this grid layer left or right.',
                    'offset-y': 'Moves this grid layer up or down.'
                }).forEach(([suffix, tip]) => {
                    SLIDER_TOOLTIPS[`grid-${layerKey}-${suffix}`] = `${label}: ${tip}`;
                });
                Object.entries({
                    pull: 'Strength pulling dots into SVG targets.',
                    'svg-radius': 'Distance where SVG targets affect dots.',
                    'return-pull': 'Strength returning dots to grid.',
                    'grid-radius': 'Distance where grid homes affect dots.',
                    'speed-limit': 'Maximum dot speed.',
                    mass: 'Dot weight and response lag.',
                    friction: 'Motion damping.',
                    elasticity: 'Stick on the low end; fly by on the high end.',
                    orbit: 'Sideways swirl around targets.',
                    shuffle: 'Random target reassignment.',
                    variation: 'Per-dot motion variation.',
                    'grid-size': 'Size at grid rest.',
                    'mid-size': 'Size mid-transition.',
                    'target-size': 'Size on SVG targets.',
                    'size-midpoint': 'Where the mid color and mid size sit between grid and target.',
                    'speed-size': 'Size added by speed.'
                }).forEach(([suffix, tip]) => {
                    SLIDER_TOOLTIPS[`dot-${layerKey}-${suffix}`] = `${label}: ${tip}`;
                });
                CONTROL_TOOLTIPS[`dot-${layerKey}-target-type`] = `${label}: SVG points this layer follows.`;
                CONTROL_TOOLTIPS[`motion-trigger-${layerKey}`] = `${label} layer motion physics.`;
                CONTROL_TOOLTIPS[`motion-toggle-layer-${layerKey}`] = `Show or hide the ${label} grid layer.`;
                CONTROL_TOOLTIPS[`motion-randomize-${layerKey}`] = `${label}: randomize unlocked layer-stack values.`;
                CONTROL_TOOLTIPS[`motion-randomize-text-${layerKey}`] = `${label}: randomize unlocked layer-stack values.`;
                CONTROL_TOOLTIPS[`motion-lock-${layerKey}`] = `${label}: lock all layer-stack values for randomize.`;
                CONTROL_TOOLTIPS[`motion-unlock-${layerKey}`] = `${label}: unlock all layer-stack values.`;
                CONTROL_TOOLTIPS[`motion-reset-${layerKey}`] = `${label}: reset layer randomization limits.`;
                CONTROL_TOOLTIPS[`motion-delete-${layerKey}`] = `${label}: delete this layer.`;
            });

            function setNativeTooltip(node, tip) {
                if (!node || !tip) return;
                node.dataset.tooltipText = tip;
                if (tooltipsEnabled) node.title = tip;
                else node.removeAttribute('title');
            }

            function clearNativeTooltips() {
                document.querySelectorAll('[title], [data-tooltip-text]').forEach(node => {
                    const existing = node.getAttribute('title');
                    if (existing && !node.dataset.tooltipText) node.dataset.tooltipText = existing;
                    node.removeAttribute('title');
                });
            }

            function syncTooltipPreference() {
                tooltipsEnabled = helpControls.tooltipsEnabled?.checked !== false;
                document.body?.classList.toggle('tooltips-disabled', !tooltipsEnabled);
                if (!tooltipsEnabled) {
                    clearNativeTooltips();
                    return;
                }
                applySliderTooltips();
                applyNativeTooltips();
            }

            function applySliderTooltips() {
                document.querySelectorAll('input[type="range"]').forEach(slider => {
                    const label = slider.closest('.slider-group')?.querySelector('span')?.textContent?.trim() || slider.id;
                    const tip = SLIDER_TOOLTIPS[slider.id] || `Adjusts ${label.toLowerCase()}.`;
                    const group = slider.closest('.slider-group');
                    if (!group) return;
                    delete group.dataset.tooltip;
                    setNativeTooltip(group, tip);
                    setNativeTooltip(slider, tip);
                    const labelNode = group.querySelector('span');
                    if (labelNode) setNativeTooltip(labelNode, tip);
                });
            }

            function readableControlName(node) {
                if (!node) return 'control';
                const text = node.getAttribute('aria-label')
                    || node.dataset.tooltipText
                    || node.title
                    || node.textContent?.trim()
                    || node.closest('.compact-color')?.querySelector('.compact-color-label')?.textContent?.trim()
                    || node.closest('.sub-toggle-container')?.querySelector('span')?.textContent?.trim()
                    || node.closest('.layer-control-row')?.querySelector('span')?.textContent?.trim()
                    || node.id
                    || 'control';
                return text.replace(/\s+/g, ' ').trim();
            }

            function applyNativeTooltips() {
                document.querySelectorAll('button, select, input, .file-upload-btn, .checkbox-switch, .color-picker-wrapper, .section-title').forEach(node => {
                    const directTip = MODULE_TOOLTIPS[node.id] || CONTROL_TOOLTIPS[node.id];
                    if (directTip) {
                        setNativeTooltip(node, directTip);
                        return;
                    }
                    if (node.matches?.('[data-view-scale]')) {
                        setNativeTooltip(node, `Set preview scale to ${node.dataset.viewScale}%.`);
                        return;
                    }
                    if (node.classList?.contains('section-title')) {
                        setNativeTooltip(node, SECTION_TOOLTIPS[readableControlName(node)] || readableControlName(node));
                        return;
                    }
                    if (node.classList?.contains('drawer-trigger')) {
                        setNativeTooltip(node, readableControlName(node));
                        return;
                    }
                    if (node.classList?.contains('motion-layer-trigger')) {
                        setNativeTooltip(node, readableControlName(node));
                        return;
                    }
                    const existingTip = node.dataset.tooltipText || node.getAttribute('title');
                    if (existingTip) {
                        setNativeTooltip(node, existingTip);
                        return;
                    }
                    if (node.matches?.('select')) {
                        setNativeTooltip(node, 'Select how this visual system behaves.');
                        return;
                    }
                    if (node.matches?.('input[type="file"]')) {
                        setNativeTooltip(node, CONTROL_TOOLTIPS[node.closest('.file-upload-wrapper')?.querySelector('.file-upload-btn')?.id] || 'Load source artwork.');
                        return;
                    }
                    if (node.classList?.contains('checkbox-switch')) {
                        const linkedInput = node.previousElementSibling;
                        setNativeTooltip(node, CONTROL_TOOLTIPS[linkedInput?.id] || 'Enable or disable this visual effect.');
                        return;
                    }
                    if (node.matches?.('input[type="color"], input[type="text"]')) {
                        setNativeTooltip(node, 'Color value used by the visual.');
                        return;
                    }
                    if (node.matches?.('input[type="checkbox"]')) {
                        setNativeTooltip(node, 'Enable or disable this visual effect.');
                        return;
                    }
                    setNativeTooltip(node, readableControlName(node));
                });
            }

            function bindColorPair(picker, hex, onChange = () => {}) {
                if (!picker || !hex) return;
                picker.addEventListener('input', () => {
                    hex.value = picker.value;
                    syncDotColorSwatchState(hex);
                    updateSizeSliderThumbColorsForColorControl(hex);
                    onChange();
                });
                hex.addEventListener('input', () => {
                    if (/^#[0-9a-f]{6}$/i.test(hex.value)) {
                        picker.value = hex.value.toLowerCase();
                        hex.value = picker.value;
                        syncDotColorSwatchState(hex);
                        updateSizeSliderThumbColorsForColorControl(hex);
                        onChange();
                    }
                });
            }

            function isDotColorHexControl(control) {
                return !!control?.id && /^dot-.+-color-hex$/.test(control.id);
            }

            function getDotColorPickerForHex(hex) {
                if (!isDotColorHexControl(hex)) return null;
                return document.getElementById(hex.id.replace(/-hex$/, ''));
            }

            function syncDotColorSwatchState(control) {
                const hex = isDotColorHexControl(control)
                    ? control
                    : (control?.id ? document.getElementById(`${control.id}-hex`) : null);
                if (!isDotColorHexControl(hex)) return;
                const color = normalizeHexColor(hex.value, '').toLowerCase();
                const wrap = hex.closest('.compact-color');
                wrap?.querySelectorAll('.dot-color-swatch').forEach(button => {
                    const active = button.dataset.color === color;
                    button.classList.toggle('active', active);
                    button.setAttribute('aria-pressed', String(active));
                });
            }

            function updateLayerSizeSliderThumbColors(layerKey) {
                const controls = motionLayerControls.layers[layerKey];
                if (!controls) return;
                const setThumbColor = (control, color) => {
                    const group = control?.closest('.slider-group');
                    if (!group) return;
                    group.style.setProperty('--slider-thumb-color', normalizeHexColor(color, '#ffffff'));
                };
                setThumbColor(controls.gridSize, controls.gridColorHex?.value || controls.gridColor?.value || '#ffffff');
                setThumbColor(controls.midSize, controls.midColorHex?.value || controls.midColor?.value || '#ffffff');
                setThumbColor(controls.targetSize, controls.targetColorHex?.value || controls.targetColor?.value || '#ffffff');
                setThumbColor(controls.speedSize, '#ffffff');
                setThumbColor(controls.speedLimit, '#ffffff');
            }

            function updateSizeSliderThumbColorsForColorControl(control) {
                const id = control?.id || '';
                const match = id.match(/^dot-(.+)-(grid|mid|target)-color(?:-hex)?$/);
                if (match) updateLayerSizeSliderThumbColors(match[1]);
            }

            function installDotColorPaletteUi() {
                document.querySelectorAll('#motion-matrix-panel .compact-color input[type="text"]').forEach(hex => {
                    if (!isDotColorHexControl(hex)) return;
                    const wrap = hex.closest('.compact-color');
                    if (!wrap || wrap.querySelector('.dot-color-swatch-row')) {
                        syncDotColorSwatchState(hex);
                        return;
                    }
                    const picker = getDotColorPickerForHex(hex);
                    wrap.classList.add('dot-palette-control');
                    hex.readOnly = true;
                    hex.setAttribute('aria-readonly', 'true');
                    const swatches = document.createElement('div');
                    swatches.className = 'dot-color-swatch-row';
                    TEN26_DOT_RANDOM_COLORS.forEach(color => {
                        const button = document.createElement('button');
                        button.type = 'button';
                        button.className = 'dot-color-swatch';
                        button.dataset.color = color;
                        button.style.backgroundColor = color;
                        const colorTitle = `Set dot color ${color}`;
                        setNativeTooltip(button, colorTitle);
                        button.setAttribute('aria-label', colorTitle);
                        button.addEventListener('click', event => {
                            event.preventDefault();
                            event.stopPropagation();
                            setColorPairValue(picker, hex, color);
                            if (picker) picker.dispatchEvent(new Event('input', { bubbles: true }));
                            else hex.dispatchEvent(new Event('input', { bubbles: true }));
                        });
                        swatches.appendChild(button);
                    });
                    const label = wrap.querySelector('.compact-color-label');
                    if (label) label.insertAdjacentElement('afterend', swatches);
                    else wrap.prepend(swatches);
                    syncDotColorSwatchState(hex);
                });
                ALL_DOT_LAYER_KEYS.forEach(updateLayerSizeSliderThumbColors);
            }

            function enableSliderValueEditing() {
                [controlPanel, gridControlPanel, motionMatrixPanel].filter(Boolean).forEach(root => {
                    root.addEventListener('dblclick', event => {
                        const indicator = event.target.closest('.val-indicator');
                        if (!indicator) return;
                        indicator.contentEditable = 'true';
                        indicator.focus();
                        const range = document.createRange();
                        range.selectNodeContents(indicator);
                        const selection = window.getSelection();
                        selection.removeAllRanges();
                        selection.addRange(range);
                    });

                    root.addEventListener('keydown', event => {
                        const indicator = event.target.closest('.val-indicator');
                        if (!indicator || !indicator.isContentEditable) return;
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            indicator.blur();
                        }
                        if (event.key === 'Escape') {
                            indicator.textContent = indicator.dataset.prevValue || '';
                            indicator.blur();
                        }
                    });

                    root.addEventListener('focusout', event => {
                        const indicator = event.target.closest('.val-indicator');
                        if (!indicator || !indicator.isContentEditable) return;
                        const slider = indicator.closest('.slider-group')?.querySelector('input[type="range"]');
                        if (!slider) {
                            indicator.contentEditable = 'false';
                            return;
                        }

                        const raw = indicator.textContent.replace(/[^0-9.\-]/g, '').trim();
                        let value = parseFloat(raw);
                        if (Number.isNaN(value)) {
                            indicator.textContent = indicator.dataset.prevValue || getControlValue(slider);
                        } else {
                            value = snapControlNumber(slider, value);
                            setControlValue(slider, value);
                            slider.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                        indicator.contentEditable = 'false';
                        indicator.dataset.prevValue = indicator.textContent;
                    });
                });
            }

            function resizeCanvas(canvas, ctx) {
                if (canvas.width !== STUDIO_WIDTH || canvas.height !== STUDIO_HEIGHT) {
                    canvas.width = STUDIO_WIDTH;
                    canvas.height = STUDIO_HEIGHT;
                    canvas.style.width = `${STUDIO_WIDTH}px`;
                    canvas.style.height = `${STUDIO_HEIGHT}px`;
                }
                ctx.clearRect(0, 0, STUDIO_WIDTH, STUDIO_HEIGHT);
            }

            // Every dot layer starts with the same data shape so UI, presets, and runtime configs stay aligned.
            function createDefaultLayerState(layerKey, overrides = {}) {
                const meta = DOT_LAYER_META[layerKey] || DOT_LAYER_META[DEFAULT_LAYER_KEY];
                return {
                    name: meta.label,
                    hidden: false,
                    cols: '25',
                    rows: '7',
                    spacing: PRESET_GRID_SPACING,
                    offsetX: '0',
                    offsetY: PRESET_GRID_OFFSET_Y,
                    targetType: 'fill',
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
                    gridSize: '2.5',
                    midSize: '2.5',
                    targetSize: '2.5',
                    sizeMidpoint: '0.5',
                    speedSize: '0',
                    visibilityEnabled: true,
                    visibilityOn: '7',
                    visibilityOff: '3',
                    visibilityRandomness: '100',
                    visibilityProbability: '70',
                    visibilityGridProximity: '0',
                    gridColor: meta.defaultColor,
                    midColor: meta.defaultColor,
                    targetColor: meta.defaultColor,
                    ...overrides
                };
            }

            let activeLayerKey = DEFAULT_LAYER_KEY;
            let dotLayerStates = ALL_DOT_LAYER_KEYS.reduce((acc, layerKey) => {
                acc[layerKey] = createDefaultLayerState(layerKey);
                return acc;
            }, {});
            let layerRuntimeConfigCache = {};

            function getLayerLabel(layerKey) {
                return dotLayerStates[layerKey]?.name || DOT_LAYER_META[layerKey]?.label || layerKey;
            }

            function getUnusedLayerKey() {
                return ALL_DOT_LAYER_KEYS.find(layerKey => !DOT_LAYER_KEYS.includes(layerKey)) || '';
            }

            function clampSvgMediaStackIndex(value = svgMediaStackIndex) {
                const numeric = Number.isFinite(parseFloat(value)) ? Math.round(parseFloat(value)) : DOT_LAYER_KEYS.length;
                return Math.max(0, Math.min(DOT_LAYER_KEYS.length, numeric));
            }

            function getVisualStackItems() {
                svgMediaStackIndex = clampSvgMediaStackIndex();
                const items = [];
                DOT_LAYER_KEYS.forEach((layerKey, index) => {
                    if (index === svgMediaStackIndex) items.push({ type: 'media' });
                    items.push({ type: 'layer', layerKey });
                });
                if (svgMediaStackIndex >= DOT_LAYER_KEYS.length) items.push({ type: 'media' });
                return items;
            }

            function applyVisualStackOrder() {
                const items = getVisualStackItems();
                const stackBaseZ = 20;
                let mediaZ = stackBaseZ;
                const activeLayerSet = new Set(DOT_LAYER_KEYS);
                ALL_DOT_LAYER_KEYS.forEach(layerKey => {
                    const canvas = dotLayerCanvases.get(layerKey);
                    if (!canvas) return;
                    canvas.style.visibility = activeLayerSet.has(layerKey) && !dotLayerStates[layerKey]?.hidden ? 'visible' : 'hidden';
                    canvas.style.mixBlendMode = 'normal';
                });
                items.forEach((item, index) => {
                    const zIndex = stackBaseZ + items.length - index;
                    if (item.type === 'media') {
                        mediaZ = zIndex;
                        return;
                    }
                    const canvas = dotLayerCanvases.get(item.layerKey);
                    if (canvas) canvas.style.zIndex = String(zIndex);
                });
                if (slideLayer) slideLayer.style.zIndex = String(mediaZ);
                if (geometryCanvas) geometryCanvas.style.zIndex = String(mediaZ);
                if (staticGridCanvas) staticGridCanvas.style.zIndex = String(Math.max(2, stackBaseZ - 2));
            }

            function moveSvgMediaStack(delta) {
                const current = clampSvgMediaStackIndex();
                const next = clampSvgMediaStackIndex(current + delta);
                if (next === current) return;
                svgMediaStackIndex = next;
                syncLayerRegistryUi();
                updateViewStatus();
                if (typeof showUiToast === 'function') showUiToast('SVG/media stack order updated.');
            }

            function syncLayerRegistryUi() {
                const visualItems = getVisualStackItems();
                const visualOrderByLayer = new Map();
                visualItems.forEach((item, index) => {
                    if (item.type === 'layer') visualOrderByLayer.set(item.layerKey, index + 1);
                    else if (svgMediaStackControls.drawer) {
                        svgMediaStackControls.drawer.hidden = false;
                        svgMediaStackControls.drawer.style.order = String(index + 1);
                    }
                });
                ALL_DOT_LAYER_KEYS.forEach(layerKey => {
                    const active = DOT_LAYER_KEYS.includes(layerKey);
                    const order = active ? (visualOrderByLayer.get(layerKey) || 99) : 99;
                    const label = getLayerLabel(layerKey);
                    const motionControls = motionLayerControls.layers[layerKey];
                    const gridLayerControls = gridControls.layers[layerKey];
                    if (motionControls?.drawer) {
                        motionControls.drawer.hidden = !active;
                        motionControls.drawer.style.order = String(order);
                    }
                    const triggerLabel = motionControls?.trigger?.querySelector('.motion-layer-name, span');
                    if (triggerLabel) triggerLabel.textContent = label;
                    if (motionControls?.trigger) setNativeTooltip(motionControls.trigger, `${label} motion physics.`);
                    if (gridLayerControls?.content) gridLayerControls.content.hidden = !active;
                });
                const canAdd = DOT_LAYER_KEYS.length < ALL_DOT_LAYER_KEYS.length;
                DOT_LAYER_KEYS.forEach((layerKey, index) => {
                    const controls = motionLayerControls.layers[layerKey];
                    setButtonActionable(controls?.moveUp, index > 0);
                    setButtonActionable(controls?.moveDown, index < DOT_LAYER_KEYS.length - 1);
                    setButtonActionable(controls?.deleteLayer, DOT_LAYER_KEYS.length > 1);
                });
                setButtonActionable(motionLayerControls.copyAbove, canAdd);
                setButtonActionable(motionLayerControls.copyBelow, canAdd);
                setButtonActionable(svgMediaStackControls.moveUp, svgMediaStackIndex > 0);
                setButtonActionable(svgMediaStackControls.moveDown, svgMediaStackIndex < DOT_LAYER_KEYS.length);
                applyVisualStackOrder();
                if (motionLayerControls.status) {
                    motionLayerControls.status.textContent = `${DOT_LAYER_KEYS.length} grid layer${DOT_LAYER_KEYS.length === 1 ? '' : 's'} active. Selected: ${getLayerLabel(activeLayerKey)}.`;
                }
            }

            function createLayerName() {
                let index = DOT_LAYER_KEYS.length + 1;
                const names = new Set(DOT_LAYER_KEYS.map(layerKey => dotLayerStates[layerKey]?.name).filter(Boolean));
                while (names.has(`Grid ${index}`)) index += 1;
                return `Grid ${index}`;
            }

            function createLayerCopyName(sourceName) {
                const baseName = String(sourceName || createLayerName()).trim() || createLayerName();
                const baseCopyName = `${baseName} Copy`;
                const names = new Set(DOT_LAYER_KEYS.map(layerKey => dotLayerStates[layerKey]?.name).filter(Boolean));
                if (!names.has(baseCopyName)) return baseCopyName;
                let index = 2;
                while (names.has(`${baseCopyName} ${index}`)) index += 1;
                return `${baseCopyName} ${index}`;
            }

            function addLayerRelative(position = 'below', sourceLayerKey = activeLayerKey) {
                const layerKey = getUnusedLayerKey();
                if (!layerKey) {
                    if (typeof showUiToast === 'function') showUiToast('Grid layer limit reached for this build.', 'warning');
                    return;
                }
                if (!DOT_LAYER_KEYS.includes(sourceLayerKey)) sourceLayerKey = activeLayerKey;
                persistGridLayerControls(sourceLayerKey, { rebuildGrid: false, retarget: false });
                persistMotionLayerControls(sourceLayerKey, { retarget: false });
                const sourceIndex = Math.max(0, DOT_LAYER_KEYS.indexOf(sourceLayerKey));
                const insertIndex = position === 'above' ? sourceIndex : sourceIndex + 1;
                const sourceLabel = getLayerLabel(sourceLayerKey);
                const sourceState = dotLayerStates[sourceLayerKey] || createDefaultLayerState(sourceLayerKey);
                const copiedState = {
                    ...sourceState,
                    name: createLayerCopyName(sourceState.name || sourceLabel)
                };
                dotLayerStates[layerKey] = createDefaultLayerState(layerKey, {
                    ...copiedState
                });
                dotLayerStates[layerKey] = coerceLayerStateForV12(dotLayerStates[layerKey], copiedState);
                copyRandomRangeStateForLayer(sourceLayerKey, layerKey);
                invalidateLayerRuntimeConfig(layerKey);
                if (insertIndex <= svgMediaStackIndex) svgMediaStackIndex += 1;
                DOT_LAYER_KEYS.splice(insertIndex, 0, layerKey);
                activeLayerKey = layerKey;
                dotGroups[layerKey]?.rebuildGrid();
                dotGroups[layerKey]?.returnToGrid();
                clearMaskCache();
                loadActiveLayerIntoUi();
                syncLayerRegistryUi();
                refreshAttractorTargetsIfNeeded();
                if (typeof showUiToast === 'function') showUiToast(`Created ${getLayerLabel(layerKey)} from ${sourceLabel}.`);
            }

            function renameActiveLayer() {
                const currentName = getLayerLabel(activeLayerKey);
                const nextName = prompt('Layer name:', currentName);
                if (!nextName) return;
                dotLayerStates[activeLayerKey] = {
                    ...dotLayerStates[activeLayerKey],
                    name: nextName.trim() || currentName
                };
                syncLayerRegistryUi();
                updateLayerSelectionUi();
            }

            function deleteActiveLayer(layerKey = activeLayerKey) {
                if (!DOT_LAYER_KEYS.includes(layerKey) || DOT_LAYER_KEYS.length <= 1) return false;
                const removedKey = layerKey;
                const removedLabel = getLayerLabel(removedKey);
                if (!confirm(`Delete ${removedLabel}?`)) return false;
                const removedIndex = DOT_LAYER_KEYS.indexOf(removedKey);
                DOT_LAYER_KEYS = DOT_LAYER_KEYS.filter(layerKey => layerKey !== removedKey);
                if (removedIndex < svgMediaStackIndex) svgMediaStackIndex -= 1;
                svgMediaStackIndex = clampSvgMediaStackIndex();
                if (activeLayerKey === removedKey) {
                    activeLayerKey = DOT_LAYER_KEYS[Math.min(removedIndex, DOT_LAYER_KEYS.length - 1)] || DOT_LAYER_KEYS[0];
                } else if (!DOT_LAYER_KEYS.includes(activeLayerKey)) {
                    activeLayerKey = DOT_LAYER_KEYS[0];
                }
                dotLayerStates[removedKey] = createDefaultLayerState(removedKey, {
                    name: DOT_LAYER_META[removedKey].label,
                    hidden: true
                });
                dotGroups[removedKey]?.returnToGrid();
                clearMaskCache();
                loadActiveLayerIntoUi();
                syncLayerRegistryUi();
                if (typeof showUiToast === 'function') showUiToast(`${removedLabel} deleted.`);
                return true;
            }

            function moveLayer(layerKey, delta) {
                const index = DOT_LAYER_KEYS.indexOf(layerKey);
                const nextIndex = index + delta;
                if (index < 0 || nextIndex < 0 || nextIndex >= DOT_LAYER_KEYS.length) return;
                const [moved] = DOT_LAYER_KEYS.splice(index, 1);
                DOT_LAYER_KEYS.splice(nextIndex, 0, moved);
                activeLayerKey = moved;
                syncLayerRegistryUi();
                updateLayerSelectionUi();
                syncLeftPanels();
            }

            function invalidateLayerRuntimeConfig(layerKey = null) {
                if (layerKey) {
                    delete layerRuntimeConfigCache[layerKey];
                    if (typeof markDotLayerDirty === 'function') markDotLayerDirty(layerKey);
                    return;
                }
                layerRuntimeConfigCache = {};
                if (typeof markAllDotLayersDirty === 'function') markAllDotLayersDirty();
            }

            function getLayerRuntimeConfig(layerKey) {
                const state = dotLayerStates[layerKey] || createDefaultLayerState(layerKey);
                const cached = layerRuntimeConfigCache[layerKey];
                if (cached?.source === state) return cached.config;
                const meta = DOT_LAYER_META[layerKey] || DOT_LAYER_META[DEFAULT_LAYER_KEY];
                const flyBy = clamp(readStateFloat(state.elasticity, 45), 0, 100);
                const targetDamping = clamp(100 - flyBy, 0, 100);
                const targetType = normalizeTargetType(state.targetType || state.targetTypes);
                const gridColor = normalizeHexColor(state.gridColor, meta.defaultColor);
                const midColor = normalizeHexColor(state.midColor, gridColor);
                const targetColor = normalizeHexColor(state.targetColor, midColor);
                const visibilityGridProximity = clamp(readStateFloat(state.visibilityGridProximity, 0), 0, 240);
                const config = {
                    hidden: !!state.hidden,
                    cols: Math.max(1, parseInt(state.cols, 10) || 1),
                    rows: Math.max(1, parseInt(state.rows, 10) || 1),
                    spacing: readStateFloat(state.spacing, 42),
                    offsetX: readStateFloat(state.offsetX, 0),
                    offsetY: readStateFloat(state.offsetY, 110),
                    targetType,
                    targetTypes: [targetType],
                    mass: readStateFloat(state.mass, 1),
                    friction: readStateFloat(state.friction, 34),
                    speedLimit: readStateFloat(state.speedLimit, 80),
                    elasticity: readStateFloat(state.elasticity, 45),
                    targetDamping,
                    returnPull: clamp(readStateFloat(state.returnPull, 0.38), 0.1, 1),
                    pull: clamp(readStateFloat(state.pull, 0.7), 0.1, 1),
                    svgRadius: clamp(readStateFloat(state.svgRadius, 320), 100, 1000),
                    gridRadius: clamp(readStateFloat(state.gridRadius, 1000), 100, 1000),
                    orbit: readStateFloat(state.orbit, 0),
                    shuffle: readStateFloat(state.shuffle, 0),
                    gridElasticity: readStateFloat(state.elasticity, 45),
                    variation: readStateFloat(state.variation, 0),
                    gridSize: clamp(readStateFloat(state.gridSize, 2.5), 0.5, MAX_DOT_SIZE),
                    midSize: clamp(readStateFloat(state.midSize, readStateFloat(state.gridSize, 2.5)), 0.5, MAX_DOT_SIZE),
                    targetSize: clamp(readStateFloat(state.targetSize, 2.5), 0.5, MAX_DOT_SIZE),
                    sizeMidpoint: clamp(readStateFloat(state.sizeMidpoint, 0.5), 0.05, 0.95),
                    speedSize: readStateFloat(state.speedSize, 0),
                    settleDistance: DOT_SETTLE_DISTANCE,
                    gridColor,
                    midColor,
                    targetColor,
                    gridRgb: hexToRgb(gridColor),
                    midRgb: hexToRgb(midColor),
                    targetRgb: hexToRgb(targetColor),
                    sameColor: gridColor === midColor && midColor === targetColor,
                    visibilityEnabled: state.visibilityEnabled === true || state.visibilityEnabled === 'true',
                    visibilityOn: readStateFloat(state.visibilityOn, 7),
                    visibilityOff: readStateFloat(state.visibilityOff, 3),
                    visibilityRandomness: readStateFloat(state.visibilityRandomness, 100),
                    visibilityProbability: readStateFloat(state.visibilityProbability, 70),
                    visibilityGridProximity,
                    visibilityGridProximitySq: visibilityGridProximity * visibilityGridProximity
                };
                config.boundaryElasticity = clamp(config.elasticity, 0, 100) / 100;
                config.gridElasticityNormalized = clamp(config.gridElasticity ?? config.elasticity, 0, 100) / 100;
                config.gridCapture = 1 - config.gridElasticityNormalized;
                config.variationNormalized = clamp(config.variation, 0, 100) / 100;
                config.hasVariation = config.variationNormalized > 0.001;
                config.baseDrag = 0.006 + clamp(config.friction, 0, 100) * 0.0018;
                config.svgRadiusSq = config.svgRadius * config.svgRadius;
                config.gridRadiusSq = config.gridRadius * config.gridRadius;
                config.targetDampingNormalized = clamp(config.targetDamping, 0, 100) / 100;
                config.maxSpeed = Math.max(0.05, config.speedLimit);
                config.maxSpeedSq = config.maxSpeed * config.maxSpeed;
                config.speedSizeLimit = Math.max(0.1, config.speedLimit);
                layerRuntimeConfigCache[layerKey] = { source: state, config };
                return config;
            }

            function buildGridPoints(config) {
                const cols = Math.max(1, config.cols);
                const rows = Math.max(1, config.rows);
                const spacing = config.spacing;
                const startX = (STUDIO_WIDTH - (cols - 1) * spacing) / 2 + config.offsetX;
                const startY = (STUDIO_HEIGHT - (rows - 1) * spacing) / 2 + config.offsetY;
                const points = [];
                for (let c = 0; c < cols; c++) {
                    for (let r = 0; r < rows; r++) {
                        points.push({ x: startX + c * spacing, y: startY + r * spacing });
                    }
                }
                return points;
            }

            function getTotalGridDots(config) {
                return Math.max(0, config.cols * config.rows);
            }

            function setControlValue(control, value) {
                if (!control) return;
                if (isDenseSizeSlider(control) && control.dataset.denseSizeScale === 'true') {
                    setDenseSizeControlValue(control, value);
                } else {
                    control.value = value;
                }
                if (control.type === 'range') updateRangeIndicator(control);
                if (control.type === 'range') syncRandomRangeVisual(control);
            }

            const randomRangeControlState = {};
            const randomLockedControlIds = new Set();
            const MOTION_RANDOM_CONTROL_KEYS = [
                'pull', 'svgRadius', 'returnPull', 'gridRadius', 'speedLimit',
                'mass', 'friction', 'elasticity',
                'orbit', 'shuffle', 'variation',
                'gridSize', 'midSize', 'targetSize', 'sizeMidpoint', 'speedSize'
            ];
            const BLINK_RANDOM_CONTROL_KEYS = [
                'visibilityOn', 'visibilityOff', 'visibilityRandomness', 'visibilityProbability',
                'gridProximity'
            ];
            function isRandomizableRangeControl(control) {
                return !!control?.id &&
                    control.type === 'range' &&
                    !!control.closest('#motion-matrix-panel .motion-layer-content');
            }

            function getRangeBounds(control) {
                if (isDenseSizeSlider(control) && control.dataset.denseSizeScale === 'true') {
                    return {
                        min: DENSE_SIZE_MIN,
                        max: DENSE_SIZE_MAX,
                        step: 0.1
                    };
                }
                const min = parseFloat(control.min);
                const max = parseFloat(control.max);
                const step = parseFloat(control.step) || 1;
                return {
                    min: Number.isFinite(min) ? min : 0,
                    max: Number.isFinite(max) ? max : 100,
                    step
                };
            }

            function snapControlNumber(control, value) {
                const { min, max, step } = getRangeBounds(control);
                const numeric = Number.isFinite(parseFloat(value)) ? parseFloat(value) : min;
                const snapped = min + Math.round((numeric - min) / step) * step;
                return Number(clamp(snapped, min, max).toFixed(stepDecimals(step)));
            }

            function formatControlNumber(control, value) {
                return String(Number(snapControlNumber(control, value).toFixed(stepDecimals(parseFloat(control.step) || 1))));
            }

            function getRandomRangeId(control) {
                return control?.id || '';
            }

            function getDefaultRandomRange(control) {
                const { min, max } = getRangeBounds(control);
                return { randomMin: min, randomMax: max };
            }

            function normalizeRandomRangeControl(control, options = {}) {
                if (!isRandomizableRangeControl(control)) return null;
                const { clampValue = false } = options;
                const id = getRandomRangeId(control);
                const { min, max } = getRangeBounds(control);
                const stored = randomRangeControlState[id] || getDefaultRandomRange(control);
                let value = snapControlNumber(control, getControlValue(control));
                let randomMin = snapControlNumber(control, stored.randomMin);
                let randomMax = snapControlNumber(control, stored.randomMax);
                randomMin = clamp(randomMin, min, max);
                randomMax = clamp(randomMax, min, max);
                if (randomMin > randomMax) {
                    const fallback = getDefaultRandomRange(control);
                    randomMin = fallback.randomMin;
                    randomMax = fallback.randomMax;
                }
                if (clampValue) {
                    value = snapControlNumber(control, clamp(value, randomMin, randomMax));
                    setControlValue(control, formatControlNumber(control, value));
                    updateRangeIndicator(control);
                } else {
                    value = snapControlNumber(control, clamp(value, min, max));
                }
                randomMin = snapControlNumber(control, clamp(randomMin, min, value));
                randomMax = snapControlNumber(control, clamp(randomMax, value, max));
                randomRangeControlState[id] = { randomMin, randomMax };
                return { randomMin, value, randomMax, min, max };
            }

            function getRangePercent(value, min, max) {
                if (max <= min) return 0;
                return clamp(((value - min) / (max - min)) * 100, 0, 100);
            }

            function getControlRangePercent(control, value, min, max) {
                if (isDenseSizeSlider(control) && control.dataset.denseSizeScale === 'true') {
                    return denseSizeActualToUi(value);
                }
                return getRangePercent(value, min, max);
            }

            function syncRandomRangeVisual(control) {
                if (!isRandomizableRangeControl(control) || !control.dataset.randomRangeInstalled) return;
                const range = normalizeRandomRangeControl(control);
                if (!range) return;
                const wrap = control.closest('.random-range-wrap');
                const group = control.closest('.slider-group');
                if (!wrap) return;
                const minPct = getControlRangePercent(control, range.randomMin, range.min, range.max);
                const valuePct = getControlRangePercent(control, range.value, range.min, range.max);
                const maxPct = getControlRangePercent(control, range.randomMax, range.min, range.max);
                wrap.style.setProperty('--random-min-pct', `${minPct}%`);
                wrap.style.setProperty('--random-value-pct', `${valuePct}%`);
                wrap.style.setProperty('--random-max-pct', `${maxPct}%`);
                const minThumb = wrap.querySelector('.random-limit-thumb-min');
                const maxThumb = wrap.querySelector('.random-limit-thumb-max');
                if (minThumb) minThumb.style.left = `${minPct}%`;
                if (maxThumb) maxThumb.style.left = `${maxPct}%`;
                group?.classList.toggle('random-range-locked', isControlRandomLocked(control));
            }

            function setRandomRangeLimit(control, side, value) {
                const current = snapControlNumber(control, getControlValue(control));
                const existing = normalizeRandomRangeControl(control) || getDefaultRandomRange(control);
                const { min, max } = getRangeBounds(control);
                const nextValue = snapControlNumber(control, value);
                if (side === 'min') {
                    randomRangeControlState[getRandomRangeId(control)] = {
                        randomMin: clamp(nextValue, min, current),
                        randomMax: existing.randomMax
                    };
                } else {
                    randomRangeControlState[getRandomRangeId(control)] = {
                        randomMin: existing.randomMin,
                        randomMax: clamp(nextValue, current, max)
                    };
                }
                syncRandomRangeVisual(control);
            }

            function getPointerRangeValue(event, control, wrap) {
                const rect = wrap.getBoundingClientRect();
                const { min, max } = getRangeBounds(control);
                const percent = rect.width ? clamp((event.clientX - rect.left) / rect.width, 0, 1) : 0;
                if (isDenseSizeSlider(control) && control.dataset.denseSizeScale === 'true') {
                    return snapControlNumber(control, denseSizeUiToActual(percent * 100));
                }
                return snapControlNumber(control, min + percent * (max - min));
            }

            function beginRandomLimitDrag(event, control, side) {
                const wrap = control.closest('.random-range-wrap');
                if (!wrap) return;
                event.preventDefault();
                event.stopPropagation();
                const pointerId = event.pointerId;
                const update = pointerEvent => {
                    setRandomRangeLimit(control, side, getPointerRangeValue(pointerEvent, control, wrap));
                };
                const stop = pointerEvent => {
                    wrap.removeEventListener('pointermove', update);
                    wrap.removeEventListener('pointerup', stop);
                    wrap.removeEventListener('pointercancel', stop);
                    try {
                        wrap.releasePointerCapture?.(pointerId);
                    } catch (error) {
                    }
                    syncRandomRangeVisual(control);
                    updateActionAvailability();
                };
                try {
                    wrap.setPointerCapture?.(pointerId);
                } catch (error) {
                }
                wrap.addEventListener('pointermove', update);
                wrap.addEventListener('pointerup', stop);
                wrap.addEventListener('pointercancel', stop);
                update(event);
            }

            function resetRandomRangeLimits(control) {
                if (!isRandomizableRangeControl(control)) return;
                const { min, max } = getRangeBounds(control);
                randomRangeControlState[getRandomRangeId(control)] = { randomMin: min, randomMax: max };
                normalizeRandomRangeControl(control, { clampValue: true });
                syncRandomRangeVisual(control);
                updateActionAvailability();
            }

            function resetRandomRangeControls(controls = []) {
                let count = 0;
                controls.forEach(control => {
                    if (!isRandomizableRangeControl(control)) return;
                    resetRandomRangeLimits(control);
                    count += 1;
                });
                return count;
            }

            function setupRandomRangeControl(control) {
                if (!isRandomizableRangeControl(control) || control.dataset.randomRangeInstalled) return;
                const group = control.closest('.slider-group');
                if (!group) return;
                const wrap = document.createElement('div');
                wrap.className = 'random-range-wrap';
                control.parentElement.insertBefore(wrap, control);
                wrap.appendChild(control);
                control.classList.add('random-main-range');
                control.dataset.randomRangeInstalled = 'true';
                ['min', 'max'].forEach(side => {
                    const thumb = document.createElement('button');
                    thumb.type = 'button';
                    thumb.className = `random-limit-thumb random-limit-thumb-${side}`;
                    const thumbTitle = side === 'min' ? 'Minimum randomization value' : 'Maximum randomization value';
                    setNativeTooltip(thumb, thumbTitle);
                    thumb.setAttribute('aria-label', thumbTitle);
                    thumb.addEventListener('pointerdown', event => beginRandomLimitDrag(event, control, side));
                    wrap.appendChild(thumb);
                });
                control.addEventListener('input', () => {
                    normalizeRandomRangeControl(control, { clampValue: true });
                    syncRandomRangeVisual(control);
                });
                group.classList.add('has-random-range');
                normalizeRandomRangeControl(control);
                syncRandomRangeVisual(control);
            }

            function setupRandomRangeUi() {
                document.querySelectorAll('#motion-matrix-panel .motion-layer-content .slider-group input[type="range"]').forEach(setupRandomRangeControl);
            }

            function getRandomRangeState() {
                setupRandomRangeUi();
                return Array.from(document.querySelectorAll('[data-random-range-installed="true"]')).reduce((acc, control) => {
                    const range = normalizeRandomRangeControl(control);
                    if (range) {
                        acc[control.id] = {
                            randomMin: String(range.randomMin),
                            randomMax: String(range.randomMax)
                        };
                    }
                    return acc;
                }, {});
            }

            function applyRandomRangeState(state = {}) {
                setupRandomRangeUi();
                document.querySelectorAll('[data-random-range-installed="true"]').forEach(control => {
                    const incoming = state?.[control.id];
                    if (incoming && incoming.randomMin !== undefined && incoming.randomMax !== undefined) {
                        randomRangeControlState[control.id] = {
                            randomMin: incoming.randomMin,
                            randomMax: incoming.randomMax
                        };
                    } else {
                        randomRangeControlState[control.id] = getDefaultRandomRange(control);
                    }
                    normalizeRandomRangeControl(control, { clampValue: true });
                    syncRandomRangeVisual(control);
                });
                updateActionAvailability();
            }

            function copyRandomRangeStateForLayer(sourceLayerKey, targetLayerKey) {
                if (!sourceLayerKey || !targetLayerKey) return;
                Object.keys(randomRangeControlState).forEach(id => {
                    const sourcePrefix = `dot-${sourceLayerKey}-`;
                    if (!id.startsWith(sourcePrefix)) return;
                    const targetId = `dot-${targetLayerKey}-${id.slice(sourcePrefix.length)}`;
                    randomRangeControlState[targetId] = { ...randomRangeControlState[id] };
                    const targetControl = document.getElementById(targetId);
                    if (targetControl) syncRandomRangeVisual(targetControl);
                });
                updateActionAvailability();
            }

            function getControlLockId(control) {
                return control?.id || '';
            }

            function isControlRandomLocked(control) {
                const lockId = getControlLockId(control);
                return !!lockId && randomLockedControlIds.has(lockId);
            }

            function setControlRandomLocked(control, locked) {
                const lockId = getControlLockId(control);
                if (!lockId) return;
                if (locked) randomLockedControlIds.add(lockId);
                else randomLockedControlIds.delete(lockId);
            }

            function getRandomLockState() {
                setupRandomLockUi();
                return Array.from(randomLockedControlIds);
            }

            function applyRandomLockState(state = []) {
                setupRandomLockUi();
                randomLockedControlIds.clear();
                if (Array.isArray(state)) {
                    state.forEach(id => {
                        if (typeof id === 'string' && id) randomLockedControlIds.add(id);
                    });
                } else if (state && typeof state === 'object') {
                    Object.entries(state).forEach(([id, locked]) => {
                        if (id && locked) randomLockedControlIds.add(id);
                    });
                }
                updateRandomLockButtons();
            }

            function stepDecimals(step) {
                const text = String(step);
                return text.includes('.') ? text.split('.')[1].length : 0;
            }

            function randomValueForRange(control) {
                const range = normalizeRandomRangeControl(control, { clampValue: true });
                const { min, max } = getRangeBounds(control);
                const low = range ? range.randomMin : min;
                const high = range ? range.randomMax : max;
                const raw = low + Math.random() * Math.max(0, high - low);
                return formatControlNumber(control, raw);
            }

            function randomDotPaletteColor() {
                return TEN26_DOT_RANDOM_COLORS[Math.floor(Math.random() * TEN26_DOT_RANDOM_COLORS.length)];
            }

            function setColorPairValue(picker, hex, value) {
                const color = normalizeHexColor(value, '#ffffff');
                if (picker) picker.value = color;
                if (hex) hex.value = color;
                syncDotColorSwatchState(hex || picker);
                updateSizeSliderThumbColorsForColorControl(hex || picker);
            }

            function getMotionRandomControls(layerKey) {
                const controls = getMotionLayerControls(layerKey);
                return [
                    ...MOTION_RANDOM_CONTROL_KEYS.map(key => controls[key]),
                    controls.gridColorHex,
                    controls.midColorHex,
                    controls.targetColorHex
                ].filter(Boolean);
            }

            function getBlinkRandomControls() {
                return BLINK_RANDOM_CONTROL_KEYS.map(key => blinkControls[key]).filter(Boolean);
            }

            function updateRandomLockButtons() {
                document.querySelectorAll('.value-lock-btn[data-lock-control]').forEach(button => {
                    const control = document.getElementById(button.dataset.lockControl);
                    const locked = isControlRandomLocked(control);
                    button.classList.toggle('locked', locked);
                    button.setAttribute('aria-pressed', String(locked));
                    setIconButton(button, locked ? 'lock' : 'unlock', `${locked ? 'Unlock' : 'Lock'} ${button.dataset.lockLabel || 'value'} for randomize`);
                    if (control?.type === 'range') syncRandomRangeVisual(control);
                });
                Object.entries(motionLayerControls.layers).forEach(([layerKey, controls]) => {
                    const label = getLayerLabel(layerKey);
                    if (controls.randomize) setIconButton(controls.randomize, 'dice', 'Randomize unlocked layer-stack values');
                    if (controls.randomizeText) {
                        controls.randomizeText.textContent = 'Random';
                        setNativeTooltip(controls.randomizeText, `Randomize unlocked ${label} layer-stack values`);
                    }
                    if (controls.lock) {
                        controls.lock.textContent = 'Lock';
                        setNativeTooltip(controls.lock, `Lock all ${label} layer-stack values for randomize`);
                    }
                    if (controls.unlock) {
                        controls.unlock.textContent = 'Unlock';
                        setNativeTooltip(controls.unlock, `Unlock all ${label} layer-stack values`);
                    }
                    if (controls.reset) {
                        controls.reset.textContent = 'Reset';
                        setNativeTooltip(controls.reset, `Reset ${label} randomization limits`);
                    }
                });
                updateActionAvailability();
            }

            function addRandomLockButton(control, label) {
                if (!control || !control.id || document.querySelector(`[data-lock-control="${control.id}"]`)) return;
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'value-lock-btn';
                button.dataset.lockControl = control.id;
                button.dataset.lockLabel = label;
                button.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    setControlRandomLocked(control, !isControlRandomLocked(control));
                    updateRandomLockButtons();
                });
                if (control.type === 'range') {
                    const group = control.closest('.slider-group');
                    group?.classList.add('has-lock');
                    group?.appendChild(button);
                } else {
                    control.insertAdjacentElement('afterend', button);
                }
            }

            function setupRandomLockUi() {
                document.querySelectorAll('#motion-matrix-panel .motion-layer-content .slider-group input[type="range"]').forEach(control => {
                    const label = control.closest('.slider-group')?.querySelector('span')?.textContent?.trim() || control.id;
                    addRandomLockButton(control, label);
                });
                document.querySelectorAll('#motion-matrix-panel .motion-layer-content .compact-color input[type="text"]').forEach(control => {
                    const label = control.closest('.compact-color')?.querySelector('.compact-color-label')?.textContent?.trim() || control.id;
                    addRandomLockButton(control, label);
                });
                updateRandomLockButtons();
            }

            function setButtonActionable(button, actionable) {
                if (!button) return;
                button.disabled = !actionable;
                button.classList.toggle('is-muted-action', !actionable);
                button.setAttribute('aria-disabled', String(!actionable));
            }

            function sameGridLayout(a = {}, b = {}) {
                return ['cols', 'rows', 'spacing', 'offsetX', 'offsetY'].every(key => String(a[key]) === String(b[key]));
            }

            function hasLockedControls(controls = []) {
                return controls.some(control => isControlRandomLocked(control));
            }

            function hasCustomRandomRange(control) {
                if (!isRandomizableRangeControl(control)) return false;
                const range = normalizeRandomRangeControl(control);
                if (!range) return false;
                const epsilon = 0.000001;
                return Math.abs(range.randomMin - range.min) > epsilon
                    || Math.abs(range.randomMax - range.max) > epsilon;
            }

            function hasCustomRandomRangeControls(controls = []) {
                return controls.some(hasCustomRandomRange);
            }

            function updateActionAvailability() {
                const layerDrawers = DOT_LAYER_KEYS
                    .map(layerKey => motionLayerControls.layers[layerKey]?.drawer)
                    .filter(Boolean);
                const anyCollapsed = layerDrawers.some(drawer => drawer.classList.contains('collapsed'));
                const anyOpen = layerDrawers.some(drawer => !drawer.classList.contains('collapsed'));
                setButtonActionable(motionLayerControls.openAll, anyCollapsed);
                setButtonActionable(motionLayerControls.collapseAll, anyOpen);

                DOT_LAYER_KEYS.forEach(layerKey => {
                    const randomControls = getMotionRandomControls(layerKey);
                    const controls = getMotionLayerControls(layerKey);
                    setButtonActionable(controls.lock, randomControls.some(control => !isControlRandomLocked(control)));
                    setButtonActionable(controls.unlock, hasLockedControls(randomControls));
                    setButtonActionable(controls.reset, hasCustomRandomRangeControls(randomControls));
                });

                const canAdd = DOT_LAYER_KEYS.length < ALL_DOT_LAYER_KEYS.length;
                setButtonActionable(motionLayerControls.copyAbove, canAdd);
                setButtonActionable(motionLayerControls.copyBelow, canAdd);
                const activeLayout = dotLayerStates[activeLayerKey] || {};
                const needsGridCopy = DOT_LAYER_KEYS.some(layerKey => layerKey !== activeLayerKey && !sameGridLayout(activeLayout, dotLayerStates[layerKey]));
                setButtonActionable(gridControls.applyAll, needsGridCopy);
            }

            function randomizeSliderControl(control) {
                if (!control || isControlRandomLocked(control)) return false;
                setControlValue(control, randomValueForRange(control));
                return true;
            }

            function randomizeMotionLayer(layerKey, options = {}) {
                const { retarget = true } = options;
                const controls = getMotionLayerControls(layerKey);
                MOTION_RANDOM_CONTROL_KEYS.forEach(key => randomizeSliderControl(controls[key]));
                if (controls.gridColorHex && !isControlRandomLocked(controls.gridColorHex)) {
                    setColorPairValue(controls.gridColor, controls.gridColorHex, randomDotPaletteColor());
                }
                if (controls.midColorHex && !isControlRandomLocked(controls.midColorHex)) {
                    setColorPairValue(controls.midColor, controls.midColorHex, randomDotPaletteColor());
                }
                if (controls.targetColorHex && !isControlRandomLocked(controls.targetColorHex)) {
                    setColorPairValue(controls.targetColor, controls.targetColorHex, randomDotPaletteColor());
                }
                persistMotionLayerControls(layerKey, { retarget });
                if (motionLayerControls.status) motionLayerControls.status.textContent = `${getLayerLabel(layerKey)} randomized. Locked values were skipped.`;
            }

            function randomizeAllMotionLayers() {
                DOT_LAYER_KEYS.forEach(layerKey => randomizeMotionLayer(layerKey, { retarget: false }));
                refreshAttractorTargetsIfNeeded();
                if (motionLayerControls.status) motionLayerControls.status.textContent = 'All active layer-stack values randomized together. Locked values were skipped.';
            }

            function randomizeAllBlinkLayers() {
                if (blinkControls.enabled) blinkControls.enabled.checked = true;
                getBlinkRandomControls().forEach(randomizeSliderControl);
                applyBlinkControlsToAllLayers();
                if (blinkControls.status) blinkControls.status.textContent = 'Blink randomized for all visible grid layers. Locked values were skipped.';
            }

            function lockMotionLayer(layerKey) {
                getMotionRandomControls(layerKey).forEach(control => setControlRandomLocked(control, true));
                updateRandomLockButtons();
                if (motionLayerControls.status) motionLayerControls.status.textContent = `${getLayerLabel(layerKey)} values locked.`;
            }

            function unlockMotionLayer(layerKey) {
                getMotionRandomControls(layerKey).forEach(control => setControlRandomLocked(control, false));
                updateRandomLockButtons();
                if (motionLayerControls.status) motionLayerControls.status.textContent = `${getLayerLabel(layerKey)} values unlocked.`;
            }

            function unlockAllBlinkLayers() {
                getBlinkRandomControls().forEach(control => setControlRandomLocked(control, false));
                updateRandomLockButtons();
                if (blinkControls.status) blinkControls.status.textContent = 'Blink values unlocked.';
            }

            function resetMotionLayerRanges(layerKey) {
                const count = resetRandomRangeControls(getMotionRandomControls(layerKey));
                if (motionLayerControls.status) motionLayerControls.status.textContent = `${getLayerLabel(layerKey)} randomization limits reset.`;
                return count;
            }

            function resetBlinkRandomRanges() {
                resetRandomRangeControls(getBlinkRandomControls());
                if (blinkControls.status) blinkControls.status.textContent = 'Blink randomization limits reset.';
            }

            function getGridLayerStateFromControls(layerKey) {
                const current = dotLayerStates[layerKey] || createDefaultLayerState(layerKey);
                const controls = gridControls.layers[layerKey] || {};
                return {
                    cols: controls.cols?.value || current.cols,
                    rows: controls.rows?.value || current.rows,
                    spacing: controls.spacing?.value || current.spacing,
                    offsetX: controls.offsetX?.value || current.offsetX,
                    offsetY: controls.offsetY?.value || current.offsetY
                };
            }

            function syncGridLayerControls(layerKey) {
                const state = dotLayerStates[layerKey] || createDefaultLayerState(layerKey);
                const controls = gridControls.layers[layerKey] || {};
                setControlValue(controls.cols, state.cols);
                setControlValue(controls.rows, state.rows);
                setControlValue(controls.spacing, state.spacing);
                setControlValue(controls.offsetX, state.offsetX);
                setControlValue(controls.offsetY, state.offsetY);
            }

            function syncAllGridLayerControls() {
                DOT_LAYER_KEYS.forEach(syncGridLayerControls);
            }

            function persistGridLayerControls(layerKey = activeLayerKey, options = {}) {
                const { rebuildGrid = true, retarget = true } = options;
                const current = dotLayerStates[layerKey] || createDefaultLayerState(layerKey);
                const nextState = { ...current, ...getGridLayerStateFromControls(layerKey) };
                dotLayerStates[layerKey] = coerceLayerStateForV12(createDefaultLayerState(layerKey, nextState), nextState);
                invalidateLayerRuntimeConfig(layerKey);
                if (rebuildGrid && dotGroups[layerKey]) dotGroups[layerKey].rebuildGrid();
                if (retarget) {
                    const heldTargetSlideIndex = getHeldTargetSlideIndex();
                    if (heldTargetSlideIndex !== null) setLayerTargetsFromSlide(layerKey, heldTargetSlideIndex, getHeldTargetScale());
                }
                if (typeof scheduleMaskWarmup === 'function') scheduleMaskWarmup();
                if (typeof scheduleTargetWarmup === 'function') scheduleTargetWarmup();
                updateLayerSelectionUi();
            }

            function getMotionLayerControls(layerKey) {
                return motionLayerControls.layers[layerKey] || motionLayerControls.layers[activeLayerKey] || motionLayerControls.layers[DEFAULT_LAYER_KEY];
            }

            function getBlinkStateFromControls() {
                return forceBlinkRespawnState({
                    visibilityEnabled: !!blinkControls.enabled?.checked,
                    visibilityOn: blinkControls.visibilityOn?.value || '7',
                    visibilityOff: blinkControls.visibilityOff?.value || '3',
                    visibilityRandomness: blinkControls.visibilityRandomness?.value || '100',
                    visibilityProbability: blinkControls.visibilityProbability?.value || '70',
                    visibilityGridProximity: blinkControls.gridProximity?.value || '0'
                });
            }

            function syncBlinkControlsFromState(sourceLayerKey = activeLayerKey) {
                const state = forceBlinkRespawnState(dotLayerStates[sourceLayerKey] || dotLayerStates[DEFAULT_LAYER_KEY] || createDefaultLayerState(DEFAULT_LAYER_KEY));
                if (blinkControls.enabled) blinkControls.enabled.checked = state.visibilityEnabled === true || state.visibilityEnabled === 'true';
                setControlValue(blinkControls.visibilityOn, state.visibilityOn || '7');
                setControlValue(blinkControls.visibilityOff, state.visibilityOff || '3');
                setControlValue(blinkControls.visibilityRandomness, state.visibilityRandomness || '100');
                setControlValue(blinkControls.visibilityProbability, state.visibilityProbability || '70');
                setControlValue(blinkControls.gridProximity, state.visibilityGridProximity || '0');
                if (blinkControls.status) blinkControls.status.textContent = blinkControls.enabled?.checked
                    ? 'Blink is enabled for all visible layers with shared dot indexes.'
                    : 'Blink applies the same dot index across all visible layers.';
            }

            function applyBlinkControlsToAllLayers() {
                const blinkState = getBlinkStateFromControls();
                DOT_LAYER_KEYS.forEach(layerKey => {
                    dotLayerStates[layerKey] = coerceLayerStateForV12(createDefaultLayerState(layerKey, {
                        ...dotLayerStates[layerKey],
                        ...blinkState
                    }), { ...dotLayerStates[layerKey], ...blinkState });
                    invalidateLayerRuntimeConfig(layerKey);
                });
                updateLayerSelectionUi();
            }

            function getMotionLayerStateFromControls(layerKey) {
                const controls = getMotionLayerControls(layerKey);
                const current = dotLayerStates[layerKey] || createDefaultLayerState(layerKey);
                const targetType = normalizeTargetType(controls.targetType?.value || current.targetType);
                const blinkState = getBlinkStateFromControls();
                const elasticity = controls.elasticity?.value || current.elasticity;
                const sizeMidpoint = controls.sizeMidpoint?.value || current.sizeMidpoint;
                return {
                    targetType,
                    targetTypes: [targetType],
                    mass: controls.mass?.value || current.mass,
                    friction: controls.friction?.value || current.friction,
                    speedLimit: controls.speedLimit?.value || current.speedLimit,
                    elasticity,
                    returnPull: controls.returnPull?.value || current.returnPull,
                    pull: controls.pull?.value || current.pull,
                    svgRadius: controls.svgRadius?.value || current.svgRadius,
                    gridRadius: controls.gridRadius?.value || current.gridRadius,
                    orbit: controls.orbit?.value || current.orbit,
                    shuffle: controls.shuffle?.value || current.shuffle,
                    variation: controls.variation?.value || current.variation,
                    gridSize: getControlValue(controls.gridSize) || current.gridSize,
                    midSize: getControlValue(controls.midSize) || current.midSize,
                    targetSize: getControlValue(controls.targetSize) || current.targetSize,
                    sizeMidpoint,
                    speedSize: controls.speedSize?.value || current.speedSize,
                    ...blinkState,
                    gridColor: normalizeHexColor(controls.gridColor?.value || current.gridColor, '#ffffff'),
                    midColor: normalizeHexColor(controls.midColor?.value || current.midColor, current.gridColor || '#ffffff'),
                    targetColor: normalizeHexColor(controls.targetColor?.value || current.targetColor, current.midColor || current.gridColor || '#ffffff')
                };
            }

            function syncMotionLayerControls(layerKey) {
                const state = dotLayerStates[layerKey] || createDefaultLayerState(layerKey);
                const controls = getMotionLayerControls(layerKey);
                if (controls.targetType) controls.targetType.value = normalizeTargetType(state.targetType || state.targetTypes);
                setControlValue(controls.mass, state.mass);
                setControlValue(controls.friction, state.friction);
                setControlValue(controls.returnPull, state.returnPull);
                setControlValue(controls.pull, state.pull);
                setControlValue(controls.svgRadius, state.svgRadius);
                setControlValue(controls.gridRadius, state.gridRadius);
                setControlValue(controls.speedLimit, state.speedLimit);
                setControlValue(controls.elasticity, state.elasticity);
                setControlValue(controls.orbit, state.orbit);
                setControlValue(controls.shuffle, state.shuffle);
                setControlValue(controls.variation, state.variation);
                setControlValue(controls.gridSize, state.gridSize);
                setControlValue(controls.midSize, state.midSize);
                setControlValue(controls.targetSize, state.targetSize);
                setControlValue(controls.sizeMidpoint, state.sizeMidpoint);
                setControlValue(controls.speedSize, state.speedSize);
                setColorPairValue(controls.gridColor, controls.gridColorHex, normalizeHexColor(state.gridColor, '#ffffff'));
                setColorPairValue(controls.midColor, controls.midColorHex, normalizeHexColor(state.midColor, state.gridColor || '#ffffff'));
                setColorPairValue(controls.targetColor, controls.targetColorHex, normalizeHexColor(state.targetColor, state.midColor || state.gridColor || '#ffffff'));
            }

            function syncAllMotionLayerControls() {
                DOT_LAYER_KEYS.forEach(syncMotionLayerControls);
                syncBlinkControlsFromState();
            }

            function persistMotionLayerControls(layerKey, options = {}) {
                const { retarget = true } = options;
                const current = dotLayerStates[layerKey] || createDefaultLayerState(layerKey);
                const nextState = { ...current, ...getMotionLayerStateFromControls(layerKey) };
                dotLayerStates[layerKey] = coerceLayerStateForV12(createDefaultLayerState(layerKey, nextState), nextState);
                invalidateLayerRuntimeConfig(layerKey);
                if (retarget) {
                    const heldTargetSlideIndex = getHeldTargetSlideIndex();
                    if (heldTargetSlideIndex !== null) setLayerTargetsFromSlide(layerKey, heldTargetSlideIndex, getHeldTargetScale());
                }
                if (typeof scheduleTargetWarmup === 'function') scheduleTargetWarmup();
                updateLayerSelectionUi();
            }

            function setLayerVisibility(layerKey, hidden) {
                dotLayerStates[layerKey] = { ...dotLayerStates[layerKey], hidden };
                invalidateLayerRuntimeConfig(layerKey);
                if (hidden && dotGroups[layerKey]) dotGroups[layerKey].returnToGrid();
                const heldTargetSlideIndex = getHeldTargetSlideIndex();
                if (heldTargetSlideIndex !== null) setLayerTargetsFromSlide(layerKey, heldTargetSlideIndex, getHeldTargetScale());
                if (typeof scheduleMaskWarmup === 'function') scheduleMaskWarmup();
                if (typeof scheduleTargetWarmup === 'function') scheduleTargetWarmup();
                updateLayerSelectionUi();
                applyVisualStackOrder();
            }

            function updateLayerSelectionUi() {
                ALL_DOT_LAYER_KEYS.forEach(layerKey => {
                    const label = getLayerLabel(layerKey);
                    const isRegistered = DOT_LAYER_KEYS.includes(layerKey);
                    const isActive = isRegistered && layerKey === activeLayerKey;
                    const isHidden = !!dotLayerStates[layerKey]?.hidden;
                    const motionControls = getMotionLayerControls(layerKey);
                    const gridLayerControls = gridControls.layers[layerKey];
                    gridLayerControls?.content?.classList.toggle('active', isActive);
                    gridLayerControls?.content?.classList.toggle('hidden-layer', isHidden);
                    motionControls.drawer?.classList.toggle('active-layer', isActive);
                    motionControls.drawer?.classList.toggle('hidden-layer', isHidden);
                    motionControls.toggle?.classList.toggle('hidden-state', isHidden);
                    if (motionControls.toggle && isRegistered) {
                        setIconButton(motionControls.toggle, isHidden ? 'eyeOff' : 'eye', `${label} layer ${isHidden ? 'hidden' : 'visible'}`);
                        motionControls.toggle.setAttribute('aria-pressed', String(!isHidden));
                    }
                    if (motionControls.status && isRegistered) {
                        const targetTypes = normalizeTargetTypes(dotLayerStates[layerKey].targetTypes !== undefined ? dotLayerStates[layerKey].targetTypes : dotLayerStates[layerKey].targetType);
                        const targetText = targetTypes.length ? targetTypes.join(' + ') : 'no SVG targets';
                        motionControls.status.textContent = `${label} layer ${isHidden ? 'hidden' : 'visible'} · ${targetText}.`;
                    }
                });
                syncLayerRegistryUi();
                const label = getLayerLabel(activeLayerKey);
                const cfg = getLayerRuntimeConfig(activeLayerKey);
                if (gridControls.status) gridControls.status.textContent = `${label} layout · ${cfg.cols} x ${cfg.rows} · ${Math.round(cfg.spacing)}px.`;
                if (blinkControls.status) {
                    const enabled = blinkControls.enabled?.checked;
                    const visibleCount = DOT_LAYER_KEYS.filter(layerKey => !dotLayerStates[layerKey].hidden).length;
                    blinkControls.status.textContent = enabled
                        ? `Blink enabled for ${visibleCount} visible layer${visibleCount === 1 ? '' : 's'} with shared dot indexes.`
                        : 'Blink applies the same dot index across all visible layers.';
                }
                updateActionAvailability();
            }

            function loadActiveLayerIntoUi() {
                morphControls = getMotionLayerControls(activeLayerKey);
                syncAllGridLayerControls();
                syncAllMotionLayerControls();
                updateLayerSelectionUi();
            }

            function applyActiveLayerTargetsIfNeeded() {
                const slideIndex = getHeldTargetSlideIndex();
                if (slideIndex === null) return;
                setLayerTargetsFromSlide(activeLayerKey, slideIndex, getHeldTargetScale());
            }

            function setLayerTargetsFromSlide(layerKey, slideSource, scaleMultiplier = 1) {
                const cfg = getLayerRuntimeConfig(layerKey);
                if (cfg.hidden) {
                    dotGroups[layerKey].returnToGrid();
                    return 0;
                }
                const targets = typeof slideSource === 'number'
                    ? getSlideScreenTargets(slideSource, cfg.targetTypes, getTotalGridDots(cfg), scaleMultiplier)
                    : getScreenTargetsForSlideLike(slideSource, cfg.targetTypes, getTotalGridDots(cfg), scaleMultiplier);
                dotGroups[layerKey].setAttractorTargets(targets);
                return targets.length ? 1 : 0;
            }

            function applyVisibleLayerTargetsForSlide(slideSource, scaleMultiplier = 1, options = {}) {
                const { activateMask = true } = options;
                if (activateMask && typeof activateSlideMask === 'function' && typeof slideSource === 'number') {
                    activateSlideMask(slideSource, { sync: true });
                }
                return DOT_LAYER_KEYS.reduce((count, layerKey) => count + setLayerTargetsFromSlide(layerKey, slideSource, scaleMultiplier), 0);
            }

            function refreshAttractorTargetsIfNeeded() {
                const slideIndex = getHeldTargetSlideIndex();
                if (slideIndex !== null) applyVisibleLayerTargetsForSlide(slideIndex, getHeldTargetScale(), { activateMask: !autoTransition });
            }

            function getHeldTargetSlideIndex() {
                if (holdState !== 'attract') return null;
                if (activeHoldMode === 'advance') return pendingSlideIndex;
                if (activeHoldMode === 'current') return currentSlideIndex;
                if (activeHoldMode === 'auto' && autoTransition) return autoTransition.targetSlideIndex;
                return null;
            }

            function getHeldTargetScale() {
                if (activeHoldMode === 'auto' && autoTransition) return autoTransition.dynamicTargetScale || 1;
                return 1;
            }

            const maskHitCache = {
                key: '',
                version: 0,
                points: new Map()
            };

            function clearMaskCache() {
                maskHitCache.key = '';
                maskHitCache.version += 1;
                maskHitCache.points.clear();
                if (typeof combinedMaskCache !== 'undefined') combinedMaskCache.clear();
            }
