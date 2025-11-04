const memberPanelChangeManager = (()=>{
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

  function stateEquals(a, b){
    const keys = new Set([
      ...Object.keys(a || {}),
      ...Object.keys(b || {})
    ]);
    for(const key of keys){
      if((a && a[key]) !== (b && b[key])){
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
    setDirty(!stateEquals(current, savedState));
  }

  function showStatus(message){
    ensureElements();
    if(!statusMessage) return;
    statusMessage.textContent = message;
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

  function handleSave({ closeAfter } = {}){
    refreshSavedState();
    showStatus('Saved');
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

  function discardChanges({ closeAfter } = {}){
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
    showStatus('Changes Discarded');
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

form.addEventListener('input', formChanged, true);
    form.addEventListener('change', formChanged, true);
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
      refreshSavedState();
    }, 0);
  });

  function isPromptOpen(){
    return !!(prompt && prompt.classList.contains('show'));
  }

  return {
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
    }
  };
})();

