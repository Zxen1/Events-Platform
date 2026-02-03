/* ============================================================================
   POST-NEW-2.JS - POST SECTION 2 (Clean Rebuild)
   ============================================================================
   
   Clean rebuild of the Post panel and Recent panel.
   This module sits to the RIGHT of the original post panel for testing.
   
   DEPENDENCIES:
   - index.js (backbone)
   
   COMMUNICATES WITH:
   - map.js (clicking cards highlights markers)
   - filter.js (filters affect visible posts)
   - header.js (mode switch)
   
   ============================================================================ */

const PostModule2 = (function() {
  'use strict';

  /* --------------------------------------------------------------------------
     STATE
     -------------------------------------------------------------------------- */

  var panelsContainerEl = null;
  var postPanelEl = null;
  var postPanelContentEl = null;
  var postListEl = null;
  var recentPanelEl = null;
  var recentPanelContentEl = null;

  /* --------------------------------------------------------------------------
     INIT
     -------------------------------------------------------------------------- */

  function init() {
    panelsContainerEl = document.querySelector('.post-mode-panels');
    if (!panelsContainerEl) {
      console.error('[PostModule2] .post-mode-panels container not found.');
      return;
    }

    ensurePanelsDom();
    console.log('[PostModule2] Initialized - panels created');
  }

  /* --------------------------------------------------------------------------
     DOM CREATION
     -------------------------------------------------------------------------- */

  function ensurePanelsDom() {
    // Recent panel 2
    recentPanelEl = panelsContainerEl.querySelector('.recent-panel-2');
    if (!recentPanelEl) {
      recentPanelEl = document.createElement('aside');
      recentPanelEl.className = 'recent-panel-2';
      recentPanelEl.setAttribute('aria-hidden', 'true');
      recentPanelEl.setAttribute('role', 'dialog');
      recentPanelEl.innerHTML = '<div class="recent-panel-2-content recent-panel-2-content--side-left recent-panel-2-content--hidden"></div>';
      panelsContainerEl.appendChild(recentPanelEl);
    }
    recentPanelContentEl = recentPanelEl.querySelector('.recent-panel-2-content');

    // Post panel 2
    postPanelEl = panelsContainerEl.querySelector('.post-panel-2');
    if (!postPanelEl) {
      postPanelEl = document.createElement('aside');
      postPanelEl.className = 'post-panel-2';
      postPanelEl.setAttribute('aria-hidden', 'true');
      postPanelEl.setAttribute('role', 'dialog');
      postPanelEl.innerHTML = '<div class="post-panel-2-content post-panel-2-content--side-left post-panel-2-content--hidden"><div class="post-list-2"></div></div>';
      panelsContainerEl.appendChild(postPanelEl);
    }
    postPanelContentEl = postPanelEl.querySelector('.post-panel-2-content');
    postListEl = postPanelContentEl.querySelector('.post-list-2');

    // Attach bottom slack to both panels
    attachBottomSlack();
  }

  /* --------------------------------------------------------------------------
     BOTTOM SLACK
     -------------------------------------------------------------------------- */

  function attachBottomSlack() {
    // Post panel bottom slack
    if (postListEl && !postListEl.querySelector('.bottomSlack')) {
      var slack = document.createElement('div');
      slack.className = 'bottomSlack';
      slack.setAttribute('aria-hidden', 'true');
      postListEl.appendChild(slack);
    }

    // Recent panel bottom slack
    if (recentPanelContentEl && !recentPanelContentEl.querySelector('.bottomSlack')) {
      var slack2 = document.createElement('div');
      slack2.className = 'bottomSlack';
      slack2.setAttribute('aria-hidden', 'true');
      recentPanelContentEl.appendChild(slack2);
    }
  }

  /* --------------------------------------------------------------------------
     PUBLIC API
     -------------------------------------------------------------------------- */

  return {
    init: init
  };

})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', PostModule2.init);
} else {
  PostModule2.init();
}
