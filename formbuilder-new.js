/* ============================================================================
   FORMBUILDER MODULE - Admin Panel > Forms Tab
   Category/Subcategory/Field Editor
   ============================================================================ */

(function() {
    'use strict';

    var container = null;
    var allIcons = [];
    
    var editPenSvg = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175l-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>';
    var moreDotsSvg = '<svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="2.5" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="8" cy="13.5" r="1.5"/></svg>';
    var dragHandleSvg = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 2L4 6h8L8 2zM8 14l4-4H4l4 4z"/></svg>';
    
    function closeAllEditPanels() {
        if (!container) return;
        container.querySelectorAll('.formbuilder-accordion--editing').forEach(function(el) {
            el.classList.remove('formbuilder-accordion--editing');
        });
        container.querySelectorAll('.formbuilder-accordion-option--editing').forEach(function(el) {
            el.classList.remove('formbuilder-accordion-option--editing');
        });
        container.querySelectorAll('.formbuilder-menu--open').forEach(function(el) {
            el.classList.remove('formbuilder-menu--open');
        });
    }
    
    function closeAllFieldEditPanels() {
        if (!container) return;
        container.querySelectorAll('.formbuilder-field-wrapper--editing').forEach(function(el) {
            el.classList.remove('formbuilder-field-wrapper--editing');
        });
    }
    
    function closeAllMenus() {
        if (!container) return;
        container.querySelectorAll('.formbuilder-menu--open').forEach(function(el) {
            el.classList.remove('formbuilder-menu--open');
        });
        container.querySelectorAll('.formbuilder-accordion-editpanel-more--open').forEach(function(el) {
            el.classList.remove('formbuilder-accordion-editpanel-more--open');
        });
        container.querySelectorAll('.formbuilder-fieldset-menu--open').forEach(function(el) {
            el.classList.remove('formbuilder-fieldset-menu--open');
        });
        container.querySelectorAll('.formbuilder-field-more--open').forEach(function(el) {
            el.classList.remove('formbuilder-field-more--open');
        });
    }
    
    function buildIconPicker(currentSrc, onSelect) {
        var menu = document.createElement('div');
        menu.className = 'formbuilder-menu';
        var currentFilename = currentSrc ? currentSrc.split('/').pop() : 'Select...';
        menu.innerHTML = '<div class="formbuilder-menu-button"><img class="formbuilder-menu-button-image" src="' + currentSrc + '" alt=""><span class="formbuilder-menu-button-text">' + currentFilename + '</span><span class="formbuilder-menu-button-arrow">▼</span></div><div class="formbuilder-menu-options"></div>';
        var btn = menu.querySelector('.formbuilder-menu-button');
        var opts = menu.querySelector('.formbuilder-menu-options');
        var btnImg = menu.querySelector('.formbuilder-menu-button-image');
        var btnText = menu.querySelector('.formbuilder-menu-button-text');
        
        allIcons.forEach(function(iconPath) {
            var filename = iconPath.split('/').pop();
            var op = document.createElement('div');
            op.className = 'formbuilder-menu-option';
            op.innerHTML = '<img class="formbuilder-menu-option-image" src="' + iconPath + '" alt=""><span class="formbuilder-menu-option-text">' + filename + '</span>';
            op.onclick = function(e) {
                e.stopPropagation();
                btnImg.src = iconPath;
                btnText.textContent = filename;
                menu.classList.remove('formbuilder-menu--open');
                onSelect(iconPath);
            };
            opts.appendChild(op);
        });
        
        btn.onclick = function(e) {
            e.stopPropagation();
            var wasOpen = menu.classList.contains('formbuilder-menu--open');
            closeAllMenus();
            if (!wasOpen) menu.classList.add('formbuilder-menu--open');
        };
        
        return menu;
    }
    
    function bindDocumentListeners() {
        // Close category/subcategory edit panels when clicking outside
        document.addEventListener('click', function(e) {
            if (!container) return;
            if (!e.target.closest('.formbuilder-accordion-editpanel') && 
                !e.target.closest('.formbuilder-accordion-option-editpanel') &&
                !e.target.closest('.formbuilder-accordion-header-editarea') &&
                !e.target.closest('.formbuilder-accordion-option-editarea') &&
                !e.target.closest('.formbuilder-accordion-header') &&
                !e.target.closest('.formbuilder-accordion-option-header')) {
                closeAllEditPanels();
            }
        });
        
        // Close 3-dot menus when clicking outside
        document.addEventListener('click', function(e) {
            if (!container) return;
            if (!e.target.closest('.formbuilder-accordion-editpanel-more')) {
                container.querySelectorAll('.formbuilder-accordion-editpanel-more--open').forEach(function(el) {
                    el.classList.remove('formbuilder-accordion-editpanel-more--open');
                });
            }
        });
        
        // Close fieldset menus when clicking outside
        document.addEventListener('click', function(e) {
            if (!container) return;
            if (!e.target.closest('.formbuilder-fieldset-menu')) {
                container.querySelectorAll('.formbuilder-fieldset-menu--open').forEach(function(el) {
                    el.classList.remove('formbuilder-fieldset-menu--open');
                });
            }
        });
        
        // Close icon picker menus when clicking outside
        document.addEventListener('click', function(e) {
            if (!container) return;
            if (!e.target.closest('.formbuilder-menu')) {
                container.querySelectorAll('.formbuilder-menu--open').forEach(function(el) {
                    el.classList.remove('formbuilder-menu--open');
                });
            }
        });
        
        // Close field 3-dot menus when clicking outside
        document.addEventListener('click', function(e) {
            if (!container) return;
            if (!e.target.closest('.formbuilder-field-more')) {
                container.querySelectorAll('.formbuilder-field-more--open').forEach(function(el) {
                    el.classList.remove('formbuilder-field-more--open');
                });
            }
        });
        
        // Close field edit panels when clicking outside
        document.addEventListener('click', function(e) {
            if (!container) return;
            if (!e.target.closest('.formbuilder-field-wrapper')) {
                closeAllFieldEditPanels();
            }
        });
    }
    
    function loadFormData() {
        // Fetch admin settings first to get checkout options and currency
        fetch('/gateway.php?action=get-admin-settings')
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (res.success) {
                    window.CHECKOUT_OPTIONS = res.checkout_options || [];
                    window.SITE_CURRENCY = (res.settings && res.settings.site_currency) || '$';
                }
                // Then fetch icons
                return fetch('/gateway.php?action=list-icons&folder=assets/category-icons/');
            })
            .then(function(r) { return r.json(); })
            .then(function(res) {
                allIcons = (res.icons || []).map(function(name) { return 'assets/category-icons/' + name; });
                return fetch('/gateway.php?action=get-form');
            })
            .then(function(r) { return r.json(); })
            .then(function(res) {
                if (!res.success || !res.snapshot) return;
                renderForm(res.snapshot);
            });
    }
    
    function renderForm(snapshot) {
        if (!container) return;
        container.innerHTML = '';
        
        var categories = snapshot.categories || [];
        var categoryIconPaths = snapshot.categoryIconPaths || {};
        var subcategoryIconPaths = snapshot.subcategoryIconPaths || {};
        var fieldsets = snapshot.fieldsets || [];
        
        categories.forEach(function(cat) {
            var accordion = document.createElement('div');
            accordion.className = 'formbuilder-accordion formbuilder-accordion--open';
            
            var catIconSrc = categoryIconPaths[cat.name] || '';
            
            // Header
            var header = document.createElement('div');
            header.className = 'formbuilder-accordion-header';
            
            var headerImg = document.createElement('img');
            headerImg.className = 'formbuilder-accordion-header-image';
            headerImg.src = catIconSrc;
            
            var headerText = document.createElement('span');
            headerText.className = 'formbuilder-accordion-header-text';
            headerText.textContent = cat.name;
            
            var headerArrow = document.createElement('span');
            headerArrow.className = 'formbuilder-accordion-header-arrow';
            headerArrow.textContent = '▼';
            
            var headerEditArea = document.createElement('div');
            headerEditArea.className = 'formbuilder-accordion-header-editarea';
            var headerEdit = document.createElement('div');
            headerEdit.className = 'formbuilder-accordion-header-edit';
            headerEdit.innerHTML = editPenSvg;
            headerEditArea.appendChild(headerEdit);
            
            var headerDrag = document.createElement('div');
            headerDrag.className = 'formbuilder-accordion-header-drag';
            headerDrag.innerHTML = dragHandleSvg;
            
            header.appendChild(headerImg);
            header.appendChild(headerText);
            header.appendChild(headerArrow);
            header.appendChild(headerDrag);
            header.appendChild(headerEditArea);
            
            // Category drag and drop
            accordion.draggable = true;
            accordion.addEventListener('dragstart', function(e) {
                e.dataTransfer.effectAllowed = 'move';
                accordion.classList.add('formbuilder-accordion--dragging');
            });
            accordion.addEventListener('dragend', function() {
                accordion.classList.remove('formbuilder-accordion--dragging');
            });
            accordion.addEventListener('dragover', function(e) {
                e.preventDefault();
                var dragging = container.querySelector('.formbuilder-accordion--dragging');
                if (dragging && dragging !== accordion) {
                    var rect = accordion.getBoundingClientRect();
                    var midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        accordion.parentNode.insertBefore(dragging, accordion);
                    } else {
                        accordion.parentNode.insertBefore(dragging, accordion.nextSibling);
                    }
                }
            });
            
            // Edit panel
            var editPanel = document.createElement('div');
            editPanel.className = 'formbuilder-accordion-editpanel';
            
            var nameRow = document.createElement('div');
            nameRow.className = 'formbuilder-accordion-editpanel-row';
            
            var nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.className = 'formbuilder-accordion-editpanel-input';
            nameInput.value = cat.name;
            nameInput.oninput = function() {
                headerText.textContent = nameInput.value || cat.name;
            };
            
            var moreBtn = document.createElement('div');
            moreBtn.className = 'formbuilder-accordion-editpanel-more';
            moreBtn.innerHTML = moreDotsSvg + '<div class="formbuilder-accordion-editpanel-more-menu"><div class="formbuilder-accordion-editpanel-more-item"><span class="formbuilder-accordion-editpanel-more-item-text">Hide Category</span><div class="formbuilder-accordion-editpanel-more-switch"></div></div><div class="formbuilder-accordion-editpanel-more-item formbuilder-accordion-editpanel-more-delete">Delete Category</div></div>';
            
            moreBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                var wasOpen = moreBtn.classList.contains('formbuilder-accordion-editpanel-more--open');
                closeAllMenus();
                if (!wasOpen) moreBtn.classList.add('formbuilder-accordion-editpanel-more--open');
            });
            
            var hideSwitch = moreBtn.querySelector('.formbuilder-accordion-editpanel-more-switch');
            hideSwitch.addEventListener('click', function(e) {
                e.stopPropagation();
                hideSwitch.classList.toggle('formbuilder-accordion-editpanel-more-switch--on');
            });
            
            nameRow.appendChild(nameInput);
            nameRow.appendChild(moreBtn);
            
            var iconPicker = buildIconPicker(catIconSrc, function(newIcon) {
                headerImg.src = newIcon;
            });
            
            editPanel.appendChild(nameRow);
            editPanel.appendChild(iconPicker);
            
            // Body
            var body = document.createElement('div');
            body.className = 'formbuilder-accordion-body';
            
            var subs = cat.subs || [];
            subs.forEach(function(subName) {
                var option = buildSubcategoryOption(cat, subName, subcategoryIconPaths, fieldsets, body);
                body.appendChild(option);
            });
            
            // Add Subcategory button
            var addSubBtn = document.createElement('div');
            addSubBtn.className = 'formbuilder-add-button';
            addSubBtn.textContent = '+ Add Subcategory';
            body.appendChild(addSubBtn);
            
            accordion.appendChild(header);
            accordion.appendChild(editPanel);
            accordion.appendChild(body);
            
            // Header edit area click
            headerEditArea.addEventListener('click', function(e) {
                e.stopPropagation();
                var isOpen = accordion.classList.contains('formbuilder-accordion--editing');
                closeAllEditPanels();
                if (!isOpen) {
                    accordion.classList.add('formbuilder-accordion--editing');
                }
            });
            
            // Header click (except edit area) expands/collapses
            header.addEventListener('click', function(e) {
                if (e.target.closest('.formbuilder-accordion-header-editarea')) return;
                if (!accordion.classList.contains('formbuilder-accordion--editing')) {
                    closeAllEditPanels();
                }
                accordion.classList.toggle('formbuilder-accordion--open');
            });
            
            container.appendChild(accordion);
        });
        
        // Add Category button
        var addCatBtn = document.createElement('div');
        addCatBtn.className = 'formbuilder-add-button formbuilder-add-category';
        addCatBtn.textContent = '+ Add Category';
        container.appendChild(addCatBtn);
    }
    
    function buildSubcategoryOption(cat, subName, subcategoryIconPaths, fieldsets, parentBody) {
        var option = document.createElement('div');
        option.className = 'formbuilder-accordion-option';
        
        var subIconSrc = subcategoryIconPaths[subName] || '';
        
        var optHeader = document.createElement('div');
        optHeader.className = 'formbuilder-accordion-option-header';
        
        var optImg = document.createElement('img');
        optImg.className = 'formbuilder-accordion-option-image';
        optImg.src = subIconSrc;
        
        var optText = document.createElement('span');
        optText.className = 'formbuilder-accordion-option-text';
        optText.textContent = subName;
        
        var optArrow = document.createElement('span');
        optArrow.className = 'formbuilder-accordion-option-arrow';
        optArrow.textContent = '▼';
        
        var optEditArea = document.createElement('div');
        optEditArea.className = 'formbuilder-accordion-option-editarea';
        var optEdit = document.createElement('div');
        optEdit.className = 'formbuilder-accordion-option-edit';
        optEdit.innerHTML = editPenSvg;
        optEditArea.appendChild(optEdit);
        
        var optDrag = document.createElement('div');
        optDrag.className = 'formbuilder-accordion-option-drag';
        optDrag.innerHTML = dragHandleSvg;
        
        optHeader.appendChild(optImg);
        optHeader.appendChild(optText);
        optHeader.appendChild(optArrow);
        optHeader.appendChild(optDrag);
        optHeader.appendChild(optEditArea);
        
        // Subcategory drag and drop
        option.draggable = true;
        option.addEventListener('dragstart', function(e) {
            e.stopPropagation();
            e.dataTransfer.effectAllowed = 'move';
            option.classList.add('formbuilder-accordion-option--dragging');
        });
        option.addEventListener('dragend', function() {
            option.classList.remove('formbuilder-accordion-option--dragging');
        });
        option.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var dragging = parentBody.querySelector('.formbuilder-accordion-option--dragging');
            if (dragging && dragging !== option) {
                var rect = option.getBoundingClientRect();
                var midY = rect.top + rect.height / 2;
                if (e.clientY < midY) {
                    option.parentNode.insertBefore(dragging, option);
                } else {
                    option.parentNode.insertBefore(dragging, option.nextSibling);
                }
            }
        });
        
        // Sub edit panel
        var subEditPanel = document.createElement('div');
        subEditPanel.className = 'formbuilder-accordion-option-editpanel';
        
        var subNameRow = document.createElement('div');
        subNameRow.className = 'formbuilder-accordion-editpanel-row';
        
        var subNameInput = document.createElement('input');
        subNameInput.type = 'text';
        subNameInput.className = 'formbuilder-accordion-editpanel-input';
        subNameInput.value = subName;
        subNameInput.oninput = function() {
            optText.textContent = subNameInput.value || subName;
        };
        
        var subMoreBtn = document.createElement('div');
        subMoreBtn.className = 'formbuilder-accordion-editpanel-more';
        subMoreBtn.innerHTML = moreDotsSvg + '<div class="formbuilder-accordion-editpanel-more-menu"><div class="formbuilder-accordion-editpanel-more-item"><span class="formbuilder-accordion-editpanel-more-item-text">Hide Subcategory</span><div class="formbuilder-accordion-editpanel-more-switch"></div></div><div class="formbuilder-accordion-editpanel-more-item formbuilder-accordion-editpanel-more-delete">Delete Subcategory</div></div>';
        
        subMoreBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            var wasOpen = subMoreBtn.classList.contains('formbuilder-accordion-editpanel-more--open');
            closeAllMenus();
            if (!wasOpen) subMoreBtn.classList.add('formbuilder-accordion-editpanel-more--open');
        });
        
        var subHideSwitch = subMoreBtn.querySelector('.formbuilder-accordion-editpanel-more-switch');
        subHideSwitch.addEventListener('click', function(e) {
            e.stopPropagation();
            subHideSwitch.classList.toggle('formbuilder-accordion-editpanel-more-switch--on');
        });
        
        subNameRow.appendChild(subNameInput);
        subNameRow.appendChild(subMoreBtn);
        
        var subIconPicker = buildIconPicker(subIconSrc, function(newIcon) {
            optImg.src = newIcon;
        });
        
        subEditPanel.appendChild(subNameRow);
        subEditPanel.appendChild(subIconPicker);
        
        // Get surcharge from subFees if available
        var subFees = cat.subFees || {};
        var subFeeData = subFees[subName] || {};
        
        // Subcategory Type row
        var typeRow = document.createElement('div');
        typeRow.className = 'formbuilder-type-row';
        
        var typeLabel = document.createElement('span');
        typeLabel.className = 'formbuilder-type-row-label';
        typeLabel.textContent = 'Subcategory Type';
        
        var currentType = (subFeeData.subcategory_type) || 'General';
        
        var eventsLabel = document.createElement('label');
        eventsLabel.className = 'formbuilder-type-option';
        var eventsInput = document.createElement('input');
        eventsInput.type = 'radio';
        eventsInput.name = 'subType-' + cat.name + '-' + subName;
        eventsInput.value = 'Events';
        eventsInput.checked = currentType === 'Events';
        var eventsText = document.createElement('span');
        eventsText.textContent = 'Events';
        eventsLabel.appendChild(eventsInput);
        eventsLabel.appendChild(eventsText);
        
        var generalLabel = document.createElement('label');
        generalLabel.className = 'formbuilder-type-option';
        var generalInput = document.createElement('input');
        generalInput.type = 'radio';
        generalInput.name = 'subType-' + cat.name + '-' + subName;
        generalInput.value = 'General';
        generalInput.checked = currentType === 'General';
        var generalText = document.createElement('span');
        generalText.textContent = 'General';
        generalLabel.appendChild(generalInput);
        generalLabel.appendChild(generalText);
        
        eventsInput.addEventListener('change', function() {
            if (eventsInput.checked) {
                if (!cat.subFees) cat.subFees = {};
                if (!cat.subFees[subName]) cat.subFees[subName] = {};
                cat.subFees[subName].subcategory_type = 'Events';
            }
        });
        
        generalInput.addEventListener('change', function() {
            if (generalInput.checked) {
                if (!cat.subFees) cat.subFees = {};
                if (!cat.subFees[subName]) cat.subFees[subName] = {};
                cat.subFees[subName].subcategory_type = 'General';
            }
        });
        
        typeRow.appendChild(typeLabel);
        typeRow.appendChild(eventsLabel);
        typeRow.appendChild(generalLabel);
        subEditPanel.appendChild(typeRow);
        
        // Surcharge row
        var surchargeRow = document.createElement('div');
        surchargeRow.className = 'formbuilder-fee-row';
        
        var surchargeLabel = document.createElement('span');
        surchargeLabel.className = 'formbuilder-fee-row-label';
        surchargeLabel.textContent = 'Checkout Surcharge';
        
        var surchargePercent = document.createElement('span');
        surchargePercent.className = 'formbuilder-fee-percent';
        surchargePercent.textContent = '%';
        
        var surchargeInput = document.createElement('input');
        surchargeInput.type = 'number';
        surchargeInput.step = '0.01';
        surchargeInput.min = '-100';
        surchargeInput.className = 'formbuilder-fee-input';
        surchargeInput.placeholder = 'N/A';
        
        if (subFeeData.checkout_surcharge !== null && subFeeData.checkout_surcharge !== undefined) {
            surchargeInput.value = parseFloat(subFeeData.checkout_surcharge).toFixed(2);
        }
        
        surchargeInput.addEventListener('input', function() {
            var value = surchargeInput.value ? parseFloat(surchargeInput.value) : null;
            if (value !== null && value < -100) {
                value = -100;
                surchargeInput.value = value.toFixed(2);
            }
            if (!cat.subFees) cat.subFees = {};
            if (!cat.subFees[subName]) cat.subFees[subName] = {};
            cat.subFees[subName].checkout_surcharge = value !== null ? Math.round(value * 100) / 100 : null;
            if (option._renderCheckoutOptions) option._renderCheckoutOptions();
        });
        
        surchargeInput.addEventListener('blur', function() {
            var value = surchargeInput.value ? parseFloat(surchargeInput.value) : null;
            if (value !== null && value < -100) {
                value = -100;
            }
            if (value !== null) {
                surchargeInput.value = value.toFixed(2);
            }
            if (option._renderCheckoutOptions) option._renderCheckoutOptions();
        });
        
        surchargeRow.appendChild(surchargeLabel);
        surchargeRow.appendChild(surchargePercent);
        surchargeRow.appendChild(surchargeInput);
        subEditPanel.appendChild(surchargeRow);
        
        // Checkout Options Editor
        var checkoutEditor = document.createElement('div');
        checkoutEditor.className = 'formbuilder-checkout-editor';
        
        var checkoutLabel = document.createElement('div');
        checkoutLabel.className = 'formbuilder-checkout-label';
        checkoutLabel.textContent = 'Checkout Options';
        
        var checkoutList = document.createElement('div');
        checkoutList.className = 'formbuilder-checkout-list';
        
        checkoutEditor.appendChild(checkoutLabel);
        checkoutEditor.appendChild(checkoutList);
        subEditPanel.appendChild(checkoutEditor);
        
        function renderCheckoutOptions() {
            checkoutList.innerHTML = '';
            var allCheckoutOptions = (window.CHECKOUT_OPTIONS || []).filter(function(opt) {
                return opt.is_active !== false && opt.is_active !== 0;
            });
            
            var surcharge = 0;
            if (cat.subFees && cat.subFees[subName] && cat.subFees[subName].checkout_surcharge !== null && cat.subFees[subName].checkout_surcharge !== undefined) {
                surcharge = parseFloat(cat.subFees[subName].checkout_surcharge) || 0;
            }
            
            if (allCheckoutOptions.length === 0) {
                var emptyMsg = document.createElement('div');
                emptyMsg.className = 'formbuilder-checkout-empty';
                emptyMsg.textContent = 'No enabled checkout options available.';
                checkoutList.appendChild(emptyMsg);
                return;
            }
            
            var siteCurrency = window.SITE_CURRENCY || '$';
            
            allCheckoutOptions.forEach(function(opt) {
                var card = document.createElement('div');
                card.className = 'formbuilder-checkout-card';
                
                var flagfall = parseFloat(opt.checkout_flagfall_price) || 0;
                var basicDayRate = opt.checkout_basic_day_rate !== null && opt.checkout_basic_day_rate !== undefined 
                    ? parseFloat(opt.checkout_basic_day_rate) : null;
                var discountDayRate = opt.checkout_discount_day_rate !== null && opt.checkout_discount_day_rate !== undefined 
                    ? parseFloat(opt.checkout_discount_day_rate) : null;
                
                function calculatePrice(days) {
                    var basePrice = flagfall;
                    if (days >= 365 && discountDayRate !== null && !isNaN(discountDayRate)) {
                        basePrice += discountDayRate * days;
                    } else if (basicDayRate !== null && !isNaN(basicDayRate)) {
                        basePrice += basicDayRate * days;
                    }
                    if (surcharge !== 0 && !isNaN(surcharge)) {
                        basePrice = basePrice * (1 + surcharge / 100);
                    }
                    return basePrice;
                }
                
                var price30 = calculatePrice(30);
                var price365 = calculatePrice(365);
                
                var title = document.createElement('div');
                title.className = 'formbuilder-checkout-title';
                title.textContent = opt.checkout_title || 'Untitled';
                
                var prices = document.createElement('div');
                prices.className = 'formbuilder-checkout-prices';
                prices.innerHTML = '<div class="formbuilder-checkout-price-item"><span>30 days: </span><span class="formbuilder-checkout-price-value">' + siteCurrency + price30.toFixed(2) + '</span></div>' +
                    '<div class="formbuilder-checkout-price-item"><span>365 days: </span><span class="formbuilder-checkout-price-value">' + siteCurrency + price365.toFixed(2) + '</span></div>';
                
                var calculator = document.createElement('div');
                calculator.className = 'formbuilder-checkout-calculator';
                
                var calcLabel = document.createElement('span');
                calcLabel.textContent = 'Calculator:';
                
                var calcInput = document.createElement('input');
                calcInput.type = 'number';
                calcInput.className = 'formbuilder-checkout-calc-input';
                calcInput.placeholder = 'Days';
                calcInput.min = '1';
                calcInput.step = '1';
                
                var calcTotal = document.createElement('span');
                calcTotal.className = 'formbuilder-checkout-calc-total';
                calcTotal.textContent = siteCurrency + '0.00';
                
                calcInput.addEventListener('input', function() {
                    var days = parseFloat(calcInput.value) || 0;
                    if (days <= 0) {
                        calcTotal.textContent = siteCurrency + '0.00';
                        return;
                    }
                    var total = calculatePrice(days);
                    calcTotal.textContent = siteCurrency + total.toFixed(2);
                });
                
                calculator.appendChild(calcLabel);
                calculator.appendChild(calcInput);
                calculator.appendChild(calcTotal);
                
                card.appendChild(title);
                card.appendChild(prices);
                card.appendChild(calculator);
                checkoutList.appendChild(card);
            });
        }
        
        option._renderCheckoutOptions = renderCheckoutOptions;
        renderCheckoutOptions();
        
        // Subcategory body with fieldset menu and form preview
        var optBody = document.createElement('div');
        optBody.className = 'formbuilder-accordion-option-body';
        
        var fieldsContainer = document.createElement('div');
        fieldsContainer.className = 'formbuilder-fields-container';
        optBody.appendChild(fieldsContainer);
        
        // Fieldset menu
        var fieldsetMenu = document.createElement('div');
        fieldsetMenu.className = 'formbuilder-fieldset-menu';
        fieldsetMenu.innerHTML = '<div class="formbuilder-fieldset-menu-button">+ Add Field</div><div class="formbuilder-fieldset-menu-options"></div>';
        
        var fieldsetBtn = fieldsetMenu.querySelector('.formbuilder-fieldset-menu-button');
        var fieldsetOpts = fieldsetMenu.querySelector('.formbuilder-fieldset-menu-options');
        
        var addedFieldsets = {};
        
        function createFieldElement(fieldData, isRequired, fieldsetDef) {
            var fsId = fieldData.id || fieldData.fieldsetKey || fieldData.key || fieldData.name;
            var fieldName = fieldData.name || fieldData.key || 'Unnamed';
            var isEditable = fieldsetDef && fieldsetDef.formbuilder_editable === true;
            
            var fieldWrapper = document.createElement('div');
            fieldWrapper.className = 'formbuilder-field-wrapper';
            fieldWrapper.setAttribute('data-fieldset-id', fsId);
            
            var field = document.createElement('div');
            field.className = 'formbuilder-field';
            
            var fieldText = document.createElement('span');
            fieldText.className = 'formbuilder-field-text';
            
            var fieldNameSpan = document.createElement('span');
            fieldNameSpan.className = 'formbuilder-field-name';
            fieldNameSpan.textContent = fieldName;
            
            var fieldRequired = document.createElement('span');
            fieldRequired.className = 'formbuilder-field-required';
            fieldRequired.textContent = '*';
            
            var fieldIndicators = document.createElement('span');
            fieldIndicators.className = 'formbuilder-field-indicators';
            
            var indicatorRepeat = document.createElement('span');
            indicatorRepeat.className = 'formbuilder-field-indicator formbuilder-field-indicator-repeat';
            indicatorRepeat.textContent = '↻';
            indicatorRepeat.title = 'Location Repeat';
            
            var indicatorMust = document.createElement('span');
            indicatorMust.className = 'formbuilder-field-indicator formbuilder-field-indicator-must';
            indicatorMust.textContent = '!';
            indicatorMust.title = 'Must Repeat';
            
            var indicatorAutofill = document.createElement('span');
            indicatorAutofill.className = 'formbuilder-field-indicator formbuilder-field-indicator-autofill';
            indicatorAutofill.textContent = '≡';
            indicatorAutofill.title = 'Autofill Repeat';
            
            fieldIndicators.appendChild(indicatorRepeat);
            fieldIndicators.appendChild(indicatorMust);
            fieldIndicators.appendChild(indicatorAutofill);
            
            var fieldDrag = document.createElement('div');
            fieldDrag.className = 'formbuilder-field-drag';
            fieldDrag.innerHTML = dragHandleSvg;
            
            var fieldEdit = document.createElement('div');
            fieldEdit.className = 'formbuilder-field-edit';
            fieldEdit.innerHTML = editPenSvg;
            
            fieldText.appendChild(fieldNameSpan);
            fieldText.appendChild(fieldRequired);
            fieldText.appendChild(fieldIndicators);
            field.appendChild(fieldText);
            field.appendChild(fieldDrag);
            field.appendChild(fieldEdit);
            
            var fieldEditPanel = document.createElement('div');
            fieldEditPanel.className = 'formbuilder-field-editpanel';
            
            var editRow = document.createElement('div');
            editRow.className = 'formbuilder-field-editpanel-row';
            
            var requiredLabel = document.createElement('label');
            requiredLabel.className = 'formbuilder-field-required-label';
            
            var requiredCheckbox = document.createElement('input');
            requiredCheckbox.type = 'checkbox';
            requiredCheckbox.className = 'formbuilder-field-required-checkbox';
            requiredCheckbox.checked = isRequired;
            if (isRequired) {
                fieldWrapper.classList.add('formbuilder-field-wrapper--required');
            }
            requiredCheckbox.onchange = function() {
                if (requiredCheckbox.checked) {
                    fieldWrapper.classList.add('formbuilder-field-wrapper--required');
                } else {
                    fieldWrapper.classList.remove('formbuilder-field-wrapper--required');
                }
            };
            
            requiredLabel.appendChild(requiredCheckbox);
            requiredLabel.appendChild(document.createTextNode('Required'));
            
            var fieldMoreBtn = document.createElement('div');
            fieldMoreBtn.className = 'formbuilder-field-more';
            fieldMoreBtn.innerHTML = moreDotsSvg + '<div class="formbuilder-field-more-menu"><div class="formbuilder-field-more-item formbuilder-field-more-delete">Delete Field</div></div>';
            
            fieldMoreBtn.addEventListener('click', function(ev) {
                ev.stopPropagation();
                var wasOpen = fieldMoreBtn.classList.contains('formbuilder-field-more--open');
                closeAllMenus();
                if (!wasOpen) fieldMoreBtn.classList.add('formbuilder-field-more--open');
            });
            
            var fieldDeleteItem = fieldMoreBtn.querySelector('.formbuilder-field-more-delete');
            fieldDeleteItem.addEventListener('click', function(ev) {
                ev.stopPropagation();
                fieldWrapper.remove();
                addedFieldsets[fsId] = false;
                var menuOpt = fieldsetOpts.querySelector('[data-fieldset-id="' + fsId + '"]');
                if (menuOpt) menuOpt.classList.remove('formbuilder-fieldset-menu-option--disabled');
            });
            
            editRow.appendChild(requiredLabel);
            editRow.appendChild(fieldMoreBtn);
            fieldEditPanel.appendChild(editRow);
            
            // Repeat switches
            var switchRow = document.createElement('div');
            switchRow.className = 'formbuilder-field-switch-row';
            
            var locationRepeatLabel = document.createElement('label');
            locationRepeatLabel.className = 'formbuilder-field-switch-label';
            var locationRepeatSwitch = document.createElement('div');
            locationRepeatSwitch.className = 'formbuilder-field-switch';
            locationRepeatLabel.appendChild(locationRepeatSwitch);
            locationRepeatLabel.appendChild(document.createTextNode('Location Repeat'));
            
            var mustRepeatLabel = document.createElement('label');
            mustRepeatLabel.className = 'formbuilder-field-switch-label formbuilder-field-switch-label--disabled';
            var mustRepeatSwitch = document.createElement('div');
            mustRepeatSwitch.className = 'formbuilder-field-switch formbuilder-field-switch--disabled';
            mustRepeatLabel.appendChild(mustRepeatSwitch);
            mustRepeatLabel.appendChild(document.createTextNode('Must Repeat'));
            
            var autofillRepeatLabel = document.createElement('label');
            autofillRepeatLabel.className = 'formbuilder-field-switch-label formbuilder-field-switch-label--disabled';
            var autofillRepeatSwitch = document.createElement('div');
            autofillRepeatSwitch.className = 'formbuilder-field-switch formbuilder-field-switch--disabled';
            autofillRepeatLabel.appendChild(autofillRepeatSwitch);
            autofillRepeatLabel.appendChild(document.createTextNode('Autofill Repeat'));
            
            locationRepeatSwitch.addEventListener('click', function(e) {
                e.stopPropagation();
                var isOn = locationRepeatSwitch.classList.toggle('formbuilder-field-switch--on');
                if (isOn) {
                    fieldWrapper.classList.add('formbuilder-field-wrapper--location-repeat');
                    mustRepeatLabel.classList.remove('formbuilder-field-switch-label--disabled');
                    mustRepeatSwitch.classList.remove('formbuilder-field-switch--disabled');
                    autofillRepeatLabel.classList.remove('formbuilder-field-switch-label--disabled');
                    autofillRepeatSwitch.classList.remove('formbuilder-field-switch--disabled');
                } else {
                    fieldWrapper.classList.remove('formbuilder-field-wrapper--location-repeat');
                    mustRepeatLabel.classList.add('formbuilder-field-switch-label--disabled');
                    mustRepeatSwitch.classList.add('formbuilder-field-switch--disabled');
                    autofillRepeatLabel.classList.add('formbuilder-field-switch-label--disabled');
                    autofillRepeatSwitch.classList.add('formbuilder-field-switch--disabled');
                }
            });
            
            mustRepeatSwitch.addEventListener('click', function(e) {
                e.stopPropagation();
                if (mustRepeatSwitch.classList.contains('formbuilder-field-switch--disabled')) return;
                var isOn = mustRepeatSwitch.classList.toggle('formbuilder-field-switch--on');
                if (isOn) {
                    fieldWrapper.classList.add('formbuilder-field-wrapper--must-repeat');
                } else {
                    fieldWrapper.classList.remove('formbuilder-field-wrapper--must-repeat');
                }
            });
            
            autofillRepeatSwitch.addEventListener('click', function(e) {
                e.stopPropagation();
                if (autofillRepeatSwitch.classList.contains('formbuilder-field-switch--disabled')) return;
                var isOn = autofillRepeatSwitch.classList.toggle('formbuilder-field-switch--on');
                if (isOn) {
                    fieldWrapper.classList.add('formbuilder-field-wrapper--autofill-repeat');
                } else {
                    fieldWrapper.classList.remove('formbuilder-field-wrapper--autofill-repeat');
                }
            });
            
            switchRow.appendChild(locationRepeatLabel);
            switchRow.appendChild(mustRepeatLabel);
            switchRow.appendChild(autofillRepeatLabel);
            fieldEditPanel.appendChild(switchRow);
            
            if (isEditable) {
                var nameLabel = document.createElement('label');
                nameLabel.className = 'formbuilder-field-label';
                nameLabel.textContent = 'Name';
                var nameInput = document.createElement('input');
                nameInput.type = 'text';
                nameInput.className = 'formbuilder-field-input';
                nameInput.placeholder = 'Field name';
                nameInput.value = fieldData.name || '';
                nameInput.oninput = function() {
                    fieldNameSpan.textContent = nameInput.value || fieldsetDef.name || 'Unnamed';
                };
                fieldEditPanel.appendChild(nameLabel);
                fieldEditPanel.appendChild(nameInput);
                
                var fieldType = fieldsetDef.type || fieldsetDef.fieldset_type || fieldsetDef.key || '';
                var needsOptions = fieldType === 'dropdown' || fieldType === 'radio' || fieldType === 'select';
                
                if (needsOptions) {
                    var optionsLabel = document.createElement('label');
                    optionsLabel.className = 'formbuilder-field-label';
                    optionsLabel.textContent = 'Options';
                    fieldEditPanel.appendChild(optionsLabel);
                    
                    var optionsContainer = document.createElement('div');
                    optionsContainer.className = 'formbuilder-field-options';
                    
                    function createOptionRow(value) {
                        var row = document.createElement('div');
                        row.className = 'formbuilder-field-option-row';
                        
                        var input = document.createElement('input');
                        input.type = 'text';
                        input.className = 'formbuilder-field-option-input';
                        input.value = value || '';
                        input.placeholder = 'Option';
                        
                        var addBtn = document.createElement('div');
                        addBtn.className = 'formbuilder-field-option-add';
                        addBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
                        addBtn.onclick = function() {
                            var newRow = createOptionRow('');
                            row.parentNode.insertBefore(newRow, row.nextSibling);
                        };
                        
                        var removeBtn = document.createElement('div');
                        removeBtn.className = 'formbuilder-field-option-remove';
                        removeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
                        removeBtn.onclick = function() {
                            if (optionsContainer.querySelectorAll('.formbuilder-field-option-row').length > 1) {
                                row.remove();
                            }
                        };
                        
                        row.appendChild(input);
                        row.appendChild(addBtn);
                        row.appendChild(removeBtn);
                        return row;
                    }
                    
                    var existingOptions = fieldData.options || fieldData.checkoutOptions || [];
                    if (Array.isArray(existingOptions) && existingOptions.length > 0) {
                        existingOptions.forEach(function(o) {
                            var val = typeof o === 'string' ? o : (o.label || o.name || o.value || '');
                            optionsContainer.appendChild(createOptionRow(val));
                        });
                    } else {
                        optionsContainer.appendChild(createOptionRow(''));
                    }
                    
                    fieldEditPanel.appendChild(optionsContainer);
                }
                
                var placeholderLabel = document.createElement('label');
                placeholderLabel.className = 'formbuilder-field-label';
                placeholderLabel.textContent = 'Placeholder';
                var placeholderInput = document.createElement('input');
                placeholderInput.type = 'text';
                placeholderInput.className = 'formbuilder-field-input';
                placeholderInput.placeholder = 'Placeholder text';
                placeholderInput.value = fieldData.placeholder || '';
                fieldEditPanel.appendChild(placeholderLabel);
                fieldEditPanel.appendChild(placeholderInput);
                
                var tooltipLabel = document.createElement('label');
                tooltipLabel.className = 'formbuilder-field-label';
                tooltipLabel.textContent = 'Tooltip';
                var tooltipInput = document.createElement('input');
                tooltipInput.type = 'text';
                tooltipInput.className = 'formbuilder-field-input';
                tooltipInput.placeholder = 'Tooltip text';
                tooltipInput.value = fieldData.tooltip || fieldData.fieldset_tooltip || '';
                fieldEditPanel.appendChild(tooltipLabel);
                fieldEditPanel.appendChild(tooltipInput);
            }
            
            fieldWrapper.appendChild(field);
            fieldWrapper.appendChild(fieldEditPanel);
            
            field.addEventListener('click', function(ev) {
                ev.stopPropagation();
                container.querySelectorAll('.formbuilder-field-wrapper--editing').forEach(function(el) {
                    if (el !== fieldWrapper) {
                        el.classList.remove('formbuilder-field-wrapper--editing');
                    }
                });
            });
            
            fieldEdit.addEventListener('click', function(ev) {
                ev.stopPropagation();
                var isOpen = fieldWrapper.classList.contains('formbuilder-field-wrapper--editing');
                container.querySelectorAll('.formbuilder-field-wrapper--editing').forEach(function(el) {
                    el.classList.remove('formbuilder-field-wrapper--editing');
                });
                if (!isOpen) {
                    fieldWrapper.classList.add('formbuilder-field-wrapper--editing');
                }
            });
            
            fieldWrapper.draggable = true;
            fieldWrapper.addEventListener('dragstart', function(ev) {
                ev.stopPropagation();
                ev.dataTransfer.effectAllowed = 'move';
                fieldWrapper.classList.add('formbuilder-field-wrapper--dragging');
            });
            fieldWrapper.addEventListener('dragend', function() {
                fieldWrapper.classList.remove('formbuilder-field-wrapper--dragging');
            });
            fieldWrapper.addEventListener('dragover', function(ev) {
                ev.preventDefault();
                ev.stopPropagation();
                var dragging = fieldsContainer.querySelector('.formbuilder-field-wrapper--dragging');
                if (dragging && dragging !== fieldWrapper) {
                    var rect = fieldWrapper.getBoundingClientRect();
                    var midY = rect.top + rect.height / 2;
                    if (ev.clientY < midY) {
                        fieldWrapper.parentNode.insertBefore(dragging, fieldWrapper);
                    } else {
                        fieldWrapper.parentNode.insertBefore(dragging, fieldWrapper.nextSibling);
                    }
                }
            });
            
            return { wrapper: fieldWrapper, fsId: fsId };
        }
        
        // Populate fieldset options
        fieldsets.forEach(function(fs) {
            var fsId = fs.id || fs.key || fs.name;
            var opt = document.createElement('div');
            opt.className = 'formbuilder-fieldset-menu-option';
            opt.textContent = fs.name || fs.key || 'Unnamed';
            opt.setAttribute('data-fieldset-id', fsId);
            opt.onclick = function(e) {
                e.stopPropagation();
                if (opt.classList.contains('formbuilder-fieldset-menu-option--disabled')) return;
                
                var result = createFieldElement(fs, true, fs);
                fieldsContainer.appendChild(result.wrapper);
                addedFieldsets[result.fsId] = true;
                opt.classList.add('formbuilder-fieldset-menu-option--disabled');
                fieldsetMenu.classList.remove('formbuilder-fieldset-menu--open');
            };
            fieldsetOpts.appendChild(opt);
        });
        
        // Load existing fields from database
        var subFieldsMap = cat.subFields || {};
        var existingFields = subFieldsMap[subName] || [];
        existingFields.forEach(function(fieldData) {
            var isRequired = fieldData.required === true || fieldData.required === 1 || fieldData.required === '1';
            var fieldsetKey = fieldData.fieldsetKey || fieldData.key || fieldData.id;
            var matchingFieldset = fieldsets.find(function(fs) {
                return fs.id === fieldsetKey || fs.key === fieldsetKey || fs.fieldset_key === fieldsetKey;
            });
            var result = createFieldElement(fieldData, isRequired, matchingFieldset);
            fieldsContainer.appendChild(result.wrapper);
            addedFieldsets[result.fsId] = true;
            var menuOpt = fieldsetOpts.querySelector('[data-fieldset-id="' + result.fsId + '"]');
            if (menuOpt) menuOpt.classList.add('formbuilder-fieldset-menu-option--disabled');
        });
        
        fieldsetBtn.onclick = function(e) {
            e.stopPropagation();
            var wasOpen = fieldsetMenu.classList.contains('formbuilder-fieldset-menu--open');
            closeAllMenus();
            if (!wasOpen) fieldsetMenu.classList.add('formbuilder-fieldset-menu--open');
        };
        
        optBody.appendChild(fieldsetMenu);
        
        var formPreviewBtn = document.createElement('div');
        formPreviewBtn.className = 'formbuilder-add-button formbuilder-form-preview';
        formPreviewBtn.textContent = 'Form Preview';
        optBody.appendChild(formPreviewBtn);
        
        option.appendChild(optHeader);
        option.appendChild(subEditPanel);
        option.appendChild(optBody);
        
        // Sub edit area click
        optEditArea.addEventListener('click', function(e) {
            e.stopPropagation();
            var isOpen = option.classList.contains('formbuilder-accordion-option--editing');
            closeAllEditPanels();
            if (!isOpen) {
                option.classList.add('formbuilder-accordion-option--editing');
            }
        });
        
        // Sub header click (except edit area)
        optHeader.addEventListener('click', function(e) {
            if (e.target.closest('.formbuilder-accordion-option-editarea')) return;
            if (!option.classList.contains('formbuilder-accordion-option--editing')) {
                closeAllEditPanels();
            }
            option.classList.toggle('formbuilder-accordion-option--open');
        });
        
        return option;
    }
    
    function init() {
        container = document.getElementById('admin-formbuilder');
        if (!container) return;

        bindDocumentListeners();
        // Data loads only when admin panel opens - NOT on page load
    }

    // Initialize DOM references when ready (no data loading)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Load data ONLY when admin panel opens
    if (window.App && App.on) {
        App.on('admin:opened', function() {
            if (container) {
                loadFormData();
            }
        });
    }
    
    // Register module
    if (window.App && App.registerModule) {
        App.registerModule('formbuilder', {
            init: init,
            refresh: loadFormData
        });
    }
})();
