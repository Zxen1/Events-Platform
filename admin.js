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
  let spinEnabled = false;

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
                const resolveFieldTypeDisplayName = window.resolveFieldTypeDisplayName || ((opt) => opt?.label || opt?.name || opt?.value || '');
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
              const resetVenueAutofillState = window.resetVenueAutofillState || (() => {});
              resetVenueAutofillState(safeField);
            }
            return safeField;
          };
          const buildVenueSessionPreview = (previewField, baseId)=>{
            const getVenueAutofillState = window.getVenueAutofillState || ((field, venue) => ({ slots: [] }));
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
