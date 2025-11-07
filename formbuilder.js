// Formbuilder.js - Extracted Form Builder functionality
// This file will contain all form builder related code

(function() {
  'use strict';

  console.log('Formbuilder.js loaded');

  // Initialize formbuilder categories
  function initFormbuilder() {
    const formbuilderCats = document.getElementById('formbuilderCats2');
    if (!formbuilderCats) {
      console.warn('Formbuilder categories container not found');
      return;
    }

    console.log('Formbuilder categories initialized');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFormbuilder);
  } else {
    initFormbuilder();
  }

})();

