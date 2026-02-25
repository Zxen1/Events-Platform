<?php
/**
 * index.php - Main entry point with Open Graph meta tags for social sharing
 * 
 * When a shared link like ?post=123 is visited, this fetches the post data
 * and injects proper OG tags so link previews show the post's image and title.
 * 
 * Fallback values come from admin_settings (website_name, website_tagline, big_logo).
 */

// Default fallbacks (will be overwritten by admin settings)
$siteName = 'FunMap';
$siteTagline = '';
$siteDescription = '';
$siteDefaultImage = '';
$folderSiteImages = '';

$ogTitle = '';
$ogDescription = '';
$ogImage = '';
$ogUrl = 'https://funmap.com';

// Check if this is a post link
// Supports both ?post=123 and /post/123-slug URL formats
$postId = 0;

// First check query string: ?post=123 or ?post=123-slug
if (isset($_GET['post'])) {
    $postId = (int)$_GET['post'];
}

// Also check URL path: /post/123-slug
if ($postId === 0 && isset($_SERVER['REQUEST_URI'])) {
    $uri = $_SERVER['REQUEST_URI'];
    // Match /post/123 or /post/123-anything
    if (preg_match('#/post/(\d+)#', $uri, $matches)) {
        $postId = (int)$matches[1];
    }
}

try {
    // Find database config (matches connector paths)
    $configCandidates = [
        '/home/funmapco/config/config-db.php',              // Production absolute path
        __DIR__ . '/home/funmapco/config/config-db.php',    // Development
        __DIR__ . '/../config/config-db.php',               // Production: public_html/../config/
        dirname(__DIR__) . '/config/config-db.php',         // Same as above
    ];
    
    $configPath = null;
    foreach ($configCandidates as $candidate) {
        if (is_file($candidate)) {
            $configPath = $candidate;
            break;
        }
    }
    
    if ($configPath) {
        require_once $configPath;
        
        // Config creates $mysqli connection
        if (isset($mysqli) && $mysqli instanceof mysqli) {
            // First, get site-wide settings for fallbacks
            $settingsResult = $mysqli->query("
                SELECT setting_key, setting_value 
                FROM admin_settings 
                WHERE setting_key IN ('website_name', 'website_tagline', 'website_description', 'big_logo', 'og_default_image', 'folder_site_images')
            ");
            $bigLogoFilename = '';
            while ($settingsResult && $row = $settingsResult->fetch_assoc()) {
                switch ($row['setting_key']) {
                    case 'website_name':
                        $siteName = $row['setting_value'];
                        break;
                    case 'website_tagline':
                        $siteTagline = $row['setting_value'];
                        break;
                    case 'website_description':
                        $siteDescription = $row['setting_value'];
                        break;
                    case 'folder_site_images':
                        $folderSiteImages = rtrim($row['setting_value'], '/');
                        break;
                    case 'og_default_image':
                        // Dedicated OG image takes priority (should be full URL)
                        if (!empty($row['setting_value'])) {
                            $siteDefaultImage = $row['setting_value'];
                        }
                        break;
                    case 'big_logo':
                        // Store for later - need folder path to construct full URL
                        $bigLogoFilename = $row['setting_value'];
                        break;
                }
            }
            
            // Construct full URL for big_logo if no dedicated OG image
            if (empty($siteDefaultImage) && !empty($bigLogoFilename)) {
                // Check if it's already a full URL
                if (preg_match('/^https?:\/\//i', $bigLogoFilename)) {
                    $siteDefaultImage = $bigLogoFilename;
                } elseif (!empty($folderSiteImages)) {
                    $siteDefaultImage = $folderSiteImages . '/' . $bigLogoFilename;
                }
            }
            
            // Set defaults from admin settings
            $ogTitle = htmlspecialchars($siteName, ENT_QUOTES, 'UTF-8');
            if (!empty($siteTagline)) {
                $ogTitle .= ' - ' . htmlspecialchars($siteTagline, ENT_QUOTES, 'UTF-8');
            }
            // Use website_description for OG description, fall back to tagline
            if (!empty($siteDescription)) {
                $ogDescription = htmlspecialchars($siteDescription, ENT_QUOTES, 'UTF-8');
            } elseif (!empty($siteTagline)) {
                $ogDescription = htmlspecialchars($siteTagline, ENT_QUOTES, 'UTF-8');
            }
            $ogImage = $siteDefaultImage;
            
            // If this is a post link, get post-specific data
            if ($postId > 0) {
                $stmt = $mysqli->prepare('
                    SELECT p.post_key, pmc.title, pmc.description, pmc.media_ids
                    FROM post_map_cards pmc
                    JOIN posts p ON p.id = pmc.post_id
                    WHERE p.id = ? AND p.deleted_at IS NULL AND p.visibility = "active"
                    LIMIT 1
                ');
                $stmt->bind_param('i', $postId);
                $stmt->execute();
                $postResult = $stmt->get_result();
                $post = $postResult ? $postResult->fetch_assoc() : null;
                
                if ($post) {
                    // Set title and description from post
                    $ogTitle = htmlspecialchars($post['title'], ENT_QUOTES, 'UTF-8') . ' - ' . htmlspecialchars($siteName, ENT_QUOTES, 'UTF-8');
                    if (!empty($post['description'])) {
                        $desc = strip_tags($post['description']);
                        $ogDescription = htmlspecialchars(mb_substr($desc, 0, 200), ENT_QUOTES, 'UTF-8');
                    }
                    // Use pretty URL format with post_key
                    $postKey = !empty($post['post_key']) ? $post['post_key'] : $postId;
                    $ogUrl = 'https://funmap.com/post/' . $postKey;
                    
                    // Get first image from media_ids
                    if (!empty($post['media_ids'])) {
                        $mediaIds = explode(',', $post['media_ids']);
                        $firstMediaId = (int)trim($mediaIds[0]);
                        
                        if ($firstMediaId > 0) {
                            $mediaStmt = $mysqli->prepare('
                                SELECT file_url FROM post_media 
                                WHERE id = ? AND deleted_at IS NULL 
                                LIMIT 1
                            ');
                            $mediaStmt->bind_param('i', $firstMediaId);
                            $mediaStmt->execute();
                            $mediaResult = $mediaStmt->get_result();
                            $media = $mediaResult ? $mediaResult->fetch_assoc() : null;
                            
                            if ($media && !empty($media['file_url'])) {
                                $ogImage = $media['file_url'];
                            }
                        }
                    }
                }
            }
        }
    }
} catch (Exception $e) {
    // Silently fail - use whatever defaults we have
}

// Final fallback if nothing was set
if (empty($ogTitle)) {
    $ogTitle = 'FunMap';
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
  <meta name="theme-color" content="#000000">
  
  <!-- PWA: iOS standalone mode -->
  <meta name="apple-mobile-web-app-capable" content="yes">
  <!-- PWA: Standard (non-iOS) standalone mode -->
  <meta name="mobile-web-app-capable" content="yes">
  <!-- PWA: Status bar style - "default" keeps status bar separate (no content behind it) -->
  <!-- "black-translucent" would extend content behind status bar but requires CSS adjustments -->
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  
  <title><?php echo $ogTitle ?: htmlspecialchars($siteName, ENT_QUOTES, 'UTF-8'); ?></title>
  
  <!-- Meta description (for Google search results) -->
  <meta name="description" content="<?php echo $ogDescription; ?>">
  
  <!-- Open Graph Meta Tags (for social sharing) -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="<?php echo $ogTitle; ?>">
  <meta property="og:description" content="<?php echo $ogDescription; ?>">
  <meta property="og:image" content="<?php echo $ogImage; ?>">
  <meta property="og:url" content="<?php echo $ogUrl; ?>">
  <meta property="og:site_name" content="FunMap">
  
  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="<?php echo $ogTitle; ?>">
  <meta name="twitter:description" content="<?php echo $ogDescription; ?>">
  <meta name="twitter:image" content="<?php echo $ogImage; ?>">
  
  <!-- Favicons -->
  <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="shortcut icon" href="/favicon.ico" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <meta name="apple-mobile-web-app-title" content="FunMap" />
  <link rel="manifest" href="/site.webmanifest" />
  
  <!-- Google Analytics 4 -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-K1FG6B44LF"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-K1FG6B44LF');
  </script>
  
  <!-- Preload critical resources (browser starts downloading immediately) -->
  <link rel="preload" href="/gateway.php?action=get-admin-settings&lite=1" as="fetch" crossorigin>
  <link rel="preload" href="https://api.mapbox.com/mapbox-gl-js/v3.17.0/mapbox-gl.js" as="script">
  <link rel="preload" href="https://api.mapbox.com/mapbox-gl-js/v3.17.0/mapbox-gl.css" as="style">
  <script>
    // Start settings fetch immediately - will be ready by map init
    window.__settingsPromise = fetch('/gateway.php?action=get-admin-settings&lite=1')
      .then(function(r) { return r.json(); })
      .catch(function() { return null; });
  </script>
  
  <!-- External APIs -->
  <!-- Console filter - always load (tiny file), checks localStorage internally -->
  <script src="console-filter.js"></script>
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.17.0/mapbox-gl.css" rel="stylesheet">
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.17.0/mapbox-gl.js"></script>
  <script src="https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.3/mapbox-gl-geocoder.min.js"></script>
  <link rel="stylesheet" href="https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.3/mapbox-gl-geocoder.css">
  <script async src="https://maps.googleapis.com/maps/api/js?key=AIzaSyATJV1D6MtAUsQ58fSEHcSD8QmznJXAPqY&libraries=places&loading=async"></script>
  
  <!-- CSS Files (10 total) -->
  <link rel="stylesheet" href="base.css?v=20251228i">
  <link rel="stylesheet" href="header.css?v=20251228i">
<link rel="stylesheet" href="filter.css?v=20251228i">
<link rel="stylesheet" href="map.css?v=20251228i">
  <link rel="stylesheet" href="post.css?v=20260226a">
  <link rel="stylesheet" href="components.css?v=20251228i">
  <link rel="stylesheet" href="fieldsets.css?v=20251228i">
  <link rel="stylesheet" href="admin.css?v=20251228i">
  <link rel="stylesheet" href="formbuilder.css?v=20251228i">
  <link rel="stylesheet" href="member.css?v=20251228i">
  <link rel="stylesheet" href="posteditor.css?v=20251228i">
  <link rel="stylesheet" href="marquee.css?v=20260226a">
</head>
<body>

  <!-- ========================================================================
       SECTION 1: HEADER
       File: header.js, header.css
       ======================================================================== -->
  <header class="header-bar">
    
    <!-- Logo button (image loaded from admin settings) -->
    <button class="header-logo-button" type="button" aria-label="Home">
      <span class="header-logo-button-image" aria-hidden="true"></span>
    </button>
    
    <!-- Filter button -->
    <button class="header-filter button-class-1" type="button" aria-label="Toggle filters" aria-expanded="false" aria-controls="filter-panel">
      <span class="button-class-1-icon header-filter-button-icon"></span>
    </button>
    
    <!-- Mode switch (Recent / Posts / Map) -->
    <nav class="header-modeswitch" aria-label="View mode">
      <button class="header-modeswitch-recent button-class-1" type="button" data-mode="recent">
        <span class="button-class-1-icon header-modeswitch-button-icon header-modeswitch-button-icon--recent" aria-hidden="true"></span>
        <span class="header-modeswitch-button-text">Recent</span>
      </button>
      <button class="header-modeswitch-posts button-class-1" type="button" data-mode="posts">
        <span class="button-class-1-icon header-modeswitch-button-icon header-modeswitch-button-icon--posts" aria-hidden="true"></span>
        <span class="header-modeswitch-button-text">Posts</span>
      </button>
      <button class="header-modeswitch-map button-class-1" type="button" data-mode="map" aria-pressed="true">
        <span class="button-class-1-icon header-modeswitch-button-icon header-modeswitch-button-icon--map" aria-hidden="true"></span>
        <span class="header-modeswitch-button-text">Map</span>
      </button>
    </nav>

    <!-- Map controls slot (wide screens only; populated by moving .map-controls here) -->
    <div class="header-map-controls" id="header-map-controls" aria-label="Map controls"></div>
    
    <!-- Access buttons (Member / Admin / Fullscreen) -->
    <button class="header-access-member button-class-1" type="button" data-panel="member" title="Members" aria-label="Member" aria-expanded="false" aria-controls="member-panel">
      <span class="button-class-1-icon header-access-button-icon header-access-button-icon--member"></span>
      <img class="header-access-button-avatar header-access-button-avatar--hidden" alt="">
    </button>
    <button class="header-access-admin button-class-1 header-access-button--hidden" type="button" data-panel="admin" title="Admin" aria-label="Admin" aria-expanded="false" aria-controls="admin-panel" aria-hidden="true">
      <span class="button-class-1-icon header-access-button-icon header-access-button-icon--admin"></span>
    </button>
    <button class="header-access-fullscreen button-class-1 fullscreen-btn" type="button" data-action="fullscreen" title="Fullscreen" aria-label="Toggle fullscreen">
      <span class="button-class-1-icon header-access-button-icon header-access-button-icon--fullscreen"></span>
    </button>
    
  </header>

  <!-- ========================================================================
       SECTION 2: FILTER PANEL
       File: filter.js, filter.css
       ======================================================================== -->
  <aside class="filter-panel" role="dialog" aria-hidden="true">
    <div class="filter-panel-backdrop"></div>
    <div class="filter-panel-content" data-side="left">
      <div class="filter-panel-header">
        <div class="filter-panel-header-top">
          <h2 class="filter-panel-header-title">Filters</h2>
          <div class="filter-panel-actions">
            <button type="button" class="filter-panel-actions-icon-btn filter-panel-actions-icon-btn--close" title="Close Panel" aria-label="Close Panel">
              <span class="filter-panel-actions-icon-btn-icon filter-panel-actions-icon-btn-icon--close" aria-hidden="true"></span>
            </button>
          </div>
        </div>
        <div class="filter-panel-summary"></div>
      </div>
      <div class="filter-panel-body">
        <div class="filter-map-controls"></div>
        <div class="filter-reset-box">
          <button class="filter-reset-btn" type="button" data-reset="filters" disabled>Reset All Filters</button>
        </div>
        <div class="filter-reset-box">
          <button class="filter-reset-btn" type="button" data-reset="categories" disabled>Reset All Categories</button>
        </div>
        <button class="filter-favourites-btn" type="button" aria-pressed="false">
          <span class="filter-favourites-icon" aria-hidden="true"></span>
          <span>Favourites on top</span>
        </button>
        <div class="filter-sort-menu menu-class-1">
          <div class="filter-sort-menu-button menu-button">
            <span class="filter-sort-menu-button-text menu-text">Sort by Recommended</span>
            <span class="filter-sort-geolocate-icon filter-sort-geolocate-icon--button" aria-hidden="true"></span>
            <span class="filter-sort-menu-button-arrow menu-arrow"></span>
          </div>
          <div class="filter-sort-menu-options menu-options">
            <div class="filter-sort-menu-option menu-option" data-sort="recommended">Sort by Recommended</div>
            <div class="filter-sort-menu-option menu-option" data-sort="az">Sort by Title A-Z</div>
            <div class="filter-sort-menu-option menu-option" data-sort="nearest">Sort by Distance<span class="filter-sort-geolocate-icon" aria-hidden="true"></span></div>
            <div class="filter-sort-menu-option menu-option" data-sort="soon">Sort by Soonest</div>
          </div>
        </div>
        
        <!-- Filter Basics Container -->
        <section class="filter-basics-container" aria-label="Filters">
          <div class="filter-keyword-row">
            <div class="filter-keyword-input-wrap">
              <input class="filter-keyword-input input-class-1" type="text" placeholder="Keywords" aria-label="Keywords">
              <button class="clear-button filter-keyword-clear" type="button" aria-label="Clear keywords"></button>
            </div>
          </div>
          <div class="filter-price-row">
            <div class="filter-price-input-wrap">
              <input class="filter-price-input filter-price-min input-class-1" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="Min price" aria-label="Minimum price">
              <span class="filter-price-separator" aria-hidden="true">-</span>
              <input class="filter-price-input filter-price-max input-class-1" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="Max price" aria-label="Maximum price">
              <button class="clear-button filter-price-clear" type="button" aria-label="Clear price range"></button>
            </div>
          </div>
          <div class="filter-daterange-row">
            <div class="filter-daterange-input-wrap">
              <input class="filter-daterange-input input-class-1" type="text" placeholder="Date Range" aria-label="Date range" readonly aria-haspopup="dialog" aria-expanded="false">
              <button class="clear-button filter-daterange-clear" type="button" aria-label="Clear date"></button>
            </div>
          </div>
          <input class="filter-expired-input" type="checkbox" style="display:none">
          <div class="filter-calendar-container" aria-hidden="true">
            <div class="filter-calendar"></div>
          </div>
        </section>
        
        <!-- Category Filter Container -->
        <section class="filter-categoryfilter-container" aria-label="Categories">
          <!-- Populated by JavaScript from database -->
        </section>

        <div class="bottomSlack" aria-hidden="true"></div>
        
      </div>
    </div>
  </aside>

  <!-- ========================================================================
       SECTION 3: MAP
       File: map.js, map.css
       ======================================================================== -->
  <main class="map-area">
    
    <!-- Map controls (geocoder, geolocate, compass) -->
    <div class="map-controls"></div>
    
    <!-- Zoom indicator -->
    <div class="map-zoom-indicator">Zoom -- • Pitch --</div>
    
    <!-- Mapbox map renders here -->
    <div class="map-container"></div>
    
    
  </main>

  <!-- ========================================================================
      SECTION 4: POST PANELS (includes Recent)
       File: post.js, post.css
       ======================================================================== -->
  <div class="post-mode-panels">
    <!-- Post panel and recent panel go here -->
  </div>

  <!-- ========================================================================
       SECTION 5: ADMIN PANEL
       File: admin.js, admin.css
       ======================================================================== -->
  <aside id="admin-panel" class="admin-panel" role="dialog" aria-hidden="true">
    <div class="admin-panel-contents admin-panel-contents--side-right admin-panel-contents--hidden">
      
      <!-- Panel Header -->
      <div class="admin-panel-header">
        <div class="admin-panel-header-top">
          <h2 class="admin-panel-header-title">Admin</h2>
          <div class="admin-panel-actions">
            <label class="admin-autosave-toggle" title="Auto-save changes">
              <input type="checkbox" id="admin-autosave-checkbox" class="admin-autosave-toggle-input">
              <span class="admin-autosave-toggle-label">Auto</span>
            </label>
            <button type="button" class="admin-panel-actions-icon-btn admin-panel-actions-icon-btn--save admin-panel-actions-icon-btn--disabled" title="Save Changes" aria-label="Save Changes" disabled>
              <span class="admin-panel-actions-icon-btn-icon admin-panel-actions-icon-btn-icon--save admin-panel-actions-icon-btn-icon--disabled" aria-hidden="true"></span>
            </button>
            <button type="button" class="admin-panel-actions-icon-btn admin-panel-actions-icon-btn--discard admin-panel-actions-icon-btn--disabled" title="Discard Changes" aria-label="Discard Changes" disabled>
              <span class="admin-panel-actions-icon-btn-icon admin-panel-actions-icon-btn-icon--discard admin-panel-actions-icon-btn-icon--disabled" aria-hidden="true"></span>
            </button>
            <button type="button" class="admin-panel-actions-icon-btn admin-panel-actions-icon-btn--close" title="Close Panel" aria-label="Close Panel">
              <span class="admin-panel-actions-icon-btn-icon admin-panel-actions-icon-btn-icon--close" aria-hidden="true"></span>
            </button>
          </div>
        </div>
        
        <!-- Tab Bar -->
        <div class="admin-tab-bar" role="tablist" aria-label="Admin sections">
          <button type="button" id="admin-tab-settings-btn" class="admin-tab-settings button-class-2" data-tab="settings" role="tab" aria-selected="true" aria-controls="admin-tab-settings">Settings</button>
          <button type="button" id="admin-tab-forms-btn" class="admin-tab-forms button-class-2" data-tab="forms" role="tab" aria-selected="false" aria-controls="admin-tab-forms">Forms</button>
          <button type="button" id="admin-tab-map-btn" class="admin-tab-map button-class-2" data-tab="map" role="tab" aria-selected="false" aria-controls="admin-tab-map">Map</button>
          <button type="button" id="admin-tab-messages-btn" class="admin-tab-messages button-class-2" data-tab="messages" role="tab" aria-selected="false" aria-controls="admin-tab-messages">Messages</button>
          <button type="button" id="admin-tab-checkout-btn" class="admin-tab-checkout button-class-2" data-tab="checkout" role="tab" aria-selected="false" aria-controls="admin-tab-checkout">Checkout</button>
          <button type="button" id="admin-tab-moderation-btn" class="admin-tab-moderation button-class-2" data-tab="moderation" role="tab" aria-selected="false" aria-controls="admin-tab-moderation">Moderation</button>
          <button type="button" id="admin-tab-sitemap-btn" class="admin-tab-sitemap button-class-2" data-tab="sitemap" role="tab" aria-selected="false" aria-controls="admin-tab-sitemap">Sitemap</button>
        </div>
      </div>
      
      <!-- Panel Body -->
      <div class="admin-panel-body">
        
        <!-- Settings Tab -->
        <section id="admin-tab-settings" class="admin-tab-contents admin-tab-contents--active" role="tabpanel" aria-labelledby="admin-tab-settings-btn">
          <form id="adminSettingsForm" style="display: contents;" onsubmit="return false;">
          <div class="admin-settings-general-container">
            <div class="admin-settings-field">
              <label class="admin-settings-field-label" for="adminWebsiteName">Website Name</label>
              <input type="text" class="admin-settings-field-input" id="adminWebsiteName" data-setting-key="website_name" autocomplete="off" placeholder="Enter website name" />
            </div>
            <div class="admin-settings-field">
              <label class="admin-settings-field-label" for="adminWebsiteTagline">Website Tagline</label>
              <input type="text" class="admin-settings-field-input" id="adminWebsiteTagline" data-setting-key="website_tagline" autocomplete="off" placeholder="Enter website tagline" />
            </div>
            <div class="admin-settings-field">
              <label class="admin-settings-field-label" for="adminWebsiteDescription">Website Description</label>
              <textarea class="admin-settings-field-textarea" id="adminWebsiteDescription" data-setting-key="website_description" rows="4" placeholder="Enter website description for social sharing"></textarea>
            </div>
            <div class="admin-settings-field">
              <label class="admin-settings-field-label" for="adminContactEmail">Contact Email</label>
              <input type="email" class="admin-settings-field-input" id="adminContactEmail" data-setting-key="contact_email" autocomplete="off" data-lpignore="true" data-form-type="other" placeholder="contact@example.com" />
            </div>
            <div class="admin-settings-field">
              <label class="admin-settings-field-label" for="adminSupportEmail">Support Email</label>
              <input type="email" class="admin-settings-field-input" id="adminSupportEmail" data-setting-key="support_email" autocomplete="off" data-lpignore="true" data-form-type="other" placeholder="support@example.com" />
            </div>
            <div class="admin-settings-field admin-settings-field--toggle row-class-1">
              <span class="admin-settings-field-label admin-settings-field-label--toggle">Welcome Message on Load</span>
              <label class="component-switch">
                <input type="checkbox" class="component-switch-input" id="adminWelcomeEnabled" data-setting-key="welcome_enabled" />
                <span class="component-switch-slider"></span>
              </label>
            </div>
            <div id="adminWelcomeLoadType" class="admin-settings-welcome-type-toggles row-class-1">
              <label class="admin-settings-welcome-type-option">
                <input type="radio" name="adminWelcomeLoadType" value="everyone" class="admin-settings-welcome-type-option-input" />
                <span class="admin-settings-welcome-type-option-label">Everyone</span>
              </label>
              <label class="admin-settings-welcome-type-option">
                <input type="radio" name="adminWelcomeLoadType" value="new_users" class="admin-settings-welcome-type-option-input" />
                <span class="admin-settings-welcome-type-option-label">New Users</span>
              </label>
            </div>
            <div class="admin-settings-field">
              <label class="admin-settings-field-label" for="adminWelcomeTitle">Welcome Title</label>
              <input type="text" class="admin-settings-field-input" id="adminWelcomeTitle" data-setting-key="welcome_title" autocomplete="off" placeholder="Enter welcome title" />
            </div>
            <div class="admin-settings-field">
              <label class="admin-settings-field-label" for="adminWelcomeMessage">Welcome Message</label>
              <textarea class="admin-settings-field-textarea" id="adminWelcomeMessage" data-setting-key="welcome_message" rows="4" placeholder="Enter welcome message (HTML supported)"></textarea>
            </div>
            <div class="admin-settings-field admin-settings-field--imagepicker">
              <label class="admin-settings-field-label">Big Logo</label>
              <div id="adminBigLogoPicker" data-setting-key="big_logo"></div>
            </div>
            <div class="admin-settings-field admin-settings-field--imagepicker">
              <label class="admin-settings-field-label">Small Logo</label>
              <div id="adminSmallLogoPicker" data-setting-key="small_logo"></div>
            </div>
            <div class="admin-settings-field admin-settings-field--imagepicker">
              <label class="admin-settings-field-label">Favicon</label>
              <div id="adminFaviconPicker" data-setting-key="favicon"></div>
            </div>
            <div class="admin-settings-field">
              <label class="admin-settings-field-label">Website Currency</label>
              <div id="adminCurrencyPicker" data-setting-key="website_currency"></div>
            </div>
            <div class="admin-settings-field">
              <span class="admin-settings-field-label admin-settings-field-label--has-tooltip"><span class="admin-settings-field-label-text">Resize Anti-Jitter</span><span class="admin-tooltip"><svg class="admin-tooltip-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M8 7v4M8 4.5v.5" stroke-linecap="round"/></svg></span><div class="admin-tooltip-text admin-settings-antijitter-tooltip"></div></span>
              <div id="adminAntijitter" class="admin-settings-antijitter-buttons toggle-class-1">
                <button type="button" class="admin-settings-antijitter-button toggle-button" data-value="off" aria-pressed="true">Off</button>
                <button type="button" class="admin-settings-antijitter-button toggle-button" data-value="blur" aria-pressed="false">Blur</button>
                <button type="button" class="admin-settings-antijitter-button toggle-button" data-value="teleport" aria-pressed="false">Teleport</button>
                <button type="button" class="admin-settings-antijitter-button toggle-button" data-value="smoothing" aria-pressed="false">Smoothing</button>
              </div>
            </div>
            <div class="admin-settings-field admin-settings-field--toggle row-class-1">
              <span class="admin-settings-field-label admin-settings-field-label--toggle">Maintenance Mode</span>
              <label class="component-switch">
                <input type="checkbox" class="component-switch-input" id="adminMaintenanceMode" data-setting-key="maintenance_mode" />
                <span class="component-switch-slider"></span>
              </label>
            </div>
            <div class="admin-settings-field admin-settings-field--toggle row-class-1">
              <span class="admin-settings-field-label admin-settings-field-label--toggle">Devtools Console Filter</span>
              <label class="component-switch">
                <input type="checkbox" class="component-switch-input" id="adminEnableConsoleFilter" data-setting-key="console_filter" />
                <span class="component-switch-slider"></span>
              </label>
            </div>
          </div>
          
          <!-- Countdown Container -->
          <div class="admin-settings-countdown-container">
            <div class="admin-settings-field admin-settings-field--toggle row-class-1">
              <span class="admin-settings-field-label admin-settings-field-label--toggle admin-settings-field-label--has-tooltip"><span class="admin-settings-field-label-text">Countdown in Posts</span><span class="admin-tooltip"><svg class="admin-tooltip-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M8 7v4M8 4.5v.5" stroke-linecap="round"/></svg></span><div class="admin-tooltip-text admin-countdown-tooltip"></div></span>
              <label class="component-switch">
                <input type="checkbox" class="component-switch-input" id="adminCountdownPosts" data-setting-key="countdown_posts" />
                <span class="component-switch-slider"></span>
              </label>
            </div>
            <div class="admin-settings-field admin-settings-field--toggle row-class-1">
              <span class="admin-settings-field-label admin-settings-field-label--toggle admin-settings-field-label--has-tooltip"><span class="admin-settings-field-label-text">Countdown on Postcards</span><span class="admin-tooltip"><svg class="admin-tooltip-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M8 7v4M8 4.5v.5" stroke-linecap="round"/></svg></span><div class="admin-tooltip-text admin-countdown-tooltip"></div></span>
              <label class="component-switch">
                <input type="checkbox" class="component-switch-input" id="adminCountdownPostcards" data-setting-key="countdown_postcards" />
                <span class="component-switch-slider"></span>
              </label>
            </div>
            <div id="adminCountdownPostcardsMode" class="admin-settings-countdown-mode-toggles row-class-1">
              <label class="admin-settings-countdown-mode-option">
                <input type="radio" name="adminCountdownPostcardsMode" value="all" class="admin-settings-countdown-mode-option-input" />
                <span class="admin-settings-countdown-mode-option-label">All Postcards</span>
              </label>
              <label class="admin-settings-countdown-mode-option">
                <input type="radio" name="adminCountdownPostcardsMode" value="soonest_only" class="admin-settings-countdown-mode-option-input" />
                <span class="admin-settings-countdown-mode-option-label">Soonest Only</span>
              </label>
            </div>
          </div>
          
          <div class="admin-settings-imagemanager-accordion accordion-class-1">
            <div class="admin-settings-imagemanager-accordion-header accordion-header">
              <span class="admin-settings-imagemanager-accordion-header-text">Image Files</span>
              <span class="admin-settings-imagemanager-accordion-header-arrow"></span>
            </div>
            <div class="admin-settings-imagemanager-accordion-body accordion-body">
              <div class="admin-settings-folders-container">
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Header Icon: Filter</label>
                  <div id="adminIconFilterPicker" data-setting-key="icon_filter"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Header Icon: Recent</label>
                  <div id="adminIconRecentPicker" data-setting-key="icon_recent"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Header Icon: Posts</label>
                  <div id="adminIconPostsPicker" data-setting-key="icon_posts"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Header Icon: Map</label>
                  <div id="adminIconMapPicker" data-setting-key="icon_map"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Header Icon: Member</label>
                  <div id="adminIconMemberPicker" data-setting-key="icon_member"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Header Icon: Admin</label>
                  <div id="adminIconAdminPicker" data-setting-key="icon_admin"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Header Icon: Fullscreen</label>
                  <div id="adminIconFullscreenPicker" data-setting-key="icon_fullscreen"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Header Icon: Fullscreen Exit</label>
                  <div id="adminIconFullscreenExitPicker" data-setting-key="icon_fullscreen_exit"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Map Control Icon: Geolocate</label>
                  <div id="adminIconGeolocatePicker" data-setting-key="icon_geolocate"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Map Control Icon: Compass</label>
                  <div id="adminIconCompassPicker" data-setting-key="icon_compass"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Map Lighting Icon: Sunrise</label>
                  <div id="adminIconLightingDawnPicker" data-setting-key="icon_lighting_dawn"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Map Lighting Icon: Day</label>
                  <div id="adminIconLightingDayPicker" data-setting-key="icon_lighting_day"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Map Lighting Icon: Sunset</label>
                  <div id="adminIconLightingDuskPicker" data-setting-key="icon_lighting_dusk"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Map Lighting Icon: Night</label>
                  <div id="adminIconLightingNightPicker" data-setting-key="icon_lighting_night"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Panel Icon: Save</label>
                  <div id="adminIconSavePicker" data-setting-key="icon_save"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Panel Icon: Discard</label>
                  <div id="adminIconDiscardPicker" data-setting-key="icon_discard"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Panel Icon: Close</label>
                  <div id="adminIconClosePicker" data-setting-key="icon_close"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Icon: Clear (X)</label>
                  <div id="adminIconClearPicker" data-setting-key="icon_clear"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Icon: Add Image</label>
                  <div id="adminIconAddImagePicker" data-setting-key="icon_add_image"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Icon: Ticket</label>
                  <div id="adminIconTicketPicker" data-setting-key="icon_ticket"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Icon: Favourites (star)</label>
                  <div id="adminIconFavouritesPicker" data-setting-key="icon_favourites"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Icon: Plus (+)</label>
                  <div id="adminIconPlusPicker" data-setting-key="icon_plus"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Icon: Minus (-)</label>
                  <div id="adminIconMinusPicker" data-setting-key="icon_minus"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Icon: Checkmark</label>
                  <div id="adminIconCheckmarkPicker" data-setting-key="icon_checkmark"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Icon: Checkbox</label>
                  <div id="adminIconCheckboxPicker" data-setting-key="icon_checkbox"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Icon: Radio</label>
                  <div id="adminIconRadioPicker" data-setting-key="icon_radio"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Icon: Radio Selected</label>
                  <div id="adminIconRadioSelectedPicker" data-setting-key="icon_radio_selected"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Icon: Arrow Down</label>
                  <div id="adminIconArrowDownPicker" data-setting-key="icon_arrow_down"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Icon: Edit</label>
                  <div id="adminIconEditPicker" data-setting-key="icon_edit"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Icon: Info</label>
                  <div id="adminIconInfoPicker" data-setting-key="icon_info"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Icon: Share</label>
                  <div id="adminIconSharePicker" data-setting-key="icon_share"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Icon: Drag Handle</label>
                  <div id="adminIconDragHandlePicker" data-setting-key="icon_drag_handle"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Icon: More Dots</label>
                  <div id="adminIconMoreDotsPicker" data-setting-key="icon_more_dots"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Icon: Search</label>
                  <div id="adminIconSearchPicker" data-setting-key="icon_search"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Icon: Reactivate</label>
                  <div id="adminIconReactivatePicker" data-setting-key="icon_reactivate"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Icon: Trash</label>
                  <div id="adminIconTrashPicker" data-setting-key="icon_trash"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Icon: Flag</label>
                  <div id="adminIconFlagPicker" data-setting-key="icon_flag"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Icon: Tick</label>
                  <div id="adminIconTickPicker" data-setting-key="icon_tick"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Icon: Hide</label>
                  <div id="adminIconHidePicker" data-setting-key="icon_hide"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Icon: Show</label>
                  <div id="adminIconShowPicker" data-setting-key="icon_show"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Post Empty Image</label>
                  <div id="adminPostPanelEmptyImagePicker" data-setting-key="post_panel_empty_image"></div>
                </div>
                <div class="admin-settings-field admin-settings-field--imagepicker">
                  <label class="admin-settings-field-label">Recent Bottom Image</label>
                  <div id="adminRecentPanelEmptyImagePicker" data-setting-key="recent_panel_footer_image"></div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="admin-settings-imagemanager-accordion accordion-class-1">
            <div class="admin-settings-imagemanager-accordion-header accordion-header">
              <span class="admin-settings-imagemanager-accordion-header-text">Image Folders</span>
              <span class="admin-settings-imagemanager-accordion-header-arrow"></span>
            </div>
            <div class="admin-settings-imagemanager-accordion-body accordion-body">
              <div class="admin-settings-folders-container">
                <div class="admin-settings-field">
                  <label class="admin-settings-field-label" for="adminFolderAgeRatings">Age Ratings Folder</label>
                  <input type="text" class="admin-settings-field-input" id="adminFolderAgeRatings" data-setting-key="folder_age_ratings" autocomplete="off" placeholder="age-ratings/" />
                </div>
                <div class="admin-settings-field">
                  <label class="admin-settings-field-label" for="adminFolderAmenities">Amenities Folder</label>
                  <input type="text" class="admin-settings-field-input" id="adminFolderAmenities" data-setting-key="folder_amenities" autocomplete="off" placeholder="amenities/" />
                </div>
                <div class="admin-settings-field">
                  <label class="admin-settings-field-label" for="adminFolderAvatars">Avatars Folder</label>
                  <input type="text" class="admin-settings-field-input" id="adminFolderAvatars" data-setting-key="folder_avatars" autocomplete="off" placeholder="avatars/" />
                </div>
                <div class="admin-settings-field">
                  <label class="admin-settings-field-label" for="adminFolderCategoryIcons">Category Icons Folder</label>
                  <input type="text" class="admin-settings-field-input" id="adminFolderCategoryIcons" data-setting-key="folder_category_icons" autocomplete="off" placeholder="category-icons/" />
                </div>
                <div class="admin-settings-field">
                  <label class="admin-settings-field-label" for="adminFolderCountries">Countries Folder</label>
                  <input type="text" class="admin-settings-field-input" id="adminFolderCountries" data-setting-key="folder_countries" autocomplete="off" placeholder="flags/" />
                </div>
                <div class="admin-settings-field">
                  <label class="admin-settings-field-label" for="adminFolderCurrencies">Currencies Folder</label>
                  <input type="text" class="admin-settings-field-input" id="adminFolderCurrencies" data-setting-key="folder_currencies" autocomplete="off" placeholder="currencies/" />
                </div>
                <div class="admin-settings-field">
                  <label class="admin-settings-field-label" for="adminFolderDummyImages">Dummy Images Folder</label>
                  <input type="text" class="admin-settings-field-input" id="adminFolderDummyImages" data-setting-key="folder_dummy_images" autocomplete="off" placeholder="dummy-images/" />
                </div>
                <div class="admin-settings-field">
                  <label class="admin-settings-field-label" for="adminFolderFieldsetIcons">Fieldset Icons Folder</label>
                  <input type="text" class="admin-settings-field-input" id="adminFolderFieldsetIcons" data-setting-key="folder_fieldset_icons" autocomplete="off" placeholder="system-images/" />
                </div>
                <div class="admin-settings-field">
                  <label class="admin-settings-field-label" for="adminFolderLinks">Links Folder</label>
                  <input type="text" class="admin-settings-field-input" id="adminFolderLinks" data-setting-key="folder_links" autocomplete="off" placeholder="Links/" />
                </div>
                <div class="admin-settings-field">
                  <label class="admin-settings-field-label" for="adminFolderMapImages">Map Images Folder</label>
                  <input type="text" class="admin-settings-field-input" id="adminFolderMapImages" data-setting-key="folder_map_images" autocomplete="off" placeholder="map-images/" />
                </div>
                <div class="admin-settings-field">
                  <label class="admin-settings-field-label" for="adminFolderPhonePrefixes">Phone Prefixes Folder</label>
                  <input type="text" class="admin-settings-field-input" id="adminFolderPhonePrefixes" data-setting-key="folder_phone_prefixes" autocomplete="off" placeholder="phone-prefixes/" />
                </div>
                <div class="admin-settings-field">
                  <label class="admin-settings-field-label" for="adminFolderPostImages">Post Images Folder</label>
                  <input type="text" class="admin-settings-field-input" id="adminFolderPostImages" data-setting-key="folder_post_images" autocomplete="off" placeholder="post-images/" />
                </div>
                <div class="admin-settings-field">
                  <label class="admin-settings-field-label" for="adminFolderPostSystemImages">Post System Images Folder</label>
                  <input type="text" class="admin-settings-field-input" id="adminFolderPostSystemImages" data-setting-key="folder_post_system_images" autocomplete="off" placeholder="system-images/" />
                </div>
                <div class="admin-settings-field">
                  <label class="admin-settings-field-label" for="adminFolderRecentSystemImages">Recent System Images Folder</label>
                  <input type="text" class="admin-settings-field-input" id="adminFolderRecentSystemImages" data-setting-key="folder_recent_system_images" autocomplete="off" placeholder="system-images/" />
                </div>
                <div class="admin-settings-field">
                  <label class="admin-settings-field-label" for="adminFolderSiteAvatars">Site Avatars Folder</label>
                  <input type="text" class="admin-settings-field-input" id="adminFolderSiteAvatars" data-setting-key="folder_site_avatars" autocomplete="off" placeholder="site-avatars/" />
                </div>
                <div class="admin-settings-field">
                  <label class="admin-settings-field-label" for="adminFolderSiteImages">Site Images Folder</label>
                  <input type="text" class="admin-settings-field-input" id="adminFolderSiteImages" data-setting-key="folder_site_images" autocomplete="off" placeholder="site-images/" />
                </div>
                <div class="admin-settings-field">
                  <label class="admin-settings-field-label" for="adminFolderSystemImages">System Images Folder</label>
                  <input type="text" class="admin-settings-field-input" id="adminFolderSystemImages" data-setting-key="folder_system_images" autocomplete="off" placeholder="system-images/" />
                </div>
              </div>
              <div class="admin-settings-api-container">
                <div class="admin-settings-field">
                  <label class="admin-settings-field-label" for="adminStorageApiKey">Bunny Storage Zone Password</label>
                  <input type="password" class="admin-settings-field-input" id="adminStorageApiKey" data-setting-key="storage_api_key" autocomplete="new-password" data-lpignore="true" data-form-type="other" placeholder="Enter Storage Zone password (must allow uploads)" />
                </div>
                <div class="admin-settings-field">
                  <label class="admin-settings-field-label" for="adminStorageZoneName">Bunny Storage Zone Name</label>
                  <input type="text" class="admin-settings-field-input" id="adminStorageZoneName" data-setting-key="storage_zone_name" autocomplete="off" placeholder="Enter storage zone name" />
                </div>
              </div>
            </div>
          </div>
          
          <div class="admin-settings-imagemanager-accordion accordion-class-1">
            <div class="admin-settings-imagemanager-accordion-header accordion-header">
              <span class="admin-settings-imagemanager-accordion-header-text">Site Customisation</span>
              <span class="admin-settings-imagemanager-accordion-header-arrow"></span>
            </div>
            <div class="admin-settings-imagemanager-accordion-body accordion-body">
              <div id="adminSiteCustomisationContainer"></div>
            </div>
          </div>

          <!-- Tailwind Color Swatches -->
          <div class="admin-settings-color-swatches">
            <div class="admin-settings-color-swatches-title">Tailwind Blue Scale</div>
            <div class="admin-settings-color-swatches-grid">
              <div class="admin-settings-color-swatch" style="background: var(--blue-50);"><span>50</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--blue-100);"><span>100</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--blue-200);"><span>200</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--blue-300);"><span>300</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--blue-400);"><span>400</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--blue-500);"><span>500</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--blue-600);"><span>600</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--blue-700);"><span>700</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--blue-800);"><span>800</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--blue-900);"><span>900</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--blue-950);"><span>950</span></div>
            </div>
            <div class="admin-settings-color-swatches-title">Tailwind Green Scale</div>
            <div class="admin-settings-color-swatches-grid">
              <div class="admin-settings-color-swatch" style="background: var(--green-50);"><span>50</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--green-100);"><span>100</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--green-200);"><span>200</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--green-300);"><span>300</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--green-400);"><span>400</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--green-500);"><span>500</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--green-600);"><span>600</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--green-700);"><span>700</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--green-800);"><span>800</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--green-900);"><span>900</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--green-950);"><span>950</span></div>
            </div>
            <div class="admin-settings-color-swatches-title">Tailwind Yellow Scale</div>
            <div class="admin-settings-color-swatches-grid">
              <div class="admin-settings-color-swatch" style="background: var(--yellow-50);"><span>50</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--yellow-100);"><span>100</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--yellow-200);"><span>200</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--yellow-300);"><span>300</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--yellow-400);"><span>400</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--yellow-500);"><span>500</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--yellow-600);"><span>600</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--yellow-700);"><span>700</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--yellow-800);"><span>800</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--yellow-900);"><span>900</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--yellow-950);"><span>950</span></div>
            </div>
            <div class="admin-settings-color-swatches-title">Tailwind Red Scale</div>
            <div class="admin-settings-color-swatches-grid">
              <div class="admin-settings-color-swatch" style="background: var(--red-50);"><span>50</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--red-100);"><span>100</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--red-200);"><span>200</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--red-300);"><span>300</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--red-400);"><span>400</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--red-500);"><span>500</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--red-600);"><span>600</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--red-700);"><span>700</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--red-800);"><span>800</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--red-900);"><span>900</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--red-950);"><span>950</span></div>
            </div>
            <div class="admin-settings-color-swatches-title">Tailwind Gray Scale</div>
            <div class="admin-settings-color-swatches-grid">
              <div class="admin-settings-color-swatch" style="background: var(--gray-50);"><span>50</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--gray-100);"><span>100</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--gray-200);"><span>200</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--gray-300);"><span>300</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--gray-400);"><span>400</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--gray-500);"><span>500</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--gray-600);"><span>600</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--gray-700);"><span>700</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--gray-800);"><span>800</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--gray-900);"><span>900</span></div>
              <div class="admin-settings-color-swatch" style="background: var(--gray-950);"><span>950</span></div>
            </div>
          </div>
          
          </form>
        </section>
        
        <!-- Forms Tab -->
        <section id="admin-tab-forms" class="admin-tab-contents" role="tabpanel" aria-labelledby="admin-tab-forms-btn">
          <div id="admin-formbuilder" class="admin-formbuilder-container"></div>
        </section>
        
        <!-- Map Tab -->
        <section id="admin-tab-map" class="admin-tab-contents" role="tabpanel" aria-labelledby="admin-tab-map-btn">
          
          <!-- Starting Location -->
          <div class="admin-map-defaults-container">
            <div class="admin-panel-field">
              <label class="admin-settings-field-label" for="adminStartingAddress">Starting Location</label>
              <div id="admin-starting-address-display" class="admin-starting-address-value" hidden></div>
              <div class="admin-map-controls-starting">
                <div id="admin-geocoder-starting" class="admin-map-controls-starting-geocoder"></div>
              </div>
              <input type="hidden" id="adminStartingAddress" />
              <input type="hidden" id="adminStartingLat" />
              <input type="hidden" id="adminStartingLng" />
            </div>
            <div class="admin-panel-field admin-panel-field--spaced">
              <label class="admin-settings-field-label admin-settings-field-label--has-tooltip" for="adminMapCardBreakpoint"><span class="admin-settings-field-label-text">Map Card Breakpoint</span><span class="admin-tooltip"><svg class="admin-tooltip-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M8 7v4M8 4.5v.5" stroke-linecap="round"/></svg></span><div class="admin-tooltip-text admin-map-card-breakpoint-tooltip"></div></label>
              <div class="admin-spin-control-row row-class-1">
                <span id="adminMapCardBreakpointDisplay" class="admin-slider-value">8</span>
                <input type="range" id="adminMapCardBreakpoint" min="0" max="22" step="1" value="8" class="admin-spin-slider" />
              </div>
            </div>
            <div class="admin-panel-field admin-panel-field--spaced">
              <label class="admin-settings-field-label" for="adminStartingZoomDesktop">Starting Zoom Desktop</label>
              <div class="admin-spin-control-row row-class-1">
                <span id="adminStartingZoomDesktopDisplay" class="admin-slider-value">10</span>
                <input type="range" id="adminStartingZoomDesktop" min="1" max="18" step="1" value="10" class="admin-spin-slider" />
              </div>
            </div>
            <div class="admin-panel-field admin-panel-field--spaced">
              <label class="admin-settings-field-label" for="adminStartingZoomMobile">Starting Zoom Mobile</label>
              <div class="admin-spin-control-row row-class-1">
                <span id="adminStartingZoomMobileDisplay" class="admin-slider-value">10</span>
                <input type="range" id="adminStartingZoomMobile" min="1" max="18" step="1" value="10" class="admin-spin-slider" />
              </div>
            </div>
            <div class="admin-panel-field admin-panel-field--spaced">
              <label class="admin-settings-field-label" for="adminStartingPitchDesktop">Starting Pitch Desktop</label>
              <div class="admin-spin-control-row row-class-1">
                <span id="adminStartingPitchDesktopDisplay" class="admin-slider-value">0°</span>
                <input type="range" id="adminStartingPitchDesktop" min="0" max="85" step="1" value="0" class="admin-spin-slider" />
              </div>
            </div>
            <div class="admin-panel-field admin-panel-field--spaced">
              <label class="admin-settings-field-label" for="adminStartingPitchMobile">Starting Pitch Mobile</label>
              <div class="admin-spin-control-row row-class-1">
                <span id="adminStartingPitchMobileDisplay" class="admin-slider-value">0°</span>
                <input type="range" id="adminStartingPitchMobile" min="0" max="85" step="1" value="0" class="admin-spin-slider" />
              </div>
            </div>
            <div class="admin-panel-field admin-panel-field--spaced">
              <label class="admin-settings-field-label" for="adminFlytoZoomDesktop">Fly-To Zoom Desktop</label>
              <div class="admin-spin-control-row row-class-1">
                <span id="adminFlytoZoomDesktopDisplay" class="admin-slider-value">12</span>
                <input type="range" id="adminFlytoZoomDesktop" min="1" max="18" step="1" value="12" class="admin-spin-slider" />
              </div>
            </div>
            <div class="admin-panel-field admin-panel-field--spaced">
              <label class="admin-settings-field-label" for="adminFlytoZoomMobile">Fly-To Zoom Mobile</label>
              <div class="admin-spin-control-row row-class-1">
                <span id="adminFlytoZoomMobileDisplay" class="admin-slider-value">12</span>
                <input type="range" id="adminFlytoZoomMobile" min="1" max="18" step="1" value="12" class="admin-spin-slider" />
              </div>
            </div>
            <div class="admin-panel-field admin-panel-field--spaced">
              <label class="admin-settings-field-label admin-settings-field-label--has-tooltip" for="adminMapCardPriorityReshuffleZoom"><span class="admin-settings-field-label-text">Map Card Reshuffle Zoom Increment</span><span class="admin-tooltip"><svg class="admin-tooltip-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M8 7v4M8 4.5v.5" stroke-linecap="round"/></svg></span><div class="admin-tooltip-text admin-map-card-priority-tooltip"></div></label>
              <div class="admin-spin-control-row row-class-1">
                <span id="adminMapCardPriorityReshuffleZoomDisplay" class="admin-slider-value">0.5</span>
                <input type="range" id="adminMapCardPriorityReshuffleZoom" min="0.1" max="3.0" step="0.1" value="0.5" class="admin-spin-slider" />
              </div>
            </div>
          </div>
          
          <!-- Spin Settings -->
          <div class="admin-map-spin-container">
            <div class="admin-panel-field">
              <div class="admin-option-label row-class-1">
                <span>Spin on Logo</span>
                <label class="component-switch">
                  <input type="checkbox" id="adminSpinLogoClick" class="component-switch-input" checked />
                  <span class="component-switch-slider"></span>
                </label>
              </div>
            </div>
            <div class="admin-panel-field">
              <div class="admin-option-label row-class-1">
                <span>Spin on Load</span>
                <label class="component-switch">
                  <input type="checkbox" id="adminSpinLoadStart" class="component-switch-input" />
                  <span class="component-switch-slider"></span>
                </label>
              </div>
              <div id="adminSpinType" class="admin-spin-type-toggles admin-spin-type-toggles--no-margin row-class-1">
                  <label class="admin-spin-type-option">
                    <input type="radio" name="adminSpinType" value="everyone" class="admin-spin-type-option-input" />
                    <span class="admin-spin-type-option-label">Everyone</span>
                  </label>
                  <label class="admin-spin-type-option">
                    <input type="radio" name="adminSpinType" value="new_users" class="admin-spin-type-option-input" />
                    <span class="admin-spin-type-option-label">New Users</span>
                </label>
              </div>
            </div>
            <div class="admin-panel-field">
              <label class="admin-settings-field-label" for="adminSpinZoomMax">Spin Max Zoom</label>
              <div class="admin-spin-control-row row-class-1">
                <span id="adminSpinZoomMaxDisplay" class="admin-slider-value">4</span>
                <input type="range" id="adminSpinZoomMax" min="1" max="10" step="1" value="4" class="admin-spin-slider" />
              </div>
            </div>
            <div class="admin-panel-field">
              <label class="admin-settings-field-label" for="adminSpinSpeed">Spin Speed</label>
              <div class="admin-spin-control-row row-class-1">
                <span id="adminSpinSpeedDisplay" class="admin-slider-value">0.3</span>
                <input type="range" id="adminSpinSpeed" min="0.1" max="2.0" step="0.1" value="0.3" class="admin-spin-slider" />
              </div>
            </div>
          </div>
          
          <!-- Map Lighting & Style -->
          <div class="admin-map-lighting-container" id="admin-map-lighting-container">
            <div class="admin-panel-field">
              <label class="admin-settings-field-label">Map Lighting</label>
              <!-- SWITCH: To swap between icons and text, comment out one set and uncomment the other. Do not delete either. -->
              <div class="admin-lighting-buttons toggle-class-1">
                <button type="button" class="admin-lighting-button toggle-button" data-lighting="dawn" aria-pressed="false" title="Sunrise">
                  <span class="admin-lighting-button-icon" data-icon-key="icon_lighting_dawn" aria-hidden="true"></span>
                  <!-- <span class="admin-lighting-button-text">Sunrise</span> -->
                </button>
                <button type="button" class="admin-lighting-button toggle-button" data-lighting="day" aria-pressed="true" title="Day">
                  <span class="admin-lighting-button-icon" data-icon-key="icon_lighting_day" aria-hidden="true"></span>
                  <!-- <span class="admin-lighting-button-text">Day</span> -->
                </button>
                <button type="button" class="admin-lighting-button toggle-button" data-lighting="dusk" aria-pressed="false" title="Sunset">
                  <span class="admin-lighting-button-icon" data-icon-key="icon_lighting_dusk" aria-hidden="true"></span>
                  <!-- <span class="admin-lighting-button-text">Sunset</span> -->
                </button>
                <button type="button" class="admin-lighting-button toggle-button" data-lighting="night" aria-pressed="false" title="Night">
                  <span class="admin-lighting-button-icon" data-icon-key="icon_lighting_night" aria-hidden="true"></span>
                  <!-- <span class="admin-lighting-button-text">Night</span> -->
                </button>
              </div>
            </div>
            <div class="admin-panel-field">
              <label class="admin-settings-field-label">Map Style</label>
              <div class="admin-style-buttons toggle-class-1">
                <button type="button" class="admin-style-button toggle-button" data-style="standard" aria-pressed="true">
                  <span class="admin-style-button-text">Standard</span>
                </button>
                <button type="button" class="admin-style-button toggle-button" data-style="standard-satellite" aria-pressed="false">
                  <span class="admin-style-button-text">Satellite</span>
                </button>
              </div>
            </div>
          </div>
          
          <!-- Extra Map Options -->
          <div class="admin-extra-map-options-container" id="admin-extra-map-options-container">
            <div class="admin-panel-field">
              <div class="admin-option-label row-class-1">
                <span>Wait for Map Tiles</span>
                <label class="component-switch">
                  <input type="checkbox" id="adminWaitForMapTiles" class="component-switch-input" checked />
                  <span class="component-switch-slider"></span>
                </label>
              </div>
            </div>
            <div class="admin-panel-field">
              <div class="admin-option-label row-class-1">
                <span>Map Card Display</span>
                <div class="admin-spin-type-toggles">
                  <label class="admin-spin-type-option">
                    <input type="radio" name="adminMapCardDisplay" value="hover_only" class="admin-spin-type-option-input" />
                    <span class="admin-spin-type-option-label">Hover Only</span>
                  </label>
                  <label class="admin-spin-type-option">
                    <input type="radio" name="adminMapCardDisplay" value="always" class="admin-spin-type-option-input" />
                    <span class="admin-spin-type-option-label">Always</span>
                  </label>
                </div>
              </div>
            </div>
            <!-- Default wallpaper mode for new users (members override with their own preference) -->
            <div class="admin-panel-field">
              <label class="admin-settings-field-label">Default Location Wallpaper</label>
              <div class="admin-wallpaper-buttons toggle-class-1">
                <button type="button" class="admin-wallpaper-button toggle-button" data-wallpaper="off" aria-pressed="false">
                  <span class="admin-wallpaper-button-text">Off</span>
                </button>
                <button type="button" class="admin-wallpaper-button toggle-button" data-wallpaper="still" aria-pressed="false">
                  <span class="admin-wallpaper-button-text">Still</span>
                </button>
                <button type="button" class="admin-wallpaper-button toggle-button" data-wallpaper="basic" aria-pressed="true">
                  <span class="admin-wallpaper-button-text">Basic</span>
                </button>
                <button type="button" class="admin-wallpaper-button toggle-button" data-wallpaper="orbit" aria-pressed="false">
                  <span class="admin-wallpaper-button-text">Orbit</span>
                </button>
              </div>
            </div>
            <!-- Wallpaper dimmer is site-wide for everyone -->
            <div class="admin-panel-field admin-panel-field--spaced">
              <label class="admin-settings-field-label" for="adminLocationWallpaperDimmer">Wallpaper Dimmer (Site-wide)</label>
              <div class="admin-spin-control-row row-class-1">
                <span id="adminLocationWallpaperDimmerDisplay" class="admin-slider-value">30%</span>
                <input type="range" id="adminLocationWallpaperDimmer" min="0" max="100" step="5" value="30" class="admin-spin-slider" />
              </div>
            </div>
          </div>
          
          <!-- Map Card Image Pickers -->
          <div class="admin-settings-container">
            <div class="admin-settings-field admin-settings-field--imagepicker">
              <label class="admin-settings-field-label">Small Map Card Pill</label>
              <div id="adminSmallMapCardPillPicker" data-setting-key="small_map_card_pill"></div>
            </div>
            <div class="admin-settings-field admin-settings-field--imagepicker">
              <label class="admin-settings-field-label">Big Map Card Pill</label>
              <div id="adminBigMapCardPillPicker" data-setting-key="big_map_card_pill"></div>
            </div>
            <div class="admin-settings-field admin-settings-field--imagepicker">
              <label class="admin-settings-field-label">Hover Map Card Pill</label>
              <div id="adminHoverMapCardPillPicker" data-setting-key="hover_map_card_pill"></div>
            </div>
            <div class="admin-settings-field admin-settings-field--imagepicker">
              <label class="admin-settings-field-label">Multi Post Icon</label>
              <div id="adminMultiPostIconPicker" data-setting-key="multi_post_icon"></div>
            </div>
            <div class="admin-settings-field admin-settings-field--imagepicker">
              <label class="admin-settings-field-label">Marker Cluster Icon</label>
              <div id="adminMarkerClusterIconPicker" data-setting-key="marker_cluster_icon"></div>
            </div>
          </div>
          
        </section>
        
        <!-- Messages Tab -->
        <section id="admin-tab-messages" class="admin-tab-contents" role="tabpanel" aria-labelledby="admin-tab-messages-btn">
          <p class="admin-tab-intro">Messages content will go here.</p>
        </section>
        
        <!-- Checkout Tab -->
        <section id="admin-tab-checkout" class="admin-tab-contents" role="tabpanel" aria-labelledby="admin-tab-checkout-btn">
          <div class="admin-checkout-settings-message" data-message-key="msg_checkout_settings"></div>
          <div class="admin-checkout-options-container">
            <span class="admin-checkout-options-header-label">Checkout Options</span>
            <div class="admin-checkout-options-tiers" id="adminCheckoutTiers">
              <!-- Checkout options will be populated by JavaScript -->
            </div>
          </div>
          <div class="admin-checkout-coupon-container">
            <span class="admin-checkout-coupon-header-label">Coupon Codes</span>
            <div class="admin-checkout-coupon-list" id="adminCheckoutCouponList">
              <!-- populated by JS -->
            </div>
            <button type="button" class="admin-checkout-coupon-add button-class-2" id="adminCheckoutCouponAdd">+ Add Coupon</button>
          </div>
        </section>
        
        <!-- Moderation Tab -->
        <section id="admin-tab-moderation" class="admin-tab-contents" role="tabpanel" aria-labelledby="admin-tab-moderation-btn">
          
          <!-- Pending Deletion Accordion -->
          <div class="admin-moderation-accordion accordion-class-1" id="admin-moderation-deletion">
            <div class="admin-moderation-accordion-header accordion-header">
              <span class="admin-moderation-accordion-title">Pending Deletion</span>
              <span class="admin-moderation-accordion-count" id="admin-moderation-deletion-count">0</span>
              <span class="admin-moderation-accordion-arrow"></span>
            </div>
            <div class="admin-moderation-accordion-body accordion-body">
              <div class="admin-moderation-list" id="admin-moderation-deletion-list">
                <!-- Populated by JavaScript -->
              </div>
              <p class="admin-moderation-empty" id="admin-moderation-deletion-empty">No accounts pending deletion.</p>
            </div>
          </div>
          
          <!-- Flagged Posts Accordion -->
          <div class="admin-moderation-accordion accordion-class-1" id="admin-moderation-flagged">
            <div class="admin-moderation-accordion-header accordion-header">
              <span class="admin-moderation-accordion-title">Flagged Posts</span>
              <span class="admin-moderation-accordion-count" id="admin-moderation-flagged-count">0</span>
              <span class="admin-moderation-accordion-arrow"></span>
            </div>
            <div class="admin-moderation-accordion-body accordion-body">
              <div class="admin-moderation-list" id="admin-moderation-flagged-list">
                <!-- Populated by JavaScript -->
              </div>
              <p class="admin-moderation-empty" id="admin-moderation-flagged-empty">No flagged posts.</p>
            </div>
          </div>
          
          <!-- Missing Map Images Accordion -->
          <div class="admin-moderation-accordion accordion-class-1" id="admin-moderation-mapimages">
            <div class="admin-moderation-accordion-header accordion-header">
              <span class="admin-moderation-accordion-title">Missing Map Images</span>
              <span class="admin-moderation-accordion-count" id="admin-moderation-mapimages-count">0</span>
              <span class="admin-moderation-accordion-arrow"></span>
            </div>
            <div class="admin-moderation-accordion-body accordion-body">
              <div class="admin-moderation-list" id="admin-moderation-mapimages-list">
                <!-- Populated by JavaScript -->
              </div>
              <p class="admin-moderation-empty" id="admin-moderation-mapimages-empty">No posts with missing map images.</p>
            </div>
          </div>
          
        </section>

        <!-- Sitemap Tab -->
        <section id="admin-tab-sitemap" class="admin-tab-contents" role="tabpanel" aria-labelledby="admin-tab-sitemap-btn">
          <div class="admin-panel-body-item">
            <iframe id="admin-sitemap-iframe" title="Sitemap" data-src="sitemap.html" loading="lazy" style="width: 100%; height: 980px; border: 0; display: block; background: transparent;"></iframe>
          </div>
        </section>

        <div class="bottomSlack" aria-hidden="true"></div>
        
      </div>
      
    </div>
  </aside>

  <!-- ========================================================================
       SECTION 6: MEMBER PANEL
       File: member.js, member.css
       ======================================================================== -->
  <aside id="member-panel" class="member-panel" role="dialog" aria-hidden="true">
    <div class="member-panel-contents member-panel-contents--side-right member-panel-contents--hidden">
      
      <!-- Panel Header -->
      <div class="member-panel-header">
        <div class="member-panel-header-top">
          <h2 class="member-panel-header-title">Members</h2>
          <div class="member-panel-actions">
            <button type="button" class="member-panel-actions-icon-btn member-panel-actions-icon-btn--close" aria-label="Close Panel">
              <span class="member-panel-actions-icon-btn-icon member-panel-actions-icon-btn-icon--close" aria-hidden="true"></span>
            </button>
          </div>
        </div>
        
        <!-- Tab Bar -->
        <div class="member-tab-bar" role="tablist" aria-label="Member sections">
          <button type="button" id="member-tab-profile-btn" class="member-tab-profile button-class-2" data-tab="profile" role="tab" aria-selected="true" aria-controls="member-tab-profile">Profile</button>
          <button type="button" id="member-tab-create-btn" class="member-tab-create button-class-2" data-tab="create" role="tab" aria-selected="false" aria-controls="member-tab-create">Create Post</button>
          <button type="button" id="member-tab-posteditor-btn" class="member-tab-posteditor button-class-2" data-tab="posteditor" role="tab" aria-selected="false" aria-controls="member-tab-posteditor" hidden>Post Editor</button>
          <button type="button" id="member-tab-register-btn" class="member-tab-register button-class-2" data-tab="register" role="tab" aria-selected="false" aria-controls="member-tab-register">Support FunMap</button>
        </div>
      </div>
      
      <!-- Panel Body -->
      <div class="member-panel-body">
        
        <!-- ================================================================
             PROFILE TAB
             ================================================================ -->
        <section id="member-tab-profile" class="member-tab-contents member-tab-contents--active" role="tabpanel" aria-labelledby="member-tab-profile-btn">
          
          <!-- Map Settings (always visible) -->
          <div class="member-mapstyle-container">
            <div class="member-panel-field">
              <label class="member-settings-field-label">Map Lighting</label>
              <!-- SWITCH: To swap between icons and text, comment out one set and uncomment the other. Do not delete either. -->
              <div class="member-lighting-buttons toggle-class-1">
                <button type="button" class="member-lighting-button toggle-button" data-lighting="dawn" aria-pressed="false" title="Sunrise">
                  <span class="member-lighting-button-icon" data-icon-key="icon_lighting_dawn" aria-hidden="true"></span>
                  <!-- <span class="member-lighting-button-text">Sunrise</span> -->
                </button>
                <button type="button" class="member-lighting-button toggle-button" data-lighting="day" aria-pressed="true" title="Day">
                  <span class="member-lighting-button-icon" data-icon-key="icon_lighting_day" aria-hidden="true"></span>
                  <!-- <span class="member-lighting-button-text">Day</span> -->
                </button>
                <button type="button" class="member-lighting-button toggle-button" data-lighting="dusk" aria-pressed="false" title="Sunset">
                  <span class="member-lighting-button-icon" data-icon-key="icon_lighting_dusk" aria-hidden="true"></span>
                  <!-- <span class="member-lighting-button-text">Sunset</span> -->
                </button>
                <button type="button" class="member-lighting-button toggle-button" data-lighting="night" aria-pressed="false" title="Night">
                  <span class="member-lighting-button-icon" data-icon-key="icon_lighting_night" aria-hidden="true"></span>
                  <!-- <span class="member-lighting-button-text">Night</span> -->
                </button>
              </div>
            </div>
            <div class="member-panel-field">
              <label class="member-settings-field-label">Map Style</label>
              <div class="member-style-buttons toggle-class-1">
                <button type="button" class="member-style-button toggle-button" data-style="standard" aria-pressed="true">
                  <span class="member-style-button-text">Standard</span>
                </button>
                <button type="button" class="member-style-button toggle-button" data-style="standard-satellite" aria-pressed="false">
                  <span class="member-style-button-text">Satellite</span>
                </button>
              </div>
            </div>
            <div class="member-panel-field">
              <label class="member-settings-field-label">Wallpaper Animation</label>
              <div class="member-wallpaper-buttons toggle-class-1">
                <button type="button" class="member-wallpaper-button toggle-button" data-wallpaper="off" aria-pressed="false">
                  <span class="member-wallpaper-button-text">Off</span>
                </button>
                <button type="button" class="member-wallpaper-button toggle-button" data-wallpaper="still" aria-pressed="false">
                  <span class="member-wallpaper-button-text">Still</span>
                </button>
                <button type="button" class="member-wallpaper-button toggle-button" data-wallpaper="basic" aria-pressed="true">
                  <span class="member-wallpaper-button-text">Basic</span>
                </button>
                <button type="button" class="member-wallpaper-button toggle-button" data-wallpaper="orbit" aria-pressed="false">
                  <span class="member-wallpaper-button-text">Orbit</span>
                </button>
              </div>
            </div>
          </div>
          
          <div class="member-auth" data-state="logged-out">
            
            <!-- Profile Container (shown when logged in) -->
            <section id="member-profile-container" class="member-profile-container" role="region" aria-live="polite" hidden>
              <!-- Profile Header -->
              <div class="member-profile">
                <img id="member-profile-avatar" class="member-profile-avatar" alt="">
                <div class="member-profile-details">
                  <p id="member-profile-name" class="member-profile-name"></p>
                  <p id="member-profile-email" class="member-profile-email"></p>
                </div>
              </div>
              
              <!-- Update Profile Button -->
              <button type="button" id="member-profileform-toggle" class="member-profileform-toggle button-class-2">Update Profile</button>
              
              <!-- Profile Form Container (hidden by default) -->
              <div id="member-profileform-container" class="member-profileform-container" hidden>
                <div id="member-avatar-grid-profile" aria-label="Avatar choices"></div>
                <form id="memberProfileEditForm" class="member-profile-edit" autocomplete="off">
                  <div id="member-profileform-fieldsets" class="member-profileform-fieldsets"></div>
                  <div class="member-profile-edit-row">
                    <button type="button" id="member-profile-more-btn" class="member-profile-more-btn" aria-label="More options" aria-haspopup="true" aria-expanded="false">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="3" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="8" cy="13" r="1.5"/></svg>
                    </button>
                    <!-- More Menu (Hidden by default) -->
                    <div id="member-profile-more-menu" class="member-profile-more-menu" hidden>
                      <div class="member-profile-more-item">
                        <span class="member-profile-more-item-text">Hide Account</span>
                        <label id="member-profile-hide-switch" class="component-switch"><input class="component-switch-input" type="checkbox"><span class="component-switch-slider"></span></label>
                      </div>
                      <button type="button" id="member-profile-delete-btn" class="member-profile-more-item member-profile-more-delete">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                        <span>Delete Account</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
              
              <!-- Profile Actions: Refresh Preferences + Logout -->
              <div class="member-profile-actions">
                <div class="member-refresh-preferences">
                  <button type="button" class="member-refresh-preferences-btn button-class-2" id="member-refresh-preferences-btn">Refresh Preferences</button>
                  <span class="member-refresh-tooltip"><svg class="member-refresh-tooltip-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><path d="M8 7v4M8 4.5v.5" stroke-linecap="round"/></svg></span>
                  <div class="member-refresh-tooltip-text" id="member-refresh-tooltip-text"></div>
                </div>
                <button type="button" class="member-logout button-class-3" id="member-logout-btn">Log Out</button>
              </div>
            </section>
            
            <!-- Login Form Container - dynamically created by JS when logged out -->

          </div>
          
        </section>
        
        <!-- ================================================================
             CREATE POST TAB
             ================================================================ -->
        <section id="member-tab-create" class="member-tab-contents" role="tabpanel" aria-labelledby="member-tab-create-btn" hidden>
          <div class="member-formpicker-container">
            <div class="member-formpicker-cats" id="member-formpicker-cats" aria-label="Categories"></div>
          </div>
          <div class="member-postform-container" hidden>
            <div id="member-postform-fieldsets" class="member-postform-fieldsets" role="group" aria-live="polite"></div>
          </div>
        </section>
        
        <!-- ================================================================
             POST EDITOR TAB
             ================================================================ -->
        <section id="member-tab-posteditor" class="member-tab-contents" role="tabpanel" aria-labelledby="member-tab-posteditor-btn" hidden>
          <!-- Content loaded when logged in -->
        </section>
        
        <!-- ================================================================
             REGISTER TAB (Support FunMap - only visible when logged out)
             ================================================================ -->
        <section id="member-tab-register" class="member-tab-contents" role="tabpanel" aria-labelledby="member-tab-register-btn" hidden>
          <form id="memberAuthFormRegister" class="member-auth-form" autocomplete="off">
            <div id="member-supporter-message" class="member-supporter-message" data-message-key="msg_member_supporter_message"></div>

            <div id="member-registrationform-container" class="member-registrationform-container">
              <div class="member-supporter-payment-presets" aria-label="Support amount presets">
                <button type="button" class="member-supporterpayment-button button-class-2c" data-amount="2" aria-pressed="false">$2</button>
                <button type="button" class="member-supporterpayment-button button-class-2c" data-amount="5" aria-pressed="false">$5</button>
                <button type="button" class="member-supporterpayment-button button-class-2c" data-amount="10" aria-pressed="false">$10</button>
                <input type="text" id="member-supporter-payment-custom" class="member-supporterpayment-input" inputmode="decimal" autocomplete="off" placeholder="Custom">
              </div>
              <input type="hidden" id="member-supporter-payment-amount" name="supportAmount" value="">
              <div id="member-registrationform-fieldsets" class="member-registrationform-fieldsets"></div>
              <div id="member-avatar-grid-register" aria-label="Avatar choices"></div>
              <div id="member-supporter-country-menu"></div>
              <input type="hidden" id="member-supporter-country" name="country" value="">
              <div id="member-register-payment-container"></div>
            </div>
          </form>
        </section>
        
        <div class="bottomSlack" aria-hidden="true"></div>
        
      </div>
    </div>
  </aside>
  
  <!-- Unsaved Changes Prompt -->
  <div class="member-unsaved-prompt" id="member-unsaved-prompt" aria-hidden="true">
    <div class="member-unsaved-dialog">
      <p>You have unsaved changes. What would you like to do?</p>
      <div class="member-unsaved-actions">
        <button type="button" class="member-button-auth" data-action="cancel">Cancel</button>
        <button type="button" class="member-button-auth" data-action="discard">Discard</button>
        <button type="button" class="member-button-auth" data-action="save">Save</button>
      </div>
    </div>
  </div>

  <!-- Avatar cropper + picker UI are created dynamically by components (components.js) -->

  <!-- ========================================================================
       SECTION 7: MARQUEE
       File: marquee.js, marquee.css
       ======================================================================== -->
  <aside class="marquee">
    <div class="marquee-content">
      <!-- Slides inserted dynamically by marquee.js -->
    </div>
  </aside>

  <!-- ========================================================================
       STATUS MESSAGES (Toast notifications)
       ======================================================================== -->
  <div id="adminStatusMessage" class="admin-status-message" role="status" aria-live="polite" aria-hidden="true"></div>
  <div id="memberStatusMessage" class="member-status-message" role="status" aria-live="polite" aria-hidden="true"></div>

  <!-- ========================================================================
       MODALS (not counted as sections)
       ======================================================================== -->
  <div class="welcome-modal">
    <!-- Welcome message, geocoder, instructions -->
  </div>

  <div class="terms-modal">
    <!-- Terms and conditions -->
  </div>

  <div class="lightbox-modal">
    <!-- Image lightbox -->
  </div>

  <!-- ========================================================================
       JAVASCRIPT FILES (10 total)
       Load order matters: backbone first, then sections
       ======================================================================== -->
  <script src="fieldsets.js?v=20251228w"></script>
  <script src="components.js?v=20251228w"></script>
  <script src="index.js?v=20251228w"></script>
  <script src="header.js?v=20251228w"></script>
<script src="filter.js?v=20251228w"></script>
<script src="map.js?v=20251228w"></script>
  <script src="post.js?v=20251228w"></script>
  <script src="admin.js?v=20251228w"></script>
  <script src="formbuilder.js?v=20251228w"></script>
  <script src="posteditor.js?v=20251228w"></script>
  <script src="member.js?v=20251228w"></script>
  <script src="marquee.js?v=20251228w"></script>


</body>
</html>
