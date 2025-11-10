      const initialVenueName = loc0.venue || '';
      const initialVenueAddress = loc0.address || '';
      const venueLabelText = initialVenueName || initialVenueAddress
        ? `Venue: ${initialVenueName}${initialVenueAddress ? `, ${initialVenueAddress}` : ''}`
        : 'Select venue';
      const sessionLabelText = 'Select Session';
      const sessionAriaText = `Select session for ${p.title}`;
      const venueAriaAttr = escapeAttrValue(venueLabelText);
      const sessionAriaAttr = escapeAttrValue(sessionAriaText);
              <div id="venue-${p.id}" class="venue-dropdown options-dropdown">
                <button class="venue-btn" aria-haspopup="true" aria-expanded="false" aria-label="${venueAriaAttr}">
                  <img src="assets/Map Screenshot.png" alt="" class="dropdown-image" aria-hidden="true">
                  <span class="dropdown-label">
                    <span class="venue-name">${initialVenueName}</span>
                    <span class="address_line">${initialVenueAddress}</span>
                  </span>
                  <span class="results-arrow${locationList.length>1?'':' is-hidden'}" aria-hidden="true"></span>
                </button>
                <div class="venue-menu post-venue-menu" hidden><div class="map-container"><div id="map-${p.id}" class="post-map"></div></div><div class="venue-options">${locationList.map((loc,i)=>`<button data-index="${i}"><span class="venue-name">${loc.venue}</span><span class="address_line">${loc.address}</span></button>`).join('')}</div></div>
              </div>
              <div id="sess-${p.id}" class="session-dropdown options-dropdown">
                <button class="sess-btn" aria-haspopup="true" aria-expanded="false" aria-label="${sessionAriaAttr}">
                  <img src="assets/Calendar Screenshot.png" alt="" class="dropdown-image" aria-hidden="true">
                  <span class="dropdown-label">
                    <span class="session-date">${sessionLabelText}</span>
                    <span class="session-time"></span>
                  </span>
                  <span class="results-arrow is-hidden" aria-hidden="true"></span>
                </button>
                <div class="session-menu options-menu" hidden><div class="calendar-container"><div class="calendar-scroll"><div id="cal-${p.id}" class="post-calendar"></div></div></div><div class="session-options"></div></div>
              </div>
      const venueNameEl = venueBtn ? venueBtn.querySelector('.venue-name') : null;
      const venueAddressEl = venueBtn ? venueBtn.querySelector('.address_line') : null;
      const venueArrowEl = venueBtn ? venueBtn.querySelector('.results-arrow') : null;
      const sessionDateEl = sessBtn ? sessBtn.querySelector('.session-date') : null;
      const sessionTimeEl = sessBtn ? sessBtn.querySelector('.session-time') : null;
      const sessionArrowEl = sessBtn ? sessBtn.querySelector('.results-arrow') : null;
      const defaultSessionAriaLabel = `Select session for ${p.title}`;
      const defaultVenueAriaLabel = venueLabelText;
      function setVenueButtonState({ name = '', address = '', showArrow = false, ariaLabel = defaultVenueAriaLabel }){
        if(venueNameEl) venueNameEl.textContent = name || '';
        if(venueAddressEl) venueAddressEl.textContent = address || '';
        if(venueArrowEl){
          venueArrowEl.classList.toggle('is-hidden', !showArrow);
        }
        if(venueBtn && ariaLabel){
          venueBtn.setAttribute('aria-label', ariaLabel);
        }
      }

      function setSessionButtonState({ label = sessionLabelText, time = '', showArrow = false, ariaLabel = defaultSessionAriaLabel }){
        if(sessionDateEl) sessionDateEl.textContent = label || '';
        if(sessionTimeEl) sessionTimeEl.textContent = time || '';
        if(sessionArrowEl){
          sessionArrowEl.classList.toggle('is-hidden', !showArrow);
        }
        if(sessBtn && ariaLabel){
          sessBtn.setAttribute('aria-label', ariaLabel);
        }
      }

        let venueButtonName = '';
        let venueButtonAddress = '';
        let venueButtonAriaLabel = 'Select venue';
        let showVenueArrow = false;

        if(loc){
          venueButtonName = loc.venue || '';
          venueButtonAddress = loc.address || '';
          showVenueArrow = multipleVisible;
          venueButtonAriaLabel = venueButtonName || venueButtonAddress
            ? `Venue: ${venueButtonName}${venueButtonAddress ? `, ${venueButtonAddress}` : ''}`
            : 'Select venue';
        } else {
          const fallback = p.city || '';
          venueButtonName = fallback;
          venueButtonAddress = fallback;
          showVenueArrow = multipleVisible && locations.length > 1;
          if(fallback){
            venueButtonAriaLabel = `Venue: ${fallback}`;
        if(venueBtn){
          setVenueButtonState({
            name: venueButtonName,
            address: venueButtonAddress,
            showArrow: showVenueArrow,
            ariaLabel: venueButtonAriaLabel
          });
        }

              const sessionLabel = formatDate(dt);
              const timeLabel = dt.time || '';
              const ariaLabel = `Selected session ${sessionLabel}${timeLabel ? ` ${timeLabel}` : ''} for ${p.title}`;
              setSessionButtonState({
                label: sessionLabel,
                time: timeLabel,
                showArrow: sessionHasMultiple,
                ariaLabel
              });
              setSessionButtonState({
                label: sessionLabelText,
                time: '',
                showArrow: sessionHasMultiple,
                ariaLabel: defaultSessionAriaLabel
              });
          if(sessionOptions){
            sessionOptions.innerHTML = '';
          }
          if(sessBtn){
            setSessionButtonState({
              label: sessionLabelText,
              time: '',
              showArrow: false,
              ariaLabel: defaultSessionAriaLabel
            });
            sessBtn.setAttribute('aria-expanded','false');
          }
          if(sessionInfo){
            sessionInfo.innerHTML = defaultInfoHTML;
          }
              setSessionButtonState({
                label: sessionLabelText,
                time: '',
                showArrow: true,
                ariaLabel: defaultSessionAriaLabel
              });
              setSessionButtonState({
                label: sessionLabelText,
                time: '',
                showArrow: false,
                ariaLabel: defaultSessionAriaLabel
              });
