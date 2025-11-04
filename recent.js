(function(){
  function renderHistoryBoard(){
    if(!recentsBoard) return;
    recentsBoard.innerHTML='';
    const validHistory = window.viewHistory.filter(v => getPostByIdAnywhere(v.id));
    window.viewHistory = validHistory;
    if(typeof saveHistory === 'function') saveHistory();
    const items = window.viewHistory.slice(0,100);
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
    reminderMsg.textContent = 'When you log in as a member, I can remember your recent posts and favourites on any device.';
    reminderWrap.appendChild(reminderMsg);
    recentsBoard.appendChild(reminderWrap);
  }

  window.renderHistoryBoard = renderHistoryBoard;
  
  if(typeof window.viewHistory !== 'undefined'){
    renderHistoryBoard();
  }
})();

