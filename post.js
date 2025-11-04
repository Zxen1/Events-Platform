(function(){
  function buildDetail(p){
    const wrap = document.createElement('div');
    wrap.className = 'open-post';
    wrap.dataset.id = p.id;
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
    const headerInner = `
          <div class="title-block">
            <div class="title">${p.title}</div>
            <div class="cat-line"><span class="sub-icon">${subcategoryIcons[p.subcategory]||''}</span> ${p.category} &gt; ${p.subcategory}</div>
          </div>
          <button class="share" aria-label="Share post">
            <svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.06-.23.09-.46.09-.7s-.03-.47-.09-.7l7.13-4.17A2.99 2.99 0 0 0 18 9a3 3 0 1 0-3-3c0 .24.03.47.09.7L7.96 10.87A3.003 3.003 0 0 0 6 10a3 3 0 1 0 3 3c0-.24-.03-.47-.09-.7l7.13 4.17c.53-.5 1.23-.81 1.96-.81a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>
          </button>
          <button class="fav" aria-pressed="${p.fav?'true':'false'}" aria-label="Toggle favourite">
            <svg viewBox="0 0 24 24"><path d="M12 17.3 6.2 21l1.6-6.7L2 9.3l6.9-.6L12 2l3.1 6.7 6.9.6-5.8 4.9L17.8 21 12 17.3z"/></svg>
          </button>
        `;
    const posterName = p.member ? p.member.username : 'Anonymous';
    const postedTime = formatPostTimestamp(p.created);
    const postedMeta = postedTime ? `Posted by ${posterName} · ${postedTime}` : `Posted by ${posterName}`;
    wrap.innerHTML = `
        <div class="post-header">
          ${headerInner}
        </div>
        <div class="post-body">
          <div class="post-details">
            <div class="post-venue-selection-container"></div>
            <div class="post-session-selection-container"></div>
            <div class="location-section">
              <div id="venue-${p.id}" class="venue-dropdown options-dropdown"><button class="venue-btn" aria-haspopup="true" aria-expanded="false"><span class="venue-name">${loc0.venue||''}</span><span class="address_line">${loc0.address||''}</span>${locationList.length>1?'<span class="results-arrow" aria-hidden="true"></span>':''}</button><div class="venue-menu post-venue-menu" hidden><div class="map-container"><div id="map-${p.id}" class="post-map"></div></div><div class="venue-options">${locationList.map((loc,i)=>`<button data-index="${i}"><span class="venue-name">${loc.venue}</span><span class="address_line">${loc.address}</span></button>`).join('')}</div></div></div>
              <div id="sess-${p.id}" class="session-dropdown options-dropdown"><button class="sess-btn" aria-haspopup="true" aria-expanded="false">Select Session</button><div class="session-menu options-menu" hidden><div class="calendar-container"><div class="calendar-scroll"><div id="cal-${p.id}" class="post-calendar"></div></div></div><div class="session-options"></div></div></div>
            </div>
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
          </div>
        </div>`;
    wrap.querySelectorAll('.post-header').forEach(head => {
      head.dataset.surfaceBg = CARD_SURFACE;
      head.style.background = CARD_SURFACE;
    });
    wrap.dataset.surfaceBg = CARD_SURFACE;
    wrap.style.background = CARD_SURFACE;
    // progressive hero swap
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
    if(!postSentinel || !postsWideEl.contains(postSentinel)){
      renderLists(filtered);
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
    if(!container) return;

    const alreadyOpen = container.querySelector(`.open-post[data-id="${id}"]`);
    if(alreadyOpen){
      return;
    }

    if(originEl && !container.contains(originEl)){
      originEl = null;
    }
    let target = originEl || container.querySelector(`[data-id="${id}"]`);

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
        const prev = getPostByIdAnywhere(exId);
        if(prev){ ex.replaceWith(card(prev, fromHistory ? false : true)); } else { ex.remove(); }
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
    const pointerInAdBoard = pointerTarget ? pointerTarget.closest('.ad-board, .ad-panel') : null;
    const shouldScrollToCard = fromMap || (!!pointerInAdBoard && !pointerInsideCardContainer) || pointerInsideCardContainer;
    const shouldReorderToTop = !fromMap && ((!!pointerInAdBoard && !pointerInsideCardContainer) || pointerInsideCardContainer);

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

    const detail = buildDetail(p);
    target.replaceWith(detail);
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

    if(fromMap){
      if(typeof window.adjustBoards === 'function'){
        window.adjustBoards();
      }
      if(typeof window.adjustListHeight === 'function'){
        window.adjustListHeight();
      }
    }

    const header = detail.querySelector('.post-header');
    if(header){
      const h = header.offsetHeight;
      header.style.scrollMarginTop = h + 'px';
    }

    if(shouldScrollToCard && container && container.contains(detail)){
      requestAnimationFrame(() => {
        const containerRect = container.getBoundingClientRect();
        const detailRect = detail.getBoundingClientRect();
        if(!containerRect || !detailRect) return;
        const topTarget = container.scrollTop + (detailRect.top - containerRect.top);
        if(typeof container.scrollTo === 'function'){
          container.scrollTo({ top: Math.max(0, topTarget), behavior: 'smooth' });
        } else {
          container.scrollTop = Math.max(0, topTarget);
        }
      });
    }

    // Update history on open (keep newest-first)
    window.viewHistory = window.viewHistory.filter(x=>x.id!==id);
    window.viewHistory.unshift({id:p.id, title:p.title, url:postUrl(p), lastOpened: Date.now()});
    if(window.viewHistory.length>100) window.viewHistory.length=100;
    if(typeof saveHistory === 'function') saveHistory();
    if(!fromHistory){
      if(typeof renderHistoryBoard === 'function') renderHistoryBoard();
    }
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
    if(post){
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

  function renderLists(list){
    if(spinning || !postsLoaded) return;
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
      emptyMsg.textContent = 'There are no posts here. Try moving the map or changing your filter settings.';
      emptyWrap.appendChild(emptyMsg);
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

  function card(p, wide=false){
    const el = document.createElement('article');
    el.className = wide ? 'post-card' : 'recents-card';
    el.dataset.id = p.id;
    if(wide) el.style.gridTemplateColumns='80px 1fr 36px';
    const thumbSrc = thumbUrl(p);
    const thumb = `<img class="thumb lqip" loading="lazy" src="${thumbSrc}" alt="" referrerpolicy="no-referrer" />`;
    el.innerHTML = `
          ${thumb}
        <div class="meta">
          <div class="title">${p.title}</div>
          <div class="info">
            <div class="cat-line"><span class="sub-icon">${subcategoryIcons[p.subcategory]||''}</span> ${p.category} &gt; ${p.subcategory}</div>
            <div class="loc-line"><span class="badge" title="Venue">ðŸ“</span><span>${p.city}</span></div>
            <div class="date-line"><span class="badge" title="Dates">ðŸ“…</span><span>${formatDates(p.dates)}</span></div>
          </div>
        </div>
        <button class="fav" aria-pressed="${p.fav?'true':'false'}" aria-label="Toggle favourite">
          <svg viewBox="0 0 24 24"><path d="M12 17.3 6.2 21l1.6-6.7L2 9.3l6.9-.6L12 2l3.1 6.7 6.9.6-5.8 4.9L17.8 21 12 17.3z"/></svg>
        </button>
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
      if(typeof renderHistoryBoard === 'function') renderHistoryBoard();
    });

    const handleHoverHighlight = (state)=> toggleSmallMapCardHoverHighlight(p.id, state);

    el.addEventListener('mouseenter', ()=> handleHoverHighlight(true));
    el.addEventListener('mouseleave', ()=> handleHoverHighlight(false));
    el.dataset.hoverHighlightBound = '1';
    return el;
  }

  window.buildDetail = buildDetail;
  window.openPost = openPost;
  window.renderLists = renderLists;
  window.card = card;
  window.closeActivePost = closeActivePost;
  window.ensurePostCardForId = ensurePostCardForId;
})();
