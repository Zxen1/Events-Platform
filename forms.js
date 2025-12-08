(function(){
  "use strict";
  
  // Wait for DOM and dependencies (max 50 retries = 5 seconds)
  let initRetries = 0;
  const MAX_INIT_RETRIES = 50;
  
  function init(){
    if(typeof window === "undefined" || typeof document === "undefined"){
      if(++initRetries < MAX_INIT_RETRIES){
        setTimeout(init, 100);
      }
      return;
    }
    
    // Check for required dependencies
    if(typeof getBaseFieldset !== "function" || typeof getMessage !== "function" || typeof normalizeFormbuilderSnapshot !== "function"){
      if(++initRetries < MAX_INIT_RETRIES){
        console.warn("[Member] Waiting for dependencies...");
        setTimeout(init, 100);
      } else {
        console.error("[Member] Dependencies not available after timeout. Form features disabled.");
      }
      return;
    }
    
    // PERFORMANCE FIX: Don't wait for formbuilder snapshot on page load
    // The snapshot will be loaded lazily when member opens Create Post tab
    // via formbuilderStateManager.ensureLoaded() or getFormbuilderSnapshotPromise()
    
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
        return direct;
      }
      // NO CACHING - always search for API key

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
            return trimmed;
          }
        }
      }
      // NO CACHING - return empty string if not found
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

    // Fields now come from backend via fieldsets table, no hardcoded defaults

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

    function collectCurrencies(snapshot){
      const codes = new Set();
      
      // First, get currencies from the currency field
      if(snapshot && Array.isArray(snapshot.currencies)){
        snapshot.currencies.forEach(code => {
          if(typeof code === 'string' && code.trim()){
            codes.add(code.trim().toUpperCase());
          }
        });
      }
      
      // Also collect from existing item-pricing and venue-ticketing fields as fallback
      const cats = snapshot && Array.isArray(snapshot.categories) ? snapshot.categories : [];
      cats.forEach(cat => {
        if(!cat || typeof cat !== 'object') return;
        const subFields = cat.subFields && typeof cat.subFields === 'object' ? cat.subFields : {};
        Object.values(subFields).forEach(fields => {
          if(!Array.isArray(fields)) return;
          fields.forEach(field => {
            if(!field || typeof field !== 'object') return;
            if(field.type === 'item-pricing'){
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
                    const seatingAreas = Array.isArray(time && time.seating_areas) ? time.seating_areas : [];
                    seatingAreas.forEach(seatingArea => {
                      const tiers = Array.isArray(seatingArea && seatingArea.tiers) ? seatingArea.tiers : [];
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
    let currencies = [];
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
      // Normalize snapshot to get all data (icon paths, etc.)
      const normalized = normalizeFormbuilderSnapshot(snapshot);
      memberSnapshot = normalized;
      
      // Use already-restored categories from window.categories if available (they have checkoutOptions preserved)
      // Otherwise use normalized categories
      if(window.categories && Array.isArray(window.categories) && window.categories.length > 0){
        memberCategories = window.categories;
        // Update memberSnapshot.categories to match (for consistency)
        memberSnapshot.categories = window.categories;
      } else {
        memberCategories = Array.isArray(memberSnapshot.categories) ? memberSnapshot.categories : [];
      }
      currencies = collectCurrencies(memberSnapshot);
      // Set window.currencies for use in other parts of the application
      window.currencies = currencies;
      // Only re-render form picker if not preserving selection AND populate is not false
      // This prevents resetting the form when admin makes formbuilder changes while user is editing
      if(options.populate !== false && !options.preserveSelection){
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
      currencies.forEach(code => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = code;
        select.appendChild(opt);
      });
      if(preserveValue && currencies.includes(preserveValue)){
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
          const normalizedType = getBaseFieldset(type);
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
          const normalizedType = getBaseFieldset(type);
          if(normalizedType){
            type = normalizedType;
          }
          // Validate against FORM_FIELDSETS
          if(!(typeof window !== 'undefined' && Array.isArray(window.FORM_FIELDSETS) ? window.FORM_FIELDSETS : []).some(opt => opt.value === type)){
            type = 'text-box';
          }
          safe.type = type;
        }
        if(typeof field.placeholder === 'string'){
          safe.placeholder = field.placeholder;
        }
        safe.required = !!field.required;
        if(type === 'item-pricing'){
          const options = Array.isArray(field.options) ? field.options : [];
          safe.options = options.map(opt => ({
            item_name: opt && typeof opt.item_name === 'string' ? opt.item_name : '',
            currency: opt && typeof opt.currency === 'string' ? opt.currency : '',
            price: opt && typeof opt.price === 'string' ? opt.price : ''
          }));
          if(safe.options.length === 0){
            safe.options.push({ item_name: '', currency: '', price: '' });
          }
        } else if(type === 'dropdown' || type === 'radio'){
          const options = Array.isArray(field.options) ? field.options : [];
          safe.options = options.map(opt => {
            if(typeof opt === 'string') return opt;
            if(opt && typeof opt === 'object' && typeof opt.item_name === 'string') return opt.item_name;
            return '';
          });
          // If options are empty or only have empty strings, try to seed from field type placeholder (e.g., "A,B,C")
          const hasNonEmptyOptions = safe.options.some(opt => opt && typeof opt === 'string' && opt.trim() !== '');
          if(!hasNonEmptyOptions){
            const fieldsetKey = field.fieldsetKey || field.key || '';
            if(fieldsetKey === 'dropdown' || fieldsetKey === 'radio'){
              // Try to get placeholder from FORM_FIELDSETS
              if(typeof window !== 'undefined' && Array.isArray(window.FORM_FIELDSETS)){
                const matchingFieldset = window.FORM_FIELDSETS.find(ft => ft.value === fieldsetKey);
                if(matchingFieldset && matchingFieldset.placeholder){
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
        
        // Preserve checkoutOptions for checkout fields
        if(safe.type === 'checkout' || field.type === 'checkout' || field.fieldsetKey === 'checkout'){
          if(Array.isArray(field.checkoutOptions)){
            safe.checkoutOptions = field.checkoutOptions.slice();
          } else {
            safe.checkoutOptions = [];
          }
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

    // Track last renderEmptyState call to prevent rapid-fire loop
    let lastRenderEmptyStateTime = 0;
    let renderEmptyStatePending = false;
    
    function renderEmptyState(message){
      // Throttle: prevent calling more than once per 500ms to avoid infinite loops
      const now = Date.now();
      if(now - lastRenderEmptyStateTime < 500){
        if(!renderEmptyStatePending){
          renderEmptyStatePending = true;
          setTimeout(()=>{
            renderEmptyStatePending = false;
            renderEmptyState(message);
          }, 500 - (now - lastRenderEmptyStateTime));
        }
        return;
      }
      lastRenderEmptyStateTime = now;
      
      // Only protect from closing if user is ACTIVELY typing in venue field
      // AND a valid subcategory is selected (prevents form showing without selection)
      const activeVenueEditor = document.activeElement && document.activeElement.closest('.venue-session-editor');
      const isActivelyTypingInVenue = activeVenueEditor && (
        document.activeElement.tagName === 'INPUT' || 
        document.activeElement.tagName === 'TEXTAREA'
      );
      
      // Only block if: actively typing in venue field AND subcategory is selected
      if(isActivelyTypingInVenue && selectedSubcategory){
        return;
      }
      
      // Hide form and related controls
      if(formWrapper) formWrapper.hidden = true;
      if(postButton){ postButton.disabled = true; postButton.hidden = true; postButton.style.display = 'none'; }
      if(postActions){ postActions.hidden = true; postActions.style.display = 'none'; }
    }

    // All form field rendering is handled by window.renderForm() from index.js

    async function initializeMemberFormbuilderSnapshot(){
      const loadingMsg = await getMessage('msg_post_loading_form', {}, false) || 'Loading form fieldsâ€¦';
      // Don't close form if venue editor exists (check before clearing)
      const hasVenueEditor = formFields && formFields.querySelector('.venue-session-editor');
      if(!hasVenueEditor){
        renderEmptyState(loadingMsg);
        if(formWrapper) formWrapper.hidden = true;
        if(formFields) formFields.innerHTML = '';
        if(postButton) postButton.disabled = true;
      }
      try{
        // LAZY LOADING: Use getFormbuilderSnapshotPromise() which loads on-demand
        const getSnapshotPromise = (typeof window !== 'undefined' && typeof window.getFormbuilderSnapshotPromise === 'function')
          ? window.getFormbuilderSnapshotPromise
          : null;
        
        if(!getSnapshotPromise){
          throw new Error('Formbuilder snapshot loader not available');
        }
        
        const backendSnapshot = await getSnapshotPromise();
        
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
    // Expose initializeMemberFormbuilderSnapshot globally so it can be called when Create Post tab opens
    if(typeof window !== 'undefined'){
      window.initializeMemberFormbuilderSnapshot = initializeMemberFormbuilderSnapshot;
    }

    const MAPBOX_VENUE_ENDPOINT = 'https://api.mapbox.com/geocoding/v5/mapbox.places/';


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

		// Composite validation: Item Pricing
		const requiredItemEditors = formFields.querySelectorAll('.form-preview-field--item-pricing .item-pricing-options-editor[aria-required="true"]');
		for(const editor of requiredItemEditors){
			let ok = false;
			const rows = editor.querySelectorAll('.item-pricing-option');
			for(const row of rows){
				const currency = row.querySelector('button.item-pricing-currency');
				const price = row.querySelector('.item-pricing-price');
				const hasCurrency = currency && String(currency.dataset.value || '').trim();
				const hasPrice = price && String(price.value || '').trim();
				if(hasCurrency && hasPrice){ ok = true; break; }
			}
			if(!ok) return false;
		}

		// Composite validation: Event Session Details (must have at least one tier with currency+price)
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
      
      // Also update admin skip payment button state
      const adminSkipButton = document.getElementById('adminSkipPaymentBtn');
      if(adminSkipButton){
        adminSkipButton.disabled = !ready;
      }
    }

    // Track last renderConfiguredFields call to prevent rapid-fire loop
    let lastRenderConfiguredFieldsTime = 0;
    let renderConfiguredFieldsPending = false;
    
		function renderConfiguredFields(){
      // Throttle: prevent calling more than once per 300ms to avoid infinite loops
      const now = Date.now();
      if(now - lastRenderConfiguredFieldsTime < 300){
        if(!renderConfiguredFieldsPending){
          renderConfiguredFieldsPending = true;
          setTimeout(()=>{
            renderConfiguredFieldsPending = false;
            renderConfiguredFields();
          }, 300 - (now - lastRenderConfiguredFieldsTime));
        }
        return;
      }
      lastRenderConfiguredFieldsTime = now;
      
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
      
      const fields = getFieldsForSelection(selectedCategory, selectedSubcategory);
      
      // Ensure formbuilder data is loaded before rendering any form
      // This covers all field types that may depend on global data (checkout options, venue builder, etc.)
      if(window.formbuilderStateManager && typeof window.formbuilderStateManager.ensureLoaded === 'function' && !window.formbuilderStateManager._loaded){
        window.formbuilderStateManager.ensureLoaded().then(() => {
          renderConfiguredFields();
        }).catch(err => {
          console.error('[Forms] Failed to load formbuilder data:', err);
        });
        formFields.innerHTML = '<p class="form-preview-loading">Loading form...</p>';
        return;
      }
      
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
        if (typeof window.renderForm === 'function') {
          window.renderForm({
            formFields: formFields,
            formId: 'form',
            fields: fields,
            categoryName: selectedCategory,
            subcategoryName: selectedSubcategory,
            fieldIdCounter: fieldIdCounter,
            formLabel: 'Create Post',
            isUserForm: true,
            onFieldRendered: (wrapper, field) => {
              if (typeof currentCreateFields !== 'undefined') {
                currentCreateFields.push({ field: field, element: wrapper });
              }
            }
          });
          
        } else {
          console.error('renderForm not available - form cannot be rendered');
        }
      }
      if(emptyState){
        emptyState.hidden = true;
      }
      if(formWrapper) formWrapper.hidden = false;
      if(postActions){ 
        postActions.hidden = false; 
        postActions.style.display = '';
        
        // Add admin "Submit without Payment" button if admin is logged in
        const currentMember = loadCurrentMember();
        const isAdmin = currentMember && currentMember.type === 'admin';
        let adminSkipButton = document.getElementById('adminSkipPaymentBtn');
        
        if(isAdmin){
          if(!adminSkipButton){
            adminSkipButton = document.createElement('button');
            adminSkipButton.type = 'button';
            adminSkipButton.id = 'adminSkipPaymentBtn';
            adminSkipButton.className = 'admin-skip-payment-btn';
            adminSkipButton.setAttribute('data-message-key', 'msg_admin_submit_without_payment');
            // Button will be populated with message text via getMessage
            postActions.appendChild(adminSkipButton);
            
            // Load message text
            (async () => {
              const messageText = await getMessage('msg_admin_submit_without_payment', {}, false) || 'Admin: Submit without Payment';
              adminSkipButton.textContent = messageText;
            })();
            
            // Handle click
            adminSkipButton.addEventListener('click', async (event) => {
              if(event && typeof event.preventDefault === 'function'){
                event.preventDefault();
              }
              if(isSubmittingCreatePost){
                return;
              }
              // Set flag and call handleMemberCreatePost
              window.__adminSkipPayment = true;
              Promise.resolve(handleMemberCreatePost(event)).catch(err => {
                console.error('Admin skip payment submission failed', err);
                showCreateStatus('Unable to post your listing. Please try again.', { error: true });
                isSubmittingCreatePost = false;
                if(postButton){
                  delete postButton.dataset.submitting;
                  postButton.disabled = false;
                }
                if(adminSkipButton){
                  delete adminSkipButton.dataset.submitting;
                  adminSkipButton.disabled = false;
                }
              });
            });
          }
          adminSkipButton.hidden = false;
          adminSkipButton.disabled = postButton ? postButton.disabled : true;
        } else {
          if(adminSkipButton){
            adminSkipButton.hidden = true;
          }
        }
      }
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
						if(t.closest('.venue-session-editor') || t.closest('.item-pricing-option') || t.closest('.item-pricing-option-actions')){
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
      // Use fieldsetKey or key as source of truth if type is not set or is just input_type
      const fieldsetKey = safeField.fieldsetKey || safeField.key || safeField.type || '';
      if(typeof safeField.type !== 'string' || !safeField.type.trim()){
        // If we have a fieldsetKey, use it; otherwise throw error
        if(!fieldsetKey) throw new Error('Fieldset is required. Missing both type and fieldsetKey for field: ' + JSON.stringify(field));
        safeField.type = fieldsetKey;
      } else {
        // Normalize field type to extract base type (e.g., "description [field=2]" -> "description")
        // BUT preserve description and text-area types BEFORE normalization
        const originalType = safeField.type;
        const normalizedType = getBaseFieldset(originalType);
        
        // If fieldsetKey exists and is different from normalized type, prefer fieldsetKey
        // This ensures radio uses 'radio' not something else
        if(fieldsetKey && fieldsetKey !== normalizedType && 
           (fieldsetKey === 'radio' || fieldsetKey === 'dropdown' || 
            fieldsetKey === 'description' || fieldsetKey === 'text-area')){
          safeField.type = fieldsetKey;
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
      // CRITICAL: Preserve fieldsetKey and key on the returned object
      if(field && typeof field === 'object'){
        if(field.fieldsetKey) safeField.fieldsetKey = field.fieldsetKey;
        if(field.key) safeField.key = field.key;
      }
      return safeField;
    }
    window.ensureFieldDefaultsForMember = ensureFieldDefaultsForMember;
    
    // Image preview handling is done by global handler in index.js
    // via MutationObserver watching for input[data-images-field]
    // No duplicate code needed here - single source of truth

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
        const adminSkipButton = document.getElementById('adminSkipPaymentBtn');
        if(adminSkipButton){
          delete adminSkipButton.dataset.submitting;
          adminSkipButton.disabled = false;
        }
      };
      if(postButton){
        postButton.dataset.submitting = 'true';
        postButton.disabled = true;
      }
      const adminSkipButton = document.getElementById('adminSkipPaymentBtn');
      if(adminSkipButton){
        adminSkipButton.dataset.submitting = 'true';
        adminSkipButton.disabled = true;
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
        if(typeof field.type !== 'string' || !field.type.trim()) {
          throw new Error('Field type is required. Missing type for field: ' + JSON.stringify(field));
        }
        const rawType = field.type;
        const type = getBaseFieldset(rawType);
        if(!type) throw new Error('Field type is required. Cannot determine type from rawType: ' + rawType);
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
        } else if(type === 'item-pricing'){
          const options = Array.isArray(field.options) ? field.options : [];
          value = options.map(opt => ({
            item_name: typeof opt.item_name === 'string' ? opt.item_name.trim() : '',
            currency: typeof opt.currency === 'string' ? opt.currency.trim().toUpperCase() : '',
            price: formatPriceValue(opt.price || '')
          })).filter(opt => opt.item_name || opt.currency || opt.price);
          if(field.required){
            const hasComplete = value.some(opt => opt.currency && opt.price);
            if(!hasComplete){
              const msg = await getMessage('msg_post_validation_pricing', { field: label }, false) || `Provide pricing details for ${label}.`;
              invalid = {
                message: msg,
                focus: ()=> focusElement(findFirstFocusable(['.item-pricing-option select','.item-pricing-option input']))
              };
              break;
            }
          }
        } else if(type === 'venue-ticketing'){
          const venues = Array.isArray(field.options) ? field.options : [];
          value = venues.map(cloneVenueSessionVenueFromWindow);
          if(field.required){
            const hasTierPrice = value.some(venue => Array.isArray(venue.sessions) && venue.sessions.some(session => Array.isArray(session.times) && session.times.some(time => Array.isArray(time.seating_areas) && time.seating_areas.some(seatingArea => Array.isArray(seatingArea.tiers) && seatingArea.tiers.some(tier => {
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
      
      // Check if admin requested to skip payment
      if(window.__adminSkipPayment === true){
        payload.skip_payment = true;
        window.__adminSkipPayment = false; // Reset flag
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
        console.error('[Member] renderFormPicker: formpickerCats element not found');
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
        console.error('[Member] memberSnapshot is null or undefined');
        return;
      }
      if(typeof memberSnapshot.categoryIconPaths !== 'object' || typeof memberSnapshot.subcategoryIconPaths !== 'object'){
        console.error('[Member] memberSnapshot missing categoryIconPaths or subcategoryIconPaths', {
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
              console.warn('[Member] Error normalizing icon path:', e);
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
                      console.warn('[Member] Error normalizing subcategory icon path:', e);
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

    // REMOVED: initializeMemberFormbuilderSnapshot() - formbuilder should only load when Create Post tab is opened, not on startup
    // This was causing 5-20 minute load times
  }

  }
  
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
