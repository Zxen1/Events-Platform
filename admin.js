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
  let promptSaveButton = null;
  let promptDiscardButton = null;
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
      promptSaveButton = prompt.querySelector('.confirm-save');
      promptDiscardButton = prompt.querySelector('.confirm-discard');
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

  function closePrompt(){
    if(prompt){
      prompt.classList.remove('show');
      prompt.setAttribute('aria-hidden','true');
    }
  }

  function cancelPrompt(){
    pendingCloseTarget = null;
    closePrompt();
  }

  function openPrompt(target){
    pendingCloseTarget = target;
    if(prompt){
      prompt.classList.add('show');
      prompt.setAttribute('aria-hidden','false');
      setTimeout(()=>{
        if(promptSaveButton) promptSaveButton.focus();
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

window.adminPanelChangeManager = adminPanelChangeManager;




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
window.adminAuthManager = adminAuthManager;



// Extracted from <script>
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#adminPanel input[type="checkbox"]').forEach(cb => {
    if (cb.closest('.switch')) return;
    if (cb.closest('.subcategory-form-toggle')) return;
    const wrapper = document.createElement('label');
    wrapper.className = 'switch';
    cb.parentNode.insertBefore(wrapper, cb);
    wrapper.appendChild(cb);
    const slider = document.createElement('span');
    slider.className = 'slider';
    cb.after(slider);
  });
});




// Extracted from <script>
document.addEventListener('DOMContentLoaded', () => {
  const colorInput = document.getElementById('postModeBgColor');
  const opacityInput = document.getElementById('postModeBgOpacity');
  const opacityVal = document.getElementById('postModeBgOpacityVal');
  const root = document.documentElement;
  const settings = JSON.parse(localStorage.getItem('admin-settings-current') || '{}');
  function hexToRgb(hex){
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `${r},${g},${b}`;
  }

  function apply(){
    const color = colorInput.value || '#000000';
    const opacity = opacityInput.value;
    root.style.setProperty('--post-mode-bg-color', hexToRgb(color));
    root.style.setProperty('--post-mode-bg-opacity', opacity);
    opacityVal.textContent = Number(opacity).toFixed(2);
  }

  if(colorInput && opacityInput && opacityVal){
    colorInput.value = settings.postModeBgColor || '#000000';
    opacityInput.value = settings.postModeBgOpacity ?? 0;
    apply();
    const save = () => {
      settings.postModeBgColor = colorInput.value;
      settings.postModeBgOpacity = opacityInput.value;
      localStorage.setItem('admin-settings-current', JSON.stringify(settings));
    };
    colorInput.addEventListener('input', () => { apply(); save(); });
    opacityInput.addEventListener('input', () => { apply(); save(); });
    const prev = window.saveAdminChanges;
    window.saveAdminChanges = () => {
      save();
      if(typeof prev === 'function'){
        return prev();
      }
      return undefined;
    };
  }
});


