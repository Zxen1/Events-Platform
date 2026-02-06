/* ============================================================================
   MARQUEE.JS - MARQUEE SECTION
   ============================================================================
   
   Controls the marquee panel - premium ads, testimonials, competitions, notices.
   
   CONTAINS:
   - Premium post ads with slow zoom animation
   - Testimonials and comments
   - FunMap notices and announcements
   - Competitions
   - 20-second cycle for full-screen premium ads
   - Mixed content scrolling feed
   
   RULES:
   - Premium full-screen ads: "Featured Post + Marquee" checkout option
   - Only shows posts not filtered out by current filters
   - Cycles through available featured posts
   
   CONTAINERS:
   - .marquee (outer panel)
   - .marquee-content (inner content area)
   - .marquee-slide (individual slides)
   
   DEPENDENCIES:
   - index.js (backbone)
   
   COMMUNICATES WITH:
   - filter.js (respects active filters via App events)
   - post.js (clicking slide opens post)
   
   ============================================================================ */

const MarqueeModule = (function() {
  'use strict';

  /* --------------------------------------------------------------------------
     CONSTANTS & CONFIG
     -------------------------------------------------------------------------- */
  function getRotationInterval() {
    return (window.App && typeof App.getConfig === 'function') ? App.getConfig('marqueeRotationInterval') || 20000 : 20000;
  }
  
  const FADE_DURATION = 1500;      // 1.5 seconds fade transition

  /* --------------------------------------------------------------------------
     STATE
     -------------------------------------------------------------------------- */
  let marqueeEl = null;           // .marquee element
  let contentEl = null;           // .marquee-content element
  let posts = [];                 // Posts to display (internal state for rotation)
  let currentIndex = -1;          // Current slide index
  let rotationTimer = null;       // Interval timer
  let postsKey = '';              // Cache key to detect changes
  let isVisible = false;          // Visibility state
  let isInitialized = false;      // Module init state

  /* --------------------------------------------------------------------------
     INITIALIZATION
     -------------------------------------------------------------------------- */
  
  /**
   * Initialize the marquee module
   */
  function init() {
    console.log('[Marquee] Initializing marquee module...');
    
    marqueeEl = document.querySelector('.marquee');
    contentEl = document.querySelector('.marquee-content');
    
    if (!marqueeEl || !contentEl) {
      console.warn('[Marquee] Marquee elements not found');
      return;
    }
    
    // Attach click handler
    contentEl.addEventListener('click', handleSlideClick, { capture: true });
    
    // Listen for filter changes
    App.on('filter:applied', handleFilterApplied);
    
    // Listen for visibility toggle
    App.on('marquee:show', show);
    App.on('marquee:hide', hide);
    App.on('marquee:toggle', toggle);
    
    console.log('[Marquee] Marquee module initialized');
  }

  /* --------------------------------------------------------------------------
     VISIBILITY (matches post/recent panel togglePanel pattern)
     -------------------------------------------------------------------------- */
  
  // Animation state tracking (same pattern as post.js panelMotion)
  let motionToken = 0;
  let hideHandler = null;
  let hideTimeoutId = 0;
  
  function clearPendingHide() {
    if (hideHandler) {
      contentEl.removeEventListener('transitionend', hideHandler);
      hideHandler = null;
    }
    if (hideTimeoutId) {
      clearTimeout(hideTimeoutId);
      hideTimeoutId = 0;
    }
  }
  
  function getTransitionDurationMs() {
    var durationMs = 300;
    try {
      var cs = window.getComputedStyle(contentEl);
      var dur = (cs && cs.transitionDuration) ? String(cs.transitionDuration).split(',')[0].trim() : '';
      if (dur.endsWith('ms')) durationMs = Math.max(0, parseFloat(dur) || 0);
      else if (dur.endsWith('s')) durationMs = Math.max(0, (parseFloat(dur) || 0) * 1000);
    } catch (e) {
      // ignore
    }
    return Math.max(0, Math.ceil(durationMs));
  }
  
  /**
   * Show the marquee panel (same pattern as togglePanel in post.js)
   */
  function show() {
    if (!marqueeEl || !contentEl) return;
    if (isVisible) return;
    
    clearPendingHide();
    motionToken += 1;
    var token = motionToken;
    
    // Show outer container
    marqueeEl.classList.add('marquee--show');
    marqueeEl.setAttribute('aria-hidden', 'false');
    
    // Ensure we start from hidden/off-screen state
    contentEl.classList.remove('marquee-content--visible');
    contentEl.classList.add('marquee-content--hidden');
    
    // Force reflow so transition works
    try { void contentEl.offsetWidth; } catch (e) {}
    
    requestAnimationFrame(function() {
      if (motionToken !== token) return;
      contentEl.classList.remove('marquee-content--hidden');
      contentEl.classList.add('marquee-content--visible');
      isVisible = true;
      
      // Start rotation if we have posts
      if (posts.length > 0 && !rotationTimer) {
        startRotation();
      }
      
      App.emit('marquee:shown');
    });
  }
  
  /**
   * Hide the marquee panel (same pattern as togglePanel in post.js)
   */
  function hide() {
    if (!marqueeEl || !contentEl) return;
    if (!isVisible) return;
    
    motionToken += 1; // invalidates any pending open RAF
    clearPendingHide();
    
    var wasShown = marqueeEl.classList.contains('marquee--show');
    var wasVisible = contentEl.classList.contains('marquee-content--visible');
    
    marqueeEl.setAttribute('aria-hidden', 'true');
    stopRotation();
    isVisible = false;
    
    // If not shown/visible, nothing to animate
    if (!wasShown || !wasVisible) {
      contentEl.classList.remove('marquee-content--visible');
      contentEl.classList.add('marquee-content--hidden');
      marqueeEl.classList.remove('marquee--show');
      App.emit('marquee:hidden');
      return;
    }
    
    // Start slide-out
    contentEl.classList.remove('marquee-content--visible');
    contentEl.classList.add('marquee-content--hidden');
    
    // After transition, remove outer show class
    var duration = getTransitionDurationMs();
    hideHandler = function(e) {
      if (e && e.target !== contentEl) return;
      clearPendingHide();
      if (!isVisible) {
        marqueeEl.classList.remove('marquee--show');
      }
      App.emit('marquee:hidden');
    };
    contentEl.addEventListener('transitionend', hideHandler, { once: true });
    
    // Fallback timeout
    hideTimeoutId = setTimeout(function() {
      hideHandler({ target: contentEl });
    }, duration + 100);
  }
  
  /**
   * Toggle marquee visibility
   */
  function toggle() {
    if (isVisible) {
      hide();
    } else {
      show();
    }
  }

  /* --------------------------------------------------------------------------
     CONTENT MANAGEMENT
     -------------------------------------------------------------------------- */
  
  /**
   * Handle filter:applied event - update marquee posts
   * @param {Object} data - Filter data with marqueePosts array
   */
  function handleFilterApplied(data) {
    if (!data || !Array.isArray(data.marqueePosts)) return;
    
    const newPosts = data.marqueePosts;
    const newKey = newPosts.map(p => p.id).join(',');
    
    // Only update if posts changed
    if (newKey !== postsKey) {
      updatePosts(newPosts);
      postsKey = newKey;
    }
  }
  
  /**
   * Update the posts to display
   * @param {Array} newPosts - Array of post objects
   */
  function updatePosts(newPosts) {
    // Stop current rotation
    stopRotation();
    
    // Clear existing slides
    clearSlides();
    
    // Update posts
    posts = newPosts;
    currentIndex = -1;
    
    // Start showing if we have posts
    if (posts.length > 0) {
      showNextSlide();
      startRotation();
    }
  }
  
  /**
   * Clear all slides from the marquee
   */
  function clearSlides() {
    if (!contentEl) return;
    contentEl.innerHTML = '';
  }

  /* --------------------------------------------------------------------------
     SLIDE ROTATION
     -------------------------------------------------------------------------- */
  
  /**
   * Start automatic slide rotation
   */
  function startRotation() {
    if (rotationTimer) return;
    rotationTimer = setInterval(showNextSlide, getRotationInterval());
  }
  
  /**
   * Stop automatic slide rotation
   */
  function stopRotation() {
    if (rotationTimer) {
      clearInterval(rotationTimer);
      rotationTimer = null;
    }
  }
  
  /**
   * Show the next slide in rotation
   */
  function showNextSlide() {
    if (!contentEl || posts.length === 0) return;
    
    currentIndex = (currentIndex + 1) % posts.length;
    const post = posts[currentIndex];
    
    const slide = document.createElement('a');
    slide.className = 'marquee-slide';
    slide.dataset.id = post.id;
    slide.href = getPostUrl(post);
    
    const img = new Image();
    img.className = 'marquee-slide-image';
    img.src = getHeroUrl(post);
    img.alt = '';
    
    // Wait for image to decode before showing
    img.decode().catch(function() {}).then(function() {
      slide.appendChild(img);
      slide.appendChild(createSlideInfo(post));
      contentEl.appendChild(slide);
      
      requestAnimationFrame(function() {
        slide.classList.add('marquee-slide--active');
      });
      
      const slides = contentEl.querySelectorAll('.marquee-slide');
      if (slides.length > 1) {
        const oldSlide = slides[0];
        oldSlide.classList.remove('marquee-slide--active');
        setTimeout(function() {
          if (oldSlide.parentNode) {
            oldSlide.remove();
          }
        }, FADE_DURATION);
      }
    });
  }
  
  /**
   * Create the info overlay for a slide
   * @param {Object} post - Post object
   * @returns {HTMLElement} The info element
   */
  function createSlideInfo(post) {
    const info = document.createElement('div');
    info.className = 'marquee-slide-info';
    
    // Get first map card data
    const mapCard = (post.map_cards && post.map_cards.length) ? post.map_cards[0] : null;

    // Get display data (mirroring PostModule.renderPostCard)
    let title = (mapCard && mapCard.title) || post.checkout_title || post.title || '';
    if (title === 'Array') title = 'Post #' + post.id;
    const venueName = (mapCard && mapCard.venue_name) || '';
    const city = (mapCard && mapCard.city) || '';
    const locationDisplay = venueName || city || post.location || post.venue || '';

    // Get subcategory info
    var displayName = post.subcategory_name || '';
    if (!displayName) {
      throw new Error('[Marquee] Subcategory name missing for key: ' + (post.subcategory_key || 'unknown'));
    }
    var iconUrl = post.subcategory_icon_url || '';
    if (!iconUrl) {
      throw new Error('[Marquee] Subcategory icon missing for key: ' + (post.subcategory_key || 'unknown'));
    }

    // Format dates - prioritizes pre-formatted session_summary from database
    const datesText = formatDates(mapCard ? mapCard.session_summary : post.session_summary);

    // Format price summary
    const postModule = (window.App && typeof App.getModule === 'function') ? App.getModule('post') : null;
    const priceParts = (postModule && typeof postModule.parsePriceSummary === 'function') 
      ? postModule.parsePriceSummary(mapCard ? mapCard.price_summary : post.price_summary)
      : { flagUrl: '', countryCode: '', text: '' };

    // 1. Title line
    const titleLine = document.createElement('div');
    titleLine.className = 'marquee-slide-info-title';
    titleLine.textContent = String(title || '').trim();
    info.appendChild(titleLine);
    
    // 2. Category line with icon
    const catLine = document.createElement('div');
    catLine.className = 'marquee-slide-info-cat';
    
    if (iconUrl) {
      const iconWrap = document.createElement('span');
      iconWrap.className = 'marquee-slide-icon-sub';
      const iconImg = document.createElement('img');
      iconImg.className = 'marquee-image-sub';
      iconImg.src = iconUrl;
      iconImg.alt = '';
      iconWrap.appendChild(iconImg);
      catLine.appendChild(iconWrap);
    }
    
    const catText = document.createElement('span');
    catText.textContent = displayName; 
    catLine.appendChild(catText);
    info.appendChild(catLine);
    
    // 3. Location line
    if (locationDisplay) {
      const locLine = document.createElement('div');
      locLine.className = 'marquee-slide-info-loc';
      locLine.innerHTML = '<span class="marquee-badge" title="Location">📍</span>';
      const locText = document.createElement('span');
      locText.textContent = String(locationDisplay).trim();
      locLine.appendChild(locText);
      info.appendChild(locLine);
    }
    
    // 4. Date line
    if (datesText) {
      const dateLine = document.createElement('div');
      dateLine.className = 'marquee-slide-info-date';
      dateLine.innerHTML = '<span class="marquee-badge" title="Dates">📅</span>';
      const dateText = document.createElement('span');
      dateText.textContent = datesText;
      dateLine.appendChild(dateText);
      info.appendChild(dateLine);
    }
    
    // 5. Price line
    if (priceParts.text) {
      const priceLine = document.createElement('div');
      priceLine.className = 'marquee-slide-info-price';
      
      let badgeContent = '';
      if (priceParts.flagUrl) {
        badgeContent = '<img class="marquee-image-badge" src="' + priceParts.flagUrl + '" alt="' + priceParts.countryCode + '" title="Currency: ' + priceParts.countryCode.toUpperCase() + '">';
      } else {
        badgeContent = '💰';
      }
      
      priceLine.innerHTML = '<span class="marquee-badge" title="Price">' + badgeContent + '</span>';
      const priceTextEl = document.createElement('span');
      priceTextEl.textContent = priceParts.text;
      priceLine.appendChild(priceTextEl);
      
      // Check for promo and add badge
      const hasPromo = (postModule && typeof postModule.mapCardHasPromo === 'function') 
        ? postModule.mapCardHasPromo(mapCard) 
        : false;
      if (hasPromo) {
        const promoTag = document.createElement('span');
        promoTag.className = 'marquee-tag-promo';
        promoTag.textContent = 'Promo';
        priceLine.appendChild(promoTag);
      }
      
      info.appendChild(priceLine);
    }
    
    return info;
  }

  /* --------------------------------------------------------------------------
     CLICK HANDLING
     -------------------------------------------------------------------------- */
  
  /**
   * Handle click on a slide
   * @param {Event} e - Click event
   */
  function handleSlideClick(e) {
    const slide = e.target.closest('.marquee-slide');
    if (!slide) return;
    
    e.preventDefault();
    
    const postId = slide.dataset.id;
    if (!postId) return;
    
    // Emit event for post module to handle
    App.emit('post:open', { id: postId, source: 'marquee' });
  }

  /* --------------------------------------------------------------------------
     HELPER FUNCTIONS
     -------------------------------------------------------------------------- */
  
  /**
   * Get the URL for a post
   * @param {Object} post - Post object
   * @returns {string} Post URL
   */
  function getPostUrl(post) {
    const postModule = (window.App && typeof App.getModule === 'function') ? App.getModule('post') : null;
    if (!postModule || typeof postModule.getPostUrl !== 'function') {
      throw new Error('[Marquee] Post module not available for getPostUrl()');
    }
    return postModule.getPostUrl(post);
  }
  
  /**
   * Get the raw image URL for a post (full resolution for marquee)
   * @param {Object} post - Post object
   * @returns {string} Raw image URL
   */
  function getHeroUrl(post) {
    const postModule = (window.App && typeof App.getModule === 'function') ? App.getModule('post') : null;
    if (!postModule || typeof postModule.getRawImageUrl !== 'function') {
      throw new Error('[Marquee] Post module not available for getRawImageUrl()');
    }
    return postModule.getRawImageUrl(post);
  }
  
  /**
   * Format dates display for a marquee slide.
   * @param {string} dates - Pre-formatted date summary string
   * @returns {string} Formatted date string
   */
  function formatDates(dates) {
    if (!dates) return '';
    if (typeof dates === 'string' && dates.indexOf('{') !== 0) {
      return dates;
    }
    return '';
  }

  /* --------------------------------------------------------------------------
     PUBLIC API
     -------------------------------------------------------------------------- */
  return {
    init,
    show,
    hide,
    toggle,
    updatePosts,
    
    // Getters for external access
    isVisible: () => isVisible,
    getPostCount: () => posts.length,
    getCurrentIndex: () => currentIndex
  };

})();

// Register with App
App.registerModule('marquee', MarqueeModule);

// Lazy initialization - only init when width is 1900+, posts mode active, and posts loaded
(function() {
    var bootloaded = false;
    var lastPosts = null;
    var currentMode = 'map';
    
    function isWideEnough() {
        return window.innerWidth >= 1900;
    }
    
    function lazyInit() {
        if (bootloaded || !isWideEnough()) return;
        MarqueeModule.init();
        bootloaded = true;
        if (lastPosts && lastPosts.length > 0) {
            MarqueeModule.updatePosts(lastPosts);
        }
    }
    
    function checkAndShow() {
        if (!bootloaded) return;
        
        // Must be: wide enough + posts mode + has posts
        if (isWideEnough() && currentMode === 'posts' && lastPosts && lastPosts.length > 0) {
            MarqueeModule.show();
        } else {
            MarqueeModule.hide();
        }
    }
    
    if (window.App && App.on) {
        App.on('filter:applied', function(data) {
            if (data && Array.isArray(data.marqueePosts)) {
                lastPosts = data.marqueePosts;
            }
            
            if (lastPosts && lastPosts.length > 0 && isWideEnough()) {
                lazyInit();
            }
            checkAndShow();
        });
        
        App.on('mode:changed', function(data) {
            if (data && data.mode) {
                currentMode = data.mode;
            }
            checkAndShow();
        });

        window.addEventListener('resize', function() {
            if (!bootloaded && lastPosts && lastPosts.length > 0 && isWideEnough()) {
                lazyInit();
            }
            checkAndShow();
        });
    }
})();
