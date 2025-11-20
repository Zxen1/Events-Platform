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
    // Mint HttpOnly token for connectors (no secrets in HTML)
    try{
      fetch('/gateway.php?action=issue-token', { credentials: 'same-origin' }).catch(()=>{});
    }catch(_e){}
    if(memberCreateSection){
      const formpickerCats = document.getElementById('memberFormpickerCats');
      const emptyState = document.getElementById('memberCreateEmpty');
      const formWrapper = document.getElementById('memberCreateFormWrapper');
      const formFields = document.getElementById('memberCreateFormFields');
      const postActions = document.getElementById('memberCreateActions');
      const postButton = document.getElementById('memberCreatePostBtn');
      if(postActions){ postActions.hidden = true; postActions.style.display = 'none'; }
      if(postButton){ postButton.hidden = true; postButton.disabled = true; postButton.style.display = 'none'; }
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
      const allowedMimePrefixes = ['image/'];
      const allowedExtensions = ['jpg','jpeg','png','gif','webp','bmp'];
      const maxFileSizeBytes = 10 * 1024 * 1024; // 10 MB default guard
      uploadEntries.forEach(entry => {
        if(!entry || typeof entry !== 'object') return;
        const files = Array.isArray(entry.files) ? entry.files : [];
        const label = typeof entry.label === 'string' ? entry.label : '';
        files.forEach(file => {
          if(!file) return;
          const isFileInstance = typeof File !== 'undefined' ? file instanceof File : true;
          if(isFileInstance || typeof file === 'object'){
            // Client-side guard before attempting upload
            const name = typeof file.name === 'string' ? file.name.toLowerCase() : '';
            const ext = name.includes('.') ? name.split('.').pop() : '';
            const hasAllowedMime = allowedMimePrefixes.some(prefix => (file.type || '').startsWith(prefix));
            const hasAllowedExt = allowedExtensions.includes(ext);
            const tooLarge = typeof file.size === 'number' && file.size > maxFileSizeBytes;
            if(!(hasAllowedMime && hasAllowedExt)){
              result.errors.push({ file, label, message: 'Only image files are allowed.' });
              return;
            }
            if(tooLarge){
              const mb = (maxFileSizeBytes / (1024 * 1024)).toFixed(1);
              result.errors.push({ file, label, message: `Image exceeds ${mb} MB.` });
              return;
            }
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
      
      // First, get currency codes from the currency field (versionPriceCurrencies)
      if(snapshot && Array.isArray(snapshot.versionPriceCurrencies)){
        snapshot.versionPriceCurrencies.forEach(code => {
          if(typeof code === 'string' && code.trim()){
            codes.add(code.trim().toUpperCase());
          }
        });
      }
      
      // Also collect from existing variant-pricing and venue-ticketing fields as fallback
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
      return Array.from(codes).sort();
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
      // Set window.currencyCodes for use in other parts of the application
      window.currencyCodes = currencyCodes;
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
        } else if(type === 'dropdown' || type === 'radio'){
          const options = Array.isArray(field.options) ? field.options : [];
          safe.options = options.map(opt => {
            if(typeof opt === 'string') return opt;
            if(opt && typeof opt === 'object' && typeof opt.version === 'string') return opt.version;
            return '';
          });
          // If options are empty or only have empty strings, try to seed from field type placeholder (e.g., "A,B,C")
          const hasNonEmptyOptions = safe.options.some(opt => opt && typeof opt === 'string' && opt.trim() !== '');
          if(!hasNonEmptyOptions){
            const fieldTypeKey = field.fieldTypeKey || field.key || '';
            if(fieldTypeKey === 'dropdown' || fieldTypeKey === 'radio'){
              // Try to get placeholder from FORM_FIELD_TYPES
              if(typeof window !== 'undefined' && Array.isArray(window.FORM_FIELD_TYPES)){
                const matchingFieldType = window.FORM_FIELD_TYPES.find(ft => ft.value === fieldTypeKey);
                if(matchingFieldType && matchingFieldType.placeholder){
                  const placeholderStr = matchingFieldType.placeholder.trim();
                  if(placeholderStr){
                    const parsed = placeholderStr.split(',').map(s => s.trim()).filter(s => s);
                    if(parsed.length > 0){
                      safe.options = parsed;
                    }
                  }
                }
              }
            }
            // If still empty after trying placeholder, add empty strings
            if(safe.options.length === 0){
              safe.options.push('', '', '');
            }
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
      // Never close the form if there's an active venue editor or if venue editor exists (regardless of message)
      // This prevents closing when user is working with venue ticketing fields
      if(activeVenueEditor || hasVenueEditor){
        // User is interacting with venue field, don't close the form
        console.log('[Member Forms] renderEmptyState: Skipping form close - venue editor active', { activeVenueEditor: !!activeVenueEditor, hasVenueEditor: !!hasVenueEditor, message });
        return;
      }
      console.log('[Member Forms] renderEmptyState: Closing form', { message });
      
      // Remove empty placeholder usage; we no longer show the empty state text
      if(formWrapper) formWrapper.hidden = true;
      if(postButton){ postButton.disabled = true; postButton.hidden = true; postButton.style.display = 'none'; }
      if(postActions){ postActions.hidden = true; postActions.style.display = 'none'; }
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
        const currencyWrapper = document.createElement('div');
        currencyWrapper.className = 'options-dropdown';
        const currencyMenuBtn = document.createElement('button');
        currencyMenuBtn.type = 'button';
        currencyMenuBtn.className = 'variant-pricing-currency';
        currencyMenuBtn.setAttribute('aria-haspopup', 'true');
        currencyMenuBtn.setAttribute('aria-expanded', 'false');
        const currencyMenuId = `member-variant-currency-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        currencyMenuBtn.setAttribute('aria-controls', currencyMenuId);
        const existingCurrency = option.currency || '';
        currencyMenuBtn.textContent = existingCurrency || 'Currency';
        currencyMenuBtn.dataset.value = existingCurrency;
        const currencyArrow = document.createElement('span');
        currencyArrow.className = 'dropdown-arrow';
        currencyArrow.setAttribute('aria-hidden', 'true');
        currencyMenuBtn.appendChild(currencyArrow);
        const currencyMenu = document.createElement('div');
        currencyMenu.className = 'options-menu';
        currencyMenu.id = currencyMenuId;
        currencyMenu.hidden = true;
        const placeholderBtn = document.createElement('button');
        placeholderBtn.type = 'button';
        placeholderBtn.className = 'menu-option';
        placeholderBtn.textContent = 'Currency';
        placeholderBtn.dataset.value = '';
        placeholderBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          currencyMenuBtn.textContent = 'Currency';
          currencyMenuBtn.dataset.value = '';
          currencyMenu.hidden = true;
          currencyMenuBtn.setAttribute('aria-expanded', 'false');
          option.currency = '';
          updatePostButtonState();
        });
        currencyMenu.appendChild(placeholderBtn);
        const availableCurrencyCodes = currencyCodes.length > 0 ? currencyCodes : (Array.isArray(window.currencyCodes) ? window.currencyCodes : []);
        availableCurrencyCodes.forEach(code => {
          const optionBtn = document.createElement('button');
          optionBtn.type = 'button';
          optionBtn.className = 'menu-option';
          optionBtn.textContent = code;
          optionBtn.dataset.value = code;
          optionBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currencyMenuBtn.textContent = code;
            currencyMenuBtn.dataset.value = code;
            currencyMenu.hidden = true;
            currencyMenuBtn.setAttribute('aria-expanded', 'false');
            option.currency = code;
            updatePostButtonState();
          });
          currencyMenu.appendChild(optionBtn);
        });
        currencyMenuBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const open = !currencyMenu.hasAttribute('hidden');
          if(open){
            currencyMenu.hidden = true;
            currencyMenuBtn.setAttribute('aria-expanded', 'false');
          } else {
            currencyMenu.hidden = false;
            currencyMenuBtn.setAttribute('aria-expanded', 'true');
            const outsideHandler = (ev) => {
              if(!ev.target.closest(currencyWrapper)){
                currencyMenu.hidden = true;
                currencyMenuBtn.setAttribute('aria-expanded', 'false');
                document.removeEventListener('click', outsideHandler);
                document.removeEventListener('pointerdown', outsideHandler);
              }
            };
            setTimeout(() => {
              document.addEventListener('click', outsideHandler);
              document.addEventListener('pointerdown', outsideHandler);
            }, 0);
          }
        });
        currencyMenu.addEventListener('click', (e) => e.stopPropagation());
        currencyWrapper.appendChild(currencyMenuBtn);
        currencyWrapper.appendChild(currencyMenu);
        const priceInput = document.createElement('input');
        priceInput.type = 'text';
        priceInput.className = 'variant-pricing-price form-preview-variant-pricing-price';
        priceInput.placeholder = '0.00';
        priceInput.value = option.price || '';
        priceInput.addEventListener('blur', ()=>{
          option.price = formatPriceValue(priceInput.value);
          priceInput.value = option.price;
        });

        bottomRow.append(currencyWrapper, priceInput);

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

    // buildVenueSessionEditor removed - using working buildVenueSessionPreview from index.js instead

    async function initializeMemberFormbuilderSnapshot(){
      const loadingMsg = await getMessage('msg_post_loading_form', {}, false) || 'Loading form fields…';
      // Don't close form if venue editor exists (check before clearing)
      const hasVenueEditor = formFields && formFields.querySelector('.venue-session-editor');
      if(!hasVenueEditor){
        renderEmptyState(loadingMsg);
        if(formWrapper) formWrapper.hidden = true;
        if(formFields) formFields.innerHTML = '';
        if(postButton) postButton.disabled = true;
      }
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
        // Removed excessive logging
        renderFormPicker();
        
        // Prevent form wrapper from closing when clicking inside venue fields
        if(formWrapper){
          formWrapper.addEventListener('click', (e)=>{
            const target = e.target;
            const venueEditor = target.closest('.venue-session-editor');
            const isGeocoderElement = target.closest('.mapboxgl-ctrl-geocoder');
            
            if(venueEditor && !isGeocoderElement){
              console.log('[Member Forms] Click inside venue editor - preventing form close', { target: target.tagName, className: target.className });
              e.stopPropagation();
              e.stopImmediatePropagation();
              return false;
            }
          }, true);
          
          // Also prevent other events that might close the form
          formWrapper.addEventListener('pointerdown', (e)=>{
            const target = e.target;
            const venueEditor = target.closest('.venue-session-editor');
            const isGeocoderElement = target.closest('.mapboxgl-ctrl-geocoder');
            
            if(venueEditor && !isGeocoderElement){
              console.log('[Member Forms] Pointerdown inside venue editor - preventing form close');
              e.stopPropagation();
              e.stopImmediatePropagation();
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
      // Ensure field defaults are applied first
      const safeField = ensureFieldDefaultsForMember(field);
      
      const wrapper = document.createElement('div');
      wrapper.className = 'panel-field form-preview-field';
      const labelText = safeField.name && safeField.name.trim() ? safeField.name.trim() : `Field ${index + 1}`;
      const labelId = `memberCreateFieldLabel-${++fieldIdCounter}`;
      const controlId = `memberCreateField-${fieldIdCounter}`;
      const label = document.createElement('label');
      label.id = labelId;
      label.className = 'form-preview-field-label';
      label.setAttribute('for', controlId);
      label.textContent = labelText;
      if(safeField.required){
        wrapper.classList.add('form-preview-field--required');
        label.appendChild(document.createTextNode(' '));
        const asterisk = document.createElement('span');
        asterisk.className = 'required-asterisk';
        asterisk.textContent = '*';
        label.appendChild(asterisk);
      }
      const header = document.createElement('div');
      header.className = 'form-preview-field-header';
      header.style.position = 'relative';
      header.appendChild(label);
      
      const placeholder = safeField.placeholder || '';
      let control = null;

      // Use fieldTypeKey/key as PRIMARY source for field type identification (not type)
      const fieldTypeKey = safeField.fieldTypeKey || safeField.key || '';
      // CRITICAL: For radio and dropdown, ALWAYS use fieldTypeKey if available
      // Otherwise fall back to type
      let resolvedBaseType = '';
      if(fieldTypeKey === 'radio' || fieldTypeKey === 'dropdown'){
        resolvedBaseType = fieldTypeKey;
      } else {
        resolvedBaseType = fieldTypeKey || safeField.type || 'text-box';
      }
      
      if(resolvedBaseType === 'description' || resolvedBaseType === 'text-area'){
        const textarea = document.createElement('textarea');
        textarea.id = controlId;
        textarea.rows = resolvedBaseType === 'description' ? 6 : 4;
        textarea.placeholder = placeholder;
        textarea.className = 'form-preview-textarea';
        if(resolvedBaseType === 'description'){
          textarea.classList.add('form-preview-description');
        }
        if(safeField.required) textarea.required = true;
        control = textarea;
      } else if(resolvedBaseType === 'dropdown'){
        wrapper.classList.add('form-preview-field--dropdown');
        const dropdownWrapper = document.createElement('div');
        dropdownWrapper.className = 'options-dropdown';
        const menuBtn = document.createElement('button');
        menuBtn.type = 'button';
        menuBtn.id = controlId;
        menuBtn.className = 'form-preview-select';
        menuBtn.setAttribute('aria-haspopup', 'true');
        menuBtn.setAttribute('aria-expanded', 'false');
        const menuId = `${controlId}-menu`;
        menuBtn.setAttribute('aria-controls', menuId);
        if(safeField.required) {
          menuBtn.setAttribute('data-required', 'true');
          menuBtn.setAttribute('aria-required', 'true');
        }
        const options = Array.isArray(safeField.options) ? safeField.options : [];
        const defaultText = placeholder || 'Select an option';
        menuBtn.textContent = defaultText;
        menuBtn.dataset.value = '';
        const arrow = document.createElement('span');
        arrow.className = 'dropdown-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        menuBtn.appendChild(arrow);
        const optionsMenu = document.createElement('div');
        optionsMenu.className = 'options-menu';
        optionsMenu.id = menuId;
        optionsMenu.hidden = true;
        if(!safeField.required){
          const placeholderBtn = document.createElement('button');
          placeholderBtn.type = 'button';
          placeholderBtn.className = 'menu-option';
          placeholderBtn.textContent = placeholder || 'Select an option';
          placeholderBtn.dataset.value = '';
          placeholderBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            menuBtn.textContent = placeholder || 'Select an option';
            menuBtn.appendChild(arrow);
            menuBtn.dataset.value = '';
            optionsMenu.hidden = true;
            menuBtn.setAttribute('aria-expanded', 'false');
            updatePostButtonState();
          });
          optionsMenu.appendChild(placeholderBtn);
        }
        options.forEach((optionValue, optionIndex) => {
          const optionBtn = document.createElement('button');
          optionBtn.type = 'button';
          optionBtn.className = 'menu-option';
          const stringValue = typeof optionValue === 'string' ? optionValue : String(optionValue ?? '');
          optionBtn.textContent = stringValue.trim() || '';
          optionBtn.dataset.value = stringValue;
          optionBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            menuBtn.textContent = stringValue.trim() || 'Select an option';
            menuBtn.appendChild(arrow);
            menuBtn.dataset.value = stringValue;
            optionsMenu.hidden = true;
            menuBtn.setAttribute('aria-expanded', 'false');
            updatePostButtonState();
          });
          optionsMenu.appendChild(optionBtn);
        });
        menuBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const open = !optionsMenu.hasAttribute('hidden');
          if(open){
            optionsMenu.hidden = true;
            menuBtn.setAttribute('aria-expanded', 'false');
          } else {
            optionsMenu.hidden = false;
            menuBtn.setAttribute('aria-expanded', 'true');
            const outsideHandler = (ev) => {
              if(!ev.target.closest(dropdownWrapper)){
                optionsMenu.hidden = true;
                menuBtn.setAttribute('aria-expanded', 'false');
                document.removeEventListener('click', outsideHandler);
                document.removeEventListener('pointerdown', outsideHandler);
              }
            };
            setTimeout(() => {
              document.addEventListener('click', outsideHandler);
              document.addEventListener('pointerdown', outsideHandler);
            }, 0);
          }
        });
        optionsMenu.addEventListener('click', (e) => e.stopPropagation());
        dropdownWrapper.appendChild(menuBtn);
        dropdownWrapper.appendChild(optionsMenu);
        control = dropdownWrapper;
      } else if(resolvedBaseType === 'radio' || fieldTypeKey === 'radio'){
        wrapper.classList.add('form-preview-field--radio-toggle');
        label.removeAttribute('for');
        const radioGroup = document.createElement('div');
        radioGroup.className = 'form-preview-radio-group';
        radioGroup.setAttribute('role', 'radiogroup');
        radioGroup.setAttribute('aria-labelledby', labelId);
        const radioName = `member-create-radio-${fieldIdCounter}`;
        const options = Array.isArray(safeField.options) ? safeField.options : [];
        if(options.length){
          options.forEach((optionValue, optionIndex)=>{
            const radioLabel = document.createElement('label');
            radioLabel.className = 'form-preview-radio-option';
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = radioName;
            // Use the actual option value, don't fall back to "Option X"
            const stringValue = typeof optionValue === 'string' ? optionValue : String(optionValue ?? '');
            radio.value = stringValue;
            if(safeField.required && optionIndex === 0) radio.required = true;
            const displayValue = stringValue.trim() || '';
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
      } else if(resolvedBaseType === 'images'){
        wrapper.classList.add('form-preview-field--images');
        label.removeAttribute('for');
        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'form-preview-images';
        const fileInput = document.createElement('input');
        fileInput.id = controlId;
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.accept = 'image/*';
        if(safeField.required) fileInput.required = true;
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
      } else if(resolvedBaseType === 'variant-pricing'){
        wrapper.classList.add('form-preview-field--variant-pricing');
        label.removeAttribute('for');
        control = buildVersionPriceEditor(safeField, labelId);
      } else if(resolvedBaseType === 'venue-ticketing'){
        wrapper.classList.add('form-preview-field--venues-sessions-pricing');
        label.removeAttribute('for');
        // Use the working buildVenueSessionPreview from index.js (form preview)
        if(typeof window !== 'undefined' && typeof window.buildVenueSessionPreview === 'function'){
          control = window.buildVenueSessionPreview(safeField, controlId);
        } else {
          // Fallback error if function not available
          const errorDiv = document.createElement('div');
          errorDiv.className = 'venue-ticketing-error';
          errorDiv.textContent = 'Venue ticketing field type is not available. Please refresh the page.';
          errorDiv.style.color = 'red';
          errorDiv.style.padding = '10px';
          control = errorDiv;
        }
      } else if(resolvedBaseType === 'website-url' || resolvedBaseType === 'tickets-url'){
        wrapper.classList.add('form-preview-field--url');
        const urlWrapper = document.createElement('div');
        urlWrapper.className = 'form-preview-url-wrapper';
        const input = document.createElement('input');
        input.id = controlId;
        input.type = 'url';
        input.placeholder = placeholder || 'https://example.com';
        input.autocomplete = 'url';
        input.className = 'form-preview-url-input';
        if(safeField.required) input.required = true;
        urlWrapper.appendChild(input);
        control = urlWrapper;
      } else if(resolvedBaseType === 'location'){
        wrapper.classList.add('form-preview-field--location');
        const ensureLocationState = ()=>{
          if(!safeField.location || typeof safeField.location !== 'object'){
            safeField.location = { address: '', latitude: '', longitude: '' };
          } else {
            if(typeof safeField.location.address !== 'string') safeField.location.address = '';
            if(typeof safeField.location.latitude !== 'string') safeField.location.latitude = '';
            if(typeof safeField.location.longitude !== 'string') safeField.location.longitude = '';
          }
          return safeField.location;
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
          if(safeField.required) fallback.required = true;
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
            if(safeField.required) geocoderInput.required = true;
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
        const isDescriptionField = resolvedBaseType === 'description' || resolvedBaseType === 'text-area' || 
                                   safeField.type === 'description' || safeField.type === 'text-area' ||
                                   (typeof safeField.type === 'string' && (safeField.type.includes('description') || safeField.type.includes('text-area')));
        
        if(isDescriptionField){
          const textarea = document.createElement('textarea');
          textarea.id = controlId;
          textarea.rows = resolvedBaseType === 'description' ? 6 : 4;
          textarea.placeholder = placeholder;
          textarea.className = 'form-preview-textarea';
          if(resolvedBaseType === 'description' || safeField.type === 'description' || (typeof safeField.type === 'string' && safeField.type.includes('description'))){
            textarea.classList.add('form-preview-description');
          }
          if(safeField.required) textarea.required = true;
          control = textarea;
        } else {
          const input = document.createElement('input');
          input.id = controlId;
          if(safeField.type === 'email' || resolvedBaseType === 'email'){
            input.type = 'email';
            input.autocomplete = 'email';
          } else if(safeField.type === 'phone' || resolvedBaseType === 'phone'){
            input.type = 'tel';
            input.autocomplete = 'tel';
          } else {
            input.type = 'text';
          }
          input.placeholder = placeholder;
          if(safeField.required) input.required = true;
          control = input;
        }
      }

      if(control){
        if(control instanceof HTMLElement){
          if(!control.id){
            control.setAttribute('aria-labelledby', labelId);
          }
        }
        wrapper.append(header, control);
      } else {
        wrapper.appendChild(header);
      }
      return wrapper;
    }

    function isCreateFormValid(){
      if(!formFields) return false;
      // Query all required standard controls
      const controls = formFields.querySelectorAll('input[required], textarea[required], select[required]');
      for(const el of controls){
        if(el.disabled || el.closest('[hidden]')) continue;
        if(el.type === 'file'){
          if(!el.files || el.files.length === 0) return false;
          continue;
        }
        const val = (el.value || '').trim();
        if(val === '') return false;
      }
      // Check required button-based dropdown menus
      const requiredMenuBtns = formFields.querySelectorAll('button.form-preview-select[data-required="true"]');
      for(const menuBtn of requiredMenuBtns){
        if(menuBtn.disabled || menuBtn.closest('[hidden]')) continue;
        const val = (menuBtn.dataset.value || '').trim();
        if(val === '') return false;
      }
      
      // Continue with email/url/tel validation for regular inputs
      for(const el of controls){
        if(el.disabled || el.closest('[hidden]')) continue;
        if(el.type === 'file') continue;
        const val = (el.value || '').trim();
        if(el.type === 'email'){
				// Stricter but still pragmatic email check
				if(!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(val)) return false;
        }
			if(el.dataset && el.dataset.urlType){ // our URL fields are text inputs with data-url-type
				let candidate = val;
				if(candidate && !candidate.includes('://')){
					candidate = 'https://' + candidate;
				}
				try {
					const parsed = new URL(candidate);
					// Normalize the input value so downstream logic sees a valid URL
					if(el.value !== parsed.href){ el.value = parsed.href; }
				} catch(_e){
					return false;
				}
			} else if(el.type === 'url' || el.inputMode === 'url'){
				try {
					const parsed = new URL(val.includes('://') ? val : 'https://' + val);
					if(el.value !== parsed.href){ el.value = parsed.href; }
				} catch(_e){ return false; }
			}
			if(el.type === 'tel' || el.inputMode === 'tel'){
				// Allow digits, spaces, parentheses, dashes, plus; require at least 7 digits
				const digits = val.replace(/\D+/g,'');
				if(!(digits.length >= 7 && /^[-+() 0-9]+$/.test(val))) return false;
        }
      }

		// Composite validation: Variant Pricing
		const requiredVariantEditors = formFields.querySelectorAll('.form-preview-field--variant-pricing .variant-pricing-options-editor[aria-required="true"]');
		for(const editor of requiredVariantEditors){
			let ok = false;
			const rows = editor.querySelectorAll('.variant-pricing-option');
			for(const row of rows){
				const currency = row.querySelector('button.variant-pricing-currency');
				const price = row.querySelector('.variant-pricing-price');
				const hasCurrency = currency && String(currency.dataset.value || '').trim();
				const hasPrice = price && String(price.value || '').trim();
				if(hasCurrency && hasPrice){ ok = true; break; }
			}
			if(!ok) return false;
		}

		// Composite validation: Venue Ticketing (must have at least one tier with currency+price)
		const requiredVenueEditors = formFields.querySelectorAll('.venue-session-editor[aria-required="true"]');
		for(const editor of requiredVenueEditors){
			let valid = false;
			const tierRows = editor.querySelectorAll('.tier-row');
			for(const tr of tierRows){
				const currency = tr.querySelector('select');
				const price = tr.querySelector('input[type="text"], input[type="number"]');
				const hasCurrency = currency && String(currency.value || '').trim();
				const hasPrice = price && String(price.value || '').trim();
				if(hasCurrency && hasPrice){ valid = true; break; }
			}
			if(!valid) return false;
		}
      return true;
    }

    function updatePostButtonState(){
      if(!postButton) return;
      const ready = isCreateFormValid();
      postButton.disabled = !ready;
    }

		function renderConfiguredFields(){
      // Only block if user is ACTIVELY typing in venue editor (not just if it exists)
      // This allows subcategory changes to work even when venue editor is present
      const activeElement = document.activeElement;
      const activeVenueEditor = activeElement && activeElement.closest('.venue-session-editor');
      const isActivelyTyping = activeVenueEditor && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA'
      );
      
      // Only block if actively typing - allow subcategory changes
      if(isActivelyTyping){
        console.log('[Member Forms] renderConfiguredFields: Blocked - user actively typing in venue editor');
        return;
      }
      
      if(!selectedCategory || !selectedSubcategory){
        // No form if either category or subcategory is not selected
        renderEmptyState();
        if(formWrapper) formWrapper.hidden = true;
        if(formFields) formFields.innerHTML = '';
        if(postButton) postButton.disabled = true;
        if(postButton) postButton.hidden = true;
        if(postActions) postActions.hidden = true;
        return;
      }
      // Don't clear form if user is actively typing in venue editor
      // But allow re-render for subcategory changes
      if(isActivelyTyping){
        console.log('[Member Forms] renderConfiguredFields: Skipping re-render - user actively typing');
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
      if(postActions){ postActions.hidden = false; postActions.style.display = ''; }
      if(postButton){ postButton.hidden = false; postButton.style.display = ''; updatePostButtonState(); }
			
			// Apply any saved draft and bind autosave for dynamic fields
			try{
        const draftKey = 'member-create-draft-v1::' + (selectedCategory || '') + '::' + (selectedSubcategory || '');
        const draft = (function(){ try{ return JSON.parse(localStorage.getItem(draftKey)||'null'); }catch(_e){ return null; } })();
				if(draft && typeof draft === 'object'){
          formFields.querySelectorAll('input,select,textarea').forEach(function(el){
						if(!el || el.disabled) return;
						if(el.type === 'file') return;
						var key = el.id || el.name || '';
						if(!key) return;
						if(!(key in draft)) return;
						var val = draft[key];
            if(el.type === 'checkbox'){
              el.checked = !!val;
              try{ el.dispatchEvent(new Event('input', { bubbles: true })); }catch(_e){}
              return;
            }
            if(el.type === 'radio'){
              el.checked = (val === el.value);
              try{ el.dispatchEvent(new Event('input', { bubbles: true })); }catch(_e){}
              return;
            }
            if(typeof val === 'string' && el.value !== val){
              el.value = val;
              try{ el.dispatchEvent(new Event('input', { bubbles: true })); }catch(_e){}
            }
					});
					// Restore button-based dropdown menus
					formFields.querySelectorAll('button.form-preview-select').forEach(function(menuBtn){
						if(!menuBtn || menuBtn.disabled) return;
						var key = menuBtn.id || '';
						if(!key || !(key in draft)) return;
						var val = draft[key];
						if(typeof val === 'string' && val.trim()){
							menuBtn.dataset.value = val;
							// Find matching option button and update text
							const menuId = menuBtn.getAttribute('aria-controls');
							if(menuId){
								const optionsMenu = document.getElementById(menuId);
								if(optionsMenu){
									const optionBtn = optionsMenu.querySelector(`button[data-value="${val}"]`);
									if(optionBtn){
										menuBtn.textContent = optionBtn.textContent;
										const arrow = menuBtn.querySelector('.dropdown-arrow');
										if(arrow) menuBtn.appendChild(arrow);
									}
								}
							}
						}
					});
					try{ updatePostButtonState(); }catch(_e){}
				}
			}catch(_e){}
			if(!formFields.__draftAutosaveBound){
				var autosave = function(){
					try{
						var snapshot = {};
						formFields.querySelectorAll('input,select,textarea').forEach(function(el){
							if(!el || el.disabled) return;
							if(el.type === 'file') return;
							var key = el.id || el.name || '';
							if(!key) return;
							if(el.type === 'checkbox'){ snapshot[key] = !!el.checked; return; }
							if(el.type === 'radio'){ if(el.checked){ snapshot[el.name||key] = el.value; } return; }
							snapshot[key] = el.value;
						});
						// Also save button-based dropdown menus
						formFields.querySelectorAll('button.form-preview-select').forEach(function(menuBtn){
							if(!menuBtn || menuBtn.disabled) return;
							var key = menuBtn.id || '';
							if(!key) return;
							snapshot[key] = menuBtn.dataset.value || '';
						});
            var k = 'member-create-draft-v1::' + (selectedCategory || '') + '::' + (selectedSubcategory || '');
            localStorage.setItem(k, JSON.stringify(snapshot));
						try{ updatePostButtonState(); }catch(_e){}
					}catch(_e){}
				};
				formFields.addEventListener('input', autosave, true);
				formFields.addEventListener('change', autosave, true);
				// Re-check submit state when composite editors mutate via clicks (add/remove rows, etc.)
				formFields.addEventListener('click', function(e){
					try{
						var t = e.target;
						if(!t) return;
						if(t.closest('.venue-session-editor') || t.closest('.variant-pricing-option') || t.closest('.variant-pricing-option-actions')){
							setTimeout(function(){ try{ updatePostButtonState(); }catch(_e){} }, 0);
						}
					}catch(_e){}
				}, true);
				formFields.__draftAutosaveBound = true;
			}
    }
    
    function ensureFieldDefaultsForMember(field){
      const safeField = field && typeof field === 'object' ? field : {};
      if(typeof safeField.name !== 'string'){
        safeField.name = '';
      } else if(!safeField.name.trim()){
        safeField.name = '';
      }
      // Use fieldTypeKey or key as source of truth if type is not set or is just input_type
      const fieldTypeKey = safeField.fieldTypeKey || safeField.key || safeField.type || '';
      if(typeof safeField.type !== 'string' || !safeField.type.trim()){
        // If we have a fieldTypeKey, use it; otherwise default to text-box
        safeField.type = fieldTypeKey || 'text-box';
      } else {
        // Normalize field type to extract base type (e.g., "description [field=2]" -> "description")
        // BUT preserve description and text-area types BEFORE normalization
        const originalType = safeField.type;
        const normalizedType = getBaseFieldType(originalType);
        
        // If fieldTypeKey exists and is different from normalized type, prefer fieldTypeKey
        // This ensures radio uses 'radio' not something else
        if(fieldTypeKey && fieldTypeKey !== normalizedType && 
           (fieldTypeKey === 'radio' || fieldTypeKey === 'dropdown' || 
            fieldTypeKey === 'description' || fieldTypeKey === 'text-area')){
          safeField.type = fieldTypeKey;
        }
        // If the original type or normalized type is description/text-area, preserve it
        else if(originalType === 'description' || originalType === 'text-area' || 
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
      // CRITICAL: Preserve fieldTypeKey and key on the returned object
      if(field && typeof field === 'object'){
        if(field.fieldTypeKey) safeField.fieldTypeKey = field.fieldTypeKey;
        if(field.key) safeField.key = field.key;
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
      const maxFileSizeBytes = (() => {
        const custom = parseInt(fileInput.dataset.maxBytes || '0', 10);
        return Number.isFinite(custom) && custom > 0 ? custom : 10 * 1024 * 1024;
      })();
      const allowedMimePrefixes = ['image/'];
      const allowedExtensions = ['jpg','jpeg','png','gif','webp','bmp'];
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
          const name = typeof file.name === 'string' ? file.name.toLowerCase() : '';
          const ext = name.includes('.') ? name.split('.').pop() : '';
          const hasAllowedMime = allowedMimePrefixes.some(prefix => (file.type || '').startsWith(prefix));
          const hasAllowedExt = allowedExtensions.includes(ext);
          if(!(hasAllowedMime && hasAllowedExt)){
            if(messageEl){
              messageEl.textContent = 'Only image files are allowed (jpg, jpeg, png, gif, webp, bmp).';
              messageEl.hidden = false;
            }
            return;
          }
          if(typeof file.size === 'number' && file.size > maxFileSizeBytes){
            if(messageEl){
              const mb = (maxFileSizeBytes / (1024 * 1024)).toFixed(1);
              messageEl.textContent = `Each image must be ≤ ${mb} MB.`;
              messageEl.hidden = false;
            }
            return;
          }
          
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
              // Re-validate submit state after removal
              try{ updatePostButtonState(); }catch(_e){}
            });
            thumb.appendChild(img);
            thumb.appendChild(removeBtn);
            previewGrid.appendChild(thumb);
          };
          reader.readAsDataURL(file);
        });
        // Re-validate submit state after selecting files
        try{ updatePostButtonState(); }catch(_e){}
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
          wrapper.classList.add('form-preview-field--dropdown');
          const dropdownWrapper = document.createElement('div');
          dropdownWrapper.className = 'options-dropdown';
          const menuBtn = document.createElement('button');
          menuBtn.type = 'button';
          menuBtn.className = 'form-preview-select';
          menuBtn.setAttribute('aria-haspopup', 'true');
          menuBtn.setAttribute('aria-expanded', 'false');
          const selectId = `${baseId}-input`;
          menuBtn.id = selectId;
          if(previewField.required) menuBtn.setAttribute('data-required', 'true');
          const menuId = `${selectId}-menu`;
          menuBtn.setAttribute('aria-controls', menuId);
          const options = Array.isArray(previewField.options) ? previewField.options : [];
          const defaultText = options.length > 0 ? options[0].trim() || 'Select an option' : 'Select an option';
          menuBtn.textContent = defaultText;
          const arrow = document.createElement('span');
          arrow.className = 'dropdown-arrow';
          arrow.setAttribute('aria-hidden', 'true');
          menuBtn.appendChild(arrow);
          const optionsMenu = document.createElement('div');
          optionsMenu.className = 'options-menu';
          optionsMenu.id = menuId;
          optionsMenu.hidden = true;
          if(options.length){
            options.forEach((optionValue, optionIndex) => {
              const optionBtn = document.createElement('button');
              optionBtn.type = 'button';
              optionBtn.className = 'menu-option';
              const stringValue = typeof optionValue === 'string' ? optionValue : String(optionValue ?? '');
              optionBtn.textContent = stringValue.trim() || '';
              optionBtn.dataset.value = stringValue;
              optionBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                menuBtn.textContent = stringValue.trim() || 'Select an option';
                optionsMenu.hidden = true;
                menuBtn.setAttribute('aria-expanded', 'false');
              });
              optionsMenu.appendChild(optionBtn);
            });
          } else {
            const placeholderBtn = document.createElement('button');
            placeholderBtn.type = 'button';
            placeholderBtn.className = 'menu-option';
            placeholderBtn.textContent = 'Select an option';
            placeholderBtn.disabled = true;
            optionsMenu.appendChild(placeholderBtn);
          }
          menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = !optionsMenu.hasAttribute('hidden');
            if(open){
              optionsMenu.hidden = true;
              menuBtn.setAttribute('aria-expanded', 'false');
            } else {
              optionsMenu.hidden = false;
              menuBtn.setAttribute('aria-expanded', 'true');
              const outsideHandler = (ev) => {
                if(!ev.target.closest(dropdownWrapper)){
                  optionsMenu.hidden = true;
                  menuBtn.setAttribute('aria-expanded', 'false');
                  document.removeEventListener('click', outsideHandler);
                }
              };
              setTimeout(() => document.addEventListener('click', outsideHandler), 0);
            }
          });
          optionsMenu.addEventListener('click', (e) => e.stopPropagation());
          dropdownWrapper.appendChild(menuBtn);
          dropdownWrapper.appendChild(optionsMenu);
          control = dropdownWrapper;
        } else {
          // Use fieldTypeKey/key as fallback for field type identification
          const fieldTypeKey = previewField.fieldTypeKey || previewField.key || '';
          if(fieldTypeKey === 'radio' || baseType === 'radio'){
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
                const stringValue = typeof optionValue === 'string' ? optionValue : String(optionValue ?? '');
                radio.value = stringValue;
                // Use the actual option value, don't fall back to "Option X"
                const radioText = document.createElement('span');
                radioText.textContent = stringValue.trim() || '';
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
            if(control && previewField.required){
              control.setAttribute('aria-required','true');
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

              const currencyWrapper = document.createElement('div');
              currencyWrapper.className = 'options-dropdown';
              const currencyMenuBtn = document.createElement('button');
              currencyMenuBtn.type = 'button';
              currencyMenuBtn.className = 'variant-pricing-currency';
              currencyMenuBtn.setAttribute('aria-haspopup', 'true');
              currencyMenuBtn.setAttribute('aria-expanded', 'false');
              const currencyMenuId = `${baseId}-currency-${optionIndex}-menu`;
              currencyMenuBtn.setAttribute('aria-controls', currencyMenuId);
              const currencyArrow = document.createElement('span');
              currencyArrow.className = 'dropdown-arrow';
              currencyArrow.setAttribute('aria-hidden', 'true');
              currencyMenuBtn.appendChild(currencyArrow);
              const currencyMenu = document.createElement('div');
              currencyMenu.className = 'options-menu';
              currencyMenu.id = currencyMenuId;
              currencyMenu.hidden = true;
              const placeholderBtn = document.createElement('button');
              placeholderBtn.type = 'button';
              placeholderBtn.className = 'menu-option';
              placeholderBtn.textContent = 'Currency';
              placeholderBtn.dataset.value = '';
              placeholderBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                currencyMenuBtn.textContent = 'Currency';
                currencyMenuBtn.dataset.value = '';
                currencyMenu.hidden = true;
                currencyMenuBtn.setAttribute('aria-expanded', 'false');
                const previousCurrency = previewField.options[optionIndex].currency || '';
                previewField.options[optionIndex].currency = '';
                const priceCleared = updatePriceState();
                if(previousCurrency !== '' || priceCleared){
                  safeNotifyFormbuilderChange();
                }
              });
              currencyMenu.appendChild(placeholderBtn);
              const currencyOptions = Array.isArray(window.currencyCodes) ? window.currencyCodes : [];
              currencyOptions.forEach(code => {
                const optionBtn = document.createElement('button');
                optionBtn.type = 'button';
                optionBtn.className = 'menu-option';
                optionBtn.textContent = code;
                optionBtn.dataset.value = code;
                optionBtn.addEventListener('click', (e) => {
                  e.stopPropagation();
                  currencyMenuBtn.textContent = code;
                  currencyMenuBtn.dataset.value = code;
                  currencyMenu.hidden = true;
                  currencyMenuBtn.setAttribute('aria-expanded', 'false');
                  const previousCurrency = previewField.options[optionIndex].currency || '';
                  previewField.options[optionIndex].currency = code;
                  const priceCleared = updatePriceState();
                  if(isCurrencySelected()){
                    commitPriceValue();
                  }
                  if(previousCurrency !== code || priceCleared){
                    safeNotifyFormbuilderChange();
                  }
                });
                currencyMenu.appendChild(optionBtn);
              });
              currencyMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const open = !currencyMenu.hasAttribute('hidden');
                if(open){
                  currencyMenu.hidden = true;
                  currencyMenuBtn.setAttribute('aria-expanded', 'false');
                } else {
                  currencyMenu.hidden = false;
                  currencyMenuBtn.setAttribute('aria-expanded', 'true');
                  const outsideHandler = (ev) => {
                    if(!ev.target.closest(currencyWrapper)){
                      currencyMenu.hidden = true;
                      currencyMenuBtn.setAttribute('aria-expanded', 'false');
                      document.removeEventListener('click', outsideHandler);
                    }
                  };
                  setTimeout(() => document.addEventListener('click', outsideHandler), 0);
                }
              });
              currencyMenu.addEventListener('click', (e) => e.stopPropagation());
              currencyWrapper.appendChild(currencyMenuBtn);
              currencyWrapper.appendChild(currencyMenu);
              const currencySelect = currencyMenuBtn; // Keep reference for isCurrencySelected
              const isCurrencySelected = ()=> (currencyMenuBtn.dataset.value || '').trim() !== '';
              // Set initial value
              if(optionValue.currency && optionValue.currency.trim()){
                currencyMenuBtn.textContent = optionValue.currency;
                currencyMenuBtn.dataset.value = optionValue.currency;
              } else {
                currencyMenuBtn.textContent = 'Currency';
                currencyMenuBtn.dataset.value = '';
              }

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
              // Currency change is handled in the menu option click handlers above

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
              bottomRow.append(currencyWrapper, priceInput, actions);

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
                  focusEl = targetRow.querySelector('button.variant-pricing-currency');
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
          // Normalize and validate on input/blur to keep submit state accurate
          const normalizeUrl = () => {
            const raw = (urlInput.value || '').trim();
            if(!raw) return;
            const withScheme = raw.includes('://') ? raw : ('https://' + raw);
            try{
              const parsed = new URL(withScheme);
              if(urlInput.value !== parsed.href){ urlInput.value = parsed.href; }
            }catch(_e){ /* ignore here; validation will catch */ }
          };
          urlInput.addEventListener('blur', () => { normalizeUrl(); try{ updatePostButtonState(); }catch(_e){} });
          urlInput.addEventListener('input', () => { try{ updatePostButtonState(); }catch(_e){} });
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
          latitudeInput.id = `${baseId}-location-latitude`;
          latitudeInput.addEventListener('input', ()=>{ locationState.latitude = latitudeInput.value; });
          const longitudeInput = document.createElement('input');
          longitudeInput.type = 'hidden';
          longitudeInput.dataset.locationLongitude = 'true';
          longitudeInput.value = locationState.longitude || '';
          longitudeInput.id = `${baseId}-location-longitude`;
          longitudeInput.addEventListener('input', ()=>{ locationState.longitude = longitudeInput.value; });
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
                  : (typeof window.searchLocalVenues === 'function'
                      ? ((query) => window.searchLocalVenues(query))
                      : null));
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
                const handlePointerDown = (e) => {
                  setGeocoderActive(true);
                  // CRITICAL: Prevent form closure when clicking on geocoder
                  if(e){
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                  }
                };
                geocoderRoot.addEventListener('focusin', handleFocusIn);
                geocoderRoot.addEventListener('focusout', handleFocusOut);
                geocoderRoot.addEventListener('pointerdown', handlePointerDown);
                // CRITICAL: Prevent form closure when clicking on geocoder suggestions
                geocoderRoot.addEventListener('click', (e) => {
                  e.stopPropagation();
                  e.stopImmediatePropagation();
                }, true);
                // Also handle suggestions wrapper if it exists
                const suggestionsWrapper = geocoderRoot.querySelector('.suggestions-wrapper');
                if(suggestionsWrapper){
                  suggestionsWrapper.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                  }, true);
                  suggestionsWrapper.addEventListener('pointerdown', (e) => {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                  }, true);
                }
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
              // Keep address in sync as user types (and on draft restore)
              geocoderInput.addEventListener('input', () => {
                locationState.address = geocoderInput.value || '';
                try{ updatePostButtonState(); }catch(_e){}
              });
              // Prevent Enter key from submitting form when in geocoder
              geocoderInput.addEventListener('keydown', (e)=>{
                if(e.key === 'Enter'){
                  e.stopPropagation();
                  // Don't preventDefault - let geocoder handle it
                }
              });
              geocoder.on('result', event => {
                // CRITICAL: Stop propagation to prevent form closure when selecting geocoder result
                if(event && event.originalEvent){
                  event.originalEvent.stopPropagation();
                  event.originalEvent.stopImmediatePropagation();
                }
                const result = event && event.result;
                if(result){
                  const clone = (typeof window !== 'undefined' && typeof window.cloneGeocoderFeature === 'function')
                    ? window.cloneGeocoderFeature(result)
                    : (function(f){
                        try { return JSON.parse(JSON.stringify(f)); } catch(e){ return { ...f }; }
                      })(result);
                  const placeName = typeof clone.place_name === 'string' ? clone.place_name : '';
                  if(placeName){
                    locationState.address = placeName;
                    geocoderInput.value = placeName;
                  } else {
                    locationState.address = geocoderInput.value || '';
                  }
                  const center = (typeof window !== 'undefined' && typeof window.getMapboxVenueFeatureCenter === 'function')
                    ? window.getMapboxVenueFeatureCenter(clone)
                    : (Array.isArray(clone.center) && clone.center.length === 2
                        ? clone.center
                        : ((clone && clone.geometry && Array.isArray(clone.geometry.coordinates)) ? clone.geometry.coordinates : null));
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

        if(type === 'radio'){
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
          // Check for button-based menu (new pattern) or select (old pattern)
          const menuBtn = element.querySelector('button.form-preview-select');
          const select = element.querySelector('select');
          if(menuBtn){
            value = menuBtn.dataset.value || '';
          } else if(select){
            value = select.value || '';
          } else {
            value = '';
          }
          if(field.required && (!value || !value.trim())){
            const msg = await getMessage('msg_post_validation_choose', { field: label }, false) || `Choose an option for ${label}.`;
            invalid = {
              message: msg,
              focus: ()=> focusElement(menuBtn || select)
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
        const fieldId = field.id || field.field_id || (field.name ? String(field.name).trim() : `field-${fieldPayload.length + 1}`);
        fieldPayload.push({
          field_id: fieldId,
          id: fieldId,
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
        const apiKeyForPost = getConnectorApiKey(currentMember);
        const headers = { 'Content-Type': 'application/json' };
        if(apiKeyForPost){
          headers['X-API-Key'] = apiKeyForPost;
        }
        response = await fetch('/gateway.php?action=add-post', {
          method: 'POST',
          headers,
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
      // Clear any saved draft for the active selection on successful post
      try{
        var clearKey = 'member-create-draft-v1::' + (selectedCategory || '') + '::' + (selectedSubcategory || '');
        localStorage.removeItem(clearKey);
      }catch(_e){}
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
      if(!formpickerCats){
        console.error('[Member Forms] renderFormPicker: formpickerCats element not found');
        return;
      }
      // Removed excessive logging - only log errors
      formpickerCats.innerHTML = '';
      selectedCategory = '';
      selectedSubcategory = '';
      
      if(formWrapper) formWrapper.hidden = true;
      if(formFields) formFields.innerHTML = '';
      if(postButton){ postButton.disabled = true; postButton.hidden = true; postButton.style.display = 'none'; }
      if(postActions){ postActions.hidden = true; postActions.style.display = 'none'; }
      if(formWrapper) formWrapper.hidden = true;
      if(formFields) formFields.innerHTML = '';
      if(postButton){ postButton.disabled = true; postButton.hidden = true; postButton.style.display = 'none'; }
      if(postActions){ postActions.hidden = true; postActions.style.display = 'none'; }
      
      const sortedCategories = (typeof window !== 'undefined' && typeof window.getSortedCategories === 'function' ? window.getSortedCategories : (cats => cats || []))(memberCategories);
      
      // Get icon paths from snapshot (fetched from database)
      if(!memberSnapshot){
        console.error('[Member Forms] memberSnapshot is null or undefined');
        return;
      }
      if(typeof memberSnapshot.categoryIconPaths !== 'object' || typeof memberSnapshot.subcategoryIconPaths !== 'object'){
        console.error('[Member Forms] memberSnapshot missing categoryIconPaths or subcategoryIconPaths', {
          hasCategoryIconPaths: typeof memberSnapshot.categoryIconPaths,
          hasSubcategoryIconPaths: typeof memberSnapshot.subcategoryIconPaths,
          snapshotKeys: Object.keys(memberSnapshot || {})
        });
        return;
      }
      const categoryIconPaths = memberSnapshot.categoryIconPaths;
      const subcategoryIconPaths = memberSnapshot.subcategoryIconPaths;
      
      // Icon paths are normalized by normalizeIconPathMap which transforms keys to "name:${name.toLowerCase()}" format
      
      // Create container for dropdowns
      const dropdownsContainer = document.createElement('div');
      dropdownsContainer.className = 'formpicker-dropdowns';
      dropdownsContainer.style.display = 'flex';
      dropdownsContainer.style.flexDirection = 'column';
      dropdownsContainer.style.gap = '12px';
      
      // Create subcategory dropdown wrapper FIRST (so it's available for category handlers)
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
      
      const subcategoryDropdown = document.createElement('div');
      subcategoryDropdown.className = 'options-dropdown';
      const subcategoryMenuBtn = document.createElement('button');
      subcategoryMenuBtn.type = 'button';
      subcategoryMenuBtn.className = 'form-preview-select';
      subcategoryMenuBtn.id = 'memberFormpickerSubcategory';
      subcategoryMenuBtn.setAttribute('aria-haspopup', 'true');
      subcategoryMenuBtn.setAttribute('aria-expanded', 'false');
      const subcategoryMenuId = 'memberFormpickerSubcategoryMenu';
      subcategoryMenuBtn.setAttribute('aria-controls', subcategoryMenuId);
      subcategoryMenuBtn.textContent = 'Select a subcategory';
      subcategoryMenuBtn.dataset.value = '';
      const subcategoryArrow = document.createElement('span');
      subcategoryArrow.className = 'dropdown-arrow';
      subcategoryArrow.setAttribute('aria-hidden', 'true');
      subcategoryMenuBtn.appendChild(subcategoryArrow);
      const subcategoryMenu = document.createElement('div');
      subcategoryMenu.className = 'options-menu';
      subcategoryMenu.id = subcategoryMenuId;
      subcategoryMenu.hidden = true;
      
      subcategoryMenu.addEventListener('click', (e) => e.stopPropagation());
      subcategoryDropdown.appendChild(subcategoryMenuBtn);
      subcategoryDropdown.appendChild(subcategoryMenu);
      
      subcategoryWrapper.appendChild(subcategoryLabel);
      subcategoryWrapper.appendChild(subcategoryDropdown);
      
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
      
      const categoryDropdown = document.createElement('div');
      categoryDropdown.className = 'options-dropdown';
      const categoryMenuBtn = document.createElement('button');
      categoryMenuBtn.type = 'button';
      categoryMenuBtn.className = 'form-preview-select';
      categoryMenuBtn.id = 'memberFormpickerCategory';
      categoryMenuBtn.setAttribute('aria-haspopup', 'true');
      categoryMenuBtn.setAttribute('aria-expanded', 'false');
      const categoryMenuId = 'memberFormpickerCategoryMenu';
      categoryMenuBtn.setAttribute('aria-controls', categoryMenuId);
      categoryMenuBtn.textContent = 'Select a category';
      categoryMenuBtn.dataset.value = '';
      const categoryArrow = document.createElement('span');
      categoryArrow.className = 'dropdown-arrow';
      categoryArrow.setAttribute('aria-hidden', 'true');
      categoryMenuBtn.appendChild(categoryArrow);
      const categoryMenu = document.createElement('div');
      categoryMenu.className = 'options-menu';
      categoryMenu.id = categoryMenuId;
      categoryMenu.hidden = true;
      
      // Add category options with icons stored in data attributes
      sortedCategories.forEach(c => {
        if(!c || typeof c.name !== 'string') return;
        const optionBtn = document.createElement('button');
        optionBtn.type = 'button';
        optionBtn.className = 'menu-option';
        // Get icon path using the same method as formbuilder (lookupIconPath logic)
        // Try id:${id} first, then name:${name.toLowerCase()}
        let iconPath = '';
        if(c.id !== null && c.id !== undefined && Number.isInteger(c.id)){
          const idKey = `id:${c.id}`;
          if(categoryIconPaths[idKey]){
            iconPath = categoryIconPaths[idKey];
          }
        }
        if(!iconPath && c.name){
          const nameKey = `name:${c.name.toLowerCase()}`;
          if(categoryIconPaths[nameKey]){
            iconPath = categoryIconPaths[nameKey];
          }
        }
        if(iconPath && typeof iconPath === 'string' && iconPath.trim()){
          // Normalize icon path like formbuilder does
          let normalizedPath = iconPath.trim();
          if(typeof window !== 'undefined' && typeof window.normalizeIconPath === 'function'){
            try{
              normalizedPath = window.normalizeIconPath(normalizedPath) || normalizedPath;
            }catch(e){
              console.warn('[Member Forms] Error normalizing icon path:', e);
            }
          }
          if(normalizedPath){
            const iconImg = document.createElement('img');
            iconImg.src = normalizedPath;
            iconImg.className = 'formpicker-category-icon';
            iconImg.alt = '';
            optionBtn.appendChild(iconImg);
          }
        }
        const textSpan = document.createElement('span');
        textSpan.textContent = c.name;
        optionBtn.appendChild(textSpan);
        optionBtn.dataset.value = c.name;
        optionBtn.dataset.icon = iconPath;
        optionBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const categoryName = c.name;
          // Clear existing content and add icon + text
          categoryMenuBtn.innerHTML = '';
          if(iconPath && typeof iconPath === 'string' && iconPath.trim()){
            let normalizedPath = iconPath.trim();
            if(typeof window !== 'undefined' && typeof window.normalizeIconPath === 'function'){
              try{
                normalizedPath = window.normalizeIconPath(normalizedPath) || normalizedPath;
              }catch(_e){}
            }
            if(normalizedPath){
              const btnIconImg = document.createElement('img');
              btnIconImg.src = normalizedPath;
              btnIconImg.className = 'formpicker-category-icon';
              btnIconImg.alt = '';
              categoryMenuBtn.appendChild(btnIconImg);
            }
          }
          const btnTextSpan = document.createElement('span');
          btnTextSpan.textContent = categoryName;
          categoryMenuBtn.appendChild(btnTextSpan);
          categoryMenuBtn.appendChild(categoryArrow);
          categoryMenuBtn.dataset.value = categoryName;
          categoryMenuBtn.dataset.icon = iconPath || '';
          categoryMenu.hidden = true;
          categoryMenuBtn.setAttribute('aria-expanded', 'false');
          selectedCategory = categoryName;
          selectedSubcategory = '';
          try{ localStorage.setItem('member-create-active-v1', JSON.stringify({ cat: selectedCategory || '', sub: '' })); }catch(_e){}
          
          // Clear and populate subcategory dropdown
          subcategoryMenu.innerHTML = '';
          if(categoryName){
            const category = sortedCategories.find(cat => cat.name === categoryName);
            if(category && Array.isArray(category.subs) && category.subs.length > 0){
              category.subs.forEach(s => {
                const subOptionBtn = document.createElement('button');
                subOptionBtn.type = 'button';
                subOptionBtn.className = 'menu-option';
                // Get icon path using the same method as formbuilder (lookupIconPath logic)
                // Try id:${id} first, then name:${name.toLowerCase()}
                let subIconPath = '';
                const subId = category && category.subIds && Object.prototype.hasOwnProperty.call(category.subIds, s)
                  ? category.subIds[s]
                  : null;
                if(subId !== null && subId !== undefined && Number.isInteger(subId)){
                  const idKey = `id:${subId}`;
                  if(subcategoryIconPaths[idKey]){
                    subIconPath = subcategoryIconPaths[idKey];
                  }
                }
                if(!subIconPath && s){
                  const nameKey = `name:${s.toLowerCase()}`;
                  if(subcategoryIconPaths[nameKey]){
                    subIconPath = subcategoryIconPaths[nameKey];
                  }
                }
                if(subIconPath && typeof subIconPath === 'string' && subIconPath.trim()){
                  // Normalize icon path like formbuilder does
                  let normalizedSubPath = subIconPath.trim();
                  if(typeof window !== 'undefined' && typeof window.normalizeIconPath === 'function'){
                    try{
                      normalizedSubPath = window.normalizeIconPath(normalizedSubPath) || normalizedSubPath;
                    }catch(e){
                      console.warn('[Member Forms] Error normalizing subcategory icon path:', e);
                    }
                  }
                  if(normalizedSubPath){
                    const subIconImg = document.createElement('img');
                    subIconImg.src = normalizedSubPath;
                    subIconImg.className = 'formpicker-subcategory-icon';
                    subIconImg.alt = '';
                    subOptionBtn.appendChild(subIconImg);
                  }
                }
                const subTextSpan = document.createElement('span');
                subTextSpan.textContent = s;
                subOptionBtn.appendChild(subTextSpan);
                subOptionBtn.dataset.value = s;
                subOptionBtn.dataset.icon = subIconPath || '';
                subOptionBtn.addEventListener('click', (e) => {
                  e.stopPropagation();
                  const subcategoryName = s;
                  // Clear existing content and add icon + text
                  subcategoryMenuBtn.innerHTML = '';
                  if(subIconPath && typeof subIconPath === 'string' && subIconPath.trim()){
                    let normalizedSubPath = subIconPath.trim();
                    if(typeof window !== 'undefined' && typeof window.normalizeIconPath === 'function'){
                      try{
                        normalizedSubPath = window.normalizeIconPath(normalizedSubPath) || normalizedSubPath;
                      }catch(_e){}
                    }
                    if(normalizedSubPath){
                      const btnSubIconImg = document.createElement('img');
                      btnSubIconImg.src = normalizedSubPath;
                      btnSubIconImg.className = 'formpicker-subcategory-icon';
                      btnSubIconImg.alt = '';
                      subcategoryMenuBtn.appendChild(btnSubIconImg);
                    }
                  }
                  const btnSubTextSpan = document.createElement('span');
                  btnSubTextSpan.textContent = subcategoryName;
                  subcategoryMenuBtn.appendChild(btnSubTextSpan);
                  subcategoryMenuBtn.appendChild(subcategoryArrow);
                  subcategoryMenuBtn.dataset.value = subcategoryName;
                  subcategoryMenuBtn.dataset.icon = subIconPath || '';
                  subcategoryMenu.hidden = true;
                  subcategoryMenuBtn.setAttribute('aria-expanded', 'false');
                  selectedSubcategory = subcategoryName;
                  try{ localStorage.setItem('member-create-active-v1', JSON.stringify({ cat: selectedCategory || '', sub: selectedSubcategory || '' })); }catch(_e){}
                  renderConfiguredFields();
                });
                subcategoryMenu.appendChild(subOptionBtn);
              });
              
              subcategoryMenuBtn.innerHTML = '';
              const resetSubTextSpan = document.createElement('span');
              resetSubTextSpan.textContent = 'Select a subcategory';
              subcategoryMenuBtn.appendChild(resetSubTextSpan);
              subcategoryMenuBtn.appendChild(subcategoryArrow);
              subcategoryMenuBtn.dataset.value = '';
              subcategoryMenuBtn.dataset.icon = '';
              subcategoryWrapper.hidden = false;
            } else {
              subcategoryWrapper.hidden = true;
            }
          } else {
            subcategoryWrapper.hidden = true;
          }
          
          renderConfiguredFields();
        });
        categoryMenu.appendChild(optionBtn);
      });
      
      categoryMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = !categoryMenu.hasAttribute('hidden');
        if(open){
          categoryMenu.hidden = true;
          categoryMenuBtn.setAttribute('aria-expanded', 'false');
        } else {
          // Close other menu before opening this one
          closeAllMenus();
          categoryMenu.hidden = false;
          categoryMenuBtn.setAttribute('aria-expanded', 'true');
          const outsideHandler = (ev) => {
            // Close if clicking outside both dropdowns or on another menu button
            const clickedCategoryBtn = ev.target === categoryMenuBtn || categoryMenuBtn.contains(ev.target);
            const clickedSubcategoryBtn = ev.target === subcategoryMenuBtn || subcategoryMenuBtn.contains(ev.target);
            if(!categoryDropdown.contains(ev.target) && !clickedCategoryBtn && !clickedSubcategoryBtn){
              closeAllMenus();
              document.removeEventListener('click', outsideHandler);
            }
          };
          setTimeout(() => document.addEventListener('click', outsideHandler), 0);
        }
      });
      categoryMenu.addEventListener('click', (e) => e.stopPropagation());
      categoryDropdown.appendChild(categoryMenuBtn);
      categoryDropdown.appendChild(categoryMenu);
      
      // Function to close all menus (defined after both menus are created)
      const closeAllMenus = () => {
        categoryMenu.hidden = true;
        categoryMenuBtn.setAttribute('aria-expanded', 'false');
        subcategoryMenu.hidden = true;
        subcategoryMenuBtn.setAttribute('aria-expanded', 'false');
      };
      
      // Register the subcategory button handler (after closeAllMenus is defined)
      subcategoryMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = !subcategoryMenu.hasAttribute('hidden');
        if(open){
          subcategoryMenu.hidden = true;
          subcategoryMenuBtn.setAttribute('aria-expanded', 'false');
        } else {
          // Close other menu before opening this one
          closeAllMenus();
          subcategoryMenu.hidden = false;
          subcategoryMenuBtn.setAttribute('aria-expanded', 'true');
          const outsideHandler = (ev) => {
            // Close if clicking outside both dropdowns or on another menu button
            const clickedCategoryBtn = ev.target === categoryMenuBtn || categoryMenuBtn.contains(ev.target);
            const clickedSubcategoryBtn = ev.target === subcategoryMenuBtn || subcategoryMenuBtn.contains(ev.target);
            if(!subcategoryDropdown.contains(ev.target) && !clickedCategoryBtn && !clickedSubcategoryBtn){
              closeAllMenus();
              document.removeEventListener('click', outsideHandler);
            }
          };
          setTimeout(() => document.addEventListener('click', outsideHandler), 0);
        }
      });
      
      categoryWrapper.appendChild(categoryLabel);
      categoryWrapper.appendChild(categoryDropdown);
      
      dropdownsContainer.appendChild(categoryWrapper);
      dropdownsContainer.appendChild(subcategoryWrapper);
      formpickerCats.appendChild(dropdownsContainer);

      // Restore last active selection (category/subcategory) and render
      try{
        const activeSel = JSON.parse(localStorage.getItem('member-create-active-v1') || 'null');
        if(activeSel && activeSel.cat){
          // Find and click the matching category option
          const categoryOption = categoryMenu.querySelector(`button[data-value="${activeSel.cat}"]`);
          if(categoryOption){
            categoryOption.click();
            if(activeSel.sub){
              // Wait a tick to ensure subcategory options are populated
              setTimeout(function(){
                const subcategoryOption = subcategoryMenu.querySelector(`button[data-value="${activeSel.sub}"]`);
                if(subcategoryOption){
                  subcategoryOption.click();
                }
              }, 50);
            }
          }
        }
      }catch(_e){}
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
      // Re-validate on any input/change within the member create form
      memberForm.addEventListener('input', updatePostButtonState, true);
      memberForm.addEventListener('change', updatePostButtonState, true);
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
