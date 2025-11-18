const panelButtons = {
  filterPanel: 'filterBtn',
  memberPanel: 'memberBtn',
  adminPanel: 'adminBtn'
};
window.panelButtons = panelButtons;

const panelStack = [];
window.panelStack = panelStack;

const panelScrollOverlayItems = new Set();
window.panelScrollOverlayItems = panelScrollOverlayItems;

(function(){
  "use strict";

  const $ = window.$ || ((sel, root=document) => root.querySelector(sel));
  const $$ = window.$$ || ((sel, root=document) => Array.from(root.querySelectorAll(sel)));

  // Filter date variables - must be declared early
  let dateStart = null;
  let dateEnd = null;
  let expiredWasOn = false;
  let spinning = false;

  // Categories UI
  const categoryControllers = {};
    const allSubcategoryKeys = [];
    const resetCategoriesBtn = $('#resetCategoriesBtn');
    const catsEl = $('#cats');
    const formbuilderCats = document.getElementById('formbuilderCats');
    const formbuilderAddCategoryBtn = document.getElementById('formbuilderAddCategory');
    const FORM_BUILDER_ADD_CATEGORY_HANDLER_PROP = '__formbuilderAddCategoryHandler';
    let formbuilderConfirmOverlay = null;
    let categoryDragContainerInitialized = false;
    let draggedCategoryMenu = null;
    let categoryDropIndicatorTarget = null;
    let categoryDropIndicatorClass = '';
    let categoryDropIndicatorBefore = null;
    let categoryDropCommitted = false;
    let draggedSubcategoryMenu = null;
    let draggedSubcategoryContainer = null;
    const subcategoryContainerState = new WeakMap();
    let draggedFieldRow = null;
    let draggedFieldContainer = null;
    const fieldContainerState = new WeakMap();
    const dropIndicatorMap = new WeakMap();

    function getDropIndicator(container){
      if(!container) return null;
      let indicator = dropIndicatorMap.get(container);
      if(indicator && indicator.parentElement !== container){
        dropIndicatorMap.delete(container);
        indicator = null;
      }
      if(!indicator){
        indicator = document.createElement('div');
        indicator.className = 'formbuilder-drop-indicator';
        container.appendChild(indicator);
        dropIndicatorMap.set(container, indicator);
      }
      return indicator;
    }

    function hideDropIndicator(container){
      if(!container) return;
      const indicator = dropIndicatorMap.get(container);
      if(indicator){
        indicator.classList.remove('visible');
      }
    }

    function positionDropIndicator(container, target, before, selector, draggedEl){
      if(!container) return;
      const indicator = getDropIndicator(container);
      if(!indicator) return;
      let top = 0;
      if(target && target !== draggedEl){
        top = before ? target.offsetTop : target.offsetTop + target.offsetHeight;
      } else {
        const items = Array.from(container.querySelectorAll(selector)).filter(el => el !== draggedEl);
        if(items.length > 0){
          const ref = before ? items[0] : items[items.length - 1];
          top = before ? ref.offsetTop : ref.offsetTop + ref.offsetHeight;
        } else {
          top = 0;
        }
      }
      indicator.style.top = `${top}px`;
      indicator.classList.add('visible');
    }

    function sanitizeInsertionReference(node){
      while(node && node.nodeType === 1 && node.classList.contains('formbuilder-drop-indicator')){
        node = node.nextSibling;
      }
      while(node && node.nodeType === 3){
        node = node.nextSibling;
      }
      return node;
    }

    function clearCategoryDropIndicator(){
      if(categoryDropIndicatorTarget){
        categoryDropIndicatorTarget.classList.remove('drag-target-before','drag-target-after');
        categoryDropIndicatorTarget = null;
        categoryDropIndicatorClass = '';
      }
      categoryDropIndicatorBefore = null;
      hideDropIndicator(formbuilderCats);
    }

    function updateCategoryDropIndicator(target, before){
      const cls = target ? (before ? 'drag-target-before' : 'drag-target-after') : '';
      if(categoryDropIndicatorTarget && categoryDropIndicatorTarget !== target){
        categoryDropIndicatorTarget.classList.remove('drag-target-before','drag-target-after');
      }
      if(target){
        if(categoryDropIndicatorTarget !== target || categoryDropIndicatorClass !== cls){
          target.classList.remove('drag-target-before','drag-target-after');
          target.classList.add(cls);
          categoryDropIndicatorTarget = target;
          categoryDropIndicatorClass = cls;
        }
      } else {
        categoryDropIndicatorTarget = null;
        categoryDropIndicatorClass = '';
      }
      categoryDropIndicatorBefore = before;
      positionDropIndicator(formbuilderCats, target, before, '.category-form-menu', draggedCategoryMenu);
    }

    function captureChildPositions(container, selector){
      const map = new Map();
      if(!container) return map;
      container.querySelectorAll(selector).forEach(el=>{
        map.set(el, el.getBoundingClientRect());
      });
      return map;
    }

    function animateListReorder(container, selector, previousRects, exclude){
      if(!container || !previousRects || previousRects.size === 0) return;
      requestAnimationFrame(()=>{
        container.querySelectorAll(selector).forEach(el=>{
          if(el === exclude) return;
          const prevRect = previousRects.get(el);
          if(!prevRect) return;
          const nextRect = el.getBoundingClientRect();
          const dx = prevRect.left - nextRect.left;
          const dy = prevRect.top - nextRect.top;
          if(Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
          el.style.transition = 'none';
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          void el.offsetWidth;
          el.style.transition = 'transform 150ms ease';
          el.style.transform = '';
          const cleanup = ()=>{
            el.style.transition = '';
            el.style.transform = '';
            el.removeEventListener('transitionend', cleanup);
          };
          el.addEventListener('transitionend', cleanup);
        });
      });
    }

    function createFormbuilderDragHandle(label, extraClass){
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = extraClass ? `formbuilder-drag-handle ${extraClass}` : 'formbuilder-drag-handle';
      handle.setAttribute('aria-label', label);
      handle.title = label;
      handle.draggable = true;
      handle.setAttribute('draggable', 'true');
      handle.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.25a.75.75 0 0 1 .53.22l2.5 2.5a.75.75 0 1 1-1.06 1.06L8.75 3.38v3.12a.75.75 0 0 1-1.5 0V3.38L6.03 5.03a.75.75 0 0 1-1.06-1.06l2.5-2.5A.75.75 0 0 1 8 1.25zm0 13.5a.75.75 0 0 0 .53-.22l2.5-2.5a.75.75 0 0 0-1.06-1.06L8.75 12.62V9.5a.75.75 0 0 0-1.5 0v3.12l-1.72-1.66a.75.75 0 1 0-1.06 1.06l2.5 2.5c.14.14.33.22.53.22z"/></svg>';
      handle.addEventListener('keydown', event=>{
        if(event.key === ' ' || event.key === 'Spacebar'){
          event.preventDefault();
        }
      });
      return handle;
    }

    function updateDragHandleLabel(handle, label){
      if(!handle) return;
      handle.setAttribute('aria-label', label);
      handle.title = label;
    }

    function notifyFormbuilderChange(){
      if(!formbuilderCats) return;
      try{
        formbuilderCats.dispatchEvent(new Event('change', { bubbles: true }));
      }catch(err){
        const evt = document.createEvent('Event');
        evt.initEvent('change', true, true);
        formbuilderCats.dispatchEvent(evt);
      }
    }

    function syncCategoriesFromDom(){
      if(!formbuilderCats) return;
      const menuEls = Array.from(formbuilderCats.querySelectorAll('.category-form-menu'));
      if(menuEls.length !== categories.length) return;
      const used = new Set();
      const newOrder = [];
      menuEls.forEach(menu=>{
        const idx = Number.parseInt(menu.dataset.categoryIndex, 10);
        if(Number.isInteger(idx) && idx >= 0 && idx < categories.length && !used.has(idx)){
          newOrder.push(categories[idx]);
          used.add(idx);
          return;
        }
        const name = menu.dataset.category || '';
        const fallback = categories.findIndex((cat, index)=> cat && !used.has(index) && cat.name === name);
        if(fallback !== -1){
          newOrder.push(categories[fallback]);
          used.add(fallback);
        }
      });
      let changed = false;
      if(newOrder.length === categories.length){
        for(let i = 0; i < newOrder.length; i++){
          if(newOrder[i] !== categories[i]){
            changed = true;
            break;
          }
        }
        if(changed){
          categories.splice(0, categories.length, ...newOrder);
        }
      }
      menuEls.forEach((menu, index)=>{
        menu.dataset.categoryIndex = String(index);
      });
      if(changed){
        notifyFormbuilderChange();
      }
    }

    function ensureCategoryDragContainer(){
      if(categoryDragContainerInitialized || !formbuilderCats) return;
      categoryDragContainerInitialized = true;
      formbuilderCats.addEventListener('dragover', event=>{
        if(!draggedCategoryMenu || draggedSubcategoryMenu || draggedFieldRow){
          return;
        }
        event.preventDefault();
        if(event.dataTransfer){
          event.dataTransfer.dropEffect = 'move';
        }
        const target = event.target.closest('.category-form-menu');
        const menus = Array.from(formbuilderCats.querySelectorAll('.category-form-menu')).filter(menu => menu !== draggedCategoryMenu);
        const containerRect = formbuilderCats.getBoundingClientRect();
        if(!target || target === draggedCategoryMenu){
          if(menus.length === 0){
            updateCategoryDropIndicator(null, true);
            return;
          }
          if(event.clientY <= containerRect.top + 8){
            updateCategoryDropIndicator(menus[0], true);
          } else {
            updateCategoryDropIndicator(menus[menus.length - 1], false);
          }
          return;
        }
        const rect = target.getBoundingClientRect();
        const before = event.clientY < rect.top + rect.height / 2;
        updateCategoryDropIndicator(target, before);
      });
      formbuilderCats.addEventListener('drop', event=>{
        if(!draggedCategoryMenu || draggedSubcategoryMenu || draggedFieldRow){
          return;
        }
        event.preventDefault();
        categoryDropCommitted = true;
        const target = categoryDropIndicatorTarget;
        const before = categoryDropIndicatorBefore;
        let reference = null;
        if(formbuilderCats){
          if(target && target !== draggedCategoryMenu){
            reference = before ? target : target.nextSibling;
          } else if(!target && before){
            reference = formbuilderCats.firstChild;
          }
        }
        reference = sanitizeInsertionReference(reference);
        const currentNext = draggedCategoryMenu.nextSibling;
        if(formbuilderCats){
          const beforeRects = captureChildPositions(formbuilderCats, '.category-form-menu');
          if(reference !== draggedCategoryMenu && reference !== currentNext){
            formbuilderCats.insertBefore(draggedCategoryMenu, reference || null);
            animateListReorder(formbuilderCats, '.category-form-menu', beforeRects, draggedCategoryMenu);
          }
        }
        clearCategoryDropIndicator();
        syncCategoriesFromDom();
      });
      formbuilderCats.addEventListener('dragleave', event=>{
        if(!draggedCategoryMenu || draggedSubcategoryMenu || draggedFieldRow) return;
        if(event.target === formbuilderCats){
          clearCategoryDropIndicator();
        }
      });
    }

    function clearSubDropIndicator(state){
      if(!state) return;
      if(state.dropIndicatorTarget){
        state.dropIndicatorTarget.classList.remove('drag-target-before','drag-target-after');
        state.dropIndicatorTarget = null;
        state.dropIndicatorClass = '';
      }
      state.dropIndicatorBefore = null;
      hideDropIndicator(state.container);
    }

    function updateSubDropIndicator(state, target, before){
      if(!state) return;
      const cls = target ? (before ? 'drag-target-before' : 'drag-target-after') : '';
      if(state.dropIndicatorTarget && state.dropIndicatorTarget !== target){
        state.dropIndicatorTarget.classList.remove('drag-target-before','drag-target-after');
      }
      if(target){
        if(state.dropIndicatorTarget !== target || state.dropIndicatorClass !== cls){
          target.classList.remove('drag-target-before','drag-target-after');
          target.classList.add(cls);
          state.dropIndicatorTarget = target;
          state.dropIndicatorClass = cls;
        }
      } else {
        state.dropIndicatorTarget = null;
        state.dropIndicatorClass = '';
      }
      state.dropIndicatorBefore = before;
      positionDropIndicator(state.container, target, before, '.subcategory-form-menu', draggedSubcategoryMenu);
    }

    function syncSubcategoryOrderFromDom(container, categoryObj){
      if(!container || !categoryObj) return;
      const subEls = Array.from(container.querySelectorAll('.subcategory-form-menu'));
      const original = Array.isArray(categoryObj.subs) ? categoryObj.subs.slice() : [];
      const used = new Set();
      const reordered = [];
      subEls.forEach(subMenu=>{
        const idx = Number.parseInt(subMenu.dataset.subIndex, 10);
        if(Number.isInteger(idx) && idx >= 0 && idx < original.length && !used.has(idx)){
          reordered.push(original[idx]);
          used.add(idx);
          return;
        }
        const name = subMenu.dataset.subcategory || '';
        const fallback = original.findIndex((subName, index)=> subName === name && !used.has(index));
        if(fallback !== -1){
          reordered.push(original[fallback]);
          used.add(fallback);
        }
      });
      let changed = false;
      if(reordered.length === original.length){
        for(let i = 0; i < reordered.length; i++){
          if(reordered[i] !== original[i]){
            changed = true;
            break;
          }
        }
        if(changed){
          categoryObj.subs = reordered;
        }
      }
      subEls.forEach((subMenu, index)=>{
        subMenu.dataset.subIndex = String(index);
      });
      if(changed){
        notifyFormbuilderChange();
      }
    }

    function setupSubcategoryContainer(container, categoryObj, addButton){
      if(!container) return null;
      let state = subcategoryContainerState.get(container);
      if(!state){
        state = {
          dropIndicatorTarget: null,
          dropIndicatorClass: '',
          dropIndicatorBefore: null,
          dropCommitted: false,
          addButton: addButton,
          category: categoryObj,
          container
        };
        subcategoryContainerState.set(container, state);
        container.addEventListener('dragover', event=>{
          if(!draggedSubcategoryMenu || draggedSubcategoryContainer !== container) return;
          event.preventDefault();
          event.stopPropagation();
          if(event.dataTransfer){
            event.dataTransfer.dropEffect = 'move';
          }
          const target = event.target.closest('.subcategory-form-menu');
          const subMenus = Array.from(container.querySelectorAll('.subcategory-form-menu')).filter(menu => menu !== draggedSubcategoryMenu);
          const containerRect = container.getBoundingClientRect();
          if(!target || target === draggedSubcategoryMenu){
            if(subMenus.length === 0){
              updateSubDropIndicator(state, null, true);
            } else if(event.clientY <= containerRect.top + 8){
              updateSubDropIndicator(state, subMenus[0], true);
            } else {
              updateSubDropIndicator(state, subMenus[subMenus.length - 1], false);
            }
            return;
          }
          const rect = target.getBoundingClientRect();
          const before = event.clientY < rect.top + rect.height / 2;
          updateSubDropIndicator(state, target, before);
        });
        container.addEventListener('drop', event=>{
          if(!draggedSubcategoryMenu || draggedSubcategoryContainer !== container) return;
          event.preventDefault();
          event.stopPropagation();
          state.dropCommitted = true;
          const target = state.dropIndicatorTarget;
          const before = state.dropIndicatorBefore;
          let reference = null;
          if(container){
            if(target && target !== draggedSubcategoryMenu){
              reference = before ? target : target.nextSibling;
            } else if(!target && before){
              reference = container.firstChild;
            } else if(state.addButton){
              reference = state.addButton;
            }
          }
          if(reference === state.addButton && state.addButton && state.addButton.previousSibling === draggedSubcategoryMenu){
            reference = draggedSubcategoryMenu.nextSibling;
          }
          reference = sanitizeInsertionReference(reference);
          if(reference === state.addButton && reference === draggedSubcategoryMenu.nextSibling){
            reference = reference.nextSibling;
          }
          const beforeRects = captureChildPositions(container, '.subcategory-form-menu');
          const currentNext = draggedSubcategoryMenu.nextSibling;
          if(reference !== draggedSubcategoryMenu && reference !== currentNext){
            container.insertBefore(draggedSubcategoryMenu, reference || state.addButton || null);
            animateListReorder(container, '.subcategory-form-menu', beforeRects, draggedSubcategoryMenu);
          }
          clearSubDropIndicator(state);
          syncSubcategoryOrderFromDom(container, state.category);
        });
        container.addEventListener('dragleave', event=>{
          if(!draggedSubcategoryMenu || draggedSubcategoryContainer !== container) return;
          if(event.target === container){
            clearSubDropIndicator(state);
          }
        });
      }
      state.addButton = addButton;
      state.category = categoryObj;
      state.container = container;
      return state;
    }

    function enableCategoryDrag(menu, header, handle){
      if(!menu || !header || !handle) return;
      ensureCategoryDragContainer();
      menu.draggable = false;
      header.draggable = false;
      handle.draggable = true;
      handle.setAttribute('draggable', 'true');
      handle.addEventListener('dragstart', event=>{
        const origin = event.target;
        if(origin !== handle){
          event.preventDefault();
          return;
        }
        event.stopPropagation();
        draggedCategoryMenu = menu;
        categoryDropCommitted = false;
        menu.classList.add('is-dragging');
        header.classList.add('is-dragging');
        handle.classList.add('is-dragging');
        if(event.dataTransfer){
          event.dataTransfer.effectAllowed = 'move';
          try{ event.dataTransfer.setData('text/plain', menu.dataset.category || ''); }catch(err){}
          try{
            const rect = menu.getBoundingClientRect();
            event.dataTransfer.setDragImage(menu, rect.width / 2, rect.height / 2);
          }catch(err){}
        }
      });
      handle.addEventListener('dragend', event=>{
        event.stopPropagation();
        if(draggedCategoryMenu === menu){
          menu.classList.remove('is-dragging');
          header.classList.remove('is-dragging');
          handle.classList.remove('is-dragging');
          draggedCategoryMenu = null;
        }
        clearCategoryDropIndicator();
        if(!categoryDropCommitted){
          syncCategoriesFromDom();
        }
        categoryDropCommitted = false;
      });
    }

    function enableSubcategoryDrag(subMenu, container, categoryObj, header, addButton, handle){
      if(!subMenu || !container || !header || !handle) return;
      const state = setupSubcategoryContainer(container, categoryObj, addButton);
      subMenu.draggable = false;
      header.draggable = false;
      handle.draggable = true;
      handle.setAttribute('draggable', 'true');
      handle.addEventListener('dragstart', event=>{
        const origin = event.target;
        if(origin !== handle){
          event.preventDefault();
          return;
        }
        event.stopPropagation();
        draggedSubcategoryMenu = subMenu;
        draggedSubcategoryContainer = container;
        if(state) state.dropCommitted = false;
        subMenu.classList.add('is-dragging');
        header.classList.add('is-dragging');
        handle.classList.add('is-dragging');
        if(event.dataTransfer){
          event.dataTransfer.effectAllowed = 'move';
          try{ event.dataTransfer.setData('text/plain', subMenu.dataset.subcategory || ''); }catch(err){}
          try{
            const rect = subMenu.getBoundingClientRect();
            event.dataTransfer.setDragImage(subMenu, rect.width / 2, rect.height / 2);
          }catch(err){}
        }
      });
      handle.addEventListener('dragend', event=>{
        event.stopPropagation();
        if(draggedSubcategoryMenu === subMenu){
          subMenu.classList.remove('is-dragging');
          header.classList.remove('is-dragging');
          handle.classList.remove('is-dragging');
          draggedSubcategoryMenu = null;
          draggedSubcategoryContainer = null;
        }
        if(state){
          clearSubDropIndicator(state);
          if(!state.dropCommitted){
            syncSubcategoryOrderFromDom(container, state.category);
          }
          state.dropCommitted = false;
        }
      });
    }

    function clearFieldDropIndicator(state){
      if(!state) return;
      if(state.dropIndicatorTarget){
        state.dropIndicatorTarget.classList.remove('drag-target-before','drag-target-after');
        state.dropIndicatorTarget = null;
        state.dropIndicatorClass = '';
      }
      state.dropIndicatorBefore = null;
      hideDropIndicator(state.container);
    }

    function updateFieldDropIndicator(state, target, before){
      if(!state) return;
      const cls = target ? (before ? 'drag-target-before' : 'drag-target-after') : '';
      if(state.dropIndicatorTarget && state.dropIndicatorTarget !== target){
        state.dropIndicatorTarget.classList.remove('drag-target-before','drag-target-after');
      }
      if(target){
        if(state.dropIndicatorTarget !== target || state.dropIndicatorClass !== cls){
          target.classList.remove('drag-target-before','drag-target-after');
          target.classList.add(cls);
          state.dropIndicatorTarget = target;
          state.dropIndicatorClass = cls;
        }
      } else {
        state.dropIndicatorTarget = null;
        state.dropIndicatorClass = '';
      }
      state.dropIndicatorBefore = before;
      positionDropIndicator(state.container, target, before, '.subcategory-field-row', draggedFieldRow);
    }

    function syncFieldOrderFromDom(container, fields){
      if(!container || !Array.isArray(fields)) return;
      const rows = Array.from(container.querySelectorAll('.subcategory-field-row'));
      const original = fields.slice();
      const reordered = [];
      rows.forEach(row=>{
        const ref = row && row.__fieldRef;
        if(ref && original.includes(ref) && !reordered.includes(ref)){
          reordered.push(ref);
        }
      });
      let changed = false;
      if(reordered.length === original.length){
        for(let i = 0; i < reordered.length; i++){
          if(reordered[i] !== original[i]){
            changed = true;
            break;
          }
        }
        if(changed){
          fields.splice(0, fields.length, ...reordered);
          notifyFormbuilderChange();
          const state = fieldContainerState.get(container);
          if(state && typeof state.onFieldsReordered === 'function'){
            try{
              state.onFieldsReordered();
            }catch(err){}
          }
        }
      }
      rows.forEach((row, index)=>{
        if(!row || !(row instanceof Element) || !row.dataset) return;
        row.dataset.fieldIndex = String(index);
      });
    }

    function setupFieldContainer(container, fields){
      if(!container) return null;
      let state = fieldContainerState.get(container);
      if(!state){
        state = {
          dropIndicatorTarget: null,
          dropIndicatorClass: '',
          dropIndicatorBefore: null,
          dropCommitted: false,
          fields,
          container
        };
        fieldContainerState.set(container, state);
        container.addEventListener('dragover', event=>{
          if(!draggedFieldRow || draggedFieldContainer !== container) return;
          event.preventDefault();
          event.stopPropagation();
          if(event.dataTransfer){
            event.dataTransfer.dropEffect = 'move';
          }
          const target = event.target.closest('.subcategory-field-row');
          const rows = Array.from(container.querySelectorAll('.subcategory-field-row')).filter(row => row !== draggedFieldRow);
          const containerRect = container.getBoundingClientRect();
          if(!target || target === draggedFieldRow){
            if(rows.length === 0){
              updateFieldDropIndicator(state, null, true);
            } else if(event.clientY <= containerRect.top + 8){
              updateFieldDropIndicator(state, rows[0], true);
            } else {
              updateFieldDropIndicator(state, rows[rows.length - 1], false);
            }
            return;
          }
          const rect = target.getBoundingClientRect();
          const before = event.clientY < rect.top + rect.height / 2;
          updateFieldDropIndicator(state, target, before);
        });
        container.addEventListener('drop', event=>{
          if(!draggedFieldRow || draggedFieldContainer !== container) return;
          event.preventDefault();
          event.stopPropagation();
          state.dropCommitted = true;
          const target = state.dropIndicatorTarget;
          const before = state.dropIndicatorBefore;
          let reference = null;
          if(container){
            if(target && target !== draggedFieldRow){
              reference = before ? target : target.nextSibling;
            } else if(!target && before){
              reference = container.firstChild;
            }
          }
          reference = sanitizeInsertionReference(reference);
          const beforeRects = captureChildPositions(container, '.subcategory-field-row');
          const currentNext = draggedFieldRow.nextSibling;
          if(reference !== draggedFieldRow && reference !== currentNext){
            container.insertBefore(draggedFieldRow, reference || null);
            animateListReorder(container, '.subcategory-field-row', beforeRects, draggedFieldRow);
          }
          clearFieldDropIndicator(state);
          syncFieldOrderFromDom(container, state.fields || fields);
        });
        container.addEventListener('dragleave', event=>{
          if(!draggedFieldRow || draggedFieldContainer !== container) return;
          if(event.target === container){
            clearFieldDropIndicator(state);
          }
        });
      }
      state.fields = fields;
      state.container = container;
      return state;
    }

    function enableFieldDrag(row, container, fields, handle){
      if(!row || !container || !handle) return;
      const state = setupFieldContainer(container, fields);
      row.draggable = false;
      handle.draggable = true;
      handle.setAttribute('draggable', 'true');
      handle.addEventListener('dragstart', event=>{
        const origin = event.target;
        if(origin !== handle){
          event.preventDefault();
          return;
        }
        event.stopPropagation();
        draggedFieldRow = row;
        draggedFieldContainer = container;
        if(state) state.dropCommitted = false;
        row.classList.add('is-dragging');
        if(row._header){
          row._header.classList.add('is-dragging');
        }
        handle.classList.add('is-dragging');
        if(event.dataTransfer){
          event.dataTransfer.effectAllowed = 'move';
          try{ 
            const summaryLabel = row.querySelector('.field-summary-label');
            const labelText = summaryLabel ? summaryLabel.textContent.trim() : 'Field';
            event.dataTransfer.setData('text/plain', labelText);
          }catch(err){}
          try{
            const rect = row.getBoundingClientRect();
            event.dataTransfer.setDragImage(row, rect.width / 2, rect.height / 2);
          }catch(err){}
        }
      });
      handle.addEventListener('dragend', event=>{
        event.stopPropagation();
        if(draggedFieldRow === row){
          row.classList.remove('is-dragging');
          if(row._header){
            row._header.classList.remove('is-dragging');
          }
          handle.classList.remove('is-dragging');
          draggedFieldRow = null;
          draggedFieldContainer = null;
        }
        if(state){
          clearFieldDropIndicator(state);
          if(!state.dropCommitted){
            syncFieldOrderFromDom(container, state.fields || fields);
          }
          state.dropCommitted = false;
        }
      });
    }

    async function ensureFormbuilderConfirmOverlay(){
      if(formbuilderConfirmOverlay) return formbuilderConfirmOverlay;
      const overlay = document.createElement('div');
      overlay.id = 'formbuilderConfirmOverlay';
      overlay.className = 'formbuilder-confirm-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.setAttribute('tabindex', '-1');

      const dialog = document.createElement('div');
      dialog.className = 'formbuilder-confirm-dialog';
      dialog.setAttribute('role', 'alertdialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'formbuilderConfirmTitle');
      dialog.setAttribute('aria-describedby', 'formbuilderConfirmMessage');

      const title = document.createElement('h2');
      title.id = 'formbuilderConfirmTitle';
      // Title will be set from DB message

      const message = document.createElement('p');
      message.id = 'formbuilderConfirmMessage';
      // Message will be set from DB message

      const actions = document.createElement('div');
      actions.className = 'formbuilder-confirm-actions';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'formbuilder-confirm-cancel';
      cancelBtn.dataset.role = 'cancel';
      cancelBtn.dataset.messageKey = 'msg_button_cancel';
      const cancelText = await getMessage('msg_button_cancel', {}, true) || 'Cancel';
      cancelBtn.textContent = cancelText;

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'formbuilder-confirm-button formbuilder-confirm-delete';
      deleteBtn.dataset.role = 'confirm';
      deleteBtn.dataset.messageKey = 'msg_button_delete';
      const deleteText = await getMessage('msg_button_delete', {}, true) || 'Delete';
      deleteBtn.textContent = deleteText;

      actions.append(cancelBtn, deleteBtn);
      dialog.append(title, message, actions);
      overlay.append(dialog);
      document.body.appendChild(overlay);
      formbuilderConfirmOverlay = overlay;
      return overlay;
    }

    async function confirmFormbuilderAction({
      messageText = 'Are you sure you want to continue?',
      titleText = 'Confirm action',
      confirmLabel = 'Confirm',
      confirmClassName = 'formbuilder-confirm-delete',
      focusCancel = true,
      messageKey = null,
      titleKey = null,
      placeholders = {}
    } = {}){
      const overlay = await ensureFormbuilderConfirmOverlay();
      const dialog = overlay.querySelector('.formbuilder-confirm-dialog');
      const title = dialog.querySelector('#formbuilderConfirmTitle');
      const message = dialog.querySelector('#formbuilderConfirmMessage');
      let cancelBtn = overlay.querySelector('[data-role="cancel"]');
      let confirmBtn = overlay.querySelector('[data-role="confirm"]');
      if(!cancelBtn || !confirmBtn) return Promise.resolve(false);
      const previousClassName = confirmBtn.className;
      const previousLabel = confirmBtn.textContent;
      const previousFocused = document.activeElement;

      // Clone both buttons to ensure clean event listeners
      if(cancelBtn && cancelBtn.parentNode){
        const replacement = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(replacement, cancelBtn);
        cancelBtn = replacement;
      }
      if(confirmBtn && confirmBtn.parentNode){
        const replacement = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(replacement, confirmBtn);
        confirmBtn = replacement;
      }

      // Load messages from DB if keys provided
      // Use sync version first (from cache) to avoid delays, fallback to async if needed
      let finalTitle = titleText || 'Confirm action';
      let finalMessage = messageText || 'Are you sure you want to continue?';
      
      if(titleKey){
        // Try sync first (fast, from cache), fallback to async if not in cache
        const syncTitle = getMessageSync(titleKey, placeholders, true);
        if(syncTitle){
          finalTitle = syncTitle;
        } else {
          // Only wait for async if sync didn't find it (with timeout to prevent long delays)
          try {
            const dbTitle = await Promise.race([
              getMessage(titleKey, placeholders, true),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 500))
            ]);
            if(dbTitle) finalTitle = dbTitle;
          } catch(err){
            // Use fallback text if message load times out
            console.warn('Message load timeout for:', titleKey);
          }
        }
      }
      if(messageKey){
        // Try sync first (fast, from cache), fallback to async if not in cache
        const syncMessage = getMessageSync(messageKey, placeholders, true);
        if(syncMessage){
          finalMessage = syncMessage;
        } else {
          // Only wait for async if sync didn't find it (with timeout to prevent long delays)
          try {
            const dbMessage = await Promise.race([
              getMessage(messageKey, placeholders, true),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 500))
            ]);
            if(dbMessage) finalMessage = dbMessage;
          } catch(err){
            // Use fallback text if message load times out
            console.warn('Message load timeout for:', messageKey);
          }
        }
      }

      title.textContent = finalTitle;
      message.textContent = finalMessage;

      const normalizedConfirmClass = typeof confirmClassName === 'string' && confirmClassName.trim()
        ? `formbuilder-confirm-button ${confirmClassName.trim()}`
        : previousClassName || 'formbuilder-confirm-button';
      confirmBtn.className = normalizedConfirmClass;
      
      // Load button label from DB if not provided
      let finalConfirmLabel = confirmLabel;
      if(!finalConfirmLabel){
        const confirmKey = confirmBtn.dataset.messageKey || 'msg_button_confirm';
        finalConfirmLabel = await getMessage(confirmKey, placeholders, true) || previousLabel || 'Confirm';
      }
      confirmBtn.textContent = finalConfirmLabel;

      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('visible');

      return new Promise(resolve => {
        const cleanup = (result)=>{
          overlay.classList.remove('visible');
          overlay.setAttribute('aria-hidden', 'true');
          window.removeEventListener('keydown', onKeyDown, true);
          overlay.removeEventListener('click', onOverlayClick);
          confirmBtn.className = previousClassName || 'formbuilder-confirm-button formbuilder-confirm-delete';
          // Restore previous label (which was already loaded from DB when overlay was created)
          confirmBtn.textContent = previousLabel || 'Delete';
          if(previousFocused && typeof previousFocused.focus === 'function'){
            try{
              previousFocused.focus({ preventScroll: true });
            }catch(err){
              try{ previousFocused.focus(); }catch(e){}
            }
          }
          resolve(result);
        };
        const onCancel = (event)=> {
          event.preventDefault();
          event.stopPropagation();
          cleanup(false);
        };
        const onConfirm = (event)=> {
          event.preventDefault();
          event.stopPropagation();
          cleanup(true);
        };
        const onOverlayClick = event => {
          if(event.target === overlay){
            cleanup(false);
          }
        };
        const onKeyDown = event => {
          if(event.key === 'Escape'){
            event.preventDefault();
            cleanup(false);
          }
        };

        cancelBtn.addEventListener('click', onCancel);
        confirmBtn.addEventListener('click', onConfirm);
        overlay.addEventListener('click', onOverlayClick);
        window.addEventListener('keydown', onKeyDown, true);

        requestAnimationFrame(()=>{
          const targetBtn = focusCancel ? cancelBtn : confirmBtn;
          try{
            targetBtn.focus({ preventScroll: true });
          }catch(err){
            try{ targetBtn.focus(); }catch(e){}
          }
        });
      });
    }

    async function confirmFormbuilderDeletion(messageText, titleText){
      const result = await confirmFormbuilderAction({
        messageText: messageText,
        titleText: titleText,
        messageKey: !messageText ? 'msg_confirm_delete_item' : null,
        titleKey: !titleText ? 'msg_confirm_delete_title' : null,
        confirmLabel: 'Delete',
        confirmClassName: 'formbuilder-confirm-delete',
        focusCancel: true
      });
      return result;
    }
    let subcategoryFieldOverlayEl = null;
    let subcategoryFieldOverlayContent = null;
    let subcategoryFieldOverlayKeyHandler = null;
    let subcategoryFieldOverlayPointerDownHandler = null;
    let subcategoryFieldOverlayScrollHandler = null;
    let subcategoryFieldOverlayResizeHandler = null;
    let subcategoryFieldOverlayTrigger = null;
    function ensureSubcategoryFieldOverlay(){
      if(subcategoryFieldOverlayEl && subcategoryFieldOverlayContent) return subcategoryFieldOverlayEl;
      if(!document || !document.body) return null;
      const overlay = document.createElement('div');
      overlay.id = 'subcategoryFieldOverlay';
      overlay.className = 'subcategory-field-overlay';
      const content = document.createElement('div');
      content.className = 'subcategory-field-overlay-content';
      content.setAttribute('role', 'dialog');
      content.setAttribute('tabindex', '-1');
      overlay.appendChild(content);
      document.body.appendChild(overlay);
      subcategoryFieldOverlayEl = overlay;
      subcategoryFieldOverlayContent = content;
      if(!subcategoryFieldOverlayKeyHandler){
        subcategoryFieldOverlayKeyHandler = event=>{
          if(event.key === 'Escape' && overlay.classList.contains('visible')){
            event.preventDefault();
            closeSubcategoryFieldOverlay();
          }
        };
        document.addEventListener('keydown', subcategoryFieldOverlayKeyHandler);
      }
      return overlay;
    }
    function closeSubcategoryFieldOverlay(){
      const overlay = subcategoryFieldOverlayEl;
      const content = subcategoryFieldOverlayContent;
      if(!overlay || !content) return;
      const activeRow = content.querySelector('.subcategory-field-row');
      if(activeRow){
        const placeholder = activeRow.__overlayPlaceholder;
        if(placeholder && placeholder.parentNode){
          placeholder.replaceWith(activeRow);
        } else if(activeRow.__overlayParent && activeRow.__overlayParent.isConnected){
          activeRow.__overlayParent.appendChild(activeRow);
        }
        if(placeholder && placeholder.parentNode){
          // already replaced
        } else if(placeholder){
          placeholder.remove();
        }
        delete activeRow.__overlayPlaceholder;
        delete activeRow.__overlayParent;
        delete activeRow.__overlayOverlay;
      }
      content.innerHTML = '';
      content.style.top = '';
      content.style.left = '';
      content.style.width = '';
      overlay.classList.remove('visible');
      overlay.removeAttribute('data-active-label');
      content.removeAttribute('aria-label');
      if(subcategoryFieldOverlayPointerDownHandler){
        document.removeEventListener('pointerdown', subcategoryFieldOverlayPointerDownHandler, true);
        subcategoryFieldOverlayPointerDownHandler = null;
      }
      if(subcategoryFieldOverlayScrollHandler){
        window.removeEventListener('scroll', subcategoryFieldOverlayScrollHandler, true);
        subcategoryFieldOverlayScrollHandler = null;
      }
      if(subcategoryFieldOverlayResizeHandler){
        window.removeEventListener('resize', subcategoryFieldOverlayResizeHandler);
        subcategoryFieldOverlayResizeHandler = null;
      }
      subcategoryFieldOverlayTrigger = null;
    }
    function openSubcategoryFieldOverlay(row, labelText, triggerEl){
      if(!row) return;
      const overlay = ensureSubcategoryFieldOverlay();
      const content = subcategoryFieldOverlayContent;
      if(!overlay || !content) return;
      const currentRow = content.querySelector('.subcategory-field-row');
      if(currentRow === row){
        closeSubcategoryFieldOverlay();
        return;
      }
      closeSubcategoryFieldOverlay();
      if(!row.parentNode) return;
      const placeholder = document.createElement('div');
      placeholder.className = 'subcategory-field-placeholder';
      const rowRect = row.getBoundingClientRect();
      if(rowRect && rowRect.width){
        const storedWidth = Math.round(rowRect.width);
        if(storedWidth > 0){
          placeholder.__overlayWidth = storedWidth;
          placeholder.style.width = storedWidth + 'px';
        }
      }
      const parentContent = row.closest('.subcategory-form-content');
      if(parentContent && typeof parentContent.getBoundingClientRect === 'function'){
        const parentRect = parentContent.getBoundingClientRect();
        const containerWidth = Math.round(parentRect?.width || 0);
        if(containerWidth > 0){
          placeholder.__overlayContainerWidth = containerWidth;
        }
      }
      row.__overlayPlaceholder = placeholder;
      row.__overlayParent = row.parentNode;
      row.__overlayOverlay = overlay;
      row.parentNode.insertBefore(placeholder, row);
      content.innerHTML = '';
      content.appendChild(row);
      const overlayWidth = placeholder.__overlayContainerWidth || placeholder.__overlayWidth;
      if(overlayWidth){
        content.style.width = overlayWidth + 'px';
      } else {
        content.style.width = '';
      }
      if(labelText){
        content.setAttribute('aria-label', labelText);
        overlay.setAttribute('data-active-label', labelText);
      } else {
        content.removeAttribute('aria-label');
        overlay.removeAttribute('data-active-label');
      }
      const triggerButton = (triggerEl instanceof Element)
        ? triggerEl.closest('.subcategory-form-button')
        : null;
      subcategoryFieldOverlayTrigger = triggerButton || (triggerEl instanceof Element ? triggerEl : null);
      overlay.classList.add('visible');
      const alignOverlay = ()=>{
        const buffer = 10;
        const triggerNode = subcategoryFieldOverlayTrigger;
        const scrollY = (typeof window !== 'undefined' && typeof window.pageYOffset === 'number')
          ? window.pageYOffset
          : (document.documentElement?.scrollTop || document.body?.scrollTop || 0);
        const scrollX = (typeof window !== 'undefined' && typeof window.pageXOffset === 'number')
          ? window.pageXOffset
          : (document.documentElement?.scrollLeft || document.body?.scrollLeft || 0);
        const viewportHeight = (typeof window !== 'undefined' && typeof window.innerHeight === 'number')
          ? window.innerHeight
          : (document.documentElement?.clientHeight || 0);
        const viewportWidth = (typeof window !== 'undefined' && typeof window.innerWidth === 'number')
          ? window.innerWidth
          : (document.documentElement?.clientWidth || 0);
        const contentRect = content.getBoundingClientRect();
        const contentHeight = contentRect?.height || 0;
        const contentWidth = contentRect?.width || 0;
        let top = scrollY + buffer;
        let left = scrollX + buffer;
        if(triggerNode && typeof triggerNode.getBoundingClientRect === 'function'){
          const triggerRect = triggerNode.getBoundingClientRect();
          const minTop = scrollY + buffer;
          let maxTop = scrollY + viewportHeight - contentHeight - buffer;
          if(!Number.isFinite(maxTop) || maxTop < minTop){
            maxTop = minTop;
          }
          let preferredTop = scrollY + triggerRect.top - buffer - contentHeight;
          if(preferredTop < minTop){
            preferredTop = scrollY + triggerRect.bottom + buffer;
          }
          if(preferredTop > maxTop){
            preferredTop = Math.max(minTop, Math.min(preferredTop, maxTop));
          }
          top = preferredTop;
          const minLeft = scrollX + buffer;
          let maxLeft = scrollX + viewportWidth - contentWidth - buffer;
          if(!Number.isFinite(maxLeft) || maxLeft < minLeft){
            maxLeft = minLeft;
          }
          let preferredLeft = scrollX + triggerRect.left;
          if(preferredLeft > maxLeft){
            preferredLeft = maxLeft;
          }
          if(preferredLeft < minLeft){
            preferredLeft = minLeft;
          }
          left = preferredLeft;
        }
        content.style.top = Math.round(top) + 'px';
        content.style.left = Math.round(left) + 'px';
      };
      const scheduleAlign = ()=>{
        if(!overlay.classList.contains('visible')) return;
        const run = ()=>{
          if(!overlay.classList.contains('visible')) return;
          alignOverlay();
        };
        if(typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'){
          window.requestAnimationFrame(run);
        } else {
          setTimeout(run, 16);
        }
      };
      const pointerDownHandler = event=>{
        if(!overlay.classList.contains('visible')) return;
        const target = event.target;
        if(!target) return;
        if(content.contains(target)) return;
        const triggerNode = subcategoryFieldOverlayTrigger;
        if(triggerNode && typeof triggerNode.contains === 'function' && triggerNode.contains(target)) return;
        closeSubcategoryFieldOverlay();
      };
      document.addEventListener('pointerdown', pointerDownHandler, true);
      subcategoryFieldOverlayPointerDownHandler = pointerDownHandler;
      const onScroll = ()=> scheduleAlign();
      const onResize = ()=> scheduleAlign();
      window.addEventListener('scroll', onScroll, true);
      window.addEventListener('resize', onResize);
      subcategoryFieldOverlayScrollHandler = onScroll;
      subcategoryFieldOverlayResizeHandler = onResize;
      requestAnimationFrame(()=>{
        alignOverlay();
        const focusSelectors = [
          'input:not([disabled]):not([tabindex="-1"])',
          'select:not([disabled]):not([tabindex="-1"])',
          'textarea:not([disabled]):not([tabindex="-1"])',
          'button:not([disabled]):not([tabindex="-1"])',
          '[href]:not([tabindex="-1"])',
          '[tabindex]:not([tabindex="-1"])',
          '[contenteditable="true"]'
        ].join(', ');
        const focusTarget = row.querySelector(focusSelectors);
        if(focusTarget && typeof focusTarget.focus === 'function'){
          try{ focusTarget.focus({ preventScroll: true }); }
          catch(err){
            try{ focusTarget.focus(); }catch(e){}
          }
        } else if(typeof content.focus === 'function'){
          try{ content.focus({ preventScroll: true }); }
          catch(err){
            try{ content.focus(); }catch(e){}
          }
        }
      });
      scheduleAlign();
    }
    const refreshFormbuilderSubcategoryLogos = ()=>{
      if(!formbuilderCats) return;
      formbuilderCats.querySelectorAll('.subcategory-form-menu').forEach(menu=>{
        const logoSpan = menu.querySelector('.subcategory-logo');
        if(!logoSpan) return;
        const subName = menu.dataset.subcategory || '';
        const iconLookup = lookupIconPath(subcategoryIconPaths, null, subName);
        const path = iconLookup.found ? (iconLookup.path || '') : '';
        const iconHtml = subcategoryIcons[subName] || '';
        const normalizedPath = applyNormalizeIconPath(path);
        logoSpan.innerHTML = '';
        if(normalizedPath){
          const img = document.createElement('img');
          img.src = normalizedPath;
          img.alt = '';
          logoSpan.appendChild(img);
          logoSpan.classList.add('has-icon');
        } else if(iconHtml){
          logoSpan.innerHTML = iconHtml;
          logoSpan.classList.add('has-icon');
        } else {
          logoSpan.textContent = subName ? subName.charAt(0) : '';
          logoSpan.classList.remove('has-icon');
        }
      });
    };
    
    
    const renderFormbuilderCats = ()=>{
      if(!formbuilderCats) return;
      const applyNormalizeIconPath = window.applyNormalizeIconPath || ((path) => path);
      if(typeof closeSubcategoryFieldOverlay === 'function'){
        closeSubcategoryFieldOverlay();
      }
      if(typeof window.closeAllIconPickers === 'function'){
        window.closeAllIconPickers();
      }
      
      // Function to load available icons from a folder
      const loadIconsFromFolder = async (folderPath) => {
        if(!folderPath) return [];
        try {
          const response = await fetch(`/gateway.php?action=list-icons&folder=${encodeURIComponent(folderPath)}`);
          if(!response.ok) return [];
          const data = await response.json();
          if(data.success && Array.isArray(data.icons)){
            return data.icons.map(icon => `${folderPath}/${icon}`);
          }
        } catch(err){
          console.warn('Failed to load icons from folder:', err);
        }
        return [];
      };
      
      const attachIconPicker = (trigger, container, options = {})=>{
        const applyNormalizeIconPath = window.applyNormalizeIconPath || ((path) => path);
        const opts = options || {};
        const getCurrentPath = typeof opts.getCurrentPath === 'function' ? opts.getCurrentPath : (()=> '');
        const onSelect = typeof opts.onSelect === 'function' ? opts.onSelect : (()=>{});
        const label = typeof opts.label === 'string' && opts.label.trim() ? opts.label.trim() : 'Choose Icon';
        const parentMenu = opts.parentMenu || null;
        const parentCategoryMenu = opts.parentCategoryMenu || null;
        const useIconFolder = opts.useIconFolder !== false;
        const customIconFolder = typeof opts.iconFolder === 'string' ? opts.iconFolder : null;
        let popup = null;
        let alignFrame = 0;
        let resizeObserver = null;

        const alignPopup = ()=>{
          if(!popup) return;
          let triggerRect;
          let containerRect;
          try {
            triggerRect = trigger.getBoundingClientRect();
            containerRect = container.getBoundingClientRect();
          } catch(err){
            return;
          }
          const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
          const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
          let left = triggerRect.left - containerRect.left;
          let top = triggerRect.bottom - containerRect.top + 8;
          popup.style.left = '0px';
          popup.style.top = '0px';
          const popupRect = popup.getBoundingClientRect();
          const overflowRight = triggerRect.left + popupRect.width - viewportWidth + 12;
          if(overflowRight > 0){
            left -= overflowRight;
          }
          const overflowLeft = containerRect.left + left;
          if(overflowLeft < 8){
            left += 8 - overflowLeft;
          }
          const desiredBottom = triggerRect.bottom + 8 + popupRect.height;
          if(desiredBottom > viewportHeight - 12){
            const altTop = triggerRect.top - containerRect.top - popupRect.height - 8;
            if(altTop + containerRect.top >= 12 || desiredBottom >= viewportHeight){
              top = Math.max(0, altTop);
            }
          }
          if(containerRect.left + left < 0){
            left = -containerRect.left;
          }
          popup.style.left = `${Math.round(left)}px`;
          popup.style.top = `${Math.round(Math.max(0, top))}px`;
        };

        const scheduleAlign = ()=>{
          if(!popup) return;
          if(alignFrame){
            cancelAnimationFrame(alignFrame);
          }
          alignFrame = requestAnimationFrame(()=>{
            alignFrame = 0;
            alignPopup();
          });
        };

        const closePicker = ()=>{
          if(!popup) return;
          popup.remove();
          popup = null;
          if(alignFrame){
            cancelAnimationFrame(alignFrame);
            alignFrame = 0;
          }
          container.classList.remove('iconpicker-open');
          if(parentMenu) parentMenu.classList.remove('has-floating-overlay');
          if(parentCategoryMenu) parentCategoryMenu.classList.remove('has-floating-overlay');
          document.removeEventListener('pointerdown', handlePointerDown, true);
          document.removeEventListener('keydown', handleKeyDown, true);
          window.removeEventListener('scroll', handleScroll, true);
          window.removeEventListener('resize', handleResize);
          if(resizeObserver){
            try{ resizeObserver.disconnect(); }catch(err){}
            resizeObserver = null;
          }
          OPEN_ICON_PICKERS.delete(closePicker);
        };

        const handlePointerDown = event => {
          if(!popup) return;
          const target = event.target;
          if(!target) return;
          if(target === trigger || (typeof trigger.contains === 'function' && trigger.contains(target))) return;
          if(popup.contains(target)) return;
          closePicker();
        };
        const handleKeyDown = event => {
          if(event.key === 'Escape'){
            closePicker();
          }
        };
        const handleScroll = ()=> scheduleAlign();
        const handleResize = ()=> scheduleAlign();

        const openPicker = async ()=>{
          if(popup) return;
          if(typeof window.closeAllIconPickers === 'function'){
            window.closeAllIconPickers();
          }
          
          // Load icons from folder if configured
          let iconsToShow = [];
          const folderToUse = customIconFolder || window.iconFolder;
          if(useIconFolder && folderToUse){
            try {
              iconsToShow = await loadIconsFromFolder(folderToUse);
            } catch(err){
              console.warn('Failed to load from icon folder', err);
            }
          }
          
          popup = document.createElement('div');
          popup.className = 'icon-picker-popup';
          popup.setAttribute('role', 'dialog');
          popup.setAttribute('aria-label', label);
          popup.tabIndex = -1;
          popup.style.position = 'absolute';
          const grid = document.createElement('div');
          grid.className = 'icon-picker-grid';
          
          if(!iconsToShow.length){
            console.warn('No icons available to display in picker');
            const errorMsg = document.createElement('div');
            errorMsg.className = 'icon-picker-error';
            errorMsg.innerHTML = 'No icons found.<br><br>Please select the icon folder in the Admin Settings Tab.<br><br>Example: <code>assets/icons</code>';
            grid.appendChild(errorMsg);
            // Load error message from DB
            (async () => {
              const msg = await getMessage('msg_error_no_icons', {}, true) || errorMsg.innerHTML;
              if(msg) errorMsg.innerHTML = msg;
            })();
          } else {
          const currentPath = applyNormalizeIconPath(getCurrentPath());
          // Load "No Icon" label from DB
          const noIconLabel = await getMessage('msg_label_no_icon', {}, true) || 'No Icon';
          const optionsList = [{ value: '', label: noIconLabel }];
            iconsToShow.forEach(path => {
            if(typeof path === 'string' && path.trim()){
              optionsList.push({ value: applyNormalizeIconPath(path) });
            }
          });
          for(const entry of optionsList){
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'icon-picker-option';
            const value = entry.value || '';
            if(!value){
              btn.classList.add('icon-picker-option--clear');
              // Use entry.label (which is already loaded from DB) or fallback
              btn.textContent = entry.label || noIconLabel;
            } else {
              const img = document.createElement('img');
              img.src = value;
              img.alt = '';
              btn.appendChild(img);
            }
            if(value === currentPath){
              btn.classList.add('selected');
            }
            btn.addEventListener('click', ()=>{
              onSelect(value);
              closePicker();
            });
            grid.appendChild(btn);
          }
          }
          popup.appendChild(grid);
          container.appendChild(popup);
          container.classList.add('iconpicker-open');
          if(parentMenu) parentMenu.classList.add('has-floating-overlay');
          if(parentCategoryMenu) parentCategoryMenu.classList.add('has-floating-overlay');
          scheduleAlign();
          document.addEventListener('pointerdown', handlePointerDown, true);
          document.addEventListener('keydown', handleKeyDown, true);
          window.addEventListener('scroll', handleScroll, true);
          window.addEventListener('resize', handleResize);
          if(typeof ResizeObserver === 'function'){
            resizeObserver = new ResizeObserver(()=> scheduleAlign());
            try{ resizeObserver.observe(container); }catch(err){ resizeObserver = null; }
          }
          OPEN_ICON_PICKERS.add(closePicker);
          requestAnimationFrame(()=>{
            try{ popup.focus({ preventScroll: true }); }
            catch(err){ try{ popup.focus(); }catch(e){} }
          });
        };
        trigger.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          openPicker();
        });
        trigger.addEventListener('keydown', event => {
          if(event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar'){
            event.preventDefault();
            openPicker();
          }
        });
        // Enable picker if we have icon folder (or custom folder specified)
        const folderAvailable = customIconFolder || window.iconFolder || window.adminIconFolder;
        if(!folderAvailable){
          trigger.disabled = true;
          trigger.setAttribute('aria-disabled','true');
        } else {
          trigger.disabled = false;
          trigger.removeAttribute('aria-disabled');
        }
        return { open: openPicker, close: closePicker };
      };
      
      // Make icon picker functions globally available for Messages tab
      window.loadIconsFromFolder = loadIconsFromFolder;
      window.attachIconPicker = attachIconPicker;
      
      const frag = document.createDocumentFragment();
      const sortedCategoryEntries = getSortedCategoryEntries(categories);
      sortedCategoryEntries.forEach(({ category: c, index: sourceIndex }, viewIndex)=>{
        const baseId = slugify(c.name) || `category-${viewIndex + 1}`;
        const contentId = `category-form-content-${baseId}-${viewIndex}`;
        const editPanelId = `category-edit-panel-${baseId}-${viewIndex}`;

        const menu = document.createElement('div');
        menu.className = 'category-form-menu filter-category-menu';
        menu.dataset.category = c.name;
        menu.dataset.categoryIndex = String(sourceIndex);
        menu.setAttribute('role','group');
        menu.setAttribute('aria-expanded','false');

        const header = document.createElement('div');
        header.className = 'formbuilder-category-header';

        const triggerWrap = document.createElement('div');
        triggerWrap.className = 'options-dropdown filter-category-trigger-wrap';

        const menuBtn = document.createElement('button');
        menuBtn.type = 'button';
        menuBtn.className = 'filter-category-trigger';
        menuBtn.setAttribute('aria-haspopup','true');
        menuBtn.setAttribute('aria-expanded','false');
        menuBtn.setAttribute('aria-controls', contentId);

        const categoryLogo = document.createElement('span');
        categoryLogo.className = 'category-logo';
        const categoryIconHtml = categoryIcons[c.name] || '';
        const categoryIconLookup = lookupIconPath(categoryIconPaths, c.id, c.name);
        const initialCategoryIconSrc = categoryIconLookup.found
          ? (categoryIconLookup.path || '')
          : extractIconSrc(categoryIconHtml);
        if(initialCategoryIconSrc){
          const applyNormalizeIconPath = window.applyNormalizeIconPath || ((path) => path);
          const normalizedInitial = applyNormalizeIconPath(initialCategoryIconSrc);
          if(normalizedInitial){
            categoryIcons[c.name] = `<img src="${normalizedInitial}" alt="">`;
            if(!categoryIconLookup.found){
              writeIconPath(categoryIconPaths, c.id, c.name, normalizedInitial);
            }
          }
          const img = document.createElement('img');
          img.src = applyNormalizeIconPath(initialCategoryIconSrc);
          img.alt = '';
          categoryLogo.appendChild(img);
          categoryLogo.classList.add('has-icon');
        } else if(categoryIconHtml){
          categoryLogo.innerHTML = categoryIconHtml;
          categoryLogo.classList.add('has-icon');
        } else {
          categoryLogo.textContent = c.name.charAt(0) || '';
        }

        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = c.name;

        const arrow = document.createElement('span');
        arrow.className = 'dropdown-arrow';
        arrow.setAttribute('aria-hidden','true');

        menuBtn.append(categoryLogo, label, arrow);
        triggerWrap.append(menuBtn);

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'category-edit-btn';
        editBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M12.854 1.146a.5.5 0 0 1 .707 0l1.293 1.293a.5.5 0 0 1 0 .707l-8.939 8.939a.5.5 0 0 1-.233.131l-3.5.875a.5.5 0 0 1-.606-.606l.875-3.5a.5.5 0 0 1 .131-.233l8.939-8.939z"/><path d="M2.5 12.5V14h1.5l9-9-1.5-1.5-9 9z"/></svg>';
        editBtn.setAttribute('aria-label', `Edit ${c.name} category`);
        editBtn.setAttribute('aria-expanded','false');

        const categoryDragHandle = createFormbuilderDragHandle(`Reorder ${c.name || 'Category'} category`, 'category-drag-handle');

        const toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.checked = true;
        toggleInput.setAttribute('aria-label', `Toggle ${c.name} category`);
        toggleInput.hidden = true;

        header.append(triggerWrap, categoryDragHandle, editBtn, toggleInput);
        menu.append(header);

        const content = document.createElement('div');
        content.className = 'category-form-content';
        content.id = contentId;
        content.hidden = true;

        const editMenu = document.createElement('div');
        editMenu.className = 'category-edit-menu';

        const editPanel = document.createElement('div');
        editPanel.className = 'category-edit-panel';
        editPanel.id = editPanelId;

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'category-name-input';
        nameInput.placeholder = 'Category Name';
        nameInput.value = c.name || '';

        const iconPicker = document.createElement('div');
        iconPicker.className = 'iconpicker-container';

        const iconPickerButton = document.createElement('button');
        iconPickerButton.type = 'button';
        iconPickerButton.className = 'iconpicker-button';
        iconPickerButton.dataset.messageKey = initialCategoryIconSrc ? 'msg_button_change_icon' : 'msg_button_choose_icon';
        // Text will be loaded from DB

        const preview = document.createElement('div');
        preview.className = 'iconpicker-preview';
        const previewLabel = document.createElement('span');
        previewLabel.dataset.messageKey = 'msg_label_no_icon';
        // Text will be loaded from DB
        const previewImg = document.createElement('img');
        previewImg.alt = `${c.name} icon preview`;
        preview.append(previewLabel, previewImg);
        const applyNormalizeIconPath = window.applyNormalizeIconPath || ((path) => path);
        const normalizedCategoryIconPath = applyNormalizeIconPath(initialCategoryIconSrc);
        if(normalizedCategoryIconPath){
          previewImg.src = normalizedCategoryIconPath;
          preview.classList.add('has-image');
          previewLabel.textContent = '';
          iconPickerButton.textContent = 'Change Icon';
          if(!categoryIconLookup.found){
            writeIconPath(categoryIconPaths, c.id, c.name, normalizedCategoryIconPath);
          }
        }
        iconPicker.append(preview, iconPickerButton);
        attachIconPicker(iconPickerButton, iconPicker, {
          getCurrentPath: ()=> applyNormalizeIconPath(getCategoryIconPath(c)),
          onSelect: value => {
            updateCategoryIconDisplay(value);
            notifyFormbuilderChange();
          },
          label: `Choose icon for ${c.name}`,
          parentMenu: content,
          parentCategoryMenu: menu
        });

        let addSubBtn = document.createElement('button');
        addSubBtn.type = 'button';
        addSubBtn.className = 'add-subcategory-btn';
        addSubBtn.dataset.messageKey = 'msg_button_add_subcategory';
        // Set fallback text in case messages don't load immediately
        addSubBtn.textContent = 'Add Subcategory';
        // Text will be updated from DB when messages are available (via MutationObserver)
        addSubBtn.setAttribute('aria-label', `Add subcategory to ${c.name}`);

        const saveCategoryBtn = document.createElement('button');
        saveCategoryBtn.type = 'button';
        saveCategoryBtn.className = 'save-changes primary-action formbuilder-inline-save';
        saveCategoryBtn.dataset.messageKey = 'msg_button_save';
        // Text will be loaded from DB
        saveCategoryBtn.setAttribute('aria-label', 'Save changes');
        saveCategoryBtn.addEventListener('click', (e)=>{
          e.preventDefault();
          e.stopPropagation();
          if(typeof window.adminPanelModule?.runSave === 'function'){
            window.adminPanelModule.runSave({ closeAfter:false });
          }
          editPanel.hidden = true;
          editBtn.setAttribute('aria-expanded', 'false');
        });

        const deleteCategoryBtn = document.createElement('button');
        deleteCategoryBtn.type = 'button';
        deleteCategoryBtn.className = 'delete-category-btn';
        deleteCategoryBtn.dataset.messageKey = 'msg_button_delete_category';
        // Text will be loaded from DB
        deleteCategoryBtn.setAttribute('aria-label', `Delete ${c.name} category`);

        const hideToggleRow = document.createElement('div');
        hideToggleRow.className = 'category-hide-toggle-row';
        const hideToggleLabel = document.createElement('span');
        hideToggleLabel.dataset.messageKey = 'msg_label_hide_category';
        // Text will be loaded from DB
        const hideToggle = document.createElement('label');
        hideToggle.className = 'switch';
        const hideToggleInput = document.createElement('input');
        hideToggleInput.type = 'checkbox';
        hideToggleInput.checked = typeof c.hidden === 'boolean' ? c.hidden : !toggleInput.checked;
        const hideToggleSlider = document.createElement('span');
        hideToggleSlider.className = 'slider';
        hideToggle.append(hideToggleInput, hideToggleSlider);
        hideToggleRow.append(hideToggleLabel, hideToggle);
        
        hideToggleInput.addEventListener('change', ()=>{
          c.hidden = hideToggleInput.checked;
          toggleInput.checked = !hideToggleInput.checked;
          toggleInput.dispatchEvent(new Event('change', {bubbles: true}));
          notifyFormbuilderChange();
        });
        
        toggleInput.addEventListener('change', ()=>{
          hideToggleInput.checked = !toggleInput.checked;
          c.hidden = hideToggleInput.checked;
          notifyFormbuilderChange();
        });
        
        const saveCategoryRow = document.createElement('div');
        saveCategoryRow.className = 'formbuilder-save-row';
        saveCategoryRow.append(saveCategoryBtn);
        
        const deleteCategoryRow = document.createElement('div');
        deleteCategoryRow.className = 'formbuilder-delete-row';
        deleteCategoryRow.append(deleteCategoryBtn);

        editPanel.append(nameInput, iconPicker, hideToggleRow, saveCategoryRow, deleteCategoryRow);
        editPanel.hidden = true;
        editPanel.style.position = 'absolute';
        editPanel.style.right = '0';
        editPanel.style.top = 'calc(100% + 10px)';
        editPanel.style.zIndex = '100';
        header.append(editPanel);
        
        editBtn.addEventListener('click', (e)=>{
          e.stopPropagation();
          document.querySelectorAll('.category-edit-panel, .subcategory-edit-panel').forEach(panel => {
            if(panel === editPanel) return;
            panel.hidden = true;
            const relatedButton = panel.parentElement
              ? panel.parentElement.querySelector('.category-edit-btn, .subcategory-edit-btn')
              : null;
            if(relatedButton){
              relatedButton.setAttribute('aria-expanded','false');
            }
          });
          closeFieldEditPanels();
          editPanel.hidden = !editPanel.hidden;
          editBtn.setAttribute('aria-expanded', editPanel.hidden ? 'false' : 'true');
        });

        const handleCategoryEditPointerDown = event => {
          if(editPanel.hidden){
            return;
          }
          const target = event.target;
          if(editPanel.contains(target)){
            return;
          }
          const clickedEditBtn = target.closest('.category-edit-btn, .subcategory-edit-btn, .field-edit-btn');
          if(clickedEditBtn){
            return;
          }
          editPanel.hidden = true;
          editBtn.setAttribute('aria-expanded', 'false');
        };
        document.addEventListener('pointerdown', handleCategoryEditPointerDown, true);
        editMenu.appendChild(addSubBtn);
        const cleanAddSubBtn = addSubBtn.cloneNode(true);
        editMenu.replaceChild(cleanAddSubBtn, addSubBtn);
        addSubBtn = cleanAddSubBtn;

        const subMenusContainer = document.createElement('div');
        subMenusContainer.className = 'subcategory-form-menus';
        const addSubAnchor = document.createElement('div');
        addSubAnchor.className = 'subcategory-drop-anchor';
        subMenusContainer.append(addSubAnchor);

        const subNameUpdaters = [];
        const subFieldsMap = (c.subFields && typeof c.subFields === 'object' && !Array.isArray(c.subFields)) ? c.subFields : (c.subFields = {});
        const getCategoryNameValue = ()=> nameInput.value.trim();
        let lastCategoryName = c.name || 'Category';
        let currentCategoryName = c.name || 'Category';
        const getCategoryDisplayName = ()=> getCategoryNameValue() || lastCategoryName || 'Category';
        const updateCategoryIconDisplay = (src)=>{
          const applyNormalizeIconPath = window.applyNormalizeIconPath || ((path) => path);
          const displayName = getCategoryDisplayName();
          categoryLogo.innerHTML = '';
          const normalizedSrc = applyNormalizeIconPath(src);
          if(normalizedSrc){
            const img = document.createElement('img');
            img.src = normalizedSrc;
            img.alt = '';
            categoryLogo.appendChild(img);
            categoryLogo.classList.add('has-icon');
            categoryIcons[currentCategoryName] = `<img src="${normalizedSrc}" alt="">`;
            writeIconPath(categoryIconPaths, c.id, currentCategoryName, normalizedSrc);
          } else {
            categoryLogo.textContent = displayName.charAt(0) || '';
            categoryLogo.classList.remove('has-icon');
            delete categoryIcons[currentCategoryName];
            writeIconPath(categoryIconPaths, c.id, currentCategoryName, '');
          }
          if(normalizedSrc){
            previewImg.src = normalizedSrc;
            preview.classList.add('has-image');
            previewLabel.textContent = '';
            (async ()=>{
              const changeIconMsg = await getMessage('msg_button_change_icon', {}, true) || 'Change Icon';
              iconPickerButton.textContent = changeIconMsg;
            })();
          } else {
            previewImg.removeAttribute('src');
            preview.classList.remove('has-image');
            (async ()=>{
              const noIconMsg = await getMessage('msg_label_no_icon', {}, true) || 'No Icon';
              previewLabel.textContent = noIconMsg;
            })();
            (async ()=>{
              const chooseIconMsg = await getMessage('msg_button_choose_icon', {}, true) || 'Choose Icon';
              iconPickerButton.textContent = chooseIconMsg;
            })();
          }
        };
        const applyCategoryNameChange = ()=>{
          const nameValue = getCategoryNameValue();
          if(nameValue){
            lastCategoryName = nameValue;
          }
          const displayName = getCategoryDisplayName();
          const datasetValue = displayName;
          const previousName = currentCategoryName;
          if(previousName !== datasetValue){
            if(categoryIcons[previousName] !== undefined){
              if(categoryIcons[datasetValue] === undefined){
                categoryIcons[datasetValue] = categoryIcons[previousName];
              }
              delete categoryIcons[previousName];
            }
            renameIconNameKey(categoryIconPaths, previousName, datasetValue);
          }
          currentCategoryName = datasetValue;
          c.name = datasetValue;
          if(Array.isArray(categories) && categories[sourceIndex] && typeof categories[sourceIndex] === 'object'){
            categories[sourceIndex].name = datasetValue;
          }
          menu.dataset.category = datasetValue;
          label.textContent = displayName;
          toggleInput.setAttribute('aria-label', `Toggle ${displayName} category`);
          updateDragHandleLabel(categoryDragHandle, `Reorder ${displayName} category`);
          iconPickerButton.setAttribute('aria-label', `Choose icon for ${displayName}`);
          previewImg.alt = `${displayName} icon preview`;
          deleteCategoryBtn.setAttribute('aria-label', `Delete ${displayName} category`);
          addSubBtn.setAttribute('aria-label', `Add subcategory to ${displayName}`);
          subMenusContainer.querySelectorAll('.subcategory-form-menu').forEach(subEl=>{
            subEl.dataset.category = datasetValue;
          });
          if(categoryLogo.querySelector('img')){
            categoryLogo.classList.add('has-icon');
          } else {
            updateCategoryIconDisplay('');
          }
          subNameUpdaters.forEach(fn=>{
            try{ fn(); }catch(err){}
          });
        };
        nameInput.addEventListener('input', applyCategoryNameChange);
        deleteCategoryBtn.addEventListener('click', async ()=>{
          const displayName = getCategoryDisplayName();
          const confirmed = await confirmFormbuilderDeletion(`Delete the "${displayName}" category?`, 'Delete Category');
          if(!confirmed) return;
          if(subcategoryFieldOverlayContent && typeof closeSubcategoryFieldOverlay === 'function'){
            const activeRow = subcategoryFieldOverlayContent.querySelector('.subcategory-field-row');
            if(activeRow && menu.contains(activeRow)){
              closeSubcategoryFieldOverlay();
            }
          }
          delete categoryIcons[currentCategoryName];
          deleteIconKeys(categoryIconPaths, c.id, currentCategoryName);
          if(c.subs && Array.isArray(c.subs)){
            c.subs.forEach(subName => {
              const subId = c.subIds && Object.prototype.hasOwnProperty.call(c.subIds, subName) ? c.subIds[subName] : null;
              deleteIconKeys(subcategoryIconPaths, subId, subName);
            });
          }
          const categoryIndex = categories.indexOf(c);
          if(categoryIndex !== -1){
            categories.splice(categoryIndex, 1);
          }
          menu.remove();
          notifyFormbuilderChange();
          
          // Update formbuilder state manager snapshot first
          if(window.formbuilderStateManager && typeof window.formbuilderStateManager.save === 'function'){
            try {
              window.formbuilderStateManager.save();
            } catch(err) {
              console.error('[Formbuilder] Failed to update state manager:', err);
            }
          }
          
          // Trigger auto-save after deletion
          if(typeof window.adminPanelModule?.runSave === 'function'){
            setTimeout(() => {
              window.adminPanelModule.runSave({ closeAfter: false });
            }, 100);
          }
        });

        c.subs.forEach((sub, subIndex)=>{
          const subMenu = document.createElement('div');
          subMenu.className = 'subcategory-form-menu';
          subMenu.dataset.category = c.name;
          subMenu.dataset.subcategory = sub;
          subMenu.dataset.subIndex = String(subIndex);
          subMenu.setAttribute('aria-expanded','false');

          const subHeader = document.createElement('div');
          subHeader.className = 'formbuilder-subcategory-header';

          const subTriggerWrap = document.createElement('div');
          subTriggerWrap.className = 'options-dropdown subcategory-trigger-wrap';

          const subContentId = `subcategory-form-content-${baseId}-${subIndex}`;
          const subBtn = document.createElement('button');
          subBtn.type = 'button';
          subBtn.className = 'subcategory-form-trigger';
          subBtn.setAttribute('aria-expanded','false');
          subBtn.setAttribute('aria-controls', subContentId);

          const subLabelWrap = document.createElement('span');
          subLabelWrap.className = 'subcategory-label-wrap';

          const subLogo = document.createElement('span');
          subLogo.className = 'subcategory-logo';
          const subIconHtml = subcategoryIcons[sub] || '';
          const subIconLookup = lookupIconPath(subcategoryIconPaths, c.subIds && Object.prototype.hasOwnProperty.call(c.subIds, sub) ? c.subIds[sub] : null, sub);
          const initialSubIconPath = subIconLookup.found ? (subIconLookup.path || '') : extractIconSrc(subIconHtml);
          const applyNormalizeIconPath = window.applyNormalizeIconPath || ((path) => path);
          if(initialSubIconPath){
            const normalizedInitialSub = applyNormalizeIconPath(initialSubIconPath);
            if(normalizedInitialSub){
              subcategoryIcons[sub] = `<img src="${normalizedInitialSub}" alt="">`;
            }
          }
          if(initialSubIconPath){
            const img = document.createElement('img');
            img.src = applyNormalizeIconPath(initialSubIconPath);
            img.alt = '';
            subLogo.appendChild(img);
            subLogo.classList.add('has-icon');
            if(!subIconLookup.found){
              writeIconPath(subcategoryIconPaths, c.subIds && Object.prototype.hasOwnProperty.call(c.subIds, sub) ? c.subIds[sub] : null, sub, applyNormalizeIconPath(initialSubIconPath));
            }
          } else if(subIconHtml){
            subLogo.innerHTML = subIconHtml;
            subLogo.classList.add('has-icon');
          } else {
            subLogo.textContent = sub.charAt(0) || '';
          }

          const subLabel = document.createElement('span');
          subLabel.className = 'subcategory-label';
          subLabel.textContent = sub;

          subLabelWrap.append(subLogo, subLabel);

          const subArrow = document.createElement('span');
          subArrow.className = 'dropdown-arrow';
          subArrow.setAttribute('aria-hidden','true');

          subBtn.append(subLabelWrap, subArrow);
          subTriggerWrap.append(subBtn);

          const subEditBtn = document.createElement('button');
          subEditBtn.type = 'button';
          subEditBtn.className = 'subcategory-edit-btn';
          subEditBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M12.854 1.146a.5.5 0 0 1 .707 0l1.293 1.293a.5.5 0 0 1 0 .707l-8.939 8.939a.5.5 0 0 1-.233.131l-3.5.875a.5.5 0 0 1-.606-.606l.875-3.5a.5.5 0 0 1 .131-.233l8.939-8.939z"/><path d="M2.5 12.5V14h1.5l9-9-1.5-1.5-9 9z"/></svg>';
          subEditBtn.setAttribute('aria-label', `Edit ${sub} subcategory`);
          subEditBtn.setAttribute('aria-expanded','false');

          const subDragHandle = createFormbuilderDragHandle(`Reorder ${sub || 'Subcategory'} subcategory`, 'subcategory-drag-handle');

          const subInput = document.createElement('input');
          subInput.type = 'checkbox';
          subInput.checked = true;
          subInput.setAttribute('aria-label', `Toggle ${sub} subcategory`);
          subInput.hidden = true;

          subHeader.append(subTriggerWrap, subDragHandle, subEditBtn, subInput);
          subMenu.append(subHeader);

          const subContent = document.createElement('div');
          subContent.className = 'subcategory-form-content';
          subContent.id = subContentId;
          subContent.hidden = true;

          const subNameInput = document.createElement('input');
          subNameInput.type = 'text';
          subNameInput.className = 'subcategory-name-input';
          subNameInput.placeholder = 'Subcategory Name';
          subNameInput.value = sub || '';

          const subIconPicker = document.createElement('div');
          subIconPicker.className = 'iconpicker-container';

          const subIconButton = document.createElement('button');
          subIconButton.type = 'button';
          subIconButton.className = 'iconpicker-button';
          subIconButton.dataset.messageKey = initialSubIconPath ? 'msg_button_change_icon' : 'msg_button_choose_icon';
          // Text will be loaded from DB

          const subPreview = document.createElement('div');
          subPreview.className = 'iconpicker-preview';
          const subPreviewLabel = document.createElement('span');
          subPreviewLabel.dataset.messageKey = 'msg_label_no_icon';
          // Text will be loaded from DB
          const subPreviewImg = document.createElement('img');
          subPreviewImg.alt = `${sub} icon preview`;
          subPreview.append(subPreviewLabel, subPreviewImg);
    

          subIconPicker.append(subPreview, subIconButton);
          attachIconPicker(subIconButton, subIconPicker, {
            getCurrentPath: ()=> applyNormalizeIconPath(getSubcategoryIconPath(c, currentSubName)),
            onSelect: value => {
              updateSubIconDisplay(value);
              notifyFormbuilderChange();
            },
            label: `Choose icon for ${sub}`,
            parentMenu: subContent,
            parentCategoryMenu: menu
          });

          const deleteSubBtn = document.createElement('button');
          deleteSubBtn.type = 'button';
          deleteSubBtn.className = 'delete-subcategory-btn';
          deleteSubBtn.dataset.messageKey = 'msg_button_delete_subcategory';
          // Text will be loaded from DB
          deleteSubBtn.setAttribute('aria-label', `Delete ${sub} subcategory from ${c.name}`);

          const fieldsSection = document.createElement('div');
          fieldsSection.className = 'subcategory-fields-section';

          const fieldsList = document.createElement('div');
          fieldsList.className = 'subcategory-fields-list';
          fieldsSection.appendChild(fieldsList);

          const addFieldBtn = document.createElement('button');
          addFieldBtn.type = 'button';
          addFieldBtn.className = 'add-field-btn';
          addFieldBtn.dataset.messageKey = 'msg_button_add_field';
          // Text will be loaded from DB
          addFieldBtn.setAttribute('aria-label', `Add field to ${sub}`);

          const ensureFieldDefaults = (field)=>{
            const safeField = field && typeof field === 'object' ? field : {};
            if(typeof safeField.name !== 'string'){
              safeField.name = '';
            } else if(!safeField.name.trim()){
              safeField.name = '';
          }
          if(typeof safeField.type !== 'string'){
            safeField.type = '';
          } else {
            // Preserve description and text-area types BEFORE normalization
            const originalType = safeField.type;
            const isDescriptionType = originalType === 'description' || originalType === 'text-area' ||
                                     (typeof originalType === 'string' && (originalType.includes('description') || originalType.includes('text-area')));
            
            if(isDescriptionType){
              // Normalize but preserve description/text-area
              const normalizedType = getBaseFieldType(originalType);
              if(normalizedType === 'description' || normalizedType === 'text-area'){
                safeField.type = normalizedType;
              } else if(originalType === 'description' || originalType === 'text-area'){
                safeField.type = originalType;
              } else {
                // Extract description/text-area from the type string
                safeField.type = originalType.includes('description') ? 'description' : 'text-area';
              }
            } else {
              // Normalize field type to extract base type (e.g., "description [field=2]" -> "description")
              const normalizedType = getBaseFieldType(safeField.type);
              if(normalizedType){
                safeField.type = normalizedType;
              }
            }
          }
          // Ensure key and fieldTypeKey sync with each other if one is missing
          if(!safeField.key && safeField.fieldTypeKey){
            safeField.key = safeField.fieldTypeKey;
          }
          if(!safeField.fieldTypeKey && safeField.key){
            safeField.fieldTypeKey = safeField.key;
          }
          // For brand new fields, default to first field type in list
          // Don't default to first field type - let user select
          // Only set defaults if field type is explicitly provided
          if(!safeField.key && !safeField.fieldTypeKey){
            // Leave unset - user must select from dropdown
          } else if(safeField.fieldTypeKey && !safeField.key){
            safeField.key = safeField.fieldTypeKey;
          } else if(safeField.key && !safeField.fieldTypeKey){
            safeField.fieldTypeKey = safeField.key;
          }
          
          // Only auto-name if field type is explicitly set (not defaulted)
            if(!safeField.name){
              safeField.name = '';
            }
            if(typeof safeField.placeholder !== 'string') safeField.placeholder = '';
            const fieldTypeKey = safeField.fieldTypeKey || safeField.key;
            const existingFieldTypeName = typeof safeField.field_type_name === 'string' ? safeField.field_type_name.trim() : '';
            const existingFieldTypeNameCamel = typeof safeField.fieldTypeName === 'string' ? safeField.fieldTypeName.trim() : '';
            let resolvedFieldTypeName = existingFieldTypeName || existingFieldTypeNameCamel;
            if(!resolvedFieldTypeName && fieldTypeKey){
              const matchingFieldType = FORM_FIELD_TYPES.find(opt => opt.value === fieldTypeKey);
              if(matchingFieldType){
                resolvedFieldTypeName = resolveFieldTypeDisplayName(matchingFieldType);
              }
            }
            resolvedFieldTypeName = resolvedFieldTypeName || '';
            safeField.field_type_name = resolvedFieldTypeName;
            safeField.fieldTypeName = resolvedFieldTypeName;
          // Only auto-name if field type is set AND field doesn't already have a custom name
          // For editable fields, preserve existing custom names
          if(fieldTypeKey && resolvedFieldTypeName){
            const matchingFieldType = FORM_FIELD_TYPES.find(ft => ft.value === fieldTypeKey);
            const isEditable = matchingFieldType && matchingFieldType.formbuilder_editable === true;
            // Only auto-name if not editable OR if name is empty
            if(!isEditable || !safeField.name || safeField.name.trim() === ''){
              safeField.name = resolvedFieldTypeName;
            }
          }
            if(fieldTypeKey === 'location'){
              if(!safeField.placeholder || !safeField.placeholder.trim()){
                safeField.placeholder = 'Search for a location';
              }
              const loc = safeField.location && typeof safeField.location === 'object' ? safeField.location : {};
              const address = typeof loc.address === 'string' ? loc.address : '';
              const latitude = typeof loc.latitude === 'string' ? loc.latitude : '';
              const longitude = typeof loc.longitude === 'string' ? loc.longitude : '';
              safeField.location = { address, latitude, longitude };
            } else if(Object.prototype.hasOwnProperty.call(safeField, 'location')){
              delete safeField.location;
            }
            const hasRequiredProp = Object.prototype.hasOwnProperty.call(safeField, 'required');
            safeField.required = hasRequiredProp ? !!safeField.required : false;
            if(!Array.isArray(safeField.options)){
              safeField.options = [];
            }
            if(fieldTypeKey === 'venue-ticketing'){
              safeField.options = normalizeVenueSessionOptions(safeField.options);
            } else if(fieldTypeKey === 'variant-pricing'){
              safeField.options = safeField.options.map(opt => {
                if(opt && typeof opt === 'object'){
                  return {
                    version: typeof opt.version === 'string' ? opt.version : '',
                    currency: typeof opt.currency === 'string' ? opt.currency : '',
                    price: typeof opt.price === 'string' ? opt.price : ''
                  };
                }
                const str = typeof opt === 'string' ? opt : String(opt ?? '');
                return { version: str, currency: '', price: '' };
              });
              if(safeField.options.length === 0){
                safeField.options.push({ version: '', currency: '', price: '' });
              }
            } else {
              safeField.options = safeField.options.map(opt => {
                if(typeof opt === 'string') return opt;
                if(opt && typeof opt === 'object' && typeof opt.version === 'string'){
                  return opt.version;
                }
                return String(opt ?? '');
              });
              if((safeField.type === 'dropdown' || safeField.type === 'radio') && safeField.options.length === 0){
                safeField.options.push('', '', '');
              }
            }
            if(safeField.type !== 'venue-ticketing'){
              resetVenueAutofillState(safeField);
            }
            return safeField;
          };
          const buildVenueSessionPreview = (previewField, baseId)=>{
            // CRITICAL: Clone options to prevent sharing state between form preview and member forms
            // Each instance needs its own independent copy of the options
            const clonedOptions = Array.isArray(previewField.options) 
              ? previewField.options.map(venue => cloneVenueSessionVenue(venue))
              : [];
            // Create a local field copy to work with, so we don't mutate the original
            const localField = {
              ...previewField,
              options: clonedOptions.length > 0 ? clonedOptions : [venueSessionCreateVenue()]
            };
            
            const editor = document.createElement('div');
            editor.className = 'venue-session-editor';
            editor.setAttribute('aria-required', previewField.required ? 'true' : 'false');
            
            // Detect if we're in member form context (needs stopPropagation to prevent form closure)
            const isMemberForm = baseId && (baseId.includes('memberForm') || baseId.includes('memberCreate'));
            // Detect if we're in formbuilder (needs to sync back to previewField.options)
            const isFormbuilder = !isMemberForm && baseId && (baseId.includes('formPreview') || baseId.includes('formbuilder'));
            
            // For member forms, prevent clicks from bubbling up to prevent form closure
            // BUT allow buttons and geocoder events to propagate so they work
            if(isMemberForm){
              const shouldStopPropagation = (e) => {
                const target = e.target;
                // Don't stop propagation for geocoder elements - they need events to work
                if(target.closest('.mapboxgl-ctrl-geocoder')) return false;
                // Don't stop propagation for buttons - they need clicks to work
                if(target.tagName === 'BUTTON' || target.closest('button')) return false;
                // Don't stop propagation for action button containers
                if(target.closest('.venue-line-actions') || target.closest('.session-date-actions') || target.closest('.session-time-actions')) return false;
                return true;
              };
              
              editor.addEventListener('click', (e)=>{
                if(shouldStopPropagation(e)){
                  e.stopPropagation();
                }
              }, true);
              editor.addEventListener('pointerdown', (e)=>{
                if(shouldStopPropagation(e)){
                  e.stopPropagation();
                }
              }, true);
              editor.addEventListener('mousedown', (e)=>{
                if(shouldStopPropagation(e)){
                  e.stopPropagation();
                }
              }, true);
              editor.addEventListener('change', (e)=>{
                if(shouldStopPropagation(e)){
                  e.stopPropagation();
                }
              }, true);
              editor.addEventListener('focusin', (e)=>{
                if(shouldStopPropagation(e)){
                  e.stopPropagation();
                }
              }, true);
              // CRITICAL: Add input event handler to prevent form closure when typing
              editor.addEventListener('input', (e)=>{
                if(shouldStopPropagation(e)){
                  e.stopPropagation();
                  e.stopImmediatePropagation();
                }
              }, true);
            }
            
            const venueList = document.createElement('div');
            venueList.className = 'venue-session-venues';
            
            // Also stop propagation on venue list for member forms (but allow buttons)
            if(isMemberForm){
              venueList.addEventListener('click', (e)=>{
                const target = e.target;
                if(!target.closest('.mapboxgl-ctrl-geocoder') && !(target.tagName === 'BUTTON' || target.closest('button'))){
                  e.stopPropagation();
                }
              }, true);
              venueList.addEventListener('pointerdown', (e)=>{
                const target = e.target;
                if(!target.closest('.mapboxgl-ctrl-geocoder') && !(target.tagName === 'BUTTON' || target.closest('button'))){
                  e.stopPropagation();
                }
              }, true);
              venueList.addEventListener('change', (e)=>{
                const target = e.target;
                if(!target.closest('.mapboxgl-ctrl-geocoder') && !(target.tagName === 'BUTTON' || target.closest('button'))){
                  e.stopPropagation();
                }
              }, true);
              // CRITICAL: Add input event handler to prevent form closure when typing
              venueList.addEventListener('input', (e)=>{
                const target = e.target;
                if(!target.closest('.mapboxgl-ctrl-geocoder') && !(target.tagName === 'BUTTON' || target.closest('button'))){
                  e.stopPropagation();
                  e.stopImmediatePropagation();
                }
              }, true);
            }
            
            editor.appendChild(venueList);

            const ensureOptions = ()=>{
              // Work with localField.options, not previewField.options
              localField.options = normalizeVenueSessionOptions(localField.options);
              if(!Array.isArray(localField.options) || localField.options.length === 0){
                localField.options = [venueSessionCreateVenue()];
              }
              // Only sync back to previewField.options if we're in formbuilder (not member forms)
              if(isFormbuilder){
                previewField.options = localField.options.map(venue => cloneVenueSessionVenue(venue));
              }
            };
            
            // Sync function to update previewField.options from localField.options (only for formbuilder)
            const syncToPreviewField = ()=>{
              if(isFormbuilder){
                previewField.options = localField.options.map(venue => cloneVenueSessionVenue(venue));
              }
            };

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const currentYear = today.getFullYear();
            const minPickerDate = new Date(today);
            minPickerDate.setMonth(minPickerDate.getMonth() - 12);
            const maxPickerDate = new Date(today);
            maxPickerDate.setFullYear(maxPickerDate.getFullYear() + 2);

            const openPickers = new Set();
            const openSessions = new Set();
            const closeAllPickers = ()=>{
              openPickers.forEach(close => {
                try{ close(); }catch(err){}
              });
              openPickers.clear();
            };

            const createTransientInputAlert = message => {
              let lastTimestamp = 0;
              let activeAlert = null;
              let activeAlertTimeout = 0;
              return target => {
                const candidate = (target && typeof target.getBoundingClientRect === 'function')
                  ? target
                  : ((document && document.activeElement && typeof document.activeElement.getBoundingClientRect === 'function')
                    ? document.activeElement
                    : null);
                const inputEl = candidate && document.body && document.body.contains(candidate) ? candidate : null;
                if(!inputEl) return;
                const now = Date.now();
                if(now - lastTimestamp < 400){
                  if(activeAlert && typeof activeAlert.reposition === 'function'){
                    activeAlert.reposition();
                  }
                  return;
                }
                lastTimestamp = now;
                if(activeAlertTimeout){
                  clearTimeout(activeAlertTimeout);
                  activeAlertTimeout = 0;
                }
                if(activeAlert && typeof activeAlert.remove === 'function'){
                  activeAlert.remove();
                  activeAlert = null;
                }
                const handle = showCopyStyleMessage(message, inputEl);
                if(!handle) return;
                activeAlert = handle;
                activeAlertTimeout = window.setTimeout(()=>{
                  handle.remove();
                  if(activeAlert === handle){
                    activeAlert = null;
                  }
                  activeAlertTimeout = 0;
                }, 1500);
              };
            };

            const currencyAlertMessage = 'Please select a currency before entering a price.';
            const showCurrencyAlert = createTransientInputAlert(currencyAlertMessage);
            const sessionTimeAlertMessage = 'There is already a session for that time.';
            const showSessionTimeAlert = createTransientInputAlert(sessionTimeAlertMessage);

            const sanitizeSessionPriceValue = value => {
              const raw = typeof value === 'string' ? value : String(value ?? '');
              const cleaned = raw.replace(/[^0-9.,]/g, '');
              if(cleaned === '') return '';
              let integerPart = '';
              let fractionPart = '';
              let separator = '';
              for(let i = 0; i < cleaned.length; i++){
                const ch = cleaned[i];
                if(ch >= '0' && ch <= '9'){
                  if(separator){
                    if(fractionPart.length < 2){
                      fractionPart += ch;
                    }
                  } else {
                    integerPart += ch;
                  }
                } else if((ch === '.' || ch === ',') && !separator){
                  separator = ch;
                }
              }
              if(separator){
                if(integerPart === '') integerPart = '0';
                return fractionPart.length > 0 ? `${integerPart}${separator}${fractionPart}` : `${integerPart}${separator}`;
              }
              return integerPart;
            };

            const formatSessionPriceValue = value => {
              const sanitized = sanitizeSessionPriceValue(value);
              if(sanitized === '') return '';
              let normalized = sanitized.replace(',', '.');
              if(normalized === '') return '';
              if(normalized.startsWith('.')){
                normalized = `0${normalized}`;
              }
              const parts = normalized.split('.');
              let integerPart = parts[0].replace(/\D/g, '');
              if(integerPart === ''){
                integerPart = '0';
              }
              let fractionPart = parts[1] || '';
              fractionPart = fractionPart.replace(/\D/g, '');
              if(fractionPart.length === 0){
                fractionPart = '00';
              } else if(fractionPart.length === 1){
                fractionPart = `${fractionPart}0`;
              } else if(fractionPart.length > 2){
                fractionPart = fractionPart.slice(0, 2);
              }
              return `${integerPart}.${fractionPart}`;
            };

            const ensureVenueCurrencyState = venue => {
              let state = VENUE_CURRENCY_STATE.get(venue);
              if(!state){
                state = { currency: '' };
                VENUE_CURRENCY_STATE.set(venue, state);
              }
              if(typeof state.currency !== 'string'){
                state.currency = '';
              }
              return state;
            };

            const findFirstVenueCurrency = venue => {
              if(!venue || !Array.isArray(venue.sessions)) return '';
              for(const session of venue.sessions){
                if(!session || !Array.isArray(session.times)) continue;
                for(const time of session.times){
                  if(!time || !Array.isArray(time.versions)) continue;
                  for(const version of time.versions){
                    if(!version || !Array.isArray(version.tiers)) continue;
                    for(const tier of version.tiers){
                      if(tier && typeof tier.currency === 'string'){
                        const trimmed = tier.currency.trim();
                        if(trimmed) return trimmed;
                      }
                    }
                  }
                }
              }
              return '';
            };

            const getVenueCurrencyValue = venue => {
              const state = ensureVenueCurrencyState(venue);
              if(state.currency){
                return state.currency;
              }
              const detected = findFirstVenueCurrency(venue);
              if(detected){
                state.currency = detected;
                LAST_SELECTED_VENUE_CURRENCY = detected;
                return detected;
              }
              return '';
            };

            const setVenueCurrencyState = (venue, currency)=>{
              const state = ensureVenueCurrencyState(venue);
              const normalized = typeof currency === 'string' ? currency.trim() : '';
              state.currency = normalized;
              if(normalized){
                LAST_SELECTED_VENUE_CURRENCY = normalized;
              }
            };

            const applyCurrencyToVenueData = (venue, currency, options = {})=>{
              const normalized = typeof currency === 'string' ? currency.trim() : '';
              const onlyUnset = options && options.onlyUnset === true;
              const sourceTier = options ? options.sourceTier : null;
              const clearPrices = options && options.clearPrices === true;
              let changed = false;
              if(!venue || !Array.isArray(venue.sessions)) return changed;
              venue.sessions.forEach(session => {
                if(!session || !Array.isArray(session.times)) return;
                session.times.forEach(time => {
                  if(!time || !Array.isArray(time.versions)) return;
                  time.versions.forEach(version => {
                    if(!version || !Array.isArray(version.tiers)) return;
                    version.tiers.forEach(tierItem => {
                      if(!tierItem || typeof tierItem !== 'object') return;
                      if(sourceTier && tierItem === sourceTier) return;
                      const current = typeof tierItem.currency === 'string' ? tierItem.currency : '';
                      if(normalized){
                        if((!onlyUnset || !current) && current !== normalized){
                          tierItem.currency = normalized;
                          changed = true;
                        }
                      } else if(!onlyUnset && current){
                        tierItem.currency = '';
                        changed = true;
                      }
                      if(clearPrices && (!normalized || !current)){
                        if(typeof tierItem.price === 'string' && tierItem.price !== ''){
                          tierItem.price = '';
                          changed = true;
                        }
                      }
                    });
                  });
                });
              });
              return changed;
            };

            const sanitizeTimeInput = value => {
              const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
              if(digits.length <= 2){
                return digits;
              }
              return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
            };

            const formatSessionDate = iso => {
              if(!iso) return '';
              try{
                const parsed = parseISODate(iso);
                const options = {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short'
                };
                if(parsed.getFullYear() !== currentYear){
                  options.year = 'numeric';
                }
                return parsed.toLocaleDateString('en-GB', options).replace(/,/g, '');
              }catch(err){
                return '';
              }
            };

            const getSessionPrimaryTime = session => {
              if(!session || !Array.isArray(session.times)) return '';
              for(let i = 0; i < session.times.length; i++){
                const candidate = session.times[i];
                if(candidate && typeof candidate.time === 'string' && candidate.time.trim() !== ''){
                  return candidate.time.trim();
                }
              }
              const first = session.times[0];
              return first && typeof first.time === 'string' ? first.time.trim() : '';
            };

            const formatSessionDateWithTime = (session, overrideTime) => {
              const dateLabel = formatSessionDate(session && session.date);
              const override = typeof overrideTime === 'string' ? overrideTime.trim() : '';
              const timeLabel = override || getSessionPrimaryTime(session);
              if(dateLabel && timeLabel){
                return `${dateLabel} ${timeLabel}`;
              }
              return dateLabel || timeLabel;
            };

            const setSessionDateInputValue = (input, session, overrideTime) => {
              if(!input) return;
              input.value = formatSessionDateWithTime(session, overrideTime);
            };

            const updateSessionDateInputDisplay = (venueIndex, sessionIndex, overrideTime) => {
              if(!localField || !Array.isArray(localField.options)) return;
              const venue = localField.options[venueIndex];
              if(!venue || !Array.isArray(venue.sessions)) return;
              const session = venue.sessions[sessionIndex];
              if(!session) return;
              const selector = `.session-date-input[data-venue-index="${venueIndex}"][data-session-index="${sessionIndex}"]`;
              const input = editor.querySelector(selector);
              if(!input) return;
              setSessionDateInputValue(input, session, overrideTime);
            };

            const ensureSlot = (venue, index)=>{
              const state = getVenueAutofillState(previewField, venue);
              if(!Array.isArray(state.slots)){
                state.slots = [];
              }
              while(state.slots.length <= index){
                state.slots.push({ value: '', locked: false, source: null });
              }
              const slot = state.slots[index];
              if(!slot || typeof slot !== 'object'){
                state.slots[index] = { value: '', locked: false, source: null };
                return state.slots[index];
              }
              if(typeof slot.value !== 'string') slot.value = '';
              if(typeof slot.locked !== 'boolean') slot.locked = false;
              if(!Object.prototype.hasOwnProperty.call(slot, 'source')) slot.source = null;
              return slot;
            };

            const resetSlotIfEmpty = (venue, index)=>{
              const state = getVenueAutofillState(previewField, venue);
              if(!state || !Array.isArray(state.slots) || !state.slots[index]) return;
              const allEmpty = venue.sessions.every(sess => {
                const t = sess.times[index];
                return !t || !t.time || !t.time.trim();
              });
              if(allEmpty){
                state.slots[index].value = '';
                state.slots[index].locked = false;
                state.slots[index].source = null;
              }
            };

            const isSessionMirrorLocked = venue => {
              const state = getVenueAutofillState(previewField, venue);
              if(typeof state.sessionMirrorLocked !== 'boolean'){
                state.sessionMirrorLocked = false;
              }
              return state.sessionMirrorLocked;
            };

            const lockSessionMirror = venue => {
              const state = getVenueAutofillState(previewField, venue);
              if(state.sessionMirrorLocked === true) return;
              state.sessionMirrorLocked = true;
              if(Array.isArray(state.slots)){
                state.slots.forEach(slot => {
                  if(slot && typeof slot === 'object'){
                    slot.locked = true;
                  }
                });
              }
            };

            const forEachOtherSession = (venue, callback)=>{
              if(!venue || !Array.isArray(venue.sessions)) return;
              venue.sessions.forEach((sess, idx)=>{
                if(idx === 0 || !sess) return;
                callback(sess, idx);
              });
            };

            const cloneVersionsFromTime = sourceTime => {
              const versions = sourceTime && Array.isArray(sourceTime.versions) ? sourceTime.versions : [];
              return versions.length ? versions.map(cloneVenueSessionVersion) : [venueSessionCreateVersion()];
            };

            const cloneSessionTimesFromFirst = (venue, targetSession)=>{
              if(!venue || !targetSession) return;
              if(isSessionMirrorLocked(venue)) return;
              const sessions = Array.isArray(venue.sessions) ? venue.sessions : [];
              if(sessions.length === 0) return;
              const template = sessions[0];
              if(!template || template === targetSession) return;
              const preservedDate = typeof targetSession.date === 'string' ? targetSession.date : '';
              const preservedTimes = Array.isArray(targetSession.times)
                ? targetSession.times.map(time => (time && typeof time.time === 'string') ? time.time : '')
                : [];
              const times = Array.isArray(template.times) ? template.times : [];
              targetSession.times = times.length ? times.map(cloneVenueSessionTime) : [venueSessionCreateTime()];
              targetSession.date = preservedDate;
              const referenceTimes = times;
              const referenceFirstTime = referenceTimes[0];
              if(targetSession.times.length === 0){
                targetSession.times.push(venueSessionCreateTime());
              }
              if(targetSession !== template){
                targetSession.times.forEach((time, index)=>{
                  time.samePricingSourceIndex = 0;
                  if(index === 0){
                    if(referenceFirstTime){
                      time.samePricingAsAbove = true;
                      time.versions = cloneVersionsFromTime(referenceFirstTime);
                      time.tierAutofillLocked = true;
                    } else {
                      time.samePricingAsAbove = false;
                      time.tierAutofillLocked = false;
                    }
                  }
                  if(preservedTimes[index]){
                    time.time = preservedTimes[index];
                  }
                });
                const targetFirstTime = targetSession.times[0];
                targetSession.times.forEach((time, index)=>{
                  if(index > 0){
                    time.samePricingAsAbove = true;
                    if(targetFirstTime && targetFirstTime !== time){
                      time.versions = cloneVersionsFromTime(targetFirstTime);
                    }
                    time.tierAutofillLocked = true;
                  }
                });
              }
            };

            const flattenSessionTimes = venue => {
              if(!venue || !Array.isArray(venue.sessions)) return;
              const pendingInsertions = [];
              let requiresLock = false;
              venue.sessions.forEach((session, index)=>{
                if(!session) return;
                if(!Array.isArray(session.times) || session.times.length === 0){
                  session.times = [venueSessionCreateTime()];
                }
                const sanitizedTimes = session.times.filter(Boolean);
                if(sanitizedTimes.length <= 1){
                  session.times = sanitizedTimes.length ? [sanitizedTimes[0]] : [venueSessionCreateTime()];
                  const firstTime = session.times[0];
                  if(firstTime){
                    if(typeof firstTime.samePricingAsAbove !== 'boolean'){
                      firstTime.samePricingAsAbove = false;
                    }
                    if(!Number.isInteger(firstTime.samePricingSourceIndex) || firstTime.samePricingSourceIndex < 0){
                      firstTime.samePricingSourceIndex = 0;
                    }
                  }
                  return;
                }
                requiresLock = true;
                const primaryTime = cloneVenueSessionTime(sanitizedTimes[0]);
                primaryTime.samePricingSourceIndex = 0;
                primaryTime.tierAutofillLocked = !!primaryTime.tierAutofillLocked;
                session.times = [primaryTime];
                const clones = [];
                for(let i = 1; i < sanitizedTimes.length; i++){
                  const cloneSession = cloneVenueSessionSession(session);
                  cloneSession.times = [cloneVenueSessionTime(sanitizedTimes[i])];
                  const firstCloneTime = cloneSession.times[0];
                  if(firstCloneTime){
                    firstCloneTime.samePricingSourceIndex = 0;
                    firstCloneTime.tierAutofillLocked = !!firstCloneTime.tierAutofillLocked;
                  }
                  clones.push(cloneSession);
                }
                if(clones.length){
                  pendingInsertions.push({ index, clones });
                }
              });
              if(requiresLock){
                lockSessionMirror(venue);
              }
              if(!pendingInsertions.length) return;
              let offset = 0;
              pendingInsertions.forEach(entry => {
                const insertIndex = entry.index + 1 + offset;
                venue.sessions.splice(insertIndex, 0, ...entry.clones);
                offset += entry.clones.length;
              });
            };

            const applyAutofillToSession = (venue, session)=>{
              if(!session) return;
              cloneSessionTimesFromFirst(venue, session);
              if(isSessionMirrorLocked(venue)) return;
              const state = getVenueAutofillState(previewField, venue);
              const slots = Array.isArray(state.slots) ? state.slots : [];
              for(let i = 0; i < slots.length; i++){
                const slot = slots[i];
                if(!slot || typeof slot !== 'object' || !slot.value || slot.locked) continue;
                const target = session.times[i] || (session.times[i] = venueSessionCreateTime());
                if(!target.time){
                  target.time = slot.value;
                }
              }
            };

            const ensureSessionStructure = (venue)=>{
              if(!Array.isArray(venue.sessions)){
                venue.sessions = [venueSessionCreateSession()];
              }
              if(venue.sessions.length === 0){
                venue.sessions.push(venueSessionCreateSession());
              }
              flattenSessionTimes(venue);
              if(!isSessionMirrorLocked(venue)){
                venue.sessions.forEach((session, index)=>{
                  if(index === 0) return;
                  cloneSessionTimesFromFirst(venue, session);
                });
              }
              let maxTimes = 0;
              venue.sessions.forEach(session => {
                if(!Array.isArray(session.times)){
                  session.times = [venueSessionCreateTime()];
                }
                if(session.times.length === 0){
                  session.times.push(venueSessionCreateTime());
                }
                session.times.forEach((time, timeIndex) => {
                  if(!Array.isArray(time.versions)){
                    time.versions = [venueSessionCreateVersion()];
                  }
                  if(time.versions.length === 0){
                    time.versions.push(venueSessionCreateVersion());
                  }
                  if(typeof time.samePricingAsAbove !== 'boolean'){
                    time.samePricingAsAbove = timeIndex > 0;
                  }
                  const sourceIndex = Number(time.samePricingSourceIndex);
                  if(!Number.isInteger(sourceIndex) || sourceIndex < 0){
                    time.samePricingSourceIndex = 0;
                  }
                  if(typeof time.tierAutofillLocked !== 'boolean'){
                    time.tierAutofillLocked = false;
                  }
                  time.versions.forEach(version => {
                    if(!Array.isArray(version.tiers)){
                      version.tiers = [venueSessionCreateTier()];
                    }
                    if(version.tiers.length === 0){
                      version.tiers.push(venueSessionCreateTier());
                    }
                  });
                });
                maxTimes = Math.max(maxTimes, session.times.length);
              });
              const state = getVenueAutofillState(previewField, venue);
              if(!Array.isArray(state.slots)) state.slots = [];
              while(state.slots.length < maxTimes){
                state.slots.push({ value: '', locked: false, source: null });
              }
              while(state.slots.length > maxTimes){
                state.slots.pop();
              }
              for(let i = 0; i < maxTimes; i++){
                ensureSlot(venue, i);
              }
              venue.sessions.forEach(session => {
                while(session.times.length < maxTimes){
                  session.times.push(venueSessionCreateTime());
                }
              });
              if(!isSessionMirrorLocked(venue)){
                const template = venue.sessions[0];
                if(template && Array.isArray(template.times)){
                  template.times.forEach((time, index)=>{
                    const slot = ensureSlot(venue, index);
                    slot.value = typeof time.time === 'string' ? time.time : '';
                    slot.source = time;
                    slot.locked = false;
                  });
                }
              }
            };

            const addVenue = (afterIndex)=>{
              ensureOptions();
              const venues = previewField.options;
              const newVenue = venueSessionCreateVenue();
              let defaultCurrency = '';
              if(Array.isArray(venues) && venues.length > 0){
                const referenceIndex = Math.min(Math.max(afterIndex, 0), venues.length - 1);
                const referenceVenue = venues[referenceIndex];
                if(referenceVenue){
                  defaultCurrency = getVenueCurrencyValue(referenceVenue) || defaultCurrency;
                }
              }
              if(!defaultCurrency && LAST_SELECTED_VENUE_CURRENCY){
                defaultCurrency = LAST_SELECTED_VENUE_CURRENCY;
              }
              if(defaultCurrency){
                applyCurrencyToVenueData(newVenue, defaultCurrency);
                setVenueCurrencyState(newVenue, defaultCurrency);
              }
              venues.splice(afterIndex + 1, 0, newVenue);
              openSessions.clear();
              notifyFormbuilderChange();
              renderVenues({ type: 'venue-name', venueIndex: afterIndex + 1 });
            };

            const removeVenue = (index)=>{
              ensureOptions();
              if(localField.options.length <= 1) return;
              const removed = localField.options.splice(index, 1)[0];
              // Sync back to previewField if in formbuilder
              if(isFormbuilder){
                previewField.options = localField.options.map(venue => cloneVenueSessionVenue(venue));
              }
              const state = VENUE_TIME_AUTOFILL_STATE.get(previewField);
              if(state && removed){
                try{ state.delete(removed); }catch(err){}
              }
              openSessions.clear();
              notifyFormbuilderChange();
              const nextIndex = Math.max(0, index - 1);
              renderVenues({ type: 'venue-name', venueIndex: nextIndex });
            };

            const requestVenueRemoval = (index)=>{
              ensureOptions();
              if(localField.options.length <= 1) return;
              if(window.confirm('Are you sure you want to remove this venue?')){
                removeVenue(index);
              }
            };

            const addSession = (venue, venueIndex, afterIndex)=>{
              const sessions = venue.sessions;
              const newSession = venueSessionCreateSession();
              const maxTimes = Math.max(...sessions.map(sess => Array.isArray(sess.times) ? sess.times.length : 1), 1);
              while(newSession.times.length < maxTimes){
                newSession.times.push(venueSessionCreateTime());
              }
              const primarySession = sessions[0];
              const primaryTimes = Array.isArray(primarySession?.times) ? primarySession.times : [];
              const primaryFirstTime = primaryTimes[0];
              newSession.times.forEach((time, index)=>{
                time.samePricingSourceIndex = 0;
                if(index === 0){
                  if(primaryFirstTime){
                    time.samePricingAsAbove = true;
                    time.versions = cloneVersionsFromTime(primaryFirstTime);
                    time.tierAutofillLocked = true;
                  } else {
                    time.samePricingAsAbove = false;
                    time.tierAutofillLocked = false;
                  }
                } else {
                  time.samePricingAsAbove = true;
                  const baseTime = newSession.times[0];
                  if(primaryTimes[index]){
                    const referenceTime = primaryTimes[index];
                    time.versions = cloneVersionsFromTime(referenceTime);
                  } else if(baseTime && baseTime !== time){
                    time.versions = cloneVersionsFromTime(baseTime);
                  }
                  time.tierAutofillLocked = true;
                }
              });
              const venueCurrency = getVenueCurrencyValue(venue);
              if(venueCurrency){
                newSession.times.forEach(time => {
                  if(!time || !Array.isArray(time.versions)) return;
                  time.versions.forEach(version => {
                    if(!version || !Array.isArray(version.tiers)) return;
                    version.tiers.forEach(tier => {
                      if(tier && !tier.currency){
                        tier.currency = venueCurrency;
                      }
                    });
                  });
                });
              }
              sessions.splice(afterIndex + 1, 0, newSession);
              applyAutofillToSession(venue, newSession);
              openSessions.clear();
              notifyFormbuilderChange();
              renderVenues();
            };

            const removeSession = (venue, venueIndex, sessionIndex)=>{
              if(venue.sessions.length <= 1) return;
              venue.sessions.splice(sessionIndex, 1);
              openSessions.clear();
              notifyFormbuilderChange();
              renderVenues();
            };

            const addTimeSlot = (venue, venueIndex, sessionIndex, timeIndex)=>{
              if(!venue || !Array.isArray(venue.sessions)) return;
              const previouslyOpenSessions = new Set(openSessions);
              flattenSessionTimes(venue);
              const sessions = venue.sessions;
              if(sessionIndex < 0 || sessionIndex >= sessions.length) return;
              const baseSession = sessions[sessionIndex];
              if(!baseSession) return;
              const existingTimes = Array.isArray(baseSession.times) ? baseSession.times : [];
              const baseTime = existingTimes[timeIndex] || existingTimes[0] || venueSessionCreateTime();
              baseSession.times = [existingTimes[0] || cloneVenueSessionTime(baseTime) || venueSessionCreateTime()];
              const primaryTime = baseSession.times[0];
              if(primaryTime){
                primaryTime.samePricingAsAbove = false;
                primaryTime.samePricingSourceIndex = 0;
                primaryTime.tierAutofillLocked = !!primaryTime.tierAutofillLocked;
                primaryTime.displayOrder = 1;
              }
              const newSession = cloneVenueSessionSession(baseSession);
              newSession.date = baseSession.date;
              newSession.times = [cloneVenueSessionTime(baseTime)];
              const newTime = newSession.times[0];
              newTime.time = '';
              newTime.samePricingAsAbove = true;
              newTime.samePricingSourceIndex = 0;
              newTime.tierAutofillLocked = true;
              newTime.displayOrder = Number.isFinite(Number(timeIndex)) ? Number(timeIndex) + 2 : 2;
              lockSessionMirror(venue);
              sessions.splice(sessionIndex + 1, 0, newSession);
              const state = getVenueAutofillState(previewField, venue);
              if(Array.isArray(state.slots) && state.slots.length > 1){
                state.slots.length = 1;
              }
              const sessionExistsInOptions = sessionObj => previewField.options.some(v => Array.isArray(v?.sessions) && v.sessions.includes(sessionObj));
              openSessions.clear();
              previouslyOpenSessions.forEach(sessionObj => {
                if(sessionExistsInOptions(sessionObj)){
                  openSessions.add(sessionObj);
                }
              });
              openSessions.add(newSession);
              notifyFormbuilderChange();
              renderVenues({ type: 'session-time', venueIndex, sessionIndex: sessionIndex + 1, timeIndex: 0 });
            };

            const removeTimeSlot = (venue, venueIndex, sessionIndex, timeIndex)=>{
              if(!venue || !Array.isArray(venue.sessions) || venue.sessions.length === 0) return;
              flattenSessionTimes(venue);
              const session = venue.sessions[sessionIndex];
              if(!session) return;
              const times = Array.isArray(session.times) ? session.times : [];
              if(times.length <= 1){
                const state = getVenueAutofillState(previewField, venue);
                if(Array.isArray(state.slots) && state.slots.length > 1){
                  state.slots.length = 1;
                }
                lockSessionMirror(venue);
                removeSession(venue, venueIndex, sessionIndex);
                return;
              }
              const mirrorLocked = isSessionMirrorLocked(venue);
              const referenceSession = mirrorLocked ? venue.sessions[sessionIndex] : venue.sessions[0];
              if(!referenceSession) return;
              const totalSlots = Array.isArray(referenceSession.times) ? referenceSession.times.length : 0;
              if(totalSlots <= 1) return;
              if(mirrorLocked){
                const sess = venue.sessions[sessionIndex];
                if(sess && sess.times.length > timeIndex){
                  sess.times.splice(timeIndex, 1);
                }
                if(sess && sess.times.length === 0){
                  sess.times.push(venueSessionCreateTime());
                }
                lockSessionMirror(venue);
              } else {
                venue.sessions.forEach(sess => {
                  if(sess.times.length > timeIndex){
                    sess.times.splice(timeIndex, 1);
                  }
                  if(sess.times.length === 0){
                    sess.times.push(venueSessionCreateTime());
                  }
                });
              }
              const state = getVenueAutofillState(previewField, venue);
              if(Array.isArray(state.slots) && state.slots.length > timeIndex){
                state.slots.splice(timeIndex, 1);
              }
              notifyFormbuilderChange();
              const nextTime = Math.max(0, Math.min(timeIndex, venue.sessions[sessionIndex]?.times.length - 1));
              renderVenues({ type: 'session-time', venueIndex, sessionIndex, timeIndex: nextTime });
            };

            const copyTemplateTiersToVersion = (time, targetVersion)=>{
              if(!time || !targetVersion) return;
              if(time.tierAutofillLocked) return;
              const template = Array.isArray(time.versions) ? time.versions[0] : null;
              if(!template || template === targetVersion) return;
              if(!Array.isArray(template.tiers) || template.tiers.length === 0) return;
              targetVersion.tiers = template.tiers.map(cloneVenueSessionTier);
            };

            const addVersion = (venue, venueIndex, sessionIndex, timeIndex, afterIndex)=>{
              const time = venue.sessions[sessionIndex].times[timeIndex];
              const timeVersionsRef = time.versions;
              const newVersion = venueSessionCreateVersion();
              const venueCurrency = getVenueCurrencyValue(venue);
              if(venueCurrency && Array.isArray(newVersion.tiers)){
                newVersion.tiers.forEach(tier => {
                  if(tier && !tier.currency){
                    tier.currency = venueCurrency;
                  }
                });
              }
              copyTemplateTiersToVersion(time, newVersion);
              time.versions.splice(afterIndex + 1, 0, newVersion);
              if(sessionIndex === 0 && !isSessionMirrorLocked(venue)){
                forEachOtherSession(venue, otherSess => {
                  const otherTime = otherSess.times[timeIndex] || (otherSess.times[timeIndex] = venueSessionCreateTime());
                  if(!Array.isArray(otherTime.versions)){
                    otherTime.versions = [venueSessionCreateVersion()];
                  }
                  if(otherTime.versions === timeVersionsRef){
                    return;
                  }
                  const clone = cloneVenueSessionVersion(newVersion);
                  otherTime.versions.splice(afterIndex + 1, 0, clone);
                });
              } else if(sessionIndex > 0){
                lockSessionMirror(venue);
              }
              notifyFormbuilderChange();
              renderVenues({ type: 'version', venueIndex, sessionIndex, timeIndex, versionIndex: afterIndex + 1 });
            };

            const removeVersion = (venue, venueIndex, sessionIndex, timeIndex, versionIndex, expectedVersion = null)=>{
              const time = venue.sessions[sessionIndex].times[timeIndex];
              const versions = Array.isArray(time.versions) ? time.versions : [];
              if(versions.length <= 1) return;
              let targetVersion = expectedVersion ?? null;
              let targetIndex = targetVersion ? versions.indexOf(targetVersion) : -1;
              if(targetIndex === -1){
                targetIndex = typeof versionIndex === 'number' ? versionIndex : -1;
                if(targetIndex < 0 || targetIndex >= versions.length) return;
                targetVersion = versions[targetIndex];
              }
              if(!targetVersion) return;
              if(sessionIndex === 0 && !isSessionMirrorLocked(venue)){
                forEachOtherSession(venue, otherSess => {
                  const otherTime = otherSess.times[timeIndex];
                  if(!otherTime || !Array.isArray(otherTime.versions)) return;
                  if(otherTime.versions === versions){
                    otherTime.versions = otherTime.versions.map(cloneVenueSessionVersion);
                  }
                });
              } else if(sessionIndex > 0){
                lockSessionMirror(venue);
              }
              versions.splice(targetIndex, 1);
              notifyFormbuilderChange();
              const focusVersion = Math.max(0, Math.min(targetIndex, versions.length - 1));
              renderVenues({ type: 'version', venueIndex, sessionIndex, timeIndex, versionIndex: focusVersion });
            };

            const addTier = (venue, venueIndex, sessionIndex, timeIndex, versionIndex, afterIndex)=>{
              const time = venue.sessions[sessionIndex].times[timeIndex];
              if(versionIndex > 0){
                lockTierAutofillIfNeeded(time, versionIndex);
              }
              const version = time.versions[versionIndex];
              const versionTiersRef = version.tiers;
              const newTier = venueSessionCreateTier();
              const venueCurrency = getVenueCurrencyValue(venue);
              if(venueCurrency){
                newTier.currency = venueCurrency;
              }
              version.tiers.splice(afterIndex + 1, 0, newTier);
              if(versionIndex === 0){
                syncTiersFromTemplate(time);
              }
              if(sessionIndex === 0 && !isSessionMirrorLocked(venue)){
                forEachOtherSession(venue, otherSess => {
                  const otherTime = otherSess.times[timeIndex] || (otherSess.times[timeIndex] = venueSessionCreateTime());
                  const otherVersions = Array.isArray(otherTime.versions) ? otherTime.versions : (otherTime.versions = [venueSessionCreateVersion()]);
                  while(otherVersions.length <= versionIndex){
                    otherVersions.push(venueSessionCreateVersion());
                  }
                  const otherVersion = otherVersions[versionIndex];
                  if(!otherVersion) return;
                  if(otherVersion === version || otherVersion.tiers === versionTiersRef){
                    return;
                  }
                  const clone = cloneVenueSessionTier(newTier);
                  otherVersion.tiers.splice(afterIndex + 1, 0, clone);
                });
              } else if(sessionIndex > 0){
                lockSessionMirror(venue);
              }
              notifyFormbuilderChange();
              renderVenues({ type: 'tier', venueIndex, sessionIndex, timeIndex, versionIndex, tierIndex: afterIndex + 1 });
            };

            const removeTier = (venue, venueIndex, sessionIndex, timeIndex, versionIndex, tierIndex, expectedVersion = null, expectedTier = null)=>{
              const time = venue.sessions[sessionIndex].times[timeIndex];
              const versions = Array.isArray(time.versions) ? time.versions : [];
              if(versions.length === 0) return;
              let targetVersion = expectedVersion ?? null;
              let targetVersionIndex = targetVersion ? versions.indexOf(targetVersion) : -1;
              if(targetVersionIndex === -1){
                targetVersionIndex = typeof versionIndex === 'number' ? versionIndex : -1;
                if(targetVersionIndex < 0 || targetVersionIndex >= versions.length) return;
                targetVersion = versions[targetVersionIndex];
              }
              if(!targetVersion) return;
              if(targetVersionIndex > 0){
                lockTierAutofillIfNeeded(time, targetVersionIndex);
              }
              const version = versions[targetVersionIndex];
              const tiers = version && Array.isArray(version.tiers) ? version.tiers : [];
              if(tiers.length <= 1) return;
              let targetTier = expectedTier ?? null;
              let targetTierIndex = targetTier ? tiers.indexOf(targetTier) : -1;
              if(targetTierIndex === -1){
                targetTierIndex = typeof tierIndex === 'number' ? tierIndex : -1;
                if(targetTierIndex < 0 || targetTierIndex >= tiers.length) return;
                targetTier = tiers[targetTierIndex];
              }
              if(!targetTier) return;
              const templateRemoval = targetVersionIndex === 0;
              if(sessionIndex === 0 && !isSessionMirrorLocked(venue)){
                forEachOtherSession(venue, otherSess => {
                  const otherTime = otherSess.times[timeIndex];
                  if(!otherTime || !Array.isArray(otherTime.versions)) return;
                  if(otherTime.versions === versions){
                    otherTime.versions = otherTime.versions.map(cloneVenueSessionVersion);
                    return;
                  }
                  const otherVersion = otherTime.versions[targetVersionIndex];
                  if(!otherVersion || !Array.isArray(otherVersion.tiers)) return;
                  if(otherVersion.tiers === tiers){
                    otherVersion.tiers = otherVersion.tiers.map(cloneVenueSessionTier);
                  }
                });
              } else if(sessionIndex > 0){
                lockSessionMirror(venue);
              }
              tiers.splice(targetTierIndex, 1);
              if(templateRemoval){
                syncTiersFromTemplate(time);
              }
              notifyFormbuilderChange();
              const focusTier = Math.max(0, Math.min(targetTierIndex, tiers.length - 1));
              renderVenues({ type: 'tier', venueIndex, sessionIndex, timeIndex, versionIndex: targetVersionIndex, tierIndex: focusTier });
            };

            const focusRequest = { current: null };
            const setFocus = spec => { focusRequest.current = spec; };

            const applyFocus = ()=>{
              const spec = focusRequest.current;
              if(!spec) return;
              focusRequest.current = null;
              let selector = '';
              if(spec.type === 'venue-name'){
                selector = `.venue-name-input[data-venue-index="${spec.venueIndex}"]`;
              } else if(spec.type === 'session-date'){
                selector = `.session-date-input[data-venue-index="${spec.venueIndex}"][data-session-index="${spec.sessionIndex}"]`;
              } else if(spec.type === 'session-time'){
                selector = `.session-time-input[data-venue-index="${spec.venueIndex}"][data-session-index="${spec.sessionIndex}"][data-time-index="${spec.timeIndex}"]`;
              } else if(spec.type === 'version'){
                selector = `.seating_area-input[data-venue-index="${spec.venueIndex}"][data-session-index="${spec.sessionIndex}"][data-time-index="${spec.timeIndex}"][data-version-index="${spec.versionIndex}"]`;
              } else if(spec.type === 'tier'){
                selector = `.pricing_tier-input[data-venue-index="${spec.venueIndex}"][data-session-index="${spec.sessionIndex}"][data-time-index="${spec.timeIndex}"][data-version-index="${spec.versionIndex}"][data-tier-index="${spec.tierIndex}"]`;
              } else if(spec.type === 'price'){
                selector = `.session-price-input[data-venue-index="${spec.venueIndex}"][data-session-index="${spec.sessionIndex}"][data-time-index="${spec.timeIndex}"][data-version-index="${spec.versionIndex}"][data-tier-index="${spec.tierIndex}"]`;
              }
              if(!selector) return;
              const target = editor.querySelector(selector);
              if(!target) return;
              requestAnimationFrame(()=>{
                try{
                  target.focus();
                  if(typeof target.select === 'function'){
                    target.select();
                  }
                }catch(err){}
              });
            };

            const createActionButton = (symbol, ariaLabel, onClick)=>{
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'tiny';
              btn.textContent = symbol;
              btn.setAttribute('aria-label', ariaLabel);
              btn.addEventListener('click', event => {
                event.preventDefault();
                onClick();
              });
              return btn;
            };

            const lockTierAutofillIfNeeded = (time, versionIndex)=>{
              if(!time || time.tierAutofillLocked) return false;
              if(typeof versionIndex !== 'number' || versionIndex <= 0) return false;
              const versionCount = Array.isArray(time.versions) ? time.versions.length : 0;
              if(versionCount <= 1) return false;
              time.tierAutofillLocked = true;
              return true;
            };

            const syncTiersFromTemplate = time => {
              if(!time || time.tierAutofillLocked) return false;
              const versions = Array.isArray(time.versions) ? time.versions : [];
              if(versions.length <= 1) return false;
              const template = versions[0];
              if(!template || !Array.isArray(template.tiers)) return false;
              const templateTiers = template.tiers;
              let changed = false;
              for(let index = 1; index < versions.length; index++){
                const version = versions[index];
                if(!version) continue;
                let tiers = Array.isArray(version.tiers) ? version.tiers : (version.tiers = []);
                if(tiers.length > templateTiers.length){
                  tiers.length = templateTiers.length;
                  changed = true;
                }
                for(let tierIndex = 0; tierIndex < templateTiers.length; tierIndex++){
                  const templateTier = templateTiers[tierIndex];
                  let targetTier = tiers[tierIndex];
                  if(!targetTier){
                    targetTier = venueSessionCreateTier();
                    tiers[tierIndex] = targetTier;
                    changed = true;
                  }
                  const templateName = typeof templateTier?.name === 'string' ? templateTier.name : '';
                  if(targetTier.name !== templateName){
                    targetTier.name = templateName;
                    changed = true;
                  }
                }
              }
              return changed;
            };

            const commitTimeValue = ({ venue, venueIndex, sessionIndex, timeIndex, timeObj, input })=>{
              const session = Array.isArray(venue.sessions) ? venue.sessions[sessionIndex] : null;
              const isMaster = sessionIndex === 0;
              if(!isMaster){
                lockSessionMirror(venue);
              }
              const mirrorLocked = isSessionMirrorLocked(venue);

              const clearTimeValue = ()=>{
                const previous = typeof timeObj.time === 'string' ? timeObj.time : '';
                if(input.value !== ''){
                  input.value = '';
                }
                if(previous){
                  timeObj.time = '';
                  notifyFormbuilderChange();
                }
                const slot = ensureSlot(venue, timeIndex);
                if(isMaster && !mirrorLocked){
                  slot.value = '';
                  slot.source = timeObj;
                  slot.locked = false;
                  forEachOtherSession(venue, (sess, idx)=>{
                    const targetTime = sess.times[timeIndex] || (sess.times[timeIndex] = venueSessionCreateTime());
                    if(targetTime.time){
                      targetTime.time = '';
                    }
                    const selector = `.session-time-input[data-venue-index="${venueIndex}"][data-session-index="${idx}"][data-time-index="${timeIndex}"]`;
                    const sibling = editor.querySelector(selector);
                    if(sibling){
                      sibling.value = '';
                      sibling.classList.remove('is-invalid');
                    }
                    updateSessionDateInputDisplay(venueIndex, idx);
                  });
                } else {
                  if(slot.source === timeObj){
                    slot.source = null;
                  }
                  slot.value = '';
                  slot.locked = true;
                }
                resetSlotIfEmpty(venue, timeIndex);
                input.classList.remove('is-invalid');
                updateSessionDateInputDisplay(venueIndex, sessionIndex);
                return previous;
              };

              const raw = input.value.trim();
              if(raw === ''){
                clearTimeValue();
                return;
              }
              if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(raw)){
                input.classList.add('is-invalid');
                input.value = timeObj.time || '';
                return;
              }
              input.classList.remove('is-invalid');
              if(timeObj.time === raw){
                return;
              }

              let hasDuplicateTime = false;
              const currentDate = typeof session?.date === 'string' ? session.date : '';
              const sessionsToCheck = Array.isArray(venue.sessions) ? venue.sessions : [];
              for(let idx = 0; idx < sessionsToCheck.length && !hasDuplicateTime; idx++){
                const compareSession = sessionsToCheck[idx];
                if(!compareSession) continue;
                if(currentDate){
                  if(typeof compareSession.date !== 'string' || compareSession.date !== currentDate) continue;
                } else if(compareSession !== session){
                  continue;
                }
                const compareTimes = Array.isArray(compareSession.times) ? compareSession.times : [];
                for(let tIdx = 0; tIdx < compareTimes.length; tIdx++){
                  const compareTime = compareTimes[tIdx];
                  if(!compareTime || compareTime === timeObj) continue;
                  if(typeof compareTime.time !== 'string') continue;
                  if(compareTime.time === raw){
                    hasDuplicateTime = true;
                    break;
                  }
                }
              }
              if(hasDuplicateTime){
                clearTimeValue();
                showSessionTimeAlert(input);
                return;
              }

              const slot = ensureSlot(venue, timeIndex);
              timeObj.time = raw;
              updateSessionDateInputDisplay(venueIndex, sessionIndex);
              if(isMaster && !mirrorLocked){
                slot.value = raw;
                slot.source = timeObj;
                slot.locked = false;
                forEachOtherSession(venue, (sess, idx)=>{
                  const targetTime = sess.times[timeIndex] || (sess.times[timeIndex] = venueSessionCreateTime());
                  targetTime.time = raw;
                  const selector = `.session-time-input[data-venue-index="${venueIndex}"][data-session-index="${idx}"][data-time-index="${timeIndex}"]`;
                  const sibling = editor.querySelector(selector);
                  if(sibling){
                    sibling.value = raw;
                    sibling.classList.remove('is-invalid');
                  }
                  updateSessionDateInputDisplay(venueIndex, idx);
                });
              } else {
                slot.value = raw;
                slot.source = timeObj;
                slot.locked = true;
              }
              notifyFormbuilderChange();
            };

            const setupDatePicker = (input, venue, session, venueIndex, sessionIndex, options = {})=>{
              const trigger = options && options.trigger ? options.trigger : input;
              let picker = null;
              let todayMonthNode = null;
              let todayMarker = null;
              let markerScrollTarget = null;
              let markerScrollListener = null;
              let markerScrollOptions = null;

              const cleanupMarker = ()=>{
                if(todayMarker){
                  todayMarker.remove();
                  todayMarker = null;
                }
                if(markerScrollTarget && markerScrollListener){
                  removeScrollListener(markerScrollTarget, markerScrollListener, markerScrollOptions);
                }
                markerScrollTarget = null;
                markerScrollListener = null;
                markerScrollOptions = null;
                todayMonthNode = null;
              };

              const scrollToMonth = (scrollEl, monthEl, behavior = 'auto')=>{
                if(!scrollEl || !monthEl) return 0;
                const left = monthEl.offsetLeft;
                scrollEl.scrollTo({ left, behavior });
                return left;
              };

              const scrollToTodayMonth = (behavior = 'auto')=>{
                if(!picker || !todayMonthNode) return;
                const scrollEl = picker.querySelector('.calendar-scroll');
                if(!scrollEl) return;
                const left = scrollToMonth(scrollEl, todayMonthNode, behavior);
                if(todayMarker){
                  const base = parseFloat(todayMarker.dataset.pos || '0');
                  todayMarker.style.left = `${base + left}px`;
                }
              };

              const selectedDates = new Set(
                Array.isArray(venue.sessions)
                  ? venue.sessions
                      .map(sess => (sess && typeof sess.date === 'string') ? sess.date : '')
                      .filter(Boolean)
                  : []
              );
              if(session && typeof session.date === 'string' && session.date){
                selectedDates.add(session.date);
              }
              const isoCells = new Map();
              const pickerHostRow = input.closest('.session-date-row');
              const parentSubMenu = input.closest('.subcategory-form-menu');
              const parentCategoryMenu = input.closest('.category-form-menu');
              let activePickerHost = null;
              const closePicker = ()=>{
                if(activePickerHost){
                  activePickerHost.classList.remove('has-open-session-picker');
                  activePickerHost = null;
                }
                if(parentSubMenu){
                  parentSubMenu.classList.remove('has-floating-overlay');
                }
                if(parentCategoryMenu){
                  parentCategoryMenu.classList.remove('has-floating-overlay');
                }
                if(!picker) return;
                cleanupMarker();
                picker.remove();
                picker = null;
                document.removeEventListener('pointerdown', onPointerDown, true);
                document.removeEventListener('keydown', onKeydown, true);
                openPickers.delete(closePicker);
              };
              const isTriggerElement = element => {
                if(!trigger || !(trigger instanceof Element)) return false;
                return trigger === element || trigger.contains(element);
              };
              const onPointerDown = event => {
                if(!picker) return;
                const target = event.target;
                if(target === input || (input && typeof input.contains === 'function' && input.contains(target))) return;
                if(isTriggerElement(target)) return;
                if(picker.contains(target)) return;
                closePicker();
              };
              const onKeydown = event => {
                if(event.key === 'Escape'){
                  event.preventDefault();
                  closePicker();
                  const focusTarget = trigger || input;
                  if(focusTarget && typeof focusTarget.focus === 'function'){
                    try{ focusTarget.focus(); }catch(err){}
                  }
                }
              };
              const updateCellSelection = iso => {
                const cell = isoCells.get(iso);
                if(!cell) return;
                if(selectedDates.has(iso)){
                  cell.classList.add('selected');
                } else {
                  cell.classList.remove('selected');
                }
              };
              const toggleDate = iso => {
                if(!iso) return;
                if(selectedDates.has(iso)){
                  selectedDates.delete(iso);
                } else {
                  selectedDates.add(iso);
                }
                updateCellSelection(iso);
              };
              const applySelection = ()=>{
                if(selectedDates.size === 0){
                  closePicker();
                  return;
                }
                const sorted = Array.from(selectedDates).sort();
                const existingSessions = Array.isArray(venue.sessions) ? [...venue.sessions] : [];
                const maxTimes = Math.max(
                  ...existingSessions.map(sess => Array.isArray(sess?.times) ? sess.times.length : 1),
                  1
                );
                const sessionsByIso = new Map();
                existingSessions.forEach(sess => {
                  if(sess && typeof sess.date === 'string' && sess.date){
                    if(!sessionsByIso.has(sess.date)){
                      sessionsByIso.set(sess.date, []);
                    }
                    sessionsByIso.get(sess.date).push(sess);
                  }
                });
                const usedSessions = new Set();
                const takeUnused = ()=>{
                  for(const candidate of existingSessions){
                    if(!candidate || usedSessions.has(candidate)) continue;
                    if(typeof candidate.date === 'string' && candidate.date && sorted.includes(candidate.date)){
                      continue;
                    }
                    usedSessions.add(candidate);
                    return candidate;
                  }
                  return null;
                };
                const newSessions = [];
                sorted.forEach(iso => {
                  let active = null;
                  const pool = sessionsByIso.get(iso);
                  if(pool && pool.length){
                    active = pool.shift();
                  }
                  if(active && usedSessions.has(active)){
                    active = null;
                  }
                  if(active){
                    usedSessions.add(active);
                  } else {
                    active = takeUnused();
                  }
                  if(!active){
                    active = venueSessionCreateSession();
                    while(active.times.length < maxTimes){
                      active.times.push(venueSessionCreateTime());
                    }
                    applyAutofillToSession(venue, active);
                  }
                  active.date = iso;
                  newSessions.push(active);
                });
                if(newSessions.length === 0){
                  closePicker();
                  return;
                }
                venue.sessions.splice(0, venue.sessions.length, ...newSessions);
                openSessions.clear();
                notifyFormbuilderChange();
                closePicker();
                renderVenues();
              };
              const buildCalendar = ()=>{
                isoCells.clear();
                cleanupMarker();
                const container = document.createElement('div');
                container.className = 'session-date-picker';
                const instructions = document.createElement('p');
                instructions.className = 'session-date-picker-instructions';
                instructions.textContent = 'Select all the dates for this venue.';
                container.appendChild(instructions);
                const scroll = document.createElement('div');
                scroll.className = 'calendar-scroll';
                setupHorizontalWheel(scroll);
                const calendar = document.createElement('div');
                calendar.className = 'calendar';
                const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                const todayIso = toISODate(today);
                let current = new Date(minPickerDate.getFullYear(), minPickerDate.getMonth(), 1);
                const end = new Date(maxPickerDate.getFullYear(), maxPickerDate.getMonth(), 1);
                while(current <= end){
                  const monthDate = new Date(current.getFullYear(), current.getMonth(), 1);
                  const monthEl = document.createElement('div');
                  monthEl.className = 'month';
                  const header = document.createElement('div');
                  header.className = 'calendar-header';
                  header.textContent = monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
                  monthEl.appendChild(header);
                  const grid = document.createElement('div');
                  grid.className = 'grid';
                  weekdays.forEach(day => {
                    const wd = document.createElement('div');
                    wd.className = 'weekday';
                    wd.textContent = day;
                    grid.appendChild(wd);
                  });
                  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
                  const startDow = firstDay.getDay();
                  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
                  const totalCells = 42;
                  for(let i = 0; i < totalCells; i++){
                    const cell = document.createElement('div');
                    cell.className = 'day';
                    const dayNum = i - startDow + 1;
                    if(i < startDow || dayNum > daysInMonth){
                      cell.classList.add('empty');
                    } else {
                      cell.textContent = dayNum;
                      const dateObj = new Date(monthDate.getFullYear(), monthDate.getMonth(), dayNum);
                      dateObj.setHours(0,0,0,0);
                      const iso = toISODate(dateObj);
                      cell.dataset.iso = iso;
                      isoCells.set(iso, cell);
                      if(dateObj < today){
                        cell.classList.add('past');
                      } else {
                        cell.classList.add('future');
                      }
                      if(iso === todayIso){
                        cell.classList.add('today');
                        if(!todayMonthNode){
                          todayMonthNode = monthEl;
                        }
                      }
                      if(selectedDates.has(iso)){
                        cell.classList.add('selected');
                      }
                      cell.addEventListener('click', ()=>{
                        toggleDate(iso);
                      });
                    }
                    grid.appendChild(cell);
                  }
                  monthEl.appendChild(grid);
                  calendar.appendChild(monthEl);
                  current.setMonth(current.getMonth() + 1);
                }
                scroll.appendChild(calendar);
                container.appendChild(scroll);
                const actions = document.createElement('div');
                actions.className = 'calendar-actions';
                const cancelBtn = document.createElement('button');
                cancelBtn.type = 'button';
                cancelBtn.className = 'calendar-action cancel';
                cancelBtn.textContent = 'Cancel';
                cancelBtn.addEventListener('click', ()=> closePicker());
                actions.appendChild(cancelBtn);
                const okBtn = document.createElement('button');
                okBtn.type = 'button';
                okBtn.className = 'calendar-action ok primary';
                okBtn.textContent = 'OK';
                okBtn.addEventListener('click', ()=> applySelection());
                actions.appendChild(okBtn);
                container.appendChild(actions);
                container.addEventListener('keydown', event => {
                  if(event.key !== 'Enter' || event.repeat){
                    return;
                  }
                  const target = event.target;
                  if(target instanceof HTMLButtonElement){
                    return;
                  }
                  event.preventDefault();
                  applySelection();
                });
                queueMicrotask(() => okBtn.focus());
                return container;
              };
              const initializePicker = pickerEl => {
                if(!pickerEl) return;
                const scrollEl = pickerEl.querySelector('.calendar-scroll');
                if(!scrollEl) return;
                scrollEl.setAttribute('tabindex', '0');
                const calendarEl = scrollEl.querySelector('.calendar');
                if(!calendarEl){
                  return;
                }
                const targetMonth = todayMonthNode || calendarEl.querySelector('.month');
                if(targetMonth){
                  scrollEl.scrollLeft = targetMonth.offsetLeft;
                }
                if(todayMonthNode){
                  const maxScroll = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
                  const track = scrollEl.clientWidth - 20;
                  const scrollPos = todayMonthNode.offsetLeft;
                  todayMarker = document.createElement('div');
                  todayMarker.className = 'today-marker';
                  const basePos = maxScroll > 0 ? (scrollPos / maxScroll) * track + 10 : 10;
                  todayMarker.dataset.pos = String(basePos);
                  todayMarker.style.left = `${basePos + scrollEl.scrollLeft}px`;
                  todayMarker.addEventListener('click', ()=> scrollToTodayMonth('smooth'));
                  scrollEl.appendChild(todayMarker);
                  const onScroll = ()=>{
                    if(!todayMarker) return;
                    const base = parseFloat(todayMarker.dataset.pos || '0');
                    todayMarker.style.left = `${base + scrollEl.scrollLeft}px`;
                  };
                  markerScrollListener = onScroll;
                  markerScrollTarget = scrollEl;
                  markerScrollOptions = addPassiveScrollListener(scrollEl, onScroll);
                  onScroll();
                }
                scrollToTodayMonth('auto');
              };
              const openPicker = ()=>{
                if(picker) return;
                closeAllPickers();
                picker = buildCalendar();
                const appendTarget = pickerHostRow || input.parentElement;
                if(pickerHostRow instanceof Element){
                  activePickerHost = pickerHostRow;
                } else if(appendTarget instanceof Element){
                  activePickerHost = appendTarget;
                } else {
                  activePickerHost = null;
                }
                if(activePickerHost){
                  activePickerHost.classList.add('has-open-session-picker');
                }
                if(appendTarget instanceof Element){
                  appendTarget.appendChild(picker);
                } else if(input.parentElement instanceof Element){
                  input.parentElement.appendChild(picker);
                }
                if(parentSubMenu){
                  parentSubMenu.classList.add('has-floating-overlay');
                }
                if(parentCategoryMenu){
                  parentCategoryMenu.classList.add('has-floating-overlay');
                }
                if(picker){
                  initializePicker(picker);
                  const pickerEl = picker;
                  const showPicker = ()=> pickerEl && pickerEl.classList.add('is-visible');
                  if(typeof requestAnimationFrame === 'function'){
                    requestAnimationFrame(showPicker);
                  } else {
                    showPicker();
                  }
                }
                document.addEventListener('pointerdown', onPointerDown, true);
                document.addEventListener('keydown', onKeydown, true);
                openPickers.add(closePicker);
              };
              if(trigger === input){
                input.addEventListener('focus', ()=> openPicker());
                input.addEventListener('click', ()=> openPicker());
              } else if(trigger){
                const handleTriggerClick = event => {
                  event.preventDefault();
                  event.stopPropagation();
                  openPicker();
                };
                const handleTriggerKeydown = event => {
                  if(event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar'){
                    event.preventDefault();
                    openPicker();
                  }
                };
                trigger.addEventListener('click', handleTriggerClick);
                trigger.addEventListener('keydown', handleTriggerKeydown);
              }
              return { open: openPicker, close: closePicker };
            };

            const renderVenues = (nextFocus = null)=>{
              closeAllPickers();
              ensureOptions();
              let shouldNotifyAfterRender = false;
              const markAutoChange = ()=>{ shouldNotifyAfterRender = true; };
              if(nextFocus) setFocus(nextFocus);
              venueList.innerHTML = '';
              const datalistSeed = Date.now();
              localField.options.forEach((venue, venueIndex)=>{
                ensureSessionStructure(venue);
                const venueCard = document.createElement('div');
                venueCard.className = 'venue-card';
                venueList.appendChild(venueCard);

                const venueLine = document.createElement('div');
                venueLine.className = 'venue-line';
                let geocoderInputRef = null;
                let nameResultsByKey = Object.create(null);
                let nameSearchTimeout = null;
                let nameSearchAbort = null;
                const NAME_AUTOCOMPLETE_DELAY = 220;
                const nameDatalistId = `venue-name-options-${datalistSeed}-${venueIndex}`;
                const venueNameDatalist = document.createElement('datalist');
                venueNameDatalist.id = nameDatalistId;
                venueCard.appendChild(venueNameDatalist);

                const clearNameSuggestions = ()=>{
                  nameResultsByKey = Object.create(null);
                  venueNameDatalist.innerHTML = '';
                };

                const getFeatureKey = (feature)=>{
                  if(!feature || typeof feature !== 'object') return '';
                  return feature.id
                    || (feature.properties && feature.properties.mapbox_id)
                    || feature.place_name
                    || feature.text
                    || '';
                };

                const updateNameSuggestions = (features)=>{
                  clearNameSuggestions();
                  if(!Array.isArray(features) || !features.length) return;
                  const seenKeys = new Set();
                  for(const feature of features){
                    if(!feature) continue;
                    const key = getFeatureKey(feature);
                    if(!key || seenKeys.has(key)) continue;
                    seenKeys.add(key);
                    const featureClone = cloneGeocoderFeature(feature);
                    nameResultsByKey[key] = featureClone;
                    const option = document.createElement('option');
                    const optionLabel = featureClone.place_name || featureClone.text || '';
                    option.value = featureClone.text || optionLabel;
                    if(optionLabel && optionLabel !== option.value){
                      option.label = optionLabel;
                      option.textContent = optionLabel;
                    } else if(optionLabel){
                      option.textContent = optionLabel;
                    }
                    option.dataset.featureKey = key;
                    venueNameDatalist.appendChild(option);
                  }
                };

                const applyFeatureToVenue = (feature, { updateName=false }={})=>{
                  if(!feature || typeof feature !== 'object') return;
                  const clone = cloneGeocoderFeature(feature);
                  const center = getMapboxVenueFeatureCenter(clone);
                  const placeName = typeof clone.place_name === 'string' ? clone.place_name : '';
                  const featureName = (typeof clone.text === 'string' && clone.text.trim())
                    ? clone.text.trim()
                    : (typeof clone.properties?.name === 'string' ? clone.properties.name.trim() : '');
                  if(updateName && featureName){
                    venue.name = featureName;
                    venueNameInput.value = featureName;
                    syncToPreviewField();
                  }
                  if(placeName){
                    venue.address = placeName;
                    if(geocoderInputRef){
                      geocoderInputRef.value = placeName;
                    }
                    syncToPreviewField();
                  }
                  if(center){
                    venue.location = {
                      lng: Number(center[0]),
                      lat: Number(center[1])
                    };
                  }
                  notifyFormbuilderChange();
                };

                const venueNamePlaceholder = `Venue Name ${venueIndex + 1}`;
                const venueNameInput = document.createElement('input');
                venueNameInput.type = 'text';
                venueNameInput.className = 'venue-name-input';
                venueNameInput.placeholder = venueNamePlaceholder;
                venueNameInput.setAttribute('aria-label', venueNamePlaceholder);
                venueNameInput.value = venue.name || '';
                venueNameInput.dataset.venueIndex = String(venueIndex);
                venueNameInput.setAttribute('list', nameDatalistId);
                venueNameInput.addEventListener('input', ()=>{
                  const value = venueNameInput.value || '';
                  venue.name = value;
                  syncToPreviewField();
                  notifyFormbuilderChange();
                  if(nameSearchTimeout){
                    clearTimeout(nameSearchTimeout);
                    nameSearchTimeout = null;
                  }
                  if(nameSearchAbort && typeof nameSearchAbort.abort === 'function'){
                    nameSearchAbort.abort();
                    nameSearchAbort = null;
                  }
                  const trimmed = value.trim();
                  if(trimmed.length < MAPBOX_VENUE_MIN_QUERY){
                    clearNameSuggestions();
                    return;
                  }
                  nameSearchTimeout = setTimeout(async ()=>{
                    nameSearchTimeout = null;
                    const controller = (typeof AbortController === 'function') ? new AbortController() : null;
                    if(controller) nameSearchAbort = controller;
                    const signal = controller ? controller.signal : undefined;
                    try{
                      const normalizedQuery = venueNameInput.value.trim();
                      if(normalizedQuery.length < MAPBOX_VENUE_MIN_QUERY){
                        clearNameSuggestions();
                        if(controller) controller.abort();
                        return;
                      }
                      const localResults = searchLocalVenues(normalizedQuery) || [];
                      const remoteResults = await searchMapboxVenues(normalizedQuery, { limit: 6, signal });
                      if(signal && signal.aborted) return;
                      if((venueNameInput.value || '').trim() !== normalizedQuery){
                        return;
                      }
                      updateNameSuggestions([...localResults, ...remoteResults]);
                    } catch(err){
                      if(signal && signal.aborted) return;
                      console.warn('Venue name lookup failed', err);
                      clearNameSuggestions();
                    } finally {
                      if(nameSearchAbort === controller){
                        nameSearchAbort = null;
                      }
                    }
                  }, NAME_AUTOCOMPLETE_DELAY);
                });

                const commitNameSelection = ()=>{
                  const value = (venueNameInput.value || '').trim();
                  if(!value){
                    return;
                  }
                  let selectedFeature = null;
                  const options = venueNameDatalist.querySelectorAll('option');
                  for(const option of options){
                    if(option.value === value && option.dataset && option.dataset.featureKey){
                      const stored = nameResultsByKey[option.dataset.featureKey];
                      if(stored){
                        selectedFeature = stored;
                        break;
                      }
                    }
                  }
                  if(!selectedFeature){
                    const lower = value.toLowerCase();
                    for(const key of Object.keys(nameResultsByKey)){
                      const candidate = nameResultsByKey[key];
                      const candidateName = (candidate.text || candidate.place_name || '').toLowerCase();
                      if(candidateName === lower){
                        selectedFeature = candidate;
                        break;
                      }
                    }
                  }
                  if(selectedFeature){
                    applyFeatureToVenue(selectedFeature, { updateName:true });
                    updateNameSuggestions([selectedFeature]);
                  }
                };

                venueNameInput.addEventListener('change', commitNameSelection);
                venueNameInput.addEventListener('blur', commitNameSelection);
                venueNameInput.addEventListener('keydown', (event)=>{
                  if(event.key === 'Enter'){
                    commitNameSelection();
                  }
                });
                venueLine.appendChild(venueNameInput);
                const venueActions = document.createElement('div');
                venueActions.className = 'venue-line-actions';
                venueActions.appendChild(createActionButton('+', 'Add Venue', ()=> addVenue(venueIndex)));
                const removeVenueBtn = createActionButton('-', 'Remove Venue', ()=> requestVenueRemoval(venueIndex));
                removeVenueBtn.classList.add('danger');
                if(localField.options.length <= 1){
                  removeVenueBtn.disabled = true;
                  removeVenueBtn.setAttribute('aria-disabled', 'true');
                } else {
                  removeVenueBtn.disabled = false;
                  removeVenueBtn.removeAttribute('aria-disabled');
                }
                venueActions.appendChild(removeVenueBtn);
                venueLine.appendChild(venueActions);
                venueCard.appendChild(venueLine);

                const addressLine = document.createElement('div');
                addressLine.className = 'venue-line address_line-line';
                const geocoderContainer = document.createElement('div');
                geocoderContainer.className = 'address_line-geocoder-container';
                addressLine.appendChild(geocoderContainer);
                venueCard.appendChild(addressLine);
                const addressPlaceholder = `Venue Address ${venueIndex + 1}`;
                const createFallbackAddressInput = ()=>{
                  geocoderContainer.innerHTML = '';
                  geocoderContainer.classList.remove('is-geocoder-active');
                  const fallback = document.createElement('input');
                  fallback.type = 'text';
                  fallback.className = 'address_line-fallback';
                  fallback.placeholder = addressPlaceholder;
                  fallback.setAttribute('aria-label', addressPlaceholder);
                  fallback.value = venue.address || '';
                  fallback.dataset.venueIndex = String(venueIndex);
                  fallback.addEventListener('input', ()=>{
                    venue.address = fallback.value;
                    notifyFormbuilderChange();
                  });
                  geocoderContainer.appendChild(fallback);
                  geocoderInputRef = fallback;
                  return fallback;
                };
                const mapboxReady = window.mapboxgl && window.MapboxGeocoder && window.mapboxgl.accessToken;
                if(mapboxReady){
                  const geocoderOptions = {
                    accessToken: window.mapboxgl.accessToken,
                    mapboxgl: window.mapboxgl,
                    marker: false,
                    placeholder: addressPlaceholder,
                    geocodingUrl: MAPBOX_VENUE_ENDPOINT,
                    // NOTE: types: 'poi,place,address' retained for reference while testing broader results.
                    types: 'address,poi',
                    reverseGeocode: true,
                    localGeocoder: localVenueGeocoder,
                    externalGeocoder: externalMapboxVenueGeocoder,
                    filter: majorVenueFilter,
                    limit: 7,
                    language: (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : undefined
                  };
                  const geocoder = new MapboxGeocoder(geocoderOptions);
                  const schedule = (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function')
                    ? window.requestAnimationFrame.bind(window)
                    : (cb)=> setTimeout(cb, 16);
                  let attempts = 0;
                  const maxAttempts = 20;
                  const attachGeocoder = ()=>{
                    if(!geocoderContainer.isConnected){
                      attempts += 1;
                      if(attempts > maxAttempts){
                        createFallbackAddressInput();
                        return;
                      }
                      schedule(attachGeocoder);
                      return;
                    }
                    try {
                      geocoder.addTo(geocoderContainer);
                    } catch(err){
                      createFallbackAddressInput();
                      return;
                    }
                    const setGeocoderActive = (isActive)=>{
                      const active = !!isActive;
                      geocoderContainer.classList.toggle('is-geocoder-active', active);
                      const subMenu = geocoderContainer.closest('.subcategory-form-menu');
                      if(subMenu){
                        subMenu.classList.toggle('has-floating-overlay', active);
                      }
                      const categoryMenu = subMenu
                        ? subMenu.closest('.category-form-menu')
                        : geocoderContainer.closest('.category-form-menu');
                      if(categoryMenu){
                        categoryMenu.classList.toggle('has-floating-overlay', active);
                      }
                    };
                    setGeocoderActive(false);
                    const geocoderRoot = geocoderContainer.querySelector('.mapboxgl-ctrl-geocoder');
                    if(geocoderRoot && !geocoderRoot.__formPreviewGeocoderBound){
                      geocoderRoot.__formPreviewGeocoderBound = true;
                      // For member forms, set high z-index to ensure geocoder is visible above other elements
                      if(isMemberForm){
                        geocoderRoot.style.zIndex = '1000001';
                        geocoderRoot.style.position = 'relative';
                        const suggestions = geocoderRoot.querySelector('.suggestions');
                        if(suggestions){
                          suggestions.style.zIndex = '1000002';
                        }
                        // Also ensure container has proper positioning
                        geocoderContainer.style.position = 'relative';
                        geocoderContainer.style.zIndex = '1000000';
                      }
                      const handleFocusIn = ()=> setGeocoderActive(true);
                      const handleFocusOut = event => {
                        const nextTarget = event && event.relatedTarget;
                        if(!nextTarget || !geocoderRoot.contains(nextTarget)){
                          setGeocoderActive(false);
                        }
                      };
                      const handlePointerDown = (e) => {
                        setGeocoderActive(true);
                        // For member forms, prevent form closure
                        if(isMemberForm && e){
                          e.stopPropagation();
                          e.stopImmediatePropagation();
                        }
                      };
                      geocoderRoot.addEventListener('focusin', handleFocusIn);
                      geocoderRoot.addEventListener('focusout', handleFocusOut);
                      geocoderRoot.addEventListener('pointerdown', handlePointerDown);
                      // For member forms, prevent form closure when clicking geocoder suggestions
                      if(isMemberForm){
                        geocoderRoot.addEventListener('click', (e) => {
                          e.stopPropagation();
                          e.stopImmediatePropagation();
                        }, true);
                        const suggestionsWrapper = geocoderRoot.querySelector('.suggestions-wrapper');
                        if(suggestionsWrapper){
                          suggestionsWrapper.addEventListener('click', (e) => {
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                          }, true);
                          suggestionsWrapper.addEventListener('pointerdown', (e) => {
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                          }, true);
                          // Also handle individual suggestion items to prevent form closure
                          const handleSuggestionEvents = (e) => {
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                          };
                          // Use MutationObserver to catch dynamically added suggestions
                          const suggestionObserver = new MutationObserver(() => {
                            const suggestionItems = suggestionsWrapper.querySelectorAll('.suggestions > li, .suggestions > div, li[role="option"]');
                            suggestionItems.forEach(item => {
                              if(!item.__venueGeocoderBound){
                                item.__venueGeocoderBound = true;
                                item.addEventListener('click', handleSuggestionEvents, true);
                                item.addEventListener('pointerdown', handleSuggestionEvents, true);
                                item.addEventListener('mousedown', handleSuggestionEvents, true);
                              }
                            });
                          });
                          suggestionObserver.observe(suggestionsWrapper, { childList: true, subtree: true });
                          // Also handle existing items
                          const existingItems = suggestionsWrapper.querySelectorAll('.suggestions > li, .suggestions > div, li[role="option"]');
                          existingItems.forEach(item => {
                            item.__venueGeocoderBound = true;
                            item.addEventListener('click', handleSuggestionEvents, true);
                            item.addEventListener('pointerdown', handleSuggestionEvents, true);
                            item.addEventListener('mousedown', handleSuggestionEvents, true);
                          });
                        }
                      }
                    }
                    const geocoderInput = geocoderContainer.querySelector('input[type="text"]');
                    if(!geocoderInput){
                      createFallbackAddressInput();
                      return;
                    }
                    geocoderInput.placeholder = addressPlaceholder;
                    geocoderInput.setAttribute('aria-label', addressPlaceholder);
                    geocoderInput.dataset.venueIndex = String(venueIndex);
                    geocoderInput.value = venue.address || '';
                    geocoderInputRef = geocoderInput;
                    geocoderInput.addEventListener('blur', ()=>{
                      const nextValue = geocoderInput.value || '';
                      if(venue.address !== nextValue){
                        venue.address = nextValue;
                        syncToPreviewField();
                        notifyFormbuilderChange();
                      }
                    });
                    // For member forms, prevent form closure when interacting with geocoder input
                    if(isMemberForm){
                      geocoderInput.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                      }, true);
                      geocoderInput.addEventListener('pointerdown', (e) => {
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                      }, true);
                      geocoderInput.addEventListener('input', (e) => {
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                      }, true);
                    }
                    geocoder.on('results', ()=> setGeocoderActive(true));
                    geocoder.on('result', event => {
                      // For member forms, stop propagation to prevent form closure
                      if(isMemberForm && event && event.originalEvent){
                        event.originalEvent.stopPropagation();
                        event.originalEvent.stopImmediatePropagation();
                      }
                      const result = event && event.result;
                      if(result){
                        const shouldUpdateName = !(venue.name && venue.name.trim());
                        applyFeatureToVenue(result, { updateName: shouldUpdateName });
                        updateNameSuggestions([result]);
                      }
                      setGeocoderActive(false);
                    });
                    geocoder.on('clear', ()=>{
                      venue.address = '';
                      venue.location = null;
                      clearNameSuggestions();
                      notifyFormbuilderChange();
                      setGeocoderActive(false);
                    });
                    geocoder.on('error', ()=> setGeocoderActive(false));
                  };
                  attachGeocoder();
                } else {
                  createFallbackAddressInput();
                }

                const sessionContainer = document.createElement('div');
                sessionContainer.className = 'session-list';
                venue.sessions.forEach((session, sessionIndex)=>{
                  const sessionCard = document.createElement('div');
                  sessionCard.className = 'session-card';

                  const dateRow = document.createElement('div');
                  dateRow.className = 'session-date-row';
                  const datePlaceholder = `Session Date ${sessionIndex + 1}`;
                  const dateInput = document.createElement('input');
                  dateInput.type = 'text';
                  dateInput.readOnly = true;
                  dateInput.className = 'session-date-input';
                  dateInput.placeholder = datePlaceholder;
                  dateInput.setAttribute('aria-label', datePlaceholder);
                  setSessionDateInputValue(dateInput, session);
                  dateInput.dataset.venueIndex = String(venueIndex);
                  dateInput.dataset.sessionIndex = String(sessionIndex);
                  dateInput.setAttribute('role', 'button');
                  dateInput.setAttribute('aria-haspopup', 'region');
                  const dateInputWrapper = document.createElement('div');
                  dateInputWrapper.className = 'session-date-input-wrapper';
                  dateInputWrapper.appendChild(dateInput);
                  const dropdownIndicator = document.createElement('span');
                  dropdownIndicator.className = 'session-date-dropdown-indicator';
                  dropdownIndicator.setAttribute('aria-hidden', 'true');
                  dropdownIndicator.textContent = '▾';
                  dateInputWrapper.appendChild(dropdownIndicator);
                  dateRow.appendChild(dateInputWrapper);

                  const dateActions = document.createElement('div');
                  dateActions.className = 'session-date-actions';
                  const openDatePickerBtn = document.createElement('button');
                  openDatePickerBtn.type = 'button';
                  openDatePickerBtn.className = 'tiny';
                  openDatePickerBtn.textContent = '+';
                  openDatePickerBtn.setAttribute('aria-label', 'Select Session Dates');
                  openDatePickerBtn.setAttribute('aria-haspopup', 'dialog');
                  dateActions.appendChild(openDatePickerBtn);
                  const removeDateBtn = createActionButton('-', 'Remove Session Date', ()=> removeSession(venue, venueIndex, sessionIndex));
                  if(venue.sessions.length <= 1){
                    removeDateBtn.disabled = true;
                    removeDateBtn.setAttribute('aria-disabled', 'true');
                  } else {
                    removeDateBtn.disabled = false;
                    removeDateBtn.removeAttribute('aria-disabled');
                  }
                  dateActions.appendChild(removeDateBtn);
                  dateRow.appendChild(dateActions);
                  sessionCard.appendChild(dateRow);
                  const datePickerControls = setupDatePicker(dateInput, venue, session, venueIndex, sessionIndex, { trigger: openDatePickerBtn });

                  const sessionDetails = document.createElement('div');
                  sessionDetails.className = 'session-details';
                  const detailsId = `session-details-${venueIndex}-${sessionIndex}`;
                  sessionDetails.id = detailsId;
                  const isOpen = openSessions.has(session);
                  sessionDetails.hidden = !isOpen;
                  dateInputWrapper.classList.toggle('is-open', isOpen);
                  dateInput.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                  dateInput.setAttribute('aria-controls', detailsId);

                  const syncSessionVisibility = (targetDetails, shouldOpen)=>{
                    if(!targetDetails) return;
                    const parentCard = targetDetails.closest('.session-card');
                    const wrapperNode = parentCard ? parentCard.querySelector('.session-date-input-wrapper') : null;
                    const inputNode = parentCard ? parentCard.querySelector('.session-date-input') : null;
                    targetDetails.hidden = !shouldOpen;
                    if(wrapperNode){
                      wrapperNode.classList.toggle('is-open', shouldOpen);
                    }
                    if(inputNode){
                      inputNode.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
                    }
                  };

                  dateInput.addEventListener('click', event => {
                    const isFirstSessionBlank = sessionIndex === 0 && (!session || typeof session.date !== 'string' || session.date.trim() === '');
                    if(isFirstSessionBlank && datePickerControls && typeof datePickerControls.open === 'function'){
                      event.preventDefault();
                      event.stopPropagation();
                      datePickerControls.open();
                      return;
                    }
                    closeAllPickers();
                    const currentlyOpen = openSessions.has(session);
                    const nextShouldOpen = !currentlyOpen;
                    if(nextShouldOpen){
                      openSessions.add(session);
                    } else {
                      openSessions.delete(session);
                    }
                    syncSessionVisibility(sessionDetails, nextShouldOpen);
                  });
                  dateInput.addEventListener('keydown', event => {
                    if(event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar'){
                      const isFirstSessionBlank = sessionIndex === 0 && (!session || typeof session.date !== 'string' || session.date.trim() === '');
                      if(isFirstSessionBlank && datePickerControls && typeof datePickerControls.open === 'function'){
                        event.preventDefault();
                        datePickerControls.open();
                        return;
                      }
                      event.preventDefault();
                      closeAllPickers();
                      const currentlyOpen = openSessions.has(session);
                      const nextShouldOpen = !currentlyOpen;
                      if(nextShouldOpen){
                        openSessions.add(session);
                      } else {
                        openSessions.delete(session);
                      }
                      syncSessionVisibility(sessionDetails, nextShouldOpen);
                    }
                  });
                  sessionCard.appendChild(sessionDetails);

                  const timesList = document.createElement('div');
                  timesList.className = 'session-times';
                  sessionDetails.appendChild(timesList);

                  session.times.forEach((timeObj, timeIndex)=>{
                    const isFirstSession = sessionIndex === 0;
                    const isFirstTimeSlot = timeIndex === 0;
                    if(isFirstTimeSlot){
                      timeObj.samePricingSourceIndex = 0;
                      if(isFirstSession){
                        timeObj.samePricingAsAbove = false;
                      } else if(typeof timeObj.samePricingAsAbove !== 'boolean'){
                        timeObj.samePricingAsAbove = true;
                      }
                    } else {
                      if(typeof timeObj.samePricingAsAbove !== 'boolean'){
                        timeObj.samePricingAsAbove = true;
                      }
                      if(!Number.isInteger(timeObj.samePricingSourceIndex) || timeObj.samePricingSourceIndex < 0){
                        timeObj.samePricingSourceIndex = 0;
                      }
                    }
                    const timeRow = document.createElement('div');
                    timeRow.className = 'session-time-row';

                    const computeTimeOrdinal = ()=>{
                      let ordinal = timeIndex + 1;
                      const currentDate = typeof session.date === 'string' ? session.date : '';
                      if(Array.isArray(venue.sessions) && currentDate){
                        for(let i = 0; i < sessionIndex; i++){
                          const compareSession = venue.sessions[i];
                          if(!compareSession || typeof compareSession.date !== 'string') continue;
                          if(compareSession.date !== currentDate) continue;
                          const compareTimes = Array.isArray(compareSession.times) ? compareSession.times.filter(Boolean) : [];
                          ordinal += Math.max(compareTimes.length, 1);
                        }
                      }
                      return ordinal;
                    };
                    const timeOrdinal = computeTimeOrdinal();
                    const timePlaceholder = `Session Time ${timeOrdinal} (24 hr clock)`;
                    const timeInput = document.createElement('input');
                    timeInput.type = 'text';
                    timeInput.className = 'session-time-input';
                    timeInput.placeholder = timePlaceholder;
                    timeInput.setAttribute('aria-label', timePlaceholder);
                    timeInput.inputMode = 'numeric';
                    timeInput.pattern = '([01]\\d|2[0-3]):[0-5]\\d';
                    timeInput.value = timeObj.time || '';
                    timeInput.dataset.venueIndex = String(venueIndex);
                    timeInput.dataset.sessionIndex = String(sessionIndex);
                    timeInput.dataset.timeIndex = String(timeIndex);
                    timeInput.addEventListener('input', ()=>{
                      const sanitized = sanitizeTimeInput(timeInput.value);
                      if(timeInput.value !== sanitized){
                        timeInput.value = sanitized;
                      }
                      timeInput.classList.remove('is-invalid');
                      setSessionDateInputValue(dateInput, session, sanitized);
                    });
                    timeInput.addEventListener('blur', ()=>{
                      commitTimeValue({ venue, venueIndex, sessionIndex, timeIndex, timeObj, input: timeInput });
                      resetSlotIfEmpty(venue, timeIndex);
                      updateSessionDateInputDisplay(venueIndex, sessionIndex);
                    });
                    timeRow.appendChild(timeInput);

                    const timeActions = document.createElement('div');
                    timeActions.className = 'session-time-actions';
                    timeActions.appendChild(createActionButton('+', 'Add Session Time', ()=> addTimeSlot(venue, venueIndex, sessionIndex, timeIndex)));
                    const removeTimeBtn = createActionButton('-', 'Remove Session Time', ()=> removeTimeSlot(venue, venueIndex, sessionIndex, timeIndex));
                    const timesForSession = Array.isArray(session.times) ? session.times.filter(Boolean) : [];
                    const canRemoveTime = timesForSession.length > 1;
                    if(!canRemoveTime){
                      removeTimeBtn.disabled = true;
                      removeTimeBtn.setAttribute('aria-disabled', 'true');
                    } else {
                      removeTimeBtn.disabled = false;
                      removeTimeBtn.removeAttribute('aria-disabled');
                    }
                    timeActions.appendChild(removeTimeBtn);
                    timeRow.appendChild(timeActions);

                    const versionList = document.createElement('div');
                    versionList.className = 'seating_area-list';
                    let samePricingRow = null;
                    let samePricingYesInput = null;
                    let samePricingNoInput = null;
                    const showSamePricingOptions = sessionIndex > 0 || timeIndex > 0;
                    
                    // Generate unique suffix once per time row to ensure IDs are unique across multiple venue ticketing fields
                    const uniqueSuffix = baseId ? baseId.replace(/[^a-zA-Z0-9]/g, '_') : `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                    const getSamePricingReference = ()=>{
                      if(timeIndex > 0){
                        const firstTime = session.times[0];
                        return firstTime && firstTime !== timeObj ? firstTime : null;
                      }
                      if(sessionIndex > 0){
                        const referenceSession = Array.isArray(venue.sessions) ? venue.sessions[0] : null;
                        if(referenceSession && referenceSession !== session){
                          const referenceTimes = Array.isArray(referenceSession.times) ? referenceSession.times : [];
                          const referenceByIndex = referenceTimes[timeIndex];
                          if(referenceByIndex && referenceByIndex !== timeObj){
                            return referenceByIndex;
                          }
                          const fallbackReference = referenceTimes[0];
                          if(fallbackReference && fallbackReference !== timeObj){
                            return fallbackReference;
                          }
                        }
                      }
                      const fallback = session.times[0];
                      return fallback && fallback !== timeObj ? fallback : null;
                    };

                    const initialReference = getSamePricingReference();
                    if(timeObj.samePricingAsAbove === true && initialReference && initialReference !== timeObj){
                      timeObj.samePricingSourceIndex = 0;
                      timeObj.versions = initialReference.versions;
                      if(sessionIndex > 0){
                        timeObj.tierAutofillLocked = true;
                      }
                    } else {
                      if(initialReference && timeObj.versions === initialReference.versions){
                        timeObj.versions = initialReference.versions.map(cloneVenueSessionVersion);
                      }
                      if(!Array.isArray(timeObj.versions) || timeObj.versions.length === 0){
                        timeObj.versions = [venueSessionCreateVersion()];
                      }
                      if(sessionIndex > 0 && timeObj.samePricingAsAbove !== true){
                        timeObj.tierAutofillLocked = false;
                      }
                    }

                    const updateSamePricingUI = ()=>{
                      const referenceTime = getSamePricingReference();
                      const isSamePricing = showSamePricingOptions && referenceTime && referenceTime !== timeObj && timeObj.samePricingAsAbove === true;
                      versionList.hidden = isSamePricing;
                      versionList.style.display = isSamePricing ? 'none' : '';
                      timeRow.classList.toggle('has-same-pricing', isSamePricing);
                      if(samePricingRow){
                        samePricingRow.hidden = !showSamePricingOptions;
                        samePricingRow.style.display = showSamePricingOptions ? '' : 'none';
                      }
                      if(samePricingYesInput){
                        samePricingYesInput.checked = showSamePricingOptions && timeObj.samePricingAsAbove === true;
                      }
                      if(samePricingNoInput){
                        samePricingNoInput.checked = showSamePricingOptions && timeObj.samePricingAsAbove !== true;
                      }
                    };

                    const populateVersionList = ()=>{
                      versionList.innerHTML = '';
                      timeObj.versions.forEach((version, versionIndex)=>{
                        const versionCard = document.createElement('div');
                        versionCard.className = 'session-pricing-card';

                        const versionPlaceholder = 'eg. General, Stalls, Balcony';
                        const seatingLabelText = `Seating Area ${versionIndex + 1}`;
                        const seatingLabel = document.createElement('label');
                        seatingLabel.className = 'seating_area-label';
                        seatingLabel.textContent = seatingLabelText;
                        const seatingInputId = `seating_area-${uniqueSuffix}-${venueIndex}-${sessionIndex}-${timeIndex}-${versionIndex}`;
                        seatingLabel.setAttribute('for', seatingInputId);
                        const versionInput = document.createElement('input');
                        versionInput.type = 'text';
                        versionInput.className = 'seating_area-input';
                        versionInput.placeholder = versionPlaceholder;
                        versionInput.setAttribute('aria-label', seatingLabelText);
                        versionInput.id = seatingInputId;
                        versionInput.value = version.name || '';
                        versionInput.dataset.venueIndex = String(venueIndex);
                        versionInput.dataset.sessionIndex = String(sessionIndex);
                        versionInput.dataset.timeIndex = String(timeIndex);
                        versionInput.dataset.versionIndex = String(versionIndex);
                        versionInput.addEventListener('input', ()=>{
                          const previous = typeof version.name === 'string' ? version.name : '';
                          const nextValue = versionInput.value;
                          version.name = nextValue;
                          if(sessionIndex === 0 && !isSessionMirrorLocked(venue) && previous !== nextValue){
                            forEachOtherSession(venue, (otherSess, otherIndex)=>{
                              const otherTime = otherSess.times[timeIndex] || (otherSess.times[timeIndex] = venueSessionCreateTime());
                              const otherVersions = Array.isArray(otherTime.versions) ? otherTime.versions : (otherTime.versions = [venueSessionCreateVersion()]);
                              while(otherVersions.length <= versionIndex){
                                otherVersions.push(venueSessionCreateVersion());
                              }
                              const otherVersion = otherVersions[versionIndex];
                              if(otherVersion){
                                otherVersion.name = nextValue;
                                const selector = `.seating_area-input[data-venue-index="${venueIndex}"][data-session-index="${otherIndex}"][data-time-index="${timeIndex}"][data-version-index="${versionIndex}"]`;
                                const peer = editor.querySelector(selector);
                                if(peer){
                                  peer.value = nextValue;
                                }
                              }
                            });
                          } else if(sessionIndex > 0 && previous !== nextValue){
                            lockSessionMirror(venue);
                          }
                          notifyFormbuilderChange();
                        });
                        versionCard.appendChild(seatingLabel);
                        versionCard.appendChild(versionInput);

                        const versionActions = document.createElement('div');
                        versionActions.className = 'version-actions';
                        versionActions.appendChild(createActionButton('+', 'Add Seating Area', ()=> addVersion(venue, venueIndex, sessionIndex, timeIndex, versionIndex)));
                        const removeVersionBtn = createActionButton('-', 'Remove Seating Area', ()=> removeVersion(venue, venueIndex, sessionIndex, timeIndex, versionIndex, version));
                        if(timeObj.versions.length <= 1){
                          removeVersionBtn.disabled = true;
                          removeVersionBtn.setAttribute('aria-disabled', 'true');
                        } else {
                          removeVersionBtn.disabled = false;
                          removeVersionBtn.removeAttribute('aria-disabled');
                        }
                        versionActions.appendChild(removeVersionBtn);
                        versionCard.appendChild(versionActions);

                        const tierList = document.createElement('div');
                        tierList.className = 'pricing_tier-list';
                        version.tiers.forEach((tier, tierIndex)=>{
                          const tierRow = document.createElement('div');
                          tierRow.className = 'tier-row';

                          const tierPlaceholder = 'eg. Child, Student, Adult';
                          const tierLabelText = `Pricing Tier ${tierIndex + 1}`;
                          const tierLabel = document.createElement('label');
                          tierLabel.className = 'pricing_tier-label';
                          tierLabel.textContent = tierLabelText;
                          // Use same unique suffix for consistency
                          const tierInputId = `pricing_tier-${uniqueSuffix}-${venueIndex}-${sessionIndex}-${timeIndex}-${versionIndex}-${tierIndex}`;
                          tierLabel.setAttribute('for', tierInputId);
                          const tierInput = document.createElement('input');
                          tierInput.type = 'text';
                          tierInput.className = 'pricing_tier-input';
                          tierInput.placeholder = tierPlaceholder;
                          tierInput.setAttribute('aria-label', tierLabelText);
                          tierInput.id = tierInputId;
                          tierInput.value = tier.name || '';
                          tierInput.dataset.venueIndex = String(venueIndex);
                          tierInput.dataset.sessionIndex = String(sessionIndex);
                          tierInput.dataset.timeIndex = String(timeIndex);
                          tierInput.dataset.versionIndex = String(versionIndex);
                          tierInput.dataset.tierIndex = String(tierIndex);
                          tierRow.appendChild(tierLabel);
                          tierInput.addEventListener('input', ()=>{
                            const previous = typeof tier.name === 'string' ? tier.name : '';
                            const nextValue = tierInput.value;
                            tier.name = nextValue;
                            let syncedFromTemplate = false;
                            if(versionIndex === 0){
                              syncedFromTemplate = syncTiersFromTemplate(timeObj);
                              if(!timeObj.tierAutofillLocked){
                                const versions = Array.isArray(timeObj.versions) ? timeObj.versions : [];
                                for(let otherVersionIndex = 1; otherVersionIndex < versions.length; otherVersionIndex++){
                                  const selector = `.pricing_tier-input[data-venue-index="${venueIndex}"][data-session-index="${sessionIndex}"][data-time-index="${timeIndex}"][data-version-index="${otherVersionIndex}"][data-tier-index="${tierIndex}"]`;
                                  const peer = editor.querySelector(selector);
                                  if(peer){
                                    peer.value = nextValue;
                                  }
                                }
                              }
                            }
                            if(sessionIndex === 0 && !isSessionMirrorLocked(venue) && previous !== nextValue){
                              forEachOtherSession(venue, (otherSess, otherIndex)=>{
                                const otherTime = otherSess.times[timeIndex] || (otherSess.times[timeIndex] = venueSessionCreateTime());
                                const otherVersions = Array.isArray(otherTime.versions) ? otherTime.versions : (otherTime.versions = [venueSessionCreateVersion()]);
                                while(otherVersions.length <= versionIndex){
                                  otherVersions.push(venueSessionCreateVersion());
                                }
                                const otherVersion = otherVersions[versionIndex];
                                if(!otherVersion) return;
                                const otherTiers = Array.isArray(otherVersion.tiers) ? otherVersion.tiers : (otherVersion.tiers = [venueSessionCreateTier()]);
                                while(otherTiers.length <= tierIndex){
                                  otherTiers.push(venueSessionCreateTier());
                                }
                                const otherTier = otherTiers[tierIndex];
                                if(otherTier){
                                  otherTier.name = nextValue;
                                  const selector = `.pricing_tier-input[data-venue-index="${venueIndex}"][data-session-index="${otherIndex}"][data-time-index="${timeIndex}"][data-version-index="${versionIndex}"][data-tier-index="${tierIndex}"]`;
                                  const peer = editor.querySelector(selector);
                                  if(peer){
                                    peer.value = nextValue;
                                  }
                                }
                              });
                            } else if(sessionIndex > 0 && previous !== nextValue){
                              lockSessionMirror(venue);
                            }
                            const locked = lockTierAutofillIfNeeded(timeObj, versionIndex);
                            if(previous !== nextValue || locked || syncedFromTemplate){
                              notifyFormbuilderChange();
                            }
                          });
                          tierRow.appendChild(tierInput);

                          const tierActions = document.createElement('div');
                          tierActions.className = 'tier-actions';
                          tierActions.appendChild(createActionButton('+', 'Add Tier', ()=> addTier(venue, venueIndex, sessionIndex, timeIndex, versionIndex, tierIndex)));
                          const removeTierBtn = createActionButton('-', 'Remove Tier', ()=> removeTier(venue, venueIndex, sessionIndex, timeIndex, versionIndex, tierIndex, version, tier));
                          if(version.tiers.length <= 1){
                            removeTierBtn.disabled = true;
                            removeTierBtn.setAttribute('aria-disabled', 'true');
                          } else {
                            removeTierBtn.disabled = false;
                            removeTierBtn.removeAttribute('aria-disabled');
                          }
                          tierActions.appendChild(removeTierBtn);
                          tierRow.appendChild(tierActions);

                          const priceRow = document.createElement('div');
                          priceRow.className = 'tier-price-row';
                          const currencyWrapper = document.createElement('div');
                          currencyWrapper.className = 'options-dropdown';
                          const currencyMenuBtn = document.createElement('button');
                          currencyMenuBtn.type = 'button';
                          currencyMenuBtn.className = 'session-currency-select';
                          currencyMenuBtn.setAttribute('aria-haspopup', 'true');
                          currencyMenuBtn.setAttribute('aria-expanded', 'false');
                          const currencyMenuId = `session-currency-${venueIndex}-${sessionIndex}-${timeIndex}-${versionIndex}-${tierIndex}`;
                          currencyMenuBtn.setAttribute('aria-controls', currencyMenuId);
                          const existingCurrency = typeof tier.currency === 'string' ? tier.currency.trim() : '';
                          currencyMenuBtn.textContent = existingCurrency || 'Currency';
                          currencyMenuBtn.dataset.value = existingCurrency;
                          currencyMenuBtn.dataset.venueIndex = String(venueIndex);
                          currencyMenuBtn.dataset.sessionIndex = String(sessionIndex);
                          currencyMenuBtn.dataset.timeIndex = String(timeIndex);
                          currencyMenuBtn.dataset.versionIndex = String(versionIndex);
                          currencyMenuBtn.dataset.tierIndex = String(tierIndex);
                          const currencyArrow = document.createElement('span');
                          currencyArrow.className = 'dropdown-arrow';
                          currencyArrow.setAttribute('aria-hidden', 'true');
                          currencyMenuBtn.appendChild(currencyArrow);
                          const currencyMenu = document.createElement('div');
                          currencyMenu.className = 'options-menu';
                          currencyMenu.id = currencyMenuId;
                          currencyMenu.hidden = true;
                          const placeholderBtn = document.createElement('button');
                          placeholderBtn.type = 'button';
                          placeholderBtn.className = 'menu-option';
                          placeholderBtn.textContent = 'Currency';
                          placeholderBtn.dataset.value = '';
                          placeholderBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            currencyMenuBtn.textContent = 'Currency';
                            currencyMenuBtn.dataset.value = '';
                            currencyMenuBtn.appendChild(currencyArrow);
                            currencyMenu.hidden = true;
                            currencyMenuBtn.setAttribute('aria-expanded', 'false');
                            const nextCurrency = '';
                            const previousCurrency = typeof tier.currency === 'string' ? tier.currency : '';
                            tier.currency = nextCurrency;
                            const shouldClearPrice = nextCurrency === '';
                            const priceCleared = updatePriceState({ clearPrice: shouldClearPrice, sanitize: true });
                            const propagated = applyCurrencyToVenueData(venue, nextCurrency, {
                              sourceTier: tier,
                              clearPrices: shouldClearPrice
                            });
                            if(sessionIndex > 0 && previousCurrency !== nextCurrency){
                              lockSessionMirror(venue);
                            }
                            if(previousCurrency !== nextCurrency || priceCleared || propagated){
                              markAutoChange();
                            }
                          });
                          currencyMenu.appendChild(placeholderBtn);
                          const currencyOptions = Array.isArray(window.currencyCodes) ? window.currencyCodes : [];
                          currencyOptions.forEach(code => {
                            const optionBtn = document.createElement('button');
                            optionBtn.type = 'button';
                            optionBtn.className = 'menu-option';
                            optionBtn.textContent = code;
                            optionBtn.dataset.value = code;
                            optionBtn.addEventListener('click', (e) => {
                              e.stopPropagation();
                              currencyMenuBtn.textContent = code;
                              currencyMenuBtn.dataset.value = code;
                              currencyMenuBtn.appendChild(currencyArrow);
                              currencyMenu.hidden = true;
                              currencyMenuBtn.setAttribute('aria-expanded', 'false');
                              const nextCurrency = code.trim();
                              const previousCurrency = typeof tier.currency === 'string' ? tier.currency : '';
                              tier.currency = nextCurrency;
                              const shouldClearPrice = nextCurrency === '';
                              const priceCleared = updatePriceState({ clearPrice: shouldClearPrice, sanitize: true });
                              const propagated = applyCurrencyToVenueData(venue, nextCurrency, {
                                sourceTier: tier,
                                clearPrices: shouldClearPrice
                              });
                              if(sessionIndex > 0 && previousCurrency !== nextCurrency){
                                lockSessionMirror(venue);
                              }
                              if(previousCurrency !== nextCurrency || priceCleared || propagated){
                                markAutoChange();
                              }
                            });
                            currencyMenu.appendChild(optionBtn);
                          });
                          currencyMenuBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const open = !currencyMenu.hasAttribute('hidden');
                            if(open){
                              currencyMenu.hidden = true;
                              currencyMenuBtn.setAttribute('aria-expanded', 'false');
                            } else {
                              currencyMenu.hidden = false;
                              currencyMenuBtn.setAttribute('aria-expanded', 'true');
                              const outsideHandler = (ev) => {
                                if(!ev.target.closest(currencyWrapper)){
                                  currencyMenu.hidden = true;
                                  currencyMenuBtn.setAttribute('aria-expanded', 'false');
                                  document.removeEventListener('click', outsideHandler);
                                  document.removeEventListener('pointerdown', outsideHandler);
                                }
                              };
                              setTimeout(() => {
                                document.addEventListener('click', outsideHandler);
                                document.addEventListener('pointerdown', outsideHandler);
                              }, 0);
                            }
                          });
                          currencyMenu.addEventListener('click', (e) => e.stopPropagation());
                          currencyWrapper.appendChild(currencyMenuBtn);
                          currencyWrapper.appendChild(currencyMenu);
                          const currencySelect = currencyMenuBtn; // Keep reference for hasCurrencySelected
                          priceRow.appendChild(currencyWrapper);

                          const priceInput = document.createElement('input');
                          priceInput.type = 'text';
                          priceInput.inputMode = 'decimal';
                          priceInput.pattern = '[0-9]+([\.,][0-9]{0,2})?';
                          priceInput.className = 'session-price-input';
                          priceInput.placeholder = '0.00';
                          const sanitizedInitialPrice = sanitizeSessionPriceValue(tier.price || '');
                          const formattedInitialPrice = formatSessionPriceValue(sanitizedInitialPrice);
                          if(typeof tier.price !== 'string' || tier.price !== formattedInitialPrice){
                            tier.price = formattedInitialPrice;
                            markAutoChange();
                          }
                          priceInput.value = formattedInitialPrice;
                          priceInput.dataset.venueIndex = String(venueIndex);
                          priceInput.dataset.sessionIndex = String(sessionIndex);
                          priceInput.dataset.timeIndex = String(timeIndex);
                          priceInput.dataset.versionIndex = String(versionIndex);
                          priceInput.dataset.tierIndex = String(tierIndex);

                          const hasCurrencySelected = ()=> (currencyMenuBtn.dataset.value || '').trim() !== '';

                          const updatePriceState = (options = {})=>{
                            const opts = options || {};
                            if(hasCurrencySelected()){
                              priceInput.readOnly = false;
                              priceInput.classList.remove('is-awaiting-currency');
                              priceInput.removeAttribute('aria-disabled');
                              if(opts.sanitize !== false){
                                const sanitized = sanitizeSessionPriceValue(priceInput.value);
                                if(priceInput.value !== sanitized){
                                  priceInput.value = sanitized;
                                }
                              }
                              return false;
                            }
                            priceInput.readOnly = true;
                            priceInput.classList.add('is-awaiting-currency');
                            priceInput.setAttribute('aria-disabled', 'true');
                            let priceChanged = false;
                            if(opts.clearPrice){
                              if(priceInput.value !== ''){
                                priceInput.value = '';
                              }
                              if(tier.price){
                                tier.price = '';
                                priceChanged = true;
                              }
                            }
                            return priceChanged;
                          };

                          const commitPriceValue = ()=>{
                            let shouldNotify = false;
                            let shouldLock = false;
                            const previous = typeof tier.price === 'string' ? tier.price : '';
                            if(!hasCurrencySelected()){
                              const cleared = updatePriceState({ clearPrice: true, sanitize: false });
                              if(cleared){
                                tier.price = '';
                                shouldNotify = true;
                                shouldLock = true;
                              }
                            } else {
                              const formattedPrice = formatSessionPriceValue(priceInput.value);
                              if(priceInput.value !== formattedPrice){
                                priceInput.value = formattedPrice;
                              }
                              if(previous !== formattedPrice){
                                tier.price = formattedPrice;
                                shouldNotify = true;
                                shouldLock = true;
                              }
                            }
                            if(sessionIndex === 0 && !isSessionMirrorLocked(venue) && previous !== tier.price){
                              const nextValue = tier.price || '';
                              forEachOtherSession(venue, (otherSess, otherIndex)=>{
                                const otherTime = otherSess.times[timeIndex] || (otherSess.times[timeIndex] = venueSessionCreateTime());
                                const otherVersions = Array.isArray(otherTime.versions) ? otherTime.versions : (otherTime.versions = [venueSessionCreateVersion()]);
                                while(otherVersions.length <= versionIndex){
                                  otherVersions.push(venueSessionCreateVersion());
                                }
                                const otherVersion = otherVersions[versionIndex];
                                if(!otherVersion) return;
                                const otherTiers = Array.isArray(otherVersion.tiers) ? otherVersion.tiers : (otherVersion.tiers = [venueSessionCreateTier()]);
                                while(otherTiers.length <= tierIndex){
                                  otherTiers.push(venueSessionCreateTier());
                                }
                                const otherTier = otherTiers[tierIndex];
                                if(!otherTier) return;
                                otherTier.price = nextValue;
                                const selector = `.session-price-input[data-venue-index="${venueIndex}"][data-session-index="${otherIndex}"][data-time-index="${timeIndex}"][data-version-index="${versionIndex}"][data-tier-index="${tierIndex}"]`;
                                const peer = editor.querySelector(selector);
                                if(peer){
                                  peer.value = nextValue;
                                }
                              });
                            } else if(sessionIndex > 0 && previous !== tier.price){
                              lockSessionMirror(venue);
                            }
                            if(shouldLock && lockTierAutofillIfNeeded(timeObj, versionIndex)){
                              shouldNotify = true;
                            }
                            if(shouldNotify){
                              notifyFormbuilderChange();
                            }
                          };

                          const blockPriceAccess = event => {
                            if(hasCurrencySelected()) return false;
                            if(event && event.type === 'pointerdown' && event.button !== 0) return false;
                            if(event && typeof event.preventDefault === 'function'){
                              event.preventDefault();
                            }
                            if(event && typeof event.stopPropagation === 'function'){
                              event.stopPropagation();
                            }
                            if(typeof priceInput.blur === 'function'){
                              requestAnimationFrame(()=>{
                                try{ priceInput.blur(); }catch(err){}
                              });
                            }
                            showCurrencyAlert(priceInput);
                            return true;
                          };

                          currencySelect.addEventListener('change', ()=>{
                            const nextCurrency = currencySelect.value.trim();
                            const previousCurrency = typeof tier.currency === 'string' ? tier.currency : '';
                            tier.currency = nextCurrency;
                            const shouldClearPrice = nextCurrency === '';
                            const priceCleared = updatePriceState({ clearPrice: shouldClearPrice, sanitize: true });
                            const propagated = applyCurrencyToVenueData(venue, nextCurrency, {
                              sourceTier: tier,
                              clearPrices: shouldClearPrice
                            });
                            if(sessionIndex > 0 && previousCurrency !== nextCurrency){
                              lockSessionMirror(venue);
                            }
                            setVenueCurrencyState(venue, nextCurrency);
                            let notifyNeeded = (previousCurrency !== nextCurrency) || priceCleared || propagated;
                            if(lockTierAutofillIfNeeded(timeObj, versionIndex)){
                              notifyNeeded = true;
                            }
                            if(notifyNeeded){
                              notifyFormbuilderChange();
                            }
                            renderVenues({ type: 'price', venueIndex, sessionIndex, timeIndex, versionIndex, tierIndex });
                          });

                          priceInput.addEventListener('beforeinput', event => {
                            if(hasCurrencySelected()){
                              const data = event && event.data;
                              if(typeof data === 'string' && /[^0-9.,]/.test(data)){
                                event.preventDefault();
                              }
                              return;
                            }
                            if(event){
                              event.preventDefault();
                            }
                            showCurrencyAlert(priceInput);
                          });
                          priceInput.addEventListener('pointerdown', blockPriceAccess);
                          priceInput.addEventListener('focus', blockPriceAccess);
                          priceInput.addEventListener('keydown', event => {
                            if(event.key === 'Tab' || event.key === 'Shift') return;
                            blockPriceAccess(event);
                          });
                          priceInput.addEventListener('input', ()=>{
                            if(!hasCurrencySelected()) return;
                            const rawValue = priceInput.value;
                            const sanitized = sanitizeSessionPriceValue(rawValue);
                            if(rawValue !== sanitized){
                              const start = priceInput.selectionStart;
                              const end = priceInput.selectionEnd;
                              priceInput.value = sanitized;
                              if(typeof priceInput.setSelectionRange === 'function' && start != null && end != null){
                                const adjustment = rawValue.length - sanitized.length;
                                const nextStart = Math.max(0, start - adjustment);
                                const nextEnd = Math.max(0, end - adjustment);
                                priceInput.setSelectionRange(nextStart, nextEnd);
                              }
                            }
                          });
                          priceInput.addEventListener('blur', commitPriceValue);
                          priceInput.addEventListener('change', commitPriceValue);

                          updatePriceState({ clearPrice: false, sanitize: false });
                          priceRow.appendChild(priceInput);
                          tierRow.appendChild(priceRow);
                          tierList.appendChild(tierRow);
                        });
                        versionCard.appendChild(tierList);
                        versionList.appendChild(versionCard);
                      });
                    };

                    const handleSamePricingSelection = (shouldMatch)=>{
                      if(sessionIndex > 0){
                        lockSessionMirror(venue);
                      }
                      const referenceTime = getSamePricingReference();
                      const canApplyReference = shouldMatch && referenceTime && referenceTime !== timeObj;
                      if(canApplyReference){
                        timeObj.samePricingAsAbove = true;
                        timeObj.samePricingSourceIndex = 0;
                        timeObj.versions = referenceTime.versions;
                        timeObj.tierAutofillLocked = true;
                      } else {
                        timeObj.samePricingAsAbove = false;
                        timeObj.samePricingSourceIndex = 0;
                        if(referenceTime && timeObj.versions === referenceTime.versions){
                          timeObj.versions = referenceTime.versions.map(cloneVenueSessionVersion);
                        }
                        if(!Array.isArray(timeObj.versions) || timeObj.versions.length === 0){
                          timeObj.versions = [venueSessionCreateVersion()];
                        }
                        timeObj.tierAutofillLocked = false;
                      }
                      notifyFormbuilderChange();
                      populateVersionList();
                      updateSamePricingUI();
                    };

                    if(showSamePricingOptions){
                      samePricingRow = document.createElement('div');
                      samePricingRow.className = 'same-pricing-row';
                      const samePricingLabel = document.createElement('span');
                      samePricingLabel.className = 'same-pricing-label';
                      samePricingLabel.textContent = 'Same Pricing as Above';
                      samePricingRow.appendChild(samePricingLabel);

                      const samePricingOptions = document.createElement('div');
                      samePricingOptions.className = 'same-pricing-options';
                      const radioName = `same-pricing-${venueIndex}-${sessionIndex}-${timeIndex}`;

                      const yesLabel = document.createElement('label');
                      samePricingYesInput = document.createElement('input');
                      samePricingYesInput.type = 'radio';
                      samePricingYesInput.name = radioName;
                      samePricingYesInput.value = 'yes';
                      yesLabel.appendChild(samePricingYesInput);
                      const yesText = document.createElement('span');
                      yesText.textContent = 'Yes';
                      yesLabel.appendChild(yesText);
                      samePricingYesInput.addEventListener('change', ()=>{
                        if(samePricingYesInput.checked){
                          handleSamePricingSelection(true);
                        }
                      });
                      samePricingOptions.appendChild(yesLabel);

                      const noLabel = document.createElement('label');
                      samePricingNoInput = document.createElement('input');
                      samePricingNoInput.type = 'radio';
                      samePricingNoInput.name = radioName;
                      samePricingNoInput.value = 'no';
                      noLabel.appendChild(samePricingNoInput);
                      const noText = document.createElement('span');
                      noText.textContent = 'No';
                      noLabel.appendChild(noText);
                      samePricingNoInput.addEventListener('change', ()=>{
                        if(samePricingNoInput.checked){
                          handleSamePricingSelection(false);
                        }
                      });
                      samePricingOptions.appendChild(noLabel);

                      samePricingRow.appendChild(samePricingOptions);
                      timeRow.appendChild(samePricingRow);
                    }

                    timeRow.appendChild(versionList);
                    populateVersionList();
                    updateSamePricingUI();
                    timesList.appendChild(timeRow);
                  });
                  sessionContainer.appendChild(sessionCard);
                });
                venueCard.appendChild(sessionContainer);

              });
              if(shouldNotifyAfterRender){
                notifyFormbuilderChange();
              }
              applyFocus();
            };

            renderVenues();
            return editor;
          };

          // Fields now come from backend via field_types, no hardcoded defaults

          const fields = Array.isArray(subFieldsMap[sub]) ? subFieldsMap[sub] : (subFieldsMap[sub] = []);

          const fieldsContainerState = setupFieldContainer(fieldsList, fields);

          const formPreviewBtn = document.createElement('button');
          formPreviewBtn.type = 'button';
          formPreviewBtn.className = 'form-preview-btn';
          formPreviewBtn.setAttribute('aria-expanded', 'false');
          formPreviewBtn.setAttribute('aria-label', `Preview ${sub} form`);
          const formPreviewLabel = document.createElement('span');
          formPreviewLabel.textContent = 'Form Preview';
          const formPreviewArrow = document.createElement('span');
          formPreviewArrow.className = 'dropdown-arrow';
          formPreviewArrow.setAttribute('aria-hidden', 'true');
          formPreviewBtn.append(formPreviewLabel, formPreviewArrow);

          const formPreviewContainer = document.createElement('div');
          formPreviewContainer.className = 'form-preview-container';
          formPreviewContainer.hidden = true;
          const formPreviewFields = document.createElement('div');
          formPreviewFields.className = 'form-preview-fields';
          formPreviewContainer.appendChild(formPreviewFields);
          const formPreviewId = `${subContentId}Preview`;
          formPreviewContainer.id = formPreviewId;
          formPreviewBtn.setAttribute('aria-controls', formPreviewId);

          // Expose buildVenueSessionPreview for use in member forms
          window.buildVenueSessionPreview = buildVenueSessionPreview;

          fieldsSection.append(fieldsList, addFieldBtn, formPreviewBtn, formPreviewContainer);

          formPreviewBtn.addEventListener('click', ()=>{
            const expanded = formPreviewBtn.getAttribute('aria-expanded') === 'true';
            const nextExpanded = !expanded;
            formPreviewBtn.setAttribute('aria-expanded', String(nextExpanded));
            formPreviewContainer.hidden = !nextExpanded;
            if(nextExpanded){
              renderFormPreview();
            }
          });

          const createFieldEditUI = (safeField, {
            hostElement = null,
            attachDropdownToPanel = false,
            summaryUpdater: initialSummaryUpdater = ()=>{}
          } = {}) => {
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'field-edit-btn';
            editBtn.setAttribute('aria-haspopup', 'true');
            editBtn.setAttribute('aria-expanded', 'false');
            editBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M12.854 1.146a.5.5 0 0 1 .707 0l1.293 1.293a.5.5 0 0 1 0 .707l-8.939 8.939a.5.5 0 0 1-.233.131l-3.5.875a.5.5 0 0 1-.606-.606l.875-3.5a.5.5 0 0 1 .131-.233l8.939-8.939z"/><path d="M2.5 12.5V14h1.5l9-9-1.5-1.5-9 9z"/></svg>';

            const editPanel = document.createElement('div');
            editPanel.className = 'field-edit-panel';
            editPanel.hidden = true;
            editPanel.style.position = 'absolute';
            editPanel.style.right = '0';
            editPanel.style.top = 'calc(100% + 10px)';
            editPanel.style.zIndex = '100';

            const editMenu = document.createElement('div');
            editMenu.className = 'field-edit-menu';
            editPanel.append(editMenu);

            const inlineControls = document.createElement('div');
            inlineControls.className = 'field-inline-controls';
            editMenu.append(inlineControls);

            const matchKey = safeField.fieldTypeKey || safeField.key || safeField.type;
            
            // Get existing field types in this subcategory (excluding current field)
            const existingFieldTypes = new Set();
            fields.forEach(f => {
              if(f !== safeField && (f.fieldTypeKey || f.key)){
                existingFieldTypes.add(f.fieldTypeKey || f.key);
              }
            });
            
            const fieldTypeWrapper = document.createElement('div');
            fieldTypeWrapper.className = 'field-type-select-wrapper options-dropdown';
            
            const fieldTypeMenuBtn = document.createElement('button');
            fieldTypeMenuBtn.type = 'button';
            fieldTypeMenuBtn.className = 'field-type-select';
            fieldTypeMenuBtn.setAttribute('aria-haspopup', 'true');
            fieldTypeMenuBtn.setAttribute('aria-expanded', 'false');
            const menuId = `field-type-menu-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            fieldTypeMenuBtn.setAttribute('aria-controls', menuId);
            
            const selectedFieldType = FORM_FIELD_TYPES.find(opt => opt.value === matchKey);
            const defaultLabel = selectedFieldType 
              ? (resolveFieldTypeDisplayName(selectedFieldType) || selectedFieldType.label || selectedFieldType.value || 'Select field type...')
              : 'Select field type...';
            fieldTypeMenuBtn.textContent = defaultLabel;
            fieldTypeMenuBtn.dataset.value = matchKey || '';
            
            const arrow = document.createElement('span');
            arrow.className = 'dropdown-arrow';
            arrow.setAttribute('aria-hidden', 'true');
            fieldTypeMenuBtn.appendChild(arrow);
            
            const fieldTypeMenu = document.createElement('div');
            fieldTypeMenu.className = 'options-menu';
            fieldTypeMenu.id = menuId;
            fieldTypeMenu.hidden = true;
            
            if(!matchKey){
              const placeholderBtn = document.createElement('button');
              placeholderBtn.type = 'button';
              placeholderBtn.className = 'menu-option';
              placeholderBtn.textContent = 'Select field type...';
              placeholderBtn.disabled = true;
              fieldTypeMenu.appendChild(placeholderBtn);
            }
            
            FORM_FIELD_TYPES.forEach(optionDef => {
              const optionBtn = document.createElement('button');
              optionBtn.type = 'button';
              optionBtn.className = 'menu-option';
              const optionLabel = resolveFieldTypeDisplayName(optionDef) || optionDef.label || optionDef.value || '';
              optionBtn.textContent = optionLabel || optionDef.value;
              optionBtn.dataset.value = optionDef.value || '';
              if(optionDef.value){
                optionBtn.dataset.fieldTypeKey = optionDef.value;
              }
              if(optionLabel){
                optionBtn.dataset.fieldTypeName = optionLabel;
              } else if(optionDef.value){
                optionBtn.dataset.fieldTypeName = optionDef.value;
              }
              
              // Disable if this field type already exists in the subcategory
              if(existingFieldTypes.has(optionDef.value) && optionDef.value !== matchKey){
                optionBtn.disabled = true;
                optionBtn.classList.add('field-type-disabled');
              }
              
              if(optionDef.value === matchKey){
                optionBtn.setAttribute('aria-pressed', 'true');
              }
              
              optionBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const nextType = optionBtn.dataset.value || '';
                if(!nextType) return;
                
                const nextValidType = FORM_FIELD_TYPES.some(opt => opt.value === nextType) ? nextType : 'text-box';
                safeField.fieldTypeKey = nextValidType;
                safeField.key = nextValidType;
                
                const matchingFieldType = FORM_FIELD_TYPES.find(opt => opt.value === nextValidType);
                const matchingDisplayName = matchingFieldType ? resolveFieldTypeDisplayName(matchingFieldType) : '';
                const updatedFieldTypeName = (matchingDisplayName || nextValidType || '').trim();
                safeField.field_type_name = updatedFieldTypeName;
                safeField.fieldTypeName = updatedFieldTypeName;
                
                const isEditable = matchingFieldType && matchingFieldType.formbuilder_editable === true;
                if(!isEditable && updatedFieldTypeName){
                  safeField.name = updatedFieldTypeName;
                } else if(isEditable && !safeField.name){
                  safeField.name = updatedFieldTypeName;
                }
                if(fieldNameInput){
                  fieldNameInput.value = safeField.name || '';
                }
                
                if(matchingFieldType){
                  if(matchingFieldType.placeholder){
                    safeField.placeholder = matchingFieldType.placeholder;
                  }
                  safeField.type = nextValidType;
                }
                
                fieldTypeMenuBtn.textContent = optionLabel || nextValidType;
                fieldTypeMenuBtn.dataset.value = nextValidType;
                fieldTypeMenuBtn.appendChild(arrow);
                fieldTypeMenu.hidden = true;
                fieldTypeMenuBtn.setAttribute('aria-expanded', 'false');
                
                // Update all option buttons aria-pressed
                fieldTypeMenu.querySelectorAll('button.menu-option').forEach(btn => {
                  btn.setAttribute('aria-pressed', btn === optionBtn ? 'true' : 'false');
                });
                
                notifyFormbuilderChange();
                updateFieldEditorsByType();
                renderFormPreview();
                runSummaryUpdater();
              });
              
              fieldTypeMenu.appendChild(optionBtn);
            });
            
            fieldTypeMenuBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              const open = !fieldTypeMenu.hasAttribute('hidden');
              if(open){
                fieldTypeMenu.hidden = true;
                fieldTypeMenuBtn.setAttribute('aria-expanded', 'false');
              } else {
                fieldTypeMenu.hidden = false;
                fieldTypeMenuBtn.setAttribute('aria-expanded', 'true');
                const outsideHandler = (ev) => {
                  if(!ev.target.closest(fieldTypeWrapper)){
                    fieldTypeMenu.hidden = true;
                    fieldTypeMenuBtn.setAttribute('aria-expanded', 'false');
                    document.removeEventListener('click', outsideHandler);
                    document.removeEventListener('pointerdown', outsideHandler);
                  }
                };
                setTimeout(() => {
                  document.addEventListener('click', outsideHandler);
                  document.addEventListener('pointerdown', outsideHandler);
                }, 0);
              }
            });
            fieldTypeMenu.addEventListener('click', (e) => e.stopPropagation());
            
            fieldTypeWrapper.append(fieldTypeMenuBtn, fieldTypeMenu);

            const fieldRequiredLabel = document.createElement('span');
            fieldRequiredLabel.className = 'field-required-label';
            fieldRequiredLabel.textContent = 'Required';

            const fieldRequiredToggle = document.createElement('label');
            fieldRequiredToggle.className = 'switch field-required-switch';
            const fieldRequiredInput = document.createElement('input');
            fieldRequiredInput.type = 'checkbox';
            fieldRequiredInput.checked = !!safeField.required;
            fieldRequiredInput.setAttribute('aria-label', 'Toggle required field');
            const fieldRequiredSlider = document.createElement('span');
            fieldRequiredSlider.className = 'slider';
            fieldRequiredToggle.append(fieldRequiredInput, fieldRequiredSlider);

            const fieldRequiredRow = document.createElement('div');
            fieldRequiredRow.className = 'field-required-row';
            fieldRequiredRow.append(fieldRequiredLabel, fieldRequiredToggle);

            // Add name input for editable fields
            const fieldNameContainer = document.createElement('div');
            fieldNameContainer.className = 'field-name-editor';
            fieldNameContainer.hidden = true;
            const fieldNameLabel = document.createElement('label');
            fieldNameLabel.className = 'field-name-label';
            fieldNameLabel.textContent = 'Field Name';
            const fieldNameInput = document.createElement('input');
            fieldNameInput.type = 'text';
            fieldNameInput.className = 'field-name-input';
            fieldNameInput.placeholder = 'Enter field name';
            fieldNameInput.value = safeField.name || '';
            fieldNameLabel.appendChild(fieldNameInput);
            fieldNameContainer.appendChild(fieldNameLabel);
            editMenu.appendChild(fieldNameContainer);

            inlineControls.append(fieldRequiredRow, fieldTypeWrapper);

            let summaryUpdater = typeof initialSummaryUpdater === 'function' ? initialSummaryUpdater : ()=>{};
            const runSummaryUpdater = ()=>{
              try{
                summaryUpdater();
              }catch(err){}
            };
            const setSummaryUpdater = fn => {
              if(typeof fn === 'function'){
                summaryUpdater = fn;
              } else {
                summaryUpdater = ()=>{};
              }
            };

            const closeEditPanel = ()=>{
              if(editPanel.hidden) return;
              editPanel.hidden = true;
              editBtn.setAttribute('aria-expanded', 'false');
              if(hostElement && hostElement.classList){
                hostElement.classList.remove('field-edit-open');
              }
            };

            const handleFieldEditPointerDown = event => {
              if(hostElement && !hostElement.isConnected && !editPanel.isConnected){
                document.removeEventListener('pointerdown', handleFieldEditPointerDown, true);
                return;
              }
              if(editPanel.hidden){
                return;
              }
              const target = event.target;
              if(editPanel.contains(target)){
                return;
              }
              const clickedEditBtn = target.closest('.category-edit-btn, .subcategory-edit-btn, .field-edit-btn');
              if(clickedEditBtn){
                return;
              }
              closeEditPanel();
            };

            document.addEventListener('pointerdown', handleFieldEditPointerDown, true);

            const updateRequiredState = nextRequired => {
              const next = !!nextRequired;
              if(next === !!safeField.required) return;
              safeField.required = next;
              notifyFormbuilderChange();
              renderFormPreview();
              runSummaryUpdater();
            };

            fieldRequiredInput.addEventListener('change', ()=>{
              updateRequiredState(fieldRequiredInput.checked);
            });

            const dropdownOptionsContainer = document.createElement('div');
            dropdownOptionsContainer.className = 'dropdown-options-editor';
            const dropdownOptionsLabel = document.createElement('div');
            dropdownOptionsLabel.className = 'dropdown-options-label';
            dropdownOptionsLabel.textContent = 'Field Options';
            const dropdownOptionsList = document.createElement('div');
            dropdownOptionsList.className = 'dropdown-options-list';
            dropdownOptionsContainer.append(dropdownOptionsLabel, dropdownOptionsList);

            if(attachDropdownToPanel === true){
              editMenu.append(dropdownOptionsContainer);
            }

            let draggedOptionRow = null;

            const ensureDropdownSeeds = ()=>{
              if(!Array.isArray(safeField.options)){
                safeField.options = [];
              }
              const fieldTypeKey = safeField.fieldTypeKey || safeField.key || '';
              if((fieldTypeKey === 'dropdown' || fieldTypeKey === 'radio')){
                // Check if options are empty or only have empty strings
                const hasNonEmptyOptions = safeField.options.some(opt => opt && typeof opt === 'string' && opt.trim() !== '');
                if(!hasNonEmptyOptions){
                  // Try to get placeholder from field type to seed options
                  const matchingFieldType = FORM_FIELD_TYPES.find(opt => opt.value === fieldTypeKey);
                  if(matchingFieldType && matchingFieldType.placeholder){
                    // Parse placeholder like "A,B,C" or "1A,2A,3A" into array
                    const placeholderStr = matchingFieldType.placeholder.trim();
                    if(placeholderStr){
                      const parsed = placeholderStr.split(',').map(s => s.trim()).filter(s => s);
                      if(parsed.length > 0){
                        safeField.options = parsed;
                      } else {
                safeField.options.push('', '', '');
                      }
                    } else {
                      safeField.options.push('', '', '');
                    }
                  } else {
                    safeField.options.push('', '', '');
                  }
                notifyFormbuilderChange();
                }
              }
            };

            const renderDropdownOptions = (focusIndex = null)=>{
              // Use fieldTypeKey/key for field type identification (not type which is for HTML input type)
              const fieldTypeKey = safeField.fieldTypeKey || safeField.key || '';
              const isOptionsType = fieldTypeKey === 'dropdown' || fieldTypeKey === 'radio';
              if(!isOptionsType){
                dropdownOptionsList.innerHTML = '';
                return;
              }
              ensureDropdownSeeds();
              dropdownOptionsList.innerHTML = '';
              safeField.options.forEach((optionValue, optionIndex)=>{
                const optionText = typeof optionValue === 'string'
                  ? optionValue
                  : (optionValue && typeof optionValue === 'object' && typeof optionValue.version === 'string'
                    ? optionValue.version
                    : '');
                const optionRow = document.createElement('div');
                optionRow.className = 'dropdown-option-row';
                optionRow.draggable = true;
                optionRow._optionValue = safeField.options[optionIndex];

                const optionInput = document.createElement('input');
                optionInput.type = 'text';
                optionInput.className = 'dropdown-option-input';
                optionInput.placeholder = 'Enter option text';
                optionInput.value = optionText;
                // Prevent clicks on input from opening edit panel
                optionInput.addEventListener('click', (e) => {
                  e.stopPropagation();
                });
                optionInput.addEventListener('mousedown', (e) => {
                  e.stopPropagation();
                });
                optionInput.addEventListener('input', ()=>{
                  safeField.options[optionIndex] = optionInput.value;
                  optionRow._optionValue = optionInput.value;
                  notifyFormbuilderChange();
                  renderFormPreview();
                });

                const actions = document.createElement('div');
                actions.className = 'dropdown-option-actions';

                const addOptionBtn = document.createElement('button');
                addOptionBtn.type = 'button';
                addOptionBtn.className = 'dropdown-option-add';
                addOptionBtn.textContent = '+';
                addOptionBtn.setAttribute('aria-label', `Add option after this one`);
                // Prevent clicks on button from opening edit panel
                addOptionBtn.addEventListener('click', (e)=>{
                  e.stopPropagation();
                  safeField.options.splice(optionIndex + 1, 0, '');
                  notifyFormbuilderChange();
                  renderDropdownOptions(optionIndex + 1);
                  renderFormPreview();
                });

                const removeOptionBtn = document.createElement('button');
                removeOptionBtn.type = 'button';
                removeOptionBtn.className = 'dropdown-option-remove';
                removeOptionBtn.textContent = '-';
                removeOptionBtn.setAttribute('aria-label', `Remove Option ${optionIndex + 1}`);
                // Prevent clicks on button from opening edit panel
                removeOptionBtn.addEventListener('click', (e)=>{
                  e.stopPropagation();
                  if(safeField.options.length <= 1){
                    safeField.options[0] = '';
                  } else {
                    safeField.options.splice(optionIndex, 1);
                  }
                  notifyFormbuilderChange();
                  const nextFocus = Math.min(optionIndex, Math.max(safeField.options.length - 1, 0));
                  renderDropdownOptions(nextFocus);
                  renderFormPreview();
                });

                actions.append(addOptionBtn, removeOptionBtn);
                optionRow.append(optionInput, actions);

                optionRow.addEventListener('dragstart', event=>{
                  const origin = event.target;
                  const tagName = origin && origin.tagName ? origin.tagName.toLowerCase() : '';
                  if(tagName === 'input' || tagName === 'button'){
                    event.preventDefault();
                    return;
                  }
                  draggedOptionRow = optionRow;
                  optionRow.classList.add('is-dragging');
                  if(event.dataTransfer){
                    event.dataTransfer.effectAllowed = 'move';
                    try{ event.dataTransfer.setData('text/plain', optionInput.value || 'Option'); }catch(err){}
                    try{
                      const rect = optionRow.getBoundingClientRect();
                      event.dataTransfer.setDragImage(optionRow, rect.width / 2, rect.height / 2);
                    }catch(err){}
                  }
                });

                optionRow.addEventListener('dragend', ()=>{
                  optionRow.classList.remove('is-dragging');
                  draggedOptionRow = null;
                });

                dropdownOptionsList.appendChild(optionRow);

                if(focusIndex === optionIndex){
                  requestAnimationFrame(()=>{
                    try{ optionInput.focus({ preventScroll: true }); }
                    catch(err){
                      try{ optionInput.focus(); }catch(e){}
                    }
                  });
                }
              });
            };

            const getDragAfterOption = mouseY => {
              const rows = Array.from(dropdownOptionsList.querySelectorAll('.dropdown-option-row')).filter(row => row !== draggedOptionRow);
              let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
              rows.forEach(row => {
                const rect = row.getBoundingClientRect();
                const offset = mouseY - (rect.top + rect.height / 2);
                if(offset < 0 && offset > closest.offset){
                  closest = { offset, element: row };
                }
              });
              return closest.element;
            };

            dropdownOptionsList.addEventListener('dragover', event=>{
              if(!draggedOptionRow) return;
              event.preventDefault();
              if(event.dataTransfer){
                event.dataTransfer.dropEffect = 'move';
              }
              const afterElement = getDragAfterOption(event.clientY);
              if(!afterElement){
                dropdownOptionsList.appendChild(draggedOptionRow);
              } else if(afterElement !== draggedOptionRow){
                dropdownOptionsList.insertBefore(draggedOptionRow, afterElement);
              }
            });

            dropdownOptionsList.addEventListener('drop', event=>{
              if(!draggedOptionRow) return;
              event.preventDefault();
              const orderedValues = Array.from(dropdownOptionsList.querySelectorAll('.dropdown-option-row')).map(row => (
                row && Object.prototype.hasOwnProperty.call(row, '_optionValue') ? row._optionValue : ''
              ));
              safeField.options.splice(0, safeField.options.length, ...orderedValues);
              if(draggedOptionRow){
                draggedOptionRow.classList.remove('is-dragging');
                draggedOptionRow = null;
              }
              notifyFormbuilderChange();
              renderDropdownOptions();
              renderFormPreview();
            });

            const updateFieldEditorsByType = ()=>{
              const type = safeField.type || safeField.fieldTypeKey || safeField.key || '';
              // Use fieldTypeKey/key for field type identification (not type which is for HTML input type)
              // Get fieldTypeKey from the current fieldTypeMenuBtn value if available, otherwise from safeField
              const selectedValue = fieldTypeMenuBtn ? (fieldTypeMenuBtn.dataset.value || '') : '';
              const fieldTypeKey = selectedValue || safeField.fieldTypeKey || safeField.key || safeField.type || '';
              const isOptionsType = fieldTypeKey === 'dropdown' || fieldTypeKey === 'radio';
              const showVariantPricing = fieldTypeKey === 'variant-pricing';
              const showVenueSession = fieldTypeKey === 'venue-ticketing';
              // Check if this field type is editable - must have a valid fieldTypeKey
              let isEditable = false;
              if(fieldTypeKey && fieldTypeKey !== ''){
                const matchingFieldType = FORM_FIELD_TYPES.find(ft => ft.value === fieldTypeKey);
                isEditable = matchingFieldType && matchingFieldType.formbuilder_editable === true;
              }
              fieldNameContainer.hidden = !isEditable;
              if(type === 'images'){
                if(safeField.placeholder){
                  safeField.placeholder = '';
                  notifyFormbuilderChange();
                }
              } else if(showVenueSession && safeField.placeholder){
                safeField.placeholder = '';
                notifyFormbuilderChange();
              }
              dropdownOptionsContainer.hidden = !isOptionsType;
              if(showVenueSession){
                safeField.options = normalizeVenueSessionOptions(safeField.options);
              } else if(showVariantPricing){
                if(!Array.isArray(safeField.options) || safeField.options.length === 0){
                  safeField.options = [{ version: '', currency: '', price: '' }];
                  notifyFormbuilderChange();
                } else {
                  safeField.options = safeField.options.map(opt => {
                    if(opt && typeof opt === 'object'){
                      return {
                        version: typeof opt.version === 'string' ? opt.version : '',
                        currency: typeof opt.currency === 'string' ? opt.currency : '',
                        price: typeof opt.price === 'string' ? opt.price : ''
                      };
                    }
                    const str = typeof opt === 'string' ? opt : String(opt ?? '');
                    return { version: str, currency: '', price: '' };
                  });
                }
              }
              if(type === 'dropdown'){
                dropdownOptionsLabel.textContent = 'Dropdown Options';
              } else if(type === 'radio'){
                dropdownOptionsLabel.textContent = 'Radio Options';
              } else {
                dropdownOptionsLabel.textContent = 'Field Options';
              }
              if(isOptionsType){
                if(!Array.isArray(safeField.options) || safeField.options.length === 0){
                  safeField.options = ['', '', ''];
                  notifyFormbuilderChange();
                }
                renderDropdownOptions();
              } else if(!showVariantPricing && !showVenueSession){
                dropdownOptionsList.innerHTML = '';
              } else if(showVenueSession){
                dropdownOptionsList.innerHTML = '';
              }
              if(type === 'location'){
                if(!safeField.placeholder || !safeField.placeholder.trim()){
                  const defaultPlaceholder = 'Search for a location';
                  safeField.placeholder = defaultPlaceholder;
                }
                if(!safeField.location || typeof safeField.location !== 'object'){
                  safeField.location = { address: '', latitude: '', longitude: '' };
                } else {
                  if(typeof safeField.location.address !== 'string') safeField.location.address = '';
                  if(typeof safeField.location.latitude !== 'string') safeField.location.latitude = '';
                  if(typeof safeField.location.longitude !== 'string') safeField.location.longitude = '';
                }
              }
              runSummaryUpdater();
            };


            // Wire up name input for editable fields - only update on blur, not on every keystroke
            // Don't call notifyFormbuilderChange() here as it triggers member form refresh
            // The formbuilder will be marked dirty when the form is saved
            fieldNameInput.addEventListener('blur', ()=>{
              const newName = fieldNameInput.value.trim();
              if(safeField.name !== newName){
                safeField.name = newName;
                // Only update preview and summary, don't trigger formbuilder change event
                // which causes member forms to refresh
                renderFormPreview();
                runSummaryUpdater();
              }
            });

            updateFieldEditorsByType();

            const openEditPanel = ()=>{
              if(!editPanel.hidden) return;
              editPanel.hidden = false;
              editBtn.setAttribute('aria-expanded', 'true');
              if(hostElement && hostElement.classList){
                hostElement.classList.add('field-edit-open');
              }
              // Update field editors to show/hide name input for editable fields
              // Force update to ensure fieldTypeKey is checked
              updateFieldEditorsByType();
              // Double-check after a brief delay to catch any async updates
              requestAnimationFrame(()=>{
                updateFieldEditorsByType();
                try{
                  if(fieldTypeMenuBtn && typeof fieldTypeMenuBtn.focus === 'function'){
                    fieldTypeMenuBtn.focus({ preventScroll: true });
                  }
                }catch(err){
                  try{ 
                    if(fieldTypeMenuBtn && typeof fieldTypeMenuBtn.focus === 'function'){
                      fieldTypeMenuBtn.focus(); 
                    }
                  }catch(e){}
                }
              });
            };

            editBtn.addEventListener('click', event=>{
              event.stopPropagation();
              document.querySelectorAll('.category-edit-panel, .subcategory-edit-panel').forEach(panel => {
                if(panel !== editPanel){
                  panel.hidden = true;
                }
              });
              closeFieldEditPanels({ exceptPanel: editPanel, exceptButton: editBtn });
              if(editPanel.hidden){
                openEditPanel();
              } else {
                closeEditPanel();
              }
            });

            let deleteHandler = null;

            const saveFieldBtn = document.createElement('button');
            saveFieldBtn.type = 'button';
            saveFieldBtn.className = 'save-changes primary-action formbuilder-inline-save';
            saveFieldBtn.textContent = 'Save';
            saveFieldBtn.setAttribute('aria-label', 'Save changes');
            saveFieldBtn.addEventListener('click', (e)=>{
              e.preventDefault();
              e.stopPropagation();
              if(typeof window.adminPanelModule?.runSave === 'function'){
                window.adminPanelModule.runSave({ closeAfter:false });
              }
              editPanel.hidden = true;
              editBtn.setAttribute('aria-expanded', 'false');
            });
            
            const saveFieldRow = document.createElement('div');
            saveFieldRow.className = 'formbuilder-save-row';
            saveFieldRow.append(saveFieldBtn);

            const deleteFieldBtn = document.createElement('button');
            deleteFieldBtn.type = 'button';
            deleteFieldBtn.className = 'delete-category-btn delete-field-btn';
            deleteFieldBtn.textContent = 'Delete Field';
            deleteFieldBtn.setAttribute('aria-label', 'Delete field');
            deleteFieldBtn.addEventListener('click', async event=>{
              event.preventDefault();
              event.stopPropagation();
              const handler = deleteHandler || (typeof safeField.__handleDeleteField === 'function'
                ? safeField.__handleDeleteField
                : null);
              if(typeof handler === 'function'){
                try{
                  await handler();
                }catch(err){}
              }
            });
            const deleteFieldRow = document.createElement('div');
            deleteFieldRow.className = 'formbuilder-delete-row';
            deleteFieldRow.append(deleteFieldBtn);

            editMenu.append(saveFieldRow, deleteFieldRow);

            const destroy = ()=>{
              document.removeEventListener('pointerdown', handleFieldEditPointerDown, true);
            };

            const setDeleteHandler = handler => {
              if(typeof handler === 'function'){
                deleteHandler = handler;
                safeField.__handleDeleteField = handler;
              } else {
                deleteHandler = null;
                if(Object.prototype.hasOwnProperty.call(safeField, '__handleDeleteField')){
                  delete safeField.__handleDeleteField;
                }
              }
            };

            return {
              editBtn,
              editPanel,
              editMenu,
              inlineControls,
              fieldTypeMenuBtn,
              fieldRequiredInput,
              dropdownOptionsContainer,
              dropdownOptionsList,
              deleteFieldBtn,
              closeEditPanel,
              openEditPanel,
              setSummaryUpdater,
              runSummaryUpdater,
              updateFieldEditorsByType,
              destroy,
              setDeleteHandler
            };
          };

          let formPreviewFieldIdCounter = 0;
          function renderFormPreview(){
            formPreviewFields.innerHTML = '';
            
            const categorySubcategoryLabel = document.createElement('div');
            categorySubcategoryLabel.className = 'form-preview-category-label';
            categorySubcategoryLabel.textContent = `${c.name} > ${sub}`;
            categorySubcategoryLabel.style.marginBottom = '12px';
            categorySubcategoryLabel.style.fontSize = '14px';
            categorySubcategoryLabel.style.fontWeight = '600';
            categorySubcategoryLabel.style.color = 'var(--button-text)';
            formPreviewFields.appendChild(categorySubcategoryLabel);
            
            if(!fields.length){
              const empty = document.createElement('p');
              empty.className = 'form-preview-empty';
              empty.textContent = 'No fields added yet.';
              formPreviewFields.appendChild(empty);
              return;
            }
            fields.forEach((fieldData, previewIndex)=>{
              const previewField = ensureFieldDefaults(fieldData);
              const wrapper = document.createElement('div');
              wrapper.className = 'panel-field form-preview-field';
              const baseId = `${formPreviewId}-field-${++formPreviewFieldIdCounter}`;
              const labelText = previewField.name.trim() || `Field ${previewIndex + 1}`;
              const labelEl = document.createElement('span');
              labelEl.className = 'subcategory-form-label';
              labelEl.textContent = labelText;
              const labelId = `${baseId}-label`;
              labelEl.id = labelId;
              let control = null;
              const baseType = getBaseFieldType(previewField.type);
              if(baseType === 'text-area' || baseType === 'description'){
                const textarea = document.createElement('textarea');
                textarea.rows = 5;
                textarea.readOnly = false;
                textarea.tabIndex = 0;
                // Make editable but prevent any form submission or member form linking
                textarea.addEventListener('change', (e) => {
                  e.stopPropagation();
                });
                textarea.addEventListener('input', (e) => {
                  e.stopPropagation();
                });
                textarea.placeholder = previewField.placeholder || '';
                textarea.className = 'form-preview-textarea';
                textarea.style.resize = 'vertical';
                const textareaId = `${baseId}-input`;
                textarea.id = textareaId;
                if(baseType === 'description'){
                  textarea.classList.add('form-preview-description');
                }
                control = textarea;
              } else if(previewField.type === 'dropdown'){
                wrapper.classList.add('form-preview-field--dropdown');
                const dropdownWrapper = document.createElement('div');
                dropdownWrapper.className = 'options-dropdown';
                const menuBtn = document.createElement('button');
                menuBtn.type = 'button';
                menuBtn.className = 'form-preview-select';
                menuBtn.setAttribute('aria-haspopup', 'true');
                menuBtn.setAttribute('aria-expanded', 'false');
                const selectId = `${baseId}-input`;
                menuBtn.id = selectId;
                const menuId = `${selectId}-menu`;
                menuBtn.setAttribute('aria-controls', menuId);
                const options = Array.isArray(previewField.options) ? previewField.options : [];
                const defaultText = options.length > 0 ? options[0].trim() || 'Select an option' : 'Select an option';
                menuBtn.textContent = defaultText;
                const arrow = document.createElement('span');
                arrow.className = 'dropdown-arrow';
                arrow.setAttribute('aria-hidden', 'true');
                menuBtn.appendChild(arrow);
                const optionsMenu = document.createElement('div');
                optionsMenu.className = 'options-menu';
                optionsMenu.id = menuId;
                optionsMenu.hidden = true;
                if(options.length){
                  options.forEach((optionValue, optionIndex)=>{
                    const optionBtn = document.createElement('button');
                    optionBtn.type = 'button';
                    optionBtn.className = 'menu-option';
                    const stringValue = typeof optionValue === 'string' ? optionValue : String(optionValue ?? '');
                    optionBtn.textContent = stringValue.trim() || '';
                    optionBtn.dataset.value = stringValue;
                    optionBtn.addEventListener('click', (e) => {
                      e.stopPropagation();
                menuBtn.textContent = stringValue.trim() || 'Select an option';
                optionsMenu.hidden = true;
                      menuBtn.setAttribute('aria-expanded', 'false');
                    });
                    optionsMenu.appendChild(optionBtn);
                  });
                } else {
                  const placeholderBtn = document.createElement('button');
                  placeholderBtn.type = 'button';
                  placeholderBtn.className = 'menu-option';
                  placeholderBtn.textContent = 'Select an option';
                  placeholderBtn.disabled = true;
                  optionsMenu.appendChild(placeholderBtn);
                }
                menuBtn.addEventListener('click', (e) => {
                  e.stopPropagation();
                  const open = !optionsMenu.hasAttribute('hidden');
                  if(open){
                    optionsMenu.hidden = true;
                    menuBtn.setAttribute('aria-expanded', 'false');
                  } else {
                    optionsMenu.hidden = false;
                    menuBtn.setAttribute('aria-expanded', 'true');
                    const outsideHandler = (ev) => {
                      if(!ev.target.closest(dropdownWrapper)){
                        optionsMenu.hidden = true;
                        menuBtn.setAttribute('aria-expanded', 'false');
                        document.removeEventListener('click', outsideHandler);
                        document.removeEventListener('pointerdown', outsideHandler);
                      }
                    };
                    setTimeout(() => {
                      document.addEventListener('click', outsideHandler);
                      document.addEventListener('pointerdown', outsideHandler);
                    }, 0);
                  }
                });
                optionsMenu.addEventListener('click', (e) => e.stopPropagation());
                dropdownWrapper.appendChild(menuBtn);
                dropdownWrapper.appendChild(optionsMenu);
                control = dropdownWrapper;
              } else if(previewField.type === 'radio'){
                const options = Array.isArray(previewField.options) ? previewField.options : [];
                const radioGroup = document.createElement('div');
                radioGroup.className = 'form-preview-radio-group';
                wrapper.classList.add('form-preview-field--radio-toggle');
                const groupName = `${baseId}-radio`;
                if(options.length){
                  options.forEach((optionValue, optionIndex)=>{
                    const radioLabel = document.createElement('label');
                    radioLabel.className = 'form-preview-radio-option';
                    const radio = document.createElement('input');
                    radio.type = 'radio';
                    radio.name = groupName;
                    const stringValue = typeof optionValue === 'string' ? optionValue : String(optionValue ?? '');
                    radio.value = stringValue;
                    radio.tabIndex = 0;
                    radio.disabled = false;
                    // Prevent form preview radio from triggering member form actions
                    radio.addEventListener('change', (e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    });
                    radio.addEventListener('click', (e) => {
                      e.stopPropagation();
                    });
                    radio.addEventListener('mousedown', (e) => {
                      e.stopPropagation();
                    });
                    // Also prevent on the label wrapper
                    radioLabel.addEventListener('click', (e) => {
                      e.stopPropagation();
                    });
                    radioLabel.addEventListener('mousedown', (e) => {
                      e.stopPropagation();
                    });
                    // Use the actual option value, don't fall back to "Option X"
                    const radioText = document.createElement('span');
                    radioText.textContent = stringValue.trim() || '';
                    radioLabel.append(radio, radioText);
                    radioGroup.appendChild(radioLabel);
                  });
                } else {
                  const placeholderOption = document.createElement('label');
                  placeholderOption.className = 'form-preview-radio-option';
                  const radio = document.createElement('input');
                  radio.type = 'radio';
                  radio.tabIndex = -1;
                  radio.disabled = true;
                  placeholderOption.append(radio, document.createTextNode('Option'));
                  radioGroup.appendChild(placeholderOption);
                }
                control = radioGroup;
              } else if(previewField.type === 'venue-ticketing'){
                wrapper.classList.add('form-preview-field--venues-sessions-pricing');
                control = buildVenueSessionPreview(previewField, baseId);
              } else if(previewField.type === 'variant-pricing'){
                wrapper.classList.add('form-preview-field--variant-pricing');
                const editor = document.createElement('div');
                editor.className = 'form-preview-variant-pricing variant-pricing-options-editor';
                const versionList = document.createElement('div');
                versionList.className = 'variant-pricing-options-list';
                editor.appendChild(versionList);

                const createEmptyOption = ()=>({ version: '', currency: '', price: '' });

                const normalizeOptions = ()=>{
                  if(!Array.isArray(previewField.options)){
                    previewField.options = [];
                  }
                  previewField.options = previewField.options.map(opt => {
                    if(opt && typeof opt === 'object'){
                      return {
                        version: typeof opt.version === 'string' ? opt.version : '',
                        currency: typeof opt.currency === 'string' ? opt.currency : '',
                        price: typeof opt.price === 'string' ? opt.price : ''
                      };
                    }
                    const str = typeof opt === 'string' ? opt : String(opt ?? '');
                    return { version: str, currency: '', price: '' };
                  });
                  if(previewField.options.length === 0){
                    previewField.options.push(createEmptyOption());
                  }
                };

                const renderVersionEditor = (focusIndex = null, focusTarget = 'version')=>{
                  normalizeOptions();
                  versionList.innerHTML = '';
                  let firstId = null;
                  const currencyAlertMessage = 'Please select a currency before entering a price.';
                  let lastCurrencyAlertAt = 0;
                  let currencyAlertHandle = null;
                  let currencyAlertTimeout = 0;
                  const showCurrencyAlert = target => {
                    const candidate = (target && typeof target.getBoundingClientRect === 'function')
                      ? target
                      : ((document && document.activeElement && typeof document.activeElement.getBoundingClientRect === 'function')
                        ? document.activeElement
                        : null);
                    const inputEl = candidate && document.body && document.body.contains(candidate) ? candidate : null;
                    if(!inputEl) return;
                    const now = Date.now();
                    if(now - lastCurrencyAlertAt < 400){
                      if(currencyAlertHandle && typeof currencyAlertHandle.reposition === 'function'){
                        currencyAlertHandle.reposition();
                      }
                      return;
                    }
                    lastCurrencyAlertAt = now;
                    if(currencyAlertTimeout){
                      clearTimeout(currencyAlertTimeout);
                      currencyAlertTimeout = 0;
                    }
                    if(currencyAlertHandle && typeof currencyAlertHandle.remove === 'function'){
                      currencyAlertHandle.remove();
                      currencyAlertHandle = null;
                    }
                    const handle = showCopyStyleMessage(currencyAlertMessage, inputEl);
                    if(!handle) return;
                    currencyAlertHandle = handle;
                    currencyAlertTimeout = window.setTimeout(()=>{
                      handle.remove();
                      if(currencyAlertHandle === handle){
                        currencyAlertHandle = null;
                      }
                      currencyAlertTimeout = 0;
                    }, 1500);
                  };
                  previewField.options.forEach((optionValue, optionIndex)=>{
                    const optionRow = document.createElement('div');
                    optionRow.className = 'variant-pricing-option';
                    optionRow.dataset.optionIndex = String(optionIndex);

                    const topRow = document.createElement('div');
                    topRow.className = 'variant-pricing-row variant-pricing-row--top';

                    const versionInput = document.createElement('input');
                    versionInput.type = 'text';
                    versionInput.className = 'variant-pricing-name';
                    versionInput.placeholder = 'Version Name';
                    const versionInputId = `${baseId}-version-${optionIndex}`;
                    versionInput.id = versionInputId;
                    if(optionIndex === 0){
                      firstId = versionInputId;
                    }
                    versionInput.value = optionValue.version || '';
                    versionInput.addEventListener('input', ()=>{
                      previewField.options[optionIndex].version = versionInput.value;
                      notifyFormbuilderChange();
                    });
                    topRow.appendChild(versionInput);

                    const bottomRow = document.createElement('div');
                    bottomRow.className = 'variant-pricing-row variant-pricing-row--bottom';

                    const currencyWrapper = document.createElement('div');
                    currencyWrapper.className = 'options-dropdown';
                    const currencyMenuBtn = document.createElement('button');
                    currencyMenuBtn.type = 'button';
                    currencyMenuBtn.className = 'variant-pricing-currency';
                    currencyMenuBtn.setAttribute('aria-haspopup', 'true');
                    currencyMenuBtn.setAttribute('aria-expanded', 'false');
                    const currencyMenuId = `variant-currency-${baseId}-${optionIndex}`;
                    currencyMenuBtn.setAttribute('aria-controls', currencyMenuId);
                    const existingCurrency = optionValue.currency || '';
                    currencyMenuBtn.textContent = existingCurrency || 'Currency';
                    currencyMenuBtn.dataset.value = existingCurrency;
                    const currencyArrow = document.createElement('span');
                    currencyArrow.className = 'dropdown-arrow';
                    currencyArrow.setAttribute('aria-hidden', 'true');
                    currencyMenuBtn.appendChild(currencyArrow);
                    const currencyMenu = document.createElement('div');
                    currencyMenu.className = 'options-menu';
                    currencyMenu.id = currencyMenuId;
                    currencyMenu.hidden = true;
                    const placeholderBtn = document.createElement('button');
                    placeholderBtn.type = 'button';
                    placeholderBtn.className = 'menu-option';
                    placeholderBtn.textContent = 'Currency';
                    placeholderBtn.dataset.value = '';
                    placeholderBtn.addEventListener('click', (e) => {
                      e.stopPropagation();
                      currencyMenuBtn.textContent = 'Currency';
                      currencyMenuBtn.dataset.value = '';
                      currencyMenu.hidden = true;
                      currencyMenuBtn.setAttribute('aria-expanded', 'false');
                      const previousCurrency = previewField.options[optionIndex].currency || '';
                      previewField.options[optionIndex].currency = '';
                      const priceCleared = updatePriceState();
                      if(previousCurrency !== '' || priceCleared){
                        notifyFormbuilderChange();
                      }
                    });
                    currencyMenu.appendChild(placeholderBtn);
                    const currencyOptions = Array.isArray(window.currencyCodes) ? window.currencyCodes : [];
                    currencyOptions.forEach(code => {
                      const optionBtn = document.createElement('button');
                      optionBtn.type = 'button';
                      optionBtn.className = 'menu-option';
                      optionBtn.textContent = code;
                      optionBtn.dataset.value = code;
                      optionBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        currencyMenuBtn.textContent = code;
                        currencyMenuBtn.dataset.value = code;
                        currencyMenu.hidden = true;
                        currencyMenuBtn.setAttribute('aria-expanded', 'false');
                        const previousCurrency = previewField.options[optionIndex].currency || '';
                        previewField.options[optionIndex].currency = code;
                        const priceCleared = updatePriceState();
                        if(isCurrencySelected()){
                          commitPriceValue();
                        }
                        if(previousCurrency !== code || priceCleared){
                          notifyFormbuilderChange();
                        }
                      });
                      currencyMenu.appendChild(optionBtn);
                    });
                    currencyMenuBtn.addEventListener('click', (e) => {
                      e.stopPropagation();
                      const open = !currencyMenu.hasAttribute('hidden');
                      if(open){
                        currencyMenu.hidden = true;
                        currencyMenuBtn.setAttribute('aria-expanded', 'false');
                      } else {
                        currencyMenu.hidden = false;
                        currencyMenuBtn.setAttribute('aria-expanded', 'true');
                        const outsideHandler = (ev) => {
                          if(!ev.target.closest(currencyWrapper)){
                            currencyMenu.hidden = true;
                            currencyMenuBtn.setAttribute('aria-expanded', 'false');
                            document.removeEventListener('click', outsideHandler);
                            document.removeEventListener('pointerdown', outsideHandler);
                          }
                        };
                        setTimeout(() => {
                          document.addEventListener('click', outsideHandler);
                          document.addEventListener('pointerdown', outsideHandler);
                        }, 0);
                      }
                    });
                    currencyMenu.addEventListener('click', (e) => e.stopPropagation());
                    currencyWrapper.appendChild(currencyMenuBtn);
                    currencyWrapper.appendChild(currencyMenu);
                    const currencySelect = currencyMenuBtn; // Keep reference for isCurrencySelected
                    const isCurrencySelected = ()=> (currencyMenuBtn.dataset.value || '').trim() !== '';

                    const priceInput = document.createElement('input');
                    priceInput.type = 'text';
                    priceInput.inputMode = 'decimal';
                    priceInput.pattern = '[0-9]+([\.,][0-9]{0,2})?';
                    priceInput.className = 'variant-pricing-price';
                    priceInput.placeholder = '0.00';
                    const sanitizePriceValue = value => (value || '').replace(/[^0-9.,]/g, '');
                    const formatPriceValue = value => {
                      const trimmed = (value || '').trim();
                      if(trimmed === '') return '';
                      let normalized = trimmed.replace(/,/g, '.');
                      if(normalized === '.') return '0.00';
                      if(normalized.startsWith('.')){
                        normalized = `0${normalized}`;
                      }
                      const dotIndex = normalized.indexOf('.');
                      if(dotIndex === -1){
                        return `${normalized}.00`;
                      }
                      let integerPart = normalized.slice(0, dotIndex).replace(/\./g, '');
                      if(integerPart === ''){
                        integerPart = '0';
                      }
                      let decimalPart = normalized.slice(dotIndex + 1).replace(/\./g, '');
                      if(decimalPart.length === 0){
                        decimalPart = '00';
                      } else if(decimalPart.length === 1){
                        decimalPart = `${decimalPart}0`;
                      } else {
                        decimalPart = decimalPart.slice(0, 2);
                      }
                      return `${integerPart}.${decimalPart}`;
                    };
                    const initialPriceValue = sanitizePriceValue(optionValue.price || '');
                    const formattedInitialPrice = formatPriceValue(initialPriceValue);
                    priceInput.value = formattedInitialPrice;
                    if(formattedInitialPrice !== (previewField.options[optionIndex].price || '')){
                      previewField.options[optionIndex].price = formattedInitialPrice;
                    }
                    const clearPriceValue = ()=>{
                      let changed = false;
                      if(priceInput.value !== ''){
                        priceInput.value = '';
                        changed = true;
                      }
                      if(previewField.options[optionIndex].price !== ''){
                        previewField.options[optionIndex].price = '';
                        changed = true;
                      } else if(typeof previewField.options[optionIndex].price !== 'string'){
                        previewField.options[optionIndex].price = '';
                      }
                      return changed;
                    };
                    const updatePriceState = ()=>{
                      if(isCurrencySelected()){
                        priceInput.readOnly = false;
                        priceInput.classList.remove('is-awaiting-currency');
                        priceInput.removeAttribute('aria-disabled');
                        return false;
                      }
                      priceInput.readOnly = true;
                      priceInput.classList.add('is-awaiting-currency');
                      priceInput.setAttribute('aria-disabled', 'true');
                      return clearPriceValue();
                    };
                    const blockPriceAccess = event => {
                      if(isCurrencySelected()) return false;
                      if(event && event.type === 'pointerdown' && event.button !== 0) return false;
                      if(event && typeof event.preventDefault === 'function'){
                        event.preventDefault();
                      }
                      if(event && typeof event.stopPropagation === 'function'){
                        event.stopPropagation();
                      }
                      if(typeof priceInput.blur === 'function'){
                        requestAnimationFrame(()=>{
                          try{ priceInput.blur(); }catch(err){}
                        });
                      }
                      showCurrencyAlert(priceInput);
                      return true;
                    };
                    // Currency change is now handled in the menu option click handlers above

                    const commitPriceValue = event => {
                      if(!isCurrencySelected()){
                        if(clearPriceValue()){
                          notifyFormbuilderChange();
                        }
                        return;
                      }
                      const rawValue = priceInput.value;
                      const sanitized = sanitizePriceValue(rawValue);
                      if(rawValue !== sanitized){
                        priceInput.value = sanitized;
                      }
                      const formatted = formatPriceValue(sanitized);
                      if(priceInput.value !== formatted){
                        priceInput.value = formatted;
                      }
                      if(event && document.activeElement === priceInput && typeof priceInput.setSelectionRange === 'function'){
                        if(formatted === ''){
                          priceInput.setSelectionRange(0, 0);
                        } else if(!/[.,]/.test(sanitized)){ 
                          const dotIndex = formatted.indexOf('.');
                          const caretPos = dotIndex === -1 ? formatted.length : Math.min(sanitized.length, dotIndex);
                          priceInput.setSelectionRange(caretPos, caretPos);
                        } else {
                          const dotIndex = formatted.indexOf('.');
                          if(dotIndex === -1){
                            priceInput.setSelectionRange(formatted.length, formatted.length);
                          } else {
                            const decimals = sanitized.split(/[.,]/)[1] || '';
                            if(decimals.length === 0){
                              priceInput.setSelectionRange(dotIndex + 1, formatted.length);
                            } else {
                              const caretPos = Math.min(dotIndex + 1 + decimals.length, formatted.length);
                              priceInput.setSelectionRange(caretPos, caretPos);
                            }
                          }
                        }
                      }
                      const previous = previewField.options[optionIndex].price || '';
                      if(previous !== formatted){
                        previewField.options[optionIndex].price = formatted;
                        notifyFormbuilderChange();
                      }
                    };
                    priceInput.addEventListener('beforeinput', event => {
                      if(event && typeof event.data === 'string' && /[^0-9.,]/.test(event.data)){
                        event.preventDefault();
                      }
                    });
                    priceInput.addEventListener('pointerdown', event => {
                      blockPriceAccess(event);
                    });
                    priceInput.addEventListener('focus', event => {
                      blockPriceAccess(event);
                    });
                    priceInput.addEventListener('keydown', event => {
                      if(event.key === 'Tab' || event.key === 'Shift') return;
                      if(blockPriceAccess(event)) return;
                    });
                    priceInput.addEventListener('input', commitPriceValue);
                    priceInput.addEventListener('change', commitPriceValue);
                    const initialCleared = updatePriceState();
                    if(isCurrencySelected()){
                      commitPriceValue();
                    } else if(initialCleared){
                      notifyFormbuilderChange();
                    }

                    const actions = document.createElement('div');
                    actions.className = 'dropdown-option-actions variant-pricing-option-actions';

                    const addBtn = document.createElement('button');
                    addBtn.type = 'button';
                    addBtn.className = 'dropdown-option-add';
                    addBtn.textContent = '+';
                    addBtn.setAttribute('aria-label', `Add version after Version ${optionIndex + 1}`);
                    addBtn.addEventListener('click', ()=>{
                      previewField.options.splice(optionIndex + 1, 0, createEmptyOption());
                      notifyFormbuilderChange();
                      renderVersionEditor(optionIndex + 1);
                    });

                    const removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = 'dropdown-option-remove';
                    removeBtn.textContent = '-';
                    removeBtn.setAttribute('aria-label', `Remove Version ${optionIndex + 1}`);
                    removeBtn.disabled = previewField.options.length <= 1;
                    removeBtn.addEventListener('click', ()=>{
                      if(previewField.options.length <= 1){
                        previewField.options[0] = createEmptyOption();
                      } else {
                        previewField.options.splice(optionIndex, 1);
                      }
                      notifyFormbuilderChange();
                      const nextFocus = Math.min(optionIndex, Math.max(previewField.options.length - 1, 0));
                      renderVersionEditor(nextFocus);
                    });

                    actions.append(addBtn, removeBtn);
                    bottomRow.append(currencyWrapper, priceInput, actions);

                    optionRow.append(topRow, bottomRow);
                    versionList.appendChild(optionRow);
                  });

                  if(focusIndex !== null){
                    requestAnimationFrame(()=>{
                      const targetRow = versionList.querySelector(`.variant-pricing-option[data-option-index="${focusIndex}"]`);
                      if(!targetRow) return;
                      let focusEl = null;
                      if(focusTarget === 'price'){
                        focusEl = targetRow.querySelector('.variant-pricing-price');
                      } else if(focusTarget === 'currency'){
                        focusEl = targetRow.querySelector('button.variant-pricing-currency');
                      }
                      if(!focusEl){
                        focusEl = targetRow.querySelector('.variant-pricing-name');
                      }
                      if(focusEl && typeof focusEl.focus === 'function'){
                        try{ focusEl.focus({ preventScroll: true }); }
                        catch(err){
                          try{ focusEl.focus(); }catch(e){}
                        }
                      }
                    });
                  }
                };

                renderVersionEditor();
                editor.setAttribute('aria-required', previewField.required ? 'true' : 'false');
                control = editor;
              } else if(previewField.type === 'website-url' || previewField.type === 'tickets-url'){
                wrapper.classList.add('form-preview-field--url');
                const urlWrapper = document.createElement('div');
                urlWrapper.className = 'form-preview-url-wrapper';
                const urlInput = document.createElement('input');
                urlInput.type = 'text';
                urlInput.className = 'form-preview-url-input';
                const urlInputId = `${baseId}-input`;
                urlInput.id = urlInputId;
                const placeholderValue = previewField.placeholder && /\.[A-Za-z]{2,}/.test(previewField.placeholder)
                  ? previewField.placeholder
                  : 'https://example.com';
                urlInput.placeholder = placeholderValue;
                urlInput.dataset.urlType = previewField.type === 'website-url' ? 'website' : 'tickets';
                urlInput.dataset.urlMessage = 'Please enter a valid URL with a dot and letters after it.';
                const linkId = `${baseId}-link`;
                urlInput.dataset.urlLinkId = linkId;
                urlInput.autocomplete = 'url';
                urlInput.inputMode = 'url';
                const urlLink = document.createElement('a');
                urlLink.id = linkId;
                urlLink.href = '#';
                urlLink.target = '_blank';
                urlLink.rel = 'noopener noreferrer';
                urlLink.className = 'form-preview-url-link';
                urlLink.textContent = 'Open link';
                urlLink.setAttribute('aria-disabled','true');
                urlLink.tabIndex = -1;
                const urlMessage = document.createElement('div');
                urlMessage.className = 'form-preview-url-message';
                urlMessage.textContent = 'Link disabled until a valid URL is entered.';
                urlWrapper.append(urlInput, urlLink, urlMessage);
                control = urlWrapper;
              } else if(previewField.type === 'images'){
                wrapper.classList.add('form-preview-field--images');
                const imageWrapper = document.createElement('div');
                imageWrapper.className = 'form-preview-images';
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                const fileInputId = `${baseId}-input`;
                fileInput.id = fileInputId;
                fileInput.accept = 'image/*';
                fileInput.multiple = true;
                fileInput.dataset.imagesField = 'true';
                fileInput.dataset.maxImages = '10';
                const previewId = `${baseId}-previews`;
                const messageId = `${baseId}-message`;
                fileInput.dataset.imagePreviewTarget = previewId;
                fileInput.dataset.imageMessageTarget = messageId;
                const hint = document.createElement('div');
                hint.className = 'form-preview-image-hint';
                hint.textContent = 'Upload up to 10 images.';
                const message = document.createElement('div');
                message.className = 'form-preview-image-message';
                message.id = messageId;
                message.hidden = true;
                const previewGrid = document.createElement('div');
                previewGrid.className = 'form-preview-image-previews';
                previewGrid.id = previewId;
                imageWrapper.append(fileInput, hint, message, previewGrid);
                control = imageWrapper;
              } else if(previewField.type === 'location'){
                wrapper.classList.add('form-preview-field--location');
                const ensureLocationState = ()=>{
                  if(!previewField.location || typeof previewField.location !== 'object'){
                    previewField.location = { address: '', latitude: '', longitude: '' };
                  } else {
                    if(typeof previewField.location.address !== 'string') previewField.location.address = '';
                    if(typeof previewField.location.latitude !== 'string') previewField.location.latitude = '';
                    if(typeof previewField.location.longitude !== 'string') previewField.location.longitude = '';
                  }
                  return previewField.location;
                };
                const locationState = ensureLocationState();
                const locationWrapper = document.createElement('div');
                locationWrapper.className = 'location-field-wrapper';
                locationWrapper.setAttribute('role', 'group');
                const addressRow = document.createElement('div');
                addressRow.className = 'venue-line address_line-line';
                const geocoderContainer = document.createElement('div');
                geocoderContainer.className = 'address_line-geocoder-container';
                const addressInputId = `${baseId}-location-address`;
                geocoderContainer.id = `${baseId}-location-geocoder`;
                addressRow.appendChild(geocoderContainer);
                locationWrapper.appendChild(addressRow);
                const latitudeInput = document.createElement('input');
                latitudeInput.type = 'hidden';
                latitudeInput.dataset.locationLatitude = 'true';
                latitudeInput.value = locationState.latitude || '';
                const longitudeInput = document.createElement('input');
                longitudeInput.type = 'hidden';
                longitudeInput.dataset.locationLongitude = 'true';
                longitudeInput.value = locationState.longitude || '';
                locationWrapper.append(latitudeInput, longitudeInput);
                const placeholderValue = (previewField.placeholder && previewField.placeholder.trim())
                  ? previewField.placeholder
                  : 'Search for a location';
                const syncCoordinateInputs = ()=>{
                  latitudeInput.value = locationState.latitude || '';
                  longitudeInput.value = locationState.longitude || '';
                };
                syncCoordinateInputs();
                const formatCoord = value => {
                  const num = Number(value);
                  return Number.isFinite(num) ? num.toFixed(6) : '';
                };
                const applyAddressLabel = input => {
                  if(input){
                    input.setAttribute('aria-labelledby', labelId);
                  }
                  return input;
                };
                const createFallbackAddressInput = ()=>{
                  geocoderContainer.innerHTML = '';
                  geocoderContainer.classList.remove('is-geocoder-active');
                  const fallback = document.createElement('input');
                  fallback.type = 'text';
                  fallback.id = addressInputId;
                  fallback.className = 'address_line-fallback';
                  fallback.placeholder = placeholderValue;
                  fallback.setAttribute('aria-label', placeholderValue);
                  fallback.dataset.locationAddress = 'true';
                  fallback.value = locationState.address || '';
                  if(previewField.required) fallback.required = true;
                  fallback.addEventListener('input', ()=>{
                    locationState.address = fallback.value;
                    notifyFormbuilderChange();
                  });
                  geocoderContainer.appendChild(fallback);
                  addressInput = fallback;
                  applyAddressLabel(fallback);
                  return fallback;
                };
                const mapboxReady = window.mapboxgl && window.MapboxGeocoder && window.mapboxgl.accessToken;
                let addressInput = null;
                if(mapboxReady){
                  const geocoderOptions = {
                    accessToken: window.mapboxgl.accessToken,
                    mapboxgl: window.mapboxgl,
                    marker: false,
                    placeholder: placeholderValue,
                    geocodingUrl: MAPBOX_VENUE_ENDPOINT,
                    types: 'address,poi',
                    reverseGeocode: true,
                    localGeocoder: localVenueGeocoder,
                    externalGeocoder: externalMapboxVenueGeocoder,
                    filter: majorVenueFilter,
                    limit: 7,
                    language: (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : undefined
                  };
                  const geocoder = new MapboxGeocoder(geocoderOptions);
                  const schedule = (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function')
                    ? window.requestAnimationFrame.bind(window)
                    : (cb)=> setTimeout(cb, 16);
                  let attempts = 0;
                  const maxAttempts = 20;
                  let geocoderMounted = false;
                  let fallbackActivated = false;
                  const attachGeocoder = ()=>{
                    if(fallbackActivated){
                      return;
                    }
                    const scheduleRetry = ()=>{
                      attempts += 1;
                      if(attempts > maxAttempts){
                        addressInput = createFallbackAddressInput();
                        fallbackActivated = true;
                        return false;
                      }
                      schedule(attachGeocoder);
                      return true;
                    };
                    if(!geocoderContainer.isConnected){
                      scheduleRetry();
                      return;
                    }
                    if(!geocoderMounted){
                      try{
                        geocoder.addTo(geocoderContainer);
                        geocoderMounted = true;
                      }catch(err){
                        addressInput = createFallbackAddressInput();
                        fallbackActivated = true;
                        return;
                      }
                    }
                    const setGeocoderActive = isActive => {
                      const active = !!isActive;
                      geocoderContainer.classList.toggle('is-geocoder-active', active);
                      const subMenu = geocoderContainer.closest('.subcategory-form-menu');
                      if(subMenu){
                        subMenu.classList.toggle('has-floating-overlay', active);
                      }
                      const categoryMenu = subMenu
                        ? subMenu.closest('.category-form-menu')
                        : geocoderContainer.closest('.category-form-menu');
                      if(categoryMenu){
                        categoryMenu.classList.toggle('has-floating-overlay', active);
                      }
                    };
                    setGeocoderActive(false);
                    const geocoderRoot = geocoderContainer.querySelector('.mapboxgl-ctrl-geocoder');
                    if(geocoderRoot && !geocoderRoot.__formPreviewGeocoderBound){
                      geocoderRoot.__formPreviewGeocoderBound = true;
                      const handleFocusIn = ()=> setGeocoderActive(true);
                      const handleFocusOut = event => {
                        const nextTarget = event && event.relatedTarget;
                        if(!nextTarget || !geocoderRoot.contains(nextTarget)){
                          setGeocoderActive(false);
                        }
                      };
                      const handlePointerDown = ()=> setGeocoderActive(true);
                      geocoderRoot.addEventListener('focusin', handleFocusIn);
                      geocoderRoot.addEventListener('focusout', handleFocusOut);
                      geocoderRoot.addEventListener('pointerdown', handlePointerDown);
                    }
                    const geocoderInput = geocoderContainer.querySelector('.mapboxgl-ctrl-geocoder--input');
                    if(!geocoderInput){
                      scheduleRetry();
                      return;
                    }
                    if(geocoderInput.__formPreviewLocationBound){
                      addressInput = geocoderInput;
                      applyAddressLabel(geocoderInput);
                      return;
                    }
                    geocoderInput.__formPreviewLocationBound = true;
                    geocoderInput.placeholder = placeholderValue;
                    geocoderInput.setAttribute('aria-label', placeholderValue);
                    geocoderInput.id = addressInputId;
                    geocoderInput.dataset.locationAddress = 'true';
                    geocoderInput.value = locationState.address || '';
                    if(previewField.required) geocoderInput.required = true;
                    addressInput = geocoderInput;
                    applyAddressLabel(geocoderInput);
                    geocoderInput.addEventListener('blur', ()=>{
                      const nextValue = geocoderInput.value || '';
                      if(locationState.address !== nextValue){
                        locationState.address = nextValue;
                        notifyFormbuilderChange();
                      }
                    });
                    // Prevent Enter key from submitting form when in geocoder (form preview location field)
                    geocoderInput.addEventListener('keydown', (e)=>{
                      if(e.key === 'Enter'){
                        e.stopPropagation();
                        // Don't preventDefault - let geocoder handle it
                      }
                    });
                    geocoder.on('results', ()=> setGeocoderActive(true));
                    geocoder.on('result', event => {
                      const result = event && event.result;
                      if(result){
                        const clone = cloneGeocoderFeature(result);
                        const placeName = typeof clone.place_name === 'string' ? clone.place_name : '';
                        if(placeName){
                          locationState.address = placeName;
                          geocoderInput.value = placeName;
                        } else {
                          locationState.address = geocoderInput.value || '';
                        }
                        const center = getMapboxVenueFeatureCenter(clone);
                        if(center && center.length >= 2){
                          const [lng, lat] = center;
                          locationState.longitude = formatCoord(lng);
                          locationState.latitude = formatCoord(lat);
                        }
                        syncCoordinateInputs();
                        notifyFormbuilderChange();
                      }
                      setGeocoderActive(false);
                    });
                    geocoder.on('clear', ()=>{
                      locationState.address = '';
                      locationState.latitude = '';
                      locationState.longitude = '';
                      geocoderInput.value = '';
                      syncCoordinateInputs();
                      notifyFormbuilderChange();
                      setGeocoderActive(false);
                    });
                    geocoder.on('error', ()=> setGeocoderActive(false));
                    return geocoderInput;
                  };
                  attachGeocoder();
                } else {
                  addressInput = createFallbackAddressInput();
                }
                if(addressInput){
                  addressInput.setAttribute('aria-labelledby', labelId);
                }
                control = locationWrapper;
              } else {
                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = previewField.placeholder || '';
                input.readOnly = false;
                input.tabIndex = 0;
                const inputId = `${baseId}-input`;
                input.id = inputId;
                if(previewField.type === 'title'){
                  input.classList.add('form-preview-title-input');
                }
                // Make editable but prevent any form submission or member form linking
                input.addEventListener('change', (e) => {
                  e.stopPropagation();
                });
                input.addEventListener('input', (e) => {
                  e.stopPropagation();
                });
                control = input;
              }
              if(control){
                if(control instanceof HTMLElement){
                  control.setAttribute('aria-required', previewField.required ? 'true' : 'false');
                  if(labelId){
                    control.setAttribute('aria-labelledby', labelId);
                  }
                }
              if(previewField.required){
                wrapper.classList.add('form-preview-field--required');
                labelEl.appendChild(document.createTextNode(' '));
                const asterisk = document.createElement('span');
                asterisk.className = 'required-asterisk';
                asterisk.textContent = '*';
                labelEl.appendChild(asterisk);
              }
              const header = document.createElement('div');
              header.className = 'form-preview-field-header';
              header.style.position = 'relative';
              header.appendChild(labelEl);

              const previewFieldEditUI = createFieldEditUI(previewField, {
                hostElement: wrapper,
                attachDropdownToPanel: true
              });

              if(previewFieldEditUI && typeof previewFieldEditUI.setDeleteHandler === 'function'){
                const sourceRow = previewField.__rowEl instanceof Element ? previewField.__rowEl : null;
                const rowDeleteHandler = sourceRow && typeof sourceRow.__deleteHandler === 'function'
                  ? sourceRow.__deleteHandler
                  : null;
                const deleteHandler = rowDeleteHandler || (typeof previewField.__handleDeleteField === 'function'
                  ? previewField.__handleDeleteField
                  : null);
                previewFieldEditUI.setDeleteHandler(deleteHandler);
              }

              previewFieldEditUI.setSummaryUpdater(()=>{
                const displayName = (typeof previewField.name === 'string' && previewField.name.trim())
                  ? previewField.name.trim()
                  : labelText;
                previewFieldEditUI.editBtn.setAttribute('aria-label', `Edit ${displayName || 'field'} settings`);
              });
              previewFieldEditUI.runSummaryUpdater();

              header.append(previewFieldEditUI.editBtn, previewFieldEditUI.editPanel);

              const handlePreviewHeaderClick = event => {
                if(event.defaultPrevented) return;
                const origin = event.target;
                if(!origin) return;
                if(origin.closest('.formbuilder-drag-handle')) return;
                if(origin.closest('.field-edit-btn')) return;
                if(origin.closest('.field-edit-panel')) return;
                event.stopPropagation();
                document.querySelectorAll('.category-edit-panel, .subcategory-edit-panel').forEach(panel => {
                  if(panel !== previewFieldEditUI.editPanel){
                    panel.hidden = true;
                  }
                });
                closeFieldEditPanels({ exceptPanel: previewFieldEditUI.editPanel, exceptButton: previewFieldEditUI.editBtn });
                previewFieldEditUI.openEditPanel();
              };

              header.addEventListener('click', handlePreviewHeaderClick);
              wrapper.append(header, control);
              formPreviewFields.appendChild(wrapper);
            }
            });
          }

          if(fieldsContainerState){
            fieldsContainerState.onFieldsReordered = renderFormPreview;
          }

          const createFieldRow = (field)=>{
            const safeField = ensureFieldDefaults(field);
            const row = document.createElement('div');
            row.className = 'subcategory-field-row';

            const header = document.createElement('div');
            header.className = 'field-row-header';
            header.style.position = 'relative';

            const summary = document.createElement('div');
            summary.className = 'field-row-summary';

            const summaryLabel = document.createElement('span');
            summaryLabel.className = 'field-summary-label';

            const summaryRequired = document.createElement('span');
            summaryRequired.className = 'field-summary-required';

            summary.append(summaryLabel, summaryRequired);
            header.append(summary);

            const fieldEditUI = createFieldEditUI(safeField, { hostElement: row });
            const { editBtn: fieldEditBtn, editPanel, dropdownOptionsContainer, fieldTypeMenuBtn, deleteFieldBtn, closeEditPanel, openEditPanel, destroy: destroyEditUI, setDeleteHandler } = fieldEditUI;
            const fieldDragHandle = createFormbuilderDragHandle('Reorder field', 'field-drag-handle');
            header.append(fieldDragHandle);
            header.append(fieldEditBtn);
            header.append(editPanel);

            row.append(header);
            row._header = header;

            const activateFieldEditPanel = event => {
              if(event.defaultPrevented) return;
              const origin = event.target;
              if(!origin) return;
              if(origin.closest('.formbuilder-drag-handle')) return;
              if(origin.closest('.field-edit-panel')) return;
              if(origin.closest('.field-edit-btn')) return;
              event.stopPropagation();
              document.querySelectorAll('.category-edit-panel, .subcategory-edit-panel').forEach(panel => {
                if(panel !== editPanel){
                  panel.hidden = true;
                }
              });
              closeFieldEditPanels({ exceptPanel: editPanel, exceptButton: fieldEditBtn });
              openEditPanel();
            };

            header.addEventListener('click', activateFieldEditPanel);
            row.addEventListener('click', activateFieldEditPanel);

            const updateFieldSummary = ()=>{
              const typeKey = safeField.fieldTypeKey || safeField.key || safeField.type || '';
              // For editable fields, use the custom name if set, otherwise use field type name
              const customName = (typeof safeField.name === 'string' && safeField.name.trim()) ? safeField.name.trim() : '';
              const storedTypeName = (typeof safeField.field_type_name === 'string' && safeField.field_type_name.trim())
                ? safeField.field_type_name.trim()
                : (typeof safeField.fieldTypeName === 'string' && safeField.fieldTypeName.trim())
                  ? safeField.fieldTypeName.trim()
                  : '';
              const typeLabelRaw = (storedTypeName || getFormFieldTypeLabel(typeKey)).trim();
              const typeLabel = typeLabelRaw || (typeof typeKey === 'string' && typeKey.trim() ? typeKey.trim() : 'Field');
              // Use custom name if available (for editable fields), otherwise use type label
              summaryLabel.textContent = customName || typeLabel || 'Field';
              const isRequired = !!safeField.required;
              summaryRequired.textContent = isRequired ? 'Required' : 'Optional';
              summaryRequired.classList.toggle('is-required', isRequired);
              fieldEditBtn.setAttribute('aria-label', `Edit ${typeLabel || 'field'} settings`);
              updateDragHandleLabel(fieldDragHandle, `Reorder ${typeLabel || 'field'} field`);
              if(deleteFieldBtn){
                const deleteLabel = typeLabel || 'field';
                deleteFieldBtn.setAttribute('aria-label', `Delete ${deleteLabel} field`);
              }
            };

            fieldEditUI.setSummaryUpdater(updateFieldSummary);
            fieldEditUI.runSummaryUpdater();

            row.append(dropdownOptionsContainer);

            const handleDeleteField = async ()=>{
              const fieldDisplayName = (typeof safeField.name === 'string' && safeField.name.trim()) ? safeField.name.trim() : 'field';
              const confirmed = await confirmFormbuilderDeletion(`Delete the "${fieldDisplayName}" field?`, 'Delete Field');
              if(!confirmed) return;
              closeEditPanel();
              destroyEditUI();
              const idx = fields.indexOf(safeField);
              if(idx !== -1){
                fields.splice(idx, 1);
              }
              if(subcategoryFieldOverlayContent && typeof closeSubcategoryFieldOverlay === 'function' && subcategoryFieldOverlayContent.contains(row)){
                closeSubcategoryFieldOverlay();
              }
              const overlayPlaceholder = row.__overlayPlaceholder;
              if(overlayPlaceholder && overlayPlaceholder.parentNode){
                overlayPlaceholder.remove();
              }
              row.remove();
              if(safeField.__rowEl === row){
                delete safeField.__rowEl;
              }
              delete row.__overlayPlaceholder;
              delete row.__overlayParent;
              delete row.__overlayOverlay;
              delete row.__deleteHandler;
              setDeleteHandler(null);
              notifyFormbuilderChange();
              syncFieldOrderFromDom(fieldsList, fields);
              renderFormPreview();
              
              // Update formbuilder state manager snapshot after field deletion
              if(window.formbuilderStateManager && typeof window.formbuilderStateManager.save === 'function'){
                try {
                  window.formbuilderStateManager.save();
                  window.formbuilderStateManager.getSaved();
                } catch(err) {
                  console.error('[Formbuilder] Failed to update state manager:', err);
                }
              }
            };

            setDeleteHandler(handleDeleteField);
            row.__deleteHandler = handleDeleteField;

            fieldEditUI.updateFieldEditorsByType();
            row.__fieldRef = safeField;
            safeField.__rowEl = row;
            return {
              row,
              dragHandle: fieldDragHandle,
              editBtn: fieldEditBtn,
              editPanel,
              openEditPanel,
              focus(){
                try{
                  if(fieldTypeMenuBtn && typeof fieldTypeMenuBtn.focus === 'function'){
                    fieldTypeMenuBtn.focus({ preventScroll: true });
                  }
                }catch(err){
                  try{ 
                    if(fieldTypeMenuBtn && typeof fieldTypeMenuBtn.focus === 'function'){
                      fieldTypeMenuBtn.focus(); 
                    }
                  }catch(e){}
                }
              },
              focusTypePicker(){
                const focusSelect = ()=>{
                  try{
                    if(fieldTypeMenuBtn && typeof fieldTypeMenuBtn.focus === 'function'){
                      fieldTypeMenuBtn.focus({ preventScroll: true });
                    }
                  }catch(err){
                    try{ 
                      if(fieldTypeMenuBtn && typeof fieldTypeMenuBtn.focus === 'function'){
                        fieldTypeMenuBtn.focus(); 
                      }
                    }catch(e){}
                  }
                };
                focusSelect();
                requestAnimationFrame(()=>{
                  // Button elements don't have showPicker, menu is controlled by click handler
                  // Just click the button to open the menu
                  if(fieldTypeMenuBtn && typeof fieldTypeMenuBtn.click === 'function'){
                    try{
                      fieldTypeMenuBtn.click();
                    }catch(err){}
                  }
                });
              }
            };
          };

          fields.forEach((existingField, fieldIndex) => {
            if(!existingField) return;
            const fieldRow = createFieldRow(existingField);
            if(!fieldRow || !fieldRow.row) return;
            fieldRow.row.dataset.fieldIndex = String(fieldIndex);
            fieldsList.appendChild(fieldRow.row);
            enableFieldDrag(fieldRow.row, fieldsList, fields, fieldRow.dragHandle);
          });

          addFieldBtn.addEventListener('click', async ()=>{
            const subDisplayName = getSubDisplayName();
          const confirmed = await confirmFormbuilderAction({
            titleText: 'Add Field',
            messageKey: 'msg_confirm_add_field',
            placeholders: { subcategory: subDisplayName },
              confirmLabel: 'Add Field',
              confirmClassName: 'formbuilder-confirm-primary',
              focusCancel: false
            });
            if(!confirmed) return;
            const newField = ensureFieldDefaults({});
            fields.push(newField);
            const fieldRow = createFieldRow(newField);
            if(!fieldRow || !fieldRow.row) return;
            fieldRow.row.dataset.fieldIndex = String(fields.length - 1);
            fieldsList.appendChild(fieldRow.row);
            enableFieldDrag(fieldRow.row, fieldsList, fields, fieldRow.dragHandle);
            syncFieldOrderFromDom(fieldsList, fields);
            notifyFormbuilderChange();
            if(fieldRow && fieldRow.editPanel){
              closeFieldEditPanels({ exceptPanel: fieldRow.editPanel, exceptButton: fieldRow.editBtn });
              if(typeof fieldRow.openEditPanel === 'function'){
                fieldRow.openEditPanel();
              }
            }
            requestAnimationFrame(()=>{
              if(fieldRow && typeof fieldRow.focusTypePicker === 'function'){
                fieldRow.focusTypePicker();
              } else if(fieldRow && typeof fieldRow.focus === 'function'){
                fieldRow.focus();
              }
            });
            renderFormPreview();
          });

          renderFormPreview();

          const defaultSubName = sub || 'Subcategory';
          let currentSubName = defaultSubName;
          let lastSubName = defaultSubName;
          let currentSubId = c.subIds && Object.prototype.hasOwnProperty.call(c.subIds, sub) ? c.subIds[sub] : null;
          const getSubNameValue = ()=> subNameInput.value.trim();
          const getSubDisplayName = ()=> getSubNameValue() || lastSubName || defaultSubName;
            const updateSubIconDisplay = (src)=>{
              const applyNormalizeIconPath = window.applyNormalizeIconPath || ((path) => path);
              const displayName = getSubDisplayName();
              subLogo.innerHTML = '';
              const normalizedSrc = applyNormalizeIconPath(src);
              if(normalizedSrc){
                const img = document.createElement('img');
                img.src = normalizedSrc;
                img.alt = '';
                subLogo.appendChild(img);
                subLogo.classList.add('has-icon');
                subcategoryIcons[currentSubName] = `<img src="${normalizedSrc}" alt="">`;
                writeIconPath(subcategoryIconPaths, currentSubId, currentSubName, normalizedSrc);
              } else {
                subLogo.textContent = displayName.charAt(0) || '';
                subLogo.classList.remove('has-icon');
                delete subcategoryIcons[currentSubName];
                writeIconPath(subcategoryIconPaths, currentSubId, currentSubName, '');
              }
              if(normalizedSrc){
                subPreviewImg.src = normalizedSrc;
                subPreview.classList.add('has-image');
                subPreviewLabel.textContent = '';
                subIconButton.textContent = 'Change Icon';
              } else {
                subPreviewImg.removeAttribute('src');
                subPreview.classList.remove('has-image');
                subPreviewLabel.textContent = 'No Icon';
                subIconButton.textContent = 'Choose Icon';
              }
            };
          const applySubNameChange = ()=>{
            const rawValue = getSubNameValue();
            if(rawValue){
              lastSubName = rawValue;
            }
            const previousSubName = currentSubName;
            const previousSubId = currentSubId;
            const displayName = getSubDisplayName();
            const datasetValue = displayName;
            subLabel.textContent = displayName;
            subMenu.dataset.subcategory = datasetValue;
            subBtn.dataset.subcategory = datasetValue;
            subInput.setAttribute('aria-label', `Toggle ${displayName} subcategory`);
            updateDragHandleLabel(subDragHandle, `Reorder ${displayName} subcategory`);
            subIconButton.setAttribute('aria-label', `Choose icon for ${displayName}`);
            subPreviewImg.alt = `${displayName} icon preview`;
          const categoryDisplayName = getCategoryDisplayName();
          deleteSubBtn.setAttribute('aria-label', `Delete ${displayName} subcategory from ${categoryDisplayName}`);
            addFieldBtn.setAttribute('aria-label', `Add field to ${displayName}`);
            formPreviewBtn.setAttribute('aria-label', `Preview ${displayName} form`);
            if(!subLogo.querySelector('img')){
              subLogo.textContent = displayName.charAt(0) || '';
              subLogo.classList.remove('has-icon');
            } else {
              subLogo.classList.add('has-icon');
            }
            if(previousSubName !== datasetValue){
              const updateSubNameInList = (list, primaryIndex)=>{
                if(!Array.isArray(list)) return false;
                if(Number.isInteger(primaryIndex) && primaryIndex >= 0 && primaryIndex < list.length){
                  list[primaryIndex] = datasetValue;
                  return true;
                }
                const mirrorIndex = list.indexOf(previousSubName);
                if(mirrorIndex !== -1){
                  list[mirrorIndex] = datasetValue;
                  return true;
                }
                return false;
              };
              const datasetIndex = Number.parseInt(subMenu.dataset.subIndex, 10);
              if(Array.isArray(c.subs)){
                if(!updateSubNameInList(c.subs, datasetIndex)){
                  updateSubNameInList(c.subs, subIndex);
                }
              }
              if(Array.isArray(categories) && categories[sourceIndex] && Array.isArray(categories[sourceIndex].subs)){
                const mirrorSubs = categories[sourceIndex].subs;
                if(!updateSubNameInList(mirrorSubs, datasetIndex)){
                  updateSubNameInList(mirrorSubs, subIndex);
                }
              }
              if(subcategoryIcons[previousSubName] !== undefined){
                subcategoryIcons[datasetValue] = subcategoryIcons[previousSubName];
                delete subcategoryIcons[previousSubName];
              }
              if(subFieldsMap[previousSubName] !== undefined){
                subFieldsMap[datasetValue] = subFieldsMap[previousSubName];
                delete subFieldsMap[previousSubName];
              }
              if(c.subIds && typeof c.subIds === 'object'){
                if(Object.prototype.hasOwnProperty.call(c.subIds, previousSubName)){
                  const preservedId = c.subIds[previousSubName];
                  delete c.subIds[previousSubName];
                  c.subIds[datasetValue] = preservedId;
                  currentSubId = preservedId;
                }
              }
              renameIconNameKey(subcategoryIconPaths, previousSubName, datasetValue);
              currentSubName = datasetValue;
            }
            if(c.subIds && Object.prototype.hasOwnProperty.call(c.subIds, currentSubName)){
              currentSubId = c.subIds[currentSubName];
            } else if(previousSubName === currentSubName){
              currentSubId = previousSubId;
            }
          };
          subNameUpdaters.push(applySubNameChange);
          subNameInput.addEventListener('input', ()=> applySubNameChange());

          deleteSubBtn.addEventListener('click', async ()=>{
            const categoryDisplayName = getCategoryDisplayName();
            const subDisplayName = getSubDisplayName();
            const confirmed = await confirmFormbuilderDeletion(`Delete the "${subDisplayName}" subcategory from ${categoryDisplayName}?`, 'Delete Subcategory');
            if(!confirmed) return;
            if(subcategoryFieldOverlayContent && typeof closeSubcategoryFieldOverlay === 'function'){
              const activeRow = subcategoryFieldOverlayContent.querySelector('.subcategory-field-row');
              if(activeRow && subMenu.contains(activeRow)){
                closeSubcategoryFieldOverlay();
              }
            }
            delete subcategoryIcons[currentSubName];
            deleteIconKeys(subcategoryIconPaths, currentSubId, currentSubName);
            if(c.subIds && typeof c.subIds === 'object' && Object.prototype.hasOwnProperty.call(c.subIds, currentSubName)){
              delete c.subIds[currentSubName];
            }
            if(Array.isArray(c.subs)){
              const subIndex = c.subs.indexOf(currentSubName);
              if(subIndex !== -1){
                c.subs.splice(subIndex, 1);
              }
            }
            subMenu.remove();
            delete subFieldsMap[currentSubName];
            notifyFormbuilderChange();
            
            // Update formbuilder state manager snapshot first
            if(window.formbuilderStateManager && typeof window.formbuilderStateManager.save === 'function'){
              try {
                window.formbuilderStateManager.save();
              } catch(err) {
                console.error('[Formbuilder] Failed to update state manager:', err);
              }
            }
            
            // Trigger auto-save after deletion
            if(typeof window.adminPanelModule?.runSave === 'function'){
              setTimeout(() => {
                window.adminPanelModule.runSave({ closeAfter: false });
              }, 100);
            }
          });

          const subEditPanel = document.createElement('div');
          subEditPanel.className = 'subcategory-edit-panel';
          subEditPanel.hidden = true;
          subEditPanel.style.position = 'absolute';
          subEditPanel.style.right = '0';
          subEditPanel.style.top = 'calc(100% + 10px)';
          subEditPanel.style.zIndex = '100';
          
          const subHideToggleRow = document.createElement('div');
          subHideToggleRow.className = 'subcategory-hide-toggle-row';
          const subHideToggleLabel = document.createElement('span');
          subHideToggleLabel.dataset.messageKey = 'msg_label_hide_subcategory';
          // Text will be loaded from DB
          const subHideToggle = document.createElement('label');
          subHideToggle.className = 'switch';
          const subHideToggleInput = document.createElement('input');
          subHideToggleInput.type = 'checkbox';
          if(!c.subHidden) c.subHidden = {};
          subHideToggleInput.checked = typeof c.subHidden[sub] === 'boolean' ? c.subHidden[sub] : !subInput.checked;
          const subHideToggleSlider = document.createElement('span');
          subHideToggleSlider.className = 'slider';
          subHideToggle.append(subHideToggleInput, subHideToggleSlider);
          subHideToggleRow.append(subHideToggleLabel, subHideToggle);
          
          subHideToggleInput.addEventListener('change', ()=>{
            if(!c.subHidden) c.subHidden = {};
            c.subHidden[sub] = subHideToggleInput.checked;
            subInput.checked = !subHideToggleInput.checked;
            subInput.dispatchEvent(new Event('change', {bubbles: true}));
            notifyFormbuilderChange();
          });
          
          subInput.addEventListener('change', ()=>{
            subHideToggleInput.checked = !subInput.checked;
            if(!c.subHidden) c.subHidden = {};
            c.subHidden[sub] = subHideToggleInput.checked;
            notifyFormbuilderChange();
          });
          
          // Get site currency from admin settings (default to USD)
          const siteCurrency = 'USD'; // TODO: Load from admin_settings
          
          // Initialize subFees if not exists, but don't overwrite existing database values
          if(!c.subFees) c.subFees = {};
          if(!c.subFees[sub]) {
            c.subFees[sub] = {};
          }
          // Set defaults only for missing values
          if(c.subFees[sub].listing_fee === undefined) c.subFees[sub].listing_fee = null;
          if(c.subFees[sub].featured_fee === undefined) c.subFees[sub].featured_fee = null;
          if(c.subFees[sub].renew_fee === undefined) c.subFees[sub].renew_fee = null;
          if(c.subFees[sub].renew_featured_fee === undefined) c.subFees[sub].renew_featured_fee = null;
          if(c.subFees[sub].subcategory_type === undefined) c.subFees[sub].subcategory_type = 'Standard';
          if(c.subFees[sub].listing_days === undefined) c.subFees[sub].listing_days = 30;
          
          // Listing Fee Row
          const listingFeeRow = document.createElement('div');
          listingFeeRow.className = 'subcategory-fee-row';
          const listingFeeLabel = document.createElement('span');
          listingFeeLabel.textContent = 'Listing Fee';
          const listingFeeCurrency = document.createElement('span');
          listingFeeCurrency.className = 'fee-currency';
          listingFeeCurrency.textContent = siteCurrency;
          const listingFeeInput = document.createElement('input');
          listingFeeInput.type = 'number';
          listingFeeInput.step = '0.01';
          listingFeeInput.min = '0';
          listingFeeInput.className = 'fee-input';
          listingFeeInput.placeholder = '0.00';
          listingFeeInput.value = c.subFees[sub].listing_fee !== null && c.subFees[sub].listing_fee !== undefined 
            ? c.subFees[sub].listing_fee.toFixed(2) 
            : '';
          listingFeeInput.addEventListener('input', ()=>{
            c.subFees[sub].listing_fee = listingFeeInput.value ? parseFloat(listingFeeInput.value) : null;
            notifyFormbuilderChange();
          });
          listingFeeInput.addEventListener('blur', ()=>{
            if(listingFeeInput.value && !listingFeeInput.value.includes('.')){
              listingFeeInput.value = parseFloat(listingFeeInput.value).toFixed(2);
              c.subFees[sub].listing_fee = parseFloat(listingFeeInput.value);
            }
          });
          listingFeeRow.append(listingFeeLabel, listingFeeCurrency, listingFeeInput);
          
          // Renew Listing Fee Row
          const renewFeeRow = document.createElement('div');
          renewFeeRow.className = 'subcategory-fee-row';
          const renewFeeLabel = document.createElement('span');
          renewFeeLabel.textContent = 'Renew Listing Fee';
          const renewFeeCurrency = document.createElement('span');
          renewFeeCurrency.className = 'fee-currency';
          renewFeeCurrency.textContent = siteCurrency;
          const renewFeeInput = document.createElement('input');
          renewFeeInput.type = 'number';
          renewFeeInput.step = '0.01';
          renewFeeInput.min = '0';
          renewFeeInput.className = 'fee-input';
          renewFeeInput.placeholder = '0.00';
          renewFeeInput.value = c.subFees[sub].renew_fee !== null && c.subFees[sub].renew_fee !== undefined 
            ? c.subFees[sub].renew_fee.toFixed(2) 
            : '';
          renewFeeInput.addEventListener('input', ()=>{
            c.subFees[sub].renew_fee = renewFeeInput.value ? parseFloat(renewFeeInput.value) : null;
            notifyFormbuilderChange();
          });
          renewFeeInput.addEventListener('blur', ()=>{
            if(renewFeeInput.value && !renewFeeInput.value.includes('.')){
              renewFeeInput.value = parseFloat(renewFeeInput.value).toFixed(2);
              c.subFees[sub].renew_fee = parseFloat(renewFeeInput.value);
            }
          });
          renewFeeRow.append(renewFeeLabel, renewFeeCurrency, renewFeeInput);
          
          // Featured Fee Row
          const featuredFeeRow = document.createElement('div');
          featuredFeeRow.className = 'subcategory-fee-row';
          const featuredFeeLabel = document.createElement('span');
          featuredFeeLabel.textContent = 'Featured Fee';
          const featuredFeeCurrency = document.createElement('span');
          featuredFeeCurrency.className = 'fee-currency';
          featuredFeeCurrency.textContent = siteCurrency;
          const featuredFeeInput = document.createElement('input');
          featuredFeeInput.type = 'number';
          featuredFeeInput.step = '0.01';
          featuredFeeInput.min = '0';
          featuredFeeInput.className = 'fee-input';
          featuredFeeInput.placeholder = '0.00';
          featuredFeeInput.value = c.subFees[sub].featured_fee !== null && c.subFees[sub].featured_fee !== undefined 
            ? c.subFees[sub].featured_fee.toFixed(2) 
            : '';
          featuredFeeInput.addEventListener('input', ()=>{
            c.subFees[sub].featured_fee = featuredFeeInput.value ? parseFloat(featuredFeeInput.value) : null;
            notifyFormbuilderChange();
          });
          featuredFeeInput.addEventListener('blur', ()=>{
            if(featuredFeeInput.value && !featuredFeeInput.value.includes('.')){
              featuredFeeInput.value = parseFloat(featuredFeeInput.value).toFixed(2);
              c.subFees[sub].featured_fee = parseFloat(featuredFeeInput.value);
            }
          });
          featuredFeeRow.append(featuredFeeLabel, featuredFeeCurrency, featuredFeeInput);
          
          // Renew Featured Fee Row
          const renewFeaturedFeeRow = document.createElement('div');
          renewFeaturedFeeRow.className = 'subcategory-fee-row';
          const renewFeaturedFeeLabel = document.createElement('span');
          renewFeaturedFeeLabel.textContent = 'Renew Featured Fee';
          const renewFeaturedFeeCurrency = document.createElement('span');
          renewFeaturedFeeCurrency.className = 'fee-currency';
          renewFeaturedFeeCurrency.textContent = siteCurrency;
          const renewFeaturedFeeInput = document.createElement('input');
          renewFeaturedFeeInput.type = 'number';
          renewFeaturedFeeInput.step = '0.01';
          renewFeaturedFeeInput.min = '0';
          renewFeaturedFeeInput.className = 'fee-input';
          renewFeaturedFeeInput.placeholder = '0.00';
          renewFeaturedFeeInput.value = c.subFees[sub].renew_featured_fee !== null && c.subFees[sub].renew_featured_fee !== undefined 
            ? c.subFees[sub].renew_featured_fee.toFixed(2) 
            : '';
          renewFeaturedFeeInput.addEventListener('input', ()=>{
            c.subFees[sub].renew_featured_fee = renewFeaturedFeeInput.value ? parseFloat(renewFeaturedFeeInput.value) : null;
            notifyFormbuilderChange();
          });
          renewFeaturedFeeInput.addEventListener('blur', ()=>{
            if(renewFeaturedFeeInput.value && !renewFeaturedFeeInput.value.includes('.')){
              renewFeaturedFeeInput.value = parseFloat(renewFeaturedFeeInput.value).toFixed(2);
              c.subFees[sub].renew_featured_fee = parseFloat(renewFeaturedFeeInput.value);
            }
          });
          renewFeaturedFeeRow.append(renewFeaturedFeeLabel, renewFeaturedFeeCurrency, renewFeaturedFeeInput);
          
          // Subcategory Type Row
          const subTypeRow = document.createElement('div');
          subTypeRow.className = 'subcategory-type-row';
          const subTypeLabel = document.createElement('span');
          subTypeLabel.textContent = 'Subcategory Type';
          const subTypeEventsLabel = document.createElement('label');
          subTypeEventsLabel.className = 'subcategory-type-option';
          const subTypeEventsInput = document.createElement('input');
          subTypeEventsInput.type = 'radio';
          subTypeEventsInput.name = `subType-${sub}`;
          subTypeEventsInput.value = 'Events';
          subTypeEventsInput.checked = c.subFees[sub].subcategory_type === 'Events';
          subTypeEventsInput.addEventListener('change', ()=>{
            if(subTypeEventsInput.checked){
              c.subFees[sub].subcategory_type = 'Events';
              notifyFormbuilderChange();
            }
          });
          const subTypeEventsText = document.createElement('span');
          subTypeEventsText.textContent = 'Events';
          subTypeEventsLabel.append(subTypeEventsInput, subTypeEventsText);
          
          const subTypeStandardLabel = document.createElement('label');
          subTypeStandardLabel.className = 'subcategory-type-option';
          const subTypeStandardInput = document.createElement('input');
          subTypeStandardInput.type = 'radio';
          subTypeStandardInput.name = `subType-${sub}`;
          subTypeStandardInput.value = 'Standard';
          subTypeStandardInput.checked = c.subFees[sub].subcategory_type === 'Standard';
          subTypeStandardInput.addEventListener('change', ()=>{
            if(subTypeStandardInput.checked){
              c.subFees[sub].subcategory_type = 'Standard';
              notifyFormbuilderChange();
            }
          });
          const subTypeStandardText = document.createElement('span');
          subTypeStandardText.textContent = 'Standard';
          subTypeStandardLabel.append(subTypeStandardInput, subTypeStandardText);
          
          subTypeRow.append(subTypeLabel, subTypeEventsLabel, subTypeStandardLabel);
          
          // Listing Days Row (conditional based on type)
          const listingDaysRow = document.createElement('div');
          listingDaysRow.className = 'subcategory-days-row';
          const listingDaysLabel = document.createElement('span');
          listingDaysLabel.textContent = 'Listing Days';
          const listingDaysInput = document.createElement('input');
          listingDaysInput.type = 'number';
          listingDaysInput.min = '1';
          listingDaysInput.className = 'days-input';
          listingDaysInput.placeholder = '30';
          listingDaysInput.value = c.subFees[sub].listing_days !== null && c.subFees[sub].listing_days !== undefined 
            ? c.subFees[sub].listing_days 
            : '';
          listingDaysInput.addEventListener('input', ()=>{
            c.subFees[sub].listing_days = listingDaysInput.value ? parseInt(listingDaysInput.value) : null;
            notifyFormbuilderChange();
          });
          const listingDaysText = document.createElement('span');
          listingDaysText.textContent = 'days';
          listingDaysRow.append(listingDaysLabel, listingDaysInput, listingDaysText);
          
          // Show/hide listing days based on type
          const updateDaysVisibility = () => {
            if(subTypeEventsInput.checked){
              listingDaysRow.style.display = 'none';
            } else {
              listingDaysRow.style.display = 'flex';
            }
          };
          subTypeEventsInput.addEventListener('change', updateDaysVisibility);
          subTypeStandardInput.addEventListener('change', updateDaysVisibility);
          updateDaysVisibility();
          
          const saveSubcategoryBtn = document.createElement('button');
          saveSubcategoryBtn.type = 'button';
          saveSubcategoryBtn.className = 'save-changes primary-action formbuilder-inline-save';
          saveSubcategoryBtn.textContent = 'Save';
          saveSubcategoryBtn.setAttribute('aria-label', 'Save changes');
          saveSubcategoryBtn.addEventListener('click', (e)=>{
            e.preventDefault();
            e.stopPropagation();
            if(typeof window.adminPanelModule?.runSave === 'function'){
              window.adminPanelModule.runSave({ closeAfter:false });
            }
            subEditPanel.hidden = true;
            subEditBtn.setAttribute('aria-expanded', 'false');
          });
          
          const saveSubcategoryRow = document.createElement('div');
          saveSubcategoryRow.className = 'formbuilder-save-row';
          saveSubcategoryRow.append(saveSubcategoryBtn);
          
          const deleteSubcategoryRow = document.createElement('div');
          deleteSubcategoryRow.className = 'formbuilder-delete-row';
          deleteSubcategoryRow.append(deleteSubBtn);

          subEditPanel.append(subNameInput, subIconPicker, subHideToggleRow, listingFeeRow, renewFeeRow, featuredFeeRow, renewFeaturedFeeRow, subTypeRow, listingDaysRow, saveSubcategoryRow, deleteSubcategoryRow);
          subHeader.append(subEditPanel);
          
          subEditBtn.addEventListener('click', (e)=>{
            e.stopPropagation();
            document.querySelectorAll('.category-edit-panel, .subcategory-edit-panel').forEach(panel => {
              if(panel === subEditPanel) return;
              panel.hidden = true;
              const relatedButton = panel.parentElement
                ? panel.parentElement.querySelector('.category-edit-btn, .subcategory-edit-btn')
                : null;
              if(relatedButton){
                relatedButton.setAttribute('aria-expanded','false');
              }
            });
            closeFieldEditPanels();
            subEditPanel.hidden = !subEditPanel.hidden;
            subEditBtn.setAttribute('aria-expanded', subEditPanel.hidden ? 'false' : 'true');
          });

          const handleSubcategoryEditPointerDown = event => {
            if(subEditPanel.hidden){
              return;
            }
            const target = event.target;
            if(subEditPanel.contains(target)){
              return;
            }
            const clickedEditBtn = target.closest('.category-edit-btn, .subcategory-edit-btn, .field-edit-btn');
            if(clickedEditBtn){
              return;
            }
            subEditPanel.hidden = true;
            subEditBtn.setAttribute('aria-expanded', 'false');
          };
          document.addEventListener('pointerdown', handleSubcategoryEditPointerDown, true);

          subContent.append(fieldsSection);

          subMenu.append(subContent);

          applySubNameChange();
      const initialIconSource = applyNormalizeIconPath(initialSubIconPath) || initialSubIconPath || '';
          if(initialIconSource){
            updateSubIconDisplay(initialIconSource);
          }

          subBtn.addEventListener('click', ()=>{
            const isExpanded = subMenu.getAttribute('aria-expanded') === 'true';
            const next = !isExpanded;
            subMenu.setAttribute('aria-expanded', next ? 'true' : 'false');
            subBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
            subContent.hidden = !next;
            if(!next && subcategoryFieldOverlayContent && typeof closeSubcategoryFieldOverlay === 'function'){
              const activeRow = subcategoryFieldOverlayContent.querySelector('.subcategory-field-row');
              if(activeRow && subMenu.contains(activeRow)){
                closeSubcategoryFieldOverlay();
              }
            }
          });

          subInput.addEventListener('change', ()=>{
            const isOn = subInput.checked;
            subMenu.classList.toggle('subcategory-off', !isOn);
            if(!isOn){
              if(subcategoryFieldOverlayContent && typeof closeSubcategoryFieldOverlay === 'function'){
                const activeRow = subcategoryFieldOverlayContent.querySelector('.subcategory-field-row');
                if(activeRow && subMenu.contains(activeRow)){
                  closeSubcategoryFieldOverlay();
                }
              }
              if(subMenu.getAttribute('aria-expanded') === 'true'){
                subMenu.setAttribute('aria-expanded','false');
                subBtn.setAttribute('aria-expanded','false');
                subContent.hidden = true;
              }
            }
          });

          subMenusContainer.insertBefore(subMenu, addSubAnchor);
          enableSubcategoryDrag(subMenu, subMenusContainer, c, subHeader, addSubAnchor, subDragHandle);
        });

        setupSubcategoryContainer(subMenusContainer, c, addSubAnchor);

        const handleAddSubClick = async ()=>{
          const categoryDisplayName = getCategoryDisplayName();
          const confirmed = await confirmFormbuilderAction({
            titleText: 'Add Subcategory',
            messageKey: 'msg_confirm_add_subcategory',
            placeholders: { category: categoryDisplayName },
            confirmLabel: 'Add Subcategory',
            confirmClassName: 'formbuilder-confirm-primary',
            focusCancel: false
          });
          if(!confirmed) return;
          if(!Array.isArray(c.subs)){
            c.subs = [];
          }
          if(!c.subIds || typeof c.subIds !== 'object' || Array.isArray(c.subIds)){
            c.subIds = {};
          }
          const baseName = 'New Subcategory';
          const existing = new Set(c.subs.map(sub => (sub && typeof sub === 'string') ? sub : ''));
          let candidate = baseName;
          let counter = 2;
          while(existing.has(candidate)){
            candidate = `${baseName} ${counter++}`;
          }
          c.subs.push(candidate);
          c.subIds[candidate] = null;
          subFieldsMap[candidate] = [];
          const categoryIndex = categories.indexOf(c);
          renderFormbuilderCats();
          notifyFormbuilderChange();
          requestAnimationFrame(()=> requestAnimationFrame(()=>{
            if(!formbuilderCats) return;
            const categorySelector = categoryIndex >= 0 ? `.category-form-menu[data-category-index="${categoryIndex}"]` : null;
            const categoryMenu = categorySelector ? formbuilderCats.querySelector(categorySelector) : null;
            if(!categoryMenu) return;
            categoryMenu.setAttribute('aria-expanded','true');
            const menuTrigger = categoryMenu.querySelector('.filter-category-trigger');
            const content = categoryMenu.querySelector('.category-form-content');
            if(menuTrigger) menuTrigger.setAttribute('aria-expanded','true');
            if(content) content.hidden = false;
            const subMenus = categoryMenu ? categoryMenu.querySelectorAll('.subcategory-form-menu') : null;
            const newSubMenu = subMenus && subMenus.length ? subMenus[subMenus.length - 1] : null;
            if(!newSubMenu) return;
            newSubMenu.setAttribute('aria-expanded','true');
            const subTrigger = newSubMenu.querySelector('.subcategory-form-trigger');
            const subContent = newSubMenu.querySelector('.subcategory-form-content');
            if(subTrigger) subTrigger.setAttribute('aria-expanded','true');
            if(subContent) subContent.hidden = false;
            const newSubEditPanel = newSubMenu.querySelector('.subcategory-edit-panel');
            const newSubEditBtn = newSubMenu.querySelector('.subcategory-edit-btn');
            if(newSubEditPanel){
              document.querySelectorAll('.category-edit-panel, .subcategory-edit-panel').forEach(panel => {
                if(panel !== newSubEditPanel){
                  panel.hidden = true;
                }
              });
              document.querySelectorAll('.category-edit-btn, .subcategory-edit-btn').forEach(btn => {
                if(btn !== newSubEditBtn){
                  btn.setAttribute('aria-expanded', 'false');
                }
              });
              closeFieldEditPanels();
              newSubEditPanel.hidden = false;
              if(newSubEditBtn){
                newSubEditBtn.setAttribute('aria-expanded', 'true');
              }
            }
            const subNameField = newSubMenu.querySelector('.subcategory-name-input');
            if(subNameField){
              try{ subNameField.focus({ preventScroll: true }); }
              catch(err){
                try{ subNameField.focus(); }catch(e){}
              }
            }
          }));
        };
        const oldSubHandler = addSubBtn.__addSubcategoryHandler;
        if(oldSubHandler){
          addSubBtn.removeEventListener('click', oldSubHandler);
        }
        addSubBtn.addEventListener('click', handleAddSubClick);
        addSubBtn.__addSubcategoryHandler = handleAddSubClick;

        applyCategoryNameChange();

        content.append(subMenusContainer, editMenu);
        menu.append(content);

        menuBtn.addEventListener('click', ()=>{
          const isExpanded = menu.getAttribute('aria-expanded') === 'true';
          const next = !isExpanded;
          menu.setAttribute('aria-expanded', next ? 'true' : 'false');
          menuBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
          content.hidden = !next;
        });

        toggleInput.addEventListener('change', ()=>{
          const isOn = toggleInput.checked;
          menu.classList.toggle('cat-off', !isOn);
          if(!isOn){
            if(menu.getAttribute('aria-expanded') === 'true'){
              menu.setAttribute('aria-expanded','false');
              menuBtn.setAttribute('aria-expanded','false');
              content.hidden = true;
            }
          }
        });

        frag.appendChild(menu);
        enableCategoryDrag(menu, header, categoryDragHandle);
      });
      formbuilderCats.innerHTML = '';
      formbuilderCats.appendChild(frag);
      refreshFormbuilderSubcategoryLogos();
    };
    if(formbuilderAddCategoryBtn){
      async function handleFormbuilderAddCategoryClick(){
        const confirmed = await confirmFormbuilderAction({
          titleText: 'Add Category',
          messageKey: 'msg_confirm_add_category',
          confirmLabel: 'Add Category',
          confirmClassName: 'formbuilder-confirm-primary',
          focusCancel: false
        });
        if(!confirmed) return;
        if(!Array.isArray(categories)) return;
        const baseName = 'New Category';
        const existing = new Set(categories.map(cat => (cat && typeof cat.name === 'string') ? cat.name : ''));
        let candidate = baseName;
        let counter = 2;
        while(existing.has(candidate)){
          candidate = `${baseName} ${counter++}`;
        }
        categories.push({ name: candidate, subs: [], subFields: {}, sort_order: null });
        renderFormbuilderCats();
        notifyFormbuilderChange();
        const newMenu = formbuilderCats ? formbuilderCats.querySelector('.category-form-menu:last-of-type') : null;
        if(!newMenu) return;
        const menuTrigger = newMenu.querySelector('.filter-category-trigger');
        const content = newMenu.querySelector('.category-form-content');
        const editPanel = newMenu.querySelector('.category-edit-panel');
        const nameField = newMenu.querySelector('.category-name-input');
        newMenu.setAttribute('aria-expanded','true');
        if(menuTrigger) menuTrigger.setAttribute('aria-expanded','true');
        if(content) content.hidden = false;
        if(editPanel){
          document.querySelectorAll('.category-edit-panel, .subcategory-edit-panel').forEach(panel => {
            if(panel !== editPanel){
              panel.hidden = true;
            }
          });
          closeFieldEditPanels();
          editPanel.hidden = false;
        }
        if(nameField){
          requestAnimationFrame(()=>{
            try{ nameField.focus({ preventScroll: true }); }
            catch(err){
              try{ nameField.focus(); }catch(e){}
            }
          });
        }
      }
      const oldCategoryHandler = formbuilderAddCategoryBtn[FORM_BUILDER_ADD_CATEGORY_HANDLER_PROP];
      if(oldCategoryHandler){
        formbuilderAddCategoryBtn.removeEventListener('click', oldCategoryHandler);
      }
      formbuilderAddCategoryBtn.addEventListener('click', handleFormbuilderAddCategoryClick);
      formbuilderAddCategoryBtn[FORM_BUILDER_ADD_CATEGORY_HANDLER_PROP] = handleFormbuilderAddCategoryClick;
    }
    function cloneFieldsMap(source){
      const out = {};
      if(source && typeof source === 'object' && !Array.isArray(source)){
        Object.keys(source).forEach(key => {
          const value = source[key];
          if(Array.isArray(value)){
            // Always include the key, even if the array is empty
            out[key] = value.length === 0 ? [] : value.map(field => {
              const cloned = {
                id: field && field.id,
                key: field && typeof field.key === 'string' ? field.key : undefined,
                fieldTypeKey: field && typeof field.fieldTypeKey === 'string' ? field.fieldTypeKey : undefined,
                name: field && typeof field.name === 'string' ? field.name : '',
                type: field && typeof field.type === 'string' ? field.type : '',
                placeholder: field && typeof field.placeholder === 'string' ? field.placeholder : '',
                required: !!(field && field.required),
                options: Array.isArray(field && field.options)
                ? field.options.map(opt => {
                    if(field && field.type === 'variant-pricing'){
                      if(opt && typeof opt === 'object'){
                        return {
                          version: typeof opt.version === 'string' ? opt.version : '',
                          currency: typeof opt.currency === 'string' ? opt.currency : '',
                          price: typeof opt.price === 'string' ? opt.price : ''
                        };
                      }
                      const str = typeof opt === 'string' ? opt : String(opt ?? '');
                      return { version: str, currency: '', price: '' };
                    }
                    if(field && field.type === 'venue-ticketing'){
                      return cloneVenueSessionVenue(opt);
                    }
                    if(typeof opt === 'string') return opt;
                    if(opt && typeof opt === 'object' && typeof opt.version === 'string'){
                      return opt.version;
                    }
                    return String(opt ?? '');
                  })
                : []
              };
              // Preserve nested fields for complex field types
              if(Array.isArray(field && field.fields)){
                cloned.fields = field.fields;
              }
              return cloned;
            });
          } else {
            out[key] = [];
          }
        });
      }
      return out;
    }
    function cloneCategoryList(list){
      return Array.isArray(list) ? list.map(item => {
        const sortOrder = normalizeCategorySortOrderValue(item ? (item.sort_order ?? item.sortOrder) : null);
        return {
          id: item && Number.isInteger(item.id) ? item.id : (typeof item.id === 'string' && /^\d+$/.test(item.id) ? parseInt(item.id, 10) : null),
          name: item && typeof item.name === 'string' ? item.name : '',
          subs: Array.isArray(item && item.subs) ? item.subs.slice() : [],
          subFields: cloneFieldsMap(item && item.subFields),
          subIds: cloneMapLike(item && item.subIds),
          subHidden: cloneMapLike(item && item.subHidden),
          subFees: cloneMapLike(item && item.subFees),
          sort_order: sortOrder,
          hidden: item && typeof item.hidden === 'boolean' ? item.hidden : false
        };
      }) : [];
    }
    function cloneMapLike(source){
      const out = {};
      if(source && typeof source === 'object'){
        Object.keys(source).forEach(key => {
          out[key] = source[key];
        });
      }
      return out;
    }
    function assignMapLike(target, source){
      if(!target || typeof target !== 'object') return;
      Object.keys(target).forEach(key => { delete target[key]; });
      if(source && typeof source === 'object'){
        Object.keys(source).forEach(key => {
          target[key] = source[key];
        });
      }
    }
    function captureFormbuilderSnapshot(){
      const subcategoryMarkers = window.subcategoryMarkers || {};
      return {
        categories: cloneCategoryList(categories),
        categoryIcons: cloneMapLike(categoryIcons),
        subcategoryIcons: cloneMapLike(subcategoryIcons),
        categoryIconPaths: cloneMapLike(categoryIconPaths),
        subcategoryIconPaths: cloneMapLike(subcategoryIconPaths),
        subcategoryMarkers: cloneMapLike(subcategoryMarkers),
        fieldTypes: Array.isArray(FORM_FIELD_TYPES)
          ? FORM_FIELD_TYPES.map(option => ({ ...option }))
          : []
      };
    }
    let savedFormbuilderSnapshot = captureFormbuilderSnapshot();
    function restoreFormbuilderSnapshot(snapshot){
      if(!snapshot) return;
      const initialFormbuilderSnapshot = window.initialFormbuilderSnapshot;
      const existingFieldTypes = (() => {
        if(initialFormbuilderSnapshot && Array.isArray(initialFormbuilderSnapshot.fieldTypes) && initialFormbuilderSnapshot.fieldTypes.length){
          return initialFormbuilderSnapshot.fieldTypes.map(option => ({ ...option }));
        }
        if(Array.isArray(FORM_FIELD_TYPES) && FORM_FIELD_TYPES.length){
          return FORM_FIELD_TYPES.map(option => ({ ...option }));
        }
        return [];
      })();
      const normalized = normalizeFormbuilderSnapshot(snapshot);
      let sanitizedFieldTypes = sanitizeFieldTypeOptions(normalized.fieldTypes);
      if(sanitizedFieldTypes.length === 0 && existingFieldTypes.length){
        sanitizedFieldTypes = sanitizeFieldTypeOptions(existingFieldTypes);
      }
      initialFormbuilderSnapshot.fieldTypes = sanitizedFieldTypes.map(option => ({ ...option }));
      FORM_FIELD_TYPES.splice(0, FORM_FIELD_TYPES.length, ...initialFormbuilderSnapshot.fieldTypes.map(option => ({ ...option })));
      const nextCategories = cloneCategoryList(normalized.categories);
      if(Array.isArray(nextCategories)){
        categories.splice(0, categories.length, ...nextCategories);
      }
      categories.forEach(cat => {
        if(!cat || typeof cat !== 'object') return;
        if(!cat.subFields || typeof cat.subFields !== 'object' || Array.isArray(cat.subFields)){
          cat.subFields = {};
        }
        (cat.subs || []).forEach(subName => {
          if(!Array.isArray(cat.subFields[subName])){
            cat.subFields[subName] = [];
          }
        });
      });
      assignMapLike(categoryIcons, snapshot.categoryIcons);
      assignMapLike(subcategoryIcons, snapshot.subcategoryIcons);
      const normalizeIconPathMap = window.normalizeIconPathMap || (() => ({}));
      assignMapLike(categoryIconPaths, normalizeIconPathMap(snapshot.categoryIconPaths));
      assignMapLike(subcategoryIconPaths, normalizeIconPathMap(snapshot.subcategoryIconPaths));
      const subcategoryMarkers = window.subcategoryMarkers = window.subcategoryMarkers || {};
      const MULTI_POST_MARKER_ICON_ID = window.MULTI_POST_MARKER_ICON_ID || 'multi-post-icon';
      const multiIconSrc = subcategoryMarkers[MULTI_POST_MARKER_ICON_ID];
      Object.keys(subcategoryMarkers).forEach(key => {
        if(key !== MULTI_POST_MARKER_ICON_ID){
          delete subcategoryMarkers[key];
        }
      });
      if(multiIconSrc){
        subcategoryMarkers[MULTI_POST_MARKER_ICON_ID] = multiIconSrc;
      }
      const markerOverrides = snapshot && snapshot.subcategoryMarkers;
      if(markerOverrides && typeof markerOverrides === 'object'){
        Object.keys(markerOverrides).forEach(name => {
          const url = markerOverrides[name];
          if(typeof url !== 'string'){
            return;
          }
          const trimmedUrl = url.trim();
          if(!trimmedUrl){
            return;
          }
          const slugKey = slugify(typeof name === 'string' ? name : '');
          if(slugKey){
            subcategoryMarkers[slugKey] = trimmedUrl;
          }
          if(typeof name === 'string' && name){
            subcategoryMarkers[name] = trimmedUrl;
          }
        });
      }
      renderFilterCategories();
      renderFormbuilderCats();
      refreshFormbuilderSubcategoryLogos();
      if(typeof document !== 'undefined' && typeof document.dispatchEvent === 'function'){
        try{
          document.dispatchEvent(new CustomEvent('subcategory-icons-ready'));
        }catch(err){}
      }
      if(window.postsLoaded && window.__markersLoaded && typeof addPostSource === 'function'){
        try{ addPostSource(); }catch(err){ console.error('addPostSource failed after snapshot restore', err); }
      }
      updateFormbuilderSnapshot();
    }
    function updateFormbuilderSnapshot(){
      savedFormbuilderSnapshot = captureFormbuilderSnapshot();
    }
    window.formbuilderStateManager = {
      capture: captureFormbuilderSnapshot,
      restoreSaved(){ restoreFormbuilderSnapshot(savedFormbuilderSnapshot); },
      save(){ updateFormbuilderSnapshot(); },
      getSaved(){ return savedFormbuilderSnapshot ? JSON.parse(JSON.stringify(savedFormbuilderSnapshot)) : null; },
      restore(snapshot){ restoreFormbuilderSnapshot(snapshot); }
    };
    persistedFormbuilderSnapshotPromise.then(snapshot => {
      if(!snapshot) return;
      const manager = window.formbuilderStateManager;
      if(!manager || typeof manager.restore !== 'function'){
        return;
      }
      try{
        manager.restore(snapshot);
      }catch(err){
        console.error('Failed to restore persisted formbuilder snapshot', err);
        return;
      }
      if(typeof manager.save === 'function'){
        try{
          manager.save();
        }catch(err){
          console.error('Failed to update saved formbuilder snapshot after hydration', err);
        }
      }
    }).catch(err => {
      console.error('Failed to load persisted formbuilder snapshot from backend', err);
    });
    function updateCategoryResetBtn(){
      if(!resetCategoriesBtn) return;
      const anyCategoryOff = Object.values(categoryControllers).some(ctrl=>ctrl && typeof ctrl.isActive === 'function' && !ctrl.isActive());
      const totalSubs = allSubcategoryKeys.length;
      const selection = window.selection = window.selection || { cats: new Set(), subs: new Set() };
      const activeSubs = selection.subs instanceof Set ? selection.subs.size : 0;
      const anySubOff = totalSubs > 0 && activeSubs < totalSubs;
      resetCategoriesBtn.classList.toggle('active', anyCategoryOff || anySubOff);
    }
    function refreshSubcategoryLogos(){
      const applyNormalizeIconPath = window.applyNormalizeIconPath || ((path) => path);
      Object.values(categoryControllers).forEach(ctrl=>{
        if(ctrl && typeof ctrl.refreshLogos === 'function'){
          ctrl.refreshLogos();
        }
      });
    }
    
    // ============= Messages Tab =============
    const messagesCats = document.getElementById('messagesCats');
    const MESSAGE_CATEGORIES = [
      { name: 'User Messages', key: 'user', icon: 'assets/admin-icons/user-messages.svg', description: 'Messages for public visitors' },
      { name: 'Member Messages', key: 'member', icon: 'assets/admin-icons/member-messages.svg', description: 'Messages for authenticated members' },
      { name: 'Admin Messages', key: 'admin', icon: 'assets/admin-icons/admin-messages.svg', description: 'Messages for admin panel' },
      { name: 'Email Messages', key: 'email', icon: 'assets/admin-icons/email-messages.svg', description: 'Email communications' }
    ];
    
    // Load custom category names and icons from database if available
    MESSAGE_CATEGORIES.forEach(cat => {
      // Categories should only come from backend - no localStorage override
      // Removed localStorage fallback to prevent showing stale category data
    });
    
    function renderMessagesCategories(){
      if(!messagesCats) return;
      messagesCats.innerHTML = '';
      const frag = document.createDocumentFragment();
      
      MESSAGE_CATEGORIES.forEach((cat, index) => {
        const menu = document.createElement('div');
        menu.className = 'category-form-menu filter-category-menu messages-category-menu';
        menu.dataset.messageCategory = cat.key;
        menu.setAttribute('role', 'group');
        menu.setAttribute('aria-expanded', 'false');
        
        const header = document.createElement('div');
        header.className = 'formbuilder-category-header';
        
        const triggerWrap = document.createElement('div');
        triggerWrap.className = 'options-dropdown filter-category-trigger-wrap';
        
        const menuBtn = document.createElement('button');
        menuBtn.type = 'button';
        menuBtn.className = 'filter-category-trigger';
        menuBtn.setAttribute('aria-haspopup', 'true');
        menuBtn.setAttribute('aria-expanded', 'false');
        
        const logo = document.createElement('span');
        logo.className = 'category-logo has-icon';
        const logoImg = document.createElement('img');
        logoImg.src = cat.icon;
        logoImg.alt = '';
        logo.appendChild(logoImg);
        
        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = cat.name;
        
        const arrow = document.createElement('span');
        arrow.className = 'dropdown-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        
        menuBtn.append(logo, label, arrow);
        triggerWrap.appendChild(menuBtn);
        
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'category-edit-btn';
        editBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M12.854 1.146a.5.5 0 0 1 .707 0l1.293 1.293a.5.5 0 0 1 0 .707l-8.939 8.939a.5.5 0 0 1-.233.131l-3.5.875a.5.5 0 0 1-.606-.606l.875-3.5a.5.5 0 0 1 .131-.233l8.939-8.939z"/><path d="M2.5 12.5V14h1.5l9-9-1.5-1.5-9 9z"/></svg>';
        editBtn.setAttribute('aria-label', `Edit ${cat.name} category`);
        editBtn.setAttribute('aria-expanded', 'false');
        
        const messageDragHandle = createFormbuilderDragHandle(`Reorder ${cat.name} category`, 'category-drag-handle');
        
        header.append(triggerWrap, messageDragHandle, editBtn);
        
        const content = document.createElement('div');
        content.className = 'category-form-content';
        content.hidden = true;
        
        const editPanel = document.createElement('div');
        editPanel.className = 'category-edit-panel';
        editPanel.hidden = true;
        editPanel.style.position = 'absolute';
        editPanel.style.right = '0';
        editPanel.style.top = 'calc(100% + 10px)';
        editPanel.style.zIndex = '100';
        
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'category-name-input';
        nameInput.placeholder = 'Category Name';
        nameInput.value = cat.name;
        
        // Auto-save category name on change
        nameInput.addEventListener('blur', () => {
          const newName = nameInput.value.trim();
          if(newName && newName !== cat.name){
            cat.name = newName;
            label.textContent = newName;
            const settingKey = `msg_category_${cat.key}_name`;
            fetch('/gateway.php?action=save-admin-settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ [settingKey]: newName })
            }).catch(err => console.error('Failed to save category name:', err));
          }
        });
        
        const iconPicker = document.createElement('div');
        iconPicker.className = 'iconpicker-container';
        
        const iconPickerButton = document.createElement('button');
        iconPickerButton.type = 'button';
        iconPickerButton.className = 'iconpicker-button';
        iconPickerButton.textContent = 'Change Icon';
        
        const preview = document.createElement('div');
        preview.className = 'iconpicker-preview has-image';
        const previewLabel = document.createElement('span');
        previewLabel.textContent = '';
        const previewImg = document.createElement('img');
        previewImg.src = cat.icon;
        previewImg.alt = `${cat.name} icon preview`;
        preview.append(previewLabel, previewImg);
        iconPicker.append(preview, iconPickerButton);
        
        // Attach icon picker functionality
        if(typeof window.attachIconPicker === 'function'){
          window.attachIconPicker(iconPickerButton, iconPicker, {
            getCurrentPath: () => cat.icon,
            onSelect: (value) => {
              if(value){
                previewImg.src = value;
                preview.classList.add('has-image');
                previewLabel.textContent = '';
                iconPickerButton.textContent = 'Change Icon';
                cat.icon = value;
                logoImg.src = value;
                // Save to admin_settings
                const settingKey = `msg_category_${cat.key}_icon`;
                fetch('/gateway.php?action=save-admin-settings', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ [settingKey]: value })
                }).catch(err => console.error('Failed to save category icon:', err));
              }
            },
            label: `Choose icon for ${cat.name}`,
            parentMenu: content,
            parentCategoryMenu: menu,
            iconFolder: window.adminIconFolder || 'assets/admin-icons'
          });
        }
        
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'save-changes primary-action formbuilder-inline-save';
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if(typeof window.adminPanelModule?.runSave === 'function'){
            window.adminPanelModule.runSave({ closeAfter: false });
          }
          editPanel.hidden = true;
          editBtn.setAttribute('aria-expanded', 'false');
        });
        
        editPanel.append(nameInput, iconPicker, saveBtn);
        header.appendChild(editPanel);
        
        menu.append(header, content);
        frag.appendChild(menu);
        
        // Toggle category dropdown on button click
        menuBtn.addEventListener('click', () => {
          const isExpanded = menu.getAttribute('aria-expanded') === 'true';
          menu.setAttribute('aria-expanded', String(!isExpanded));
          menuBtn.setAttribute('aria-expanded', String(!isExpanded));
          content.hidden = isExpanded;
        });
        
        // Toggle edit panel on edit button click
        editBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          // Close all other edit panels
          document.querySelectorAll('.category-edit-panel, .subcategory-edit-panel').forEach(panel => {
            if(panel === editPanel) return;
            panel.hidden = true;
            const relatedButton = panel.parentElement
              ? panel.parentElement.querySelector('.category-edit-btn, .subcategory-edit-btn')
              : null;
            if(relatedButton){
              relatedButton.setAttribute('aria-expanded','false');
            }
          });
          // Toggle this edit panel
          editPanel.hidden = !editPanel.hidden;
          editBtn.setAttribute('aria-expanded', editPanel.hidden ? 'false' : 'true');
        });
        
        // Close edit panel when clicking outside
        const handleEditPointerDown = event => {
          if(editPanel.hidden) return;
          const target = event.target;
          if(editPanel.contains(target)) return;
          const clickedEditBtn = target.closest('.category-edit-btn, .subcategory-edit-btn, .field-edit-btn');
          if(clickedEditBtn) return;
          editPanel.hidden = true;
          editBtn.setAttribute('aria-expanded', 'false');
        };
        document.addEventListener('pointerdown', handleEditPointerDown, true);
      });
      
      messagesCats.appendChild(frag);
    }
    
    // Fetch and populate admin messages from database
    async function loadAdminMessages(){
      try {
        // Fetch messages directly for messages tab to get full container structure
        // This preserves the original container format needed by populateMessagesIntoContainers
        const response = await fetch('/gateway.php?action=get-admin-settings&include_messages=true');
        if(!response.ok){
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        
        if(result.success && result.messages){
          populateMessagesIntoContainers(result.messages);
        } else {
          console.error('Failed to load admin messages:', result.message || result.messages_error);
        }
      } catch(error){
        console.error('Error loading admin messages:', error);
        // Don't call updateAllMessageElements here - it would overwrite the messages tab
      }
    }
    
    function populateMessagesIntoContainers(messageContainers){
      // Map container_key to MESSAGE_CATEGORIES key
      const containerKeyMap = {
        'msg_user': 'user',
        'msg_member': 'member',
        'msg_admin': 'admin',
        'msg_email': 'email'
      };
      
      messageContainers.forEach(container => {
        const categoryKey = containerKeyMap[container.container_key];
        if(!categoryKey) return;
        
        // Find the category menu element
        const categoryMenu = messagesCats.querySelector(`[data-message-category="${categoryKey}"]`);
        if(!categoryMenu) return;
        
        const content = categoryMenu.querySelector('.category-form-content');
        if(!content) return;
        
        // Clear existing content
        content.innerHTML = '';
        
        // Create messages list
        if(container.messages && container.messages.length > 0){
          const messagesList = document.createElement('div');
          messagesList.className = 'messages-list';
          
          container.messages.forEach(message => {
            const messageItem = document.createElement('div');
            messageItem.className = 'message-item';
            messageItem.dataset.messageId = message.id;
            messageItem.dataset.messageKey = message.message_key;
            
            // Message label with hover popup
            const messageLabel = document.createElement('div');
            messageLabel.className = 'message-label';
            messageLabel.textContent = message.message_name || message.message_key;
            
            // Create hover popup with metadata
            const hoverPopup = document.createElement('div');
            hoverPopup.className = 'message-hover-popup';
            
            // Type badge in popup
            const typeBadge = document.createElement('span');
            typeBadge.className = `message-type-badge type-${message.message_type}`;
            typeBadge.textContent = message.message_type;
            hoverPopup.appendChild(typeBadge);
            
            // Description in popup
            if(message.message_description){
              const description = document.createElement('div');
              description.className = 'message-popup-description';
              description.textContent = message.message_description;
              hoverPopup.appendChild(description);
            }
            
            // Placeholders in popup
            if(message.placeholders && message.placeholders.length > 0){
              const placeholdersInfo = document.createElement('div');
              placeholdersInfo.className = 'message-popup-placeholders';
              placeholdersInfo.innerHTML = `<strong>Placeholders:</strong> ${message.placeholders.map(p => `<code>{${p}}</code>`).join(', ')}`;
              hoverPopup.appendChild(placeholdersInfo);
            }
            
            messageLabel.appendChild(hoverPopup);
            
            // Message text display (shown by default)
            const messageTextDisplay = document.createElement('div');
            messageTextDisplay.className = 'message-text-display';
            messageTextDisplay.innerHTML = message.message_text || '';
            messageTextDisplay.title = 'Click to edit';
            
            // Message text input (hidden by default)
            const textArea = document.createElement('textarea');
            textArea.className = 'message-text-input';
            textArea.value = message.message_text || '';
            textArea.rows = 3;
            textArea.dataset.messageId = message.id;
            textArea.dataset.originalValue = message.message_text || '';
            textArea.hidden = true;
            
            // Track changes
            textArea.addEventListener('input', () => {
              if(textArea.value !== textArea.dataset.originalValue){
                messageItem.classList.add('modified');
                messageTextDisplay.innerHTML = textArea.value;
                // Mark admin panel as dirty
                if(typeof window.adminPanelModule?.markDirty === 'function'){
                  window.adminPanelModule.markDirty();
                }
              } else {
                messageItem.classList.remove('modified');
              }
            });
            
            // Click to switch to edit mode
            messageTextDisplay.addEventListener('click', () => {
              messageTextDisplay.hidden = true;
              textArea.hidden = false;
              textArea.focus();
            });
            
            // Click outside or blur to switch back to display mode
            textArea.addEventListener('blur', () => {
              // Update display with current textarea value before hiding
              messageTextDisplay.innerHTML = textArea.value;
              
              // Update modified state based on comparison with original
              if(textArea.value !== textArea.dataset.originalValue){
                messageItem.classList.add('modified');
                // Mark admin panel as dirty
                if(typeof window.adminPanelModule?.markDirty === 'function'){
                  window.adminPanelModule.markDirty();
                }
              } else {
                messageItem.classList.remove('modified');
              }
              
              messageTextDisplay.hidden = false;
              textArea.hidden = true;
            });
            
            messageItem.append(messageLabel, messageTextDisplay, textArea);
            messagesList.appendChild(messageItem);
          });
          
          content.appendChild(messagesList);
        } else {
          const emptyMsg = document.createElement('div');
          emptyMsg.className = 'messages-empty';
          emptyMsg.textContent = 'No messages in this category';
          content.appendChild(emptyMsg);
        }
      });
    }
    
    // Initialize messages categories when admin panel opens
    if(messagesCats){
      renderMessagesCategories();
      
      // Load messages from database (admin panel sees all messages including email/admin)
      loadAdminMessages();
      
      // Add drag and drop functionality for Messages tab categories
      let draggedMessageCategory = null;
      let messageCategoryDropIndicatorTarget = null;
      let messageCategoryDropIndicatorBefore = null;
      
      messagesCats.addEventListener('dragstart', event => {
        const menu = event.target.closest('.messages-category-menu');
        if(!menu) return;
        draggedMessageCategory = menu;
        menu.classList.add('is-dragging');
        if(event.dataTransfer){
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/html', menu.innerHTML);
        }
      });
      
      messagesCats.addEventListener('dragend', event => {
        if(draggedMessageCategory){
          draggedMessageCategory.classList.remove('is-dragging');
          draggedMessageCategory = null;
        }
        messageCategoryDropIndicatorTarget = null;
        messageCategoryDropIndicatorBefore = null;
        messagesCats.querySelectorAll('.drag-target-before, .drag-target-after').forEach(el => {
          el.classList.remove('drag-target-before', 'drag-target-after');
        });
      });
      
      messagesCats.addEventListener('dragover', event => {
        if(!draggedMessageCategory) return;
        event.preventDefault();
        if(event.dataTransfer){
          event.dataTransfer.dropEffect = 'move';
        }
        const target = event.target.closest('.messages-category-menu');
        if(!target || target === draggedMessageCategory) return;
        
        const rect = target.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const before = event.clientY < midpoint;
        
        if(messageCategoryDropIndicatorTarget && messageCategoryDropIndicatorTarget !== target){
          messageCategoryDropIndicatorTarget.classList.remove('drag-target-before', 'drag-target-after');
        }
        messageCategoryDropIndicatorTarget = target;
        messageCategoryDropIndicatorBefore = before;
        target.classList.remove('drag-target-before', 'drag-target-after');
        target.classList.add(before ? 'drag-target-before' : 'drag-target-after');
      });
      
      messagesCats.addEventListener('drop', event => {
        if(!draggedMessageCategory) return;
        event.preventDefault();
        const target = messageCategoryDropIndicatorTarget;
        const before = messageCategoryDropIndicatorBefore;
        if(target && target !== draggedMessageCategory){
          const reference = before ? target : target.nextSibling;
          if(reference !== draggedMessageCategory && reference !== draggedMessageCategory.nextSibling){
            messagesCats.insertBefore(draggedMessageCategory, reference || null);
          }
        }
      });
    }
    // ============= End Messages Tab =============
    
    function renderFilterCategories(){
      if(!catsEl) return;
      catsEl.textContent = '';
      Object.keys(categoryControllers).forEach(key=>{ delete categoryControllers[key]; });
      allSubcategoryKeys.length = 0;
      const selection = window.selection = window.selection || { cats: new Set(), subs: new Set() };
      selection.cats = new Set();
      selection.subs = new Set();
      const seedSubs = true;
      const sortedCategories = getSortedCategories(categories);
      sortedCategories.forEach(c=>{
        const el = document.createElement('div');
        el.className='filter-category-menu';
        el.dataset.category = c.name;
        el.setAttribute('role','group');
        el.setAttribute('aria-expanded','false');

        const header = document.createElement('div');
        header.className='filter-category-header';

        const triggerWrap = document.createElement('div');
        triggerWrap.className='options-dropdown filter-category-trigger-wrap';

        const menuBtn = document.createElement('button');
        menuBtn.type='button';
        menuBtn.className='filter-category-trigger';
        menuBtn.setAttribute('aria-haspopup','true');
        menuBtn.setAttribute('aria-expanded','false');
        const menuId = `filter-category-menu-${slugify(c.name)}`;
        menuBtn.setAttribute('aria-controls', menuId);

        const categoryLogo = document.createElement('span');
        categoryLogo.className='category-logo';
        const categoryIconHtml = categoryIcons[c.name] || '';
        if(categoryIconHtml){
          categoryLogo.innerHTML = categoryIconHtml;
          categoryLogo.classList.add('has-icon');
        } else {
          categoryLogo.textContent = c.name.charAt(0) || '';
        }

        const label = document.createElement('span');
        label.className='label';
        label.textContent=c.name;

        const arrow = document.createElement('span');
        arrow.className='dropdown-arrow';
        arrow.setAttribute('aria-hidden','true');

        menuBtn.append(categoryLogo, label, arrow);

        const optionsMenu = document.createElement('div');
        optionsMenu.className='options-menu';
        optionsMenu.id = menuId;
        optionsMenu.hidden = true;

        triggerWrap.append(menuBtn, optionsMenu);

        const toggle = document.createElement('label');
        toggle.className='cat-switch';
        const input = document.createElement('input');
        input.type='checkbox';
        input.setAttribute('aria-label',`Toggle ${c.name} category`);
        const slider = document.createElement('span');
        slider.className='slider';
        toggle.append(input, slider);

        const subButtons = [];
        c.subs.forEach(s=>{
          const subBtn=document.createElement('button');
          subBtn.type='button';
          subBtn.className='subcategory-option';
          subBtn.dataset.category = c.name;
          subBtn.dataset.subcategory = s;
          const key = c.name+'::'+s;
          if(!allSubcategoryKeys.includes(key)){
            allSubcategoryKeys.push(key);
          }
          if(seedSubs){
            selection.subs.add(key);
          }
          const isSelected = selection.subs.has(key);
          subBtn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
          if(isSelected){
            subBtn.classList.add('on');
          }
          subBtn.innerHTML='<span class="subcategory-logo"></span><span class="subcategory-label"></span><span class="subcategory-switch" aria-hidden="true"><span class="track"></span><span class="thumb"></span></span>';
          const subLabel = subBtn.querySelector('.subcategory-label');
          if(subLabel){
            subLabel.textContent = s;
          }
          subBtn.addEventListener('click',()=>{
            if(!input.checked) return;
            const isActive = subBtn.getAttribute('aria-pressed') === 'true';
            if(isActive){
              subBtn.setAttribute('aria-pressed','false');
              subBtn.classList.remove('on');
              selection.subs.delete(key);
            } else {
              subBtn.setAttribute('aria-pressed','true');
              subBtn.classList.add('on');
              selection.subs.add(key);
            }
            applyFilters();
            updateCategoryResetBtn();
          });
          optionsMenu.appendChild(subBtn);
          subButtons.push(subBtn);
        });

        header.append(triggerWrap, toggle);
        el.appendChild(header);
        catsEl.appendChild(el);

        let openState = false;
        function syncExpanded(){
          const expanded = input.checked && openState;
          el.setAttribute('aria-expanded', expanded ? 'true' : 'false');
          menuBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
          optionsMenu.hidden = !expanded;
        }
        function setOpenState(next){
          openState = !!next;
          syncExpanded();
        }
        function setCategoryActive(active, opts={}){
          const enabled = !!active;
          input.checked = enabled;
          el.classList.toggle('cat-off', !enabled);
          menuBtn.disabled = !enabled;
          menuBtn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
          subButtons.forEach(btn=>{
            btn.disabled = !enabled;
            btn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
          });
          if(enabled){
            selection.cats.add(c.name);
          } else {
            selection.cats.delete(c.name);
            setOpenState(false);
          }
          syncExpanded();
          if(!opts.silent){
            applyFilters();
            updateResetBtn();
          }
          updateCategoryResetBtn();
        }
        menuBtn.addEventListener('click', ()=>{
          if(menuBtn.disabled) return;
          setOpenState(!openState);
        });
        input.addEventListener('change', ()=>{
          setCategoryActive(input.checked);
        });

        const controller = {
          name: c.name,
          element: el,
          setActive: (active, opts={})=> setCategoryActive(active, opts),
          setOpen: (open)=> setOpenState(open),
          getOpenState: ()=> openState,
          isActive: ()=> input.checked,
          syncSubs: ()=>{
            subButtons.forEach(btn=>{
              const subName = btn.dataset.subcategory;
              const key = c.name+'::'+subName;
              const selected = selection.subs.has(key);
              btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
              btn.classList.toggle('on', selected);
            });
          },
          refreshLogos: ()=>{
            if(categoryLogo){
              const catIconHtml = categoryIcons[c.name] || '';
              if(catIconHtml){
                categoryLogo.innerHTML = catIconHtml;
                categoryLogo.classList.add('has-icon');
              } else {
                categoryLogo.textContent = c.name.charAt(0) || '';
                categoryLogo.classList.remove('has-icon');
              }
            }
            subButtons.forEach(btn=>{
              const logoSpan = btn.querySelector('.subcategory-logo');
              if(!logoSpan) return;
              const iconHtml = subcategoryIcons[btn.dataset.subcategory] || '';
              if(iconHtml){
                logoSpan.innerHTML = iconHtml;
                logoSpan.classList.add('has-icon');
              } else {
                const label = btn.dataset.subcategory || '';
                logoSpan.textContent = label.charAt(0) || '';
                logoSpan.classList.remove('has-icon');
              }
            });
          }
        };
        categoryControllers[c.name] = controller;
        setCategoryActive(true, {silent:true});
        controller.syncSubs();
        syncExpanded();
      });
      refreshSubcategoryLogos();
      updateCategoryResetBtn();
      updateResetBtn();
    }
    if(catsEl){
      renderFilterCategories();
      renderFormbuilderCats();
      updateFormbuilderSnapshot();
      const handleIconsReady = ()=>{
        refreshSubcategoryLogos();
        refreshFormbuilderSubcategoryLogos();
      };
      document.addEventListener('subcategory-icons-ready', handleIconsReady);
    }

    if(resetCategoriesBtn){
      resetCategoriesBtn.addEventListener('click', ()=>{
        selection.subs = new Set(allSubcategoryKeys);
        Object.values(categoryControllers).forEach(ctrl=>{
          ctrl.setActive(true, {silent:true});
          ctrl.setOpen(false);
          ctrl.syncSubs();
        });
        applyFilters();
        updateResetBtn();
        updateCategoryResetBtn();
      });
    }

    // Reset
    $('#resetBtn').addEventListener('click',()=>{
      $('#keyword-textbox').value='';
      $('#daterange-textbox').value='';
      const minPriceInput = $('#min-price-input');
      const maxPriceInput = $('#max-price-input');
      if(minPriceInput) minPriceInput.value='';
      if(maxPriceInput) maxPriceInput.value='';
      const expired = $('#expiredToggle');
      if(expired){
        expired.checked = false;
        expiredWasOn = false;
      }
      dateStart = null;
      dateEnd = null;
      dateRangeWasCleared = true;
      buildFilterCalendar(minPickerDate, maxPickerDate);
      updateRangeClasses();
      updateInput();
      closeCalendarPopup();
      if(geocoder) geocoder.clear();
      applyFilters();
      updateClearButtons();
    });

    function updateClearButtons(){
      const kw = $('#keyword-textbox');
      const kwX = kw.parentElement.querySelector('.keyword-clear-button');
      kwX && kwX.classList.toggle('active', kw.value.trim() !== '');
      const minPriceInput = $('#min-price-input');
      const maxPriceInput = $('#max-price-input');
      const priceClear = $('#filterPanel .price-clear-button');
      const hasPrice = (minPriceInput && minPriceInput.value.trim() !== '') || (maxPriceInput && maxPriceInput.value.trim() !== '');
      priceClear && priceClear.classList.toggle('active', hasPrice);
      const date = $('#daterange-textbox');
      const dateX = date.parentElement.querySelector('.daterange-clear-button');
      const hasDate = (dateStart || dateEnd) || $('#expiredToggle').checked;
      dateX && dateX.classList.toggle('active', !!hasDate);
      updateResetBtn();
    }

    function nonLocationFiltersActive(){
      const kw = $('#keyword-textbox').value.trim() !== '';
      const raw = $('#daterange-textbox').value.trim();
      const hasDate = !!(dateStart || dateEnd || raw);
      const expired = $('#expiredToggle').checked;
      const {min, max} = getPriceFilterValues();
      const priceActive = min !== null || max !== null;
      return kw || hasDate || expired || priceActive;
    }

    function updateResetBtn(){
      const active = nonLocationFiltersActive();
      document.body.classList.toggle('filters-active', active);
      const reset = $('#resetBtn');
      reset && reset.classList.toggle('active', active);
    }

    function fmtShort(iso){
      return parseISODate(iso).toLocaleDateString('en-GB', {weekday:'short', day:'numeric', month:'short'}).replace(/,/g,'');
    }

    const dateRangeInput = $('#daterange-textbox');
    $('#keyword-textbox').addEventListener('input', ()=>{ applyFilters(); updateClearButtons(); });
    const minPriceInput = $('#min-price-input');
    const maxPriceInput = $('#max-price-input');
    [minPriceInput, maxPriceInput].forEach(input=>{
      if(!input) return;
      input.addEventListener('input', ()=>{
        const sanitized = input.value.replace(/\D+/g,'');
        if(sanitized !== input.value){ input.value = sanitized; }
        applyFilters();
        updateClearButtons();
      });
    });
    dateRangeInput?.addEventListener('input', ()=>{ applyFilters(); updateClearButtons(); });
    if(dateRangeInput){
      dateRangeInput.addEventListener('focus', ()=> openCalendarPopup());
      dateRangeInput.addEventListener('click', ()=> openCalendarPopup());
    }
    $('#daterange-textbox').addEventListener('keydown', e=>{
      if(e.key === 'Tab'){
        closeCalendarPopup();
        return;
      }
      if(e.key === 'Escape'){
        e.preventDefault();
        closeCalendarPopup();
        return;
      }
      if(e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown'){
        e.preventDefault();
        openCalendarPopup(true);
        return;
      }
      if(e.key==='ArrowLeft' || e.key==='ArrowRight'){
        e.preventDefault();
        openCalendarPopup();
        const month = calendarScroll ? calendarScroll.querySelector('.month') : null;
        const w = month ? month.offsetWidth : 0;
        if(calendarScroll && w){
          calendarScroll.scrollBy({left:e.key==='ArrowLeft'?-w:w, behavior:'smooth'});
        }
        return;
      }
      e.preventDefault();
    });
    const today = new Date();
    today.setHours(0,0,0,0);
    const minPickerDate = new Date(today);
    minPickerDate.setMonth(minPickerDate.getMonth() - 12);
    const maxPickerDate = new Date(today);
    maxPickerDate.setFullYear(maxPickerDate.getFullYear() + 2);
    const expiredToggle = $('#expiredToggle');
    const calendarScroll = $('#datePickerContainer');
    const filterBasics = $('#filterPanel .filter-basics-container');
    const filterPanelBody = $('#filterPanel .panel-body');
    let calendarPopupOpen = false;
    let calendarFirstOpen = true;
    let lastExpiredState = null;
    let dateRangeWasCleared = false;

    function positionCalendarPopup(){
      if(!calendarScroll || !dateRangeInput || !filterBasics) return;
      const inputRect = dateRangeInput.getBoundingClientRect();
      const containerRect = filterBasics.getBoundingClientRect();
      const left = inputRect.left - containerRect.left;
      const top = inputRect.bottom - containerRect.top + 8;
      const popupWidth = calendarScroll.offsetWidth || 0;
      const maxLeft = Math.max(0, containerRect.width - popupWidth);
      const clampedLeft = Math.min(Math.max(left, 0), maxLeft);
      calendarScroll.style.left = `${Math.round(clampedLeft)}px`;
      calendarScroll.style.top = `${Math.round(top)}px`;
    }

    function handleCalendarOutsideClick(e){
      if(!calendarScroll) return;
      if(calendarScroll.contains(e.target)) return;
      if(dateRangeInput && dateRangeInput.contains(e.target)) return;
      closeCalendarPopup();
    }

    function openCalendarPopup(focusCalendar = false){
      if(!calendarScroll) return;
      
      // Rebuild calendar only if expired state changed
      const expiredChecked = expiredToggle && expiredToggle.checked;
      if(lastExpiredState !== expiredChecked){
        lastExpiredState = expiredChecked;
        const minDate = expiredChecked ? minPickerDate : today;
        buildFilterCalendar(minDate, maxPickerDate);
        // Scroll to today after rebuild
        setTimeout(() => scrollCalendarToToday('auto'), 0);
      }
      
      if(!calendarPopupOpen){
        calendarPopupOpen = true;
        calendarScroll.classList.add('is-visible');
        calendarScroll.setAttribute('tabindex','0');
        calendarScroll.setAttribute('aria-hidden','false');
        if(dateRangeInput) dateRangeInput.setAttribute('aria-expanded','true');
        document.addEventListener('click', handleCalendarOutsideClick, true);
        window.addEventListener('resize', positionCalendarPopup);
        filterPanelBody?.addEventListener('scroll', positionCalendarPopup, { passive:true });
        
        // Scroll to today on first open, after clear, or expired state change
        if(calendarFirstOpen || dateRangeWasCleared){
          calendarFirstOpen = false;
          dateRangeWasCleared = false;
          setTimeout(() => scrollCalendarToToday('auto'), 0);
        }
      }
      
      positionCalendarPopup();
      if(focusCalendar){
        calendarScroll.focus({ preventScroll:true });
      }
    }

    function closeCalendarPopup(){
      if(!calendarScroll || !calendarPopupOpen) return;
      calendarPopupOpen = false;
      if(calendarScroll.contains(document.activeElement)){
        const activeEl = document.activeElement;
        if(activeEl && typeof activeEl.blur === 'function'){
          activeEl.blur();
        }
      }
      calendarScroll.setAttribute('tabindex','-1');
      calendarScroll.classList.remove('is-visible');
      calendarScroll.setAttribute('aria-hidden','true');
      if(dateRangeInput) dateRangeInput.setAttribute('aria-expanded','false');
      document.removeEventListener('click', handleCalendarOutsideClick, true);
      window.removeEventListener('resize', positionCalendarPopup);
      filterPanelBody?.removeEventListener('scroll', positionCalendarPopup);
    }

    function verticalCanScroll(el, delta){
      if(!el) return false;
      if(delta < 0) return el.scrollTop > 0;
      if(delta > 0) return el.scrollTop < el.scrollHeight - el.clientHeight;
      return false;
    }

    function setupHorizontalWheel(scroller){
      if(!scroller) return;
      scroller.addEventListener('wheel', e=>{
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if(delta !== 0){
          scroller.scrollLeft += delta;
          e.preventDefault();
        }
      }, {passive:false});
    }
    
    function setupCalendarScrollRestriction(){
      if(!calendarScroll) return;
      calendarScroll.addEventListener('scroll', ()=>{
        const expiredChecked = expiredToggle && expiredToggle.checked;
        if(!expiredChecked && calendarScroll.dataset.todayScroll){
          const todayScrollPos = parseFloat(calendarScroll.dataset.todayScroll) || 0;
          if(calendarScroll.scrollLeft < todayScrollPos){
            calendarScroll.scrollLeft = todayScrollPos;
          }
        }
      }, {passive:true});
    }

    function smoothScroll(el, to, duration=600){
      const start = el.scrollLeft;
      const change = to - start;
      const startTime = performance.now();
      function animate(time){
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        el.scrollLeft = start + change * progress;
        if(progress < 1) requestAnimationFrame(animate);
      }
      requestAnimationFrame(animate);
    }

    function setupCalendarScroll(scroller){
      if(!scroller) return;
      scroller.setAttribute('tabindex','0');
      setupHorizontalWheel(scroller);
      const container = scroller.closest('.calendar-container');
      const adjustScale = () => {
        if(!container) return;
        const base = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--calendar-width')) || 0;
        const available = container.parentElement ? container.parentElement.clientWidth : container.clientWidth;
        const scale = base ? Math.min(1, available / base) : 1;
        container.style.setProperty('--calendar-scale', scale);
        if(calendarPopupOpen){
          positionCalendarPopup();
        }
      };
      if('ResizeObserver' in window && container){
        const ro = new ResizeObserver(adjustScale);
        ro.observe(container);
      }
      adjustScale();
      scroller.addEventListener('keydown', e=>{
        if(e.key==='Escape'){
          e.preventDefault();
          closeCalendarPopup();
          dateRangeInput?.focus({ preventScroll:true });
          return;
        }
        if(e.key==='ArrowLeft' || e.key==='ArrowRight'){
          const m = scroller.querySelector('.month') || scroller.querySelector('.month-item');
          const w = m ? m.offsetWidth : 0;
          scroller.scrollLeft += e.key==='ArrowLeft'?-w:w;
          e.preventDefault();
        }
      });
        addPassiveScrollListener(scroller, ()=>{
          const marker = scroller.querySelector('.today-marker');
          if(marker){
            const base = parseFloat(marker.dataset.pos || '0');
            marker.style.left = `${base + Math.round(scroller.scrollLeft)}px`;
          }
        });
      }
      setupCalendarScroll(calendarScroll);
      expiredWasOn = expiredToggle && expiredToggle.checked;

    function scrollCalendarToToday(behavior='auto'){
      const calScroll = $('#datePickerContainer');
      if(!calScroll) return;
      const todayCell = calScroll.querySelector('.day.today');
      if(todayCell){
        const month = todayCell.closest('.month');
        const left = month ? month.offsetLeft : 0;
        calScroll.dataset.todayScroll = left;
        calScroll.scrollTo({left, behavior});
        const marker = calScroll.querySelector('.today-marker');
        if(marker){
          const base = parseFloat(marker.dataset.pos || '0');
          marker.style.left = `${base + left}px`;
        }
      }
    }
    window.scrollCalendarToToday = scrollCalendarToToday;

    function formatDisplay(date){
      const wd = date.toLocaleDateString('en-GB',{weekday:'short'});
      const day = date.getDate();
      const mon = date.toLocaleDateString('en-GB',{month:'short'});
      let str = `${wd} ${day} ${mon}`;
      if(date.getFullYear() !== today.getFullYear()) str += `, ${date.getFullYear()}`;
      return str;
    }

    function orderedRange(){
      if(dateStart && dateEnd){
        return dateStart <= dateEnd ? {start:dateStart,end:dateEnd} : {start:dateEnd,end:dateStart};
      }
      return {start:dateStart,end:dateEnd};
    }

    function sameDay(a,b){ return a.toDateString()===b.toDateString(); }
    function isToday(d){ return sameDay(d,today); }

    function updateRangeClasses(){
      const {start,end} = orderedRange();
      $('#datePicker').querySelectorAll('.day').forEach(day=>{
        const iso = day.dataset.iso;
        if(!iso) return;
        const [yy, mm, dd] = iso.split('-').map(Number);
        const d = new Date(yy, mm - 1, dd);
        day.classList.remove('selected','in-range','range-start','range-end');
        if(start && sameDay(d, start)) day.classList.add('selected','range-start');
        if(end && sameDay(d, end)) day.classList.add('selected','range-end');
        if(start && end && d>start && d<end) day.classList.add('in-range');
      });
    }

    function updateInput(){
      const input = $('#daterange-textbox');
      const {start,end} = orderedRange();
      if(start && end){
        input.value = `${formatDisplay(start)} - ${formatDisplay(end)}`;
      } else if(start){
        input.value = formatDisplay(start);
      } else {
        input.value = '';
      }
      applyFilters();
      updateClearButtons();
    }

    function selectRangeDate(date){
      if(!dateStart || dateEnd){ dateStart = date; dateEnd = null; }
      else { dateEnd = date; }
      updateRangeClasses();
      updateInput();
      if(dateEnd){
        closeCalendarPopup();
      }
    }

    function buildFilterCalendar(minDate, maxDate){
      const container = $('#datePicker');
      container.innerHTML='';
      const cal = document.createElement('div');
      cal.className='calendar';
      let current = new Date(minDate.getFullYear(), minDate.getMonth(),1);
      const end = new Date(maxDate.getFullYear(), maxDate.getMonth(),1);
      const todayDate = new Date();
      todayDate.setHours(0,0,0,0);
      let monthIndex = 0;
      let currentMonthIndex = 0;
      while(current <= end){
        const monthEl = document.createElement('div');
        monthEl.className='month';
        const header = document.createElement('div');
        header.className='calendar-header';
        header.textContent=current.toLocaleDateString('en-GB',{month:'long',year:'numeric'});
        monthEl.appendChild(header);
        const grid = document.createElement('div');
        grid.className='grid';

        const weekdays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        weekdays.forEach(wd=>{
          const w=document.createElement('div');
          w.className='weekday';
          w.textContent=wd;
          grid.appendChild(w);
        });

        const firstDay = new Date(current.getFullYear(), current.getMonth(),1);
        const startDow = firstDay.getDay();
        const daysInMonth = new Date(current.getFullYear(), current.getMonth()+1,0).getDate();
        const totalCells = 42;
        for(let i=0;i<totalCells;i++){
          const cell=document.createElement('div');
          cell.className='day';
          const dayNum=i-startDow+1;
          if(i<startDow || dayNum>daysInMonth){
            cell.classList.add('empty');
          }else{
            cell.textContent=dayNum;
            const date=new Date(current.getFullYear(), current.getMonth(), dayNum);
            const toISODate = window.toISODate || ((d) => {
              const y = d.getFullYear();
              const m = String(d.getMonth()+1).padStart(2,'0');
              const day = String(d.getDate()).padStart(2,'0');
              return `${y}-${m}-${day}`;
            });
            cell.dataset.iso = toISODate(date);
            if(date < todayDate) cell.classList.add('past');
            else cell.classList.add('future');
            if(isToday(date)) cell.classList.add('today');
            if(date >= minDate) cell.addEventListener('click', ()=> selectRangeDate(date));
          }
          grid.appendChild(cell);
        }
        monthEl.appendChild(grid);
        cal.appendChild(monthEl);
        if(current.getFullYear() === todayDate.getFullYear() && current.getMonth() === todayDate.getMonth()){
          currentMonthIndex = monthIndex;
        }
        current.setMonth(current.getMonth()+1);
        monthIndex++;
      }
      container.appendChild(cal);
      updateRangeClasses();
      if(calendarScroll){
        const monthWidth = cal.querySelector('.month').offsetWidth;
        const scrollPos = monthWidth * currentMonthIndex;
        const maxScroll = calendarScroll.scrollWidth - calendarScroll.clientWidth;
        const track = calendarScroll.clientWidth - 20;
        const pos = maxScroll ? scrollPos / maxScroll * track + 10 : 10;
        calendarScroll.querySelector('.today-marker')?.remove();
        const marker = document.createElement('div');
        marker.className = 'today-marker';
        marker.dataset.pos = pos;
        calendarScroll.appendChild(marker);
        marker.addEventListener('click', ()=> scrollCalendarToToday('smooth'));
      }
    }

    buildFilterCalendar(minPickerDate, maxPickerDate);
    setupCalendarScrollRestriction();
    closeCalendarPopup();

    $$('#filterPanel .keyword-clear-button, #filterPanel .daterange-clear-button, #filterPanel .price-clear-button').forEach(btn=> btn.addEventListener('click',()=>{
      if(btn.classList.contains('price-clear-button')){
        const minInputEl = $('#min-price-input');
        const maxInputEl = $('#max-price-input');
        if(minInputEl) minInputEl.value='';
        if(maxInputEl) maxInputEl.value='';
        (minInputEl || maxInputEl)?.focus();
        applyFilters();
        updateClearButtons();
        return;
      }
      const input = btn.parentElement.querySelector('input');
      if(input){
        if(input.id==='daterange-textbox'){
          dateStart = null;
          dateEnd = null;
          updateRangeClasses();
          updateInput();
          const expiredToggle = $('#expiredToggle');
          if(expiredToggle) expiredToggle.checked = false;
          dateRangeWasCleared = true;
        } else {
          input.value='';
          input.focus();
        }
        applyFilters();
        updateClearButtons();
      }
    }));
    if(expiredToggle){
      expiredToggle.addEventListener('change', ()=>{
        const input = $('#daterange-textbox');
        const todayDate = new Date();
        todayDate.setHours(0,0,0,0);
        dateStart = null;
        dateEnd = null;
        if(expiredToggle.checked){
          buildFilterCalendar(minPickerDate, maxPickerDate);
        } else {
          buildFilterCalendar(todayDate, maxPickerDate);
        }
        expiredWasOn = expiredToggle.checked;
        updateRangeClasses();
        updateInput();
        closeCalendarPopup();
      });
      if(expiredToggle.checked){
        expiredToggle.dispatchEvent(new Event('change'));
      }
    }
    updateClearButtons();
    updateResetBtn();
    const optionsBtn = $('#optionsBtn');
    const optionsMenu = $('#optionsMenu');
    const favToggle = $('#favToggle');
    const sortButtons = $$('.sort-option');

    function updateSortBtnLabel(text){
      const hasMultiple = optionsMenu.querySelectorAll('button').length > 1;
      if(hasMultiple){
        optionsBtn.innerHTML = `${text}<span class="results-arrow" aria-hidden="true"></span>`;
      } else {
        optionsBtn.textContent = text;
      }
    }

    updateSortBtnLabel(optionsBtn.textContent);

    favToggle.addEventListener('click', ()=>{
      favToTop = !favToTop;
      favSortDirty = favToTop ? false : true;
      favToggle.setAttribute('aria-pressed', favToTop);
      renderLists(filtered);
    });

    sortButtons.forEach(btn=>{
      btn.addEventListener('click', ()=>{
        currentSort = btn.dataset.sort;
        sortButtons.forEach(b=> b.setAttribute('aria-pressed', b===btn ? 'true' : 'false'));
        updateSortBtnLabel(btn.textContent);
        renderLists(filtered);
      });
    });

    optionsBtn.addEventListener('click', e=>{
      e.stopPropagation();
      const open = !optionsMenu.hasAttribute('hidden');
      if(open){
        optionsMenu.setAttribute('hidden','');
        optionsBtn.setAttribute('aria-expanded','false');
      } else {
        optionsMenu.removeAttribute('hidden');
        optionsBtn.setAttribute('aria-expanded','true');
      }
    });
    optionsMenu.addEventListener('click', e=> e.stopPropagation());
      document.addEventListener('click', ()=>{
        optionsMenu.setAttribute('hidden','');
        optionsBtn.setAttribute('aria-expanded','false');
      });

      const recentsBoard = $('#recentsBoard');
      const adBoard = $('.ad-board');
      const boardsContainer = $('.post-mode-boards');
      const postBoard = $('.post-board');
      const recentsButton = $('#recents-button');
      const postsButton = $('#posts-button');
      const mapButton = $('#map-button');
      const boardDisplayCache = new WeakMap();
      let boardsInitialized = false;
      let userClosedPostBoard = false;
      const WIDE_SCREEN_CLUSTER_MIN_WIDTH = 1200;

      function isWideScreenPostBoard(){
        return window.innerWidth >= WIDE_SCREEN_CLUSTER_MIN_WIDTH;
      }

      function autoOpenPostBoardForCluster({ multiIds = [], multiCount = 0, trigger = 'click' } = {}){
        if(trigger !== 'click' && trigger !== 'touch') return;
        if(userClosedPostBoard) return;
        if(!isWideScreenPostBoard()) return;
        const normalizedIds = Array.isArray(multiIds)
          ? multiIds.map(id => String(id)).filter(Boolean)
          : [];
        const numericCount = Number(multiCount);
        const normalizedCount = Number.isFinite(numericCount) && numericCount > 0 ? numericCount : 0;
        const total = Math.max(normalizedIds.length, normalizedCount, 0);
        if(total <= 1) return;
        if(typeof setMode !== 'function') return;
        const wasPostsMode = document.body.classList.contains('mode-posts');
        const hadHistory = document.body.classList.contains('show-history');
        if(hadHistory){
          document.body.classList.remove('show-history');
        }
        if(!wasPostsMode){
          setMode('posts');
        } else if(hadHistory && typeof adjustBoards === 'function'){
          adjustBoards();
        }
      }

      window.updatePostsButtonState = function(currentZoom){
        const threshold = MARKER_ZOOM_THRESHOLD;
        let zoomValue = Number.isFinite(currentZoom) ? currentZoom : null;
        if(!Number.isFinite(zoomValue) && map && typeof map.getZoom === 'function'){
          try{ zoomValue = map.getZoom(); }catch(err){ zoomValue = null; }
        }
        const postsEnabled = Number.isFinite(zoomValue) ? zoomValue >= threshold : false;
        if(postsButton){
          postsButton.setAttribute('aria-disabled', postsEnabled ? 'false' : 'true');
          postsButton.classList.toggle('is-disabled', !postsEnabled);
        }
        document.body.classList.toggle('hide-posts-ui', !postsEnabled);
        if(!postsEnabled){
          if(typeof setMode === 'function' && document.body.classList.contains('mode-posts')){
            setMode('map', true);
          }
          document.body.classList.remove('show-history');
          if(typeof adjustBoards === 'function'){ adjustBoards(); }
          if(typeof updateModeToggle === 'function'){ updateModeToggle(); }
        }
      };

      if(typeof window.updatePostsButtonState === 'function'){
        const startZoom = window.startZoom || 1.5;
        window.updatePostsButtonState(startZoom);
      }

      // Add click handler for disabled posts button
      if(postsButton){
        postsButton.addEventListener('click', (e) => {
          if(postsButton.classList.contains('is-disabled')){
            e.preventDefault();
            e.stopPropagation();
            showZoomToast();
            return false;
          }
        }, true);
      }

      async function showZoomToast(){
        let toast = document.getElementById('zoom-toast');
        if(!toast){
          toast = document.createElement('div');
          toast.id = 'zoom-toast';
          toast.className = 'zoom-toast';
          document.body.appendChild(toast);
        }
        
        const msg = await getMessage('msg_map_zoom_required', {}, false) || 'Zoom the map to see posts';
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => {
          toast.classList.remove('show');
        }, 2000);
      }

      function getDefaultBoardDisplay(board){
        if(!board) return 'block';
        if(boardDisplayCache.has(board)) return boardDisplayCache.get(board);
        let value = '';
        try{
          value = getComputedStyle(board).display;
        }catch(err){ value = ''; }
        if(!value || value === 'none'){
          if(board.classList.contains('post-board')) value = 'flex';
          else if(board.classList.contains('ad-board')) value = 'block';
          else value = 'block';
        }
        boardDisplayCache.set(board, value);
        return value;
      }

      function clearBoardHide(board){
        if(!board) return;
        if(board._boardHideHandler){
          board.removeEventListener('transitionend', board._boardHideHandler);
          board._boardHideHandler = null;
        }
        if(board._boardHideTimer){
          clearTimeout(board._boardHideTimer);
          board._boardHideTimer = null;
        }
      }

      function showBoard(board, immediate=false){
        if(!board) return;
        clearBoardHide(board);
        const defaultDisplay = getDefaultBoardDisplay(board);
        board.style.display = defaultDisplay;
        board.setAttribute('aria-hidden','false');
        if(immediate){
          board.classList.add('panel-visible');
          board.style.transform = '';
        } else {
          const wasHidden = !board.classList.contains('panel-visible');
          schedulePanelEntrance(board, wasHidden);
        }
      }

      function hideBoard(board, immediate=false){
        if(!board) return;
        clearBoardHide(board);
        board.setAttribute('aria-hidden','true');
        const finalize = ()=>{
          board.style.display = 'none';
          board._boardHideHandler = null;
          board._boardHideTimer = null;
          try{
            board.style.removeProperty('transform');
          }catch(err){}
        };
        if(immediate){
          board.classList.remove('panel-visible');
          finalize();
          return;
        }
        if(!board.classList.contains('panel-visible')){
          finalize();
          return;
        }
        const handler = event=>{
          if(event && event.target !== board) return;
          board.removeEventListener('transitionend', handler);
          finalize();
        };
        board._boardHideHandler = handler;
        board.addEventListener('transitionend', handler);
        const removeVisible = ()=>{
          if(!board.isConnected){
            board.removeEventListener('transitionend', handler);
            finalize();
            return;
          }
          board.classList.remove('panel-visible');
        };
        if('requestAnimationFrame' in window){
          requestAnimationFrame(removeVisible);
        } else {
          removeVisible();
        }
        board._boardHideTimer = setTimeout(()=>{
          if(board._boardHideHandler){
            board._boardHideHandler();
          }
        }, 400);
      }

      function toggleBoard(board, shouldShow, immediate=false){
        if(shouldShow){
          showBoard(board, immediate);
        } else {
          hideBoard(board, immediate);
        }
      }

      function updateModeToggle(){
        const historyActive = document.body.classList.contains('show-history');
        const isPostsMode = document.body.classList.contains('mode-posts');
        const isMapMode = document.body.classList.contains('mode-map');
        if(recentsButton){
          recentsButton.setAttribute('aria-pressed', historyActive ? 'true' : 'false');
        }
        if(postsButton){
          postsButton.setAttribute('aria-pressed', !historyActive && isPostsMode ? 'true' : 'false');
        }
        if(mapButton){
          mapButton.setAttribute('aria-pressed', isMapMode ? 'true' : 'false');
        }
      }

      function adjustBoards(){
        const small = window.innerWidth < 1200;
        const historyActive = document.body.classList.contains('show-history');
        const isPostsMode = document.body.classList.contains('mode-posts');
        const filterPanel = document.getElementById('filterPanel');
        const filterContent = filterPanel ? filterPanel.querySelector('.panel-content') : null;
        const pinBtn = filterPanel ? filterPanel.querySelector('.pin-panel') : null;
        const filterPinned = !!(filterPanel && filterPanel.classList.contains('show') && pinBtn && pinBtn.getAttribute('aria-pressed') === 'true');
        const historyOpenPost = recentsBoard ? recentsBoard.querySelector('.open-post') : null;
        const postsOpenPost = postBoard ? postBoard.querySelector('.open-post') : null;
        const anyOpenPost = historyOpenPost || postsOpenPost;
        const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap')) || 10;
        let filterWidth = filterPinned && filterContent ? filterContent.getBoundingClientRect().width : 0;
        const postWidth = postBoard ? (postBoard.offsetWidth || 530) : 0;
        const historyWidth = recentsBoard ? (recentsBoard.offsetWidth || 530) : 0;
        const boardsWidths = [];
        if(historyActive && recentsBoard){
          boardsWidths.push(historyWidth);
        } else if(postBoard){
          boardsWidths.push(postWidth);
        }
        let totalBoardsWidth = boardsWidths.reduce((sum, w)=> sum + w, 0);
        if(boardsWidths.length > 1){
          totalBoardsWidth += gap * (boardsWidths.length - 1);
        }
        const adWidth = adBoard ? (adBoard.offsetWidth || 440) : 0;
        const shouldShowAds = adBoard && window.innerWidth >= 1900;
        let hideAds = !shouldShowAds || !isPostsMode;
        let requiredWidth = totalBoardsWidth;
        if(filterPinned && filterWidth){
          requiredWidth += filterWidth;
        } else {
          filterWidth = 0;
        }
        if(shouldShowAds && adWidth){
          requiredWidth += adWidth + gap;
        }
        const canAnchor = filterPinned && filterWidth && requiredWidth <= window.innerWidth;
        document.body.classList.toggle('filter-anchored', canAnchor);
        document.documentElement.style.setProperty('--filter-panel-offset', canAnchor ? `${filterWidth}px` : '0px');
        boardsContainer.style.justifyContent = 'flex-start';
        const skipAnimation = !boardsInitialized;
        toggleBoard(recentsBoard, isPostsMode && historyActive, skipAnimation);
        toggleBoard(postBoard, isPostsMode && !historyActive, skipAnimation);
        document.body.classList.toggle('detail-open', !!anyOpenPost);
        if(adBoard){
          toggleBoard(adBoard, isPostsMode && !hideAds && shouldShowAds, skipAnimation);
        }
        document.body.classList.toggle('hide-ads', hideAds);
        updateModeToggle();
        boardsInitialized = true;
      }
      window.adjustBoards = adjustBoards;
      adjustBoards();
      window.addEventListener('resize', adjustBoards);
      window.adjustListHeight();
        setTimeout(()=>{
          if(map && typeof map.resize === 'function'){
            map.resize();
            updatePostPanel();
            applyFilters();
          }
        }, 0);

      recentsButton && recentsButton.addEventListener('click', ()=>{
        const isPostsMode = document.body.classList.contains('mode-posts');
        const historyActive = document.body.classList.contains('show-history');
        if(isPostsMode && historyActive){
          userClosedPostBoard = true;
          setModeFromUser('map');
          return;
        }
        setMode('posts');
        document.body.classList.add('show-history');
        renderHistoryBoard();
        adjustBoards();
        setTimeout(()=>{
          if(map && typeof map.resize === 'function'){
            map.resize();
            updatePostPanel();
          }
        }, 300);
        updateModeToggle();
      });

      postsButton && postsButton.addEventListener('click', ()=>{
        const historyActive = document.body.classList.contains('show-history');
        const isPostsMode = document.body.classList.contains('mode-posts');
        if(isPostsMode && !historyActive){
          userClosedPostBoard = true;
          setModeFromUser('map');
          return;
        }
        document.body.classList.remove('show-history');
        if(!isPostsMode || historyActive){
          setMode('posts');
          setTimeout(()=>{
            if(map && typeof map.resize === 'function'){
              map.resize();
              updatePostPanel();
            }
          }, 0);
        } else {
          updateModeToggle();
        }
      });

      mapButton && mapButton.addEventListener('click', ()=>{
        const isMapMode = document.body.classList.contains('mode-map');
        if(!isMapMode){
          userClosedPostBoard = true;
          setModeFromUser('map');
        } else if(document.body.classList.contains('show-history')){
          document.body.classList.remove('show-history');
          adjustBoards();
          updateModeToggle();
        }
      });

    function buildDetail(p, existingCard = null, isRecentsBoard = false){
      const locationList = Array.isArray(p.locations) ? p.locations : [];
      const loc0 = locationList[0] || {};
      const selectSuffix = '<span style="display:inline-block;margin-left:10px;">(Select Session)</span>';
      const loc0Dates = Array.isArray(loc0.dates)
        ? loc0.dates.slice().sort((a,b)=> (a.full||'').localeCompare(b.full||''))
        : [];
      const basePrice = loc0 && loc0.price !== undefined ? loc0.price : '';
      const defaultInfo = loc0Dates.length
        ? `💲 ${basePrice} | 📅 ${loc0Dates[0].date} - ${loc0Dates[loc0Dates.length-1].date}${selectSuffix}`
        : `💲 ${basePrice}${selectSuffix}`;
      const thumbSrc = thumbUrl(p);
      const posterName = p.member ? p.member.username : 'Anonymous';
      const postedTime = formatPostTimestamp(p.created);
      const postedMeta = postedTime ? `Posted by ${posterName} · ${postedTime}` : `Posted by ${posterName}`;
      
      // Create wrapper for open post
      const wrap = document.createElement('div');
      wrap.className = 'open-post post-collapsed';
      wrap.dataset.id = p.id;
      
      // Use existing card or create new one - preserve type (recents-card vs post-card)
      let cardEl = existingCard;
      const isValidCard = cardEl && (cardEl.classList.contains('post-card') || cardEl.classList.contains('recents-card'));
      if(!isValidCard){
        cardEl = card(p, !isRecentsBoard);
      }
      
      // Remove any highlight classes and force #1f2750 background
      if(cardEl){
        cardEl.classList.remove('is-map-highlight');
        cardEl.style.background = '#1f2750';
        if(cardEl.dataset){
          cardEl.dataset.surfaceBg = '#1f2750';  // Update the stored background so restoration uses correct color
          delete cardEl.dataset.prevHighlightBackground;
        }
      }
      
      // Add share button ONLY if it doesn't exist (preserves existing card state)
      if(cardEl && !cardEl.querySelector('.share')){
        const cardActions = cardEl.querySelector('.card-actions');
        if(cardActions){
          const shareBtn = document.createElement('button');
          shareBtn.className = 'share';
          shareBtn.setAttribute('aria-label', 'Share post');
          shareBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.06-.23.09-.46.09-.7s-.03-.47-.09-.7l7.13-4.17A2.99 2.99 0 0 0 18 9a3 3 0 1 0-3-3c0 .24.03.47.09.7L7.96 10.87A3.003 3.003 0 0 0 6 10a3 3 0 1 0 3 3c0-.24-.03-.47-.09-.7l7.13 4.17c.53-.5 1.23-.81 1.96-.81a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>';
          cardActions.appendChild(shareBtn);
        }
      }
      
      // Create post body
      const postBody = document.createElement('div');
      postBody.className = 'post-body';
      postBody.innerHTML = `
        <div class="post-nav-buttons">
          <button class="venue-menu-button" type="button" aria-label="View Map" aria-haspopup="true" aria-expanded="false" data-nav="map">
            <img src="assets/Map Screenshot.png" alt="Map view">
            <span class="venue-name">${loc0.venue||''}</span><span class="address_line">${loc0.address||''}</span>${locationList.length>1?'<span class="results-arrow" aria-hidden="true"></span>':''}
          </button>
          <button class="session-menu-button" type="button" aria-label="View Calendar" aria-haspopup="true" aria-expanded="false" data-nav="calendar">
            <img src="assets/Calendar Screenshot.png" alt="Calendar view">
          </button>
        </div>
        <div id="venue-${p.id}" class="venue-dropdown options-dropdown"><div class="venue-menu post-venue-menu" hidden><div class="map-container"><div id="map-${p.id}" class="post-map"></div></div><div class="venue-options">${locationList.map((loc,i)=>`<button data-index="${i}"><span class="venue-name">${loc.venue}</span><span class="address_line">${loc.address}</span></button>`).join('')}</div></div></div>
        <div id="sess-${p.id}" class="session-dropdown options-dropdown"><div class="session-menu options-menu" hidden><div class="calendar-container"><div class="calendar-scroll"><div id="cal-${p.id}" class="post-calendar"></div></div></div><div class="session-options"></div></div></div>
        <div class="post-details">
          <div class="post-venue-selection-container"></div>
          <div class="post-session-selection-container"></div>
          <div class="post-details-info-container">
            <div id="venue-info-${p.id}" class="venue-info"></div>
            <div id="session-info-${p.id}" class="session-info">
              <div>${defaultInfo}</div>
            </div>
          </div>
          <div class="post-details-description-container">
            <div class="desc-wrap"><div class="desc" tabindex="0" aria-expanded="false">${p.desc}</div></div>
            <div class="member-avatar-row"><img src="${memberAvatarUrl(p)}" alt="${posterName} avatar" width="50" height="50"/><span>${postedMeta}</span></div>
          </div>
        </div>
        <div class="post-images">
          <div class="image-box"><div class="image-track"><img id="hero-img" class="lqip" src="${thumbSrc}" data-full="${heroUrl(p)}" alt="" loading="eager" fetchpriority="high" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='${thumbSrc}';"/></div></div>
          <div class="thumbnail-row"></div>
        </div>`;
      
      // Assemble the structure
      wrap.appendChild(cardEl);
      wrap.appendChild(postBody);
      
      // Add click handler to card to toggle post body
      cardEl.addEventListener('click', (e) => {
        // Don't trigger if clicking on buttons or their children
        if(e.target.closest('button, [role="button"], a, .fav, .share')) return;
        wrap.classList.toggle('post-collapsed');
      });
      
      // Set up favorites button handler for the card in open post
      const favBtnInCard = cardEl.querySelector('.fav');
      if(favBtnInCard && !favBtnInCard._favHandlerBound){
        favBtnInCard.addEventListener('click', (e)=>{
          e.stopPropagation();
          e.preventDefault();
          p.fav = !p.fav;
          favSortDirty = true;
          document.querySelectorAll(`[data-id="${p.id}"] .fav`).forEach(btn=>{
            btn.setAttribute('aria-pressed', p.fav ? 'true' : 'false');
          });
          renderHistoryBoard();
        });
        favBtnInCard._favHandlerBound = true;
      }
      
      // Store animation trigger function on the wrap element
      // This will be called after scroll completes to prevent flicker
      wrap._triggerAnimation = () => {
        wrap.classList.remove('post-collapsed');
        wrap.classList.add('post-expanding');
        setTimeout(() => {
          wrap.classList.remove('post-expanding');
        }, 350);
      };
      
      // Don't auto-trigger animation - wait for scroll to complete first
      // Animation will be triggered from openPost after scroll
      
      // Progressive hero swap
      (function(){
        const img = wrap.querySelector('#hero-img');
        if(img){
          const full = img.getAttribute('data-full');
          const hi = new Image();
          hi.referrerPolicy = 'no-referrer';
          hi.fetchPriority = 'high';
          hi.onload = ()=>{
            const swap = ()=>{ img.src = full; img.classList.remove('lqip'); img.classList.add('ready'); };
            if(hi.decode){ hi.decode().then(swap).catch(swap); } else { swap(); }
          };
          hi.onerror = ()=>{};
          hi.src = full;
        }
      })();
      
      return wrap;
    }

      function ensurePostCardForId(id){
        if(!postsWideEl) return null;
        
        // Check if there's already an open post - if so, don't trigger a full reload
        const hasOpenPost = postsWideEl.querySelector('.open-post');
        
        if(!postSentinel || !postsWideEl.contains(postSentinel)){
          // Only do a full renderLists if there's no open post
          if(!hasOpenPost){
            renderLists(filtered);
          } else {
            // If there's an open post, just ensure the sentinel exists without clearing everything
            if(!postSentinel || !postsWideEl.contains(postSentinel)){
              postSentinel = document.createElement('div');
              postSentinel.style.height = '1px';
              postsWideEl.appendChild(postSentinel);
            }
          }
        }
        let cardEl = postsWideEl.querySelector(`.post-card[data-id="${id}"]`);
        if(cardEl) return cardEl;

        const index = sortedPostList.findIndex(item => item && item.id === id);
        if(index === -1) return null;

        while(renderedPostCount <= index){
          const before = renderedPostCount;
          appendPostBatch();
          cardEl = postsWideEl.querySelector(`.post-card[data-id="${id}"]`);
          if(cardEl) return cardEl;
          if(renderedPostCount === before) break;
        }

        return postsWideEl.querySelector(`.post-card[data-id="${id}"]`);
      }

      async function openPost(id, fromHistory=false, fromMap=false, originEl=null){
        // ========================================================================
        // ENTRY POINT TRACKING
        // ========================================================================
        let entryPoint = 'unknown';
        if(fromHistory && originEl && originEl.classList.contains('recents-card')){
          entryPoint = 'recents-card';
        } else if(!fromHistory && !fromMap && originEl && originEl.classList.contains('post-card')){
          entryPoint = 'post-card';
        } else if(fromMap){
          entryPoint = 'map-marker';
        } else if(!fromHistory && !fromMap && !originEl){
          entryPoint = 'ad-board'; // Ad board calls without originEl
        }
        console.log(`[openPost] Entry Point: ${entryPoint}`, {
          id,
          fromHistory,
          fromMap,
          hasOriginEl: !!originEl,
          originElClass: originEl ? originEl.className : null
        });
        
        lockMap(false);
        touchMarker = null;
        if(hoverPopup){
          let shouldRemovePopup = true;
          if(fromMap && typeof popupIsHovered === 'function'){
            try{
              if(popupIsHovered(hoverPopup)){
                shouldRemovePopup = false;
              }
            }catch(err){
              shouldRemovePopup = true;
            }
          }
          if(shouldRemovePopup){
            runOverlayCleanup(hoverPopup);
            try{ hoverPopup.remove(); }catch(err){}
            hoverPopup = null;
          }
        }
        spinEnabled = false;
        localStorage.setItem('spinGlobe', 'false');
        stopSpin();
        const p = getPostByIdAnywhere(id); if(!p) return;
        activePostId = id;
        selectedVenueKey = null;
        updateSelectedMarkerRing();

        if(!fromHistory){
          if(document.body.classList.contains('show-history')){
            document.body.classList.remove('show-history');
            adjustBoards();
            updateModeToggle();
          }
          if(mode !== 'posts'){
            setMode('posts', true);
            await nextFrame();
          }
        }
        $$('.recents-card[aria-selected="true"], .post-card[aria-selected="true"]').forEach(el=>el.removeAttribute('aria-selected'));
        $$('.mapboxgl-popup.big-map-card .big-map-card[aria-selected="true"]').forEach(el=>el.removeAttribute('aria-selected'));

        const container = fromHistory ? document.getElementById('recentsBoard') : postsWideEl;
        if(!container){
          console.error('[openPost] Container not found!', { fromHistory, postsWideEl: !!postsWideEl, recentsBoard: !!document.getElementById('recentsBoard') });
          return;
        }
        
        // Capture scroll position EARLY - before any DOM operations that might reset it
        const earlyScrollTop = container.scrollTop;
        const earlyScrollHeight = container.scrollHeight;
        const earlyClientHeight = container.clientHeight;
        
        console.log(`[openPost] Container selected: ${container.id || container.className}`, {
          containerId: container.id,
          containerClass: container.className,
          isRecentsBoard: container.id === 'recentsBoard',
          isPostBoard: container === postsWideEl,
          earlyScrollTop,
          earlyScrollHeight,
          earlyClientHeight,
          wasScrolled: earlyScrollTop > 0
        });

        const alreadyOpen = container.querySelector(`.open-post[data-id="${id}"]`);
        if(alreadyOpen){
          return;
        }

        if(originEl && !container.contains(originEl)){
          originEl = null;
        }
        let target = originEl || container.querySelector(`[data-id="${id}"]`);

        // ========================================================================
        // CLOSE PREVIOUS OPEN POST
        // ========================================================================
        (function(){
          const ex = container.querySelector('.open-post');
          if(ex){
            
            const seenDetailMaps = new Set();
            const cleanupDetailMap = node=>{
              if(!node || !node._detailMap) return;
              const ref = node._detailMap;
              if(!seenDetailMaps.has(ref)){
                if(ref.resizeHandler){
                  window.removeEventListener('resize', ref.resizeHandler);
                }
                if(ref.map && typeof ref.map.remove === 'function'){
                  ref.map.remove();
                }
                seenDetailMaps.add(ref);
              }
              if(ref){
                ref.map = null;
                ref.resizeHandler = null;
              }
              if(node && node.__map){
                node.__map = null;
              }
              delete node._detailMap;
            };
            cleanupDetailMap(ex);
            const mapNode = ex.querySelector('.post-map');
            if(mapNode){
              cleanupDetailMap(mapNode);
            }
            const exId = ex.dataset && ex.dataset.id;
            // Preserve the existing card from the open post instead of creating a new one
            const existingCard = ex.querySelector('.post-card, .recents-card');
            if(existingCard){
              // Remove share button if it was added
              const shareBtn = existingCard.querySelector('.share');
              if(shareBtn) shareBtn.remove();
              // Restore original card background
              existingCard.style.background = CARD_SURFACE;
              if(existingCard.dataset){
                existingCard.dataset.surfaceBg = CARD_SURFACE;
              }
              ex.replaceWith(existingCard);
            } else {
              const prev = getPostByIdAnywhere(exId);
              if(prev){ ex.replaceWith(card(prev, fromHistory ? false : true)); } else { ex.remove(); }
            }
          }
        })();

        if(originEl && !container.contains(originEl)){
          originEl = null;
        }
        target = originEl || container.querySelector(`[data-id="${id}"]`);

        const pointerEvt = window.__lastPointerDown;
        let pointerTarget = null;
        if(pointerEvt && pointerEvt.target instanceof Element){
          let consider = true;
          if(typeof pointerEvt.timeStamp === 'number'){
            const nowTs = (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
            const evtTs = pointerEvt.timeStamp;
            if(typeof evtTs === 'number'){
              const diff = nowTs - evtTs;
              if(Number.isFinite(diff) && (diff > 2000 || diff < -2000)){
                consider = false;
              }
            }
          }
          if(consider){
            pointerTarget = pointerEvt.target;
          }
        }
        const pointerCard = pointerTarget ? pointerTarget.closest('.post-card, .recents-card') : null;
        const pointerInsideCardContainer = pointerCard && container.contains(pointerCard);
        const shouldReorderToTop = false; // Never reorder posts - maintain sort order

        if(!target && !fromHistory){
          target = ensurePostCardForId(id);
        }

        if(!target){
          target = card(p, fromHistory ? false : true);
          if(!fromHistory && container === postsWideEl){
            if(postSentinel && postSentinel.parentElement === container){
              container.insertBefore(target, postSentinel);
            } else {
              container.appendChild(target);
            }
          } else {
            container.prepend(target);
          }
        } else if(shouldReorderToTop && container.contains(target) && !pointerInsideCardContainer){
          const firstCard = container.querySelector('.open-post, .post-card, .recents-card');
          if(firstCard && firstCard !== target){
            container.insertBefore(target, firstCard);
          } else if(!firstCard){
            container.prepend(target);
          }
        }
        const resCard = resultsEl ? resultsEl.querySelector(`[data-id="${id}"]`) : null;
        if(resCard){
          resCard.setAttribute('aria-selected','true');
          if(fromMap){
            const qb = resCard.closest('.quick-list-board');
            if(qb){
              // intentionally skipping automatic scrolling
            }
          }
        }
        const mapCard = document.querySelector('.mapboxgl-popup.big-map-card .big-map-card');
        if(mapCard) mapCard.setAttribute('aria-selected','true');

        // Store position before buildDetail modifies DOM
        const targetParent = target.parentElement;
        const targetNext = target.nextSibling;
        const isCardValid = target && target.classList && (target.classList.contains('post-card') || target.classList.contains('recents-card'));
        
        // Scroll the card to the top BEFORE converting it to open-post
        // Find the actual scrollable element
        let scrollElement = container;
        if(container === postsWideEl || container.classList.contains('post-board')){
          const postsEl = container.querySelector('.posts');
          if(postsEl){
            scrollElement = postsEl;
          }
        }
        
        // Scroll the card to the top of the scroll container - ALWAYS scroll to top
        // This prevents posts from opening where they are instead of at the top
        if(scrollElement && typeof scrollElement.scrollTop !== 'undefined'){
          // Always scroll to top immediately - no delays
          scrollElement.scrollTop = 0;
        }
        
        // Pass the existing target card to buildDetail to preserve it without recreating
        const detail = buildDetail(p, isCardValid ? target : null, fromHistory);
        
        // If target wasn't reused, remove it
        if(!isCardValid && target.parentElement){
          target.remove();
        }
        
        // Insert detail at the original position
        if(targetNext && targetNext.parentElement === targetParent){
          targetParent.insertBefore(detail, targetNext);
        } else if(targetParent){
          targetParent.appendChild(detail);
        } else {
          container.appendChild(detail);
        }
        
        hookDetailActions(detail, p);
        if (typeof updateStickyImages === 'function') {
          updateStickyImages();
        }
        if (typeof initPostLayout === 'function') {
          initPostLayout(container);
          if (typeof updateStickyImages === 'function') {
            updateStickyImages();
          }
        }

        await nextFrame();

        // Update history on open (keep newest-first)
        viewHistory = viewHistory.filter(x=>x.id!==id);
        viewHistory.unshift({id:p.id, title:p.title, url:postUrl(p), lastOpened: Date.now()});
        if(viewHistory.length>100) viewHistory.length=100;
        saveHistory();
        if(!fromHistory){
          renderHistoryBoard();
        }

        // Ensure all layout operations complete before scrolling
        if(typeof window.adjustBoards === 'function'){
          window.adjustBoards();
        }
        if(typeof window.adjustListHeight === 'function'){
          window.adjustListHeight();
        }

        // Ensure scroll is at top after layout operations
        // The card should already be scrolled to top, but verify and adjust if needed
        const scrollToTop = (attempt = 1) => {
          if(!container){
            console.warn(`[openPost] Scroll attempt ${attempt}: Container missing`);
            return;
          }
          
          // Find the actual scrollable element
          // For post-board: .posts element is scrollable (has overflow-y: auto)
          // For recents-board: container itself is scrollable
          let scrollElement = container;
          if(container === postsWideEl || container.classList.contains('post-board')){
            // Post board - find the .posts element inside
            const postsEl = container.querySelector('.posts');
            if(postsEl){
              scrollElement = postsEl;
            }
          }
          // For recents-board, container itself is scrollable, so use it directly
          
          // Find the open-post element that was just created
          // The card becomes the header (sticky top:0) and post-body slides out underneath
          const openPostEl = container.querySelector(`.open-post[data-id="${id}"]`);
          
          const beforeScroll = scrollElement.scrollTop;
          const scrollHeight = scrollElement.scrollHeight;
          const clientHeight = scrollElement.clientHeight;
          const canScroll = scrollHeight > clientHeight;
          
          if(scrollElement && typeof scrollElement.scrollTop !== 'undefined'){
            // Ensure we're at the top - use instant scroll for final positioning
            // (The smooth scroll should have already happened, this is just a safety check)
            if(beforeScroll > 5){
              scrollElement.scrollTop = 0;
            }
            
            const afterScroll = scrollElement.scrollTop;
            // Success if we scrolled to the top (or very close to it, within 5px tolerance)
            const scrollSuccess = afterScroll <= 5;
            
            // Enhanced logging with inline values for easy reading
            const containerName = container.id || container.className;
            const scrollElementName = scrollElement === container ? 'container' : (scrollElement.className || 'posts');
            const openPostOffsetTop = openPostEl ? openPostEl.offsetTop : null;
            console.log(
              `[openPost] Scroll attempt ${attempt} (${entryPoint}): ${scrollSuccess ? '✓ SUCCESS' : '✗ FAILED'}`,
              `\n  Container: ${containerName}`,
              `\n  Scroll element: ${scrollElementName}${scrollElement !== container ? ' (child)' : ' (container)'}`,
              `\n  Open-post found: ${!!openPostEl}${openPostEl ? ` (offsetTop: ${openPostOffsetTop}px)` : ''}`,
              `\n  Before: ${beforeScroll}px → After: ${afterScroll}px`,
              `\n  Dimensions: ${clientHeight}px viewport / ${scrollHeight}px content (${canScroll ? 'scrollable' : 'not scrollable'})`,
              {
                container: containerName,
                scrollElement: scrollElementName,
                hasOpenPost: !!openPostEl,
                openPostOffsetTop,
                beforeScroll,
                afterScroll,
                scrollSuccess,
                scrollHeight,
                clientHeight,
                canScroll,
                scrollTopProperty: typeof scrollElement.scrollTop
              }
            );
            
            if(!scrollSuccess && attempt === 3){
              console.error(
                `[openPost] ⚠️ SCROLL FAILED after 3 attempts for ${entryPoint}!`,
                `\n  Container: ${containerName}`,
                `\n  Scroll element: ${scrollElementName}`,
                `\n  Final position: ${afterScroll}px (expected: 0px)`,
                `\n  Content height: ${scrollHeight}px, Viewport: ${clientHeight}px`,
                {
                  entryPoint,
                  container: containerName,
                  scrollElement: scrollElementName,
                  finalScrollTop: afterScroll,
                  scrollHeight,
                  clientHeight,
                  element: scrollElement
                }
              );
            }
          } else {
            console.warn(
              `[openPost] Scroll attempt ${attempt}: scrollTop property undefined`,
              `\n  Has element: ${!!scrollElement}`,
              `\n  scrollTop type: ${typeof scrollElement?.scrollTop}`,
              {
                hasElement: !!scrollElement,
                scrollTopType: typeof scrollElement?.scrollTop,
                element: scrollElement
              }
            );
          }
        };

        // Use multiple attempts to ensure scroll happens after all layout operations
        // This handles timing issues with layout operations, DOM updates, and animations
        // Find the actual scrollable element first
        let actualScrollElement = container;
        if(container === postsWideEl || container.classList.contains('post-board')){
          const postsEl = container.querySelector('.posts');
          if(postsEl){
            actualScrollElement = postsEl;
          }
        }
        
        const containerName = container.id || container.className;
        const scrollElementName = actualScrollElement === container ? 'container' : (actualScrollElement.className || 'posts');
        const initialScrollTop = actualScrollElement.scrollTop;
        const initialScrollHeight = actualScrollElement.scrollHeight;
        const initialClientHeight = actualScrollElement.clientHeight;
        
        // Capture early scroll from actual scroll element too
        const earlyActualScrollTop = actualScrollElement.scrollTop;
        
        console.log(
          `[openPost] Starting scroll sequence for ${entryPoint}`,
          `\n  Container: ${containerName}`,
          `\n  Scroll element: ${scrollElementName}${actualScrollElement !== container ? ' (child)' : ' (container)'}`,
          `\n  Early scroll (before DOM ops): container=${earlyScrollTop}px, scrollEl=${earlyActualScrollTop}px${earlyActualScrollTop > 0 ? ' ⚠️ WAS SCROLLED' : ''}`,
          `\n  Current position (after DOM ops): ${initialScrollTop}px`,
          `\n  Dimensions: ${initialClientHeight}px viewport / ${initialScrollHeight}px content`,
          {
            container: containerName,
            scrollElement: scrollElementName,
            earlyScrollTop,
            earlyActualScrollTop,
            initialScrollTop,
            scrollHeight: initialScrollHeight,
            clientHeight: initialClientHeight,
            needsScroll: earlyActualScrollTop > 0 || initialScrollTop > 0
          }
        );
        
        // Scroll to top BEFORE animation to prevent flicker
        const openPostEl = container.querySelector(`.open-post[data-id="${id}"]`);
        let animationTriggered = false;
        const triggerAnimation = () => {
          if(!animationTriggered && openPostEl && typeof openPostEl._triggerAnimation === 'function'){
            animationTriggered = true;
            openPostEl._triggerAnimation();
          }
        };
        
        // Fallback timeout to ensure animation triggers even if scroll fails
        const fallbackTimeout = setTimeout(() => {
          if(!animationTriggered){
            console.warn('[openPost] Fallback: Triggering animation after timeout');
            triggerAnimation();
          }
        }, 500);
        
        requestAnimationFrame(() => {
          scrollToTop(1);
          requestAnimationFrame(() => {
            scrollToTop(2);
            // Final attempt after a short delay to catch any late layout changes
            setTimeout(() => {
              requestAnimationFrame(() => {
                scrollToTop(3);
                // Final verification with clear success/failure message
                // Use the actual scroll element for final check
                let finalScrollElement = container;
                if(container === postsWideEl || container.classList.contains('post-board')){
                  const postsEl = container.querySelector('.posts');
                  if(postsEl){
                    finalScrollElement = postsEl;
                  }
                }
                
                const finalScrollTop = finalScrollElement.scrollTop;
                const finalScrollHeight = finalScrollElement.scrollHeight;
                const finalClientHeight = finalScrollElement.clientHeight;
                const success = finalScrollTop <= 5; // Allow 5px tolerance
                const finalScrollElementName = finalScrollElement === container ? 'container' : (finalScrollElement.className || 'posts');
                
                console.log(
                  `[openPost] ${success ? '✅ SUCCESS' : '❌ FAILED'}: Scroll sequence complete for ${entryPoint}`,
                  `\n  Container: ${containerName}`,
                  `\n  Scroll element: ${finalScrollElementName}${finalScrollElement !== container ? ' (child)' : ' (container)'}`,
                  `\n  Final position: ${finalScrollTop}px (${success ? 'scrolled to top' : 'NOT at top'})`,
                  `\n  Dimensions: ${finalClientHeight}px viewport / ${finalScrollHeight}px content`,
                  {
                    container: containerName,
                    scrollElement: finalScrollElementName,
                    finalScrollTop,
                    success,
                    scrollHeight: finalScrollHeight,
                    clientHeight: finalClientHeight
                  }
                );
                
                // Now that scroll is complete, trigger the animation
                clearTimeout(fallbackTimeout);
                triggerAnimation();
              });
            }, 100);
          });
        });
      }

      function closeActivePost(){
        const openEl = document.querySelector('.post-board .open-post, #recentsBoard .open-post');
        if(!openEl){
          document.body.classList.remove('detail-open');
          if(typeof initPostLayout === 'function') initPostLayout(postsWideEl);
          if(typeof window.adjustBoards === 'function') window.adjustBoards();
          return;
        }
        const openBody = openEl.querySelector('.post-body');
        if(openBody){
          openBody.style.removeProperty('--second-post-height');
          openBody.style.removeProperty('min-height');
          if(openBody.dataset) delete openBody.dataset.secondPostHeight;
        }
        const container = openEl.closest('.post-board, #recentsBoard') || postsWideEl;
        const isHistory = container && container.id === 'recentsBoard';
        const id = openEl.dataset ? openEl.dataset.id : null;
        const post = id ? getPostByIdAnywhere(id) : null;
        const detachedColumn = document.querySelector('.post-mode-boards > .post-body');
        if(detachedColumn){
          detachedColumn.classList.remove('is-visible');
          if(detachedColumn.dataset) delete detachedColumn.dataset.openPostId;
          detachedColumn.remove();
        }
        document.body.classList.remove('detail-open');
        $$('.recents-card[aria-selected="true"], .post-card[aria-selected="true"]').forEach(el=> el.removeAttribute('aria-selected'));
        // Preserve the existing card instead of creating a new one
        const existingCard = openEl.querySelector('.post-card, .recents-card');
        if(existingCard){
          // Remove share button if it was added
          const shareBtn = existingCard.querySelector('.share');
          if(shareBtn) shareBtn.remove();
          // Restore original card background
          existingCard.style.background = CARD_SURFACE;
          if(existingCard.dataset){
            existingCard.dataset.surfaceBg = CARD_SURFACE;
          }
          openEl.replaceWith(existingCard);
        } else if(post){
          const replacement = card(post, !isHistory);
          openEl.replaceWith(replacement);
        } else {
          openEl.remove();
        }
        activePostId = null;
        selectedVenueKey = null;
        updateSelectedMarkerRing();
        if(typeof initPostLayout === 'function') initPostLayout(postsWideEl);
        if(typeof updateStickyImages === 'function') updateStickyImages();
        if(typeof window.adjustBoards === 'function') window.adjustBoards();
      }

      window.openPost = openPost;
      if(typeof window.__wrapForInputYield === 'function'){
        window.__wrapForInputYield('openPost');
      }

      const resLists = $$('.recents-board');
      resLists.forEach(list=>{
          list.addEventListener('click', (e)=>{
            // Check if clicking on fav button or any of its children (like SVG)
            if(e.target.closest('.fav, .share')) return;
            const cardEl = e.target.closest('.recents-card');
            if(!cardEl) return;
            e.preventDefault();
            const id = cardEl.getAttribute('data-id');
            if(!id) return;
            callWhenDefined('openPost', (fn)=>{
              requestAnimationFrame(() => {
                try{
                  stopSpin();
                  // CASE 1: RECENTS CARD CLICKED - SCROLL TO TOP
                  // Parameters: (id, fromHistory=true, fromMap=false, originEl=cardEl)
                  fn(id, true, false, cardEl);
                }catch(err){ console.error(err); }
              });
            });
          }, { capture: true });
        });

      const postsWide = $('.post-board');
      if(postsWide){
        postsWide.addEventListener('click', e=>{
          // Check if clicking on fav/share button or any of its children (like SVG)
          if(e.target.closest('.fav, .share')) return;
          const cardEl = e.target.closest('.post-card');
          if(cardEl){
            const id = cardEl.getAttribute('data-id');
            if(id){
              e.preventDefault();
              callWhenDefined('openPost', (fn)=>{
                requestAnimationFrame(() => {
                  try{
                    stopSpin();
                    // CASE 2: POST CARD CLICKED - SCROLL TO TOP
                    // Parameters: (id, fromHistory=false, fromMap=false, originEl=cardEl)
                    fn(id, false, false, cardEl);
                  }catch(err){ console.error(err); }
                });
              });
            }
            return;
          }
          if(e.target === postsWide && postsWide.querySelector('.open-post')){
            userClosedPostBoard = true;
            setTimeout(()=> setModeFromUser('map'), 0);
          }
        }, { capture:true });
      }

      recentsBoard && recentsBoard.addEventListener('click', e=>{
        if(e.target === recentsBoard){
          userClosedPostBoard = true;
          setModeFromUser('map');
        }
      });

      function setMode(m, skipFilters = false){
        mode = m;
        document.body.classList.remove('mode-map','mode-posts','hide-posts-ui');
        document.body.classList.add('mode-'+m);
        if(m==='map'){
          document.body.classList.remove('show-history');
        }
        if(m === 'map'){
          startMainMapInit();
        }
        const shouldAdjustListHeight = m === 'posts' && typeof window.adjustListHeight === 'function';
        adjustBoards();
        if(shouldAdjustListHeight){
          window.adjustListHeight();
        }
        updateModeToggle();
        if(m === 'posts'){
          userClosedPostBoard = false;
          const boardEl = document.querySelector('.post-board');
          if(boardEl){
            boardEl.style.width = '';
          }
          if(window.adjust){
            window.adjust();
          }
        }
        if(map){
          if(typeof map.resize === 'function'){
            map.resize();
          }
          updatePostPanel();
        }
        if(m==='posts'){
          spinEnabled = false;
          localStorage.setItem('spinGlobe','false');
          stopSpin();
        }
        if(!skipFilters) applyFilters();
      }
    window.setMode = setMode;

      function setModeFromUser(m, skipFilters = false){
        const previous = modeChangeWasUserInitiated;
        modeChangeWasUserInitiated = true;
        try{
          setMode(m, skipFilters);
        } finally {
          modeChangeWasUserInitiated = previous;
        }
      }

    // Mapbox
    let mapboxBundlePromise = null;
    let mapboxBundleReady = false;
    let mainMapInitPromise = null;
    let mapInitTriggered = false;
    let mapInitQueued = false;
    let modeChangeWasUserInitiated = false;

    function loadMapbox(cb){
      const invokeCallback = () => {
        if(typeof cb === 'function'){
          try{ cb(); }catch(err){ console.error(err); }
        }
      };

      if(mapboxBundleReady){
        return Promise.resolve().then(invokeCallback);
      }

      if(!mapboxBundlePromise){
        mapboxBundlePromise = new Promise((resolve, reject) => {
          const mapboxVerRaw = window.MAPBOX_VERSION || 'v3.15.0';
          const mapboxVer = mapboxVerRaw.startsWith('v') ? mapboxVerRaw : `v${mapboxVerRaw}`;
          const mapboxVerNoV = mapboxVer.replace(/^v/, '');
          const cssSources = [
            {
              selector: 'link[href*="mapbox-gl.css"], link[href*="mapbox-gl@"], style[data-mapbox]',
              primary: `https://api.mapbox.com/mapbox-gl-js/${mapboxVer}/mapbox-gl.css`,
              fallback: `https://unpkg.com/mapbox-gl@${mapboxVerNoV}/dist/mapbox-gl.css`
            },
            {
              selector: 'link[href*="mapbox-gl-geocoder.css"], link[href*="mapbox-gl-geocoder@"]',
              primary: 'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.0/mapbox-gl-geocoder.css',
              fallback: 'https://unpkg.com/@mapbox/mapbox-gl-geocoder@5.0.0/dist/mapbox-gl-geocoder.css'
            }
          ];

          let settled = false;

          function fail(error){
            if(settled){
              return;
            }
            settled = true;
            mapboxBundleReady = false;
            mapboxBundlePromise = null;
            reject(error instanceof Error ? error : new Error(error || 'Mapbox bundle failed to load'));
          }

          function finalize(){
            if(settled){
              return;
            }
            Promise.resolve(ensureMapboxCssFor(document.body))
              .catch(()=>{})
              .then(() => {
                if(settled){
                  return;
                }
                if(window && window.mapboxgl){
                  settled = true;
                  mapboxBundleReady = true;
                  resolve();
                } else {
                  fail(new Error('Mapbox GL failed to load'));
                }
              });
          }

          function monitorLink(link, onReady, fallbackUrl){
            if(!link || (link.tagName && link.tagName.toLowerCase() === 'style')){
              onReady();
              return;
            }
            if(fallbackUrl && link.dataset && !link.dataset.fallback){
              link.dataset.fallback = fallbackUrl;
            }

            let settled = false;

            function cleanup(){
              link.removeEventListener('load', handleLoad);
              link.removeEventListener('error', handleError);
            }

            function complete(){
              if(settled){
                return;
              }
              settled = true;
              cleanup();
              onReady();
            }

            function handleLoad(){
              complete();
            }

            function handleError(){
              const attempts = link.dataset && link.dataset.fallbackErrors ? Number(link.dataset.fallbackErrors) : 0;
              const nextAttempts = (Number.isNaN(attempts) ? 0 : attempts) + 1;
              if(link.dataset){
                link.dataset.fallbackErrors = String(nextAttempts);
              }
              const fallback = link.dataset ? link.dataset.fallback : fallbackUrl;
              if(fallback && link.href !== fallback){
                link.href = fallback;
                return;
              }
              if(fallback && nextAttempts === 1){
                return;
              }
              complete();
            }

            function needsListeners(){
              if(!link.sheet){
                return true;
              }
              try {
                void link.sheet.cssRules;
                return false;
              } catch(err){
                if(err && (err.name === 'SecurityError' || err.code === 18)){
                  return false;
                }
                return true;
              }
            }

            if(needsListeners()){
              link.addEventListener('load', handleLoad, {once:true});
              link.addEventListener('error', handleError);
            } else {
              complete();
            }
          }

          function ensureCss(index, onReady){
            const {selector, primary, fallback} = cssSources[index];
            const selectors = selector.split(',').map(s => s.trim());
            for(const sel of selectors){
              const candidate = document.querySelector(sel);
              if(candidate){
                if(candidate.tagName && candidate.tagName.toLowerCase() === 'style'){
                  onReady();
                  return;
                }
                monitorLink(candidate, onReady, fallback);
                return;
              }
            }
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = primary;
            monitorLink(link, onReady, fallback);
            document.head.appendChild(link);
          }

          if(window.mapboxgl && window.MapboxGeocoder){
            let pending = cssSources.length;
            if(pending === 0){
              finalize();
              return;
            }
            const done = () => {
              if(--pending === 0){
                finalize();
              }
            };
            cssSources.forEach((_, i) => ensureCss(i, done));
            return;
          }

          cssSources.forEach((_, i) => ensureCss(i, ()=>{}));
          loadScripts();

          function loadScripts(){
            let successTriggered = false;

            function done(){
              if(successTriggered){
                return;
              }
              successTriggered = true;
              finalize();
            }

            const loadGeocoder = ()=>{
              const g = document.createElement('script');
              g.src='https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.0/mapbox-gl-geocoder.min.js';
              g.async = true;
              g.defer = true;
              g.onload = done;
              g.onerror = ()=>{
                const gf = document.createElement('script');
                gf.src='https://unpkg.com/@mapbox/mapbox-gl-geocoder@5.0.0/dist/mapbox-gl-geocoder.min.js';
                gf.async = true;
                gf.defer = true;
                gf.onload = done;
                gf.onerror = ()=>{
                  fail(new Error('Mapbox Geocoder failed to load'));
                };
                document.head.appendChild(gf);
              };
              document.head.appendChild(g);
            };

            const s = document.createElement('script');
            s.src=`https://api.mapbox.com/mapbox-gl-js/${mapboxVer}/mapbox-gl.js`;
            s.async = true;
            s.defer = true;
            s.onload = loadGeocoder;
            s.onerror = ()=>{
              const sf = document.createElement('script');
              sf.src=`https://unpkg.com/mapbox-gl@${mapboxVerNoV}/dist/mapbox-gl.js`;
              sf.async = true;
              sf.defer = true;
              sf.onload = loadGeocoder;
              sf.onerror = ()=>{
                fail(new Error('Mapbox GL failed to load from fallback source'));
              };
              document.head.appendChild(sf);
            };
            document.head.appendChild(s);
          }
        });
      }

      return mapboxBundlePromise.then(() => {
        invokeCallback();
      });
    }

    function startMainMapInit(){
      if(mainMapInitPromise){
        return mainMapInitPromise;
      }
      mapInitQueued = false;
      if(typeof __notifyMapOnInteraction === 'function'){
        __notifyMapOnInteraction = null;
      }
      mainMapInitPromise = loadMapbox().then(() => {
        if(mapInitTriggered){
          return;
        }
        mapInitTriggered = true;
        return Promise.resolve(initMap()).catch(err => {
          console.error(err);
        });
      }).catch(err => {
        console.error(err);
      });
      return mainMapInitPromise;
    }

    function queueMainMapInitAfterInteraction(){
      if(mainMapInitPromise || mapInitTriggered){
        return;
      }
      if(__userInteractionObserved){
        startMainMapInit();
        return;
      }
      if(mapInitQueued){
        return;
      }
      mapInitQueued = true;
      loadMapbox().catch(err => console.error(err));
      const notify = () => {
        mapInitQueued = false;
        startMainMapInit();
      };
      __notifyMapOnInteraction = notify;
    }

    function addControls(){
      if(typeof MapboxGeocoder === 'undefined'){
        const script = document.createElement('script');
        script.src='https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.0/mapbox-gl-geocoder.min.js';
        script.onload = addControls;
        script.onerror = ()=> console.error('Mapbox Geocoder failed to load');
        document.head.appendChild(script);
        return;
      }
      const cssLink = document.querySelector('style[data-mapbox], link[href*="mapbox-gl.css"], link[href*="mapbox-gl@"]');
      if(!cssLink || !cssLink.sheet){
        setTimeout(addControls, 50);
        return;
      }
      geocoders.length = 0;
      geocoder = null;

      const sets = [
        {geo:'#geocoder-welcome', locate:'#geolocate-welcome', compass:'#compass-welcome'},
        {geo:'#geocoder-map', locate:'#geolocate-map', compass:'#compass-map'},
        {geo:'#geocoder-filter', locate:'#geolocate-filter', compass:'#compass-filter'},
        {geo:'#geocoder-member', locate:'#geolocate-member', compass:'#compass-member'}
      ];
      const cityZoomLevel = 12;

      sets.forEach((sel, idx)=>{
        const geocoderOptions = {
          accessToken: mapboxgl.accessToken,
          mapboxgl,
          placeholder: 'Search venues or places',
          types: 'poi,place,address',
          marker: false,
          limit: 10,
          reverseGeocode: true,
          language: navigator.language,
          proximity: null, // Remove regional bias
          bbox: null,      // Remove viewport limitation
          flyTo: false
        };

        const gc = new MapboxGeocoder(geocoderOptions);
        const gEl = sel && sel.geo ? document.querySelector(sel.geo) : null;
        if(gEl){
          gEl.appendChild(gc.onAdd(map));
        }
        geocoders.push(gc);
        if(idx === 1){
          geocoder = gc;
        }

        const handleGeocoderResult = (result) => {
          if(!map || !result) return;
          closeWelcomeModalIfOpen();

          const toLngLatArray = (value) => {
            if(Array.isArray(value) && value.length >= 2){
              const lng = Number(value[0]);
              const lat = Number(value[1]);
              if(Number.isFinite(lng) && Number.isFinite(lat)){
                return [lng, lat];
              }
            } else if(value && typeof value === 'object'){
              const lng = Number(value.lng);
              const lat = Number(value.lat);
              if(Number.isFinite(lng) && Number.isFinite(lat)){
                return [lng, lat];
              }
            }
            return null;
          };

          const waitForIdle = () => {
            if(!map) return;
            if(typeof map.isMoving === 'function'){
              let moving = false;
              try{
                moving = map.isMoving();
              }catch(err){ moving = false; }
              if(moving){
                requestAnimationFrame(waitForIdle);
                return;
              }
            }
            applyFlight();
          };

          const applyFlight = () => {
            if(!map) return;

            const minZoom = Math.max(cityZoomLevel, MARKER_ZOOM_THRESHOLD + 0.01);
            let maxZoom = 22;
            if(typeof map.getMaxZoom === 'function'){
              try{
                const candidate = map.getMaxZoom();
                if(Number.isFinite(candidate)){
                  maxZoom = candidate;
                }
              }catch(err){}
            }

            let cameraFromBounds = null;
            if(Array.isArray(result?.bbox) && result.bbox.length === 4 && typeof map.cameraForBounds === 'function'){
              const [minLng, minLat, maxLng, maxLat] = result.bbox.map(Number);
              const hasBounds = [minLng, minLat, maxLng, maxLat].every(Number.isFinite);
              if(hasBounds){
                try{
                  cameraFromBounds = map.cameraForBounds([[minLng, minLat], [maxLng, maxLat]], {
                    padding: { top: 60, bottom: 60, left: 60, right: 60 }
                  });
                }catch(err){ cameraFromBounds = null; }
              }
            }

            const currentCenter = (() => {
              if(typeof map.getCenter === 'function'){
                try{
                  const center = map.getCenter();
                  return toLngLatArray(center);
                }catch(err){ 
                  console.error('Failed to get bearing:', err);
                  return null; 
                }
              }
              return null;
            })();

            let targetCenter = null;
            if(cameraFromBounds?.center){
              targetCenter = toLngLatArray(cameraFromBounds.center);
            }
            if(!targetCenter){
              const geometry = result?.geometry;
              if(geometry && String(geometry.type).toLowerCase() === 'point'){
                targetCenter = toLngLatArray(geometry.coordinates);
              }
            }
            if(!targetCenter){
              targetCenter = toLngLatArray(result?.center);
            }
            if(!targetCenter){
              targetCenter = currentCenter;
            }

            let zoomCandidate = Number(cameraFromBounds?.zoom);
            if(!Number.isFinite(zoomCandidate) && Number.isFinite(result?.zoom)){
              zoomCandidate = result.zoom;
            }
            if(!Number.isFinite(zoomCandidate) && Number.isFinite(result?.properties?.zoom)){
              zoomCandidate = result.properties.zoom;
            }
            if(!Number.isFinite(zoomCandidate)){
              if(typeof map.getZoom === 'function'){
                try{
                  const currentZoom = map.getZoom();
                  if(Number.isFinite(currentZoom)){
                    zoomCandidate = currentZoom;
                  }
                }catch(err){}
              }
            }

            let targetZoom = Number.isFinite(zoomCandidate) ? zoomCandidate : minZoom;
            if(targetZoom < minZoom){
              targetZoom = minZoom;
            }
            if(Number.isFinite(maxZoom) && targetZoom > maxZoom){
              targetZoom = maxZoom;
            }

            const currentBearing = (() => {
              if(typeof map.getBearing === 'function'){
                try{
                  const bearing = map.getBearing();
                  return Number.isFinite(bearing) ? bearing : null;
                }catch(err){ 
                  console.error('Failed to get bearing:', err);
                  return null; 
                }
              }
              return null;
            })();

            let targetBearing = Number(cameraFromBounds?.bearing);
            if(!Number.isFinite(targetBearing) && Number.isFinite(result?.bearing)){
              targetBearing = result.bearing;
            }
            if(!Number.isFinite(targetBearing) && Number.isFinite(result?.properties?.bearing)){
              targetBearing = result.properties.bearing;
            }
            if(!Number.isFinite(targetBearing)){
              targetBearing = currentBearing;
            }

            const currentPitch = (() => {
              if(typeof map.getPitch === 'function'){
                try{
                  const pitch = map.getPitch();
                  return Number.isFinite(pitch) ? pitch : null;
                }catch(err){ 
                  console.error('Failed to get bearing:', err);
                  return null; 
                }
              }
              return null;
            })();

            let targetPitch = Number(cameraFromBounds?.pitch);
            if(!Number.isFinite(targetPitch) && Number.isFinite(result?.pitch)){
              targetPitch = result.pitch;
            }
            if(!Number.isFinite(targetPitch) && Number.isFinite(result?.properties?.pitch)){
              targetPitch = result.properties.pitch;
            }
            if(!Number.isFinite(targetPitch)){
              targetPitch = currentPitch;
            }

            const flight = {
              essential: true,
              center: targetCenter || currentCenter || undefined,
              zoom: Number.isFinite(targetZoom) ? targetZoom : minZoom,
              speed: 1.35,
              curve: 1.5,
              easing: t => 1 - Math.pow(1 - t, 3)
            };

            if(Number.isFinite(targetBearing)){
              flight.bearing = targetBearing;
            }
            if(Number.isFinite(targetPitch)){
              flight.pitch = targetPitch;
            }

            try{
              if(typeof map.flyTo === 'function'){
                map.flyTo(flight);
              }
            }catch(err){}
          };

          waitForIdle();
        };
        gc.on('result', event => handleGeocoderResult(event && event.result));

        const geolocateToken = `geolocate:${idx}`;
        let geolocateButton = null;
        let geolocateFallbackTimeout = null;

        const clearGeolocateLoading = () => {
          if(geolocateFallbackTimeout){
            clearTimeout(geolocateFallbackTimeout);
            geolocateFallbackTimeout = null;
          }
          if(mapLoading){
            mapLoading.removeMotion(geolocateToken);
          }
        };

        const ensureGeolocateLoading = () => {
          if(!mapLoading) return;
          mapLoading.addMotion(geolocateToken);
          if(geolocateFallbackTimeout){
            clearTimeout(geolocateFallbackTimeout);
          }
          geolocateFallbackTimeout = setTimeout(() => {
            geolocateFallbackTimeout = null;
            if(mapLoading){
              mapLoading.removeMotion(geolocateToken);
            }
          }, 15000);
        };

        const awaitGeolocateIdle = () => {
          if(!mapLoading){
            clearGeolocateLoading();
            return;
          }
          const finalize = () => {
            clearGeolocateLoading();
          };
          let bound = false;
          if(map && typeof map.once === 'function'){
            try{
              map.once('idle', finalize);
              bound = true;
            }catch(err){
              finalize();
              return;
            }
          }
          if(!bound){
            finalize();
          } else {
            if(geolocateFallbackTimeout){
              clearTimeout(geolocateFallbackTimeout);
            }
            geolocateFallbackTimeout = setTimeout(() => {
              finalize();
            }, 8000);
          }
        };

        const geolocate = new mapboxgl.GeolocateControl({
          positionOptions:{ enableHighAccuracy:true },
          trackUserLocation:false,
          fitBoundsOptions:{ maxZoom: cityZoomLevel }
        });
        geolocate.on('geolocate', (event)=>{
          ensureGeolocateLoading();
          spinEnabled = false; localStorage.setItem('spinGlobe','false'); stopSpin();
          closeWelcomeModalIfOpen();
          if(mode!=='map') setModeFromUser('map');
          if(event && event.coords){
            setAllGeocoderProximity(event.coords.longitude, event.coords.latitude);
          }
          if(map && typeof map.easeTo === 'function' && event && event.coords){
            let targetZoom = cityZoomLevel;
            if(typeof map.getMaxZoom === 'function'){
              try{
                const maxZoom = map.getMaxZoom();
                if(typeof maxZoom === 'number' && maxZoom < targetZoom){
                  targetZoom = maxZoom;
                }
              }catch(err){}
            }
            const currentZoom = (typeof map.getZoom === 'function') ? map.getZoom() : null;
            const needsZoomAdjust = !Number.isFinite(currentZoom) || Math.abs(currentZoom - targetZoom) > 0.05;
            const center = [event.coords.longitude, event.coords.latitude];
            if(needsZoomAdjust){
              let currentPitch = null;
              try{
                currentPitch = typeof map.getPitch === 'function' ? map.getPitch() : null;
              }catch(err){
                currentPitch = null;
              }
              const options = { center, zoom: targetZoom, duration: 800, essential: true };
              if(Number.isFinite(currentPitch)){
                options.pitch = currentPitch;
              }
              try{
                map.easeTo(options);
              }catch(err){}
            }
          }
          awaitGeolocateIdle();
        });
        geolocate.on('error', () => {
          clearGeolocateLoading();
        });
        const geoHolder = sel && sel.locate ? document.querySelector(sel.locate) : null;
        if(geoHolder){
          const controlEl = geolocate.onAdd(map);
          geoHolder.appendChild(controlEl);
          if(controlEl){
            geolocateButton = controlEl.querySelector('button');
            if(geolocateButton){
              const handlePress = (evt) => {
                if(evt && evt.type === 'keydown'){
                  const key = evt.key || evt.code;
                  if(!key) return;
                  if(key !== 'Enter' && key !== ' ' && key !== 'Spacebar'){ return; }
                }
                ensureGeolocateLoading();
              };
              geolocateButton.addEventListener('click', handlePress, { passive: true });
              geolocateButton.addEventListener('keydown', handlePress);
            }
          }
        }
        const nav = new mapboxgl.NavigationControl({showZoom:false, visualizePitch:true});
        const compassHolder = sel && sel.compass ? document.querySelector(sel.compass) : null;
        if(compassHolder) compassHolder.appendChild(nav.onAdd(map));
      });

      syncGeocoderProximityToMap();
    }

    async function initMap(){
      // Wait for formbuilder snapshot to load before initializing map
      if (typeof window !== 'undefined' && window.persistedFormbuilderSnapshotPromise) {
        try {
          await window.persistedFormbuilderSnapshotPromise;
        } catch (err) {
          console.error('Failed to wait for formbuilder snapshot:', err);
          throw err; // Don't continue if snapshot failed
        }
      }
      
      if(typeof mapboxgl === 'undefined'){
        console.error('Mapbox GL failed to load');
        return;
      }
      try{
        await ensureMapboxCssFor(document.body);
      }catch(err){}
      // Validate Mapbox token before initialization
      if(!MAPBOX_TOKEN || typeof MAPBOX_TOKEN !== 'string' || MAPBOX_TOKEN.trim() === ''){
        console.error('Mapbox token is missing or invalid');
        return;
      }
      mapboxgl.accessToken = MAPBOX_TOKEN;
      if(typeof mapboxgl.setLogLevel === 'function'){
        mapboxgl.setLogLevel('error');
      }
        const startZoom = window.startZoom || 1.5;
        const startCenter = window.startCenter || [0, 0];
        map = new mapboxgl.Map({
          container:'map',
          style:'mapbox://styles/mapbox/standard',
          projection:'globe',
          center: startCenter,
          zoom: startZoom,
          pitch: window.startPitch || 0,
          bearing: window.startBearing || 0,
          attributionControl:true
        });
        // Add error handler for token/auth errors
        map.on('error', (e) => {
          if(e && e.error && (e.error.message || '').includes('token') || (e.error.message || '').includes('Unauthorized')){
            console.error('Mapbox authentication error:', e.error);
          }
        });
        try{ ensurePlaceholderSprites(map); }catch(err){}
        const zoomIndicatorEl = document.getElementById('mapZoomIndicator');
        const updateZoomIndicator = () => {
          if(!map || !zoomIndicatorEl || typeof map.getZoom !== 'function') return;
          try{
            const zoomLevel = map.getZoom();
            const pitchLevel = typeof map.getPitch === 'function' ? map.getPitch() : NaN;
            if(Number.isFinite(zoomLevel)){
              const zoomText = `Zoom ${zoomLevel.toFixed(2)}`;
              if(Number.isFinite(pitchLevel)){
                zoomIndicatorEl.textContent = `${zoomText} • Pitch ${Math.round(pitchLevel)}°`;
              } else {
                zoomIndicatorEl.textContent = zoomText;
              }
            } else {
              zoomIndicatorEl.textContent = 'Zoom -- • Pitch --';
            }
          }catch(err){}
        };
        if(zoomIndicatorEl && map && typeof map.on === 'function'){
          ['zoom','zoomend','pitch','pitchend'].forEach(evt => {
            try{ map.on(evt, updateZoomIndicator); }catch(err){}
          });
          if(typeof map.once === 'function'){
            try{ map.once('load', updateZoomIndicator); }catch(err){}
          }
          updateZoomIndicator();
        }

        let recentMapInteraction = false;
        let recentInteractionTimeout = null;
        const markRecentInteraction = () => {
          recentMapInteraction = true;
          if(recentInteractionTimeout){
            clearTimeout(recentInteractionTimeout);
          }
          recentInteractionTimeout = setTimeout(() => {
            recentMapInteraction = false;
            recentInteractionTimeout = null;
          }, 1200);
        };

        const mapCanvasContainer = (typeof map.getCanvasContainer === 'function') ? map.getCanvasContainer() : null;
        if(mapCanvasContainer){
          ['mousedown','touchstart','wheel','pointerdown'].forEach(evtName => {
            try{
              mapCanvasContainer.addEventListener(evtName, markRecentInteraction, { passive: true });
            }catch(err){}
          });
          if(map && typeof map.on === 'function'){
            try{
              map.on('remove', () => {
                if(recentInteractionTimeout){
                  clearTimeout(recentInteractionTimeout);
                  recentInteractionTimeout = null;
                }
                ['mousedown','touchstart','wheel','pointerdown'].forEach(evtName => {
                  try{ mapCanvasContainer.removeEventListener(evtName, markRecentInteraction, false); }catch(err){}
                });
              });
            }catch(err){}
          }
        }

        const handleWelcomeOnMapMotion = (evt) => {
          if(evt && evt.originalEvent){
            closeWelcomeModalIfOpen();
            return;
          }
          if(recentMapInteraction){
            closeWelcomeModalIfOpen();
          }
        };

        if(map && typeof map.on === 'function'){
          ['movestart','dragstart','zoomstart','rotatestart','pitchstart','boxzoomstart'].forEach(evtName => {
            try{ map.on(evtName, handleWelcomeOnMapMotion); }catch(err){}
          });
        }
// === Pill hooks (safe) ===
try { if (typeof __addOrReplacePill150x40 === 'function') __addOrReplacePill150x40(map); } catch(e){}
if (!map.__pillHooksInstalled) {
  try { map.on('style.load', () => __addOrReplacePill150x40(map)); } catch(e){}
  try { map.on('styleimagemissing', (evt) => { if (evt && evt.id === 'marker-label-bg') __addOrReplacePill150x40(map); }); } catch(e){}
  map.__pillHooksInstalled = true;
}
        try{ map.on('style.load', () => { try{ reapplyMarkerLabelComposites(map); }catch(err){} }); }catch(err){}

        const applyStyleAdjustments = () => {
          try{ ensurePlaceholderSprites(map); }catch(err){}
          applyNightSky(map);
          patchMapboxStyleArtifacts(map);
        };
        whenStyleReady(map, applyStyleAdjustments);
        map.on('style.load', applyStyleAdjustments);
        map.on('styledata', () => {
          try{ ensurePlaceholderSprites(map); }catch(err){}
          if(map.isStyleLoaded && map.isStyleLoaded()){
            patchMapboxStyleArtifacts(map);
          }
        });
        ensureMapIcon = attachIconLoader(map);
        const pendingStyleImageRequests = new Map();
        const handleStyleImageMissing = (evt) => {
          const imageId = evt && evt.id;
          if(!imageId){
            return;
          }
          try{
            if(map.hasImage?.(imageId)){
              return;
            }
          }catch(err){
            console.error(err);
          }
          if(pendingStyleImageRequests.has(imageId)){
            return;
          }
          const result = generateMarkerImageFromId(imageId, map, { ensureIcon: ensureMapIcon });
          if(result && typeof result.then === 'function'){
            const task = result.then(output => {
              if(!output){
                return;
              }
              const { image, options } = output;
              if(!image){
                return;
              }
              try{
                if(map.hasImage?.(imageId)){
                  return;
                }
                map.addImage(imageId, image, options || {});
              }catch(error){
                console.error(error);
              }
            }).catch(error => {
              console.error(error);
            }).finally(() => {
              pendingStyleImageRequests.delete(imageId);
            });
            pendingStyleImageRequests.set(imageId, task);
            return;
          }
          if(result && result.image){
            try{
              if(!map.hasImage?.(imageId)){
                map.addImage(imageId, result.image, result.options || {});
              }
            }catch(error){
              console.error(error);
            }
          }
        };
        try{ map.on('styleimagemissing', handleStyleImageMissing); }
        catch(err){ console.error(err); }

        // Map loading state management
        const mapLoading = (() => {
          const loader = window.__logoLoading;
          if(!loader || typeof loader.begin !== 'function' || typeof loader.end !== 'function'){
            return null;
          }
          const overlay = document.getElementById('headerLoadingOverlay');
          const motionTokens = new Set();
          let tilesPending = false;
          let active = false;

          const isMapMovingNow = () => {
            if(!map) return false;
            try{
              if(typeof map.isMoving === 'function' && map.isMoving()) return true;
              if(typeof map.isZooming === 'function' && map.isZooming()) return true;
              if(typeof map.isRotating === 'function' && map.isRotating()) return true;
              if(typeof map.isEasing === 'function' && map.isEasing()) return true;
            }catch(err){}
            return false;
          };

          const apply = (forceStop = false) => {
            const busy = !forceStop && (tilesPending || motionTokens.size > 0 || isMapMovingNow());
            if(busy){
              if(overlay){
                overlay.classList.remove('is-hidden');
                overlay.setAttribute('aria-hidden', 'false');
              }
              if(!active){
                active = true;
                try{ loader.begin('map'); }catch(err){}
              }
            } else {
              if(overlay){
                overlay.classList.add('is-hidden');
                overlay.setAttribute('aria-hidden', 'true');
              }
              if(active){
                active = false;
                try{ loader.end('map'); }catch(err){}
              }
            }
          };

          return {
            apply,
            setTiles(pending){
              if(tilesPending === pending) return;
              tilesPending = pending;
              apply();
            },
            addMotion(token){
              if(motionTokens.has(token)) return;
              motionTokens.add(token);
              apply();
            },
            removeMotion(token){
              if(!motionTokens.has(token)) return;
              motionTokens.delete(token);
              apply();
            },
            clearAll(){
              motionTokens.clear();
              tilesPending = false;
              if(overlay){
                overlay.classList.add('is-hidden');
                overlay.setAttribute('aria-hidden', 'true');
              }
              if(active){
                active = false;
                try{ loader.end('map'); }catch(err){}
              }
            }
          };
        })();

        if(mapLoading){
          const updateRenderState = () => {
            let tileBusy = false;
            if(map){
              try{
                if(typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded()){
                  tileBusy = true;
                } else if(typeof map.areTilesLoaded === 'function'){
                  tileBusy = !map.areTilesLoaded();
                }
              }catch(err){
                tileBusy = true;
              }
            }
            mapLoading.setTiles(tileBusy);
            mapLoading.apply();
          };

          map.on('sourcedataloading', () => mapLoading.setTiles(true));
          map.on('render', updateRenderState);
          map.on('idle', () => {
            mapLoading.setTiles(false);
            mapLoading.apply();
          });

          ['move','zoom','rotate','pitch','drag'].forEach(evt => {
            const startEv = `${evt}start`;
            const endEv = `${evt}end`;
            map.on(startEv, () => mapLoading.addMotion(evt));
            map.on(endEv, () => mapLoading.removeMotion(evt));
          });
          ['moveend','zoomend','rotateend','pitchend','dragend'].forEach(evt => {
            map.on(evt, () => mapLoading.apply());
          });
          map.on('remove', () => mapLoading.clearAll());
        }
      map.on('zoomstart', ()=>{
        if(waitForInitialZoom){
          initialZoomStarted = true;
        }
      });
      map.on('zoom', (e)=>{
        const zoomValue = getZoomFromEvent(e);
        if(waitForInitialZoom){
          if(!initialZoomStarted){
            updateZoomState(zoomValue);
            return;
          }
          waitForInitialZoom = false;
          window.waitForInitialZoom = waitForInitialZoom;
          initialZoomStarted = false;
        }
        updateZoomState(zoomValue);
        if(!spinning){
          scheduleCheckLoadPosts({ zoom: zoomValue, target: map });
        }
      });
      map.on('zoomend', ()=>{
        if(markersLoaded) return;
        if(!map || typeof map.getZoom !== 'function') return;
        let currentZoom = NaN;
        try{ currentZoom = map.getZoom(); }catch(err){ currentZoom = NaN; }
        if(!Number.isFinite(currentZoom) || currentZoom < MARKER_PRELOAD_ZOOM){
          return;
        }
        try{ loadPostMarkers(); }catch(err){ console.error(err); }
        markersLoaded = true;
        window.__markersLoaded = true;
      });
      map.on('moveend', ()=>{
        syncGeocoderProximityToMap();
        if(!spinning){
          scheduleCheckLoadPosts({ zoom: lastKnownZoom, target: map });
        }
      });
      addControls();
      try{
        map.scrollZoom.setWheelZoomRate(1/240);
        map.scrollZoom.setZoomRate(1/240);
      }catch(e){}
      map.on('load', ()=>{
        setupSeedLayers(map);
        applyNightSky(map);
        $$('.map-overlay').forEach(el=>el.remove());
        if(spinEnabled){
          startSpin(true);
        }
        updatePostPanel();
        applyFilters();
        updateZoomState(getZoomFromEvent());
        if(!markersLoaded){
          const zoomLevel = Number.isFinite(lastKnownZoom) ? lastKnownZoom : getZoomFromEvent();
          if(Number.isFinite(zoomLevel) && zoomLevel >= MARKER_PRELOAD_ZOOM){
            try{ loadPostMarkers(); }catch(err){ console.error(err); }
            markersLoaded = true;
            window.__markersLoaded = true;
          }
        }
        checkLoadPosts();
      });

      map.on('style.load', ()=>{
        setupSeedLayers(map);
        updateLayerVisibility(lastKnownZoom);
      });

        ['mousedown','wheel','touchstart','dragstart','pitchstart','rotatestart','zoomstart'].forEach(ev=> map.on(ev, haltSpin));
        let suppressNextRefresh = false;
        const refreshMapView = () => {
          if(suppressNextRefresh) return;
          scheduleCheckLoadPosts({ zoom: lastKnownZoom, target: map });
          updatePostPanel();
          updateFilterCounts();
          refreshMarkers();
          refreshInViewMarkerLabelComposites(map);
          const center = map.getCenter().toArray();
          const zoom = map.getZoom();
          const pitch = map.getPitch();
          const bearing = map.getBearing();
          updateBalloonSourceForZoom(zoom);
          localStorage.setItem('mapView', JSON.stringify({center, zoom, pitch, bearing}));
        };
        ['moveend','zoomend','rotateend','pitchend'].forEach(ev => map.on(ev, refreshMapView));
        map.on('dragend', clearMapGeocoder);
        map.on('click', clearMapGeocoder);
        map.on('touchstart', () => requestAnimationFrame(blurAllGeocoderInputs));
      }

    function startSpin(fromCurrent=false){
      if(mode!=='map') setModeFromUser('map');
      if(!spinEnabled || spinning || !map) return;
      if(map.getZoom() >= spinZoomMax) return;
      if(typeof filterPanel !== 'undefined' && filterPanel) closePanel(filterPanel);
      spinning = true;
      hideResultIndicators();
      historyWasActive = document.body.classList.contains('show-history');
      if(historyWasActive){
        document.body.classList.remove('show-history');
        adjustBoards();
        updateModeToggle();
      }
      function step(){
        if(!spinning || !map) return;
        const isBusy = (map.isMoving && map.isMoving()) || (map.areTilesLoaded && !map.areTilesLoaded());
        if(isBusy){
          requestAnimationFrame(step);
          return;
        }
        const c = map.getCenter();
        map.setCenter([c.lng + spinSpeed, c.lat]);
        requestAnimationFrame(step);
      }
      if(fromCurrent){
        requestAnimationFrame(step);
      }else{
        const LEGACY_DEFAULT_PITCH = 0;
        const startPitch = window.startPitch;
        const targetPitch = Number.isFinite(startPitch) ? startPitch : LEGACY_DEFAULT_PITCH;
        const startZoom = window.startZoom || 1.5;
        map.easeTo({center:[0,0], zoom:startZoom, pitch:targetPitch, essential:true});
        map.once('moveend', () => requestAnimationFrame(step));
      }
    }
    function stopSpin(){
      spinning = false;
      const wasHistory = historyWasActive;
      historyWasActive = false;
      if(wasHistory){
        document.body.classList.add('show-history');
        adjustBoards();
        updateModeToggle();
      }
      const shouldLoadPosts = pendingPostLoad;
      pendingPostLoad = false;
      if(shouldLoadPosts){
        scheduleCheckLoadPosts({ zoom: lastKnownZoom, target: map });
        return;
      }
      applyFilters();
    }

    function haltSpin(e){
      const target = (e && e.originalEvent && e.originalEvent.target) || (e && e.target);
      if(target instanceof Node && logoEls.some(el=>el.contains(target))) return;
      if(spinEnabled || spinning){
        spinEnabled = false;
        localStorage.setItem('spinGlobe','false');
        stopSpin();
      }
    }

    ['pointerdown','wheel','keydown','touchstart'].forEach(ev=>
      document.addEventListener(ev, haltSpin, {capture:true})
    );

    function updateSpinState(){
      const shouldSpin = spinLoadStart && (spinLoadType === 'everyone' || (spinLoadType === 'new_users' && firstVisit));
      if(shouldSpin !== spinEnabled){
        spinEnabled = shouldSpin;
        localStorage.setItem('spinGlobe', JSON.stringify(spinEnabled));
        if(spinEnabled) startSpin(); else stopSpin();
      }
    }

    window.spinGlobals = {
      get spinEnabled(){ return spinEnabled; },
      set spinEnabled(v){ spinEnabled = v; },
      get spinLoadStart(){ return spinLoadStart; },
      set spinLoadStart(v){ spinLoadStart = v; updateSpinState(); },
      get spinLoadType(){ return spinLoadType; },
      set spinLoadType(v){ spinLoadType = v; updateSpinState(); },
      get spinLogoClick(){ return spinLogoClick; },
      set spinLogoClick(v){ spinLogoClick = v; updateLogoClickState(); },
      get spinZoomMax(){ return spinZoomMax; },
      set spinZoomMax(v){ spinZoomMax = v; },
      get spinSpeed(){ return spinSpeed; },
      set spinSpeed(v){ spinSpeed = v; },
      startSpin,
      stopSpin,
      updateSpinState,
      updateLogoClickState
    };

    // Map layers
    function collectLocationEntries(post){
      const entries = [];
      const locs = Array.isArray(post?.locations) ? post.locations : [];
      locs.forEach((loc, idx) => {
        if(!loc) return;
        const lng = Number(loc.lng);
        const lat = Number(loc.lat);
        if(!Number.isFinite(lng) || !Number.isFinite(lat)) return;
        entries.push({
          post,
          loc,
          lng,
          lat,
          index: idx,
          key: venueKey(lng, lat)
        });
      });
      if(!entries.length && Number.isFinite(post?.lng) && Number.isFinite(post?.lat)){
        const fallbackVenue = typeof post?.venue === 'string' && post.venue
          ? post.venue
          : (post?.city || '');
        entries.push({
          post,
          loc:{
            venue: fallbackVenue,
            address: post?.city || '',
            lng: post.lng,
            lat: post.lat
          },
          lng: post.lng,
          lat: post.lat,
          index: 0,
          key: venueKey(post.lng, post.lat)
        });
      }
      return entries.filter(entry => entry.key);
    }

    function postsToGeoJSON(list){
      const features = [];
      if(!Array.isArray(list) || !list.length){
        return { type:'FeatureCollection', features };
      }

      const venueGroups = new Map();
      const orphanEntries = [];

      list.forEach(p => {
        if(!p) return;
        const entries = collectLocationEntries(p);
        entries.forEach(entry => {
          if(!entry) return;
          const key = entry.key;
          const post = entry.post || p;
          if(!key){
            orphanEntries.push({ post, entry });
            return;
          }
          let group = venueGroups.get(key);
          if(!group){
            group = { key, entries: [], postIds: new Set() };
            venueGroups.set(key, group);
          }
          group.entries.push({ post, entry });
          if(post && post.id !== undefined && post.id !== null){
            const strId = String(post.id);
            if(strId) group.postIds.add(strId);
          }
        });
      });

      const buildSingleFeature = ({ post, entry }) => {
        if(!post || !entry) return null;
        const key = entry.key || '';
        const baseSub = slugify(post.subcategory);
        const labelLines = getMarkerLabelLines(post);
        const combinedLabel = buildMarkerLabelText(post, labelLines);
        const spriteSource = [baseSub || '', labelLines.line1 || '', labelLines.line2 || ''].join('|');
        const labelSpriteId = hashString(spriteSource);
        const featureId = key
          ? `post:${post.id}::${key}::${entry.index}`
          : `post:${post.id}::${entry.index}`;
        const venueName = entry.loc && entry.loc.venue ? entry.loc.venue : getPrimaryVenueName(post);
        return {
          type:'Feature',
          id: featureId,
          properties:{
            id: post.id,
            featureId,
            title: post.title,
            label: combinedLabel,
            labelLine1: labelLines.line1,
            labelLine2: labelLines.line2,
            labelSpriteId,
            venueName,
            city: post.city,
            cat: post.category,
            sub: baseSub,
            baseSub,
            venueKey: key,
            locationIndex: entry.index,
            isMultiVenue: false
          },
          geometry:{ type:'Point', coordinates:[entry.lng, entry.lat] }
        };
      };

      const buildMultiFeature = (group) => {
        if(!group || !group.entries.length) return null;
        const multiCount = group.postIds.size;
        if(multiCount <= 1){
          return group.entries.map(buildSingleFeature).filter(Boolean);
        }
        const primary = group.entries[0];
        if(!primary || !primary.post || !primary.entry) return null;
        const { post, entry } = primary;
        const baseSub = slugify(post.subcategory);
        const multiIconId = MULTI_POST_MARKER_ICON_ID;
        const venueName = (() => {
          for(const item of group.entries){
            const candidate = item && item.entry && item.entry.loc && item.entry.loc.venue;
            if(candidate){
              return candidate;
            }
          }
          return getPrimaryVenueName(post);
        })() || '';
        const multiCountLabel = `${multiCount} posts here`;
        const multiVenueText = shortenMarkerLabelText(venueName, markerLabelTextAreaWidthPx);
        const combinedLabel = multiVenueText ? `${multiCountLabel}\n${multiVenueText}` : multiCountLabel;
        const spriteSource = ['multi', multiIconId || '', baseSub || '', multiCountLabel, multiVenueText || ''].join('|');
        const labelSpriteId = hashString(spriteSource);
        const featureId = `venue:${group.key}::${post.id}`;
        const coordinates = [entry.lng, entry.lat];
        const multiIds = Array.from(group.postIds);
        return [{
          type:'Feature',
          id: featureId,
          properties:{
            id: post.id,
            featureId,
            title: multiCountLabel,
            label: combinedLabel,
            labelLine1: multiCountLabel,
            labelLine2: multiVenueText,
            labelSpriteId,
            venueName,
            city: post.city,
            cat: post.category,
            sub: multiIconId,
            baseSub,
            venueKey: group.key,
            locationIndex: entry.index,
            isMultiVenue: true,
            multiCount,
            multiPostIds: multiIds
          },
          geometry:{ type:'Point', coordinates }
        }];
      };

      venueGroups.forEach(group => {
        const result = buildMultiFeature(group);
        if(Array.isArray(result)){
          result.forEach(feature => { 
            if(feature) {
              // Prevent nested clusters - check if cluster feature with same coordinates already exists
              const existing = features.find(f => 
                f && f.geometry && feature.geometry &&
                Array.isArray(f.geometry.coordinates) && Array.isArray(feature.geometry.coordinates) &&
                f.geometry.coordinates.length >= 2 && feature.geometry.coordinates.length >= 2 &&
                Math.abs(f.geometry.coordinates[0] - feature.geometry.coordinates[0]) < 0.0001 &&
                Math.abs(f.geometry.coordinates[1] - feature.geometry.coordinates[1]) < 0.0001 &&
                f.properties && f.properties.isMultiVenue && feature.properties && feature.properties.isMultiVenue
              );
              if(!existing){
                features.push(feature);
              }
            }
          });
        }
      });

      orphanEntries.forEach(item => {
        const feature = buildSingleFeature(item);
        if(feature) features.push(feature);
      });

      return {
        type:'FeatureCollection',
        features
      };
    }

    let addingPostSource = false;
    let pendingAddPostSource = false;

    function loadPostMarkers(){
      try{
        addPostSource();
      }catch(err){
        console.error('loadPostMarkers failed', err);
      }
    }

    async function addPostSource(){
      if(!map){
        return;
      }
      if(addingPostSource){
        pendingAddPostSource = true;
        return;
      }
      addingPostSource = true;
      if(map && Number.isFinite(lastKnownZoom) && lastKnownZoom >= MARKER_SPRITE_ZOOM){
        map.__retainAllMarkerSprites = true;
      }
      try{
      const markerList = filtersInitialized && Array.isArray(filtered) ? filtered : posts;
      const collections = getMarkerCollections(markerList);
      const { postsData, signature, featureIndex } = collections;
      markerFeatureIndex = featureIndex instanceof Map ? featureIndex : new Map();
      const featureCount = Array.isArray(postsData.features) ? postsData.features.length : 0;
      if(featureCount > 1000){
        await new Promise(resolve => scheduleIdle(resolve, 120));
      }
      const MARKER_MIN_ZOOM = MARKER_ZOOM_THRESHOLD;
      const existing = map.getSource('posts');
      if(!existing){
        map.addSource('posts', { type:'geojson', data: postsData, promoteId: 'featureId' });
        const source = map.getSource('posts');
        if(source){ source.__markerSignature = signature; }
      } else {
        existing.setData(postsData);
        existing.__markerSignature = signature;
      }
      const subcategoryMarkers = window.subcategoryMarkers || {};
      const iconIds = Object.keys(subcategoryMarkers);
      if(typeof ensureMapIcon === 'function'){
        await Promise.all(iconIds.map(id => ensureMapIcon(id).catch(()=>{})));
      }
      await prepareMarkerLabelCompositesForPosts(postsData);
      ensureMarkerLabelBackground(map);
      updateMapFeatureHighlights(lastHighlightedPostIds);
      const markerLabelBaseConditions = [
        ['!',['has','point_count']],
        ['has','title']
      ];
      const markerLabelFilter = ['all', ...markerLabelBaseConditions];

      const markerLabelIconImage = ['let', 'spriteId', ['coalesce', ['get','labelSpriteId'], ''],
        ['case',
          ['==', ['var','spriteId'], ''],
          MARKER_LABEL_BG_ID,
          ['concat', MARKER_LABEL_COMPOSITE_PREFIX, ['var','spriteId']]
        ]
      ];

      const markerLabelHighlightIconImage = ['let', 'spriteId', ['coalesce', ['get','labelSpriteId'], ''],
        ['case',
          ['==', ['var','spriteId'], ''],
          MARKER_LABEL_BG_ACCENT_ID,
          ['concat', MARKER_LABEL_COMPOSITE_PREFIX, ['var','spriteId'], MARKER_LABEL_COMPOSITE_ACCENT_SUFFIX]
        ]
      ];

      const highlightedStateExpression = ['boolean', ['feature-state', 'isHighlighted'], false];
      const markerLabelHighlightOpacity = ['case', highlightedStateExpression, 1, 0];
      const markerLabelBaseOpacity = ['case', highlightedStateExpression, 0, 1];

      const markerLabelMinZoom = MARKER_MIN_ZOOM;
      const labelLayersConfig = [
        { id:'marker-label', source:'posts', sortKey: 1100, filter: markerLabelFilter, iconImage: markerLabelIconImage, iconOpacity: markerLabelBaseOpacity, minZoom: markerLabelMinZoom },
        { id:'marker-label-highlight', source:'posts', sortKey: 1101, filter: markerLabelFilter, iconImage: markerLabelHighlightIconImage, iconOpacity: markerLabelHighlightOpacity, minZoom: markerLabelMinZoom }
      ];
      labelLayersConfig.forEach(({ id, source, sortKey, filter, iconImage, iconOpacity, minZoom }) => {
        const layerMinZoom = Number.isFinite(minZoom) ? minZoom : markerLabelMinZoom;
        let layerExists = !!map.getLayer(id);
        if(!layerExists){
          try{
            map.addLayer({
              id,
              type:'symbol',
              source,
              filter: filter || markerLabelFilter,
              minzoom: layerMinZoom,
              layout:{
                'icon-image': iconImage || markerLabelIconImage,
                'icon-size': 1,
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'icon-anchor': 'left',
                'icon-pitch-alignment': 'viewport',
                'symbol-z-order': 'viewport-y',
                'symbol-sort-key': sortKey
              },
              paint:{
                'icon-translate': [markerLabelBgTranslatePx, 0],
                'icon-translate-anchor': 'viewport',
                'icon-opacity': iconOpacity || 1
              }
            });
            layerExists = !!map.getLayer(id);
          }catch(e){
            layerExists = !!map.getLayer(id);
          }
        }
        if(!layerExists){
          return;
        }
        try{ map.setFilter(id, filter || markerLabelFilter); }catch(e){}
        try{ map.setLayoutProperty(id,'icon-image', iconImage || markerLabelIconImage); }catch(e){}
        try{ map.setLayoutProperty(id,'icon-size', 1); }catch(e){}
        try{ map.setLayoutProperty(id,'icon-allow-overlap', true); }catch(e){}
        try{ map.setLayoutProperty(id,'icon-ignore-placement', true); }catch(e){}
        try{ map.setLayoutProperty(id,'icon-anchor','left'); }catch(e){}
        try{ map.setLayoutProperty(id,'icon-pitch-alignment','viewport'); }catch(e){}
        try{ map.setLayoutProperty(id,'symbol-z-order','viewport-y'); }catch(e){}
        try{ map.setLayoutProperty(id,'symbol-sort-key', sortKey); }catch(e){}
        try{ map.setPaintProperty(id,'icon-translate',[markerLabelBgTranslatePx,0]); }catch(e){}
        try{ map.setPaintProperty(id,'icon-translate-anchor','viewport'); }catch(e){}
        try{ map.setPaintProperty(id,'icon-opacity', iconOpacity || 1); }catch(e){}
        try{ map.setLayerZoomRange(id, layerMinZoom, 24); }catch(e){}
      });
      ALL_MARKER_LAYER_IDS.forEach(id=>{
        if(map.getLayer(id)){
          try{ map.moveLayer(id); }catch(e){}
        }
      });
      [
        ['marker-label','icon-opacity-transition'],
        ['marker-label-highlight','icon-opacity-transition']
      ].forEach(([layer, prop])=>{
        if(map.getLayer(layer)){
          try{ map.setPaintProperty(layer, prop, {duration:0}); }catch(e){}
        }
      });
      refreshInViewMarkerLabelComposites(map);
      if(!postSourceEventsBound){
        function createMapCardOverlay(post, opts = {}){
          const { targetLngLat, fixedLngLat, eventLngLat, venueKey: overlayVenueKey = null } = opts;
          const previousKey = selectedVenueKey;
          if(overlayVenueKey){
            selectedVenueKey = overlayVenueKey;
          }
          try{
            const overlayRoot = document.createElement('div');
            overlayRoot.className = 'mapmarker-overlay';
            overlayRoot.setAttribute('aria-hidden', 'true');
            overlayRoot.style.pointerEvents = 'none';
            overlayRoot.style.userSelect = 'none';

            const parseVenueKey = (key)=>{
              if(typeof key !== 'string') return null;
              const parts = key.split(',');
              if(parts.length !== 2) return null;
              const lng = Number(parts[0]);
              const lat = Number(parts[1]);
              if(!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
              return { lng, lat };
            };

            let resolvedVenueKey = typeof overlayVenueKey === 'string' && overlayVenueKey ? overlayVenueKey : '';
            let resolvedCoords = resolvedVenueKey ? parseVenueKey(resolvedVenueKey) : null;
            const sourceCoord = targetLngLat || fixedLngLat || eventLngLat || (Number.isFinite(post?.lng) && Number.isFinite(post?.lat) ? { lng: post.lng, lat: post.lat } : null);
            if(!resolvedCoords && sourceCoord && Number.isFinite(sourceCoord.lng) && Number.isFinite(sourceCoord.lat)){
              resolvedCoords = { lng: Number(sourceCoord.lng), lat: Number(sourceCoord.lat) };
            }
            if(!resolvedVenueKey && resolvedCoords){
              resolvedVenueKey = toVenueCoordKey(resolvedCoords.lng, resolvedCoords.lat);
            }
            if(resolvedVenueKey){
              overlayRoot.dataset.venueKey = resolvedVenueKey;
            } else if(overlayVenueKey){
              overlayRoot.dataset.venueKey = overlayVenueKey;
            } else {
              delete overlayRoot.dataset.venueKey;
            }

            let visibleList = filtersInitialized ? filtered : posts;
            if(!Array.isArray(visibleList) || visibleList.length === 0){
              visibleList = Array.isArray(posts) ? posts : [];
            }
            const allowedIdSet = new Set(Array.isArray(visibleList) ? visibleList.map(item => {
              if(!item || item.id === undefined || item.id === null) return '';
              return String(item.id);
            }).filter(Boolean) : []);
            let venuePostsAll = [];
            if(resolvedCoords && typeof getPostsAtVenueByCoords === 'function'){
              venuePostsAll = getPostsAtVenueByCoords(resolvedCoords.lng, resolvedCoords.lat) || [];
            } else if(resolvedVenueKey && typeof getPostsAtVenueByCoords === 'function'){
              const coords = parseVenueKey(resolvedVenueKey);
              if(coords){
                venuePostsAll = getPostsAtVenueByCoords(coords.lng, coords.lat) || [];
              }
            }
            let venuePostsVisible = Array.isArray(venuePostsAll)
              ? venuePostsAll.filter(item => allowedIdSet.has(String(item && item.id)))
              : [];
            if((!Array.isArray(venuePostsVisible) || venuePostsVisible.length === 0) && post){
              venuePostsVisible = [post];
            }
            const uniqueVenuePosts = [];
            const venuePostIds = new Set();
            venuePostsVisible.forEach(item => {
              if(!item || item.id === undefined || item.id === null) return;
              const idStr = String(item.id);
              if(!idStr || venuePostIds.has(idStr)) return;
              venuePostIds.add(idStr);
              uniqueVenuePosts.push(item);
            });
            const multiIds = uniqueVenuePosts.map(item => String(item.id)).filter(Boolean);
            const multiCount = uniqueVenuePosts.length;
            const isMultiVenue = multiCount > 1;
            if(isMultiVenue){
              overlayRoot.dataset.multiIds = multiIds.join(',');
            } else {
              delete overlayRoot.dataset.multiIds;
            }
            const sortedList = Array.isArray(sortedPostList) ? sortedPostList : [];
            let primaryVenuePost = null;
            if(isMultiVenue && sortedList.length){
              primaryVenuePost = sortedList.find(entry => entry && venuePostIds.has(String(entry.id))) || null;
            }
            if(!primaryVenuePost){
              primaryVenuePost = uniqueVenuePosts[0] || post;
            }
            const overlayId = primaryVenuePost && primaryVenuePost.id !== undefined && primaryVenuePost.id !== null
              ? String(primaryVenuePost.id)
              : String(post.id);
            overlayRoot.dataset.id = overlayId;

            const markerContainer = document.createElement('div');
            markerContainer.className = 'small-map-card';
            markerContainer.dataset.id = overlayId;
            markerContainer.setAttribute('aria-hidden', 'true');
            markerContainer.style.pointerEvents = 'none';
            markerContainer.style.userSelect = 'none';

            const markerIcon = new Image();
            try{ markerIcon.decoding = 'async'; }catch(e){}
            markerIcon.alt = '';
            markerIcon.className = 'mapmarker';
            markerIcon.draggable = false;
            markerIcon.loading = 'eager';
            markerIcon.referrerPolicy = 'no-referrer';
            if(isMultiVenue){
              markerIcon.src = SMALL_MULTI_MAP_CARD_ICON_SRC;
              enforceSmallMultiMapCardIcon(markerIcon, overlayRoot);
            } else {
              const markerSources = window.subcategoryMarkers || {};
              const slugifyFn = typeof slugify === 'function' ? slugify : (window.slugify || (str => (str || '').toString().trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')));
              const markerIdCandidates = [];
              if(post && post.subcategory){
                markerIdCandidates.push(slugifyFn(post.subcategory));
              }
              const markerIconUrl = markerIdCandidates.map(id => (id && markerSources[id]) || null).find(Boolean) || '';
              if(markerIconUrl){
                markerIcon.src = markerIconUrl;
              }
            }
            requestAnimationFrame(() => {
              if(typeof markerIcon.decode === 'function'){
                markerIcon.decode().catch(()=>{});
              }
            });

            const markerPill = new Image();
            try{ markerPill.decoding = 'async'; }catch(e){}
            markerPill.alt = '';
            markerPill.src = 'assets/icons-30/150x40-pill-70.webp';
            markerPill.dataset.defaultSrc = 'assets/icons-30/150x40-pill-70.webp';
            markerPill.dataset.highlightSrc = 'assets/icons-30/150x40-pill-2f3b73.webp';
            markerPill.className = 'mapmarker-pill';
            markerPill.loading = 'eager';
            markerPill.style.opacity = '0.9';
            markerPill.style.visibility = 'visible';
            markerPill.draggable = false;
            requestAnimationFrame(() => {
              if(typeof markerPill.decode === 'function'){
                markerPill.decode().catch(()=>{});
              }
            });

            const labelLines = isMultiVenue ? null : getMarkerLabelLines(post);
            const venueDisplayName = (()=>{
              if(resolvedVenueKey){
                const candidates = uniqueVenuePosts.length ? uniqueVenuePosts : (post ? [post] : []);
                for(const candidate of candidates){
                  const locs = Array.isArray(candidate?.locations) ? candidate.locations : [];
                  const match = locs.find(loc => loc && toVenueCoordKey(loc.lng, loc.lat) === resolvedVenueKey && loc.venue);
                  if(match && match.venue){
                    return match.venue;
                  }
                }
              }
              const fallback = uniqueVenuePosts[0] || post;
              return getPrimaryVenueName(fallback) || '';
            })();
            const multiSmallVenueText = shortenMarkerLabelText(venueDisplayName, markerLabelTextAreaWidthPx);
            const multiBigVenueText = shortenMarkerLabelText(venueDisplayName, mapCardTitleWidthPx);
            const multiCountLabel = `${multiCount} posts here`;
            const markerLabel = document.createElement('div');
            markerLabel.className = 'mapmarker-label';
            if(isMultiVenue){
              markerContainer.classList.add('small-multi-post-map-card');
              const markerLine1 = document.createElement('div');
              markerLine1.className = 'mapmarker-label-line';
              markerLine1.textContent = multiCountLabel;
              const markerLine2 = document.createElement('div');
              markerLine2.className = 'mapmarker-label-line';
              markerLine2.textContent = multiSmallVenueText || venueDisplayName || '';
              markerLabel.append(markerLine1, markerLine2);
            } else if(labelLines){
              const markerLine1 = document.createElement('div');
              markerLine1.className = 'mapmarker-label-line';
              markerLine1.textContent = labelLines.line1;
              markerLabel.appendChild(markerLine1);
              if(labelLines.line2){
                const markerLine2 = document.createElement('div');
                markerLine2.className = 'mapmarker-label-line';
                markerLine2.textContent = labelLines.line2;
                markerLabel.appendChild(markerLine2);
              }
            }

            markerContainer.append(markerPill, markerIcon, markerLabel);

            const cardRoot = document.createElement('div');
            cardRoot.className = 'big-map-card big-map-card--popup';
            if(isMultiVenue){
              cardRoot.classList.add('big-multi-post-map-card');
            }
            cardRoot.dataset.id = overlayId;
            cardRoot.setAttribute('aria-hidden', 'true');
            cardRoot.style.pointerEvents = 'auto';
            cardRoot.style.userSelect = 'none';

            const pillImg = new Image();
            try{ pillImg.decoding = 'async'; }catch(e){}
            pillImg.alt = '';
            pillImg.src = 'assets/icons-30/225x60-pill-99.webp';
            pillImg.className = 'map-card-pill';
            pillImg.style.opacity = '0.9';
            pillImg.draggable = false;

            const thumbImg = new Image();
            try{ thumbImg.decoding = 'async'; }catch(e){}
            thumbImg.alt = '';
            thumbImg.loading = 'eager';
            thumbImg.draggable = false;
            if(isMultiVenue){
              thumbImg.src = 'assets/icons-30/multi-post-icon-50.webp';
              thumbImg.className = 'map-card-thumb';
            } else {
              const thumbFallback = 'assets/funmap-logo-small.png';
              thumbImg.onerror = ()=>{
                thumbImg.onerror = null;
                thumbImg.src = thumbFallback;
              };
              thumbImg.src = thumbUrl(post) || thumbFallback;
              thumbImg.className = 'map-card-thumb';
              thumbImg.referrerPolicy = 'no-referrer';
            }
            requestAnimationFrame(() => {
              if(typeof thumbImg.decode === 'function'){
                thumbImg.decode().catch(()=>{});
              }
            });

            const labelEl = document.createElement('div');
            labelEl.className = 'map-card-label';
            const titleWrap = document.createElement('div');
            titleWrap.className = 'map-card-title';
            if(isMultiVenue){
              [multiCountLabel, multiBigVenueText || venueDisplayName || ''].forEach(line => {
                const lineEl = document.createElement('div');
                lineEl.className = 'map-card-title-line';
                lineEl.textContent = line;
                titleWrap.appendChild(lineEl);
              });
            } else if(labelLines){
              const cardTitleLines = Array.isArray(labelLines.cardTitleLines) && labelLines.cardTitleLines.length
                ? labelLines.cardTitleLines.slice(0, 2)
                : [labelLines.line1, labelLines.line2].filter(Boolean).slice(0, 2);
              cardTitleLines.forEach(line => {
                if(!line) return;
                const lineEl = document.createElement('div');
                lineEl.className = 'map-card-title-line';
                lineEl.textContent = line;
                titleWrap.appendChild(lineEl);
              });
            }
            if(!titleWrap.childElementCount){
              const lineEl = document.createElement('div');
              lineEl.className = 'map-card-title-line';
              lineEl.textContent = '';
              titleWrap.appendChild(lineEl);
            }
            labelEl.appendChild(titleWrap);
            if(!isMultiVenue && labelLines){
              const venueLine = labelLines.venueLine || shortenMarkerLabelText(getPrimaryVenueName(post), mapCardTitleWidthPx);
              if(venueLine){
                const venueEl = document.createElement('div');
                venueEl.className = 'map-card-venue';
                venueEl.textContent = venueLine;
                labelEl.appendChild(venueEl);
              }
            }

            cardRoot.append(pillImg, thumbImg, labelEl);
            overlayRoot.append(markerContainer, cardRoot);
            overlayRoot.classList.add('is-card-visible');
            overlayRoot.style.pointerEvents = '';
            resetBigMapCardTransforms();

            const handleOverlayClick = (ev)=>{
              ev.preventDefault();
              ev.stopPropagation();
              const pid = overlayRoot.dataset.id;
              if(!pid) return;
              callWhenDefined('openPost', (fn)=>{
                requestAnimationFrame(() => {
                  try{
                    touchMarker = null;
                    stopSpin();
                    if(typeof closePanel === 'function' && typeof filterPanel !== 'undefined' && filterPanel){
                      try{ closePanel(filterPanel); }catch(err){}
                    }
                    // CASE 3: MAP MARKER CLICKED (overlay) - SCROLL TO TOP
                    // Parameters: (id, fromHistory=false, fromMap=true, originEl=null)
                    fn(pid, false, true, null);
                  }catch(err){ console.error(err); }
                });
              });
            };
            cardRoot.addEventListener('click', handleOverlayClick, { capture: true });
            ['pointerdown','mousedown','touchstart'].forEach(type => {
              cardRoot.addEventListener(type, (ev)=>{
                const pointerType = typeof ev.pointerType === 'string' ? ev.pointerType.toLowerCase() : '';
                const isTouchLike = pointerType === 'touch' || ev.type === 'touchstart';
                if(!isTouchLike){
                  try{ ev.preventDefault(); }catch(err){}
                }
                try{ ev.stopPropagation(); }catch(err){}
              }, { capture: true });
            });
            const marker = new mapboxgl.Marker({ element: overlayRoot, anchor: 'center' });
            if(typeof marker.setZIndexOffset === 'function'){
              try{ marker.setZIndexOffset(20000); }catch(e){}
            }
            const markerElement = typeof marker.getElement === 'function' ? marker.getElement() : overlayRoot;
            if(markerElement && markerElement.style){
              markerElement.style.zIndex = '20000';
            }
            if(targetLngLat){ marker.setLngLat(targetLngLat); }
            else if(fixedLngLat){ marker.setLngLat(fixedLngLat); }
            else if(eventLngLat){ marker.setLngLat(eventLngLat); }
            marker.addTo(map);
            marker.__fixedLngLat = fixedLngLat;
            window.__overCard = false;
            registerPopup(marker);
            return marker;
          } finally {
            if(overlayVenueKey){
              selectedVenueKey = previousKey;
            }
          }
        }

        const handleMarkerClick = (e)=>{
          stopSpin();
          const f = e.features && e.features[0]; if(!f) return;
          const props = f.properties || {};
          const venueKey = props.venueKey || null;
          const id = props.id;
          const rawMultiIds = Array.isArray(props.multiPostIds) ? props.multiPostIds : [];
          const normalizedMultiIds = rawMultiIds.map(item => String(item)).filter(Boolean);
          const multiCountFromProps = Number(props.multiCount);
          let normalizedMultiCount = Number.isFinite(multiCountFromProps) && multiCountFromProps > 0 ? multiCountFromProps : 0;
          if(!normalizedMultiCount){
            normalizedMultiCount = normalizedMultiIds.length;
          }
          const helperMultiCount = Math.max(normalizedMultiIds.length, normalizedMultiCount, props.isMultiVenue ? 2 : 0);
          const isMultiCluster = helperMultiCount > 1;
          if(id !== undefined && id !== null){
            activePostId = id;
            selectedVenueKey = venueKey;
            updateSelectedMarkerRing();
          }
          const coords = f.geometry && f.geometry.coordinates;
          const hasCoords = Array.isArray(coords) && coords.length >= 2 && Number.isFinite(coords[0]) && Number.isFinite(coords[1]);
          const baseLngLat = hasCoords ? { lng: coords[0], lat: coords[1] } : (e && e.lngLat ? { lng: e.lngLat.lng, lat: e.lngLat.lat } : null);
          const fixedLngLat = baseLngLat || (e && e.lngLat ? { lng: e.lngLat.lng, lat: e.lngLat.lat } : null);
          const targetLngLat = baseLngLat || (e ? e.lngLat : null);
          const touchClick = isTouchDevice || (e.originalEvent && (e.originalEvent.pointerType === 'touch' || e.originalEvent.pointerType === 'pen'));
          if(touchClick){
            if(touchMarker !== id || !hoverPopup){
              touchMarker = id;
              if(hoverPopup){
                runOverlayCleanup(hoverPopup);
                try{ hoverPopup.remove(); }catch(err){}
                hoverPopup = null;
                updateSelectedMarkerRing();
              }
              const p = posts.find(x=>x.id===id);
              if(p){
                hoverPopup = createMapCardOverlay(p, { targetLngLat, fixedLngLat, eventLngLat: e && e.lngLat, venueKey });
                updateSelectedMarkerRing();
              }
            }
            if(isMultiCluster){
              autoOpenPostBoardForCluster({
                multiIds: normalizedMultiIds,
                multiCount: helperMultiCount,
                trigger: 'touch'
              });
            }
            return;
          }
          if(isMultiCluster){
            autoOpenPostBoardForCluster({
              multiIds: normalizedMultiIds,
              multiCount: helperMultiCount,
              trigger: 'click'
            });
          }
        };
      MARKER_INTERACTIVE_LAYERS.forEach(layer => map.on('click', layer, handleMarkerClick));

      map.on('click', e=>{
        const originalTarget = e.originalEvent && e.originalEvent.target;
        const targetEl = originalTarget && typeof originalTarget.closest === 'function'
          ? originalTarget.closest('.mapmarker-overlay')
          : null;
        if(targetEl){
          return;
        }
        const feats = map.queryRenderedFeatures(e.point);
        if(!feats.length){
          if(hoverPopup){
            runOverlayCleanup(hoverPopup);
            try{ hoverPopup.remove(); }catch(err){}
            hoverPopup = null;
          }
          updateSelectedMarkerRing();
          touchMarker = null;
        }
      });

      updateSelectedMarkerRing();

      // Cursor + popup for marker points
      
      const handleMarkerMouseEnter = (e)=>{
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features && e.features[0]; if(!f) return;
        const props = f.properties || {};
        const id = props.id;
        const venueKey = props.venueKey || null;
        const coords = f.geometry && f.geometry.coordinates;
        const hasCoords = Array.isArray(coords) && coords.length >= 2 && Number.isFinite(coords[0]) && Number.isFinite(coords[1]);
        const baseLngLat = hasCoords ? { lng: coords[0], lat: coords[1] } : (e && e.lngLat ? { lng: e.lngLat.lng, lat: e.lngLat.lat } : null);
        const fixedLngLat = baseLngLat || (e && e.lngLat ? { lng: e.lngLat.lng, lat: e.lngLat.lat } : null);
        const targetLngLat = baseLngLat || (e ? e.lngLat : null);
        const p = posts.find(x=>x.id===id);
        if(!p){
          return;
        }
        if(hoverPopup){
          runOverlayCleanup(hoverPopup);
          try{ hoverPopup.remove(); }catch(e){}
          hoverPopup = null;
          updateSelectedMarkerRing();
        }
        hoverPopup = createMapCardOverlay(p, { targetLngLat, fixedLngLat, eventLngLat: e && e.lngLat, venueKey });
        updateSelectedMarkerRing();
      };
      MARKER_INTERACTIVE_LAYERS.forEach(layer => map.on('mouseenter', layer, handleMarkerMouseEnter));

      const onMarkerMove = window.rafThrottle((evt)=>{
        if(hoverPopup && typeof hoverPopup.setLngLat === 'function'){
          const fixed = hoverPopup.__fixedLngLat;
          if(fixed && Number.isFinite(fixed.lng) && Number.isFinite(fixed.lat)){
            hoverPopup.setLngLat(fixed);
          }
        }
      });
      MARKER_INTERACTIVE_LAYERS.forEach(layer => map.on('mousemove', layer, onMarkerMove));

      const handleMarkerMouseLeave = ()=>{
        map.getCanvas().style.cursor = 'grab';
        if(listLocked) return;
        const currentPopup = hoverPopup;
        schedulePopupRemoval(currentPopup, 200);
      };
      MARKER_INTERACTIVE_LAYERS.forEach(layer => map.on('mouseleave', layer, handleMarkerMouseLeave));

      // Maintain pointer cursor for balloons and surface multi-venue cards when applicable
        postSourceEventsBound = true;
      }
      } catch (err) {
        console.error('addPostSource failed', err);
      } finally {
        addingPostSource = false;
        const shouldReplay = pendingAddPostSource;
        pendingAddPostSource = false;
        if(shouldReplay){
          addPostSource();
        }
      }
    }
    window.addPostSource = addPostSource;
    function renderLists(list){
      if(spinning || !postsLoaded) return;
      
      // If there's an open post, skip the full re-render to avoid flashing/reloading cards
      const existingOpenPost = postsWideEl.querySelector('.open-post');
      if(existingOpenPost){
        // Just update the sorted list and counts without rebuilding the DOM
        const sort = currentSort;
        const arr = list.slice();
        if(sort==='az') arr.sort((a,b)=> a.title.localeCompare(b.title));
        if(sort==='soon') arr.sort((a,b)=> a.dates[0].localeCompare(b.dates[0]));
        if(sort==='nearest'){
          let ref = {lng:0,lat:0}; if(map){ const c = map.getCenter(); ref = {lng:c.lng,lat:c.lat}; }
          arr.sort((a,b)=> distKm({lng:a.lng,lat:a.lat}, ref) - distKm({lng:b.lng,lat:b.lat}, ref));
        }
        if(favToTop && !favSortDirty) arr.sort((a,b)=> (b.fav - a.fav));
        
        const { postsData } = getMarkerCollections(arr);
        const boundsForCount = getVisibleMarkerBoundsForCount();
        const markerTotal = boundsForCount ? countMarkersForVenue(arr, null, boundsForCount) : countMarkersForVenue(arr);
        
        sortedPostList = arr;
        updateResultCount(markerTotal);
        return;
      }
      
      const sort = currentSort;
      const arr = list.slice();
      if(sort==='az') arr.sort((a,b)=> a.title.localeCompare(b.title));
      if(sort==='soon') arr.sort((a,b)=> a.dates[0].localeCompare(b.dates[0]));
      if(sort==='nearest'){
        let ref = {lng:0,lat:0}; if(map){ const c = map.getCenter(); ref = {lng:c.lng,lat:c.lat}; }
        arr.sort((a,b)=> distKm({lng:a.lng,lat:a.lat}, ref) - distKm({lng:b.lng,lat:b.lat}, ref));
      }
      if(favToTop && !favSortDirty) arr.sort((a,b)=> (b.fav - a.fav));

      const { postsData } = getMarkerCollections(arr);
      const boundsForCount = getVisibleMarkerBoundsForCount();
      const markerTotal = boundsForCount ? countMarkersForVenue(arr, null, boundsForCount) : countMarkersForVenue(arr);

      sortedPostList = arr;
      renderedPostCount = 0;

      if(postBatchObserver) postBatchObserver.disconnect();
      removeScrollListener(postsWideEl, onPostBoardScroll, postBoardScrollOptions);
      postBoardScrollOptions = null;
      if(postSentinel) postSentinel.remove();
      postSentinel = null;

      if(resultsEl) resultsEl.innerHTML = '';
      postsWideEl.innerHTML = '';

      if(markerTotal === 0){
        updateResultCount(0);
        const emptyWrap = document.createElement('div');
        emptyWrap.className = 'post-board-empty';
        const summaryEl = $('#filterSummary');
        const summaryText = summaryEl ? summaryEl.textContent.trim() : '';
        const summaryCopy = document.createElement('div');
        summaryCopy.className = 'filter-summary post-board-empty-summary';
        summaryCopy.textContent = summaryText || 'No results match your filters.';
        emptyWrap.appendChild(summaryCopy);
        const emptyImg = document.createElement('img');
        emptyImg.src = 'assets/monkeys/Firefly_cute-little-monkey-in-red-cape-pointing-up-937096.png';
        emptyImg.alt = 'Cute little monkey in red cape pointing up';
        emptyImg.className = 'post-board-empty-image';
        emptyWrap.appendChild(emptyImg);
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'post-board-empty-message';
        emptyMsg.dataset.messageKey = 'msg_posts_empty_state';
        emptyMsg.textContent = 'There are no posts here. Try moving the map or changing your filter settings.';
        emptyWrap.appendChild(emptyMsg);
        // Load message from DB asynchronously
        (async () => {
          const msg = await getMessage('msg_posts_empty_state', {}, false);
          if(msg) emptyMsg.textContent = msg;
        })();
        postsWideEl.appendChild(emptyWrap);
        return;
      }

      postSentinel = document.createElement('div');
      postSentinel.style.height = '1px';
      postsWideEl.appendChild(postSentinel);

      if(spinning && arr.length){
        const sample = card(arr[0], true);
        sample.style.visibility = 'hidden';
        postsWideEl.insertBefore(sample, postSentinel);
        const rect = sample.getBoundingClientRect();
        const style = getComputedStyle(sample);
        const cardHeight = rect.height + parseFloat(style.marginBottom || 0);
        postsWideEl.removeChild(sample);
        const max = Math.max(1, Math.floor(postsModeEl.clientHeight / cardHeight));
        appendPostBatch(max);
      } else {
        appendPostBatch(INITIAL_RENDER_COUNT);
      }

      updateResultCount(markerTotal);

      if('IntersectionObserver' in window){
        postBatchObserver = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            if(entry.isIntersecting){
              appendPostBatch();
            }
          });
        }, {root: postsWideEl, rootMargin:'0px 0px 200px 0px'});
        postBatchObserver.observe(postSentinel);
      } else {
        postBoardScrollOptions = addPassiveScrollListener(postsWideEl, onPostBoardScroll);
      }
    }
    function updateResultCount(n){
      const el = $('#resultCount');
      if(!el) return;
      if(spinning){
        el.innerHTML = '';
        el.style.display = 'none';
        return;
      }
      el.innerHTML = `<strong>${n}</strong>`;
      el.style.display = '';
    }
    function formatDates(d){
      if(!d || !d.length) return '';
      const sorted = d.slice().sort();
      const currentYear = new Date().getFullYear();
      const formatPart = (dateObj, includeYear=false)=>{
        const base = dateObj.toLocaleDateString('en-GB',{weekday:'short', day:'numeric', month:'short'}).replace(/,/g,'');
        return includeYear ? `${base}, ${dateObj.getFullYear()}` : base;
      };
      const first = parseISODate(sorted[0]);
      const last = parseISODate(sorted[sorted.length-1]);
      if(sorted.length === 1){
        const includeYear = first.getFullYear() !== currentYear;
        return formatPart(first, includeYear);
      }
      const firstYear = first.getFullYear();
      const lastYear = last.getFullYear();
      const crossYear = firstYear !== lastYear;
      const firstIncludeYear = crossYear && firstYear !== currentYear;
      const lastIncludeYear = (crossYear && lastYear !== currentYear) || (!crossYear && lastYear !== currentYear);
      const startText = formatPart(first, firstIncludeYear);
      const endText = formatPart(last, lastIncludeYear);
      return `${startText} - ${endText}`;
    }

    function parseCreatedToDate(created){
      if(!created) return null;
      const parts = created.split('T');
      if(parts.length < 2) return null;
      const [datePart, rawTime] = parts;
      if(!datePart) return null;
      const hasZ = rawTime.endsWith('Z');
      const timeCore = hasZ ? rawTime.slice(0, -1) : rawTime;
      const [hh = '00', mm = '00', ss = '00', ms = ''] = timeCore.split('-');
      const iso = `${datePart}T${hh.padStart(2,'0')}:${mm.padStart(2,'0')}:${ss.padStart(2,'0')}${ms ? '.' + ms : ''}${hasZ ? 'Z' : ''}`;
      const dt = new Date(iso);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }

    function formatPostTimestamp(created){
      const dt = parseCreatedToDate(created);
      if(!dt) return '';
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth()+1).padStart(2,'0');
      const d = String(dt.getUTCDate()).padStart(2,'0');
      const hh = String(dt.getUTCHours()).padStart(2,'0');
      const mm = String(dt.getUTCMinutes()).padStart(2,'0');
      return `${y}-${m}-${d} ${hh}:${mm} UTC`;
    }

    function prioritizeVisibleImages(){
      const roots = [postsWideEl];
      if(resultsEl) roots.push(resultsEl);
      roots.forEach(root => {
        const imgs = root.querySelectorAll('img.thumb');
        if(!imgs.length) return;
        if('IntersectionObserver' in window){
          const observerRoot = root === postsWideEl ? root.closest('.post-board') : root;
          const obs = new IntersectionObserver(entries => {
            entries.forEach(entry => {
              if(entry.isIntersecting){
                const img = entry.target;
                if(img.dataset.src){
                  img.addEventListener('load', ()=> img.classList.remove('lqip'), {once:true});
                  img.src = img.dataset.src;
                  img.removeAttribute('data-src');
                }
                img.fetchPriority = 'high';
                obs.unobserve(img);
              }
            });
          }, {root: observerRoot});
          imgs.forEach(img => obs.observe(img));
        } else {
          imgs.forEach(img => {
            img.loading = 'lazy';
            if(img.dataset.src){
              img.addEventListener('load', ()=> img.classList.remove('lqip'), {once:true});
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
            }
          });
        }
      });
    }

    function card(p, wide=false){
      const el = document.createElement('article');
      el.className = wide ? 'post-card' : 'recents-card';
      el.dataset.id = p.id;
      const thumbSrc = thumbUrl(p);
      const thumb = `<img class="thumb lqip" loading="lazy" src="${thumbSrc}" alt="" referrerpolicy="no-referrer" />`;
        el.innerHTML = `
          ${thumb}
        <div class="meta">
          <div class="title">${p.title}</div>
          <div class="info">
            <div class="cat-line"><span class="sub-icon">${subcategoryIcons[p.subcategory]||''}</span> ${p.category} &gt; ${p.subcategory}</div>
            <div class="loc-line"><span class="badge" title="Venue">📍</span><span>${p.city}</span></div>
            <div class="date-line"><span class="badge" title="Dates">📅</span><span>${formatDates(p.dates)}</span></div>
          </div>
        </div>
        <div class="card-actions">
          <button class="fav" aria-pressed="${p.fav?'true':'false'}" aria-label="Toggle favourite">
            <svg viewBox="0 0 24 24"><path d="M12 17.3 6.2 21l1.6-6.7L2 9.3l6.9-.6L12 2l3.1 6.7 6.9.6-5.8 4.9L17.8 21 12 17.3z"/></svg>
          </button>
        </div>
      `;
      el.dataset.surfaceBg = CARD_SURFACE;
      el.style.background = CARD_SURFACE;
      el.querySelector('.fav').addEventListener('click', (e)=>{
        e.stopPropagation();
        p.fav = !p.fav;
        favSortDirty = true;
        document.querySelectorAll(`[data-id="${p.id}"] .fav`).forEach(btn=>{
          btn.setAttribute('aria-pressed', p.fav ? 'true' : 'false');
        });
        renderHistoryBoard();
      });

      const handleHoverHighlight = (state)=> toggleSmallMapCardHoverHighlight(p.id, state);

      el.addEventListener('mouseenter', ()=> handleHoverHighlight(true));
      el.addEventListener('mouseleave', ()=> handleHoverHighlight(false));
      el.dataset.hoverHighlightBound = '1';
      return el;
    }

    document.addEventListener('mouseover', event => {
      const cardEl = event.target.closest('.post-card, .recents-card');
      if(!cardEl || cardEl.dataset.hoverHighlightBound === '1') return;
      const related = event.relatedTarget;
      if(related && cardEl.contains(related)) return;
      const id = cardEl.dataset ? cardEl.dataset.id : null;
      if(!id) return;
      toggleSmallMapCardHoverHighlight(id, true);
    });

    document.addEventListener('mouseout', event => {
      const cardEl = event.target.closest('.post-card, .recents-card');
      if(!cardEl || cardEl.dataset.hoverHighlightBound === '1') return;
      const related = event.relatedTarget;
      if(related && cardEl.contains(related)) return;
      const id = cardEl.dataset ? cardEl.dataset.id : null;
      if(!id) return;
      toggleSmallMapCardHoverHighlight(id, false);
    });

    // History board
    function loadHistory(){ 
      try{ 
        const historyStr = localStorage.getItem('openHistoryV2');
        if(!historyStr) return [];
        return JSON.parse(historyStr);
      }catch(e){ 
        console.error('Failed to load history:', e);
        // Don't return empty array - show error or return null
        return null; // Or throw error
      } 
    }
    function saveHistory(){ localStorage.setItem('openHistoryV2', JSON.stringify(viewHistory)); }
    function formatLastOpened(ts){
      if(!ts) return '';
      const diff = Date.now() - ts;
      const mins = Math.floor(diff/60000);
      let ago;
      if(mins < 60){
        ago = mins + ' minute' + (mins===1?'':'s');
      } else if(mins < 1440){
        const hrs = Math.floor(mins/60);
        ago = hrs + ' hour' + (hrs===1?'':'s');
      } else {
        const days = Math.floor(mins/1440);
        ago = days + ' day' + (days===1?'':'s');
      }
      const d = new Date(ts);
      const weekday = d.toLocaleDateString('en-GB', {weekday:'short'});
      const day = d.getDate();
      const month = d.toLocaleDateString('en-GB', {month:'short'});
      const year = d.getFullYear();
      const hour = String(d.getHours()).padStart(2,'0');
      const minute = String(d.getMinutes()).padStart(2,'0');
      return `Last opened ${ago} ago - ${weekday} ${day} ${month}, ${year} ${hour}:${minute}`;
    }

    function captureState(){
      const {start,end} = orderedRange();
      const openCats = Object.values(categoryControllers).filter(ctrl=>ctrl.getOpenState && ctrl.getOpenState()).map(ctrl=>ctrl.name);
      return {
        bounds: map ? map.getBounds().toArray() : null,
        kw: $('#keyword-textbox').value,
        date: $('#daterange-textbox').value,
        start: start ? toISODate(start) : null,
        end: end ? toISODate(end) : null,
        expired: $('#expiredToggle').checked,
        minPrice: $('#min-price-input') ? $('#min-price-input').value : '',
        maxPrice: $('#max-price-input') ? $('#max-price-input').value : '',
        cats: [...selection.cats],
        subs: [...selection.subs],
        openCats
      };
    }

    function restoreState(st){
      if(!st) return;
      $('#keyword-textbox').value = st.kw || '';
      if($('#min-price-input')){
        const minEl = $('#min-price-input');
        minEl.value = (st.minPrice || '').toString().replace(/\D+/g,'');
      }
      if($('#max-price-input')){
        const maxEl = $('#max-price-input');
        maxEl.value = (st.maxPrice || '').toString().replace(/\D+/g,'');
      }
      dateStart = st.start ? parseISODate(st.start) : null;
      dateEnd = st.end ? parseISODate(st.end) : null;
      if(!st.start && st.range){
        const parts = st.range.split(' to ').map(s=>s.trim());
        if(parts[0]) dateStart = parseISODate(parts[0]);
        if(parts[1]) dateEnd = parseISODate(parts[1]);
      }
      $('#expiredToggle').checked = st.expired || false;
      if($('#expiredToggle').checked){
        buildFilterCalendar(minPickerDate, maxPickerDate);
      } else {
        buildFilterCalendar(today, maxPickerDate);
      }
      if(dateStart){
        const sIso = toISODate(dateStart);
        const sDisp = fmtShort(sIso);
        if(dateEnd && dateEnd.getTime() !== dateStart.getTime()){
          const eIso = toISODate(dateEnd);
          const eDisp = fmtShort(eIso);
          $('#daterange-textbox').value = `${sDisp} - ${eDisp}`;
        } else {
          $('#daterange-textbox').value = sDisp;
        }
      } else {
        $('#daterange-textbox').value = '';
      }
      expiredWasOn = $('#expiredToggle').checked;
      updateRangeClasses();
      updateInput();
      const savedCatsArray = Array.isArray(st.cats) && st.cats.length ? st.cats : categories.map(cat=>cat.name);
      const savedCats = new Set(savedCatsArray);
      const savedSubsArray = Array.isArray(st.subs) ? st.subs : null;
      const subsToUse = savedSubsArray && savedSubsArray.length ? savedSubsArray : allSubcategoryKeys;
      const openCats = Array.isArray(st.openCats) ? new Set(st.openCats) : null;
      selection.cats = new Set();
      selection.subs = new Set(subsToUse);
      const controllers = Object.values(categoryControllers);
      if(controllers.length){
        controllers.forEach(ctrl=>{
          const active = savedCats.has(ctrl.name);
          ctrl.setActive(active, {silent:true});
          const shouldOpen = active && (openCats ? openCats.has(ctrl.name) : false);
          ctrl.setOpen(shouldOpen);
          ctrl.syncSubs();
        });
      } else {
        selection.cats = new Set(savedCatsArray);
      }
      if(map && st.bounds){
        stopSpin();
        const bounds = new mapboxgl.LngLatBounds(st.bounds);
        map.fitBounds(bounds, {padding:10});
        postPanel = bounds;
      }
      applyFilters();
      updateClearButtons();
      updateCategoryResetBtn();
    }
    function renderHistoryBoard(){
      if(!recentsBoard) return;
      recentsBoard.innerHTML='';
      const validHistory = viewHistory.filter(v => getPostByIdAnywhere(v.id));
      viewHistory = validHistory;
      saveHistory();
      const items = viewHistory.slice(0,100);
      for(const v of items){
        const p = getPostByIdAnywhere(v.id);
        if(!p) continue;
        if(!v.lastOpened) v.lastOpened = Date.now();
        const labelEl = document.createElement('div');
        labelEl.className = 'last-opened-label';
        labelEl.textContent = formatLastOpened(v.lastOpened);
        recentsBoard.appendChild(labelEl);
        const el = card(p);
        recentsBoard.appendChild(el);
      }
      const reminderWrap = document.createElement('div');
      reminderWrap.className = 'recents-board-reminder';
      const reminderImg = document.createElement('img');
      reminderImg.src = 'assets/monkeys/Firefly_cute-little-monkey-in-red-cape-pointing-up-937096.png';
      reminderImg.alt = 'Cute little monkey in red cape pointing up';
      reminderWrap.appendChild(reminderImg);
      const reminderMsg = document.createElement('p');
      reminderMsg.dataset.messageKey = 'msg_member_login_reminder';
      reminderMsg.textContent = 'When you log in as a member, I can remember your recent posts and favourites on any device.';
      // Load message from DB asynchronously
      (async () => {
        const msg = await getMessage('msg_member_login_reminder', {}, false);
        if(msg) reminderMsg.textContent = msg;
      })();
      reminderWrap.appendChild(reminderMsg);
      recentsBoard.appendChild(reminderWrap);
    }

    renderHistoryBoard();

function openPostModal(id){
      const p = getPostByIdAnywhere(id);
      if(!p) return;
      activePostId = id;
      updateSelectedMarkerRing();
      const container = document.getElementById('post-modal-container');
      if(!container) return;
      const modal = container.querySelector('.post-modal');
      modal.innerHTML='';
      const wrap = document.createElement('div');
      wrap.className = 'post-board';
      const detail = buildDetail(p);
      const cardEl = detail.querySelector('.post-card');
      const favBtn = cardEl && cardEl.querySelector('.fav');
      if(cardEl && favBtn){
        const closeBtn = document.createElement('button');
        closeBtn.type='button';
        closeBtn.className='close-post';
        closeBtn.setAttribute('aria-label','Close post');
        closeBtn.textContent='✖';
        closeBtn.style.marginLeft='10px';
        favBtn.after(closeBtn);
        closeBtn.addEventListener('click', e=>{ e.stopPropagation(); closePostModal(); });
      }
      wrap.appendChild(detail);
      modal.appendChild(wrap);
      hookDetailActions(detail, p);
      container.classList.remove('hidden');
      const panelStack = window.panelStack || [];
      if(!panelStack.includes(container)) panelStack.push(container);
      bringToTop(container);
      requestAnimationFrame(()=>{
        const imgArea = detail.querySelector('.post-images');
        const text = detail.querySelector('.post-details');
        if(headerEl){
          headerEl.style.position='sticky';
          headerEl.style.top='0';
          headerEl.style.zIndex='2';
        }
        if(imgArea && text && text.offsetTop === imgArea.offsetTop){
          imgArea.style.position='sticky';
          imgArea.style.top = headerEl ? headerEl.offsetHeight + 'px' : '0';
        }
      });
      viewHistory = viewHistory.filter(x=>x.id!==id);
      viewHistory.unshift({id:p.id, title:p.title, url:postUrl(p), lastOpened: Date.now()});
      if(viewHistory.length>100) viewHistory.length=100;
      saveHistory(); renderHistoryBoard();
      location.hash = `/post/${p.slug}-${p.created}`;
    }

    function closePostModal(){
      const container = document.getElementById('post-modal-container');
      if(!container) return;
      container.classList.add('hidden');
      const panelStack = window.panelStack || [];
      const idx = panelStack.indexOf(container);
      if(idx!==-1) panelStack.splice(idx,1);
      const modal = container.querySelector('.post-modal');
      if(modal) modal.innerHTML='';
      location.hash = '';
    }
    window.closePostModal = closePostModal;

    function handleHash(){
      if(!location.hash){
        closePostModal();
        return;
      }
      const m = location.hash.match(/\/post\/([^\/]+)-([^\/]+)$/);
      if(!m) return;
      const slug = decodeURIComponent(m[1]);
      const created = m[2];
      const matchPost = (list) => {
        if(!Array.isArray(list) || !list.length) return null;
        return list.find(x => x && x.slug === slug && x.created === created) || null;
      };
      let post = matchPost(posts);
      if(!post){
        const cache = getAllPostsCache({ allowInitialize: true });
        post = matchPost(cache);
      }
      if(post){ openPostModal(post.id); }
    }

    window.addEventListener('hashchange', handleHash);

    window.addEventListener('resize', ()=>{});

    document.addEventListener('DOMContentLoaded', ()=>{
      const container = document.getElementById('post-modal-container');
      if(container){
        container.addEventListener('click', e=>{ if(e.target===container) closePostModal(); });
      }
      handleHash();
    });

    document.addEventListener('click', (ev)=>{
      const card = ev.target.closest('.mapboxgl-popup.big-map-card .big-map-card');
      if(card){
        ev.preventDefault();
        const pid = card.getAttribute('data-id') || (card.closest('.map-card-list-item') && card.closest('.map-card-list-item').getAttribute('data-id'));
        if(pid){
          callWhenDefined('openPost', (fn)=>{
            requestAnimationFrame(() => {
              try{
                touchMarker = null;
                stopSpin();
                if(typeof closePanel === 'function' && typeof filterPanel !== 'undefined' && filterPanel){
                  try{ closePanel(filterPanel); }catch(err){}
                }
                // CASE 3: MAP MARKER CLICKED (popup card) - SCROLL TO TOP
                // Parameters: (id, fromHistory=false, fromMap=true, originEl=null)
                fn(pid, false, true, null);
              }catch(err){ console.error(err); }
            });
          });
        }
      }
    }, { capture:true });

    function hookDetailActions(el, p){
      const locationList = Array.isArray(p.locations) ? p.locations : [];
      // Card click handler is now set in buildDetail() to toggle post-collapsed
      
      el.querySelectorAll('.fav').forEach(favBtn => {
        favBtn.addEventListener('click', (e)=>{
          e.stopPropagation();
          p.fav = !p.fav;
          favSortDirty = true;
          document.querySelectorAll(`[data-id="${p.id}"] .fav`).forEach(btn=>{
            btn.setAttribute('aria-pressed', p.fav ? 'true' : 'false');
          });
          const detailEl = el;
          renderHistoryBoard();
          const replacement = postsWideEl.querySelector(`[data-id="${p.id}"]`);
          if(replacement){
            replacement.replaceWith(detailEl);
          }
        });
      });

      el.querySelectorAll('.share').forEach(shareBtn => {
        shareBtn.addEventListener('click', (e)=>{
          e.stopPropagation();
          const url = postUrl(p);
          navigator.clipboard.writeText(url).then(()=>{ showCopyMsg(shareBtn); });
        });
      });

      const postImagesEl = el.querySelector('.post-images');
      const descEl = el.querySelector('.post-details .desc');

      const animatePostImages = direction => {
        if(!postImagesEl || typeof postImagesEl.animate !== 'function'){
          return;
        }
        try {
          if(postImagesEl._descAnimation){
            postImagesEl._descAnimation.cancel();
          }
        } catch(err){}
        const distance = 16;
        let keyframes;
        let duration = 260;
        let easing = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
        if(direction === 'down'){
          keyframes = [
            { transform: `translateY(-${distance}px)` },
            { transform: 'translateY(0)' }
          ];
        } else {
          // No bounce animation on collapse
          return;
        }
        const animation = postImagesEl.animate(keyframes, { duration, easing });
        postImagesEl._descAnimation = animation;
        if(animation){
          animation.onfinish = animation.oncancel = () => {
            if(postImagesEl._descAnimation === animation){
              postImagesEl._descAnimation = null;
            }
          };
        }
      };

      const setDescExpandedState = targetState => {
        const openPostEl = el;
        if(!openPostEl || !openPostEl.classList){
          return false;
        }
        const desired = !!targetState;
        const current = openPostEl.classList.contains('desc-expanded');
        if(current === desired){
          return false;
        }
        if(descEl){
          if(descEl.classList){
            descEl.classList.toggle('expanded', desired);
          }
          if(typeof descEl.setAttribute === 'function'){
            descEl.setAttribute('aria-expanded', desired ? 'true' : 'false');
          }
        }
        openPostEl.classList.toggle('desc-expanded', desired);
        if(desired){
          document.body.classList.remove('open-post-sticky-images');
          animatePostImages('down');
        } else {
          if(typeof updateStickyImages === 'function'){
            updateStickyImages();
          }
          animatePostImages('up');
        }
        return true;
      };

      if(descEl){
        const handleDescToggle = evt => {
          const allowed = ['Enter', ' ', 'Spacebar', 'Space'];
          if(evt.type === 'keydown' && !allowed.includes(evt.key)){
            return;
          }
          evt.preventDefault();
          const openPostEl = el;
          const isExpanded = openPostEl
            ? openPostEl.classList.contains('desc-expanded')
            : descEl.classList.contains('expanded');
          setDescExpandedState(!isExpanded);
        };
        descEl.addEventListener('click', handleDescToggle);
        descEl.addEventListener('keydown', handleDescToggle);
      }

      const imgs = p.images && p.images.length ? p.images : [heroUrl(p)];
      const thumbCol = el.querySelector('.thumbnail-row');
      const imageBox = el.querySelector('.image-box');
      const imageTrack = imageBox ? imageBox.querySelector('.image-track') : null;
      const baseImg = imageTrack ? imageTrack.querySelector('img') : null;
      const slides = [];
      if(imageBox){
        imageBox._modalImages = imgs.slice();
        try {
          imageBox.dataset.modalImages = JSON.stringify(imgs);
        } catch(err) {
          imageBox.dataset.modalImages = '';
        }
        if(typeof imageBox.dataset.index === 'undefined'){
          imageBox.dataset.index = '0';
        }
      }
      if(baseImg){
        baseImg.dataset.index = '0';
        baseImg.dataset.full = imgs[0];
        if(!baseImg.classList.contains('ready')){
          baseImg.classList.add('lqip');
        }
        slides[0] = baseImg;
      }
      if(imageTrack){
        imageTrack.style.transform = 'translateX(0)';
      }
      for(let i=1;i<imgs.length;i++){
        if(!imageTrack) break;
        const slide = document.createElement('img');
        slide.dataset.index = i;
        slide.dataset.full = imgs[i];
        slide.alt = '';
        slide.decoding = 'async';
        slide.loading = 'lazy';
        slide.classList.add('lqip');
        slide.src = imgs[i];
        imageTrack.appendChild(slide);
        slides[i] = slide;
      }
      if(thumbCol){
        imgs.forEach((url,i)=>{
          const t = document.createElement('img');
          t.src = url;
          t.dataset.full = url;
          t.dataset.index = i;
          t.tabIndex = 0;
          thumbCol.appendChild(t);
        });
      }
      const clampIdx = idx => Math.min(Math.max(idx, 0), imgs.length - 1);
      let currentIdx = 0;
      const ensureSlide = idx => {
        if(!imageTrack) return null;
        if(!slides[idx]){
          const slide = document.createElement('img');
          slide.dataset.index = idx;
          slide.dataset.full = imgs[idx];
          slide.alt = '';
          slide.decoding = 'async';
          slide.loading = 'lazy';
          slide.classList.add('lqip');
          slide.src = imgs[idx];
          imageTrack.appendChild(slide);
          slides[idx] = slide;
        }
        return slides[idx];
      };
      const scrollThumbIntoView = target => {
        if(!thumbCol || !target) return;
        const rowRect = thumbCol.getBoundingClientRect();
        const tRect = target.getBoundingClientRect();
        if(tRect.left < rowRect.left){
          thumbCol.scrollBy({left: tRect.left - rowRect.left - 8, behavior:'smooth'});
        } else if(tRect.right > rowRect.right){
          thumbCol.scrollBy({left: tRect.right - rowRect.right + 8, behavior:'smooth'});
        }
      };
      const moveTo = (idx, {instant=false}={})=>{
        if(!imageTrack) return;
        if(instant){
          imageTrack.style.transition = 'none';
        }
        const apply = ()=>{ imageTrack.style.transform = `translateX(-${idx * 100}%)`; };
        if(instant){
          apply();
          requestAnimationFrame(()=>{ imageTrack.style.transition = ''; });
        } else {
          apply();
        }
      };
      function show(idx, {instant=false}={}){
        idx = clampIdx(idx);
        const t = thumbCol ? thumbCol.querySelector(`img[data-index="${idx}"]`) : null;
        const slide = ensureSlide(idx);
        if(!slide) return;
        const prevIdx = currentIdx;
        const alreadyReady = slide.classList.contains('ready');
        currentIdx = idx;
        if(prevIdx !== idx || instant){
          moveTo(idx, {instant});
        }
        if(imageBox){
          imageBox.dataset.index = idx;
        }
        if(slides.length){
          slides.forEach((img,i)=>{
            if(img){
              img.classList.toggle('active', i===idx);
            }
          });
        }
        if(t && thumbCol){
          thumbCol.querySelectorAll('img').forEach(im=> im.classList.toggle('selected', im===t));
          scrollThumbIntoView(t);
        }
        const full = (t && (t.dataset.full || t.src)) || slide.dataset.full || slide.src;
        if(!slide.dataset.full){
          slide.dataset.full = full;
        }
        
        // Seamless image transition - preload full-res, only swap when ready
        if(slide.src !== full){
          const hi = new Image();
          hi.onload = ()=>{
            const swap = ()=>{
              if(slide.dataset.full !== full){ slide.dataset.full = full; }
              // Swap immediately - image is already loaded so no flicker
              slide.src = full;
              slide.classList.remove('lqip');
              slide.classList.add('ready');
            };
            if(hi.decode){ hi.decode().then(swap).catch(swap); } else { swap(); }
          };
          hi.onerror = ()=>{
            // On error, still mark as ready to prevent infinite loading
            slide.classList.remove('lqip');
            slide.classList.add('ready');
          };
          hi.src = full;
        } else if(!alreadyReady){
          // Already showing correct image, just mark as ready
          slide.classList.remove('lqip');
          slide.classList.add('ready');
        }
      }
      show(0, {instant:true});
      if(thumbCol){
        thumbCol.scrollLeft = 0;
        setupHorizontalWheel(thumbCol);
        thumbCol.addEventListener('click', e=>{
          const t = e.target.closest('img');
          if(!t) return;
          const idx = clampIdx(parseInt(t.dataset.index,10));
          if(currentIdx === idx && t.classList.contains('selected')){
            const fullSrc = t.dataset.full || t.src;
            openImageModal(fullSrc, {images: imgs, startIndex: idx, origin: t});
          } else {
            show(idx);
          }
        });
        thumbCol.addEventListener('keydown', e=>{
          if(e.key==='ArrowDown'){
            e.preventDefault();
            const ni = clampIdx(currentIdx + 1);
            show(ni);
            const nextThumb = thumbCol.querySelector(`img[data-index="${ni}"]`);
            if(nextThumb) nextThumb.focus();
          } else if(e.key==='ArrowUp'){
            e.preventDefault();
            const ni = clampIdx(currentIdx - 1);
            show(ni);
            const prevThumb = thumbCol.querySelector(`img[data-index="${ni}"]`);
            if(prevThumb) prevThumb.focus();
          }
        });
      }
      if(imageBox){
        let dragStartX = null;
        let dragStartY = null;
        let dragActive = false;
        let lastDragTime = 0;
        const resetDragState = ()=>{
          dragStartX = null;
          dragStartY = null;
          dragActive = false;
          if(imageTrack){
            imageTrack.style.transition = '';
          }
        };
        imageBox.addEventListener('click', e=>{
          if(Date.now() - lastDragTime < 400){
            e.preventDefault();
            return;
          }
          const imgTarget = e.target.closest('.image-track img');
          if(!imgTarget) return;
          e.stopPropagation();
          const openPostEl = imageBox.closest('.open-post');
          if(openPostEl && !openPostEl.classList.contains('desc-expanded')){
            const changed = setDescExpandedState(true);
            if(changed){
              return;
            }
          }
          const currentSlide = ensureSlide(currentIdx) || slides[currentIdx] || imgTarget;
          const fullSrc = currentSlide ? (currentSlide.dataset.full || currentSlide.src) : imgs[currentIdx];
          openImageModal(fullSrc, {images: imgs, startIndex: currentIdx, origin: imgTarget});
        });
        imageBox.addEventListener('touchstart', e=>{
          if(e.touches.length !== 1) return;
          dragStartX = e.touches[0].clientX;
          dragStartY = e.touches[0].clientY;
          dragActive = false;
        });
        imageBox.addEventListener('touchmove', e=>{
          if(dragStartX===null || !imageTrack) return;
          const touch = e.touches[0];
          const deltaX = touch.clientX - dragStartX;
          const deltaY = touch.clientY - dragStartY;
          if(!dragActive){
            if(Math.abs(deltaX) < 5) return;
            if(Math.abs(deltaY) > Math.abs(deltaX)){
              resetDragState();
              return;
            }
            dragActive = true;
            imageTrack.style.transition = 'none';
          }
          const width = imageBox.clientWidth || 1;
          let adjustedDelta = deltaX;
          if((currentIdx === 0 && adjustedDelta > 0) || (currentIdx === imgs.length-1 && adjustedDelta < 0)){
            adjustedDelta = 0;
          }
          const deltaPercent = (adjustedDelta / width) * 100;
          const basePercent = -currentIdx * 100;
          imageTrack.style.transform = `translateX(${basePercent + deltaPercent}%)`;
          e.preventDefault();
        }, {passive:false});
        imageBox.addEventListener('touchend', e=>{
          if(dragStartX===null){
            resetDragState();
            return;
          }
          const deltaX = e.changedTouches[0].clientX - dragStartX;
          if(imageTrack){
            imageTrack.style.transition = '';
          }
          if(dragActive){
            const prevIdx = currentIdx;
            let targetIdx = prevIdx;
            const threshold = (imageBox.clientWidth || 1) * 0.15;
            if(deltaX <= -threshold && prevIdx < imgs.length - 1){
              targetIdx = prevIdx + 1;
            } else if(deltaX >= threshold && prevIdx > 0){
              targetIdx = prevIdx - 1;
            }
            lastDragTime = Date.now();
            requestAnimationFrame(()=> show(targetIdx));
          }
          resetDragState();
        });
        imageBox.addEventListener('touchcancel', ()=>{
          if(dragActive && imageTrack){
            imageTrack.style.transition = '';
            requestAnimationFrame(()=> show(currentIdx));
          }
          resetDragState();
        });
      }
      const venueDropdown = el.querySelector(`#venue-${p.id}`);
      const venueBtn = el.querySelector('.venue-menu-button');
      const venueMenu = venueDropdown ? venueDropdown.querySelector('.venue-menu') : null;
      const venueOptions = venueMenu ? venueMenu.querySelector('.venue-options') : null;
      let venueCloseTimer = null;
      const venueInfo = el.querySelector(`#venue-info-${p.id}`);
      const sessDropdown = el.querySelector(`#sess-${p.id}`);
      const sessBtn = el.querySelector('.session-menu-button');
      const sessMenu = sessDropdown ? sessDropdown.querySelector('.session-menu') : null;
      const sessionOptions = sessMenu ? sessMenu.querySelector('.session-options') : null;
      const showMenu = menu => { if(menu) menu.removeAttribute('hidden'); };
      const hideMenu = menu => { if(menu) menu.setAttribute('hidden',''); };
      const isMenuOpen = menu => !!(menu && !menu.hasAttribute('hidden'));
      const sessionInfo = el.querySelector(`#session-info-${p.id}`);
      const calendarEl = el.querySelector(`#cal-${p.id}`);
      const mapEl = el.querySelector(`#map-${p.id}`);
      const calContainer = el.querySelector('.calendar-container');
      const calScroll = calContainer ? calContainer.querySelector('.calendar-scroll') : null;
      if(calScroll){
        setupCalendarScroll(calScroll);
      }
      let map, locationMarkers = [], sessionHasMultiple = false, lastClickedCell = null, resizeHandler = null, detailMapRef = null;
      let currentVenueIndex = 0;

      function updateDetailMarkerSelection(selectedIdx = currentVenueIndex){
        if(!Number.isInteger(selectedIdx)){
          selectedIdx = currentVenueIndex;
        }
        locationMarkers.forEach(({ element, index }) => {
          const isSelected = index === selectedIdx;
          element.classList.toggle('is-selected', isSelected);
          element.classList.toggle('is-dimmed', !isSelected);
          element.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        });
      }
      let sessionCloseTimer = null;
      let ensureMapForVenue = async ()=>{};
      const shouldShowExpiredSessions = () => {
        const expiredToggle = document.getElementById('expiredToggle');
        return !!(expiredToggle && expiredToggle.checked);
      };
      const sessionThresholdDate = () => {
        const base = new Date();
        base.setHours(0,0,0,0);
        base.setDate(base.getDate() - 1);
        return base;
      };
      const parseSessionDate = (value) => {
        if(typeof value !== 'string') return new Date(Number.NaN);
        const parts = value.split('-').map(Number);
        const yy = parts[0];
        const mm = parts[1];
        const dd = parts[2];
        return new Date(yy, (mm || 1) - 1, dd || 1);
      };
      function computeVisibleSessionsForLocation(location){
        if(!location || !Array.isArray(location.dates)) return [];
        const showExpired = shouldShowExpiredSessions();
        const threshold = sessionThresholdDate();
        return location.dates
          .map((d,i)=>({d,i}))
          .filter(({d})=>{
            if(!d || typeof d.full !== 'string') return false;
            if(showExpired) return true;
            const parsed = parseSessionDate(d.full);
            return parsed instanceof Date && !Number.isNaN(parsed.getTime()) && parsed >= threshold;
          });
      }
      let visibleVenueState = { byIndex: new Map(), visibleIndices: [] };
      function computeVenueVisibility(){
        const byIndex = new Map();
        const visibleIndices = [];
        locationList.forEach((location, idx) => {
          if(location && Array.isArray(location.dates)){
            location.dates.sort((a,b)=>{
              const fullA = (a && a.full) || '';
              const fullB = (b && b.full) || '';
              const fullCompare = fullA.localeCompare(fullB);
              if(fullCompare !== 0) return fullCompare;
              const timeA = (a && a.time) || '';
              const timeB = (b && b.time) || '';
              return timeA.localeCompare(timeB);
            });
          }
          const visibleSessions = computeVisibleSessionsForLocation(location);
          const hasVisible = visibleSessions.length > 0;
          byIndex.set(idx, { visibleSessions, hasVisible });
          if(venueOptions){
            const button = venueOptions.querySelector(`button[data-index="${idx}"]`);
            if(button){
              button.hidden = !hasVisible;
              if(hasVisible){
                button.removeAttribute('hidden');
                button.disabled = false;
                button.tabIndex = 0;
                button.removeAttribute('aria-hidden');
              } else {
                button.setAttribute('hidden','');
                button.disabled = true;
                button.tabIndex = -1;
                button.setAttribute('aria-hidden','true');
                button.classList.remove('selected');
              }
            }
          }
          if(hasVisible){
            visibleIndices.push(idx);
          }
        });
        visibleVenueState = { byIndex, visibleIndices };
        return visibleVenueState;
      }
      let syncingVenueFromSessions = false;
        function scheduleSessionMenuClose({waitForScroll=false, targetLeft=null}={}){
          if(!sessMenu) return;
          if(sessionCloseTimer){
            clearTimeout(sessionCloseTimer);
            sessionCloseTimer = null;
          }
          const begin = ()=>{
            requestAnimationFrame(()=>requestAnimationFrame(()=>{
              sessionCloseTimer = setTimeout(()=>{
                hideMenu(sessMenu);
                if(sessBtn) sessBtn.setAttribute('aria-expanded','false');
                sessionCloseTimer = null;
              }, 100);
            }));
          };
          if(waitForScroll && calScroll && targetLeft !== null){
            let attempts = 0;
            const maxAttempts = 60;
            const check = ()=>{
              const distance = Math.abs(calScroll.scrollLeft - targetLeft);
              if(distance <= 0.5 || attempts >= maxAttempts){
                begin();
              } else {
                attempts += 1;
                requestAnimationFrame(check);
              }
            };
            requestAnimationFrame(check);
          } else {
            begin();
          }
        }
        if(mapEl && mapEl._detailMap){
          detailMapRef = mapEl._detailMap;
          map = detailMapRef.map || map;
          resizeHandler = detailMapRef.resizeHandler || resizeHandler;
          if(!el._detailMap){
            el._detailMap = detailMapRef;
          }
        }
      function updateVenue(idx){
        const locations = locationList;
        const hasLocations = locations.length > 0;
        let targetIndex = Number.isInteger(idx) ? idx : 0;
        if(hasLocations){
          targetIndex = Math.min(Math.max(targetIndex, 0), locations.length - 1);
        } else {
          targetIndex = 0;
        }
        const visibility = computeVenueVisibility();
        const visibleIndices = visibility.visibleIndices || [];
        const multipleVisible = visibleIndices.length > 1;
        if(visibleIndices.length){
          if(!visibleIndices.includes(targetIndex)){
            targetIndex = visibleIndices[0];
          }
        }
        currentVenueIndex = targetIndex;
        const loc = hasLocations ? locations[targetIndex] : null;

        if(venueOptions){
          const buttons = venueOptions.querySelectorAll('button');
          buttons.forEach((button, optionIndex) => {
            const isSelected = optionIndex === currentVenueIndex && !button.hidden && !button.disabled;
            button.classList.toggle('selected', isSelected);
          });
        }

        if(loc){
          setSelectedVenueHighlight(loc.lng, loc.lat);
        } else {
          setSelectedVenueHighlight();
        }

        updateDetailMarkerSelection(targetIndex);

        if(venueBtn){
          if(loc){
            venueBtn.innerHTML = `<img src="assets/Map Screenshot.png" alt="Map view"><span class="venue-name">${loc.venue}</span><span class="address_line">${loc.address}</span>${multipleVisible?'<span class="results-arrow" aria-hidden="true"></span>':''}`;
          } else {
            venueBtn.innerHTML = `<img src="assets/Map Screenshot.png" alt="Map view"><span class="venue-name">${p.city || ''}</span><span class="address_line">${p.city || ''}</span>`;
          }
        }

        if(venueInfo){
          if(loc){
            venueInfo.innerHTML = `<strong>${loc.venue}</strong><br>${loc.address}`;
          } else {
            venueInfo.innerHTML = '';
          }
        }

        const hasDates = loc && Array.isArray(loc.dates) && loc.dates.length;
        if(!hasDates){
          sessionHasMultiple = false;
          if(sessionInfo){
            sessionInfo.innerHTML = '';
          }
          ensureMapForVenue();
          return;
        }

        loc.dates.sort((a,b)=>{
          const fullA = (a && a.full) || '';
          const fullB = (b && b.full) || '';
          const fullCompare = fullA.localeCompare(fullB);
          if(fullCompare !== 0) return fullCompare;
          const timeA = (a && a.time) || '';
          const timeB = (b && b.time) || '';
          return timeA.localeCompare(timeB);
        });

        const currentYear = new Date().getFullYear();
        const parseDate = s => parseSessionDate(s);
        const formatDate = d => {
          const y = parseDate(d.full).getFullYear();
          return y !== currentYear ? `${d.date}, ${y}` : d.date;
        };

        if(venueInfo){
          venueInfo.innerHTML = `<strong>${loc.venue}</strong><br>${loc.address}`;
        }
        if(venueBtn){
          venueBtn.innerHTML = `<img src="assets/Map Screenshot.png" alt="Map view"><span class="venue-name">${loc.venue}</span><span class="address_line">${loc.address}</span>${multipleVisible?'<span class="results-arrow" aria-hidden="true"></span>':''}`;
        }

        let cal = null;
        let selectedIndex = null;
        let dateStrings = [];
        let allowedSet = new Set();
        let minDate = null;
        let maxDate = null;
        let months = [];
        let visibleDateEntries = [];
        let defaultInfoHTML = '';

        function recomputeVisibleDateData(visibilityState){
          if(!loc || !Array.isArray(loc.dates)){
            visibleDateEntries = [];
            dateStrings = [];
            allowedSet = new Set();
            minDate = null;
            maxDate = null;
            months = [];
            return;
          }
          const snapshot = visibilityState || computeVenueVisibility();
          const entry = snapshot && snapshot.byIndex ? snapshot.byIndex.get(currentVenueIndex) : null;
          visibleDateEntries = entry && Array.isArray(entry.visibleSessions)
            ? entry.visibleSessions.map(({ d, i }) => ({ d, i }))
            : [];

          const seen = new Set();
          const uniqueEntries = [];
          visibleDateEntries.forEach(({d}) => {
            if(!d || typeof d.full !== 'string') return;
            if(seen.has(d.full)) return;
            const parsed = parseDate(d.full);
            if(!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) return;
            seen.add(d.full);
            uniqueEntries.push({ iso: d.full, date: parsed });
          });

          dateStrings = uniqueEntries.map(entry => entry.iso);
          allowedSet = new Set(dateStrings);
          if(uniqueEntries.length){
            minDate = new Date(uniqueEntries[0].date.getTime());
            maxDate = new Date(uniqueEntries[uniqueEntries.length - 1].date.getTime());
          } else {
            minDate = null;
            maxDate = null;
          }

          months = [];
          if(minDate && maxDate){
            const cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
            const limit = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
            while(cursor <= limit){
              months.push(new Date(cursor.getTime()));
              cursor.setMonth(cursor.getMonth() + 1);
            }
          }
        }

        function refreshDefaultSessionInfo(){
          const visible = visibleDateEntries;
          sessionHasMultiple = visible.length > 1;
          if(!sessionInfo){
            defaultInfoHTML = '';
            return;
          }
          const suffix = '<span style="display:inline-block;margin-left:10px;">(Select Session)</span>';
          if(visible.length){
            const firstDate = visible[0].d;
            const lastDate = visible[visible.length - 1].d;
            const rangeText = `${formatDate(firstDate)} - ${formatDate(lastDate)}`;
            defaultInfoHTML = `<div>💲 ${loc.price} | 📅 ${rangeText}${suffix}</div>`;
          } else if(Array.isArray(loc.dates) && loc.dates.length){
            defaultInfoHTML = `<div>💲 ${loc.price}${suffix}</div>`;
          } else {
            defaultInfoHTML = '';
          }
          sessionInfo.innerHTML = defaultInfoHTML;
        }

        function markSelected(){
          if(!calendarEl) return;
          calendarEl.querySelectorAll('.day').forEach(d=> d.classList.remove('selected'));
          if(selectedIndex!==null){
            const dt = loc.dates[selectedIndex];
            const cell = calendarEl.querySelector(`.day[data-iso="${dt.full}"]`);
            if(cell) cell.classList.add('selected');
          }
        }

        function scrollCalendarToMonth(dt, {smooth=false}={}){
          if(!dt || !calendarEl || !calScroll) return null;
          const cell = calendarEl.querySelector(`.day[data-iso="${dt.full}"]`);
          if(!cell) return null;
          const monthEl = cell.closest('.month');
          if(!monthEl) return null;
          const currentLeft = calScroll.scrollLeft;
          let targetLeft = monthEl.offsetLeft;
          if(typeof monthEl.getBoundingClientRect === 'function' && typeof calScroll.getBoundingClientRect === 'function'){
            const monthRect = monthEl.getBoundingClientRect();
            const scrollRect = calScroll.getBoundingClientRect();
            const delta = monthRect.left - scrollRect.left;
            const adjusted = currentLeft + delta;
            if(Number.isFinite(adjusted)){
              targetLeft = adjusted;
            }
          }
          const maxLeft = Math.max(0, calScroll.scrollWidth - calScroll.clientWidth);
          targetLeft = Math.min(Math.max(targetLeft, 0), maxLeft);
          const distance = Math.abs(currentLeft - targetLeft);
          if(typeof calScroll.scrollTo === 'function'){
            if(smooth && distance > 1){
              calScroll.scrollTo({left: targetLeft, behavior: 'smooth'});
              return {targetLeft, waitForScroll: true};
            }
            calScroll.scrollTo({left: targetLeft});
          } else {
            calScroll.scrollLeft = targetLeft;
          }
          return {targetLeft, waitForScroll: false};
        }

        function selectSession(i){
          if(!sessMenu || !sessionOptions) return;
          selectedIndex = Number.isInteger(i) ? i : null;
          sessionOptions.querySelectorAll('button').forEach(b=> b.classList.remove('selected'));
          const btn = selectedIndex !== null ? sessionOptions.querySelector(`button[data-index="${selectedIndex}"]`) : null;
          if(btn) btn.classList.add('selected');
          const dt = selectedIndex !== null ? loc.dates[selectedIndex] : null;
          let waitForScroll = false;
          let targetScrollLeft = null;
          if(dt){
            if(sessionInfo){
              sessionInfo.innerHTML = `<div><strong>${formatDate(dt)} ${dt.time}</strong></div><div>Adults $20, Kids $10, Pensioners $15</div><div>🎫 Buy at venue | ♿ Accessible | 👶 Kid-friendly</div>`;
            }
            if(sessBtn){
              sessBtn.innerHTML = `<img src="assets/Calendar Screenshot.png" alt="Calendar view"><span class="session-date">${formatDate(dt)}</span><span class="session-time">${dt.time}</span>${sessionHasMultiple?'<span class="results-arrow" aria-hidden="true"></span>':''}`;
            }
            markSelected();
            const scrollResult = scrollCalendarToMonth(dt, {smooth: true});
            if(scrollResult){
              targetScrollLeft = scrollResult.targetLeft;
              waitForScroll = scrollResult.waitForScroll;
            }
          } else {
            if(sessionInfo){
              sessionInfo.innerHTML = defaultInfoHTML;
            }
            if(sessBtn){
              sessBtn.innerHTML = sessionHasMultiple ? '<img src="assets/Calendar Screenshot.png" alt="Calendar view">Select Session<span class="results-arrow" aria-hidden="true"></span>' : '<img src="assets/Calendar Screenshot.png" alt="Calendar view">Select Session';
              sessBtn.setAttribute('aria-expanded','false');
            }
            markSelected();
          }
          if(isMenuOpen(sessMenu)){
            scheduleSessionMenuClose({waitForScroll, targetLeft: targetScrollLeft});
          } else if(sessBtn){
            sessBtn.setAttribute('aria-expanded','false');
          }
        }

        function showTimePopup(matches){
          if(!calContainer) return;
          const existing = calContainer.querySelector('.time-popup');
          if(existing) existing.remove();
          const popup = document.createElement('div');
          popup.className = 'time-popup';
          popup.innerHTML = `<div class="time-list">${matches.map(m=>`<button data-index="${m.i}">${m.d.time}</button>`).join('')}</div>`;
          calContainer.appendChild(popup);
          if(lastClickedCell){
            const rect = lastClickedCell.getBoundingClientRect();
            const containerRect = calContainer.getBoundingClientRect();
            const dateCenterX = rect.left + rect.width / 2 - containerRect.left;
            const containerCenterX = calContainer.clientWidth / 2;
            popup.style.top = (rect.top - containerRect.top) + 'px';
            if (dateCenterX < containerCenterX) {
              popup.style.left = (rect.right - containerRect.left + 4) + 'px';
            } else {
              popup.style.left = (rect.left - containerRect.left) + 'px';
            }
            requestAnimationFrame(() => {
              const popupRect = popup.getBoundingClientRect();
              const minMargin = 10;
              let left = parseFloat(popup.style.left);
              let top = parseFloat(popup.style.top);
              if (dateCenterX >= containerCenterX) {
                left = left - popupRect.width - 4;
              }
              if (left < minMargin) left = minMargin;
              if (top < minMargin) top = minMargin;
              if (left + popupRect.width + minMargin > calContainer.clientWidth) {
                left = calContainer.clientWidth - popupRect.width - minMargin;
              }
              if (top + popupRect.height + minMargin > calContainer.clientHeight) {
                top = calContainer.clientHeight - popupRect.height - minMargin;
              }
              popup.style.left = left + 'px';
              popup.style.top = top + 'px';
            });
          }
          popup.querySelectorAll('button').forEach(b=> b.addEventListener('click',()=>{ selectSession(parseInt(b.dataset.index,10)); popup.remove(); }));
          setTimeout(()=> document.addEventListener('click', function handler(e){ if(!popup.contains(e.target)){ popup.remove(); document.removeEventListener('click', handler); } }),0);
        }

        function renderMonth(monthDate){
          if(!cal) return;
          const monthEl = document.createElement('div');
          monthEl.className='month';
          const header = document.createElement('div');
          header.className='calendar-header';
          header.textContent = monthDate.toLocaleDateString('en-GB',{month:'long',year:'numeric'});
          monthEl.appendChild(header);
          const grid = document.createElement('div');
          grid.className='grid';
          ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(wd=>{
            const w=document.createElement('div');
            w.className='weekday';
            w.textContent=wd;
            grid.appendChild(w);
          });
          const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(),1);
          const startDow = firstDay.getDay();
          const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth()+1,0).getDate();
          const totalCells = 42;
          for(let i=0;i<totalCells;i++){
            const cell=document.createElement('div');
            cell.className='day';
            const dayNum=i-startDow+1;
            if(i<startDow || dayNum>daysInMonth){
              cell.classList.add('empty');
            }else{
              cell.textContent=dayNum;
              const dateObj=new Date(monthDate.getFullYear(), monthDate.getMonth(), dayNum);
              const iso=toISODate(dateObj);
              cell.dataset.iso = iso;
              if(allowedSet.has(iso)){
                cell.classList.add('available-day');
                cell.addEventListener('mousedown',()=>{ lastClickedCell = cell; });
                cell.addEventListener('click',()=>{
                  const matches = visibleDateEntries.filter(entry => entry.d.full === iso);
                  if(matches.length===1){ selectSession(matches[0].i); }
                  else if(matches.length>1){ showTimePopup(matches); }
                });
              } else {
                cell.classList.add('empty');
              }
              if(isToday(dateObj)) cell.classList.add('today');
            }
            grid.appendChild(cell);
          }
          monthEl.appendChild(grid);
          cal.appendChild(monthEl);
        }

        function buildCalendarShell(){
          if(!calendarEl) return;
          calendarEl.innerHTML='';
          cal = document.createElement('div');
          cal.className='calendar';
          calendarEl.appendChild(cal);
          if(!calendarEl._calendarClickStopper){
            calendarEl.addEventListener('click', e=> e.stopPropagation());
            calendarEl._calendarClickStopper = true;
          }
        }

        function finalizeCalendar(){
          markSelected();
        }

        function renderCalendar(){
          if(!calendarEl) return;
          buildCalendarShell();
          months.forEach(monthDate => renderMonth(monthDate));
          finalizeCalendar();
        }

        function updateSessionOptionsList(){
          if(!loc || !Array.isArray(loc.dates)){
            visibleDateEntries = [];
            if(sessionOptions){
              sessionOptions.innerHTML = '';
            }
            if(sessBtn){
              sessBtn.innerHTML = '<img src="assets/Calendar Screenshot.png" alt="Calendar view">Select Session';
              sessBtn.setAttribute('aria-expanded','false');
            }
            if(sessionInfo){
              sessionInfo.innerHTML = defaultInfoHTML;
            }
            return;
          }
          const visibility = computeVenueVisibility();
          const visibleIndices = visibility.visibleIndices || [];
          if(!syncingVenueFromSessions && visibleIndices.length && !visibleIndices.includes(currentVenueIndex)){
            const fallbackIndex = visibleIndices[0];
            if(fallbackIndex !== undefined){
              syncingVenueFromSessions = true;
              try{
                updateVenue(fallbackIndex);
              } finally {
                syncingVenueFromSessions = false;
              }
              return;
            }
          }
          recomputeVisibleDateData(visibility);
          refreshDefaultSessionInfo();
          if(calContainer){
            const existingPopup = calContainer.querySelector('.time-popup');
            if(existingPopup) existingPopup.remove();
          }
          lastClickedCell = null;
          if(calendarEl){
            renderCalendar();
          }

          const visibleDates = visibleDateEntries;

          if(sessionOptions){
            sessionOptions.innerHTML = visibleDates
              .map(({d,i})=> `<button data-index="${i}"><span class="session-date">${formatDate(d)}</span><span class="session-time">${d.time}</span></button>`)
              .join('');
          }

          if(sessMenu){
            sessMenu.scrollTop = 0;
          }

          const hasVisible = visibleDates.length > 0;

          const selectedIsVisible = visibleDates.some(({i})=> i === selectedIndex);
          if(!selectedIsVisible){
            selectedIndex = null;
          }

          if(sessionHasMultiple){
            selectedIndex = null;
            markSelected();
            if(sessionInfo) sessionInfo.innerHTML = defaultInfoHTML;
            if(sessBtn){
              sessBtn.innerHTML = '<img src="assets/Calendar Screenshot.png" alt="Calendar view">Select Session<span class="results-arrow" aria-hidden="true"></span>';
              sessBtn.setAttribute('aria-expanded','false');
            }
          } else if(hasVisible){
            selectSession(visibleDates[0].i);
          } else {
            selectedIndex = null;
            markSelected();
            if(sessionInfo) sessionInfo.innerHTML = defaultInfoHTML;
            if(sessBtn){
              sessBtn.innerHTML = '<img src="assets/Calendar Screenshot.png" alt="Calendar view">Select Session';
              sessBtn.setAttribute('aria-expanded','false');
            }
          }

          if(sessionOptions){
            sessionOptions.querySelectorAll('button').forEach(btn=>{
              btn.addEventListener('click', ()=> selectSession(parseInt(btn.dataset.index,10)));
            });
          }

          try{
            if(typeof ensureMapForVenue === 'function'){
              ensureMapForVenue();
            }
          }catch(err){}

          setTimeout(()=>{
            if(map && typeof map.resize === 'function') map.resize();
          },0);
        }

        function attachSessionButtonHandler(){
          if(!sessBtn || !sessMenu) return;
          const handler = ()=>{
            const expanded = sessBtn.getAttribute('aria-expanded') === 'true';
            const opening = !expanded;
            sessBtn.setAttribute('aria-expanded', String(opening));
            if(opening){
              showMenu(sessMenu);
              if(selectedIndex !== null){
                const dt = loc.dates[selectedIndex];
                if(dt){
                  requestAnimationFrame(()=> scrollCalendarToMonth(dt));
                }
              }
            } else {
              hideMenu(sessMenu);
            }
          };
          if(sessBtn._sessionToggle){
            sessBtn.removeEventListener('click', sessBtn._sessionToggle);
          }
          sessBtn._sessionToggle = handler;
          sessBtn.addEventListener('click', handler);
        }

        ensureMapForVenue = async function(){
          if(!mapEl) return;

          const visibility = computeVenueVisibility();
          const visibleIndices = Array.isArray(visibility.visibleIndices) ? visibility.visibleIndices : [];
          const locationEntries = locationList
            .map((location, idx) => ({ location, idx }))
            .filter(entry => entry.location && Number.isFinite(entry.location.lng) && Number.isFinite(entry.location.lat));
          const allIndicesVisible = visibleIndices.length > 0 && visibleIndices.length === locationEntries.length;
          const allowedIndices = allIndicesVisible ? null : new Set(visibleIndices);
          const effectiveEntries = allowedIndices
            ? locationEntries.filter(entry => allowedIndices.has(entry.idx))
            : locationEntries;

          if(!effectiveEntries.length){
            locationMarkers.forEach(({ marker }) => { try{ marker.remove(); }catch(e){} });
            locationMarkers = [];
            return;
          }

          const selectedEntry = effectiveEntries.find(entry => entry.idx === currentVenueIndex) || effectiveEntries[0];
          if(!selectedEntry){
            locationMarkers.forEach(({ marker }) => { try{ marker.remove(); }catch(e){} });
            locationMarkers = [];
            return;
          }

          const selectedIdx = selectedEntry.idx;
          const selectedLoc = selectedEntry.location;
          const center = [selectedLoc.lng, selectedLoc.lat];
          const subId = slugify(p.subcategory);
          const subcategoryMarkers = window.subcategoryMarkers || {};
          const markerUrl = subcategoryMarkers[subId];

          const assignDetailRef = ()=>{
            detailMapRef = detailMapRef || {};
            detailMapRef.map = map;
            detailMapRef.resizeHandler = resizeHandler;
            if(mapEl){
              mapEl._detailMap = detailMapRef;
              mapEl.__map = map;
            }
            if(el){
              el._detailMap = detailMapRef;
            }
            if(map){
              MapRegistry.register(map);
            }
          };

          const refreshMarkers = () => {
            if(!map) return;
            locationMarkers.forEach(({ marker }) => { try{ marker.remove(); }catch(e){} });
            locationMarkers = [];
            effectiveEntries.forEach(({ location, idx }) => {
              if(!Number.isFinite(location.lng) || !Number.isFinite(location.lat)){
                return;
              }
              let element;
              if(markerUrl){
                element = new Image();
                element.src = markerUrl;
                element.alt = '';
                element.decoding = 'async';
              } else {
                element = document.createElement('div');
                element.style.background = '#0f172a';
              }
              element.classList.add('post-location-marker');
              element.dataset.index = String(idx);
              element.tabIndex = 0;
              element.setAttribute('role', 'button');
              element.setAttribute('aria-pressed', 'false');
              element.setAttribute('aria-label', `${location.venue} (${location.address})`);
              element.addEventListener('click', () => {
                if(idx === currentVenueIndex) return;
                updateVenue(idx);
              });
              element.addEventListener('keydown', evt => {
                if(evt.key === 'Enter' || evt.key === ' ' || evt.key === 'Spacebar'){
                  evt.preventDefault();
                  element.click();
                }
              });
              const markerInstance = new mapboxgl.Marker({ element, anchor: 'center' }).setLngLat([location.lng, location.lat]).addTo(map);
              locationMarkers.push({ marker: markerInstance, element, index: idx });
            });
            updateDetailMarkerSelection(selectedIdx);
          };

          const fitToLocations = () => {
            if(!map || !effectiveEntries.length){
              return;
            }
            const validPoints = effectiveEntries
              .map(entry => entry.location)
              .filter(location => Number.isFinite(location.lng) && Number.isFinite(location.lat));
            if(!validPoints.length){
              return;
            }
            if(validPoints.length === 1){
              try{
                map.setCenter([validPoints[0].lng, validPoints[0].lat]);
                map.setZoom(10);
              }catch(e){}
              return;
            }
            try{
              const bounds = validPoints.reduce((acc, location) => {
                if(acc){
                  acc.extend([location.lng, location.lat]);
                  return acc;
                }
                return new mapboxgl.LngLatBounds([location.lng, location.lat], [location.lng, location.lat]);
              }, null);
              if(bounds){
                map.fitBounds(bounds, { padding: 40, duration: 0, maxZoom: 10 });
              }
            }catch(e){}
          };

          if(!map){
            setTimeout(async () => {
              if(map) {
                refreshMarkers();
                fitToLocations();
                return;
              }

              await ensureMapboxCssFor(mapEl);

              if (mapEl && mapEl.__map && typeof mapEl.__map.remove === 'function') {
                try { mapEl.__map.remove(); } catch {}
                mapEl.__map = null;
              }
              locationMarkers.forEach(({ marker }) => { try{ marker.remove(); }catch(e){} });
              locationMarkers = [];

              map = new mapboxgl.Map({
                container: mapEl,
                style: mapStyle,
                center,
                zoom: 3,
                interactive: false
              });

              const ensureDetailIcon = attachIconLoader(map);

              const pendingDetailStyleImageRequests = new Map();

              const handleDetailStyleImageMissing = (evt) => {
                const imageId = evt && evt.id;
                if(!imageId){
                  return;
                }
                try{
                  if(map.hasImage?.(imageId)){
                    return;
                  }
                }catch(err){
                  console.error(err);
                }
                if(pendingDetailStyleImageRequests.has(imageId)){
                  return;
                }
                const result = generateMarkerImageFromId(imageId, map, { ensureIcon: ensureDetailIcon });
                if(result && typeof result.then === 'function'){
                  const task = result.then(output => {
                    if(!output){
                      return;
                    }
                    const { image, options } = output;
                    if(!image){
                      return;
                    }
                    try{
                      if(map.hasImage?.(imageId)){
                        return;
                      }
                      map.addImage(imageId, image, options || {});
                    }catch(error){
                      console.error(error);
                    }
                  }).catch(error => {
                    console.error(error);
                  }).finally(() => {
                    pendingDetailStyleImageRequests.delete(imageId);
                  });
                  pendingDetailStyleImageRequests.set(imageId, task);
                  return;
                }
                if(result && result.image){
                  try{
                    if(!map.hasImage?.(imageId)){
                      map.addImage(imageId, result.image, result.options || {});
                    }
                  }catch(error){
                    console.error(error);
                  }
                }
              };

              map.on('mousemove', (e) => {
                const has = !!(e.features && e.features.length);
                map.getCanvas().style.cursor = has ? 'pointer' : '';
              });

              armPointerOnSymbolLayers(map);

              const applyDetailStyleAdjustments = () => {
                applyNightSky(map);
                patchMapboxStyleArtifacts(map);
              };
              whenStyleReady(map, applyDetailStyleAdjustments);
              map.on('style.load', applyDetailStyleAdjustments);
              map.on('styledata', () => {
                if(map.isStyleLoaded && map.isStyleLoaded()){
                  patchMapboxStyleArtifacts(map);
                }
              });

              try{ map.on('styleimagemissing', handleDetailStyleImageMissing); }
              catch(err){ console.error(err); }

              if(resizeHandler){
                window.removeEventListener('resize', resizeHandler);
              }
              resizeHandler = ()=>{ if(map) map.resize(); };
              window.addEventListener('resize', resizeHandler);

              const ready = () => {
                refreshMarkers();
                fitToLocations();
              };
              if(map.loaded()){
                ready();
              } else {
                map.once('load', ready);
              }

              assignDetailRef();

              setTimeout(()=>{ if(map && typeof map.resize === 'function') map.resize(); },0);
            }, 0);
          } else {
            refreshMarkers();
            fitToLocations();
            setTimeout(()=> map && map.resize(),0);
            assignDetailRef();
          }
        };
        window.ensureMapForVenue = ensureMapForVenue;

        const expiredToggle = document.getElementById('expiredToggle');
        if(expiredToggle){
          const handler = ()=> updateSessionOptionsList();
          if(expiredToggle._detailExpiredHandler){
            expiredToggle.removeEventListener('change', expiredToggle._detailExpiredHandler);
          }
          expiredToggle._detailExpiredHandler = handler;
          expiredToggle.addEventListener('change', handler);
        }

        if(sessMenu){
          const filterHandler = ()=> updateSessionOptionsList();
          if(sessMenu._detailSessionFilterHandler){
            ['sessionfilterchange','sessionfilterreset'].forEach(evt => {
              sessMenu.removeEventListener(evt, sessMenu._detailSessionFilterHandler);
            });
          }
          sessMenu._detailSessionFilterHandler = filterHandler;
          ['sessionfilterchange','sessionfilterreset'].forEach(evt => {
            sessMenu.addEventListener(evt, filterHandler);
          });
        }

        const tasks = [];
        if(mapEl){
          tasks.push(()=> {
            const ensure = typeof window.callWhenDefined === 'function'
              ? window.callWhenDefined
              : function(name, cb, timeoutMs){
                  const start = performance.now(), max = timeoutMs ?? 5000;
                  (function check(){
                    const fn = window[name];
                    if (typeof fn === 'function') { try { cb(fn); } catch(e){} return; }
                    if (performance.now() - start < max) requestAnimationFrame(check);
                  })();
                };
            ensure('ensureMapForVenue', fn => fn());
          });
        }
        tasks.push(()=> updateSessionOptionsList());
        tasks.push(()=> attachSessionButtonHandler());

        function runNext(){
          const task = tasks.shift();
          if(!task) return;
          const start = performance.now();
          try{ task(); }catch(err){}
          if(performance.now() - start > 6){
            setTimeout(runNext, 0);
          } else {
            runNext();
          }
        }
        runNext();
      }

      window.updateVenue = updateVenue;
      window.ensureMapForVenue = ensureMapForVenue;
      if(typeof window.__wrapForInputYield === 'function'){
        window.__wrapForInputYield('updateVenue');
        window.__wrapForInputYield('ensureMapForVenue');
      }

        if(mapEl){
          setTimeout(()=>{
            loadMapbox().then(()=>{
              updateVenue(0);
              if(venueMenu && venueBtn && venueOptions){
                venueOptions.querySelectorAll('button').forEach(btn=>{
                  const btnIndex = parseInt(btn.dataset.index, 10);
                  const isVisible = !btn.hidden && !btn.disabled;
                  btn.classList.toggle('selected', isVisible && btnIndex === currentVenueIndex);
                  btn.addEventListener('click', ()=>{
                    if(btn.hidden || btn.disabled){
                      hideMenu(venueMenu);
                      venueBtn.setAttribute('aria-expanded','false');
                      return;
                    }
                    const targetIndex = parseInt(btn.dataset.index, 10);
                    if(!Number.isInteger(targetIndex)){
                      return;
                    }
                    if(targetIndex === currentVenueIndex){
                      if(venueCloseTimer){
                        clearTimeout(venueCloseTimer);
                      }
                      venueCloseTimer = setTimeout(()=>{
                        hideMenu(venueMenu);
                        venueBtn.setAttribute('aria-expanded','false');
                        venueCloseTimer = null;
                      }, 100);
                      return;
                    }
                    venueOptions.querySelectorAll('button').forEach(b=> b.classList.remove('selected'));
                    btn.classList.add('selected');
                    updateVenue(targetIndex);
                    if(venueCloseTimer){
                      clearTimeout(venueCloseTimer);
                    }
                    venueCloseTimer = setTimeout(()=>{
                      hideMenu(venueMenu);
                      venueBtn.setAttribute('aria-expanded','false');
                      venueCloseTimer = null;
                    }, 100);
                  });
                });
                venueBtn.addEventListener('click', ()=>{
                  const expanded = venueBtn.getAttribute('aria-expanded') === 'true';
                  const opening = !expanded;
                  venueBtn.setAttribute('aria-expanded', String(opening));
                  if(opening){
                    showMenu(venueMenu);
                  } else {
                    hideMenu(venueMenu);
                  }
                  if(opening){
                    const adjustMap = ()=>{
                      if(map && typeof map.resize === 'function') map.resize();
                      if(typeof ensureMapForVenue === 'function') ensureMapForVenue();
                    };
                    if(typeof requestAnimationFrame === 'function'){
                      requestAnimationFrame(adjustMap);
                    } else {
                      setTimeout(adjustMap, 0);
                    }
                  }
                });
                document.addEventListener('click', e=>{ if(venueDropdown && !venueDropdown.contains(e.target) && venueBtn && !venueBtn.contains(e.target)){ hideMenu(venueMenu); venueBtn.setAttribute('aria-expanded','false'); } });
              }
              if(sessBtn && sessMenu){
                if(!sessDropdown._sessionOutsideHandler){
                  const outsideHandler = e=>{
                    if(sessDropdown && !sessDropdown.contains(e.target) && sessBtn && !sessBtn.contains(e.target)){
                      hideMenu(sessMenu);
                      sessBtn.setAttribute('aria-expanded','false');
                    }
                  };
                  sessDropdown._sessionOutsideHandler = outsideHandler;
                  document.addEventListener('click', outsideHandler);
                }
              }
              if(map && typeof map.resize === 'function') map.resize();
            }).catch(err => console.error(err));
          },0);
        }
    }

    function inBounds(p){
      if(!postPanel) return true;
      return p.lng >= postPanel.getWest() && p.lng <= postPanel.getEast() &&
             p.lat >= postPanel.getSouth() && p.lat <= postPanel.getNorth();
    }
    function kwMatch(p){ const kw = $('#keyword-textbox').value.trim().toLowerCase(); if(!kw) return true; return (p.title+' '+p.city+' '+p.category+' '+p.subcategory).toLowerCase().includes(kw); }
    function getPriceFilterValues(){
      const minInput = $('#min-price-input');
      const maxInput = $('#max-price-input');
      const rawMin = minInput ? minInput.value.trim() : '';
      const rawMax = maxInput ? maxInput.value.trim() : '';
      let min = rawMin === '' ? null : Number(rawMin);
      let max = rawMax === '' ? null : Number(rawMax);
      if(min !== null && !Number.isFinite(min)) min = null;
      if(max !== null && !Number.isFinite(max)) max = null;
      if(min !== null && max !== null && min > max){ const swap = min; min = max; max = swap; }
      return {min, max};
    }
    function parsePriceRange(value){
      if(typeof value !== 'string') return {min:null, max:null};
      const matches = value.match(/\d+(?:\.\d+)?/g);
      if(!matches || !matches.length) return {min:null, max:null};
      const nums = matches.map(Number).filter(n => Number.isFinite(n));
      if(!nums.length) return {min:null, max:null};
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      return {min, max};
    }
    function priceMatch(p){
      const {min, max} = getPriceFilterValues();
      if(min === null && max === null) return true;
      const ranges = [];
      const addRange = value => {
        const parsed = parsePriceRange(value);
        if(!parsed) return;
        const hasMin = parsed.min !== null;
        const hasMax = parsed.max !== null;
        if(!hasMin && !hasMax) return;
        const normalizedMin = hasMin ? parsed.min : parsed.max;
        const normalizedMax = hasMax ? parsed.max : parsed.min;
        if(normalizedMin === null && normalizedMax === null) return;
        ranges.push({
          min: normalizedMin,
          max: normalizedMax
        });
      };
      addRange(p && p.price);
      if(p && Array.isArray(p.locations)){
        p.locations.forEach(loc => {
          if(loc) addRange(loc.price);
        });
      }
      if(!ranges.length) return false;
      const aggregatedMin = ranges.reduce((acc, range) => {
        const candidate = range.min !== null ? range.min : range.max;
        if(candidate === null) return acc;
        return acc === null ? candidate : Math.min(acc, candidate);
      }, null);
      const aggregatedMax = ranges.reduce((acc, range) => {
        const candidate = range.max !== null ? range.max : range.min;
        if(candidate === null) return acc;
        return acc === null ? candidate : Math.max(acc, candidate);
      }, null);
      if(min !== null && aggregatedMax !== null && aggregatedMax < min) return false;
      if(max !== null && aggregatedMin !== null && aggregatedMin > max) return false;
      const satisfiesBounds = ranges.some(range => {
        if(min !== null && range.max !== null && range.max < min) return false;
        if(max !== null && range.min !== null && range.min > max) return false;
        return true;
      });
      if(!satisfiesBounds) return false;
      return true;
    }
    function dateMatch(p){
      const {start,end} = orderedRange();
      const expiredChk = $('#expiredToggle');
      if(!start && !end){
        if(expiredChk && expiredChk.checked){
          return true;
        }
        const today = new Date(); today.setHours(0,0,0,0);
        return p.dates.some(d => parseISODate(d) >= today);
      }
      return p.dates.some(d => {
        const dt = parseISODate(d);
        if(start && dt < start) return false;
        if(end && dt > end) return false;
        return true;
      });
    }
    function catMatch(p){
      const haveCategoryControllers = Object.keys(categoryControllers).length > 0;
      if(!haveCategoryControllers){
        return true;
      }
      if(selection.cats.size===0){
        return false;
      }
      const cOk = selection.cats.has(p.category);
      if(!cOk) return false;
      if(selection.subs.size===0){
        return false;
      }
      return selection.subs.has(p.category+'::'+p.subcategory);
    }

    function hideResultIndicators(){
      const resultCountEl = $('#resultCount');
      if(resultCountEl){
        resultCountEl.innerHTML = '';
        resultCountEl.style.display = 'none';
      }
      const summaryEl = $('#filterSummary');
      if(summaryEl){
        summaryEl.textContent = '';
      }
    }

    function getVisibleMarkerBoundsForCount(){
      let zoomCandidate = Number.isFinite(lastKnownZoom) ? lastKnownZoom : NaN;
      if(!Number.isFinite(zoomCandidate) && map && typeof map.getZoom === 'function'){
        try {
          zoomCandidate = map.getZoom();
        } catch(err){
          zoomCandidate = NaN;
        }
      }
      if(!Number.isFinite(zoomCandidate) || zoomCandidate < MARKER_ZOOM_THRESHOLD){
        return null;
      }
      const boundsSource = postPanel || (map && typeof map.getBounds === 'function' ? map.getBounds() : null);
      if(!boundsSource) return null;
      return normalizeBounds(boundsSource);
    }

    function updateFilterCounts(){
      if(spinning){
        hideResultIndicators();
        updateResetBtn();
        return;
      }
      if(!postsLoaded) return;
      const basePosts = posts.filter(p => (spinning || inBounds(p)) && dateMatch(p));
      filtered = basePosts.filter(p => kwMatch(p) && catMatch(p) && priceMatch(p));
      const boundsForCount = getVisibleMarkerBoundsForCount();
      const filteredMarkers = boundsForCount ? countMarkersForVenue(filtered, null, boundsForCount) : countMarkersForVenue(filtered);
      const rawTotalMarkers = boundsForCount ? countMarkersForVenue(basePosts, null, boundsForCount) : countMarkersForVenue(basePosts);
      const totalMarkers = Math.max(filteredMarkers, rawTotalMarkers);
      const summary = $('#filterSummary');
      if(summary){ summary.textContent = `${filteredMarkers} results showing out of ${totalMarkers} results in the area.`; }
      updateResultCount(filteredMarkers);
      updateResetBtn();
    }

    function refreshMarkers(render = true){
      if(spinning) return;
      if(!postsLoaded) return;
      const newAdPosts = filtered.filter(p => p.sponsored);
      const ids = newAdPosts.map(p => p.id).join(',');
      if(adPanel && ids !== adIdsKey){
        adPanel.innerHTML = '';
        adIndex = -1;
        if(adTimer){ clearInterval(adTimer); }
        adPosts = newAdPosts;
        if(adPosts.length){
          showNextAd();
          adTimer = setInterval(showNextAd,20000);
        } else {
          const img = document.createElement('img');
          img.src = 'assets/welcome%20001.jpg';
          img.alt = 'Welcome';
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';
          adPanel.appendChild(img);
        }
        adIdsKey = ids;
      } else {
        adPosts = newAdPosts;
      }
      if(render) renderLists(filtered);
      syncMarkerSources(filtered);
      updateLayerVisibility(lastKnownZoom);
      filtersInitialized = true;
    }

    function applyFilters(render = true){
      if(spinning){
        hideResultIndicators();
        return;
      }
      updateFilterCounts();
      refreshMarkers(render);
    }

    function showNextAd(){
      if(!adPanel || !adPosts.length) return;
      adIndex = (adIndex + 1) % adPosts.length;
      const p = adPosts[adIndex];
      const slide = document.createElement('a');
      slide.className = 'ad-slide';
      slide.dataset.id = p.id;
      slide.href = postUrl(p);
      const img = new Image();
      img.src = heroUrl(p);
      img.alt = '';
      img.decode().catch(()=>{}).then(()=>{
        slide.appendChild(img);
        const info = document.createElement('div');
        info.className = 'info';
        info.innerHTML = `
          <div class="title">${p.title}</div>
          <div class="cat-line"><span class="sub-icon">${subcategoryIcons[p.subcategory]||''}</span> ${p.category} &gt; ${p.subcategory}</div>
          <div class="loc-line"><span class="badge" title="Venue">📍</span><span>${p.city}</span></div>
          <div class="date-line"><span class="badge" title="Dates">📅</span><span>${formatDates(p.dates)}</span></div>
        `;
        slide.appendChild(info);
        adPanel.appendChild(slide);
        requestAnimationFrame(()=> slide.classList.add('active'));
        const slides = adPanel.querySelectorAll('.ad-slide');
        if(slides.length > 1){
          const old = slides[0];
          old.classList.remove('active');
          setTimeout(()=> old.remove(),1500);
        }
      });
    }

    function handleAdPanelClick(e){
      const slide = e.target.closest('.ad-slide');
      if(!slide) return;
      e.preventDefault();
      const id = slide.dataset.id;
      requestAnimationFrame(() => {
        callWhenDefined('openPost', (fn)=>{
          // CASE 4: AD BOARD CLICKED - SCROLL TO TOP
          // Parameters: (id, fromHistory=false, fromMap=false, originEl=null)
          Promise.resolve(fn(id, false, false, null)).then(() => {
            requestAnimationFrame(() => {
              document.querySelectorAll('.recents-card[aria-selected="true"]').forEach(el=>el.removeAttribute('aria-selected'));
              const quickCard = document.querySelector(`.recents-board .recents-card[data-id="${id}"]`);
              if(quickCard){
                quickCard.setAttribute('aria-selected','true');
              }
            });
          }).catch(err => console.error(err));
        });
      });
    }

    function initAdBoard(){
      adPanel = document.querySelector('.ad-panel');
      if(!adPanel) return;
      if(!adPanel.__adListenerBound){
        adPanel.addEventListener('click', handleAdPanelClick, { capture: true });
        adPanel.__adListenerBound = true;
      }
    }

    // applyFilters();
    setMode(mode);
    if(historyWasActive && mode === 'posts'){
      document.body.classList.add('show-history');
      adjustBoards();
    }
    window.addEventListener('beforeunload', () => {
      localStorage.setItem('mode', mode);
      localStorage.setItem('historyActive', document.body.classList.contains('show-history') ? 'true' : 'false');
    });
  })();

// 0577 helpers (safety)
function isPortrait(id){ let h=0; for(let i=0;i<id.length;i++){ h=(h<<5)-h+id.charCodeAt(i); h|=0; } return Math.abs(h)%2===0; }
function heroUrl(p){ const id = (typeof p==='string')? p : p.id; const port=isPortrait(id); return `https://picsum.photos/seed/${encodeURIComponent(id)}-t/${port?'800/1200':'1200/800'}`; }
function thumbUrl(p){ const id = (typeof p==='string')? p : p.id; const port=isPortrait(id); return `https://picsum.photos/seed/${encodeURIComponent(id)}-t/${port?'200/300':'300/200'}`; }
var __stableViewportHeight = (()=>{
  const initialInner = window.innerHeight || 0;
  const initialClient = document.documentElement ? document.documentElement.clientHeight : 0;
  const initialVisual = window.visualViewport ? (window.visualViewport.height || 0) : 0;
  const initial = Math.max(initialInner, initialClient, initialVisual);
  return Number.isFinite(initial) && initial > 0 ? initial : 0;
})();

function getViewportHeight(){
  const innerHeight = window.innerHeight || 0;
  const clientHeight = document.documentElement ? document.documentElement.clientHeight : 0;
  if(window.visualViewport){
    const viewport = window.visualViewport;
    const viewportHeight = viewport.height || 0;
    const offsetTop = typeof viewport.offsetTop === 'number' ? viewport.offsetTop : 0;
    if(offsetTop > 0){
      if(Number.isFinite(__stableViewportHeight) && __stableViewportHeight > 0){
        return __stableViewportHeight;
      }
      return Math.max(innerHeight, clientHeight, viewportHeight, 0);
    }
    const candidate = Math.max(innerHeight, clientHeight, viewportHeight, 0);
    if(Number.isFinite(candidate) && candidate > 0){
      __stableViewportHeight = candidate;
      return candidate;
    }
    return Number.isFinite(__stableViewportHeight) && __stableViewportHeight > 0 ? __stableViewportHeight : 0;
  }
  const fallback = Math.max(innerHeight, clientHeight, 0);
  if(Number.isFinite(fallback) && fallback > 0){
    if(!Number.isFinite(__stableViewportHeight) || __stableViewportHeight <= 0){
      __stableViewportHeight = fallback;
    } else {
      const delta = Math.abs(fallback - __stableViewportHeight);
      if(delta <= 120 || fallback > __stableViewportHeight){
        __stableViewportHeight = fallback;
      }
    }
    return fallback;
  }
  return Number.isFinite(__stableViewportHeight) && __stableViewportHeight > 0 ? __stableViewportHeight : 0;
}
function bringToTop(item){
  const panelStack = window.panelStack || [];
  if(!panelStack) return;
  const idx = panelStack.indexOf(item);
  if(idx!==-1) panelStack.splice(idx,1);
  panelStack.push(item);
  panelStack.forEach((p,i)=>{
    if(p instanceof Element){ 
      // Use CSS variables for z-index, ensuring devtools buttons (z-index 100) stay on top
      const baseZ = p.classList.contains('panel') ? 60 : (p.classList.contains('modal') ? 90 : 60);
      p.style.zIndex = String(baseZ + i);
    }
  });
}
function registerPopup(p){
  bringToTop(p);
  if(typeof p.on==='function'){
    p.on('close',()=>{
      const panelStack = window.panelStack || [];
      const i = panelStack.indexOf(p);
      if(i!==-1) panelStack.splice(i,1);
    });
  }
  const el = p.getElement && p.getElement();
  if(el){
    el.addEventListener('mousedown', ()=> bringToTop(p));
  }
}
function savePanelState(m){
  if(!m || !m.id || m.id === 'welcome-modal') return;
  const content = m.querySelector('.panel-content');
  if(!content) return;
  const state = {
    left: content.style.left,
    top: content.style.top,
    width: content.style.width,
    height: content.style.height
  };
  localStorage.setItem(`panel-${m.id}`, JSON.stringify(state));
}
function loadPanelState(m){
  if(!m || !m.id) return false;
  const content = m.querySelector('.panel-content');
  if(!content) return false;
  const saved = JSON.parse(localStorage.getItem(`panel-${m.id}`) || 'null');
  if(saved){
    ['width','height','left','top'].forEach(prop=>{
      if(saved[prop]) content.style[prop] = saved[prop];
    });
    if(saved.left || saved.top) content.style.transform = 'none';
    return true;
  }
  return false;
}

function updatePanelScrollOverlay(target){
  if(!target || !target.isConnected) return;
  const overlayWidth = target.offsetWidth - target.clientWidth;
  const value = overlayWidth > 0 ? `${overlayWidth}px` : '0px';
  target.style.setProperty('--panel-scrollbar-overlay', value);
}

function registerPanelScrollOverlay(target){
  const panelScrollOverlayItems = window.panelScrollOverlayItems || new Set();
  if(!target || panelScrollOverlayItems.has(target)) return;
  panelScrollOverlayItems.add(target);
  updatePanelScrollOverlay(target);
  if('ResizeObserver' in window){
    const observer = new ResizeObserver(()=> updatePanelScrollOverlay(target));
    observer.observe(target);
  }
  target.addEventListener('scroll', ()=> updatePanelScrollOverlay(target), { passive: true });
}

function refreshPanelScrollOverlays(){
  document.querySelectorAll('.panel-body').forEach(registerPanelScrollOverlay);
  panelScrollOverlayItems.forEach(updatePanelScrollOverlay);
}

document.addEventListener('DOMContentLoaded', ()=>{
  refreshPanelScrollOverlays();
  window.addEventListener('resize', ()=>{
    requestAnimationFrame(()=>{
      panelScrollOverlayItems.forEach(updatePanelScrollOverlay);
    });
  });
});

(function(){
  const MIN_HEADER_WIDTH = 390;
  const SIDE_MARGIN = 10;
  let mapControls = null;
  let originalParent = null;
  let originalNext = null;
  let header = null;
  let headerButtons = null;
  let viewToggle = null;
  let welcomeModal = null;
  let placedInHeader = false;
  let rafId = null;

  function cacheElements(){
    if(!mapControls || !mapControls.isConnected){
      mapControls = document.querySelector('.map-controls-map');
      if(mapControls){
        if(!originalParent) originalParent = mapControls.parentElement;
        if(!originalNext) originalNext = mapControls.nextElementSibling;
      }
    }
    if(!header || !header.isConnected){
      header = document.querySelector('.header');
    }
    if(header){
      if(!headerButtons || !header.contains(headerButtons)){
        headerButtons = header.querySelector('.header-buttons');
      }
      if(!viewToggle || !header.contains(viewToggle)){
        viewToggle = header.querySelector('.view-toggle');
      }
    } else {
      headerButtons = null;
      viewToggle = null;
    }
    if(!welcomeModal || !welcomeModal.isConnected){
      welcomeModal = document.getElementById('welcome-modal');
    }
    return Boolean(mapControls && header);
  }

  function moveToHeader(){
    if(!cacheElements() || placedInHeader) return;
    const insertBeforeNode = (headerButtons && headerButtons.parentNode === header) ? headerButtons : null;
    if(insertBeforeNode){
      header.insertBefore(mapControls, insertBeforeNode);
    } else {
      header.appendChild(mapControls);
    }
    mapControls.classList.add('in-header');
    placedInHeader = true;
  }

  function moveToOriginal(){
    if(!mapControls || !originalParent || !placedInHeader) return;
    if(originalNext && originalNext.parentNode === originalParent){
      originalParent.insertBefore(mapControls, originalNext);
    } else {
      originalParent.appendChild(mapControls);
    }
    mapControls.classList.remove('in-header');
    mapControls.style.left = '';
    mapControls.style.width = '';
    mapControls.style.maxWidth = '';
    placedInHeader = false;
  }

  function performUpdate(){
    rafId = null;
    if(!cacheElements()) return;
    const welcomeOpen = welcomeModal && welcomeModal.classList.contains('show');
    if(welcomeOpen){
      moveToOriginal();
      return;
    }
    if(!headerButtons || !viewToggle){
      moveToOriginal();
      return;
    }
    const headerRect = header.getBoundingClientRect();
    const viewRect = viewToggle.getBoundingClientRect();
    const buttonsRect = headerButtons.getBoundingClientRect();
    const leftBoundary = Math.max(viewRect.right, headerRect.left) + SIDE_MARGIN;
    const rightBoundary = Math.min(buttonsRect.left, headerRect.right) - SIDE_MARGIN;
    const available = rightBoundary - leftBoundary;
    if(available < MIN_HEADER_WIDTH){
      moveToOriginal();
      return;
    }
    moveToHeader();
    const center = leftBoundary + available / 2;
    mapControls.style.left = (center - headerRect.left) + 'px';
    mapControls.style.width = '';
    mapControls.style.maxWidth = '';
    const ctrlRect = mapControls.getBoundingClientRect();
    if(ctrlRect.width > available){
      moveToOriginal();
    }
  }

  function scheduleUpdate(){
    if(rafId !== null) return;
    rafId = requestAnimationFrame(performUpdate);
  }

  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('orientationchange', scheduleUpdate);
  document.addEventListener('DOMContentLoaded', scheduleUpdate);
  window.addEventListener('load', scheduleUpdate);
  if(document.readyState !== 'loading') scheduleUpdate();

  const getWelcome = () => {
    if(!welcomeModal || !welcomeModal.isConnected){
      welcomeModal = document.getElementById('welcome-modal');
    }
    return welcomeModal;
  };
  const observedWelcome = getWelcome();
  if(observedWelcome && typeof MutationObserver === 'function'){
    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(observedWelcome, {attributes:true, attributeFilter:['class','style']});
  }

  window.updateHeaderMapControls = scheduleUpdate;
})();

function schedulePanelEntrance(content, force=false){
  if(!content) return;
  if(force){
    content.classList.remove('panel-visible');
  }
  content.style.transform = '';
  if(force || !content.classList.contains('panel-visible')){
    requestAnimationFrame(()=>{
      if(!content.isConnected) return;
      content.classList.add('panel-visible');
    });
  }
}
function openPanel(m){
  if(!m) return;
  if(m.id === 'adminPanel' && window.adminAuthManager && !window.adminAuthManager.isAuthenticated()){
    window.adminAuthManager.ensureAuthenticated();
    return;
  }
  
  // Initialize admin panel spin controls with current values
  if(m.id === 'adminPanel'){
    const spinLoadStartCheckbox = document.getElementById('spinLoadStart');
    const spinTypeRadios = document.querySelectorAll('input[name="spinType"]');
    const spinLogoClickCheckbox = document.getElementById('spinLogoClick');
    const spinZoomMaxSlider = document.getElementById('spinZoomMax');
    const spinZoomMaxDisplay = document.getElementById('spinZoomMaxDisplay');
    const spinSpeedSlider = document.getElementById('spinSpeed');
    const spinSpeedDisplay = document.getElementById('spinSpeedDisplay');
    
    if(window.spinGlobals){
      if(spinLoadStartCheckbox){
        spinLoadStartCheckbox.checked = window.spinGlobals.spinLoadStart || false;
      }
      if(spinTypeRadios.length){
        spinTypeRadios.forEach(radio => {
          radio.checked = (radio.value === (window.spinGlobals.spinLoadType || 'everyone'));
        });
      }
      if(spinLogoClickCheckbox){
        spinLogoClickCheckbox.checked = window.spinGlobals.spinLogoClick !== undefined ? window.spinGlobals.spinLogoClick : true;
      }
      if(spinZoomMaxSlider && spinZoomMaxDisplay){
        const zoomValue = window.spinGlobals.spinZoomMax || 4;
        spinZoomMaxSlider.value = zoomValue;
        spinZoomMaxDisplay.textContent = zoomValue;
      }
      if(spinSpeedSlider && spinSpeedDisplay){
        const speedValue = window.spinGlobals.spinSpeed || 0.3;
        spinSpeedSlider.value = speedValue;
        spinSpeedDisplay.textContent = speedValue.toFixed(1);
      }
    }
    
    // Auto-save function for map settings
    async function autoSaveMapSettings(){
      const settings = {};
      if(spinLoadStartCheckbox) settings.spin_on_load = spinLoadStartCheckbox.checked;
      if(spinLogoClickCheckbox) settings.spin_on_logo = spinLogoClickCheckbox.checked;
      const checkedRadio = Array.from(spinTypeRadios).find(r => r.checked);
      if(checkedRadio) settings.spin_load_type = checkedRadio.value;
      if(spinZoomMaxSlider){
        const zoomValue = parseInt(spinZoomMaxSlider.value, 10);
        if(!isNaN(zoomValue)) settings.spin_zoom_max = zoomValue;
      }
      if(spinSpeedSlider){
        const speedValue = parseFloat(spinSpeedSlider.value);
        if(!isNaN(speedValue)) settings.spin_speed = speedValue;
      }
      
      // Include icon folder setting
      const iconFolderInput = document.getElementById('adminIconFolder');
      if(iconFolderInput){
        const iconFolderValue = iconFolderInput.value.trim();
        if(iconFolderValue){
          settings.icon_folder = iconFolderValue;
          window.iconFolder = iconFolderValue;
        }
      }
      
      // Include admin icon folder setting
      const adminIconFolderInput = document.getElementById('adminAdminIconFolder');
      if(adminIconFolderInput){
        const adminIconFolderValue = adminIconFolderInput.value.trim();
        if(adminIconFolderValue){
          settings.admin_icon_folder = adminIconFolderValue;
          window.adminIconFolder = adminIconFolderValue;
        }
      }
      
      try {
        await fetch('/gateway.php?action=save-admin-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(settings)
        });
      } catch(err){
        console.warn('Auto-save failed:', err);
      }
    }
    
    // Make value displays editable on click
    function makeValueEditable(display, slider, min, max, decimals){
      if(!display || display.dataset.editableAdded) return;
      display.dataset.editableAdded = 'true';
      display.style.cursor = 'pointer';
      
      display.addEventListener('click', ()=>{
        const currentValue = display.textContent;
        const input = document.createElement('input');
        input.type = 'number';
        input.value = currentValue;
        input.min = min;
        input.max = max;
        input.step = decimals ? '0.1' : '1';
        input.className = 'slider-value-input';
        input.style.width = '60px';
        input.style.textAlign = 'center';
        input.style.fontSize = '16px';
        input.style.fontWeight = 'bold';
        input.style.background = 'rgba(0,0,0,0.5)';
        input.style.color = '#fff';
        input.style.border = '1px solid #2e3a72';
        input.style.borderRadius = '4px';
        input.style.padding = '2px';
        
        const commitValue = ()=>{
          let newValue = decimals ? parseFloat(input.value) : parseInt(input.value, 10);
          if(isNaN(newValue)) newValue = decimals ? parseFloat(currentValue) : parseInt(currentValue, 10);
          newValue = Math.max(min, Math.min(max, newValue));
          const formattedValue = decimals ? newValue.toFixed(1) : newValue.toString();
          display.textContent = formattedValue;
          display.style.display = '';
          input.remove();
          if(slider) slider.value = newValue;
          if(slider === spinZoomMaxSlider && window.spinGlobals) window.spinGlobals.spinZoomMax = newValue;
          if(slider === spinSpeedSlider && window.spinGlobals) window.spinGlobals.spinSpeed = newValue;
          autoSaveMapSettings();
        };
        
        input.addEventListener('blur', commitValue);
        input.addEventListener('keydown', (e)=>{
          if(e.key === 'Enter'){
            e.preventDefault();
            commitValue();
          } else if(e.key === 'Escape'){
            display.style.display = '';
            input.remove();
          }
        });
        
        display.style.display = 'none';
        display.parentNode.insertBefore(input, display);
        input.focus();
        input.select();
      });
    }
    
    makeValueEditable(spinZoomMaxDisplay, spinZoomMaxSlider, 1, 10, false);
    makeValueEditable(spinSpeedDisplay, spinSpeedSlider, 0.1, 2.0, true);
    
    // Zoom slider - update display on input, save on change
    if(spinZoomMaxSlider && !spinZoomMaxSlider.dataset.listenerAdded){
      spinZoomMaxSlider.dataset.listenerAdded = 'true';
      spinZoomMaxSlider.addEventListener('input', ()=>{
        spinZoomMaxDisplay.textContent = spinZoomMaxSlider.value;
      });
      spinZoomMaxSlider.addEventListener('change', ()=>{
        const zoomValue = parseInt(spinZoomMaxSlider.value, 10);
        if(!isNaN(zoomValue) && window.spinGlobals){
          window.spinGlobals.spinZoomMax = zoomValue;
        }
        autoSaveMapSettings();
      });
    }
    
    // Speed slider - update display on input, save on change
    if(spinSpeedSlider && !spinSpeedSlider.dataset.listenerAdded){
      spinSpeedSlider.dataset.listenerAdded = 'true';
      spinSpeedSlider.addEventListener('input', ()=>{
        spinSpeedDisplay.textContent = parseFloat(spinSpeedSlider.value).toFixed(1);
      });
      spinSpeedSlider.addEventListener('change', ()=>{
        const speedValue = parseFloat(spinSpeedSlider.value);
        if(!isNaN(speedValue) && window.spinGlobals){
          window.spinGlobals.spinSpeed = speedValue;
        }
        autoSaveMapSettings();
      });
    }
    
    // Auto-save when toggles/radios change
    if(spinLoadStartCheckbox && !spinLoadStartCheckbox.dataset.autoSaveAdded){
      spinLoadStartCheckbox.dataset.autoSaveAdded = 'true';
      spinLoadStartCheckbox.addEventListener('change', ()=>{
        if(window.spinGlobals) window.spinGlobals.spinLoadStart = spinLoadStartCheckbox.checked;
        autoSaveMapSettings();
      });
    }
    if(spinLogoClickCheckbox && !spinLogoClickCheckbox.dataset.autoSaveAdded){
      spinLogoClickCheckbox.dataset.autoSaveAdded = 'true';
      spinLogoClickCheckbox.addEventListener('change', ()=>{
        if(window.spinGlobals) window.spinGlobals.spinLogoClick = spinLogoClickCheckbox.checked;
        autoSaveMapSettings();
      });
    }
    spinTypeRadios.forEach(radio => {
      if(radio.dataset.autoSaveAdded) return;
      radio.dataset.autoSaveAdded = 'true';
      radio.addEventListener('change', ()=>{
        if(radio.checked && window.spinGlobals) window.spinGlobals.spinLoadType = radio.value;
        autoSaveMapSettings();
      });
    });
    
    // Auto-save icon folder setting on blur
    const iconFolderInput = document.getElementById('adminIconFolder');
    if(iconFolderInput && !iconFolderInput.dataset.autoSaveAdded){
      iconFolderInput.dataset.autoSaveAdded = 'true';
      iconFolderInput.addEventListener('blur', ()=>{
        autoSaveMapSettings();
      });
      iconFolderInput.addEventListener('change', ()=>{
        autoSaveMapSettings();
      });
    }
    
    // Auto-save admin icon folder setting on blur
    const adminIconFolderInput = document.getElementById('adminAdminIconFolder');
    if(adminIconFolderInput && !adminIconFolderInput.dataset.autoSaveAdded){
      adminIconFolderInput.dataset.autoSaveAdded = 'true';
      adminIconFolderInput.addEventListener('blur', ()=>{
        autoSaveMapSettings();
      });
      adminIconFolderInput.addEventListener('change', ()=>{
        autoSaveMapSettings();
      });
    }
  }
  
  const content = m.querySelector('.panel-content') || m.querySelector('.modal-content');
  if(content && m.id !== 'welcome-modal'){
    content.style.width = '';
    content.style.height = '';
  }
  let shouldScheduleEntrance = false;
  if(content){
    const rootStyles = getComputedStyle(document.documentElement);
    const headerH = parseFloat(rootStyles.getPropertyValue('--header-h')) || 0;
    const subH = parseFloat(rootStyles.getPropertyValue('--subheader-h')) || 0;
    const footerH = parseFloat(rootStyles.getPropertyValue('--footer-h')) || 0;
    const safeTop = parseFloat(rootStyles.getPropertyValue('--safe-top')) || 0;
    const viewportHeight = getViewportHeight();
    const innerWidth = window.innerWidth;
    if(m.id==='adminPanel' || m.id==='memberPanel'){
      const topPos = headerH + safeTop;
      const availableHeight = Math.max(0, viewportHeight - footerH - topPos);
      content.style.left='auto';
      content.style.right='0';
      content.style.top=`${topPos}px`;
      content.style.bottom=`${footerH}px`;
      content.style.maxHeight = availableHeight ? `${availableHeight}px` : '';
      content.dataset.side='right';
      if(!content.classList.contains('panel-visible')){
        content.classList.remove('panel-visible');
        shouldScheduleEntrance = true;
      }
    } else if(m.id==='filterPanel'){
      const topPos = headerH + subH + safeTop;
      if(innerWidth < 450){
        content.style.left='0';
        content.style.right='0';
        content.style.top=`${topPos}px`;
        content.style.bottom=`${footerH}px`;
        content.style.maxHeight='';
      } else {
        const availableHeight = Math.max(0, viewportHeight - footerH - topPos);
        content.style.left='0';
        content.style.right='';
        content.style.top=`${topPos}px`;
        content.style.bottom='';
        content.style.maxHeight = availableHeight ? `${availableHeight}px` : '';
      }
      content.dataset.side='left';
      if(!content.classList.contains('panel-visible')){
        content.classList.remove('panel-visible');
        shouldScheduleEntrance = true;
      }
    } else if(m.id==='welcome-modal'){
      const topPos = headerH + safeTop + 10;
      content.style.left='50%';
      content.style.top=`${topPos}px`;
      content.style.transform='translateX(-50%)';
    } else {
      content.style.left='50%';
      content.style.top='50%';
      content.style.transform='translate(-50%, -50%)';
      if(m.id !== 'welcome-modal' && !['adminPanel','memberPanel','filterPanel'].includes(m.id)){
        loadPanelState(m);
      }
    }
  }
  m.classList.add('show');
  m.removeAttribute('aria-hidden');
  m.removeAttribute('inert');
  if(m.id === 'welcome-modal'){
    const mc = document.querySelector('.map-controls-map');
    if(mc) mc.style.display = 'none';
  }
  const btnId = window.panelButtons && window.panelButtons[m && m.id];
  if(btnId){
    const btn = document.getElementById(btnId);
    btn && btn.setAttribute('aria-pressed','true');
  }
  localStorage.setItem(`panel-open-${m.id}`,'true');
  if(content && shouldScheduleEntrance){
    schedulePanelEntrance(content);
  }
  if(!m.__bringToTopAdded){
    m.addEventListener('mousedown', ()=> bringToTop(m));
    m.__bringToTopAdded = true;
  }
  bringToTop(m);
  if(map && typeof map.resize === 'function') setTimeout(()=> map.resize(),0);
  if(typeof window.adjustBoards === 'function') setTimeout(()=> window.adjustBoards(), 0);
  if(typeof window.updateHeaderMapControls === 'function') window.updateHeaderMapControls();
  if(content){
    requestAnimationFrame(()=> refreshPanelScrollOverlays());
  }
}

const memberPanelChangeManager = (()=>{
  const DRAFT_KEY = 'member-form-draft-v1';
  let panel = null;
  let form = null;
  let saveButton = null;
  let discardButton = null;
  let prompt = null;
  let promptCancelButton = null;
  let promptSaveButton = null;
  let promptDiscardButton = null;
  let promptKeydownListener = null;
  let promptKeydownTarget = null;
  let promptOpener = null;
  let statusMessage = null;
  let dirty = false;
  let savedState = {};
  let applying = false;
  let initialized = false;
  let statusTimer = null;
  let pendingCloseTarget = null;

  function ensureElements(){
    panel = document.getElementById('memberPanel');
    form = document.getElementById('memberForm');
    if(panel){
      saveButton = panel.querySelector('.save-changes');
      discardButton = panel.querySelector('.discard-changes');
    }
    prompt = document.getElementById('memberUnsavedPrompt');
    if(prompt){
      promptCancelButton = prompt.querySelector('.confirm-cancel');
      promptSaveButton = prompt.querySelector('.confirm-save');
      promptDiscardButton = prompt.querySelector('.confirm-discard');
    } else {
      promptCancelButton = null;
      promptSaveButton = null;
      promptDiscardButton = null;
    }
    statusMessage = document.getElementById('memberStatusMessage');
  }

  function getKey(el){
    if(!el) return '';
    return el.name || el.id || '';
  }

  function serializeState(){
    if(!form) return {};
    const data = {};
    form.querySelectorAll('input, select, textarea').forEach(el => {
      const key = getKey(el);
      if(!key) return;
      if(el.type === 'file'){
        data[key] = el.files && el.files.length ? '__FILE_SELECTED__' : '';
        return;
      }
      if(el.type === 'checkbox'){
        data[key] = !!el.checked;
        return;
      }
      if(el.type === 'radio'){
        if(!(key in data)) data[key] = null;
        if(el.checked) data[key] = el.value;
        return;
      }
      data[key] = el.value;
    });
    return data;
  }

  function saveDraft(state){
    try{
      const payload = { ts: Date.now(), state: state || {} };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    }catch(_e){}
  }

  function loadDraft(){
    try{
      const raw = localStorage.getItem(DRAFT_KEY);
      if(!raw) return null;
      const parsed = JSON.parse(raw);
      if(parsed && parsed.state && typeof parsed.state === 'object'){
        return parsed.state;
      }
    }catch(_e){}
    return null;
  }
  function stateEquals(a, b){
    const keys = new Set([
      ...Object.keys(a || {}),
      ...Object.keys(b || {})
    ]);
    for(const key of keys){
      if(a[key] !== b[key]){
        return false;
      }
    }
    return true;
  }

  function setDirty(value){
    dirty = !!value;
    if(panel){
      panel.classList.toggle('has-unsaved', dirty);
      panel.setAttribute('data-unsaved', dirty ? 'true' : 'false');
    }
    if(saveButton){
      saveButton.disabled = !dirty;
    }
    if(discardButton){
      discardButton.disabled = !dirty;
    }
    if(promptDiscardButton){
      promptDiscardButton.disabled = !dirty;
    }
  }

  function updateDirty(){
    if(applying) return;
    ensureElements();
    const current = serializeState();
    // Always persist draft; disable prompt for member panel
    saveDraft(current);
    setDirty(false);
  }

  async function showStatus(message){
    ensureElements();
    if(!statusMessage) return;
    
    // If message looks like a message key (starts with 'msg_'), fetch from DB
    let displayMessage = message;
    if(typeof message === 'string' && message.startsWith('msg_')){
      displayMessage = await getMessage(message, {}, true) || message;
    }
    
    statusMessage.textContent = displayMessage;
    statusMessage.setAttribute('aria-hidden','false');
    statusMessage.classList.add('show');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(()=>{
      statusMessage.classList.remove('show');
      statusMessage.setAttribute('aria-hidden','true');
    }, 2000);
  }

  function applyState(state){
    if(!form || !state) return;
    applying = true;
    try{
      form.querySelectorAll('input, select, textarea').forEach(el => {
        const key = getKey(el);
        if(!key || !(key in state)) return;
        const value = state[key];
        if(el.type === 'file'){
          const shouldClear = !value;
          if(shouldClear && el.value){
            el.value = '';
          }
          return;
        }
        if(el.type === 'checkbox'){
          const nextChecked = !!value;
          if(el.checked !== nextChecked){
            el.checked = nextChecked;
          }
          return;
        }
        if(el.type === 'radio'){
          const shouldCheck = value === el.value;
          if(el.checked !== shouldCheck){
            el.checked = shouldCheck;
          }
          return;
        }
        const nextValue = value == null ? '' : String(value);
        if(el.value !== nextValue){
          el.value = nextValue;
        }
      });
    } finally {
      applying = false;
      updateDirty();
    }
  }

  function refreshSavedState(){
    savedState = serializeState();
    setDirty(false);
  }

  function isFocusableCandidate(el){
    if(!el || typeof el.focus !== 'function'){ return false; }
    if('disabled' in el && el.disabled){ return false; }
    if(el.classList && el.classList.contains('primary-action')){ return false; }
    return true;
  }

  function findFocusTarget(){
    if(isFocusableCandidate(promptOpener) && promptOpener.isConnected){
      return promptOpener;
    }
    const roots = [];
    if(pendingCloseTarget && typeof pendingCloseTarget.querySelector === 'function'){
      roots.push(pendingCloseTarget);
    }
    if(panel && typeof panel.querySelector === 'function' && !roots.includes(panel)){
      roots.push(panel);
    }
    for(const root of roots){
      const closeButton = root.querySelector('.close-panel');
      if(isFocusableCandidate(closeButton)){
        return closeButton;
      }
      const discardButtonCandidate = root.querySelector('.discard-changes');
      if(isFocusableCandidate(discardButtonCandidate)){
        return discardButtonCandidate;
      }
      const fallback = root.querySelector('button:not([disabled]):not(.primary-action), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if(isFocusableCandidate(fallback)){
        return fallback;
      }
    }
    return null;
  }

  function closePrompt(){
    if(prompt){
      const active = document.activeElement;
      if(active && prompt.contains(active)){
        const focusTarget = findFocusTarget();
        if(!focusTarget && panel){
          const previousTabIndex = panel.getAttribute('tabindex');
          panel.setAttribute('tabindex','-1');
          panel.focus({ preventScroll: true });
          if(previousTabIndex === null){
            panel.removeAttribute('tabindex');
          } else {
            panel.setAttribute('tabindex', previousTabIndex);
          }
        } else if(focusTarget){
          focusTarget.focus({ preventScroll: true });
        }
      }
      prompt.classList.remove('show');
      prompt.setAttribute('aria-hidden','true');
      prompt.setAttribute('inert','');
      promptOpener = null;
    }
  }

  function cancelPrompt(){
    pendingCloseTarget = null;
    closePrompt();
  }

  function openPrompt(target){
    pendingCloseTarget = target || panel;
    promptOpener = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
    if(prompt){
      prompt.classList.add('show');
      prompt.setAttribute('aria-hidden','false');
      prompt.removeAttribute('inert');
      setTimeout(()=>{
        if(promptCancelButton && !promptCancelButton.disabled){
          promptCancelButton.focus();
        } else if(promptSaveButton && !promptSaveButton.disabled){
          promptSaveButton.focus();
        }
      }, 0);
    }
  }

  async function handleSave({ closeAfter } = {}){
    refreshSavedState();
    await showStatus('msg_admin_saved');
    if(closeAfter){
      const target = pendingCloseTarget;
      pendingCloseTarget = null;
      closePrompt();
      if(target) closePanel(target);
    } else {
      pendingCloseTarget = null;
    }
  }

  function notifyDiscard(detail = {}){
    try{
      document.dispatchEvent(new CustomEvent('member-panel:discarded', { detail }));
    }catch(err){
      console.error('Failed to dispatch member discard event', err);
    }
  }

  async function discardChanges({ closeAfter } = {}){
    if(form && typeof form.reset === 'function'){
      applying = true;
      try{
        form.reset();
      } finally {
        applying = false;
      }
    }
    applyState(savedState);
    setDirty(false);
    await showStatus('msg_admin_discarded');
    notifyDiscard({ closeAfter: !!closeAfter });
    if(closeAfter){
      const target = pendingCloseTarget;
      pendingCloseTarget = null;
      closePrompt();
      if(target) closePanel(target);
    } else {
      pendingCloseTarget = null;
      closePrompt();
    }
  }

  function formChanged(){
    if(applying) return;
    updateDirty();
  }

  function attachListeners(){
    if(initialized) return;
    ensureElements();
    if(!panel || !form) return;
    
// === Added Confirm Password Field ===
(function ensureConfirmPasswordField(){
  const registerPanel = document.getElementById('memberRegisterPanel');
  if(!registerPanel) return;
  const pwd = registerPanel.querySelector('input[type="password"]');
  if(!pwd) return;
  if(registerPanel.querySelector('#memberRegisterPasswordConfirm')) return;
  const confirm = document.createElement('input');
  confirm.type = 'password';
  confirm.id = 'memberRegisterPasswordConfirm';
  confirm.placeholder = 'Confirm Password';
  if(pwd.className) confirm.className = pwd.className;
  confirm.required = true;
  pwd.insertAdjacentElement('afterend', confirm);
})();
// === End Added Confirm Password Field ===

// Filter out auth inputs from triggering dirty state
function formChangedWrapper(event){
  if(event && event.target){
    const target = event.target;
    const isAuthInput = target.closest('.member-auth-panel') || 
                       target.id === 'memberLoginEmail' || 
                       target.id === 'memberLoginPassword' ||
                       target.id === 'memberRegisterName' ||
                       target.id === 'memberRegisterEmail' ||
                       target.id === 'memberRegisterPassword' ||
                       target.id === 'memberRegisterPasswordConfirm' ||
                       target.id === 'memberRegisterAvatar';
    if(isAuthInput) return;
    // Exclude venue field inputs - they should not trigger form change
    const isVenueField = target.closest('.venue-session-editor') || 
                        target.closest('.venue-card') ||
                        target.closest('.venue-session-venues') ||
                        target.closest('.mapboxgl-ctrl-geocoder');
    if(isVenueField) return;
  }
  formChanged();
}

form.addEventListener('input', formChangedWrapper, true);
    form.addEventListener('change', formChangedWrapper, true);
    if(saveButton){
      saveButton.addEventListener('click', e=>{
        e.preventDefault();
        pendingCloseTarget = null;
        handleSave({ closeAfter:false });
      });
    }
    if(discardButton){
      discardButton.addEventListener('click', e=>{
        e.preventDefault();
        pendingCloseTarget = null;
        discardChanges({ closeAfter:false });
      });
    }
    if(promptCancelButton){
      promptCancelButton.addEventListener('click', e=>{
        e.preventDefault();
        cancelPrompt();
      });
    }
    if(promptSaveButton){
      promptSaveButton.addEventListener('click', e=>{
        e.preventDefault();
        handleSave({ closeAfter:true });
      });
    }
    if(promptDiscardButton){
      promptDiscardButton.addEventListener('click', e=>{
        e.preventDefault();
        discardChanges({ closeAfter:true });
      });
    }
    if(prompt){
      if(promptKeydownTarget && promptKeydownTarget !== prompt && promptKeydownListener){
        promptKeydownTarget.removeEventListener('keydown', promptKeydownListener);
      }
      if(!promptKeydownListener){
        promptKeydownListener = event => handlePromptKeydown(event, {
          prompt,
          cancelButton: promptCancelButton,
          cancelPrompt
        });
      }
      promptKeydownTarget = prompt;
      prompt.addEventListener('keydown', promptKeydownListener);
      prompt.addEventListener('click', e=>{
        if(e.target === prompt) cancelPrompt();
      });
    }
    initialized = true;
    refreshSavedState();
  }

  ensureElements();
  attachListeners();
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(()=>{
      ensureElements();
      attachListeners();
      const draft = loadDraft();
      if(draft){ applyState(draft); }
      refreshSavedState();
    }, 0);
  });

  function isPromptOpen(){
    return !!(prompt && prompt.classList.contains('show'));
  }

  return {
    handlePanelClose(_panelEl){ return false; },
    handleEscape(_panelEl){ return false; }
  };
})();

// Extracted from <script>
(function(){
  const SAVE_ENDPOINT = '/gateway.php?action=save-form';
  const JSON_HEADERS = { 'Content-Type': 'application/json' };
  const STATUS_TIMER_KEY = '__adminStatusMessageTimer';
  const ERROR_CLASS = 'error';
  const ERROR_TIMEOUT = 5000;

  function showErrorBanner(message){
    const banner = document.getElementById('adminStatusMessage');
    if(!banner) return;
    const text = typeof message === 'string' && message.trim() ? message.trim() : 'Failed to save changes.';
    banner.textContent = text;
    banner.setAttribute('aria-hidden', 'false');
    banner.classList.add('show');
    banner.classList.add(ERROR_CLASS);
    if(window[STATUS_TIMER_KEY]){
      clearTimeout(window[STATUS_TIMER_KEY]);
    }
    window[STATUS_TIMER_KEY] = setTimeout(()=>{
      banner.classList.remove('show');
      banner.classList.remove(ERROR_CLASS);
      banner.setAttribute('aria-hidden', 'true');
      window[STATUS_TIMER_KEY] = null;
    }, ERROR_TIMEOUT);
  }

  async function saveAdminChanges(){
    // Collect modified admin messages
    const modifiedMessages = [];
    document.querySelectorAll('.message-text-input').forEach(textarea => {
      if(textarea.value !== textarea.dataset.originalValue){
        modifiedMessages.push({
          id: parseInt(textarea.dataset.messageId),
          message_text: textarea.value
        });
      }
    });
    
    // Collect general website settings
    const websiteSettings = {};
    
    const websiteNameInput = document.getElementById('adminWebsiteName');
    if(websiteNameInput){
      websiteSettings.site_name = websiteNameInput.value.trim();
    }
    
    const websiteTaglineInput = document.getElementById('adminWebsiteTagline');
    if(websiteTaglineInput){
      websiteSettings.site_tagline = websiteTaglineInput.value.trim();
    }
    
    const websiteCurrencyInput = document.getElementById('adminWebsiteCurrency');
    if(websiteCurrencyInput){
      websiteSettings.site_currency = websiteCurrencyInput.value.trim();
    }
    
    const contactEmailInput = document.getElementById('adminContactEmail');
    if(contactEmailInput){
      websiteSettings.contact_email = contactEmailInput.value.trim();
    }
    
    const supportEmailInput = document.getElementById('adminSupportEmail');
    if(supportEmailInput){
      websiteSettings.support_email = supportEmailInput.value.trim();
    }
    
    const maintenanceModeCheckbox = document.getElementById('adminMaintenanceMode');
    if(maintenanceModeCheckbox){
      websiteSettings.maintenance_mode = maintenanceModeCheckbox.checked;
    }
    
    const welcomeEnabledCheckbox = document.getElementById('adminWelcomeEnabled');
    if(welcomeEnabledCheckbox){
      websiteSettings.welcome_enabled = welcomeEnabledCheckbox.checked;
    }
    
    // Save messages separately to admin-settings endpoint (not formbuilder)
    if(modifiedMessages.length > 0){
      try {
        const messageResponse = await fetch('/gateway.php?action=save-admin-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: modifiedMessages })
        });
        
        if(!messageResponse.ok){
          console.error('Failed to save messages - HTTP status:', messageResponse.status);
        } else {
          const messageResult = await messageResponse.json();
          if(!messageResult.success){
            console.error('Failed to save messages:', messageResult.message || 'Unknown error');
          } else {
            console.log(`Messages saved successfully (${messageResult.messages_updated || 0} updated)`);
            
            // Update originalValue for all successfully saved messages
            modifiedMessages.forEach(savedMessage => {
              const textArea = document.querySelector(`.message-text-input[data-message-id="${savedMessage.id}"]`);
              if(textArea){
                // Update the originalValue to the current value (now saved)
                textArea.dataset.originalValue = textArea.value;
                
                // Update the display
                const messageItem = textArea.closest('.message-item');
                if(messageItem){
                  const messageTextDisplay = messageItem.querySelector('.message-text-display');
                  if(messageTextDisplay){
                    messageTextDisplay.innerHTML = textArea.value;
                  }
                  
                  // Remove modified class since it's now saved
                  messageItem.classList.remove('modified');
                }
              }
            });
          }
        }
      } catch(err) {
        console.error('Failed to save messages:', err);
      }
    }
    
    // Save general settings to database if any exist
    if(Object.keys(websiteSettings).length > 0){
      try {
        const response = await fetch('/gateway.php?action=save-admin-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(websiteSettings)
        });
        
        if(!response.ok){
          console.error('Failed to save website settings - HTTP status:', response.status);
        } else {
          const result = await response.json();
          if(!result.success){
            console.error('Failed to save website settings:', result.message || 'Unknown error');
          } else {
            console.log('Website settings saved successfully');
          }
        }
      } catch(err) {
        console.error('Failed to save website settings:', err);
      }
    }
    
    // Collect form data (separate from messages and settings)
    let payload = null;
    if(window.formbuilderStateManager && typeof window.formbuilderStateManager.capture === 'function'){
      try {
        payload = window.formbuilderStateManager.capture();
      } catch (err) {
        console.error('formbuilderStateManager.capture failed', err);
      }
    }
    if(!payload || typeof payload !== 'object'){
      payload = {};
    }

    // Only save form data if there's actual form data (not just empty object)
    let response;
    try {
      // Only send form data if there's something to save
      if(Object.keys(payload).length > 0){
        response = await fetch(SAVE_ENDPOINT, {
          method: 'POST',
          headers: JSON_HEADERS,
          credentials: 'same-origin',
          body: JSON.stringify(payload)
        });
      } else {
        // No form data to save, create a successful response object
        response = {
          ok: true,
          text: async () => JSON.stringify({ success: true })
        };
      }
    } catch (networkError) {
      const errorMsg = await getMessage('msg_admin_save_error_network', {}, true) || 'Unable to reach the server. Please try again.';
      showErrorBanner(errorMsg);
      throw networkError;
    }

    const responseText = await response.text();
    let data = {};
    if(responseText){
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[SaveAdminChanges] JSON parse error:', parseError, 'Response text:', responseText);
        const errorMsg = await getMessage('msg_admin_save_error_response', {}, true) || 'Unexpected response while saving changes.';
        showErrorBanner(errorMsg);
        const error = new Error('Invalid JSON response');
        error.responseText = responseText;
        throw error;
      }
    }

    if(!response.ok || typeof data !== 'object' || data === null || data.success !== true){
      console.error('[SaveAdminChanges] Save failed:', { responseOk: response.ok, data });
      const message = data && typeof data.message === 'string' && data.message.trim()
        ? data.message.trim()
        : `Failed to save changes${response.ok ? '' : ` (HTTP ${response.status})`}.`;
      showErrorBanner(message);
      const error = new Error(message);
      error.response = response;
      error.payload = data;
      throw error;
    }

    if(Array.isArray(data.new_category_ids) && data.new_category_ids.length){
      let idIndex = 0;
      categories.forEach(cat => {
        if(cat && (cat.id === null || cat.id === undefined)){
          if(idIndex < data.new_category_ids.length){
            cat.id = data.new_category_ids[idIndex];
            idIndex++;
          }
        }
      });
    }

    if(Array.isArray(data.new_subcategory_ids) && data.new_subcategory_ids.length){
      let idIndex = 0;
      categories.forEach(cat => {
        if(!cat || !Array.isArray(cat.subs)) return;
        cat.subs.forEach((subName, subIdx) => {
          const subId = cat.subIds && cat.subIds[subName];
          if(subId === null || subId === undefined){
            if(idIndex < data.new_subcategory_ids.length){
              if(!cat.subIds) cat.subIds = {};
              cat.subIds[subName] = data.new_subcategory_ids[idIndex];
              idIndex++;
            }
          }
        });
      });
    }

    if(window.formbuilderStateManager && typeof window.formbuilderStateManager.save === 'function'){
      try{
        window.formbuilderStateManager.save();
      }catch(err){
        console.error('Failed to update saved formbuilder state after ID assignment', err);
      }
    }

    // Update original values for messages after successful save
    if(modifiedMessages.length > 0){
      document.querySelectorAll('.message-text-input').forEach(textarea => {
        textarea.dataset.originalValue = textarea.value;
        const messageItem = textarea.closest('.message-item');
        if(messageItem){
          messageItem.classList.remove('modified');
        }
      });
    }

    return data;
  }

  window.saveAdminChanges = saveAdminChanges;
})();

const adminPanelChangeManager = (()=>{
  let panel = null;
  let form = null;
  let saveButton = null;
  let discardButton = null;
  let prompt = null;
  let promptCancelButton = null;
  let promptSaveButton = null;
  let promptDiscardButton = null;
  let promptKeydownListener = null;
  let promptKeydownTarget = null;
  let promptOpener = null;
  let statusMessage = null;
  let dirty = false;
  let savedState = {};
  let applying = false;
  let statusTimer = null;
  let initialized = false;
  let pendingCloseTarget = null;

  function ensureElements(){
    panel = document.getElementById('adminPanel');
    form = document.getElementById('adminForm');
    if(panel){
      saveButton = panel.querySelector('.save-changes');
      discardButton = panel.querySelector('.discard-changes');
    }
    prompt = document.getElementById('adminUnsavedPrompt');
    if(prompt){
      promptCancelButton = prompt.querySelector('.confirm-cancel');
      promptSaveButton = prompt.querySelector('.confirm-save');
      promptDiscardButton = prompt.querySelector('.confirm-discard');
    } else {
      promptCancelButton = null;
      promptSaveButton = null;
      promptDiscardButton = null;
    }
    statusMessage = document.getElementById('adminStatusMessage');
  }

  function trigger(el, type){
    el.dispatchEvent(new Event(type, { bubbles: true }));
  }

  function serializeState(){
    if(!form) return {};
    const data = {};
    const elements = form.querySelectorAll('input, select, textarea');
    elements.forEach(el => {
      if(!el) return;
      const key = el.name || el.id;
      if(!key) return;
      if(el.type === 'file') return;
      if(el.tagName === 'SELECT' && el.multiple){
        data[key] = Array.from(el.options || []).filter(opt => opt.selected).map(opt => opt.value);
        return;
      }
      if(el.type === 'checkbox'){
        data[key] = el.checked;
        return;
      }
      if(el.type === 'radio'){
        if(!(key in data)) data[key] = null;
        if(el.checked) data[key] = el.value;
        return;
      }
      data[key] = el.value;
    });
    form.querySelectorAll('[contenteditable][id]').forEach(el => {
      data[el.id] = el.innerHTML;
    });
    return data;
  }

  function applyState(state){
    if(!form || !state) return;
    applying = true;
    try{
      const elements = form.querySelectorAll('input, select, textarea');
      elements.forEach(el => {
        if(!el) return;
        const key = el.name || el.id;
        if(!key || !(key in state)) return;
        if(el.type === 'file') return;
        if(el.tagName === 'SELECT' && el.multiple){
          const values = Array.isArray(state[key]) ? state[key].map(String) : [];
          let changed = false;
          Array.from(el.options || []).forEach(opt => {
            const shouldSelect = values.includes(opt.value);
            if(opt.selected !== shouldSelect){
              opt.selected = shouldSelect;
              changed = true;
            }
          });
          if(changed) trigger(el, 'change');
          return;
        }
        if(el.type === 'checkbox'){
          const shouldCheck = !!state[key];
          if(el.checked !== shouldCheck){
            el.checked = shouldCheck;
            trigger(el, 'change');
          }
          return;
        }
        if(el.type === 'radio'){
          const shouldCheck = state[key] === el.value;
          if(el.checked !== shouldCheck){
            el.checked = shouldCheck;
            if(shouldCheck) trigger(el, 'change');
          }
          return;
        }
        const nextValue = state[key] === null || state[key] === undefined ? '' : String(state[key]);
        if(el.value !== nextValue){
          el.value = nextValue;
          trigger(el, 'input');
          trigger(el, 'change');
        }
      });
      form.querySelectorAll('[contenteditable][id]').forEach(el => {
        if(!(el.id in state)) return;
        const html = state[el.id] ?? '';
        if(el.innerHTML !== html){
          el.innerHTML = html;
          trigger(el, 'input');
          trigger(el, 'change');
        }
      });
    } finally {
      applying = false;
    }
  }

  function setDirty(value){
    dirty = !!value;
    if(panel){
      panel.classList.toggle('has-unsaved', dirty);
      panel.setAttribute('data-unsaved', dirty ? 'true' : 'false');
    }
    if(saveButton){
      saveButton.disabled = !dirty;
    }
    if(discardButton){
      discardButton.disabled = !dirty;
    }
    if(promptDiscardButton){
      promptDiscardButton.disabled = !dirty;
    }
  }

  function stateEquals(a, b){
    const keys = new Set([
      ...Object.keys(a || {}),
      ...Object.keys(b || {})
    ]);
    for(const key of keys){
      const aVal = a[key];
      const bVal = b[key];
      // Handle arrays (for multi-select)
      if(Array.isArray(aVal) && Array.isArray(bVal)){
        if(aVal.length !== bVal.length) return false;
        for(let i = 0; i < aVal.length; i++){
          if(aVal[i] !== bVal[i]) return false;
        }
        continue;
      }
      if(Array.isArray(aVal) || Array.isArray(bVal)) return false;
      if(aVal !== bVal) return false;
    }
    return true;
  }

  function updateDirty(){
    if(applying) return;
    ensureElements();
    const current = serializeState();
    setDirty(!stateEquals(current, savedState));
  }

  function refreshSavedState({ skipManagerSave } = {}){
    if(!form) return;
    savedState = serializeState();
    if(!skipManagerSave && window.formbuilderStateManager && typeof window.formbuilderStateManager.save === 'function'){
      window.formbuilderStateManager.save();
    }
    setDirty(false);
  }

  let savedStateInitializationPromise = null;
  let savedStateInitialized = false;

  async function initializeSavedState(){
    if(savedStateInitialized) return Promise.resolve();
    if(savedStateInitializationPromise) return savedStateInitializationPromise;
    let formWasFound = false;
    savedStateInitializationPromise = (async ()=>{
      if(typeof window === 'undefined') return;
      ensureElements();
      formWasFound = !!form;
      const manager = window.formbuilderStateManager;
      let snapshot = null;
      // NO FALLBACKS - only use backend snapshot
      const fetchSnapshot = typeof window.fetchSavedFormbuilderSnapshot === 'function'
        ? window.fetchSavedFormbuilderSnapshot
        : null;
      if(!fetchSnapshot){
        throw new Error('Formbuilder snapshot fetch function not available');
      }
      try{
        snapshot = await fetchSnapshot();
        if(!snapshot || typeof snapshot !== 'object'){
          throw new Error('Invalid formbuilder snapshot received from server');
        }
      }catch(err){
        console.error('Failed to fetch admin formbuilder snapshot from server:', err);
        throw err; // Don't fall back to localStorage
      }
      if(manager && typeof manager.restore === 'function' && snapshot){
        try{
          manager.restore(snapshot);
        }catch(err){
          console.error('Failed to hydrate admin formbuilder snapshot:', err);
          throw err; // Don't silently fail
        }
      }
      refreshSavedState({ skipManagerSave: true });
      if(manager && typeof manager.save === 'function'){
        try{
          manager.save();
        }catch(err){
          console.warn('Failed to persist hydrated admin formbuilder snapshot', err);
        }
      }
    })()
    .catch(err => {
      console.warn('Failed to initialize admin saved state', err);
    })
    .finally(()=>{
      savedStateInitializationPromise = null;
      if(formWasFound){
        savedStateInitialized = true;
      }
    });
    return savedStateInitializationPromise;
  }

  function showStatus(message){
    if(!statusMessage) statusMessage = document.getElementById('adminStatusMessage');
    if(!statusMessage) return;
    statusMessage.textContent = message;
    statusMessage.setAttribute('aria-hidden','false');
    statusMessage.classList.remove('error');
    if(window.__adminStatusMessageTimer){
      clearTimeout(window.__adminStatusMessageTimer);
      window.__adminStatusMessageTimer = null;
    }
    statusMessage.classList.add('show');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(()=>{
      statusMessage.classList.remove('show');
      statusMessage.setAttribute('aria-hidden','true');
    }, 2000);
  }

  function isFocusableCandidate(el){
    if(!el || typeof el.focus !== 'function'){ return false; }
    if('disabled' in el && el.disabled){ return false; }
    if(el.classList && el.classList.contains('primary-action')){ return false; }
    return true;
  }

  function findFocusTarget(){
    if(isFocusableCandidate(promptOpener) && promptOpener.isConnected){
      return promptOpener;
    }
    const roots = [];
    if(pendingCloseTarget && typeof pendingCloseTarget.querySelector === 'function'){
      roots.push(pendingCloseTarget);
    }
    if(panel && typeof panel.querySelector === 'function' && !roots.includes(panel)){
      roots.push(panel);
    }
    for(const root of roots){
      const closeButton = root.querySelector('.close-panel');
      if(isFocusableCandidate(closeButton)){
        return closeButton;
      }
      const discardButtonCandidate = root.querySelector('.discard-changes');
      if(isFocusableCandidate(discardButtonCandidate)){
        return discardButtonCandidate;
      }
      const fallback = root.querySelector('button:not([disabled]):not(.primary-action), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if(isFocusableCandidate(fallback)){
        return fallback;
      }
    }
    return null;
  }

  function closePrompt(){
    if(prompt){
      const active = document.activeElement;
      if(active && prompt.contains(active)){
        const focusTarget = findFocusTarget();
        if(!focusTarget && panel){
          const previousTabIndex = panel.getAttribute('tabindex');
          panel.setAttribute('tabindex','-1');
          panel.focus({ preventScroll: true });
          if(previousTabIndex === null){
            panel.removeAttribute('tabindex');
          } else {
            panel.setAttribute('tabindex', previousTabIndex);
          }
        } else if(focusTarget){
          focusTarget.focus({ preventScroll: true });
        }
      }
      prompt.classList.remove('show');
      prompt.setAttribute('aria-hidden','true');
      prompt.setAttribute('inert','');
      promptOpener = null;
    }
  }

  function cancelPrompt(){
    pendingCloseTarget = null;
    closePrompt();
  }

  function openPrompt(target){
    pendingCloseTarget = target;
    promptOpener = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
    if(prompt){
      prompt.classList.add('show');
      prompt.setAttribute('aria-hidden','false');
      prompt.removeAttribute('inert');
      setTimeout(()=>{
        if(promptCancelButton && !promptCancelButton.disabled){
          promptCancelButton.focus();
        } else if(promptSaveButton && !promptSaveButton.disabled){
          promptSaveButton.focus();
        }
      }, 0);
    }
  }

  async function runSave({ closeAfter } = {}){
    ensureElements();
    let result = null;
    try{
      if(typeof window.saveAdminChanges === 'function'){
        result = window.saveAdminChanges();
      }
      // Map settings (spin controls) auto-save on change, no need to save here
    }catch(err){
      const message = err && typeof err.message === 'string' ? err.message : '';
      if(message && message.toLowerCase().includes('database connection not configured')){
        console.warn('Skipped saving admin changes because the database connection is not configured.');
      } else {
        console.error('Failed to save admin changes', err);
      }
      if(!closeAfter) cancelPrompt();
      return;
    }
    Promise.resolve(result).then(()=>{
      refreshSavedState();
      showStatus('Saved');
      const panelToClose = closeAfter ? pendingCloseTarget : null;
      if(closeAfter) pendingCloseTarget = null;
      closePrompt();
      if(panelToClose) closePanel(panelToClose);
    }).catch(err => {
      const message = err && typeof err.message === 'string' ? err.message : '';
      if(message && message.toLowerCase().includes('database connection not configured')){
        console.warn('Skipped saving admin changes because the database connection is not configured.');
      } else {
        console.error('Failed to save admin changes', err);
      }
    });
  }

  function notifyDiscard(detail = {}){
    try{
      document.dispatchEvent(new CustomEvent('admin-panel:discarded', { detail }));
    }catch(err){
      console.error('Failed to dispatch admin discard event', err);
    }
  }

  function discardChanges({ closeAfter } = {}){
    if(form && typeof form.reset === 'function'){
      applying = true;
      try{
        form.reset();
      } finally {
        applying = false;
      }
    }
    if(window.formbuilderStateManager && typeof window.formbuilderStateManager.restoreSaved === 'function'){
      window.formbuilderStateManager.restoreSaved();
    }
    // Reset admin messages to original values
    document.querySelectorAll('.message-text-input').forEach(textarea => {
      textarea.value = textarea.dataset.originalValue;
      const messageItem = textarea.closest('.message-item');
      if(messageItem){
        messageItem.classList.remove('modified');
      }
      const textPreview = messageItem?.querySelector('.message-text-preview');
      if(textPreview){
        textPreview.textContent = textarea.dataset.originalValue;
      }
    });
    if(savedState) applyState(savedState);
    setDirty(false);
    showStatus('Changes Discarded');
    notifyDiscard({ closeAfter: !!closeAfter });
    const panelToClose = closeAfter ? pendingCloseTarget : null;
    pendingCloseTarget = null;
    closePrompt();
    if(panelToClose) closePanel(panelToClose);
  }

  function formChanged(){
    if(applying) return;
    updateDirty();
  }

  function attachListeners(){
    if(initialized) return;
    ensureElements();
    if(!panel || !form) return;
    
    // Filter out auth inputs from triggering dirty state (adminPanel version)
    function formChangedWrapper(event){
      if(event && event.target){
        const target = event.target;
        const isAuthInput = target.closest('.member-auth-panel') || 
                           target.id === 'memberLoginEmail' || 
                           target.id === 'memberLoginPassword' ||
                           target.id === 'memberRegisterName' ||
                           target.id === 'memberRegisterEmail' ||
                           target.id === 'memberRegisterPassword' ||
                           target.id === 'memberRegisterPasswordConfirm' ||
                           target.id === 'memberRegisterAvatar';
        if(isAuthInput) return;
        // Exclude venue field inputs - they should not trigger form change
        const isVenueField = target.closest('.venue-session-editor') || 
                            target.closest('.venue-card') ||
                            target.closest('.venue-session-venues') ||
                            target.closest('.mapboxgl-ctrl-geocoder');
        if(isVenueField) return;
      }
      formChanged();
    }
    
    form.addEventListener('input', formChangedWrapper, true);
    form.addEventListener('change', formChangedWrapper, true);
    if(saveButton){
      saveButton.addEventListener('click', e=>{
        e.preventDefault();
        pendingCloseTarget = null;
        runSave({ closeAfter:false });
      });
    }
    if(discardButton){
      discardButton.addEventListener('click', e=>{
        e.preventDefault();
        discardChanges({ closeAfter:false });
      });
    }
    if(promptCancelButton){
      promptCancelButton.addEventListener('click', e=>{
        e.preventDefault();
        cancelPrompt();
      });
    }
    if(promptSaveButton){
      promptSaveButton.addEventListener('click', e=>{
        e.preventDefault();
        runSave({ closeAfter:true });
      });
    }
    if(promptDiscardButton){
      promptDiscardButton.addEventListener('click', e=>{
        e.preventDefault();
        discardChanges({ closeAfter:true });
      });
    }
    if(prompt){
      if(promptKeydownTarget && promptKeydownTarget !== prompt && promptKeydownListener){
        promptKeydownTarget.removeEventListener('keydown', promptKeydownListener);
      }
      if(!promptKeydownListener){
        promptKeydownListener = event => handlePromptKeydown(event, {
          prompt,
          cancelButton: promptCancelButton,
          cancelPrompt
        });
      }
      promptKeydownTarget = prompt;
      prompt.addEventListener('keydown', promptKeydownListener);
      prompt.addEventListener('click', e=>{
        if(e.target === prompt) cancelPrompt();
      });
    }
    initialized = true;
  }

  ensureElements();
  attachListeners();
  initializeSavedState().then(()=>{
    refreshSavedState();
  });
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(()=>{
      ensureElements();
      attachListeners();
      initializeSavedState().then(()=>{
        refreshSavedState();
      });
    }, 0);
  });

  function isPromptOpen(){
    return !!(prompt && prompt.classList.contains('show'));
  }

  return {
    hasUnsaved(){
      return !!dirty;
    },
    handlePanelClose(panelEl){
      if(!panel || panelEl !== panel) return false;
      if(isPromptOpen()) return true;
      if(dirty){
        openPrompt(panelEl);
        return true;
      }
      return false;
    },
    handleEscape(panelEl){
      if(isPromptOpen()){
        cancelPrompt();
        return true;
      }
      if(panel && panelEl === panel && dirty){
        openPrompt(panelEl);
        return true;
      }
      return false;
    },
    markSaved(message){
      ensureElements();
      refreshSavedState();
      if(message) showStatus(message);
    },
    markDirty(){
      ensureElements();
      setDirty(true);
    },
    runSave
  };
})();
window.adminPanelModule = adminPanelChangeManager;
window.adminPanelChangeManager = adminPanelChangeManager;
window.memberPanelChangeManager = memberPanelChangeManager;
