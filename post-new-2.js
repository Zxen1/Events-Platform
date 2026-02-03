/* POST-NEW-2.JS - Test panel */

(function() {
  'use strict';

  function init() {
    var el = document.querySelector('.post-panel-2');
    if (!el) {
      el = document.createElement('div');
      el.className = 'post-panel-2';
      document.body.appendChild(el);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
