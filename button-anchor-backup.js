/* ============================================================================
   BUTTON ANCHOR BACKUP - Standalone Self-Contained Components
   ============================================================================
   
   Created: December 30, 2025
   Purpose: Backup of working ButtonAnchorBottom and ButtonAnchorTop components.
   
   NO DEPENDENCIES - These components are fully self-contained.
   They inject their own CSS and create their own DOM elements as needed.
   
   USAGE:
   1. Include this file in your HTML: <script src="button-anchor-backup.js"></script>
   2. Attach to scroll containers:
      ButtonAnchorBottom.attach(scrollEl, { stopDelayMs: 180, clickHoldMs: 250, scrollbarFadeMs: 160 });
      ButtonAnchorTop.attach(scrollEl, { stopDelayMs: 180, clickHoldMs: 250, scrollbarFadeMs: 160 });
   
   WHAT THEY DO:
   - ButtonAnchorBottom: Prevents "button flies away" when content ABOVE collapses
   - ButtonAnchorTop: Prevents "button flies away" when content BELOW collapses (closes downward)
   
   ============================================================================ */

(function() {
    'use strict';

    /* ========================================================================
       BUTTON ANCHOR BOTTOM
       Prevents "clicked button flies away" when collapsible content above closes.
       Self-contained: injects required slack CSS and creates the slack element if missing.
       ======================================================================== */

    var ButtonAnchorBottom = (function() {
        var STYLE_ID = 'button-anchor-bottom-style';
        var attached = new WeakMap();
        var registered = [];
        var tabListenerInstalled = false;
        
        function ensureStyle() {
            try {
                if (document.getElementById(STYLE_ID)) return;
                var style = document.createElement('style');
                style.id = STYLE_ID;
                style.textContent =
                    '.panel-bottom-slack{' +
                    'height:var(--panel-bottom-slack,0px);' +
                    'flex:0 0 auto;' +
                    'pointer-events:none;' +
                    'transition:none;' +
                    '}';
                document.head.appendChild(style);
            } catch (e) {}
        }
        
        function ensureSlackEl(scrollEl) {
            var slackEl = null;
            try { slackEl = scrollEl.querySelector('.panel-bottom-slack'); } catch (e) { slackEl = null; }
            if (slackEl) return slackEl;
            try {
                slackEl = document.createElement('div');
                slackEl.className = 'panel-bottom-slack';
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
                throw new Error('ButtonAnchorBottom.attach: scrollEl must be an Element');
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
            
            var expandedSlackPx = 4000;
            var collapsedSlackPx = 0;
            
            var slackEl = ensureSlackEl(scrollEl);
            var unlockTimer = null;
            var locked = false;
            var currentSlackPx = 0;
            var lastScrollTop = scrollEl.scrollTop || 0;
            var scrollbarFadeTimer = null;
            var pendingOffscreenCollapse = false;
            var internalAdjust = false;
            
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
                try {
                    scrollEl.style.setProperty('--panel-bottom-slack', String(px) + 'px');
                } catch (e0) {}
                try { scrollEl.getBoundingClientRect(); } catch (e1) {}
                fadeScrollbar();
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
            
            function collapseIfOffscreenBelow() {
                try {
                    if (currentSlackPx !== expandedSlackPx) return false;
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
            
            scrollEl.addEventListener('pointerdown', function(e) {
                try {
                    var t = e && e.target;
                    if (!(t instanceof Element)) return;
                    if (slackEl && (t === slackEl || slackEl.contains(t))) return;
                    if (!scrollEl.contains(t)) return;
                    applySlackPx(expandedSlackPx);
                } catch (e0) {}
            }, { passive: true, capture: true });
            
            function onScroll() {
                if (internalAdjust) return;
                try {
                    var st = scrollEl.scrollTop || 0;
                    if (st > lastScrollTop && isSlackOnScreen()) return;
                    if (st > lastScrollTop) collapseIfOffscreenBelow();
                    if (st === lastScrollTop) return;
                    lastScrollTop = st;
                } catch (e) {}
                startScrollBurst();
                maybeCollapseOffscreen();
            }
            
            scrollEl.addEventListener('scroll', onScroll, { passive: true });
            
            scrollEl.addEventListener('wheel', function(e) {
                try {
                    var deltaY = Number(e && e.deltaY) || 0;
                    if (deltaY > 0) collapseIfOffscreenBelow();
                    if (deltaY > 0 && isSlackOnScreen()) {
                        if (e && typeof e.preventDefault === 'function') e.preventDefault();
                        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                        return;
                    }
                } catch (e0) {}
                startScrollBurst();
            }, { passive: false });
            
            var lastTouchY = null;
            scrollEl.addEventListener('touchstart', function(e) {
                try {
                    var t = e && e.touches && e.touches[0];
                    lastTouchY = t ? t.clientY : null;
                } catch (e0) { lastTouchY = null; }
                startScrollBurst();
            }, { passive: true });
            
            scrollEl.addEventListener('touchmove', function(e) {
                try {
                    var t = e && e.touches && e.touches[0];
                    if (!t) return;
                    var y = t.clientY;
                    if (lastTouchY === null) lastTouchY = y;
                    var dy = y - lastTouchY;
                    lastTouchY = y;
                    if (dy < 0) collapseIfOffscreenBelow();
                    if (dy < 0 && isSlackOnScreen()) {
                        if (e && typeof e.preventDefault === 'function') e.preventDefault();
                        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                    }
                } catch (e1) {}
            }, { passive: false });
            
            scrollEl.addEventListener('keydown', function(e) {
                try {
                    if (!isSlackOnScreen()) return;
                    var k = e && (e.key || e.code) ? String(e.key || e.code) : '';
                    if (k === 'ArrowDown' || k === 'PageDown' || k === 'End') {
                        if (e && typeof e.preventDefault === 'function') e.preventDefault();
                        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                    }
                } catch (e2) {}
            }, true);
            
            applySlackPx(collapsedSlackPx);
            
            var controller = {
                forceOff: function() {
                    try { pendingOffscreenCollapse = false; } catch (e1) {}
                    try { if (unlockTimer) clearTimeout(unlockTimer); } catch (e2) {}
                    try { scrollEl.style.maxHeight = ''; } catch (e3) {}
                    locked = false;
                    applySlackPx(collapsedSlackPx);
                    try { lastScrollTop = scrollEl.scrollTop || 0; } catch (e4) {}
                }
            };
            
            if (enableForceOffOnTabs) {
                try {
                    var panelEl = scrollEl.closest(panelSelector);
                    if (panelEl) registered.push({ panelEl: panelEl, scrollEl: scrollEl, controller: controller });
                    installTabSwitchListener(tabSelector, panelSelector);
                } catch (e0) {}
            }
            
            try { attached.set(scrollEl, controller); } catch (e5) {}
            return controller;
        }
        
        return { attach: attach };
    })();

    /* ========================================================================
       BUTTON ANCHOR TOP
       Prevents "clicked button flies away" when collapsible content above changes near the TOP edge.
       Opposite of ButtonAnchorBottom:
       - Uses a TOP slack element + CSS var: --panel-top-slack
       - Blocks UPWARD scrolling while the top spacer is on-screen
       ======================================================================== */

    var ButtonAnchorTop = (function() {
        var STYLE_ID = 'button-anchor-top-style';
        var attached = new WeakMap();
        var registered = [];
        var tabListenerInstalled = false;
        
        function ensureStyle() {
            try {
                if (document.getElementById(STYLE_ID)) return;
                var style = document.createElement('style');
                style.id = STYLE_ID;
                style.textContent =
                    '.panel-top-slack{' +
                    'height:var(--panel-top-slack,0px);' +
                    'flex:0 0 auto;' +
                    'pointer-events:none;' +
                    'transition:none;' +
                    '}';
                document.head.appendChild(style);
            } catch (e) {}
        }
        
        function ensureSlackEl(scrollEl) {
            var slackEl = null;
            try { slackEl = scrollEl.querySelector('.panel-top-slack'); } catch (e) { slackEl = null; }
            if (slackEl) return slackEl;
            try {
                slackEl = document.createElement('div');
                slackEl.className = 'panel-top-slack';
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
                throw new Error('ButtonAnchorTop.attach: scrollEl must be an Element');
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
            var pendingAnchor = null;
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
                        scrollEl.style.setProperty('--panel-top-slack', String(px) + 'px');
                        scrollEl.scrollTop = (scrollEl.scrollTop || 0) + (px - oldPx);
                    } else {
                        scrollEl.style.setProperty('--panel-top-slack', String(px) + 'px');
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
                    return slackRect.bottom > scrollRect.top && slackRect.top < scrollRect.bottom;
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
            
            function applyAnchorAdjustment() {
                if (!pendingAnchor) return;
                var a = pendingAnchor;
                pendingAnchor = null;
                if (!a || !a.el || !a.el.isConnected) return;
                
                try {
                    var afterTop = a.el.getBoundingClientRect().top;
                    var delta = afterTop - a.topBefore;
                    if (!delta) return;
                    
                    var desired = (scrollEl.scrollTop || 0) + delta;
                    if (desired < 0) {
                        applySlackPx(expandedSlackPx);
                        desired = desired + expandedSlackPx;
                    }
                    
                    internalAdjust = true;
                    scrollEl.scrollTop = desired;
                    internalAdjust = false;
                    lastScrollTop = scrollEl.scrollTop || 0;
                } catch (e) {
                    internalAdjust = false;
                }
            }
            
            function startAnchorObserver() {
                if (anchorObserver) return;
                try {
                    anchorObserver = new MutationObserver(function() {
                        if (anchorApplied) return;
                        anchorDirty = true;
                    });
                    anchorObserver.observe(scrollEl, {
                        subtree: true,
                        childList: true,
                        attributes: true,
                        characterData: false
                    });
                } catch (e) {
                    anchorObserver = null;
                }
            }

            function stopAnchorObserver() {
                if (!anchorObserver) return;
                try { anchorObserver.disconnect(); } catch (e0) {}
                anchorObserver = null;
            }

            scrollEl.addEventListener('pointerdown', function(e) {
                try {
                    var t = e && e.target;
                    if (!(t instanceof Element)) return;
                    if (slackEl && (t === slackEl || slackEl.contains(t))) return;
                    if (!scrollEl.contains(t)) return;
                    var anchorEl = t.closest('button, [role="button"], a') || t;
                    pendingAnchor = { el: anchorEl, topBefore: anchorEl.getBoundingClientRect().top };
                    clickHoldUntil = Date.now() + clickHoldMs;
                    anchorApplied = false;
                    anchorDirty = false;
                    startAnchorObserver();
                } catch (e0) {}
            }, { passive: true, capture: true });
            
            scrollEl.addEventListener('click', function() {
                try {
                    queueMicrotask(function() {
                        if (anchorApplied) return;
                        anchorApplied = true;
                        stopAnchorObserver();
                        if (!anchorDirty) return;
                        applyAnchorAdjustment();
                    });
                } catch (e0) {}
            }, false);
            
            function onScroll() {
                if (internalAdjust) return;
                try {
                    var st = scrollEl.scrollTop || 0;
                    if (st < lastScrollTop && isSlackOnScreen()) return;
                    if (st < lastScrollTop) collapseIfOffscreenAbove();
                    if (st === lastScrollTop) return;
                    lastScrollTop = st;
                } catch (e) {}
                startScrollBurst();
                maybeCollapseOffscreen();
            }
            
            scrollEl.addEventListener('scroll', onScroll, { passive: true });
            
            scrollEl.addEventListener('wheel', function(e) {
                try {
                    var deltaY = Number(e && e.deltaY) || 0;
                    if (deltaY < 0) collapseIfOffscreenAbove();
                    if (deltaY < 0 && isSlackOnScreen()) {
                        if (e && typeof e.preventDefault === 'function') e.preventDefault();
                        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                        return;
                    }
                } catch (e0) {}
                startScrollBurst();
            }, { passive: false });
            
            var lastTouchY = null;
            scrollEl.addEventListener('touchstart', function(e) {
                try {
                    var t = e && e.touches && e.touches[0];
                    lastTouchY = t ? t.clientY : null;
                } catch (e0) { lastTouchY = null; }
                startScrollBurst();
            }, { passive: true });
            
            scrollEl.addEventListener('touchmove', function(e) {
                try {
                    var t = e && e.touches && e.touches[0];
                    if (!t) return;
                    var y = t.clientY;
                    if (lastTouchY === null) lastTouchY = y;
                    var dy = y - lastTouchY;
                    lastTouchY = y;
                    if (dy > 0) collapseIfOffscreenAbove();
                    if (dy > 0 && isSlackOnScreen()) {
                        if (e && typeof e.preventDefault === 'function') e.preventDefault();
                        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                    }
                } catch (e1) {}
            }, { passive: false });
            
            scrollEl.addEventListener('keydown', function(e) {
                try {
                    if (!isSlackOnScreen()) return;
                    var k = e && (e.key || e.code) ? String(e.key || e.code) : '';
                    if (k === 'ArrowUp' || k === 'PageUp' || k === 'Home') {
                        if (e && typeof e.preventDefault === 'function') e.preventDefault();
                        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
                    }
                } catch (e2) {}
            }, true);
            
            applySlackPx(collapsedSlackPx);
            
            var controller = {
                forceOff: function() {
                    try { clickHoldUntil = 0; } catch (e0) {}
                    try { pendingOffscreenCollapse = false; } catch (e1) {}
                    try { if (unlockTimer) clearTimeout(unlockTimer); } catch (e2) {}
                    try { scrollEl.style.maxHeight = ''; } catch (e3) {}
                    locked = false;
                    pendingAnchor = null;
                    applySlackPx(collapsedSlackPx);
                    try { lastScrollTop = scrollEl.scrollTop || 0; } catch (e4) {}
                }
            };
            
            if (enableForceOffOnTabs) {
                try {
                    var panelEl = scrollEl.closest(panelSelector);
                    if (panelEl) registered.push({ panelEl: panelEl, scrollEl: scrollEl, controller: controller });
                    installTabSwitchListener(tabSelector, panelSelector);
                } catch (e0) {}
            }
            
            try { attached.set(scrollEl, controller); } catch (e5) {}
            return controller;
        }
        
        return { attach: attach };
    })();

    // Expose globally
    window.ButtonAnchorBottom = ButtonAnchorBottom;
    window.ButtonAnchorTop = ButtonAnchorTop;

})();

