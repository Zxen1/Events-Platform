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

    let response;
    try {
      response = await fetch(SAVE_ENDPOINT, {
        method: 'POST',
        headers: JSON_HEADERS,
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      });
    } catch (networkError) {
      showErrorBanner('Unable to reach the server. Please try again.');
      throw networkError;
    }

    const responseText = await response.text();
    let data = {};
    if(responseText){
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        showErrorBanner('Unexpected response while saving changes.');
        const error = new Error('Invalid JSON response');
        error.responseText = responseText;
        throw error;
      }
    }

    if(!response.ok || typeof data !== 'object' || data === null || data.success !== true){
      const message = data && typeof data.message === 'string' && data.message.trim()
        ? data.message.trim()
        : `Failed to save changes${response.ok ? '' : ` (HTTP ${response.status})`}.`;
      showErrorBanner(message);
      const error = new Error(message);
      error.response = response;
      error.payload = data;
      throw error;
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
    if(discardButton){
      discardButton.disabled = !dirty;
    }
    if(promptDiscardButton){
      promptDiscardButton.disabled = !dirty;
    }
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
      const fetchSnapshot = typeof window.fetchSavedFormbuilderSnapshot === 'function'
        ? window.fetchSavedFormbuilderSnapshot
        : null;
      if(fetchSnapshot){
        try{
          snapshot = await fetchSnapshot();
        }catch(err){
          console.warn('Failed to fetch admin formbuilder snapshot from server', err);
        }
      }
      if(!snapshot && typeof window.getSavedFormbuilderSnapshot === 'function'){
        try{
          snapshot = await Promise.resolve(window.getSavedFormbuilderSnapshot());
        }catch(err){
          console.warn('Failed to load saved admin formbuilder snapshot', err);
        }
      }
      if(manager && typeof manager.restore === 'function' && snapshot){
        try{
          manager.restore(snapshot);
        }catch(err){
          console.warn('Failed to hydrate admin formbuilder snapshot', err);
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

  function runSave({ closeAfter } = {}){
    ensureElements();
    let result = null;
    try{
      if(typeof window.saveAdminChanges === 'function'){
        result = window.saveAdminChanges();
      }
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
    setDirty(true);
  }

  function attachListeners(){
    if(initialized) return;
    ensureElements();
    if(!panel || !form) return;
    form.addEventListener('input', formChanged, true);
    form.addEventListener('change', formChanged, true);
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
    }
  };
})();


const adminAuthManager = (()=>{
  const STORAGE_KEY = 'admin-authenticated';
  const IDENTITY_KEY = 'admin-identity';
  const adminBtn = document.getElementById('adminBtn');
  const adminPanel = document.getElementById('adminPanel');
  const memberPanel = document.getElementById('memberPanel');

  let authenticated = localStorage.getItem(STORAGE_KEY) === 'true';
  let adminIdentity = localStorage.getItem(IDENTITY_KEY) || '';

  function updateUI(){
    if(adminBtn){
      const isVisible = !!authenticated;
      adminBtn.hidden = !isVisible;
      adminBtn.style.display = isVisible ? 'flex' : 'none';
      adminBtn.setAttribute('aria-hidden', (!isVisible).toString());
      if(!isVisible){
        adminBtn.setAttribute('aria-pressed','false');
      }
    }
  }

  function setAuthenticatedState(value, identity){
    const next = !!value;
    if(next === authenticated){
      updateUI();
      return;
    }
    authenticated = next;
    localStorage.setItem(STORAGE_KEY, authenticated ? 'true' : 'false');
    if(authenticated){
      const normalizedIdentity = typeof identity === 'string' ? identity.trim() : '';
      adminIdentity = normalizedIdentity || adminIdentity;
      if(adminIdentity){
        localStorage.setItem(IDENTITY_KEY, adminIdentity);
      }
    } else {
      adminIdentity = '';
      localStorage.removeItem(IDENTITY_KEY);
    }
    updateUI();
    if(!authenticated){
      localStorage.setItem('panel-open-adminPanel','false');
      if(adminPanel && adminPanel.classList.contains('show')){
        closePanel(adminPanel);
      }
    }
  }

  function ensureAuthenticated(){
    if(authenticated) return true;
    if(memberPanel && !memberPanel.classList.contains('show')){
      openPanel(memberPanel);
    }
    const memberBtn = document.getElementById('memberBtn');
    if(memberBtn){
      memberBtn.focus();
    }
    return false;
  }

  updateUI();
  if(!authenticated){
    localStorage.setItem('panel-open-adminPanel','false');
    if(adminPanel && adminPanel.classList.contains('show')){
      closePanel(adminPanel);
    }
  }

  return {
    isAuthenticated(){
      return authenticated;
    },
    ensureAuthenticated,
    setAuthenticated(value, identity){
      setAuthenticatedState(value, identity);
    },
    getAdminUser(){
      const identifier = adminIdentity || localStorage.getItem(IDENTITY_KEY) || 'admin';
      const trimmed = identifier.trim();
      const emailNormalized = trimmed ? trimmed.toLowerCase() : 'admin';
      return {
        name: 'Administrator',
        email: trimmed || 'admin',
        emailNormalized,
        username: trimmed || 'admin',
        avatar: '',
        isAdmin: true
      };
    }
  };
})();


// Formbuilder Code

    // Categories UI
    const categoryControllers = {};
    const allSubcategoryKeys = [];
    const $ = window.$ || ((sel, root=document) => root.querySelector(sel));
    const resetCategoriesBtn = $('#resetCategoriesBtn');
    const catsEl = $('#cats');
    const formbuilderCats = document.getElementById('formbuilderCats');
    const formbuilderAddCategoryBtn = document.getElementById('formbuilderAddCategory');
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

    function enableCategoryDrag(menu, header){
      if(!menu || !header) return;
      ensureCategoryDragContainer();
      menu.draggable = false;
      header.draggable = true;
      header.addEventListener('dragstart', event=>{
        const origin = event.target;
        if(!origin || origin.closest('.formbuilder-category-header') !== header){
          event.preventDefault();
          return;
        }
        event.stopPropagation();
        draggedCategoryMenu = menu;
        categoryDropCommitted = false;
        menu.classList.add('is-dragging');
        header.classList.add('is-dragging');
        if(event.dataTransfer){
          event.dataTransfer.effectAllowed = 'move';
          try{ event.dataTransfer.setData('text/plain', menu.dataset.category || ''); }catch(err){}
          try{
            const rect = menu.getBoundingClientRect();
            event.dataTransfer.setDragImage(menu, rect.width / 2, rect.height / 2);
          }catch(err){}
        }
      });
      header.addEventListener('dragend', event=>{
        event.stopPropagation();
        if(draggedCategoryMenu === menu){
          menu.classList.remove('is-dragging');
          header.classList.remove('is-dragging');
          draggedCategoryMenu = null;
        }
        clearCategoryDropIndicator();
        if(!categoryDropCommitted){
          syncCategoriesFromDom();
        }
        categoryDropCommitted = false;
      });
    }

    function enableSubcategoryDrag(subMenu, container, categoryObj, header, addButton){
      if(!subMenu || !container || !header) return;
      const state = setupSubcategoryContainer(container, categoryObj, addButton);
      subMenu.draggable = false;
      header.draggable = true;
      header.addEventListener('dragstart', event=>{
        const origin = event.target;
        if(!origin || origin.closest('.formbuilder-subcategory-header') !== header){
          event.preventDefault();
          return;
        }
        event.stopPropagation();
        draggedSubcategoryMenu = subMenu;
        draggedSubcategoryContainer = container;
        if(state) state.dropCommitted = false;
        subMenu.classList.add('is-dragging');
        header.classList.add('is-dragging');
        if(event.dataTransfer){
          event.dataTransfer.effectAllowed = 'move';
          try{ event.dataTransfer.setData('text/plain', subMenu.dataset.subcategory || ''); }catch(err){}
          try{
            const rect = subMenu.getBoundingClientRect();
            event.dataTransfer.setDragImage(subMenu, rect.width / 2, rect.height / 2);
          }catch(err){}
        }
      });
      header.addEventListener('dragend', event=>{
        event.stopPropagation();
        if(draggedSubcategoryMenu === subMenu){
          subMenu.classList.remove('is-dragging');
          header.classList.remove('is-dragging');
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

    function enableFieldDrag(row, container, fields){
      if(!row || !container) return;
      const state = setupFieldContainer(container, fields);
      row.draggable = true;
      row.addEventListener('dragstart', event=>{
        const origin = event.target;
        if(origin !== row){
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
        if(event.dataTransfer){
          event.dataTransfer.effectAllowed = 'move';
          try{ event.dataTransfer.setData('text/plain', (row.querySelector('.field-name-input')?.value || 'Field')); }catch(err){}
          try{
            const rect = row.getBoundingClientRect();
            event.dataTransfer.setDragImage(row, rect.width / 2, rect.height / 2);
          }catch(err){}
        }
      });
      row.addEventListener('dragend', event=>{
        event.stopPropagation();
        if(draggedFieldRow === row){
          row.classList.remove('is-dragging');
          if(row._header){
            row._header.classList.remove('is-dragging');
          }
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

    function ensureFormbuilderConfirmOverlay(){
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
      title.textContent = 'Delete item?';

      const message = document.createElement('p');
      message.id = 'formbuilderConfirmMessage';
      message.textContent = 'Are you sure you want to delete this item?';

      const actions = document.createElement('div');
      actions.className = 'formbuilder-confirm-actions';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'formbuilder-confirm-cancel';
      cancelBtn.textContent = 'Cancel';

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'formbuilder-confirm-delete';
      deleteBtn.textContent = 'Delete';

      actions.append(cancelBtn, deleteBtn);
      dialog.append(title, message, actions);
      overlay.append(dialog);
      document.body.appendChild(overlay);
      formbuilderConfirmOverlay = overlay;
      return overlay;
    }

    function confirmFormbuilderDeletion(messageText, titleText){
      const overlay = ensureFormbuilderConfirmOverlay();
      const dialog = overlay.querySelector('.formbuilder-confirm-dialog');
      const title = dialog.querySelector('#formbuilderConfirmTitle');
      const message = dialog.querySelector('#formbuilderConfirmMessage');
      const cancelBtn = overlay.querySelector('.formbuilder-confirm-cancel');
      const deleteBtn = overlay.querySelector('.formbuilder-confirm-delete');
      title.textContent = titleText || 'Delete item?';
      message.textContent = messageText || 'Are you sure you want to delete this item?';
      overlay.setAttribute('aria-hidden', 'false');
      overlay.classList.add('visible');
      const previouslyFocused = document.activeElement;

      return new Promise(resolve=>{
        const cleanup = (result)=>{
          overlay.classList.remove('visible');
          overlay.setAttribute('aria-hidden', 'true');
          cancelBtn.removeEventListener('click', onCancel);
          deleteBtn.removeEventListener('click', onConfirm);
          window.removeEventListener('keydown', onKeyDown, true);
          overlay.removeEventListener('click', onOverlayClick);
          if(previouslyFocused && typeof previouslyFocused.focus === 'function'){
            try{
              previouslyFocused.focus({ preventScroll: true });
            }catch(err){
              try{ previouslyFocused.focus(); }catch(e){}
            }
          }
          resolve(result);
        };
        const onCancel = ()=> cleanup(false);
        const onConfirm = ()=> cleanup(true);
        const onOverlayClick = (event)=>{
          if(event.target === overlay){
            cleanup(false);
          }
        };
        const onKeyDown = (event)=>{
          if(event.key === 'Escape'){
            event.preventDefault();
            cleanup(false);
          }
        };

        cancelBtn.addEventListener('click', onCancel, { once: true });
        deleteBtn.addEventListener('click', onConfirm, { once: true });
        overlay.addEventListener('click', onOverlayClick);
        window.addEventListener('keydown', onKeyDown, true);

        requestAnimationFrame(()=>{
          try{
            cancelBtn.focus({ preventScroll: true });
          }catch(err){
            cancelBtn.focus();
          }
        });
      });
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
          img.width = 20;
          img.height = 20;
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
      if(typeof closeSubcategoryFieldOverlay === 'function'){
        closeSubcategoryFieldOverlay();
      }
      closeAllIconPickers();
      const attachIconPicker = (trigger, container, options = {})=>{
        const opts = options || {};
        const getCurrentPath = typeof opts.getCurrentPath === 'function' ? opts.getCurrentPath : (()=> '');
        const onSelect = typeof opts.onSelect === 'function' ? opts.onSelect : (()=>{});
        const label = typeof opts.label === 'string' && opts.label.trim() ? opts.label.trim() : 'Choose Icon';
        const parentMenu = opts.parentMenu || null;
        const parentCategoryMenu = opts.parentCategoryMenu || null;
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

        const openPicker = ()=>{
          if(popup || !ICON_LIBRARY.length) return;
          closeAllIconPickers();
          popup = document.createElement('div');
          popup.className = 'icon-picker-popup';
          popup.setAttribute('role', 'dialog');
          popup.setAttribute('aria-label', label);
          popup.tabIndex = -1;
          popup.style.position = 'absolute';
          const grid = document.createElement('div');
          grid.className = 'icon-picker-grid';
          const currentPath = applyNormalizeIconPath(getCurrentPath());
          const optionsList = [{ value: '', label: 'No Icon' }];
          ICON_LIBRARY.forEach(path => {
            if(typeof path === 'string' && path.trim()){
              optionsList.push({ value: applyNormalizeIconPath(path) });
            }
          });
          optionsList.forEach(entry => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'icon-picker-option';
            const value = entry.value || '';
            if(!value){
              btn.classList.add('icon-picker-option--clear');
              btn.textContent = entry.label || 'No Icon';
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
          });
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
        if(!ICON_LIBRARY.length){
          trigger.disabled = true;
          trigger.setAttribute('aria-disabled','true');
        } else {
          trigger.disabled = false;
          trigger.removeAttribute('aria-disabled');
        }
        return { open: openPicker, close: closePicker };
      };
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
          const normalizedInitial = applyNormalizeIconPath(initialCategoryIconSrc);
          if(normalizedInitial){
            categoryIcons[c.name] = `<img src="${normalizedInitial}" width="20" height="20" alt="">`;
            if(!categoryIconLookup.found){
              writeIconPath(categoryIconPaths, c.id, c.name, normalizedInitial);
            }
          }
          const img = document.createElement('img');
          img.src = applyNormalizeIconPath(initialCategoryIconSrc);
          img.width = 20;
          img.height = 20;
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

        const toggle = document.createElement('label');
        toggle.className = 'switch cat-switch';
        const toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.checked = true;
        toggleInput.setAttribute('aria-label', `Toggle ${c.name} category`);
        const toggleSlider = document.createElement('span');
        toggleSlider.className = 'slider';
        toggle.append(toggleInput, toggleSlider);

        header.append(triggerWrap, toggle);
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
        iconPickerButton.textContent = initialCategoryIconSrc ? 'Change Icon' : 'Choose Icon';

        const preview = document.createElement('div');
        preview.className = 'iconpicker-preview';
        const previewLabel = document.createElement('span');
        previewLabel.textContent = 'No Icon';
        const previewImg = document.createElement('img');
        previewImg.alt = `${c.name} icon preview`;
        preview.append(previewLabel, previewImg);
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
        iconPicker.append(iconPickerButton, preview);
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

        const addSubBtn = document.createElement('button');
        addSubBtn.type = 'button';
        addSubBtn.className = 'add-subcategory-btn';
        addSubBtn.textContent = 'Add Subcategory';
        addSubBtn.setAttribute('aria-label', `Add subcategory to ${c.name}`);

        const deleteCategoryBtn = document.createElement('button');
        deleteCategoryBtn.type = 'button';
        deleteCategoryBtn.className = 'delete-category-btn';
        deleteCategoryBtn.textContent = 'Delete Category';
        deleteCategoryBtn.setAttribute('aria-label', `Delete ${c.name} category`);

        editPanel.append(nameInput, iconPicker, addSubBtn);
        editMenu.append(editPanel);
        const categoryDeleteActions = document.createElement('div');
        categoryDeleteActions.className = 'category-delete-actions';
        categoryDeleteActions.appendChild(deleteCategoryBtn);

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
          const displayName = getCategoryDisplayName();
          categoryLogo.innerHTML = '';
          const normalizedSrc = applyNormalizeIconPath(src);
          if(normalizedSrc){
            const img = document.createElement('img');
            img.src = normalizedSrc;
            img.width = 20;
            img.height = 20;
            img.alt = '';
            categoryLogo.appendChild(img);
            categoryLogo.classList.add('has-icon');
            categoryIcons[currentCategoryName] = `<img src="${normalizedSrc}" width="20" height="20" alt="">`;
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
            iconPickerButton.textContent = 'Change Icon';
          } else {
            previewImg.removeAttribute('src');
            preview.classList.remove('has-image');
            previewLabel.textContent = 'No Icon';
            iconPickerButton.textContent = 'Choose Icon';
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
          menu.remove();
          notifyFormbuilderChange();
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
          if(initialSubIconPath){
            const normalizedInitialSub = applyNormalizeIconPath(initialSubIconPath);
            if(normalizedInitialSub){
              subcategoryIcons[sub] = `<img src="${normalizedInitialSub}" width="20" height="20" alt="">`;
            }
          }
          if(initialSubIconPath){
            const img = document.createElement('img');
            img.src = applyNormalizeIconPath(initialSubIconPath);
            img.width = 20;
            img.height = 20;
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

          const subToggle = document.createElement('label');
          subToggle.className = 'subcategory-form-toggle';
          const subInput = document.createElement('input');
          subInput.type = 'checkbox';
          subInput.checked = true;
          subInput.setAttribute('aria-label', `Toggle ${sub} subcategory`);
          const subSlider = document.createElement('span');
          subSlider.className = 'slider';
          subToggle.append(subInput, subSlider);

          subHeader.append(subTriggerWrap, subToggle);
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
          subIconButton.textContent = initialSubIconPath ? 'Change Icon' : 'Choose Icon';

          const subPreview = document.createElement('div');
          subPreview.className = 'iconpicker-preview';
          const subPreviewLabel = document.createElement('span');
          subPreviewLabel.textContent = 'No Icon';
          const subPreviewImg = document.createElement('img');
          subPreviewImg.alt = `${sub} icon preview`;
          subPreview.append(subPreviewLabel, subPreviewImg);
    

          subIconPicker.append(subIconButton, subPreview);
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
          deleteSubBtn.textContent = 'Delete Subcategory';
          deleteSubBtn.setAttribute('aria-label', `Delete ${sub} subcategory from ${c.name}`);

          const subPlaceholder = document.createElement('p');
          subPlaceholder.className = 'subcategory-form-placeholder';
          subPlaceholder.innerHTML = `Customize the <strong>${sub}</strong> subcategory.`;

          const fieldsSection = document.createElement('div');
          fieldsSection.className = 'subcategory-fields-section';

          const fieldsList = document.createElement('div');
          fieldsList.className = 'subcategory-fields-list';
          fieldsSection.appendChild(fieldsList);

          const addFieldBtn = document.createElement('button');
          addFieldBtn.type = 'button';
          addFieldBtn.className = 'add-field-btn';
          addFieldBtn.textContent = 'Add Field';
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
          }
          if(!window.FORM_FIELD_TYPES.some(opt => opt.value === safeField.type)){
            safeField.type = 'text-box';
          }
            if(!safeField.name){
              const typeLabel = getFormFieldTypeLabel(safeField.type).trim();
              if(typeLabel){
                safeField.name = typeLabel;
              }
            }
            if(typeof safeField.placeholder !== 'string') safeField.placeholder = '';
            if(safeField.type === 'location'){
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
            const requiresByDefault = safeField.type === 'title'
              || safeField.type === 'description'
              || safeField.type === 'images';
            const hasRequiredProp = Object.prototype.hasOwnProperty.call(safeField, 'required');
            safeField.required = hasRequiredProp ? !!safeField.required : requiresByDefault;
            if(!Array.isArray(safeField.options)){
              safeField.options = [];
            }
            if(safeField.type === 'venues_sessions_pricing'){
              safeField.options = normalizeVenueSessionOptions(safeField.options);
            } else if(safeField.type === 'variant_pricing'){
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
              if((safeField.type === 'dropdown' || safeField.type === 'radio-toggle') && safeField.options.length === 0){
                safeField.options.push('', '', '');
              }
            }
            if(safeField.type !== 'venues_sessions_pricing'){
              resetVenueAutofillState(safeField);
            }
            return safeField;
          };

          const buildVenueSessionPreview = (previewField, baseId)=>{
            const editor = document.createElement('div');
            editor.className = 'venue-session-editor';
            editor.setAttribute('aria-required', previewField.required ? 'true' : 'false');
            const venueList = document.createElement('div');
            venueList.className = 'venue-session-venues';
            editor.appendChild(venueList);

            const ensureOptions = ()=>{
              previewField.options = normalizeVenueSessionOptions(previewField.options);
              if(!Array.isArray(previewField.options) || previewField.options.length === 0){
                previewField.options = [venueSessionCreateVenue()];
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
              if(!previewField || !Array.isArray(previewField.options)) return;
              const venue = previewField.options[venueIndex];
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
              if(previewField.options.length <= 1) return;
              const removed = previewField.options.splice(index, 1)[0];
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
              if(previewField.options.length <= 1) return;
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
              previewField.options.forEach((venue, venueIndex)=>{
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
                  }
                  if(placeName){
                    venue.address = placeName;
                    if(geocoderInputRef){
                      geocoderInputRef.value = placeName;
                    }
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
                if(previewField.options.length <= 1){
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
                        notifyFormbuilderChange();
                      }
                    });
                    geocoder.on('results', ()=> setGeocoderActive(true));
                    geocoder.on('result', event => {
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
                  dropdownIndicator.textContent = 'â–¾';
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
                        const seatingInputId = `seating_area-${venueIndex}-${sessionIndex}-${timeIndex}-${versionIndex}`;
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
                          const tierInputId = `pricing_tier-${venueIndex}-${sessionIndex}-${timeIndex}-${versionIndex}-${tierIndex}`;
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
                          const currencySelect = document.createElement('select');
                          currencySelect.className = 'session-currency-select';
                          const emptyOpt = document.createElement('option');
                          emptyOpt.value = '';
                          emptyOpt.textContent = 'Currency';
                          currencySelect.appendChild(emptyOpt);
                          VERSION_PRICE_CURRENCIES.forEach(code => {
                            const opt = document.createElement('option');
                            opt.value = code;
                            opt.textContent = code;
                            currencySelect.appendChild(opt);
                          });
                          const existingCurrency = typeof tier.currency === 'string' ? tier.currency.trim() : '';
                          currencySelect.value = existingCurrency;
                          currencySelect.dataset.venueIndex = String(venueIndex);
                          currencySelect.dataset.sessionIndex = String(sessionIndex);
                          currencySelect.dataset.timeIndex = String(timeIndex);
                          currencySelect.dataset.versionIndex = String(versionIndex);
                          currencySelect.dataset.tierIndex = String(tierIndex);
                          priceRow.appendChild(currencySelect);

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

                          const hasCurrencySelected = ()=> currencySelect.value.trim() !== '';

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

          const ensureDefaultFieldSet = (fieldList)=>{
            if(!Array.isArray(fieldList) || fieldList.length > 0) return false;
            DEFAULT_SUBCATEGORY_FIELDS.forEach(defaultField => {
              fieldList.push({
                name: typeof defaultField.name === 'string' ? defaultField.name : '',
                type: typeof defaultField.type === 'string' ? defaultField.type : 'text-box',
                placeholder: typeof defaultField.placeholder === 'string' ? defaultField.placeholder : '',
                required: !!defaultField.required,
                options: []
              });
            });
            return fieldList.length > 0;
          };

          const fields = Array.isArray(subFieldsMap[sub]) ? subFieldsMap[sub] : (subFieldsMap[sub] = []);

          if(ensureDefaultFieldSet(fields)){
            notifyFormbuilderChange();
          }

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

          fieldsSection.append(formPreviewBtn, formPreviewContainer, addFieldBtn);

          formPreviewBtn.addEventListener('click', ()=>{
            const expanded = formPreviewBtn.getAttribute('aria-expanded') === 'true';
            const nextExpanded = !expanded;
            formPreviewBtn.setAttribute('aria-expanded', String(nextExpanded));
            formPreviewContainer.hidden = !nextExpanded;
            if(nextExpanded){
              renderFormPreview();
            }
          });

          let formPreviewFieldIdCounter = 0;
          function renderFormPreview(){
            formPreviewFields.innerHTML = '';
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
              const labelButton = document.createElement('button');
              labelButton.type = 'button';
              labelButton.className = 'subcategory-form-button';
              labelButton.textContent = labelText;
              labelButton.setAttribute('aria-haspopup', 'dialog');
              labelButton.dataset.previewIndex = String(previewIndex);
              const labelId = `${baseId}-label`;
              labelButton.id = labelId;
              let control = null;
              if(previewField.type === 'text-area' || previewField.type === 'description'){
                const textarea = document.createElement('textarea');
                textarea.rows = 5;
                textarea.readOnly = true;
                textarea.tabIndex = -1;
                textarea.placeholder = previewField.placeholder || '';
                textarea.className = 'form-preview-textarea';
                textarea.style.resize = 'vertical';
                const textareaId = `${baseId}-input`;
                textarea.id = textareaId;
                if(previewField.type === 'description'){
                  textarea.classList.add('form-preview-description');
                }
                control = textarea;
              } else if(previewField.type === 'dropdown'){
                const select = document.createElement('select');
                select.className = 'form-preview-select';
                wrapper.classList.add('form-preview-field--dropdown');
                const options = Array.isArray(previewField.options) ? previewField.options : [];
                if(options.length){
                  options.forEach((optionValue, optionIndex)=>{
                    const option = document.createElement('option');
                    const displayValue = (typeof optionValue === 'string' && optionValue.trim())
                      ? optionValue
                      : `Option ${optionIndex + 1}`;
                    option.value = optionValue;
                    option.textContent = displayValue;
                    select.appendChild(option);
                  });
                } else {
                  const placeholderOption = document.createElement('option');
                  placeholderOption.textContent = 'Select an option';
                  select.appendChild(placeholderOption);
                }
                select.tabIndex = -1;
                const selectId = `${baseId}-input`;
                select.id = selectId;
                control = select;
              } else if(previewField.type === 'radio-toggle'){
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
                    radio.value = optionValue;
                    radio.tabIndex = -1;
                    radio.disabled = true;
                    const displayValue = (typeof optionValue === 'string' && optionValue.trim())
                      ? optionValue
                      : `Option ${optionIndex + 1}`;
                    const radioText = document.createElement('span');
                    radioText.textContent = displayValue;
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
              } else if(previewField.type === 'venues_sessions_pricing'){
                wrapper.classList.add('form-preview-field--venues-sessions-pricing');
                control = buildVenueSessionPreview(previewField, baseId);
              } else if(previewField.type === 'variant_pricing'){
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

                    const currencySelect = document.createElement('select');
                    currencySelect.className = 'variant-pricing-currency';
                    const emptyOption = document.createElement('option');
                    emptyOption.value = '';
                    emptyOption.textContent = 'Currency';
                    currencySelect.appendChild(emptyOption);
                    VERSION_PRICE_CURRENCIES.forEach(code => {
                      const opt = document.createElement('option');
                      opt.value = code;
                      opt.textContent = code;
                      currencySelect.appendChild(opt);
                    });
                    currencySelect.value = optionValue.currency || '';
                    const isCurrencySelected = ()=> currencySelect.value.trim() !== '';

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
                    currencySelect.addEventListener('change', ()=>{
                      const previousCurrency = previewField.options[optionIndex].currency || '';
                      const nextCurrency = currencySelect.value;
                      previewField.options[optionIndex].currency = nextCurrency;
                      const priceCleared = updatePriceState();
                      if(isCurrencySelected()){
                        commitPriceValue();
                      }
                      if(previousCurrency !== nextCurrency || priceCleared){
                        notifyFormbuilderChange();
                      }
                    });

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
                    bottomRow.append(currencySelect, priceInput, actions);

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
                        focusEl = targetRow.querySelector('.variant-pricing-currency');
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
                input.readOnly = true;
                input.tabIndex = -1;
                const inputId = `${baseId}-input`;
                input.id = inputId;
                if(previewField.type === 'title'){
                  input.classList.add('form-preview-title-input');
                }
                control = input;
              }
              if(control){
                if(control instanceof HTMLElement){
                  control.setAttribute('aria-required', previewField.required ? 'true' : 'false');
                  if(labelId){
                    control.setAttribute('aria-labelledby', labelId);
                  }
                }
                labelButton.addEventListener('click', event=>{
                  event.preventDefault();
                  let targetRow = previewField && previewField.__rowEl;
                  if(!targetRow || !targetRow.isConnected){
                    targetRow = Array.from(fieldsList.querySelectorAll('.subcategory-field-row')).find(row => row.__fieldRef === previewField) || targetRow;
                  }
                  if(targetRow && typeof openSubcategoryFieldOverlay === 'function'){
                    openSubcategoryFieldOverlay(targetRow, labelText, event.currentTarget || event.target);
                  }
                });
                if(previewField.required){
                  wrapper.classList.add('form-preview-field--required');
                  labelButton.appendChild(document.createTextNode(' '));
                  const asterisk = document.createElement('span');
                  asterisk.className = 'required-asterisk';
                  asterisk.textContent = '*';
                  labelButton.appendChild(asterisk);
                }
                wrapper.append(labelButton, control);
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

            const fieldHeader = document.createElement('div');
            fieldHeader.className = 'field-row-header';
            row._header = fieldHeader;

            const fieldNameInput = document.createElement('input');
            fieldNameInput.type = 'text';
            fieldNameInput.className = 'field-name-input';
            fieldNameInput.placeholder = 'Field Name';
            fieldNameInput.value = safeField.name;

            const fieldTypeSelect = document.createElement('select');
            fieldTypeSelect.className = 'field-type-select';
            window.FORM_FIELD_TYPES.forEach(optionDef => {
              const option = document.createElement('option');
              option.value = optionDef.value;
              option.textContent = optionDef.label;
              if(optionDef.value === safeField.type){
                option.selected = true;
              }
              fieldTypeSelect.appendChild(option);
            });

            const fieldTypeWrapper = document.createElement('div');
            fieldTypeWrapper.className = 'field-type-select-wrapper';
            const fieldTypeArrow = document.createElement('span');
            fieldTypeArrow.className = 'field-type-select-arrow';
            fieldTypeArrow.setAttribute('aria-hidden', 'true');
            fieldTypeArrow.textContent = 'â–¾';
            fieldTypeWrapper.append(fieldTypeSelect, fieldTypeArrow);

            const fieldPlaceholderInput = document.createElement('input');
            fieldPlaceholderInput.type = 'text';
            fieldPlaceholderInput.className = 'field-placeholder-input';
            fieldPlaceholderInput.placeholder = 'Field Placeholder';
            fieldPlaceholderInput.value = safeField.placeholder;

            const fieldPlaceholderWrapper = document.createElement('div');
            fieldPlaceholderWrapper.className = 'field-placeholder-wrapper';
            fieldPlaceholderWrapper.appendChild(fieldPlaceholderInput);

            const fieldRequiredRow = document.createElement('div');
            fieldRequiredRow.className = 'field-required-row';
            const fieldRequiredLabel = document.createElement('span');
            fieldRequiredLabel.className = 'field-required-label';
            fieldRequiredLabel.textContent = 'Required Field';
            const fieldRequiredOptions = document.createElement('div');
            fieldRequiredOptions.className = 'field-required-options';
            const requiredGroupName = `field-required-${Math.random().toString(36).slice(2)}`;

            const requiredYesLabel = document.createElement('label');
            requiredYesLabel.className = 'field-required-option';
            const requiredYesInput = document.createElement('input');
            requiredYesInput.type = 'radio';
            requiredYesInput.name = requiredGroupName;
            requiredYesInput.value = 'yes';
            requiredYesInput.checked = !!safeField.required;
            const requiredYesText = document.createElement('span');
            requiredYesText.textContent = 'Yes';
            requiredYesLabel.append(requiredYesInput, requiredYesText);

            const requiredNoLabel = document.createElement('label');
            requiredNoLabel.className = 'field-required-option';
            const requiredNoInput = document.createElement('input');
            requiredNoInput.type = 'radio';
            requiredNoInput.name = requiredGroupName;
            requiredNoInput.value = 'no';
            requiredNoInput.checked = !safeField.required;
            const requiredNoText = document.createElement('span');
            requiredNoText.textContent = 'No';
            requiredNoLabel.append(requiredNoInput, requiredNoText);

            const updateRequiredState = (nextRequired)=>{
              const next = !!nextRequired;
              if(next === safeField.required) return;
              safeField.required = next;
              notifyFormbuilderChange();
              renderFormPreview();
            };

            requiredYesInput.addEventListener('change', ()=>{
              if(requiredYesInput.checked){
                updateRequiredState(true);
              }
            });

            requiredNoInput.addEventListener('change', ()=>{
              if(requiredNoInput.checked){
                updateRequiredState(false);
              }
            });

            fieldRequiredOptions.append(requiredYesLabel, requiredNoLabel);
            fieldRequiredRow.append(fieldRequiredLabel, fieldRequiredOptions);

            const dropdownOptionsContainer = document.createElement('div');
            dropdownOptionsContainer.className = 'dropdown-options-editor';
            const dropdownOptionsLabel = document.createElement('div');
            dropdownOptionsLabel.className = 'dropdown-options-label';
            dropdownOptionsLabel.textContent = 'Field Options';
            const dropdownOptionsList = document.createElement('div');
            dropdownOptionsList.className = 'dropdown-options-list';
            dropdownOptionsContainer.append(dropdownOptionsLabel, dropdownOptionsList);

            let draggedOptionRow = null;

            const ensureDropdownSeeds = ()=>{
              if(!Array.isArray(safeField.options)){
                safeField.options = [];
              }
              if((safeField.type === 'dropdown' || safeField.type === 'radio-toggle') && safeField.options.length === 0){
                safeField.options.push('', '', '');
                notifyFormbuilderChange();
              }
            };

            const renderDropdownOptions = (focusIndex = null)=>{
              const isOptionsType = safeField.type === 'dropdown' || safeField.type === 'radio-toggle';
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
                optionInput.placeholder = `Option ${optionIndex + 1}`;
                optionInput.value = optionText;
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
                addOptionBtn.setAttribute('aria-label', `Add option after Option ${optionIndex + 1}`);
                addOptionBtn.addEventListener('click', ()=>{
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
                removeOptionBtn.addEventListener('click', ()=>{
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

            const getDragAfterOption = (mouseY)=>{
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

            const deleteFieldBtn = document.createElement('button');
            deleteFieldBtn.type = 'button';
            deleteFieldBtn.className = 'delete-field-btn';
            deleteFieldBtn.textContent = 'Ã—';

            const updateDeleteFieldAria = ()=>{
              const displayName = fieldNameInput.value.trim() || 'field';
              deleteFieldBtn.setAttribute('aria-label', `Delete ${displayName} field`);
              deleteFieldBtn.setAttribute('title', `Delete ${displayName} field`);
            };

            fieldNameInput.addEventListener('input', ()=>{
              safeField.name = fieldNameInput.value;
              updateDeleteFieldAria();
              notifyFormbuilderChange();
              renderFormPreview();
            });

            fieldTypeSelect.addEventListener('change', ()=>{
              const previousType = safeField.type;
              const previousLabel = getFormFieldTypeLabel(previousType).trim();
              const currentName = fieldNameInput.value.trim();
              const nextType = fieldTypeSelect.value;
              const nextValidType = window.FORM_FIELD_TYPES.some(opt => opt.value === nextType) ? nextType : 'text-box';
              const nextLabel = getFormFieldTypeLabel(nextValidType).trim();
              const shouldAutofillName = !currentName || (previousLabel && currentName === previousLabel);
              safeField.type = nextValidType;
              if(shouldAutofillName && nextLabel){
                safeField.name = nextLabel;
                fieldNameInput.value = nextLabel;
                updateDeleteFieldAria();
              }
              notifyFormbuilderChange();
              updateFieldEditorsByType();
              renderFormPreview();
            });

            fieldPlaceholderInput.addEventListener('input', ()=>{
              safeField.placeholder = fieldPlaceholderInput.value;
              notifyFormbuilderChange();
              renderFormPreview();
            });

          deleteFieldBtn.addEventListener('click', async ()=>{
            const fieldDisplayName = fieldNameInput.value.trim() || 'field';
            const confirmed = await confirmFormbuilderDeletion(`Delete the "${fieldDisplayName}" field?`, 'Delete Field');
            if(!confirmed) return;
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
            notifyFormbuilderChange();
            syncFieldOrderFromDom(fieldsList, fields);
            renderFormPreview();
          });

            updateDeleteFieldAria();

            const updateFieldEditorsByType = ()=>{
              const type = safeField.type;
              const isOptionsType = type === 'dropdown' || type === 'radio-toggle';
              const showVariantPricing = type === 'variant_pricing';
              const showVenueSession = type === 'venues_sessions_pricing';
              const hidePlaceholder = isOptionsType || type === 'images' || showVariantPricing || showVenueSession;
              fieldPlaceholderWrapper.hidden = hidePlaceholder;
              if(type === 'images'){
                if(fieldPlaceholderInput.value){
                  fieldPlaceholderInput.value = '';
                }
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
              } else if(type === 'radio-toggle'){
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
                  if(!fieldPlaceholderInput.value){
                    fieldPlaceholderInput.value = defaultPlaceholder;
                  }
                }
                if(!safeField.location || typeof safeField.location !== 'object'){
                  safeField.location = { address: '', latitude: '', longitude: '' };
                } else {
                  if(typeof safeField.location.address !== 'string') safeField.location.address = '';
                  if(typeof safeField.location.latitude !== 'string') safeField.location.latitude = '';
                  if(typeof safeField.location.longitude !== 'string') safeField.location.longitude = '';
                }
              }
            };

            updateFieldEditorsByType();

            fieldHeader.append(fieldNameInput, deleteFieldBtn);

            row.append(fieldHeader, fieldTypeWrapper, fieldPlaceholderWrapper, fieldRequiredRow, dropdownOptionsContainer);
            row.__fieldRef = safeField;
            safeField.__rowEl = row;
            return {
              row,
              focus(){
                try{
                  fieldNameInput.focus({ preventScroll: true });
                }catch(err){
                  try{ fieldNameInput.focus(); }catch(e){}
                }
              },
              focusTypePicker(){
                const focusSelect = ()=>{
                  try{
                    fieldTypeSelect.focus({ preventScroll: true });
                  }catch(err){
                    try{ fieldTypeSelect.focus(); }catch(e){}
                  }
                };
                focusSelect();
                requestAnimationFrame(()=>{
                  if(typeof fieldTypeSelect.showPicker === 'function'){
                    try{
                      fieldTypeSelect.showPicker();
                      return;
                    }catch(err){}
                  }
                  try{
                    const openEvent = new MouseEvent('mousedown', {
                      bubbles: true,
                      cancelable: true,
                      view: window
                    });
                    fieldTypeSelect.dispatchEvent(openEvent);
                  }catch(err){}
                });
              }
            };
          };

          fields.forEach((existingField, fieldIndex) => {
            const fieldRow = createFieldRow(existingField);
            fieldRow.row.dataset.fieldIndex = String(fieldIndex);
            fieldsList.appendChild(fieldRow.row);
            enableFieldDrag(fieldRow.row, fieldsList, fields);
          });

          addFieldBtn.addEventListener('click', ()=>{
            const newField = ensureFieldDefaults({});
            fields.push(newField);
            const fieldRow = createFieldRow(newField);
            fieldsList.appendChild(fieldRow.row);
            fieldRow.row.dataset.fieldIndex = String(fields.length - 1);
            enableFieldDrag(fieldRow.row, fieldsList, fields);
            notifyFormbuilderChange();
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
              const displayName = getSubDisplayName();
              subLogo.innerHTML = '';
              const normalizedSrc = applyNormalizeIconPath(src);
              if(normalizedSrc){
                const img = document.createElement('img');
                img.src = normalizedSrc;
                img.width = 20;
                img.height = 20;
                img.alt = '';
                subLogo.appendChild(img);
                subLogo.classList.add('has-icon');
                subcategoryIcons[currentSubName] = `<img src="${normalizedSrc}" width="20" height="20" alt="">`;
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
            subIconButton.setAttribute('aria-label', `Choose icon for ${displayName}`);
            subPreviewImg.alt = `${displayName} icon preview`;
            subPlaceholder.innerHTML = `Customize the <strong>${displayName}</strong> subcategory.`;
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
            subMenu.remove();
            delete subFieldsMap[currentSubName];
            notifyFormbuilderChange();
          });

          subContent.append(subNameInput, subIconPicker, subPlaceholder, fieldsSection, deleteSubBtn);

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
          enableSubcategoryDrag(subMenu, subMenusContainer, c, subHeader, addSubAnchor);
        });

        setupSubcategoryContainer(subMenusContainer, c, addSubAnchor);

        addSubBtn.addEventListener('click', ()=>{
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
          c.subs.unshift(candidate);
          c.subIds[candidate] = null;
          subFieldsMap[candidate] = [];
          const categoryIndex = categories.indexOf(c);
          renderFormbuilderCats();
          notifyFormbuilderChange();
          if(!formbuilderCats) return;
          const categorySelector = categoryIndex >= 0 ? `.category-form-menu[data-category-index="${categoryIndex}"]` : null;
          const categoryMenu = categorySelector ? formbuilderCats.querySelector(categorySelector) : null;
          if(!categoryMenu) return;
          categoryMenu.setAttribute('aria-expanded','true');
          const menuTrigger = categoryMenu.querySelector('.filter-category-trigger');
          const content = categoryMenu.querySelector('.category-form-content');
          if(menuTrigger) menuTrigger.setAttribute('aria-expanded','true');
          if(content) content.hidden = false;
          const newSubMenu = categoryMenu.querySelector('.subcategory-form-menu');
          if(!newSubMenu) return;
          newSubMenu.setAttribute('aria-expanded','true');
          const subTrigger = newSubMenu.querySelector('.subcategory-form-trigger');
          const subContent = newSubMenu.querySelector('.subcategory-form-content');
          if(subTrigger) subTrigger.setAttribute('aria-expanded','true');
          if(subContent) subContent.hidden = false;
          const subNameField = newSubMenu.querySelector('.subcategory-name-input');
          if(subNameField){
            requestAnimationFrame(()=>{
              try{ subNameField.focus({ preventScroll: true }); }
              catch(err){
                try{ subNameField.focus(); }catch(e){}
              }
            });
          }
        });

        applyCategoryNameChange();

        content.append(editMenu, subMenusContainer, categoryDeleteActions);
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
        enableCategoryDrag(menu, header);
      });
      formbuilderCats.innerHTML = '';
      formbuilderCats.appendChild(frag);
      refreshFormbuilderSubcategoryLogos();
    };
    if(formbuilderAddCategoryBtn){
      formbuilderAddCategoryBtn.addEventListener('click', ()=>{
        if(!Array.isArray(categories)) return;
        const baseName = 'New Category';
        const existing = new Set(categories.map(cat => (cat && typeof cat.name === 'string') ? cat.name : ''));
        let candidate = baseName;
        let counter = 2;
        while(existing.has(candidate)){
          candidate = `${baseName} ${counter++}`;
        }
        categories.unshift({ name: candidate, subs: [], subFields: {}, sort_order: null });
        renderFormbuilderCats();
        notifyFormbuilderChange();
        const newMenu = formbuilderCats ? formbuilderCats.querySelector('.category-form-menu:first-of-type') : null;
        if(!newMenu) return;
        const menuTrigger = newMenu.querySelector('.filter-category-trigger');
        const content = newMenu.querySelector('.category-form-content');
        const editPanel = newMenu.querySelector('.category-edit-panel');
        const nameField = newMenu.querySelector('.category-name-input');
        newMenu.setAttribute('aria-expanded','true');
        if(menuTrigger) menuTrigger.setAttribute('aria-expanded','true');
        if(content) content.hidden = false;
        if(editPanel) editPanel.hidden = false;
        if(nameField){
          requestAnimationFrame(()=>{
            try{ nameField.focus({ preventScroll: true }); }
            catch(err){
              try{ nameField.focus(); }catch(e){}
            }
          });
        }
      });
    }
    function cloneFieldsMap(source){
      const out = {};
      if(source && typeof source === 'object' && !Array.isArray(source)){
        Object.keys(source).forEach(key => {
          const value = source[key];
          if(Array.isArray(value)){
            out[key] = value.map(field => ({
              name: field && typeof field.name === 'string' ? field.name : '',
              type: field && typeof field.type === 'string' && window.FORM_FIELD_TYPES.some(opt => opt.value === field.type)
                ? field.type
                : 'text-box',
              placeholder: field && typeof field.placeholder === 'string' ? field.placeholder : '',
              required: !!(field && field.required),
              options: Array.isArray(field && field.options)
                ? field.options.map(opt => {
                    if(field && field.type === 'variant_pricing'){
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
                    if(field && field.type === 'venues_sessions_pricing'){
                      return cloneVenueSessionVenue(opt);
                    }
                    if(typeof opt === 'string') return opt;
                    if(opt && typeof opt === 'object' && typeof opt.version === 'string'){
                      return opt.version;
                    }
                    return String(opt ?? '');
                  })
                : []
            }));
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
          sort_order: sortOrder
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
      return {
        categories: cloneCategoryList(window.categories),
        categoryIcons: cloneMapLike(window.categoryIcons || {}),
        subcategoryIcons: cloneMapLike(window.subcategoryIcons || {}),
        categoryIconPaths: cloneMapLike(window.categoryIconPaths || {}),
        subcategoryIconPaths: cloneMapLike(window.subcategoryIconPaths || {}),
        subcategoryMarkers: cloneMapLike(window.subcategoryMarkers || {}),
        subcategoryMarkerIds: cloneMapLike(window.subcategoryMarkerIds || {}),
        categoryShapes: cloneMapLike(window.categoryShapes || {}),
        fieldTypes: Array.isArray(window.FORM_FIELD_TYPES)
          ? window.FORM_FIELD_TYPES.map(option => ({ ...option }))
          : [],
        versionPriceCurrencies: Array.isArray(window.VERSION_PRICE_CURRENCIES)
          ? window.VERSION_PRICE_CURRENCIES.slice()
          : []
      };
    }
    let savedFormbuilderSnapshot = captureFormbuilderSnapshot();
    function restoreFormbuilderSnapshot(snapshot){
      if(!snapshot) return;
      const existingFieldTypes = (() => {
        if(Array.isArray(window.initialFormbuilderSnapshot?.fieldTypes) && window.initialFormbuilderSnapshot.fieldTypes.length){
          return window.initialFormbuilderSnapshot.fieldTypes.map(option => ({ ...option }));
        }
        if(Array.isArray(window.FORM_FIELD_TYPES) && window.FORM_FIELD_TYPES.length){
          return window.FORM_FIELD_TYPES.map(option => ({ ...option }));
        }
        return [];
      })();
      const normalized = normalizeFormbuilderSnapshot(snapshot);
      let sanitizedFieldTypes = sanitizeFieldTypeOptions(normalized.fieldTypes);
      if(sanitizedFieldTypes.length === 0 && existingFieldTypes.length){
        sanitizedFieldTypes = sanitizeFieldTypeOptions(existingFieldTypes);
      }
      window.initialFormbuilderSnapshot.fieldTypes = sanitizedFieldTypes.map(option => ({ ...option }));
      window.FORM_FIELD_TYPES.splice(0, window.FORM_FIELD_TYPES.length, ...window.initialFormbuilderSnapshot.fieldTypes.map(option => ({ ...option })));
      const nextCategories = cloneCategoryList(normalized.categories);
      if(Array.isArray(nextCategories)){
        window.categories.splice(0, window.categories.length, ...nextCategories);
      }
      window.categories.forEach(cat => {
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
      assignMapLike(window.categoryIcons, snapshot.categoryIcons);
      assignMapLike(window.subcategoryIcons, snapshot.subcategoryIcons);
      assignMapLike(window.categoryIconPaths, normalizeIconPathMap(snapshot.categoryIconPaths));
      assignMapLike(window.subcategoryIconPaths, normalizeIconPathMap(snapshot.subcategoryIconPaths));
      const multiIconSrc = window.subcategoryMarkers[MULTI_POST_MARKER_ICON_ID];
      Object.keys(window.subcategoryMarkers).forEach(key => {
        if(key !== MULTI_POST_MARKER_ICON_ID){
          delete window.subcategoryMarkers[key];
        }
      });
      if(multiIconSrc){
        window.subcategoryMarkers[MULTI_POST_MARKER_ICON_ID] = multiIconSrc;
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
            window.subcategoryMarkers[slugKey] = trimmedUrl;
          }
          if(typeof name === 'string' && name){
            window.subcategoryMarkers[name] = trimmedUrl;
          }
        });
      }
      assignMapLike(window.subcategoryMarkerIds, snapshot.subcategoryMarkerIds);
      assignMapLike(window.categoryShapes, snapshot.categoryShapes);
      if(Array.isArray(normalized.versionPriceCurrencies)){
        window.VERSION_PRICE_CURRENCIES.splice(0, window.VERSION_PRICE_CURRENCIES.length, ...normalized.versionPriceCurrencies);
      }
      if(typeof window.renderFilterCategories === 'function') window.renderFilterCategories();
      if(typeof renderFormbuilderCats === 'function') renderFormbuilderCats();
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
