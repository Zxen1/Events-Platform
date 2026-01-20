/* ============================================================================
   SLACK BACKUP (TopSlack + BottomSlack)
   ----------------------------------------------------------------------------
   Purpose:
   - Standalone backup of the working Slack system (no "panel" naming, no hyphens)
   - Provides BottomSlack + TopSlack with the same behavior as the live components
   - Injects minimal CSS for `.bottomSlack` / `.topSlack` and uses CSS vars:
       --bottomSlack, --topSlack
   ----------------------------------------------------------------------------
   Usage (example):
     BottomSlack.attach(scrollEl, { stopDelayMs: 180, clickHoldMs: 250, scrollbarFadeMs: 160 });
     TopSlack.attach(scrollEl,    { stopDelayMs: 180, clickHoldMs: 250, scrollbarFadeMs: 160 });
   ============================================================================ */

/* ============================================================================
   BOTTOM SLACK
   ============================================================================ */

var BottomSlack = (function() {
    var STYLE_ID = 'bottomSlackStyle';
    var attached = new WeakMap(); // scrollEl -> controller
    var registered = []; // [{ panelEl, scrollEl, controller }]
    var tabListenerInstalled = false;

    function ensureStyle() {
        try {
            if (document.getElementById(STYLE_ID)) return;
            var style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent =
                '.bottomSlack{' +
                'height:var(--bottomSlack,0px);' +
                'flex:0 0 auto;' +
                'pointer-events:none;' +
                'transition:none;' +
                '}';
            document.head.appendChild(style);
        } catch (e) {}
    }

    function ensureSlackEl(scrollEl) {
        var slackEl = null;
        try { slackEl = scrollEl.querySelector('.bottomSlack'); } catch (e) { slackEl = null; }
        if (slackEl) return slackEl;
        try {
            slackEl = document.createElement('div');
            slackEl.className = 'bottomSlack';
            slackEl.setAttribute('aria-hidden', 'true');
            scrollEl.appendChild(slackEl);
        } catch (e2) {}
        return slackEl;
    }

    function installTabSwitchListener(tabSelector, panelSelector) {
        if (tabListenerInstalled) return;
        tabListenerInstalled = true;

        document.addEventListener('click', function(e) {
            var t = e && e.target;
            if (!t || !t.closest) return;
            var tabBtn = t.closest(tabSelector);
            if (!tabBtn) return;
            var panel = tabBtn.closest(panelSelector);
            if (!panel) return;

            for (var i = 0; i < registered.length; i++) {
                var r = registered[i];
                if (!r || !r.panelEl || !r.controller) continue;
                if (r.panelEl === panel) {
                    try { r.controller.forceOff(); } catch (e0) {}
                    return;
                }
            }
        }, true);
    }

    function attach(scrollEl, opts) {
        if (!(scrollEl instanceof Element)) {
            throw new Error('BottomSlack.attach: scrollEl must be an Element');
        }

        var existing = null;
        try { existing = attached.get(scrollEl); } catch (e0) { existing = null; }
        if (existing) return existing;

        opts = opts || {};
        ensureStyle();

        var stopDelayMs = (typeof opts.stopDelayMs === 'number') ? opts.stopDelayMs : 180;
        var clickHoldMs = (typeof opts.clickHoldMs === 'number') ? opts.clickHoldMs : 250;
        var scrollbarFadeMs = (typeof opts.scrollbarFadeMs === 'number') ? opts.scrollbarFadeMs : 160;

        var tabSelector = opts.tabSelector || '[role="tab"]';
        var panelSelector = opts.panelSelector || '.admin-panel, .member-panel';
        var enableForceOffOnTabs = (opts.enableForceOffOnTabs !== false);

        // STRICT RULE: only two slack sizes exist.
        var expandedSlackPx = 4000;
        var collapsedSlackPx = 0;

        var slackEl = ensureSlackEl(scrollEl);
        var unlockTimer = null;
        var locked = false;
        var clickHoldUntil = 0;
        var currentSlackPx = 0;
        var lastScrollTop = scrollEl.scrollTop || 0;
        var scrollbarFadeTimer = null;
        var pendingOffscreenCollapse = false;
        var internalAdjust = false;
        var pendingAnchor = null; // { el, topBefore }
        var anchorObserver = null;
        var anchorApplied = false;
        var anchorDirty = false;

        function fadeScrollbar() {
            try {
                scrollEl.classList.add('panel-scrollbar-fade');
                if (scrollbarFadeTimer) clearTimeout(scrollbarFadeTimer);
                scrollbarFadeTimer = setTimeout(function() {
                    try { scrollEl.classList.remove('panel-scrollbar-fade'); } catch (e) {}
                }, scrollbarFadeMs);
            } catch (e) {}
        }

        function applySlackPx(px) {
            if (px !== collapsedSlackPx && px !== expandedSlackPx) return;
            if (currentSlackPx === px) return;

            currentSlackPx = px;
            try { scrollEl.style.setProperty('--bottomSlack', String(px) + 'px'); } catch (e0) {}
            try { scrollEl.getBoundingClientRect(); } catch (e1) {}
            fadeScrollbar();
            try { lastScrollTop = scrollEl.scrollTop || 0; } catch (e2) {}
        }

        function isSlackOnScreen() {
            if (!slackEl) return false;
            try {
                var slackRect = slackEl.getBoundingClientRect();
                var scrollRect = scrollEl.getBoundingClientRect();
                return slackRect.top < scrollRect.bottom && slackRect.bottom > scrollRect.top;
            } catch (e) {
                return false;
            }
        }

        function isSlackOffscreenBelow() {
            if (!slackEl) return false;
            try {
                var slackRect = slackEl.getBoundingClientRect();
                var scrollRect = scrollEl.getBoundingClientRect();
                return slackRect.top >= scrollRect.bottom;
            } catch (e) {
                return false;
            }
        }

        function maybeCollapseOffscreen() {
            if (!pendingOffscreenCollapse) return;
            if (isSlackOnScreen()) return;
            pendingOffscreenCollapse = false;
            applySlackPx(collapsedSlackPx);
        }

        function requestCollapseOffscreen() {
            pendingOffscreenCollapse = true;
            maybeCollapseOffscreen();
        }

        // If slack is ON but sits below the viewport, collapse it before the user can ever scroll into it.
        function collapseIfOffscreenBelow() {
            try {
                if (currentSlackPx !== expandedSlackPx) return false;
                if (Date.now() < clickHoldUntil) return false;
                if (!isSlackOffscreenBelow()) return false;
                pendingOffscreenCollapse = false;
                applySlackPx(collapsedSlackPx);
                return true;
            } catch (e) {
                return false;
            }
        }

        function lock() {
            if (locked) return;
            var h = scrollEl.clientHeight || 0;
            if (h <= 0) return;
            if (Date.now() < clickHoldUntil) return;
            scrollEl.style.maxHeight = h + 'px';
            locked = true;
        }

        function unlock() {
            if (!locked) return;
            scrollEl.style.maxHeight = '';
            requestCollapseOffscreen();
            locked = false;
        }

        function startScrollBurst() {
            lock();
            if (unlockTimer) clearTimeout(unlockTimer);
            unlockTimer = setTimeout(unlock, stopDelayMs);
        }

        // Clicking: click-hold window + temporary slack ON.
        function holdClickSlack(e) {
            try {
                var t = e && e.target;
                if (t && t.closest && t.closest('[role="tab"]')) return;
            } catch (_eTab) {}

            // Disable per element/section.
            try {
                var t2 = e && e.target;
                if (t2 && t2.closest) {
                    var slackDisabled = t2.closest('[data-bottomslack="false"]');
                    if (slackDisabled) {
                        applySlackPx(collapsedSlackPx);
                        return;
                    }
                }
            } catch (_eAttr) {}

            try {
                var h = scrollEl.clientHeight || 0;
                var contentNoSlack = (scrollEl.scrollHeight || 0) - (currentSlackPx || 0);
                if (contentNoSlack <= h) {
                    try { if (isSlackOnScreen()) return; } catch (_eVis) {}
                    pendingOffscreenCollapse = false;
                    applySlackPx(collapsedSlackPx);
                    return;
                }
            } catch (e0) {}

            clickHoldUntil = Date.now() + clickHoldMs;
            applySlackPx(expandedSlackPx);
        }

        scrollEl.addEventListener('pointerdown', holdClickSlack, { passive: true, capture: true });
        scrollEl.addEventListener('click', holdClickSlack, { passive: true, capture: true });

        // Scroll handling
        function onScroll() {
            if (internalAdjust) return;
            try {
                var st = scrollEl.scrollTop || 0;
                // While slack is visible, do not allow downward scrolling (no snapping).
                if (st > lastScrollTop && isSlackOnScreen()) return;

                if (st > lastScrollTop) collapseIfOffscreenBelow();
                if (st === lastScrollTop) return;
                lastScrollTop = st;
            } catch (e) {}
            startScrollBurst();
            maybeCollapseOffscreen();
        }
        scrollEl.addEventListener('scroll', onScroll, { passive: true });

        // Wheel/trackpad: block downward scroll while slack is visible.
        scrollEl.addEventListener('wheel', function(e) {
            try {
                var deltaY = Number(e && e.deltaY) || 0;
                if (deltaY > 0) collapseIfOffscreenBelow();
                if (deltaY > 0 && isSlackOnScreen()) {
                    if (e && typeof e.preventDefault === 'function') e.preventDefault();
                    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                }
            } catch (e0) {}
            startScrollBurst();
        }, { passive: false });

        // Default: slack off.
        applySlackPx(collapsedSlackPx);

        var controller = {
            forceOff: function() {
                try { clickHoldUntil = 0; } catch (e0) {}
                try { pendingOffscreenCollapse = false; } catch (e1) {}
                try { applySlackPx(collapsedSlackPx); } catch (e2) {}
            }
        };

        // Track for tab switching force-off behavior.
        try {
            var panelEl = scrollEl.closest(panelSelector);
            registered.push({ panelEl: panelEl, scrollEl: scrollEl, controller: controller });
        } catch (e3) {}

        if (enableForceOffOnTabs) installTabSwitchListener(tabSelector, panelSelector);

        try { attached.set(scrollEl, controller); } catch (e4) {}
        return controller;
    }

    return {
        attach: attach
    };
})();

/* ============================================================================
   TOP SLACK
   ============================================================================ */

var TopSlack = (function() {
    var STYLE_ID = 'topSlackStyle';
    var attached = new WeakMap(); // scrollEl -> controller
    var registered = []; // [{ panelEl, scrollEl, controller }]
    var tabListenerInstalled = false;

    function ensureStyle() {
        try {
            if (document.getElementById(STYLE_ID)) return;
            var style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent =
                '.topSlack{' +
                'height:var(--topSlack,0px);' +
                'flex:0 0 auto;' +
                'pointer-events:none;' +
                'transition:none;' +
                '}';
            document.head.appendChild(style);
        } catch (e) {}
    }

    function ensureSlackEl(scrollEl) {
        var slackEl = null;
        try { slackEl = scrollEl.querySelector('.topSlack'); } catch (e) { slackEl = null; }
        if (slackEl) return slackEl;
        try {
            slackEl = document.createElement('div');
            slackEl.className = 'topSlack';
            slackEl.setAttribute('aria-hidden', 'true');
            scrollEl.insertBefore(slackEl, scrollEl.firstChild);
        } catch (e2) {}
        return slackEl;
    }

    function installTabSwitchListener(tabSelector, panelSelector) {
        if (tabListenerInstalled) return;
        tabListenerInstalled = true;

        document.addEventListener('click', function(e) {
            var t = e && e.target;
            if (!t || !t.closest) return;
            var tabBtn = t.closest(tabSelector);
            if (!tabBtn) return;
            var panel = tabBtn.closest(panelSelector);
            if (!panel) return;

            for (var i = 0; i < registered.length; i++) {
                var r = registered[i];
                if (!r || !r.panelEl || !r.controller) continue;
                if (r.panelEl === panel) {
                    try { r.controller.forceOff(); } catch (e0) {}
                    return;
                }
            }
        }, true);
    }

    function attach(scrollEl, opts) {
        if (!(scrollEl instanceof Element)) {
            throw new Error('TopSlack.attach: scrollEl must be an Element');
        }

        var existing = null;
        try { existing = attached.get(scrollEl); } catch (e0) { existing = null; }
        if (existing) return existing;

        opts = opts || {};
        ensureStyle();

        var stopDelayMs = (typeof opts.stopDelayMs === 'number') ? opts.stopDelayMs : 180;
        var clickHoldMs = (typeof opts.clickHoldMs === 'number') ? opts.clickHoldMs : 250;
        var scrollbarFadeMs = (typeof opts.scrollbarFadeMs === 'number') ? opts.scrollbarFadeMs : 160;

        var tabSelector = opts.tabSelector || '[role="tab"]';
        var panelSelector = opts.panelSelector || '.admin-panel, .member-panel';
        var enableForceOffOnTabs = (opts.enableForceOffOnTabs !== false);

        // STRICT RULE: only two slack sizes exist.
        var expandedSlackPx = 4000;
        var collapsedSlackPx = 0;

        var slackEl = ensureSlackEl(scrollEl);
        var unlockTimer = null;
        var locked = false;
        var clickHoldUntil = 0;
        var currentSlackPx = 0;
        var lastScrollTop = scrollEl.scrollTop || 0;
        var scrollbarFadeTimer = null;
        var pendingOffscreenCollapse = false;
        var internalAdjust = false;
        var pendingAnchor = null; // { el, topBefore }
        var anchorObserver = null;
        var anchorApplied = false;
        var anchorDirty = false;

        function fadeScrollbar() {
            try {
                scrollEl.classList.add('panel-scrollbar-fade');
                if (scrollbarFadeTimer) clearTimeout(scrollbarFadeTimer);
                scrollbarFadeTimer = setTimeout(function() {
                    try { scrollEl.classList.remove('panel-scrollbar-fade'); } catch (e) {}
                }, scrollbarFadeMs);
            } catch (e) {}
        }

        function applySlackPx(px) {
            if (px !== collapsedSlackPx && px !== expandedSlackPx) return;
            if (currentSlackPx === px) return;

            var oldPx = currentSlackPx;
            currentSlackPx = px;

            internalAdjust = true;
            try {
                if (px > oldPx) {
                    scrollEl.style.setProperty('--topSlack', String(px) + 'px');
                    scrollEl.scrollTop = (scrollEl.scrollTop || 0) + (px - oldPx);
                } else {
                    scrollEl.style.setProperty('--topSlack', String(px) + 'px');
                    var next = (scrollEl.scrollTop || 0) - (oldPx - px);
                    scrollEl.scrollTop = next < 0 ? 0 : next;
                }
            } catch (e0) {}
            internalAdjust = false;

            try { scrollEl.getBoundingClientRect(); } catch (e1) {}
            fadeScrollbar();
            try { lastScrollTop = scrollEl.scrollTop || 0; } catch (e2) {}
        }

        function isSlackOnScreen() {
            if (!slackEl) return false;
            try {
                var slackRect = slackEl.getBoundingClientRect();
                var scrollRect = scrollEl.getBoundingClientRect();
                return slackRect.top < scrollRect.bottom && slackRect.bottom > scrollRect.top;
            } catch (e) {
                return false;
            }
        }

        function isSlackOffscreenAbove() {
            if (!slackEl) return false;
            try {
                var slackRect = slackEl.getBoundingClientRect();
                var scrollRect = scrollEl.getBoundingClientRect();
                return slackRect.bottom <= scrollRect.top;
            } catch (e) {
                return false;
            }
        }

        function maybeCollapseOffscreen() {
            if (!pendingOffscreenCollapse) return;
            if (isSlackOnScreen()) return;
            pendingOffscreenCollapse = false;
            applySlackPx(collapsedSlackPx);
        }

        function requestCollapseOffscreen() {
            pendingOffscreenCollapse = true;
            maybeCollapseOffscreen();
        }

        // If slack is ON but sits above the viewport, collapse it before the user can ever scroll into it.
        function collapseIfOffscreenAbove() {
            try {
                if (currentSlackPx !== expandedSlackPx) return false;
                if (Date.now() < clickHoldUntil) return false;
                if (!isSlackOffscreenAbove()) return false;
                pendingOffscreenCollapse = false;
                applySlackPx(collapsedSlackPx);
                return true;
            } catch (e) {
                return false;
            }
        }

        function lock() {
            if (locked) return;
            var h = scrollEl.clientHeight || 0;
            if (h <= 0) return;
            if (Date.now() < clickHoldUntil) return;
            scrollEl.style.maxHeight = h + 'px';
            locked = true;
        }

        function unlock() {
            if (!locked) return;
            scrollEl.style.maxHeight = '';
            requestCollapseOffscreen();
            locked = false;
        }

        function startScrollBurst() {
            lock();
            if (unlockTimer) clearTimeout(unlockTimer);
            unlockTimer = setTimeout(unlock, stopDelayMs);
        }

        // Clicking: click-hold window + temporary slack ON.
        function holdClickSlack(e) {
            try {
                var t = e && e.target;
                if (t && t.closest && t.closest('[role="tab"]')) return;
            } catch (_eTab) {}

            // Disable per element/section.
            try {
                var t2 = e && e.target;
                if (t2 && t2.closest) {
                    var slackDisabled = t2.closest('[data-topslack="false"]');
                    if (slackDisabled) {
                        applySlackPx(collapsedSlackPx);
                        return;
                    }
                }
            } catch (_eAttr) {}

            try {
                var h = scrollEl.clientHeight || 0;
                var contentNoSlack = (scrollEl.scrollHeight || 0) - (currentSlackPx || 0);
                if (contentNoSlack <= h) {
                    try { if (isSlackOnScreen()) return; } catch (_eVis) {}
                    pendingOffscreenCollapse = false;
                    applySlackPx(collapsedSlackPx);
                    return;
                }
            } catch (e0) {}

            clickHoldUntil = Date.now() + clickHoldMs;
            applySlackPx(expandedSlackPx);
        }

        scrollEl.addEventListener('pointerdown', holdClickSlack, { passive: true, capture: true });
        scrollEl.addEventListener('click', holdClickSlack, { passive: true, capture: true });

        // Scroll handling
        function onScroll() {
            if (internalAdjust) return;
            try {
                var st = scrollEl.scrollTop || 0;
                // While slack is visible, do not allow upward scrolling (no snapping).
                if (st < lastScrollTop && isSlackOnScreen()) return;

                if (st < lastScrollTop) collapseIfOffscreenAbove();
                if (st === lastScrollTop) return;
                lastScrollTop = st;
            } catch (e) {}
            startScrollBurst();
            maybeCollapseOffscreen();
        }
        scrollEl.addEventListener('scroll', onScroll, { passive: true });

        // Wheel/trackpad: block upward scroll while slack is visible.
        scrollEl.addEventListener('wheel', function(e) {
            try {
                var deltaY = Number(e && e.deltaY) || 0;
                if (deltaY < 0) collapseIfOffscreenAbove();
                if (deltaY < 0 && isSlackOnScreen()) {
                    if (e && typeof e.preventDefault === 'function') e.preventDefault();
                    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                }
            } catch (e0) {}
            startScrollBurst();
        }, { passive: false });

        // Default: slack off.
        applySlackPx(collapsedSlackPx);

        var controller = {
            forceOff: function() {
                try { clickHoldUntil = 0; } catch (e0) {}
                try { pendingOffscreenCollapse = false; } catch (e1) {}
                try { applySlackPx(collapsedSlackPx); } catch (e2) {}
            }
        };

        try {
            var panelEl = scrollEl.closest(panelSelector);
            registered.push({ panelEl: panelEl, scrollEl: scrollEl, controller: controller });
        } catch (e3) {}

        if (enableForceOffOnTabs) installTabSwitchListener(tabSelector, panelSelector);

        try { attached.set(scrollEl, controller); } catch (e4) {}
        return controller;
    }

    return {
        attach: attach
    };
})();

// Expose globally (backup)
try {
    window.BottomSlack = BottomSlack;
    window.TopSlack = TopSlack;
} catch (e) {}










