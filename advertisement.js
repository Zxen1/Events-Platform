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
        info.textContent = p.title;
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
          Promise.resolve(fn(id)).then(() => {
            requestAnimationFrame(() => {
              const openEl = document.querySelector(`.post-board .open-post[data-id="${id}"]`);
              if(openEl){
                requestAnimationFrame(() => { openEl.scrollIntoView({behavior:'smooth', block:'start'}); });
              }
              document.querySelectorAll('.recents-card[aria-selected="true"]').forEach(el=>el.removeAttribute('aria-selected'));
              const quickCard = document.querySelector(`.recents-board .recents-card[data-id="${id}"]`);
              if(quickCard){
                quickCard.setAttribute('aria-selected','true');
                requestAnimationFrame(() => {
                  quickCard.scrollIntoView({behavior:'smooth', block:'nearest'});
                });
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

    initAdBoard();

