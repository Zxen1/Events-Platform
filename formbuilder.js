// Formbuilder.js - Extracted Form Builder functionality

(function() {
  'use strict';

  console.log('Formbuilder.js loaded');

  // Render categories menu
  function renderFormbuilderCats2() {
    const formbuilderCats2 = document.getElementById('formbuilderCats2');
    if (!formbuilderCats2) return;

    formbuilderCats2.innerHTML = '';
    
    const categories = window.categories || [];
    const categoryIcons = window.categoryIcons || {};
    const getSortedCategoryEntries = window.getSortedCategoryEntries || ((list) => list.map((category, index) => ({ category, index })));
    
    const sortedCategoryEntries = getSortedCategoryEntries(categories);
    
    sortedCategoryEntries.forEach(({ category: c, index: sourceIndex }) => {
      if (!c || typeof c !== 'object') return;

      const menu = document.createElement('div');
      menu.className = 'category-form-menu';
      menu.dataset.category = c.name;
      menu.dataset.categoryIndex = String(sourceIndex);
      menu.setAttribute('role','group');
      menu.setAttribute('aria-expanded','false');

      const triggerWrap = document.createElement('div');
      triggerWrap.className = 'options-dropdown';

      const menuBtn = document.createElement('button');
      menuBtn.type = 'button';
      menuBtn.className = 'category-trigger';
      menuBtn.setAttribute('aria-haspopup','true');
      menuBtn.setAttribute('aria-expanded','false');

      const categoryIcon = document.createElement('span');
      categoryIcon.className = 'category-icon';
      const categoryIconHtml = categoryIcons[c.name] || '';
      if (categoryIconHtml) {
        categoryIcon.innerHTML = categoryIconHtml;
        categoryIcon.classList.add('has-icon');
      } else {
        categoryIcon.textContent = c.name.charAt(0) || '';
      }

      const categoryName = document.createElement('span');
      categoryName.className = 'category-name';
      categoryName.textContent = c.name;

      const arrow = document.createElement('span');
      arrow.className = 'dropdown-arrow';
      arrow.setAttribute('aria-hidden','true');

      menuBtn.append(categoryIcon, categoryName, arrow);
      triggerWrap.append(menuBtn);

      const toggle = document.createElement('label');
      toggle.className = 'switch cat-switch';
      const toggleInput = document.createElement('input');
      toggleInput.type = 'checkbox';
      toggleInput.checked = true;
      toggleInput.setAttribute('aria-label', `Toggle ${c.name} category`);
      const toggleSlider = document.createElement('span');
      toggleSlider.className = 'slider';
      toggle.append(toggleInput, toggleSlider);

      menu.append(triggerWrap, toggle);

      // Create content area for subcategories
      const content = document.createElement('div');
      content.className = 'category-form-content';
      content.hidden = true;

      // Create subcategories container
      const subMenusContainer = document.createElement('div');
      subMenusContainer.className = 'subcategory-form-menus';

      // Render subcategories
      const subs = c.subs || [];
      subs.forEach((sub, subIndex) => {
        const subMenu = document.createElement('div');
        subMenu.className = 'subcategory-form-menu';
        subMenu.dataset.category = c.name;
        subMenu.dataset.subcategory = sub;
        subMenu.dataset.subIndex = String(subIndex);
        subMenu.setAttribute('aria-expanded','false');

        const subTriggerWrap = document.createElement('div');
        subTriggerWrap.className = 'options-dropdown subcategory-trigger-wrap';

        const subBtn = document.createElement('button');
        subBtn.type = 'button';
        subBtn.className = 'subcategory-form-trigger';
        subBtn.setAttribute('aria-expanded','false');

        const subLabelWrap = document.createElement('span');
        subLabelWrap.className = 'subcategory-label-wrap';

        const subIcon = document.createElement('span');
        subIcon.className = 'subcategory-icon';
        const subcategoryIcons = window.subcategoryIcons || {};
        const subIconHtml = subcategoryIcons[sub] || '';
        if (subIconHtml) {
          subIcon.innerHTML = subIconHtml;
          subIcon.classList.add('has-icon');
        } else {
          subIcon.textContent = sub.charAt(0) || '';
        }

        const subName = document.createElement('span');
        subName.className = 'subcategory-name';
        subName.textContent = sub;

        subLabelWrap.append(subIcon, subName);

        const subArrow = document.createElement('span');
        subArrow.className = 'dropdown-arrow';
        subArrow.setAttribute('aria-hidden','true');

        subBtn.append(subLabelWrap, subArrow);
        subTriggerWrap.append(subBtn);

        const subToggle = document.createElement('label');
        subToggle.className = 'subcategory-form-toggle';
        const subInput = document.createElement('input');
        subInput.type = 'checkbox';
        subInput.checked = true;
        subInput.setAttribute('aria-label', `Toggle ${sub} subcategory`);
        const subSlider = document.createElement('span');
        subSlider.className = 'slider';
        subToggle.append(subInput, subSlider);

        subMenu.append(subTriggerWrap, subToggle);
        subMenusContainer.appendChild(subMenu);
      });

      content.appendChild(subMenusContainer);
      menu.appendChild(content);

      // Add click handler for accordion
      menuBtn.addEventListener('click', () => {
        const isExpanded = menu.getAttribute('aria-expanded') === 'true';
        const next = !isExpanded;
        menu.setAttribute('aria-expanded', next ? 'true' : 'false');
        menuBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
        content.hidden = !next;
      });

      formbuilderCats2.appendChild(menu);
    });
  }

  // Initialize formbuilder
  function initFormbuilder() {
    if (!window.categories) {
      setTimeout(initFormbuilder, 100);
      return;
    }

    renderFormbuilderCats2();
    console.log('Formbuilder categories rendered');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFormbuilder);
  } else {
    initFormbuilder();
  }

})();
