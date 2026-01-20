/* ============================================================================
   SITEMAP MODULE - Admin Panel > Site Map Tab
   Visual representation of site structure for developers and administrators
   ============================================================================
   
   This file is intentionally hard-coded. It serves as documentation and a
   visual reference for the site architecture. Unlike other admin tabs, this
   does not pull from the database or messages system.
   
   The Site Map shows:
   1. Device layouts (Landscape + Portrait) with clickable sections
   2. A genealogy-style tree showing the hierarchy of each section
   3. Instructional notes for new administrators
   
   ============================================================================ */

(function() {
    'use strict';

    var container = null;
    var isInitialized = false;

    /* --------------------------------------------------------------------------
       SECTION DATA (Hard-coded)
       -------------------------------------------------------------------------- */

    var sections = [
        {
            key: 'header',
            name: 'Header',
            color: '#5B8DEF',
            isPanel: false,
            description: 'The top navigation bar that appears on all screens. Contains the site logo, search, and primary navigation controls.',
            children: [
                { name: 'Logo', desc: 'Site branding, links to home/map view' },
                { name: 'Search', desc: 'Global search for events and locations' },
                { name: 'Menu Button', desc: 'Opens the filter panel' },
                { name: 'Member Button', desc: 'Opens member panel (login/profile)' },
                { name: 'Admin Button', desc: 'Opens admin panel (admin users only)' }
            ]
        },
        {
            key: 'map',
            name: 'Map',
            color: '#7EC87E',
            isPanel: false,
            description: 'The Mapbox-powered interactive map that displays all event locations. This is the background layer visible behind all panels.',
            children: [
                { name: 'Map Markers', desc: 'Clickable pins showing event locations' },
                { name: 'Clusters', desc: 'Grouped markers when zoomed out' },
                { name: 'Popup Cards', desc: 'Brief event info on marker click' },
                { name: 'Map Controls', desc: 'Zoom, rotation, geolocation' }
            ]
        },
        {
            key: 'filter',
            name: 'Filter Panel',
            color: '#F5A623',
            isPanel: true,
            description: 'Allows users to filter events by category, date, price, and other criteria. Appears on the left side (desktop) or full-width (mobile).',
            width: { desktop: '380px', mobile: 'full' },
            side: 'left',
            children: [
                { name: 'Category Filter', desc: 'Multi-select categories and subcategories' },
                { name: 'Date Filter', desc: 'Date range picker' },
                { name: 'Price Filter', desc: 'Free/paid toggle, price range' },
                { name: 'Distance Filter', desc: 'Radius from current location' }
            ]
        },
        {
            key: 'post',
            name: 'Post Panel',
            color: '#E85D75',
            isPanel: true,
            description: 'Displays full event details when a user clicks on an event. Shows all event information, images, pricing, and booking options.',
            width: { desktop: '530px', mobile: 'full' },
            side: 'left',
            children: [
                { name: 'Event Header', desc: 'Title, category, host info' },
                { name: 'Image Gallery', desc: 'Event photos with lightbox' },
                { name: 'Description', desc: 'Full event description' },
                { name: 'Sessions/Dates', desc: 'Available dates and times' },
                { name: 'Pricing', desc: 'Ticket tiers and prices' },
                { name: 'Location', desc: 'Venue details and map' },
                { name: 'Booking Button', desc: 'Proceed to checkout' }
            ]
        },
        {
            key: 'recents',
            name: 'Recents Panel',
            color: '#9B6DD3',
            isPanel: true,
            description: 'Shows recently viewed events and bookmarked favorites. Helps users quickly return to events they were interested in.',
            width: { desktop: '530px', mobile: 'full' },
            side: 'left',
            children: [
                { name: 'Recent Events', desc: 'Last viewed event cards' },
                { name: 'Favorites', desc: 'Bookmarked events' },
                { name: 'Quick Actions', desc: 'Clear history, manage favorites' }
            ]
        },
        {
            key: 'member',
            name: 'Member Panel',
            color: '#4ECDC4',
            isPanel: true,
            description: 'User account management. Login/register forms for guests, profile editing and post management for logged-in members.',
            width: { desktop: '440px', mobile: 'full' },
            side: 'right',
            children: [
                { name: 'Profile Tab', desc: 'View/edit account details' },
                { name: 'Create Post Tab', desc: 'Event creation form' },
                { name: 'My Posts Tab', desc: 'Manage your events' },
                { name: 'Support Tab', desc: 'Membership/subscription options' }
            ]
        },
        {
            key: 'admin',
            name: 'Admin Panel',
            color: '#FF6B6B',
            isPanel: true,
            description: 'Site administration for authorized users. Configure site settings, manage content, moderate users, and customize the platform.',
            width: { desktop: '440px', mobile: 'full' },
            side: 'right',
            children: [
                { name: 'Settings Tab', desc: 'Site name, currency, general config' },
                { name: 'Forms Tab', desc: 'Form builder for event fields' },
                { name: 'Map Tab', desc: 'Map appearance and behavior' },
                { name: 'Messages Tab', desc: 'UI text and labels' },
                { name: 'Checkout Tab', desc: 'Payment and booking options' },
                { name: 'Moderation Tab', desc: 'User/content moderation' },
                { name: 'Site Map Tab', desc: 'This documentation (you are here)' }
            ]
        },
        {
            key: 'marquee',
            name: 'Marquee Panel',
            color: '#45B7D1',
            isPanel: true,
            description: 'Featured content showcase. Displays promoted events, announcements, or curated collections in a carousel or grid format.',
            width: { desktop: '440px', mobile: 'full' },
            side: 'right',
            children: [
                { name: 'Featured Events', desc: 'Promoted/sponsored events' },
                { name: 'Announcements', desc: 'Site-wide notices' },
                { name: 'Collections', desc: 'Curated event groups' }
            ]
        }
    ];

    /* --------------------------------------------------------------------------
       BUILD FUNCTIONS
       -------------------------------------------------------------------------- */

    function buildLayoutsSection() {
        var wrapper = document.createElement('div');
        wrapper.className = 'admin-sitemap-layouts';

        // Landscape layout
        wrapper.appendChild(buildLandscapeLayout());

        // Portrait layout
        wrapper.appendChild(buildPortraitLayout());

        return wrapper;
    }

    function buildLandscapeLayout() {
        var layout = document.createElement('div');
        layout.className = 'admin-sitemap-layout';

        var label = document.createElement('div');
        label.className = 'admin-sitemap-layout-label';
        label.textContent = 'Landscape (Desktop)';
        layout.appendChild(label);

        var device = document.createElement('div');
        device.className = 'admin-sitemap-device admin-sitemap-device--landscape';

        // Header row
        var header = document.createElement('div');
        header.className = 'admin-sitemap-landscape-header admin-sitemap-section--header admin-sitemap-landscape-section';
        header.textContent = 'Header';
        header.dataset.section = 'header';
        header.onclick = function() { scrollToSection('header'); };
        device.appendChild(header);

        // Body with left/center/right
        var body = document.createElement('div');
        body.className = 'admin-sitemap-landscape-body';

        // Left side panels
        var left = document.createElement('div');
        left.className = 'admin-sitemap-landscape-left';

        var filter = createLandscapeSection('filter', 'Filter');
        filter.classList.add('admin-sitemap-landscape-section--filter');
        left.appendChild(filter);
        left.appendChild(createLandscapeSection('post', 'Post'));
        left.appendChild(createLandscapeSection('recents', 'Recents'));

        // Center (map)
        var center = document.createElement('div');
        center.className = 'admin-sitemap-landscape-center admin-sitemap-section--map admin-sitemap-landscape-section';
        center.textContent = 'Map';
        center.dataset.section = 'map';
        center.onclick = function() { scrollToSection('map'); };

        // Right side panels
        var right = document.createElement('div');
        right.className = 'admin-sitemap-landscape-right';
        right.appendChild(createLandscapeSection('member', 'Member'));
        right.appendChild(createLandscapeSection('admin', 'Admin'));
        right.appendChild(createLandscapeSection('marquee', 'Marquee'));

        body.appendChild(left);
        body.appendChild(center);
        body.appendChild(right);
        device.appendChild(body);

        layout.appendChild(device);
        return layout;
    }

    function createLandscapeSection(key, name) {
        var section = document.createElement('div');
        section.className = 'admin-sitemap-landscape-section admin-sitemap-section--' + key;
        section.textContent = name;
        section.dataset.section = key;
        section.onclick = function() { scrollToSection(key); };
        return section;
    }

    function buildPortraitLayout() {
        var layout = document.createElement('div');
        layout.className = 'admin-sitemap-layout';

        var label = document.createElement('div');
        label.className = 'admin-sitemap-layout-label';
        label.textContent = 'Portrait (Mobile)';
        layout.appendChild(label);

        var device = document.createElement('div');
        device.className = 'admin-sitemap-device admin-sitemap-device--portrait';

        // Wrapper for the phone representation (centered in the box)
        var wrapper = document.createElement('div');
        wrapper.className = 'admin-sitemap-portrait-wrapper';

        // Header
        var header = document.createElement('div');
        header.className = 'admin-sitemap-portrait-header admin-sitemap-section--header';
        wrapper.appendChild(header);

        // Body
        var body = document.createElement('div');
        body.className = 'admin-sitemap-portrait-body';

        // Map background
        var map = document.createElement('div');
        map.className = 'admin-sitemap-portrait-map admin-sitemap-section--map admin-sitemap-portrait-section';
        map.textContent = 'Map';
        map.dataset.section = 'map';
        map.onclick = function() { scrollToSection('map'); };
        body.appendChild(map);

        // Panels overlay
        var panels = document.createElement('div');
        panels.className = 'admin-sitemap-portrait-panels';

        var panelOrder = ['filter', 'post', 'recents', 'member', 'admin', 'marquee'];
        panelOrder.forEach(function(key) {
            var section = document.createElement('div');
            section.className = 'admin-sitemap-portrait-section admin-sitemap-section--' + key;
            section.textContent = key.charAt(0).toUpperCase() + key.slice(1);
            section.dataset.section = key;
            section.onclick = function() { scrollToSection(key); };
            panels.appendChild(section);
        });

        body.appendChild(panels);
        wrapper.appendChild(body);
        device.appendChild(wrapper);
        layout.appendChild(device);

        return layout;
    }

    function buildTree() {
        var tree = document.createElement('div');
        tree.className = 'admin-sitemap-tree';

        var label = document.createElement('div');
        label.className = 'admin-sitemap-tree-label';
        label.textContent = 'Section Details';
        tree.appendChild(label);

        var treeContainer = document.createElement('div');
        treeContainer.className = 'admin-sitemap-tree-container';

        sections.forEach(function(sec) {
            treeContainer.appendChild(buildTreeNode(sec));
        });

        tree.appendChild(treeContainer);
        return tree;
    }

    function buildTreeNode(sec) {
        var node = document.createElement('div');
        node.className = 'admin-sitemap-node';
        node.id = 'sitemap-section-' + sec.key;

        // Header
        var header = document.createElement('div');
        header.className = 'admin-sitemap-node-header';
        header.onclick = function() {
            node.classList.toggle('admin-sitemap-node--open');
        };

        var color = document.createElement('div');
        color.className = 'admin-sitemap-node-color';
        color.style.background = sec.color;

        var title = document.createElement('div');
        title.className = 'admin-sitemap-node-title';
        title.textContent = sec.name + (sec.isPanel ? '' : ' (Section)');

        var arrow = document.createElement('div');
        arrow.className = 'admin-sitemap-node-arrow';

        header.appendChild(color);
        header.appendChild(title);
        header.appendChild(arrow);
        node.appendChild(header);

        // Body
        var body = document.createElement('div');
        body.className = 'admin-sitemap-node-body';

        // Description
        var desc = document.createElement('div');
        desc.className = 'admin-sitemap-node-description';
        desc.textContent = sec.description;
        body.appendChild(desc);

        // Width info for panels
        if (sec.isPanel && sec.width) {
            var widthInfo = document.createElement('div');
            widthInfo.className = 'admin-sitemap-node-description';
            widthInfo.textContent = 'Desktop: ' + sec.width.desktop + ' (' + sec.side + ' side) | Mobile: ' + sec.width.mobile + ' width';
            body.appendChild(widthInfo);
        }

        // Children
        if (sec.children && sec.children.length > 0) {
            var children = document.createElement('div');
            children.className = 'admin-sitemap-node-children';

            sec.children.forEach(function(child) {
                var childEl = document.createElement('div');
                childEl.className = 'admin-sitemap-child';

                var childName = document.createElement('div');
                childName.className = 'admin-sitemap-child-name';
                childName.textContent = child.name;

                var childDesc = document.createElement('div');
                childDesc.className = 'admin-sitemap-child-desc';
                childDesc.textContent = child.desc;

                childEl.appendChild(childName);
                childEl.appendChild(childDesc);
                children.appendChild(childEl);
            });

            body.appendChild(children);
        }

        node.appendChild(body);
        return node;
    }

    function buildNotes() {
        var notes = document.createElement('div');
        notes.className = 'admin-sitemap-notes';

        var label = document.createElement('div');
        label.className = 'admin-sitemap-notes-label';
        label.textContent = 'Notes';
        notes.appendChild(label);

        var text = document.createElement('div');
        text.className = 'admin-sitemap-notes-text';
        text.innerHTML = 
            '<p><strong>Single-Page Architecture:</strong> This is a Panel Scroller CMS. All sections exist on one page - the map is always the background, and panels slide in from the sides.</p>' +
            '<p><strong>Desktop Layout:</strong> Left-side panels (Filter, Post, Recents) and right-side panels (Member, Admin, Marquee) can both be open simultaneously, with the map visible through the gap in the middle.</p>' +
            '<p><strong>Mobile Layout:</strong> On phones, all panels are full-width and appear below the header. Only one panel is visible at a time. The header may scroll off-screen in some situations.</p>' +
            '<p><strong>Click any section</strong> in the diagrams above to jump to its details in the tree below.</p>';

        notes.appendChild(text);
        return notes;
    }

    /* --------------------------------------------------------------------------
       SCROLL TO SECTION
       -------------------------------------------------------------------------- */

    function scrollToSection(key) {
        var nodeId = 'sitemap-section-' + key;
        var node = document.getElementById(nodeId);
        if (!node) return;

        // Open the node
        node.classList.add('admin-sitemap-node--open');

        // Scroll into view
        node.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Brief highlight effect
        node.style.outline = '2px solid var(--accent-primary)';
        setTimeout(function() {
            node.style.outline = '';
        }, 1500);
    }

    /* --------------------------------------------------------------------------
       INIT
       -------------------------------------------------------------------------- */

    function init() {
        if (isInitialized) return;

        container = document.getElementById('admin-tab-sitemap');
        if (!container) return;

        // Build the UI
        container.appendChild(buildLayoutsSection());
        container.appendChild(buildNotes());
        container.appendChild(buildTree());

        isInitialized = true;
    }

    /* --------------------------------------------------------------------------
       PUBLIC API
       -------------------------------------------------------------------------- */

    window.SitemapModule = {
        init: init
    };

    // Register module with App
    if (window.App && App.registerModule) {
        App.registerModule('sitemap', window.SitemapModule);
    }
})();
