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
     CONSTANTS
     -------------------------------------------------------------------------- */
  const ROTATION_INTERVAL = 20000; // 20 seconds per slide
  const FADE_DURATION = 1500;      // 1.5 seconds fade transition

  /* --------------------------------------------------------------------------
     STATE
     -------------------------------------------------------------------------- */
  let marqueeEl = null;           // .marquee element
  let contentEl = null;           // .marquee-content element
  let posts = [];                 // Posts to display
  let currentIndex = -1;          // Current slide index
  let rotationTimer = null;       // Interval timer
  let postsKey = '';              // Cache key to detect changes
  let isVisible = false;          // Visibility state

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

    // Watch for window resize to handle 1920px rule
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check
    
    console.log('[Marquee] Marquee module initialized');
  }

  /**
   * Handle window resize - enforce 1920px visibility rule
   */
  function handleResize() {
    let threshold = 1920;
    if (window.App && typeof App.getConfig === 'function') {
      const configVal = App.getConfig('marqueeWidthThreshold');
      if (typeof configVal === 'number' && isFinite(configVal)) {
        threshold = configVal;
      }
    }
    const isWideEnough = window.innerWidth >= threshold;
    if (isWideEnough) {
      if (!isVisible && posts.length > 0) {
        show();
      }
    } else {
      if (isVisible) {
        hide();
      }
    }
  }

  /* --------------------------------------------------------------------------
     VISIBILITY
     -------------------------------------------------------------------------- */
  
  /**
   * Show the marquee panel
   */
  function show() {
    if (!marqueeEl || !contentEl) return;
    
    marqueeEl.classList.add('marquee--show');
    contentEl.classList.remove('marquee-content--hidden');
    contentEl.classList.add('marquee-content--visible');
    isVisible = true;
    
    // Start rotation if we have posts
    if (posts.length > 0 && !rotationTimer) {
      startRotation();
    }
    
    App.emit('marquee:shown');
  }
  
  /**
   * Hide the marquee panel
   */
  function hide() {
    if (!marqueeEl || !contentEl) return;
    
    contentEl.classList.remove('marquee-content--visible');
    contentEl.classList.add('marquee-content--hidden');
    
    // Stop rotation when hidden
    stopRotation();
    
    setTimeout(() => {
      if (!isVisible) {
        marqueeEl.classList.remove('marquee--show');
      }
    }, 300); // Match CSS transition duration
    
    isVisible = false;
    App.emit('marquee:hidden');
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
    rotationTimer = setInterval(showNextSlide, ROTATION_INTERVAL);
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
    
    // Advance index
    currentIndex = (currentIndex + 1) % posts.length;
    const post = posts[currentIndex];
    
    // Create new slide
    const slide = createSlide(post);
    contentEl.appendChild(slide);
    
    // Trigger animation
    requestAnimationFrame(() => {
      slide.classList.add('marquee-slide--active');
    });
    
    // Remove old slides after fade
    const slides = contentEl.querySelectorAll('.marquee-slide');
    if (slides.length > 1) {
      const oldSlide = slides[0];
      oldSlide.classList.remove('marquee-slide--active');
      setTimeout(() => {
        if (oldSlide.parentNode) {
          oldSlide.remove();
        }
      }, FADE_DURATION);
    }
  }

  /* --------------------------------------------------------------------------
     SLIDE CREATION
     -------------------------------------------------------------------------- */
  
  /**
   * Create a slide element for a post
   * @param {Object} post - Post object
   * @returns {HTMLElement} The slide element
   */
  function createSlide(post) {
    const slide = document.createElement('a');
    slide.className = 'marquee-slide';
    slide.dataset.id = post.id;
    slide.href = getPostUrl(post);
    
    // Create image
    const img = document.createElement('img');
    img.className = 'marquee-slide-image';
    img.src = getHeroUrl(post);
    img.alt = '';
    
    // Wait for image to load before showing info
    img.onload = () => {
      slide.appendChild(createSlideInfo(post));
    };
    
    slide.appendChild(img);
    return slide;
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
    const subcategoryKey = post.subcategory_key || (mapCard && mapCard.subcategory_key) || '';
    const subInfo = (window.PostModule && typeof PostModule.getSubcategoryInfo === 'function') 
      ? PostModule.getSubcategoryInfo(subcategoryKey)
      : { category: post.category || '', subcategory: post.subcategory || subcategoryKey };
    
    const iconUrl = post.subcategory_icon_url || post.subIcon || (window.PostModule && typeof PostModule.getSubcategoryIconUrl === 'function' ? PostModule.getSubcategoryIconUrl(subcategoryKey) : '');

    // Format dates
    const datesText = (window.PostModule && typeof PostModule.formatPostDates === 'function')
      ? PostModule.formatPostDates(post)
      : formatDates(post.dates || (mapCard && mapCard.session_summary));

    // Format price summary
    const priceParts = (window.PostModule && typeof PostModule.parsePriceSummary === 'function')
      ? PostModule.parsePriceSummary(mapCard ? mapCard.price_summary : post.price_summary)
      : { flagUrl: '', countryCode: '', text: (mapCard ? mapCard.price_summary : post.price_summary || '') };

    // 1. Title line
    const titleLine = document.createElement('div');
    titleLine.className = 'marquee-slide-info-title';
    titleLine.textContent = escapeHtml(String(title).trim());
    info.appendChild(titleLine);
    
    // 2. Category line with icon
    const catLine = document.createElement('div');
    catLine.className = 'marquee-slide-info-cat';
    
    if (iconUrl) {
      const iconWrap = document.createElement('span');
      iconWrap.className = 'marquee-subicon';
      const iconImg = document.createElement('img');
      iconImg.className = 'marquee-subicon-image';
      iconImg.src = iconUrl;
      iconImg.alt = '';
      iconWrap.appendChild(iconImg);
      catLine.appendChild(iconWrap);
    }
    
    const catLineText = subInfo.category && subInfo.subcategory
      ? subInfo.category + ' › ' + subInfo.subcategory
      : subInfo.subcategory || subcategoryKey;

    const catText = document.createElement('span');
    catText.innerHTML = catLineText; // It might contain &rsaquo; or similar
    catLine.appendChild(catText);
    info.appendChild(catLine);
    
    // 3. Location line
    if (locationDisplay) {
      const locLine = document.createElement('div');
      locLine.className = 'marquee-slide-info-loc';
      locLine.innerHTML = '<span class="marquee-badge" title="Location">📍</span>';
      const locText = document.createElement('span');
      locText.textContent = escapeHtml(String(locationDisplay).trim());
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
      
      let badgeHtml = '';
      if (priceParts.flagUrl) {
        badgeHtml = '<img class="marquee-badge" src="' + priceParts.flagUrl + '" alt="' + priceParts.countryCode + '" title="Currency: ' + priceParts.countryCode.toUpperCase() + '" style="width: 18px; height: 18px; vertical-align: middle; margin-right: 5px; object-fit: contain;">';
      } else {
        badgeHtml = '<span class="marquee-badge" title="Price">💰</span>';
      }
      
      priceLine.innerHTML = badgeHtml;
      const priceTextEl = document.createElement('span');
      priceTextEl.textContent = priceParts.text;
      priceLine.appendChild(priceTextEl);
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
    // Use post module's URL builder if available
    const postModule = App.getModule('post');
    if (postModule && typeof postModule.getPostUrl === 'function') {
      return postModule.getPostUrl(post);
    }
    console.warn('[Marquee] Post module not ready for getPostUrl()');
    return '';
  }
  
  /**
   * Get the hero image URL for a post
   * @param {Object} post - Post object
   * @returns {string} Hero image URL
   */
  function getHeroUrl(post) {
    // Use post module's URL builder if available
    const postModule = App.getModule('post');
    if (postModule && typeof postModule.getHeroUrl === 'function') {
      return postModule.getHeroUrl(post);
    }
    
    // Use post's hero image if set
    if (post.heroImage) {
      return post.heroImage;
    }
    
    console.warn('[Marquee] Missing hero image for post id ' + String(post && post.id));
    return '';
  }
  
  /**
   * Simple hash to boolean for consistent portrait/landscape selection
   * @param {string} str - String to hash
   * @returns {boolean}
   */
  function hashToBoolean(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h) % 2 === 0;
  }
  
  /**
   * Format dates for display
   * @param {Object|Array|string} dates - Date data
   * @returns {string} Formatted date string
   */
  function formatDates(dates) {
    if (!dates) return 'Dates TBA';
    
    // If string, return as-is
    if (typeof dates === 'string') {
      // If it's a JSON string, try to parse it (legacy fallback)
      if (dates.indexOf('{') === 0) {
        try {
          const parsed = JSON.parse(dates);
          if (parsed.start) {
            if (parsed.end && parsed.end !== parsed.start) {
              return App.formatDateShort(parsed.start) + ' - ' + App.formatDateShort(parsed.end);
            }
            return App.formatDateShort(parsed.start);
          }
        } catch (e) {}
      }
      return dates;
    }
    
    // If array with start/end
    if (Array.isArray(dates) && dates.length > 0) {
      const start = dates[0];
      const end = dates[dates.length - 1];
      if (start === end) return App.formatDateShort(start);
      return App.formatDateShort(start) + ' - ' + App.formatDateShort(end);
    }
    
    // If object with start/end
    if (dates.start) {
      if (dates.end && dates.end !== dates.start) {
        return App.formatDateShort(dates.start) + ' - ' + App.formatDateShort(dates.end);
      }
      return App.formatDateShort(dates.start);
    }
    
    return 'Dates TBA';
  }

  /**
   * Format a single date
   * @param {string|Date} date - Date to format
   * @returns {string} Formatted date
   */
  function formatDate(date) {
    return App.formatDateShort(date);
  }
  
  /**
   * Escape HTML to prevent XSS
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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

// Lazy initialization - only init when posts are loaded and zoom meets threshold
(function() {
    var isInitialized = false;
    
    function getMinZoom() {
        return App.getConfig('postsLoadZoom');
    }
    
    function lazyInit() {
        if (isInitialized) return;
        MarqueeModule.init();
        isInitialized = true;
    }
    
    function checkZoomAndShow() {
        var mapModule = App.getModule('map');
        if (mapModule && typeof mapModule.getZoom === 'function') {
            var zoom = mapModule.getZoom();
            if (zoom > getMinZoom()) {
                MarqueeModule.show();
            } else {
                MarqueeModule.hide();
            }
        }
    }
    
    // Listen for posts being loaded/filtered
    if (window.App && App.on) {
        App.on('filter:applied', function(data) {
            if (data && Array.isArray(data.marqueePosts) && data.marqueePosts.length > 0) {
                lazyInit();
                checkZoomAndShow();
            }
        });
        
        // Listen for zoom changes to show/hide based on zoom level
        App.on('map:boundsChanged', function(data) {
            if (!isInitialized) return;
            if (data && data.zoom !== undefined) {
                if (data.zoom > getMinZoom()) {
                    MarqueeModule.show();
                } else {
                    MarqueeModule.hide();
                }
            }
        });
    }
})();
