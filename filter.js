(function(){
  const categoryControllers = {};
  const allSubcategoryKeys = [];
  
  function renderFilterCategories(){
    const catsEl = $('#cats');
    if(!catsEl) return;
    catsEl.textContent = '';
    Object.keys(categoryControllers).forEach(key=>{ delete categoryControllers[key]; });
    allSubcategoryKeys.length = 0;
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

  window.renderFilterCategories = renderFilterCategories;
  window.buildFilterCalendar = buildFilterCalendar;
  window.kwMatch = kwMatch;
  window.priceMatch = priceMatch;
  window.dateMatch = dateMatch;
  window.catMatch = catMatch;
  window.applyFilters = applyFilters;
  window.updateFilterCounts = updateFilterCounts;
  window.refreshMarkers = refreshMarkers;
})();

