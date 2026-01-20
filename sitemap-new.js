/* SITEMAP MODULE */
(function() {
    'use strict';

    var isInitialized = false;

    function init() {
        if (isInitialized) return;
        var container = document.getElementById('admin-tab-sitemap');
        if (!container) return;

        container.innerHTML = 
            '<div class="admin-sitemap-layouts">' +
                '<div class="admin-sitemap-layout-label">Landscape (Desktop)</div>' +
                '<div class="admin-sitemap-device admin-sitemap-device--landscape">' +
                    '<div class="header">Header</div>' +
                    '<div class="body">' +
                        '<div class="left"><div class="filter">Filter</div><div class="post">Post</div><div class="recents">Recents</div></div>' +
                        '<div class="map">Map</div>' +
                        '<div class="right"><div class="member">Member</div><div class="admin">Admin</div><div class="marquee">Marquee</div></div>' +
                    '</div>' +
                '</div>' +
                '<div class="admin-sitemap-layout-label">Portrait (Mobile)</div>' +
                '<div class="admin-sitemap-device admin-sitemap-device--portrait">' +
                    '<div class="header">Header</div>' +
                    '<div class="body">' +
                        '<div class="map">Map</div>' +
                        '<div class="filter">Filter</div><div class="post">Post</div><div class="recents">Recents</div>' +
                        '<div class="member">Member</div><div class="admin">Admin</div><div class="marquee">Marquee</div>' +
                    '</div>' +
                '</div>' +
            '</div>';

        isInitialized = true;
    }

    window.SitemapModule = { init: init };
    if (window.App && App.registerModule) App.registerModule('sitemap', window.SitemapModule);
})();
