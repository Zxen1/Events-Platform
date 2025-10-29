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
                    if(geocoderRoot){
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
              } else if(previewField.type === 'venue-session-version-tier-price'){
                wrapper.classList.add('form-preview-field--venue-session');
                control = buildVenueSessionPreview(previewField, baseId);
              } else if(previewField.type === 'version-price'){
                wrapper.classList.add('form-preview-field--version-price');
                const editor = document.createElement('div');
                editor.className = 'form-preview-version-price version-price-options-editor';
                const versionList = document.createElement('div');
                versionList.className = 'version-price-options-list';
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
                    optionRow.className = 'version-price-option';
                    optionRow.dataset.optionIndex = String(optionIndex);

                    const topRow = document.createElement('div');
                    topRow.className = 'version-price-row version-price-row--top';

                    const versionInput = document.createElement('input');
                    versionInput.type = 'text';
                    versionInput.className = 'version-price-name';
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
                    bottomRow.className = 'version-price-row version-price-row--bottom';

                    const currencySelect = document.createElement('select');
                    currencySelect.className = 'version-price-currency';
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
                    priceInput.className = 'version-price-price';
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
                    actions.className = 'dropdown-option-actions version-price-option-actions';

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
                      const targetRow = versionList.querySelector(`.version-price-option[data-option-index="${focusIndex}"]`);
                      if(!targetRow) return;
                      let focusEl = null;
                      if(focusTarget === 'price'){
                        focusEl = targetRow.querySelector('.version-price-price');
                      } else if(focusTarget === 'currency'){
                        focusEl = targetRow.querySelector('.version-price-currency');
                      }
                      if(!focusEl){
                        focusEl = targetRow.querySelector('.version-price-name');
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
            FORM_FIELD_TYPES.forEach(optionDef => {
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
            fieldTypeArrow.textContent = '▾';
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
            deleteFieldBtn.textContent = '×';

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
              const nextValidType = FORM_FIELD_TYPES.some(opt => opt.value === nextType) ? nextType : 'text-box';
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
              const showVersionPrice = type === 'version-price';
              const showVenueSession = type === 'venue-session-version-tier-price';
              const hidePlaceholder = isOptionsType || type === 'images' || showVersionPrice || showVenueSession;
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
              } else if(showVersionPrice){
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
              } else if(!showVersionPrice && !showVenueSession){
                dropdownOptionsList.innerHTML = '';
              } else if(showVenueSession){
                dropdownOptionsList.innerHTML = '';
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
              type: field && typeof field.type === 'string' && FORM_FIELD_TYPES.some(opt => opt.value === field.type)
                ? field.type
                : 'text-box',
              placeholder: field && typeof field.placeholder === 'string' ? field.placeholder : '',
              required: !!(field && field.required),
              options: Array.isArray(field && field.options)
                ? field.options.map(opt => {
                    if(field && field.type === 'version-price'){
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
                    if(field && field.type === 'venue-session-version-tier-price'){
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
        categories: cloneCategoryList(categories),
        categoryIcons: cloneMapLike(categoryIcons),
        subcategoryIcons: cloneMapLike(subcategoryIcons),
        categoryIconPaths: cloneMapLike(categoryIconPaths),
        subcategoryIconPaths: cloneMapLike(subcategoryIconPaths),
        subcategoryMarkers: cloneMapLike(subcategoryMarkers),
        subcategoryMarkerIds: cloneMapLike(subcategoryMarkerIds),
        categoryShapes: cloneMapLike(categoryShapes),
        versionPriceCurrencies: Array.isArray(VERSION_PRICE_CURRENCIES)
          ? VERSION_PRICE_CURRENCIES.slice()
          : []
      };
    }
    let savedFormbuilderSnapshot = captureFormbuilderSnapshot();
    function restoreFormbuilderSnapshot(snapshot){
      if(!snapshot) return;
      const normalized = normalizeFormbuilderSnapshot(snapshot);
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
      assignMapLike(categoryIconPaths, normalizeIconPathMap(snapshot.categoryIconPaths));
      assignMapLike(subcategoryIconPaths, normalizeIconPathMap(snapshot.subcategoryIconPaths));
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
      assignMapLike(subcategoryMarkerIds, snapshot.subcategoryMarkerIds);
      assignMapLike(categoryShapes, snapshot.categoryShapes);
      if(Array.isArray(normalized.versionPriceCurrencies)){
        VERSION_PRICE_CURRENCIES.splice(0, VERSION_PRICE_CURRENCIES.length, ...normalized.versionPriceCurrencies);
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
      const activeSubs = selection.subs instanceof Set ? selection.subs.size : 0;
      const anySubOff = totalSubs > 0 && activeSubs < totalSubs;
      resetCategoriesBtn.classList.toggle('active', anyCategoryOff || anySubOff);
    }
    function refreshSubcategoryLogos(){
      Object.values(categoryControllers).forEach(ctrl=>{
        if(ctrl && typeof ctrl.refreshLogos === 'function'){
          ctrl.refreshLogos();
        }
      });
    }
    function renderFilterCategories(){
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
      buildFilterCalendar(today, maxPickerDate);
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
      if(!calendarPopupOpen){
        calendarPopupOpen = true;
        calendarScroll.classList.add('is-visible');
        calendarScroll.setAttribute('tabindex','0');
        calendarScroll.setAttribute('aria-hidden','false');
        if(dateRangeInput) dateRangeInput.setAttribute('aria-expanded','true');
        document.addEventListener('click', handleCalendarOutsideClick, true);
        window.addEventListener('resize', positionCalendarPopup);
        filterPanelBody?.addEventListener('scroll', positionCalendarPopup, { passive:true });
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

    buildFilterCalendar(today, maxPickerDate);
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
        } else {
          input.value='';
        }
        input.focus();
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

      updatePostsButtonState = function(currentZoom){
        const threshold = MARKER_ZOOM_THRESHOLD;
        let zoomValue = Number.isFinite(currentZoom) ? currentZoom : null;
        if(!Number.isFinite(zoomValue) && map && typeof map.getZoom === 'function'){
          try{ zoomValue = map.getZoom(); }catch(err){ zoomValue = null; }
        }
        const postsEnabled = Number.isFinite(zoomValue) ? zoomValue >= threshold : false;
        if(postsButton){
          postsButton.disabled = !postsEnabled;
          postsButton.setAttribute('aria-disabled', postsEnabled ? 'false' : 'true');
          postsButton.classList.toggle('is-disabled', !postsEnabled);
        }
        document.body.classList.toggle('hide-posts-ui', !postsEnabled);
        if(!postsEnabled){
          if(typeof setMode === 'function' && document.body.classList.contains('mode-posts')){
            setMode('map', true);
          }
          document.body.classList.remove('show-history');
          if(typeof adjustBoards === 'function'){ adjustBoards(); }
          if(typeof updateModeToggle === 'function'){ updateModeToggle(); }
        }
      };

      updatePostsButtonState(startZoom);

      function getDefaultBoardDisplay(board){
        if(!board) return 'block';
        if(boardDisplayCache.has(board)) return boardDisplayCache.get(board);
        let value = '';
        try{
          value = getComputedStyle(board).display;
        }catch(err){ value = ''; }
        if(!value || value === 'none'){
          if(board.classList.contains('post-board')) value = 'flex';
          else if(board.classList.contains('ad-board')) value = 'block';
          else value = 'block';
        }
        boardDisplayCache.set(board, value);
        return value;
      }

      function clearBoardHide(board){
        if(!board) return;
        if(board._boardHideHandler){
          board.removeEventListener('transitionend', board._boardHideHandler);
          board._boardHideHandler = null;
        }
        if(board._boardHideTimer){
          clearTimeout(board._boardHideTimer);
          board._boardHideTimer = null;
        }
      }

      function showBoard(board, immediate=false){
        if(!board) return;
        clearBoardHide(board);
        const defaultDisplay = getDefaultBoardDisplay(board);
        board.style.display = defaultDisplay;
        board.setAttribute('aria-hidden','false');
        if(immediate){
          board.classList.add('panel-visible');
          board.style.transform = '';
        } else {
          const wasHidden = !board.classList.contains('panel-visible');
          schedulePanelEntrance(board, wasHidden);
        }
      }

      function hideBoard(board, immediate=false){
        if(!board) return;
        clearBoardHide(board);
        board.setAttribute('aria-hidden','true');
        const finalize = ()=>{
          board.style.display = 'none';
          board._boardHideHandler = null;
          board._boardHideTimer = null;
          try{
            board.style.removeProperty('transform');
          }catch(err){}
        };
        if(immediate){
          board.classList.remove('panel-visible');
          finalize();
          return;
        }
        if(!board.classList.contains('panel-visible')){
          finalize();
          return;
        }
        const handler = event=>{
          if(event && event.target !== board) return;
          board.removeEventListener('transitionend', handler);
          finalize();
        };
        board._boardHideHandler = handler;
        board.addEventListener('transitionend', handler);
        const removeVisible = ()=>{
          if(!board.isConnected){
            board.removeEventListener('transitionend', handler);
            finalize();
            return;
          }
          board.classList.remove('panel-visible');
        };
        if('requestAnimationFrame' in window){
          requestAnimationFrame(removeVisible);
        } else {
          removeVisible();
        }
        board._boardHideTimer = setTimeout(()=>{
          if(board._boardHideHandler){
            board._boardHideHandler();
          }
        }, 400);
      }

      function toggleBoard(board, shouldShow, immediate=false){
        if(shouldShow){
          showBoard(board, immediate);
        } else {
          hideBoard(board, immediate);
        }
      }

      function updateModeToggle(){
        const historyActive = document.body.classList.contains('show-history');
        const isPostsMode = document.body.classList.contains('mode-posts');
        const isMapMode = document.body.classList.contains('mode-map');
        if(recentsButton){
          recentsButton.setAttribute('aria-pressed', historyActive ? 'true' : 'false');
        }
        if(postsButton){
          postsButton.setAttribute('aria-pressed', !historyActive && isPostsMode ? 'true' : 'false');
        }
        if(mapButton){
          mapButton.setAttribute('aria-pressed', isMapMode ? 'true' : 'false');
        }
      }

      function adjustBoards(){
        const small = window.innerWidth < 1200;
        const historyActive = document.body.classList.contains('show-history');
        const isPostsMode = document.body.classList.contains('mode-posts');
        const filterPanel = document.getElementById('filterPanel');
        const filterContent = filterPanel ? filterPanel.querySelector('.panel-content') : null;
        const pinBtn = filterPanel ? filterPanel.querySelector('.pin-panel') : null;
        const filterPinned = !!(filterPanel && filterPanel.classList.contains('show') && pinBtn && pinBtn.getAttribute('aria-pressed') === 'true');
        const historyOpenPost = recentsBoard ? recentsBoard.querySelector('.open-post') : null;
        const postsOpenPost = postBoard ? postBoard.querySelector('.open-post') : null;
        const anyOpenPost = historyOpenPost || postsOpenPost;
        const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap')) || 10;
        let filterWidth = filterPinned && filterContent ? filterContent.getBoundingClientRect().width : 0;
        const postWidth = postBoard ? (postBoard.offsetWidth || 530) : 0;
        const historyWidth = recentsBoard ? (recentsBoard.offsetWidth || 530) : 0;
        const boardsWidths = [];
        if(historyActive && recentsBoard){
          boardsWidths.push(historyWidth);
        } else if(postBoard){
          boardsWidths.push(postWidth);
        }
        let totalBoardsWidth = boardsWidths.reduce((sum, w)=> sum + w, 0);
        if(boardsWidths.length > 1){
          totalBoardsWidth += gap * (boardsWidths.length - 1);
        }
        const adWidth = adBoard ? (adBoard.offsetWidth || 440) : 0;
        const shouldShowAds = adBoard && window.innerWidth >= 1900;
        let hideAds = !shouldShowAds || !isPostsMode;
        let requiredWidth = totalBoardsWidth;
        if(filterPinned && filterWidth){
          requiredWidth += filterWidth;
        } else {
          filterWidth = 0;
        }
        if(shouldShowAds && adWidth){
          requiredWidth += adWidth + gap;
        }
        const canAnchor = filterPinned && filterWidth && requiredWidth <= window.innerWidth;
        document.body.classList.toggle('filter-anchored', canAnchor);
        document.documentElement.style.setProperty('--filter-panel-offset', canAnchor ? `${filterWidth}px` : '0px');
        boardsContainer.style.justifyContent = 'flex-start';
        const skipAnimation = !boardsInitialized;
        toggleBoard(recentsBoard, isPostsMode && historyActive, skipAnimation);
        toggleBoard(postBoard, isPostsMode && !historyActive, skipAnimation);
        document.body.classList.toggle('detail-open', !!anyOpenPost);
        if(adBoard){
          toggleBoard(adBoard, isPostsMode && !hideAds && shouldShowAds, skipAnimation);
        }
        document.body.classList.toggle('hide-ads', hideAds);
        updateModeToggle();
        boardsInitialized = true;
      }
      window.adjustBoards = adjustBoards;
      adjustBoards();
      window.addEventListener('resize', adjustBoards);
      window.adjustListHeight();
        setTimeout(()=>{
          if(map && typeof map.resize === 'function'){
            map.resize();
            updatePostPanel();
            applyFilters();
          }
        }, 0);

      recentsButton && recentsButton.addEventListener('click', ()=>{
        const isPostsMode = document.body.classList.contains('mode-posts');
        const historyActive = document.body.classList.contains('show-history');
        if(isPostsMode && historyActive){
          userClosedPostBoard = true;
          setModeFromUser('map');
          return;
        }
        setMode('posts');
        document.body.classList.add('show-history');
        renderHistoryBoard();
        adjustBoards();
        setTimeout(()=>{
          if(map && typeof map.resize === 'function'){
            map.resize();
            updatePostPanel();
          }
        }, 300);
        updateModeToggle();
      });

      postsButton && postsButton.addEventListener('click', ()=>{
        const historyActive = document.body.classList.contains('show-history');
        const isPostsMode = document.body.classList.contains('mode-posts');
        if(isPostsMode && !historyActive){
          userClosedPostBoard = true;
          setModeFromUser('map');
          return;
        }
        document.body.classList.remove('show-history');
        if(!isPostsMode || historyActive){
          setMode('posts');
          setTimeout(()=>{
            if(map && typeof map.resize === 'function'){
              map.resize();
              updatePostPanel();
            }
          }, 0);
        } else {
          updateModeToggle();
        }
      });

      mapButton && mapButton.addEventListener('click', ()=>{
        const isMapMode = document.body.classList.contains('mode-map');
        if(!isMapMode){
          userClosedPostBoard = true;
          setModeFromUser('map');
        } else if(document.body.classList.contains('show-history')){
          document.body.classList.remove('show-history');
          adjustBoards();
          updateModeToggle();
        }
      });

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
        viewHistory = viewHistory.filter(x=>x.id!==id);
        viewHistory.unshift({id:p.id, title:p.title, url:postUrl(p), lastOpened: Date.now()});
        if(viewHistory.length>100) viewHistory.length=100;
        saveHistory();
        if(!fromHistory){
          renderHistoryBoard();
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

      window.openPost = openPost;
      if(typeof window.__wrapForInputYield === 'function'){
        window.__wrapForInputYield('openPost');
      }

      const resLists = $$('.recents-board');
      resLists.forEach(list=>{
          list.addEventListener('click', (e)=>{
            if(e.target.closest('.fav')) return;
            const cardEl = e.target.closest('.recents-card');
            if(!cardEl) return;
            e.preventDefault();
            const id = cardEl.getAttribute('data-id');
            if(!id) return;
            callWhenDefined('openPost', (fn)=>{
              requestAnimationFrame(() => {
                try{
                  stopSpin();
                  fn(id, true, false, cardEl);
                }catch(err){ console.error(err); }
              });
            });
          }, { capture: true });
        });

      const postsWide = $('.post-board');
      if(postsWide){
        postsWide.addEventListener('click', e=>{
          if(e.target.closest('.fav')) return;
          const cardEl = e.target.closest('.post-card');
          if(cardEl){
            const id = cardEl.getAttribute('data-id');
            if(id){
              e.preventDefault();
              callWhenDefined('openPost', (fn)=>{
                requestAnimationFrame(() => {
                  try{
                    stopSpin();
                    fn(id, false, false, cardEl);
                  }catch(err){ console.error(err); }
                });
              });
            }
            return;
          }
          if(e.target === postsWide && postsWide.querySelector('.open-post')){
            userClosedPostBoard = true;
            setTimeout(()=> setModeFromUser('map'), 0);
          }
        }, { capture:true });
      }

      recentsBoard && recentsBoard.addEventListener('click', e=>{
        if(e.target === recentsBoard){
          userClosedPostBoard = true;
          setModeFromUser('map');
        }
      });

      function setMode(m, skipFilters = false){
        mode = m;
        document.body.classList.remove('mode-map','mode-posts','hide-posts-ui');
        document.body.classList.add('mode-'+m);
        if(m==='map'){
          document.body.classList.remove('show-history');
        }
        if(m === 'map'){
          startMainMapInit();
        }
        const shouldAdjustListHeight = m === 'posts' && typeof window.adjustListHeight === 'function';
        adjustBoards();
        if(shouldAdjustListHeight){
          window.adjustListHeight();
        }
        updateModeToggle();
        if(m === 'posts'){
          userClosedPostBoard = false;
          const boardEl = document.querySelector('.post-board');
          if(boardEl){
            boardEl.style.width = '';
          }
          if(window.adjust){
            window.adjust();
          }
        }
        if(map){
          if(typeof map.resize === 'function'){
            map.resize();
          }
          updatePostPanel();
        }
        if(m==='posts'){
          spinEnabled = false;
          localStorage.setItem('spinGlobe','false');
          stopSpin();
        }
        if(!skipFilters) applyFilters();
      }
    window.setMode = setMode;

      function setModeFromUser(m, skipFilters = false){
        const previous = modeChangeWasUserInitiated;
        modeChangeWasUserInitiated = true;
        try{
          setMode(m, skipFilters);
        } finally {
          modeChangeWasUserInitiated = previous;
        }
      }

    // Mapbox
    let mapboxBundlePromise = null;
    let mapboxBundleReady = false;
    let mainMapInitPromise = null;
    let mapInitTriggered = false;
    let mapInitQueued = false;
    let modeChangeWasUserInitiated = false;

    function loadMapbox(cb){
      const invokeCallback = () => {
        if(typeof cb === 'function'){
          try{ cb(); }catch(err){ console.error(err); }
        }
      };

      if(mapboxBundleReady){
        return Promise.resolve().then(invokeCallback);
      }

      if(!mapboxBundlePromise){
        mapboxBundlePromise = new Promise((resolve, reject) => {
          const mapboxVerRaw = window.MAPBOX_VERSION || 'v3.15.0';
          const mapboxVer = mapboxVerRaw.startsWith('v') ? mapboxVerRaw : `v${mapboxVerRaw}`;
          const mapboxVerNoV = mapboxVer.replace(/^v/, '');
          const cssSources = [
            {
              selector: 'link[href*="mapbox-gl.css"], link[href*="mapbox-gl@"], style[data-mapbox]',
              primary: `https://api.mapbox.com/mapbox-gl-js/${mapboxVer}/mapbox-gl.css`,
              fallback: `https://unpkg.com/mapbox-gl@${mapboxVerNoV}/dist/mapbox-gl.css`
            },
            {
              selector: 'link[href*="mapbox-gl-geocoder.css"], link[href*="mapbox-gl-geocoder@"]',
              primary: 'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.0/mapbox-gl-geocoder.css',
              fallback: 'https://unpkg.com/@mapbox/mapbox-gl-geocoder@5.0.0/dist/mapbox-gl-geocoder.css'
            }
          ];

          let settled = false;

          function fail(error){
            if(settled){
              return;
            }
            settled = true;
            mapboxBundleReady = false;
            mapboxBundlePromise = null;
            reject(error instanceof Error ? error : new Error(error || 'Mapbox bundle failed to load'));
          }

          function finalize(){
            if(settled){
              return;
            }
            Promise.resolve(ensureMapboxCssFor(document.body))
              .catch(()=>{})
              .then(() => {
                if(settled){
                  return;
                }
                if(window && window.mapboxgl){
                  settled = true;
                  mapboxBundleReady = true;
                  resolve();
                } else {
                  fail(new Error('Mapbox GL failed to load'));
                }
              });
          }

          function monitorLink(link, onReady, fallbackUrl){
            if(!link || (link.tagName && link.tagName.toLowerCase() === 'style')){
              onReady();
              return;
            }
            if(fallbackUrl && link.dataset && !link.dataset.fallback){
              link.dataset.fallback = fallbackUrl;
            }

            let settled = false;

            function cleanup(){
              link.removeEventListener('load', handleLoad);
              link.removeEventListener('error', handleError);
            }

            function complete(){
              if(settled){
                return;
              }
              settled = true;
              cleanup();
              onReady();
            }

            function handleLoad(){
              complete();
            }

            function handleError(){
              const attempts = link.dataset && link.dataset.fallbackErrors ? Number(link.dataset.fallbackErrors) : 0;
              const nextAttempts = (Number.isNaN(attempts) ? 0 : attempts) + 1;
              if(link.dataset){
                link.dataset.fallbackErrors = String(nextAttempts);
              }
              const fallback = link.dataset ? link.dataset.fallback : fallbackUrl;
              if(fallback && link.href !== fallback){
                link.href = fallback;
                return;
              }
              if(fallback && nextAttempts === 1){
                return;
              }
              complete();
            }

            function needsListeners(){
              if(!link.sheet){
                return true;
              }
              try {
                void link.sheet.cssRules;
                return false;
              } catch(err){
                if(err && (err.name === 'SecurityError' || err.code === 18)){
                  return false;
                }
                return true;
              }
            }

            if(needsListeners()){
              link.addEventListener('load', handleLoad, {once:true});
              link.addEventListener('error', handleError);
            } else {
              complete();
            }
          }

          function ensureCss(index, onReady){
            const {selector, primary, fallback} = cssSources[index];
            const selectors = selector.split(',').map(s => s.trim());
            for(const sel of selectors){
              const candidate = document.querySelector(sel);
              if(candidate){
                if(candidate.tagName && candidate.tagName.toLowerCase() === 'style'){
                  onReady();
                  return;
                }
                monitorLink(candidate, onReady, fallback);
                return;
              }
            }
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = primary;
            monitorLink(link, onReady, fallback);
            document.head.appendChild(link);
          }

          if(window.mapboxgl && window.MapboxGeocoder){
            let pending = cssSources.length;
            if(pending === 0){
              finalize();
              return;
            }
            const done = () => {
              if(--pending === 0){
                finalize();
              }
            };
            cssSources.forEach((_, i) => ensureCss(i, done));
            return;
          }

          cssSources.forEach((_, i) => ensureCss(i, ()=>{}));
          loadScripts();

          function loadScripts(){
            let successTriggered = false;

            function done(){
              if(successTriggered){
                return;
              }
              successTriggered = true;
              finalize();
            }

            const loadGeocoder = ()=>{
              const g = document.createElement('script');
              g.src='https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.0/mapbox-gl-geocoder.min.js';
              g.async = true;
              g.defer = true;
              g.onload = done;
              g.onerror = ()=>{
                const gf = document.createElement('script');
                gf.src='https://unpkg.com/@mapbox/mapbox-gl-geocoder@5.0.0/dist/mapbox-gl-geocoder.min.js';
                gf.async = true;
                gf.defer = true;
                gf.onload = done;
                gf.onerror = ()=>{
                  fail(new Error('Mapbox Geocoder failed to load'));
                };
                document.head.appendChild(gf);
              };
              document.head.appendChild(g);
            };

            const s = document.createElement('script');
            s.src=`https://api.mapbox.com/mapbox-gl-js/${mapboxVer}/mapbox-gl.js`;
            s.async = true;
            s.defer = true;
            s.onload = loadGeocoder;
            s.onerror = ()=>{
              const sf = document.createElement('script');
              sf.src=`https://unpkg.com/mapbox-gl@${mapboxVerNoV}/dist/mapbox-gl.js`;
              sf.async = true;
              sf.defer = true;
              sf.onload = loadGeocoder;
              sf.onerror = ()=>{
                fail(new Error('Mapbox GL failed to load from fallback source'));
              };
              document.head.appendChild(sf);
            };
            document.head.appendChild(s);
          }
        });
      }

      return mapboxBundlePromise.then(() => {
        invokeCallback();
      });
    }

    function startMainMapInit(){
      if(mainMapInitPromise){
        return mainMapInitPromise;
      }
      mapInitQueued = false;
      if(typeof __notifyMapOnInteraction === 'function'){
        __notifyMapOnInteraction = null;
      }
      mainMapInitPromise = loadMapbox().then(() => {
        if(mapInitTriggered){
          return;
        }
        mapInitTriggered = true;
        return Promise.resolve(initMap()).catch(err => {
          console.error(err);
        });
      }).catch(err => {
        console.error(err);
      });
      return mainMapInitPromise;
    }

    function queueMainMapInitAfterInteraction(){
      if(mainMapInitPromise || mapInitTriggered){
        return;
      }
      if(__userInteractionObserved){
        startMainMapInit();
        return;
      }
      if(mapInitQueued){
        return;
      }
      mapInitQueued = true;
      loadMapbox().catch(err => console.error(err));
      const notify = () => {
        mapInitQueued = false;
        startMainMapInit();
      };
      __notifyMapOnInteraction = notify;
    }

    function addControls(){
      if(typeof MapboxGeocoder === 'undefined'){
        const script = document.createElement('script');
        script.src='https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.0/mapbox-gl-geocoder.min.js';
        script.onload = addControls;
        script.onerror = ()=> console.error('Mapbox Geocoder failed to load');
        document.head.appendChild(script);
        return;
      }
      const cssLink = document.querySelector('style[data-mapbox], link[href*="mapbox-gl.css"], link[href*="mapbox-gl@"]');
      if(!cssLink || !cssLink.sheet){
        setTimeout(addControls, 50);
        return;
      }
      geocoders.length = 0;
      geocoder = null;

      const sets = [
        {geo:'#geocoder-welcome', locate:'#geolocate-welcome', compass:'#compass-welcome'},
        {geo:'#geocoder-map', locate:'#geolocate-map', compass:'#compass-map'},
        {geo:'#geocoder-filter', locate:'#geolocate-filter', compass:'#compass-filter'},
        {geo:'#geocoder-member', locate:'#geolocate-member', compass:'#compass-member'}
      ];
      const cityZoomLevel = 12;

      sets.forEach((sel, idx)=>{
        const geocoderOptions = {
          accessToken: mapboxgl.accessToken,
          mapboxgl,
          placeholder: 'Search venues or places',
          types: 'poi,place,address',
          marker: false,
          limit: 10,
          reverseGeocode: true,
          language: navigator.language,
          proximity: null, // Remove regional bias
          bbox: null,      // Remove viewport limitation
          flyTo: false
        };

        const gc = new MapboxGeocoder(geocoderOptions);
        const gEl = sel && sel.geo ? document.querySelector(sel.geo) : null;
        if(gEl){
          gEl.appendChild(gc.onAdd(map));
        }
        geocoders.push(gc);
        if(idx === 1){
          geocoder = gc;
        }

        const handleGeocoderResult = (result) => {
          if(!map || !result) return;
          closeWelcomeModalIfOpen();

          const toLngLatArray = (value) => {
            if(Array.isArray(value) && value.length >= 2){
              const lng = Number(value[0]);
              const lat = Number(value[1]);
              if(Number.isFinite(lng) && Number.isFinite(lat)){
                return [lng, lat];
              }
            } else if(value && typeof value === 'object'){
              const lng = Number(value.lng);
              const lat = Number(value.lat);
              if(Number.isFinite(lng) && Number.isFinite(lat)){
                return [lng, lat];
              }
            }
            return null;
          };

          const waitForIdle = () => {
            if(!map) return;
            if(typeof map.isMoving === 'function'){
              let moving = false;
              try{
                moving = map.isMoving();
              }catch(err){ moving = false; }
              if(moving){
                requestAnimationFrame(waitForIdle);
                return;
              }
            }
            applyFlight();
          };

          const applyFlight = () => {
            if(!map) return;

            const minZoom = Math.max(cityZoomLevel, MARKER_ZOOM_THRESHOLD + 0.01);
            let maxZoom = 22;
            if(typeof map.getMaxZoom === 'function'){
              try{
                const candidate = map.getMaxZoom();
                if(Number.isFinite(candidate)){
                  maxZoom = candidate;
                }
              }catch(err){}
            }

            let cameraFromBounds = null;
            if(Array.isArray(result?.bbox) && result.bbox.length === 4 && typeof map.cameraForBounds === 'function'){
              const [minLng, minLat, maxLng, maxLat] = result.bbox.map(Number);
              const hasBounds = [minLng, minLat, maxLng, maxLat].every(Number.isFinite);
              if(hasBounds){
                try{
                  cameraFromBounds = map.cameraForBounds([[minLng, minLat], [maxLng, maxLat]], {
                    padding: { top: 60, bottom: 60, left: 60, right: 60 }
                  });
                }catch(err){ cameraFromBounds = null; }
              }
            }

            const currentCenter = (() => {
              if(typeof map.getCenter === 'function'){
                try{
                  const center = map.getCenter();
                  return toLngLatArray(center);
                }catch(err){ return null; }
              }
              return null;
            })();

            let targetCenter = null;
            if(cameraFromBounds?.center){
              targetCenter = toLngLatArray(cameraFromBounds.center);
            }
            if(!targetCenter){
              const geometry = result?.geometry;
              if(geometry && String(geometry.type).toLowerCase() === 'point'){
                targetCenter = toLngLatArray(geometry.coordinates);
              }
            }
            if(!targetCenter){
              targetCenter = toLngLatArray(result?.center);
            }
            if(!targetCenter){
              targetCenter = currentCenter;
            }

            let zoomCandidate = Number(cameraFromBounds?.zoom);
            if(!Number.isFinite(zoomCandidate) && Number.isFinite(result?.zoom)){
              zoomCandidate = result.zoom;
            }
            if(!Number.isFinite(zoomCandidate) && Number.isFinite(result?.properties?.zoom)){
              zoomCandidate = result.properties.zoom;
            }
            if(!Number.isFinite(zoomCandidate)){
              if(typeof map.getZoom === 'function'){
                try{
                  const currentZoom = map.getZoom();
                  if(Number.isFinite(currentZoom)){
                    zoomCandidate = currentZoom;
                  }
                }catch(err){}
              }
            }

            let targetZoom = Number.isFinite(zoomCandidate) ? zoomCandidate : minZoom;
            if(targetZoom < minZoom){
              targetZoom = minZoom;
            }
            if(Number.isFinite(maxZoom) && targetZoom > maxZoom){
              targetZoom = maxZoom;
            }

            const currentBearing = (() => {
              if(typeof map.getBearing === 'function'){
                try{
                  const bearing = map.getBearing();
                  return Number.isFinite(bearing) ? bearing : null;
                }catch(err){ return null; }
              }
              return null;
            })();

            let targetBearing = Number(cameraFromBounds?.bearing);
            if(!Number.isFinite(targetBearing) && Number.isFinite(result?.bearing)){
              targetBearing = result.bearing;
            }
            if(!Number.isFinite(targetBearing) && Number.isFinite(result?.properties?.bearing)){
              targetBearing = result.properties.bearing;
            }
            if(!Number.isFinite(targetBearing)){
              targetBearing = currentBearing;
            }

            const currentPitch = (() => {
              if(typeof map.getPitch === 'function'){
                try{
                  const pitch = map.getPitch();
                  return Number.isFinite(pitch) ? pitch : null;
                }catch(err){ return null; }
              }
              return null;
            })();

            let targetPitch = Number(cameraFromBounds?.pitch);
            if(!Number.isFinite(targetPitch) && Number.isFinite(result?.pitch)){
              targetPitch = result.pitch;
            }
            if(!Number.isFinite(targetPitch) && Number.isFinite(result?.properties?.pitch)){
              targetPitch = result.properties.pitch;
            }
            if(!Number.isFinite(targetPitch)){
              targetPitch = currentPitch;
            }

            const flight = {
              essential: true,
              center: targetCenter || currentCenter || undefined,
              zoom: Number.isFinite(targetZoom) ? targetZoom : minZoom,
              speed: 1.35,
              curve: 1.5,
              easing: t => 1 - Math.pow(1 - t, 3)
            };

            if(Number.isFinite(targetBearing)){
              flight.bearing = targetBearing;
            }
            if(Number.isFinite(targetPitch)){
              flight.pitch = targetPitch;
            }

            try{
              if(typeof map.flyTo === 'function'){
                map.flyTo(flight);
              }
            }catch(err){}
          };

          waitForIdle();
        };
        gc.on('result', event => handleGeocoderResult(event && event.result));

        const geolocateToken = `geolocate:${idx}`;
        let geolocateButton = null;
        let geolocateFallbackTimeout = null;

        const clearGeolocateLoading = () => {
          if(geolocateFallbackTimeout){
            clearTimeout(geolocateFallbackTimeout);
            geolocateFallbackTimeout = null;
          }
          if(mapLoading){
            mapLoading.removeMotion(geolocateToken);
          }
        };

        const ensureGeolocateLoading = () => {
          if(!mapLoading) return;
          mapLoading.addMotion(geolocateToken);
          if(geolocateFallbackTimeout){
            clearTimeout(geolocateFallbackTimeout);
          }
          geolocateFallbackTimeout = setTimeout(() => {
            geolocateFallbackTimeout = null;
            if(mapLoading){
              mapLoading.removeMotion(geolocateToken);
            }
          }, 15000);
        };

        const awaitGeolocateIdle = () => {
          if(!mapLoading){
            clearGeolocateLoading();
            return;
          }
          const finalize = () => {
            clearGeolocateLoading();
          };
          let bound = false;
          if(map && typeof map.once === 'function'){
            try{
              map.once('idle', finalize);
              bound = true;
            }catch(err){
              finalize();
              return;
            }
          }
          if(!bound){
            finalize();
          } else {
            if(geolocateFallbackTimeout){
              clearTimeout(geolocateFallbackTimeout);
            }
            geolocateFallbackTimeout = setTimeout(() => {
              finalize();
            }, 8000);
          }
        };

        const geolocate = new mapboxgl.GeolocateControl({
          positionOptions:{ enableHighAccuracy:true },
          trackUserLocation:false,
          fitBoundsOptions:{ maxZoom: cityZoomLevel }
        });
        geolocate.on('geolocate', (event)=>{
          ensureGeolocateLoading();
          spinEnabled = false; localStorage.setItem('spinGlobe','false'); stopSpin();
          closeWelcomeModalIfOpen();
          if(mode!=='map') setModeFromUser('map');
          if(event && event.coords){
            setAllGeocoderProximity(event.coords.longitude, event.coords.latitude);
          }
          if(map && typeof map.easeTo === 'function' && event && event.coords){
            let targetZoom = cityZoomLevel;
            if(typeof map.getMaxZoom === 'function'){
              try{
                const maxZoom = map.getMaxZoom();
                if(typeof maxZoom === 'number' && maxZoom < targetZoom){
                  targetZoom = maxZoom;
                }
              }catch(err){}
            }
            const currentZoom = (typeof map.getZoom === 'function') ? map.getZoom() : null;
            const needsZoomAdjust = !Number.isFinite(currentZoom) || Math.abs(currentZoom - targetZoom) > 0.05;
            const center = [event.coords.longitude, event.coords.latitude];
            if(needsZoomAdjust){
              let currentPitch = null;
              try{
                currentPitch = typeof map.getPitch === 'function' ? map.getPitch() : null;
              }catch(err){
                currentPitch = null;
              }
              const options = { center, zoom: targetZoom, duration: 800, essential: true };
              if(Number.isFinite(currentPitch)){
                options.pitch = currentPitch;
              }
              try{
                map.easeTo(options);
              }catch(err){}
            }
          }
          awaitGeolocateIdle();
        });
        geolocate.on('error', () => {
          clearGeolocateLoading();
        });
        const geoHolder = sel && sel.locate ? document.querySelector(sel.locate) : null;
        if(geoHolder){
          const controlEl = geolocate.onAdd(map);
          geoHolder.appendChild(controlEl);
          if(controlEl){
            geolocateButton = controlEl.querySelector('button');
            if(geolocateButton){
              const handlePress = (evt) => {
                if(evt && evt.type === 'keydown'){
                  const key = evt.key || evt.code;
                  if(!key) return;
                  if(key !== 'Enter' && key !== ' ' && key !== 'Spacebar'){ return; }
                }
                ensureGeolocateLoading();
              };
              geolocateButton.addEventListener('click', handlePress, { passive: true });
              geolocateButton.addEventListener('keydown', handlePress);
            }
          }
        }
        const nav = new mapboxgl.NavigationControl({showZoom:false, visualizePitch:true});
        const compassHolder = sel && sel.compass ? document.querySelector(sel.compass) : null;
        if(compassHolder) compassHolder.appendChild(nav.onAdd(map));
      });

      syncGeocoderProximityToMap();
    }

    async function initMap(){
      if(typeof mapboxgl === 'undefined'){
        console.error('Mapbox GL failed to load');
        return;
      }
      try{
        await ensureMapboxCssFor(document.body);
      }catch(err){}
          mapboxgl.accessToken = MAPBOX_TOKEN;
        if(typeof mapboxgl.setLogLevel === 'function'){
          mapboxgl.setLogLevel('error');
        }
        map = new mapboxgl.Map({
          container:'map',
          style:'mapbox://styles/mapbox/standard',
          projection:'globe',
          center: startCenter,
          zoom: startZoom,
          pitch: startPitch,
          bearing: startBearing,
          attributionControl:true
        });
        try{ ensurePlaceholderSprites(map); }catch(err){}
        const zoomIndicatorEl = document.getElementById('mapZoomIndicator');
        const updateZoomIndicator = () => {
          if(!map || !zoomIndicatorEl || typeof map.getZoom !== 'function') return;
          try{
            const zoomLevel = map.getZoom();
            const pitchLevel = typeof map.getPitch === 'function' ? map.getPitch() : NaN;
            if(Number.isFinite(zoomLevel)){
              const zoomText = `Zoom ${zoomLevel.toFixed(2)}`;
              if(Number.isFinite(pitchLevel)){
                zoomIndicatorEl.textContent = `${zoomText} • Pitch ${Math.round(pitchLevel)}°`;
              } else {
                zoomIndicatorEl.textContent = zoomText;
              }
            } else {
              zoomIndicatorEl.textContent = 'Zoom -- • Pitch --';
            }
          }catch(err){}
        };
        if(zoomIndicatorEl){
          ['zoom','zoomend','pitch','pitchend'].forEach(evt => {
            try{ map.on(evt, updateZoomIndicator); }catch(err){}
          });
          map.once('load', updateZoomIndicator);
          updateZoomIndicator();
        }

        let recentMapInteraction = false;
        let recentInteractionTimeout = null;
        const markRecentInteraction = () => {
          recentMapInteraction = true;
          if(recentInteractionTimeout){
            clearTimeout(recentInteractionTimeout);
          }
          recentInteractionTimeout = setTimeout(() => {
            recentMapInteraction = false;
            recentInteractionTimeout = null;
          }, 1200);
        };

        const mapCanvasContainer = (typeof map.getCanvasContainer === 'function') ? map.getCanvasContainer() : null;
        if(mapCanvasContainer){
          ['mousedown','touchstart','wheel','pointerdown'].forEach(evtName => {
            try{
              mapCanvasContainer.addEventListener(evtName, markRecentInteraction, { passive: true });
            }catch(err){}
          });
          try{
            map.on('remove', () => {
              if(recentInteractionTimeout){
                clearTimeout(recentInteractionTimeout);
                recentInteractionTimeout = null;
              }
              ['mousedown','touchstart','wheel','pointerdown'].forEach(evtName => {
                try{ mapCanvasContainer.removeEventListener(evtName, markRecentInteraction, false); }catch(err){}
              });
            });
          }catch(err){}
        }

        const handleWelcomeOnMapMotion = (evt) => {
          if(evt && evt.originalEvent){
            closeWelcomeModalIfOpen();
            return;
          }
          if(recentMapInteraction){
            closeWelcomeModalIfOpen();
          }
        };

        ['movestart','dragstart','zoomstart','rotatestart','pitchstart','boxzoomstart'].forEach(evtName => {
          try{ map.on(evtName, handleWelcomeOnMapMotion); }catch(err){}
        });
// === Pill hooks (safe) ===
try { if (typeof __addOrReplacePill150x40 === 'function') __addOrReplacePill150x40(map); } catch(e){}
if (!map.__pillHooksInstalled) {
  try { map.on('style.load', () => __addOrReplacePill150x40(map)); } catch(e){}
  try { map.on('styleimagemissing', (evt) => { if (evt && evt.id === 'marker-label-bg') __addOrReplacePill150x40(map); }); } catch(e){}
  map.__pillHooksInstalled = true;
}
        try{ map.on('style.load', () => { try{ reapplyMarkerLabelComposites(map); }catch(err){} }); }catch(err){}

        const applyStyleAdjustments = () => {
          try{ ensurePlaceholderSprites(map); }catch(err){}
          applyNightSky(map);
          patchMapboxStyleArtifacts(map);
        };
        whenStyleReady(map, applyStyleAdjustments);
        map.on('style.load', applyStyleAdjustments);
        map.on('styledata', () => {
          try{ ensurePlaceholderSprites(map); }catch(err){}
          if(map.isStyleLoaded && map.isStyleLoaded()){
            patchMapboxStyleArtifacts(map);
          }
        });
        ensureMapIcon = attachIconLoader(map);
        const pendingStyleImageRequests = new Map();
        const handleStyleImageMissing = (evt) => {
          const imageId = evt && evt.id;
          if(!imageId){
            return;
          }
          try{
            if(map.hasImage?.(imageId)){
              return;
            }
          }catch(err){
            console.error(err);
          }
          if(pendingStyleImageRequests.has(imageId)){
            return;
          }
          const result = generateMarkerImageFromId(imageId, map, { ensureIcon: ensureMapIcon });
          if(result && typeof result.then === 'function'){
            const task = result.then(output => {
              if(!output){
                return;
              }
              const { image, options } = output;
              if(!image){
                return;
              }
              try{
                if(map.hasImage?.(imageId)){
                  return;
                }
                map.addImage(imageId, image, options || {});
              }catch(error){
                console.error(error);
              }
            }).catch(error => {
              console.error(error);
            }).finally(() => {
              pendingStyleImageRequests.delete(imageId);
            });
            pendingStyleImageRequests.set(imageId, task);
            return;
          }
          if(result && result.image){
            try{
              if(!map.hasImage?.(imageId)){
                map.addImage(imageId, result.image, result.options || {});
              }
            }catch(error){
              console.error(error);
            }
          }
        };
        try{ map.on('styleimagemissing', handleStyleImageMissing); }
        catch(err){ console.error(err); }
        const mapLoading = (() => {
          const loader = window.__logoLoading;
          if(!loader || typeof loader.begin !== 'function' || typeof loader.end !== 'function'){
            return null;
          }
          const overlay = document.getElementById('headerLoadingOverlay');
          const motionTokens = new Set();
          let tilesPending = false;
          let active = false;

          const isMapMovingNow = () => {
            if(!map) return false;
            try{
              if(typeof map.isMoving === 'function' && map.isMoving()) return true;
              if(typeof map.isZooming === 'function' && map.isZooming()) return true;
              if(typeof map.isRotating === 'function' && map.isRotating()) return true;
              if(typeof map.isEasing === 'function' && map.isEasing()) return true;
            }catch(err){}
            return false;
          };

          const apply = (forceStop = false) => {
            const busy = !forceStop && (tilesPending || motionTokens.size > 0 || isMapMovingNow());
            if(busy){
              if(overlay){
                overlay.classList.remove('is-hidden');
                overlay.setAttribute('aria-hidden', 'false');
              }
              if(!active){
                active = true;
                try{ loader.begin('map'); }catch(err){}
              }
            } else {
              if(overlay){
                overlay.classList.add('is-hidden');
                overlay.setAttribute('aria-hidden', 'true');
              }
              if(active){
                active = false;
                try{ loader.end('map'); }catch(err){}
              }
            }
          };

          return {
            apply,
            setTiles(pending){
              if(tilesPending === pending) return;
              tilesPending = pending;
              apply();
            },
            addMotion(token){
              if(motionTokens.has(token)) return;
              motionTokens.add(token);
              apply();
            },
            removeMotion(token){
              if(!motionTokens.has(token)) return;
              motionTokens.delete(token);
              apply();
            },
            clearAll(){
              motionTokens.clear();
              tilesPending = false;
              if(overlay){
                overlay.classList.add('is-hidden');
                overlay.setAttribute('aria-hidden', 'true');
              }
              if(active){
                active = false;
                try{ loader.end('map'); }catch(err){}
              }
            }
          };
        })();

        if(mapLoading){
          const updateRenderState = () => {
            let tileBusy = false;
            if(map){
              try{
                if(typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded()){
                  tileBusy = true;
                } else if(typeof map.areTilesLoaded === 'function'){
                  tileBusy = !map.areTilesLoaded();
                }
              }catch(err){
                tileBusy = true;
              }
            }
            mapLoading.setTiles(tileBusy);
            mapLoading.apply();
          };

          map.on('sourcedataloading', () => mapLoading.setTiles(true));
          map.on('render', updateRenderState);
          map.on('idle', () => {
            mapLoading.setTiles(false);
            mapLoading.apply();
          });

          ['move','zoom','rotate','pitch','drag'].forEach(evt => {
            const startEv = `${evt}start`;
            const endEv = `${evt}end`;
            map.on(startEv, () => mapLoading.addMotion(evt));
            map.on(endEv, () => mapLoading.removeMotion(evt));
          });
          ['moveend','zoomend','rotateend','pitchend','dragend'].forEach(evt => {
            map.on(evt, () => mapLoading.apply());
          });
          map.on('remove', () => mapLoading.clearAll());
        }
      map.on('zoomstart', ()=>{
        if(waitForInitialZoom){
          initialZoomStarted = true;
        }
      });
      map.on('zoom', (e)=>{
        const zoomValue = getZoomFromEvent(e);
        if(waitForInitialZoom){
          if(!initialZoomStarted){
            updateZoomState(zoomValue);
            return;
          }
          waitForInitialZoom = false;
          window.waitForInitialZoom = waitForInitialZoom;
          initialZoomStarted = false;
        }
        updateZoomState(zoomValue);
        scheduleCheckLoadPosts({ zoom: zoomValue, target: map });
      });
      map.on('zoomend', ()=>{
        if(markersLoaded) return;
        if(!map || typeof map.getZoom !== 'function') return;
        let currentZoom = NaN;
        try{ currentZoom = map.getZoom(); }catch(err){ currentZoom = NaN; }
        if(!Number.isFinite(currentZoom) || currentZoom < MARKER_PRELOAD_ZOOM){
          return;
        }
        try{ loadPostMarkers(); }catch(err){ console.error(err); }
        markersLoaded = true;
        window.__markersLoaded = true;
      });
      map.on('moveend', ()=>{
        syncGeocoderProximityToMap();
        scheduleCheckLoadPosts({ zoom: lastKnownZoom, target: map });
      });
      addControls();
      try{
        map.scrollZoom.setWheelZoomRate(1/240);
        map.scrollZoom.setZoomRate(1/240);
      }catch(e){}
      map.on('load', ()=>{
        setupSeedLayers(map);
        applyNightSky(map);
        $$('.map-overlay').forEach(el=>el.remove());
        if(spinEnabled){
          startSpin(true);
        }
        updatePostPanel();
        applyFilters();
        updateZoomState(getZoomFromEvent());
        if(!markersLoaded){
          const zoomLevel = Number.isFinite(lastKnownZoom) ? lastKnownZoom : getZoomFromEvent();
          if(Number.isFinite(zoomLevel) && zoomLevel >= MARKER_PRELOAD_ZOOM){
            try{ loadPostMarkers(); }catch(err){ console.error(err); }
            markersLoaded = true;
            window.__markersLoaded = true;
          }
        }
        checkLoadPosts();
      });

      map.on('style.load', ()=>{
        setupSeedLayers(map);
        updateLayerVisibility(lastKnownZoom);
      });

        ['mousedown','wheel','touchstart','dragstart','pitchstart','rotatestart','zoomstart'].forEach(ev=> map.on(ev, haltSpin));
        let suppressNextRefresh = false;
        const refreshMapView = () => {
          if(suppressNextRefresh) return;
          scheduleCheckLoadPosts({ zoom: lastKnownZoom, target: map });
          updatePostPanel();
          updateFilterCounts();
          refreshMarkers();
          refreshInViewMarkerLabelComposites(map);
          const center = map.getCenter().toArray();
          const zoom = map.getZoom();
          const pitch = map.getPitch();
          const bearing = map.getBearing();
          updateBalloonSourceForZoom(zoom);
          localStorage.setItem('mapView', JSON.stringify({center, zoom, pitch, bearing}));
        };
        ['moveend','zoomend','rotateend','pitchend'].forEach(ev => map.on(ev, refreshMapView));
        map.on('dragend', clearMapGeocoder);
        map.on('click', clearMapGeocoder);
        map.on('touchstart', () => requestAnimationFrame(blurAllGeocoderInputs));
      }

    function startSpin(fromCurrent=false){
      if(mode!=='map') setModeFromUser('map');
      if(!spinEnabled || spinning || !map) return;
      if(map.getZoom() >= 3) return;
      if(typeof filterPanel !== 'undefined' && filterPanel) closePanel(filterPanel);
      spinning = true;
      hideResultIndicators();
      historyWasActive = document.body.classList.contains('show-history');
      if(historyWasActive){
        document.body.classList.remove('show-history');
        adjustBoards();
        updateModeToggle();
      }
      function step(){
        if(!spinning || !map) return;
        const isBusy = (map.isMoving && map.isMoving()) || (map.areTilesLoaded && !map.areTilesLoaded());
        if(isBusy){
          requestAnimationFrame(step);
          return;
        }
        const c = map.getCenter();
        map.setCenter([c.lng + spinSpeed, c.lat]);
        requestAnimationFrame(step);
      }
      if(fromCurrent){
        requestAnimationFrame(step);
      }else{
        const targetPitch = Number.isFinite(startPitch) ? startPitch : LEGACY_DEFAULT_PITCH;
        map.easeTo({center:[0,0], zoom:startZoom, pitch:targetPitch, essential:true});
        map.once('moveend', () => requestAnimationFrame(step));
      }
    }
    function stopSpin(){
      spinning = false;
      const wasHistory = historyWasActive;
      historyWasActive = false;
      if(wasHistory){
        document.body.classList.add('show-history');
        adjustBoards();
        updateModeToggle();
      }
      const shouldLoadPosts = pendingPostLoad;
      pendingPostLoad = false;
      if(shouldLoadPosts){
        scheduleCheckLoadPosts({ zoom: lastKnownZoom, target: map });
        return;
      }
      applyFilters();
    }

    function haltSpin(e){
      const target = (e && e.originalEvent && e.originalEvent.target) || (e && e.target);
      if(target instanceof Node && logoEls.some(el=>el.contains(target))) return;
      if(spinEnabled || spinning){
        spinEnabled = false;
        localStorage.setItem('spinGlobe','false');
        stopSpin();
      }
    }

    ['pointerdown','wheel','keydown','touchstart'].forEach(ev=>
      document.addEventListener(ev, haltSpin, {capture:true})
    );

    function updateSpinState(){
      const shouldSpin = spinLoadStart && (spinLoadType === 'all' || (spinLoadType === 'new' && firstVisit));
      if(shouldSpin !== spinEnabled){
        spinEnabled = shouldSpin;
        localStorage.setItem('spinGlobe', JSON.stringify(spinEnabled));
        if(spinEnabled) startSpin(); else stopSpin();
      }
    }

    window.spinGlobals = {
      get spinEnabled(){ return spinEnabled; },
      set spinEnabled(v){ spinEnabled = v; },
      get spinLoadStart(){ return spinLoadStart; },
      set spinLoadStart(v){ spinLoadStart = v; },
      get spinLoadType(){ return spinLoadType; },
      set spinLoadType(v){ spinLoadType = v; },
      get spinLogoClick(){ return spinLogoClick; },
      set spinLogoClick(v){ spinLogoClick = v; updateLogoClickState(); },
      startSpin,
      stopSpin,
      updateSpinState,
      updateLogoClickState
    };

    // Map layers
    function collectLocationEntries(post){
      const entries = [];
      const locs = Array.isArray(post?.locations) ? post.locations : [];
      locs.forEach((loc, idx) => {
        if(!loc) return;
        const lng = Number(loc.lng);
        const lat = Number(loc.lat);
        if(!Number.isFinite(lng) || !Number.isFinite(lat)) return;
        entries.push({
          post,
          loc,
          lng,
          lat,
          index: idx,
          key: venueKey(lng, lat)
        });
      });
      if(!entries.length && Number.isFinite(post?.lng) && Number.isFinite(post?.lat)){
        const fallbackVenue = typeof post?.venue === 'string' && post.venue
          ? post.venue
          : (post?.city || '');
        entries.push({
          post,
          loc:{
            venue: fallbackVenue,
            address: post?.city || '',
            lng: post.lng,
            lat: post.lat
          },
          lng: post.lng,
          lat: post.lat,
          index: 0,
          key: venueKey(post.lng, post.lat)
        });
      }
      return entries.filter(entry => entry.key);
    }

    function postsToGeoJSON(list){
      const features = [];
      if(!Array.isArray(list) || !list.length){
        return { type:'FeatureCollection', features };
      }

      const venueGroups = new Map();
      const orphanEntries = [];

      list.forEach(p => {
        if(!p) return;
        const entries = collectLocationEntries(p);
        entries.forEach(entry => {
          if(!entry) return;
          const key = entry.key;
          const post = entry.post || p;
          if(!key){
            orphanEntries.push({ post, entry });
            return;
          }
          let group = venueGroups.get(key);
          if(!group){
            group = { key, entries: [], postIds: new Set() };
            venueGroups.set(key, group);
          }
          group.entries.push({ post, entry });
          if(post && post.id !== undefined && post.id !== null){
            const strId = String(post.id);
            if(strId) group.postIds.add(strId);
          }
        });
      });

      const buildSingleFeature = ({ post, entry }) => {
        if(!post || !entry) return null;
        const key = entry.key || '';
        const baseSub = subcategoryMarkerIds[post.subcategory] || slugify(post.subcategory);
        const labelLines = getMarkerLabelLines(post);
        const combinedLabel = buildMarkerLabelText(post, labelLines);
        const spriteSource = [baseSub || '', labelLines.line1 || '', labelLines.line2 || ''].join('|');
        const labelSpriteId = hashString(spriteSource);
        const featureId = key
          ? `post:${post.id}::${key}::${entry.index}`
          : `post:${post.id}::${entry.index}`;
        const venueName = entry.loc && entry.loc.venue ? entry.loc.venue : getPrimaryVenueName(post);
        return {
          type:'Feature',
          id: featureId,
          properties:{
            id: post.id,
            featureId,
            title: post.title,
            label: combinedLabel,
            labelLine1: labelLines.line1,
            labelLine2: labelLines.line2,
            labelSpriteId,
            venueName,
            city: post.city,
            cat: post.category,
            sub: baseSub,
            baseSub,
            venueKey: key,
            locationIndex: entry.index,
            isMultiVenue: false
          },
          geometry:{ type:'Point', coordinates:[entry.lng, entry.lat] }
        };
      };

      const buildMultiFeature = (group) => {
        if(!group || !group.entries.length) return null;
        const multiCount = group.postIds.size;
        if(multiCount <= 1){
          return group.entries.map(buildSingleFeature).filter(Boolean);
        }
        const primary = group.entries[0];
        if(!primary || !primary.post || !primary.entry) return null;
        const { post, entry } = primary;
        const baseSub = subcategoryMarkerIds[post.subcategory] || slugify(post.subcategory);
        const multiIconId = MULTI_POST_MARKER_ICON_ID;
        const venueName = (() => {
          for(const item of group.entries){
            const candidate = item && item.entry && item.entry.loc && item.entry.loc.venue;
            if(candidate){
              return candidate;
            }
          }
          return getPrimaryVenueName(post);
        })() || '';
        const multiCountLabel = `${multiCount} posts here`;
        const multiVenueText = shortenMarkerLabelText(venueName, markerLabelTextAreaWidthPx);
        const combinedLabel = multiVenueText ? `${multiCountLabel}\n${multiVenueText}` : multiCountLabel;
        const spriteSource = ['multi', multiIconId || '', baseSub || '', multiCountLabel, multiVenueText || ''].join('|');
        const labelSpriteId = hashString(spriteSource);
        const featureId = `venue:${group.key}::${post.id}`;
        const coordinates = [entry.lng, entry.lat];
        const multiIds = Array.from(group.postIds);
        return [{
          type:'Feature',
          id: featureId,
          properties:{
            id: post.id,
            featureId,
            title: multiCountLabel,
            label: combinedLabel,
            labelLine1: multiCountLabel,
            labelLine2: multiVenueText,
            labelSpriteId,
            venueName,
            city: post.city,
            cat: post.category,
            sub: multiIconId,
            baseSub,
            venueKey: group.key,
            locationIndex: entry.index,
            isMultiVenue: true,
            multiCount,
            multiPostIds: multiIds
          },
          geometry:{ type:'Point', coordinates }
        }];
      };

      venueGroups.forEach(group => {
        const result = buildMultiFeature(group);
        if(Array.isArray(result)){
          result.forEach(feature => { if(feature) features.push(feature); });
        }
      });

      orphanEntries.forEach(item => {
        const feature = buildSingleFeature(item);
        if(feature) features.push(feature);
      });

      return {
        type:'FeatureCollection',
        features
      };
    }



    let addingPostSource = false;
    let pendingAddPostSource = false;

    function loadPostMarkers(){
      try{
        addPostSource();
      }catch(err){
        console.error('loadPostMarkers failed', err);
      }
    }

    async function addPostSource(){
      if(!map){
        return;
      }
      if(addingPostSource){
        pendingAddPostSource = true;
        return;
      }
      addingPostSource = true;
      if(map && Number.isFinite(lastKnownZoom) && lastKnownZoom >= MARKER_SPRITE_ZOOM){
        map.__retainAllMarkerSprites = true;
      }
      try{
      const markerList = filtersInitialized && Array.isArray(filtered) ? filtered : posts;
      const collections = getMarkerCollections(markerList);
      const { postsData, signature, featureIndex } = collections;
      markerFeatureIndex = featureIndex instanceof Map ? featureIndex : new Map();
      const featureCount = Array.isArray(postsData.features) ? postsData.features.length : 0;
      if(featureCount > 1000){
        await new Promise(resolve => scheduleIdle(resolve, 120));
      }
      const MARKER_MIN_ZOOM = MARKER_ZOOM_THRESHOLD;
      const existing = map.getSource('posts');
      if(!existing){
        map.addSource('posts', { type:'geojson', data: postsData, promoteId: 'featureId' });
        const source = map.getSource('posts');
        if(source){ source.__markerSignature = signature; }
      } else {
        existing.setData(postsData);
        existing.__markerSignature = signature;
      }
      const iconIds = Object.keys(subcategoryMarkers);
      if(typeof ensureMapIcon === 'function'){
        await Promise.all(iconIds.map(id => ensureMapIcon(id).catch(()=>{})));
      }
      await prepareMarkerLabelCompositesForPosts(postsData);
      ensureMarkerLabelBackground(map);
      updateMapFeatureHighlights(lastHighlightedPostIds);
      const markerLabelBaseConditions = [
        ['!',['has','point_count']],
        ['has','title']
      ];
      const markerLabelFilter = ['all', ...markerLabelBaseConditions];

      const markerLabelIconImage = ['let', 'spriteId', ['coalesce', ['get','labelSpriteId'], ''],
        ['case',
          ['==', ['var','spriteId'], ''],
          MARKER_LABEL_BG_ID,
          ['concat', MARKER_LABEL_COMPOSITE_PREFIX, ['var','spriteId']]
        ]
      ];

      const markerLabelHighlightIconImage = ['let', 'spriteId', ['coalesce', ['get','labelSpriteId'], ''],
        ['case',
          ['==', ['var','spriteId'], ''],
          MARKER_LABEL_BG_ACCENT_ID,
          ['concat', MARKER_LABEL_COMPOSITE_PREFIX, ['var','spriteId'], MARKER_LABEL_COMPOSITE_ACCENT_SUFFIX]
        ]
      ];

      const highlightedStateExpression = ['boolean', ['feature-state', 'isHighlighted'], false];
      const markerLabelHighlightOpacity = ['case', highlightedStateExpression, 1, 0];
      const markerLabelBaseOpacity = ['case', highlightedStateExpression, 0, 1];

      const markerLabelMinZoom = MARKER_MIN_ZOOM;
      const labelLayersConfig = [
        { id:'marker-label', source:'posts', sortKey: 1100, filter: markerLabelFilter, iconImage: markerLabelIconImage, iconOpacity: markerLabelBaseOpacity, minZoom: markerLabelMinZoom },
        { id:'marker-label-highlight', source:'posts', sortKey: 1101, filter: markerLabelFilter, iconImage: markerLabelHighlightIconImage, iconOpacity: markerLabelHighlightOpacity, minZoom: markerLabelMinZoom }
      ];
      labelLayersConfig.forEach(({ id, source, sortKey, filter, iconImage, iconOpacity, minZoom }) => {
        const layerMinZoom = Number.isFinite(minZoom) ? minZoom : markerLabelMinZoom;
        let layerExists = !!map.getLayer(id);
        if(!layerExists){
          try{
            map.addLayer({
              id,
              type:'symbol',
              source,
              filter: filter || markerLabelFilter,
              minzoom: layerMinZoom,
              layout:{
                'icon-image': iconImage || markerLabelIconImage,
                'icon-size': 1,
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'icon-anchor': 'left',
                'icon-pitch-alignment': 'viewport',
                'symbol-z-order': 'viewport-y',
                'symbol-sort-key': sortKey
              },
              paint:{
                'icon-translate': [markerLabelBgTranslatePx, 0],
                'icon-translate-anchor': 'viewport',
                'icon-opacity': iconOpacity || 1
              }
            });
            layerExists = !!map.getLayer(id);
          }catch(e){
            layerExists = !!map.getLayer(id);
          }
        }
        if(!layerExists){
          return;
        }
        try{ map.setFilter(id, filter || markerLabelFilter); }catch(e){}
        try{ map.setLayoutProperty(id,'icon-image', iconImage || markerLabelIconImage); }catch(e){}
        try{ map.setLayoutProperty(id,'icon-size', 1); }catch(e){}
        try{ map.setLayoutProperty(id,'icon-allow-overlap', true); }catch(e){}
        try{ map.setLayoutProperty(id,'icon-ignore-placement', true); }catch(e){}
        try{ map.setLayoutProperty(id,'icon-anchor','left'); }catch(e){}
        try{ map.setLayoutProperty(id,'icon-pitch-alignment','viewport'); }catch(e){}
        try{ map.setLayoutProperty(id,'symbol-z-order','viewport-y'); }catch(e){}
        try{ map.setLayoutProperty(id,'symbol-sort-key', sortKey); }catch(e){}
        try{ map.setPaintProperty(id,'icon-translate',[markerLabelBgTranslatePx,0]); }catch(e){}
        try{ map.setPaintProperty(id,'icon-translate-anchor','viewport'); }catch(e){}
        try{ map.setPaintProperty(id,'icon-opacity', iconOpacity || 1); }catch(e){}
        try{ map.setLayerZoomRange(id, layerMinZoom, 24); }catch(e){}
      });
      ALL_MARKER_LAYER_IDS.forEach(id=>{
        if(map.getLayer(id)){
          try{ map.moveLayer(id); }catch(e){}
        }
      });
      [
        ['marker-label','icon-opacity-transition'],
        ['marker-label-highlight','icon-opacity-transition']
      ].forEach(([layer, prop])=>{
        if(map.getLayer(layer)){
          try{ map.setPaintProperty(layer, prop, {duration:0}); }catch(e){}
        }
      });
      refreshInViewMarkerLabelComposites(map);
      if(!postSourceEventsBound){
        function createMapCardOverlay(post, opts = {}){
          const { targetLngLat, fixedLngLat, eventLngLat, venueKey: overlayVenueKey = null } = opts;
          const previousKey = selectedVenueKey;
          if(overlayVenueKey){
            selectedVenueKey = overlayVenueKey;
          }
          try{
            const overlayRoot = document.createElement('div');
            overlayRoot.className = 'mapmarker-overlay';
            overlayRoot.setAttribute('aria-hidden', 'true');
            overlayRoot.style.pointerEvents = 'none';
            overlayRoot.style.userSelect = 'none';

            const parseVenueKey = (key)=>{
              if(typeof key !== 'string') return null;
              const parts = key.split(',');
              if(parts.length !== 2) return null;
              const lng = Number(parts[0]);
              const lat = Number(parts[1]);
              if(!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
              return { lng, lat };
            };

            let resolvedVenueKey = typeof overlayVenueKey === 'string' && overlayVenueKey ? overlayVenueKey : '';
            let resolvedCoords = resolvedVenueKey ? parseVenueKey(resolvedVenueKey) : null;
            const sourceCoord = targetLngLat || fixedLngLat || eventLngLat || (Number.isFinite(post?.lng) && Number.isFinite(post?.lat) ? { lng: post.lng, lat: post.lat } : null);
            if(!resolvedCoords && sourceCoord && Number.isFinite(sourceCoord.lng) && Number.isFinite(sourceCoord.lat)){
              resolvedCoords = { lng: Number(sourceCoord.lng), lat: Number(sourceCoord.lat) };
            }
            if(!resolvedVenueKey && resolvedCoords){
              resolvedVenueKey = toVenueCoordKey(resolvedCoords.lng, resolvedCoords.lat);
            }
            if(resolvedVenueKey){
              overlayRoot.dataset.venueKey = resolvedVenueKey;
            } else if(overlayVenueKey){
              overlayRoot.dataset.venueKey = overlayVenueKey;
            } else {
              delete overlayRoot.dataset.venueKey;
            }

            let visibleList = filtersInitialized ? filtered : posts;
            if(!Array.isArray(visibleList) || visibleList.length === 0){
              visibleList = Array.isArray(posts) ? posts : [];
            }
            const allowedIdSet = new Set(Array.isArray(visibleList) ? visibleList.map(item => {
              if(!item || item.id === undefined || item.id === null) return '';
              return String(item.id);
            }).filter(Boolean) : []);
            let venuePostsAll = [];
            if(resolvedCoords && typeof getPostsAtVenueByCoords === 'function'){
              venuePostsAll = getPostsAtVenueByCoords(resolvedCoords.lng, resolvedCoords.lat) || [];
            } else if(resolvedVenueKey && typeof getPostsAtVenueByCoords === 'function'){
              const coords = parseVenueKey(resolvedVenueKey);
              if(coords){
                venuePostsAll = getPostsAtVenueByCoords(coords.lng, coords.lat) || [];
              }
            }
            let venuePostsVisible = Array.isArray(venuePostsAll)
              ? venuePostsAll.filter(item => allowedIdSet.has(String(item && item.id)))
              : [];
            if((!Array.isArray(venuePostsVisible) || venuePostsVisible.length === 0) && post){
              venuePostsVisible = [post];
            }
            const uniqueVenuePosts = [];
            const venuePostIds = new Set();
            venuePostsVisible.forEach(item => {
              if(!item || item.id === undefined || item.id === null) return;
              const idStr = String(item.id);
              if(!idStr || venuePostIds.has(idStr)) return;
              venuePostIds.add(idStr);
              uniqueVenuePosts.push(item);
            });
            const multiIds = uniqueVenuePosts.map(item => String(item.id)).filter(Boolean);
            const multiCount = uniqueVenuePosts.length;
            const isMultiVenue = multiCount > 1;
            if(isMultiVenue){
              overlayRoot.dataset.multiIds = multiIds.join(',');
            } else {
              delete overlayRoot.dataset.multiIds;
            }
            const sortedList = Array.isArray(sortedPostList) ? sortedPostList : [];
            let primaryVenuePost = null;
            if(isMultiVenue && sortedList.length){
              primaryVenuePost = sortedList.find(entry => entry && venuePostIds.has(String(entry.id))) || null;
            }
            if(!primaryVenuePost){
              primaryVenuePost = uniqueVenuePosts[0] || post;
            }
            const overlayId = primaryVenuePost && primaryVenuePost.id !== undefined && primaryVenuePost.id !== null
              ? String(primaryVenuePost.id)
              : String(post.id);
            overlayRoot.dataset.id = overlayId;

            const markerContainer = document.createElement('div');
            markerContainer.className = 'small-map-card';
            markerContainer.dataset.id = overlayId;
            markerContainer.setAttribute('aria-hidden', 'true');
            markerContainer.style.pointerEvents = 'none';
            markerContainer.style.userSelect = 'none';

            const markerIcon = new Image();
            try{ markerIcon.decoding = 'async'; }catch(e){}
            markerIcon.alt = '';
            markerIcon.className = 'mapmarker';
            markerIcon.draggable = false;
            markerIcon.loading = 'eager';
            markerIcon.referrerPolicy = 'no-referrer';
            if(isMultiVenue){
              markerIcon.src = SMALL_MULTI_MAP_CARD_ICON_SRC;
              enforceSmallMultiMapCardIcon(markerIcon, overlayRoot);
            } else {
              const markerSources = window.subcategoryMarkers || {};
              const markerIds = window.subcategoryMarkerIds || {};
              const slugifyFn = typeof slugify === 'function' ? slugify : (window.slugify || (str => (str || '').toString().trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')));
              const markerIdCandidates = [];
              if(post && post.subcategory){
                const mappedId = markerIds[post.subcategory];
                if(mappedId) markerIdCandidates.push(mappedId);
                markerIdCandidates.push(slugifyFn(post.subcategory));
              }
              const markerIconUrl = markerIdCandidates.map(id => (id && markerSources[id]) || null).find(Boolean) || '';
              const markerFallback = 'assets/icons-30/whats-on-category-icon-30.webp';
              markerIcon.onerror = ()=>{
                markerIcon.onerror = null;
                markerIcon.src = markerFallback;
              };
              markerIcon.src = markerIconUrl || markerFallback;
            }
            requestAnimationFrame(() => {
              if(typeof markerIcon.decode === 'function'){
                markerIcon.decode().catch(()=>{});
              }
            });

            const markerPill = new Image();
            try{ markerPill.decoding = 'async'; }catch(e){}
            markerPill.alt = '';
            markerPill.src = 'assets/icons-30/150x40-pill-70.webp';
            markerPill.dataset.defaultSrc = 'assets/icons-30/150x40-pill-70.webp';
            markerPill.dataset.highlightSrc = 'assets/icons-30/150x40-pill-2f3b73.webp';
            markerPill.className = 'mapmarker-pill';
            markerPill.loading = 'eager';
            markerPill.style.opacity = '0.9';
            markerPill.style.visibility = 'visible';
            markerPill.draggable = false;
            requestAnimationFrame(() => {
              if(typeof markerPill.decode === 'function'){
                markerPill.decode().catch(()=>{});
              }
            });

            const labelLines = isMultiVenue ? null : getMarkerLabelLines(post);
            const venueDisplayName = (()=>{
              if(resolvedVenueKey){
                const candidates = uniqueVenuePosts.length ? uniqueVenuePosts : (post ? [post] : []);
                for(const candidate of candidates){
                  const locs = Array.isArray(candidate?.locations) ? candidate.locations : [];
                  const match = locs.find(loc => loc && toVenueCoordKey(loc.lng, loc.lat) === resolvedVenueKey && loc.venue);
                  if(match && match.venue){
                    return match.venue;
                  }
                }
              }
              const fallback = uniqueVenuePosts[0] || post;
              return getPrimaryVenueName(fallback) || '';
            })();
            const multiSmallVenueText = shortenMarkerLabelText(venueDisplayName, markerLabelTextAreaWidthPx);
            const multiBigVenueText = shortenMarkerLabelText(venueDisplayName, mapCardTitleWidthPx);
            const multiCountLabel = `${multiCount} posts here`;
            const markerLabel = document.createElement('div');
            markerLabel.className = 'mapmarker-label';
            if(isMultiVenue){
              markerContainer.classList.add('small-multi-post-map-card');
              const markerLine1 = document.createElement('div');
              markerLine1.className = 'mapmarker-label-line';
              markerLine1.textContent = multiCountLabel;
              const markerLine2 = document.createElement('div');
              markerLine2.className = 'mapmarker-label-line';
              markerLine2.textContent = multiSmallVenueText || venueDisplayName || '';
              markerLabel.append(markerLine1, markerLine2);
            } else if(labelLines){
              const markerLine1 = document.createElement('div');
              markerLine1.className = 'mapmarker-label-line';
              markerLine1.textContent = labelLines.line1;
              markerLabel.appendChild(markerLine1);
              if(labelLines.line2){
                const markerLine2 = document.createElement('div');
                markerLine2.className = 'mapmarker-label-line';
                markerLine2.textContent = labelLines.line2;
                markerLabel.appendChild(markerLine2);
              }
            }

            markerContainer.append(markerPill, markerIcon, markerLabel);

            const cardRoot = document.createElement('div');
            cardRoot.className = 'big-map-card big-map-card--popup';
            if(isMultiVenue){
              cardRoot.classList.add('big-multi-post-map-card');
            }
            cardRoot.dataset.id = overlayId;
            cardRoot.setAttribute('aria-hidden', 'true');
            cardRoot.style.pointerEvents = 'auto';
            cardRoot.style.userSelect = 'none';

            const pillImg = new Image();
            try{ pillImg.decoding = 'async'; }catch(e){}
            pillImg.alt = '';
            pillImg.src = 'assets/icons-30/225x60-pill-99.webp';
            pillImg.className = 'map-card-pill';
            pillImg.style.opacity = '0.9';
            pillImg.draggable = false;

            const thumbImg = new Image();
            try{ thumbImg.decoding = 'async'; }catch(e){}
            thumbImg.alt = '';
            thumbImg.loading = 'eager';
            thumbImg.draggable = false;
            if(isMultiVenue){
              thumbImg.src = 'assets/icons-30/multi-post-icon-50.webp';
              thumbImg.className = 'map-card-thumb';
            } else {
              const thumbFallback = 'assets/funmap-logo-small.png';
              thumbImg.onerror = ()=>{
                thumbImg.onerror = null;
                thumbImg.src = thumbFallback;
              };
              thumbImg.src = thumbUrl(post) || thumbFallback;
              thumbImg.className = 'map-card-thumb';
              thumbImg.referrerPolicy = 'no-referrer';
            }
            requestAnimationFrame(() => {
              if(typeof thumbImg.decode === 'function'){
                thumbImg.decode().catch(()=>{});
              }
            });

            const labelEl = document.createElement('div');
            labelEl.className = 'map-card-label';
            const titleWrap = document.createElement('div');
            titleWrap.className = 'map-card-title';
            if(isMultiVenue){
              [multiCountLabel, multiBigVenueText || venueDisplayName || ''].forEach(line => {
                const lineEl = document.createElement('div');
                lineEl.className = 'map-card-title-line';
                lineEl.textContent = line;
                titleWrap.appendChild(lineEl);
              });
            } else if(labelLines){
              const cardTitleLines = Array.isArray(labelLines.cardTitleLines) && labelLines.cardTitleLines.length
                ? labelLines.cardTitleLines.slice(0, 2)
                : [labelLines.line1, labelLines.line2].filter(Boolean).slice(0, 2);
              cardTitleLines.forEach(line => {
                if(!line) return;
                const lineEl = document.createElement('div');
                lineEl.className = 'map-card-title-line';
                lineEl.textContent = line;
                titleWrap.appendChild(lineEl);
              });
            }
            if(!titleWrap.childElementCount){
              const lineEl = document.createElement('div');
              lineEl.className = 'map-card-title-line';
              lineEl.textContent = '';
              titleWrap.appendChild(lineEl);
            }
            labelEl.appendChild(titleWrap);
            if(!isMultiVenue && labelLines){
              const venueLine = labelLines.venueLine || shortenMarkerLabelText(getPrimaryVenueName(post), mapCardTitleWidthPx);
              if(venueLine){
                const venueEl = document.createElement('div');
                venueEl.className = 'map-card-venue';
                venueEl.textContent = venueLine;
                labelEl.appendChild(venueEl);
              }
            }

            cardRoot.append(pillImg, thumbImg, labelEl);
            overlayRoot.append(markerContainer, cardRoot);
            overlayRoot.classList.add('is-card-visible');
            overlayRoot.style.pointerEvents = '';
            resetBigMapCardTransforms();

            const handleOverlayClick = (ev)=>{
              ev.preventDefault();
              ev.stopPropagation();
              const pid = overlayRoot.dataset.id;
              if(!pid) return;
              callWhenDefined('openPost', (fn)=>{
                requestAnimationFrame(() => {
                  try{
                    touchMarker = null;
                    stopSpin();
                    if(typeof closePanel === 'function' && typeof filterPanel !== 'undefined' && filterPanel){
                      try{ closePanel(filterPanel); }catch(err){}
                    }
                    fn(pid, false, true);
                  }catch(err){ console.error(err); }
                });
              });
            };
            cardRoot.addEventListener('click', handleOverlayClick, { capture: true });
            ['pointerdown','mousedown','touchstart'].forEach(type => {
              cardRoot.addEventListener(type, (ev)=>{
                const pointerType = typeof ev.pointerType === 'string' ? ev.pointerType.toLowerCase() : '';
                const isTouchLike = pointerType === 'touch' || ev.type === 'touchstart';
                if(!isTouchLike){
                  try{ ev.preventDefault(); }catch(err){}
                }
                try{ ev.stopPropagation(); }catch(err){}
              }, { capture: true });
            });
            const marker = new mapboxgl.Marker({ element: overlayRoot, anchor: 'center' });
            if(typeof marker.setZIndexOffset === 'function'){
              try{ marker.setZIndexOffset(20000); }catch(e){}
            }
            const markerElement = typeof marker.getElement === 'function' ? marker.getElement() : overlayRoot;
            if(markerElement && markerElement.style){
              markerElement.style.zIndex = '20000';
            }
            if(targetLngLat){ marker.setLngLat(targetLngLat); }
            else if(fixedLngLat){ marker.setLngLat(fixedLngLat); }
            else if(eventLngLat){ marker.setLngLat(eventLngLat); }
            marker.addTo(map);
            marker.__fixedLngLat = fixedLngLat;
            window.__overCard = false;
            registerPopup(marker);
            return marker;
          } finally {
            if(overlayVenueKey){
              selectedVenueKey = previousKey;
            }
          }
        }

        const handleMarkerClick = (e)=>{
          stopSpin();
          const f = e.features && e.features[0]; if(!f) return;
          const props = f.properties || {};
          const venueKey = props.venueKey || null;
          const id = props.id;
          const rawMultiIds = Array.isArray(props.multiPostIds) ? props.multiPostIds : [];
          const normalizedMultiIds = rawMultiIds.map(item => String(item)).filter(Boolean);
          const multiCountFromProps = Number(props.multiCount);
          let normalizedMultiCount = Number.isFinite(multiCountFromProps) && multiCountFromProps > 0 ? multiCountFromProps : 0;
          if(!normalizedMultiCount){
            normalizedMultiCount = normalizedMultiIds.length;
          }
          const helperMultiCount = Math.max(normalizedMultiIds.length, normalizedMultiCount, props.isMultiVenue ? 2 : 0);
          const isMultiCluster = helperMultiCount > 1;
          if(id !== undefined && id !== null){
            activePostId = id;
            selectedVenueKey = venueKey;
            updateSelectedMarkerRing();
          }
          const coords = f.geometry && f.geometry.coordinates;
          const hasCoords = Array.isArray(coords) && coords.length >= 2 && Number.isFinite(coords[0]) && Number.isFinite(coords[1]);
          const baseLngLat = hasCoords ? { lng: coords[0], lat: coords[1] } : (e && e.lngLat ? { lng: e.lngLat.lng, lat: e.lngLat.lat } : null);
          const fixedLngLat = baseLngLat || (e && e.lngLat ? { lng: e.lngLat.lng, lat: e.lngLat.lat } : null);
          const targetLngLat = baseLngLat || (e ? e.lngLat : null);
          const touchClick = isTouchDevice || (e.originalEvent && (e.originalEvent.pointerType === 'touch' || e.originalEvent.pointerType === 'pen'));
          if(touchClick){
            if(touchMarker !== id || !hoverPopup){
              touchMarker = id;
              if(hoverPopup){
                runOverlayCleanup(hoverPopup);
                try{ hoverPopup.remove(); }catch(err){}
                hoverPopup = null;
                updateSelectedMarkerRing();
              }
              const p = posts.find(x=>x.id===id);
              if(p){
                hoverPopup = createMapCardOverlay(p, { targetLngLat, fixedLngLat, eventLngLat: e && e.lngLat, venueKey });
                updateSelectedMarkerRing();
              }
            }
            if(isMultiCluster){
              autoOpenPostBoardForCluster({
                multiIds: normalizedMultiIds,
                multiCount: helperMultiCount,
                trigger: 'touch'
              });
            }
            return;
          }
          if(isMultiCluster){
            autoOpenPostBoardForCluster({
              multiIds: normalizedMultiIds,
              multiCount: helperMultiCount,
              trigger: 'click'
            });
          }
        };
      MARKER_INTERACTIVE_LAYERS.forEach(layer => map.on('click', layer, handleMarkerClick));

      map.on('click', e=>{
        const originalTarget = e.originalEvent && e.originalEvent.target;
        const targetEl = originalTarget && typeof originalTarget.closest === 'function'
          ? originalTarget.closest('.mapmarker-overlay')
          : null;
        if(targetEl){
          return;
        }
        const feats = map.queryRenderedFeatures(e.point);
        if(!feats.length){
          if(hoverPopup){
            runOverlayCleanup(hoverPopup);
            try{ hoverPopup.remove(); }catch(err){}
            hoverPopup = null;
          }
          updateSelectedMarkerRing();
          touchMarker = null;
        }
      });

      updateSelectedMarkerRing();

      // Cursor + popup for marker points
      
      const handleMarkerMouseEnter = (e)=>{
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features && e.features[0]; if(!f) return;
        const props = f.properties || {};
        const id = props.id;
        const venueKey = props.venueKey || null;
        const coords = f.geometry && f.geometry.coordinates;
        const hasCoords = Array.isArray(coords) && coords.length >= 2 && Number.isFinite(coords[0]) && Number.isFinite(coords[1]);
        const baseLngLat = hasCoords ? { lng: coords[0], lat: coords[1] } : (e && e.lngLat ? { lng: e.lngLat.lng, lat: e.lngLat.lat } : null);
        const fixedLngLat = baseLngLat || (e && e.lngLat ? { lng: e.lngLat.lng, lat: e.lngLat.lat } : null);
        const targetLngLat = baseLngLat || (e ? e.lngLat : null);
        const p = posts.find(x=>x.id===id);
        if(!p){
          return;
        }
        if(hoverPopup){
          runOverlayCleanup(hoverPopup);
          try{ hoverPopup.remove(); }catch(e){}
          hoverPopup = null;
          updateSelectedMarkerRing();
        }
        hoverPopup = createMapCardOverlay(p, { targetLngLat, fixedLngLat, eventLngLat: e && e.lngLat, venueKey });
        updateSelectedMarkerRing();
      };
      MARKER_INTERACTIVE_LAYERS.forEach(layer => map.on('mouseenter', layer, handleMarkerMouseEnter));

      const onMarkerMove = window.rafThrottle((evt)=>{
        if(hoverPopup && typeof hoverPopup.setLngLat === 'function'){
          const fixed = hoverPopup.__fixedLngLat;
          if(fixed && Number.isFinite(fixed.lng) && Number.isFinite(fixed.lat)){
            hoverPopup.setLngLat(fixed);
          }
        }
      });
      MARKER_INTERACTIVE_LAYERS.forEach(layer => map.on('mousemove', layer, onMarkerMove));

      const handleMarkerMouseLeave = ()=>{
        map.getCanvas().style.cursor = 'grab';
        if(listLocked) return;
        const currentPopup = hoverPopup;
        schedulePopupRemoval(currentPopup, 200);
      };
      MARKER_INTERACTIVE_LAYERS.forEach(layer => map.on('mouseleave', layer, handleMarkerMouseLeave));

      // Maintain pointer cursor for balloons and surface multi-venue cards when applicable
        postSourceEventsBound = true;
      }
      } catch (err) {
        console.error('addPostSource failed', err);
      } finally {
        addingPostSource = false;
        const shouldReplay = pendingAddPostSource;
        pendingAddPostSource = false;
        if(shouldReplay){
          addPostSource();
        }
      }
    }
    window.addPostSource = addPostSource;
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
    function formatDates(d){
      if(!d || !d.length) return '';
      const sorted = d.slice().sort();
      const currentYear = new Date().getFullYear();
      const formatPart = (dateObj, includeYear=false)=>{
        const base = dateObj.toLocaleDateString('en-GB',{weekday:'short', day:'numeric', month:'short'}).replace(/,/g,'');
        return includeYear ? `${base}, ${dateObj.getFullYear()}` : base;
      };
      const first = parseISODate(sorted[0]);
      const last = parseISODate(sorted[sorted.length-1]);
      if(sorted.length === 1){
        const includeYear = first.getFullYear() !== currentYear;
        return formatPart(first, includeYear);
      }
      const firstYear = first.getFullYear();
      const lastYear = last.getFullYear();
      const crossYear = firstYear !== lastYear;
      const firstIncludeYear = crossYear && firstYear !== currentYear;
      const lastIncludeYear = (crossYear && lastYear !== currentYear) || (!crossYear && lastYear !== currentYear);
      const startText = formatPart(first, firstIncludeYear);
      const endText = formatPart(last, lastIncludeYear);
      return `${startText} - ${endText}`;
    }

    function parseCreatedToDate(created){
      if(!created) return null;
      const parts = created.split('T');
      if(parts.length < 2) return null;
      const [datePart, rawTime] = parts;
      if(!datePart) return null;
      const hasZ = rawTime.endsWith('Z');
      const timeCore = hasZ ? rawTime.slice(0, -1) : rawTime;
      const [hh = '00', mm = '00', ss = '00', ms = ''] = timeCore.split('-');
      const iso = `${datePart}T${hh.padStart(2,'0')}:${mm.padStart(2,'0')}:${ss.padStart(2,'0')}${ms ? '.' + ms : ''}${hasZ ? 'Z' : ''}`;
      const dt = new Date(iso);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }

    function formatPostTimestamp(created){
      const dt = parseCreatedToDate(created);
      if(!dt) return '';
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth()+1).padStart(2,'0');
      const d = String(dt.getUTCDate()).padStart(2,'0');
      const hh = String(dt.getUTCHours()).padStart(2,'0');
      const mm = String(dt.getUTCMinutes()).padStart(2,'0');
      return `${y}-${m}-${d} ${hh}:${mm} UTC`;
    }

    function prioritizeVisibleImages(){
      const roots = [postsWideEl];
      if(resultsEl) roots.push(resultsEl);
      roots.forEach(root => {
        const imgs = root.querySelectorAll('img.thumb');
        if(!imgs.length) return;
        if('IntersectionObserver' in window){
          const observerRoot = root === postsWideEl ? root.closest('.post-board') : root;
          const obs = new IntersectionObserver(entries => {
            entries.forEach(entry => {
              if(entry.isIntersecting){
                const img = entry.target;
                if(img.dataset.src){
                  img.addEventListener('load', ()=> img.classList.remove('lqip'), {once:true});
                  img.src = img.dataset.src;
                  img.removeAttribute('data-src');
                }
                img.fetchPriority = 'high';
                obs.unobserve(img);
              }
            });
          }, {root: observerRoot});
          imgs.forEach(img => obs.observe(img));
        } else {
          imgs.forEach(img => {
            img.loading = 'lazy';
            if(img.dataset.src){
              img.addEventListener('load', ()=> img.classList.remove('lqip'), {once:true});
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
            }
          });
        }
      });
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
            <div class="loc-line"><span class="badge" title="Venue">📍</span><span>${p.city}</span></div>
            <div class="date-line"><span class="badge" title="Dates">📅</span><span>${formatDates(p.dates)}</span></div>
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
        renderHistoryBoard();
      });

      const handleHoverHighlight = (state)=> toggleSmallMapCardHoverHighlight(p.id, state);

      el.addEventListener('mouseenter', ()=> handleHoverHighlight(true));
      el.addEventListener('mouseleave', ()=> handleHoverHighlight(false));
      el.dataset.hoverHighlightBound = '1';
      return el;
    }

    document.addEventListener('mouseover', event => {
      const cardEl = event.target.closest('.post-card, .recents-card');
      if(!cardEl || cardEl.dataset.hoverHighlightBound === '1') return;
      const related = event.relatedTarget;
      if(related && cardEl.contains(related)) return;
      const id = cardEl.dataset ? cardEl.dataset.id : null;
      if(!id) return;
      toggleSmallMapCardHoverHighlight(id, true);
    });

    document.addEventListener('mouseout', event => {
      const cardEl = event.target.closest('.post-card, .recents-card');
      if(!cardEl || cardEl.dataset.hoverHighlightBound === '1') return;
      const related = event.relatedTarget;
      if(related && cardEl.contains(related)) return;
      const id = cardEl.dataset ? cardEl.dataset.id : null;
      if(!id) return;
      toggleSmallMapCardHoverHighlight(id, false);
    });

    // History board
    function loadHistory(){ try{ return JSON.parse(localStorage.getItem('openHistoryV2')||'[]'); }catch(e){ return []; } }
    function saveHistory(){ localStorage.setItem('openHistoryV2', JSON.stringify(viewHistory)); }
    function formatLastOpened(ts){
      if(!ts) return '';
      const diff = Date.now() - ts;
      const mins = Math.floor(diff/60000);
      let ago;
      if(mins < 60){
        ago = mins + ' minute' + (mins===1?'':'s');
      } else if(mins < 1440){
        const hrs = Math.floor(mins/60);
        ago = hrs + ' hour' + (hrs===1?'':'s');
      } else {
        const days = Math.floor(mins/1440);
        ago = days + ' day' + (days===1?'':'s');
      }
      const d = new Date(ts);
      const weekday = d.toLocaleDateString('en-GB', {weekday:'short'});
      const day = d.getDate();
      const month = d.toLocaleDateString('en-GB', {month:'short'});
      const year = d.getFullYear();
      const hour = String(d.getHours()).padStart(2,'0');
      const minute = String(d.getMinutes()).padStart(2,'0');
      return `Last opened ${ago} ago - ${weekday} ${day} ${month}, ${year} ${hour}:${minute}`;
    }

    function captureState(){
      const {start,end} = orderedRange();
      const openCats = Object.values(categoryControllers).filter(ctrl=>ctrl.getOpenState && ctrl.getOpenState()).map(ctrl=>ctrl.name);
      return {
        bounds: map ? map.getBounds().toArray() : null,
        kw: $('#keyword-textbox').value,
        date: $('#daterange-textbox').value,
        start: start ? toISODate(start) : null,
        end: end ? toISODate(end) : null,
        expired: $('#expiredToggle').checked,
        minPrice: $('#min-price-input') ? $('#min-price-input').value : '',
        maxPrice: $('#max-price-input') ? $('#max-price-input').value : '',
        cats: [...selection.cats],
        subs: [...selection.subs],
        openCats
      };
    }

    function restoreState(st){
      if(!st) return;
      $('#keyword-textbox').value = st.kw || '';
      if($('#min-price-input')){
        const minEl = $('#min-price-input');
        minEl.value = (st.minPrice || '').toString().replace(/\D+/g,'');
      }
      if($('#max-price-input')){
        const maxEl = $('#max-price-input');
        maxEl.value = (st.maxPrice || '').toString().replace(/\D+/g,'');
      }
      dateStart = st.start ? parseISODate(st.start) : null;
      dateEnd = st.end ? parseISODate(st.end) : null;
      if(!st.start && st.range){
        const parts = st.range.split(' to ').map(s=>s.trim());
        if(parts[0]) dateStart = parseISODate(parts[0]);
        if(parts[1]) dateEnd = parseISODate(parts[1]);
      }
      $('#expiredToggle').checked = st.expired || false;
      if($('#expiredToggle').checked){
        buildFilterCalendar(minPickerDate, maxPickerDate);
      } else {
        buildFilterCalendar(today, maxPickerDate);
      }
      if(dateStart){
        const sIso = toISODate(dateStart);
        const sDisp = fmtShort(sIso);
        if(dateEnd && dateEnd.getTime() !== dateStart.getTime()){
          const eIso = toISODate(dateEnd);
          const eDisp = fmtShort(eIso);
          $('#daterange-textbox').value = `${sDisp} - ${eDisp}`;
        } else {
          $('#daterange-textbox').value = sDisp;
        }
      } else {
        $('#daterange-textbox').value = '';
      }
      expiredWasOn = $('#expiredToggle').checked;
      updateRangeClasses();
      updateInput();
      const savedCatsArray = Array.isArray(st.cats) && st.cats.length ? st.cats : categories.map(cat=>cat.name);
      const savedCats = new Set(savedCatsArray);
      const savedSubsArray = Array.isArray(st.subs) ? st.subs : null;
      const subsToUse = savedSubsArray && savedSubsArray.length ? savedSubsArray : allSubcategoryKeys;
      const openCats = Array.isArray(st.openCats) ? new Set(st.openCats) : null;
      selection.cats = new Set();
      selection.subs = new Set(subsToUse);
      const controllers = Object.values(categoryControllers);
      if(controllers.length){
        controllers.forEach(ctrl=>{
          const active = savedCats.has(ctrl.name);
          ctrl.setActive(active, {silent:true});
          const shouldOpen = active && (openCats ? openCats.has(ctrl.name) : false);
          ctrl.setOpen(shouldOpen);
          ctrl.syncSubs();
        });
      } else {
        selection.cats = new Set(savedCatsArray);
      }
      if(map && st.bounds){
        stopSpin();
        const bounds = new mapboxgl.LngLatBounds(st.bounds);
        map.fitBounds(bounds, {padding:10});
        postPanel = bounds;
      }
      applyFilters();
      updateClearButtons();
      updateCategoryResetBtn();
    }
    function renderHistoryBoard(){
      if(!recentsBoard) return;
      recentsBoard.innerHTML='';
      const validHistory = viewHistory.filter(v => getPostByIdAnywhere(v.id));
      viewHistory = validHistory;
      saveHistory();
      const items = viewHistory.slice(0,100);
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

    renderHistoryBoard();

function openPostModal(id){
      const p = getPostByIdAnywhere(id);
      if(!p) return;
      activePostId = id;
      updateSelectedMarkerRing();
      const container = document.getElementById('post-modal-container');
      if(!container) return;
      const modal = container.querySelector('.post-modal');
      modal.innerHTML='';
      const wrap = document.createElement('div');
      wrap.className = 'post-board';
      const detail = buildDetail(p);
      const headerEl = detail.querySelector('.post-header');
      const favBtn = headerEl && headerEl.querySelector('.fav');
      if(headerEl && favBtn){
        const closeBtn = document.createElement('button');
        closeBtn.type='button';
        closeBtn.className='close-post';
        closeBtn.setAttribute('aria-label','Close post');
        closeBtn.textContent='✖';
        closeBtn.style.marginLeft='10px';
        favBtn.after(closeBtn);
        closeBtn.addEventListener('click', e=>{ e.stopPropagation(); closePostModal(); });
      }
      wrap.appendChild(detail);
      modal.appendChild(wrap);
      hookDetailActions(detail, p);
      container.classList.remove('hidden');
      if(!panelStack.includes(container)) panelStack.push(container);
      bringToTop(container);
      requestAnimationFrame(()=>{
        const imgArea = detail.querySelector('.post-images');
        const text = detail.querySelector('.post-details');
        if(headerEl){
          headerEl.style.position='sticky';
          headerEl.style.top='0';
          headerEl.style.zIndex='2';
        }
        if(imgArea && text && text.offsetTop === imgArea.offsetTop){
          imgArea.style.position='sticky';
          imgArea.style.top = headerEl ? headerEl.offsetHeight + 'px' : '0';
        }
      });
      viewHistory = viewHistory.filter(x=>x.id!==id);
      viewHistory.unshift({id:p.id, title:p.title, url:postUrl(p), lastOpened: Date.now()});
      if(viewHistory.length>100) viewHistory.length=100;
      saveHistory(); renderHistoryBoard();
      location.hash = `/post/${p.slug}-${p.created}`;
    }

    function closePostModal(){
      const container = document.getElementById('post-modal-container');
      if(!container) return;
      container.classList.add('hidden');
      const idx = panelStack.indexOf(container);
      if(idx!==-1) panelStack.splice(idx,1);
      const modal = container.querySelector('.post-modal');
      if(modal) modal.innerHTML='';
      location.hash = '';
    }
    window.closePostModal = closePostModal;

    function handleHash(){
      if(!location.hash){
        closePostModal();
        return;
      }
      const m = location.hash.match(/\/post\/([^\/]+)-([^\/]+)$/);
      if(!m) return;
      const slug = decodeURIComponent(m[1]);
      const created = m[2];
      const matchPost = (list) => {
        if(!Array.isArray(list) || !list.length) return null;
        return list.find(x => x && x.slug === slug && x.created === created) || null;
      };
      let post = matchPost(posts);
      if(!post){
        const cache = getAllPostsCache({ allowInitialize: true });
        post = matchPost(cache);
      }
      if(post){ openPostModal(post.id); }
    }

    window.addEventListener('hashchange', handleHash);

    window.addEventListener('resize', ()=>{});

    document.addEventListener('DOMContentLoaded', ()=>{
      const container = document.getElementById('post-modal-container');
      if(container){
        container.addEventListener('click', e=>{ if(e.target===container) closePostModal(); });
      }
      handleHash();
    });

    document.addEventListener('click', (ev)=>{
      const card = ev.target.closest('.mapboxgl-popup.big-map-card .big-map-card');
      if(card){
        ev.preventDefault();
        const pid = card.getAttribute('data-id') || (card.closest('.map-card-list-item') && card.closest('.map-card-list-item').getAttribute('data-id'));
        if(pid){
          callWhenDefined('openPost', (fn)=>{
            requestAnimationFrame(() => {
              try{
                touchMarker = null;
                stopSpin();
                if(typeof closePanel === 'function' && typeof filterPanel !== 'undefined' && filterPanel){
                  try{ closePanel(filterPanel); }catch(err){}
                }
                fn(pid, false, true);
              }catch(err){ console.error(err); }
            });
          });
        }
      }
    }, { capture:true });

    function hookDetailActions(el, p){
      const locationList = Array.isArray(p.locations) ? p.locations : [];
      el.querySelectorAll('.post-header').forEach(headerEl => {
        headerEl.addEventListener('click', evt=>{
          if(evt.target.closest('button')) return;
          evt.stopPropagation();
          closeActivePost();
        });
      });
      el.querySelectorAll('.fav').forEach(favBtn => {
        favBtn.addEventListener('click', (e)=>{
          e.stopPropagation();
          p.fav = !p.fav;
          favSortDirty = true;
          document.querySelectorAll(`[data-id="${p.id}"] .fav`).forEach(btn=>{
            btn.setAttribute('aria-pressed', p.fav ? 'true' : 'false');
          });
          const detailEl = el;
          renderHistoryBoard();
          const replacement = postsWideEl.querySelector(`[data-id="${p.id}"]`);
          if(replacement){
            replacement.replaceWith(detailEl);
          }
        });
      });

      el.querySelectorAll('.share').forEach(shareBtn => {
        shareBtn.addEventListener('click', (e)=>{
          e.stopPropagation();
          const url = postUrl(p);
          navigator.clipboard.writeText(url).then(()=>{ showCopyMsg(shareBtn); });
        });
      });

      const descEl = el.querySelector('.post-details .desc');
      if(descEl){
        const toggleDesc = evt => {
          const allowed = ['Enter', ' ', 'Spacebar', 'Space'];
          if(evt.type === 'keydown' && !allowed.includes(evt.key)){
            return;
          }
          evt.preventDefault();
          const expanded = !descEl.classList.contains('expanded');
          descEl.classList.toggle('expanded', expanded);
          descEl.setAttribute('aria-expanded', expanded ? 'true' : 'false');
          const openPostEl = el;
          if(openPostEl){
            openPostEl.classList.toggle('desc-expanded', expanded);
          }
          if(expanded){
            document.body.classList.remove('open-post-sticky-images');
          } else if(typeof updateStickyImages === 'function'){
            updateStickyImages();
          }
        };
        descEl.addEventListener('click', toggleDesc);
        descEl.addEventListener('keydown', toggleDesc);
      }

      const imgs = p.images && p.images.length ? p.images : [heroUrl(p)];
      const thumbCol = el.querySelector('.thumbnail-row');
      const imageBox = el.querySelector('.image-box');
      const imageTrack = imageBox ? imageBox.querySelector('.image-track') : null;
      const baseImg = imageTrack ? imageTrack.querySelector('img') : null;
      const slides = [];
      if(imageBox){
        imageBox._modalImages = imgs.slice();
        try {
          imageBox.dataset.modalImages = JSON.stringify(imgs);
        } catch(err) {
          imageBox.dataset.modalImages = '';
        }
        if(typeof imageBox.dataset.index === 'undefined'){
          imageBox.dataset.index = '0';
        }
      }
      if(baseImg){
        baseImg.dataset.index = '0';
        baseImg.dataset.full = imgs[0];
        if(!baseImg.classList.contains('ready')){
          baseImg.classList.add('lqip');
        }
        slides[0] = baseImg;
      }
      if(imageTrack){
        imageTrack.style.transform = 'translateX(0)';
      }
      for(let i=1;i<imgs.length;i++){
        if(!imageTrack) break;
        const slide = document.createElement('img');
        slide.dataset.index = i;
        slide.dataset.full = imgs[i];
        slide.alt = '';
        slide.decoding = 'async';
        slide.loading = 'lazy';
        slide.classList.add('lqip');
        slide.src = imgs[i];
        imageTrack.appendChild(slide);
        slides[i] = slide;
      }
      if(thumbCol){
        imgs.forEach((url,i)=>{
          const t = document.createElement('img');
          t.src = url;
          t.dataset.full = url;
          t.dataset.index = i;
          t.tabIndex = 0;
          thumbCol.appendChild(t);
        });
      }
      const clampIdx = idx => Math.min(Math.max(idx, 0), imgs.length - 1);
      let currentIdx = 0;
      const ensureSlide = idx => {
        if(!imageTrack) return null;
        if(!slides[idx]){
          const slide = document.createElement('img');
          slide.dataset.index = idx;
          slide.dataset.full = imgs[idx];
          slide.alt = '';
          slide.decoding = 'async';
          slide.loading = 'lazy';
          slide.classList.add('lqip');
          slide.src = imgs[idx];
          imageTrack.appendChild(slide);
          slides[idx] = slide;
        }
        return slides[idx];
      };
      const scrollThumbIntoView = target => {
        if(!thumbCol || !target) return;
        const rowRect = thumbCol.getBoundingClientRect();
        const tRect = target.getBoundingClientRect();
        if(tRect.left < rowRect.left){
          thumbCol.scrollBy({left: tRect.left - rowRect.left - 8, behavior:'smooth'});
        } else if(tRect.right > rowRect.right){
          thumbCol.scrollBy({left: tRect.right - rowRect.right + 8, behavior:'smooth'});
        }
      };
      const moveTo = (idx, {instant=false}={})=>{
        if(!imageTrack) return;
        if(instant){
          imageTrack.style.transition = 'none';
        }
        const apply = ()=>{ imageTrack.style.transform = `translateX(-${idx * 100}%)`; };
        if(instant){
          apply();
          requestAnimationFrame(()=>{ imageTrack.style.transition = ''; });
        } else {
          apply();
        }
      };
      function show(idx, {instant=false}={}){
        idx = clampIdx(idx);
        const t = thumbCol ? thumbCol.querySelector(`img[data-index="${idx}"]`) : null;
        const slide = ensureSlide(idx);
        if(!slide) return;
        const prevIdx = currentIdx;
        const alreadyReady = slide.classList.contains('ready');
        currentIdx = idx;
        if(prevIdx !== idx || instant){
          moveTo(idx, {instant});
        }
        if(imageBox){
          imageBox.dataset.index = idx;
        }
        if(slides.length){
          slides.forEach((img,i)=>{
            if(img){
              img.classList.toggle('active', i===idx);
            }
          });
        }
        if(t && thumbCol){
          thumbCol.querySelectorAll('img').forEach(im=> im.classList.toggle('selected', im===t));
          scrollThumbIntoView(t);
        }
        if(t && slide.src !== t.src){
          slide.src = t.src;
        }
        const full = (t && (t.dataset.full || t.src)) || slide.dataset.full || slide.src;
        if(!slide.dataset.full){
          slide.dataset.full = full;
        }
        if(!alreadyReady || slide.src !== full){
          slide.classList.remove('ready');
          slide.classList.add('lqip');
          const hi = new Image();
          hi.onload = ()=>{
            const swap = ()=>{
              if(slide.dataset.full !== full){ slide.dataset.full = full; }
              slide.src = full;
              slide.classList.remove('lqip');
              slide.classList.add('ready');
            };
            if(hi.decode){ hi.decode().then(swap).catch(swap); } else { swap(); }
          };
          hi.onerror = ()=>{};
          hi.src = full;
        }
      }
      show(0, {instant:true});
      if(thumbCol){
        thumbCol.scrollLeft = 0;
        setupHorizontalWheel(thumbCol);
        thumbCol.addEventListener('click', e=>{
          const t = e.target.closest('img');
          if(!t) return;
          const idx = clampIdx(parseInt(t.dataset.index,10));
          if(currentIdx === idx && t.classList.contains('selected')){
            const fullSrc = t.dataset.full || t.src;
            openImageModal(fullSrc, {images: imgs, startIndex: idx, origin: t});
          } else {
            show(idx);
          }
        });
        thumbCol.addEventListener('keydown', e=>{
          if(e.key==='ArrowDown'){
            e.preventDefault();
            const ni = clampIdx(currentIdx + 1);
            show(ni);
            const nextThumb = thumbCol.querySelector(`img[data-index="${ni}"]`);
            if(nextThumb) nextThumb.focus();
          } else if(e.key==='ArrowUp'){
            e.preventDefault();
            const ni = clampIdx(currentIdx - 1);
            show(ni);
            const prevThumb = thumbCol.querySelector(`img[data-index="${ni}"]`);
            if(prevThumb) prevThumb.focus();
          }
        });
      }
      if(imageBox){
        let dragStartX = null;
        let dragStartY = null;
        let dragActive = false;
        let lastDragTime = 0;
        const resetDragState = ()=>{
          dragStartX = null;
          dragStartY = null;
          dragActive = false;
          if(imageTrack){
            imageTrack.style.transition = '';
          }
        };
        imageBox.addEventListener('click', e=>{
          if(Date.now() - lastDragTime < 400){
            e.preventDefault();
            return;
          }
          const imgTarget = e.target.closest('.image-track img');
          if(!imgTarget) return;
          e.stopPropagation();
          const currentSlide = ensureSlide(currentIdx) || slides[currentIdx] || imgTarget;
          const fullSrc = currentSlide ? (currentSlide.dataset.full || currentSlide.src) : imgs[currentIdx];
          openImageModal(fullSrc, {images: imgs, startIndex: currentIdx, origin: imgTarget});
        });
        imageBox.addEventListener('touchstart', e=>{
          if(e.touches.length !== 1) return;
          dragStartX = e.touches[0].clientX;
          dragStartY = e.touches[0].clientY;
          dragActive = false;
        });
        imageBox.addEventListener('touchmove', e=>{
          if(dragStartX===null || !imageTrack) return;
          const touch = e.touches[0];
          const deltaX = touch.clientX - dragStartX;
          const deltaY = touch.clientY - dragStartY;
          if(!dragActive){
            if(Math.abs(deltaX) < 5) return;
            if(Math.abs(deltaY) > Math.abs(deltaX)){
              resetDragState();
              return;
            }
            dragActive = true;
            imageTrack.style.transition = 'none';
          }
          const width = imageBox.clientWidth || 1;
          let adjustedDelta = deltaX;
          if((currentIdx === 0 && adjustedDelta > 0) || (currentIdx === imgs.length-1 && adjustedDelta < 0)){
            adjustedDelta = 0;
          }
          const deltaPercent = (adjustedDelta / width) * 100;
          const basePercent = -currentIdx * 100;
          imageTrack.style.transform = `translateX(${basePercent + deltaPercent}%)`;
          e.preventDefault();
        }, {passive:false});
        imageBox.addEventListener('touchend', e=>{
          if(dragStartX===null){
            resetDragState();
            return;
          }
          const deltaX = e.changedTouches[0].clientX - dragStartX;
          if(imageTrack){
            imageTrack.style.transition = '';
          }
          if(dragActive){
            const prevIdx = currentIdx;
            let targetIdx = prevIdx;
            const threshold = (imageBox.clientWidth || 1) * 0.15;
            if(deltaX <= -threshold && prevIdx < imgs.length - 1){
              targetIdx = prevIdx + 1;
            } else if(deltaX >= threshold && prevIdx > 0){
              targetIdx = prevIdx - 1;
            }
            lastDragTime = Date.now();
            requestAnimationFrame(()=> show(targetIdx));
          }
          resetDragState();
        });
        imageBox.addEventListener('touchcancel', ()=>{
          if(dragActive && imageTrack){
            imageTrack.style.transition = '';
            requestAnimationFrame(()=> show(currentIdx));
          }
          resetDragState();
        });
      }
      const venueDropdown = el.querySelector(`#venue-${p.id}`);
      const venueBtn = venueDropdown ? venueDropdown.querySelector('.venue-btn') : null;
      const venueMenu = venueDropdown ? venueDropdown.querySelector('.venue-menu') : null;
      const venueOptions = venueMenu ? venueMenu.querySelector('.venue-options') : null;
      let venueCloseTimer = null;
      const venueInfo = el.querySelector(`#venue-info-${p.id}`);
      const sessDropdown = el.querySelector(`#sess-${p.id}`);
      const sessBtn = sessDropdown ? sessDropdown.querySelector('.sess-btn') : null;
      const sessMenu = sessDropdown ? sessDropdown.querySelector('.session-menu') : null;
      const sessionOptions = sessMenu ? sessMenu.querySelector('.session-options') : null;
      const showMenu = menu => { if(menu) menu.removeAttribute('hidden'); };
      const hideMenu = menu => { if(menu) menu.setAttribute('hidden',''); };
      const isMenuOpen = menu => !!(menu && !menu.hasAttribute('hidden'));
      const sessionInfo = el.querySelector(`#session-info-${p.id}`);
      const calendarEl = el.querySelector(`#cal-${p.id}`);
      const mapEl = el.querySelector(`#map-${p.id}`);
      const calContainer = el.querySelector('.calendar-container');
      const calScroll = calContainer ? calContainer.querySelector('.calendar-scroll') : null;
      if(calScroll){
        setupCalendarScroll(calScroll);
      }
      let map, locationMarkers = [], sessionHasMultiple = false, lastClickedCell = null, resizeHandler = null, detailMapRef = null;
      let currentVenueIndex = 0;

      function updateDetailMarkerSelection(selectedIdx = currentVenueIndex){
        if(!Number.isInteger(selectedIdx)){
          selectedIdx = currentVenueIndex;
        }
        locationMarkers.forEach(({ element, index }) => {
          const isSelected = index === selectedIdx;
          element.classList.toggle('is-selected', isSelected);
          element.classList.toggle('is-dimmed', !isSelected);
          element.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        });
      }
      let sessionCloseTimer = null;
      let ensureMapForVenue = async ()=>{};
      const shouldShowExpiredSessions = () => {
        const expiredToggle = document.getElementById('expiredToggle');
        return !!(expiredToggle && expiredToggle.checked);
      };
      const sessionThresholdDate = () => {
        const base = new Date();
        base.setHours(0,0,0,0);
        base.setDate(base.getDate() - 1);
        return base;
      };
      const parseSessionDate = (value) => {
        if(typeof value !== 'string') return new Date(Number.NaN);
        const parts = value.split('-').map(Number);
        const yy = parts[0];
        const mm = parts[1];
        const dd = parts[2];
        return new Date(yy, (mm || 1) - 1, dd || 1);
      };
      function computeVisibleSessionsForLocation(location){
        if(!location || !Array.isArray(location.dates)) return [];
        const showExpired = shouldShowExpiredSessions();
        const threshold = sessionThresholdDate();
        return location.dates
          .map((d,i)=>({d,i}))
          .filter(({d})=>{
            if(!d || typeof d.full !== 'string') return false;
            if(showExpired) return true;
            const parsed = parseSessionDate(d.full);
            return parsed instanceof Date && !Number.isNaN(parsed.getTime()) && parsed >= threshold;
          });
      }
      let visibleVenueState = { byIndex: new Map(), visibleIndices: [] };
      function computeVenueVisibility(){
        const byIndex = new Map();
        const visibleIndices = [];
        locationList.forEach((location, idx) => {
          if(location && Array.isArray(location.dates)){
            location.dates.sort((a,b)=>{
              const fullA = (a && a.full) || '';
              const fullB = (b && b.full) || '';
              const fullCompare = fullA.localeCompare(fullB);
              if(fullCompare !== 0) return fullCompare;
              const timeA = (a && a.time) || '';
              const timeB = (b && b.time) || '';
              return timeA.localeCompare(timeB);
            });
          }
          const visibleSessions = computeVisibleSessionsForLocation(location);
          const hasVisible = visibleSessions.length > 0;
          byIndex.set(idx, { visibleSessions, hasVisible });
          if(venueOptions){
            const button = venueOptions.querySelector(`button[data-index="${idx}"]`);
            if(button){
              button.hidden = !hasVisible;
              if(hasVisible){
                button.removeAttribute('hidden');
                button.disabled = false;
                button.tabIndex = 0;
                button.removeAttribute('aria-hidden');
              } else {
                button.setAttribute('hidden','');
                button.disabled = true;
                button.tabIndex = -1;
                button.setAttribute('aria-hidden','true');
                button.classList.remove('selected');
              }
            }
          }
          if(hasVisible){
            visibleIndices.push(idx);
          }
        });
        visibleVenueState = { byIndex, visibleIndices };
        return visibleVenueState;
      }
      let syncingVenueFromSessions = false;
        function scheduleSessionMenuClose({waitForScroll=false, targetLeft=null}={}){
          if(!sessMenu) return;
          if(sessionCloseTimer){
            clearTimeout(sessionCloseTimer);
            sessionCloseTimer = null;
          }
          const begin = ()=>{
            requestAnimationFrame(()=>requestAnimationFrame(()=>{
              sessionCloseTimer = setTimeout(()=>{
                hideMenu(sessMenu);
                if(sessBtn) sessBtn.setAttribute('aria-expanded','false');
                sessionCloseTimer = null;
              }, 100);
            }));
          };
          if(waitForScroll && calScroll && targetLeft !== null){
            let attempts = 0;
            const maxAttempts = 60;
            const check = ()=>{
              const distance = Math.abs(calScroll.scrollLeft - targetLeft);
              if(distance <= 0.5 || attempts >= maxAttempts){
                begin();
              } else {
                attempts += 1;
                requestAnimationFrame(check);
              }
            };
            requestAnimationFrame(check);
          } else {
            begin();
          }
        }
        if(mapEl && mapEl._detailMap){
          detailMapRef = mapEl._detailMap;
          map = detailMapRef.map || map;
          resizeHandler = detailMapRef.resizeHandler || resizeHandler;
          if(!el._detailMap){
            el._detailMap = detailMapRef;
          }
        }
      function updateVenue(idx){
        const locations = locationList;
        const hasLocations = locations.length > 0;
        let targetIndex = Number.isInteger(idx) ? idx : 0;
        if(hasLocations){
          targetIndex = Math.min(Math.max(targetIndex, 0), locations.length - 1);
        } else {
          targetIndex = 0;
        }
        const visibility = computeVenueVisibility();
        const visibleIndices = visibility.visibleIndices || [];
        const multipleVisible = visibleIndices.length > 1;
        if(visibleIndices.length){
          if(!visibleIndices.includes(targetIndex)){
            targetIndex = visibleIndices[0];
          }
        }
        currentVenueIndex = targetIndex;
        const loc = hasLocations ? locations[targetIndex] : null;

        if(venueOptions){
          const buttons = venueOptions.querySelectorAll('button');
          buttons.forEach((button, optionIndex) => {
            const isSelected = optionIndex === currentVenueIndex && !button.hidden && !button.disabled;
            button.classList.toggle('selected', isSelected);
          });
        }

        if(loc){
          setSelectedVenueHighlight(loc.lng, loc.lat);
        } else {
          setSelectedVenueHighlight();
        }

        updateDetailMarkerSelection(targetIndex);

        if(venueBtn){
          if(loc){
            venueBtn.innerHTML = `<span class="venue-name">${loc.venue}</span><span class="address_line">${loc.address}</span>${multipleVisible?'<span class="results-arrow" aria-hidden="true"></span>':''}`;
          } else {
            venueBtn.innerHTML = `<span class="venue-name">${p.city || ''}</span><span class="address_line">${p.city || ''}</span>`;
          }
        }

        if(venueInfo){
          if(loc){
            venueInfo.innerHTML = `<strong>${loc.venue}</strong><br>${loc.address}`;
          } else {
            venueInfo.innerHTML = '';
          }
        }

        const hasDates = loc && Array.isArray(loc.dates) && loc.dates.length;
        if(!hasDates){
          sessionHasMultiple = false;
          if(sessionInfo){
            sessionInfo.innerHTML = '';
          }
          ensureMapForVenue();
          return;
        }

        loc.dates.sort((a,b)=>{
          const fullA = (a && a.full) || '';
          const fullB = (b && b.full) || '';
          const fullCompare = fullA.localeCompare(fullB);
          if(fullCompare !== 0) return fullCompare;
          const timeA = (a && a.time) || '';
          const timeB = (b && b.time) || '';
          return timeA.localeCompare(timeB);
        });

        const currentYear = new Date().getFullYear();
        const parseDate = s => parseSessionDate(s);
        const formatDate = d => {
          const y = parseDate(d.full).getFullYear();
          return y !== currentYear ? `${d.date}, ${y}` : d.date;
        };

        if(venueInfo){
          venueInfo.innerHTML = `<strong>${loc.venue}</strong><br>${loc.address}`;
        }
        if(venueBtn){
          venueBtn.innerHTML = `<span class="venue-name">${loc.venue}</span><span class="address_line">${loc.address}</span>${multipleVisible?'<span class="results-arrow" aria-hidden="true"></span>':''}`;
        }

        let cal = null;
        let selectedIndex = null;
        let dateStrings = [];
        let allowedSet = new Set();
        let minDate = null;
        let maxDate = null;
        let months = [];
        let visibleDateEntries = [];
        let defaultInfoHTML = '';

        function recomputeVisibleDateData(visibilityState){
          if(!loc || !Array.isArray(loc.dates)){
            visibleDateEntries = [];
            dateStrings = [];
            allowedSet = new Set();
            minDate = null;
            maxDate = null;
            months = [];
            return;
          }
          const snapshot = visibilityState || computeVenueVisibility();
          const entry = snapshot && snapshot.byIndex ? snapshot.byIndex.get(currentVenueIndex) : null;
          visibleDateEntries = entry && Array.isArray(entry.visibleSessions)
            ? entry.visibleSessions.map(({ d, i }) => ({ d, i }))
            : [];

          const seen = new Set();
          const uniqueEntries = [];
          visibleDateEntries.forEach(({d}) => {
            if(!d || typeof d.full !== 'string') return;
            if(seen.has(d.full)) return;
            const parsed = parseDate(d.full);
            if(!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) return;
            seen.add(d.full);
            uniqueEntries.push({ iso: d.full, date: parsed });
          });

          dateStrings = uniqueEntries.map(entry => entry.iso);
          allowedSet = new Set(dateStrings);
          if(uniqueEntries.length){
            minDate = new Date(uniqueEntries[0].date.getTime());
            maxDate = new Date(uniqueEntries[uniqueEntries.length - 1].date.getTime());
          } else {
            minDate = null;
            maxDate = null;
          }

          months = [];
          if(minDate && maxDate){
            const cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
            const limit = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
            while(cursor <= limit){
              months.push(new Date(cursor.getTime()));
              cursor.setMonth(cursor.getMonth() + 1);
            }
          }
        }

        function refreshDefaultSessionInfo(){
          const visible = visibleDateEntries;
          sessionHasMultiple = visible.length > 1;
          if(!sessionInfo){
            defaultInfoHTML = '';
            return;
          }
          const suffix = '<span style="display:inline-block;margin-left:10px;">(Select Session)</span>';
          if(visible.length){
            const firstDate = visible[0].d;
            const lastDate = visible[visible.length - 1].d;
            const rangeText = `${formatDate(firstDate)} - ${formatDate(lastDate)}`;
            defaultInfoHTML = `<div>💲 ${loc.price} | 📅 ${rangeText}${suffix}</div>`;
          } else if(Array.isArray(loc.dates) && loc.dates.length){
            defaultInfoHTML = `<div>💲 ${loc.price}${suffix}</div>`;
          } else {
            defaultInfoHTML = '';
          }
          sessionInfo.innerHTML = defaultInfoHTML;
        }

        function markSelected(){
          if(!calendarEl) return;
          calendarEl.querySelectorAll('.day').forEach(d=> d.classList.remove('selected'));
          if(selectedIndex!==null){
            const dt = loc.dates[selectedIndex];
            const cell = calendarEl.querySelector(`.day[data-iso="${dt.full}"]`);
            if(cell) cell.classList.add('selected');
          }
        }

        function scrollCalendarToMonth(dt, {smooth=false}={}){
          if(!dt || !calendarEl || !calScroll) return null;
          const cell = calendarEl.querySelector(`.day[data-iso="${dt.full}"]`);
          if(!cell) return null;
          const monthEl = cell.closest('.month');
          if(!monthEl) return null;
          const currentLeft = calScroll.scrollLeft;
          let targetLeft = monthEl.offsetLeft;
          if(typeof monthEl.getBoundingClientRect === 'function' && typeof calScroll.getBoundingClientRect === 'function'){
            const monthRect = monthEl.getBoundingClientRect();
            const scrollRect = calScroll.getBoundingClientRect();
            const delta = monthRect.left - scrollRect.left;
            const adjusted = currentLeft + delta;
            if(Number.isFinite(adjusted)){
              targetLeft = adjusted;
            }
          }
          const maxLeft = Math.max(0, calScroll.scrollWidth - calScroll.clientWidth);
          targetLeft = Math.min(Math.max(targetLeft, 0), maxLeft);
          const distance = Math.abs(currentLeft - targetLeft);
          if(typeof calScroll.scrollTo === 'function'){
            if(smooth && distance > 1){
              calScroll.scrollTo({left: targetLeft, behavior: 'smooth'});
              return {targetLeft, waitForScroll: true};
            }
            calScroll.scrollTo({left: targetLeft});
          } else {
            calScroll.scrollLeft = targetLeft;
          }
          return {targetLeft, waitForScroll: false};
        }

        function selectSession(i){
          if(!sessMenu || !sessionOptions) return;
          selectedIndex = Number.isInteger(i) ? i : null;
          sessionOptions.querySelectorAll('button').forEach(b=> b.classList.remove('selected'));
          const btn = selectedIndex !== null ? sessionOptions.querySelector(`button[data-index="${selectedIndex}"]`) : null;
          if(btn) btn.classList.add('selected');
          const dt = selectedIndex !== null ? loc.dates[selectedIndex] : null;
          let waitForScroll = false;
          let targetScrollLeft = null;
          if(dt){
            if(sessionInfo){
              sessionInfo.innerHTML = `<div><strong>${formatDate(dt)} ${dt.time}</strong></div><div>Adults $20, Kids $10, Pensioners $15</div><div>🎫 Buy at venue | ♿ Accessible | 👶 Kid-friendly</div>`;
            }
            if(sessBtn){
              sessBtn.innerHTML = `<span class="session-date">${formatDate(dt)}</span><span class="session-time">${dt.time}</span>${sessionHasMultiple?'<span class="results-arrow" aria-hidden="true"></span>':''}`;
            }
            markSelected();
            const scrollResult = scrollCalendarToMonth(dt, {smooth: true});
            if(scrollResult){
              targetScrollLeft = scrollResult.targetLeft;
              waitForScroll = scrollResult.waitForScroll;
            }
          } else {
            if(sessionInfo){
              sessionInfo.innerHTML = defaultInfoHTML;
            }
            if(sessBtn){
              sessBtn.innerHTML = sessionHasMultiple ? 'Select Session<span class="results-arrow" aria-hidden="true"></span>' : 'Select Session';
              sessBtn.setAttribute('aria-expanded','false');
            }
            markSelected();
          }
          if(isMenuOpen(sessMenu)){
            scheduleSessionMenuClose({waitForScroll, targetLeft: targetScrollLeft});
          } else if(sessBtn){
            sessBtn.setAttribute('aria-expanded','false');
          }
        }

        function showTimePopup(matches){
          if(!calContainer) return;
          const existing = calContainer.querySelector('.time-popup');
          if(existing) existing.remove();
          const popup = document.createElement('div');
          popup.className = 'time-popup';
          popup.innerHTML = `<div class="time-list">${matches.map(m=>`<button data-index="${m.i}">${m.d.time}</button>`).join('')}</div>`;
          calContainer.appendChild(popup);
          if(lastClickedCell){
            const rect = lastClickedCell.getBoundingClientRect();
            const containerRect = calContainer.getBoundingClientRect();
            popup.style.left = (rect.left - containerRect.left) + 'px';
            popup.style.top = (rect.bottom - containerRect.top + 4) + 'px';
          }
          popup.querySelectorAll('button').forEach(b=> b.addEventListener('click',()=>{ selectSession(parseInt(b.dataset.index,10)); popup.remove(); }));
          setTimeout(()=> document.addEventListener('click', function handler(e){ if(!popup.contains(e.target)){ popup.remove(); document.removeEventListener('click', handler); } }),0);
        }

        function renderMonth(monthDate){
          if(!cal) return;
          const monthEl = document.createElement('div');
          monthEl.className='month';
          const header = document.createElement('div');
          header.className='calendar-header';
          header.textContent = monthDate.toLocaleDateString('en-GB',{month:'long',year:'numeric'});
          monthEl.appendChild(header);
          const grid = document.createElement('div');
          grid.className='grid';
          ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(wd=>{
            const w=document.createElement('div');
            w.className='weekday';
            w.textContent=wd;
            grid.appendChild(w);
          });
          const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(),1);
          const startDow = firstDay.getDay();
          const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth()+1,0).getDate();
          const totalCells = 42;
          for(let i=0;i<totalCells;i++){
            const cell=document.createElement('div');
            cell.className='day';
            const dayNum=i-startDow+1;
            if(i<startDow || dayNum>daysInMonth){
              cell.classList.add('empty');
            }else{
              cell.textContent=dayNum;
              const dateObj=new Date(monthDate.getFullYear(), monthDate.getMonth(), dayNum);
              const iso=toISODate(dateObj);
              cell.dataset.iso = iso;
              if(allowedSet.has(iso)){
                cell.classList.add('available-day');
                cell.addEventListener('mousedown',()=>{ lastClickedCell = cell; });
                cell.addEventListener('click',()=>{
                  const matches = visibleDateEntries.filter(entry => entry.d.full === iso);
                  if(matches.length===1){ selectSession(matches[0].i); }
                  else if(matches.length>1){ showTimePopup(matches); }
                });
              } else {
                cell.classList.add('empty');
              }
              if(isToday(dateObj)) cell.classList.add('today');
            }
            grid.appendChild(cell);
          }
          monthEl.appendChild(grid);
          cal.appendChild(monthEl);
        }

        function buildCalendarShell(){
          if(!calendarEl) return;
          calendarEl.innerHTML='';
          cal = document.createElement('div');
          cal.className='calendar';
          calendarEl.appendChild(cal);
          if(!calendarEl._calendarClickStopper){
            calendarEl.addEventListener('click', e=> e.stopPropagation());
            calendarEl._calendarClickStopper = true;
          }
        }

        function finalizeCalendar(){
          markSelected();
        }

        function renderCalendar(){
          if(!calendarEl) return;
          buildCalendarShell();
          months.forEach(monthDate => renderMonth(monthDate));
          finalizeCalendar();
        }

        function updateSessionOptionsList(){
          if(!loc || !Array.isArray(loc.dates)){
            visibleDateEntries = [];
            if(sessionOptions){
              sessionOptions.innerHTML = '';
            }
            if(sessBtn){
              sessBtn.textContent = 'Select Session';
              sessBtn.setAttribute('aria-expanded','false');
            }
            if(sessionInfo){
              sessionInfo.innerHTML = defaultInfoHTML;
            }
            return;
          }
          const visibility = computeVenueVisibility();
          const visibleIndices = visibility.visibleIndices || [];
          if(!syncingVenueFromSessions && visibleIndices.length && !visibleIndices.includes(currentVenueIndex)){
            const fallbackIndex = visibleIndices[0];
            if(fallbackIndex !== undefined){
              syncingVenueFromSessions = true;
              try{
                updateVenue(fallbackIndex);
              } finally {
                syncingVenueFromSessions = false;
              }
              return;
            }
          }
          recomputeVisibleDateData(visibility);
          refreshDefaultSessionInfo();
          if(calContainer){
            const existingPopup = calContainer.querySelector('.time-popup');
            if(existingPopup) existingPopup.remove();
          }
          lastClickedCell = null;
          if(calendarEl){
            renderCalendar();
          }

          const visibleDates = visibleDateEntries;

          if(sessionOptions){
            sessionOptions.innerHTML = visibleDates
              .map(({d,i})=> `<button data-index="${i}"><span class="session-date">${formatDate(d)}</span><span class="session-time">${d.time}</span></button>`)
              .join('');
          }

          if(sessMenu){
            sessMenu.scrollTop = 0;
          }

          const hasVisible = visibleDates.length > 0;

          const selectedIsVisible = visibleDates.some(({i})=> i === selectedIndex);
          if(!selectedIsVisible){
            selectedIndex = null;
          }

          if(sessionHasMultiple){
            selectedIndex = null;
            markSelected();
            if(sessionInfo) sessionInfo.innerHTML = defaultInfoHTML;
            if(sessBtn){
              sessBtn.innerHTML = 'Select Session<span class="results-arrow" aria-hidden="true"></span>';
              sessBtn.setAttribute('aria-expanded','false');
            }
          } else if(hasVisible){
            selectSession(visibleDates[0].i);
          } else {
            selectedIndex = null;
            markSelected();
            if(sessionInfo) sessionInfo.innerHTML = defaultInfoHTML;
            if(sessBtn){
              sessBtn.textContent = 'Select Session';
              sessBtn.setAttribute('aria-expanded','false');
            }
          }

          if(sessionOptions){
            sessionOptions.querySelectorAll('button').forEach(btn=>{
              btn.addEventListener('click', ()=> selectSession(parseInt(btn.dataset.index,10)));
            });
          }

          try{
            if(typeof ensureMapForVenue === 'function'){
              ensureMapForVenue();
            }
          }catch(err){}

          setTimeout(()=>{
            if(map && typeof map.resize === 'function') map.resize();
          },0);
        }

        function attachSessionButtonHandler(){
          if(!sessBtn || !sessMenu) return;
          const handler = ()=>{
            const expanded = sessBtn.getAttribute('aria-expanded') === 'true';
            const opening = !expanded;
            sessBtn.setAttribute('aria-expanded', String(opening));
            if(opening){
              showMenu(sessMenu);
              if(selectedIndex !== null){
                const dt = loc.dates[selectedIndex];
                if(dt){
                  requestAnimationFrame(()=> scrollCalendarToMonth(dt));
                }
              }
            } else {
              hideMenu(sessMenu);
            }
          };
          if(sessBtn._sessionToggle){
            sessBtn.removeEventListener('click', sessBtn._sessionToggle);
          }
          sessBtn._sessionToggle = handler;
          sessBtn.addEventListener('click', handler);
        }

        ensureMapForVenue = async function(){
          if(!mapEl) return;

          const visibility = computeVenueVisibility();
          const visibleIndices = Array.isArray(visibility.visibleIndices) ? visibility.visibleIndices : [];
          const locationEntries = locationList
            .map((location, idx) => ({ location, idx }))
            .filter(entry => entry.location && Number.isFinite(entry.location.lng) && Number.isFinite(entry.location.lat));
          const allIndicesVisible = visibleIndices.length > 0 && visibleIndices.length === locationEntries.length;
          const allowedIndices = allIndicesVisible ? null : new Set(visibleIndices);
          const effectiveEntries = allowedIndices
            ? locationEntries.filter(entry => allowedIndices.has(entry.idx))
            : locationEntries;

          if(!effectiveEntries.length){
            locationMarkers.forEach(({ marker }) => { try{ marker.remove(); }catch(e){} });
            locationMarkers = [];
            return;
          }

          const selectedEntry = effectiveEntries.find(entry => entry.idx === currentVenueIndex) || effectiveEntries[0];
          if(!selectedEntry){
            locationMarkers.forEach(({ marker }) => { try{ marker.remove(); }catch(e){} });
            locationMarkers = [];
            return;
          }

          const selectedIdx = selectedEntry.idx;
          const selectedLoc = selectedEntry.location;
          const center = [selectedLoc.lng, selectedLoc.lat];
          const subId = subcategoryMarkerIds[p.subcategory] || slugify(p.subcategory);
          const markerUrl = subcategoryMarkers[subId];

          const assignDetailRef = ()=>{
            detailMapRef = detailMapRef || {};
            detailMapRef.map = map;
            detailMapRef.resizeHandler = resizeHandler;
            if(mapEl){
              mapEl._detailMap = detailMapRef;
              mapEl.__map = map;
            }
            if(el){
              el._detailMap = detailMapRef;
            }
            if(map){
              MapRegistry.register(map);
            }
          };

          const refreshMarkers = () => {
            if(!map) return;
            locationMarkers.forEach(({ marker }) => { try{ marker.remove(); }catch(e){} });
            locationMarkers = [];
            effectiveEntries.forEach(({ location, idx }) => {
              if(!Number.isFinite(location.lng) || !Number.isFinite(location.lat)){
                return;
              }
              let element;
              if(markerUrl){
                element = new Image();
                element.src = markerUrl;
                element.alt = '';
                element.decoding = 'async';
              } else {
                element = document.createElement('div');
                element.style.background = '#0f172a';
              }
              element.classList.add('post-location-marker');
              element.dataset.index = String(idx);
              element.tabIndex = 0;
              element.setAttribute('role', 'button');
              element.setAttribute('aria-pressed', 'false');
              element.setAttribute('aria-label', `${location.venue} (${location.address})`);
              element.addEventListener('click', () => {
                if(idx === currentVenueIndex) return;
                updateVenue(idx);
              });
              element.addEventListener('keydown', evt => {
                if(evt.key === 'Enter' || evt.key === ' ' || evt.key === 'Spacebar'){
                  evt.preventDefault();
                  element.click();
                }
              });
              const markerInstance = new mapboxgl.Marker({ element, anchor: 'center' }).setLngLat([location.lng, location.lat]).addTo(map);
              locationMarkers.push({ marker: markerInstance, element, index: idx });
            });
            updateDetailMarkerSelection(selectedIdx);
          };

          const fitToLocations = () => {
            if(!map || !effectiveEntries.length){
              return;
            }
            const validPoints = effectiveEntries
              .map(entry => entry.location)
              .filter(location => Number.isFinite(location.lng) && Number.isFinite(location.lat));
            if(!validPoints.length){
              return;
            }
            if(validPoints.length === 1){
              try{
                map.setCenter([validPoints[0].lng, validPoints[0].lat]);
                map.setZoom(10);
              }catch(e){}
              return;
            }
            try{
              const bounds = validPoints.reduce((acc, location) => {
                if(acc){
                  acc.extend([location.lng, location.lat]);
                  return acc;
                }
                return new mapboxgl.LngLatBounds([location.lng, location.lat], [location.lng, location.lat]);
              }, null);
              if(bounds){
                map.fitBounds(bounds, { padding: 40, duration: 0, maxZoom: 10 });
              }
            }catch(e){}
          };

          if(!map){
            setTimeout(async () => {
              if(map) {
                refreshMarkers();
                fitToLocations();
                return;
              }

              await ensureMapboxCssFor(mapEl);

              if (mapEl && mapEl.__map && typeof mapEl.__map.remove === 'function') {
                try { mapEl.__map.remove(); } catch {}
                mapEl.__map = null;
              }
              locationMarkers.forEach(({ marker }) => { try{ marker.remove(); }catch(e){} });
              locationMarkers = [];

              map = new mapboxgl.Map({
                container: mapEl,
                style: mapStyle,
                center,
                zoom: 3,
                interactive: false
              });

              const ensureDetailIcon = attachIconLoader(map);

              const pendingDetailStyleImageRequests = new Map();

              const handleDetailStyleImageMissing = (evt) => {
                const imageId = evt && evt.id;
                if(!imageId){
                  return;
                }
                try{
                  if(map.hasImage?.(imageId)){
                    return;
                  }
                }catch(err){
                  console.error(err);
                }
                if(pendingDetailStyleImageRequests.has(imageId)){
                  return;
                }
                const result = generateMarkerImageFromId(imageId, map, { ensureIcon: ensureDetailIcon });
                if(result && typeof result.then === 'function'){
                  const task = result.then(output => {
                    if(!output){
                      return;
                    }
                    const { image, options } = output;
                    if(!image){
                      return;
                    }
                    try{
                      if(map.hasImage?.(imageId)){
                        return;
                      }
                      map.addImage(imageId, image, options || {});
                    }catch(error){
                      console.error(error);
                    }
                  }).catch(error => {
                    console.error(error);
                  }).finally(() => {
                    pendingDetailStyleImageRequests.delete(imageId);
                  });
                  pendingDetailStyleImageRequests.set(imageId, task);
                  return;
                }
                if(result && result.image){
                  try{
                    if(!map.hasImage?.(imageId)){
                      map.addImage(imageId, result.image, result.options || {});
                    }
                  }catch(error){
                    console.error(error);
                  }
                }
              };

              map.on('mousemove', (e) => {
                const has = !!(e.features && e.features.length);
                map.getCanvas().style.cursor = has ? 'pointer' : '';
              });

              armPointerOnSymbolLayers(map);

              const applyDetailStyleAdjustments = () => {
                applyNightSky(map);
                patchMapboxStyleArtifacts(map);
              };
              whenStyleReady(map, applyDetailStyleAdjustments);
              map.on('style.load', applyDetailStyleAdjustments);
              map.on('styledata', () => {
                if(map.isStyleLoaded && map.isStyleLoaded()){
                  patchMapboxStyleArtifacts(map);
                }
              });

              try{ map.on('styleimagemissing', handleDetailStyleImageMissing); }
              catch(err){ console.error(err); }

              if(resizeHandler){
                window.removeEventListener('resize', resizeHandler);
              }
              resizeHandler = ()=>{ if(map) map.resize(); };
              window.addEventListener('resize', resizeHandler);

              const ready = () => {
                refreshMarkers();
                fitToLocations();
              };
              if(map.loaded()){
                ready();
              } else {
                map.once('load', ready);
              }

              assignDetailRef();

              setTimeout(()=>{ if(map && typeof map.resize === 'function') map.resize(); },0);
            }, 0);
          } else {
            refreshMarkers();
            fitToLocations();
            setTimeout(()=> map && map.resize(),0);
            assignDetailRef();
          }
        };
        window.ensureMapForVenue = ensureMapForVenue;

        const expiredToggle = document.getElementById('expiredToggle');
        if(expiredToggle){
          const handler = ()=> updateSessionOptionsList();
          if(expiredToggle._detailExpiredHandler){
            expiredToggle.removeEventListener('change', expiredToggle._detailExpiredHandler);
          }
          expiredToggle._detailExpiredHandler = handler;
          expiredToggle.addEventListener('change', handler);
        }

        if(sessMenu){
          const filterHandler = ()=> updateSessionOptionsList();
          if(sessMenu._detailSessionFilterHandler){
            ['sessionfilterchange','sessionfilterreset'].forEach(evt => {
              sessMenu.removeEventListener(evt, sessMenu._detailSessionFilterHandler);
            });
          }
          sessMenu._detailSessionFilterHandler = filterHandler;
          ['sessionfilterchange','sessionfilterreset'].forEach(evt => {
            sessMenu.addEventListener(evt, filterHandler);
          });
        }

        const tasks = [];
        if(mapEl){
          tasks.push(()=> {
            const ensure = typeof window.callWhenDefined === 'function'
              ? window.callWhenDefined
              : function(name, cb, timeoutMs){
                  const start = performance.now(), max = timeoutMs ?? 5000;
                  (function check(){
                    const fn = window[name];
                    if (typeof fn === 'function') { try { cb(fn); } catch(e){} return; }
                    if (performance.now() - start < max) requestAnimationFrame(check);
                  })();
                };
            ensure('ensureMapForVenue', fn => fn());
          });
        }
        tasks.push(()=> updateSessionOptionsList());
        tasks.push(()=> attachSessionButtonHandler());

        function runNext(){
          const task = tasks.shift();
          if(!task) return;
          const start = performance.now();
          try{ task(); }catch(err){}
          if(performance.now() - start > 6){
            setTimeout(runNext, 0);
          } else {
            runNext();
          }
        }
        runNext();
      }

      window.updateVenue = updateVenue;
      window.ensureMapForVenue = ensureMapForVenue;
      if(typeof window.__wrapForInputYield === 'function'){
        window.__wrapForInputYield('updateVenue');
        window.__wrapForInputYield('ensureMapForVenue');
      }

        if(mapEl){
          setTimeout(()=>{
            loadMapbox().then(()=>{
              updateVenue(0);
              if(venueMenu && venueBtn && venueOptions){
                venueOptions.querySelectorAll('button').forEach(btn=>{
                  const btnIndex = parseInt(btn.dataset.index, 10);
                  const isVisible = !btn.hidden && !btn.disabled;
                  btn.classList.toggle('selected', isVisible && btnIndex === currentVenueIndex);
                  btn.addEventListener('click', ()=>{
                    if(btn.hidden || btn.disabled){
                      hideMenu(venueMenu);
                      venueBtn.setAttribute('aria-expanded','false');
                      return;
                    }
                    const targetIndex = parseInt(btn.dataset.index, 10);
                    if(!Number.isInteger(targetIndex)){
                      return;
                    }
                    if(targetIndex === currentVenueIndex){
                      if(venueCloseTimer){
                        clearTimeout(venueCloseTimer);
                      }
                      venueCloseTimer = setTimeout(()=>{
                        hideMenu(venueMenu);
                        venueBtn.setAttribute('aria-expanded','false');
                        venueCloseTimer = null;
                      }, 100);
                      return;
                    }
                    venueOptions.querySelectorAll('button').forEach(b=> b.classList.remove('selected'));
                    btn.classList.add('selected');
                    updateVenue(targetIndex);
                    if(venueCloseTimer){
                      clearTimeout(venueCloseTimer);
                    }
                    venueCloseTimer = setTimeout(()=>{
                      hideMenu(venueMenu);
                      venueBtn.setAttribute('aria-expanded','false');
                      venueCloseTimer = null;
                    }, 100);
                  });
                });
                venueBtn.addEventListener('click', ()=>{
                  const expanded = venueBtn.getAttribute('aria-expanded') === 'true';
                  const opening = !expanded;
                  venueBtn.setAttribute('aria-expanded', String(opening));
                  if(opening){
                    showMenu(venueMenu);
                  } else {
                    hideMenu(venueMenu);
                  }
                  if(opening){
                    const adjustMap = ()=>{
                      if(map && typeof map.resize === 'function') map.resize();
                      if(typeof ensureMapForVenue === 'function') ensureMapForVenue();
                    };
                    if(typeof requestAnimationFrame === 'function'){
                      requestAnimationFrame(adjustMap);
                    } else {
                      setTimeout(adjustMap, 0);
                    }
                  }
                });
                document.addEventListener('click', e=>{ if(venueDropdown && !venueDropdown.contains(e.target)){ hideMenu(venueMenu); venueBtn.setAttribute('aria-expanded','false'); } });
              }
              if(sessBtn && sessMenu){
                if(!sessDropdown._sessionOutsideHandler){
                  const outsideHandler = e=>{
                    if(sessDropdown && !sessDropdown.contains(e.target)){
                      hideMenu(sessMenu);
                      sessBtn.setAttribute('aria-expanded','false');
                    }
                  };
                  sessDropdown._sessionOutsideHandler = outsideHandler;
                  document.addEventListener('click', outsideHandler);
                }
              }
              if(map && typeof map.resize === 'function') map.resize();
            }).catch(err => console.error(err));
          },0);
        }
    }

    function inBounds(p){
      if(!postPanel) return true;
      return p.lng >= postPanel.getWest() && p.lng <= postPanel.getEast() &&
             p.lat >= postPanel.getSouth() && p.lat <= postPanel.getNorth();
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

    // applyFilters();
    setMode(mode);
    if(historyWasActive && mode === 'posts'){
      document.body.classList.add('show-history');
      adjustBoards();
    }
    window.addEventListener('beforeunload', () => {
      localStorage.setItem('mode', mode);
      localStorage.setItem('historyActive', document.body.classList.contains('show-history') ? 'true' : 'false');
    });
  })();
  
// 0577 helpers (safety)
function isPortrait(id){ let h=0; for(let i=0;i<id.length;i++){ h=(h<<5)-h+id.charCodeAt(i); h|=0; } return Math.abs(h)%2===0; }
function heroUrl(p){ const id = (typeof p==='string')? p : p.id; const port=isPortrait(id); return `https://picsum.photos/seed/${encodeURIComponent(id)}-t/${port?'800/1200':'1200/800'}`; }
function thumbUrl(p){ const id = (typeof p==='string')? p : p.id; const port=isPortrait(id); return `https://picsum.photos/seed/${encodeURIComponent(id)}-t/${port?'200/300':'300/200'}`; }
function getViewportHeight(){
  return window.innerHeight || document.documentElement.clientHeight || 0;
}
const panelStack = [];
function bringToTop(item){
  const idx = panelStack.indexOf(item);
  if(idx!==-1) panelStack.splice(idx,1);
  panelStack.push(item);
  panelStack.forEach((p,i)=>{
    if(p instanceof Element){ p.style.zIndex = 2000 + i; }
  });
}
function registerPopup(p){
  bringToTop(p);
  if(typeof p.on==='function'){
    p.on('close',()=>{
      const i = panelStack.indexOf(p);
      if(i!==-1) panelStack.splice(i,1);
    });
  }
  const el = p.getElement && p.getElement();
  if(el){
    el.addEventListener('mousedown', ()=> bringToTop(p));
  }
}
function savePanelState(m){
  if(!m || !m.id || m.id === 'welcome-modal') return;
  const content = m.querySelector('.panel-content');
  if(!content) return;
  const state = {
    left: content.style.left,
    top: content.style.top,
    width: content.style.width,
    height: content.style.height
  };
  localStorage.setItem(`panel-${m.id}`, JSON.stringify(state));
}
function loadPanelState(m){
  if(!m || !m.id) return false;
  const content = m.querySelector('.panel-content');
  if(!content) return false;
  const saved = JSON.parse(localStorage.getItem(`panel-${m.id}`) || 'null');
  if(saved){
    ['width','height','left','top'].forEach(prop=>{
      if(saved[prop]) content.style[prop] = saved[prop];
    });
    if(saved.left || saved.top) content.style.transform = 'none';
    return true;
  }
  return false;
}
const panelButtons = {
  filterPanel: 'filterBtn',
  memberPanel: 'memberBtn',
  adminPanel: 'adminBtn'
};

const panelScrollOverlayItems = new Set();

function updatePanelScrollOverlay(target){
  if(!target || !target.isConnected) return;
  const overlayWidth = target.offsetWidth - target.clientWidth;
  const value = overlayWidth > 0 ? `${overlayWidth}px` : '0px';
  target.style.setProperty('--panel-scrollbar-overlay', value);
}

function registerPanelScrollOverlay(target){
  if(!target || panelScrollOverlayItems.has(target)) return;
  panelScrollOverlayItems.add(target);
  updatePanelScrollOverlay(target);
  if('ResizeObserver' in window){
    const observer = new ResizeObserver(()=> updatePanelScrollOverlay(target));
    observer.observe(target);
  }
  target.addEventListener('scroll', ()=> updatePanelScrollOverlay(target), { passive: true });
}

function refreshPanelScrollOverlays(){
  document.querySelectorAll('.panel-body').forEach(registerPanelScrollOverlay);
  panelScrollOverlayItems.forEach(updatePanelScrollOverlay);
}

document.addEventListener('DOMContentLoaded', ()=>{
  refreshPanelScrollOverlays();
  window.addEventListener('resize', ()=>{
    requestAnimationFrame(()=>{
      panelScrollOverlayItems.forEach(updatePanelScrollOverlay);
    });
  });
});

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

function schedulePanelEntrance(content, force=false){
  if(!content) return;
  if(force){
    content.classList.remove('panel-visible');
  }
  content.style.transform = '';
  if(force || !content.classList.contains('panel-visible')){
    requestAnimationFrame(()=>{
      if(!content.isConnected) return;
      content.classList.add('panel-visible');
    });
  }
}
function openPanel(m){
  if(!m) return;
  if(m.id === 'adminPanel' && window.adminAuthManager && !window.adminAuthManager.isAuthenticated()){
    window.adminAuthManager.ensureAuthenticated();
    return;
  }
  const content = m.querySelector('.panel-content') || m.querySelector('.modal-content');
  if(content && m.id !== 'welcome-modal'){
    content.style.width = '';
    content.style.height = '';
  }
  let shouldScheduleEntrance = false;
  if(content){
    const rootStyles = getComputedStyle(document.documentElement);
    const headerH = parseFloat(rootStyles.getPropertyValue('--header-h')) || 0;
    const subH = parseFloat(rootStyles.getPropertyValue('--subheader-h')) || 0;
    const footerH = parseFloat(rootStyles.getPropertyValue('--footer-h')) || 0;
    const safeTop = parseFloat(rootStyles.getPropertyValue('--safe-top')) || 0;
    const viewportHeight = getViewportHeight();
    const innerWidth = window.innerWidth;
    if(m.id==='adminPanel' || m.id==='memberPanel'){
      const topPos = headerH + safeTop;
      const availableHeight = Math.max(0, viewportHeight - footerH - topPos);
      content.style.left='auto';
      content.style.right='0';
      content.style.top=`${topPos}px`;
      content.style.bottom=`${footerH}px`;
      content.style.maxHeight = availableHeight ? `${availableHeight}px` : '';
      content.dataset.side='right';
      if(!content.classList.contains('panel-visible')){
        content.classList.remove('panel-visible');
        shouldScheduleEntrance = true;
      }
    } else if(m.id==='filterPanel'){
      const topPos = headerH + subH + safeTop;
      if(innerWidth < 450){
        content.style.left='0';
        content.style.right='0';
        content.style.top=`${topPos}px`;
        content.style.bottom=`${footerH}px`;
        content.style.maxHeight='';
      } else {
        const availableHeight = Math.max(0, viewportHeight - footerH - topPos);
        content.style.left='0';
        content.style.right='';
        content.style.top=`${topPos}px`;
        content.style.bottom='';
        content.style.maxHeight = availableHeight ? `${availableHeight}px` : '';
      }
      content.dataset.side='left';
      if(!content.classList.contains('panel-visible')){
        content.classList.remove('panel-visible');
        shouldScheduleEntrance = true;
      }
    } else if(m.id==='welcome-modal'){
      const topPos = headerH + safeTop + 10;
      content.style.left='50%';
      content.style.top=`${topPos}px`;
      content.style.transform='translateX(-50%)';
    } else {
      content.style.left='50%';
      content.style.top='50%';
      content.style.transform='translate(-50%, -50%)';
      if(m.id !== 'welcome-modal' && !['adminPanel','memberPanel','filterPanel'].includes(m.id)){
        loadPanelState(m);
      }
    }
  }
  m.classList.add('show');
  m.removeAttribute('aria-hidden');
  m.removeAttribute('inert');
  if(m.id === 'welcome-modal'){
    const mc = document.querySelector('.map-controls-map');
    if(mc) mc.style.display = 'none';
  }
  const btnId = panelButtons[m && m.id];
  if(btnId){
    const btn = document.getElementById(btnId);
    btn && btn.setAttribute('aria-pressed','true');
  }
  localStorage.setItem(`panel-open-${m.id}`,'true');
  if(content && shouldScheduleEntrance){
    schedulePanelEntrance(content);
  }
  if(!m.__bringToTopAdded){
    m.addEventListener('mousedown', ()=> bringToTop(m));
    m.__bringToTopAdded = true;
  }
  bringToTop(m);
  if(map && typeof map.resize === 'function') setTimeout(()=> map.resize(),0);
  if(typeof window.adjustBoards === 'function') setTimeout(()=> window.adjustBoards(), 0);
  if(typeof window.updateHeaderMapControls === 'function') window.updateHeaderMapControls();
  if(content){
    requestAnimationFrame(()=> refreshPanelScrollOverlays());
  }
}

const memberPanelChangeManager = (()=>{
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
      promptSaveButton = prompt.querySelector('.confirm-save');
      promptDiscardButton = prompt.querySelector('.confirm-discard');
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

  function closePrompt(){
    if(prompt){
      const active = document.activeElement;
      if(active && prompt.contains(active)){
        let focusTarget = null;
        if(pendingCloseTarget && typeof pendingCloseTarget.querySelector === 'function'){
          focusTarget = pendingCloseTarget.querySelector('.close-panel, .primary-action, button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
        }
        if(!focusTarget && panel && typeof panel.querySelector === 'function'){
          focusTarget = panel.querySelector('.close-panel, .primary-action, button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
        }
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
    }
  }

  function cancelPrompt(){
    pendingCloseTarget = null;
    closePrompt();
  }

  function openPrompt(target){
    pendingCloseTarget = target || panel;
    if(prompt){
      prompt.classList.add('show');
      prompt.setAttribute('aria-hidden','false');
      prompt.removeAttribute('inert');
      setTimeout(()=>{
        if(promptSaveButton) promptSaveButton.focus();
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