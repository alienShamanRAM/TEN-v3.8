// TEN26 app state, DOM references, controls, helpers, and grid-layer setup.
const viewport = document.getElementById('canvas-viewport');
            const controlPanel = document.getElementById('control-panel');
            const gridControlPanel = document.getElementById('grid-control-panel');
            const panelToggle = document.getElementById('panel-toggle');
            const minimizeBtn = document.getElementById('minimize-btn');
            const motionMatrixPanel = document.getElementById('motion-matrix-panel');
            const toastRegion = document.getElementById('ui-toast-region');
            let uiToastTimer = null;
            let overlayStatusText = '';
            const TEN26_DOT_RANDOM_COLORS = [
                '#ffffff',
                '#ffc5f4',
                '#02006c'
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
                return { ...state, visibilityRespawn: '0' };
            }

            function createRangeGroup(label, id, min, max, value, step = '1') {
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
                toggle.title = 'Show or hide this layer.';
                toggle.textContent = 'Eye';
                const trigger = document.createElement('button');
                trigger.className = 'motion-layer-trigger';
                trigger.id = `motion-trigger-${layerKey}`;
                trigger.type = 'button';
                const triggerText = document.createElement('span');
                triggerText.className = 'motion-layer-name';
                triggerText.textContent = 'Layer';
                trigger.appendChild(triggerText);
                header.append(toggle, trigger);

                const content = document.createElement('div');
                content.className = 'motion-layer-content';

                const targetSelect = document.createElement('select');
                targetSelect.id = `dot-${layerKey}-target-type`;
                targetSelect.title = 'Choose the SVG target points for this layer.';
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
                    ['SVG Pull', 'pull', '0', '3', '0.7', '0.01'],
                    ['SVG Reach', 'svg-radius', '20', '1400', '320', '5'],
                    ['Grid Pull', 'return-pull', '0.01', '0.6', '0.38', '0.01'],
                    ['Grid Reach', 'grid-radius', '120', '2200', '1600', '10'],
                    ['Speed Cap', 'speed-limit', '0.5', '120', '80', '0.5'],
                    ['Weight', 'mass', '0.2', '8', '1', '0.1'],
                    ['Damping', 'friction', '0', '100', '34', '1'],
                    ['Stick / Fly-By', 'elasticity', '0', '100', '45', '1'],
                    ['Swirl', 'orbit', '-2', '2', '0', '0.01'],
                    ['Shuffle', 'shuffle', '0', '100', '0', '1'],
                    ['Motion Var', 'variation', '0', '100', '0', '1'],
                    ['Grid Size', 'grid-size', '0.5', '20', '2.5', '0.1'],
                    ['Mid Size', 'mid-size', '0.5', '20', '2.5', '0.1'],
                    ['Target Size', 'target-size', '0.5', '20', '2.5', '0.1'],
                    ['Speed Size', 'speed-size', '-8', '8', '0', '0.1']
                ].forEach(([label, suffix, min, max, value, step]) => {
                    content.appendChild(createRangeGroup(label, `dot-${layerKey}-${suffix}`, min, max, value, step));
                });

                const colorRow = document.createElement('div');
                colorRow.className = 'color-pair-row';
                colorRow.append(
                    createCompactColorControl(layerKey, 'Grid', 'grid'),
                    createCompactColorControl(layerKey, 'Target', 'target')
                );
                content.appendChild(colorRow);

                const actions = document.createElement('div');
                actions.className = 'drawer-bottom-actions';
                const randomize = document.createElement('button');
                randomize.className = 'preset-action-btn pink-action';
                randomize.id = `motion-randomize-text-${layerKey}`;
                randomize.type = 'button';
                randomize.textContent = 'Randomize';
                const unlock = document.createElement('button');
                unlock.className = 'preset-action-btn';
                unlock.id = `motion-unlock-${layerKey}`;
                unlock.type = 'button';
                unlock.textContent = 'Unlock';
                actions.append(randomize, unlock);
                content.appendChild(actions);

                drawer.append(header, content);
                return drawer;
            }

            function createGridLayerButton(layerKey) {
                const button = document.createElement('button');
                button.className = 'layer-tab';
                button.id = `grid-select-layer-${layerKey}`;
                button.type = 'button';
                button.textContent = 'Layer';
                return button;
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
                }
                const gridDrawer = document.getElementById('drawer-grid');
                const tabRow = gridDrawer?.querySelector('.layer-tab-row');
                const gridStatus = document.getElementById('grid-layout-status');
                if (tabRow) tabRow.remove();
                if (gridStatus?.parentElement) {
                    gridDrawer.querySelectorAll('.grid-layer-content').forEach(node => node.remove());
                    ALL_DOT_LAYER_KEYS.forEach(layerKey => {
                        gridStatus.parentElement.insertBefore(createGridLayerContent(layerKey), gridStatus);
                    });
                }
            }

            // The Layers drawer controls the companion layer editor surface.
            const LEFT_PANEL_DRAWER_IDS = ['drawer-dot-matrix'];

            function getLeftPanelForDrawer(drawerId) {
                if (drawerId === 'drawer-dot-matrix') return motionMatrixPanel;
                return null;
            }

            function installGridControlPanel() {
                if (!gridControlPanel) return;
                ['drawer-dot-matrix', 'drawer-grid', 'drawer-blink-mode', 'drawer-presets'].forEach(drawerId => {
                    const drawer = document.getElementById(drawerId);
                    if (drawer && drawer.parentElement !== gridControlPanel) gridControlPanel.appendChild(drawer);
                });
            }

            function collapseLeftPanelDrawers(drawerId) {
                getLeftPanelForDrawer(drawerId)?.querySelectorAll('.motion-layer-drawer').forEach(drawer => drawer.classList.add('collapsed'));
            }

            // The GRID drawer owns the embedded layer controls while the left panel is open.
            function syncLeftPanels() {
                const panelIsHidden = controlPanel.classList.contains('minimized') || gridControlPanel?.classList.contains('minimized');
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

            installGridControlPanel();
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
                gridControlPanel?.classList.add('minimized');
                syncLeftPanels();
            }

            function showControlPanels() {
                controlPanel.classList.remove('minimized');
                gridControlPanel?.classList.remove('minimized');
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
            const staticGridCanvas = document.getElementById('grid-canvas-primary');
            const geometryCanvas = document.getElementById('svg-geometry-canvas');
            const morphCanvas = document.getElementById('morph-canvas');
            const morphCtx = morphCanvas.getContext('2d');

            const MAX_DOT_LAYERS = 9;
            const DEFAULT_LAYER_KEY = 'layer-1';
            const LEGACY_DOT_LAYER_KEYS = ['top', 'mid', 'bottom'];
            const ALL_DOT_LAYER_KEYS = Array.from({ length: MAX_DOT_LAYERS }, (_, index) => `layer-${index + 1}`);
            let DOT_LAYER_KEYS = [DEFAULT_LAYER_KEY];
            const TARGET_TYPE_KEYS = ['anchor', 'path', 'fill'];
            const DOT_LAYER_META = ALL_DOT_LAYER_KEYS.reduce((acc, layerKey, index) => {
                acc[layerKey] = { label: `Layer ${index + 1}`, defaultOffsetY: '110', defaultColor: '#ffffff' };
                return acc;
            }, {});
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
            const PRESET_GRID_RADIUS = '1600';
            const MAX_DOT_SIZE = 20;
            const INTERACTION_HELP_TEXT = 'Left/Right change slides. Space holds the current slide. Up hides the UI. Down restores it. Esc stops flicker.';

            const UI_ICONS = {
                eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c5.2 0 8.8 4.5 9.7 5.8.2.3.2.6 0 .9C20.8 13 17.2 17.5 12 17.5S3.2 13 2.3 11.7a.8.8 0 0 1 0-.9C3.2 9.5 6.8 5 12 5Zm0 2C8.4 7 5.6 9.6 4.4 11.2 5.6 12.9 8.4 15.5 12 15.5s6.4-2.6 7.6-4.3C18.4 9.6 15.6 7 12 7Zm0 1.5a2.7 2.7 0 1 1 0 5.4 2.7 2.7 0 0 1 0-5.4Z"/></svg>',
                eyeOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.3 2.4 21.6 20.7l-1.3 1.3-3.2-3.2A10.8 10.8 0 0 1 12 20C6.8 20 3.2 15.5 2.3 14.2a.8.8 0 0 1 0-.9 17 17 0 0 1 4-4.1L2 4l1.3-1.6Zm6.1 9.3a2.7 2.7 0 0 0 3.4 3.4l-3.4-3.4Zm2.6-6.2c5.2 0 8.8 4.5 9.7 5.8.2.3.2.6 0 .9a16.8 16.8 0 0 1-2.6 3.1l-2.2-2.2a5 5 0 0 0-6-6L9.1 5.4c.9-.2 1.9-.4 2.9-.4Z"/></svg>',
                dice: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3h11A3.5 3.5 0 0 1 21 6.5v11a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 17.5v-11A3.5 3.5 0 0 1 6.5 3Zm0 2A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19h11a1.5 1.5 0 0 0 1.5-1.5v-11A1.5 1.5 0 0 0 17.5 5h-11ZM8 8.2a1.2 1.2 0 1 1 2.4 0A1.2 1.2 0 0 1 8 8.2Zm5.6 0a1.2 1.2 0 1 1 2.4 0 1.2 1.2 0 0 1-2.4 0ZM8 15.8a1.2 1.2 0 1 1 2.4 0 1.2 1.2 0 0 1-2.4 0Zm5.6 0a1.2 1.2 0 1 1 2.4 0 1.2 1.2 0 0 1-2.4 0Zm-2.8-3.8a1.2 1.2 0 1 1 2.4 0 1.2 1.2 0 0 1-2.4 0Z"/></svg>',
                lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3h1.2c.7 0 1.3.6 1.3 1.3v7.4c0 .7-.6 1.3-1.3 1.3H5.8c-.7 0-1.3-.6-1.3-1.3v-7.4c0-.7.6-1.3 1.3-1.3H7Zm2 0h6V7a3 3 0 0 0-6 0v3Z"/></svg>',
                unlock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10V7a5 5 0 0 1 9.4-2.4l-1.8.9A3 3 0 0 0 10 7v3h8.2c.7 0 1.3.6 1.3 1.3v7.4c0 .7-.6 1.3-1.3 1.3H5.8c-.7 0-1.3-.6-1.3-1.3v-7.4c0-.7.6-1.3 1.3-1.3H8Z"/></svg>',
                minimize: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11h14v2H5v-2Z"/></svg>'
            };

            function setIconButton(button, iconName, label) {
                if (!button) return;
                button.innerHTML = UI_ICONS[iconName] || '';
                button.setAttribute('aria-label', label);
                button.title = label;
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

                    const actions = document.createElement('div');
                    actions.className = 'motion-layer-actions';
                    ['up', 'down'].forEach(direction => {
                        const button = document.createElement('button');
                        button.type = 'button';
                        button.id = `motion-move-${direction}-${layerKey}`;
                        button.className = 'motion-layer-icon-btn motion-layer-reorder-btn';
                        button.textContent = direction === 'up' ? '▲' : '▼';
                        button.title = `${direction === 'up' ? 'Move layer up' : 'Move layer down'}.`;
                        actions.appendChild(button);
                    });
                    ['randomize-text', 'unlock'].forEach(actionKey => {
                        const button = document.getElementById(`motion-${actionKey}-${layerKey}`);
                        if (!button) return;
                        button.classList.add('preset-action-btn', 'motion-layer-text-action');
                        button.classList.remove('pink-action');
                        button.textContent = actionKey === 'unlock' ? 'Unlock' : 'Randomize';
                        actions.appendChild(button);
                    });
                    const deleteButton = document.createElement('button');
                    deleteButton.type = 'button';
                    deleteButton.id = `motion-delete-${layerKey}`;
                    deleteButton.className = 'motion-layer-icon-btn motion-layer-delete-btn';
                    deleteButton.textContent = 'X';
                    deleteButton.title = 'Delete layer.';
                    actions.appendChild(deleteButton);
                    if (actions.children.length) header.appendChild(actions);

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
                    const gridColorControl = document.getElementById(`dot-${layerKey}-grid-color`)?.closest('.compact-color');
                    if (gridColorControl && !document.getElementById(`dot-${layerKey}-mid-color`)) {
                        const midColorControl = gridColorControl.cloneNode(true);
                        midColorControl.querySelector('.compact-color-label').textContent = 'Mid';
                        const picker = midColorControl.querySelector('input[type="color"]');
                        const hex = midColorControl.querySelector('input[type="text"]');
                        if (picker) {
                            picker.id = `dot-${layerKey}-mid-color`;
                            picker.value = '#ffffff';
                        }
                        if (hex) {
                            hex.id = `dot-${layerKey}-mid-color-hex`;
                            hex.value = '#ffffff';
                        }
                        gridColorControl.insertAdjacentElement('afterend', midColorControl);
                    }
                    colorRow?.querySelectorAll('.compact-color').forEach(colorControl => topRow.appendChild(colorControl));

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
                selectButtons: ALL_DOT_LAYER_KEYS.reduce((acc, layerKey) => {
                    acc[layerKey] = document.getElementById(`grid-select-layer-${layerKey}`);
                    return acc;
                }, {}),
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
                unlockAll: document.getElementById('matrix-unlock-all'),
                addAbove: document.getElementById('matrix-add-above'),
                addBelow: document.getElementById('matrix-add-below'),
                rename: document.getElementById('matrix-rename-layer'),
                delete: document.getElementById('matrix-delete-layer'),
                status: document.getElementById('matrix-status'),
                layers: ALL_DOT_LAYER_KEYS.reduce((acc, layerKey) => {
                    acc[layerKey] = {
                        drawer: document.getElementById(`motion-drawer-${layerKey}`),
                        trigger: document.getElementById(`motion-trigger-${layerKey}`),
                        toggle: document.getElementById(`motion-toggle-layer-${layerKey}`),
                        randomize: document.getElementById(`motion-randomize-${layerKey}`),
                        randomizeText: document.getElementById(`motion-randomize-text-${layerKey}`),
                        unlock: document.getElementById(`motion-unlock-${layerKey}`),
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
            const blinkControls = {
                enabled: document.getElementById('blink-enabled'),
                visibilityOn: document.getElementById('blink-visibility-on'),
                visibilityOff: document.getElementById('blink-visibility-off'),
                visibilityRandomness: document.getElementById('blink-visibility-randomness'),
                visibilityProbability: document.getElementById('blink-visibility-probability'),
                randomize: document.getElementById('blink-randomize-btn'),
                unlock: document.getElementById('blink-unlock-btn'),
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
                enabled: document.getElementById('mask-enabled'),
                status: document.getElementById('mask-status'),
                expansion: document.getElementById('mask-expansion'),
                scaleTime: document.getElementById('mask-scale-time'),
                samples: document.getElementById('mask-samples'),
                speedThreshold: document.getElementById('mask-speed-threshold'),
                gridThreshold: document.getElementById('mask-grid-threshold')
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

            const slideControlControls = {
                drawer: document.getElementById('drawer-slide-control'),
                trigger: document.getElementById('drawer-trigger-slide-control'),
                summary: document.getElementById('slide-control-summary'),
                counts: document.getElementById('slide-control-counts'),
                countTotal: document.getElementById('slide-count-total'),
                countSvg: document.getElementById('slide-count-svg'),
                countMedia: document.getElementById('slide-count-media'),
                currentStatus: document.getElementById('slide-current-status'),
                currentProperties: document.getElementById('slide-current-properties'),
                grid: document.getElementById('slide-button-grid')
            };

            const imageMaskControls = {
                enabled: document.getElementById('image-mask-enabled'),
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
                randomize: document.getElementById('flicker-randomize-btn'),
                unlock: document.getElementById('flicker-unlock-btn'),
                currentTime: document.getElementById('transition-current-time'),
                travelTime: document.getElementById('transition-travel-time'),
                gridTime: document.getElementById('transition-grid-time'),
                flickerTime: document.getElementById('transition-flicker-time'),
                flickerBias: document.getElementById('transition-flicker-bias'),
                flickerSpeed: document.getElementById('transition-flicker-speed'),
                flickerBalance: document.getElementById('transition-flicker-balance'),
                flickerWildness: document.getElementById('transition-flicker-wildness')
            };

            const presetSelect = document.getElementById('preset-select');
            const presetApplyBtn = document.getElementById('preset-apply-btn');
            const presetAddBtn = document.getElementById('preset-add-btn');
            const presetDeleteBtn = document.getElementById('preset-delete-btn');
            const presetExportBtn = document.getElementById('preset-export-btn');
            const presetImportBtn = document.getElementById('preset-import-btn');
            const presetImportFile = document.getElementById('preset-import-file');
            const presetStatus = document.getElementById('preset-status');
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
            const read = input => parseFloat(input.value);
            const readInt = input => parseInt(input.value, 10);
            const readStateFloat = (value, fallback) => {
                const parsed = parseFloat(value);
                return Number.isFinite(parsed) ? parsed : fallback;
            };
            const isTypingTarget = el => el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

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
                if (viewControls.scale) {
                    viewControls.scale.value = String(next);
                    updateRangeIndicator(viewControls.scale);
                }
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

            function overlayMetric(label, value) {
                return `<span>${escapeOverlayText(label)}</span> <span class="overlay-value">${escapeOverlayText(value)}</span>`;
            }

            function renderOverlayLine(label, value) {
                return `<div class="overlay-line">${overlayMetric(label, value)}</div>`;
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
                const frameCap = clamp(parseInt(viewControls.frameRate?.value, 10) || 60, 30, 120);
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
                            realtimeParts.push(renderOverlayLine('FPS', `${overlayFrameStats.fps} / worst ${overlayFrameStats.worst}`));
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
                if (overlayRuntimeRefreshElapsed < 0.25) return;
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

            function interpolateMidRgbColor(start, mid, end, amount) {
                const t = clamp(amount, 0, 1);
                if (t <= 0.5) return interpolateRgbColor(start, mid, smoothstep(0, 1, t / 0.5));
                return interpolateRgbColor(mid, end, smoothstep(0, 1, (t - 0.5) / 0.5));
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

            function approachValue(current, target, duration, deltaTime) {
                if (duration <= 0.01) return target;
                const step = deltaTime / duration;
                if (current < target) return Math.min(target, current + step);
                return Math.max(target, current - step);
            }

            function updateRangeIndicator(slider) {
                const valueIdAliases = {};
                const indicator = document.getElementById(valueIdAliases[slider.id] || `val-${slider.id}`);
                if (!indicator) return;
                const suffix = slider.id.includes('opacity') || slider.id === 'slide-scale' || slider.id === 'image-slide-scale' || slider.id === 'view-scale' ? '%' : '';
                indicator.textContent = slider.value + suffix;
                indicator.dataset.prevValue = indicator.textContent;
            }

            function bindAllRangeDisplays() {
                document.querySelectorAll('input[type="range"]').forEach(slider => {
                    slider.addEventListener('input', () => updateRangeIndicator(slider));
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
                'dot-pull': 'Strength pulling dots into SVG targets.',
                'dot-svg-radius': 'Distance where SVG targets affect dots.',
                'dot-return-pull': 'Strength pulling dots back to grid.',
                'dot-grid-radius': 'Distance where grid homes affect dots.',
                'dot-speed-limit': 'Maximum dot speed.',
                'dot-mass': 'Dot weight and response lag.',
                'dot-friction': 'Motion damping.',
                'dot-elasticity': 'Stick on the low end; fly by on the high end.',
                'dot-orbit': 'Sideways swirl around targets.',
                'dot-shuffle': 'Random target reassignment.',
                'dot-variation': 'Per-dot motion variation.',
                'dot-grid-size': 'Dot size at grid rest.',
                'dot-mid-size': 'Dot size mid-transition.',
                'dot-target-size': 'Dot size on SVG targets.',
                'dot-speed-size': 'Size added by dot speed.',
                'grid-cols': 'Grid columns for this layer.',
                'grid-rows': 'Grid rows for this layer.',
                'grid-spacing': 'Distance between grid dots.',
                'grid-offset-x': 'Move this grid layer horizontally.',
                'grid-offset-y': 'Move this grid layer vertically.',
                'view-scale': 'Preview zoom only. It does not resize the canvas, grid, image, or SVG coordinates.',
                'stage-width': 'Canvas width in shared stage coordinates.',
                'stage-height': 'Canvas height in shared stage coordinates.',
                'mask-expansion': 'Expand the painted SVG mask outward.',
                'mask-scale-time': 'Seconds used for masked dots to shrink out or grow back during slide changes.',
                'image-mask-expansion': 'Expand the image slide mask outward from the rectangle edges.',
                'image-mask-scale-time': 'Seconds used for image-slide masked dots to shrink out or grow back.',
                'mask-samples': 'Legacy mask setting kept for older presets.',
                'mask-speed-threshold': 'Legacy mask setting kept for older presets.',
                'mask-grid-threshold': 'Legacy mask setting kept for older presets.',
                'slide-auto-duration': 'Seconds between automatic slide advances.',
                'transition-current-time': 'Time dots spend locking onto the current slide before it flickers out.',
                'transition-travel-time': 'Time dots spend traveling toward the next slide while artwork is hidden.',
                'transition-grid-time': 'Time dots spend relaxing back from the new slide into the grid.',
                'transition-flicker-time': 'Length of flicker phase.',
                'transition-flicker-bias': 'Favor old-out or new-in.',
                'transition-flicker-speed': 'Flicker pulses per second.',
                'transition-flicker-balance': 'Visible vs hidden ratio.',
                'transition-flicker-wildness': 'Randomness in flicker timing.',
                'image-scale': 'Image size behind the dots.',
                'image-offset-x': 'Move image left or right.',
                'image-offset-y': 'Move image up or down.',
                'bg-cycle-speed': 'Canvas color cycle speed.',
                'view-frame-rate': 'Animation frame cap.',
                'blink-visibility-on': 'Visible time per blink cycle.',
                'blink-visibility-off': 'Hidden time per blink cycle.',
                'blink-visibility-randomness': 'Timing variation per dot.',
                'blink-visibility-probability': 'Dots included in blink.'
            };

            const MODULE_TOOLTIPS = {
                'drawer-trigger-dot-matrix': 'Layered dot motion, size, and color.',
                'drawer-trigger-grid': 'Dot count, spacing, and layer offsets.',
                'drawer-trigger-blink-mode': 'Shared dot visibility across all grids.',
                'drawer-trigger-slides': 'SVG artwork used as dot targets.',
                'drawer-trigger-image-slides': 'Media slides used as rectangular dot targets.',
                'drawer-trigger-slide-control': 'Direct slide navigation and current slide inspection.',
                'drawer-trigger-flicker': 'Glitch timing between slides.',
                'drawer-trigger-background': 'Canvas color, canvas size, app backdrop, and optional image layer.',
                'drawer-trigger-help': 'Manual for controls, shortcuts, and workflow.',
                'drawer-trigger-presets': 'Save and restore full scene settings.',
                'drawer-trigger-view-options': 'Preview scale, frame cap, fullscreen, and info overlay.'
            };

            const SECTION_TOOLTIPS = {
                'SVG Mask': 'Hide grid homes inside or near painted SVG artwork.',
                'Image Mask': 'Hide grid homes inside the active media rectangle.',
                'Media Mask': 'Hide grid homes inside the active media rectangle.',
                'Transition Path': 'Dot movement phases: hold current, move to next, then return to grid.',
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
                'mask-enabled': 'Hide grid-home dots inside the active SVG.',
                'image-mask-enabled': 'Hide grid-home dots inside the active media rectangle.',
                'view-overlay-opacity': 'Set info overlay opacity. 0% hides it and stops overlay runtime refresh.',
                'media-transition-mode': 'Choose how transitions behave when the current slide is media.',
                'panel-toggle': 'Open both control panels.',
                'minimize-btn': 'Hide both control panels.',
                'header-prev-btn': 'Previous slide.',
                'header-hold-btn': 'Hold to attract dots to the current slide.',
                'header-next-btn': 'Next slide.',
                'header-auto-btn': 'Automatically advance to the next slide every 4 seconds.',
                'matrix-open-all': 'Open all Grid Layer drawers.',
                'matrix-collapse-all': 'Collapse all Grid Layer drawers.',
                'matrix-add-above': 'Create a copy above the selected grid layer.',
                'matrix-add-below': 'Create a copy below the selected grid layer.',
                'matrix-randomize-all': 'Randomize unlocked values across all grid layers.',
                'matrix-unlock-all': 'Unlock every locked grid-layer value.',
                'matrix-rename-layer': 'Rename the selected grid layer.',
                'matrix-delete-layer': 'Delete the selected grid layer.',
                'blink-randomize-btn': 'Randomize unlocked blink timing values.',
                'blink-unlock-btn': 'Unlock all blink timing values.',
                'flicker-randomize-btn': 'Randomize unlocked flicker values.',
                'flicker-unlock-btn': 'Unlock all flicker values.',
                'grid-apply-all': 'Apply the selected grid layout to every active layer.',
                'preset-apply-btn': 'Apply the selected full-scene preset to the canvas.',
                'preset-add-btn': 'Save the current settings as a new preset.',
                'preset-delete-btn': 'Delete the selected preset unless it is the last one.',
                'preset-export-btn': 'Export the current preset list to JSON.',
                'preset-import-btn': 'Import a saved TEN26 preset JSON file.',
                'preset-import-file': 'Import a saved TEN26 preset JSON file.',
                'view-fit-btn': 'Fit the full canvas inside the current browser window.',
                'fullscreen-enter-btn': 'Enter browser fullscreen mode.',
                'fullscreen-exit-btn': 'Exit browser fullscreen mode.'
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
                    'speed-size': 'Size added by speed.'
                }).forEach(([suffix, tip]) => {
                    SLIDER_TOOLTIPS[`dot-${layerKey}-${suffix}`] = `${label}: ${tip}`;
                });
                CONTROL_TOOLTIPS[`grid-select-layer-${layerKey}`] = `Edit the ${label} grid layout controls.`;
                CONTROL_TOOLTIPS[`dot-${layerKey}-target-type`] = `${label}: SVG points this layer follows.`;
                CONTROL_TOOLTIPS[`motion-trigger-${layerKey}`] = `${label} layer motion physics.`;
                CONTROL_TOOLTIPS[`motion-toggle-layer-${layerKey}`] = `Show or hide the ${label} grid layer.`;
                CONTROL_TOOLTIPS[`motion-randomize-${layerKey}`] = `${label}: randomize unlocked motion values.`;
                CONTROL_TOOLTIPS[`motion-randomize-text-${layerKey}`] = `${label}: randomize unlocked motion values.`;
                CONTROL_TOOLTIPS[`motion-unlock-${layerKey}`] = `${label}: unlock all motion values.`;
                CONTROL_TOOLTIPS[`motion-delete-${layerKey}`] = `${label}: delete this layer.`;
            });

            function applySliderTooltips() {
                document.querySelectorAll('input[type="range"]').forEach(slider => {
                    const label = slider.closest('.slider-group')?.querySelector('span')?.textContent?.trim() || slider.id;
                    const tip = SLIDER_TOOLTIPS[slider.id] || `Adjusts ${label.toLowerCase()}.`;
                    const group = slider.closest('.slider-group');
                    if (!group) return;
                    delete group.dataset.tooltip;
                    group.title = tip;
                    slider.title = tip;
                    const labelNode = group.querySelector('span');
                    if (labelNode) labelNode.title = tip;
                });
            }

            function readableControlName(node) {
                if (!node) return 'control';
                const text = node.getAttribute('aria-label')
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
                        node.title = directTip;
                        return;
                    }
                    if (node.matches?.('[data-view-scale]')) {
                        node.title = `Set preview scale to ${node.dataset.viewScale}%.`;
                        return;
                    }
                    if (node.classList?.contains('layer-tab')) {
                        node.title = `Edit the ${readableControlName(node)} grid layout controls.`;
                        return;
                    }
                    if (node.classList?.contains('section-title')) {
                        node.title = SECTION_TOOLTIPS[readableControlName(node)] || readableControlName(node);
                        return;
                    }
                    if (node.classList?.contains('drawer-trigger')) {
                        node.title = readableControlName(node);
                        return;
                    }
                    if (node.classList?.contains('motion-layer-trigger')) {
                        node.title = readableControlName(node);
                        return;
                    }
                    if (node.title) return;
                    if (node.matches?.('select')) {
                        node.title = 'Select how this visual system behaves.';
                        return;
                    }
                    if (node.matches?.('input[type="file"]')) {
                        node.title = CONTROL_TOOLTIPS[node.closest('.file-upload-wrapper')?.querySelector('.file-upload-btn')?.id] || 'Load source artwork.';
                        return;
                    }
                    if (node.classList?.contains('checkbox-switch')) {
                        const linkedInput = node.previousElementSibling;
                        node.title = CONTROL_TOOLTIPS[linkedInput?.id] || 'Enable or disable this visual effect.';
                        return;
                    }
                    if (node.matches?.('input[type="color"], input[type="text"]')) {
                        node.title = 'Color value used by the visual.';
                        return;
                    }
                    if (node.matches?.('input[type="checkbox"]')) {
                        node.title = 'Enable or disable this visual effect.';
                        return;
                    }
                    node.title = readableControlName(node);
                });
            }

            function bindColorPair(picker, hex, onChange = () => {}) {
                if (!picker || !hex) return;
                picker.addEventListener('input', () => {
                    hex.value = picker.value;
                    syncDotColorSwatchState(hex);
                    onChange();
                });
                hex.addEventListener('input', () => {
                    if (/^#[0-9a-f]{6}$/i.test(hex.value)) {
                        picker.value = hex.value.toLowerCase();
                        hex.value = picker.value;
                        syncDotColorSwatchState(hex);
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
                        button.title = `Set dot color ${color}`;
                        button.setAttribute('aria-label', `Set dot color ${color}`);
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
                            indicator.textContent = indicator.dataset.prevValue || slider.value;
                        } else {
                            const min = parseFloat(slider.min);
                            const max = parseFloat(slider.max);
                            const step = parseFloat(slider.step) || 1;
                            value = Math.round(value / step) * step;
                            slider.value = clamp(value, min, max);
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
                    capture: '25',
                    shuffle: '0',
                    variation: '0',
                    returnPull: '0.38',
                    pull: '0.7',
                    svgRadius: '320',
                    svgRadiusMotion: '0',
                    gridRadius: PRESET_GRID_RADIUS,
                    gridRadiusMotion: '0',
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
                    visibilityRespawn: '0',
                    snapDistance: '1.5',
                    gridColor: meta.defaultColor,
                    midColor: meta.defaultColor,
                    targetColor: meta.defaultColor,
                    colorMidpoint: '0.5',
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

            function syncLayerRegistryUi() {
                const activeLabel = getLayerLabel(activeLayerKey);
                ALL_DOT_LAYER_KEYS.forEach(layerKey => {
                    const active = DOT_LAYER_KEYS.includes(layerKey);
                    const order = active ? DOT_LAYER_KEYS.indexOf(layerKey) + 1 : 99;
                    const label = getLayerLabel(layerKey);
                    const motionControls = motionLayerControls.layers[layerKey];
                    const gridLayerControls = gridControls.layers[layerKey];
                    if (motionControls?.drawer) {
                        motionControls.drawer.hidden = !active;
                        motionControls.drawer.style.order = String(order);
                    }
                    const triggerLabel = motionControls?.trigger?.querySelector('.motion-layer-name, span');
                    if (triggerLabel) triggerLabel.textContent = label;
                    if (motionControls?.trigger) motionControls.trigger.title = `${label} layer motion physics.`;
                    if (gridControls.selectButtons[layerKey]) {
                        gridControls.selectButtons[layerKey].hidden = !active;
                        gridControls.selectButtons[layerKey].style.order = String(order);
                        gridControls.selectButtons[layerKey].textContent = label;
                    }
                    if (gridLayerControls?.content) gridLayerControls.content.hidden = !active;
                });
                const canAdd = DOT_LAYER_KEYS.length < ALL_DOT_LAYER_KEYS.length;
                setButtonActionable(motionLayerControls.addAbove, canAdd);
                setButtonActionable(motionLayerControls.addBelow, canAdd);
                setButtonActionable(motionLayerControls.delete, DOT_LAYER_KEYS.length > 1);
                if (motionLayerControls.rename) setButtonActionable(motionLayerControls.rename, DOT_LAYER_KEYS.length > 0);
                if (motionLayerControls.addAbove) {
                    motionLayerControls.addAbove.textContent = 'Copy Above';
                    motionLayerControls.addAbove.title = `Create a copy ABOVE ${activeLabel}`;
                }
                if (motionLayerControls.addBelow) {
                    motionLayerControls.addBelow.textContent = 'Copy Bellow';
                    motionLayerControls.addBelow.title = `Create a copy BELOW ${activeLabel}`;
                }
                if (motionLayerControls.rename) {
                    motionLayerControls.rename.textContent = 'Rename';
                    motionLayerControls.rename.title = `Rename ${activeLabel}`;
                }
                if (motionLayerControls.delete) {
                    motionLayerControls.delete.textContent = 'Delete';
                    motionLayerControls.delete.title = `Delete ${activeLabel}`;
                }
                DOT_LAYER_KEYS.forEach((layerKey, index) => {
                    const controls = motionLayerControls.layers[layerKey];
                    setButtonActionable(controls?.moveUp, index > 0);
                    setButtonActionable(controls?.moveDown, index < DOT_LAYER_KEYS.length - 1);
                    setButtonActionable(controls?.deleteLayer, DOT_LAYER_KEYS.length > 1);
                });
                if (motionLayerControls.status) {
                    motionLayerControls.status.textContent = `${DOT_LAYER_KEYS.length} layer${DOT_LAYER_KEYS.length === 1 ? '' : 's'} active. Selected: ${getLayerLabel(activeLayerKey)}.`;
                }
            }

            function createLayerName() {
                let index = DOT_LAYER_KEYS.length + 1;
                const names = new Set(DOT_LAYER_KEYS.map(layerKey => dotLayerStates[layerKey]?.name).filter(Boolean));
                while (names.has(`Layer ${index}`)) index += 1;
                return `Layer ${index}`;
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

            function addLayerRelative(position = 'below') {
                const layerKey = getUnusedLayerKey();
                if (!layerKey) {
                    if (typeof showUiToast === 'function') showUiToast('Layer limit reached for this build.', 'warning');
                    return;
                }
                persistGridLayerControls(activeLayerKey, { rebuildGrid: false, retarget: false });
                persistMotionLayerControls(activeLayerKey, { retarget: false });
                const activeIndex = Math.max(0, DOT_LAYER_KEYS.indexOf(activeLayerKey));
                const insertIndex = position === 'above' ? activeIndex : activeIndex + 1;
                const sourceLayerKey = activeLayerKey;
                const sourceLabel = getLayerLabel(sourceLayerKey);
                const sourceState = dotLayerStates[sourceLayerKey] || createDefaultLayerState(sourceLayerKey);
                const copiedState = {
                    ...sourceState,
                    name: createLayerCopyName(sourceState.name || sourceLabel),
                    visibilityRespawn: '0'
                };
                dotLayerStates[layerKey] = createDefaultLayerState(layerKey, {
                    ...copiedState
                });
                dotLayerStates[layerKey] = coerceLayerStateForV12(dotLayerStates[layerKey], copiedState);
                copyRandomRangeStateForLayer(sourceLayerKey, layerKey);
                invalidateLayerRuntimeConfig(layerKey);
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
                    return;
                }
                layerRuntimeConfigCache = {};
            }

            function getLayerRuntimeConfig(layerKey) {
                const state = dotLayerStates[layerKey] || createDefaultLayerState(layerKey);
                const cached = layerRuntimeConfigCache[layerKey];
                if (cached?.source === state) return cached.config;
                const meta = DOT_LAYER_META[layerKey] || DOT_LAYER_META[DEFAULT_LAYER_KEY];
                const flyBy = clamp(readStateFloat(state.elasticity, 45), 0, 100);
                const legacyCapture = clamp(100 - flyBy, 0, 100);
                const targetType = normalizeTargetType(state.targetType || state.targetTypes);
                const gridColor = normalizeHexColor(state.gridColor, meta.defaultColor);
                const midColor = normalizeHexColor(state.midColor, gridColor);
                const targetColor = normalizeHexColor(state.targetColor, midColor);
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
                    capture: legacyCapture,
                    returnPull: clamp(readStateFloat(state.returnPull, 0.38), 0.01, 0.6),
                    pull: readStateFloat(state.pull, 0.7),
                    svgRadius: readStateFloat(state.svgRadius, 320),
                    svgRadiusMotion: readStateFloat(state.svgRadiusMotion, 0),
                    gridRadius: readStateFloat(state.gridRadius, 1600),
                    gridRadiusMotion: readStateFloat(state.gridRadiusMotion, 0),
                    orbit: readStateFloat(state.orbit, 0),
                    shuffle: readStateFloat(state.shuffle, 0),
                    variation: readStateFloat(state.variation, 0),
                    gridSize: clamp(readStateFloat(state.gridSize, 2.5), 0.5, MAX_DOT_SIZE),
                    midSize: clamp(readStateFloat(state.midSize, readStateFloat(state.gridSize, 2.5)), 0.5, MAX_DOT_SIZE),
                    targetSize: clamp(readStateFloat(state.targetSize, 2.5), 0.5, MAX_DOT_SIZE),
                    sizeMidpoint: clamp(readStateFloat(state.sizeMidpoint, 0.5), 0.05, 0.95),
                    speedSize: readStateFloat(state.speedSize, 0),
                    snapDistance: readStateFloat(state.snapDistance, 1.5),
                    gridColor,
                    midColor,
                    targetColor,
                    gridRgb: hexToRgb(gridColor),
                    midRgb: hexToRgb(midColor),
                    targetRgb: hexToRgb(targetColor),
                    sameColor: gridColor === midColor && midColor === targetColor,
                    idleMotion: state.idleMotion,
                    idleSteps: parseInt(state.idleSteps, 10) || 0,
                    idleSpeed: readStateFloat(state.idleSpeed, 0),
                    idleRandom: readStateFloat(state.idleRandom, 0),
                    visibilityEnabled: state.visibilityEnabled === true || state.visibilityEnabled === 'true',
                    visibilityOn: readStateFloat(state.visibilityOn, 7),
                    visibilityOff: readStateFloat(state.visibilityOff, 3),
                    visibilityRandomness: readStateFloat(state.visibilityRandomness, 100),
                    visibilityProbability: readStateFloat(state.visibilityProbability, 70),
                    visibilityRespawn: 0
                };
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
                control.value = value;
                if (control.type === 'range') updateRangeIndicator(control);
                if (control.type === 'range') syncRandomRangeVisual(control);
            }

            const randomRangeControlState = {};
            const randomLockedControlIds = new Set();
            const MOTION_RANDOM_CONTROL_KEYS = [
                'pull', 'svgRadius', 'returnPull', 'gridRadius', 'speedLimit',
                'mass', 'friction', 'elasticity',
                'orbit', 'shuffle', 'variation',
                'gridSize', 'midSize', 'targetSize', 'speedSize'
            ];
            const BLINK_RANDOM_CONTROL_KEYS = [
                'visibilityOn', 'visibilityOff', 'visibilityRandomness', 'visibilityProbability'
            ];
            function isRandomizableRangeControl(control) {
                return !!control?.id &&
                    control.type === 'range' &&
                    !!control.closest('#motion-matrix-panel .motion-layer-content, #drawer-blink-mode, #drawer-auto-transition');
            }

            function getRangeBounds(control) {
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
                let value = snapControlNumber(control, control.value);
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
                    control.value = formatControlNumber(control, value);
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

            function syncRandomRangeVisual(control) {
                if (!isRandomizableRangeControl(control) || !control.dataset.randomRangeInstalled) return;
                const range = normalizeRandomRangeControl(control);
                if (!range) return;
                const wrap = control.closest('.random-range-wrap');
                const group = control.closest('.slider-group');
                if (!wrap) return;
                const minPct = getRangePercent(range.randomMin, range.min, range.max);
                const valuePct = getRangePercent(range.value, range.min, range.max);
                const maxPct = getRangePercent(range.randomMax, range.min, range.max);
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
                const current = snapControlNumber(control, control.value);
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
                    thumb.title = side === 'min' ? 'Minimum randomization value' : 'Maximum randomization value';
                    thumb.setAttribute('aria-label', thumb.title);
                    thumb.addEventListener('pointerdown', event => beginRandomLimitDrag(event, control, side));
                    wrap.appendChild(thumb);
                });
                control.addEventListener('input', () => {
                    normalizeRandomRangeControl(control, { clampValue: true });
                    syncRandomRangeVisual(control);
                });
                const reset = document.createElement('button');
                reset.type = 'button';
                reset.className = 'value-lock-btn random-range-reset-btn';
                reset.dataset.rangeControl = control.id;
                reset.textContent = '↔';
                reset.title = 'Reset randomization limits';
                reset.setAttribute('aria-label', 'Reset randomization limits');
                reset.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    resetRandomRangeLimits(control);
                });
                group.classList.add('has-random-range');
                group.appendChild(reset);
                normalizeRandomRangeControl(control);
                syncRandomRangeVisual(control);
            }

            function setupRandomRangeUi() {
                document.querySelectorAll('#motion-matrix-panel .motion-layer-content .slider-group input[type="range"], #drawer-blink-mode .slider-group input[type="range"], #drawer-auto-transition .slider-group input[type="range"]').forEach(setupRandomRangeControl);
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

            function getFlickerRandomControls() {
                return [
                    autoControls.currentTime,
                    autoControls.travelTime,
                    autoControls.gridTime,
                    autoControls.flickerTime,
                    autoControls.flickerBias,
                    autoControls.flickerSpeed,
                    autoControls.flickerBalance,
                    autoControls.flickerWildness
                ].filter(Boolean);
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
                    if (controls.randomize) setIconButton(controls.randomize, 'dice', 'Randomize motion layer');
                    if (controls.randomizeText) {
                        controls.randomizeText.textContent = 'Randomize';
                        controls.randomizeText.title = `Randomize ${label}`;
                    }
                    if (controls.unlock) {
                        controls.unlock.textContent = 'Unlock';
                        controls.unlock.title = `Unlock ${label}`;
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
                document.querySelectorAll('#motion-matrix-panel .motion-layer-content .slider-group input[type="range"], #drawer-blink-mode .slider-group input[type="range"], #drawer-auto-transition .slider-group input[type="range"]').forEach(control => {
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

            function updateActionAvailability() {
                const layerDrawers = DOT_LAYER_KEYS
                    .map(layerKey => motionLayerControls.layers[layerKey]?.drawer)
                    .filter(Boolean);
                const anyCollapsed = layerDrawers.some(drawer => drawer.classList.contains('collapsed'));
                const anyOpen = layerDrawers.some(drawer => !drawer.classList.contains('collapsed'));
                setButtonActionable(motionLayerControls.openAll, anyCollapsed);
                setButtonActionable(motionLayerControls.collapseAll, anyOpen);

                const hasAnyMotionLock = DOT_LAYER_KEYS.some(layerKey => hasLockedControls(getMotionRandomControls(layerKey)));
                setButtonActionable(motionLayerControls.unlockAll, hasAnyMotionLock);
                DOT_LAYER_KEYS.forEach(layerKey => {
                    setButtonActionable(getMotionLayerControls(layerKey).unlock, hasLockedControls(getMotionRandomControls(layerKey)));
                });
                setButtonActionable(blinkControls.unlock, hasLockedControls(getBlinkRandomControls()));
                setButtonActionable(autoControls.unlock, hasLockedControls(getFlickerRandomControls()));

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
                if (motionLayerControls.status) motionLayerControls.status.textContent = 'All active layers randomized together. Locked values were skipped.';
            }

            function randomizeAllBlinkLayers() {
                if (blinkControls.enabled) blinkControls.enabled.checked = true;
                getBlinkRandomControls().forEach(randomizeSliderControl);
                applyBlinkControlsToAllLayers();
                if (blinkControls.status) blinkControls.status.textContent = 'Blink randomized for all visible grid layers. Locked values were skipped.';
            }

            function unlockMotionLayer(layerKey) {
                getMotionRandomControls(layerKey).forEach(control => setControlRandomLocked(control, false));
                updateRandomLockButtons();
                if (motionLayerControls.status) motionLayerControls.status.textContent = `${getLayerLabel(layerKey)} values unlocked.`;
            }

            function unlockAllMotionLayers() {
                DOT_LAYER_KEYS.forEach(unlockMotionLayer);
                if (motionLayerControls.status) motionLayerControls.status.textContent = 'All layer values unlocked.';
            }

            function unlockAllBlinkLayers() {
                getBlinkRandomControls().forEach(control => setControlRandomLocked(control, false));
                updateRandomLockButtons();
                if (blinkControls.status) blinkControls.status.textContent = 'Blink values unlocked.';
            }

            function randomizeFlickerMorph() {
                getFlickerRandomControls().forEach(randomizeSliderControl);
                if (autoControls.status) autoControls.status.textContent = 'Flicker randomized. Locked values were skipped.';
            }

            function unlockFlickerMorph() {
                getFlickerRandomControls().forEach(control => setControlRandomLocked(control, false));
                updateRandomLockButtons();
                if (autoControls.status) autoControls.status.textContent = 'Flicker values unlocked.';
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
                    visibilityProbability: blinkControls.visibilityProbability?.value || '70'
                });
            }

            function syncBlinkControlsFromState(sourceLayerKey = activeLayerKey) {
                const state = forceBlinkRespawnState(dotLayerStates[sourceLayerKey] || dotLayerStates[DEFAULT_LAYER_KEY] || createDefaultLayerState(DEFAULT_LAYER_KEY));
                if (blinkControls.enabled) blinkControls.enabled.checked = state.visibilityEnabled === true || state.visibilityEnabled === 'true';
                setControlValue(blinkControls.visibilityOn, state.visibilityOn || '7');
                setControlValue(blinkControls.visibilityOff, state.visibilityOff || '3');
                setControlValue(blinkControls.visibilityRandomness, state.visibilityRandomness || '100');
                setControlValue(blinkControls.visibilityProbability, state.visibilityProbability || '70');
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
                return {
                    targetType,
                    targetTypes: [targetType],
                    mass: controls.mass?.value || current.mass,
                    friction: controls.friction?.value || current.friction,
                    speedLimit: controls.speedLimit?.value || current.speedLimit,
                    elasticity,
                    capture: String(clamp(100 - readStateFloat(elasticity, 45), 0, 100)),
                    returnPull: controls.returnPull?.value || current.returnPull,
                    pull: controls.pull?.value || current.pull,
                    svgRadius: controls.svgRadius?.value || current.svgRadius,
                    svgRadiusMotion: current.svgRadiusMotion || '0',
                    gridRadius: controls.gridRadius?.value || current.gridRadius,
                    gridRadiusMotion: current.gridRadiusMotion || '0',
                    orbit: controls.orbit?.value || current.orbit,
                    shuffle: controls.shuffle?.value || current.shuffle,
                    variation: controls.variation?.value || current.variation,
                    gridSize: controls.gridSize?.value || current.gridSize,
                    midSize: controls.midSize?.value || current.midSize,
                    targetSize: controls.targetSize?.value || current.targetSize,
                    sizeMidpoint: controls.sizeMidpoint?.value || current.sizeMidpoint,
                    speedSize: controls.speedSize?.value || current.speedSize,
                    colorMidpoint: '0.5',
                    ...blinkState,
                    snapDistance: current.snapDistance || '1.5',
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
            }

            function updateLayerSelectionUi() {
                ALL_DOT_LAYER_KEYS.forEach(layerKey => {
                    const label = getLayerLabel(layerKey);
                    const isRegistered = DOT_LAYER_KEYS.includes(layerKey);
                    const isActive = isRegistered && layerKey === activeLayerKey;
                    const isHidden = !!dotLayerStates[layerKey]?.hidden;
                    gridControls.selectButtons[layerKey]?.classList.toggle('active', isActive);
                    gridControls.selectButtons[layerKey]?.classList.toggle('hidden-state', isHidden);
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

            function setLayerTargetsFromSlide(layerKey, slideIndex, scaleMultiplier = 1) {
                const cfg = getLayerRuntimeConfig(layerKey);
                if (cfg.hidden) {
                    dotGroups[layerKey].returnToGrid();
                    return 0;
                }
                const targets = getSlideScreenTargets(slideIndex, cfg.targetTypes, getTotalGridDots(cfg), scaleMultiplier);
                dotGroups[layerKey].setAttractorTargets(targets);
                return targets.length ? 1 : 0;
            }

            function applyVisibleLayerTargetsForSlide(slideIndex, scaleMultiplier = 1, options = {}) {
                const { activateMask = true } = options;
                if (activateMask && typeof activateSlideMask === 'function') activateSlideMask(slideIndex, { sync: true });
                return DOT_LAYER_KEYS.reduce((count, layerKey) => count + setLayerTargetsFromSlide(layerKey, slideIndex, scaleMultiplier), 0);
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
            }
