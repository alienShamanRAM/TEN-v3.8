// TEN26 hardening layer: SVG sanitizing, safer presets, storage checks, and responsive panel CSS.
window.installTen26Hardening = function installTen26Hardening() {
    if (window.__TEN26_HARDENING_INSTALLED__) return;
    window.__TEN26_HARDENING_INSTALLED__ = true;

    const SAFE_SVG_ELEMENTS = new Set([
        'svg', 'g', 'defs', 'style', 'title', 'desc', 'symbol', 'use',
        'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
        'lineargradient', 'radialgradient', 'stop', 'clippath', 'mask', 'pattern',
        'text', 'tspan'
    ]);
    const SAFE_SVG_ATTRS = new Set([
        'id', 'class', 'style', 'viewbox', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
        'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'd', 'points',
        'transform', 'opacity', 'fill', 'fill-opacity', 'fill-rule', 'stroke',
        'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
        'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity', 'clip-path',
        'clip-rule', 'mask', 'filter', 'gradientunits', 'gradienttransform',
        'offset', 'stop-color', 'stop-opacity', 'xmlns', 'role', 'aria-label',
        'preserveaspectratio', 'font-family', 'font-size', 'font-weight',
        'letter-spacing', 'text-anchor', 'dominant-baseline', 'data-name'
    ]);
    const SAFE_HREF_ATTRS = new Set(['href', 'xlink:href']);

    function fallbackSvg() {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 150"></svg>';
    }

    function isSafeCss(css = '') {
        const text = String(css || '');
        if (/@import|expression\s*\(|javascript:|vbscript:|data:text\/html|-moz-binding/i.test(text)) return false;
        const urls = text.match(/url\(([^)]+)\)/gi) || [];
        return urls.every(url => /^url\(\s*['"]?#[-\w:.]+['"]?\s*\)$/i.test(url));
    }

    function isSafeReference(value = '') {
        const text = String(value || '').trim();
        if (!text) return true;
        if (/javascript:|vbscript:|data:text\/html/i.test(text)) return false;
        if (/^#[-\w:.]+$/.test(text)) return true;
        if (/^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(text)) return true;
        return false;
    }

    function isSafeAttributeValue(value = '') {
        const text = String(value || '');
        if (/javascript:|vbscript:|data:text\/html/i.test(text)) return false;
        const urls = text.match(/url\(([^)]+)\)/gi) || [];
        return urls.every(url => /^url\(\s*['"]?#[-\w:.]+['"]?\s*\)$/i.test(url));
    }

    function sanitizeSvgText(svgText) {
        const raw = String(svgText || '').trim();
        if (!raw) return fallbackSvg();
        let doc;
        try {
            doc = new DOMParser().parseFromString(raw, 'image/svg+xml');
        } catch (error) {
            return fallbackSvg();
        }
        const root = doc.documentElement;
        if (!root || root.nodeName.toLowerCase() === 'parsererror' || root.nodeName.toLowerCase() !== 'svg') return fallbackSvg();

        Array.from(root.querySelectorAll('*')).forEach(node => {
            const tag = node.nodeName.toLowerCase();
            if (!SAFE_SVG_ELEMENTS.has(tag)) {
                node.remove();
                return;
            }
            if (tag === 'style') {
                node.textContent = isSafeCss(node.textContent) ? node.textContent : '';
            }
        });

        [root, ...Array.from(root.querySelectorAll('*'))].forEach(node => {
            Array.from(node.attributes || []).forEach(attr => {
                const name = attr.name.toLowerCase();
                const value = attr.value;
                if (name.startsWith('on')) {
                    node.removeAttribute(attr.name);
                    return;
                }
                if (SAFE_HREF_ATTRS.has(name)) {
                    if (!isSafeReference(value)) node.removeAttribute(attr.name);
                    return;
                }
                if (name === 'style') {
                    if (!isSafeCss(value)) node.removeAttribute(attr.name);
                    return;
                }
                if (!SAFE_SVG_ATTRS.has(name) && !name.startsWith('data-') && !name.startsWith('aria-')) {
                    node.removeAttribute(attr.name);
                    return;
                }
                if (!isSafeAttributeValue(value)) node.removeAttribute(attr.name);
            });
        });

        root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        return new XMLSerializer().serializeToString(root);
    }

    window.TEN26SanitizeSvgText = sanitizeSvgText;

    if (typeof createSlide === 'function') {
        const originalCreateSlide = createSlide;
        createSlide = function createSanitizedSlide(name, svg, options) {
            return originalCreateSlide(name, sanitizeSvgText(svg), options);
        };
    }

    if (typeof ensureSlideTemplate === 'function') {
        ensureSlideTemplate = function ensureSanitizedSlideTemplate(slide) {
            if (!slide) return null;
            if (slide.type === 'image') {
                if (!slide.domTemplate) slide.domTemplate = document.createElement('template');
                return slide.domTemplate;
            }
            if (!slide.domTemplate) {
                const template = document.createElement('template');
                template.innerHTML = sanitizeSvgText(slide.svg);
                slide.domTemplate = template;
            }
            return slide.domTemplate;
        };
    }

    if (typeof buildFillPoints === 'function') {
        buildFillPoints = function buildBoundedFillPoints(slide, total) {
            const state = slide.geometry;
            const bounds = state.bounds;
            if (!state.root || !total || !state.fillItems.length || !bounds || bounds.width <= 0 || bounds.height <= 0) return [];
            let candidates = [];
            const area = Math.max(1, bounds.width * bounds.height);
            const startedAt = performance.now();
            const maxWorkMs = 28;
            const maxCandidates = Math.max(total * 6, 2400);
            for (let density = 2; density <= 64; density *= 2) {
                candidates = [];
                const step = Math.max(0.1, Math.sqrt(area / (total * density)));
                let row = 0;
                for (let y = bounds.top + step / 2; y <= bounds.bottom; y += step) {
                    const stagger = row % 2 ? step / 2 : 0;
                    for (let x = bounds.left + step / 2 + stagger; x <= bounds.right; x += step) {
                        const point = new state.scope.Point(x, y);
                        if (isInsideSlideFill(slide, point)) candidates.push(point);
                        if (candidates.length >= maxCandidates) break;
                    }
                    row++;
                    if (candidates.length >= maxCandidates) break;
                    if (performance.now() - startedAt > maxWorkMs && candidates.length >= total) break;
                }
                if (candidates.length >= total || performance.now() - startedAt > maxWorkMs) break;
            }
            return selectEvenly(candidates, total);
        };
    }

    if (typeof bindEvents === 'function') {
        const originalBindEvents = bindEvents;
        bindEvents = function bindEventsWithStartupGuard() {
            try {
                originalBindEvents();
            } catch (error) {
                console.error('TEN26 startup binding failed:', error);
                if (typeof showUiToast === 'function') showUiToast('Some controls could not start. The canvas will keep running.', 'warning');
            }
        };
    }

    const style = document.createElement('style');
    style.id = 'ten26-responsive-hardening';
    style.textContent = `
@media (max-width: 760px) {
    :root { --drawer-width: min(320px, calc(100vw - 24px)); --drawer-collapsed-width: 168px; }
    #control-panel { top: 12px; right: 12px; left: 12px; width: auto; max-height: min(46vh, calc(100vh - 24px)); padding: 12px; border-radius: 10px; }
    #grid-control-panel { top: calc(46vh + 24px); right: 12px; bottom: auto; left: 12px; width: auto; max-height: min(20vh, calc(100vh - 24px)); padding: 12px; border-radius: 10px; }
    #panel-toggle { top: 18px; right: 18px; z-index: 13; }
    .panel-header { grid-template-columns: 1fr; align-items: stretch; }
    .header-utility { justify-content: space-between; }
    .motion-matrix-panel { position: fixed; left: 12px; right: 12px; top: auto !important; bottom: 12px; width: auto; max-height: min(28vh, calc(100vh - 24px)) !important; overflow-y: auto; justify-content: flex-start; padding-bottom: 0; z-index: 11; }
    .motion-layer-drawer { width: 100%; min-width: 0; max-height: none; border-radius: 10px; }
    .motion-layer-drawer.collapsed { width: 100%; min-width: 0; }
    .slider-group, .slider-group.has-lock { grid-template-columns: 84px minmax(54px, 1fr) 40px 22px; }
    .slider-group:not(.has-lock) { grid-template-columns: 84px minmax(64px, 1fr) 40px; }
    .view-resolution-overlay { bottom: 8px; max-width: calc(100vw - 24px); }
    .ui-toast-region { right: 12px; bottom: 12px; max-width: calc(100vw - 24px); }
}
@media (max-width: 460px) {
    .preset-row { display: grid; grid-template-columns: 1fr auto; }
    .preset-action-row { grid-template-columns: 1fr; }
    .view-scale-grid { grid-template-columns: repeat(3, 1fr); }
    .matrix-action-row, .drawer-bottom-actions, .view-actions { grid-template-columns: 1fr; }
    .compact-color { grid-template-columns: 44px 28px minmax(0, 1fr) 22px; }
    .compact-color.dot-palette-control { grid-template-columns: 40px minmax(54px, 1fr) 58px 20px; }
}
`;
    document.head.appendChild(style);
};
