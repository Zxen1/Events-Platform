// === Shared login verifier ===
async function verifyUserLogin(username, password) {
  try {
    const res = await fetch('/gateway.php?action=verify-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('verifyUserLogin failed: invalid JSON response', text);
      return { success: false };
    }

    if(!data || typeof data !== 'object'){
      return { success: false };
    }

    return data;
  } catch (e) {
    console.error('verifyUserLogin failed', e);
    return { success: false };
  }
}

function normalizeCategorySortOrderValue(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed !== '') {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function getBaseFieldType(fieldType){
  if(typeof fieldType !== 'string' || !fieldType.trim()){
    return '';
  }
  // Extract base type from formats like "description [field=2]" or "text-area [field=15]"
  const match = fieldType.match(/^([^\s\[]+)/);
  return match ? match[1].trim() : fieldType.trim();
}

function compareCategoriesForDisplay(a, b) {
  if (a === b) {
    return 0;
  }
  if (!a || typeof a !== 'object') {
    return !b || typeof b !== 'object' ? 0 : 1;
  }
  if (!b || typeof b !== 'object') {
    return -1;
  }
  const orderA = normalizeCategorySortOrderValue(a.sort_order ?? a.sortOrder);
  const orderB = normalizeCategorySortOrderValue(b.sort_order ?? b.sortOrder);
  if (orderA !== null && orderB !== null && orderA !== orderB) {
    return orderA - orderB;
  }
  if (orderA !== null && orderB === null) {
    return -1;
  }
  if (orderA === null && orderB !== null) {
    return 1;
  }
  const nameA = typeof a.name === 'string' ? a.name : '';
  const nameB = typeof b.name === 'string' ? b.name : '';
  const nameCompare = nameA.localeCompare(nameB, undefined, { sensitivity: 'accent', numeric: true });
  if (nameCompare !== 0) {
    return nameCompare;
  }
  return 0;
}

function getSortedCategoryEntries(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map((category, index) => ({ category, index }))
    .sort((a, b) => {
      const cmp = compareCategoriesForDisplay(a.category, b.category);
      if (cmp !== 0) {
        return cmp;
      }
      return a.index - b.index;
    });
}

function getSortedCategories(list) {
  return getSortedCategoryEntries(list).map(entry => entry.category);
}

// === Shared Form Utilities ===

// Normalize field defaults - shared utility for both admin and member forms
function ensureFieldDefaults(field) {
  const safeField = field && typeof field === 'object' ? field : {};
  
  if (typeof safeField.name !== 'string') {
    safeField.name = '';
  } else if (!safeField.name.trim()) {
    safeField.name = '';
  }
  
  if (typeof safeField.type !== 'string') {
    safeField.type = '';
  } else {
    const originalType = safeField.type;
    const isDescriptionType = originalType === 'description' || originalType === 'text-area' ||
      (typeof originalType === 'string' && (originalType.includes('description') || originalType.includes('text-area')));
    
    if (isDescriptionType) {
      const normalizedType = getBaseFieldType(originalType);
      if (normalizedType === 'description' || normalizedType === 'text-area') {
        safeField.type = normalizedType;
      } else if (originalType === 'description' || originalType === 'text-area') {
        safeField.type = originalType;
      } else {
        safeField.type = originalType.includes('description') ? 'description' : 'text-area';
      }
    } else {
      const normalizedType = getBaseFieldType(safeField.type);
      if (normalizedType) {
        safeField.type = normalizedType;
      }
    }
  }
  
  if (typeof safeField.placeholder !== 'string') safeField.placeholder = '';
  const hasRequiredProp = Object.prototype.hasOwnProperty.call(safeField, 'required');
  safeField.required = hasRequiredProp ? !!safeField.required : false;
  
  if (!Array.isArray(safeField.options)) {
    safeField.options = [];
  }
  
  if (safeField.type === 'venue-ticketing') {
    // Will be normalized by buildVenueSessionPreview
  } else if (safeField.type === 'variant-pricing') {
    safeField.options = safeField.options.map(opt => {
      if (opt && typeof opt === 'object') {
        return {
          version: typeof opt.version === 'string' ? opt.version : '',
          currency: typeof opt.currency === 'string' ? opt.currency : '',
          price: typeof opt.price === 'string' ? opt.price : ''
        };
      }
      const str = typeof opt === 'string' ? opt : String(opt ?? '');
      return { version: str, currency: '', price: '' };
    });
    if (safeField.options.length === 0) {
      safeField.options.push({ version: '', currency: '', price: '' });
    }
  } else {
    safeField.options = safeField.options.map(opt => {
      if (typeof opt === 'string') return opt;
      if (opt && typeof opt === 'object' && typeof opt.version === 'string') {
        return opt.version;
      }
      return String(opt ?? '');
    });
    if ((safeField.type === 'dropdown' || safeField.type === 'radio') && safeField.options.length === 0) {
      safeField.options.push('', '', '');
    }
  }
  
  return safeField;
}

// === Shared Form Rendering Function ===
// Unified form rendering for both admin preview and member forms
// Removes all admin-specific UI and stopPropagation calls for full interactivity
function renderForm(options) {
  const {
    container,           // Target container element
    fields,              // Array of field data
    idPrefix,            // Prefix for field IDs (e.g., 'memberForm' or 'formPreview')
    categoryName,        // Category name for label
    subcategoryName,     // Subcategory name for label
    fieldIdCounter = { value: 0 },  // Counter object (shared reference)
    onFieldChange = null // Optional callback for field changes (for admin formbuilder)
  } = options;
  
  if (!container || !Array.isArray(fields)) {
    return;
  }
  
  container.innerHTML = '';
  
  // Category/subcategory label
  if (categoryName || subcategoryName) {
    const label = document.createElement('div');
    label.className = 'form-category-label';
    label.textContent = categoryName && subcategoryName ? `${categoryName} > ${subcategoryName}` : (subcategoryName || categoryName || '');
    label.style.marginBottom = '12px';
    label.style.fontSize = '14px';
    label.style.fontWeight = '600';
    label.style.color = 'var(--button-text)';
    container.appendChild(label);
  }
  
  if (!fields.length) {
    const empty = document.createElement('p');
    empty.className = 'form-empty';
    empty.textContent = 'No fields added yet.';
    container.appendChild(empty);
    return;
  }
  
  fields.forEach((fieldData, index) => {
    const field = ensureFieldDefaults(fieldData);
    const wrapper = document.createElement('div');
    wrapper.className = 'panel-field form-field';
    const baseId = `${idPrefix}-field-${++fieldIdCounter.value}`;
    const labelText = field.name.trim() || `Field ${index + 1}`;
    const labelEl = document.createElement('span');
    labelEl.className = 'subcategory-form-label';
    labelEl.textContent = labelText;
    const labelId = `${baseId}-label`;
    labelEl.id = labelId;
    let control = null;
    const baseType = getBaseFieldType(field.type);
    
    // Text area / Description
    if (baseType === 'text-area' || baseType === 'description') {
      const textarea = document.createElement('textarea');
      textarea.rows = 5;
      textarea.placeholder = field.placeholder || '';
      textarea.className = 'form-textarea';
      textarea.style.resize = 'vertical';
      textarea.id = `${baseId}-input`;
      if (baseType === 'description') {
        textarea.classList.add('form-description');
      }
      if (field.required) textarea.required = true;
      control = textarea;
    }
    // Dropdown
    else if (field.type === 'dropdown') {
      wrapper.classList.add('form-field--dropdown');
      const dropdownWrapper = document.createElement('div');
      dropdownWrapper.className = 'options-dropdown';
      const menuBtn = document.createElement('button');
      menuBtn.type = 'button';
      menuBtn.className = 'form-select';
      menuBtn.setAttribute('aria-haspopup', 'true');
      menuBtn.setAttribute('aria-expanded', 'false');
      const selectId = `${baseId}-input`;
      menuBtn.id = selectId;
      const menuId = `${selectId}-menu`;
      menuBtn.setAttribute('aria-controls', menuId);
      const options = Array.isArray(field.options) ? field.options : [];
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
      if (options.length) {
        options.forEach((optionValue) => {
          const optionBtn = document.createElement('button');
          optionBtn.type = 'button';
          optionBtn.className = 'menu-option';
          const stringValue = typeof optionValue === 'string' ? optionValue : String(optionValue ?? '');
          optionBtn.textContent = stringValue.trim() || '';
          optionBtn.dataset.value = stringValue;
          optionBtn.addEventListener('click', () => {
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
      menuBtn.addEventListener('click', () => {
        const open = !optionsMenu.hasAttribute('hidden');
        if (open) {
          optionsMenu.hidden = true;
          menuBtn.setAttribute('aria-expanded', 'false');
        } else {
          optionsMenu.hidden = false;
          menuBtn.setAttribute('aria-expanded', 'true');
          const outsideHandler = (ev) => {
            if (dropdownWrapper && !dropdownWrapper.contains(ev.target)) {
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
      dropdownWrapper.appendChild(menuBtn);
      dropdownWrapper.appendChild(optionsMenu);
      control = dropdownWrapper;
    }
    // Radio
    else if (field.type === 'radio') {
      const options = Array.isArray(field.options) ? field.options : [];
      const radioGroup = document.createElement('div');
      radioGroup.className = 'form-radio-group';
      wrapper.classList.add('form-field--radio-toggle');
      const groupName = `${baseId}-radio`;
      if (options.length) {
        options.forEach((optionValue) => {
          const radioLabel = document.createElement('label');
          radioLabel.className = 'form-radio-option';
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = groupName;
          const stringValue = typeof optionValue === 'string' ? optionValue : String(optionValue ?? '');
          radio.value = stringValue;
          if (field.required) radio.required = true;
          const radioText = document.createElement('span');
          radioText.textContent = stringValue.trim() || '';
          radioLabel.append(radio, radioText);
          radioGroup.appendChild(radioLabel);
        });
      } else {
        const placeholderOption = document.createElement('label');
        placeholderOption.className = 'form-radio-option';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.disabled = true;
        placeholderOption.append(radio, document.createTextNode('Option'));
        radioGroup.appendChild(placeholderOption);
      }
      control = radioGroup;
    }
    // Venue ticketing - use shared builder if available
    else if (field.type === 'venue-ticketing') {
      wrapper.classList.add('form-field--venues-sessions-pricing');
      if (typeof window.buildVenueSessionPreview === 'function') {
        control = window.buildVenueSessionPreview(field, baseId);
      } else {
        // Fallback placeholder
        control = document.createElement('div');
        control.className = 'venue-session-editor';
        control.textContent = 'Venue/Session editor (loading...)';
      }
    }
    // Variant pricing - simplified version (full implementation will be added)
    else if (field.type === 'variant-pricing') {
      wrapper.classList.add('form-field--variant-pricing');
      control = document.createElement('div');
      control.className = 'variant-pricing-options-editor';
      control.textContent = 'Variant pricing editor (to be implemented)';
    }
    // URL fields
    else if (field.type === 'website-url' || field.type === 'tickets-url') {
      wrapper.classList.add('form-field--url');
      const urlWrapper = document.createElement('div');
      urlWrapper.className = 'form-url-wrapper';
      const urlInput = document.createElement('input');
      urlInput.type = 'text';
      urlInput.className = 'form-url-input';
      urlInput.id = `${baseId}-input`;
      const placeholderValue = field.placeholder && /\.[A-Za-z]{2,}/.test(field.placeholder)
        ? field.placeholder
        : 'https://example.com';
      urlInput.placeholder = placeholderValue;
      urlInput.autocomplete = 'url';
      urlInput.inputMode = 'url';
      if (field.required) urlInput.required = true;
      urlWrapper.appendChild(urlInput);
      control = urlWrapper;
    }
    // Images
    else if (field.type === 'images') {
      wrapper.classList.add('form-field--images');
      const imageWrapper = document.createElement('div');
      imageWrapper.className = 'form-images';
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = `${baseId}-input`;
      fileInput.accept = 'image/*';
      fileInput.multiple = true;
      fileInput.dataset.imagesField = 'true';
      fileInput.dataset.maxImages = '10';
      const previewId = `${baseId}-previews`;
      const messageId = `${baseId}-message`;
      fileInput.dataset.imagePreviewTarget = previewId;
      fileInput.dataset.imageMessageTarget = messageId;
      const hint = document.createElement('div');
      hint.className = 'form-image-hint';
      hint.textContent = 'Upload up to 10 images.';
      const message = document.createElement('div');
      message.className = 'form-image-message';
      message.id = messageId;
      message.hidden = true;
      const previewGrid = document.createElement('div');
      previewGrid.className = 'form-image-previews';
      previewGrid.id = previewId;
      imageWrapper.append(fileInput, hint, message, previewGrid);
      control = imageWrapper;
    }
    // Location
    else if (field.type === 'location') {
      wrapper.classList.add('form-field--location');
      const locationWrapper = document.createElement('div');
      locationWrapper.className = 'location-field-wrapper';
      locationWrapper.setAttribute('role', 'group');
      const addressRow = document.createElement('div');
      addressRow.className = 'venue-line address_line-line';
      const geocoderContainer = document.createElement('div');
      geocoderContainer.className = 'address_line-geocoder-container';
      geocoderContainer.id = `${baseId}-location-geocoder`;
      addressRow.appendChild(geocoderContainer);
      locationWrapper.appendChild(addressRow);
      const latitudeInput = document.createElement('input');
      latitudeInput.type = 'hidden';
      latitudeInput.dataset.locationLatitude = 'true';
      const longitudeInput = document.createElement('input');
      longitudeInput.type = 'hidden';
      longitudeInput.dataset.locationLongitude = 'true';
      locationWrapper.append(latitudeInput, longitudeInput);
      // Location geocoder initialization will be handled separately
      control = locationWrapper;
    }
    // Default text input
    else {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = field.placeholder || '';
      input.id = `${baseId}-input`;
      if (field.type === 'title') {
        input.classList.add('form-title-input');
      }
      if (field.required) input.required = true;
      control = input;
    }
    
    if (control) {
      if (control instanceof HTMLElement) {
        control.setAttribute('aria-required', field.required ? 'true' : 'false');
        if (labelId) {
          control.setAttribute('aria-labelledby', labelId);
        }
      }
      
      if (field.required) {
        wrapper.classList.add('form-field--required');
        labelEl.appendChild(document.createTextNode(' '));
        const asterisk = document.createElement('span');
        asterisk.className = 'required-asterisk';
        asterisk.textContent = '*';
        labelEl.appendChild(asterisk);
      }
      
      const header = document.createElement('div');
      header.className = 'form-field-header';
      header.appendChild(labelEl);
      wrapper.append(header, control);
      container.appendChild(wrapper);
    }
  });
}
// Expose shared form functions globally
window.renderForm = renderForm;
window.getBaseFieldType = getBaseFieldType;
window.ensureFieldDefaults = ensureFieldDefaults;

// === Message Utility Functions ===
// Cache for loaded messages
let messageCache = null;
let messageCachePromise = null;

/**
 * Load messages from database and cache them
 * @param {boolean} includeAdmin - If true, includes admin and email messages (for admin panel)
 * @returns {Promise<Object>} Object mapping message_key to message data
 */
async function loadMessagesFromDatabase(includeAdmin = false){
  // Return cached messages if available
  if(messageCache && !includeAdmin){
    return messageCache;
  }
  
  // Prevent duplicate requests
  if(messageCachePromise){
    return messageCachePromise;
  }
  
  messageCachePromise = (async () => {
    try {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch('/gateway.php?action=get-admin-settings&include_messages=true', {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if(!response.ok){
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      
      if(!result.success || !result.messages){
        console.warn('Failed to load messages from database:', result.message || result.messages_error);
        return {};
      }
      
      // Flatten messages by message_key for easy lookup
      const messagesMap = {};
      result.messages.forEach(container => {
        if(!container.messages || !Array.isArray(container.messages)) return;
        
        container.messages.forEach(message => {
          // Filter visibility: users see only msg_user and msg_member, exclude msg_email
          // Admin sees everything when includeAdmin is true
          if(!includeAdmin){
            const visibleContainers = ['msg_user', 'msg_member'];
            if(!visibleContainers.includes(message.container_key || container.container_key)){
              return; // Skip admin and email messages for regular users
            }
            // Also check is_visible flag
            if(message.is_visible === false || message.is_visible === 0){
              return; // Skip hidden messages
            }
          }
          
          // Only include active messages
          if(message.is_active !== false && message.is_active !== 0){
            messagesMap[message.message_key] = message;
          }
        });
      });
      
      // Cache user-visible messages separately from admin messages
      if(!includeAdmin){
        messageCache = messagesMap;
      }
      
      return messagesMap;
    } catch(error){
      if(error.name === 'AbortError'){
        console.error('Message loading timed out after 10 seconds');
      } else {
        console.error('Error loading messages from database:', error);
      }
      // Return empty object on error - UI will use fallback text
      return {};
    } finally {
      messageCachePromise = null;
    }
  })();
  
  return messageCachePromise;
}

/**
 * Replace placeholders in message text (e.g., {name} -> actual value)
 * @param {string} text - Message text with placeholders
 * @param {Object} placeholders - Object with placeholder values
 * @returns {string} Message with placeholders replaced
 */
function replacePlaceholders(text, placeholders = {}){
  if(!text || typeof text !== 'string'){
    return text || '';
  }
  
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    return placeholders[key] !== undefined ? String(placeholders[key]) : match;
  });
}

/**
 * Get a message by key from the database
 * @param {string} messageKey - The message_key to look up
 * @param {Object} placeholders - Object with placeholder values to replace
 * @param {boolean} includeAdmin - If true, includes admin/email messages (for admin panel)
 * @returns {Promise<string>} The message text with placeholders replaced, or empty string if not found
 */
async function getMessage(messageKey, placeholders = {}, includeAdmin = false){
  if(!messageKey || typeof messageKey !== 'string'){
    return '';
  }
  
  const messages = await loadMessagesFromDatabase(includeAdmin);
  const message = messages[messageKey];
  
  if(!message){
    console.warn(`Message not found: ${messageKey}`);
    return '';
  }
  
  return replacePlaceholders(message.message_text || '', placeholders);
}

/**
 * Get a message synchronously from cache (must have been loaded first)
 * @param {string} messageKey - The message_key to look up
 * @param {Object} placeholders - Object with placeholder values to replace
 * @param {boolean} includeAdmin - If true, looks in admin messages cache
 * @returns {string} The message text with placeholders replaced, or empty string if not found
 */
function getMessageSync(messageKey, placeholders = {}, includeAdmin = false){
  if(!messageKey || typeof messageKey !== 'string'){
    return '';
  }
  
  // If cache not loaded yet, return empty (should use async getMessage instead)
  if(!includeAdmin && !messageCache){
    console.warn(`Message cache not loaded yet for: ${messageKey}. Use getMessage() instead.`);
    return '';
  }
  
  // For sync version, we need to use cache
  // Note: Admin messages would need separate cache, but for now we'll return empty
  const messages = includeAdmin ? {} : messageCache || {};
  const message = messages[messageKey];
  
  if(!message){
    return '';
  }
  
  return replacePlaceholders(message.message_text || '', placeholders);
}

/**
 * Update all elements with data-message-key attributes when messages load
 * This handles both initial elements and dynamically created ones
 * @param {boolean} includeAdmin - If true, includes admin messages
 */
async function updateAllMessageElements(includeAdmin = false){
  try {
    // Wait for messages to be loaded
    const messages = await loadMessagesFromDatabase(includeAdmin);
    
    // Find all elements with data-message-key attribute (including dynamically created ones)
    const allElements = document.querySelectorAll('[data-message-key]');
    
    for(const el of allElements){
      // CRITICAL: SKIP message items in the messages tab - they're already properly formatted
      // These have complex HTML structure with labels, edit panels, input transforms, etc.
      // If we update these with textContent, we'll destroy the entire messages tab UI
      // DO NOT REMOVE THIS CHECK - it prevents breaking the messages tab
      if(el.closest('.messages-list') || el.closest('.message-item')){
        continue;
      }
      
      const messageKey = el.dataset.messageKey;
      if(!messageKey) continue;
      
      const message = messages[messageKey];
      if(message && message.message_text){
        const text = replacePlaceholders(message.message_text, {});
        if(text){
          el.textContent = text;
        }
      }
    }
  } catch(error){
    console.error('Error updating message elements:', error);
  }
}

/**
 * Set up a MutationObserver to automatically update message elements when they're added to DOM
 */
function setupMessageObserver(){
  if(window.messageObserver) return; // Already set up
  
  window.messageObserver = new MutationObserver((mutations) => {
    // Check if any new elements with data-message-key were added
    let shouldUpdate = false;
    for(const mutation of mutations){
      for(const node of mutation.addedNodes){
        if(node.nodeType === Node.ELEMENT_NODE){
          if(node.hasAttribute && node.hasAttribute('data-message-key')){
            shouldUpdate = true;
            break;
          }
          // Also check children
          if(node.querySelectorAll && node.querySelectorAll('[data-message-key]').length > 0){
            shouldUpdate = true;
            break;
          }
        }
      }
      if(shouldUpdate) break;
    }
    
    // Update messages if new elements were added
    if(shouldUpdate){
      // Debounce to avoid too many updates
      if(window.messageUpdateTimeout){
        clearTimeout(window.messageUpdateTimeout);
      }
      window.messageUpdateTimeout = setTimeout(() => {
        updateAllMessageElements(true).catch(err => {
          console.warn('Failed to update message elements:', err);
        });
      }, 100);
    }
  });
  
  // Observe the entire document for new elements
  window.messageObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Make message functions globally available
window.getMessage = getMessage;
window.getMessageSync = getMessageSync;
window.loadMessagesFromDatabase = loadMessagesFromDatabase;
window.replacePlaceholders = replacePlaceholders;
window.updateAllMessageElements = updateAllMessageElements;

function handlePromptKeydown(event, context){
  if(!context || !context.prompt || typeof context.cancelPrompt !== 'function'){
    return;
  }
  const { prompt, cancelButton, cancelPrompt } = context;
  if(event.key !== 'Enter' || event.defaultPrevented){
    return;
  }
  if(!prompt.contains(event.target)){
    return;
  }
  const active = document.activeElement;
  const activeInPrompt = !!(active && prompt.contains(active));
  const isCancelFocused = activeInPrompt && cancelButton && active === cancelButton;
  const nothingFocusable = !activeInPrompt || active === prompt || active === document.body;
  if(isCancelFocused || nothingFocusable){
    event.preventDefault();
    cancelPrompt();
  }
}

// Extracted from <script>
(function(){
      const LOADING_CLASS = 'is-loading';
      let pendingCount = 0;
      let logoImg = null;
      let updatePending = false;
      let stopRequested = false;
      let stopTimeoutId = null;

      function handleAnimationLoop(){
        if(stopRequested && pendingCount === 0){
          finalizeStop();
        }
      }

      function ensureLogo(){
        if(!logoImg){
          logoImg = document.querySelector('.logo img');
          if(logoImg && !logoImg.__logoAnimationBound){
            try{
              logoImg.addEventListener('animationiteration', handleAnimationLoop);
              logoImg.addEventListener('animationend', handleAnimationLoop);
            }catch(err){}
            logoImg.__logoAnimationBound = true;
          }
        }
        return logoImg;
      }

      function finalizeStop(){
        const img = ensureLogo();
        if(!img){
          return;
        }
        stopRequested = false;
        if(stopTimeoutId){
          clearTimeout(stopTimeoutId);
          stopTimeoutId = null;
        }
        if(img.classList && img.classList.contains(LOADING_CLASS)){
          img.classList.remove(LOADING_CLASS);
        } else if(!img.classList && img.style){
          img.style.animation = '';
        }
      }

      function requestStop(){
        const img = ensureLogo();
        if(!img){
          return;
        }
        if(pendingCount > 0){
          return;
        }
        let isAnimating = false;
        if(img.classList){
          isAnimating = img.classList.contains(LOADING_CLASS);
        } else if(img.style){
          isAnimating = typeof img.style.animation === 'string' && img.style.animation !== '';
        }
        if(!isAnimating){
          finalizeStop();
          return;
        }
        if(stopRequested){
          return;
        }
        stopRequested = true;
        if(stopTimeoutId){
          clearTimeout(stopTimeoutId);
        }
        stopTimeoutId = setTimeout(()=>{
          if(stopRequested && pendingCount === 0){
            finalizeStop();
          }
        }, 1200);
      }

      function applyState(){
        updatePending = false;
        const img = ensureLogo();
        if(!img){
          return;
        }
        if(pendingCount > 0){
          stopRequested = false;
          if(stopTimeoutId){
            clearTimeout(stopTimeoutId);
            stopTimeoutId = null;
          }
          if(img.classList && !img.classList.contains(LOADING_CLASS)){
            img.classList.add(LOADING_CLASS);
          } else if(!img.classList){
            img.style.animation = 'logo-rotate 1s linear infinite';
          }
        } else {
          requestStop();
        }
      }

      function scheduleUpdate(){
        if(updatePending){
          return;
        }
        updatePending = true;
        if(typeof requestAnimationFrame === 'function'){
          requestAnimationFrame(applyState);
        } else {
          setTimeout(applyState, 0);
        }
      }

      function begin(){
        pendingCount++;
        scheduleUpdate();
      }

      function end(){
        if(pendingCount > 0){
          pendingCount--;
        }
        scheduleUpdate();
      }

      if(document.readyState === 'complete' || document.readyState === 'interactive'){
        ensureLogo();
        scheduleUpdate();
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          ensureLogo();
          scheduleUpdate();
        });
      }

      window.addEventListener('pageshow', () => {
        ensureLogo();
        scheduleUpdate();
      });

      const originalFetch = window.fetch;
      if(typeof originalFetch === 'function'){
        window.fetch = function(...args){
          begin();
          let finished = false;
          const finalize = () => {
            if(finished) return;
            finished = true;
            end();
          };
          try{
            const response = originalFetch.apply(this, args);
            Promise.resolve(response).then(finalize, finalize);
            return response;
          } catch(err){
            finalize();
            throw err;
          }
        };
      }

      if('XMLHttpRequest' in window && XMLHttpRequest.prototype){
        const originalSend = XMLHttpRequest.prototype.send;
        if(typeof originalSend === 'function'){
          XMLHttpRequest.prototype.send = function(...args){
            begin();
            let finalized = false;
            const finalize = () => {
              if(finalized) return;
              finalized = true;
              this.removeEventListener('loadend', finalize);
              end();
            };
            this.addEventListener('loadend', finalize);
            try{
              return originalSend.apply(this, args);
            } catch(err){
              finalize();
              throw err;
            }
          };
        }
      }

      const loaderApi = (()=>{
        const api = {
          begin(){ begin(); },
          end(){ end(); },
          track(promise){
            if(!promise || typeof promise.then !== 'function'){
              return promise;
            }
            let settled = false;
            begin();
            const finalize = () => {
              if(settled) return;
              settled = true;
              end();
            };
            Promise.resolve(promise).then(finalize, finalize);
            return promise;
          }
        };
        return api;
      })();

      const existingLoader = window.__logoLoading && typeof window.__logoLoading === 'object'
        ? window.__logoLoading
        : {};
      existingLoader.begin = loaderApi.begin;
      existingLoader.end = loaderApi.end;
      existingLoader.track = loaderApi.track;
      existingLoader.trackPromise = loaderApi.track;
      window.__logoLoading = existingLoader;
    })();

// Extracted from <script>
// --- tiny scheduler helpers ---
  function rafThrottle(fn){
    let scheduled = false, lastArgs, lastThis;
    return function throttled(...args){
      lastArgs = args; lastThis = this;
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => { scheduled = false; fn.apply(lastThis, lastArgs); });
    };
  }

  // Prefer idle time, but don't stall forever.
  function scheduleIdle(fn, timeout=200){
    if ('requestIdleCallback' in window) {
      requestIdleCallback(fn, { timeout });
    } else {
      setTimeout(fn, Math.min(timeout, 50));
    }
  }

  function withPassiveDefault(options){
    if(options === undefined){
      return { passive: true };
    }
    if(typeof options === 'boolean'){
      return { capture: options, passive: true };
    }
    if(typeof options === 'object' && options !== null && options.passive === undefined){
      return Object.assign({}, options, { passive: true });
    }
    return options;
  }

  function addPassiveScrollListener(target, listener, options){
    if(!target || typeof target.addEventListener !== 'function') return null;
    const opts = withPassiveDefault(options);
    target.addEventListener('scroll', listener, opts);
    return opts;
  }

  function removeScrollListener(target, listener, options){
    if(!target || typeof target.removeEventListener !== 'function') return;
    let capture = false;
    if(typeof options === 'boolean'){
      capture = options;
    } else if(typeof options === 'object' && options !== null){
      capture = !!options.capture;
    }
    target.removeEventListener('scroll', listener, capture);
  }

// Extracted from <script>
(function(){
  const ASSET_VERSION = 'v=20240705';
  const assetPattern = /^(?:\.\/)?assets\//;

  function withVersion(url){
    if (!url || url.includes('?')) return url;
    if (!assetPattern.test(url)) return url;
    if (url.startsWith('./')) {
      return `./${url.slice(2)}?${ASSET_VERSION}`;
    }
    return `${url}?${ASSET_VERSION}`;
  }

  function toAbsoluteUrl(url){
    if (!url) return url;
    try {
      return new URL(url, window.location.href).href;
    } catch (err) {
      return url;
    }
  }

  function bustCacheAttributes(){
    const attrs = ['src', 'href'];
    attrs.forEach((attr) => {
      document.querySelectorAll(`[${attr}]`).forEach((node) => {
        const current = node.getAttribute(attr);
        const updated = withVersion(current);
        if (updated && updated !== current) {
          node.setAttribute(attr, updated);
        }
      });
    });

    document.querySelectorAll('[srcset]').forEach((node) => {
      const srcset = node.getAttribute('srcset');
      if (!srcset) return;
      const rewritten = srcset
        .split(',')
        .map((entry) => {
          const trimmed = entry.trim();
          if (!trimmed) return trimmed;
          const parts = trimmed.split(/\s+/, 2);
          const nextUrl = withVersion(parts[0]);
          if (!nextUrl || nextUrl === parts[0]) return trimmed;
          return parts[1] ? `${nextUrl} ${parts[1]}` : nextUrl;
        })
        .join(', ');
      if (rewritten !== srcset) {
        node.setAttribute('srcset', rewritten);
      }
    });
  }

  function updateManifest(){
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) return;
    const manifest = {
      name: 'Events Platform',
      short_name: 'Events',
      icons: [
        {
          src: toAbsoluteUrl(withVersion('assets/favicons/android-chrome-192x192.png')),
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: toAbsoluteUrl(withVersion('assets/favicons/android-chrome-512x512.png')),
          sizes: '512x512',
          type: 'image/png'
        }
      ],
      theme_color: '#ffffff',
      background_color: '#ffffff',
      display: 'standalone'
    };
    const serialized = encodeURIComponent(JSON.stringify(manifest));
    link.setAttribute('href', `data:application/manifest+json;charset=utf-8,${serialized}`);
  }

  function hideGeocoderIconFromAT(){
    let applied = false;
    document.querySelectorAll('.mapboxgl-ctrl-geocoder--icon').forEach((icon) => {
      if (icon.getAttribute('aria-hidden') === 'true') return;
      icon.setAttribute('aria-hidden', 'true');
      icon.setAttribute('role', 'presentation');
      applied = true;
    });
    return applied;
  }

  function setupGeocoderObserver(){
    const observer = new MutationObserver(() => {
      if (hideGeocoderIconFromAT()) {
        /* noop */
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 5000);
  }

  document.addEventListener('DOMContentLoaded', () => {
    bustCacheAttributes();
    updateManifest();
    hideGeocoderIconFromAT();
    setupGeocoderObserver();
    
    // Load user-visible messages on page load (excludes admin and email messages)
    loadMessagesFromDatabase(false).then(() => {
      // Update all message elements after loading
      updateAllMessageElements(false).catch(err => {
        console.warn('Failed to update message elements:', err);
      });
    }).catch(err => {
      console.warn('Failed to preload messages:', err);
    });
    
    // Set up observer for dynamically created elements
    setupMessageObserver();
    
    // Load admin messages and update all elements (including dynamically created ones)
    (async () => {
      try {
        await loadMessagesFromDatabase(true);
        await updateAllMessageElements(true);
      } catch(err){
        console.warn('Failed to load admin messages:', err);
      }
    })();
  });
})();

// Extracted from <script>
if (typeof slugify !== 'function') {
  function slugify(text) {
    return String(text)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

// Extracted from <script>
// === 150x40 pill provider (sprite id: marker-label-bg) ===
(function(){
  const PILL_ID = 'marker-label-bg';
  const ACCENT_ID = `${PILL_ID}--accent`;
  const PILL_BASE_IMAGE_URL = 'assets/icons-30/150x40-pill-70.webp';
  const PILL_ACCENT_IMAGE_URL = 'assets/icons-30/150x40-pill-2f3b73.webp';
  let cachedImages = null;
  let loadingTask = null;
  const pendingMaps = new Set();

  function applyImageToMap(map){
    if(!map || typeof map.hasImage !== 'function' || !cachedImages){
      return;
    }
    try{
      if(map.hasImage(PILL_ID)){
        try{ map.removeImage(PILL_ID); }catch(e){}
      }
      if(map.hasImage(ACCENT_ID)){
        try{ map.removeImage(ACCENT_ID); }catch(e){}
      }
      const baseImage = cachedImages.base || cachedImages.accent;
      if(baseImage){
        map.addImage(PILL_ID, baseImage, { pixelRatio: 1 });
      }
      const accentImage = cachedImages.accent || cachedImages.base;
      if(accentImage){
        map.addImage(ACCENT_ID, accentImage, { pixelRatio: 1 });
      }
    }catch(e){ /* silent */ }
  }

  function tintImage(sourceImage, color, alpha = 1){
    if(!sourceImage){
      return null;
    }
    try{
      const width = sourceImage.naturalWidth || sourceImage.width || 150;
      const height = sourceImage.naturalHeight || sourceImage.height || 40;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      const ctx = canvas.getContext('2d');
      if(!ctx){
        return null;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = window.devicePixelRatio || 1;
      ctx.save();
      ctx.scale(scale, scale);
      ctx.imageSmoothingEnabled = false;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(sourceImage, 0, 0, canvas.width / scale, canvas.height / scale);
      ctx.restore();
      if(color){
        ctx.globalCompositeOperation = 'source-atop';
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      return canvas;
    }catch(err){
      return null;
    }
  }

  function prepareCachedImages(baseImage, accentImage){
    if(!baseImage){
      cachedImages = null;
      return;
    }
    const tintedBase = tintImage(baseImage, 'rgba(0,0,0,1)', 0.9) || baseImage;
    let highlight = null;
    if(accentImage){
      highlight = tintImage(accentImage, null, 1) || accentImage;
    }
    if(!highlight){
      highlight = tintImage(baseImage, '#2f3b73', 1) || tintedBase;
    }
    cachedImages = { base: tintedBase, accent: highlight };
  }

  function loadImage(url){
    if(!url){
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const img = new Image();
      try{ img.crossOrigin = 'anonymous'; }catch(e){}
      try{ img.decoding = 'async'; }catch(e){}
      img.onload = () => {
        if(img.naturalWidth > 0 && img.naturalHeight > 0){
          resolve(img);
        }else{
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
      if(img.complete && img.naturalWidth > 0 && img.naturalHeight > 0){
        resolve(img);
      }
    });
  }

  function ensureImage(){
    if(cachedImages || loadingTask){
      return;
    }
    loadingTask = Promise.all([
      loadImage(PILL_BASE_IMAGE_URL),
      loadImage(PILL_ACCENT_IMAGE_URL)
    ]).then(([baseImage, accentImage]) => {
      if(baseImage){
        prepareCachedImages(baseImage, accentImage);
        if(cachedImages){
          pendingMaps.forEach((map) => applyImageToMap(map));
        }
      }
    }).catch(() => {
      cachedImages = null;
    }).finally(() => {
      pendingMaps.clear();
      loadingTask = null;
    });
  }

  function addOrReplacePill(map){
    try{
      if(!map || typeof map.hasImage !== 'function'){
        return;
      }
      if(cachedImages){
        applyImageToMap(map);
        return;
      }
      pendingMaps.add(map);
      ensureImage();
    }catch(e){ /* silent */ }
  }

  window.__addOrReplacePill150x40 = addOrReplacePill;
  ensureImage();
})();

// Extracted from <script>
let __userInteractionObserved = false;
let __notifyMapOnInteraction = null;

// Remember where the user actually clicked/tapped
    document.addEventListener('pointerdown', (e) => {
      window.__lastPointerDown = e;
      __userInteractionObserved = true;
      if(typeof __notifyMapOnInteraction === 'function'){
        const fn = __notifyMapOnInteraction;
        __notifyMapOnInteraction = null;
        try{ fn(); }catch(err){ console.error(err); }
      }
    }, { capture: true });

    document.addEventListener('touchstart', () => {
      __userInteractionObserved = true;
      if(typeof __notifyMapOnInteraction === 'function'){
        const fn = __notifyMapOnInteraction;
        __notifyMapOnInteraction = null;
        try{ fn(); }catch(err){ console.error(err); }
      }
    }, { capture: true, passive: true });

    document.addEventListener('keydown', () => {
      __userInteractionObserved = true;
      if(typeof __notifyMapOnInteraction === 'function'){
        const fn = __notifyMapOnInteraction;
        __notifyMapOnInteraction = null;
        try{ fn(); }catch(err){ console.error(err); }
      }
    }, { capture: true });

// Extracted from <script>
async function ensureMapboxCssFor(container) {
    const ver = (window.MAPBOX_VERSION || "v3.15.0").replace(/^v/,'v');
    const cssHref = `https://api.mapbox.com/mapbox-gl-js/${ver}/mapbox-gl.css`;

    const doc = (container && container.ownerDocument) || document;
    const root = container && container.getRootNode && container.getRootNode();

    // For Shadow DOM maps, inject right into the shadow root
    if (root && root.host && typeof ShadowRoot !== "undefined" && root instanceof ShadowRoot) {
      if (!root.querySelector('style[data-mapbox-gl]')) {
        const s = document.createElement('style');
        s.setAttribute('data-mapbox-gl','');
        s.textContent = `@import url('${cssHref}');`;
        root.prepend(s);
      }
      return;
    }

    // Normal document (or iframe document)
    let link = doc.getElementById('mapbox-gl-css');
    if (!link) {
      link = doc.createElement('link');
      link.id = 'mapbox-gl-css';
      link.rel = 'stylesheet';
      link.href = cssHref;
      doc.head.appendChild(link);
    }
    if (link.sheet) return;
    await new Promise(res => link.addEventListener('load', res, { once: true }));
  }

  (async () => {
    try {
      await ensureMapboxCssFor(document.body);
    } catch(e){}
  })();

  (function(){
    const q = [];
    let scheduled = false;
    function flush(){
      scheduled = false;
      const budget = 6;
      let start = performance.now();
      while(q.length){
        const fn = q.shift();
        try{ fn && fn(); }catch(err){ console.error(err); }
        if(performance.now() - start > budget){
          if(typeof requestAnimationFrame === 'function'){
            requestAnimationFrame(flush);
          } else {
            setTimeout(flush, 16);
          }
          return;
        }
      }
    }
    window.deferToAnimationFrame = function(cb){
      q.push(cb);
      if(!scheduled){
        scheduled = true;
        if(typeof requestAnimationFrame === 'function'){
          requestAnimationFrame(flush);
        } else {
          setTimeout(flush, 16);
        }
      }
    };
  })();

  // Helper: do nothing until style is truly loaded
  function whenStyleReady(map, fn){
    if (map.isStyleLoaded && map.isStyleLoaded()) { fn(); return; }
    const onLoad = () => { map.off('load', onLoad); fn(); };
    map.on('load', onLoad);
  }

  function applyNightSky(mapInstance){
    if(!mapInstance) return;
    if(typeof mapInstance.setFog === 'function'){
      try {
        mapInstance.setFog({
          color: 'rgba(11,13,23,0.6)',
          'high-color': 'rgba(27,32,53,0.7)',
          'horizon-blend': 0.15,
          'space-color': '#010409',
          'star-intensity': 0.6
        });
      } catch(err){}
    }
    if(typeof mapInstance.getLayer !== 'function'){
      return;
    }
    let skyLayerId = null;
    const skyPaint = {
      'sky-type': 'gradient',
      'sky-gradient-center': [0, 0],
      'sky-gradient-radius': 80,
      'sky-gradient': [
        'interpolate',
        ['linear'],
        ['sky-radial-progress'],
        0.0, 'rgba(6,10,20,1)',
        0.6, '#0b1d51',
        1.0, '#1a2a6c'
      ],
      'sky-opacity': 1
    };
    try {
      if(mapInstance.getLayer('sky')){
        skyLayerId = 'sky';
      } else if(mapInstance.getLayer('night-sky')){
        skyLayerId = 'night-sky';
      } else if(typeof mapInstance.addLayer === 'function'){
        mapInstance.addLayer({
          id:'night-sky',
          type:'sky',
          paint: skyPaint
        });
        skyLayerId = 'night-sky';
      }
    } catch(err){
      if(!skyLayerId && typeof mapInstance.getLayer === 'function' && mapInstance.getLayer('sky')){
        skyLayerId = 'sky';
      }
    }
    if(!skyLayerId || typeof mapInstance.setPaintProperty !== 'function'){
      return;
    }
    Object.entries(skyPaint).forEach(([prop, value]) => {
      try { mapInstance.setPaintProperty(skyLayerId, prop, value); } catch(err){}
    });
  }

  function createTransparentPlaceholder(width, height){
    const canvas = document.createElement('canvas');
    const w = Math.max(1, Number.isFinite(width) ? width : (width || 2));
    const h = Math.max(1, Number.isFinite(height) ? height : (Number.isFinite(width) ? width : (width || 2)));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if(ctx){
      ctx.clearRect(0, 0, w, h);
    }
    return canvas;
  }

  function ensurePlaceholderSprites(mapInstance){
    if(!mapInstance || typeof mapInstance.addImage !== 'function') return;
    const required = ['mx-federal-5','background','background-stroke','icon','icon-stroke'];
    const install = () => {
      required.forEach(name => {
        try{
          if(mapInstance.hasImage?.(name)) return;
          const size = name === 'mx-federal-5' ? 2 : 4;
          const options = { pixelRatio: 1 };
          if(name !== 'mx-federal-5'){
            options.sdf = true;
          }
          mapInstance.addImage(name, createTransparentPlaceholder(size), options);
        }catch(err){}
      });
    };
    if(typeof mapInstance.isStyleLoaded === 'function' && !mapInstance.isStyleLoaded()){
      if(!mapInstance.__placeholderSpriteReady){
        const onStyleLoad = () => {
          try{ install(); }catch(err){}
          try{ mapInstance.off?.('style.load', onStyleLoad); }catch(err){}
          mapInstance.__placeholderSpriteReady = null;
        };
        mapInstance.__placeholderSpriteReady = onStyleLoad;
        try{ mapInstance.on('style.load', onStyleLoad); }catch(err){}
      }
      return;
    }
    install();
  }

  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const markerIconSize = 1;
  const markerIconBaseSizePx = 30;
  const markerLabelBackgroundWidthPx = 150;
  const markerLabelBackgroundHeightPx = 40;
  const markerLabelTextGapPx = 5;
  const markerLabelMarkerInsetPx = 5;
  const markerLabelTextRightPaddingPx = 5;
  const markerLabelTextPaddingPx = markerIconBaseSizePx * markerIconSize + markerLabelMarkerInsetPx + markerLabelTextGapPx;
  const markerLabelTextAreaWidthPx = Math.max(0, markerLabelBackgroundWidthPx - markerLabelTextPaddingPx - markerLabelTextRightPaddingPx);
  const markerLabelTextSize = 12;
  const markerLabelTextLineHeight = 1.2;
  const markerLabelBgTranslatePx = 0;
  const markerLabelEllipsisChar = '\u2026';
  const mapCardTitleWidthPx = 165;
  let markerLabelMeasureContext = null;
  const markerLabelCompositePlaceholderIds = new Set();

  function ensureMarkerLabelMeasureContext(){
    if(markerLabelMeasureContext){
      return markerLabelMeasureContext;
    }
    const canvas = document.createElement('canvas');
    markerLabelMeasureContext = canvas.getContext('2d');
    return markerLabelMeasureContext;
  }

  function markerLabelMeasureFont(){
    return `${markerLabelTextSize}px "Open Sans", "Arial Unicode MS Regular", sans-serif`;
  }

  function shortenMarkerLabelText(text, widthPx = markerLabelTextAreaWidthPx){
    const raw = (text ?? '').toString().trim();
    if(!raw){
      return '';
    }
    const ctx = ensureMarkerLabelMeasureContext();
    if(!ctx){
      return raw;
    }
    ctx.font = markerLabelMeasureFont();
    const maxWidth = widthPx;
    if(maxWidth <= 0){
      return raw;
    }
    if(ctx.measureText(raw).width <= maxWidth){
      return raw;
    }
    const ellipsis = markerLabelEllipsisChar;
    let low = 0;
    let high = raw.length;
    let best = ellipsis;
    while(low <= high){
      const mid = Math.floor((low + high) / 2);
      if(mid <= 0){
        high = mid - 1;
        continue;
      }
      const candidate = raw.slice(0, mid).trimEnd() + ellipsis;
      if(ctx.measureText(candidate).width <= maxWidth){
        best = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return best;
  }

  function splitTextAcrossLines(text, widthPx, maxLines){
    const normalized = (text ?? '').toString().replace(/\s+/g, ' ').trim();
    if(!normalized){
      return [];
    }
    if(!Number.isFinite(widthPx) || widthPx <= 0 || maxLines <= 0){
      return [normalized];
    }
    const ctx = ensureMarkerLabelMeasureContext();
    if(!ctx){
      return [normalized];
    }
    ctx.font = markerLabelMeasureFont();
    if(ctx.measureText(normalized).width <= widthPx){
      return [normalized];
    }
    const lines = [];
    let remaining = normalized;
    while(remaining && lines.length < maxLines){
      if(lines.length === maxLines - 1){
        lines.push(shortenMarkerLabelText(remaining, widthPx));
        break;
      }
      let low = 1;
      let high = remaining.length;
      let bestIndex = 0;
      while(low <= high){
        const mid = Math.floor((low + high) / 2);
        const candidate = remaining.slice(0, mid).trimEnd();
        if(!candidate){
          low = mid + 1;
          continue;
        }
        if(ctx.measureText(candidate).width <= widthPx){
          bestIndex = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      let line = remaining.slice(0, bestIndex).trimEnd();
      const leftoverRaw = remaining.slice(bestIndex);
      const leftoverHadLeadingWhitespace = /^\s/.test(leftoverRaw);
      let leftover = leftoverRaw.trimStart();
      if(leftover){
        const lastSpace = line.lastIndexOf(' ');
        if(lastSpace > 0){
          const candidate = line.slice(0, lastSpace).trimEnd();
          const movedBase = line.slice(lastSpace + 1);
          const moved = (leftoverHadLeadingWhitespace ? `${movedBase} ${leftover}` : `${movedBase}${leftover}`).trim();
          if(candidate && ctx.measureText(candidate).width <= widthPx){
            line = candidate;
            leftover = moved;
          }
        }
      }
      if(!line){
        lines.push(shortenMarkerLabelText(remaining, widthPx));
        break;
      }
      lines.push(line);
      remaining = leftover;
      if(remaining && ctx.measureText(remaining).width <= widthPx && lines.length < maxLines){
        lines.push(remaining);
        break;
      }
    }
    return lines;
  }

  function getPrimaryVenueName(p){
    if(!p) return '';
    const activeKey = typeof selectedVenueKey === 'string' && selectedVenueKey ? selectedVenueKey : null;
    if(activeKey && Array.isArray(p.locations) && p.locations.length){
      const match = p.locations.find(loc => loc && toVenueCoordKey(loc.lng, loc.lat) === activeKey && loc.venue);
      if(match && match.venue){
        return match.venue;
      }
    }
    const loc = Array.isArray(p.locations) && p.locations.length ? p.locations[0] : null;
    if(loc && loc.venue){
      return loc.venue;
    }
    if(p.venue){
      return p.venue;
    }
    return p.city || '';
  }

  function getMarkerLabelLines(p){
    const title = p && p.title ? p.title : '';
    const markerTitleLines = splitTextAcrossLines(title, markerLabelTextAreaWidthPx, 2);
    while(markerTitleLines.length < 2){ markerTitleLines.push(''); }
    const cardTitleLines = splitTextAcrossLines(title, mapCardTitleWidthPx, 2);
    while(cardTitleLines.length < 2){ cardTitleLines.push(''); }
    const venueRaw = getPrimaryVenueName(p);
    return {
      line1: markerTitleLines[0] || '',
      line2: markerTitleLines[1] || '',
      cardTitleLines,
      venueLine: venueRaw ? shortenMarkerLabelText(venueRaw, mapCardTitleWidthPx) : ''
    };
  }

  function buildMarkerLabelText(p, overrideLines){
    const lines = overrideLines || getMarkerLabelLines(p);
    if(lines.line2){
      return `${lines.line1}\n${lines.line2}`;
    }
    return lines.line1;
  }

  const MARKER_LABEL_BG_ID = 'marker-label-bg';
  const MARKER_LABEL_BG_ACCENT_ID = `${MARKER_LABEL_BG_ID}--accent`;
  const MARKER_LABEL_COMPOSITE_PREFIX = 'marker-label-composite-';
  const MARKER_LABEL_COMPOSITE_ACCENT_SUFFIX = '--accent';
  const VISIBLE_MARKER_LABEL_LAYERS = ['marker-label', 'marker-label-highlight'];
  const markerLabelCompositeStore = new Map();
  const markerLabelCompositePending = new Map();
  let lastInViewMarkerLabelSpriteIds = new Set();
  // Mapbox GL JS enforces a hard limit on the number of images that can be
  // registered with a style (currently ~1000). Generating a composite sprite
  // for every single marker label without a cap quickly exhausts that budget,
  // which in turn causes Mapbox to render the fallback pill without any icon
  // or text. Each composite registers both a base pill and its accent variant,
  // so cap the composites to keep the total image count comfortably below the
  // platform ceiling.
  const MARKER_LABEL_COMPOSITE_LIMIT = 900;
  const MARKER_SPRITE_RETAIN_ZOOM = 12;
  let markerLabelPillImagePromise = null;

  function nowTimestamp(){
    try{
      if(typeof performance !== 'undefined' && typeof performance.now === 'function'){
        return performance.now();
      }
    }catch(err){}
    return Date.now();
  }

  function collectActiveCompositeEntries(mapInstance){
    const entries = [];
    if(!mapInstance) return entries;
    markerLabelCompositeStore.forEach((meta, spriteId) => {
      if(!meta || !meta.image) return;
      const compositeId = markerLabelCompositeId(spriteId);
      let present = false;
      if(typeof mapInstance.hasImage === 'function'){
        try{ present = !!mapInstance.hasImage(compositeId); }
        catch(err){ present = false; }
      }
      if(!present) return;
      entries.push({
        spriteId,
        compositeId,
        priority: Boolean(meta.priority),
        inView: Boolean(meta.inView),
        lastUsed: Number.isFinite(meta.lastUsed) ? meta.lastUsed : 0
      });
    });
    return entries;
  }

  function touchMarkerLabelCompositeMeta(spriteId, options = {}){
    if(!spriteId) return null;
    const opts = options || {};
    const meta = markerLabelCompositeStore.get(spriteId) || {};
    const shouldUpdateTime = opts.updateTimestamp !== false;
    if(shouldUpdateTime){
      const ts = Number.isFinite(opts.timestamp) ? opts.timestamp : nowTimestamp();
      meta.lastUsed = ts;
    } else if(!Number.isFinite(meta.lastUsed)){
      meta.lastUsed = 0;
    }
    if(opts.inView !== undefined){
      meta.inView = Boolean(opts.inView);
    }
    if(opts.priority !== undefined){
      meta.priority = Boolean(opts.priority);
    }
    markerLabelCompositeStore.set(spriteId, meta);
    return meta;
  }

  function refreshInViewMarkerLabelComposites(mapInstance){
    if(!mapInstance || typeof mapInstance.queryRenderedFeatures !== 'function'){
      return;
    }
    let features = [];
    const layersToQuery = Array.isArray(VISIBLE_MARKER_LABEL_LAYERS)
      ? VISIBLE_MARKER_LABEL_LAYERS.filter(layerId => {
          if(!layerId){
            return false;
          }
          if(typeof mapInstance.getLayer !== 'function'){
            return true;
          }
          try{
            return Boolean(mapInstance.getLayer(layerId));
          }catch(err){
            return false;
          }
        })
      : [];
    try{
      if(layersToQuery.length){
        features = mapInstance.queryRenderedFeatures({ layers: layersToQuery });
      }
    }catch(err){
      features = [];
    }
    const nextIds = new Set();
    const timestamp = nowTimestamp();
    features.forEach(feature => {
      if(!feature || !feature.properties) return;
      const rawSpriteId = feature.properties.labelSpriteId ?? feature.properties.spriteId;
      if(rawSpriteId === undefined || rawSpriteId === null) return;
      const spriteId = String(rawSpriteId);
      if(!spriteId) return;
      if(nextIds.has(spriteId)){
        touchMarkerLabelCompositeMeta(spriteId, { inView: true, updateTimestamp: false });
        return;
      }
      nextIds.add(spriteId);
      touchMarkerLabelCompositeMeta(spriteId, { inView: true, timestamp });
    });
    lastInViewMarkerLabelSpriteIds.forEach(spriteId => {
      if(nextIds.has(spriteId)) return;
      const meta = markerLabelCompositeStore.get(spriteId);
      if(!meta) return;
      meta.inView = false;
      markerLabelCompositeStore.set(spriteId, meta);
    });
    lastInViewMarkerLabelSpriteIds = nextIds;
  }
  // Expose on window for admin.js access
  window.refreshInViewMarkerLabelComposites = refreshInViewMarkerLabelComposites;

  function enforceMarkerLabelCompositeBudget(mapInstance, options = {}){
    if(!mapInstance || !MARKER_LABEL_COMPOSITE_LIMIT || MARKER_LABEL_COMPOSITE_LIMIT <= 0){
      return;
    }
    let zoomForBudget = NaN;
    if(typeof mapInstance.getZoom === 'function'){
      try{ zoomForBudget = mapInstance.getZoom(); }
      catch(err){ zoomForBudget = NaN; }
    }
    if(Number.isFinite(zoomForBudget) && zoomForBudget >= MARKER_SPRITE_RETAIN_ZOOM){
      mapInstance.__retainAllMarkerSprites = true;
    }
    if(mapInstance.__retainAllMarkerSprites){
      return;
    }
    if(typeof mapInstance.removeImage !== 'function'){
      return;
    }
    const { keep = [], reserve = 0 } = options || {};
    const keepList = Array.isArray(keep) ? keep : [keep];
    const keepSet = new Set(keepList.filter(Boolean));
    const entries = collectActiveCompositeEntries(mapInstance);
    if(!entries.length){
      return;
    }
    const effectiveLimit = Math.max(0, MARKER_LABEL_COMPOSITE_LIMIT - Math.max(0, reserve));
    if(entries.length <= effectiveLimit){
      return;
    }
    entries.forEach(entry => {
      entry.keep = keepSet.has(entry.spriteId);
    });
    entries.sort((a, b) => {
      if(a.keep !== b.keep){
        return a.keep ? -1 : 1;
      }
      if(a.inView !== b.inView){
        return a.inView ? -1 : 1;
      }
      if(a.priority !== b.priority){
        return a.priority ? -1 : 1;
      }
      return (b.lastUsed || 0) - (a.lastUsed || 0);
    });
    entries.slice(effectiveLimit).forEach(entry => {
      if(keepSet.has(entry.spriteId)) return;
      const meta = markerLabelCompositeStore.get(entry.spriteId);
      if(meta){
        if(meta.image){
          try{ delete meta.image; }catch(err){ meta.image = null; }
        }
        if(meta.options){
          try{ delete meta.options; }catch(err){ meta.options = undefined; }
        }
        if(meta.highlightImage){
          try{ delete meta.highlightImage; }catch(err){ meta.highlightImage = null; }
        }
        if(meta.highlightOptions){
          try{ delete meta.highlightOptions; }catch(err){ meta.highlightOptions = undefined; }
        }
        meta.inView = false;
        markerLabelCompositeStore.set(entry.spriteId, meta);
      }
      markerLabelCompositePending.delete(entry.spriteId);
      try{
        if(typeof mapInstance.hasImage === 'function'){
          if(mapInstance.hasImage(entry.compositeId)){
            mapInstance.removeImage(entry.compositeId);
          }
          const highlightId = `${entry.compositeId}${MARKER_LABEL_COMPOSITE_ACCENT_SUFFIX}`;
          if(mapInstance.hasImage(highlightId)){
            mapInstance.removeImage(highlightId);
          }
        }
      }catch(err){}
    });
  }

  function loadMarkerLabelImage(url){
    return new Promise((resolve, reject) => {
      if(!url){
        reject(new Error('Missing URL'));
        return;
      }
      const img = new Image();
      try{ img.crossOrigin = 'anonymous'; }catch(err){}
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${url}`));
      img.src = url;
      if(img.complete){
        setTimeout(() => {
          if(img.naturalWidth > 0 && img.naturalHeight > 0){
            resolve(img);
          }
        }, 0);
      }
    });
  }

  async function ensureMarkerLabelPillImage(){
    if(markerLabelPillImagePromise){
      return markerLabelPillImagePromise;
    }
    const baseUrl = 'assets/icons-30/150x40-pill-70.webp';
    const accentUrl = 'assets/icons-30/150x40-pill-2f3b73.webp';
    const promise = Promise.all([
      loadMarkerLabelImage(baseUrl),
      loadMarkerLabelImage(accentUrl).catch(() => null)
    ]).then(([baseImg, accentImg]) => {
      if(!baseImg){
        return null;
      }
      return { base: baseImg, highlight: accentImg };
    }).catch(err => {
      console.error(err);
      return null;
    });
    markerLabelPillImagePromise = promise;
    promise.then(result => {
      if(!result){
        markerLabelPillImagePromise = null;
      }
    }).catch(() => {
      markerLabelPillImagePromise = null;
    });
    return markerLabelPillImagePromise;
  }

  function computeMarkerLabelCanvasDimensions(sourceImage){
    const rawWidth = sourceImage && (sourceImage.naturalWidth || sourceImage.width)
      ? (sourceImage.naturalWidth || sourceImage.width)
      : markerLabelBackgroundWidthPx;
    const rawHeight = sourceImage && (sourceImage.naturalHeight || sourceImage.height)
      ? (sourceImage.naturalHeight || sourceImage.height)
      : markerLabelBackgroundHeightPx;
    const canvasWidth = Math.max(1, Math.round(Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : markerLabelBackgroundWidthPx));
    const canvasHeight = Math.max(1, Math.round(Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : markerLabelBackgroundHeightPx));
    const pixelRatio = canvasWidth / markerLabelBackgroundWidthPx;
    return { canvasWidth, canvasHeight, pixelRatio };
  }

  function drawMarkerLabelComposite(ctx, image, x, y, width, height){
    if(!ctx || !image){
      return;
    }
    const scale = window.devicePixelRatio || 1;
    ctx.save();
    ctx.scale(scale, scale);
    try{
      ctx.imageSmoothingEnabled = false;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, x / scale, y / scale, width / scale, height / scale);
    }catch(err){
      console.error(err);
    }
    ctx.restore();
  }

  function buildMarkerLabelPillSprite(sourceImage, tintColor, tintAlpha = 1){
    if(!sourceImage){
      return null;
    }
    const { canvasWidth, canvasHeight, pixelRatio } = computeMarkerLabelCanvasDimensions(sourceImage);
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    if(!ctx){
      return null;
    }
    try{
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      const scale = window.devicePixelRatio || 1;
      ctx.save();
      ctx.scale(scale, scale);
      ctx.imageSmoothingEnabled = false;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(sourceImage, 0, 0, canvasWidth / scale, canvasHeight / scale);
      ctx.restore();
    }catch(err){
      console.error(err);
      return null;
    }
    if(tintColor){
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = tintAlpha;
      ctx.fillStyle = tintColor;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    let imageData = null;
    try{
      imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    }catch(err){
      console.error(err);
      imageData = null;
    }
    if(!imageData){
      return null;
    }
    return {
      image: imageData,
      options: { pixelRatio: Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1 }
    };
  }

  let markerLabelPillSpriteCache = null;

  async function ensureMarkerLabelPillSprites(){
    if(markerLabelPillSpriteCache){
      return markerLabelPillSpriteCache;
    }
    const assets = await ensureMarkerLabelPillImage();
    if(!assets || !assets.base){
      return null;
    }
    const baseSprite = buildMarkerLabelPillSprite(assets.base, 'rgba(0,0,0,1)', 0.9);
    let accentSprite = null;
    if(assets.highlight){
      accentSprite = buildMarkerLabelPillSprite(assets.highlight, null, 1);
    }
    if(!accentSprite){
      accentSprite = buildMarkerLabelPillSprite(assets.base, '#2f3b73', 1);
    }
    if(!baseSprite){
      return null;
    }
    markerLabelPillSpriteCache = {
      base: baseSprite,
      highlight: accentSprite || baseSprite
    };
    return markerLabelPillSpriteCache;
  }

  function markerLabelCompositeId(spriteId){
    return `${MARKER_LABEL_COMPOSITE_PREFIX}${spriteId}`;
  }

  async function createMarkerLabelCompositeTextures(mapInstance, labelSpriteId, meta){
    if(!labelSpriteId){
      return null;
    }
    const pillAssets = await ensureMarkerLabelPillImage();
    if(!pillAssets || !pillAssets.base){
      return null;
    }
    const pillImg = pillAssets.base;
    const pillAccentImg = pillAssets.highlight;
    const markerSources = window.subcategoryMarkers || {};
    const iconUrl = meta && meta.iconId ? markerSources[meta.iconId] : null;
    let iconImg = null;
    if(iconUrl){
      try{
        iconImg = await loadMarkerLabelImage(iconUrl);
      }catch(err){
        console.error(err);
        iconImg = null;
      }
    }
    const { canvasWidth, canvasHeight, pixelRatio } = computeMarkerLabelCanvasDimensions(pillImg);
    let deviceScale = 1;
    try{
      const ratio = window.devicePixelRatio;
      if(Number.isFinite(ratio) && ratio > 0){
        deviceScale = ratio;
      }
    }catch(err){
      deviceScale = 1;
    }
    if(!Number.isFinite(deviceScale) || deviceScale <= 0){
      deviceScale = 1;
    }
    const scaledCanvasWidth = Math.max(1, Math.round(canvasWidth * deviceScale));
    const scaledCanvasHeight = Math.max(1, Math.round(canvasHeight * deviceScale));
    const scaledPixelRatio = (Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1) * deviceScale;
    const labelLines = [];
    const line1 = (meta && meta.labelLine1 ? meta.labelLine1 : '').trim();
    const line2 = (meta && meta.labelLine2 ? meta.labelLine2 : '').trim();
    if(line1){
      labelLines.push({ text: line1, color: '#ffffff' });
    }
    if(line2){
      labelLines.push({ text: line2, color: meta && meta.isMulti ? '#d0d0d0' : '#ffffff' });
    }
    const drawForeground = (ctx) => {
      if(!ctx){
        return;
      }
      try{
        ctx.imageSmoothingEnabled = true;
        if('imageSmoothingQuality' in ctx){
          ctx.imageSmoothingQuality = 'high';
        }
      }catch(err){}
      if(iconImg){
        const iconSizePx = markerIconBaseSizePx * markerIconSize * scaledPixelRatio;
        const destX = Math.round(markerLabelMarkerInsetPx * scaledPixelRatio);
        const destY = Math.round((scaledCanvasHeight - iconSizePx) / 2);
        drawMarkerLabelComposite(ctx, iconImg, destX, destY, iconSizePx, iconSizePx);
      }
      if(labelLines.length){
        const fontSizePx = markerLabelTextSize * scaledPixelRatio;
        const lineGapPx = Math.max(0, (markerLabelTextLineHeight - 1) * markerLabelTextSize * scaledPixelRatio);
        const totalHeight = labelLines.length * fontSizePx + Math.max(0, labelLines.length - 1) * lineGapPx;
        let textY = Math.round((scaledCanvasHeight - totalHeight) / 2);
        if(!Number.isFinite(textY) || textY < 0){
          textY = 0;
        }
        const textX = Math.round(markerLabelTextPaddingPx * scaledPixelRatio);
        ctx.font = `${fontSizePx}px "Open Sans", "Arial Unicode MS Regular", sans-serif`;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 2 * scaledPixelRatio;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1 * scaledPixelRatio;
        labelLines.forEach(line => {
          ctx.fillStyle = line.color;
          try{
            ctx.fillText(line.text, textX, textY);
          }catch(err){
            console.error(err);
          }
          textY += fontSizePx + lineGapPx;
        });
        ctx.shadowColor = 'transparent';
      }
    };
    const buildComposite = (backgroundImage, tintColor, tintAlpha = 1) => {
      if(!backgroundImage){
        return null;
      }
      const canvas = document.createElement('canvas');
      canvas.width = scaledCanvasWidth;
      canvas.height = scaledCanvasHeight;
      const ctx = canvas.getContext('2d');
      if(!ctx){
        return null;
      }
      ctx.clearRect(0, 0, scaledCanvasWidth, scaledCanvasHeight);
      try{
        drawMarkerLabelComposite(ctx, backgroundImage, 0, 0, scaledCanvasWidth, scaledCanvasHeight);
      }catch(err){
        console.error(err);
      }
      if(tintColor){
        ctx.globalCompositeOperation = 'source-atop';
        ctx.globalAlpha = tintAlpha;
        ctx.fillStyle = tintColor;
        ctx.fillRect(0, 0, scaledCanvasWidth, scaledCanvasHeight);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      drawForeground(ctx);
      let imageData = null;
      try{
        imageData = ctx.getImageData(0, 0, scaledCanvasWidth, scaledCanvasHeight);
      }catch(err){
        console.error(err);
        imageData = null;
      }
      if(!imageData){
        return null;
      }
      return {
        image: imageData,
        options: { pixelRatio: Number.isFinite(scaledPixelRatio) && scaledPixelRatio > 0 ? scaledPixelRatio : 1 }
      };
    };
    const baseComposite = buildComposite(pillImg, 'rgba(0,0,0,1)', 0.9);
    let accentComposite = null;
    if(pillAccentImg){
      accentComposite = buildComposite(pillAccentImg, null, 1);
    }
    if(!accentComposite){
      accentComposite = buildComposite(pillImg, '#2f3b73', 1);
    }
    if(!baseComposite){
      return null;
    }
    const highlightComposite = accentComposite || baseComposite;
    const nextMeta = Object.assign({}, meta || {}, {
      image: baseComposite.image,
      options: baseComposite.options,
      highlightImage: highlightComposite ? highlightComposite.image : null,
      highlightOptions: (highlightComposite && highlightComposite.options) || baseComposite.options
    });
    markerLabelCompositeStore.set(labelSpriteId, nextMeta);
    return {
      base: baseComposite,
      highlight: highlightComposite,
      meta: nextMeta
    };
  }

  async function ensureMarkerLabelCompositeAssets(mapInstance, labelSpriteId, meta){
    if(!labelSpriteId){
      return null;
    }
    const existing = markerLabelCompositeStore.get(labelSpriteId);
    if(existing && existing.image){
      return {
        base: { image: existing.image, options: existing.options || {} },
        highlight: {
          image: existing.highlightImage || existing.image,
          options: existing.highlightOptions || existing.options || {}
        },
        meta: existing
      };
    }
    if(markerLabelCompositePending.has(labelSpriteId)){
      try{
        await markerLabelCompositePending.get(labelSpriteId);
      }catch(err){
        console.error(err);
      }
      const refreshed = markerLabelCompositeStore.get(labelSpriteId);
      if(refreshed && refreshed.image){
        return {
          base: { image: refreshed.image, options: refreshed.options || {} },
          highlight: {
            image: refreshed.highlightImage || refreshed.image,
            options: refreshed.highlightOptions || refreshed.options || {}
          },
          meta: refreshed
        };
      }
    }
    const task = (async () => {
      return createMarkerLabelCompositeTextures(mapInstance, labelSpriteId, meta);
    })();
    markerLabelCompositePending.set(labelSpriteId, task);
    try{
      const generated = await task;
      if(!generated || !generated.base){
        return null;
      }
      return generated;
    }finally{
      markerLabelCompositePending.delete(labelSpriteId);
    }
  }

  async function generateMarkerImageFromId(id, mapInstance, options = {}){
    if(!id){
      return null;
    }
    const targetMap = mapInstance || map;
    if(id === MARKER_LABEL_BG_ID || id === MARKER_LABEL_BG_ACCENT_ID){
      const sprites = await ensureMarkerLabelPillSprites();
      if(!sprites){
        return {
          image: createTransparentPlaceholder(markerLabelBackgroundWidthPx, markerLabelBackgroundHeightPx),
          options: { pixelRatio: 1 }
        };
      }
      return id === MARKER_LABEL_BG_ID ? sprites.base : (sprites.highlight || sprites.base);
    }
    if(id && id.startsWith(MARKER_LABEL_COMPOSITE_PREFIX)){
      const isAccent = id.endsWith(MARKER_LABEL_COMPOSITE_ACCENT_SUFFIX);
      const baseId = isAccent ? id.slice(0, -MARKER_LABEL_COMPOSITE_ACCENT_SUFFIX.length) : id;
      const spriteId = baseId.slice(MARKER_LABEL_COMPOSITE_PREFIX.length);
      if(!spriteId){
        return null;
      }
      const meta = markerLabelCompositeStore.get(spriteId);
      if(!meta){
        return null;
      }
      const assets = await ensureMarkerLabelCompositeAssets(targetMap, spriteId, meta);
      if(!assets || !assets.base){
        return null;
      }
      const updatedMeta = markerLabelCompositeStore.get(spriteId) || assets.meta || meta;
      if(isAccent){
        const image = updatedMeta && (updatedMeta.highlightImage || updatedMeta.image);
        if(!image){
          return null;
        }
        return {
          image,
          options: updatedMeta.highlightOptions || updatedMeta.options || {}
        };
      }
      if(updatedMeta && updatedMeta.image){
        return {
          image: updatedMeta.image,
          options: updatedMeta.options || {}
        };
      }
      return null;
    }
    const placeholders = ['mx-federal-5','background','background-stroke','icon','icon-stroke'];
    if(placeholders.includes(id)){
      const size = id === 'mx-federal-5' ? 2 : 4;
      const placeholderOptions = { pixelRatio: 1 };
      if(id !== 'mx-federal-5'){
        placeholderOptions.sdf = true;
      }
      return {
        image: createTransparentPlaceholder(size),
        options: placeholderOptions
      };
    }
    const ensureIcon = options && typeof options.ensureIcon === 'function' ? options.ensureIcon : null;
    if(ensureIcon){
      try{
        await ensureIcon(id);
      }catch(err){
        console.error(err);
      }
      if(targetMap && typeof targetMap.hasImage === 'function'){
        try{
          if(targetMap.hasImage(id)){
            return null;
          }
        }catch(err){
          console.error(err);
        }
      }
    }
    return null;
  }

  async function ensureMarkerLabelComposite(mapInstance, labelSpriteId, iconId, labelLine1, labelLine2, isMulti, options = {}){
    if(!mapInstance || !labelSpriteId){
      return null;
    }
    const { priority = false } = options || {};
    const compositeId = markerLabelCompositeId(labelSpriteId);
    const highlightId = `${compositeId}${MARKER_LABEL_COMPOSITE_ACCENT_SUFFIX}`;
    const meta = markerLabelCompositeStore.get(labelSpriteId) || {};
    meta.iconId = iconId || meta.iconId || '';
    meta.labelLine1 = labelLine1 ?? meta.labelLine1 ?? '';
    meta.labelLine2 = labelLine2 ?? meta.labelLine2 ?? '';
    meta.isMulti = Boolean(isMulti ?? meta.isMulti);
    meta.priority = Boolean(priority);
    meta.lastUsed = nowTimestamp();
    markerLabelCompositeStore.set(labelSpriteId, meta);
    if(mapInstance.hasImage?.(compositeId)){
      if(markerLabelCompositePlaceholderIds.has(compositeId)){
        try{ mapInstance.removeImage(compositeId); }catch(err){}
        markerLabelCompositePlaceholderIds.delete(compositeId);
      } else {
        return compositeId;
      }
    }
    if(markerLabelCompositePlaceholderIds.has(highlightId) && mapInstance.hasImage?.(highlightId)){
      try{ mapInstance.removeImage(highlightId); }catch(err){}
      markerLabelCompositePlaceholderIds.delete(highlightId);
    }
    const assets = await ensureMarkerLabelCompositeAssets(mapInstance, labelSpriteId, meta);
    if(!assets || !assets.base){
      return null;
    }
    const baseComposite = assets.base;
    const highlightComposite = assets.highlight;
    try{
      if(mapInstance.hasImage?.(compositeId)){
        mapInstance.removeImage(compositeId);
      }
      markerLabelCompositePlaceholderIds.delete(compositeId);
      if(mapInstance.hasImage?.(highlightId)){
        mapInstance.removeImage(highlightId);
      }
      markerLabelCompositePlaceholderIds.delete(highlightId);
    }catch(err){
      console.error(err);
    }
    try{
      enforceMarkerLabelCompositeBudget(mapInstance, { keep: [labelSpriteId], reserve: 1 });
      mapInstance.addImage(compositeId, baseComposite.image, baseComposite.options || {});
      markerLabelCompositePlaceholderIds.delete(compositeId);
      if(highlightComposite && highlightComposite.image){
        mapInstance.addImage(highlightId, highlightComposite.image, highlightComposite.options || baseComposite.options || {});
        markerLabelCompositePlaceholderIds.delete(highlightId);
      }
      const updatedMeta = markerLabelCompositeStore.get(labelSpriteId) || meta;
      if(updatedMeta){
        markerLabelCompositeStore.set(labelSpriteId, Object.assign(updatedMeta, {
          image: baseComposite.image,
          options: baseComposite.options,
          highlightImage: highlightComposite ? highlightComposite.image : null,
          highlightOptions: (highlightComposite && highlightComposite.options) || baseComposite.options
        }));
      }
      enforceMarkerLabelCompositeBudget(mapInstance, { keep: [labelSpriteId] });
      return compositeId;
    }catch(err){
      console.error(err);
      return null;
    }
  }

  function reapplyMarkerLabelComposites(mapInstance){
    if(!mapInstance){
      return;
    }
    const entries = [];
    markerLabelCompositeStore.forEach((entry, spriteId) => {
      if(!entry || !entry.image){
        return;
      }
      entries.push({
        spriteId,
        compositeId: markerLabelCompositeId(spriteId),
        image: entry.image,
        options: entry.options || {},
        highlightImage: entry.highlightImage,
        highlightOptions: entry.highlightOptions || entry.options || {},
        priority: Boolean(entry.priority),
        lastUsed: Number.isFinite(entry.lastUsed) ? entry.lastUsed : 0
      });
    });
    entries.sort((a, b) => {
      if(a.priority !== b.priority){
        return a.priority ? -1 : 1;
      }
      if(a.lastUsed !== b.lastUsed){
        return (b.lastUsed || 0) - (a.lastUsed || 0);
      }
      return a.spriteId.localeCompare(b.spriteId);
    });
    entries.forEach(entry => {
      let already = false;
      if(typeof mapInstance.hasImage === 'function'){
        try{ already = !!mapInstance.hasImage(entry.compositeId); }
        catch(err){ already = false; }
      }
      if(already){
        if(markerLabelCompositePlaceholderIds.has(entry.compositeId)){
          try{ mapInstance.removeImage(entry.compositeId); }catch(err){}
          markerLabelCompositePlaceholderIds.delete(entry.compositeId);
          already = false;
        } else {
          return;
        }
      }
      try{
        enforceMarkerLabelCompositeBudget(mapInstance, { keep: [entry.spriteId], reserve: 1 });
        mapInstance.addImage(entry.compositeId, entry.image, entry.options || {});
        markerLabelCompositePlaceholderIds.delete(entry.compositeId);
        if(entry.highlightImage){
          const highlightId = `${entry.compositeId}${MARKER_LABEL_COMPOSITE_ACCENT_SUFFIX}`;
          try{ if(mapInstance.hasImage?.(highlightId)) mapInstance.removeImage(highlightId); }catch(err){}
          try{ mapInstance.addImage(highlightId, entry.highlightImage, entry.highlightOptions || entry.options || {}); }
          catch(err){ console.error(err); }
          markerLabelCompositePlaceholderIds.delete(highlightId);
        }
        enforceMarkerLabelCompositeBudget(mapInstance, { keep: [entry.spriteId] });
      }catch(err){
        console.error(err);
      }
    });
  }

  function scheduleMarkerLabelBackgroundRetry(mapInstance){
    if(!mapInstance || typeof mapInstance === 'undefined') return;
    const mark = '__markerLabelBgRetryScheduled';
    if(mapInstance[mark]) return;
    mapInstance[mark] = true;
    const retry = () => {
      mapInstance[mark] = false;
      try{ ensureMarkerLabelBackground(mapInstance); }catch(err){}
    };
    if(typeof mapInstance.once === 'function'){
      mapInstance.once('style.load', retry);
    } else if(typeof mapInstance.on === 'function'){
      const handler = () => {
        try{ mapInstance.off?.('style.load', handler); }catch(err){}
        retry();
      };
      mapInstance.on('style.load', handler);
    } else {
      setTimeout(retry, 0);
    }
  }

  function ensureMarkerLabelBackground(mapInstance){
    if(!mapInstance || typeof mapInstance.addImage !== 'function') return;
    try{
      if(mapInstance.hasImage && mapInstance.hasImage(MARKER_LABEL_BG_ID)){
        mapInstance.__markerLabelBgRetryScheduled = false;
        return;
      }
    }catch(err){
      scheduleMarkerLabelBackgroundRetry(mapInstance);
      return;
    }
    if(typeof mapInstance.isStyleLoaded === 'function' && !mapInstance.isStyleLoaded()){
      scheduleMarkerLabelBackgroundRetry(mapInstance);
      return;
    }
    const placeholder = document.createElement('canvas');
    try{
      placeholder.width = Math.max(1, Math.round(markerLabelBackgroundWidthPx));
      placeholder.height = Math.max(1, Math.round(markerLabelBackgroundHeightPx));
      const phCtx = placeholder.getContext('2d');
      if(phCtx){
        phCtx.clearRect(0, 0, placeholder.width, placeholder.height);
      }
    }catch(err){
      placeholder.width = 1;
      placeholder.height = 1;
    }
    try{
      mapInstance.addImage(MARKER_LABEL_BG_ID, placeholder, { pixelRatio: 1 });
      mapInstance.__markerLabelBgRetryScheduled = false;
    }catch(err){
      scheduleMarkerLabelBackgroundRetry(mapInstance);
      return;
    }
    try{ window.__addOrReplacePill150x40?.(mapInstance); }catch(err){}
  }

  function patchLayerFiltersForMissingLayer(mapInstance, style){
    if(!mapInstance || typeof mapInstance.setFilter !== 'function') return;
    const layers = style && Array.isArray(style.layers) ? style.layers : [];
    if(!layers.length) return;

    const shouldSkipLayer = (layer) => {
      if(!layer) return true;
      const meta = layer.metadata || {};
      const featureComponent = layer['mapbox:featureComponent'] || meta['mapbox:featureComponent'];
      const featureSet = layer['mapbox:featureset'] || meta['mapbox:featureset'];
      if(featureSet) return true;
      if(typeof featureComponent === 'string' && featureComponent.includes('place-label')) return true;
      if(typeof layer.id === 'string' && layer.id.includes('place-label')) return true;
      if(typeof layer.source === 'string' && layer.source.includes('place-label')) return true;
      return false;
    };

    function patchExpression(expr){
      if(!Array.isArray(expr)){
        return { expr, changed:false };
      }
      const op = expr[0];
      let changed = false;
      const result = expr.map((item, idx) => {
        if(idx === 0) return item;
        const patched = patchExpression(item);
        if(patched.changed) changed = true;
        return patched.expr;
      });

      if((op === 'number' || op === 'to-number') && result.length > 1){
        const target = result[1];
        if(Array.isArray(target)){
          const already = target[0] === 'coalesce'
            && Array.isArray(target[1])
            && target[1][0] === 'get'
            && target[1][1] === 'layer';
          if(!already && target[0] === 'get' && target[1] === 'layer'){
            result[1] = ['coalesce', target, 0];
            changed = true;
          }
        }
      }

      return { expr: result, changed };
    }

    layers.forEach(layer => {
      if(!layer || !layer.id || !layer.filter) return;
      if(shouldSkipLayer(layer)) return;
      try{
        const patched = patchExpression(layer.filter);
        if(!patched.changed) return;
        mapInstance.setFilter(layer.id, patched.expr);
      }catch(err){}
    });
  }

  function patchTerrainSource(mapInstance, style){
    if(!mapInstance || typeof mapInstance.setTerrain !== 'function') return;
    const terrain = style && style.terrain;
    if(!terrain || !terrain.source) return;
    const sources = style.sources || {};
    const originalSource = sources[terrain.source];
    if(!originalSource) return;

    const dedicatedId = 'terrain-dem-dedicated';
    const ensureDedicatedSource = () => {
      if(mapInstance.getSource?.(dedicatedId)) return true;
      try {
        const clone = JSON.parse(JSON.stringify(originalSource));
        mapInstance.addSource(dedicatedId, clone);
        return !!mapInstance.getSource?.(dedicatedId);
      } catch(err){}
      return false;
    };

    const currentTerrain = typeof mapInstance.getTerrain === 'function' ? mapInstance.getTerrain() : null;
    if(currentTerrain && currentTerrain.source === dedicatedId && typeof currentTerrain.cutoff === 'number' && currentTerrain.cutoff > 0){
      return;
    }

    const hasDedicated = ensureDedicatedSource();
    const targetSource = hasDedicated ? dedicatedId : terrain.source;
    const nextTerrain = Object.assign({}, terrain, { source: targetSource });
    if(typeof nextTerrain.cutoff !== 'number' || nextTerrain.cutoff <= 0){
      nextTerrain.cutoff = 0.01;
    }
    try { mapInstance.setTerrain(nextTerrain); } catch(err){}
  }

  function patchMapboxStyleArtifacts(mapInstance){
    if(!mapInstance || typeof mapInstance.getStyle !== 'function') return;
    if(mapInstance.isStyleLoaded && !mapInstance.isStyleLoaded()) return;
    let style;
    try{
      style = mapInstance.getStyle();
    }catch(err){
      return;
    }
    if(!style) return;
    try{ ensurePlaceholderSprites(mapInstance); }catch(err){}
    try{ patchLayerFiltersForMissingLayer(mapInstance, style); }catch(err){}
    try{ patchTerrainSource(mapInstance, style); }catch(err){}
  }

  // Attach pointer cursor only after style is ready, and re-attach if style changes later.
  function armPointerOnSymbolLayers(map){
    const POINTER_READY_IDS = new Set([
      'marker-label',
      'marker-label-highlight',
      'post-balloons'
    ]);

    function shouldAttachPointer(layer){
      if (!layer || layer.type !== 'symbol') return false;
      if (POINTER_READY_IDS.has(layer.id)) return true;
      if (typeof layer.source === 'string' && layer.source === 'posts') return true;
      if (layer.metadata && layer.metadata.cursor === 'pointer') return true;
      return false;
    }

    function attach(){
      if (!map.getStyle || !map.isStyleLoaded || !map.isStyleLoaded()) return;
      const st = map.getStyle();
      if (!st || !st.layers) return;

      map.__cursorArmed = map.__cursorArmed || new Set();
      st.layers.forEach(l => {
        if (!shouldAttachPointer(l) || map.__cursorArmed.has(l.id)) return;
        map.on('mouseenter', l.id, () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', l.id, () => map.getCanvas().style.cursor = 'grab');
        map.__cursorArmed.add(l.id);
      });
    }

    // First time once the style is fully loaded
    whenStyleReady(map, attach);

    // If the style changes later, reattach *after* the new style finishes
    map.on('styledata', () => {
      if (map.isStyleLoaded && map.isStyleLoaded()) attach();
    });
  }
  const callWhenDefined = window.callWhenDefined || function(name, invoke, timeoutMs){
    const start = performance.now(), max = timeoutMs ?? 5000;
    (function wait(){
      const fn = window[name];
      if (typeof fn === 'function') {
        try { invoke(fn); } catch(e){}
        return;
      }
      if (performance.now() - start < max) requestAnimationFrame(wait);
    })();
  };
  window.callWhenDefined = window.callWhenDefined || callWhenDefined;

  let startPitch, startBearing, logoEls = [], geocoder;
  const LEGACY_DEFAULT_PITCH = 0;
  const geocoders = [];
  let lastGeocoderProximity = null;

  function setAllGeocoderProximity(lng, lat){
    if(!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    // Temporarily disable proximity biasing to broaden search results.
    lastGeocoderProximity = null;
  }

  function syncGeocoderProximityToMap(){
    if(!map || typeof map.getCenter !== 'function') return;
    try{
      const center = map.getCenter();
      if(center && Number.isFinite(center.lng) && Number.isFinite(center.lat)){
        setAllGeocoderProximity(center.lng, center.lat);
      }
    }catch(err){}
  }
  const CARD_SURFACE = 'linear-gradient(rgba(0,0,0,0.8),rgba(0,0,0,0.6))';
  const CARD_HIGHLIGHT = '#2e3a72';
  const MapRegistry = {
    list: [],
    limit: 4,
    register(map){
      if(!map) return;
      if(this.list.includes(map)) return;
      this.list.push(map);
      if(typeof map.once === 'function'){
        map.once('remove', () => {
          this.list = this.list.filter(m => m !== map);
        });
      }
      if(this.list.length > this.limit){
        const victim = this.list.shift();
        try{ victim && typeof victim.remove === 'function' && victim.remove(); }catch(err){}
      }
    }
  };

  function getGeocoderInput(gc){
    if(!gc) return null;
    if(gc._inputReference) return gc._inputReference;
    if(gc._inputEl) return gc._inputEl;
    if(gc._container) return gc._container.querySelector('input[type="text"]');
    return null;
  }

  function blurAllGeocoderInputs(){
    geocoders.forEach(gc => {
      const input = getGeocoderInput(gc);
      if(input && typeof input.blur === 'function'){
        input.blur();
      }
    });
  }

  function clearMapGeocoder(){
    if(!geocoder || typeof geocoder.clear !== 'function') return;
    const before = document.activeElement;
    geocoder.clear();
    const after = document.activeElement;
    requestAnimationFrame(() => {
      [after, before, getGeocoderInput(geocoder)].forEach(el => {
        if(el && el.classList && el.classList.contains('mapboxgl-ctrl-geocoder--input') && typeof el.blur === 'function'){
          el.blur();
        }
      });
      blurAllGeocoderInputs();
    });
  }

  function closeWelcomeModalIfOpen(){
    const welcome = document.getElementById('welcome-modal');
    if(welcome && welcome.classList.contains('show')){
      closePanel(welcome);
    }
  }

  function loadHistory(){ 
    try{ 
      const historyStr = localStorage.getItem('openHistoryV2');
      if(!historyStr) return [];
      return JSON.parse(historyStr);
    }catch(e){ 
      console.error('Failed to load history:', e);
      return [];
    } 
  }
  window.loadHistory = loadHistory;

  (function(){
    const MAPBOX_TOKEN = "pk.eyJ1IjoienhlbiIsImEiOiJjbWViaDRibXEwM2NrMm1wcDhjODg4em5iIn0.2A9teACgwpiCy33uO4WZJQ";
    window.MAPBOX_TOKEN = MAPBOX_TOKEN;

    let mode = localStorage.getItem('mode') || 'map';
    window.mode = mode;
    const DEFAULT_SPIN_SPEED = 0.3;
    // Welcome message will be loaded from DB

    const firstVisit = !localStorage.getItem('hasVisited');
    localStorage.setItem('hasVisited','1');
    if(firstVisit){
      mode = 'map';
      localStorage.setItem('mode','map');
      localStorage.setItem('historyActive','false');
      ['filterPanel','memberPanel','adminPanel'].forEach(id => {
        localStorage.setItem(`panel-open-${id}`,'false');
      });
    }
    // Only use saved view if valid - no random fallback
    let savedView = null;
    try{
      const savedViewStr = localStorage.getItem('mapView');
      if(savedViewStr){
        savedView = JSON.parse(savedViewStr);
      }
    }catch(err){
      console.error('Failed to parse saved map view:', err);
      // Don't use fallback - will need to get center from backend or show error
    }

    if(savedView && typeof savedView === 'object'){
      savedView.bearing = 0;
      try{ localStorage.setItem('mapView', JSON.stringify(savedView)); }catch(err){
        console.error('Failed to save map view:', err);
      }
    }

    // Map center is a UI preference - use sensible default if not available, but log it
    let startCenter;
    let startZoom;
    if(savedView && savedView.center && Array.isArray(savedView.center) && savedView.center.length === 2){
      startCenter = savedView.center;
      startZoom = savedView.zoom || 1.5;
    } else {
      // No saved view - use sensible default (center of world map) but log it
      console.warn('No saved map view found - using default center. This is expected on first visit.');
      startCenter = [0, 0]; // Center of world map - sensible default
      startZoom = 1.5;
    }
    window.startCenter = startCenter;
    // Save this default so it's available next time
    try{
      const defaultView = { center: startCenter, zoom: startZoom, bearing: 0 };
      localStorage.setItem('mapView', JSON.stringify(defaultView));
    }catch(err){
      console.error('Failed to save default map view:', err);
    }
    let lastKnownZoom = startZoom;
    window.lastKnownZoom = lastKnownZoom;
    // Keep lastKnownZoom in sync via getter/setter
    Object.defineProperty(window, 'lastKnownZoom', {
      get: () => lastKnownZoom,
      set: (val) => { lastKnownZoom = val; },
      configurable: true
    });
    window.startZoom = startZoom;
    const hasSavedPitch = typeof savedView?.pitch === 'number';
    const initialPitch = hasSavedPitch ? savedView.pitch : LEGACY_DEFAULT_PITCH;
    startPitch = window.startPitch = initialPitch;
    startBearing = window.startBearing = 0;

      let map, spinning = false, historyWasActive = localStorage.getItem('historyActive') === 'true', expiredWasOn = false, dateStart = null, dateEnd = null,
          spinLoadStart = false,
          spinLoadType = 'everyone',
          spinLogoClick = true,
          spinZoomMax = 4,
          spinSpeed = 0.3,
          spinEnabled = false,
          mapStyle = window.mapStyle = 'mapbox://styles/mapbox/standard';
      
      // Load admin settings from database
      (async function loadAdminSettings(){
        try {
          const response = await fetch('/gateway.php?action=get-admin-settings', {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
          });
          if(response.ok){
            const data = await response.json();
            if(data.success && data.settings){
              // Update the local variables directly first
              spinLoadStart = data.settings.spin_on_load || false;
              spinLoadType = data.settings.spin_load_type || 'everyone';
              spinLogoClick = data.settings.spin_on_logo !== undefined ? data.settings.spin_on_logo : true;
              spinZoomMax = data.settings.spin_zoom_max || 4;
              spinSpeed = data.settings.spin_speed || 0.3;
              
              // Store icon folder path globally
              window.iconFolder = data.settings.icon_folder || 'assets/icons-30';
              window.adminIconFolder = data.settings.admin_icon_folder || 'assets/admin-icons';
              
              // Store post mode shadow and console filter settings
              if(data.settings.post_mode_shadow !== undefined){
                localStorage.setItem('post_mode_shadow', data.settings.post_mode_shadow);
              }
              if(data.settings.console_filter !== undefined){
                localStorage.setItem('enableConsoleFilter', data.settings.console_filter ? 'true' : 'false');
              }
              
              // Store message category names and icons
              ['user', 'member', 'admin', 'email'].forEach(key => {
                if(data.settings[`msg_category_${key}_name`]){
                  localStorage.setItem(`msg_category_${key}_name`, data.settings[`msg_category_${key}_name`]);
                }
                if(data.settings[`msg_category_${key}_icon`]){
                  localStorage.setItem(`msg_category_${key}_icon`, data.settings[`msg_category_${key}_icon`]);
                }
              });
              
              // Calculate if spin should be enabled
              const shouldSpin = spinLoadStart && (spinLoadType === 'everyone' || (spinLoadType === 'new_users' && firstVisit));
              spinEnabled = shouldSpin;
              
              // Apply the state immediately
              if(shouldSpin){
                if(typeof startSpin === 'function') startSpin();
              } else {
                if(typeof stopSpin === 'function') stopSpin();
              }
              
              // Update logo click state
              if(typeof updateLogoClickState === 'function') updateLogoClickState();
              
              // Initialize UI controls with database values
              const spinLoadStartCheckbox = document.getElementById('spinLoadStart');
              const spinTypeRadios = document.querySelectorAll('input[name="spinType"]');
              const spinLogoClickCheckbox = document.getElementById('spinLogoClick');
              const spinZoomMaxInput = document.getElementById('spinZoomMax');
              
              if(spinLoadStartCheckbox){
                spinLoadStartCheckbox.checked = spinLoadStart;
              }
              if(spinTypeRadios.length){
                spinTypeRadios.forEach(radio => {
                  radio.checked = (radio.value === spinLoadType);
                });
              }
              if(spinLogoClickCheckbox){
                spinLogoClickCheckbox.checked = spinLogoClick;
              }
              const spinZoomMaxSlider = document.getElementById('spinZoomMax');
              const spinZoomMaxDisplay = document.getElementById('spinZoomMaxDisplay');
              if(spinZoomMaxSlider && spinZoomMaxDisplay){
                spinZoomMaxSlider.value = spinZoomMax;
                spinZoomMaxDisplay.textContent = spinZoomMax;
              }
              const spinSpeedSlider = document.getElementById('spinSpeed');
              const spinSpeedDisplay = document.getElementById('spinSpeedDisplay');
              if(spinSpeedSlider && spinSpeedDisplay){
                spinSpeedSlider.value = spinSpeed;
                spinSpeedDisplay.textContent = spinSpeed.toFixed(1);
              }
              
              // Initialize icon folder input
              const iconFolderInput = document.getElementById('adminIconFolder');
              if(iconFolderInput){
                iconFolderInput.value = window.iconFolder;
              }
              
              // Initialize admin icon folder input
              const adminIconFolderInput = document.getElementById('adminAdminIconFolder');
              if(adminIconFolderInput){
                adminIconFolderInput.value = window.adminIconFolder || 'assets/admin-icons';
              }
              
              // Initialize general website settings
              const websiteNameInput = document.getElementById('adminWebsiteName');
              if(websiteNameInput && data.settings.site_name){
                websiteNameInput.value = data.settings.site_name;
              }
              
              const websiteTaglineInput = document.getElementById('adminWebsiteTagline');
              if(websiteTaglineInput && data.settings.site_tagline){
                websiteTaglineInput.value = data.settings.site_tagline;
              }
              
              const websiteCurrencyInput = document.getElementById('adminWebsiteCurrency');
              if(websiteCurrencyInput && data.settings.site_currency){
                websiteCurrencyInput.value = data.settings.site_currency;
              }
              
              const contactEmailInput = document.getElementById('adminContactEmail');
              if(contactEmailInput && data.settings.contact_email){
                contactEmailInput.value = data.settings.contact_email;
              }
              
              const supportEmailInput = document.getElementById('adminSupportEmail');
              if(supportEmailInput && data.settings.support_email){
                supportEmailInput.value = data.settings.support_email;
              }
              
              const maintenanceModeCheckbox = document.getElementById('adminMaintenanceMode');
              if(maintenanceModeCheckbox){
                maintenanceModeCheckbox.checked = data.settings.maintenance_mode === true || data.settings.maintenance_mode === 'true';
              }
              
              const welcomeEnabledCheckbox = document.getElementById('adminWelcomeEnabled');
              if(welcomeEnabledCheckbox){
                welcomeEnabledCheckbox.checked = data.settings.welcome_enabled !== false && data.settings.welcome_enabled !== 'false';
              }
              
              // Initialize console filter checkbox
              const consoleFilterCheckbox = document.getElementById('adminEnableConsoleFilter');
              if(consoleFilterCheckbox){
                // Track if we're programmatically setting the checkbox (to avoid triggering change event)
                let isSettingProgrammatically = false;
                const savedState = localStorage.getItem('enableConsoleFilter') === 'true';
                isSettingProgrammatically = true;
                consoleFilterCheckbox.checked = savedState;
                isSettingProgrammatically = false;
                
                consoleFilterCheckbox.addEventListener('change', async (event) => {
                  // Skip if this change was programmatic
                  if(isSettingProgrammatically){
                    return;
                  }
                  
                  // Only show prompt for user-initiated events (not programmatic changes)
                  // event.isTrusted is false for programmatic changes
                  if(event.isTrusted === false){
                    return;
                  }
                  
                  const enabled = consoleFilterCheckbox.checked;
                  localStorage.setItem('enableConsoleFilter', enabled ? 'true' : 'false');
                  
                  // Auto-save to database
                  try {
                    await fetch('/gateway.php?action=save-admin-settings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ console_filter: enabled })
                    });
                  } catch (e) {
                    console.error('Failed to save console filter setting:', e);
                  }
                  
                  // Show reload prompt only for user-initiated changes
                  const messageKey = enabled ? 'msg_confirm_console_filter_enable' : 'msg_confirm_console_filter_disable';
                  (async () => {
                    const message = await getMessage(messageKey, {}, true) || (enabled 
                      ? 'Console filter will be enabled on next page load. Reload now?' 
                      : 'Console filter will be disabled on next page load. Reload now?');
                    if(confirm(message)){
                      location.reload();
                    }
                  })();
                });
              }
            }
          }
        } catch(err){
          console.error('Failed to load admin settings from database:', err);
          // Don't use defaults - error should be visible
          // You may want to show an error message in the UI here
          throw err; // Or handle the error appropriately without using defaults
        }
      })();
      let markersLoaded = false;
      window.__markersLoaded = false;
      // Keep markersLoaded in sync via getter/setter
      Object.defineProperty(window, 'markersLoaded', {
        get: () => markersLoaded,
        set: (val) => { markersLoaded = val; window.__markersLoaded = val; },
        configurable: true
      });
      const MARKER_ZOOM_THRESHOLD = 8;
      window.MARKER_ZOOM_THRESHOLD = MARKER_ZOOM_THRESHOLD;
      const MARKER_SPRITE_ZOOM = MARKER_SPRITE_RETAIN_ZOOM;
      window.MARKER_SPRITE_ZOOM = MARKER_SPRITE_ZOOM;
      const ZOOM_VISIBILITY_PRECISION = 1000;
      const MARKER_VISIBILITY_BUCKET = Math.round(MARKER_ZOOM_THRESHOLD * ZOOM_VISIBILITY_PRECISION);
      const MARKER_PRELOAD_OFFSET = 0.2;
      const MARKER_PRELOAD_ZOOM = Math.max(MARKER_ZOOM_THRESHOLD - MARKER_PRELOAD_OFFSET, 0);
      window.MARKER_PRELOAD_ZOOM = MARKER_PRELOAD_ZOOM;
      const MARKER_LAYER_IDS = [
        'hover-fill',
        'marker-label',
        'marker-label-highlight'
      ];
      const ALL_MARKER_LAYER_IDS = [...MARKER_LAYER_IDS];
      const MID_ZOOM_MARKER_CLASS = 'map--midzoom-markers';
      const SPRITE_MARKER_CLASS = 'map--sprite-markers';
        const BALLOON_SOURCE_ID = 'post-balloon-source';
        const BALLOON_LAYER_ID = 'post-balloons';
        const BALLOON_LAYER_IDS = [BALLOON_LAYER_ID];
        const BALLOON_IMAGE_ID = 'seed-balloon-icon';
        const BALLOON_IMAGE_URL = 'assets/balloons/balloons-icon-16181-60.png';
        const BALLOON_MIN_ZOOM = 0;
        const BALLOON_MAX_ZOOM = MARKER_ZOOM_THRESHOLD;
        let balloonLayersVisible = true;

        function ensureBalloonIconImage(mapInstance){
          return new Promise(resolve => {
            if(!mapInstance || typeof mapInstance.hasImage !== 'function'){
              resolve();
              return;
            }
            if(mapInstance.hasImage(BALLOON_IMAGE_ID)){
              resolve();
              return;
            }
            const handleImage = (image)=>{
              if(!image){
                resolve();
                return;
              }
              try{
                if(!mapInstance.hasImage(BALLOON_IMAGE_ID) && image.width > 0 && image.height > 0){
                  const pixelRatio = image.width >= 256 ? 2 : 1;
                  mapInstance.addImage(BALLOON_IMAGE_ID, image, { pixelRatio });
                }
              }catch(err){ console.error(err); }
              resolve();
            };
            try{
              if(typeof mapInstance.loadImage === 'function'){
                mapInstance.loadImage(BALLOON_IMAGE_URL, (err, image)=>{
                  if(err){ console.error(err); resolve(); return; }
                  handleImage(image);
                });
                return;
              }
            }catch(err){ console.error(err); resolve(); return; }
            if(typeof Image !== 'undefined'){
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = ()=>handleImage(img);
              img.onerror = ()=>resolve();
              img.src = BALLOON_IMAGE_URL;
              return;
            }
            resolve();
          });
        }

        function formatBalloonCount(count){
          if(!Number.isFinite(count) || count <= 0){
            return '0';
          }
          if(count >= 1000000){
            const value = count / 1000000;
            const formatted = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
            return `${formatted}m`;
          }
          if(count >= 1000){
            const value = count / 1000;
            const formatted = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
            return `${formatted}k`;
          }
          return String(count);
        }

        function getBalloonGridSize(zoom){
          const z = Number.isFinite(zoom) ? zoom : 0;
          if(z >= 7.5) return 0.5;
          if(z >= 6) return 1;
          if(z >= 4) return 2.5;
          if(z >= 2) return 5;
          return 10;
        }

        const clampBalloonLat = (lat)=> Math.max(-85, Math.min(85, lat));

        function groupPostsForBalloonZoom(postsSource, zoom){
          const gridSizeRaw = getBalloonGridSize(zoom);
          const gridSize = gridSizeRaw > 0 ? gridSizeRaw : 5;
          const groups = new Map();
          postsSource.forEach(post => {
            if(!post || !Number.isFinite(post.lng) || !Number.isFinite(post.lat)) return;
            const lng = Number(post.lng);
            const lat = clampBalloonLat(Number(post.lat));
            const col = Math.floor((lng + 180) / gridSize);
            const row = Math.floor((lat + 90) / gridSize);
            const key = `${col}|${row}`;
            let bucket = groups.get(key);
            if(!bucket){
              bucket = { count:0, sumLng:0, sumLat:0, posts: [] };
              groups.set(key, bucket);
            }
            bucket.count += 1;
            bucket.sumLng += lng;
            bucket.sumLat += lat;
            bucket.posts.push(post);
          });
          return { groups };
        }

        let lastBalloonGroupingDetails = { key: null, zoom: null, groups: new Map() };

        function buildBalloonFeatureCollection(zoom){
          const allowInitialize = true; // ensure balloons have data even before marker zoom threshold
          const postsSource = getAllPostsCache({ allowInitialize });
          if(!Array.isArray(postsSource) || postsSource.length === 0){
            const emptyGroups = new Map();
            const groupingKey = getBalloonBucketKey(zoom);
            lastBalloonGroupingDetails = { key: groupingKey, zoom, groups: emptyGroups };
            return { type:'FeatureCollection', features: [] };
          }
          const { groups } = groupPostsForBalloonZoom(postsSource, zoom);
          const features = [];
          groups.forEach((bucket, key) => {
            if(!bucket || bucket.count <= 0) return;
            const avgLng = bucket.sumLng / bucket.count;
            const avgLat = bucket.sumLat / bucket.count;
            features.push({
              type:'Feature',
              properties:{
                count: bucket.count,
                label: formatBalloonCount(bucket.count),
                bucket: key
              },
              geometry:{ type:'Point', coordinates:[avgLng, avgLat] }
            });
          });
          const groupingKey = getBalloonBucketKey(zoom);
          lastBalloonGroupingDetails = { key: groupingKey, zoom, groups };
          return { type:'FeatureCollection', features };
        }

        function computeChildBalloonTarget(bucket, currentZoom, maxAllowedZoom){
          if(!bucket || !Array.isArray(bucket.posts) || bucket.posts.length <= 1){
            return null;
          }
          const safeCurrent = Number.isFinite(currentZoom) ? currentZoom : 0;
          const safeMax = Number.isFinite(maxAllowedZoom) ? maxAllowedZoom : safeCurrent;
          if(!(safeMax > safeCurrent)){
            return null;
          }
          const step = 0.25;
          const maxIterations = Math.max(1, Math.ceil((safeMax - safeCurrent) / step) + 1);
          for(let i=0;i<maxIterations;i++){
            const candidateZoom = Math.min(safeMax, safeCurrent + (i + 1) * step);
            if(!(candidateZoom > safeCurrent)){
              continue;
            }
            const { groups } = groupPostsForBalloonZoom(bucket.posts, candidateZoom);
            const childBuckets = Array.from(groups.values()).filter(child => child && child.count > 0);
            if(childBuckets.length <= 1){
              continue;
            }
            let totalCount = 0;
            let sumLng = 0;
            let sumLat = 0;
            childBuckets.forEach(child => {
              const childCenterLng = child.sumLng / child.count;
              const childCenterLat = child.sumLat / child.count;
              totalCount += child.count;
              sumLng += childCenterLng * child.count;
              sumLat += childCenterLat * child.count;
            });
            if(totalCount <= 0){
              continue;
            }
            return {
              center: [sumLng / totalCount, sumLat / totalCount],
              zoom: candidateZoom
            };
          }
          return null;
        }

        let lastBalloonBucketKey = null;

        function getBalloonBucketKey(zoom){
          const size = getBalloonGridSize(zoom);
          return Number.isFinite(size) ? size.toFixed(2) : 'default';
        }

        function updateBalloonSourceForZoom(zoom){
          if(!map) return;
          const source = map.getSource && map.getSource(BALLOON_SOURCE_ID);
          if(!source || typeof source.setData !== 'function') return;
          const zoomValue = Number.isFinite(zoom) ? zoom : (typeof map.getZoom === 'function' ? map.getZoom() : 0);
          const bucketKey = getBalloonBucketKey(zoomValue);
          if(lastBalloonBucketKey === bucketKey) return;
          try{
            const data = buildBalloonFeatureCollection(zoomValue);
            source.setData(data);
            lastBalloonBucketKey = bucketKey;
          }catch(err){ console.error(err); }
        }
        // Expose on window for admin.js access (after function is fully defined)
        window.updateBalloonSourceForZoom = updateBalloonSourceForZoom;

        function resetBalloonSourceState(){
          lastBalloonBucketKey = null;
          lastBalloonGroupingDetails = { key: null, zoom: null, groups: new Map() };
        }

        function setupSeedLayers(mapInstance){
          if(!mapInstance) return;
          // Ensure balloon layers are ready even at low zoom on initial load
          const currentZoom = typeof mapInstance.getZoom === 'function' ? mapInstance.getZoom() : 0;
          if(!Number.isFinite(currentZoom)){
            if(!mapInstance.__seedLayerZoomGate){
              const handleZoomGate = ()=>{
                const readyZoom = typeof mapInstance.getZoom === 'function' ? mapInstance.getZoom() : 0;
                if(Number.isFinite(readyZoom)){
                  mapInstance.off('zoomend', handleZoomGate);
                  mapInstance.__seedLayerZoomGate = null;
                  setupSeedLayers(mapInstance);
                }
              };
              mapInstance.__seedLayerZoomGate = handleZoomGate;
              mapInstance.on('zoomend', handleZoomGate);
            }
            return;
          }
          if(mapInstance.__seedLayerZoomGate){
            mapInstance.off('zoomend', mapInstance.__seedLayerZoomGate);
            mapInstance.__seedLayerZoomGate = null;
          }
          ensureBalloonIconImage(mapInstance).then(()=>{
            try{
              if(mapInstance.getLayer(BALLOON_LAYER_ID)) mapInstance.removeLayer(BALLOON_LAYER_ID);
            }catch(err){ console.error(err); }

            let balloonSource = null;
            try{
              balloonSource = mapInstance.getSource && mapInstance.getSource(BALLOON_SOURCE_ID);
            }catch(err){ balloonSource = null; }
            const emptyData = (typeof EMPTY_FEATURE_COLLECTION !== 'undefined') ? EMPTY_FEATURE_COLLECTION : { type:'FeatureCollection', features: [] };
            try{
              if(balloonSource && typeof balloonSource.setData === 'function'){
                balloonSource.setData(emptyData);
              } else {
                if(balloonSource){
                  try{ mapInstance.removeSource(BALLOON_SOURCE_ID); }catch(removeErr){ console.error(removeErr); }
                }
                mapInstance.addSource(BALLOON_SOURCE_ID, { type:'geojson', data: emptyData });
              }
            }catch(err){ console.error(err); }

            try{
              mapInstance.addLayer({
                id: BALLOON_LAYER_ID,
                type: 'symbol',
                source: BALLOON_SOURCE_ID,
                minzoom: BALLOON_MIN_ZOOM,
                maxzoom: BALLOON_MAX_ZOOM,
                layout: {
                  'icon-image': BALLOON_IMAGE_ID,
                  'icon-size': ['interpolate', ['linear'], ['zoom'], 0, 0.4, 7.5, 1],
                  'icon-allow-overlap': true,
                  'icon-ignore-placement': true,
                  'icon-anchor': 'bottom',
                  'text-field': ['to-string', ['coalesce', ['get','label'], ['get','count']]],
                  'text-size': 12,
                  'text-offset': [0, -1.35],
                  'text-font': ['Open Sans Bold','Arial Unicode MS Bold'],
                  'text-allow-overlap': true,
                  'text-ignore-placement': true,
                  'symbol-z-order': 'viewport-y',
                  'symbol-sort-key': 900
                },
                paint: {
                  'text-color': '#ffffff',
                  'text-halo-color': 'rgba(0,0,0,0.45)',
                  'text-halo-width': 1.2,
                  'icon-opacity': 0.95
                },
                metadata:{ cursor:'pointer' }
              });
            }catch(err){ console.error(err); }

            resetBalloonSourceState();
            const currentZoomValue = mapInstance.getZoom ? mapInstance.getZoom() : BALLOON_MIN_ZOOM;
            updateBalloonSourceForZoom(currentZoomValue);
            const shouldShow = Number.isFinite(currentZoomValue) ? currentZoomValue < BALLOON_MAX_ZOOM : true;
            try{
              mapInstance.setLayoutProperty(BALLOON_LAYER_ID, 'visibility', shouldShow ? 'visible' : 'none');
            }catch(err){}
            balloonLayersVisible = shouldShow;
          });

          if(!mapInstance.__seedBalloonEventsBound){
            const handleBalloonClick = (e)=>{
              if(e && typeof e.preventDefault === 'function') e.preventDefault();
              const feature = e && e.features && e.features[0];
              if(!feature) return;
              const coords = feature.geometry && feature.geometry.coordinates;
              if(!Array.isArray(coords) || coords.length < 2) return;
              const currentZoom = typeof mapInstance.getZoom === 'function' ? mapInstance.getZoom() : 0;
              const maxZoom = typeof mapInstance.getMaxZoom === 'function' ? mapInstance.getMaxZoom() : 22;
              const maxAllowedZoom = Number.isFinite(maxZoom)
                ? Math.min(maxZoom, BALLOON_MAX_ZOOM)
                : BALLOON_MAX_ZOOM;
              const safeCurrentZoom = Number.isFinite(currentZoom) ? currentZoom : 0;
              const bucketKey = feature.properties && feature.properties.bucket;
              const grouping = lastBalloonGroupingDetails && lastBalloonGroupingDetails.groups instanceof Map
                ? lastBalloonGroupingDetails.groups
                : null;
              const bucketData = grouping && bucketKey ? grouping.get(bucketKey) : null;
              const childZoomLimit = Number.isFinite(maxZoom)
                ? Math.min(maxZoom, Math.max(maxAllowedZoom, 12))
                : 12;
              const childTarget = computeChildBalloonTarget(bucketData, safeCurrentZoom, childZoomLimit);
              const hasChildTarget = childTarget && Array.isArray(childTarget.center) && childTarget.center.length >= 2;
              const targetCenter = hasChildTarget
                ? [childTarget.center[0], childTarget.center[1]]
                : [coords[0], coords[1]];
              const desiredLeafZoom = Number.isFinite(maxZoom) ? Math.min(12, maxZoom) : 12;
              let finalZoom;
              if(hasChildTarget){
                const childZoom = childTarget && Number.isFinite(childTarget.zoom)
                  ? Math.min(childTarget.zoom, childZoomLimit)
                  : NaN;
                finalZoom = Number.isFinite(childZoom) ? childZoom : safeCurrentZoom;
                if(finalZoom < safeCurrentZoom){
                  finalZoom = safeCurrentZoom;
                }
              } else {
                finalZoom = Number.isFinite(desiredLeafZoom) ? desiredLeafZoom : safeCurrentZoom;
                if(finalZoom < safeCurrentZoom){
                  finalZoom = safeCurrentZoom;
                }
              }
              if(!Number.isFinite(finalZoom)){
                finalZoom = safeCurrentZoom;
              }
              let currentPitch = null;
              try{
                currentPitch = typeof mapInstance.getPitch === 'function' ? mapInstance.getPitch() : null;
              }catch(err){
                currentPitch = null;
              }
              try{
                const flight = { center: targetCenter, zoom: finalZoom, essential: true };
                if(Number.isFinite(currentPitch)){
                  flight.pitch = currentPitch;
                }
                if(typeof mapInstance.flyTo === 'function'){
                  mapInstance.flyTo(Object.assign({}, flight, {
                    speed: 1.35,
                    curve: 1.5,
                    easing: t => 1 - Math.pow(1 - t, 3)
                  }));
                } else {
                  mapInstance.easeTo(Object.assign({}, flight, { duration: 650, easing: t => 1 - Math.pow(1 - t, 3) }));
                }
              }catch(err){ console.error(err); }
            };
            mapInstance.on('click', BALLOON_LAYER_ID, handleBalloonClick);
            mapInstance.on('mouseenter', BALLOON_LAYER_ID, ()=>{ mapInstance.getCanvas().style.cursor = 'pointer'; });
            mapInstance.on('mouseleave', BALLOON_LAYER_ID, ()=>{ mapInstance.getCanvas().style.cursor = 'grab'; });
            mapInstance.__seedBalloonEventsBound = true;
          }
          if(mapInstance === map){
            updateLayerVisibility(lastKnownZoom);
          }
        }
        // Expose on window for admin.js access (after function is fully defined)
        window.setupSeedLayers = setupSeedLayers;
        localStorage.setItem('spinGlobe', JSON.stringify(spinEnabled));
        logoEls = [document.querySelector('.logo')].filter(Boolean);
        let ensureMapIcon = null;
        window.ensureMapIcon = ensureMapIcon;
      function updateLogoClickState(){
        logoEls.forEach(el=>{
          el.style.cursor = 'pointer';
          el.style.pointerEvents = 'auto';
        });
      }
      window.updateLogoClickState = updateLogoClickState;
      updateLogoClickState();

      async function openWelcome(){
        const popup = document.getElementById('welcome-modal');
        const msgEl = document.getElementById('welcomeMessageBox');
        const titleEl = document.getElementById('welcomeTitle');
        
        // Load welcome messages from DB
        const welcomeBody = await getMessage('msg_welcome_body', {}, false) || '<p>Welcome to Funmap! Choose an area on the map to search for events and listings. Click the <svg class="icon-search" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" role="img" aria-label="Filters"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> button to refine your search.</p>';
        const welcomeTitle = await getMessage('msg_welcome_title', {}, false) || 'Welcome to FunMap';
        
        msgEl.innerHTML = welcomeBody;
        if(titleEl) titleEl.textContent = welcomeTitle;
        openPanel(popup);
        const body = document.getElementById('welcomeBody');
        body.style.padding = '20px';
      }
      window.openWelcome = openWelcome;

      function toggleWelcome(){
        const popup = document.getElementById('welcome-modal');
        if(popup.classList.contains('show')){
          closePanel(popup);
        } else {
          openWelcome();
        }
      }

      logoEls.forEach(el=>{
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          if(spinning){
            toggleWelcome();
            return;
          }
          if(spinLogoClick && map && map.getZoom() <= spinZoomMax){
            spinEnabled = true;
            localStorage.setItem('spinGlobe', 'true');
            startSpin(true);
          }
          toggleWelcome();
        });
      });
    // 'Post Panel' is defined as the current map bounds
    let postPanel = null;
    let posts = [], filtered = [], adPosts = [], adIndex = -1, adTimer = null, adPanel = null, adIdsKey = '', pendingPostLoad = false;
    window.pendingPostLoad = pendingPostLoad;
    let filtersInitialized = false;
    // Expose posts, filtered, and filtersInitialized globally for admin.js access
    Object.defineProperty(window, 'posts', {
      get: () => posts,
      set: (val) => { posts = val; },
      configurable: true
    });
    Object.defineProperty(window, 'filtered', {
      get: () => filtered,
      set: (val) => { filtered = val; },
      configurable: true
    });
    Object.defineProperty(window, 'filtersInitialized', {
      get: () => filtersInitialized,
      set: (val) => { filtersInitialized = val; },
      configurable: true
    });
    let favToTop = false, favSortDirty = true, currentSort = 'az';
    let selection = window.selection = window.selection || { cats: new Set(), subs: new Set() };
    let viewHistory = loadHistory();
    window.viewHistory = viewHistory;
    let hoverPopup = null;
    let postSourceEventsBound = false;
    let touchMarker = null;
    let activePostId = null;
    let markerFeatureIndex = new Map();
    // Expose markerFeatureIndex globally for admin.js access
    Object.defineProperty(window, 'markerFeatureIndex', {
      get: () => markerFeatureIndex,
      set: (val) => { markerFeatureIndex = val; },
      configurable: true
    });
    let lastHighlightedPostIds = [];
    let highlightedFeatureKeys = [];
    const hoverHighlightedPostIds = new Set();
    function updateMapFeatureHighlights(targets){
      const input = Array.isArray(targets) ? targets : [targets];
      const seen = new Set();
      const normalized = [];
      const highlightSpriteIds = new Set();
      input.forEach(entry => {
        if(entry === undefined || entry === null) return;
        let idValue;
        let venueKeyValue = null;
        if(typeof entry === 'object' && !Array.isArray(entry)){
          const rawId = entry.id ?? entry.postId ?? entry.postID ?? entry.postid;
          if(rawId === undefined || rawId === null) return;
          idValue = String(rawId);
          const rawVenue = entry.venueKey ?? entry.venue_key ?? entry.venue;
          if(rawVenue !== undefined && rawVenue !== null){
            const venueString = String(rawVenue).trim();
            if(venueString){
              venueKeyValue = venueString;
            }
          }
        } else {
          idValue = String(entry);
        }
        if(!idValue) return;
        const dedupeKey = venueKeyValue ? `${idValue}::${venueKeyValue}` : idValue;
        if(seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        normalized.push({ id: idValue, venueKey: venueKeyValue });
      });
      lastHighlightedPostIds = normalized.map(item => ({ id: item.id, venueKey: item.venueKey }));
      if(!map || typeof map.setFeatureState !== 'function'){
        if(!normalized.length){
          highlightedFeatureKeys = [];
        }
        return;
      }
      if(!normalized.length){
        highlightedFeatureKeys.forEach(entry => {
          try{ map.setFeatureState({ source: entry.source, id: entry.id }, { isHighlighted: false }); }
          catch(err){}
        });
        highlightedFeatureKeys = [];
        return;
      }
      const nextEntries = [];
      const nextKeys = new Set();
      const extractVenueFromId = (featureId)=>{
        if(typeof featureId !== 'string') return '';
        const parts = featureId.split('::');
        return parts.length >= 3 ? String(parts[1] || '') : '';
      };
      normalized.forEach(target => {
        if(!target || !target.id) return;
        const entries = window.markerFeatureIndex instanceof Map ? window.markerFeatureIndex.get(target.id) : null;
        if(!entries || !entries.length) return;
        entries.forEach(entry => {
          if(!entry) return;
          const source = entry.source || 'posts';
          const featureId = entry.id;
          if(featureId === undefined || featureId === null) return;
          if(target.venueKey){
            const entryVenueKey = entry.venueKey ? String(entry.venueKey) : extractVenueFromId(featureId);
            if(!entryVenueKey || entryVenueKey !== target.venueKey){
              return;
            }
          }
          const compositeKey = `${source}::${featureId}`;
          if(nextKeys.has(compositeKey)) return;
          nextKeys.add(compositeKey);
          nextEntries.push({ source, id: featureId });
          if(entry.spriteId){
            const spriteValue = String(entry.spriteId);
            if(spriteValue){
              highlightSpriteIds.add(spriteValue);
            }
          }
        });
      });
      highlightedFeatureKeys.forEach(entry => {
        const compositeKey = `${entry.source}::${entry.id}`;
        if(nextKeys.has(compositeKey)) return;
        try{ map.setFeatureState({ source: entry.source, id: entry.id }, { isHighlighted: false }); }
        catch(err){}
      });
      nextEntries.forEach(entry => {
        try{ map.setFeatureState({ source: entry.source, id: entry.id }, { isHighlighted: true }); }
        catch(err){}
      });
      highlightedFeatureKeys = nextEntries;
      if(highlightSpriteIds.size){
        highlightSpriteIds.forEach(spriteId => {
          touchMarkerLabelCompositeMeta(spriteId, { updateTimestamp: true });
        });
      }
    }
    let selectedVenueKey = null;
    const BASE_URL = (()=>{ let b = location.origin + location.pathname.split('/post/')[0]; if(!b.endsWith('/')) b+='/'; return b; })();

    const $ = (sel, root=document) => root.querySelector(sel);
    const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
    window.$ = window.$ || $;
    window.$$ = window.$$ || $$;
    function assignMapLike(target, source){
      if(!target || typeof target !== 'object') return;
      Object.keys(target).forEach(key => { delete target[key]; });
      if(source && typeof source === 'object'){
        Object.keys(source).forEach(key => {
          target[key] = source[key];
        });
      }
    }
    const clamp = (n, a, b)=> Math.max(a, Math.min(b, n));
    const toRad = d => d * Math.PI / 180;
    function distKm(a,b){ const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng); const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(Math.PI*(b.lng - a.lng)/360)**2; return 2 * 6371 * Math.asin(Math.sqrt(s)); }
    const sleep = ms => new Promise(r=>setTimeout(r,ms));
    const nextFrame = ()=> new Promise(r=> requestAnimationFrame(()=>r()));
    function getViewportHeight(){
      const innerHeight = window.innerHeight || 0;
      const clientHeight = document.documentElement ? document.documentElement.clientHeight : 0;
      if(window.visualViewport){
        const viewport = window.visualViewport;
        const viewportHeight = viewport.height || 0;
        const offsetTop = typeof viewport.offsetTop === 'number' ? viewport.offsetTop : 0;
        if(offsetTop > 0){
          const __stableViewportHeight = window.__stableViewportHeight || 0;
          if(Number.isFinite(__stableViewportHeight) && __stableViewportHeight > 0){
            return __stableViewportHeight;
          }
          return Math.max(innerHeight, clientHeight, viewportHeight, 0);
        }
        const candidate = Math.max(innerHeight, clientHeight, viewportHeight, 0);
        if(Number.isFinite(candidate) && candidate > 0){
          return candidate;
        }
      }
      return Math.max(innerHeight, clientHeight, 0);
    }
    window.getViewportHeight = getViewportHeight;

    // Ensure result lists occupy available space between the header and footer
    function adjustListHeight(){
      const rootStyles = getComputedStyle(document.documentElement);
      const headerH = parseFloat(rootStyles.getPropertyValue('--header-h')) || 0;
      const subH = parseFloat(rootStyles.getPropertyValue('--subheader-h')) || 0;
      const footerH = parseFloat(rootStyles.getPropertyValue('--footer-h')) || 0;
      const safeTop = parseFloat(rootStyles.getPropertyValue('--safe-top')) || 0;
      let viewportHeight = getViewportHeight();
      if(!Number.isFinite(viewportHeight) || viewportHeight <= 0){
        viewportHeight = headerH + subH + footerH + safeTop;
      }
      let availableHeight = Math.max(0, viewportHeight - headerH - subH - footerH - safeTop);
      if(!Number.isFinite(availableHeight) || availableHeight < 0){
        availableHeight = 0;
      }
      const root = document.documentElement;
      if(root){
        const fullHeight = (Number.isFinite(viewportHeight) && viewportHeight > 0)
          ? viewportHeight
          : (availableHeight + headerH + subH + footerH + safeTop);
        if(Number.isFinite(fullHeight) && fullHeight > 0){
          root.style.setProperty('--vh', `${(fullHeight / 100)}px`);
        }
        if(availableHeight > 0){
          root.style.setProperty('--panel-area-height', `${availableHeight}px`);
          root.style.setProperty('--boards-area-height', `${availableHeight}px`);
        } else {
          root.style.removeProperty('--panel-area-height');
          root.style.removeProperty('--boards-area-height');
        }
      }
      document.querySelectorAll('.recents-board, .quick-list-board, .post-board, .ad-board').forEach(list=>{
        if(availableHeight > 0){
          const value = `${availableHeight}px`;
          list.style.height = value;
          list.style.maxHeight = value;
          list.style.minHeight = value;
        } else {
          list.style.removeProperty('height');
          list.style.removeProperty('max-height');
          list.style.removeProperty('min-height');
        }
      });
    }
    window.adjustListHeight = adjustListHeight;
    if(window.visualViewport){
      window.visualViewport.addEventListener('resize', adjustListHeight);
      addPassiveScrollListener(window.visualViewport, adjustListHeight);
    }
    window.addEventListener('resize', adjustListHeight);
    window.addEventListener('orientationchange', adjustListHeight);

    let stickyScrollHandler = null;
      function updateStickyImages(){
        const root = document.documentElement;
        const openPost = document.querySelector('.post-board .open-post');
        const body = openPost ? openPost.querySelector('.post-body') : null;
        const imgArea = body ? body.querySelector('.post-images') : null;
        const cardHeader = openPost ? openPost.querySelector('.post-card') : null;
        document.body.classList.remove('hide-map-calendar');
        if(!openPost || !body || !imgArea || !cardHeader){
          document.body.classList.remove('open-post-sticky-images');
          root.style.removeProperty('--open-post-header-h');
          return;
        }
        root.style.setProperty('--open-post-header-h', cardHeader.offsetHeight + 'px');
        document.body.classList.add('open-post-sticky-images');
      }

    window.updateStickyImages = updateStickyImages;

    function updateLayoutVars(){
      const root = document.documentElement;
      const header = document.querySelector('.header');
      if(header){
        const headerStyles = getComputedStyle(header);
        const safeTop = parseFloat(headerStyles.paddingTop) || 0;
        const rect = header.getBoundingClientRect();
        let measured = Number.isFinite(rect.height) ? rect.height : 0;
        if(!measured || measured <= safeTop){
          const fallbackOffset = Number.isFinite(header.offsetHeight) ? header.offsetHeight : 0;
          measured = fallbackOffset;
        }
        if(!measured || measured <= safeTop){
          const fallbackScroll = Number.isFinite(header.scrollHeight) ? header.scrollHeight : 0;
          measured = fallbackScroll;
        }
        measured = Math.max(0, measured - safeTop);
        if(!measured){
          const rootStyles = getComputedStyle(root);
          const current = parseFloat(rootStyles.getPropertyValue('--header-h')) || 0;
          if(current > 0){
            measured = current;
          }
        }
        if(measured > 0){
          root.style.setProperty('--header-h', `${measured}px`);
        }
      }
      if(typeof window.adjustListHeight === 'function'){
        window.adjustListHeight();
      }
    }
    window.updateLayoutVars = updateLayoutVars;

    function updatePostPanel(){ if(map) postPanel = map.getBounds(); }
    window.updatePostPanel = updatePostPanel;

    // === 0528 helpers: cluster contextmenu list (robust positioning + locking) ===
    let listLocked = false;
    function lockMap(lock){
      listLocked = lock;
      const fn = lock ? 'disable' : 'enable';
      try{ map.dragPan[fn](); }catch(e){}
      try{ map.scrollZoom[fn](); }catch(e){}
      try{ map.boxZoom[fn](); }catch(e){}
      try{ map.keyboard[fn](); }catch(e){}
      try{ map.doubleClickZoom[fn](); }catch(e){}
      try{ map.touchZoomRotate[fn](); }catch(e){}
    }
    const MARKER_INTERACTIVE_LAYERS = VISIBLE_MARKER_LABEL_LAYERS.slice();
    window.__overCard = window.__overCard || false;

    function getPopupElement(popup){
      return popup && typeof popup.getElement === 'function' ? popup.getElement() : null;
    }

    function popupIsHovered(popup){
      if(window.__overCard){
        return true;
      }
      const el = getPopupElement(popup);
      if(!el) return false;
      if(el.matches(':hover')) return true;
      try {
        const hovered = el.querySelector(':hover');
        if(hovered) return true;
      } catch(err){}
      try {
        const hoveredList = document.querySelectorAll(':hover');
        for(let i = hoveredList.length - 1; i >= 0; i--){
          const node = hoveredList[i];
          if(node && (node === el || el.contains(node))){
            return true;
          }
        }
      } catch(err){}
      return false;
    }

    function schedulePopupRemoval(popup, delay=180){
      const target = popup || hoverPopup;
      if(!target) return;
      setTimeout(()=>{
        if(hoverPopup !== target) return;
        if(popupIsHovered(target)){
          window.__overCard = true;
          return;
        }
        window.__overCard = false;
        runOverlayCleanup(target);
        try{ target.remove(); }catch(e){}
        if(hoverPopup === target){
          hoverPopup = null;
          updateSelectedMarkerRing();
        }
      }, delay);
    }

    const SMALL_MAP_CARD_PILL_DEFAULT_SRC = 'assets/icons-30/150x40-pill-70.webp';
    const SMALL_MAP_CARD_PILL_HOVER_SRC = 'assets/icons-30/150x40-pill-2f3b73.webp';
    const MULTI_POST_MARKER_ICON_ID = 'multi-post-icon';
    const MULTI_POST_MARKER_ICON_SRC = 'assets/icons-30/multi-post-icon-30.webp';
    window.MULTI_POST_MARKER_ICON_ID = MULTI_POST_MARKER_ICON_ID;
    const SMALL_MULTI_MAP_CARD_ICON_SRC = 'assets/icons-30/multi-post-icon-30.webp';

      function resetBigMapCardTransforms(){
        document.querySelectorAll('.big-map-card').forEach(card => {
          card.style.transform = 'none';
        });
      }
      resetBigMapCardTransforms();
      document.addEventListener('DOMContentLoaded', resetBigMapCardTransforms);

    function registerOverlayCleanup(overlayEl, fn){
      if(!overlayEl || typeof fn !== 'function') return;
      const list = Array.isArray(overlayEl.__cleanupFns)
        ? overlayEl.__cleanupFns
        : (overlayEl.__cleanupFns = []);
      list.push(fn);
    }

    function runOverlayCleanup(target){
      if(!target) return;
      const el = typeof target.getElement === 'function' ? target.getElement() : target;
      if(!el) return;
      const fns = Array.isArray(el.__cleanupFns) ? el.__cleanupFns.slice() : [];
      if(!fns.length) return;
      el.__cleanupFns = [];
      fns.forEach(fn => {
        try{ fn(); }catch(err){}
      });
    }

    function setSmallMapCardPillImage(cardEl, highlighted){
      if(!cardEl) return;
      const pillImg = cardEl.querySelector('.mapmarker-pill, .map-card-pill')
        || cardEl.querySelector('img[src*="150x40-pill" i]');
      if(!pillImg) return;
      if(!pillImg.dataset.defaultSrc){
        const currentSrc = pillImg.getAttribute('src') || '';
        pillImg.dataset.defaultSrc = currentSrc || SMALL_MAP_CARD_PILL_DEFAULT_SRC;
      }
      if(!pillImg.dataset.highlightSrc){
        pillImg.dataset.highlightSrc = SMALL_MAP_CARD_PILL_HOVER_SRC;
      }
      const targetSrc = highlighted
        ? (pillImg.dataset.highlightSrc || SMALL_MAP_CARD_PILL_HOVER_SRC)
        : (pillImg.dataset.defaultSrc || SMALL_MAP_CARD_PILL_DEFAULT_SRC);
      if((pillImg.getAttribute('src') || '') !== targetSrc){
        pillImg.setAttribute('src', targetSrc);
      }
      if(pillImg.getAttribute('srcset')){
        pillImg.removeAttribute('srcset');
      }
    }

    function enforceSmallMultiMapCardIcon(img, overlayEl){
      if(!img) return;
      const targetSrc = SMALL_MULTI_MAP_CARD_ICON_SRC;
      const apply = ()=>{
        const currentSrc = img.getAttribute('src') || '';
        if(currentSrc !== targetSrc){
          img.setAttribute('src', targetSrc);
        }
      };
      apply();
      const onLoad = ()=> apply();
      const onError = ()=> apply();
      img.addEventListener('load', onLoad);
      img.addEventListener('error', onError);
      if(overlayEl){
        registerOverlayCleanup(overlayEl, ()=>{
          img.removeEventListener('load', onLoad);
          img.removeEventListener('error', onError);
        });
      }
      if(typeof MutationObserver === 'function'){
        const observer = new MutationObserver(()=>{
          if(!img.isConnected){
            observer.disconnect();
            return;
          }
          apply();
        });
        try{
          observer.observe(img, { attributes: true, attributeFilter: ['src'] });
        }catch(err){
          try{ observer.disconnect(); }catch(e){}
          return;
        }
        if(overlayEl){
          registerOverlayCleanup(overlayEl, ()=>{
            try{ observer.disconnect(); }catch(e){}
          });
        }
      }
    }

    function escapeAttrValue(value){
      const raw = String(value);
      if(typeof window !== 'undefined' && window.CSS && typeof window.CSS.escape === 'function'){
        try{ return window.CSS.escape(raw); }catch(err){ /* fall through */ }
      }
      return raw.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
    }

    function getOverlayMultiIds(overlay){
      if(!overlay || !overlay.dataset) return [];
      const raw = overlay.dataset.multiIds || '';
      if(!raw) return [];
      return raw.split(',').map(id => id.trim()).filter(Boolean);
    }

    function findMarkerOverlaysById(id){
      if(id === undefined || id === null) return [];
      const strId = String(id);
      const matches = new Set();
      const escaped = escapeAttrValue(strId);
      if(typeof document !== 'undefined' && document.querySelectorAll){
        try{
          document.querySelectorAll(`.mapmarker-overlay[data-id="${escaped}"]`).forEach(el => matches.add(el));
        }catch(err){ /* ignore selector issues */ }
        document.querySelectorAll('.mapmarker-overlay[data-multi-ids]').forEach(el => {
          if(matches.has(el)) return;
          const multiIds = getOverlayMultiIds(el);
          if(multiIds.includes(strId)){
            matches.add(el);
          }
        });
      }
      return Array.from(matches);
    }

    function toggleSmallMapCardHoverHighlight(postId, shouldHighlight){
      if(postId === undefined || postId === null) return;
      const idStr = String(postId);
      const highlightClass = 'is-pill-highlight';
      const mapHighlightClass = 'is-map-highlight';
      let highlightChanged = false;
      if(shouldHighlight){
        if(!hoverHighlightedPostIds.has(idStr)){
          hoverHighlightedPostIds.add(idStr);
          highlightChanged = true;
        }
      } else {
        if(hoverHighlightedPostIds.delete(idStr)){
          highlightChanged = true;
        }
      }
      const overlays = findMarkerOverlaysById(postId);
      overlays.forEach(overlay => {
        overlay.querySelectorAll('.small-map-card').forEach(cardEl => {
          if(shouldHighlight){
            if(!Object.prototype.hasOwnProperty.call(cardEl.dataset, 'hoverPrevHighlight')){
              cardEl.dataset.hoverPrevHighlight = cardEl.classList.contains(highlightClass) ? '1' : '0';
            }
            if(!cardEl.classList.contains(highlightClass)){
              cardEl.classList.add(highlightClass);
            }
            setSmallMapCardPillImage(cardEl, true);
          } else if(Object.prototype.hasOwnProperty.call(cardEl.dataset, 'hoverPrevHighlight')){
            const prev = cardEl.dataset.hoverPrevHighlight === '1';
            delete cardEl.dataset.hoverPrevHighlight;
            if(!prev){
              cardEl.classList.remove(highlightClass);
              setSmallMapCardPillImage(cardEl, false);
            } else {
              setSmallMapCardPillImage(cardEl, true);
            }
          }
        });
        overlay.querySelectorAll('.big-map-card').forEach(cardEl => {
          if(shouldHighlight){
            if(!Object.prototype.hasOwnProperty.call(cardEl.dataset, 'hoverPrevMapHighlight')){
              cardEl.dataset.hoverPrevMapHighlight = cardEl.classList.contains(mapHighlightClass) ? '1' : '0';
            }
            if(!cardEl.classList.contains(mapHighlightClass)){
              cardEl.classList.add(mapHighlightClass);
            }
          } else if(Object.prototype.hasOwnProperty.call(cardEl.dataset, 'hoverPrevMapHighlight')){
            const prev = cardEl.dataset.hoverPrevMapHighlight === '1';
            delete cardEl.dataset.hoverPrevMapHighlight;
            if(!prev){
              cardEl.classList.remove(mapHighlightClass);
            }
          }
        });
      });
      if(highlightChanged || shouldHighlight){
        updateSelectedMarkerRing();
      }
    }

    function updateSelectedMarkerRing(){
      const highlightClass = 'is-map-highlight';
      const markerHighlightClass = 'is-pill-highlight';
      const isSurfaceHighlightTarget = (el)=> !!(el && el.classList && el.classList.contains('post-card'));
      const restoreHighlightBackground = (el)=>{
        if(!isSurfaceHighlightTarget(el) || !el.dataset) return;
        if(Object.prototype.hasOwnProperty.call(el.dataset, 'prevHighlightBackground')){
          const prev = el.dataset.prevHighlightBackground;
          delete el.dataset.prevHighlightBackground;
          if(prev){
            el.style.background = prev;
            return;
          }
        }
        if(Object.prototype.hasOwnProperty.call(el.dataset, 'surfaceBg')){
          el.style.background = el.dataset.surfaceBg;
        } else {
          el.style.removeProperty('background');
        }
      };
      const applyHighlightBackground = (el)=>{
        if(!isSurfaceHighlightTarget(el) || !el.dataset) return;
        if(!Object.prototype.hasOwnProperty.call(el.dataset, 'prevHighlightBackground')){
          el.dataset.prevHighlightBackground = el.style.background || '';
        }
        el.style.background = CARD_HIGHLIGHT;
      };
      const restoreAttr = (el)=>{
        if(!el || !el.dataset) return;
        if(Object.prototype.hasOwnProperty.call(el.dataset, 'prevAriaSelected')){
          const prev = el.dataset.prevAriaSelected;
          if(prev){
            el.setAttribute('aria-selected', prev);
          } else {
            el.removeAttribute('aria-selected');
          }
          delete el.dataset.prevAriaSelected;
        }
      };
      document.querySelectorAll(`.post-card.${highlightClass}, .big-map-card.${highlightClass}`).forEach(el => {
        el.classList.remove(highlightClass);
        restoreAttr(el);
        restoreHighlightBackground(el);
      });
      document.querySelectorAll(`.small-map-card.${markerHighlightClass}`).forEach(el => {
        setSmallMapCardPillImage(el, false);
        el.classList.remove(markerHighlightClass);
      });

      const overlayEl = hoverPopup && typeof hoverPopup.getElement === 'function'
        ? hoverPopup.getElement()
        : null;
      const overlayId = overlayEl && overlayEl.dataset ? String(overlayEl.dataset.id || '') : '';
      const overlayMultiIds = overlayEl ? getOverlayMultiIds(overlayEl) : [];
      let fallbackId = '';
      if(!overlayId){
        if(activePostId !== undefined && activePostId !== null){
          fallbackId = String(activePostId);
        } else {
          const openEl = document.querySelector('.post-board .open-post[data-id]');
          fallbackId = openEl && openEl.dataset ? String(openEl.dataset.id || '') : '';
        }
      }
      const hoverHighlightList = Array.from(hoverHighlightedPostIds);
      const idsToHighlight = Array.from(new Set([
        overlayId,
        fallbackId,
        ...(overlayMultiIds || []),
        ...hoverHighlightList
      ].filter(Boolean)));
      if(!idsToHighlight.length){
        updateMapFeatureHighlights([]);
        return;
      }
      const applyHighlight = (el)=>{
        if(!el) return;
        if(el.dataset && !Object.prototype.hasOwnProperty.call(el.dataset, 'prevAriaSelected')){
          el.dataset.prevAriaSelected = el.hasAttribute('aria-selected') ? el.getAttribute('aria-selected') : '';
        }
        el.classList.add(highlightClass);
        el.setAttribute('aria-selected', 'true');
        applyHighlightBackground(el);
      };
      const overlayVenueKey = overlayEl && overlayEl.dataset ? String(overlayEl.dataset.venueKey || '').trim() : '';
      const globalVenueKey = typeof selectedVenueKey === 'string' && selectedVenueKey ? String(selectedVenueKey).trim() : '';
      const highlightTargets = [];
      const targetSeen = new Set();
      idsToHighlight.forEach(id => {
        const strId = String(id);
        const selectorId = escapeAttrValue(strId);
        const listCard = postsWideEl ? postsWideEl.querySelector(`.post-card[data-id="${selectorId}"]`) : null;
        applyHighlight(listCard);
        // Don't highlight open post cards - they should maintain their #1f2750 background
        const preferredVenue = (overlayId && strId === overlayId && overlayVenueKey)
          ? overlayVenueKey
          : globalVenueKey;
        const normalizedVenue = preferredVenue ? String(preferredVenue).trim() : '';
        const overlays = findMarkerOverlaysById(strId);
        overlays.forEach(overlay => {
          const overlayKey = overlay && overlay.dataset ? String(overlay.dataset.venueKey || '').trim() : '';
          if(normalizedVenue && overlayKey && overlayKey !== normalizedVenue){
            return;
          }
          overlay.querySelectorAll('.small-map-card').forEach(el => {
            setSmallMapCardPillImage(el, true);
            el.classList.add(markerHighlightClass);
          });
          overlay.querySelectorAll('.big-map-card').forEach(el => {
            el.classList.add(highlightClass);
          });
        });
        const dedupeKey = normalizedVenue ? `${strId}::${normalizedVenue}` : strId;
        if(!targetSeen.has(dedupeKey)){
          targetSeen.add(dedupeKey);
          highlightTargets.push({ id: strId, venueKey: normalizedVenue || null });
        }
      });
      updateMapFeatureHighlights(highlightTargets);
    }

    function hashString(str){
      let hash = 0;
      for(let i=0;i<str.length;i++){
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
      return hash.toString(36);
    }

function countMarkersForVenue(postsAtVenue, venueKey, bounds){
  if(!Array.isArray(postsAtVenue) || !postsAtVenue.length){
    return 0;
  }
  const key = typeof venueKey === 'string' && venueKey ? venueKey : null;
  const normalizedBounds = bounds ? normalizeBounds(bounds) : null;
  const markerInBounds = (lng, lat)=>{
    const lon = Number(lng);
    const la = Number(lat);
    if(!Number.isFinite(lon) || !Number.isFinite(la)) return false;
    if(!normalizedBounds) return true;
    return pointWithinBounds(lon, la, normalizedBounds);
  };
  if(key){
    return postsAtVenue.reduce((total, post) => {
      if(!post) return total;
      let count = 0;
      if(Array.isArray(post.locations) && post.locations.length){
        count = post.locations.reduce((sum, loc) => {
          if(!loc) return sum;
          const lng = Number(loc.lng);
          const lat = Number(loc.lat);
          if(!Number.isFinite(lng) || !Number.isFinite(lat)) return sum;
          if(toVenueCoordKey(lng, lat) !== key) return sum;
          return markerInBounds(lng, lat) ? sum + 1 : sum;
        }, 0);
      }
      if(!count && Number.isFinite(post.lng) && Number.isFinite(post.lat) && toVenueCoordKey(post.lng, post.lat) === key && markerInBounds(post.lng, post.lat)){
        count = 1;
      }
      return total + (count || 0);
    }, 0);
  }
  return postsAtVenue.reduce((total, post) => {
    if(!post) return total;
    let count = 0;
    if(Array.isArray(post.locations) && post.locations.length){
      count += post.locations.reduce((sum, loc) => {
        if(!loc) return sum;
        const lng = Number(loc.lng);
        const lat = Number(loc.lat);
        if(!Number.isFinite(lng) || !Number.isFinite(lat)) return sum;
        return markerInBounds(lng, lat) ? sum + 1 : sum;
      }, 0);
    }
    if((!Array.isArray(post.locations) || !post.locations.length) && Number.isFinite(post.lng) && Number.isFinite(post.lat) && markerInBounds(post.lng, post.lat)){
      count += 1;
    }
    return total + count;
  }, 0);
}
window.countMarkersForVenue = countMarkersForVenue;

function mulberry32(a){ return function(){var t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15, t|1); t^=t+Math.imul(t^t>>>7, t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
    const rnd = mulberry32(42);

    const cities = [
      {n:"Melbourne, Australia", c:[144.9631,-37.8136]},
      {n:"Sydney, Australia", c:[151.2093,-33.8688]},
      {n:"London, UK", c:[-0.1276,51.5072]},
      {n:"New York, USA", c:[-74.0060,40.7128]},
      {n:"Tokyo, Japan", c:[139.6917,35.6895]},
      {n:"Paris, France", c:[2.3522,48.8566]},
      {n:"Rio de Janeiro, Brazil", c:[-43.1729,-22.9068]},
      {n:"Cape Town, South Africa", c:[18.4241,-33.9249]},
      {n:"Reykjavík, Iceland", c:[-21.8174,64.1265]},
      {n:"Mumbai, India", c:[72.8777,19.0760]}
    ];

    let persistedFormbuilderSnapshotFetchPromise = null;
    if(typeof window !== 'undefined'){
      window.persistedFormbuilderSnapshotPromise = persistedFormbuilderSnapshotFetchPromise;
    }

    function getSavedFormbuilderSnapshot(){
      if(window.formbuilderStateManager && typeof window.formbuilderStateManager.getSaved === 'function'){
        try{
          const snapshot = window.formbuilderStateManager.getSaved();
          if(snapshot && typeof snapshot === 'object'){
            return snapshot;
          }
        }catch(err){
          console.error('Failed to read saved formbuilder snapshot', err);
          return null;
        }
      }
      return null;
    }

    async function fetchSavedFormbuilderSnapshot(){
      if(persistedFormbuilderSnapshotFetchPromise){
        return persistedFormbuilderSnapshotFetchPromise;
      }

      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timeoutId = controller ? window.setTimeout(() => {
        try{ controller.abort(); }catch(err){}
      }, 15000) : 0;

      const fetchPromise = (async () => {
        try{
          const response = await fetch('/gateway.php?action=get-form', {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: controller ? controller.signal : undefined
          });
          const text = await response.text();
          let data;
          try{
            data = JSON.parse(text);
          }catch(parseErr){
            throw new Error('The server returned an unexpected response.');
          }
          if(!response.ok || !data || data.success !== true || !data.snapshot){
            const message = data && typeof data.message === 'string' && data.message.trim()
              ? data.message.trim()
              : 'Unable to load form definitions.';
            throw new Error(message);
          }
          return data.snapshot;
        } finally {
          if(timeoutId){
            clearTimeout(timeoutId);
          }
        }
      })();

      persistedFormbuilderSnapshotFetchPromise = fetchPromise.finally(() => {
        persistedFormbuilderSnapshotFetchPromise = null;
        if(typeof window !== 'undefined'){
          window.persistedFormbuilderSnapshotPromise = null;
        }
      });

      if(typeof window !== 'undefined'){
        window.persistedFormbuilderSnapshotPromise = persistedFormbuilderSnapshotFetchPromise;
      }

      return persistedFormbuilderSnapshotFetchPromise;
    }

    if(typeof window !== 'undefined'){
      window.fetchSavedFormbuilderSnapshot = fetchSavedFormbuilderSnapshot;
    }

    function cloneFieldValue(value){
      if(value === null || value === undefined){
        return null;
      }
      if(Array.isArray(value)){
        return value.map(cloneFieldValue).filter(v => v !== null && v !== undefined);
      }
      if(value && typeof value === 'object'){
        try{
          return JSON.parse(JSON.stringify(value));
        }catch(err){
          return { ...value };
        }
      }
      return value;
    }

    const DEFAULT_FORMBUILDER_SNAPSHOT = {
      categories: [],
      versionPriceCurrencies: [],
      categoryIconPaths: {},
      subcategoryIconPaths: {},
      fieldTypes: []
    };

    function resolveFieldTypeDisplayName(option){
      if(!option || typeof option !== 'object'){
        return '';
      }
      const candidates = [
        option.field_type_name,
        option.fieldTypeName,
        option.name,
        option.label
      ];
      for(const candidate of candidates){
        if(typeof candidate === 'string'){
          const trimmed = candidate.trim();
          if(trimmed){
            return trimmed;
          }
        }
      }
      return '';
    }
    window.resolveFieldTypeDisplayName = resolveFieldTypeDisplayName;

    function normalizeFieldTypeOptions(options){
      const list = Array.isArray(options)
        ? options
        : Array.isArray(options && options.fieldTypes)
          ? options.fieldTypes
          : [];
      const normalized = [];
      const seen = new Set();
      const pushOption = (value, label, source=null)=>{
        const trimmedValue = typeof value === 'string' ? value.trim() : '';
        if(!trimmedValue){
          return;
        }
        const dedupeKey = trimmedValue.toLowerCase();
        if(seen.has(dedupeKey)){
          return;
        }
        const trimmedLabel = typeof label === 'string' ? label.trim() : '';
        const sourceName = resolveFieldTypeDisplayName(source);
        const displayName = sourceName || trimmedLabel || trimmedValue;
        const option = {
          value: trimmedValue,
          label: displayName,
          name: displayName,
          fieldTypeName: displayName,
          field_type_name: displayName,
          fieldTypeKey: trimmedValue,
          field_type_key: trimmedValue
        };
        if(source && typeof source === 'object'){
          if(typeof source.placeholder === 'string' && source.placeholder){
            option.placeholder = source.placeholder;
          }
          if(typeof source.type === 'string' && source.type){
            option.type = source.type;
          }
        }
        normalized.push(option);
        seen.add(dedupeKey);
      };
      list.forEach(item => {
        if(item && typeof item === 'object'){
          const value = typeof item.value === 'string' && item.value.trim()
            ? item.value.trim()
            : typeof item.key === 'string' && item.key.trim()
              ? item.key.trim()
              : typeof item.field_type_key === 'string' && item.field_type_key.trim()
                ? item.field_type_key.trim()
                : typeof item.fieldTypeKey === 'string' && item.fieldTypeKey.trim()
                  ? item.fieldTypeKey.trim()
                  : typeof item.id === 'number' && Number.isFinite(item.id)
                    ? String(item.id)
                    : typeof item.id === 'string' && item.id.trim()
                      ? item.id.trim()
                      : '';
          if(!value){
            return;
          }
          const label = typeof item.name === 'string' && item.name.trim()
            ? item.name.trim()
            : typeof item.field_type_name === 'string' && item.field_type_name.trim()
              ? item.field_type_name.trim()
              : typeof item.fieldTypeName === 'string' && item.fieldTypeName.trim()
                ? item.fieldTypeName.trim()
                : '';
          pushOption(value, label, item);
          return;
        }
        if(typeof item === 'string'){
          const trimmed = item.trim();
          if(trimmed){
            pushOption(trimmed, trimmed);
          }
        }
      });
      return normalized;
    }

    function normalizeCategoriesSnapshot(sourceCategories){
      const list = Array.isArray(sourceCategories) ? sourceCategories : [];
      const parseId = value => {
        if(typeof value === 'number' && Number.isInteger(value) && value >= 0){
          return value;
        }
        if(typeof value === 'string' && value.trim() && /^\d+$/.test(value.trim())){
          return parseInt(value.trim(), 10);
        }
        return null;
      };
      const normalized = list.map(item => {
        if(!item || typeof item !== 'object') return null;
        const name = typeof item.name === 'string' ? item.name : '';
        if(!name) return null;
        const subIdsSource = (item.subIds && typeof item.subIds === 'object' && !Array.isArray(item.subIds)) ? item.subIds : {};
        const rawSubs = Array.isArray(item.subs) ? item.subs : [];
        const subs = [];
        const subIdMap = {};
        rawSubs.forEach(entry => {
          if(typeof entry === 'string'){
            const subName = entry.trim();
            if(!subName) return;
            subs.push(subName);
            if(Object.prototype.hasOwnProperty.call(subIdsSource, entry)){
              const parsed = parseId(subIdsSource[entry]);
              if(parsed !== null){
                subIdMap[subName] = parsed;
              }
            }
            return;
          }
          if(entry && typeof entry === 'object'){
            const subName = typeof entry.name === 'string' ? entry.name.trim() : '';
            if(!subName) return;
            subs.push(subName);
            const parsed = parseId(entry.id);
            if(parsed !== null){
              subIdMap[subName] = parsed;
            } else if(Object.prototype.hasOwnProperty.call(subIdsSource, subName)){
              const fromMap = parseId(subIdsSource[subName]);
              if(fromMap !== null){
                subIdMap[subName] = fromMap;
              }
            }
          }
        });
        const rawSubFields = (item.subFields && typeof item.subFields === 'object' && !Array.isArray(item.subFields)) ? item.subFields : {};
        const subFields = {};
        subs.forEach(sub => {
          const fields = Array.isArray(rawSubFields[sub]) ? rawSubFields[sub].map(cloneFieldValue).filter(f => f !== null && f !== undefined) : [];
          subFields[sub] = fields;
        });
        const sortOrder = normalizeCategorySortOrderValue(item.sort_order ?? item.sortOrder);
        const subHidden = (item.subHidden && typeof item.subHidden === 'object' && !Array.isArray(item.subHidden)) ? item.subHidden : {};
        const subFees = (item.subFees && typeof item.subFees === 'object' && !Array.isArray(item.subFees)) ? item.subFees : {};
        return { id: parseId(item.id), name, subs, subFields, subIds: subIdMap, subHidden, subFees, sort_order: sortOrder };
      }).filter(Boolean);
      const base = normalized.length ? normalized : DEFAULT_FORMBUILDER_SNAPSHOT.categories.map(cat => ({
        id: null,
        name: cat.name,
        subs: cat.subs.slice(),
        subIds: cat.subs.reduce((acc, sub) => {
          acc[sub] = null;
          return acc;
        }, {}),
        subFields: cat.subs.reduce((acc, sub) => {
          acc[sub] = [];
          return acc;
        }, {}),
        subHidden: {},
        subFees: {},
        sort_order: normalizeCategorySortOrderValue(cat && (cat.sort_order ?? cat.sortOrder))
      }));
      base.forEach(cat => {
        if(!cat.subFields || typeof cat.subFields !== 'object' || Array.isArray(cat.subFields)){
          cat.subFields = {};
        }
        if(!cat.subIds || typeof cat.subIds !== 'object' || Array.isArray(cat.subIds)){
          cat.subIds = {};
        }
        if(!cat.subHidden || typeof cat.subHidden !== 'object' || Array.isArray(cat.subHidden)){
          cat.subHidden = {};
        }
        if(!cat.subFees || typeof cat.subFees !== 'object' || Array.isArray(cat.subFees)){
          cat.subFees = {};
        }
        cat.subs.forEach(sub => {
          if(!Array.isArray(cat.subFields[sub])){
            cat.subFields[sub] = [];
          }
          if(!Object.prototype.hasOwnProperty.call(cat.subIds, sub)){
            cat.subIds[sub] = null;
          }
        });
        cat.sort_order = normalizeCategorySortOrderValue(cat.sort_order ?? cat.sortOrder);
      });
      return base;
    }

    function normalizeFormbuilderSnapshot(snapshot){
      const normalizedCategories = normalizeCategoriesSnapshot(snapshot && snapshot.categories);
      const rawCurrencies = (snapshot && Array.isArray(snapshot.versionPriceCurrencies)) ? snapshot.versionPriceCurrencies : [];
      const normalizedCurrencies = Array.from(new Set(rawCurrencies
        .map(code => typeof code === 'string' ? code.trim().toUpperCase() : '')
        .filter(Boolean)));
      const normalizedFieldTypes = normalizeFieldTypeOptions(
        snapshot && (snapshot.fieldTypes || snapshot.field_types)
      );
      const normalizedCategoryIconPaths = normalizeIconPathMap(snapshot && snapshot.categoryIconPaths);
      const normalizedSubcategoryIconPaths = normalizeIconPathMap(snapshot && snapshot.subcategoryIconPaths);
      return {
        categories: normalizedCategories,
        versionPriceCurrencies: normalizedCurrencies,
        categoryIconPaths: normalizedCategoryIconPaths,
        subcategoryIconPaths: normalizedSubcategoryIconPaths,
        fieldTypes: normalizedFieldTypes
      };
    }

    window.getSavedFormbuilderSnapshot = getSavedFormbuilderSnapshot;
    window.normalizeFormbuilderSnapshot = normalizeFormbuilderSnapshot;

    function getPersistedFormbuilderSnapshotFromGlobals(){
      if(typeof window === 'undefined'){
        return null;
      }
      const candidates = [
        window.__persistedFormbuilderSnapshot,
        window.__PERSISTED_FORMBUILDER_SNAPSHOT__,
        window.__FORMBUILDER_SNAPSHOT__,
        window.persistedFormbuilderSnapshot,
        window.formbuilderSnapshot,
        window.formBuilderSnapshot,
        window.initialFormbuilderSnapshot,
        window.__initialFormbuilderSnapshot
      ];
      for(const candidate of candidates){
        if(candidate && typeof candidate === 'object'){
          return candidate;
        }
      }
      return null;
    }

    const persistedFormbuilderSnapshotPromise = (()=>{
      if(typeof window !== 'undefined' && window.__persistedFormbuilderSnapshotPromise){
        return window.__persistedFormbuilderSnapshotPromise;
      }
      const promise = (async ()=>{
        const inlineSnapshot = getPersistedFormbuilderSnapshotFromGlobals();
        if(inlineSnapshot){
          return inlineSnapshot;
        }
        if(typeof fetchSavedFormbuilderSnapshot === 'function'){
          return await fetchSavedFormbuilderSnapshot();
        }
        return null;
      })();
      if(typeof window !== 'undefined'){
        window.__persistedFormbuilderSnapshotPromise = promise;
      }
      return promise;
    })();

    // Wait for snapshot to load, then initialize
    persistedFormbuilderSnapshotPromise.then(snapshot => {
      window.__persistedFormbuilderSnapshot = snapshot;
    }).catch(err => {
      console.error('Failed to load formbuilder snapshot', err);
      // Don't hide the error - it should be visible
    });

    // NO FALLBACKS - wait for backend snapshot only
    // Note: This will throw if snapshot is not available - errors should be visible
    // For backward compatibility during initialization, create normalized structure
    // but this should not be used if backend snapshot fails
    const getInitialSnapshot = () => {
      const inline = getPersistedFormbuilderSnapshotFromGlobals();
      if(inline && typeof inline === 'object'){
        return normalizeFormbuilderSnapshot(inline);
      }
      // If no inline snapshot, return normalized empty structure
      // This should only be used if backend snapshot is not yet loaded
      return normalizeFormbuilderSnapshot(null);
    };
    const initialFormbuilderSnapshot = window.initialFormbuilderSnapshot = getInitialSnapshot();
    function sanitizeFieldTypeOptions(options){
      const list = Array.isArray(options) ? options : normalizeFieldTypeOptions(options);
      const sanitized = [];
      const seenValues = new Set();
      list.forEach(option => {
        if(option && typeof option === 'object'){
          const rawValue = typeof option.value === 'string' ? option.value.trim() : '';
          if(!rawValue){
            return;
          }
          const dedupeKey = rawValue.toLowerCase();
          if(seenValues.has(dedupeKey)){
            return;
          }
          seenValues.add(dedupeKey);
          const displayName = resolveFieldTypeDisplayName(option) || rawValue;
          const sanitizedOption = {
            ...option,
            value: rawValue,
            label: displayName,
            name: displayName,
            fieldTypeName: displayName,
            field_type_name: displayName,
            fieldTypeKey: rawValue,
            field_type_key: rawValue
          };
          sanitized.push(sanitizedOption);
          return;
        }
        if(typeof option === 'string'){
          const trimmed = option.trim();
          if(!trimmed){
            return;
          }
          const dedupeKey = trimmed.toLowerCase();
          if(seenValues.has(dedupeKey)){
            return;
          }
          seenValues.add(dedupeKey);
          sanitized.push({
            value: trimmed,
            label: trimmed,
            name: trimmed,
            fieldTypeName: trimmed,
            field_type_name: trimmed,
            fieldTypeKey: trimmed,
            field_type_key: trimmed
          });
        }
      });
      // Sort by sort_order (editable fields with sort_order=100 will be at bottom)
      sanitized.sort((a, b) => {
        const orderA = (typeof a.sort_order === 'number' ? a.sort_order : (a.sort_order ? parseInt(a.sort_order, 10) : 0)) || 0;
        const orderB = (typeof b.sort_order === 'number' ? b.sort_order : (b.sort_order ? parseInt(b.sort_order, 10) : 0)) || 0;
        if(orderA !== orderB){
          return orderA - orderB;
        }
        // If same sort_order, maintain original order (don't sort alphabetically)
        return 0;
      });
      return sanitized;
    }
    window.sanitizeFieldTypeOptions = sanitizeFieldTypeOptions;
    const categories = window.categories = initialFormbuilderSnapshot.categories;
    // versionPriceCurrencies now come from backend via currency field options
    window.currencyCodes = Array.isArray(initialFormbuilderSnapshot.versionPriceCurrencies) ? initialFormbuilderSnapshot.versionPriceCurrencies : [];
    const categoryIcons = window.categoryIcons = window.categoryIcons || {};
    const subcategoryIcons = window.subcategoryIcons = window.subcategoryIcons || {};
    const categoryIconPaths = window.categoryIconPaths = window.categoryIconPaths || {};
    const subcategoryIconPaths = window.subcategoryIconPaths = window.subcategoryIconPaths || {};
    assignMapLike(categoryIconPaths, normalizeIconPathMap(initialFormbuilderSnapshot.categoryIconPaths));
    assignMapLike(subcategoryIconPaths, normalizeIconPathMap(initialFormbuilderSnapshot.subcategoryIconPaths));
    const snapshotFieldTypeOptions = Array.isArray(initialFormbuilderSnapshot.fieldTypes)
      ? initialFormbuilderSnapshot.fieldTypes
      : [];
    const finalFieldTypeOptions = sanitizeFieldTypeOptions(snapshotFieldTypeOptions);
    initialFormbuilderSnapshot.fieldTypes = finalFieldTypeOptions.map(option => ({ ...option }));
    const FORM_FIELD_TYPES = window.FORM_FIELD_TYPES = initialFormbuilderSnapshot.fieldTypes.map(option => ({ ...option }));
    const getFormFieldTypeLabel = (value)=>{
      const match = FORM_FIELD_TYPES.find(opt => opt.value === value);
      if(!match){
        return '';
      }
      const label = resolveFieldTypeDisplayName(match);
      if(label){
        return label;
      }
      return typeof value === 'string' ? value : '';
    };
    const VENUE_TIME_AUTOFILL_STATE = new WeakMap();
    const VENUE_CURRENCY_STATE = new WeakMap();
    let LAST_SELECTED_VENUE_CURRENCY = '';

    function venueSessionCreateTier(){
      return { name: '', currency: '', price: '' };
    }
    function venueSessionCreateVersion(){
      return { name: '', tiers: [venueSessionCreateTier()] };
    }
    function venueSessionCreateTime(){
      return {
        time: '',
        versions: [venueSessionCreateVersion()],
        samePricingAsAbove: true,
        samePricingSourceIndex: 0,
        tierAutofillLocked: false
      };
    }
    function venueSessionCreateSession(){
      return { date: '', times: [venueSessionCreateTime()] };
    }
    function venueSessionCreateVenue(){
      return { name: '', address: '', location: null, feature: null, sessions: [venueSessionCreateSession()] };
    }
    function normalizeVenueSessionTier(tier){
      let obj = tier;
      if(!obj || typeof obj !== 'object'){
        obj = venueSessionCreateTier();
      }
      if(typeof obj.name !== 'string') obj.name = '';
      if(typeof obj.currency !== 'string') obj.currency = '';
      if(typeof obj.price !== 'string') obj.price = '';
      return obj;
    }
    function normalizeVenueSessionVersion(version){
      let obj = version;
      if(!obj || typeof obj !== 'object'){
        obj = venueSessionCreateVersion();
      }
      if(typeof obj.name !== 'string') obj.name = '';
      if(!Array.isArray(obj.tiers)){
        obj.tiers = [venueSessionCreateTier()];
      } else {
        for(let i = 0; i < obj.tiers.length; i++){
          obj.tiers[i] = normalizeVenueSessionTier(obj.tiers[i]);
        }
        if(obj.tiers.length === 0){
          obj.tiers.push(venueSessionCreateTier());
        }
      }
      return obj;
    }
    function normalizeVenueSessionTime(time){
      let obj = time;
      if(!obj || typeof obj !== 'object'){
        obj = venueSessionCreateTime();
      }
      if(typeof obj.time !== 'string') obj.time = '';
      if(!Array.isArray(obj.versions)){
        obj.versions = [venueSessionCreateVersion()];
      } else {
        for(let i = 0; i < obj.versions.length; i++){
          obj.versions[i] = normalizeVenueSessionVersion(obj.versions[i]);
        }
        if(obj.versions.length === 0){
          obj.versions.push(venueSessionCreateVersion());
        }
      }
      obj.samePricingAsAbove = obj.samePricingAsAbove !== false;
      obj.tierAutofillLocked = obj && obj.tierAutofillLocked === true;
      const sourceIndex = Number(obj.samePricingSourceIndex);
      obj.samePricingSourceIndex = Number.isInteger(sourceIndex) && sourceIndex >= 0 ? sourceIndex : 0;
      return obj;
    }
    function normalizeVenueSessionSession(session){
      let obj = session;
      if(!obj || typeof obj !== 'object'){
        obj = venueSessionCreateSession();
      }
      if(typeof obj.date !== 'string') obj.date = '';
      if(!Array.isArray(obj.times)){
        obj.times = [venueSessionCreateTime()];
      } else {
        for(let i = 0; i < obj.times.length; i++){
          obj.times[i] = normalizeVenueSessionTime(obj.times[i]);
        }
        if(obj.times.length === 0){
          obj.times.push(venueSessionCreateTime());
        }
      }
      return obj;
    }
    function normalizeVenueSessionVenue(opt){
      let obj = opt;
      if(!obj || typeof obj !== 'object'){
        obj = venueSessionCreateVenue();
      }
      if(typeof obj.name !== 'string') obj.name = '';
      if(typeof obj.address !== 'string') obj.address = '';
      if(obj.location && typeof obj.location === 'object'){
        const lng = Number(obj.location.lng);
        const lat = Number(obj.location.lat);
        obj.location = (Number.isFinite(lng) && Number.isFinite(lat)) ? { lng, lat } : null;
      } else {
        obj.location = null;
      }
      if(obj.feature && typeof obj.feature !== 'object'){
        obj.feature = null;
      }
      if(!Array.isArray(obj.sessions)){
        obj.sessions = [venueSessionCreateSession()];
      } else {
        for(let i = 0; i < obj.sessions.length; i++){
          obj.sessions[i] = normalizeVenueSessionSession(obj.sessions[i]);
        }
        if(obj.sessions.length === 0){
          obj.sessions.push(venueSessionCreateSession());
        }
      }
      return obj;
    }
    function normalizeVenueSessionOptions(options){
      let list = options;
      if(!Array.isArray(list)){
        list = [];
      }
      for(let i = 0; i < list.length; i++){
        list[i] = normalizeVenueSessionVenue(list[i]);
      }
      if(list.length === 0){
        list.push(venueSessionCreateVenue());
      }
      return list;
    }
    window.normalizeVenueSessionOptions = normalizeVenueSessionOptions;
    function cloneVenueSessionTier(tier){
      const base = venueSessionCreateTier();
      if(tier && typeof tier === 'object'){
        if(typeof tier.name === 'string') base.name = tier.name;
        if(typeof tier.currency === 'string') base.currency = tier.currency;
        if(typeof tier.price === 'string') base.price = tier.price;
      }
      return base;
    }
    function cloneVenueSessionVersion(version){
      const base = venueSessionCreateVersion();
      base.name = (version && typeof version.name === 'string') ? version.name : '';
      const tiers = version && Array.isArray(version.tiers) ? version.tiers : [];
      base.tiers = tiers.length ? tiers.map(cloneVenueSessionTier) : [venueSessionCreateTier()];
      return base;
    }
    function cloneVenueSessionTime(time){
      const base = venueSessionCreateTime();
      base.time = (time && typeof time.time === 'string') ? time.time : '';
      const versions = time && Array.isArray(time.versions) ? time.versions : [];
      base.versions = versions.length ? versions.map(cloneVenueSessionVersion) : [venueSessionCreateVersion()];
      base.samePricingAsAbove = !!(time && time.samePricingAsAbove);
      const sourceIndex = Number(time && time.samePricingSourceIndex);
      base.samePricingSourceIndex = Number.isInteger(sourceIndex) && sourceIndex >= 0 ? sourceIndex : 0;
      base.tierAutofillLocked = !!(time && time.tierAutofillLocked);
      return base;
    }
    function cloneVenueSessionSession(session){
      const base = venueSessionCreateSession();
      base.date = (session && typeof session.date === 'string') ? session.date : '';
      const times = session && Array.isArray(session.times) ? session.times : [];
      base.times = times.length ? times.map(cloneVenueSessionTime) : [venueSessionCreateTime()];
      return base;
    }
    function cloneVenueSessionFeature(feature){
      if(!feature || typeof feature !== 'object') return null;
      try{
        return JSON.parse(JSON.stringify(feature));
      }catch(err){
        return { ...feature };
      }
    }
    function cloneVenueSessionVenue(venue){
      const base = venueSessionCreateVenue();
      base.name = (venue && typeof venue.name === 'string') ? venue.name : '';
      base.address = (venue && typeof venue.address === 'string') ? venue.address : '';
      if(venue && venue.location && typeof venue.location === 'object'){
        const lng = Number(venue.location.lng);
        const lat = Number(venue.location.lat);
        if(Number.isFinite(lng) && Number.isFinite(lat)){
          base.location = { lng, lat };
        }
      }
      if(venue && venue.feature && typeof venue.feature === 'object'){
        base.feature = cloneVenueSessionFeature(venue.feature);
      }
      const sessions = venue && Array.isArray(venue.sessions) ? venue.sessions : [];
      base.sessions = sessions.length ? sessions.map(cloneVenueSessionSession) : [venueSessionCreateSession()];
      return base;
    }
    window.normalizeVenueSessionOptions = normalizeVenueSessionOptions;
    window.cloneVenueSessionVenue = cloneVenueSessionVenue;
    function getVenueAutofillState(field, venue){
      let fieldState = VENUE_TIME_AUTOFILL_STATE.get(field);
      if(!fieldState){
        fieldState = new WeakMap();
        VENUE_TIME_AUTOFILL_STATE.set(field, fieldState);
      }
      let state = fieldState.get(venue);
      if(!state){
        state = { slots: [] };
        fieldState.set(venue, state);
      }
      return state;
    }
    function resetVenueAutofillState(field){
      VENUE_TIME_AUTOFILL_STATE.delete(field);
    }
    window.resetVenueAutofillState = resetVenueAutofillState;

    // Fields now come from backend via field_types table, no hardcoded defaults
    const OPEN_ICON_PICKERS = window.__openIconPickers || new Set();
    window.__openIconPickers = OPEN_ICON_PICKERS;

    function toIconIdKey(id){
      return Number.isInteger(id) ? `id:${id}` : '';
    }
    function toIconNameKey(name){
      return typeof name === 'string' && name ? `name:${name.toLowerCase()}` : '';
    }

    function normalizeIconAssetPath(path){
      const normalized = baseNormalizeIconPath(path);
      if(!normalized){
        return '';
      }
      if(/^(?:https?:)?\/\//i.test(normalized) || normalized.startsWith('data:')){
        return normalized;
      }
      return normalized;
    }

    const existingNormalizeIconPath = (typeof window !== 'undefined' && typeof window.normalizeIconPath === 'function')
      ? window.normalizeIconPath
      : null;
    if(typeof window !== 'undefined'){
      window.normalizeIconPath = (path)=>{
        const initial = existingNormalizeIconPath ? existingNormalizeIconPath(path) : path;
        return normalizeIconAssetPath(initial);
      };
    }

    function normalizeIconPathMap(source){
      const normalized = {};
      if(!source || typeof source !== 'object'){
        return normalized;
      }
      Object.keys(source).forEach(key => {
        const rawValue = source[key];
        const value = typeof rawValue === 'string' ? normalizeIconAssetPath(rawValue) : '';
        if(typeof key !== 'string'){
          return;
        }
        const trimmed = key.trim();
        if(!trimmed){
          return;
        }
        if(/^id:\d+$/i.test(trimmed)){
          normalized[trimmed.toLowerCase()] = value;
          return;
        }
        if(/^[0-9]+$/.test(trimmed)){
          normalized[`id:${trimmed}`] = value;
          return;
        }
        if(/^name:/i.test(trimmed)){
          const rest = trimmed.slice(5).toLowerCase();
          if(rest){
            normalized[`name:${rest}`] = value;
          }
          return;
        }
        normalized[`name:${trimmed.toLowerCase()}`] = value;
      });
      return normalized;
    }
    window.normalizeIconPathMap = normalizeIconPathMap;
    function lookupIconPath(map, id, name){
      const idKey = toIconIdKey(id);
      if(idKey && Object.prototype.hasOwnProperty.call(map, idKey)){
        return { path: map[idKey], found: true };
      }
      const nameKey = toIconNameKey(name);
      if(nameKey && Object.prototype.hasOwnProperty.call(map, nameKey)){
        return { path: map[nameKey], found: true };
      }
      return { path: '', found: false };
    }
    window.lookupIconPath = lookupIconPath;
    function writeIconPath(map, id, name, path){
      const idKey = toIconIdKey(id);
      if(idKey){
        map[idKey] = path;
      }
      const nameKey = toIconNameKey(name);
      if(nameKey){
        map[nameKey] = path;
      }
    }
    window.writeIconPath = writeIconPath;
    function renameIconNameKey(map, oldName, newName){
      const oldKey = toIconNameKey(oldName);
      const newKey = toIconNameKey(newName);
      if(!oldKey || !newKey || oldKey === newKey){
        if(oldKey && !newKey){
          delete map[oldKey];
        }
        return;
      }
      if(Object.prototype.hasOwnProperty.call(map, oldKey) && !Object.prototype.hasOwnProperty.call(map, newKey)){
        map[newKey] = map[oldKey];
      }
      delete map[oldKey];
    }
    function deleteIconKeys(map, id, name){
      const idKey = toIconIdKey(id);
      if(idKey){
        delete map[idKey];
      }
      const nameKey = toIconNameKey(name);
      if(nameKey){
        delete map[nameKey];
      }
    }
    function closeAllIconPickers(){
      Array.from(OPEN_ICON_PICKERS).forEach(close => {
        try{ close(); }catch(err){}
      });
    }
    window.closeAllIconPickers = closeAllIconPickers;
    function closeFieldEditPanels({ exceptPanel = null, exceptButton = null } = {}){
      document.querySelectorAll('.field-edit-panel').forEach(panel => {
        if(panel === exceptPanel) return;
        panel.hidden = true;
        const host = panel.closest('.subcategory-field-row, .form-preview-field');
        if(host && host.classList){
          host.classList.remove('field-edit-open');
        }
      });
      document.querySelectorAll('.field-edit-btn[aria-expanded="true"]').forEach(btn => {
        if(btn === exceptButton) return;
        btn.setAttribute('aria-expanded', 'false');
      });
    }
    function baseNormalizeIconPath(path){
      if(typeof path !== 'string') return '';
      const trimmed = path.trim();
      if(!trimmed) return '';
      return trimmed.replace(/^\/+/, '');
    }
    function applyNormalizeIconPath(path){
      if(typeof window !== 'undefined' && typeof window.normalizeIconPath === 'function'){
        try{
          const overridden = window.normalizeIconPath(path);
          if(typeof overridden !== 'undefined'){
            return baseNormalizeIconPath(overridden);
          }
        }catch(err){}
      }
      return baseNormalizeIconPath(path);
    }
    window.applyNormalizeIconPath = applyNormalizeIconPath;
    function getCategoryIconPath(category){
      if(!category) return '';
      const lookup = lookupIconPath(categoryIconPaths, category.id, category.name);
      if(lookup.found){
        return lookup.path || '';
      }
      return '';
    }
    function getSubcategoryIconPath(category, subName){
      const id = category && category.subIds && Object.prototype.hasOwnProperty.call(category.subIds, subName)
        ? category.subIds[subName]
        : null;
      const lookup = lookupIconPath(subcategoryIconPaths, id, subName);
      if(lookup.found){
        return lookup.path || '';
      }
      return '';
    }
    const subcategoryMarkers = window.subcategoryMarkers = window.subcategoryMarkers || {};
    if(!subcategoryMarkers[MULTI_POST_MARKER_ICON_ID]){
      subcategoryMarkers[MULTI_POST_MARKER_ICON_ID] = MULTI_POST_MARKER_ICON_SRC;
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

    function extractIconSrc(html){
      if(typeof html !== 'string'){ return ''; }
      const trimmed = html.trim();
      if(!trimmed){ return ''; }
      if(typeof document === 'undefined'){ return ''; }
      if(!extractIconSrc.__parser){
        extractIconSrc.__parser = document.createElement('div');
      }
      const parser = extractIconSrc.__parser;
      parser.innerHTML = trimmed;
      const img = parser.querySelector('img');
      const src = img ? (img.getAttribute('src') || '').trim() : '';
      parser.innerHTML = '';
      return src;
    }

    // --- Icon loader: ensures Mapbox images are available and quiets missing-image logs ---
    function attachIconLoader(mapInstance){
      if(!mapInstance) return () => Promise.resolve(false);
      const KNOWN = [
        'freebies','live-sport','volunteers','goods-and-services','clubs','artwork',
        'live-gigs','for-sale','education-centres','tutors'
      ];
      const pending = new Map();

      const urlsFor = (name) => {
        const urls = [];
        const seen = new Set();
        const pushUrl = (url) => {
          if(!url || seen.has(url)){
            return;
          }
          seen.add(url);
          urls.push(url);
        };
        const markers = window.subcategoryMarkers || {};
        const manual = markers[name] || null;
        const shouldLookupLocal = Boolean(manual);
        if(manual){
          pushUrl(manual);
        }
        return { urls, shouldLookupLocal };
      };

      function loadImageCompat(url){
        return new Promise((resolve, reject) => {
          if(typeof mapInstance.loadImage === 'function'){
            mapInstance.loadImage(url, (err, img) => err ? reject(err) : resolve(img));
          } else {
            fetch(url)
              .then(r => r.ok ? r.blob() : Promise.reject(url))
              .then(blob => createImageBitmap(blob))
              .then(resolve)
              .catch(reject);
          }
        });
      }

      function pickPixelRatio(url, img){
        if(typeof url === 'string' && /@2x\.[^./]+$/i.test(url)){
          return 2;
        }
        return 1;
      }

      function placeholder(name){
        const canvas = document.createElement('canvas');
        canvas.width = 48;
        canvas.height = 48;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(24, 24, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((name && name[0] ? name[0] : '?').toUpperCase(), 24, 24);
        return canvas;
      }

      async function addIcon(name){
        if(!name) return false;
        if(mapInstance.hasImage?.(name)) return true;
        if(pending.has(name)) return pending.get(name);
        const task = (async () => {
          const { urls, shouldLookupLocal } = urlsFor(name);
          if(!urls.length && !shouldLookupLocal){
            try{ mapInstance.addImage(name, placeholder(name)); }catch(err){}
            return false;
          }
          for(const url of urls){
            try{
              const img = await loadImageCompat(url);
              if(mapInstance.hasImage?.(name)) return true;
              const pixelRatio = pickPixelRatio(url, img);
              mapInstance.addImage(name, img, { sdf:false, pixelRatio });
              return true;
            }catch(err){}
          }
          try{ mapInstance.addImage(name, placeholder(name)); }catch(err){}
          return false;
        })().finally(() => pending.delete(name));
        pending.set(name, task);
        return task;
      }

      mapInstance.on('style.load', async () => {
        try{ ensureMarkerLabelBackground(mapInstance); }catch(err){}
        try{ reapplyMarkerLabelComposites(mapInstance); }catch(err){}
        const markers = window.subcategoryMarkers || {};
        const preloadList = Array.from(new Set([...KNOWN, ...Object.keys(markers)]));
        if(!preloadList.length) return;
        const BATCH_SIZE = 4;
        const BATCH_DELAY = 60;
        for(let i = 0; i < preloadList.length; i += BATCH_SIZE){
          const slice = preloadList.slice(i, i + BATCH_SIZE);
          const tasks = slice.map(iconName => (
            addIcon(iconName).catch(() => false)
          ));
          try{
            await Promise.allSettled(tasks);
          }catch(err){}
          if(BATCH_DELAY && i + BATCH_SIZE < preloadList.length){
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
          }
        }
      });

      return addIcon;
    }
    window.attachIconLoader = attachIconLoader;

    const venueKey = (lng, lat) => toVenueCoordKey(lng, lat);

    function setSelectedVenueHighlight(lng, lat){
      if(Number.isFinite(lng) && Number.isFinite(lat)){
        const key = venueKey(lng, lat);
        if(selectedVenueKey !== key){
          selectedVenueKey = key;
          updateSelectedMarkerRing();
        }
      } else if(selectedVenueKey !== null){
        selectedVenueKey = null;
        updateSelectedMarkerRing();
      }
    }

    function ensureSvgDimensions(svg){
      try{
        const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const el = doc.documentElement;
        let w = parseFloat(el.getAttribute('width'));
        let h = parseFloat(el.getAttribute('height'));
        const viewBox = el.getAttribute('viewBox');
        if((!w || !h) && viewBox){
          const parts = viewBox.split(/[ ,]/).map(Number);
          if(parts.length === 4){
            w = w || parts[2];
            h = h || parts[3];
          }
        }
        if(!w) w = 40;
        if(!h) h = 40;
        el.setAttribute('width', w);
        el.setAttribute('height', h);
        return {svg: new XMLSerializer().serializeToString(el), width: w, height: h};
      }catch(e){
        return {svg, width:40, height:40};
      }
    }
// 0585: unique title generator (with location; no category prefix)
const __ADJ = ["Radiant","Indigo","Velvet","Silver","Crimson","Neon","Amber","Sapphire","Emerald","Electric","Roaring","Midnight","Sunlit","Ethereal","Urban","Astral","Analog","Digital","Windswept","Golden","Hidden","Avant","Cosmic","Garden","Quiet","Vivid","Obsidian","Scarlet","Cerulean","Lunar","Solar","Autumn","Verdant","Azure"];
const __NOUN = ["Symphony","Market","Carnival","Showcase","Assembly","Parade","Salon","Summit","Expo","Soirée","Revue","Collective","Fair","Gathering","Series","Retrospective","Circuit","Sessions","Weekender","Festival","Bazaar","Program","Tableau","Odyssey","Forum","Mosaic","Canvas","Relay","Drift","Workshop","Lab"];
const __HOOK = ["at Dusk","of Ideas","in Motion","for Everyone","Remix","Live","Reborn","MKII","Redux","Infinite","Prime","Pulse","Wave","Future","Now","Unlocked","Extended","Panorama","Unbound","Edition","Run","Sequence"];
function __rng(seed){ let s = seed|0; return ()=> (s = (s*1664525 + 1013904223)>>>0); }
const __USED_BIGRAMS = new Set();
function uniqueTitle(seed, cityName, idx){
  // Deterministic RNG with attempt salt for conflict resolution
  const base = (seed||0) ^ ((idx||0)*99991);

  const normalize = (s)=> s
    .replace(/[^\p{L}\p{N}]+/gu,' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const lower = (ws)=> ws.map(w=> w.toLowerCase());

  const bigrams = (words)=> {
    const out = [];
    for(let i=0;i<words.length-1;i++) out.push(words[i]+" "+words[i+1]);
    return out;
  };

  const violates = (title)=> {
    const ws = normalize(title);
    const lc = lower(ws);
    if(!ws.length) return true;

    // no duplicate adjacent words inside one title
    for(let i=0;i<lc.length-1;i++){
      if(lc[i]===lc[i+1]) return true;
    }
    // any bigram seen before globally?
    const b = bigrams(lc);
    for(const bg of b){ if(__USED_BIGRAMS.has(bg)) return true; }

    return false;
  };

  const pickFrom = (r, arr)=> arr[r()%arr.length];

  // Word banks
  const A = __ADJ, N = __NOUN, H = __HOOK;
  const ARTISTS = [
    "The Silver Comets","Neon Parade","Paper Lanterns","Velvet Echoes","Indigo Quartet",
    "The Jet Set","Crimson Tide","Midnight Radio","Electric Hearts","Golden Hour",
    "The Amber Rooms","Violet Skyline","Satellite City","The Night Owls","Ivory Street Band",
    "Bluebird Company","Marble Garden","Velvet Undergrounders","Echo Park Players","Lantern Light",
    "Harbor & Co.","The Carousel Club","Kite & Canvas","Saffron Society","The Prairie Dogs"
  ];
  const PLAY_FORMS = [
    "Picture Show","Live on Stage","In Concert","Experience","Cabaret","Showcase",
    "Festival","Gala","Residency","Matinee","After Dark","Revue","Workshop"
  ];
  const STORY_OPENERS = [
    "Once Upon a Time","Into the Unknown","A Night to Remember","Between Two Worlds",
    "The Last Carousel","Dreams of Summer","Echoes in the Hall","Velvet Midnight",
    "The Paper Moon","Lanterns at Dusk","The Long Goodbye","Morning After Dark","Before the Storm"
  ];
  const TOUR_TAGS = ["Greatest Hits","Unplugged","Anniversary Tour","Acoustic Sessions","Late Night Set"];
  const PROMOS = ["One Night Only!","Two Nights Only!","One Weekend Only!","2 weeks only!!","Limited Season","Encore Performance"];

  const makeTitle = (r)=>{
    const templates = [
      ()=> `${pickFrom(r, ARTISTS)} Live on Stage`,
      ()=> `${pickFrom(r, ARTISTS)} — ${pickFrom(r, TOUR_TAGS)}`,
      ()=> `An Evening with ${pickFrom(r, ARTISTS)}`,
      ()=> `The ${pickFrom(r, N)} ${pickFrom(r, PLAY_FORMS)}`,
      ()=> `The ${pickFrom(r, A)} ${pickFrom(r, N)}`,
      ()=> `${pickFrom(r, A)} ${pickFrom(r, N)} ${pickFrom(r, H)}`,
      ()=> `${pickFrom(r, STORY_OPENERS)}`,
      ()=> `${pickFrom(r, A)} ${pickFrom(r, N)}: ${pickFrom(r, H)}`,
      ()=> `${pickFrom(r, A)} ${pickFrom(r, N)} ${pickFrom(r, PLAY_FORMS)}`,
      ()=> `${pickFrom(r, N)} ${pickFrom(r, PLAY_FORMS)}`
    ];
    let t = templates[r()%templates.length]();
    if ((r()%4)===0) t += ` — ${pickFrom(r, PROMOS)}`;
    return t.replace(/\s+/g,' ').trim();
  };

  // Try multiple deterministic attempts with salted RNG until constraints satisfied
  let attempt = 0, title = "";
  for(; attempt < 96; attempt++){
    const r = __rng(base ^ (attempt * 1315423911));
    const candidate = makeTitle(r);
    if(!violates(candidate)){
      title = candidate;
      break;
    }
  }
  if(!title){ title = makeTitle(__rng(base ^ 0x9e3779b9)); } // fallback

  // Commit global constraints
  const ws = lower(normalize(title));
  for(let i=0;i<ws.length-1;i++){ __USED_BIGRAMS.add(ws[i]+" "+ws[i+1]); }

  return title;
}function pick(arr){ return arr[Math.floor(rnd()*arr.length)]; }
    function jitter([lng,lat]){ return [lng + (rnd()-0.5)*8, clamp(lat + (rnd()-0.5)*8,-80,80)]; }

  function toISODate(d){
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  window.toISODate = toISODate;

  function parseISODate(s){
    const [yy, mm, dd] = s.split('-').map(Number);
    return new Date(yy, mm - 1, dd);
  }

  const DAY_MS = 86400000;

  function generateEventBlocks(options={}){
    const {
      minBlocks = 1,
      maxBlocks = 3,
      allowPast = false,
      maxFutureDays = 180,
      upcomingBiasDays = 60,
      pastWindowDays = 60,
      maxSpanDays = 14
    } = options;
    const now = new Date();
    now.setHours(0,0,0,0);
    const normalizedMin = Math.max(1, Math.floor(minBlocks));
    const normalizedMax = Math.max(normalizedMin, Math.floor(maxBlocks));
    const blockTotal = normalizedMin + Math.floor(rnd() * (normalizedMax - normalizedMin + 1));
    const futureRange = Math.max(1, Math.floor(maxFutureDays));
    const biasRange = Math.max(1, Math.min(futureRange, Math.floor(upcomingBiasDays) || futureRange));
    const pastRange = Math.max(0, Math.floor(pastWindowDays));
    const blocks = [];
    for(let i=0;i<blockTotal;i++){
      let offsetDays = 0;
      if(allowPast && pastRange > 0 && rnd() < 0.22){
        offsetDays = -Math.floor(rnd() * pastRange);
      } else {
        const roll = rnd();
        if(roll < 0.7){
          offsetDays = Math.floor(rnd() * biasRange);
        } else if(roll < 0.9){
          const midRange = Math.max(biasRange, Math.floor(futureRange * 0.65));
          offsetDays = Math.floor(rnd() * Math.min(futureRange, midRange));
        } else {
          offsetDays = Math.floor(rnd() * futureRange);
        }
      }
      if(!allowPast && offsetDays < 0){
        offsetDays = 0;
      }
      const span = 1 + Math.floor(rnd() * Math.max(1, Math.floor(maxSpanDays)));
      const start = new Date(now.getTime() + offsetDays * DAY_MS);
      start.setHours(0,0,0,0);
      blocks.push({ start, spanDays: span });
    }
    blocks.sort((a,b)=> a.start - b.start);
    return blocks;
  }

  function pickBlockOffsets(spanDays){
    const totalDays = Math.max(1, Math.floor(spanDays));
    const offsets = new Set();
    if(totalDays <= 1){
      offsets.add(0);
      return Array.from(offsets);
    }
    const densityRoll = rnd();
    let target;
    if(densityRoll < 0.25){
      target = 1 + Math.floor(rnd() * Math.min(2, totalDays));
    } else if(densityRoll < 0.6){
      target = Math.min(totalDays, 2 + Math.floor(rnd() * Math.min(3, totalDays - 1)));
    } else if(densityRoll < 0.85){
      target = Math.min(totalDays, Math.max(2, Math.round(totalDays * (0.5 + rnd() * 0.4))));
    } else {
      target = Math.min(totalDays, Math.max(3, Math.round(totalDays * (0.75 + rnd() * 0.6))));
    }
    target = Math.max(1, Math.min(totalDays, target));
    while(offsets.size < target){
      offsets.add(Math.floor(rnd() * totalDays));
      if(offsets.size >= totalDays){
        break;
      }
    }
    return Array.from(offsets).sort((a,b)=> a - b);
  }

  function randomSessionTime(){
    const slot = rnd();
    let hour;
    if(slot < 0.15){
      hour = 10 + Math.floor(rnd() * 3); // late morning
    } else if(slot < 0.8){
      hour = 18 + Math.floor(rnd() * 4); // evening shows
    } else if(slot < 0.9){
      hour = 14 + Math.floor(rnd() * 4); // matinees
    } else {
      hour = 12 + Math.floor(rnd() * 6); // afternoon variety
    }
    const minute = Math.floor(rnd() * 4) * 15;
    return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  }

  function generateSessionsFromBlocks(blocks, options={}){
    const allowEmptyBlocks = options.allowEmptyBlocks !== false;
    const emptyBlockChance = typeof options.emptyBlockChance === 'number'
      ? Math.min(Math.max(options.emptyBlockChance, 0), 1)
      : 0.2;
    const ensureAtLeastOne = options.ensureAtLeastOne === true;
    const allowDoubleSessions = options.allowDoubleSessions !== false;
    const generator = typeof options.timeGenerator === 'function' ? options.timeGenerator : randomSessionTime;
    const sessions = [];
    blocks.forEach((block, blockIndex) => {
      if(!block || !(block.start instanceof Date)){
        return;
      }
      if(allowEmptyBlocks && rnd() < emptyBlockChance && blockIndex !== 0){
        return;
      }
      const offsets = pickBlockOffsets(block.spanDays);
      offsets.forEach(offset => {
        const sessionDate = new Date(block.start.getTime() + offset * DAY_MS);
        sessionDate.setHours(0,0,0,0);
        const full = toISODate(sessionDate);
        const dateLabel = sessionDate
          .toLocaleDateString('en-GB',{weekday:'short', day:'numeric', month:'short'})
          .replace(/,/g,'');
        const time = generator({ block, offset, date: sessionDate });
        sessions.push({ date: dateLabel, time, full });
        if(allowDoubleSessions && rnd() < 0.08){
          let extraTime = generator({ block, offset, date: sessionDate, variant: 'double' });
          if(extraTime === time){
            extraTime = randomSessionTime();
          }
          sessions.push({ date: dateLabel, time: extraTime, full });
        }
      });
    });
    if(ensureAtLeastOne && !sessions.length){
      const fallbackDate = new Date();
      fallbackDate.setHours(0,0,0,0);
      const full = toISODate(fallbackDate);
      const dateLabel = fallbackDate
        .toLocaleDateString('en-GB',{weekday:'short', day:'numeric', month:'short'})
        .replace(/,/g,'');
      const time = generator({ fallback: true, date: fallbackDate });
      sessions.push({ date: dateLabel, time, full });
    }
    sessions.sort((a,b)=> a.full.localeCompare(b.full) || a.time.localeCompare(b.time));
    return sessions;
  }

  function randomDates(){
    const blocks = generateEventBlocks({
      minBlocks: 1,
      maxBlocks: 3,
      allowPast: false,
      maxFutureDays: 180,
      upcomingBiasDays: 120,
      maxSpanDays: 14
    });
    const sessions = generateSessionsFromBlocks(blocks, {
      allowEmptyBlocks: false,
      ensureAtLeastOne: true,
      allowDoubleSessions: false
    });
    const isoSet = new Set();
    sessions.forEach(entry => {
      if(entry && entry.full){
        isoSet.add(entry.full);
      }
    });
    if(!isoSet.size){
      isoSet.add(toISODate(new Date()));
    }
    return Array.from(isoSet).sort();
  }

  function randomSchedule(){
    const blocks = generateEventBlocks({
      minBlocks: 1,
      maxBlocks: 3,
      allowPast: true,
      pastWindowDays: 75,
      maxFutureDays: 180,
      upcomingBiasDays: 60,
      maxSpanDays: 14
    });
    return generateSessionsFromBlocks(blocks, {
      allowEmptyBlocks: true,
      emptyBlockChance: 0.25,
      ensureAtLeastOne: true,
      allowDoubleSessions: true,
      timeGenerator: randomSessionTime
    });
  }

  function derivePostDatesFromLocations(locations){
    if(!Array.isArray(locations) || !locations.length){
      return [];
    }
    const seen = new Set();
    locations.forEach(loc => {
      if(!loc) return;
      const schedule = Array.isArray(loc.dates) ? loc.dates : [];
      schedule.forEach(entry => {
        if(!entry) return;
        if(typeof entry === 'string'){
          const trimmed = entry.trim();
          if(trimmed) seen.add(trimmed);
          return;
        }
        if(entry.full){
          const normalized = String(entry.full).trim();
          if(normalized) seen.add(normalized);
        }
      });
    });
    return Array.from(seen).sort();
  }

  function normalizeLongitude(value){
    if(!Number.isFinite(value)) value = 0;
    const normalized = ((value + 180) % 360 + 360) % 360 - 180;
    return Number.isFinite(normalized) ? normalized : 0;
  }

  function clampLatitude(value){
    if(!Number.isFinite(value)) return 0;
    return Math.max(-85, Math.min(85, value));
  }

  function safeCoordinate(city, baseLng=0, baseLat=0, radius=0){
    const centerLng = Number.isFinite(baseLng) ? baseLng : 0;
    const centerLat = Number.isFinite(baseLat) ? baseLat : 0;
    const spread = Math.max(Number.isFinite(radius) ? radius : 0, 0);

    let lng = centerLng;
    let lat = centerLat;

    if(spread > 0){
      const distance = Math.sqrt(rnd()) * spread;
      const angle = rnd() * Math.PI * 2;
      lng += Math.cos(angle) * distance;
      lat += Math.sin(angle) * distance;
    }

    return {
      lng: normalizeLongitude(lng),
      lat: clampLatitude(lat)
    };
  }

  function createRandomLocation(city, baseLng=0, baseLat=0, options={}){
    const defaultRadius = 0.05;
    const radius = Number.isFinite(options.radius) ? Math.max(options.radius, 0) : defaultRadius;
    const coord = safeCoordinate(city, baseLng, baseLat, radius);
    const venueName = options.name || city || 'Event Venue';
    const address = options.address || city || '';
    return {
      venue: venueName,
      address,
      lng: coord.lng,
      lat: coord.lat,
      dates: randomSchedule(),
      price: randomPriceRange()
    };
  }

  const LOCAL_GEOCODER_MAX_RESULTS = 10;
  const localVenueIndex = [];
  const localVenueKeySet = new Set();
  const LOCAL_VENUE_PLACE_TYPES = Object.freeze(['poi', 'venue']);
  const MULTI_VENUE_COORD_PRECISION = 6;
  window.postsAtVenue = window.postsAtVenue && typeof window.postsAtVenue === 'object'
    ? window.postsAtVenue
    : Object.create(null);

  function getPostsAtVenueStore(){
    if(!window.postsAtVenue || typeof window.postsAtVenue !== 'object'){
      window.postsAtVenue = Object.create(null);
    }
    return window.postsAtVenue;
  }

  function toVenueCoordKey(lng, lat){
    if(!Number.isFinite(lng) || !Number.isFinite(lat)) return '';
    const normalizedLng = Number(lng).toFixed(MULTI_VENUE_COORD_PRECISION);
    const normalizedLat = Number(lat).toFixed(MULTI_VENUE_COORD_PRECISION);
    return `${normalizedLng},${normalizedLat}`;
  }

  function clearPostsAtVenueIndex(){
    const store = getPostsAtVenueStore();
    Object.keys(store).forEach(key => { delete store[key]; });
  }

  function registerPostAtVenue(post, key){
    if(!key) return;
    const store = getPostsAtVenueStore();
    const bucket = store[key] || (store[key] = []);
    if(!bucket.some(item => item && item.id === post.id)){
      bucket.push(post);
    }
  }

  function getPostsAtVenueByCoords(lng, lat){
    const key = toVenueCoordKey(lng, lat);
    if(!key) return [];
    const store = getPostsAtVenueStore();
    const bucket = store[key];
    return Array.isArray(bucket) ? bucket.slice() : [];
  }

  window.getPostsAtVenueByCoords = getPostsAtVenueByCoords;

  function localVenueKey(name='', address='', lng, lat){
    const normName = (name || '').toLowerCase();
    const normAddr = (address || '').toLowerCase();
    const normLng = Number.isFinite(lng) ? lng.toFixed(6) : '';
    const normLat = Number.isFinite(lat) ? lat.toFixed(6) : '';
    return `${normName}|${normAddr}|${normLng}|${normLat}`;
  }

  function cloneGeocoderFeature(feature){
    return {
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: Array.isArray(feature.geometry?.coordinates)
          ? feature.geometry.coordinates.slice()
          : []
      },
      center: Array.isArray(feature.center) ? feature.center.slice() : [],
      properties: {
        ...(feature.properties || {})
      }
    };
  }
  // Expose for member-forms.js usage
  if(typeof window !== 'undefined'){
    window.cloneGeocoderFeature = cloneGeocoderFeature;
  }

  function addVenueToLocalIndex({ name, address, lng, lat, city }){
    if(!name || !Number.isFinite(lng) || !Number.isFinite(lat)) return;
    const key = localVenueKey(name, address, lng, lat);
    if(localVenueKeySet.has(key)) return;
    localVenueKeySet.add(key);
    const contextParts = [address, city].filter(Boolean);
    const placeName = contextParts.length ? `${name} — ${contextParts.join(', ')}` : name;
    const searchText = [name, address, city].filter(Boolean).join(' ').toLowerCase();
    localVenueIndex.push({
      search: searchText,
      feature: {
        type:'Feature',
        geometry:{ type:'Point', coordinates:[lng, lat] },
        center:[lng, lat],
        place_name: placeName,
        text: name,
        place_type: LOCAL_VENUE_PLACE_TYPES.slice(),
        properties:{
          name,
          address: address || '',
          city: city || '',
          source:'local-venue'
        }
      }
    });
  }

  function rebuildVenueIndex(){
    localVenueIndex.length = 0;
    localVenueKeySet.clear();
    clearPostsAtVenueIndex();
    const postList = Array.isArray(posts) ? posts : [];
    const addFromPost = (post) => {
      if(!post) return;
      const city = post.city || '';
      const fallbackName = getPrimaryVenueName(post) || city;
      const fallbackAddress = city || post.city || '';
      const seenVenueKeys = new Set();
      const addVenue = (lng, lat, locName, locAddress) => {
        if(!Number.isFinite(lng) || !Number.isFinite(lat)) return;
        const nameValue = locName || fallbackName;
        const addressValue = locAddress || fallbackAddress;
        addVenueToLocalIndex({ name: nameValue, address: addressValue, lng, lat, city });
        const key = toVenueCoordKey(lng, lat);
        if(!key || seenVenueKeys.has(key)) return;
        seenVenueKeys.add(key);
        registerPostAtVenue(post, key);
      };
      if(Array.isArray(post.locations) && post.locations.length){
        post.locations.forEach(loc => {
          if(!loc) return;
          addVenue(loc.lng, loc.lat, loc.venue, loc.address);
        });
        return;
      }
      addVenue(post.lng, post.lat, fallbackName, fallbackAddress);
    };
    postList.forEach(addFromPost);
  }

  function searchLocalVenues(query){
    const normalized = (query || '').toLowerCase().trim();
    if(!normalized) return [];
    const terms = normalized.split(/\s+/).filter(Boolean);
    if(!terms.length) return [];
    const matches = [];
    for(const entry of localVenueIndex){
      const haystack = entry.search;
      let score = 0;
      let valid = true;
      for(const term of terms){
        const idx = haystack.indexOf(term);
        if(idx === -1){
          valid = false;
          break;
        }
        score += 1 / (1 + idx);
      }
      if(valid){
        matches.push({ entry, score });
      }
    }
    matches.sort((a,b)=> b.score - a.score);
    return matches.slice(0, LOCAL_GEOCODER_MAX_RESULTS).map(item => {
      const feature = cloneGeocoderFeature(item.entry.feature);
      feature.relevance = Math.min(1, item.score);
      return feature;
    });
  }

  const localVenueGeocoder = (query) => searchLocalVenues(query);
  // Expose to window for member-forms.js access
  if(typeof window !== 'undefined'){
    window.searchLocalVenues = searchLocalVenues;
    window.localVenueGeocoder = localVenueGeocoder;
  }

  const MAPBOX_VENUE_ENDPOINT = 'https://api.mapbox.com/geocoding/v5/mapbox.places/';
  window.MAPBOX_VENUE_ENDPOINT = MAPBOX_VENUE_ENDPOINT;
  const MAPBOX_VENUE_CACHE_LIMIT = 40;
  const MAPBOX_VENUE_MIN_QUERY = 2;
  const mapboxVenueCache = new Map();

  function mapboxVenueCacheKey(query, options={}){
    const normalized = (query || '').trim().toLowerCase();
    const limit = Number.isFinite(options.limit) ? options.limit : 0;
    const types = typeof options.types === 'string' ? options.types : '';
    const prox = options.proximity && Number.isFinite(options.proximity.longitude) && Number.isFinite(options.proximity.latitude)
      ? `${options.proximity.longitude.toFixed(3)},${options.proximity.latitude.toFixed(3)}`
      : '';
    const language = typeof options.language === 'string' ? options.language : '';
    const country = typeof options.country === 'string' ? options.country : '';
    const bbox = Array.isArray(options.bbox) ? options.bbox.join(',') : '';
    return [normalized, limit, types, prox, language, country, bbox].join('|');
  }

  function rememberMapboxVenueResult(key, features){
    if(!key) return;
    try{
      mapboxVenueCache.set(key, features);
      if(mapboxVenueCache.size > MAPBOX_VENUE_CACHE_LIMIT){
        const firstKey = mapboxVenueCache.keys().next().value;
        if(firstKey) mapboxVenueCache.delete(firstKey);
      }
    }catch(err){}
  }

  function getMapboxVenueFeatureCenter(feature){
    if(feature && Array.isArray(feature.center) && feature.center.length === 2){
      const [lng, lat] = feature.center;
      if(Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
    }
    const coords = feature && feature.geometry && Array.isArray(feature.geometry.coordinates)
      ? feature.geometry.coordinates
      : null;
    if(coords && coords.length >= 2){
      const [lng, lat] = coords;
      if(Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
    }
    return null;
  }
  // Expose for member-forms.js usage
  if(typeof window !== 'undefined'){
    window.getMapboxVenueFeatureCenter = getMapboxVenueFeatureCenter;
  }

  function normalizeMapboxVenueFeature(feature){
    if(!feature || typeof feature !== 'object') return null;
    const clone = cloneGeocoderFeature(feature);
    const center = getMapboxVenueFeatureCenter(clone);
    if(center){
      clone.center = center.slice();
      clone.geometry = clone.geometry || { type:'Point', coordinates:center.slice() };
      if(Array.isArray(clone.geometry.coordinates)){
        clone.geometry.coordinates[0] = center[0];
        clone.geometry.coordinates[1] = center[1];
      }
    }
    if(!Array.isArray(clone.place_type) || !clone.place_type.length){
      clone.place_type = Array.isArray(feature.place_type) && feature.place_type.length
        ? feature.place_type.slice()
        : ['poi'];
    }
    clone.properties = clone.properties || {};
    if(!clone.properties.name && typeof clone.text === 'string'){
      clone.properties.name = clone.text;
    }
    if(typeof feature.properties === 'object'){
      if(!clone.properties.address && typeof feature.properties.address === 'string'){
        clone.properties.address = feature.properties.address;
      }
      if(!clone.properties.category && typeof feature.properties.category === 'string'){
        clone.properties.category = feature.properties.category;
      }
    }
    if(!clone.properties.source){
      clone.properties.source = 'mapbox-places';
    }
    if(typeof clone.text !== 'string' && typeof feature.text === 'string'){
      clone.text = feature.text;
    }
    if(typeof clone.place_name !== 'string' && typeof feature.place_name === 'string'){
      clone.place_name = feature.place_name;
    }
    return clone;
  }

  const MAPBOX_SUPPORTED_VENUE_TYPES = ['poi','place','address'];

  const MAJOR_VENUE_PRIORITY_TYPES = [
    'country',
    'region',
    'district',
    'place',
    'locality',
    'neighborhood',
    'address'
  ];

  const MAJOR_VENUE_POI_KEYWORDS = [
    'airport',
    'international airport',
    'airfield',
    'railway station',
    'train station',
    'subway station',
    'metro station',
    'bus station',
    'bus terminal',
    'transit station',
    'ferry terminal',
    'cruise terminal',
    'harbor',
    'port',
    'stadium',
    'arena',
    'ballpark',
    'coliseum',
    'amphitheater',
    'amphitheatre',
    'convention center',
    'conference center',
    'exhibition center',
    'expo center',
    'landmark',
    'monument',
    'memorial',
    'tower',
    'bridge',
    'palace',
    'castle',
    'temple',
    'shrine',
    'cathedral',
    'church',
    'mosque',
    'synagogue',
    'basilica',
    'pagoda',
    'museum',
    'gallery',
    'art museum',
    'science museum',
    'science center',
    'observatory',
    'planetarium',
    'library',
    'university',
    'college',
    'campus',
    'school',
    'academy',
    'zoo',
    'aquarium',
    'botanical garden',
    'garden',
    'park',
    'national park',
    'state park',
    'theme park',
    'amusement park',
    'water park',
    'heritage site',
    'historic site',
    'world heritage',
    'city hall',
    'parliament',
    'government',
    'embassy',
    'consulate',
    'consulate general',
    'court',
    'plaza',
    'square',
    'cultural center',
    'performing arts',
    'concert hall',
    'opera house',
    'theatre',
    'theater',
    'music hall'
  ].map(keyword => keyword.toLowerCase());

  const MAJOR_VENUE_POI_MAKI = [
    'airport',
    'harbor',
    'harbour',
    'monument',
    'landmark',
    'castle',
    'town-hall',
    'museum',
    'park',
    'stadium',
    'rail',
    'college',
    'library',
    'zoo',
    'campsite'
  ];

  function isMajorVenuePoi(feature, placeTypes){
    const properties = (feature && feature.properties) ? feature.properties : {};
    if(properties.landmark === true) return true;
    if(placeTypes.includes('poi.landmark')) return true;
    const makiRaw = typeof properties.maki === 'string' ? properties.maki : '';
    const maki = makiRaw.toLowerCase();
    if(maki){
      if(MAJOR_VENUE_POI_MAKI.includes(maki) || maki.startsWith('religious')){
        return true;
      }
    }
    const category = typeof properties.category === 'string' ? properties.category.toLowerCase() : '';
    const name = typeof properties.name === 'string' ? properties.name.toLowerCase() : '';
    const text = typeof feature.text === 'string' ? feature.text.toLowerCase() : '';
    const placeName = typeof feature.place_name === 'string' ? feature.place_name.toLowerCase() : '';
    const haystack = [category, name, text, placeName].filter(Boolean).join(' ');
    if(!haystack) return false;
    return MAJOR_VENUE_POI_KEYWORDS.some(keyword => haystack.includes(keyword));
  }

  function majorVenueFilter(feature){
    if(!feature || typeof feature !== 'object') return false;
    const rawTypes = Array.isArray(feature.place_type) ? feature.place_type : [];
    const placeTypes = rawTypes.map(type => String(type || '').toLowerCase());
    if(placeTypes.some(type => MAJOR_VENUE_PRIORITY_TYPES.includes(type))){
      return true;
    }
    if(placeTypes.includes('poi') || placeTypes.includes('poi.landmark')){
      return isMajorVenuePoi(feature, placeTypes);
    }
    return false;
  }
  // Expose on window for admin.js access
  window.majorVenueFilter = majorVenueFilter;

  function normalizeMapboxVenueTypes(value, fallback='poi'){
    const rawList = Array.isArray(value)
      ? value
      : (typeof value === 'string' ? value.split(',') : []);
    const seen = new Set();
    const filtered = [];
    for(const entry of rawList){
      const trimmed = String(entry || '').trim();
      if(!trimmed) continue;
      if(MAPBOX_SUPPORTED_VENUE_TYPES.includes(trimmed) && !seen.has(trimmed)){
        seen.add(trimmed);
        filtered.push(trimmed);
      }
    }
    if(filtered.length > 0){
      return filtered.join(',');
    }
    if(typeof fallback === 'string' && fallback){
      return normalizeMapboxVenueTypes(fallback, '');
    }
    return '';
  }

  async function searchMapboxVenues(query, options={}){
    const normalized = (query || '').trim();
    if(!normalized || normalized.length < MAPBOX_VENUE_MIN_QUERY) return [];
    if(typeof MAPBOX_TOKEN !== 'string' || !MAPBOX_TOKEN){
      return [];
    }
    const limitRaw = Number.isFinite(options.limit) ? options.limit : 5;
    const limit = Math.max(1, Math.min(10, limitRaw));
    const types = normalizeMapboxVenueTypes(options.types, 'poi');
    const resolvedTypes = types || 'poi';
    const language = typeof options.language === 'string' && options.language ? options.language : '';
    const country = typeof options.country === 'string' && options.country ? options.country : '';
    const bbox = Array.isArray(options.bbox) ? options.bbox : null;
    const proximity = options.proximity && Number.isFinite(options.proximity.longitude) && Number.isFinite(options.proximity.latitude)
      ? { longitude: options.proximity.longitude, latitude: options.proximity.latitude }
      : null;
    const cacheKey = mapboxVenueCacheKey(normalized, { limit, types: resolvedTypes, proximity, language, country, bbox });
    if(mapboxVenueCache.has(cacheKey)){
      const cached = mapboxVenueCache.get(cacheKey);
      return Array.isArray(cached) ? cached.map(cloneGeocoderFeature) : [];
    }
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      autocomplete: 'true',
      types: resolvedTypes,
      limit: String(limit)
    });
    if(language) params.set('language', language);
    if(country) params.set('country', country);
    if(proximity){
      params.set('proximity', `${proximity.longitude},${proximity.latitude}`);
    }
    if(bbox && bbox.length === 4 && bbox.every(val => Number.isFinite(val))){
      params.set('bbox', bbox.join(','));
    }
    const url = `${MAPBOX_VENUE_ENDPOINT}${encodeURIComponent(normalized)}.json?${params.toString()}`;
    const fetchOptions = {};
    if(options.signal) fetchOptions.signal = options.signal;
    let data = null;
    try{
      const response = await fetch(url, fetchOptions);
      if(!response || !response.ok){
        return [];
      }
      data = await response.json();
    }catch(err){
      if(options.signal && options.signal.aborted){
        return [];
      }
      console.warn('Mapbox venue search failed', err);
      return [];
    }
    const features = Array.isArray(data && data.features) ? data.features : [];
    const normalizedResults = [];
    for(const feature of features){
      const normalizedFeature = normalizeMapboxVenueFeature(feature);
      const center = getMapboxVenueFeatureCenter(normalizedFeature);
      if(!normalizedFeature || !center) continue;
      normalizedResults.push(normalizedFeature);
    }
    rememberMapboxVenueResult(cacheKey, normalizedResults.map(cloneGeocoderFeature));
    return normalizedResults.map(cloneGeocoderFeature);
  }

  function externalMapboxVenueGeocoder(query){
    const contextOptions = (this && this.options) ? this.options : {};
    const limit = Number.isFinite(contextOptions.limit) ? contextOptions.limit : undefined;
    const proximity = contextOptions.proximity && typeof contextOptions.proximity === 'object'
      ? contextOptions.proximity
      : null;
    const language = contextOptions.language;
    const country = contextOptions.country;
    const bbox = contextOptions.bbox;
    const types = normalizeMapboxVenueTypes(contextOptions.types, 'poi');
    return searchMapboxVenues(query, { limit, proximity, language, country, bbox, types });
  }
  window.externalMapboxVenueGeocoder = externalMapboxVenueGeocoder;

  rebuildVenueIndex();

  function randomImages(id){
    const hero = heroUrl(id);
    const others = Array.from({length:9},(_,i)=>{
      const port = i % 2 === 0;
      return `https://picsum.photos/seed/${encodeURIComponent(id)}-${i}/${port?'800/1200':'1200/800'}`;
    });
    return [hero, ...others];
  }

  function randomText(min=50,max=200){
    const lorem = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua".split(' ');
    const count = min + Math.floor(rnd()*(max-min+1));
    const words = [];
    for(let i=0;i<count;i++){ words.push(lorem[i%lorem.length]); }
    words[0] = words[0][0].toUpperCase() + words[0].slice(1);
    return words.join(' ') + '.';
  }

  function randomPriceRange(){
    const low = 10 + Math.floor(rnd()*90);
    const high = low + 10 + Math.floor(rnd()*90);
    return `$${low} - $${high}`;
  }

  function randomUsername(seed){
    const names = ['Aria','Blake','Casey','Drew','Evan','Finn','Gray','Harper','Indie','Jules'];
    let h = 0; for(let i=0;i<seed.length;i++){ h = (h<<5)-h+seed.charCodeAt(i); }
    const name = names[Math.abs(h)%names.length];
    const num = Math.abs(Math.floor(h/7))%1000;
    return name + num;
  }

  function randomAvatar(seed){
    return `https://picsum.photos/seed/${encodeURIComponent(seed)}-a/100/100`;
  }

  function slugify(str){
    return str.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  }
  window.slugify = slugify;

  function postUrl(p){
    return `${BASE_URL}#/post/${p.slug}-${p.created}`;
  }

  async function showCopyMsg(btn){
    const cardHeader = btn && btn.closest('.post-card');
    if(!cardHeader) return;
    const msg = document.createElement('div');
    msg.className='copy-msg';
    const copyMsg = await getMessage('msg_link_copied', {}, false) || 'Link Copied';
    msg.textContent = copyMsg;
    cardHeader.appendChild(msg);
    const btnRect = btn.getBoundingClientRect();
    const headerRect = cardHeader.getBoundingClientRect();
    const msgRect = msg.getBoundingClientRect();
    msg.style.top = (btnRect.top - headerRect.top + (btnRect.height - msgRect.height)/2) + 'px';
    msg.style.left = (btnRect.left - headerRect.left - msgRect.width - 10) + 'px';
    requestAnimationFrame(()=>msg.classList.add('show'));
    setTimeout(()=>msg.remove(),1500);
  }

  function showCopyStyleMessage(text, target){
    if(!target || typeof target.getBoundingClientRect !== 'function') return null;
    const msg = document.createElement('div');
    msg.className = 'copy-msg';
    msg.textContent = text;
    document.body.appendChild(msg);

    let removed = false;
    const remove = ()=>{
      if(removed) return;
      removed = true;
      if(msg && msg.parentNode){
        msg.remove();
      }
    };

    const reposition = ()=>{
      if(!target || typeof target.getBoundingClientRect !== 'function'){
        remove();
        return;
      }
      if(document.body && !document.body.contains(target)){
        remove();
        return;
      }
      const rect = target.getBoundingClientRect();
      const msgRect = msg.getBoundingClientRect();
      const top = rect.top + window.scrollY + (rect.height - msgRect.height) / 2;
      const left = rect.left + window.scrollX + (rect.width - msgRect.width) / 2;
      msg.style.top = `${top}px`;
      msg.style.left = `${left}px`;
    };

    reposition();
    requestAnimationFrame(()=>{
      reposition();
      msg.classList.add('show');
    });

    return { element: msg, remove, reposition };
  }

function makePosts(){
  // OPTIMIZED: Reduced post counts for faster loading (was 1500+, now ~300)
  const out = [];
  const cityCounts = Object.create(null);
  const MAX_POSTS_PER_CITY = 200;
  const neighborhoodCache = new Map();
  const eligibleCategories = Array.isArray(categories)
    ? categories.filter(cat => cat && Array.isArray(cat.subs) && cat.subs.length)
    : [];

  const pickCategory = ()=> eligibleCategories.length ? pick(eligibleCategories) : null;
  const pickSubcategory = (cat)=> (cat && Array.isArray(cat.subs) && cat.subs.length)
    ? pick(cat.subs)
    : null;

  function pushPost(post){
    if(post && post.city){
      const key = String(post.city);
      cityCounts[key] = (cityCounts[key] || 0) + 1;
    }
    out.push(post);
  }

  function canAddCity(city){
    if(!city) return true;
    const key = String(city);
    return (cityCounts[key] || 0) < MAX_POSTS_PER_CITY;
  }

  function inlandShiftFor(lng){
    if(!Number.isFinite(lng)) return 0;
    if(lng < -90) return 0.012;
    if(lng < -30) return -0.012;
    if(lng >= 120) return -0.012;
    if(lng >= 60) return -0.009;
    if(lng >= 20) return -0.008;
    if(lng >= -10) return -0.006;
    return -0.01;
  }

  function buildNeighborhoods(city, baseLng, baseLat){
    const key = city || `${baseLng},${baseLat}`;
    if(neighborhoodCache.has(key)){
      return neighborhoodCache.get(key);
    }
    const latSign = Number.isFinite(baseLat) && baseLat < 0 ? -1 : 1;
    const lngShift = inlandShiftFor(baseLng);
    const neighborhoods = [
      { lng: normalizeLongitude(baseLng), lat: clampLatitude(baseLat) },
      { lng: normalizeLongitude(baseLng + lngShift), lat: clampLatitude(baseLat + 0.008 * latSign) },
      { lng: normalizeLongitude(baseLng + lngShift * 0.6), lat: clampLatitude(baseLat - 0.007 * latSign) },
      { lng: normalizeLongitude(baseLng + lngShift * -0.4), lat: clampLatitude(baseLat + 0.004 * latSign) }
    ];
    neighborhoodCache.set(key, neighborhoods);
    return neighborhoods;
  }

  function jitterNeighborhoodPoint(point){
    if(!point) return { lng: 0, lat: 0 };
    const jitterRange = 0.004;
    const lng = normalizeLongitude(point.lng + (rnd() - 0.5) * jitterRange * 2);
    const lat = clampLatitude(point.lat + (rnd() - 0.5) * jitterRange * 2);
    return { lng, lat };
  }
  // ---- OPTIMIZED: 30 posts at Federation Square (was 100) ----
  const fsLng = 144.9695, fsLat = -37.8178;
  const fsCity = "Federation Square, Melbourne";
  for(let i=0;i<30;i++){
    const cat = pickCategory();
    const sub = pickSubcategory(cat);
    if(!cat || !sub) continue;
    const id = 'FS'+i;
    const title = `${id} ${uniqueTitle(i*7777+13, fsCity, i)}`;
    const created = new Date().toISOString().replace(/[:.]/g,'-');
    const location = createRandomLocation(fsCity, fsLng, fsLat, {
      name: 'Federation Square',
      address: 'Swanston St & Flinders St, Melbourne VIC 3000, Australia',
      radius: 0.05
    });
    const locations = [location];
    pushPost({
      id,
      title,
      slug: slugify(title),
      created,
      city: fsCity,
      lng: location.lng, lat: location.lat,
      category: cat.name,
      subcategory: sub,
      dates: derivePostDatesFromLocations(locations),
      sponsored: true, // All posts are sponsored for development
      fav:false,
      desc: randomText(),
      images: randomImages(id),
      locations,
      member: { username: randomUsername(id), avatar: randomAvatar(id) },
    });
  }

  // ---- OPTIMIZED: 30 posts in Tasmania (was 100) ----
  const tasLng = 147.3272, tasLat = -42.8821;
  const tasCity = "Hobart, Tasmania";
  const todayTas = new Date(); todayTas.setHours(0,0,0,0);
  for(let i=0;i<30;i++){
    const cat = pickCategory();
    const sub = pickSubcategory(cat);
    if(!cat || !sub) continue;
    const id = 'TAS'+i;
    const title = `${id} ${uniqueTitle(i*5311+23, tasCity, i)}`;
    const created = new Date().toISOString().replace(/[:.]/g,'-');
    const offset = 1 + i%30;
    const date = new Date(todayTas);
    date.setDate(date.getDate() + (i<50 ? -offset : offset));
    const location = createRandomLocation(tasCity, tasLng, tasLat, { radius: 0.05 });
    const isoDate = toISODate(date);
    location.dates = [{
      date: date.toLocaleDateString('en-GB',{weekday:'short', day:'numeric', month:'short'}).replace(/,/g,''),
      time: '09:00',
      full: isoDate
    }];
    const locations = [location];
    pushPost({
      id,
      title,
      slug: slugify(title),
      created,
      city: tasCity,
      lng: location.lng,
      lat: location.lat,
      category: cat.name,
      subcategory: sub,
      dates: derivePostDatesFromLocations(locations),
      sponsored: true, // All posts are sponsored for development
      fav:false,
      desc: randomText(),
      images: randomImages(id),
      locations,
      member: { username: randomUsername(id), avatar: randomAvatar(id) },
    });
  }

  // ---- Restore world-wide posts ----
  // A light list of hub cities for better realism
  const hubs = [
    {c:"New York, USA",      lng:-73.9857, lat:40.7484},
    {c:"Los Angeles, USA",   lng:-118.2437, lat:34.0522},
    {c:"London, UK",         lng:-0.1276, lat:51.5074},
    {c:"Paris, France",      lng:2.3522, lat:48.8566},
    {c:"Berlin, Germany",    lng:13.4050, lat:52.5200},
    {c:"Madrid, Spain",      lng:-3.7038, lat:40.4168},
    {c:"Rome, Italy",        lng:12.4964, lat:41.9028},
    {c:"Amsterdam, NL",      lng:4.9041, lat:52.3676},
    {c:"Dublin, Ireland",    lng:-6.2603, lat:53.3498},
    {c:"Stockholm, Sweden",  lng:18.0686, lat:59.3293},
    {c:"Copenhagen, Denmark",lng:12.5683, lat:55.6761},
    {c:"Helsinki, Finland",  lng:24.9384, lat:60.1699},
    {c:"Oslo, Norway",       lng:10.7522, lat:59.9139},
    {c:"Reykjavík, Iceland", lng:-21.8277, lat:64.1265},
    {c:"Moscow, Russia",     lng:37.6173, lat:55.7558},
    {c:"Istanbul, Türkiye",  lng:28.9784, lat:41.0082},
    {c:"Athens, Greece",     lng:23.7275, lat:37.9838},
    {c:"Cairo, Egypt",       lng:31.2357, lat:30.0444},
    {c:"Nairobi, Kenya",     lng:36.8219, lat:-1.2921},
    {c:"Lagos, Nigeria",     lng:3.3792, lat:6.5244},
    {c:"Johannesburg, SA",   lng:28.0473, lat:-26.2041},
    {c:"Cape Town, SA",      lng:18.4241, lat:-33.9249},
    {c:"Dubai, UAE",         lng:55.2708, lat:25.2048},
    {c:"Mumbai, India",      lng:72.8777, lat:19.0760},
    {c:"Delhi, India",       lng:77.1025, lat:28.7041},
    {c:"Bangkok, Thailand",  lng:100.5018, lat:13.7563},
    {c:"Singapore",          lng:103.8198, lat:1.3521},
    {c:"Hong Kong, China",   lng:114.1694, lat:22.3193},
    {c:"Tokyo, Japan",       lng:139.6917, lat:35.6895},
    {c:"Seoul, South Korea", lng:126.9780, lat:37.5665},
    {c:"Sydney, Australia",  lng:151.2093, lat:-33.8688},
    {c:"Brisbane, Australia",lng:153.0251, lat:-27.4698},
    {c:"Auckland, New Zealand", lng:174.7633, lat:-36.8485},
    {c:"Toronto, Canada",    lng:-79.3832, lat:43.6532},
    {c:"Vancouver, Canada",  lng:-123.1207, lat:49.2827},
    {c:"Mexico City, Mexico",lng:-99.1332, lat:19.4326},
    {c:"São Paulo, Brazil",  lng:-46.6333, lat:-23.5505},
    {c:"Rio de Janeiro, Brazil", lng:-43.1729, lat:-22.9068},
    {c:"Buenos Aires, Argentina", lng:-58.3816, lat:-34.6037},
    {c:"Santiago, Chile",    lng:-70.6693, lat:-33.4489}
  ];

  // OPTIMIZED: Generate ~200 posts across hubs (was 900)
  const TOTAL_WORLD = 200;
  const worldCitySpecs = hubs.map(hub => ({
    city: hub.c,
    baseLng: hub.lng,
    baseLat: hub.lat,
    neighborhoods: buildNeighborhoods(hub.c, hub.lng, hub.lat),
    generated: 0
  }));
  const shufflePool = (pool)=>{
    if(!pool.length) return pool;
    const order = shuffledIndices(pool.length);
    return order.map(idx => pool[idx]);
  };
  let worldPool = shufflePool(worldCitySpecs.map((_, idx) => idx));
  let worldPoolIndex = 0;
  let worldProduced = 0;
  const WORLD_ATTEMPT_MAX = TOTAL_WORLD * 6;
  let worldAttempts = 0;
  while(worldProduced < TOTAL_WORLD && worldPool.length && worldAttempts < WORLD_ATTEMPT_MAX){
    if(worldPoolIndex >= worldPool.length){
      const available = worldPool.filter(idx => canAddCity(worldCitySpecs[idx].city));
      worldPool = shufflePool(available);
      worldPoolIndex = 0;
      if(!worldPool.length){
        break;
      }
    }
    const specIndex = worldPool[worldPoolIndex++];
    const spec = worldCitySpecs[specIndex];
    worldAttempts++;
    if(!spec || !canAddCity(spec.city)){
      continue;
    }
    const neighborhoods = spec.neighborhoods && spec.neighborhoods.length
      ? spec.neighborhoods
      : buildNeighborhoods(spec.city, spec.baseLng, spec.baseLat);
    const generation = spec.generated || 0;
    const basePoint = neighborhoods[generation % neighborhoods.length] || neighborhoods[0];
    spec.generated = generation + 1;
    const coords = jitterNeighborhoodPoint(basePoint);
    const cityLabel = typeof spec.city === 'string' ? spec.city.split(',')[0].trim() || spec.city : spec.city;
    const location = createRandomLocation(spec.city, coords.lng, coords.lat, {
      name: `${cityLabel} District ${((generation % neighborhoods.length) + 1)}`,
      address: spec.city,
      radius: 0
    });
    const locations = [location];
    const cat = pickCategory();
    const sub = pickSubcategory(cat);
    if(!cat || !sub) continue;
    const id = `WW${worldProduced}`;
    const title = `${id} ${uniqueTitle(worldProduced*9343+19, spec.city, worldProduced)}`;
    const created = new Date().toISOString().replace(/[:.]/g,'-');
    pushPost({
      id,
      title,
      slug: slugify(title),
      created,
      city: spec.city,
      lng: location.lng,
      lat: location.lat,
      category: cat.name,
      subcategory: sub,
      dates: derivePostDatesFromLocations(locations),
      sponsored: true, // All posts are sponsored for development
      fav:false,
      desc: randomText(),
      images: randomImages(id),
      locations,
      member: { username: randomUsername(id), avatar: randomAvatar(id) },
    });
    worldProduced++;
  }

  // ---- OPTIMIZED: 5 Sydney Opera House posts (was 10) ----
  const operaCity = 'Sydney, Australia';
  const operaVenueName = 'Sydney Opera House';
  const operaAddress = 'Bennelong Point, Sydney NSW 2000, Australia';
  const operaLng = 151.2153;
  const operaLat = -33.8568;
  for(let i=0;i<5;i++){
    const cat = pickCategory();
    const sub = pickSubcategory(cat);
    if(!cat || !sub) continue;
    const id = 'SOH'+i;
    const title = `${id} ${uniqueTitle(i*12007+7, operaCity, i)}`;
    const created = new Date().toISOString().replace(/[:.]/g,'-');
    const location = {
      venue: operaVenueName,
      address: operaAddress,
      lng: operaLng,
      lat: operaLat,
      dates: randomSchedule(),
      price: randomPriceRange()
    };
    const locations = [location];
    pushPost({
      id,
      title,
      slug: slugify(title),
      created,
      city: operaCity,
      lng: operaLng,
      lat: operaLat,
      category: cat.name,
      subcategory: sub,
      dates: derivePostDatesFromLocations(locations),
      sponsored: true, // All posts are sponsored for development
      fav:false,
      desc: randomText(),
      images: randomImages(id),
      locations,
      member: { username: randomUsername(id), avatar: randomAvatar(id) },
    });
  }

  // ---- OPTIMIZED: 100 single-venue posts (was 400) ----
  const coordKey = (lng, lat)=>{
    if(!Number.isFinite(lng) || !Number.isFinite(lat)) return '';
    return `${lng.toFixed(6)},${lat.toFixed(6)}`;
  };
  const existingCoordKeys = new Set(out.map(p => coordKey(p.lng, p.lat)).filter(Boolean));
  const singleVenueBases = [
    { city: "Anchorage, USA", lng: -149.9003, lat: 61.2181 },
    { city: "Honolulu, USA", lng: -157.8583, lat: 21.3069 },
    { city: "San Francisco, USA", lng: -122.4194, lat: 37.7749 },
    { city: "Seattle, USA", lng: -122.3321, lat: 47.6062 },
    { city: "Vancouver, Canada", lng: -123.1207, lat: 49.2827 },
    { city: "Calgary, Canada", lng: -114.0719, lat: 51.0447 },
    { city: "Toronto, Canada", lng: -79.3832, lat: 43.6532 },
    { city: "Montreal, Canada", lng: -73.5673, lat: 45.5017 },
    { city: "Boston, USA", lng: -71.0589, lat: 42.3601 },
    { city: "New Orleans, USA", lng: -90.0715, lat: 29.9511 },
    { city: "Chicago, USA", lng: -87.6298, lat: 41.8781 },
    { city: "Miami, USA", lng: -80.1918, lat: 25.7617 },
    { city: "Dallas, USA", lng: -96.7969, lat: 32.7767 },
    { city: "Denver, USA", lng: -104.9903, lat: 39.7392 },
    { city: "Phoenix, USA", lng: -112.0740, lat: 33.4484 },
    { city: "Los Angeles, USA", lng: -118.2437, lat: 34.0522 },
    { city: "Mexico City, Mexico", lng: -99.1332, lat: 19.4326 },
    { city: "Guadalajara, Mexico", lng: -103.3496, lat: 20.6597 },
    { city: "Bogotá, Colombia", lng: -74.0721, lat: 4.7110 },
    { city: "Lima, Peru", lng: -77.0428, lat: -12.0464 },
    { city: "Quito, Ecuador", lng: -78.4678, lat: -0.1807 },
    { city: "Santiago, Chile", lng: -70.6693, lat: -33.4489 },
    { city: "Buenos Aires, Argentina", lng: -58.3816, lat: -34.6037 },
    { city: "Montevideo, Uruguay", lng: -56.1645, lat: -34.9011 },
    { city: "São Paulo, Brazil", lng: -46.6333, lat: -23.5505 },
    { city: "Rio de Janeiro, Brazil", lng: -43.1729, lat: -22.9068 },
    { city: "Brasília, Brazil", lng: -47.8825, lat: -15.7942 },
    { city: "Recife, Brazil", lng: -34.8770, lat: -8.0476 },
    { city: "Fortaleza, Brazil", lng: -38.5434, lat: -3.7319 },
    { city: "Caracas, Venezuela", lng: -66.9036, lat: 10.4806 },
    { city: "San Juan, Puerto Rico", lng: -66.1057, lat: 18.4655 },
    { city: "Reykjavík, Iceland", lng: -21.8277, lat: 64.1265 },
    { city: "Oslo, Norway", lng: 10.7522, lat: 59.9139 },
    { city: "Stockholm, Sweden", lng: 18.0686, lat: 59.3293 },
    { city: "Helsinki, Finland", lng: 24.9384, lat: 60.1699 },
    { city: "Copenhagen, Denmark", lng: 12.5683, lat: 55.6761 },
    { city: "Edinburgh, UK", lng: -3.1883, lat: 55.9533 },
    { city: "Dublin, Ireland", lng: -6.2603, lat: 53.3498 },
    { city: "Glasgow, UK", lng: -4.2518, lat: 55.8642 },
    { city: "London, UK", lng: -0.1276, lat: 51.5074 },
    { city: "Manchester, UK", lng: -2.2426, lat: 53.4808 },
    { city: "Paris, France", lng: 2.3522, lat: 48.8566 },
    { city: "Lyon, France", lng: 4.8357, lat: 45.7640 },
    { city: "Marseille, France", lng: 5.3698, lat: 43.2965 },
    { city: "Madrid, Spain", lng: -3.7038, lat: 40.4168 },
    { city: "Barcelona, Spain", lng: 2.1734, lat: 41.3851 },
    { city: "Valencia, Spain", lng: -0.3763, lat: 39.4699 },
    { city: "Lisbon, Portugal", lng: -9.1393, lat: 38.7223 },
    { city: "Porto, Portugal", lng: -8.6291, lat: 41.1579 },
    { city: "Brussels, Belgium", lng: 4.3517, lat: 50.8503 },
    { city: "Amsterdam, Netherlands", lng: 4.9041, lat: 52.3676 },
    { city: "Rotterdam, Netherlands", lng: 4.4792, lat: 51.9244 },
    { city: "Berlin, Germany", lng: 13.4050, lat: 52.5200 },
    { city: "Hamburg, Germany", lng: 9.9937, lat: 53.5511 },
    { city: "Munich, Germany", lng: 11.5820, lat: 48.1351 },
    { city: "Frankfurt, Germany", lng: 8.6821, lat: 50.1109 },
    { city: "Prague, Czechia", lng: 14.4378, lat: 50.0755 },
    { city: "Vienna, Austria", lng: 16.3738, lat: 48.2082 },
    { city: "Zurich, Switzerland", lng: 8.5417, lat: 47.3769 },
    { city: "Warsaw, Poland", lng: 21.0122, lat: 52.2297 },
    { city: "Kraków, Poland", lng: 19.9440, lat: 50.0647 },
    { city: "Budapest, Hungary", lng: 19.0402, lat: 47.4979 },
    { city: "Bucharest, Romania", lng: 26.1025, lat: 44.4268 },
    { city: "Athens, Greece", lng: 23.7275, lat: 37.9838 },
    { city: "Istanbul, Türkiye", lng: 28.9784, lat: 41.0082 },
    { city: "Ankara, Türkiye", lng: 32.8597, lat: 39.9334 },
    { city: "Cairo, Egypt", lng: 31.2357, lat: 30.0444 },
    { city: "Casablanca, Morocco", lng: -7.5898, lat: 33.5731 },
    { city: "Marrakesh, Morocco", lng: -7.9811, lat: 31.6295 },
    { city: "Algiers, Algeria", lng: 3.0588, lat: 36.7538 },
    { city: "Tunis, Tunisia", lng: 10.1815, lat: 36.8065 },
    { city: "Tripoli, Libya", lng: 13.1913, lat: 32.8872 },
    { city: "Khartoum, Sudan", lng: 32.5599, lat: 15.5007 },
    { city: "Addis Ababa, Ethiopia", lng: 38.7578, lat: 8.9806 },
    { city: "Nairobi, Kenya", lng: 36.8219, lat: -1.2921 },
    { city: "Kampala, Uganda", lng: 32.5825, lat: 0.3476 },
    { city: "Dar es Salaam, Tanzania", lng: 39.2083, lat: -6.7924 },
    { city: "Kigali, Rwanda", lng: 30.0588, lat: -1.9499 },
    { city: "Lagos, Nigeria", lng: 3.3792, lat: 6.5244 },
    { city: "Accra, Ghana", lng: -0.1869, lat: 5.6037 },
    { city: "Abidjan, Côte d'Ivoire", lng: -4.0083, lat: 5.3599 },
    { city: "Dakar, Senegal", lng: -17.4731, lat: 14.7167 },
    { city: "Kinshasa, DR Congo", lng: 15.2663, lat: -4.4419 },
    { city: "Luanda, Angola", lng: 13.2344, lat: -8.8383 },
    { city: "Johannesburg, South Africa", lng: 28.0473, lat: -26.2041 },
    { city: "Cape Town, South Africa", lng: 18.4241, lat: -33.9249 },
    { city: "Windhoek, Namibia", lng: 17.0832, lat: -22.5609 },
    { city: "Gaborone, Botswana", lng: 25.9089, lat: -24.6282 },
    { city: "Harare, Zimbabwe", lng: 31.0530, lat: -17.8249 },
    { city: "Maputo, Mozambique", lng: 32.5732, lat: -25.9692 },
    { city: "Riyadh, Saudi Arabia", lng: 46.6753, lat: 24.7136 },
    { city: "Jeddah, Saudi Arabia", lng: 39.1979, lat: 21.4858 },
    { city: "Doha, Qatar", lng: 51.5310, lat: 25.2854 },
    { city: "Dubai, UAE", lng: 55.2708, lat: 25.2048 },
    { city: "Muscat, Oman", lng: 58.4059, lat: 23.5859 },
    { city: "Kuwait City, Kuwait", lng: 47.9783, lat: 29.3759 },
    { city: "Manama, Bahrain", lng: 50.5861, lat: 26.2285 },
    { city: "Tehran, Iran", lng: 51.3890, lat: 35.6892 },
    { city: "Baghdad, Iraq", lng: 44.3661, lat: 33.3152 },
    { city: "Amman, Jordan", lng: 35.9239, lat: 31.9522 },
    { city: "Beirut, Lebanon", lng: 35.5018, lat: 33.8938 },
    { city: "Jerusalem", lng: 35.2137, lat: 31.7683 },
    { city: "Mumbai, India", lng: 72.8777, lat: 19.0760 },
    { city: "Delhi, India", lng: 77.1025, lat: 28.7041 },
    { city: "Bengaluru, India", lng: 77.5946, lat: 12.9716 },
    { city: "Hyderabad, India", lng: 78.4867, lat: 17.3850 },
    { city: "Chennai, India", lng: 80.2707, lat: 13.0827 },
    { city: "Kolkata, India", lng: 88.3639, lat: 22.5726 },
    { city: "Kathmandu, Nepal", lng: 85.3240, lat: 27.7172 },
    { city: "Dhaka, Bangladesh", lng: 90.4125, lat: 23.8103 },
    { city: "Colombo, Sri Lanka", lng: 79.8612, lat: 6.9271 },
    { city: "Bangkok, Thailand", lng: 100.5018, lat: 13.7563 },
    { city: "Chiang Mai, Thailand", lng: 98.9931, lat: 18.7883 },
    { city: "Vientiane, Laos", lng: 102.6341, lat: 17.9757 },
    { city: "Phnom Penh, Cambodia", lng: 104.9282, lat: 11.5564 },
    { city: "Ho Chi Minh City, Vietnam", lng: 106.6297, lat: 10.8231 },
    { city: "Hanoi, Vietnam", lng: 105.8342, lat: 21.0278 },
    { city: "Yangon, Myanmar", lng: 96.1951, lat: 16.8409 },
    { city: "Singapore", lng: 103.8198, lat: 1.3521 },
    { city: "Kuala Lumpur, Malaysia", lng: 101.6869, lat: 3.1390 },
    { city: "Jakarta, Indonesia", lng: 106.8456, lat: -6.2088 },
    { city: "Surabaya, Indonesia", lng: 112.7521, lat: -7.2575 },
    { city: "Manila, Philippines", lng: 120.9842, lat: 14.5995 },
    { city: "Cebu, Philippines", lng: 123.8854, lat: 10.3157 },
    { city: "Hong Kong", lng: 114.1694, lat: 22.3193 },
    { city: "Macau", lng: 113.5439, lat: 22.1987 },
    { city: "Taipei, Taiwan", lng: 121.5654, lat: 25.0330 },
    { city: "Seoul, South Korea", lng: 126.9780, lat: 37.5665 },
    { city: "Busan, South Korea", lng: 129.0756, lat: 35.1796 },
    { city: "Tokyo, Japan", lng: 139.6917, lat: 35.6895 },
    { city: "Osaka, Japan", lng: 135.5023, lat: 34.6937 },
    { city: "Nagoya, Japan", lng: 136.9066, lat: 35.1815 },
    { city: "Sapporo, Japan", lng: 141.3544, lat: 43.0618 },
    { city: "Beijing, China", lng: 116.4074, lat: 39.9042 },
    { city: "Shanghai, China", lng: 121.4737, lat: 31.2304 },
    { city: "Guangzhou, China", lng: 113.2644, lat: 23.1291 },
    { city: "Shenzhen, China", lng: 114.0579, lat: 22.5431 },
    { city: "Chengdu, China", lng: 104.0665, lat: 30.5728 },
    { city: "Xi'an, China", lng: 108.9398, lat: 34.3416 },
    { city: "Ulaanbaatar, Mongolia", lng: 106.9057, lat: 47.8864 },
    { city: "Almaty, Kazakhstan", lng: 76.8860, lat: 43.2389 },
    { city: "Bishkek, Kyrgyzstan", lng: 74.5698, lat: 42.8746 },
    { city: "Tashkent, Uzbekistan", lng: 69.2401, lat: 41.2995 },
    { city: "Astana, Kazakhstan", lng: 71.4704, lat: 51.1605 },
    { city: "Moscow, Russia", lng: 37.6173, lat: 55.7558 },
    { city: "Saint Petersburg, Russia", lng: 30.3351, lat: 59.9343 },
    { city: "Novosibirsk, Russia", lng: 82.9346, lat: 55.0084 },
    { city: "Yekaterinburg, Russia", lng: 60.5975, lat: 56.8389 },
    { city: "Perth, Australia", lng: 115.8575, lat: -31.9505 },
    { city: "Adelaide, Australia", lng: 138.6007, lat: -34.9285 },
    { city: "Melbourne, Australia", lng: 144.9631, lat: -37.8136 },
    { city: "Sydney, Australia", lng: 151.2093, lat: -33.8688 },
    { city: "Brisbane, Australia", lng: 153.0251, lat: -27.4698 },
    { city: "Hobart, Australia", lng: 147.3272, lat: -42.8821 },
    { city: "Auckland, New Zealand", lng: 174.7633, lat: -36.8485 },
    { city: "Wellington, New Zealand", lng: 174.7762, lat: -41.2865 },
    { city: "Christchurch, New Zealand", lng: 172.6362, lat: -43.5321 },
    { city: "Suva, Fiji", lng: 178.4419, lat: -18.1248 }
  ];
  const SINGLE_VENUE_POSTS = 100;
  const singleVenueSpecs = singleVenueBases.map(base => ({
    city: base.city,
    baseLng: base.lng,
    baseLat: base.lat,
    neighborhoods: buildNeighborhoods(base.city, base.lng, base.lat),
    generated: 0
  }));
  let singlePool = shufflePool(singleVenueSpecs.map((_, idx) => idx));
  let singlePoolIndex = 0;
  let singleProduced = 0;
  const SINGLE_ATTEMPT_MAX = SINGLE_VENUE_POSTS * 8;
  let singleAttempts = 0;
  while(singleProduced < SINGLE_VENUE_POSTS && singlePool.length && singleAttempts < SINGLE_ATTEMPT_MAX){
    if(singlePoolIndex >= singlePool.length){
      const available = singlePool.filter(idx => canAddCity(singleVenueSpecs[idx].city));
      singlePool = shufflePool(available);
      singlePoolIndex = 0;
      if(!singlePool.length){
        break;
      }
    }
    const specIndex = singlePool[singlePoolIndex++];
    const spec = singleVenueSpecs[specIndex];
    singleAttempts++;
    if(!spec || !canAddCity(spec.city)){
      continue;
    }
    const neighborhoods = spec.neighborhoods && spec.neighborhoods.length
      ? spec.neighborhoods
      : buildNeighborhoods(spec.city, spec.baseLng, spec.baseLat);
    const generation = spec.generated || 0;
    const venueIndex = generation % neighborhoods.length;
    const cycle = Math.floor(generation / neighborhoods.length) + 1;
    spec.generated = generation + 1;
    const basePoint = neighborhoods[venueIndex] || neighborhoods[0];
    let coords = jitterNeighborhoodPoint(basePoint);
    let key = coordKey(coords.lng, coords.lat);
    let coordAttempts = 0;
    while((!key || existingCoordKeys.has(key)) && coordAttempts < 20){
      coords = jitterNeighborhoodPoint(basePoint);
      key = coordKey(coords.lng, coords.lat);
      coordAttempts++;
    }
    if(!key || existingCoordKeys.has(key)){
      continue;
    }
    const venueName = `${spec.city} Solo Venue ${cycle}-${venueIndex + 1}`;
    const locationDetail = createRandomLocation(spec.city, coords.lng, coords.lat, {
      name: venueName,
      address: spec.city,
      radius: 0
    });
    const locations = [locationDetail];
    const finalKey = coordKey(locationDetail.lng, locationDetail.lat);
    if(finalKey){
      existingCoordKeys.add(finalKey);
    }
    const cat = pickCategory();
    const sub = pickSubcategory(cat);
    if(!cat || !sub) continue;
    const id = `SV${singleProduced}`;
    const title = `${id} ${uniqueTitle(singleProduced*48271+131, spec.city, singleProduced)}`;
    const created = new Date().toISOString().replace(/[:.]/g,'-');
    pushPost({
      id,
      title,
      slug: slugify(title),
      created,
      city: spec.city,
      lng: locationDetail.lng,
      lat: locationDetail.lat,
      category: cat.name,
      subcategory: sub,
      dates: derivePostDatesFromLocations(locations),
      sponsored: true, // All posts are sponsored for development
      fav:false,
      desc: randomText(),
      images: randomImages(id),
      locations,
      member: { username: randomUsername(id), avatar: randomAvatar(id) },
    });
    singleProduced++;
  }

  const MIN_MULTI_VENUE_DISTANCE_KM = 50;
  const MAX_MULTI_VENUE_DISTANCE_KM = 4000;
  const EARTH_RADIUS_KM = 6371;

  function toRadians(degrees){
    return (Number.isFinite(degrees) ? degrees : 0) * Math.PI / 180;
  }

  function haversineDistanceKm(a, b){
    if(!a || !b) return Infinity;
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);
    const dLat = toRadians(b.lat - a.lat);
    const dLng = toRadians(b.lng - a.lng);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const chord = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    const clampChord = Math.min(1, Math.max(0, chord));
    return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(clampChord), Math.sqrt(1 - clampChord));
  }

  function buildMultiVenuePool(){
    const cityLookup = singleVenueBases.reduce((acc, base)=>{
      if(!base || !base.city) return acc;
      if(Number.isFinite(base.lng) && Number.isFinite(base.lat)){
        acc[base.city] = { lng: base.lng, lat: base.lat };
      }
      return acc;
    }, Object.create(null));

    const MULTI_REGION_CITY_LISTS = [
      {
        region: 'North America',
        cityNames: [
          'Anchorage, USA',
          'Honolulu, USA',
          'San Francisco, USA',
          'Seattle, USA',
          'Vancouver, Canada',
          'Calgary, Canada',
          'Toronto, Canada',
          'Montreal, Canada',
          'Boston, USA',
          'New Orleans, USA',
          'Chicago, USA',
          'Miami, USA',
          'Dallas, USA',
          'Denver, USA',
          'Phoenix, USA',
          'Los Angeles, USA'
        ]
      },
      {
        region: 'Central & South America',
        cityNames: [
          'Mexico City, Mexico',
          'Guadalajara, Mexico',
          'Bogotá, Colombia',
          'Lima, Peru',
          'Quito, Ecuador',
          'Santiago, Chile',
          'Buenos Aires, Argentina',
          'Montevideo, Uruguay',
          'São Paulo, Brazil',
          'Rio de Janeiro, Brazil',
          'Brasília, Brazil',
          'Recife, Brazil',
          'Fortaleza, Brazil',
          'Caracas, Venezuela',
          'San Juan, Puerto Rico'
        ]
      },
      {
        region: 'Europe',
        cityNames: [
          'Reykjavík, Iceland',
          'Oslo, Norway',
          'Stockholm, Sweden',
          'Helsinki, Finland',
          'Copenhagen, Denmark',
          'Edinburgh, UK',
          'Dublin, Ireland',
          'Glasgow, UK',
          'London, UK',
          'Manchester, UK',
          'Paris, France',
          'Lyon, France',
          'Marseille, France',
          'Madrid, Spain',
          'Barcelona, Spain',
          'Valencia, Spain',
          'Lisbon, Portugal',
          'Berlin, Germany',
          'Hamburg, Germany',
          'Munich, Germany',
          'Frankfurt, Germany',
          'Prague, Czechia',
          'Vienna, Austria',
          'Zurich, Switzerland',
          'Warsaw, Poland',
          'Kraków, Poland',
          'Budapest, Hungary',
          'Bucharest, Romania',
          'Athens, Greece'
        ]
      },
      {
        region: 'Africa',
        cityNames: [
          'Cairo, Egypt',
          'Casablanca, Morocco',
          'Marrakesh, Morocco',
          'Algiers, Algeria',
          'Tunis, Tunisia',
          'Tripoli, Libya',
          'Khartoum, Sudan',
          'Addis Ababa, Ethiopia',
          'Nairobi, Kenya',
          'Kampala, Uganda',
          'Dar es Salaam, Tanzania',
          'Kigali, Rwanda',
          'Lagos, Nigeria',
          'Accra, Ghana',
          "Abidjan, Côte d'Ivoire",
          'Dakar, Senegal',
          'Kinshasa, DR Congo',
          'Luanda, Angola',
          'Johannesburg, South Africa',
          'Cape Town, South Africa',
          'Windhoek, Namibia',
          'Gaborone, Botswana',
          'Harare, Zimbabwe',
          'Maputo, Mozambique'
        ]
      },
      {
        region: 'Middle East',
        cityNames: [
          'Riyadh, Saudi Arabia',
          'Jeddah, Saudi Arabia',
          'Doha, Qatar',
          'Dubai, UAE',
          'Muscat, Oman',
          'Kuwait City, Kuwait',
          'Manama, Bahrain',
          'Tehran, Iran',
          'Baghdad, Iraq',
          'Amman, Jordan',
          'Beirut, Lebanon',
          'Jerusalem'
        ]
      },
      {
        region: 'Asia',
        cityNames: [
          'Mumbai, India',
          'Delhi, India',
          'Bengaluru, India',
          'Hyderabad, India',
          'Chennai, India',
          'Kolkata, India',
          'Kathmandu, Nepal',
          'Dhaka, Bangladesh',
          'Colombo, Sri Lanka',
          'Bangkok, Thailand',
          'Chiang Mai, Thailand',
          'Vientiane, Laos',
          'Phnom Penh, Cambodia',
          'Ho Chi Minh City, Vietnam',
          'Hanoi, Vietnam',
          'Yangon, Myanmar',
          'Singapore',
          'Kuala Lumpur, Malaysia',
          'Jakarta, Indonesia',
          'Surabaya, Indonesia',
          'Manila, Philippines',
          'Cebu, Philippines',
          'Hong Kong',
          'Macau',
          'Taipei, Taiwan',
          'Seoul, South Korea',
          'Busan, South Korea',
          'Tokyo, Japan',
          'Osaka, Japan',
          'Nagoya, Japan',
          'Sapporo, Japan',
          'Beijing, China',
          'Shanghai, China',
          'Guangzhou, China',
          'Shenzhen, China',
          'Chengdu, China',
          "Xi'an, China",
          'Ulaanbaatar, Mongolia',
          'Almaty, Kazakhstan',
          'Bishkek, Kyrgyzstan',
          'Tashkent, Uzbekistan',
          'Astana, Kazakhstan',
          'Moscow, Russia',
          'Saint Petersburg, Russia',
          'Novosibirsk, Russia',
          'Yekaterinburg, Russia'
        ]
      },
      {
        region: 'Oceania',
        cityNames: [
          'Perth, Australia',
          'Adelaide, Australia',
          'Melbourne, Australia',
          'Sydney, Australia',
          'Brisbane, Australia',
          'Hobart, Australia',
          'Auckland, New Zealand',
          'Wellington, New Zealand',
          'Christchurch, New Zealand',
          'Suva, Fiji'
        ]
      }
    ];

    const deterministicOffset = (label, axis)=>{
      let hash = 0;
      for(let i = 0; i < label.length; i++){
        const charCode = label.charCodeAt(i);
        hash = (hash * 33 + charCode + (axis + 1) * 131) & 0xffffffff;
      }
      const normalized = ((hash % 2001) / 2000) - 0.5;
      return normalized * 0.002;
    };

    const pool = [];
    const seen = new Set();

    MULTI_REGION_CITY_LISTS.forEach(spec => {
      if(!spec || !spec.region || !Array.isArray(spec.cityNames)) return;
      spec.cityNames.forEach(cityName => {
        if(!cityName) return;
        const base = cityLookup[cityName];
        if(!base) return;
        const label = `${spec.region}:${cityName}`;
        let lng = normalizeLongitude(base.lng + deterministicOffset(label, 0));
        let lat = clampLatitude(base.lat + deterministicOffset(label, 1));
        let key = toVenueCoordKey(lng, lat);
        if(!key || seen.has(key)){
          let attempts = 0;
          let adjustment = 0.0003;
          while(attempts < 5 && key && seen.has(key)){
            const delta = adjustment * (attempts % 2 === 0 ? 1 : -1);
            lng = normalizeLongitude(base.lng + delta);
            lat = clampLatitude(base.lat + delta);
            key = toVenueCoordKey(lng, lat);
            attempts++;
            adjustment += 0.0001;
          }
          if((!key || seen.has(key)) && toVenueCoordKey(base.lng, base.lat) && !seen.has(toVenueCoordKey(base.lng, base.lat))){
            lng = normalizeLongitude(base.lng);
            lat = clampLatitude(base.lat);
            key = toVenueCoordKey(lng, lat);
          }
        }
        if(!key || seen.has(key)){
          return;
        }
        seen.add(key);
        pool.push({
          city: cityName,
          region: spec.region,
          lng,
          lat
        });
      });
    });
    return pool;
  }

  function shuffledIndices(length){
    const indices = Array.from({ length }, (_, idx) => idx);
    for(let i = indices.length - 1; i > 0; i--){
      const j = Math.floor(rnd() * (i + 1));
      const tmp = indices[i];
      indices[i] = indices[j];
      indices[j] = tmp;
    }
    return indices;
  }

  function assignMultiVenues(postList, targetCount){
    if(!Array.isArray(postList) || !postList.length || targetCount <= 0){
      return 0;
    }
    const pool = buildMultiVenuePool();
    if(pool.length < 2){
      return 0;
    }
    const venuesByRegion = pool.reduce((acc, venue) => {
      if(!venue) return acc;
      const key = venue.region || 'Global';
      if(!acc[key]) acc[key] = [];
      acc[key].push(venue);
      return acc;
    }, Object.create(null));
    const regionKeys = Object.keys(venuesByRegion).filter(key => Array.isArray(venuesByRegion[key]) && venuesByRegion[key].length >= 2);
    if(!regionKeys.length){
      return 0;
    }
    const sampleVenueSet = (regionKey, desiredCount)=>{
      const candidates = venuesByRegion[regionKey];
      if(!Array.isArray(candidates) || candidates.length < desiredCount){
        return null;
      }
      const maxAttempts = Math.max(20, candidates.length);
      for(let attempt = 0; attempt < maxAttempts; attempt++){
        const order = shuffledIndices(candidates.length);
        const selection = [];
        const used = new Set();
        for(let i = 0; i < order.length && selection.length < desiredCount; i++){
          const candidate = candidates[order[i]];
          if(!candidate) continue;
          const key = toVenueCoordKey(candidate.lng, candidate.lat);
          if(!key || used.has(key)) continue;
          let ok = true;
          for(let s = 0; s < selection.length; s++){
            const existing = selection[s];
            const distance = haversineDistanceKm(existing, candidate);
            if(distance < MIN_MULTI_VENUE_DISTANCE_KM || distance > MAX_MULTI_VENUE_DISTANCE_KM){
              ok = false;
              break;
            }
          }
          if(ok){
            selection.push(candidate);
            used.add(key);
          }
        }
        if(selection.length === desiredCount){
          return selection;
        }
      }
      return null;
    };
    const indices = shuffledIndices(postList.length);
    let assigned = 0;
    for(let idx = 0; idx < indices.length && assigned < targetCount; idx++){
      const post = postList[indices[idx]];
      if(!post){
        continue;
      }
      const desiredBase = 2 + Math.floor(rnd() * 3);
      let desired = desiredBase;
      let venues = null;
      let attempts = 0;
      while(attempts < 60 && !venues){
        const regionKey = regionKeys[Math.floor(rnd() * regionKeys.length)];
        venues = sampleVenueSet(regionKey, desired);
        if(!venues){
          attempts++;
          if(attempts % 10 === 0 && desired > 2){
            desired--;
          }
        }
      }
      if(!venues || venues.length < 2){
        for(let r = 0; r < regionKeys.length && (!venues || venues.length < 2); r++){
          venues = sampleVenueSet(regionKeys[r], 2);
        }
      }
      if(!venues || venues.length < 2){
        continue;
      }
      const nextLocations = venues.map((venue, venueIdx) => {
        const cityLabel = venue.city;
        const venueLabel = `${cityLabel} · Spot ${venueIdx + 1}`;
        return {
          venue: venueLabel,
          address: cityLabel,
          lng: venue.lng,
          lat: venue.lat,
          dates: randomSchedule(),
          price: randomPriceRange()
        };
      });
      post.locations = nextLocations;
      post.dates = derivePostDatesFromLocations(nextLocations);
      const primary = nextLocations[0];
      if(primary){
        post.lng = primary.lng;
        post.lat = primary.lat;
        post.city = primary.address || primary.venue || post.city;
      }
      assigned++;
    }
    return assigned;
  }

  // OPTIMIZED: Reduced multi-venue assignment target (was 1000, now 200 to match reduced post count)
  assignMultiVenues(out, 200);

  out.forEach(post => {
    if(!post) return;
    if(Array.isArray(post.locations) && post.locations.length){
      post.dates = derivePostDatesFromLocations(post.locations);
    } else if(Array.isArray(post.dates)){
      post.dates = post.dates.slice().sort();
    } else {
      post.dates = [];
    }
  });

  return out;
}

    let ALL_POSTS_CACHE = null;
    let ALL_POSTS_BY_ID = null;
    function rebuildAllPostsIndex(cache){
      if(!Array.isArray(cache)){
        ALL_POSTS_BY_ID = null;
        return;
      }
      const map = new Map();
      cache.forEach(item => {
        if(!item || item.id === undefined || item.id === null) return;
        map.set(String(item.id), item);
      });
      ALL_POSTS_BY_ID = map;
    }
    function getAllPostsCache(options = {}){
      const { allowInitialize = true } = options;
      if(Array.isArray(ALL_POSTS_CACHE)){
        return ALL_POSTS_CACHE;
      }
      if(!allowInitialize){
        return null;
      }
      ALL_POSTS_CACHE = makePosts();
      rebuildAllPostsIndex(ALL_POSTS_CACHE);
      return ALL_POSTS_CACHE;
    }
    function getPostByIdAnywhere(id){
      if(id === undefined || id === null) return null;
      const normalizedId = String(id);
      const checkList = (list) => {
        if(!Array.isArray(list)) return null;
        return list.find(entry => entry && String(entry.id) === normalizedId) || null;
      };
      const loaded = checkList(posts);
      if(loaded) return loaded;
      if(!ALL_POSTS_BY_ID || !(ALL_POSTS_BY_ID instanceof Map)){
        const cache = getAllPostsCache({ allowInitialize: true });
        if(Array.isArray(cache)){
          rebuildAllPostsIndex(cache);
        }
      }
      return ALL_POSTS_BY_ID instanceof Map ? (ALL_POSTS_BY_ID.get(normalizedId) || null) : null;
    }
    window.getPostByIdAnywhere = getPostByIdAnywhere;
    const EMPTY_FEATURE_COLLECTION = { type:'FeatureCollection', features: [] };

    const markerDataCache = {
      signature: null,
      postsData: EMPTY_FEATURE_COLLECTION,
      featureIndex: new Map()
    };

    function invalidateMarkerDataCache(){
      markerDataCache.signature = null;
      markerDataCache.postsData = EMPTY_FEATURE_COLLECTION;
      markerDataCache.featureIndex = new Map();
    }

    function markerSignatureForList(list){
      if(!Array.isArray(list) || !list.length){
        return 'empty';
      }
      const parts = [];
      list.forEach(post => {
        if(!post) return;
        const baseId = post.id || '';
        let added = false;
        if(Array.isArray(post.locations) && post.locations.length){
          post.locations.forEach((loc, idx) => {
            if(!loc) return;
            const key = toVenueCoordKey(loc.lng, loc.lat);
            if(!key) return;
            parts.push(`${baseId}#${idx}:${key}`);
            added = true;
          });
        }
        if(!added){
          const key = toVenueCoordKey(post.lng, post.lat);
          if(key){
            parts.push(`${baseId}:${key}`);
          } else {
            parts.push(String(baseId));
          }
        }
      });
      parts.sort();
      return parts.join('|');
    }

    function buildMarkerFeatureIndex(postsData){
      const index = new Map();
      const features = Array.isArray(postsData?.features) ? postsData.features : [];
      features.forEach(feature => {
        if(!feature || !feature.properties) return;
        const props = feature.properties;
        const baseId = props.id;
        if(baseId === undefined || baseId === null) return;
        const fid = feature.id ?? props.featureId;
        if(fid === undefined || fid === null) return;
        let venueKey = '';
        if(props.venueKey !== undefined && props.venueKey !== null){
          const venueString = String(props.venueKey).trim();
          venueKey = venueString;
        } else if(typeof fid === 'string'){
          const parts = fid.split('::');
          if(parts.length >= 3){
            venueKey = String(parts[1] || '');
          }
        }
        const rawSpriteId = props.labelSpriteId ?? props.spriteId ?? '';
        const spriteId = rawSpriteId !== undefined && rawSpriteId !== null ? String(rawSpriteId) : '';
        const ids = new Set();
        ids.add(String(baseId));
        if(Array.isArray(props.multiPostIds)){
          props.multiPostIds.forEach(postId => {
            if(postId === undefined || postId === null) return;
            const strId = String(postId);
            if(strId) ids.add(strId);
          });
        }
        ids.forEach(idValue => {
          if(!index.has(idValue)){
            index.set(idValue, []);
          }
          index.get(idValue).push({ source: 'posts', id: fid, venueKey, spriteId });
        });
      });
      return index;
    }

    function getMarkerCollections(list){
      const signature = markerSignatureForList(list);
      if(markerDataCache.signature === signature && markerDataCache.postsData){
        return {
          postsData: markerDataCache.postsData,
          signature,
          changed: false,
          featureIndex: markerDataCache.featureIndex
        };
      }
      if(!Array.isArray(list) || !list.length){
        markerDataCache.signature = signature;
        markerDataCache.postsData = EMPTY_FEATURE_COLLECTION;
        markerDataCache.featureIndex = new Map();
        return {
          postsData: EMPTY_FEATURE_COLLECTION,
          signature,
          changed: true,
          featureIndex: markerDataCache.featureIndex
        };
      }
      const postsData = postsToGeoJSON(list);
      markerDataCache.signature = signature;
      markerDataCache.postsData = postsData;
      markerDataCache.featureIndex = buildMarkerFeatureIndex(postsData);
      return { postsData, signature, changed: true, featureIndex: markerDataCache.featureIndex };
    }
    window.getMarkerCollections = getMarkerCollections;

    function prepareMarkerLabelCompositesForPosts(postsData){
      const enforceBudget = () => {
        if(typeof enforceMarkerLabelCompositeBudget === 'function' && map){
          try{ enforceMarkerLabelCompositeBudget(map); }catch(err){}
        }
      };
      if(!map || typeof ensureMarkerLabelComposite !== 'function'){
        enforceBudget();
        return Promise.resolve();
      }
      const features = Array.isArray(postsData?.features) ? postsData.features : [];
      if(!features.length){
        enforceBudget();
        return Promise.resolve();
      }
      const spriteMeta = new Map();
      const zoomLevel = typeof map.getZoom === 'function' ? Number(map.getZoom()) : NaN;
      const zoomEligible = Number.isFinite(zoomLevel) && zoomLevel >= 8;
      const rawBounds = zoomEligible && typeof map.getBounds === 'function' ? normalizeBounds(map.getBounds()) : null;
      const priorityBounds = rawBounds ? expandBounds(rawBounds, { lat: 0.35, lng: 0.35 }) : null;
      const highlightedPostIdSet = new Set();
      (Array.isArray(lastHighlightedPostIds) ? lastHighlightedPostIds : []).forEach(entry => {
        if(!entry) return;
        const rawId = entry.id ?? entry.postId ?? entry.postID ?? entry.postid;
        if(rawId === undefined || rawId === null) return;
        const strId = String(rawId);
        if(strId){
          highlightedPostIdSet.add(strId);
        }
      });
      const usageTimestamp = nowTimestamp();
      features.forEach(feature => {
        if(!feature || !feature.properties) return;
        const props = feature.properties;
        const spriteId = props.labelSpriteId;
        if(!spriteId || spriteMeta.has(spriteId)) return;
        const coords = Array.isArray(feature.geometry && feature.geometry.coordinates)
          ? feature.geometry.coordinates
          : null;
        let inView = false;
        if(zoomEligible && coords && coords.length >= 2 && priorityBounds){
          const [lng, lat] = coords;
          if(Number.isFinite(lng) && Number.isFinite(lat)){
            inView = pointWithinBounds(lng, lat, priorityBounds);
          }
        }
        const existing = markerLabelCompositeStore.get(spriteId) || {};
        const iconId = props.sub || props.baseSub || '';
        const labelLine1 = props.labelLine1 || '';
        const labelLine2 = props.labelLine2 || '';
        const multiIds = Array.isArray(props.multiPostIds) ? props.multiPostIds : [];
        const isMulti = Boolean(props.isMultiVenue || (props.multiCount && Number(props.multiCount) > 1) || multiIds.length > 1);
        const isHighlighted = (() => {
          const ownId = props.id !== undefined && props.id !== null ? String(props.id) : '';
          if(ownId && highlightedPostIdSet.has(ownId)){
            return true;
          }
          return multiIds.some(mid => {
            if(mid === undefined || mid === null) return false;
            return highlightedPostIdSet.has(String(mid));
          });
        })();
        const priority = Boolean(inView || isHighlighted);
        let lastUsed = Number.isFinite(existing.lastUsed) ? existing.lastUsed : 0;
        if(priority){
          lastUsed = usageTimestamp;
        }
        const updatedMeta = Object.assign({}, existing, {
          iconId,
          labelLine1,
          labelLine2,
          isMulti,
          priority,
          lastUsed,
          inView
        });
        markerLabelCompositeStore.set(spriteId, updatedMeta);
        spriteMeta.set(spriteId, {
          iconId,
          labelLine1,
          labelLine2,
          isMulti,
          priority,
          lastUsed,
          inView
        });
      });
      const spriteEntries = Array.from(spriteMeta.entries());
      const compareEntries = (a, b) => {
        const aMeta = a[1] || {};
        const bMeta = b[1] || {};
        const aPriority = aMeta.priority ? 1 : 0;
        const bPriority = bMeta.priority ? 1 : 0;
        if(aPriority !== bPriority){
          return bPriority - aPriority;
        }
        const aLast = Number.isFinite(aMeta.lastUsed) ? aMeta.lastUsed : 0;
        const bLast = Number.isFinite(bMeta.lastUsed) ? bMeta.lastUsed : 0;
        if(aLast !== bLast){
          return bLast - aLast;
        }
        return String(a[0]).localeCompare(String(b[0]));
      };
      spriteEntries.sort(compareEntries);
      const compositeSafetyBuffer = 25;
      let eagerSpriteEntries = [];
      if(zoomEligible){
        eagerSpriteEntries = spriteEntries.filter(([, meta]) => meta && (meta.inView || meta.priority));
        if(Number.isFinite(MARKER_LABEL_COMPOSITE_LIMIT) && MARKER_LABEL_COMPOSITE_LIMIT > 0){
          const maxEager = Math.max(0, MARKER_LABEL_COMPOSITE_LIMIT - Math.max(0, compositeSafetyBuffer));
          if(maxEager <= 0){
            eagerSpriteEntries = [];
          } else if(eagerSpriteEntries.length > maxEager){
            eagerSpriteEntries = eagerSpriteEntries.slice(0, maxEager);
          }
        }
      }
      const tasks = eagerSpriteEntries.map(([spriteId, meta]) =>
        ensureMarkerLabelComposite(
          map,
          spriteId,
          meta.iconId,
          meta.labelLine1,
          meta.labelLine2,
          meta.isMulti,
          { priority: meta.priority }
        ).catch(()=>{})
      );
      return Promise.all(tasks).then(() => {
        enforceBudget();
      });
    }

    async function syncMarkerSources(list, options = {}){
      const { force = false } = options;
      const collections = getMarkerCollections(list);
      const { postsData, signature, featureIndex } = collections;
      window.markerFeatureIndex = markerFeatureIndex = featureIndex instanceof Map ? featureIndex : new Map();
      let preparationPromise = null;
      let preparationErrorLogged = false;
      const ensurePreparationPromise = () => {
        if(!preparationPromise){
          preparationPromise = prepareMarkerLabelCompositesForPosts(postsData);
        }
        return preparationPromise;
      };
      const awaitPreparation = async () => {
        try{
          await ensurePreparationPromise();
          return true;
        }catch(err){
          if(!preparationErrorLogged){
            preparationErrorLogged = true;
            console.error(err);
          }
          return false;
        }
      };
      let preparationReady = false;
      let updated = false;
      if(map && typeof map.getSource === 'function'){
        const postsSource = map.getSource('posts');
        if(postsSource && (force || postsSource.__markerSignature !== signature)){
          preparationReady = await awaitPreparation();
          if(preparationReady){
            try{ postsSource.setData(postsData); }catch(err){ console.error(err); }
            postsSource.__markerSignature = signature;
            updated = true;
          }
        }
      }
      if(updated || force){
        if(!preparationReady){
          preparationReady = await awaitPreparation();
        }
        ensurePreparationPromise().catch(()=>{});
        updateMapFeatureHighlights(lastHighlightedPostIds);
      }
      return { updated, signature };
    }
    window.syncMarkerSources = syncMarkerSources;

    let postsLoaded = false;
    // Expose postsLoaded globally for admin.js access
    Object.defineProperty(window, 'postsLoaded', {
      get: () => postsLoaded,
      set: (val) => { postsLoaded = val; },
      configurable: true
    });
    let waitForInitialZoom = window.waitForInitialZoom ?? (firstVisit ? true : false);
    let initialZoomStarted = false;
    // Expose on window for admin.js access - use getter/setter to keep in sync
    Object.defineProperty(window, 'initialZoomStarted', {
      get: () => initialZoomStarted,
      set: (val) => { initialZoomStarted = val; },
      configurable: true
    });
    let postLoadRequested = false;
    let lastLoadedBoundsKey = null;
    window.waitForInitialZoom = waitForInitialZoom;
    let updatePostsButtonState = () => {};
    window.updatePostsButtonState = updatePostsButtonState;

    function boundsToKey(bounds, precision = 2){
      if(!bounds) return '';
      const west = typeof bounds.getWest === 'function' ? bounds.getWest() : bounds.west;
      const east = typeof bounds.getEast === 'function' ? bounds.getEast() : bounds.east;
      const south = typeof bounds.getSouth === 'function' ? bounds.getSouth() : bounds.south;
      const north = typeof bounds.getNorth === 'function' ? bounds.getNorth() : bounds.north;
      const fmt = (val) => Number.isFinite(val) ? val.toFixed(precision) : 'nan';
      return [west, south, east, north].map(fmt).join('|');
    }

    function normalizeBounds(bounds){
      if(!bounds) return null;
      if(typeof bounds.getWest === 'function'){
        return {
          west: bounds.getWest(),
          east: bounds.getEast(),
          south: bounds.getSouth(),
          north: bounds.getNorth()
        };
      }
      const { west, east, south, north } = bounds;
      if(!Number.isFinite(west) || !Number.isFinite(east) || !Number.isFinite(south) || !Number.isFinite(north)){
        return null;
      }
      return { west, east, south, north };
    }

    function expandBounds(bounds, padding = {}){
      const normalized = normalizeBounds(bounds);
      if(!normalized) return null;
      let latPad;
      let lngPad;
      if(typeof padding === 'number'){
        latPad = lngPad = padding;
      } else {
        const latCandidate = padding.lat ?? padding.latitude ?? padding.y ?? padding.vertical;
        const lngCandidate = padding.lng ?? padding.longitude ?? padding.x ?? padding.horizontal;
        latPad = Number.isFinite(latCandidate) ? latCandidate : 0.25;
        lngPad = Number.isFinite(lngCandidate) ? lngCandidate : 0.25;
      }
      latPad = Math.max(0, latPad);
      lngPad = Math.max(0, lngPad);
      let { west, east, south, north } = normalized;
      west = Math.max(-180, west - lngPad);
      east = Math.min(180, east + lngPad);
      const clampLat = (value) => Math.max(-85, Math.min(85, value));
      south = clampLat(south - latPad);
      north = clampLat(north + latPad);
      return { west, east, south, north };
    }

    function pointWithinBounds(lng, lat, bounds){
      if(!Number.isFinite(lng) || !Number.isFinite(lat) || !bounds){
        return false;
      }
      const { west, east, south, north } = bounds;
      if(!Number.isFinite(west) || !Number.isFinite(east) || !Number.isFinite(south) || !Number.isFinite(north)){
        return false;
      }
      const withinLat = lat >= Math.min(south, north) && lat <= Math.max(south, north);
      if(!withinLat) return false;
      if(west <= east){
        return lng >= west && lng <= east;
      }
      return lng >= west || lng <= east;
    }

    function clearLoadedPosts(){
      invalidateMarkerDataCache();
      if(postsLoaded){
        postsLoaded = false;
        window.postsLoaded = postsLoaded;
      }
      lastLoadedBoundsKey = null;
      window.posts = posts = [];
      window.filtered = filtered = [];
      if(typeof sortedPostList !== 'undefined'){ sortedPostList = []; }
      if(typeof renderedPostCount !== 'undefined'){ renderedPostCount = 0; }
      if(typeof postBatchObserver !== 'undefined' && postBatchObserver){
        try{ postBatchObserver.disconnect(); }catch(err){}
        postBatchObserver = null;
      }
      if(typeof postSentinel !== 'undefined' && postSentinel && postSentinel.remove){
        postSentinel.remove();
        postSentinel = null;
      }
      if(typeof adTimer !== 'undefined' && adTimer){
        clearInterval(adTimer);
        adTimer = null;
      }
      if(typeof adPosts !== 'undefined'){ adPosts = []; }
      if(typeof adIdsKey !== 'undefined'){ adIdsKey = ''; }
      const adPanelEl = typeof document !== 'undefined' ? document.querySelector('.ad-panel') : null;
      if(adPanelEl){ adPanelEl.innerHTML = ''; }
      const resultsElLocal = $('#results');
      if(resultsElLocal){ resultsElLocal.innerHTML = ''; }
      const postsBoardEl = $('.post-board');
      if(postsBoardEl){ postsBoardEl.innerHTML = ''; }
      hideResultIndicators();
      if(typeof updateResetBtn === 'function'){ updateResetBtn(); }
      if(map){
        const postsSource = map.getSource && map.getSource('posts');
        if(postsSource && typeof postsSource.setData === 'function'){
          postsSource.setData(EMPTY_FEATURE_COLLECTION);
          postsSource.__markerSignature = null;
        }
      }
      updateLayerVisibility(lastKnownZoom);
    }

    function loadPosts(bounds){
      if(spinning){
        pendingPostLoad = true;
        window.pendingPostLoad = pendingPostLoad;
        return;
      }
      const normalized = normalizeBounds(bounds);
      if(!normalized){
        postLoadRequested = true;
        hideResultIndicators();
        return;
      }
      const key = boundsToKey(normalized);
      if(postsLoaded && lastLoadedBoundsKey === key){
        const applyFiltersFn = window.applyFilters;
        if(typeof applyFiltersFn === 'function'){
          applyFiltersFn();
        }
        return;
      }
      const cache = getAllPostsCache();
      const nextPosts = Array.isArray(cache)
        ? cache.filter(p => pointWithinBounds(p.lng, p.lat, normalized))
        : [];
      window.posts = posts = nextPosts;
      window.postsLoaded = postsLoaded = true;
      lastLoadedBoundsKey = key;
      rebuildVenueIndex();
      invalidateMarkerDataCache();
      resetBalloonSourceState();
      if(markersLoaded && map && Object.keys(subcategoryMarkers).length){ 
        const addPostSourceFn = window.addPostSource;
        if(typeof addPostSourceFn === 'function'){
          addPostSourceFn();
        }
      }
      const initAdBoardFn = window.initAdBoard;
      if(typeof initAdBoardFn === 'function'){
        initAdBoardFn();
      }
      const applyFiltersFn = window.applyFilters;
      if(typeof applyFiltersFn === 'function'){
        applyFiltersFn();
      }
      updateLayerVisibility(lastKnownZoom);
    }

    let markerLayersVisible = false;
    let pendingZoomCheckToken = null;
    let pendingZoomEvent = null;

    function getZoomFromEvent(event){
      if(event){
        if(typeof event.zoom === 'number'){ return event.zoom; }
        const target = event.target && typeof event.target.getZoom === 'function' ? event.target : null;
        if(target){
          try{ return target.getZoom(); }catch(err){ return NaN; }
        }
      }
      if(map && typeof map.getZoom === 'function'){
        try{ return map.getZoom(); }catch(err){ return NaN; }
      }
      return NaN;
    }
    // Expose on window for admin.js access (after function is fully defined)
    window.getZoomFromEvent = getZoomFromEvent;

    function setLayerVisibility(id, visible){
      if(!map || typeof map.getLayer !== 'function') return;
      let layer = null;
      try{ layer = map.getLayer(id); }catch(err){ layer = null; }
      if(!layer) return;
      const desired = visible ? 'visible' : 'none';
      try{
        const current = map.getLayoutProperty(id, 'visibility');
        if(current !== desired){
          map.setLayoutProperty(id, 'visibility', desired);
        }
      }catch(err){
        try{ map.setLayoutProperty(id, 'visibility', desired); }catch(e){}
      }
    }

    function updateMarkerZoomClasses(zoom){
      if(!map || typeof map.getContainer !== 'function') return;
      const container = map.getContainer();
      if(!container || !container.classList) return;
      const zoomValue = Number.isFinite(zoom) ? zoom : getZoomFromEvent();
      const isMidZoom = Number.isFinite(zoomValue) && zoomValue >= MARKER_ZOOM_THRESHOLD && zoomValue < MARKER_SPRITE_ZOOM;
      const isSpriteZoom = Number.isFinite(zoomValue) && zoomValue >= MARKER_SPRITE_ZOOM;
      container.classList.toggle(MID_ZOOM_MARKER_CLASS, isMidZoom);
      container.classList.toggle(SPRITE_MARKER_CLASS, isSpriteZoom);
    }

    function updateLayerVisibility(zoom){
      const zoomValue = Number.isFinite(zoom) ? zoom : getZoomFromEvent();
      const zoomBucket = Number.isFinite(zoomValue)
        ? Math.floor((zoomValue + 1e-6) * ZOOM_VISIBILITY_PRECISION)
        : NaN;
      const hasBucket = Number.isFinite(zoomBucket);
      const shouldShowMarkers = hasBucket ? zoomBucket >= MARKER_VISIBILITY_BUCKET : markerLayersVisible;
      const shouldShowBalloons = hasBucket ? zoomBucket < MARKER_VISIBILITY_BUCKET : balloonLayersVisible;
      if(markerLayersVisible !== shouldShowMarkers){
        MARKER_LAYER_IDS.forEach(id => setLayerVisibility(id, shouldShowMarkers));
        markerLayersVisible = shouldShowMarkers;
      }
      if(balloonLayersVisible !== shouldShowBalloons){
        BALLOON_LAYER_IDS.forEach(id => setLayerVisibility(id, shouldShowBalloons));
        balloonLayersVisible = shouldShowBalloons;
      }
      if(shouldShowBalloons && Number.isFinite(zoomValue)){
        updateBalloonSourceForZoom(zoomValue);
      }
    }
    // Expose on window for admin.js access (after function is fully defined)
    window.updateLayerVisibility = updateLayerVisibility;

    function updateZoomState(zoom){
      if(Number.isFinite(zoom)){
        lastKnownZoom = zoom;
        if(window.lastKnownZoom !== undefined) window.lastKnownZoom = zoom;
      } else {
        const current = getZoomFromEvent();
        if(Number.isFinite(current)){
          lastKnownZoom = current;
          if(window.lastKnownZoom !== undefined) window.lastKnownZoom = current;
        }
      }
      if(typeof window.updatePostsButtonState === 'function'){
        window.updatePostsButtonState(lastKnownZoom);
      }
      updateLayerVisibility(lastKnownZoom);
      updateMarkerZoomClasses(lastKnownZoom);
      updateBalloonSourceForZoom(lastKnownZoom);
      if(map && Number.isFinite(lastKnownZoom) && lastKnownZoom >= MARKER_SPRITE_ZOOM){
        map.__retainAllMarkerSprites = true;
      }
      if(!markersLoaded){
        const preloadCandidate = Number.isFinite(lastKnownZoom) ? lastKnownZoom : getZoomFromEvent();
        if(Number.isFinite(preloadCandidate) && preloadCandidate >= MARKER_PRELOAD_ZOOM){
          const loadPostMarkersFn = window.loadPostMarkers;
          if(typeof loadPostMarkersFn === 'function'){
            try{ loadPostMarkersFn(); }catch(err){ console.error(err); }
          }
          markersLoaded = true;
          window.__markersLoaded = true;
          if(window.markersLoaded !== undefined) window.markersLoaded = true;
        }
      }
    }
    // Expose on window for admin.js access (after function is fully defined)
    window.updateZoomState = updateZoomState;

    function scheduleCheckLoadPosts(event){
      // Expose on window for admin.js access
      window.scheduleCheckLoadPosts = scheduleCheckLoadPosts;
      pendingZoomEvent = event || { zoom: lastKnownZoom, target: map };
      if(pendingZoomCheckToken !== null) return;
      const scheduler = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb)=> setTimeout(cb, 0);
      pendingZoomCheckToken = scheduler(()=>{
        pendingZoomCheckToken = null;
        const evt = pendingZoomEvent;
        pendingZoomEvent = null;
        checkLoadPosts(evt);
      });
    }
    // Expose on window for admin.js access (after function is fully defined)
    window.scheduleCheckLoadPosts = scheduleCheckLoadPosts;

    function checkLoadPosts(event){
      if(!map) return;
      const zoomCandidate = getZoomFromEvent(event);
      updateZoomState(zoomCandidate);
      let zoomLevel = Number.isFinite(zoomCandidate) ? zoomCandidate : lastKnownZoom;
      if(!Number.isFinite(zoomLevel)){
        zoomLevel = getZoomFromEvent();
      }
      if(waitForInitialZoom){
        if(Number.isFinite(zoomLevel) && zoomLevel >= MARKER_PRELOAD_ZOOM){
          waitForInitialZoom = false;
          window.waitForInitialZoom = waitForInitialZoom;
          initialZoomStarted = false;
        } else {
          postLoadRequested = true;
          hideResultIndicators();
          return;
        }
      }
      if(!Number.isFinite(zoomLevel)){
        postLoadRequested = true;
        hideResultIndicators();
        return;
      }
      if(typeof window.updatePostsButtonState === 'function'){
        window.updatePostsButtonState(zoomLevel);
      }
      if(Number.isFinite(zoomLevel) && zoomLevel < MARKER_PRELOAD_ZOOM){
        postLoadRequested = true;
        if(postsLoaded || (Array.isArray(posts) && posts.length)){ clearLoadedPosts(); }
        hideResultIndicators();
        return;
      }
      if(spinning){
        pendingPostLoad = true;
        window.pendingPostLoad = pendingPostLoad;
        hideResultIndicators();
        return;
      }
      postLoadRequested = false;
      const bounds = typeof map.getBounds === 'function' ? map.getBounds() : null;
      if(!bounds){
        postLoadRequested = true;
        hideResultIndicators();
        return;
      }
      loadPosts(bounds);
    }
    // Expose on window for admin.js access (after function is fully defined)
    window.checkLoadPosts = checkLoadPosts;

    const resultsEl = $('#results');
    const postsWideEl = $('.post-board');
    const postsModeEl = $('.post-board');

    let sortedPostList = [];
    let renderedPostCount = 0;
    let postBatchObserver = null;
    let postSentinel = null;
    let postBoardScrollOptions = null;
    const INITIAL_RENDER_COUNT = 50;
    const POST_BATCH_SIZE = 25;

    function appendPostBatch(count = POST_BATCH_SIZE){
      const slice = sortedPostList.slice(renderedPostCount, renderedPostCount + count);
      slice.forEach(p => {
        if(resultsEl){
          const rCard = card(p);
          if(activePostId && p.id === activePostId) rCard.setAttribute('aria-selected','true');
          resultsEl.appendChild(rCard);
        }
        const wCard = card(p, true);
        postsWideEl.insertBefore(wCard, postSentinel);
      });
      renderedPostCount += slice.length;
      if(renderedPostCount >= sortedPostList.length){
        if(postBatchObserver) postBatchObserver.disconnect();
        removeScrollListener(postsWideEl, onPostBoardScroll, postBoardScrollOptions);
        postBoardScrollOptions = null;
      }
      prioritizeVisibleImages();
    }

    function onPostBoardScroll(){
      if(postsWideEl.scrollTop + postsWideEl.clientHeight >= postsWideEl.scrollHeight - 200){
        appendPostBatch();
      }
    }

    // Image helpers (reuse shared utilities)

    function memberAvatarUrl(p){
      if(p.member && p.member.avatar){
        return p.member.avatar;
      }
      return 'assets/balloons/birthday-party-png-45917-100.png';
    }

    function mapCardHTML(p, opts={}){
      const overrideKey = typeof opts.venueKey === 'string' && opts.venueKey ? opts.venueKey : null;
      const prevKey = selectedVenueKey;
      if(overrideKey){
        selectedVenueKey = overrideKey;
      }
      try{
        const venueName = getPrimaryVenueName(p) || p.city;
        const labelLines = getMarkerLabelLines(p);
        const cardTitleLines = Array.isArray(labelLines.cardTitleLines) && labelLines.cardTitleLines.length
          ? labelLines.cardTitleLines.slice(0, 2)
          : [labelLines.line1, labelLines.line2].filter(Boolean).slice(0, 2);
        const normalizedTitleLines = cardTitleLines.slice(0, 2);
        const firstTitleLine = normalizedTitleLines[0] || '';
        const hasSecondTitleLine = Boolean((normalizedTitleLines[1] || '').trim());
        const displayTitleLines = hasSecondTitleLine ? normalizedTitleLines : [firstTitleLine];
        const titleHtml = displayTitleLines
          .map(line => `<div class="map-card-title-line">${line}</div>`)
          .join('');
        const venueLine = labelLines.venueLine || shortenMarkerLabelText(venueName, mapCardTitleWidthPx);
        const venueHtml = venueLine ? `<div class="map-card-venue">${venueLine}</div>` : '';
        const labelClasses = ['map-card-label'];
        if(!hasSecondTitleLine){
          labelClasses.push('map-card-label--single-line');
        }
        const labelHtml = `<div class="${labelClasses.join(' ')}"><div class="map-card-title">${titleHtml}</div>${venueHtml}</div>`;
        const classes = ['big-map-card'];
        const extraClasses = Array.isArray(opts.extraClasses) ? opts.extraClasses : (opts.extraClass ? [opts.extraClass] : []);
        const variant = opts.variant || 'popup';
        if(variant === 'popup') classes.push('big-map-card--popup');
        if(variant === 'list') classes.push('big-map-card--list');
        extraClasses.filter(Boolean).forEach(cls => classes.push(cls));
        if(variant === 'list'){
          return `<div class="${classes.join(' ')}" data-id="${p.id}"><img class="map-card-thumb" src="${thumbUrl(p)}" alt="" referrerpolicy="no-referrer" />${labelHtml}</div>`;
        }
        return `<div class="${classes.join(' ')}" data-id="${p.id}"><img class="map-card-pill" src="assets/icons-30/225x60-pill-99.webp" alt="" /><img class="map-card-thumb" src="${thumbUrl(p)}" alt="" referrerpolicy="no-referrer" />${labelHtml}</div>`;
      } finally {
        if(overrideKey){
          selectedVenueKey = prevKey;
        }
      }
    }

    function hoverHTML(p){
      return mapCardHTML(p);
    }
  })();

function closePanel(m){
  const btnId = window.panelButtons && window.panelButtons[m && m.id];
  if(btnId){
    const btn = document.getElementById(btnId);
    btn && btn.setAttribute('aria-pressed','false');
  }
  const content = m.querySelector('.panel-content') || m.querySelector('.modal-content');
  const active = document.activeElement;
  if(active && m.contains(active)) active.blur();
  if(m.id === 'welcome-modal'){
    const mc = document.querySelector('.map-controls-map');
    if(mc) mc.style.display = '';
  }
  m.setAttribute('inert','');
  if(content && content.dataset.side){
    content.classList.remove('panel-visible');
    content.addEventListener('transitionend', function handler(){
      content.removeEventListener('transitionend', handler);
      m.classList.remove('show');
      m.setAttribute('aria-hidden','true');
      localStorage.setItem(`panel-open-${m.id}`,'false');
      const idx = panelStack.indexOf(m);
      if(idx!==-1) panelStack.splice(idx,1);
      if(map && typeof map.resize === 'function') setTimeout(()=> map.resize(),0);
      if(typeof window.adjustBoards === 'function') setTimeout(()=> window.adjustBoards(), 0);
    }, {once:true});
  } else {
    m.classList.remove('show');
    m.setAttribute('aria-hidden','true');
    localStorage.setItem(`panel-open-${m.id}`,'false');
    const panelStack = window.panelStack || [];
    const idx = panelStack.indexOf(m);
    if(idx!==-1) panelStack.splice(idx,1);
    if(map && typeof map.resize === 'function') setTimeout(()=> map.resize(),0);
    if(typeof window.adjustBoards === 'function') setTimeout(()=> window.adjustBoards(), 0);
  }
  if(typeof window.updateHeaderMapControls === 'function') window.updateHeaderMapControls();
}

const adminAuthManager = (()=>{
  const STORAGE_KEY = 'admin-authenticated';
  const IDENTITY_KEY = 'admin-identity';
  const adminBtn = document.getElementById('adminBtn');
  const adminPanel = document.getElementById('adminPanel');
  const memberPanel = document.getElementById('memberPanel');

  let authenticated = localStorage.getItem(STORAGE_KEY) === 'true';
  let adminIdentity = localStorage.getItem(IDENTITY_KEY) || '';

  function updateUI(){
    if(adminBtn){
      const isVisible = !!authenticated;
      adminBtn.hidden = !isVisible;
      adminBtn.style.display = isVisible ? 'flex' : 'none';
      adminBtn.setAttribute('aria-hidden', (!isVisible).toString());
      if(!isVisible){
        adminBtn.setAttribute('aria-pressed','false');
      }
    }
  }

  function setAuthenticatedState(value, identity){
    const next = !!value;
    if(next === authenticated){
      updateUI();
      return;
    }
    authenticated = next;
    localStorage.setItem(STORAGE_KEY, authenticated ? 'true' : 'false');
    if(authenticated){
      const normalizedIdentity = typeof identity === 'string' ? identity.trim() : '';
      adminIdentity = normalizedIdentity || adminIdentity;
      if(adminIdentity){
        localStorage.setItem(IDENTITY_KEY, adminIdentity);
      }
    } else {
      adminIdentity = '';
      localStorage.removeItem(IDENTITY_KEY);
    }
    updateUI();
    if(!authenticated){
      localStorage.setItem('panel-open-adminPanel','false');
      if(adminPanel && adminPanel.classList.contains('show')){
        closePanel(adminPanel);
      }
    }
  }

  function ensureAuthenticated(){
    if(authenticated) return true;
    if(memberPanel && !memberPanel.classList.contains('show')){
      openPanel(memberPanel);
    }
    const memberBtn = document.getElementById('memberBtn');
    if(memberBtn){
      memberBtn.focus();
    }
    return false;
  }

  updateUI();
  if(!authenticated){
    localStorage.setItem('panel-open-adminPanel','false');
    if(adminPanel && adminPanel.classList.contains('show')){
      closePanel(adminPanel);
    }
  }

  return {
    isAuthenticated(){
      return authenticated;
    },
    ensureAuthenticated,
    setAuthenticated(value, identity){
      setAuthenticatedState(value, identity);
    },
    getAdminUser(){
      const identifier = adminIdentity || localStorage.getItem(IDENTITY_KEY) || 'admin';
      const trimmed = identifier.trim();
      const emailNormalized = trimmed ? trimmed.toLowerCase() : 'admin';
      return {
        name: 'Administrator',
        email: trimmed || 'admin',
        emailNormalized,
        username: trimmed || 'admin',
        avatar: '',
        isAdmin: true
      };
    }
  };
})();
window.adminAuthManager = adminAuthManager;

const welcomeModalEl = document.getElementById('welcome-modal');
if(welcomeModalEl){
  const welcomeControls = welcomeModalEl.querySelector('.map-controls-welcome');
  welcomeModalEl.addEventListener('click', e => {
    if(welcomeControls && welcomeControls.contains(e.target)) return;
    closePanel(welcomeModalEl);
  });
  const welcomeContent = welcomeModalEl.querySelector('.modal-content');
  if(welcomeContent){
    welcomeContent.addEventListener('click', e => {
      if(welcomeControls && welcomeControls.contains(e.target)) return;
      closePanel(welcomeModalEl);
    });
  }
}

function requestClosePanel(m){
  if(m){
    if(m.id === 'adminPanel' && window.adminPanelChangeManager && window.adminPanelChangeManager.handlePanelClose(m)){
      return;
    }
    if(m.id === 'memberPanel' && window.memberPanelChangeManager && window.memberPanelChangeManager.handlePanelClose(m)){
      return;
    }
  }
  closePanel(m);
}
function togglePanel(m){
  if(m.classList.contains('show')){
    requestClosePanel(m);
  } else {
    openPanel(m);
  }
}
function movePanelToEdge(panel, side){
  if(!panel) return;
  const content = panel.querySelector('.panel-content') || panel.querySelector('.modal-content');
  if(!content) return;
  const header = document.querySelector('.header');
  const topPos = header ? header.getBoundingClientRect().bottom : 0;
  content.style.top = `${topPos}px`;
  if(side === 'left'){
    content.dataset.side='left';
    content.style.left = '0';
    content.style.right = 'auto';
    schedulePanelEntrance(content, true);
  } else {
    content.dataset.side='right';
    content.style.left = 'auto';
    content.style.right = '0';
    schedulePanelEntrance(content, true);
  }
}
function repositionPanels(){
  ['adminPanel','memberPanel','filterPanel'].forEach(id=>{
    const panel = document.getElementById(id);
    if(panel && panel.classList.contains('show')){
      const content = panel.querySelector('.panel-content');
      if(!content) return;
      const w = content.style.width;
      const h = content.style.height;
      openPanel(panel);
      content.style.width = w;
      content.style.height = h;
    }
  });
}
function handleEsc(){
  const top = panelStack[panelStack.length-1];
  if(!top){
    const {container} = ensureImageModalReady();
    if(container && !container.classList.contains('hidden')){
      closeImageModal(container);
    }
    return;
  }
  if(top instanceof Element){
    if(top.id === 'adminPanel' && window.adminPanelChangeManager && window.adminPanelChangeManager.handleEscape(top)){
      return;
    }
    if(top.id === 'memberPanel' && window.memberPanelChangeManager && window.memberPanelChangeManager.handleEscape(top)){
      return;
    }
    if(top.id === 'post-modal-container'){
      closePostModal();
    } else {
      requestClosePanel(top);
    }
  } else if(typeof top.remove==='function'){
    panelStack.pop();
    top.remove();
  }
}
document.addEventListener('keydown', e=>{
  if(e.key==='Escape') handleEsc();
});

let pointerStartedInFilterContent = false;

function handleDocInteract(e){
  if(e.target.closest('.image-modal-container')) return;
  if(logoEls.some(el => el.contains(e.target))) return;
  if(e.target.closest('#filterBtn')) return;
  const welcome = document.getElementById('welcome-modal');
  if(welcome && welcome.classList.contains('show')){
    const controls = welcome.querySelector('.map-controls-welcome');
    if(!controls || !controls.contains(e.target)){
      closePanel(welcome);
    }
  }
  const filterPanel = window.filterPanel || document.getElementById('filterPanel');
  const fromPointerDown = !!e.__fromPointerDown;
  if(filterPanel && filterPanel.classList.contains('show')){
    const content = filterPanel.querySelector('.panel-content');
    const pinBtn = filterPanel.querySelector('.pin-panel');
    const pinned = pinBtn && pinBtn.getAttribute('aria-pressed')==='true';
    const startedInside = pointerStartedInFilterContent;
    if(content && !content.contains(e.target) && !pinned){
      if(startedInside && !fromPointerDown){
        pointerStartedInFilterContent = false;
        return;
      }
      closePanel(filterPanel);
      pointerStartedInFilterContent = false;
      return;
    }
    if(!fromPointerDown){
      pointerStartedInFilterContent = false;
    }
  } else if(!fromPointerDown){
    pointerStartedInFilterContent = false;
  }
}

document.addEventListener('click', handleDocInteract);
document.addEventListener('pointerdown', (e) => {
  const target = e.target;
  const filterPanel = window.filterPanel || document.getElementById('filterPanel');
  const content = filterPanel ? filterPanel.querySelector('.panel-content') : null;
  pointerStartedInFilterContent = !!(filterPanel && filterPanel.classList.contains('show') && content && content.contains(target));
  requestAnimationFrame(() => handleDocInteract({ target, __fromPointerDown: true }));
});

// Panels and admin/member interactions
(function(){
  const memberBtn = document.getElementById('memberBtn');
  const adminBtn = document.getElementById('adminBtn');
  const memberPanel = document.getElementById('memberPanel');
  const adminPanel = document.getElementById('adminPanel');
  const filterPanel = window.filterPanel || document.getElementById('filterPanel');

  if(memberBtn && memberPanel){
    memberBtn.addEventListener('click', ()=> togglePanel(memberPanel));
  }
  if(adminBtn && adminPanel){
    adminBtn.addEventListener('click', ()=>{
      if(window.adminAuthManager && !window.adminAuthManager.isAuthenticated()){
        window.adminAuthManager.ensureAuthenticated();
        return;
      }
      togglePanel(adminPanel);
    });
  }
  document.querySelectorAll('.panel .close-panel').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const panel = btn.closest('.panel');
      requestClosePanel(panel);
    });
  });
  document.querySelectorAll('.panel .move-left').forEach(btn=>{
    btn.addEventListener('click', e=>{
      e.stopPropagation();
      const panel = btn.closest('.panel');
      movePanelToEdge(panel, 'left');
    });
  });
  document.querySelectorAll('.panel .move-right').forEach(btn=>{
    btn.addEventListener('click', e=>{
      e.stopPropagation();
      const panel = btn.closest('.panel');
      movePanelToEdge(panel, 'right');
    });
  });


  document.querySelectorAll('.panel .panel-header').forEach(header=>{
    header.addEventListener('mousedown', e=>{
      if(e.target.closest('button')) return;
      const panel = header.closest('.panel');
      const content = panel ? panel.querySelector('.panel-content') : null;
      if(!content) return;
      bringToTop(panel);
      const rect = content.getBoundingClientRect();
      const startX = e.clientX;
      const startLeft = rect.left;
      const onMove = (ev)=>{
        const dx = ev.clientX - startX;
        let newLeft = startLeft + dx;
        const maxLeft = window.innerWidth - rect.width;
        if(newLeft < 0) newLeft = 0;
        if(newLeft > maxLeft) newLeft = maxLeft;
        content.style.left = `${newLeft}px`;
        content.style.right = 'auto';
      };
      const throttledMove = rafThrottle(onMove);
      function onUp(){
        document.removeEventListener('mousemove', throttledMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', throttledMove);
      document.addEventListener('mouseup', onUp);
    });
  });

    const welcomeModal = document.getElementById('welcome-modal');
    const panelsToRestore = [memberPanel, adminPanel, welcomeModal];
    panelsToRestore.forEach(m=>{
      if(!m) return;
      if(m.id === 'adminPanel' && window.adminAuthManager && !window.adminAuthManager.isAuthenticated()){
        localStorage.setItem(`panel-open-${m.id}`,'false');
        return;
      }
      if(localStorage.getItem(`panel-open-${m.id}`) === 'true'){
        const openPanel = window.openPanel || (() => {});
        openPanel(m);
      }
    });
    if(welcomeModal && !localStorage.getItem('welcome-seen')){
      openWelcome();
      localStorage.setItem('welcome-seen','true');
    }
  document.querySelectorAll('.panel').forEach(panel=>{
    const content = panel.querySelector('.panel-content');
    if(content){
      const defaultWidth = panel.id === 'filterPanel' ? '380px' : '440px';
      content.style.width = defaultWidth;
      content.style.maxWidth = defaultWidth;
      content.style.top = 'calc(var(--header-h) + var(--safe-top))';
      content.style.bottom = 'var(--footer-h)';
      content.style.height = 'calc(100vh - var(--header-h) - var(--safe-top) - var(--footer-h))';
      content.style.maxHeight = 'calc(100vh - var(--header-h) - var(--safe-top) - var(--footer-h))';
    }
  });

  const adminTabs = document.querySelectorAll('#adminPanel .tab-bar button');
  const adminPanels = document.querySelectorAll('#adminPanel .tab-panel');
  adminTabs.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      adminTabs.forEach(b=>b.setAttribute('aria-selected','false'));
      adminPanels.forEach(p=>p.classList.remove('active'));
      btn.setAttribute('aria-selected','true');
      const panel = document.getElementById(`tab-${btn.dataset.tab}`);
      panel && panel.classList.add('active');
      
      // Initialize formbuilder when Forms tab is opened
      if(btn.dataset.tab === 'forms' && typeof window.renderFormbuilderCats === 'function'){
        window.renderFormbuilderCats();
      }
    });
  });

  const memberTabs = document.querySelectorAll('#memberPanel .tab-bar .tab-btn');
  const memberPanels = document.querySelectorAll('#memberPanel .member-tab-panel');
  memberTabs.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      memberTabs.forEach(b=>b.setAttribute('aria-selected','false'));
      memberPanels.forEach(p=>{
        p.classList.remove('active');
        p.setAttribute('hidden','');
      });
      btn.setAttribute('aria-selected','true');
      const panel = document.getElementById(`memberTab-${btn.dataset.tab}`);
      if(panel){
        panel.classList.add('active');
        panel.removeAttribute('hidden');
      }
    });
  });

  // Initialize map on page load
  (function initializeMapOnLoad(){
    const initMapMode = () => {
      const setModeFn = window.setMode;
      if(typeof setModeFn === 'function'){
        const currentMode = localStorage.getItem('mode') || 'map';
        // Only call setMode if we're in map mode to trigger initialization
        if(currentMode === 'map' && !document.body.classList.contains('mode-map')){
          setModeFn('map', true); // skipFilters=true to avoid double initialization
        } else if(currentMode === 'map'){
          // Already in map mode, but ensure map initializes
          const startMainMapInit = window.startMainMapInit;
          if(typeof startMainMapInit === 'function'){
            startMainMapInit();
          }
        }
      }
    };
    
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', initMapMode);
    } else {
      // DOM already ready, wait a bit for setMode to be defined
      setTimeout(initMapMode, 100);
    }
  })();

  const adminPaypalClientId = document.getElementById('adminPaypalClientId');
  const adminPaypalClientSecret = document.getElementById('adminPaypalClientSecret');

  // Member form code has been moved to member-forms.js
  // The member form initialization is now handled in that separate file

  const colorAreas = [
    {key:'header', label:'Header', selectors:{bg:['.header'], text:['.header']}},
    {key:'body', label:'Body', selectors:{bg:['body'], border:[], hoverBorder:[], activeBorder:[]}},
    {key:'list', label:'List', selectors:{bg:['.quick-list-board'], text:['.quick-list-board'], title:['.quick-list-board .recents-card .t','.quick-list-board .recents-card .title'], btn:['.quick-list-board button','.quick-list-board .sq','.quick-list-board .tiny','.quick-list-board .btn'], btnText:['.quick-list-board button','.quick-list-board .sq','.quick-list-board .tiny','.quick-list-board .btn'], card:['.quick-list-board .recents-card']}},
    {key:'post-board', label:'Closed Posts', selectors:{bg:['.post-board'], text:['.post-board','.post-board .posts'], title:['.post-board .post-card .t','.post-board .post-card .title','.post-board .open-post .t','.post-board .open-post .title'], btn:['.post-board button'], btnText:['.post-board button'], card:['.post-board .post-card','.post-board .open-post']}},
    {key:'open-post', label:'Open Posts', selectors:{text:['.open-post','.open-post .venue-info','.open-post .session-info'], title:['.open-post .t','.open-post .title'], btn:['.open-post button'], btnText:['.open-post button'], card:['.open-post'], header:['.open-post .post-card'], image:['.open-post .image-box'], menu:['.open-post .venue-menu button','.open-post .session-menu button']}},
    {key:'map', label:'Map', selectors:{popupBg:['.mapboxgl-popup.big-map-card .mapboxgl-popup-content','.mapboxgl-popup.big-map-card .big-map-card','.mapboxgl-popup.big-map-card .chip','.mapboxgl-popup.big-map-card .chip-small','.mapboxgl-popup.big-map-card .map-card-list-item'], popupText:['.mapboxgl-popup.big-map-card .big-map-card','.mapboxgl-popup.big-map-card .map-card-title','.mapboxgl-popup.big-map-card .map-card-venue','.mapboxgl-popup.big-map-card .chip','.mapboxgl-popup.big-map-card .chip-small','.mapboxgl-popup.big-map-card .map-card-list-item'], title:['.mapboxgl-popup.big-map-card .map-card-title','.mapboxgl-popup.big-map-card .chip .t','.mapboxgl-popup.big-map-card .chip .title','.mapboxgl-popup.big-map-card .chip-small .t','.mapboxgl-popup.big-map-card .chip-small .title']}},
    {key:'filter', label:'Filter Panel', selectors:{bg:['#filterPanel .panel-content'], text:['#filterPanel .panel-content'], title:['#filterPanel .panel-content .t','#filterPanel .panel-content .title'], btn:['#filterPanel button:not([class*="mapboxgl-"])','#filterPanel .sq','#filterPanel .tiny'], btnText:['#filterPanel button:not([class*="mapboxgl-"])','#filterPanel .sq','#filterPanel .tiny']}},
    {key:'calendar', label:'Calendar', selectors:{bg:['.calendar'], text:['.calendar .day'], weekday:['.calendar .weekday'], title:['.calendar .calendar-header'], header:['.calendar .calendar-header']}},
  {key:'adminPanel', label:'Admin Panel', selectors:{bg:['#adminPanel .panel-content'], text:['#adminPanel .panel-content'], title:['#adminPanel .panel-content .t','#adminPanel .panel-content .title'], btn:['#adminPanel button','#adminPanel #spinType span'], btnText:['#adminPanel button','#adminPanel #spinType span']}},
  {key:'welcome-modal', label:'Welcome Modal', selectors:{bg:['#welcome-modal .modal-content'], text:['#welcome-modal .modal-content'], title:['#welcome-modal .modal-content .t','#welcome-modal .modal-content .title'], btn:['#welcome-modal button:not([class*"mapboxgl-"])'], btnText:['#welcome-modal button:not([class*"mapboxgl-"])']}},
  {key:'memberPanel', label:'Member Panel', selectors:{bg:['#memberPanel .panel-content'], text:['#memberPanel .panel-content'], title:['#memberPanel .panel-content .t','#memberPanel .panel-content .title'], btn:['#memberPanel button'], btnText:['#memberPanel button']}},
  {key:'imagePanel', label:'Image Modal', selectors:{bg:['.image-modal-container'], text:['.image-modal-container .image-modal']}}
];

  function storeTitleDefaults(){
    colorAreas.forEach(area=>{
      (area.selectors.title||[]).forEach(sel=>{
        document.querySelectorAll(sel).forEach(el=>{
          const cs = getComputedStyle(el);
          el.dataset.titleDefaultColor = cs.color;
          el.dataset.titleDefaultFont = cs.fontFamily;
          el.dataset.titleDefaultSize = cs.fontSize;
          el.dataset.titleDefaultWeight = cs.fontWeight;
          el.dataset.titleDefaultShadow = cs.textShadow;
        });
      });
    });
    const varMap = {'today-c':'--today', 'sessionAvailable-c':'--session-available', 'sessionSelected-c':'--session-selected'};
    Object.entries(varMap).forEach(([id,varName])=>{
      const el = document.getElementById(id);
      if(el){
        const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        if(val) el.value = val;
      }
    });
  }

  function restoreTitleDefaults(area){
    (area.selectors.title||[]).forEach(sel=>{
      document.querySelectorAll(sel).forEach(el=>{
        if(el.dataset.titleDefaultColor) el.style.color = el.dataset.titleDefaultColor;
        if(el.dataset.titleDefaultFont) el.style.fontFamily = el.dataset.titleDefaultFont;
        if(el.dataset.titleDefaultSize) el.style.fontSize = el.dataset.titleDefaultSize;
        if(el.dataset.titleDefaultWeight) el.style.fontWeight = el.dataset.titleDefaultWeight;
        if(el.dataset.titleDefaultShadow) el.style.textShadow = el.dataset.titleDefaultShadow;
      });
    });
  }

  storeTitleDefaults();

  const headerEl = document.querySelector('.header');
  if(headerEl && 'ResizeObserver' in window){
    const headerObserver = new ResizeObserver(()=>{
      updateLayoutVars();
    });
    headerObserver.observe(headerEl);
  }

  window.addEventListener('resize', updateLayoutVars);
  window.addEventListener('resize', updateStickyImages);
  window.addEventListener('load', updateLayoutVars);
  updateLayoutVars();
  if (typeof updateStickyImages === 'function') {
    updateStickyImages();
  }
  if(typeof window.__wrapForInputYield === 'function'){
    ['openPost','updateVenue','togglePanel','ensureMapForVenue'].forEach(name => window.__wrapForInputYield(name));
  }
})();

// Extracted from <script>
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#adminPanel input[type="checkbox"]').forEach(cb => {
    if (cb.closest('.switch')) return;
    if (cb.closest('.subcategory-form-toggle')) return;
    const wrapper = document.createElement('label');
    wrapper.className = 'switch';
    cb.parentNode.insertBefore(wrapper, cb);
    wrapper.appendChild(cb);
    const slider = document.createElement('span');
    slider.className = 'slider';
    cb.after(slider);
  });
});

// Extracted from <script>
document.addEventListener('DOMContentLoaded', () => {
  const opacityInput = document.getElementById('postModeBgOpacity');
  const opacityVal = document.getElementById('postModeBgOpacityVal');
  const root = document.documentElement;

  function apply(){
    const opacity = opacityInput.value;
    root.style.setProperty('--post-mode-bg-color', '0,0,0'); // Always black
    root.style.setProperty('--post-mode-bg-opacity', opacity);
    opacityVal.textContent = Number(opacity).toFixed(2);
  }
  
  // Auto-save function for post mode shadow
  async function autoSavePostModeShadow(){
    const shadowValue = parseFloat(opacityInput.value);
    if(isNaN(shadowValue)) {
      console.error('Invalid shadow value:', opacityInput.value);
      return;
    }
    localStorage.setItem('post_mode_shadow', shadowValue);
    try {
      const response = await fetch('/gateway.php?action=save-admin-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_mode_shadow: shadowValue })
      });
      if(!response.ok){
        console.error('Failed to save post mode shadow: HTTP', response.status, response.statusText);
        const text = await response.text();
        console.error('Response:', text);
      } else {
        const result = await response.json();
        if(result && result.success !== false){
          console.log('Post mode shadow saved successfully:', shadowValue, result);
          if(result.settings_saved !== undefined){
            console.log('Settings saved count:', result.settings_saved);
          }
        } else {
          console.error('Failed to save post mode shadow:', result);
        }
      }
    } catch (e) {
      console.error('Failed to save post mode shadow:', e);
    }
  }

  if(opacityInput && opacityVal){
    // Load from localStorage (which is populated from database on page load)
    const savedValue = localStorage.getItem('post_mode_shadow');
    opacityInput.value = savedValue !== null ? savedValue : 0;
    apply();
    
    // Update display on slider input
    opacityInput.addEventListener('input', () => {
      opacityVal.textContent = parseFloat(opacityInput.value).toFixed(2);
    });
    
    // Auto-save on slider change
    opacityInput.addEventListener('change', () => {
      apply();
      autoSavePostModeShadow();
    });
    
    // Make value display editable on click
    if(!opacityVal.dataset.editableAdded){
      opacityVal.dataset.editableAdded = 'true';
      opacityVal.style.cursor = 'pointer';
      
      opacityVal.addEventListener('click', ()=>{
        const currentValue = opacityVal.textContent;
        const input = document.createElement('input');
        input.type = 'number';
        input.value = currentValue;
        input.min = 0;
        input.max = 1;
        input.step = 0.01;
        input.className = 'slider-value-input';
        input.style.width = '60px';
        input.style.textAlign = 'center';
        input.style.fontSize = '16px';
        input.style.fontWeight = 'bold';
        input.style.background = 'rgba(0,0,0,0.5)';
        input.style.color = '#fff';
        input.style.border = '1px solid #2e3a72';
        input.style.borderRadius = '4px';
        input.style.padding = '2px';
        
        const commitValue = ()=>{
          let newValue = parseFloat(input.value);
          if(isNaN(newValue)) newValue = parseFloat(currentValue);
          newValue = Math.max(0, Math.min(1, newValue));
          const formattedValue = newValue.toFixed(2);
          opacityVal.textContent = formattedValue;
          opacityVal.style.display = '';
          input.remove();
          opacityInput.value = newValue;
          apply();
          autoSavePostModeShadow();
        };
        
        input.addEventListener('blur', commitValue);
        input.addEventListener('keydown', (e)=>{
          if(e.key === 'Enter'){
            e.preventDefault();
            commitValue();
          } else if(e.key === 'Escape'){
            opacityVal.style.display = '';
            input.remove();
          }
        });
        
        opacityVal.style.display = 'none';
        opacityVal.parentNode.insertBefore(input, opacityVal);
        input.focus();
        input.select();
      });
    }
  }
});

// Extracted from <script>
document.addEventListener('DOMContentLoaded', () => {
  const vp = document.getElementById('viewport');
  const updateViewport = () => {
    if (!vp) return;
    if (window.innerWidth < 650) {
      vp.setAttribute('content','width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
    } else {
      vp.setAttribute('content','width=device-width, initial-scale=1');
    }
  };
  updateViewport();
  window.addEventListener('resize', updateViewport);
  window.addEventListener('orientationchange', updateViewport);

  const fsBtn = document.getElementById('fullscreenBtn');
  if (fsBtn) {
    const docEl = document.documentElement;
    const canFS = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
    const enabled = document.fullscreenEnabled || document.webkitFullscreenEnabled || document.mozFullScreenEnabled || document.msFullscreenEnabled;
    if (!canFS || enabled === false) {
      fsBtn.style.display = 'none';
    } else {
      const getFull = () => document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
      const updateFsState = () => {
        fsBtn.setAttribute('aria-pressed', getFull() ? 'true' : 'false');
      };
      updateFsState();
      ['fullscreenchange','webkitfullscreenchange','mozfullscreenchange','MSFullscreenChange'].forEach(evt => {
        document.addEventListener(evt, updateFsState);
      });
      fsBtn.addEventListener('click', () => {
        const isFull = getFull();
        if (!isFull) {
          const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
          if (req) {
            try {
              const result = req.call(docEl);
              if (result && typeof result.catch === 'function') result.catch(() => {});
            } catch (err) {
              updateFsState();
            }
          }
        } else {
          const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
          if (exit) {
            try {
              const result = exit.call(document);
              if (result && typeof result.catch === 'function') result.catch(() => {});
            } catch (err) {
              updateFsState();
            }
          }
        }
      });
    }
  }

  if (window.innerWidth >= 650) return;

  const posts = document.querySelector('.post-board');
  if (!posts) return;

  let defaultSize = parseFloat(getComputedStyle(posts).fontSize);
  let startDist = null;
  let enlarged = false;

  function distance(t1, t2){
    return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  }

  posts.addEventListener('touchstart', e => {
    if (e.target.tagName === 'IMG') return;
    if (e.touches.length === 2) {
      startDist = distance(e.touches[0], e.touches[1]);
    }
  });

  posts.addEventListener('touchmove', e => {
    if (e.target.tagName === 'IMG') return;
    if (e.touches.length === 2 && startDist) {
      const scale = distance(e.touches[0], e.touches[1]) / startDist;
      if (!enlarged && scale > 1.2) {
        posts.style.fontSize = (defaultSize * 1.2) + 'px';
        enlarged = true;
      } else if (enlarged && scale < 0.8) {
        posts.style.fontSize = defaultSize + 'px';
        enlarged = false;
      }
      e.preventDefault();
    }
  }, { passive: false });

  posts.addEventListener('touchend', e => {
    if (e.touches.length < 2) startDist = null;
  });

  posts.querySelectorAll('img').forEach(img => {
    img.addEventListener('click', e => { e.stopPropagation(); openImageModal(img.src, {origin: img}); });
    img.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        e.preventDefault();
        e.stopPropagation();
        openImageModal(img.src, {origin: img});
      }
    }, { passive: false });
  });
});

// Extracted from <script>
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('input[type="color"]').forEach(el => {
    if(!el.value) el.value = '#000000';
  });
});

// Extracted from <script>
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('wheel', e => {
    if(e.target.closest('.post-board, .panel-content, .options-menu, .calendar-scroll')){
      e.stopPropagation();
    }
  });
  const postsPanel = document.querySelector('.post-board');
  const postsBg = document.querySelector('.post-mode-background');
  if(postsPanel){
    postsPanel.addEventListener('click', e => {
      if(e.target === postsPanel || e.target.classList.contains('posts')){
        e.stopPropagation();
      }
    });
  }
  if(postsBg){
    postsBg.addEventListener('click', e => e.stopPropagation());
  }
});

// Extracted from <script>
let boardAdjustCleanup = null;

function ensureImageModalReady(){
  const container = document.querySelector('.image-modal-container');
  if(!container) return {container:null, modal:null};
  const modal = container.querySelector('.image-modal');
  if(!container._listenerAdded){
    container.addEventListener('click', e => {
      if(e.target === container){
        closeImageModal(container);
      }
    });
    container._listenerAdded = true;
  }
  if(modal && !modal._closeListenerAdded){
    modal.addEventListener('click', e => {
      if(!e.target.closest('img')){
        closeImageModal(container);
      }
    });
    modal._closeListenerAdded = true;
  }
  return {container, modal};
}

function closeImageModal(container){
  const target = container || ensureImageModalReady().container;
  if(!target) return;
  const modal = target.querySelector('.image-modal');
  if(modal) modal.innerHTML = '';
  target.classList.add('hidden');
  if(target.dataset){
    delete target.dataset.activeSrc;
    delete target.dataset.activeIndex;
  }
  target._imageModalState = null;
  target._imageModalImg = null;
}

function advanceImageModal(container, modal, step=1){
  if(!container || !modal) return;
  const state = container._imageModalState;
  if(!state || !Array.isArray(state.images) || state.images.length <= 1) return;
  const len = state.images.length;
  state.index = ((state.index + step) % len + len) % len;
  renderImageModalImage(container, modal);
}

function renderImageModalImage(container, modal){
  if(!container || !modal) return;
  const state = container._imageModalState;
  if(!state || !Array.isArray(state.images) || !state.images.length) return;
  let img = container._imageModalImg;
  if(!img || img.parentNode !== modal){
    modal.innerHTML = '';
    img = document.createElement('img');
    img.addEventListener('click', e => {
      e.stopPropagation();
      advanceImageModal(container, modal, 1);
    });
    container._imageModalImg = img;
    modal.appendChild(img);
  }
  const src = state.images[state.index];
  if(img.getAttribute('src') !== src){
    img.src = src;
  }
  if(container.dataset){
    container.dataset.activeSrc = src;
    container.dataset.activeIndex = String(state.index);
  }
}

function normalizeImageModalSrc(value){
  if(!value) return '';
  try {
    return new URL(value, window.location.href).href;
  } catch(err){
    return String(value);
  }
}

function resolveImageModalContext(config){
  const result = {images: [], index: 0, gallery: null};
  if(!config) return result;
  const src = typeof config.src === 'string' ? config.src : '';
  const providedImages = Array.isArray(config.images) ? config.images.filter(Boolean) : null;
  const originEl = config.origin instanceof Element ? config.origin : null;
  let galleryRoot = config.gallery instanceof Element ? config.gallery : null;
  const findGalleryFrom = el => {
    if(!el) return null;
    const fromImageBox = el.closest && el.closest('.image-box');
    if(fromImageBox) return fromImageBox;
    const postImages = el.closest && el.closest('.post-images');
    if(postImages){
      const box = postImages.querySelector('.image-box');
      if(box) return box;
    }
    const openPost = el.closest && el.closest('.open-post');
    if(openPost){
      const box = openPost.querySelector('.image-box');
      if(box) return box;
    }
    return null;
  };
  if(!galleryRoot && originEl){
    galleryRoot = findGalleryFrom(originEl);
  }
  let images = providedImages && providedImages.length ? providedImages.slice() : null;
  if((!images || !images.length) && galleryRoot){
    if(Array.isArray(galleryRoot._modalImages) && galleryRoot._modalImages.length){
      images = galleryRoot._modalImages.slice();
    } else if(galleryRoot.dataset && galleryRoot.dataset.modalImages){
      try {
        const parsed = JSON.parse(galleryRoot.dataset.modalImages);
        if(Array.isArray(parsed) && parsed.length){
          images = parsed.slice();
        }
      } catch(err){}
    }
  }
  if((!images || !images.length) && galleryRoot){
    const trackImgs = Array.from(galleryRoot.querySelectorAll('.image-track img'));
    if(trackImgs.length){
      images = trackImgs.map(im => (im.dataset && im.dataset.full) ? im.dataset.full : im.src);
    }
  }
  if(!images || !images.length){
    images = src ? [src] : [];
  }
  let index = null;
  if(typeof config.startIndex === 'number' && Number.isFinite(config.startIndex)){
    index = config.startIndex;
  } else if(typeof config.startIndex === 'string'){
    const parsedStart = parseInt(config.startIndex, 10);
    if(Number.isFinite(parsedStart)){
      index = parsedStart;
    }
  }
  const originImg = originEl && originEl.tagName === 'IMG' ? originEl : (originEl && originEl.querySelector ? originEl.querySelector('img') : null);
  if(index === null && originImg && originImg.dataset && originImg.dataset.index){
    const parsed = parseInt(originImg.dataset.index, 10);
    if(Number.isFinite(parsed)){
      index = parsed;
    }
  }
  if(index === null && galleryRoot && galleryRoot.dataset && galleryRoot.dataset.index){
    const parsed = parseInt(galleryRoot.dataset.index, 10);
    if(Number.isFinite(parsed)){
      index = parsed;
    }
  }
  if(index === null && src){
    const found = images.indexOf(src);
    if(found !== -1){
      index = found;
    } else {
      const normalizedSrc = normalizeImageModalSrc(src);
      for(let i=0;i<images.length;i++){
        if(normalizeImageModalSrc(images[i]) === normalizedSrc){
          index = i;
          break;
        }
      }
    }
  }
  if(index === null){
    index = 0;
  }
  index = Math.max(0, Math.min(index, images.length ? images.length - 1 : 0));
  result.images = images;
  result.index = index;
  result.gallery = galleryRoot;
  return result;
}

function openImageModal(srcOrConfig, options){
  const base = (typeof srcOrConfig === 'object' && srcOrConfig !== null && !Array.isArray(srcOrConfig))
    ? Object.assign({}, srcOrConfig)
    : {src: srcOrConfig};
  if(options && typeof options === 'object'){
    Object.assign(base, options);
  }
  if(typeof base.src !== 'string' || !base.src){
    return;
  }
  const {container, modal} = ensureImageModalReady();
  if(!container || !modal) return;
  document.querySelectorAll('.image-modal-container').forEach(other => {
    if(other !== container && !other.classList.contains('hidden')){
      closeImageModal(other);
    }
  });
  const context = resolveImageModalContext(base);
  if(!context.images.length) return;
  container._imageModalState = {
    images: context.images.slice(),
    index: context.index,
    gallery: context.gallery || null
  };
  renderImageModalImage(container, modal);
  container.classList.remove('hidden');
}

function initPostLayout(board){
  if(typeof boardAdjustCleanup === 'function'){
    boardAdjustCleanup();
    boardAdjustCleanup = null;
  }
  const scheduleMapResize = mapInstance => {
    if(!mapInstance) return;
    if(typeof mapInstance.resize === 'function'){
      requestAnimationFrame(()=>{
        try { mapInstance.resize(); } catch(err){}
      });
    }
  };
  if(!(board instanceof Element)){
    document.documentElement.style.removeProperty('--post-header-h');
    if(typeof window.adjustBoards === 'function') window.adjustBoards();
    return;
  }
  const openPost = board.querySelector('.open-post');
  if(!openPost){
    document.body.classList.remove('detail-open');
    document.body.classList.remove('hide-map-calendar');
    document.documentElement.style.removeProperty('--post-header-h');
    if(typeof window.adjustBoards === 'function') window.adjustBoards();
    return;
  }
  document.body.classList.add('detail-open');
  document.body.classList.remove('hide-map-calendar');
  const postBody = openPost.querySelector('.post-body');
  if(postBody){
    postBody.removeAttribute('hidden');
    postBody.classList.remove('is-visible');
    if(postBody.dataset) delete postBody.dataset.openPostId;
  }
  const triggerDetailMapResize = target => {
    if(!target) return;
    const mapNode = target.querySelector ? target.querySelector('.post-map') : null;
    const ref = target._detailMap || (mapNode && mapNode._detailMap) || null;
    const mapInstance = ref && ref.map;
    if(mapInstance && typeof mapInstance.resize === 'function'){
      scheduleMapResize(mapInstance);
    }
  };
  triggerDetailMapResize(postBody);
  const thumbRow = postBody ? postBody.querySelector('.thumbnail-row') : null;
  const selectedImageBox = postBody ? postBody.querySelector('.selected-image, .image-box') : null;
  ensureImageModalReady();
  if(thumbRow){
    thumbRow.scrollLeft = 0;
  }
  if(thumbRow && !thumbRow._imageModalListener){
    thumbRow.addEventListener('dblclick', e => {
      const img = e.target.closest('img');
      if(img){
        e.preventDefault();
        e.stopPropagation();
        openImageModal(img.src, {origin: img});
      }
    });
    thumbRow._imageModalListener = true;
  }
  if(selectedImageBox && !selectedImageBox._imageModalListener){
    selectedImageBox.addEventListener('click', evt => {
      const currentTarget = (evt && evt.currentTarget instanceof Element)
        ? evt.currentTarget
        : selectedImageBox;
      const clickedImageBox = (evt && evt.target instanceof Element)
        ? evt.target.closest('.image-box')
        : null;
      if(clickedImageBox){
        return;
      }
      const parseIndex = value => {
        if(typeof value === 'undefined') return null;
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : null;
      };
      let galleryRoot = null;
      if(currentTarget instanceof Element){
        if(currentTarget.classList.contains('image-box')){
          galleryRoot = currentTarget;
        } else {
          const postImages = typeof currentTarget.closest === 'function'
            ? currentTarget.closest('.post-images')
            : null;
          const parent = currentTarget.parentElement;
          const host = postImages || parent;
          if(host instanceof Element){
            galleryRoot = host.querySelector('.image-box');
          }
        }
      }
      const activeImg = galleryRoot ? galleryRoot.querySelector('.image-track img.active') : null;
      let img = activeImg || (currentTarget instanceof Element ? currentTarget.querySelector('img') : null);
      if(!img && galleryRoot){
        img = galleryRoot.querySelector('img');
      }
      if(!(img instanceof Element)){
        return;
      }
      if(evt && typeof evt.preventDefault === 'function') evt.preventDefault();
      if(evt && typeof evt.stopPropagation === 'function') evt.stopPropagation();
      let startIndex = null;
      if(activeImg && activeImg.dataset){
        startIndex = parseIndex(activeImg.dataset.index);
      }
      if(startIndex === null && galleryRoot && galleryRoot.dataset){
        startIndex = parseIndex(galleryRoot.dataset.index);
      }
      if(startIndex === null && img.dataset){
        startIndex = parseIndex(img.dataset.index);
      }
      const options = {origin: img};
      if(galleryRoot){
        options.gallery = galleryRoot;
      }
      if(startIndex !== null){
        options.startIndex = startIndex;
      }
      const src = (img.dataset && img.dataset.full) ? img.dataset.full : img.src;
      openImageModal(src, options);
    });
    selectedImageBox._imageModalListener = true;
  }
  if(typeof updateStickyImages === 'function'){
    updateStickyImages();
  }
  const updateMetrics = () => {
    if(typeof updateStickyImages === 'function'){
      updateStickyImages();
    }
    if(openPost){
      const cardHeader = openPost.querySelector('.post-card');
      if(cardHeader){
        document.documentElement.style.setProperty('--post-header-h', cardHeader.offsetHeight + 'px');
      } else {
        document.documentElement.style.removeProperty('--post-header-h');
      }
    }
    triggerDetailMapResize(postBody);
    if(typeof window.adjustBoards === 'function') window.adjustBoards();
  };
  updateMetrics();
  window.addEventListener('resize', updateMetrics);
  window.addEventListener('load', updateMetrics);
  boardAdjustCleanup = () => {
    window.removeEventListener('resize', updateMetrics);
    window.removeEventListener('load', updateMetrics);
  };
}

document.addEventListener('DOMContentLoaded', () => {
  initPostLayout(document.querySelector('.post-board'));
});

// Extracted from <script>
(function(){
  const MESSAGE = 'Please enter a valid URL with a dot and letters after it.';
  const DOT_PATTERN = /\.[A-Za-z]{2,}(?=[^A-Za-z]|$)/;
  const processed = new WeakSet();
  let observerStarted = false;

  function normalizeUrl(value){
    const raw = typeof value === 'string' ? value.trim() : '';
    if(!raw) return '';
    const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw);
    const candidate = hasScheme ? raw : `https://${raw}`;
    try {
      const normalized = new URL(candidate);
      return normalized.href;
    } catch(err){
      return '';
    }
  }

  function disableLink(link){
    if(!link) return;
    link.setAttribute('aria-disabled','true');
    link.removeAttribute('href');
    link.tabIndex = -1;
  }

  function enableLink(link, href){
    if(!link) return;
    link.removeAttribute('aria-disabled');
    link.href = href;
    if(!link.hasAttribute('target')){
      link.target = '_blank';
    }
    const rel = link.getAttribute('rel') || '';
    const relParts = new Set(rel.split(/\s+/).filter(Boolean));
    relParts.add('noopener');
    relParts.add('noreferrer');
    link.setAttribute('rel', Array.from(relParts).join(' '));
    if(link.tabIndex < 0) link.tabIndex = 0;
  }

  function applyUrlBehavior(input){
    if(!(input instanceof HTMLInputElement)) return;
    if(processed.has(input)) return;
    processed.add(input);
    if(!input.dataset.urlMessage){
      input.dataset.urlMessage = MESSAGE;
    }
    input.setAttribute('pattern', '.*\\.[A-Za-z]{2,}.*');
    input.autocomplete = input.autocomplete || 'url';
    input.inputMode = input.inputMode || 'url';
    input.setAttribute('title', input.dataset.urlMessage);
    const linkId = input.dataset.urlLinkId || '';
    const link = linkId ? document.getElementById(linkId) : null;

    if(link){
      link.addEventListener('click', event => {
        if(link.getAttribute('aria-disabled') === 'true'){
          event.preventDefault();
          event.stopPropagation();
        }
      });
    }

    const validate = ()=>{
      const value = input.value != null ? String(input.value).trim() : '';
      if(!value){
        input.setCustomValidity('');
        if(link) disableLink(link);
        return;
      }
      if(!DOT_PATTERN.test(value)){
        input.setCustomValidity(input.dataset.urlMessage || MESSAGE);
        if(link) disableLink(link);
        return;
      }
      const normalized = normalizeUrl(value);
      if(normalized){
        input.setCustomValidity('');
        if(link) enableLink(link, normalized);
      } else {
        input.setCustomValidity(input.dataset.urlMessage || MESSAGE);
        if(link) disableLink(link);
      }
    };

    input.addEventListener('input', validate);
    input.addEventListener('change', validate);
    input.addEventListener('blur', validate);
    validate();
  }

  function scan(root){
    if(!root) return;
    const list = root.querySelectorAll ? root.querySelectorAll('input[data-url-type]') : [];
    list.forEach(applyUrlBehavior);
  }

  function startObserver(){
    if(observerStarted || !document.body) return;
    observerStarted = true;
    const observer = new MutationObserver(mutations => {
      for(const mutation of mutations){
        if(mutation.type === 'childList'){
          mutation.addedNodes.forEach(node => {
            if(!(node instanceof Element)) return;
            if(node.matches && node.matches('input[data-url-type]')){
              applyUrlBehavior(node);
            }
            if(node.querySelectorAll){
              node.querySelectorAll('input[data-url-type]').forEach(applyUrlBehavior);
            }
          });
        } else if(mutation.type === 'attributes'){
          const target = mutation.target;
          if(target instanceof HTMLInputElement && target.hasAttribute('data-url-type')){
            applyUrlBehavior(target);
          }
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-url-type']
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => {
      scan(document);
      startObserver();
    }, { once: true });
  } else {
    scan(document);
    startObserver();
  }
})();

// Extracted from <script>
(function(){
  const DEFAULT_MAX = 10;
  const processed = new WeakSet();
  let observerStarted = false;
  let dragState = null;

  function handleThumbDragStart(event){
    const targetEl = event.target instanceof Element ? event.target : null;
    if(targetEl && targetEl.closest('.form-preview-image-remove')){
      event.preventDefault();
      return;
    }
    let thumb = targetEl ? targetEl.closest('.form-preview-image-thumb') : null;
    if(!thumb && event.currentTarget instanceof Element){
      thumb = event.currentTarget.closest('.form-preview-image-thumb');
    }
    if(!thumb) return;
    const previewEl = thumb ? thumb.parentElement : null;
    if(!previewEl || !previewEl._imageInput) return;
    const index = Number.parseInt(thumb.dataset.index || '', 10);
    dragState = {
      input: previewEl._imageInput,
      fromIndex: Number.isNaN(index) ? -1 : index,
      thumb
    };
    thumb.classList.add('is-dragging');
    if(event.dataTransfer){
      event.dataTransfer.effectAllowed = 'move';
      try{ event.dataTransfer.setData('text/plain', thumb.dataset.index || ''); }catch(err){}
    }
  }

  function handleThumbDragEnd(event){
    let thumb = event.target instanceof Element ? event.target.closest('.form-preview-image-thumb') : null;
    if(!thumb && event.currentTarget instanceof Element){
      thumb = event.currentTarget.closest('.form-preview-image-thumb');
    }
    if(!thumb) return;
    thumb.classList.remove('is-dragging');
    if(dragState && dragState.thumb === thumb){
      dragState = null;
    }
  }

  function handlePreviewDragOver(event){
    if(!dragState) return;
    const previewEl = event.currentTarget;
    if(!previewEl || previewEl._imageInput !== dragState.input) return;
    event.preventDefault();
    if(event.dataTransfer){
      event.dataTransfer.dropEffect = 'move';
    }
  }

  function handlePreviewDrop(event){
    if(!dragState) return;
    const previewEl = event.currentTarget;
    if(!previewEl || previewEl._imageInput !== dragState.input) return;
    event.preventDefault();
    event.stopPropagation();
    const files = getStoredFiles(dragState.input);
    const from = dragState.fromIndex;
    if(from < 0 || from >= files.length){
      if(dragState.thumb){
        dragState.thumb.classList.remove('is-dragging');
      }
      dragState = null;
      return;
    }
    let insertIndex = getDropInsertIndex(previewEl, event);
    if(!Number.isInteger(insertIndex) || insertIndex < 0){
      insertIndex = files.length;
    }
    const [moved] = files.splice(from, 1);
    if(insertIndex > files.length){
      insertIndex = files.length;
    }
    if(from < insertIndex){
      insertIndex--;
    }
    if(insertIndex < 0){
      insertIndex = 0;
    }
    files.splice(insertIndex, 0, moved);
    if(dragState.thumb){
      dragState.thumb.classList.remove('is-dragging');
    }
    const input = dragState.input;
    dragState = null;
    storeFiles(input, files);
    renderPreviews(input);
  }

  function getDropInsertIndex(previewEl, event){
    if(!previewEl) return 0;
    const thumbs = Array.from(previewEl.querySelectorAll('.form-preview-image-thumb'));
    if(thumbs.length === 0) return 0;
    const pointerX = event.clientX;
    const pointerY = event.clientY;
    let fallbackIndex = 0;
    for(const thumb of thumbs){
      if(dragState && dragState.thumb === thumb) continue;
      const rect = thumb.getBoundingClientRect();
      const datasetIndex = Number.parseInt(thumb.dataset.index || '', 10);
      if(Number.isNaN(datasetIndex)) continue;
      const centerX = rect.left + rect.width / 2;
      if(pointerY < rect.top){
        return datasetIndex;
      }
      if(pointerY <= rect.bottom){
        if(pointerX < centerX){
          return datasetIndex;
        }
        fallbackIndex = datasetIndex + 1;
        continue;
      }
      fallbackIndex = datasetIndex + 1;
    }
    return fallbackIndex;
  }

  function getMax(input){
    return Number.parseInt(input.dataset.maxImages, 10) || DEFAULT_MAX;
  }

  function getStoredFiles(input){
    if(Array.isArray(input._imageFiles)){
      return input._imageFiles.slice();
    }
    const files = Array.from(input.files || []);
    input._imageFiles = files.slice();
    return files;
  }

  function storeFiles(input, files){
    const copy = files.slice();
    if(typeof DataTransfer !== 'undefined'){
      try {
        const dt = new DataTransfer();
        copy.forEach(file => {
          try { dt.items.add(file); } catch(err){}
        });
        input.files = dt.files;
      } catch(err){}
    }
    input._imageFiles = copy;
    if(copy.length === 0){
      try { input.value = ''; } catch(err){}
    }
  }

  function updateLimitMessage(input, totalSelected){
    const max = getMax(input);
    if(totalSelected > max){
      input._imageLimitMessage = `Only the first ${max} images will be used.`;
    } else {
      input._imageLimitMessage = '';
    }
  }

  function removeImageAt(input, index){
    const files = getStoredFiles(input);
    if(index < 0 || index >= files.length) return;
    files.splice(index, 1);
    updateLimitMessage(input, files.length);
    storeFiles(input, files);
    renderPreviews(input);
  }

  function renderPreviews(input){
    if(!(input instanceof HTMLInputElement)) return;
    const previewId = input.dataset.imagePreviewTarget || '';
    const messageId = input.dataset.imageMessageTarget || '';
    const previewEl = previewId ? document.getElementById(previewId) : null;
    const messageEl = messageId ? document.getElementById(messageId) : null;
    const files = getStoredFiles(input);
    if(messageEl){
      const message = input._imageLimitMessage || '';
      if(message){
        messageEl.textContent = message;
        messageEl.hidden = false;
      } else {
        messageEl.textContent = '';
        messageEl.hidden = true;
      }
    }
    if(previewEl){
      previewEl._imageInput = input;
      if(!previewEl._dragHandlersAttached){
        previewEl.addEventListener('dragover', handlePreviewDragOver);
        previewEl.addEventListener('drop', handlePreviewDrop);
        previewEl._dragHandlersAttached = true;
      }
      previewEl.innerHTML = '';
      files.forEach((file, index) => {
        const thumb = document.createElement('div');
        thumb.className = 'form-preview-image-thumb';
        thumb.dataset.index = String(index);
        thumb.draggable = true;
        thumb.addEventListener('dragstart', handleThumbDragStart);
        thumb.addEventListener('dragend', handleThumbDragEnd);
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'form-preview-image-remove';
        removeBtn.setAttribute('aria-label', file.name ? `Remove ${file.name}` : `Remove image ${index + 1}`);
        removeBtn.innerHTML = '<span aria-hidden="true">&times;</span>';
        removeBtn.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          if(typeof event.stopImmediatePropagation === 'function'){
            event.stopImmediatePropagation();
          }
          removeImageAt(input, index);
        });
        const img = document.createElement('img');
        img.alt = file.name ? `${file.name} preview` : `Image preview ${index + 1}`;
        img.draggable = true;
        img.addEventListener('dragstart', handleThumbDragStart);
        img.addEventListener('dragend', handleThumbDragEnd);
        thumb.append(removeBtn, img);
        previewEl.appendChild(thumb);
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          if(typeof reader.result === 'string'){
            img.src = reader.result;
          }
        });
        try {
          reader.readAsDataURL(file);
        } catch(err){}
      });
    }
  }

  function handleSelectionChange(input){
    const newFiles = Array.from(input.files || []);
    const existing = getStoredFiles(input);
    if(newFiles.length === 0){
      storeFiles(input, existing);
      renderPreviews(input);
      return;
    }
    const combined = existing.concat(newFiles);
    updateLimitMessage(input, combined.length);
    const max = getMax(input);
    const limited = combined.slice(0, max);
    storeFiles(input, limited);
    renderPreviews(input);
  }

  function applyImageBehavior(input){
    if(!(input instanceof HTMLInputElement)) return;
    if(input.type !== 'file') return;
    if(processed.has(input)) return;
    processed.add(input);
    input.multiple = true;
    if(!input.accept) input.accept = 'image/*';
    const initialFiles = Array.from(input.files || []);
    updateLimitMessage(input, initialFiles.length);
    const max = getMax(input);
    const limited = initialFiles.slice(0, max);
    storeFiles(input, limited);
    renderPreviews(input);
    input.addEventListener('change', () => handleSelectionChange(input));
  }

  function scan(root){
    if(!root) return;
    const list = root.querySelectorAll ? root.querySelectorAll('input[data-images-field]') : [];
    list.forEach(applyImageBehavior);
  }

  function startObserver(){
    if(observerStarted || !document.body) return;
    observerStarted = true;
    const observer = new MutationObserver(mutations => {
      for(const mutation of mutations){
        if(mutation.type === 'childList'){
          mutation.addedNodes.forEach(node => {
            if(!(node instanceof Element)) return;
            if(node.matches && node.matches('input[data-images-field]')){
              applyImageBehavior(node);
            }
            if(node.querySelectorAll){
              node.querySelectorAll('input[data-images-field]').forEach(applyImageBehavior);
            }
          });
        } else if(mutation.type === 'attributes'){
          const target = mutation.target;
          if(target instanceof HTMLInputElement && target.hasAttribute('data-images-field')){
            applyImageBehavior(target);
          }
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-images-field']
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => {
      scan(document);
      startObserver();
    }, { once: true });
  } else {
    scan(document);
    startObserver();
  }
})();

// Extracted from <script>
(function(){
  const MESSAGE = 'Please include "@" and "." in the email address.';
  const processedForms = new WeakSet();

  function ensureFormListener(form){
    if(!form || processedForms.has(form)) return;
    form.addEventListener('submit', () => {
      const candidates = form.querySelectorAll('input[data-email-textboxified="true"]');
      candidates.forEach(input => {
        if(typeof input._emailTextboxValidate === 'function'){
          input._emailTextboxValidate();
        }
      });
    }, true);
    processedForms.add(form);
  }

  function applyEmailBehavior(input){
    if(!(input instanceof HTMLInputElement)) return;
    if(input.dataset.emailTextboxified === 'true') return;
    input.dataset.emailTextboxified = 'true';
    try {
      input.type = 'text';
    } catch(err) {}
    ensureFormListener(input.form || null);

    const validate = () => {
      const value = input.value != null ? String(input.value).trim() : '';
      if(!value){
        input.setCustomValidity('');
        return;
      }
      if(value.includes('@') && value.includes('.')){
        input.setCustomValidity('');
      } else {
        input.setCustomValidity(MESSAGE);
      }
    };

    input._emailTextboxValidate = validate;
    input.addEventListener('input', validate);
    input.addEventListener('change', validate);
    input.addEventListener('blur', validate);
    if(typeof input.setAttribute === 'function'){
      input.setAttribute('title', MESSAGE);
    }
    validate();
  }

  function scan(root){
    if(!root) return;
    const list = root.querySelectorAll ? root.querySelectorAll('input[type="email"]') : [];
    list.forEach(applyEmailBehavior);
  }

  function handleMutations(mutations){
    for(const mutation of mutations){
      if(mutation.type === 'childList'){
        mutation.addedNodes.forEach(node => {
          if(!(node instanceof Element)) return;
          if(node.matches && node.matches('input[type="email"]')){
            applyEmailBehavior(node);
          }
          if(node.querySelectorAll){
            node.querySelectorAll('input[type="email"]').forEach(applyEmailBehavior);
          }
        });
      } else if(mutation.type === 'attributes'){
        const target = mutation.target;
        if(target instanceof HTMLInputElement && target.type === 'email'){
          applyEmailBehavior(target);
        }
      }
    }
  }

  function init(){
    if(!document.body){
      return;
    }
    scan(document);
    const observer = new MutationObserver(handleMutations);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['type']
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

// Extracted from <script>
(function(){
  const USERS_KEY = 'member-auth-users';
  const CURRENT_KEY = 'member-auth-current';
  let users = [];
  let currentUser = null;
  let statusTimer = null;
  let lastAction = 'login';

  let form = null;
  let container = null;
  let tabsWrap = null;
  let loginTab = null;
  let registerTab = null;
  let loginPanel = null;
  let registerPanel = null;
  let profilePanel = null;
  let loginInputs = [];
  let registerInputs = [];
  let profileAvatar = null;
  let profileName = null;
  let profileEmail = null;
  let logoutBtn = null;

  function normalizeUser(user){
    if(!user || typeof user !== 'object') return null;
    const emailRaw = typeof user.email === 'string' ? user.email.trim() : '';
    const normalized = typeof user.emailNormalized === 'string' && user.emailNormalized.trim()
      ? user.emailNormalized.trim().toLowerCase()
      : emailRaw.toLowerCase();
    if(!normalized) return null;
    const usernameRaw = typeof user.username === 'string' ? user.username.trim() : '';
    const username = usernameRaw || normalized;
    return {
      name: typeof user.name === 'string' ? user.name.trim() : '',
      email: emailRaw,
      emailNormalized: normalized,
      username,
      password: typeof user.password === 'string' ? user.password : '',
      avatar: typeof user.avatar === 'string' ? user.avatar.trim() : ''
    };
  }

  function loadUsers(){
    try{
      const raw = localStorage.getItem(USERS_KEY);
      if(!raw) return [];
      const parsed = JSON.parse(raw);
      if(!Array.isArray(parsed)) return [];
      return parsed.map(normalizeUser).filter(Boolean);
    }catch(err){
      return [];
    }
  }

  function saveUsers(list){
    users = Array.isArray(list) ? list.map(normalizeUser).filter(Boolean) : [];
    try{
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }catch(err){}
  }

  function extractRoleFlags(source){
    if(!source || typeof source !== 'object') return {};
    const flags = {};
    Object.keys(source).forEach(key => {
      if(typeof source[key] === 'boolean' && (key.startsWith('is') || key.startsWith('can'))){
        flags[key] = source[key];
      }
    });
    if(Array.isArray(source.roles)){
      const cleaned = source.roles
        .map(role => typeof role === 'string' ? role.trim() : '')
        .filter(Boolean);
      if(cleaned.length){
        flags.roles = cleaned;
      }
    }
    if(typeof source.role === 'string'){
      const trimmedRole = source.role.trim();
      if(trimmedRole){
        flags.role = trimmedRole;
      }
    }
    return flags;
  }

  function storeCurrent(user){
    try{
      if(user){
        const idValue = (()=>{
          if(typeof user.id === 'number' && Number.isFinite(user.id)) return user.id;
          if(typeof user.id === 'string'){
            const trimmed = user.id.trim();
            if(!trimmed) return null;
            const numeric = Number(trimmed);
            return Number.isFinite(numeric) ? numeric : trimmed;
          }
          return null;
        })();
        const storedType = (()=>{
          if(user && user.isAdmin) return 'admin';
          if(typeof user.type === 'string'){
            const trimmedType = user.type.trim();
            if(trimmedType){
              return trimmedType.toLowerCase() === 'admin' ? 'admin' : trimmedType;
            }
          }
          return 'member';
        })();
        const payload = {
          type: storedType,
          username: typeof user.username === 'string' ? user.username : '',
          email: typeof user.email === 'string' ? user.email : '',
          name: typeof user.name === 'string' ? user.name : '',
          avatar: typeof user.avatar === 'string' ? user.avatar : ''
        };
        if(idValue !== null){
          payload.id = idValue;
        }
        const roleData = extractRoleFlags(user);
        Object.keys(roleData).forEach(key => {
          payload[key] = roleData[key];
        });
        if(typeof user.emailNormalized === 'string' && user.emailNormalized){
          payload.emailNormalized = user.emailNormalized;
        }
        localStorage.setItem(CURRENT_KEY, JSON.stringify(payload));
      } else {
        localStorage.removeItem(CURRENT_KEY);
      }
    }catch(err){}
  }

  function loadStoredCurrent(){
    try{
      const raw = localStorage.getItem(CURRENT_KEY);
      if(!raw) return null;
      const parsed = JSON.parse(raw);
      if(!parsed || typeof parsed !== 'object') return null;
      const rawType = typeof parsed.type === 'string' ? parsed.type.trim() : '';
      const typeLower = rawType.toLowerCase();
      const type = typeLower === 'admin' ? 'admin' : (rawType || 'member');
      const username = typeof parsed.username === 'string' ? parsed.username : '';
      const emailRaw = typeof parsed.email === 'string' ? parsed.email : username;
      const storedNormalizedEmail = typeof parsed.emailNormalized === 'string'
        ? parsed.emailNormalized.trim().toLowerCase()
        : '';
      const normalized = storedNormalizedEmail || (typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : '');
      const storedId = (()=>{
        if(typeof parsed.id === 'number' && Number.isFinite(parsed.id)) return parsed.id;
        if(typeof parsed.id === 'string'){
          const trimmed = parsed.id.trim();
          if(!trimmed) return null;
          const numeric = Number(trimmed);
          return Number.isFinite(numeric) ? numeric : trimmed;
        }
        return null;
      })();
      const storedRoles = extractRoleFlags(parsed);
      if(type === 'admin'){
        if(window.adminAuthManager){
          window.adminAuthManager.setAuthenticated(true, username || emailRaw || 'admin');
        }
        return {
          id: storedId,
          name: parsed.name || 'Administrator',
          email: emailRaw,
          emailNormalized: normalized || 'admin',
          username: username || emailRaw || 'admin',
          avatar: parsed.avatar || '',
          type: 'admin',
          ...storedRoles,
          isAdmin: true
        };
      }
      if(normalized){
        const existing = users.find(u => u.emailNormalized === normalized);
        if(existing){
          return { ...existing, id: storedId, ...storedRoles, type };
        }
      }
      if(!emailRaw){
        return null;
      }
      return {
        id: storedId,
        name: parsed.name || '',
        email: emailRaw,
        emailNormalized: normalized || emailRaw.toLowerCase(),
        username: username || normalized || emailRaw,
        avatar: parsed.avatar || '',
        type,
        ...storedRoles,
        isAdmin: !!storedRoles.isAdmin && storedRoles.isAdmin === true
      };
    }catch(err){}
    return null;
  }

  function svgPlaceholder(letter){
    const palette = ['#2e3a72','#0ea5e9','#f97316','#14b8a6','#a855f7'];
    const color = palette[letter.charCodeAt(0) % palette.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="${color}"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-size="36" font-family="Inter, Arial, sans-serif" fill="#ffffff">${letter}</text></svg>`;
    try{
      return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    }catch(err){
      return `data:image/svg+xml;base64,${btoa(svg)}`;
    }
  }

  function createPlaceholder(name){
    const trimmed = (name || '').trim();
    const initial = trimmed ? trimmed[0].toUpperCase() : 'U';
    return svgPlaceholder(initial);
  }

  function getAvatarSource(user){
    if(!user) return createPlaceholder('');
    const raw = user.avatar ? String(user.avatar).trim() : '';
    if(raw) return raw;
    return createPlaceholder(user.name || user.email || 'U');
  }

  function ensureMemberAvatarImage(){
    const memberBtn = document.getElementById('memberBtn');
    if(!memberBtn) return null;
    let img = memberBtn.querySelector('.member-avatar');
    if(!img){
      img = document.createElement('img');
      img.className = 'member-avatar';
      img.alt = '';
      img.setAttribute('aria-hidden','true');
      memberBtn.appendChild(img);
    }
    return img;
  }

  function updateMemberButton(user){
    const memberBtn = document.getElementById('memberBtn');
    if(!memberBtn) return;
    const img = ensureMemberAvatarImage();
    if(!img) return;
    img.onerror = null;
    img.removeAttribute('data-fallback-applied');
    if(user){
      const descriptor = user.name || user.email || 'Member';
      img.dataset.fallbackApplied = '';
      img.onerror = () => {
        if(img.dataset.fallbackApplied === '1') return;
        img.dataset.fallbackApplied = '1';
        img.src = createPlaceholder(descriptor);
      };
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = getAvatarSource(user);
      memberBtn.classList.add('has-avatar');
      memberBtn.setAttribute('aria-label', `Open members area for ${descriptor}`);
    } else {
      img.removeAttribute('src');
      img.removeAttribute('data-fallback-applied');
      memberBtn.classList.remove('has-avatar');
      memberBtn.setAttribute('aria-label', 'Open members area');
    }
  }

  async function showStatus(message, options = {}){
    const statusEl = document.getElementById('memberStatusMessage');
    if(!statusEl) return;
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
    if(statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      statusEl.classList.remove('show');
      statusEl.classList.remove('error','success');
      statusEl.setAttribute('aria-hidden','true');
    }, 2400);
  }

  function disableInputs(list, disabled){
    list.forEach(input => {
      input.disabled = !!disabled;
    });
  }

  function clearInputs(list){
    list.forEach(input => {
      if('value' in input){
        input.value = '';
      }
    });
  }

  function setAuthPanelState(panelEl, isActive, inputs){
    if(!panelEl) return;
    if(Array.isArray(inputs)){
      disableInputs(inputs, !isActive);
    }
    const submitBtn = panelEl.querySelector('.member-auth-submit');
    if(submitBtn){
      if(!isActive){
        submitBtn.dataset.memberAuthPrevDisabled = submitBtn.disabled ? 'true' : 'false';
        submitBtn.disabled = true;
      } else if('memberAuthPrevDisabled' in submitBtn.dataset){
        submitBtn.disabled = submitBtn.dataset.memberAuthPrevDisabled === 'true';
        delete submitBtn.dataset.memberAuthPrevDisabled;
      } else {
        submitBtn.disabled = false;
      }
    }
    if(!isActive){
      const activeEl = document.activeElement;
      if(activeEl && panelEl.contains(activeEl) && typeof activeEl.blur === 'function'){
        activeEl.blur();
      }
      panelEl.setAttribute('inert','');
    } else {
      panelEl.removeAttribute('inert');
    }
    panelEl.hidden = !isActive;
    panelEl.setAttribute('aria-hidden', (!isActive).toString());
  }

  function focusFirstAuthField(panelEl){
    if(!panelEl || panelEl.hidden) return;
    let ancestor = panelEl.parentElement;
    while(ancestor){
      if(ancestor.hidden || ancestor.getAttribute && ancestor.getAttribute('aria-hidden') === 'true'){
        return;
      }
      ancestor = ancestor.parentElement;
    }
    const target = panelEl.querySelector('input:not([type="hidden"]):not([disabled])')
      || panelEl.querySelector('select:not([disabled])')
      || panelEl.querySelector('textarea:not([disabled])')
      || panelEl.querySelector('button:not([disabled])');
    if(target && typeof target.focus === 'function'){
      requestAnimationFrame(() => target.focus());
    }
  }

  function setActivePanel(panel){
    if(!container || container.dataset.state === 'logged-in') return;
    const target = panel === 'register' ? 'register' : 'login';
    const isLogin = target === 'login';
    if(loginTab) loginTab.setAttribute('aria-selected', isLogin ? 'true' : 'false');
    if(registerTab) registerTab.setAttribute('aria-selected', !isLogin ? 'true' : 'false');
    setAuthPanelState(loginPanel, isLogin, loginInputs);
    setAuthPanelState(registerPanel, !isLogin, registerInputs);
    container.dataset.active = target;
    lastAction = target;
    focusFirstAuthField(isLogin ? loginPanel : registerPanel);
  }

  function render(){
    if(window.adminAuthManager){
      if(currentUser && currentUser.isAdmin){
        const identity = currentUser.username || currentUser.email || 'admin';
        window.adminAuthManager.setAuthenticated(true, identity);
      } else {
        window.adminAuthManager.setAuthenticated(false);
      }
    }
    if(!container) return;
    if(currentUser){
      container.dataset.state = 'logged-in';
      setAuthPanelState(loginPanel, false, loginInputs);
      setAuthPanelState(registerPanel, false, registerInputs);
      clearInputs(loginInputs);
      clearInputs(registerInputs);
      if(profilePanel){
        profilePanel.hidden = false;
        profilePanel.setAttribute('aria-hidden','false');
        profilePanel.removeAttribute('inert');
      }
      if(profileAvatar){
        const descriptor = currentUser.name || currentUser.email || 'Member';
        profileAvatar.dataset.fallbackApplied = '';
        profileAvatar.onerror = () => {
          if(profileAvatar.dataset.fallbackApplied === '1') return;
          profileAvatar.dataset.fallbackApplied = '1';
          profileAvatar.src = createPlaceholder(descriptor);
        };
        profileAvatar.loading = 'lazy';
        profileAvatar.decoding = 'async';
        profileAvatar.src = getAvatarSource(currentUser);
        profileAvatar.alt = `${descriptor}'s avatar`;
      }
      if(profileName) profileName.textContent = currentUser.name || 'Member';
      if(profileEmail) profileEmail.textContent = currentUser.email || '';
      if(tabsWrap) tabsWrap.setAttribute('aria-hidden','true');
      updateMemberButton(currentUser);
      lastAction = 'login';
      if(window.memberPanelChangeManager && typeof window.memberPanelChangeManager.markSaved === 'function'){
        window.memberPanelChangeManager.markSaved();
      }
    } else {
      container.dataset.state = 'logged-out';
      if(profilePanel){
        profilePanel.hidden = true;
        profilePanel.setAttribute('aria-hidden','true');
        profilePanel.setAttribute('inert','');
      }
      if(profileAvatar){
        profileAvatar.onerror = null;
        profileAvatar.removeAttribute('src');
        profileAvatar.removeAttribute('data-fallback-applied');
        profileAvatar.alt = '';
      }
      if(profileName) profileName.textContent = '';
      if(profileEmail) profileEmail.textContent = '';
      if(tabsWrap) tabsWrap.removeAttribute('aria-hidden');
      const active = container.dataset.active === 'register' ? 'register' : 'login';
      setActivePanel(active);
      clearInputs(loginInputs);
      clearInputs(registerInputs);
      updateMemberButton(null);
      if(window.memberPanelChangeManager && typeof window.memberPanelChangeManager.markSaved === 'function'){
        window.memberPanelChangeManager.markSaved();
      }
    }
  }

  async function handleLogin(){
    const emailInput = document.getElementById('memberLoginEmail');
    const passwordInput = document.getElementById('memberLoginPassword');
    const usernameRaw = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';
    if(!usernameRaw || !password){
      await showStatus('msg_auth_login_empty', { error: true });
      if(!usernameRaw && emailInput){
        emailInput.focus();
      } else if(passwordInput){
        passwordInput.focus();
      }
      return;
    }
    let verification = null;
    try{
      verification = await verifyUserLogin(usernameRaw, password);
    }catch(err){
      console.error('Login verification failed', err);
      await showStatus('msg_auth_login_failed', { error: true });
      return;
    }
    if(!verification || verification.success !== true){
      await showStatus('msg_auth_login_incorrect', { error: true });
      if(passwordInput){
        passwordInput.focus();
        passwordInput.select();
      }
      return;
    }
    const payload = verification && verification.user && typeof verification.user === 'object'
      ? verification.user
      : {};
    const payloadEmailRaw = typeof payload.email === 'string' ? payload.email.trim() : '';
    const email = payloadEmailRaw || usernameRaw;
    const normalizedEmail = typeof email === 'string' && email ? email.toLowerCase() : '';
    const payloadUsername = typeof payload.username === 'string' ? payload.username.trim() : '';
    const username = payloadUsername || email || usernameRaw;
    const payloadName = typeof payload.name === 'string' ? payload.name.trim() : '';
    const payloadAvatar = typeof payload.avatar === 'string' ? payload.avatar.trim() : '';
    const payloadId = (()=>{
      if(typeof payload.id === 'number' && Number.isFinite(payload.id)) return payload.id;
      if(typeof payload.id === 'string'){
        const trimmed = payload.id.trim();
        if(!trimmed) return null;
        const numeric = Number(trimmed);
        return Number.isFinite(numeric) ? numeric : trimmed;
      }
      if(typeof payload.user_id === 'number' && Number.isFinite(payload.user_id)) return payload.user_id;
      if(typeof payload.user_id === 'string'){
        const trimmed = payload.user_id.trim();
        if(!trimmed) return null;
        const numeric = Number(trimmed);
        return Number.isFinite(numeric) ? numeric : trimmed;
      }
      if(typeof payload.userId === 'number' && Number.isFinite(payload.userId)) return payload.userId;
      if(typeof payload.userId === 'string'){
        const trimmed = payload.userId.trim();
        if(!trimmed) return null;
        const numeric = Number(trimmed);
        return Number.isFinite(numeric) ? numeric : trimmed;
      }
      return null;
    })();
    const roleFlags = extractRoleFlags(payload);
    const { isAdmin: extractedIsAdmin, roles: extractedRoles, ...otherRoleFlags } = roleFlags;
    const rolesList = Array.isArray(extractedRoles)
      ? extractedRoles
      : (Array.isArray(payload.roles)
        ? payload.roles
            .map(role => typeof role === 'string' ? role.trim() : '')
            .filter(Boolean)
        : []);
    const usernameLower = typeof username === 'string' ? username.toLowerCase() : '';
    let isAdmin = false;
    if(typeof payload.isAdmin === 'boolean'){
      isAdmin = payload.isAdmin;
    } else if(typeof extractedIsAdmin === 'boolean'){
      isAdmin = extractedIsAdmin;
    } else if(rolesList.includes('admin')){
      isAdmin = true;
    } else if(normalizedEmail === 'admin' || usernameLower === 'admin'){
      isAdmin = true;
    }
    currentUser = {
      id: payloadId,
      name: payloadName,
      email,
      emailNormalized: normalizedEmail || usernameRaw.toLowerCase(),
      username,
      avatar: payloadAvatar,
      type: isAdmin ? 'admin' : (typeof payload.type === 'string' && payload.type.trim() ? payload.type.trim() : 'member'),
      ...otherRoleFlags,
      ...(rolesList.length ? { roles: rolesList } : {}),
      isAdmin
    };
    if(!currentUser.emailNormalized){
      if(typeof currentUser.email === 'string' && currentUser.email){
        currentUser.emailNormalized = currentUser.email.toLowerCase();
      } else {
        currentUser.emailNormalized = usernameLower;
      }
    }
    if(!currentUser.username){
      currentUser.username = currentUser.email || usernameRaw;
    }
    storeCurrent(currentUser);
    render();
    const displayName = currentUser.name || currentUser.email || currentUser.username;
    await showStatus('msg_auth_login_success', { placeholders: { name: displayName } });
  }

  async function handleRegister(){
    const nameInput = document.getElementById('memberRegisterName');
    const emailInput = document.getElementById('memberRegisterEmail');
    const passwordInput = document.getElementById('memberRegisterPassword');
    const passwordConfirmInput = document.getElementById('memberRegisterPasswordConfirm');
    const avatarInput = document.getElementById('memberRegisterAvatar');
    const name = nameInput ? nameInput.value.trim() : '';
    const emailRaw = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';
    const passwordConfirm = passwordConfirmInput ? passwordConfirmInput.value : '';
    const avatar = avatarInput ? avatarInput.value.trim() : '';
    if(!name || !emailRaw || !password){
      await showStatus('msg_auth_register_empty', { error: true });
      if(!name && nameInput){
        nameInput.focus();
        return;
      }
      if(!emailRaw && emailInput){
        emailInput.focus();
        return;
      }
      if(!password && passwordInput){
        passwordInput.focus();
      }
      return;
    }
    if(password.length < 4){
      await showStatus('msg_auth_register_password_short', { error: true });
      if(passwordInput) passwordInput.focus();
      return;
    }
    if(!passwordConfirm){
      await showStatus('msg_auth_register_empty', { error: true });
      if(passwordConfirmInput) passwordConfirmInput.focus();
      return;
    }
    if(password !== passwordConfirm){
      await showStatus('msg_auth_register_password_mismatch', { error: true });
      if(passwordConfirmInput){
        passwordConfirmInput.focus();
        if(typeof passwordConfirmInput.select === 'function'){
          passwordConfirmInput.select();
        }
      }
      return;
    }
    const normalized = emailRaw.toLowerCase();
    const formData = new FormData();
    formData.set('display_name', name);
    formData.set('email', emailRaw);
    formData.set('password', password);
    formData.set('confirm', passwordConfirm);
    formData.set('avatar_url', avatar);
    let response;
    try{
      response = await fetch('/gateway.php?action=add-member', {
        method: 'POST',
        body: formData
      });
    }catch(err){
      console.error('Registration request failed', err);
      await showStatus('msg_auth_register_failed', { error: true });
      return;
    }
    let responseText = '';
    try{
      responseText = await response.text();
    }catch(err){
      console.error('Failed to read registration response', err);
      await showStatus('msg_auth_register_failed', { error: true });
      return;
    }
    let payload = null;
    if(responseText){
      try{
        payload = JSON.parse(responseText);
      }catch(err){
        payload = null;
      }
    }
    if(!response.ok || !payload || payload.success === false){
      let errorMessage = await getMessage('msg_auth_register_failed', {}, false) || 'Registration failed.';
      if(payload && typeof payload === 'object'){
        const possible = payload.error || payload.message;
        if(typeof possible === 'string' && possible.trim()){
          errorMessage = possible.trim();
        }
      } else if(responseText && responseText.trim()){
        errorMessage = responseText.trim();
      }
      await showStatus(errorMessage, { error: true });
      return;
    }
    const memberData = payload && typeof payload === 'object'
      ? (payload.member || payload.user || payload.data || payload.payload || null)
      : null;
    const resolvedMember = memberData && typeof memberData === 'object' ? memberData : {};
    const memberNameRaw = typeof resolvedMember.display_name === 'string' && resolvedMember.display_name.trim()
      ? resolvedMember.display_name.trim()
      : (typeof resolvedMember.name === 'string' && resolvedMember.name.trim() ? resolvedMember.name.trim() : name);
    const memberEmailRaw = typeof resolvedMember.email === 'string' && resolvedMember.email.trim()
      ? resolvedMember.email.trim()
      : emailRaw;
    const memberAvatarRaw = typeof resolvedMember.avatar_url === 'string' && resolvedMember.avatar_url.trim()
      ? resolvedMember.avatar_url.trim()
      : (typeof resolvedMember.avatar === 'string' && resolvedMember.avatar.trim()
        ? resolvedMember.avatar.trim()
        : avatar);
    const memberUsernameRaw = typeof resolvedMember.username === 'string' && resolvedMember.username.trim()
      ? resolvedMember.username.trim()
      : (memberEmailRaw || normalized);
    const finalEmailRaw = memberEmailRaw || emailRaw;
    const finalEmail = typeof finalEmailRaw === 'string' ? finalEmailRaw.trim() : '';
    const finalNormalized = finalEmail ? finalEmail.toLowerCase() : normalized;
    currentUser = {
      name: memberNameRaw || name,
      email: finalEmail,
      emailNormalized: finalNormalized,
      username: memberUsernameRaw || finalEmail || finalNormalized,
      avatar: memberAvatarRaw || '',
      isAdmin: finalNormalized === 'admin'
    };
    storeCurrent(currentUser);
    if(form && typeof form.reset === 'function'){
      form.reset();
    } else {
      clearInputs(registerInputs);
    }
    render();
    const displayName = currentUser.name || currentUser.email;
    await showStatus('msg_auth_register_success', { placeholders: { name: displayName } });
  }

  async function handleLogout(){
    currentUser = null;
    storeCurrent(null);
    render();
    await showStatus('msg_auth_logout_success');
  }

  function setup(){
    form = document.getElementById('memberForm');
    if(!form) return;
    container = form.querySelector('.member-auth');
    if(!container) return;
    tabsWrap = container.querySelector('.member-auth-tabs');
    loginTab = document.getElementById('memberAuthTabLogin');
    registerTab = document.getElementById('memberAuthTabRegister');
    loginPanel = document.getElementById('memberLoginPanel');
    registerPanel = document.getElementById('memberRegisterPanel');
    profilePanel = document.getElementById('memberProfilePanel');
    profileAvatar = document.getElementById('memberProfileAvatar');
    profileName = document.getElementById('memberProfileName');
    profileEmail = document.getElementById('memberProfileEmail');
    logoutBtn = document.getElementById('memberLogoutBtn');
    loginInputs = loginPanel ? Array.from(loginPanel.querySelectorAll('input')) : [];
    registerInputs = registerPanel ? Array.from(registerPanel.querySelectorAll('input')) : [];

    form.addEventListener('submit', event => {
      let submitter = event.submitter || null;
      if(!submitter){
        const active = document.activeElement || null;
        if(active && form.contains(active)){
          submitter = active;
        }
      }
      const origin = submitter && typeof submitter.closest === 'function' ? submitter : null;
      const isMemberAuthEvent = origin && origin.closest('.member-auth');
      if(!isMemberAuthEvent){
        return;
      }
      event.preventDefault();
      const action = submitter && submitter.dataset && submitter.dataset.action ? submitter.dataset.action : lastAction;
      if(action === 'register'){
        handleRegister();
      } else {
        Promise.resolve(handleLogin()).catch(err => {
          console.error('Login handler failed', err);
          showStatus('Unable to process login. Please try again.', { error: true });
        });
      }
    });

    const submitButtons = form.querySelectorAll('.member-auth-submit');
    submitButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        lastAction = btn.dataset.action || 'login';
      });
    });

    if(loginTab){
      loginTab.addEventListener('click', () => {
        setActivePanel('login');
      });
    }
    if(registerTab){
      registerTab.addEventListener('click', () => {
        setActivePanel('register');
      });
    }
    if(logoutBtn){
      logoutBtn.addEventListener('click', event => {
        event.preventDefault();
        if(currentUser){
          handleLogout();
        }
      });
    }

    users = loadUsers();
    currentUser = loadStoredCurrent();
    render();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }
})();

// Extracted from <script>
// Wait helpers if your app exposes callWhenDefined; otherwise poll.
(function(){
  function whenDefined(name, cb){
    if (window.callWhenDefined) return window.callWhenDefined(name, cb);
    const iv = setInterval(() => {
      if (typeof window[name] === 'function') { clearInterval(iv); cb(window[name]); }
    }, 20);
  }

  // Debounce/guard in-flight jobs by name
  const _inflight = new Map();
  function guardOnce(name, fn){
    return async function guarded(...args){
      if (_inflight.get(name)) return; // drop duplicates
      _inflight.set(name, true);
      try { return await fn.apply(this, args); }
      finally { _inflight.delete(name); }
    };
  }

  const factories = new Map([
    ['hookDetailActions', (orig) => {
      const wrapped = rafThrottle(function(...args){
        scheduleIdle(() => orig.apply(this, args));
      });
      return guardOnce('hookDetailActions', wrapped);
    }],
    ['ensureMapForVenue', (orig) => {
      let token = 0;
      return guardOnce('ensureMapForVenue', function(...args){
        const myToken = ++token;
        // Defer heavy create to idle; newest call wins.
        scheduleIdle(async () => {
          if (myToken !== token) return;
          try { await orig.apply(this, args); } catch(e) { /* swallow */ }
        }, 300);
      });
    }]
  ]);

  function applyWrapper(name){
    const factory = factories.get(name);
    if (!factory) return;
    whenDefined(name, (orig) => {
      if (typeof orig !== 'function' || orig.__inputWrapped) return;
      const wrapped = factory(orig);
      if (typeof wrapped === 'function'){
        wrapped.__inputWrapped = true;
        window[name] = wrapped;
      }
    });
  }

  ['hookDetailActions','ensureMapForVenue'].forEach(applyWrapper);

  window.__wrapForInputYield = function(name){
    applyWrapper(name);
  };
})();

// LocalStorage Clear Button Handler
(function(){
  function initClearLocalStorageBtn(){
    const btn = document.getElementById('clearLocalStorageBtn');
    if(!btn) {
      // Retry if button not ready yet
      setTimeout(initClearLocalStorageBtn, 100);
      return;
    }
    
    btn.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      
      try {
        const keys = Object.keys(localStorage);
        const keyCount = keys.length;
        localStorage.clear();
        console.log(`[LocalStorage] Cleared ${keyCount} items`);
        
        // Reload the page to apply changes
        location.reload();
      } catch(err){
        console.error('[LocalStorage] Error clearing:', err);
      }
    });
    
    console.log('[LocalStorage] Clear button initialized');
  }
  
  // Initialize when DOM is ready
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initClearLocalStorageBtn);
  } else {
    initClearLocalStorageBtn();
  }
})();