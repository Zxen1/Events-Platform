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

