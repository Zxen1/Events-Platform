(function(){
  "use strict";

  // Filter panel UI initialization
  const filterPanel = document.getElementById('filterPanel');
  const filterBtn = document.getElementById('filterBtn');
  
  if(filterBtn && filterPanel){
    filterBtn.addEventListener('click', ()=> togglePanel(filterPanel));
  }

  // Filter panel pin button
  document.querySelectorAll('#filterPanel .pin-panel').forEach(btn=>{
    btn.addEventListener('click', e=>{
      e.stopPropagation();
      const pressed = btn.getAttribute('aria-pressed')==='true';
      btn.setAttribute('aria-pressed', pressed ? 'false' : 'true');
      if(typeof window.adjustBoards === 'function') setTimeout(()=> window.adjustBoards(), 0);
    });
  });

  // Filter panel auto-open on wide screens (called from shared panel init)
  function initFilterPanel(){
    const shouldOpenFilter = window.innerWidth >= 1300 && localStorage.getItem('panel-open-filterPanel') === 'true';
    if(filterPanel && shouldOpenFilter){
      openPanel(filterPanel);
    }
  }

  // Initialize when shared panel code is ready
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initFilterPanel);
  } else {
    setTimeout(initFilterPanel, 0);
  }

  // Expose filter panel reference for shared panel code
  window.filterPanel = filterPanel;
})();
