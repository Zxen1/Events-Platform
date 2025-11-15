(function(){
  "use strict";
  
  // Wait for DOM and dependencies
  function init(){
    if(typeof window === "undefined" || typeof document === "undefined"){
      setTimeout(init, 100);
      return;
    }
    
    // Check for required dependencies
    if(typeof getBaseFieldType !== "function" || typeof getMessage !== "function" || typeof normalizeFormbuilderSnapshot !== "function"){
      console.warn("Member forms: Waiting for dependencies...");
      setTimeout(init, 100);
      return;
    }
    
    // Also wait for persistedFormbuilderSnapshotPromise to be available
    const snapshotPromise = (typeof window !== 'undefined' && window.persistedFormbuilderSnapshotPromise) 
      ? window.persistedFormbuilderSnapshotPromise 
      : (typeof window !== 'undefined' && window.__persistedFormbuilderSnapshotPromise)
        ? window.__persistedFormbuilderSnapshotPromise
        : null;
    if(!snapshotPromise){
      console.warn("Member forms: Waiting for formbuilder snapshot promise...");
      setTimeout(init, 100);
      return;
    }
    
    const memberCreateSection = document.getElementById('memberTab-create');
    if(memberCreateSection){
      const formpickerCats = document.getElementById('memberFormpickerCats');
      const emptyState = document.getElementById('memberCreateEmpty');
      const formWrapper = document.getElementById('memberCreateFormWrapper');
      const formFields = document.getElementById('memberCreateFormFields');
      const postButton = document.getElementById('memberCreatePostBtn');
      const memberForm = document.getElementById('memberForm');
    
    let selectedCategory = '';
    let selectedSubcategory = '';

    let currentCreateFields = [];
    let createStatusTimer = 0;
    let isSubmittingCreatePost = false;

    function normalizePositiveInteger(value){
      if(typeof value === 'number' && Number.isFinite(value) && value > 0){
        return Math.floor(value);
      }
      if(typeof value === 'string'){
        const trimmed = value.trim();
        if(!trimmed) return null;
        const numeric = Number(trimmed);
        if(Number.isFinite(numeric) && numeric > 0){
          return Math.floor(numeric);
        }
      }
      return null;
    }

    function getConnectorApiKey(memberCandidate){
      const extractFromObject = source => {
        if(!source || typeof source !== 'object') return '';
        const keys = ['apiKey','api_key','connectorKey','connector_key','key','api'];
        for(const key of keys){
          const value = source[key];
          if(typeof value === 'string'){
            const trimmed = value.trim();
            if(trimmed){
              return trimmed;
            }
          }
        }
        return '';
      };

      const direct = extractFromObject(memberCandidate);
      if(direct){
        getConnectorApiKey.cached = direct;
        return direct;
      }

      if(typeof getConnectorApiKey.cached === 'string'){
        return getConnectorApiKey.cached;
      }

      const candidates = [];

      if(typeof window !== 'undefined'){
        candidates.push(
          window.FUNMAP_CONNECTOR_API_KEY,
          window.FUNMAP_API_KEY,
          window.FUNMAP_CONNECTOR_KEY,
          window.API_KEY
        );
        if(window.funmapConnector && typeof window.funmapConnector === 'object'){
          const obj = window.funmapConnector;
          ['apiKey','connectorKey','key'].forEach(prop => {
            if(typeof obj[prop] === 'string'){
              candidates.push(obj[prop]);
            }
          });
        }
        if(window.funmapConfig && typeof window.funmapConfig === 'object'){
          const obj = window.funmapConfig;
          ['apiKey','connectorKey','key'].forEach(prop => {
            if(typeof obj[prop] === 'string'){
              candidates.push(obj[prop]);
            }
          });
        }
      }

      if(typeof document !== 'undefined'){
        const htmlDataset = document.documentElement && document.documentElement.dataset
          ? document.documentElement.dataset.funmapApiKey
          : '';
        const bodyDataset = document.body && document.body.dataset
          ? document.body.dataset.funmapApiKey
          : '';
        candidates.push(htmlDataset, bodyDataset);
        if(typeof document.querySelector === 'function'){
          const meta = document.querySelector('meta[name="funmap-api-key"], meta[name="funmap-connector-key"], meta[name="x-api-key"]');
          if(meta && typeof meta.content === 'string'){
            candidates.push(meta.content);
          }
        }
      }

      const storageKeys = [
        'funmap-api-key',
        'FUNMAP_API_KEY',
        'funmapConnectorApiKey',
        'FUNMAP_CONNECTOR_API_KEY',
        'connector-api-key',
        'CONNECTOR_API_KEY'
      ];

      const storageProviders = [
        () => {
          try { return typeof localStorage !== 'undefined' ? localStorage : null; }
          catch(err){ return null; }
        },
        () => {
          try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; }
          catch(err){ return null; }
        }
      ];

      storageProviders.forEach(getter => {
        const store = getter();
        if(!store) return;
        storageKeys.forEach(key => {
          try {
            const value = store.getItem(key);
            if(typeof value === 'string'){
              candidates.push(value);
            }
          } catch(err){}
        });
      });

      for(const candidate of candidates){
        if(typeof candidate === 'string'){
          const trimmed = candidate.trim();
          if(trimmed){
            getConnectorApiKey.cached = trimmed;
            return trimmed;
          }
        }
      }

      getConnectorApiKey.cached = '';
      return '';
    }

    async function uploadMediaForPost(postId, memberId, uploadEntries, memberCandidate){
      const normalizedPostId = normalizePositiveInteger(postId);
      const normalizedMemberId = normalizePositiveInteger(memberId);
      const result = { uploaded: [], errors: [] };

      if(!Array.isArray(uploadEntries) || uploadEntries.length === 0){
        return result;
      }

      if(!normalizedPostId){
        result.errors.push({ message: 'Missing post ID for media uploads.' });
        return result;
      }

      const filesWithContext = [];
      uploadEntries.forEach(entry => {
        if(!entry || typeof entry !== 'object') return;
        const files = Array.isArray(entry.files) ? entry.files : [];
        const label = typeof entry.label === 'string' ? entry.label : '';
        files.forEach(file => {
          if(!file) return;
          const isFileInstance = typeof File !== 'undefined' ? file instanceof File : true;
          if(isFileInstance || typeof file === 'object'){
            filesWithContext.push({ file, label });
          }
        });
      });

      if(filesWithContext.length === 0){
        return result;
      }

      const apiKey = getConnectorApiKey(memberCandidate);
      const endpoint = '/gateway.php?action=upload-media';
      const memberIdToSend = normalizedMemberId !== null ? normalizedMemberId : 0;

      for(let index = 0; index < filesWithContext.length; index += 1){
        const context = filesWithContext[index];
        const { file, label } = context;
        const formData = new FormData();
        formData.set('post_id', String(normalizedPostId));
        formData.set('member_id', String(memberIdToSend));
        const explicitName = file && typeof file.name === 'string' && file.name.trim()
          ? file.name
          : `upload-${index + 1}`;
        try {
          formData.set('file', file, explicitName);
        } catch(err){
          try {
            formData.set('file', file);
          } catch(fallbackErr){
            result.errors.push({ file, label, message: 'Unable to prepare image upload payload.', detail: fallbackErr });
            continue;
          }
        }

        const requestOptions = { method: 'POST', body: formData };
        if(apiKey){
          requestOptions.headers = { 'X-API-Key': apiKey };
        }

        let response;
        try {
          response = await fetch(endpoint, requestOptions);
        } catch(networkError){
          result.errors.push({ file, label, message: 'Network error during image upload.', detail: networkError });
          continue;
        }

        let responseText = '';
        try {
          responseText = await response.text();
        } catch(readError){
          result.errors.push({ file, label, message: 'Unable to read upload response.', detail: readError });
          continue;
        }

        let payload = null;
        if(responseText){
          try {
            payload = JSON.parse(responseText);
          } catch(parseError){
            payload = null;
          }
        }

        if(!response.ok || !payload || payload.success === false){
          const fallbackMessage = payload && typeof payload === 'object'
            ? (typeof payload.error === 'string' && payload.error.trim()
              ? payload.error.trim()
              : (typeof payload.message === 'string' && payload.message.trim()
                ? payload.message.trim()
                : 'Upload failed.'))
            : (response.ok ? 'Upload failed.' : `Upload failed (HTTP ${response.status}).`);
          result.errors.push({
            file,
            label,
            message: fallbackMessage,
            detail: payload,
            status: response.status,
            responseText
          });
          continue;
        }

        result.uploaded.push({ file, label, response: payload });
      }

      if(result.errors.length && !apiKey){
        console.warn('Media uploads failed; no API key was available for verification.');
      }

      return result;
    }

    // Fields now come from backend via field_types table, no hardcoded defaults

    const normalizeVenueSessionOptionsFromWindow = typeof window.normalizeVenueSessionOptions === 'function'
      ? window.normalizeVenueSessionOptions
      : normalizeVenueSessionOptions;
    const cloneVenueSessionVenueFromWindow = typeof window.cloneVenueSessionVenue === 'function'
      ? window.cloneVenueSessionVenue
      : cloneVenueSessionVenue;

    async function showCreateStatus(message, options = {}){
      const statusEl = document.getElementById('memberStatusMessage');
      if(!statusEl || typeof message !== 'string') return;
      const isError = !!options.error;
      
      // If message looks like a message key (starts with 'msg_'), fetch from DB
      let displayMessage = message;
      if(typeof message === 'string' && message.startsWith('msg_')){
        displayMessage = await getMessage(message, options.placeholders || {}, false) || message;
      }
      
      statusEl.textContent = displayMessage;
      statusEl.classList.remove('error','success','show');
      statusEl.classList.add(isError ? 'error' : 'success');
      statusEl.setAttribute('aria-hidden','false');
      void statusEl.offsetWidth;
      statusEl.classList.add('show');
      if(createStatusTimer){
        clearTimeout(createStatusTimer);
      }
      createStatusTimer = window.setTimeout(()=>{
        statusEl.classList.remove('show');
        statusEl.classList.remove('error','success');
        statusEl.setAttribute('aria-hidden','true');
      }, 2400);
    }

    function loadCurrentMember(){
      try{
        const raw = localStorage.getItem('member-auth-current');
        if(!raw) return null;
        const parsed = JSON.parse(raw);
        if(!parsed || typeof parsed !== 'object') return null;
        return {
          id: typeof parsed.id === 'number' ? parsed.id : null,
          username: typeof parsed.username === 'string' ? parsed.username : '',
          email: typeof parsed.email === 'string' ? parsed.email : '',
          name: typeof parsed.name === 'string' ? parsed.name : '',
          type: parsed.type === 'admin' ? 'admin' : 'member'
        };
      }catch(err){
        return null;
      }
    }

    function collectCurrencyCodes(snapshot){
      const codes = new Set();
      const cats = snapshot && Array.isArray(snapshot.categories) ? snapshot.categories : [];
      cats.forEach(cat => {
        if(!cat || typeof cat !== 'object') return;
        const subFields = cat.subFields && typeof cat.subFields === 'object' ? cat.subFields : {};
        Object.values(subFields).forEach(fields => {
          if(!Array.isArray(fields)) return;
          fields.forEach(field => {
            if(!field || typeof field !== 'object') return;
            if(field.type === 'variant-pricing'){
              const options = Array.isArray(field.options) ? field.options : [];
              options.forEach(opt => {
                const code = opt && typeof opt.currency === 'string' ? opt.currency.trim().toUpperCase() : '';
                if(code) codes.add(code);
              });
            } else if(field.type === 'venue-ticketing'){
              const venues = Array.isArray(field.options) ? field.options : [];
              venues.forEach(venue => {
                const sessions = Array.isArray(venue && venue.sessions) ? venue.sessions : [];
                sessions.forEach(session => {
                  const times = Array.isArray(session && session.times) ? session.times : [];
                  times.forEach(time => {
                    const versions = Array.isArray(time && time.versions) ? time.versions : [];
                    versions.forEach(version => {
                      const tiers = Array.isArray(version && version.tiers) ? version.tiers : [];
                      tiers.forEach(tier => {
                        const code = tier && typeof tier.currency === 'string' ? tier.currency.trim().toUpperCase() : '';
                        if(code) codes.add(code);
                      });
                    });
                  });
                });
              });
            }
          });
        });
      });
      return Array.from(codes);
    }

    const defaultEmptyMessage = emptyState ? emptyState.textContent : '';
    // Messages will be loaded from DB when needed

    // NO DEFAULT SNAPSHOT - only use backend data
    let memberSnapshot = null; // Will be set from backend only
    let memberCategories = [];
    let currencyCodes = [];
    let fieldIdCounter = 0;
    let memberSnapshotErrorMessage = '';

    function setEmptyStateMessage(message){
      if(!emptyState) return;
      if(typeof message === 'string' && message.trim()){
        emptyState.textContent = message;
      } else {
        emptyState.textContent = defaultEmptyMessage;
      }
    }

    function applyMemberSnapshot(snapshot, options = {}){
      if(!snapshot || typeof snapshot !== 'object'){
        throw new Error('Invalid snapshot provided to applyMemberSnapshot');
      }
      const normalized = normalizeFormbuilderSnapshot(snapshot);
      memberSnapshot = normalized;
      memberCategories = Array.isArray(memberSnapshot.categories) ? memberSnapshot.categories : [];
      currencyCodes = collectCurrencyCodes(memberSnapshot);
      if(options.populate !== false){
        renderFormPicker();
      }
    }

    function ensureCurrencyOptions(select){
      if(!select) return;
      const preserveValue = select.value;
      const options = Array.from(select.options || []);
      options.forEach(opt => {
        if(opt.value){
          select.removeChild(opt);
        }
      });
      currencyCodes.forEach(code => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = code;
        select.appendChild(opt);
      });
      if(preserveValue && currencyCodes.includes(preserveValue)){
        select.value = preserveValue;
      } else {
        select.value = '';
      }
    }

    function refreshMemberSnapshotFromManager(){
      if(window.formbuilderStateManager && typeof window.formbuilderStateManager.capture === 'function'){
        try{
          const snapshot = window.formbuilderStateManager.capture();
          if(snapshot && typeof snapshot === 'object'){
            memberSnapshotErrorMessage = '';
            applyMemberSnapshot(snapshot, { preserveSelection: true });
            return;
          }
        }catch(err){
          console.error('Failed to capture latest formbuilder snapshot', err);
        }
      }
      // Only apply if memberSnapshot is valid
      if(memberSnapshot && typeof memberSnapshot === 'object'){
        applyMemberSnapshot(memberSnapshot, { preserveSelection: true });
      } else {
        console.warn('Cannot refresh member snapshot - no valid snapshot available');
      }
    }

    // NO DEFAULT SNAPSHOT - memberSnapshot will be set from backend via initializeMemberFormbuilderSnapshot()
    // Don't apply a default snapshot - wait for backend data

    function formatPriceValue(value){
      const raw = (value || '').replace(/[^0-9.,]/g, '').replace(/,/g, '.');
      if(!raw) return '';
      const parts = raw.split('.');
      let integer = parts[0] || '';
      integer = integer.replace(/\./g, '');
      if(!integer) integer = '0';
      let fraction = parts[1] || '';
      fraction = fraction.replace(/\./g, '').slice(0, 2);
      if(fraction.length === 0){
        fraction = '00';
      } else if(fraction.length === 1){
        fraction = `${fraction}0`;
      }
      return `${integer}.${fraction}`;
    }

    function sanitizeCreateField(field){
      const safe = {
        name: '',
        type: 'text-box',
        placeholder: '',
        required: false,
        options: []
      };
      if(field && typeof field === 'object'){
        if(typeof field.name === 'string'){
          safe.name = field.name.trim();
        }
        let type = typeof field.type === 'string' ? field.type : 'text-box';
        const originalType = type;
        
        // Check for description/text-area FIRST, before any normalization
        // This ensures they're preserved even if they come in different formats
        const isDescriptionType = type === 'description' || type === 'text-area' ||
                                 (typeof type === 'string' && (type.includes('description') || type.includes('text-area')));
        
        if(isDescriptionType){
          // Normalize but preserve description/text-area
          const normalizedType = getBaseFieldType(type);
          if(normalizedType === 'description' || normalizedType === 'text-area'){
            safe.type = normalizedType;
          } else if(type === 'description' || type === 'text-area'){
            safe.type = type;
          } else {
            // Extract description/text-area from the type string
            safe.type = type.includes('description') ? 'description' : 'text-area';
          }
        } else {
          // Normalize field type to extract base type (e.g., "description [field=2]" -> "description")
          const normalizedType = getBaseFieldType(type);
          if(normalizedType){
            type = normalizedType;
          }
          // Validate against FORM_FIELD_TYPES
          if(!(typeof window !== 'undefined' && Array.isArray(window.FORM_FIELD_TYPES) ? window.FORM_FIELD_TYPES : []).some(opt => opt.value === type)){
            type = 'text-box';
          }
          safe.type = type;
        }
        if(typeof field.placeholder === 'string'){
          safe.placeholder = field.placeholder;
        }
        safe.required = !!field.required;
        if(type === 'variant-pricing'){
          const options = Array.isArray(field.options) ? field.options : [];
          safe.options = options.map(opt => ({
            version: opt && typeof opt.version === 'string' ? opt.version : '',
            currency: opt && typeof opt.currency === 'string' ? opt.currency : '',
            price: opt && typeof opt.price === 'string' ? opt.price : ''
          }));
          if(safe.options.length === 0){
            safe.options.push({ version: '', currency: '', price: '' });
          }
        } else if(type === 'dropdown' || type === 'radio-toggle'){
          const options = Array.isArray(field.options) ? field.options : [];
          safe.options = options.map(opt => {
            if(typeof opt === 'string') return opt;
            if(opt && typeof opt === 'object' && typeof opt.version === 'string') return opt.version;
            return '';
          });
          if(safe.options.length === 0){
            safe.options.push('');
          }
        } else if(type === 'venue-ticketing'){
          const normalized = normalizeVenueSessionOptionsFromWindow(field.options);
          safe.options = normalized.map(cloneVenueSessionVenueFromWindow);
        } else if(type === 'location'){
          const loc = field && field.location && typeof field.location === 'object' ? field.location : {};
          safe.location = {
            address: typeof loc.address === 'string' ? loc.address : '',
            latitude: typeof loc.latitude === 'string' ? loc.latitude : '',
            longitude: typeof loc.longitude === 'string' ? loc.longitude : ''
          };
        } else {
          safe.options = Array.isArray(field.options)
            ? field.options.map(opt => {
                if(typeof opt === 'string') return opt;
                if(opt && typeof opt === 'object'){
                  try{
                    return JSON.parse(JSON.stringify(opt));
                  }catch(err){
                    return { ...opt };
                  }
                }
                return '';
              })
            : [];
        }
      }
      return safe;
    }

    function getFieldsForSelection(categoryName, subcategoryName){
      if(!categoryName || !subcategoryName) return [];
      const category = memberCategories.find(cat => cat && typeof cat.name === 'string' && cat.name === categoryName);
      if(!category) return [];
      const subFieldsMap = category.subFields && typeof category.subFields === 'object' ? category.subFields : {};
      let fields = Array.isArray(subFieldsMap && subFieldsMap[subcategoryName]) ? subFieldsMap[subcategoryName] : [];
      return fields.map(sanitizeCreateField);
    }

    function renderEmptyState(message){
      // Don't hide form wrapper if user is interacting with venue fields
      const activeVenueEditor = document.activeElement && document.activeElement.closest('.venue-session-editor');
      const hasVenueEditor = formFields && formFields.querySelector('.venue-session-editor');
      if(activeVenueEditor || (hasVenueEditor && !message)){
        // User is interacting with venue field, don't close the form
        return;
      }
      
      if(emptyState){
        if(typeof message === 'string'){
          memberSnapshotErrorMessage = message;
          setEmptyStateMessage(message);
        } else if(memberSnapshotErrorMessage){
          setEmptyStateMessage(memberSnapshotErrorMessage);
        } else {
          setEmptyStateMessage();
        }
        emptyState.hidden = false;
      }
      if(formWrapper) formWrapper.hidden = true;
      if(postButton) postButton.disabled = true;
    }

    function buildVersionPriceEditor(field, labelId){
      const options = Array.isArray(field.options) && field.options.length
        ? field.options.map(opt => ({
            version: typeof opt.version === 'string' ? opt.version : '',
            currency: typeof opt.currency === 'string' ? opt.currency : '',
            price: typeof opt.price === 'string' ? opt.price : ''
          }))
        : [{ version: '', currency: '', price: '' }];

      const editor = document.createElement('div');
      editor.className = 'form-preview-variant-pricing variant-pricing-options-editor';
      editor.setAttribute('role', 'group');
      editor.setAttribute('aria-labelledby', labelId);

      const list = document.createElement('div');
      list.className = 'variant-pricing-options-list';
      editor.appendChild(list);

      function addRow(option){
        const row = document.createElement('div');
        row.className = 'variant-pricing-option';

        const topRow = document.createElement('div');
        topRow.className = 'variant-pricing-row variant-pricing-row--top';
        const versionInput = document.createElement('input');
        versionInput.type = 'text';
        versionInput.className = 'variant-pricing-name form-preview-variant-pricing-name';
        versionInput.placeholder = 'Version Name';
        versionInput.value = option.version || '';
        versionInput.addEventListener('input', ()=>{ option.version = versionInput.value; });
        topRow.appendChild(versionInput);

        const bottomRow = document.createElement('div');
        bottomRow.className = 'variant-pricing-row variant-pricing-row--bottom';
        const currencySelect = document.createElement('select');
        currencySelect.className = 'variant-pricing-currency';
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = 'Currency';
        currencySelect.appendChild(emptyOption);
        currencyCodes.forEach(code => {
          const opt = document.createElement('option');
          opt.value = code;
          opt.textContent = code;
          currencySelect.appendChild(opt);
        });
        currencySelect.value = option.currency || '';
        currencySelect.addEventListener('change', ()=>{ option.currency = currencySelect.value; });

        const priceInput = document.createElement('input');
        priceInput.type = 'text';
        priceInput.className = 'variant-pricing-price form-preview-variant-pricing-price';
        priceInput.placeholder = '0.00';
        priceInput.value = option.price || '';
        priceInput.addEventListener('blur', ()=>{
          option.price = formatPriceValue(priceInput.value);
          priceInput.value = option.price;
        });

        bottomRow.append(currencySelect, priceInput);

        const actions = document.createElement('div');
        actions.className = 'variant-pricing-option-actions';
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'member-create-secondary-btn';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', ()=>{
          if(options.length <= 1){
            option.version = '';
            option.currency = '';
            option.price = '';
            versionInput.value = '';
            currencySelect.value = '';
            priceInput.value = '';
            return;
          }
          const idx = options.indexOf(option);
          if(idx !== -1){
            options.splice(idx, 1);
          }
          row.remove();
        });
        actions.appendChild(removeBtn);

        row.append(topRow, bottomRow, actions);
        list.appendChild(row);
      }

      options.forEach(addRow);

      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'member-create-secondary-btn';
      addBtn.textContent = 'Add Version';
      addBtn.addEventListener('click', ()=>{
        const option = { version: '', currency: '', price: '' };
        options.push(option);
        addRow(option);
      });

      editor.appendChild(addBtn);
      return editor;
    }

    function buildVenueSessionEditor(field, labelId){
      const cloneVenueSessionVenueFn = typeof window !== 'undefined' && typeof window.cloneVenueSessionVenue === 'function' ? window.cloneVenueSessionVenue : (v => v);
      const venueSessionCreateVenueFn = typeof window !== 'undefined' && typeof window.venueSessionCreateVenue === 'function' ? window.venueSessionCreateVenue : (() => ({ name: '', address: '', sessions: [] }));
      const venues = Array.isArray(field.options) && field.options.length ? field.options.map(cloneVenueSessionVenueFn) : [venueSessionCreateVenueFn()];
      const editor = document.createElement('div');
      editor.className = 'venue-session-editor';
      editor.setAttribute('role', 'group');
      editor.setAttribute('aria-labelledby', labelId);
      // Prevent clicks inside the venue editor from bubbling up and potentially closing the form
      editor.addEventListener('click', (e)=>{ e.stopPropagation(); }, true);
      editor.addEventListener('pointerdown', (e)=>{ e.stopPropagation(); }, true);
      editor.addEventListener('mousedown', (e)=>{ e.stopPropagation(); }, true);
      editor.addEventListener('change', (e)=>{ e.stopPropagation(); }, true);
      editor.addEventListener('focusin', (e)=>{ e.stopPropagation(); }, true);
      // Generate unique prefix from labelId to ensure unique IDs across multiple editors
      const uniquePrefix = labelId ? labelId.replace(/[^a-zA-Z0-9]/g, '_') : `venue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const venueList = document.createElement('div');
      venueList.className = 'venue-session-venues';
      // Also stop propagation on the venue list
      venueList.addEventListener('click', (e)=>{ e.stopPropagation(); }, true);
      venueList.addEventListener('pointerdown', (e)=>{ e.stopPropagation(); }, true);
      venueList.addEventListener('change', (e)=>{ e.stopPropagation(); }, true);
      editor.appendChild(venueList);
      let addVenueBtn = null;

      function addVenueCard(venue){
        const venueCard = document.createElement('div');
        venueCard.className = 'venue-card';

        const venueHeader = document.createElement('div');
        venueHeader.className = 'venue-line address_line-line';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Venue Name';
        nameInput.value = venue.name || '';
        nameInput.addEventListener('input', (e)=>{ 
          e.stopPropagation();
          venue.name = nameInput.value; 
        });
        nameInput.addEventListener('click', (e)=>{ e.stopPropagation(); });
        nameInput.addEventListener('focus', (e)=>{ e.stopPropagation(); });
        const addressInput = document.createElement('input');
        addressInput.type = 'text';
        addressInput.placeholder = 'Venue Address';
        addressInput.value = venue.address || '';
        addressInput.addEventListener('input', (e)=>{ 
          e.stopPropagation();
          venue.address = addressInput.value; 
        });
        addressInput.addEventListener('click', (e)=>{ e.stopPropagation(); });
        addressInput.addEventListener('focus', (e)=>{ e.stopPropagation(); });
        venueHeader.append(nameInput, addressInput);

        const sessionList = document.createElement('div');
        sessionList.className = 'session-pricing-card-list';

        function addSessionCard(session){
          const sessionCard = document.createElement('div');
          sessionCard.className = 'session-pricing-card';
          const sessionTop = document.createElement('div');
          sessionTop.className = 'session-date-row';
          const dateInput = document.createElement('input');
          dateInput.type = 'date';
          dateInput.value = session.date || '';
          dateInput.addEventListener('change', (e)=>{ 
            e.stopPropagation();
            session.date = dateInput.value; 
          });
          dateInput.addEventListener('click', (e)=>{ e.stopPropagation(); });
          dateInput.addEventListener('focus', (e)=>{ e.stopPropagation(); });
          sessionTop.appendChild(dateInput);

          const sessionActions = document.createElement('div');
          sessionActions.className = 'session-date-actions';
          const removeSessionBtn = document.createElement('button');
          removeSessionBtn.type = 'button';
          removeSessionBtn.className = 'member-create-secondary-btn';
          removeSessionBtn.textContent = 'Remove Session';
          removeSessionBtn.addEventListener('click', (e)=>{
            e.preventDefault();
            e.stopPropagation();
            if(venue.sessions.length <= 1){
              session.date = '';
              dateInput.value = '';
              const venueSessionCreateTimeFn = typeof window !== 'undefined' && typeof window.venueSessionCreateTime === 'function' ? window.venueSessionCreateTime : (() => ({ time: '', versions: [] }));
              session.times = [venueSessionCreateTimeFn()];
              timeList.innerHTML = '';
              session.times.forEach(addTimeCard);
              return;
            }
            const idx = venue.sessions.indexOf(session);
            if(idx !== -1){
              venue.sessions.splice(idx, 1);
            }
            sessionCard.remove();
          });
          sessionActions.appendChild(removeSessionBtn);
          sessionTop.appendChild(sessionActions);
          sessionCard.appendChild(sessionTop);

          const timeList = document.createElement('div');
          timeList.className = 'session-time-list';
          sessionCard.appendChild(timeList);

          function addTimeCard(time){
            const timeCard = document.createElement('div');
            timeCard.className = 'session-time-row';
            const timeHeader = document.createElement('div');
            timeHeader.className = 'session-time-input-wrapper';
            const timeInput = document.createElement('input');
            timeInput.type = 'time';
            timeInput.value = time.time || '';
            timeInput.addEventListener('change', (e)=>{ 
              e.stopPropagation();
              time.time = timeInput.value; 
            });
            timeInput.addEventListener('click', (e)=>{ e.stopPropagation(); });
            timeInput.addEventListener('focus', (e)=>{ e.stopPropagation(); });
            timeHeader.appendChild(timeInput);

            const timeActions = document.createElement('div');
            timeActions.className = 'session-time-actions';
            const removeTimeBtn = document.createElement('button');
            removeTimeBtn.type = 'button';
            removeTimeBtn.className = 'member-create-secondary-btn';
            removeTimeBtn.textContent = 'Remove Time';
          removeTimeBtn.addEventListener('click', (e)=>{
            e.preventDefault();
            e.stopPropagation();
            if(session.times.length <= 1){
              time.time = '';
              timeInput.value = '';
              return;
            }
            const idx = session.times.indexOf(time);
            if(idx !== -1){
              session.times.splice(idx, 1);
            }
            timeCard.remove();
          });
            timeActions.appendChild(removeTimeBtn);
            timeHeader.appendChild(timeActions);
            timeCard.appendChild(timeHeader);

            const versionList = document.createElement('div');
            versionList.className = 'session-version-list';
            timeCard.appendChild(versionList);

            function addVersionCard(version){
              const versionCard = document.createElement('div');
              versionCard.className = 'session-pricing-card version-entry-card';
              const versionNameInput = document.createElement('input');
              versionNameInput.type = 'text';
              versionNameInput.placeholder = 'Version Name';
              versionNameInput.value = version.name || '';
              versionNameInput.addEventListener('input', (e)=>{ 
                e.stopPropagation();
                version.name = versionNameInput.value; 
              });
              versionNameInput.addEventListener('click', (e)=>{ e.stopPropagation(); });
              versionNameInput.addEventListener('focus', (e)=>{ e.stopPropagation(); });
              versionCard.appendChild(versionNameInput);

              const tierList = document.createElement('div');
              tierList.className = 'tier-list';
              versionCard.appendChild(tierList);

              function addTierRow(tier){
                const tierRow = document.createElement('div');
                tierRow.className = 'tier-row';
                const tierNameInput = document.createElement('input');
                tierNameInput.type = 'text';
                tierNameInput.placeholder = 'Tier Name';
                tierNameInput.value = tier.name || '';
                tierNameInput.addEventListener('input', (e)=>{ 
                  e.stopPropagation();
                  tier.name = tierNameInput.value; 
                });
                tierNameInput.addEventListener('click', (e)=>{ e.stopPropagation(); });
                tierNameInput.addEventListener('focus', (e)=>{ e.stopPropagation(); });

                const tierCurrencySelect = document.createElement('select');
                tierCurrencySelect.innerHTML = '<option value="">Currency</option>';
                currencyCodes.forEach(code => {
                  const opt = document.createElement('option');
                  opt.value = code;
                  opt.textContent = code;
                  tierCurrencySelect.appendChild(opt);
                });
                tierCurrencySelect.value = tier.currency || '';
                tierCurrencySelect.addEventListener('change', (e)=>{ 
                  e.stopPropagation();
                  tier.currency = tierCurrencySelect.value; 
                });
                tierCurrencySelect.addEventListener('click', (e)=>{ e.stopPropagation(); });
                tierCurrencySelect.addEventListener('focus', (e)=>{ e.stopPropagation(); });

                const tierPriceInput = document.createElement('input');
                tierPriceInput.type = 'text';
                tierPriceInput.placeholder = '0.00';
                tierPriceInput.value = tier.price || '';
                tierPriceInput.addEventListener('blur', (e)=>{
                  e.stopPropagation();
                  tier.price = formatPriceValue(tierPriceInput.value);
                  tierPriceInput.value = tier.price;
                });
                tierPriceInput.addEventListener('click', (e)=>{ e.stopPropagation(); });
                tierPriceInput.addEventListener('focus', (e)=>{ e.stopPropagation(); });

                const tierActions = document.createElement('div');
                tierActions.className = 'tier-actions';
                const removeTierBtn = document.createElement('button');
                removeTierBtn.type = 'button';
                removeTierBtn.className = 'member-create-secondary-btn';
                removeTierBtn.textContent = 'Remove';
              removeTierBtn.addEventListener('click', (e)=>{
                e.preventDefault();
                e.stopPropagation();
                if(version.tiers.length <= 1){
                  tier.name = '';
                  tier.currency = '';
                  tier.price = '';
                  tierNameInput.value = '';
                  tierCurrencySelect.value = '';
                  tierPriceInput.value = '';
                  return;
                }
                const idx = version.tiers.indexOf(tier);
                if(idx !== -1){
                  version.tiers.splice(idx, 1);
                }
                tierRow.remove();
              });

                tierActions.appendChild(removeTierBtn);
                tierRow.append(tierNameInput, tierCurrencySelect, tierPriceInput, tierActions);
                tierList.appendChild(tierRow);
              }

              if(!Array.isArray(version.tiers) || !version.tiers.length){
                const venueSessionCreateTierFn = typeof window !== 'undefined' && typeof window.venueSessionCreateTier === 'function' ? window.venueSessionCreateTier : (() => ({ name: '', currency: '', price: '' }));
                version.tiers = [venueSessionCreateTierFn()];
              }
              version.tiers.forEach(addTierRow);

              const versionActions = document.createElement('div');
              versionActions.className = 'version-actions';
              const addTierBtn = document.createElement('button');
              addTierBtn.type = 'button';
              addTierBtn.className = 'member-create-secondary-btn';
              addTierBtn.textContent = 'Add Tier';
              addTierBtn.addEventListener('click', (e)=>{
                e.preventDefault();
                e.stopPropagation();
                const venueSessionCreateTierFn = typeof window !== 'undefined' && typeof window.venueSessionCreateTier === 'function' ? window.venueSessionCreateTier : (() => ({ name: '', currency: '', price: '' }));
                const tier = venueSessionCreateTierFn();
                version.tiers.push(tier);
                addTierRow(tier);
              });
              const removeVersionBtn = document.createElement('button');
              removeVersionBtn.type = 'button';
              removeVersionBtn.className = 'member-create-secondary-btn';
              removeVersionBtn.textContent = 'Remove Version';
              removeVersionBtn.addEventListener('click', (e)=>{
                e.preventDefault();
                e.stopPropagation();
                if(time.versions.length <= 1){
                  version.name = '';
                  versionNameInput.value = '';
                  version.tiers.forEach(tier => {
                    tier.name = '';
                    tier.currency = '';
                    tier.price = '';
                  });
                  tierList.innerHTML = '';
                  version.tiers.forEach(addTierRow);
                  return;
                }
                const idx = time.versions.indexOf(version);
                if(idx !== -1){
                  time.versions.splice(idx, 1);
                }
                versionCard.remove();
              });
              versionActions.append(addTierBtn, removeVersionBtn);
              versionCard.appendChild(versionActions);
              versionList.appendChild(versionCard);
            }

            if(!Array.isArray(time.versions) || !time.versions.length){
              const venueSessionCreateVersionFn = typeof window !== 'undefined' && typeof window.venueSessionCreateVersion === 'function' ? window.venueSessionCreateVersion : (() => ({ name: '', tiers: [] }));
              time.versions = [venueSessionCreateVersionFn()];
            }
            time.versions.forEach(addVersionCard);

            const timeFooter = document.createElement('div');
            timeFooter.className = 'session-time-actions';
            const addVersionBtn = document.createElement('button');
            addVersionBtn.type = 'button';
            addVersionBtn.className = 'member-create-secondary-btn';
            addVersionBtn.textContent = 'Add Version';
            addVersionBtn.addEventListener('click', (e)=>{
              e.preventDefault();
              e.stopPropagation();
              const venueSessionCreateVersionFn = typeof window !== 'undefined' && typeof window.venueSessionCreateVersion === 'function' ? window.venueSessionCreateVersion : (() => ({ name: '', tiers: [] }));
              const version = venueSessionCreateVersionFn();
              time.versions.push(version);
              addVersionCard(version);
            });
            timeFooter.appendChild(addVersionBtn);
            timeCard.appendChild(timeFooter);
            timeList.appendChild(timeCard);
          }

          if(!Array.isArray(session.times) || !session.times.length){
            const venueSessionCreateTimeFn = typeof window !== 'undefined' && typeof window.venueSessionCreateTime === 'function' ? window.venueSessionCreateTime : (() => ({ time: '', versions: [] }));
            session.times = [venueSessionCreateTimeFn()];
          }
          session.times.forEach(addTimeCard);

          const sessionFooterActions = document.createElement('div');
          sessionFooterActions.className = 'session-date-actions';
          const addTimeBtn = document.createElement('button');
          addTimeBtn.type = 'button';
          addTimeBtn.className = 'member-create-secondary-btn';
          addTimeBtn.textContent = 'Add Time Slot';
          addTimeBtn.addEventListener('click', (e)=>{
            e.preventDefault();
            e.stopPropagation();
            const venueSessionCreateTimeFn = typeof window !== 'undefined' && typeof window.venueSessionCreateTime === 'function' ? window.venueSessionCreateTime : (() => ({ time: '', versions: [] }));
            const time = venueSessionCreateTimeFn();
            session.times.push(time);
            addTimeCard(time);
          });
          sessionFooterActions.appendChild(addTimeBtn);
          sessionCard.appendChild(sessionFooterActions);
          sessionList.appendChild(sessionCard);
        }

        if(!Array.isArray(venue.sessions) || !venue.sessions.length){
          const venueSessionCreateSessionFn = typeof window !== 'undefined' && typeof window.venueSessionCreateSession === 'function' ? window.venueSessionCreateSession : (() => ({ date: '', times: [] }));
          venue.sessions = [venueSessionCreateSessionFn()];
        }
        venue.sessions.forEach(addSessionCard);

        const venueActions = document.createElement('div');
        venueActions.className = 'venue-line-actions';
        const addSessionBtn = document.createElement('button');
        addSessionBtn.type = 'button';
        addSessionBtn.className = 'member-create-secondary-btn';
        addSessionBtn.textContent = 'Add Session';
        addSessionBtn.addEventListener('click', (e)=>{
          e.preventDefault();
          e.stopPropagation();
          const venueSessionCreateSessionFn = typeof window !== 'undefined' && typeof window.venueSessionCreateSession === 'function' ? window.venueSessionCreateSession : (() => ({ date: '', times: [] }));
          const session = venueSessionCreateSessionFn();
          venue.sessions.push(session);
          addSessionCard(session);
        });
        const removeVenueBtn = document.createElement('button');
        removeVenueBtn.type = 'button';
        removeVenueBtn.className = 'member-create-secondary-btn';
        removeVenueBtn.textContent = 'Remove Venue';
        removeVenueBtn.addEventListener('click', (e)=>{
          e.preventDefault();
          e.stopPropagation();
          if(venues.length <= 1){
            venue.name = '';
            venue.address = '';
            nameInput.value = '';
            addressInput.value = '';
            return;
          }
          const idx = venues.indexOf(venue);
          if(idx !== -1){
            venues.splice(idx, 1);
          }
          venueCard.remove();
        });
        venueActions.append(addSessionBtn, removeVenueBtn);

        venueCard.append(venueHeader, sessionList, venueActions);
        if(addVenueBtn){
          venueList.insertBefore(venueCard, addVenueBtn);
        } else {
          venueList.appendChild(venueCard);
        }
      }

      venues.forEach(addVenueCard);

      addVenueBtn = document.createElement('button');
      addVenueBtn.type = 'button';
      addVenueBtn.className = 'member-create-secondary-btn';
      addVenueBtn.textContent = 'Add Venue';
      addVenueBtn.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        const venueSessionCreateVenueFn = typeof window !== 'undefined' && typeof window.venueSessionCreateVenue === 'function' ? window.venueSessionCreateVenue : (() => ({ name: '', address: '', sessions: [] }));
        const venue = venueSessionCreateVenueFn();
        venues.push(venue);
        addVenueCard(venue);
      });
      venueList.appendChild(addVenueBtn);

      return editor;
    }

    async function initializeMemberFormbuilderSnapshot(){
      const loadingMsg = await getMessage('msg_post_loading_form', {}, false) || 'Loading form fieldsΓÇª';
      renderEmptyState(loadingMsg);
      if(formWrapper) formWrapper.hidden = true;
      if(formFields) formFields.innerHTML = '';
      if(postButton) postButton.disabled = true;
      try{
        // Try both possible locations for the snapshot promise
        const snapshotPromise = (typeof window !== 'undefined' && window.persistedFormbuilderSnapshotPromise) 
          ? window.persistedFormbuilderSnapshotPromise 
          : (typeof window !== 'undefined' && window.__persistedFormbuilderSnapshotPromise)
            ? window.__persistedFormbuilderSnapshotPromise
            : null;
        
        if(!snapshotPromise){
          throw new Error('Formbuilder snapshot promise not available');
        }
        
        const backendSnapshot = await snapshotPromise;
        
        // NO FALLBACKS - validate snapshot exists and is valid
        if(!backendSnapshot){
          throw new Error('No formbuilder snapshot available from backend. Please configure the formbuilder in the admin panel first.');
        }
        if(typeof backendSnapshot !== 'object'){
          throw new Error('Formbuilder snapshot is not a valid object');
        }
        if(!backendSnapshot.categories || !Array.isArray(backendSnapshot.categories)){
          throw new Error('Formbuilder snapshot is missing categories. Please configure categories in the formbuilder.');
        }
        
        if(window.formbuilderStateManager && typeof window.formbuilderStateManager.restore === 'function'){
          window.formbuilderStateManager.restore(backendSnapshot);
        }
        applyMemberSnapshot(backendSnapshot, { preserveSelection: false, populate: false });
        memberSnapshotErrorMessage = '';
        setEmptyStateMessage(defaultEmptyMessage);
        renderFormPicker();
        
        // Prevent form wrapper from closing when clicking inside venue fields
        if(formWrapper){
          formWrapper.addEventListener('click', (e)=>{
            // If click is inside a venue editor, prevent any closing behavior
            const venueEditor = e.target.closest('.venue-session-editor');
            if(venueEditor){
              e.stopPropagation();
            }
          }, true);
        }
      }catch(error){
        // NO FALLBACKS - show error, don't render with incorrect data
        console.error('Failed to load formbuilder snapshot for members:', error);
        const errorMsg = await getMessage('msg_post_form_load_error', {}, false) || `Unable to load form configuration. ${error.message || 'Please refresh the page or contact support.'}`;
        memberSnapshotErrorMessage = errorMsg;
        setEmptyStateMessage(errorMsg);
        
        // DON'T apply defaultMemberSnapshot - keep form hidden
        // DON'T call renderFormPicker() - don't render with incorrect data
        if(formWrapper) formWrapper.hidden = true;
        if(formFields) formFields.innerHTML = '';
        if(postButton) postButton.disabled = true;
      }
    }

    const MAPBOX_VENUE_ENDPOINT = 'https://api.mapbox.com/geocoding/v5/mapbox.places/';

    function buildMemberCreateField(field, index){
      const wrapper = document.createElement('div');
      wrapper.className = 'panel-field form-preview-field';
      const labelText = field.name && field.name.trim() ? field.name.trim() : `Field ${index + 1}`;
      const labelId = `memberCreateFieldLabel-${++fieldIdCounter}`;
      const controlId = `memberCreateField-${fieldIdCounter}`;
      const label = document.createElement('label');
      label.id = labelId;
      label.className = 'form-preview-field-label';
      label.setAttribute('for', controlId);
      label.textContent = labelText;
      if(field.required){
        wrapper.classList.add('form-preview-field--required');
        label.appendChild(document.createTextNode(' '));
        const asterisk = document.createElement('span');
        asterisk.className = 'required-asterisk';
        asterisk.textContent = '*';
        label.appendChild(asterisk);
      }
      wrapper.appendChild(label);

      const placeholder = field.placeholder || '';
      let control = null;

      const baseType = getBaseFieldType(field.type);
      if(baseType === 'description' || baseType === 'text-area'){
        const textarea = document.createElement('textarea');
        textarea.id = controlId;
        textarea.rows = baseType === 'description' ? 6 : 4;
        textarea.placeholder = placeholder;
        textarea.className = 'form-preview-textarea';
        if(baseType === 'description'){
          textarea.classList.add('form-preview-description');
        }
        if(field.required) textarea.required = true;
        control = textarea;
      } else if(baseType === 'dropdown'){
        wrapper.classList.add('form-preview-field--dropdown');
        const select = document.createElement('select');
        select.id = controlId;
        select.className = 'form-preview-select';
        if(field.required) select.required = true;
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = placeholder || 'Select an option';
        select.appendChild(placeholderOption);
        field.options.forEach((optionValue, optionIndex) => {
          const option = document.createElement('option');
          const stringValue = typeof optionValue === 'string' ? optionValue : String(optionValue ?? '');
          option.value = stringValue;
          option.textContent = stringValue.trim() ? stringValue : `Option ${optionIndex + 1}`;
          select.appendChild(option);
        });
        control = select;
      } else if(baseType === 'radio-toggle'){
        wrapper.classList.add('form-preview-field--radio-toggle');
        label.removeAttribute('for');
        const radioGroup = document.createElement('div');
        radioGroup.className = 'form-preview-radio-group';
        radioGroup.setAttribute('role', 'radiogroup');
        radioGroup.setAttribute('aria-labelledby', labelId);
        const radioName = `member-create-radio-${fieldIdCounter}`;
        if(field.options.length){
          field.options.forEach((optionValue, optionIndex)=>{
            const radioLabel = document.createElement('label');
            radioLabel.className = 'form-preview-radio-option';
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = radioName;
            radio.value = typeof optionValue === 'string' ? optionValue : String(optionValue ?? '');
            if(field.required && optionIndex === 0) radio.required = true;
            const displayValue = radio.value.trim() ? radio.value : `Option ${optionIndex + 1}`;
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
          radio.disabled = true;
          const radioText = document.createElement('span');
          radioText.textContent = 'Option';
          placeholderOption.append(radio, radioText);
          radioGroup.appendChild(placeholderOption);
        }
        control = radioGroup;
      } else if(baseType === 'images'){
        wrapper.classList.add('form-preview-field--images');
        label.removeAttribute('for');
        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'form-preview-images';
        const fileInput = document.createElement('input');
        fileInput.id = controlId;
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.accept = 'image/*';
        if(field.required) fileInput.required = true;
        const hint = document.createElement('p');
        hint.className = 'form-preview-image-hint';
        hint.textContent = placeholder || 'Upload images';
        const message = document.createElement('p');
        message.className = 'form-preview-image-message';
        message.textContent = '';
        const previewGrid = document.createElement('div');
        previewGrid.className = 'form-preview-image-previews';
        const previewId = `${controlId}-previews`;
        previewGrid.id = previewId;
        fileInput.dataset.imagePreviewTarget = previewId;
        imageWrapper.append(fileInput, hint, message, previewGrid);
        control = imageWrapper;
      } else if(baseType === 'variant-pricing'){
        wrapper.classList.add('form-preview-field--variant-pricing');
        label.removeAttribute('for');
        control = buildVersionPriceEditor(field, labelId);
      } else if(baseType === 'venue-ticketing'){
        wrapper.classList.add('form-preview-field--venues-sessions-pricing');
        label.removeAttribute('for');
        // Use buildVenueSessionPreview if available (for member forms), otherwise fall back to editor
        if(typeof window !== 'undefined' && typeof window.buildVenueSessionPreview === 'function'){
          control = window.buildVenueSessionPreview(field, controlId);
        } else {
          control = buildVenueSessionEditor(field, labelId);
        }
      } else if(baseType === 'website-url' || baseType === 'tickets-url'){
        wrapper.classList.add('form-preview-field--url');
        const urlWrapper = document.createElement('div');
        urlWrapper.className = 'form-preview-url-wrapper';
        const input = document.createElement('input');
        input.id = controlId;
        input.type = 'url';
        input.placeholder = placeholder || 'https://example.com';
        input.autocomplete = 'url';
        input.className = 'form-preview-url-input';
        if(field.required) input.required = true;
        urlWrapper.appendChild(input);
        control = urlWrapper;
      } else if(baseType === 'location'){
        wrapper.classList.add('form-preview-field--location');
        const ensureLocationState = ()=>{
          if(!field.location || typeof field.location !== 'object'){
            field.location = { address: '', latitude: '', longitude: '' };
          } else {
            if(typeof field.location.address !== 'string') field.location.address = '';
            if(typeof field.location.latitude !== 'string') field.location.latitude = '';
            if(typeof field.location.longitude !== 'string') field.location.longitude = '';
          }
          return field.location;
        };
        const locationState = ensureLocationState();
        const locationWrapper = document.createElement('div');
        locationWrapper.className = 'location-field-wrapper';
        locationWrapper.setAttribute('role', 'group');
        const addressRow = document.createElement('div');
        addressRow.className = 'venue-line address_line-line';
        const geocoderContainer = document.createElement('div');
        geocoderContainer.className = 'address_line-geocoder-container';
        const geocoderId = `${controlId}-geocoder`;
        geocoderContainer.id = geocoderId;
        addressRow.appendChild(geocoderContainer);
        locationWrapper.appendChild(addressRow);
        const latitudeInput = document.createElement('input');
        latitudeInput.type = 'hidden';
        latitudeInput.dataset.locationLatitude = 'true';
        latitudeInput.value = locationState.latitude || '';
        const longitudeInput = document.createElement('input');
        longitudeInput.type = 'hidden';
        longitudeInput.dataset.locationLongitude = 'true';
        longitudeInput.value = locationState.longitude || '';
        locationWrapper.append(latitudeInput, longitudeInput);
        const placeholderValue = placeholder || 'Search for a location';
        const addressInputId = `${controlId}-address`;
        const syncCoordinateInputs = ()=>{
          latitudeInput.value = locationState.latitude || '';
          longitudeInput.value = locationState.longitude || '';
        };
        syncCoordinateInputs();
        const formatCoord = value => {
          const num = Number(value);
          return Number.isFinite(num) ? num.toFixed(6) : '';
        };
        const applyAddressLabel = input => {
          if(input){
            input.setAttribute('aria-labelledby', labelId);
          }
          return input;
        };
        const createFallbackAddressInput = ()=>{
          geocoderContainer.innerHTML = '';
          geocoderContainer.classList.remove('is-geocoder-active');
          const fallback = document.createElement('input');
          fallback.type = 'text';
          fallback.id = addressInputId;
          fallback.className = 'address_line-fallback';
          fallback.placeholder = placeholderValue;
          fallback.setAttribute('aria-label', placeholderValue);
          fallback.dataset.locationAddress = 'true';
          fallback.value = locationState.address || '';
          if(field.required) fallback.required = true;
          fallback.addEventListener('input', ()=>{
            locationState.address = fallback.value;
          });
          geocoderContainer.appendChild(fallback);
          addressInput = fallback;
          applyAddressLabel(fallback);
          return fallback;
        };
        const mapboxReady = window.mapboxgl && window.MapboxGeocoder && window.mapboxgl.accessToken;
        let addressInput = null;
        label.setAttribute('for', addressInputId);
        if(mapboxReady){
          const geocoderOptions = {
            accessToken: window.mapboxgl.accessToken,
            mapboxgl: window.mapboxgl,
            marker: false,
            placeholder: placeholderValue,
            geocodingUrl: typeof MAPBOX_VENUE_ENDPOINT !== 'undefined' ? MAPBOX_VENUE_ENDPOINT : 'https://api.mapbox.com/geocoding/v5/mapbox.places/',
            types: 'address,poi',
            reverseGeocode: true,
            localGeocoder: typeof window !== 'undefined' && typeof window.localVenueGeocoder !== 'undefined' ? window.localVenueGeocoder : null,
            externalGeocoder: typeof window !== 'undefined' && typeof window.externalMapboxVenueGeocoder !== 'undefined' ? window.externalMapboxVenueGeocoder : null,
            filter: typeof window !== 'undefined' && typeof window.majorVenueFilter !== 'undefined' ? window.majorVenueFilter : null,
            limit: 7,
            language: (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : undefined
          };
          const geocoder = new MapboxGeocoder(geocoderOptions);
          const schedule = (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function')
            ? window.requestAnimationFrame.bind(window)
            : (cb)=> setTimeout(cb, 16);
          let attempts = 0;
          const maxAttempts = 20;
          let geocoderMounted = false;
          let fallbackActivated = false;
          const attachGeocoder = ()=>{
            if(fallbackActivated){
              return;
            }
            const scheduleRetry = ()=>{
              attempts += 1;
              if(attempts > maxAttempts){
                createFallbackAddressInput();
                fallbackActivated = true;
                return false;
              }
              schedule(attachGeocoder);
              return true;
            };
            if(!geocoderContainer.isConnected){
              scheduleRetry();
              return;
            }
            if(!geocoderMounted){
              try{
                geocoder.addTo(geocoderContainer);
                geocoderMounted = true;
              }catch(err){
                createFallbackAddressInput();
                fallbackActivated = true;
                return;
              }
            }
            const setGeocoderActive = isActive => {
              const active = !!isActive;
              geocoderContainer.classList.toggle('is-geocoder-active', active);
            };
            setGeocoderActive(false);
            const geocoderRoot = geocoderContainer.querySelector('.mapboxgl-ctrl-geocoder');
            if(geocoderRoot && !geocoderRoot.__memberCreateGeocoderBound){
              geocoderRoot.__memberCreateGeocoderBound = true;
              // Set z-index for member panel geocoder
              geocoderRoot.style.zIndex = '1000001';
              const suggestions = geocoderRoot.querySelector('.suggestions');
              if(suggestions){
                suggestions.style.zIndex = '1000002';
              }
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
            const geocoderInput = geocoderContainer.querySelector('.mapboxgl-ctrl-geocoder--input');
            if(!geocoderInput){
              scheduleRetry();
              return;
            }
            if(geocoderInput.__memberCreateLocationBound){
              addressInput = geocoderInput;
              applyAddressLabel(geocoderInput);
              return;
            }
            geocoderInput.__memberCreateLocationBound = true;
            geocoderInput.placeholder = placeholderValue;
            geocoderInput.setAttribute('aria-label', placeholderValue);
            geocoderInput.id = addressInputId;
            geocoderInput.dataset.locationAddress = 'true';
            geocoderInput.value = locationState.address || '';
            if(field.required) geocoderInput.required = true;
            addressInput = geocoderInput;
            applyAddressLabel(geocoderInput);
            geocoderInput.addEventListener('blur', ()=>{
              const nextValue = geocoderInput.value || '';
              if(locationState.address !== nextValue){
                locationState.address = nextValue;
              }
            });
            // Prevent Enter key from submitting form when in geocoder
            geocoderInput.addEventListener('keydown', (e)=>{
              if(e.key === 'Enter'){
                e.stopPropagation();
                // Don't preventDefault - let geocoder handle it
              }
            });
            geocoder.on('results', ()=> setGeocoderActive(true));
            geocoder.on('result', event => {
              const result = event && event.result;
              if(result){
                const cloneGeocoderFeatureFn = typeof window !== 'undefined' && typeof window.cloneGeocoderFeature === 'function' ? window.cloneGeocoderFeature : (f => f);
                const getMapboxVenueFeatureCenterFn = typeof window !== 'undefined' && typeof window.getMapboxVenueFeatureCenter === 'function' ? window.getMapboxVenueFeatureCenter : (() => null);
                const clone = cloneGeocoderFeatureFn(result);
                const placeName = typeof clone.place_name === 'string' ? clone.place_name : '';
                if(placeName){
                  locationState.address = placeName;
                  geocoderInput.value = placeName;
                } else {
                  locationState.address = geocoderInput.value || '';
                }
                const center = getMapboxVenueFeatureCenterFn(clone);
                if(center && center.length >= 2){
                  const [lng, lat] = center;
                  locationState.longitude = formatCoord(lng);
                  locationState.latitude = formatCoord(lat);
                }
                syncCoordinateInputs();
              }
              setGeocoderActive(false);
            });
            geocoder.on('clear', ()=>{
              locationState.address = '';
              locationState.latitude = '';
              locationState.longitude = '';
              geocoderInput.value = '';
              syncCoordinateInputs();
              setGeocoderActive(false);
            });
            geocoder.on('error', ()=> setGeocoderActive(false));
          };
          attachGeocoder();
        } else {
          addressInput = createFallbackAddressInput();
        }
        if(addressInput){
          addressInput.setAttribute('aria-labelledby', labelId);
        }
        control = locationWrapper;
      } else {
        // Check if it's actually a description field that wasn't caught earlier
        const isDescriptionField = baseType === 'description' || baseType === 'text-area' || 
                                   field.type === 'description' || field.type === 'text-area' ||
                                   (typeof field.type === 'string' && (field.type.includes('description') || field.type.includes('text-area')));
        
        if(isDescriptionField){
          const textarea = document.createElement('textarea');
          textarea.id = controlId;
          textarea.rows = baseType === 'description' ? 6 : 4;
          textarea.placeholder = placeholder;
          textarea.className = 'form-preview-textarea';
          if(baseType === 'description' || field.type === 'description' || (typeof field.type === 'string' && field.type.includes('description'))){
            textarea.classList.add('form-preview-description');
          }
          if(field.required) textarea.required = true;
          control = textarea;
        } else {
          const input = document.createElement('input');
          input.id = controlId;
          if(field.type === 'email'){
            input.type = 'email';
            input.autocomplete = 'email';
          } else if(field.type === 'phone'){
            input.type = 'tel';
            input.autocomplete = 'tel';
          } else {
            input.type = 'text';
          }
          input.placeholder = placeholder;
          if(field.required) input.required = true;
          control = input;
        }
      }

      if(control){
        if(control instanceof HTMLElement){
          if(!control.id){
            control.setAttribute('aria-labelledby', labelId);
          }
        }
        wrapper.appendChild(control);
      }
      return wrapper;
    }

    function renderConfiguredFields(){
      // Prevent re-rendering if user is currently interacting with venue fields
      // Check if any venue editor is focused or has active interactions
      const activeVenueEditor = document.activeElement && document.activeElement.closest('.venue-session-editor');
      if(activeVenueEditor){
        // Don't re-render if user is interacting with venue field
        return;
      }
      
      if(!selectedCategory || !selectedSubcategory){
        renderEmptyState();
        if(formWrapper) formWrapper.hidden = true;
        if(postButton) postButton.disabled = true;
        return;
      }
      const fields = getFieldsForSelection(selectedCategory, selectedSubcategory);
      fieldIdCounter = 0;
      formFields.innerHTML = '';
      currentCreateFields = [];
      if(fields.length === 0){
        const placeholder = document.createElement('p');
        placeholder.className = 'form-preview-empty';
        placeholder.textContent = 'No fields configured for this subcategory yet.';
        formFields.appendChild(placeholder);
      } else {
        memberSnapshotErrorMessage = '';
        renderFormPreviewForMember(fields);
      }
      if(emptyState){
        emptyState.hidden = true;
      }
      if(formWrapper) formWrapper.hidden = false;
      if(postButton) postButton.disabled = false;
    }
    
    function ensureFieldDefaultsForMember(field){
      const safeField = field && typeof field === 'object' ? field : {};
      if(typeof safeField.name !== 'string'){
        safeField.name = '';
      } else if(!safeField.name.trim()){
        safeField.name = '';
      }
      if(typeof safeField.type !== 'string'){
        safeField.type = 'text-box';
      } else {
        // Normalize field type to extract base type (e.g., "description [field=2]" -> "description")
        // BUT preserve description and text-area types BEFORE normalization
        const originalType = safeField.type;
        const normalizedType = getBaseFieldType(originalType);
        
        // If the original type or normalized type is description/text-area, preserve it
        if(originalType === 'description' || originalType === 'text-area' || 
           normalizedType === 'description' || normalizedType === 'text-area' ||
           (typeof originalType === 'string' && (originalType.includes('description') || originalType.includes('text-area')))){
          // Use normalized type if it's description/text-area, otherwise use original
          if(normalizedType === 'description' || normalizedType === 'text-area'){
            safeField.type = normalizedType;
          } else if(originalType === 'description' || originalType === 'text-area'){
            safeField.type = originalType;
          } else {
            // Fallback: check if original contains description/text-area
            safeField.type = originalType.includes('description') ? 'description' : 
                           originalType.includes('text-area') ? 'text-area' : normalizedType || 'text-box';
          }
        } else if(normalizedType){
          safeField.type = normalizedType;
        } else if(!safeField.type || safeField.type === ''){
          safeField.type = 'text-box';
        }
      }
      if(typeof safeField.placeholder !== 'string'){
        safeField.placeholder = '';
      }
      if(typeof safeField.required !== 'boolean'){
        safeField.required = false;
      }
      if(!Array.isArray(safeField.options)){
        safeField.options = [];
      }
      return safeField;
    }
    
    function handleImagePreview(fileInput){
      if(!fileInput || fileInput.type !== 'file') return;
      const previewTargetId = fileInput.dataset.imagePreviewTarget;
      const messageTargetId = fileInput.dataset.imageMessageTarget;
      if(!previewTargetId) return;
      
      const previewGrid = document.getElementById(previewTargetId);
      const messageEl = messageTargetId ? document.getElementById(messageTargetId) : null;
      if(!previewGrid) return;
      
      const maxImages = parseInt(fileInput.dataset.maxImages || '10', 10);
      const fileMap = new WeakMap();
      
      fileInput.addEventListener('change', function(event){
        const files = Array.from(event.target.files || []);
        if(files.length === 0) return;
        
        const existingPreviews = previewGrid.querySelectorAll('.form-preview-image-thumb').length;
        const remainingSlots = maxImages - existingPreviews;
        
        if(files.length > remainingSlots){
          if(messageEl){
            messageEl.textContent = `You can only upload ${maxImages} images total.`;
            messageEl.hidden = false;
          }
          return;
        }
        
        if(messageEl){
          messageEl.hidden = true;
        }
        
        files.forEach(file => {
          if(!file.type.startsWith('image/')) return;
          
          const reader = new FileReader();
          reader.onload = function(e){
            const thumb = document.createElement('div');
            thumb.className = 'form-preview-image-thumb';
            const img = document.createElement('img');
            img.src = e.target.result;
            img.alt = file.name;
            fileMap.set(thumb, file);
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'form-preview-image-remove';
            removeBtn.setAttribute('aria-label', `Remove ${file.name}`);
            removeBtn.innerHTML = '<span>├ù</span>';
            removeBtn.addEventListener('click', function(){
              const fileToRemove = fileMap.get(thumb);
              thumb.remove();
              if(fileToRemove){
                const dataTransfer = new DataTransfer();
                Array.from(fileInput.files).forEach(f => {
                  if(f !== fileToRemove){
                    dataTransfer.items.add(f);
                  }
                });
                fileInput.files = dataTransfer.files;
              }
            });
            thumb.appendChild(img);
            thumb.appendChild(removeBtn);
            previewGrid.appendChild(thumb);
          };
          reader.readAsDataURL(file);
        });
      });
    }
    
    function renderFormPreviewForMember(fields){
      formFields.innerHTML = '';
      
      const subcategoryTitle = document.createElement('div');
      subcategoryTitle.className = 'member-form-subcategory-title';
      subcategoryTitle.textContent = selectedSubcategory || '';
      subcategoryTitle.style.marginBottom = '16px';
      subcategoryTitle.style.fontSize = '18px';
      subcategoryTitle.style.fontWeight = '700';
      subcategoryTitle.style.color = 'var(--button-text)';
      formFields.appendChild(subcategoryTitle);
      
      if(!fields || fields.length === 0){
        const empty = document.createElement('p');
        empty.className = 'form-preview-empty';
        empty.textContent = 'No fields added yet.';
        formFields.appendChild(empty);
        return;
      }
      fields.forEach((fieldData, previewIndex) => {
        const previewField = ensureFieldDefaultsForMember(fieldData);
        const wrapper = document.createElement('div');
        wrapper.className = 'panel-field form-preview-field';
        const baseId = `memberForm-field-${++fieldIdCounter}`;
        const labelText = previewField.name.trim() || `Field ${previewIndex + 1}`;
        const labelEl = document.createElement('span');
        labelEl.className = 'subcategory-form-label';
        labelEl.textContent = labelText;
        const labelId = `${baseId}-label`;
        labelEl.id = labelId;
        let control = null;
        
        const baseType = getBaseFieldType(previewField.type);
        // Check both baseType and original type for description/text-area
        const isDescription = baseType === 'description' || baseType === 'text-area' || 
                            previewField.type === 'description' || previewField.type === 'text-area' ||
                            (typeof previewField.type === 'string' && (previewField.type.includes('description') || previewField.type.includes('text-area')));
        if(isDescription){
          const textarea = document.createElement('textarea');
          textarea.rows = 5;
          textarea.placeholder = previewField.placeholder || '';
          textarea.className = 'form-preview-textarea';
          textarea.style.resize = 'vertical';
          const textareaId = `${baseId}-input`;
          textarea.id = textareaId;
          if(baseType === 'description' || previewField.type === 'description' || (typeof previewField.type === 'string' && previewField.type.includes('description'))){
            textarea.classList.add('form-preview-description');
          }
          if(previewField.required) textarea.required = true;
          control = textarea;
        } else if(baseType === 'dropdown'){
          const select = document.createElement('select');
          select.className = 'form-preview-select';
          wrapper.classList.add('form-preview-field--dropdown');
          const options = Array.isArray(previewField.options) ? previewField.options : [];
          if(options.length){
            options.forEach((optionValue, optionIndex) => {
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
          const selectId = `${baseId}-input`;
          select.id = selectId;
          if(previewField.required) select.required = true;
          control = select;
        } else if(baseType === 'radio-toggle'){
          const options = Array.isArray(previewField.options) ? previewField.options : [];
          const radioGroup = document.createElement('div');
          radioGroup.className = 'form-preview-radio-group';
          wrapper.classList.add('form-preview-field--radio-toggle');
          const groupName = `${baseId}-radio`;
          if(options.length){
            options.forEach((optionValue, optionIndex) => {
              const radioLabel = document.createElement('label');
              radioLabel.className = 'form-preview-radio-option';
              const radio = document.createElement('input');
              radio.type = 'radio';
              radio.name = groupName;
              radio.value = optionValue;
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
            placeholderOption.append(radio, document.createTextNode('Option'));
            radioGroup.appendChild(placeholderOption);
          }
          control = radioGroup;
        } else if(baseType === 'venue-ticketing'){
          wrapper.classList.add('form-preview-field--venues-sessions-pricing');
          // Use the same builder as admin form preview for identical structure
          if(typeof window.buildVenueSessionPreview === 'function'){
            control = window.buildVenueSessionPreview(previewField, baseId);
          } else {
            // Fallback if not available yet
            control = buildVenueSessionEditor(previewField, labelId);
          }
        } else if(baseType === 'variant-pricing'){
          wrapper.classList.add('form-preview-field--variant-pricing');
          // Use exact same logic as admin form preview for identical structure
          const editor = document.createElement('div');
          editor.className = 'form-preview-variant-pricing variant-pricing-options-editor';
          const versionList = document.createElement('div');
          versionList.className = 'variant-pricing-options-list';
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

          // Make notifyFormbuilderChange optional for member forms
          const safeNotifyFormbuilderChange = typeof window !== 'undefined' && typeof window.notifyFormbuilderChange === 'function' 
            ? window.notifyFormbuilderChange 
            : (()=>{});

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
              const showCopyStyleMessageFn = typeof window !== 'undefined' && typeof window.showCopyStyleMessage === 'function' ? window.showCopyStyleMessage : (() => null);
              const handle = showCopyStyleMessageFn(currencyAlertMessage, inputEl);
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
              optionRow.className = 'variant-pricing-option';
              optionRow.dataset.optionIndex = String(optionIndex);

              const topRow = document.createElement('div');
              topRow.className = 'variant-pricing-row variant-pricing-row--top';

              const versionInput = document.createElement('input');
              versionInput.type = 'text';
              versionInput.className = 'variant-pricing-name';
              versionInput.placeholder = 'Version Name';
              const versionInputId = `${baseId}-version-${optionIndex}`;
              versionInput.id = versionInputId;
              if(optionIndex === 0){
                firstId = versionInputId;
              }
              versionInput.value = optionValue.version || '';
              versionInput.addEventListener('input', ()=>{
                previewField.options[optionIndex].version = versionInput.value;
                safeNotifyFormbuilderChange();
              });
              topRow.appendChild(versionInput);

              const bottomRow = document.createElement('div');
              bottomRow.className = 'variant-pricing-row variant-pricing-row--bottom';

              const currencySelect = document.createElement('select');
              currencySelect.className = 'variant-pricing-currency';
              const emptyOption = document.createElement('option');
              emptyOption.value = '';
              emptyOption.textContent = 'Currency';
              currencySelect.appendChild(emptyOption);
              // Currency options should come from backend via currency field
              const currencyOptions = Array.isArray(window.currencyCodes) ? window.currencyCodes : [];
              currencyOptions.forEach(code => {
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
              priceInput.className = 'variant-pricing-price';
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
                  safeNotifyFormbuilderChange();
                }
              });

              const commitPriceValue = event => {
                if(!isCurrencySelected()){
                  if(clearPriceValue()){
                    safeNotifyFormbuilderChange();
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
                  safeNotifyFormbuilderChange();
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
                safeNotifyFormbuilderChange();
              }

              const actions = document.createElement('div');
              actions.className = 'dropdown-option-actions variant-pricing-option-actions';

              const addBtn = document.createElement('button');
              addBtn.type = 'button';
              addBtn.className = 'dropdown-option-add';
              addBtn.textContent = '+';
              addBtn.setAttribute('aria-label', `Add version after Version ${optionIndex + 1}`);
              addBtn.addEventListener('click', ()=>{
                previewField.options.splice(optionIndex + 1, 0, createEmptyOption());
                safeNotifyFormbuilderChange();
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
                safeNotifyFormbuilderChange();
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
                const targetRow = versionList.querySelector(`.variant-pricing-option[data-option-index="${focusIndex}"]`);
                if(!targetRow) return;
                let focusEl = null;
                if(focusTarget === 'price'){
                  focusEl = targetRow.querySelector('.variant-pricing-price');
                } else if(focusTarget === 'currency'){
                  focusEl = targetRow.querySelector('.variant-pricing-currency');
                }
                if(!focusEl){
                  focusEl = targetRow.querySelector('.variant-pricing-name');
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
        } else if(baseType === 'website-url' || baseType === 'tickets-url'){
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
          urlInput.dataset.urlType = baseType === 'website-url' ? 'website' : 'tickets';
          urlInput.autocomplete = 'url';
          urlInput.inputMode = 'url';
          if(previewField.required) urlInput.required = true;
          urlWrapper.appendChild(urlInput);
          control = urlWrapper;
        } else if(baseType === 'images'){
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
          if(previewField.required) fileInput.required = true;
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
          handleImagePreview(fileInput);
          control = imageWrapper;
        } else if(baseType === 'location'){
          wrapper.classList.add('form-preview-field--location');
          const ensureLocationState = () => {
            if(!previewField.location || typeof previewField.location !== 'object'){
              previewField.location = { address: '', latitude: '', longitude: '' };
            } else {
              if(typeof previewField.location.address !== 'string') previewField.location.address = '';
              if(typeof previewField.location.latitude !== 'string') previewField.location.latitude = '';
              if(typeof previewField.location.longitude !== 'string') previewField.location.longitude = '';
            }
            return previewField.location;
          };
          const locationState = ensureLocationState();
          const locationWrapper = document.createElement('div');
          locationWrapper.className = 'location-field-wrapper';
          locationWrapper.setAttribute('role', 'group');
          const addressRow = document.createElement('div');
          addressRow.className = 'venue-line address_line-line';
          const geocoderContainer = document.createElement('div');
          geocoderContainer.className = 'address_line-geocoder-container';
          const addressInputId = `${baseId}-location-address`;
          geocoderContainer.id = `${baseId}-location-geocoder`;
          addressRow.appendChild(geocoderContainer);
          locationWrapper.appendChild(addressRow);
          const latitudeInput = document.createElement('input');
          latitudeInput.type = 'hidden';
          latitudeInput.dataset.locationLatitude = 'true';
          latitudeInput.value = locationState.latitude || '';
          const longitudeInput = document.createElement('input');
          longitudeInput.type = 'hidden';
          longitudeInput.dataset.locationLongitude = 'true';
          longitudeInput.value = locationState.longitude || '';
          locationWrapper.append(latitudeInput, longitudeInput);
          const placeholderValue = (previewField.placeholder && previewField.placeholder.trim())
            ? previewField.placeholder
            : 'Search for a location';
          const syncCoordinateInputs = () => {
            latitudeInput.value = locationState.latitude || '';
            longitudeInput.value = locationState.longitude || '';
          };
          syncCoordinateInputs();
          const formatCoord = value => {
            const num = Number(value);
            return Number.isFinite(num) ? num.toFixed(6) : '';
          };
          const applyAddressLabel = input => {
            if(input){
              input.setAttribute('aria-labelledby', labelId);
            }
            return input;
          };
          const createFallbackAddressInput = () => {
            geocoderContainer.innerHTML = '';
            geocoderContainer.classList.remove('is-geocoder-active');
            const fallback = document.createElement('input');
            fallback.type = 'text';
            fallback.id = addressInputId;
            fallback.className = 'address_line-fallback';
            fallback.placeholder = placeholderValue;
            fallback.setAttribute('aria-label', placeholderValue);
            fallback.dataset.locationAddress = 'true';
            fallback.value = locationState.address || '';
            if(previewField.required) fallback.required = true;
            fallback.addEventListener('input', () => {
              locationState.address = fallback.value;
            });
            geocoderContainer.appendChild(fallback);
            addressInput = fallback;
            applyAddressLabel(fallback);
            return fallback;
          };
          const mapboxReady = window.mapboxgl && window.MapboxGeocoder && window.mapboxgl.accessToken;
          let addressInput = null;
          if(mapboxReady){
            // Ensure localVenueGeocoder is accessible - it's defined at top level but may not be in scope
            const safeLocalVenueGeocoder = typeof localVenueGeocoder !== 'undefined' 
              ? localVenueGeocoder 
              : (typeof window.localVenueGeocoder !== 'undefined' 
                  ? window.localVenueGeocoder 
                  : ((query) => searchLocalVenues(query)));
            const safeExternalGeocoder = typeof externalMapboxVenueGeocoder !== 'undefined'
              ? externalMapboxVenueGeocoder
              : (typeof window.externalMapboxVenueGeocoder !== 'undefined'
                  ? window.externalMapboxVenueGeocoder
                  : null);
            const safeFilter = typeof majorVenueFilter !== 'undefined'
              ? majorVenueFilter
              : (typeof window.majorVenueFilter !== 'undefined'
                  ? window.majorVenueFilter
                  : null);
            const geocoderOptions = {
              accessToken: window.mapboxgl.accessToken,
              mapboxgl: window.mapboxgl,
              marker: false,
              placeholder: placeholderValue,
              geocodingUrl: typeof MAPBOX_VENUE_ENDPOINT !== 'undefined' ? MAPBOX_VENUE_ENDPOINT : 'https://api.mapbox.com/geocoding/v5/mapbox.places/',
              types: 'address,poi',
              reverseGeocode: true,
              localGeocoder: safeLocalVenueGeocoder,
              externalGeocoder: safeExternalGeocoder,
              filter: safeFilter,
              limit: 7,
              language: (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : undefined
            };
            const geocoder = new MapboxGeocoder(geocoderOptions);
            const schedule = (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function')
              ? window.requestAnimationFrame.bind(window)
              : (cb) => setTimeout(cb, 16);
            let attempts = 0;
            const maxAttempts = 20;
            let geocoderMounted = false;
            let fallbackActivated = false;
            const attachGeocoder = () => {
              if(fallbackActivated){
                return;
              }
              const scheduleRetry = () => {
                attempts += 1;
                if(attempts > maxAttempts){
                  addressInput = createFallbackAddressInput();
                  fallbackActivated = true;
                  return false;
                }
                schedule(attachGeocoder);
                return true;
              };
              if(!geocoderContainer.isConnected){
                scheduleRetry();
                return;
              }
              if(!geocoderMounted){
                try{
                  geocoder.addTo(geocoderContainer);
                  geocoderMounted = true;
                }catch(err){
                  addressInput = createFallbackAddressInput();
                  fallbackActivated = true;
                  return;
                }
              }
              const setGeocoderActive = isActive => {
                const active = !!isActive;
                geocoderContainer.classList.toggle('is-geocoder-active', active);
              };
              setGeocoderActive(false);
              const geocoderRoot = geocoderContainer.querySelector('.mapboxgl-ctrl-geocoder');
              if(geocoderRoot && !geocoderRoot.__memberFormGeocoderBound){
                geocoderRoot.__memberFormGeocoderBound = true;
                // Set z-index for member panel geocoder
                geocoderRoot.style.zIndex = '1000001';
                const suggestions = geocoderRoot.querySelector('.suggestions');
                if(suggestions){
                  suggestions.style.zIndex = '1000002';
                }
                const handleFocusIn = () => setGeocoderActive(true);
                const handleFocusOut = event => {
                  const nextTarget = event && event.relatedTarget;
                  if(!nextTarget || !geocoderRoot.contains(nextTarget)){
                    setGeocoderActive(false);
                  }
                };
                const handlePointerDown = () => setGeocoderActive(true);
                geocoderRoot.addEventListener('focusin', handleFocusIn);
                geocoderRoot.addEventListener('focusout', handleFocusOut);
                geocoderRoot.addEventListener('pointerdown', handlePointerDown);
              }
              const geocoderInput = geocoderContainer.querySelector('.mapboxgl-ctrl-geocoder--input');
              if(!geocoderInput){
                scheduleRetry();
                return;
              }
              if(geocoderInput.__memberFormLocationBound){
                addressInput = geocoderInput;
                applyAddressLabel(geocoderInput);
                return;
              }
              geocoderInput.__memberFormLocationBound = true;
              geocoderInput.placeholder = placeholderValue;
              geocoderInput.setAttribute('aria-label', placeholderValue);
              geocoderInput.id = addressInputId;
              geocoderInput.dataset.locationAddress = 'true';
              geocoderInput.value = locationState.address || '';
              if(previewField.required) geocoderInput.required = true;
              addressInput = geocoderInput;
              applyAddressLabel(geocoderInput);
              geocoderInput.addEventListener('blur', () => {
                const nextValue = geocoderInput.value || '';
                if(locationState.address !== nextValue){
                  locationState.address = nextValue;
                }
              });
              // Prevent Enter key from submitting form when in geocoder
              geocoderInput.addEventListener('keydown', (e)=>{
                if(e.key === 'Enter'){
                  e.stopPropagation();
                  // Don't preventDefault - let geocoder handle it
                }
              });
              geocoder.on('result', event => {
                const result = event && event.result;
                if(result){
                  const clone = cloneGeocoderFeature(result);
                  const placeName = typeof clone.place_name === 'string' ? clone.place_name : '';
                  if(placeName){
                    locationState.address = placeName;
                    geocoderInput.value = placeName;
                  } else {
                    locationState.address = geocoderInput.value || '';
                  }
                  const center = getMapboxVenueFeatureCenter(clone);
                  if(center && center.length >= 2){
                    const [lng, lat] = center;
                    locationState.longitude = formatCoord(lng);
                    locationState.latitude = formatCoord(lat);
                  }
                  syncCoordinateInputs();
                }
                setGeocoderActive(false);
              });
              geocoder.on('clear', () => {
                locationState.address = '';
                locationState.latitude = '';
                locationState.longitude = '';
                geocoderInput.value = '';
                syncCoordinateInputs();
                setGeocoderActive(false);
              });
              geocoder.on('error', () => setGeocoderActive(false));
              return geocoderInput;
            };
            attachGeocoder();
          } else {
            addressInput = createFallbackAddressInput();
          }
          if(addressInput){
            addressInput.setAttribute('aria-labelledby', labelId);
          }
          control = locationWrapper;
        } else {
          // Check if it's actually a description field that wasn't caught earlier
          const isDescriptionField = baseType === 'description' || baseType === 'text-area' || 
                                     previewField.type === 'description' || previewField.type === 'text-area' ||
                                     (typeof previewField.type === 'string' && (previewField.type.includes('description') || previewField.type.includes('text-area')));
          
          if(isDescriptionField){
            const textarea = document.createElement('textarea');
            const textareaId = `${baseId}-input`;
            textarea.id = textareaId;
            textarea.rows = baseType === 'description' ? 6 : 4;
            textarea.placeholder = previewField.placeholder || '';
            textarea.className = 'form-preview-textarea';
            if(baseType === 'description' || previewField.type === 'description' || (typeof previewField.type === 'string' && previewField.type.includes('description'))){
              textarea.classList.add('form-preview-description');
            }
            if(previewField.required) textarea.required = true;
            control = textarea;
          } else {
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = previewField.placeholder || '';
            const inputId = `${baseId}-input`;
            input.id = inputId;
            if(baseType === 'title'){
              input.classList.add('form-preview-title-input');
            }
            if(previewField.required) input.required = true;
            control = input;
          }
        }
        
        if(control){
          if(control instanceof HTMLElement){
            control.setAttribute('aria-required', previewField.required ? 'true' : 'false');
            if(labelId){
              control.setAttribute('aria-labelledby', labelId);
            }
          }
        }
        if(previewField.required){
          wrapper.classList.add('form-preview-field--required');
          labelEl.appendChild(document.createTextNode(' '));
          const asterisk = document.createElement('span');
          asterisk.className = 'required-asterisk';
          asterisk.textContent = '*';
          labelEl.appendChild(asterisk);
        }
        
        const header = document.createElement('div');
        header.className = 'form-preview-field-header';
        header.style.position = 'relative';
        header.appendChild(labelEl);
        
        wrapper.append(header, control);
        formFields.appendChild(wrapper);
        currentCreateFields.push({ field: previewField, element: wrapper });
      });
    }

    async function handleMemberCreatePost(event){
      if(event && typeof event.preventDefault === 'function'){
        event.preventDefault();
      }
      if(isSubmittingCreatePost){
        return;
      }
      isSubmittingCreatePost = true;
      const restoreButtonState = ()=>{
        if(postButton){
          delete postButton.dataset.submitting;
          postButton.disabled = false;
        }
      };
      if(postButton){
        postButton.dataset.submitting = 'true';
        postButton.disabled = true;
      }

      const focusElement = el => {
        if(el && typeof el.focus === 'function'){
          if(typeof requestAnimationFrame === 'function'){
            requestAnimationFrame(()=> el.focus());
          } else {
            el.focus();
          }
        }
      };

      if(!selectedCategory || !selectedSubcategory){
        await showCreateStatus('msg_post_create_no_category', { error: true });
        restoreButtonState();
        isSubmittingCreatePost = false;
        return;
      }

      const category = memberCategories.find(cat => cat && typeof cat.name === 'string' && cat.name === selectedCategory) || null;
      const categoryId = category && Object.prototype.hasOwnProperty.call(category, 'id') ? category.id : null;
      const subcategoryId = category && category.subIds && Object.prototype.hasOwnProperty.call(category.subIds, selectedSubcategory)
        ? category.subIds[selectedSubcategory]
        : null;

      let postTitle = '';
      const fieldPayload = [];
      const imageUploadQueue = [];
      let invalid = null;

      for(const entry of currentCreateFields){
        if(!entry || typeof entry !== 'object'){
          continue;
        }
        const { field, element } = entry;
        if(!field || !element){
          continue;
        }
        const rawType = typeof field.type === 'string' ? field.type : 'text-box';
        const type = getBaseFieldType(rawType) || 'text-box';
        const label = field.name && field.name.trim() ? field.name.trim() : 'This field';
        let value;

        const findFirstFocusable = (selectorList)=>{
          if(!element) return null;
          if(Array.isArray(selectorList)){
            for(const selector of selectorList){
              const candidate = element.querySelector(selector);
              if(candidate) return candidate;
            }
            return null;
          }
          return element.querySelector('input, select, textarea');
        };

        if(type === 'radio-toggle'){
          const checked = element.querySelector('input[type="radio"]:checked');
          value = checked ? checked.value : '';
          if(field.required && !value){
            const msg = await getMessage('msg_post_validation_select', { field: label }, false) || `Select an option for ${label}.`;
            invalid = {
              message: msg,
              focus: ()=> focusElement(findFirstFocusable(['input[type="radio"]']))
            };
            break;
          }
        } else if(type === 'dropdown'){
          const select = element.querySelector('select');
          value = select ? select.value : '';
          if(field.required && (!value || !value.trim())){
            const msg = await getMessage('msg_post_validation_choose', { field: label }, false) || `Choose an option for ${label}.`;
            invalid = {
              message: msg,
              focus: ()=> focusElement(select)
            };
            break;
          }
        } else if(type === 'images'){
          const input = element.querySelector('input[type="file"]');
          let files = [];
          if(input){
            if(Array.isArray(input._imageFiles)){
              files = input._imageFiles.slice();
            } else if(input.files){
              files = Array.from(input.files);
            }
          }
          value = files.map(file => ({
            name: file && typeof file.name === 'string' ? file.name : '',
            size: file && typeof file.size === 'number' ? file.size : 0,
            type: file && typeof file.type === 'string' ? file.type : '',
            lastModified: file && typeof file.lastModified === 'number' ? file.lastModified : 0
          }));
          if(files.length){
            imageUploadQueue.push({ files: files.slice(), label });
          }
          if(field.required && value.length === 0){
            const msg = await getMessage('msg_post_validation_file_required', { field: label }, false) || `Add at least one file for ${label}.`;
            invalid = {
              message: msg,
              focus: ()=> focusElement(input)
            };
            break;
          }
        } else if(type === 'variant-pricing'){
          const options = Array.isArray(field.options) ? field.options : [];
          value = options.map(opt => ({
            version: typeof opt.version === 'string' ? opt.version.trim() : '',
            currency: typeof opt.currency === 'string' ? opt.currency.trim().toUpperCase() : '',
            price: formatPriceValue(opt.price || '')
          })).filter(opt => opt.version || opt.currency || opt.price);
          if(field.required){
            const hasComplete = value.some(opt => opt.currency && opt.price);
            if(!hasComplete){
              const msg = await getMessage('msg_post_validation_pricing', { field: label }, false) || `Provide pricing details for ${label}.`;
              invalid = {
                message: msg,
                focus: ()=> focusElement(findFirstFocusable(['.variant-pricing-option select','.variant-pricing-option input']))
              };
              break;
            }
          }
        } else if(type === 'venue-ticketing'){
          const venues = Array.isArray(field.options) ? field.options : [];
          value = venues.map(cloneVenueSessionVenueFromWindow);
          if(field.required){
            const hasTierPrice = value.some(venue => Array.isArray(venue.sessions) && venue.sessions.some(session => Array.isArray(session.times) && session.times.some(time => Array.isArray(time.versions) && time.versions.some(version => Array.isArray(version.tiers) && version.tiers.some(tier => {
              const price = typeof tier.price === 'string' ? tier.price.trim() : '';
              const currency = typeof tier.currency === 'string' ? tier.currency.trim() : '';
              return price && currency;
            })))));
            if(!hasTierPrice){
              const msg = await getMessage('msg_post_validation_pricing_tiers', { field: label }, false) || `Add at least one price tier for ${label}.`;
              invalid = {
                message: msg,
                focus: ()=> focusElement(findFirstFocusable(['.tier-row select','.tier-row input']))
              };
              break;
            }
          }
        } else if(type === 'description' || type === 'text-area'){
          const textarea = element.querySelector('textarea');
          value = textarea ? textarea.value : '';
          if(field.required && (!value || !value.trim())){
            const msg = await getMessage('msg_post_validation_required', { field: label }, false) || `Enter a value for ${label}.`;
            invalid = {
              message: msg,
              focus: ()=> focusElement(textarea)
            };
            break;
          }
        } else if(type === 'location'){
          const addressInput = element.querySelector('[data-location-address]');
          const latitudeInput = element.querySelector('[data-location-latitude]');
          const longitudeInput = element.querySelector('[data-location-longitude]');
          const addressValue = addressInput ? addressInput.value : (field.location && field.location.address) || '';
          const latitudeValue = latitudeInput ? latitudeInput.value : (field.location && field.location.latitude) || '';
          const longitudeValue = longitudeInput ? longitudeInput.value : (field.location && field.location.longitude) || '';
          const trimmedLocation = {
            address: (addressValue || '').trim(),
            latitude: (latitudeValue || '').trim(),
            longitude: (longitudeValue || '').trim()
          };
          field.location = {
            address: trimmedLocation.address,
            latitude: trimmedLocation.latitude,
            longitude: trimmedLocation.longitude
          };
          value = trimmedLocation;
          if(field.required && (!trimmedLocation.address || !trimmedLocation.latitude || !trimmedLocation.longitude)){
            const msg = await getMessage('msg_post_validation_location', { field: label }, false) || `Select a location for ${label}.`;
            invalid = {
              message: msg,
              focus: ()=> focusElement(addressInput)
            };
            break;
          }
        } else {
          const input = element.querySelector('input, textarea');
          value = input ? input.value : '';
          if(field.required && (!value || !String(value).trim())){
            const msg = await getMessage('msg_post_validation_required', { field: label }, false) || `Enter a value for ${label}.`;
            invalid = {
              message: msg,
              focus: ()=> focusElement(input)
            };
            break;
          }
        }

        if(typeof value === 'string'){
          value = value.trim();
        }
        if(type === 'title' && typeof value === 'string' && value && !postTitle){
          postTitle = value;
        } else if(!postTitle && typeof value === 'string' && value && field.name && /title/i.test(field.name)){
          postTitle = value;
        }
        fieldPayload.push({
          name: field.name || '',
          type,
          required: !!field.required,
          value
        });
      }

      if(invalid){
        await showCreateStatus(invalid.message, { error: true });
        if(invalid.focus){
          invalid.focus();
        }
        restoreButtonState();
        isSubmittingCreatePost = false;
        return;
      }

      if(!postTitle){
        const fallback = fieldPayload.find(item => typeof item.value === 'string' && item.value);
        if(fallback && typeof fallback.value === 'string'){
          postTitle = fallback.value;
        }
      }
      // Title requirement is now handled by backend validation based on subcategories.required column

      const currentMember = loadCurrentMember();
      const payload = {
        category_id: categoryId,
        category_name: categoryName,
        subcategory_id: subcategoryId,
        subcategory_name: subcategoryName,
        title: postTitle,
        fields: fieldPayload,
        member: currentMember
      };
      if(currentMember){
        payload.member_id = typeof currentMember.id === 'number' ? currentMember.id : 0;
        payload.member_name = currentMember.name || currentMember.username || currentMember.email || '';
        payload.member_email = currentMember.email || '';
        payload.member_username = currentMember.username || '';
        payload.member_type = currentMember.type || 'member';
      }

      let response;
      try{
        response = await fetch('/gateway.php?action=add-post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }catch(err){
        console.error('Failed to submit member post', err);
        await showCreateStatus('msg_post_create_error', { error: true });
        restoreButtonState();
        isSubmittingCreatePost = false;
        return;
      }

      let responseText = '';
      try{
        responseText = await response.text();
      }catch(err){
        console.error('Failed to read member post response', err);
        await showCreateStatus('msg_post_submit_confirm_error', { error: true });
        restoreButtonState();
        isSubmittingCreatePost = false;
        return;
      }

      let responseData = null;
      if(responseText){
        try{
          responseData = JSON.parse(responseText);
        }catch(err){
          responseData = null;
        }
      }

      if(!response.ok || (responseData && responseData.success === false)){
        let errorMessage = await getMessage('msg_post_create_error', {}, false) || 'Unable to post your listing.';
        if(responseData && typeof responseData === 'object'){
          const candidate = responseData.error || responseData.message;
          if(typeof candidate === 'string' && candidate.trim()){
            errorMessage = candidate.trim();
          }
        } else if(responseText && responseText.trim()){
          errorMessage = responseText.trim();
        }
        await showCreateStatus(errorMessage, { error: true });
        restoreButtonState();
        isSubmittingCreatePost = false;
        return;
      }

      const postIdentifier = responseData && (Object.prototype.hasOwnProperty.call(responseData, 'insert_id')
        ? responseData.insert_id
        : (Object.prototype.hasOwnProperty.call(responseData, 'post_id')
          ? responseData.post_id
          : (Object.prototype.hasOwnProperty.call(responseData, 'id') ? responseData.id : null)));
      const normalizedPostId = normalizePositiveInteger(postIdentifier);
      const totalUploadCount = imageUploadQueue.reduce((sum, entry) => {
        if(!entry || typeof entry !== 'object' || !Array.isArray(entry.files)){
          return sum;
        }
        return sum + entry.files.length;
      }, 0);
      let uploadOutcome = { uploaded: [], errors: [] };
      if(totalUploadCount > 0){
        if(normalizedPostId){
          const memberIdForUpload = Object.prototype.hasOwnProperty.call(payload, 'member_id')
            ? payload.member_id
            : (currentMember && Object.prototype.hasOwnProperty.call(currentMember, 'id') ? currentMember.id : null);
          try{
            uploadOutcome = await uploadMediaForPost(normalizedPostId, memberIdForUpload, imageUploadQueue, currentMember);
          }catch(uploadError){
            console.error('Failed to upload media for new post', uploadError);
            uploadOutcome.errors.push({ message: 'Unexpected error during image upload.', detail: uploadError });
          }
        } else {
          uploadOutcome.errors.push({ message: 'Unable to determine post ID for image uploads.' });
        }
      }

      const successMessage = await getMessage('msg_post_create_success', {}, false) || 'Your listing has been posted!';
      let finalMessage = successMessage;
      const finalOptions = {};
      if(Array.isArray(uploadOutcome.errors) && uploadOutcome.errors.length){
        uploadOutcome.errors.forEach(error => {
          if(error) console.error('Media upload failed', error);
        });
        finalMessage = totalUploadCount > 0 && uploadOutcome.errors.length >= totalUploadCount
          ? 'Your listing was posted, but we could not upload your images. Please try again later.'
          : 'Your listing was posted, but some images could not be uploaded.';
        finalOptions.error = true;
      } else if(Array.isArray(uploadOutcome.uploaded) && uploadOutcome.uploaded.length){
        finalMessage = await getMessage('msg_post_create_with_images', {}, false) || 'Your listing and images have been posted!';
      }

      await showCreateStatus(finalMessage, finalOptions);
      if(window.memberPanelChangeManager && typeof window.memberPanelChangeManager.markSaved === 'function'){
        window.memberPanelChangeManager.markSaved();
      }

      selectedCategory = '';
      selectedSubcategory = '';
      if(formpickerCats){
        const allSubButtons = formpickerCats.querySelectorAll('.subcategory-option');
        allSubButtons.forEach(btn => {
          btn.setAttribute('aria-pressed', 'false');
          btn.classList.remove('on');
        });
      }
      currentCreateFields = [];
      renderEmptyState();

      if(postButton){
        delete postButton.dataset.submitting;
      }
      isSubmittingCreatePost = false;
    }

    function renderFormPicker(){
      if(!formpickerCats) return;
      formpickerCats.innerHTML = '';
      selectedCategory = '';
      selectedSubcategory = '';
      
      if(formWrapper) formWrapper.hidden = true;
      if(formFields) formFields.innerHTML = '';
      if(postButton) postButton.disabled = true;
      
      const categoryIcons = window.categoryIcons = window.categoryIcons || {};
      const subcategoryIcons = window.subcategoryIcons = window.subcategoryIcons || {};
      const sortedCategories = (typeof window !== 'undefined' && typeof window.getSortedCategories === 'function' ? window.getSortedCategories : (cats => cats || []))(memberCategories);
      
      // Create container for dropdowns
      const dropdownsContainer = document.createElement('div');
      dropdownsContainer.className = 'formpicker-dropdowns';
      dropdownsContainer.style.display = 'flex';
      dropdownsContainer.style.flexDirection = 'column';
      dropdownsContainer.style.gap = '12px';
      
      // Create category dropdown wrapper
      const categoryWrapper = document.createElement('div');
      categoryWrapper.className = 'form-preview-field form-preview-field--dropdown';
      categoryWrapper.style.position = 'relative';
      
      const categoryLabel = document.createElement('label');
      categoryLabel.className = 'form-preview-field-label';
      categoryLabel.textContent = 'Category';
      categoryLabel.style.fontWeight = '600';
      categoryLabel.style.marginBottom = '8px';
      categoryLabel.style.display = 'block';
      
      // Create select wrapper for arrow positioning
      const categorySelectWrapper = document.createElement('div');
      categorySelectWrapper.style.position = 'relative';
      categorySelectWrapper.style.width = '100%';
      
      const categorySelect = document.createElement('select');
      categorySelect.className = 'form-preview-select';
      categorySelect.id = 'memberFormpickerCategory';
      categorySelect.style.width = '100%';
      categorySelect.style.height = '36px';
      categorySelect.style.padding = '0 12px';
      categorySelect.style.paddingRight = '40px';
      categorySelect.style.appearance = 'none';
      categorySelect.style.border = '1px solid var(--border)';
      categorySelect.style.borderRadius = '8px';
      categorySelect.style.background = 'rgba(0,0,0,0.35)';
      categorySelect.style.color = 'var(--button-text)';
      categorySelect.style.boxSizing = 'border-box';
      
      // Add placeholder option
      const categoryPlaceholder = document.createElement('option');
      categoryPlaceholder.value = '';
      categoryPlaceholder.textContent = 'Select a category';
      categoryPlaceholder.disabled = true;
      categoryPlaceholder.selected = true;
      categorySelect.appendChild(categoryPlaceholder);
      
      // Add category options with icons stored in data attributes
      sortedCategories.forEach(c => {
        if(!c || typeof c.name !== 'string') return;
        const option = document.createElement('option');
        option.value = c.name;
        option.textContent = c.name;
        option.dataset.icon = categoryIcons[c.name] || '';
        categorySelect.appendChild(option);
      });
      
      // Create dropdown arrow for category - positioned relative to select wrapper
      const categoryArrow = document.createElement('span');
      categoryArrow.className = 'formpicker-dropdown-arrow';
      categoryArrow.style.position = 'absolute';
      categoryArrow.style.top = '50%';
      categoryArrow.style.right = '18px';
      categoryArrow.style.width = '8px';
      categoryArrow.style.height = '8px';
      categoryArrow.style.border = '2px solid var(--button-text)';
      categoryArrow.style.borderTop = '0';
      categoryArrow.style.borderLeft = '0';
      categoryArrow.style.transform = 'translateY(-50%) rotate(45deg)';
      categoryArrow.style.pointerEvents = 'none';
      categoryArrow.setAttribute('aria-hidden', 'true');
      
      categorySelectWrapper.appendChild(categorySelect);
      categorySelectWrapper.appendChild(categoryArrow);
      
      categoryWrapper.appendChild(categoryLabel);
      categoryWrapper.appendChild(categorySelectWrapper);
      
      // Create subcategory dropdown wrapper (initially hidden)
      const subcategoryWrapper = document.createElement('div');
      subcategoryWrapper.className = 'form-preview-field form-preview-field--dropdown';
      subcategoryWrapper.style.position = 'relative';
      subcategoryWrapper.hidden = true;
      
      const subcategoryLabel = document.createElement('label');
      subcategoryLabel.className = 'form-preview-field-label';
      subcategoryLabel.textContent = 'Subcategory';
      subcategoryLabel.style.fontWeight = '600';
      subcategoryLabel.style.marginBottom = '8px';
      subcategoryLabel.style.display = 'block';
      
      // Create select wrapper for arrow positioning
      const subcategorySelectWrapper = document.createElement('div');
      subcategorySelectWrapper.style.position = 'relative';
      subcategorySelectWrapper.style.width = '100%';
      
      const subcategorySelect = document.createElement('select');
      subcategorySelect.className = 'form-preview-select';
      subcategorySelect.id = 'memberFormpickerSubcategory';
      subcategorySelect.style.width = '100%';
      subcategorySelect.style.height = '36px';
      subcategorySelect.style.padding = '0 12px';
      subcategorySelect.style.paddingRight = '40px';
      subcategorySelect.style.appearance = 'none';
      subcategorySelect.style.border = '1px solid var(--border)';
      subcategorySelect.style.borderRadius = '8px';
      subcategorySelect.style.background = 'rgba(0,0,0,0.35)';
      subcategorySelect.style.color = 'var(--button-text)';
      subcategorySelect.style.boxSizing = 'border-box';
      
      // Create dropdown arrow for subcategory - positioned relative to select wrapper
      const subcategoryArrow = document.createElement('span');
      subcategoryArrow.className = 'formpicker-dropdown-arrow';
      subcategoryArrow.style.position = 'absolute';
      subcategoryArrow.style.top = '50%';
      subcategoryArrow.style.right = '18px';
      subcategoryArrow.style.width = '8px';
      subcategoryArrow.style.height = '8px';
      subcategoryArrow.style.border = '2px solid var(--button-text)';
      subcategoryArrow.style.borderTop = '0';
      subcategoryArrow.style.borderLeft = '0';
      subcategoryArrow.style.transform = 'translateY(-50%) rotate(45deg)';
      subcategoryArrow.style.pointerEvents = 'none';
      subcategoryArrow.setAttribute('aria-hidden', 'true');
      
      subcategorySelectWrapper.appendChild(subcategorySelect);
      subcategorySelectWrapper.appendChild(subcategoryArrow);
      
      subcategoryWrapper.appendChild(subcategoryLabel);
      subcategoryWrapper.appendChild(subcategorySelectWrapper);
      
      // Handle category selection
      categorySelect.addEventListener('change', () => {
        const categoryName = categorySelect.value;
        selectedCategory = categoryName;
        selectedSubcategory = '';
        
        // Clear and populate subcategory dropdown
        subcategorySelect.innerHTML = '';
        if(categoryName){
          const category = sortedCategories.find(c => c.name === categoryName);
          if(category && Array.isArray(category.subs) && category.subs.length > 0){
            const subPlaceholder = document.createElement('option');
            subPlaceholder.value = '';
            subPlaceholder.textContent = 'Select a subcategory';
            subPlaceholder.disabled = true;
            subPlaceholder.selected = true;
            subcategorySelect.appendChild(subPlaceholder);
            
            category.subs.forEach(s => {
              const option = document.createElement('option');
              option.value = s;
              option.textContent = s;
              option.dataset.icon = subcategoryIcons[s] || '';
              subcategorySelect.appendChild(option);
            });
            
            subcategoryWrapper.hidden = false;
          } else {
            subcategoryWrapper.hidden = true;
          }
        } else {
          subcategoryWrapper.hidden = true;
        }
        
        renderConfiguredFields();
      });
      
      // Handle subcategory selection
      subcategorySelect.addEventListener('change', () => {
        selectedSubcategory = subcategorySelect.value;
        renderConfiguredFields();
      });
      
      dropdownsContainer.appendChild(categoryWrapper);
      dropdownsContainer.appendChild(subcategoryWrapper);
      formpickerCats.appendChild(dropdownsContainer);
    }
    if(memberForm){
      memberForm.addEventListener('submit', event => {
        let submitter = event.submitter || null;
        if(!submitter){
          const active = document.activeElement;
          if(active && memberForm.contains(active) && active.type === 'submit' && (active.tagName === 'BUTTON' || active.tagName === 'INPUT')){
            submitter = active;
          }
        }
        const isCreateSubmit = submitter
          ? submitter.id === 'memberCreatePostBtn'
          : (!!memberCreateSection && !memberCreateSection.hidden);
        if(!isCreateSubmit){
          return;
        }
        if(isSubmittingCreatePost){
          if(event && typeof event.preventDefault === 'function'){
            event.preventDefault();
          }
          return;
        }
        Promise.resolve(handleMemberCreatePost(event)).catch(err => {
          console.error('Member create submission failed', err);
          showCreateStatus('Unable to post your listing. Please try again.', { error: true });
          isSubmittingCreatePost = false;
          if(postButton){
            delete postButton.dataset.submitting;
            postButton.disabled = false;
          }
        });
      });
    }
    if(postButton){
      postButton.addEventListener('click', event => {
        Promise.resolve(handleMemberCreatePost(event)).catch(err => {
          console.error('Member create submission failed', err);
          showCreateStatus('Unable to post your listing. Please try again.', { error: true });
          isSubmittingCreatePost = false;
          if(postButton){
            delete postButton.dataset.submitting;
            postButton.disabled = false;
          }
        });
      });
    }
    if(typeof formbuilderCats !== 'undefined' && formbuilderCats){
      formbuilderCats.addEventListener('change', ()=>{
        refreshMemberSnapshotFromManager();
      });
    }

    initializeMemberFormbuilderSnapshot();
  }

  }
  
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
