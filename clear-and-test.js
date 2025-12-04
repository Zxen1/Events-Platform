// ============================================
// FunMap Clear Cache & Test Script
// Paste this into the browser console on funmap.com
// ============================================

(async function clearAndTestFunMap() {
  console.log('🚀 FunMap Performance Test Starting...\n');
  
  // Step 1: Clear localStorage
  console.log('📦 Step 1: Clearing localStorage...');
  const beforeCount = Object.keys(localStorage).length;
  const beforeSize = Object.keys(localStorage).reduce((acc, key) => 
    acc + (localStorage.getItem(key) || '').length, 0);
  
  localStorage.clear();
  console.log(`✓ Cleared ${beforeCount} items (${(beforeSize/1024).toFixed(1)} KB)\n`);
  
  // Step 2: Clear service workers
  if ('serviceWorker' in navigator) {
    console.log('🔧 Step 2: Clearing service workers...');
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (let registration of registrations) {
        await registration.unregister();
        console.log(`✓ Unregistered: ${registration.scope}`);
      }
      if (registrations.length === 0) {
        console.log('✓ No service workers found');
      }
    } catch (e) {
      console.warn('⚠ Service worker error:', e.message);
    }
    console.log('');
  }
  
  // Step 3: Clear caches
  if ('caches' in window) {
    console.log('🗄️ Step 3: Clearing browser caches...');
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => {
        console.log(`  Deleting cache: ${name}`);
        return caches.delete(name);
      }));
      console.log(`✓ Cleared ${cacheNames.length} cache(s)\n`);
    } catch (e) {
      console.warn('⚠ Cache error:', e.message);
    }
  }
  
  // Step 4: Test API endpoints
  console.log('⚡ Step 4: Testing API endpoints...\n');
  const endpoints = [
    { name: 'get-admin-settings', url: '/gateway.php?action=get-admin-settings' },
    { name: 'get-form', url: '/gateway.php?action=get-form' },
    { name: 'verify-login', url: '/gateway.php?action=verify-login' }
  ];
  
  const results = [];
  const startTime = performance.now();
  
  for (const endpoint of endpoints) {
    const reqStart = performance.now();
    try {
      const response = await fetch(endpoint.url + '&_t=' + Date.now(), { 
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin'
      });
      const reqEnd = performance.now();
      const text = await response.text();
      const size = new Blob([text]).size;
      const duration = reqEnd - reqStart;
      
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (e) {
        // Not JSON, that's okay
      }
      
      const status = response.ok ? '✓' : '✗';
      const statusText = response.ok ? 'OK' : `ERROR ${response.status}`;
      const success = data && data.success !== undefined ? (data.success ? '✓' : '✗') : '?';
      
      console.log(`${status} ${endpoint.name}:`);
      console.log(`   Time: ${duration.toFixed(0)}ms`);
      console.log(`   Size: ${(size/1024).toFixed(1)} KB`);
      console.log(`   Status: ${statusText}`);
      if (data && data.success !== undefined) {
        console.log(`   Success: ${success}`);
      }
      console.log('');
      
      results.push({ 
        name: endpoint.name, 
        duration, 
        size, 
        success: response.ok,
        httpStatus: response.status 
      });
    } catch (e) {
      const reqEnd = performance.now();
      const duration = reqEnd - reqStart;
      console.error(`✗ ${endpoint.name}: ${e.message} (${duration.toFixed(0)}ms)\n`);
      results.push({ 
        name: endpoint.name, 
        duration, 
        size: 0, 
        success: false,
        error: e.message 
      });
    }
  }
  
  // Step 5: Summary
  const totalTime = performance.now() - startTime;
  const totalSize = results.reduce((acc, r) => acc + r.size, 0);
  const avgTime = results.reduce((acc, r) => acc + r.duration, 0) / results.length;
  const slowest = results.reduce((a, b) => a.duration > b.duration ? a : b);
  
  console.log('📊 Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Total API test time: ${(totalTime/1000).toFixed(2)}s`);
  console.log(`Average endpoint time: ${avgTime.toFixed(0)}ms`);
  console.log(`Slowest endpoint: ${slowest.name} (${slowest.duration.toFixed(0)}ms)`);
  console.log(`Total data transferred: ${(totalSize/1024).toFixed(1)} KB`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Step 6: Check page load performance
  if (performance.timing) {
    const timing = performance.timing;
    const pageLoad = timing.loadEventEnd - timing.navigationStart;
    const domReady = timing.domContentLoadedEventEnd - timing.navigationStart;
    const firstByte = timing.responseStart - timing.navigationStart;
    
    console.log('📈 Page Load Metrics:');
    console.log(`   DNS lookup: ${(timing.domainLookupEnd - timing.domainLookupStart).toFixed(0)}ms`);
    console.log(`   Connection: ${(timing.connectEnd - timing.connectStart).toFixed(0)}ms`);
    console.log(`   Time to first byte: ${firstByte.toFixed(0)}ms`);
    console.log(`   DOM ready: ${(domReady/1000).toFixed(2)}s`);
    console.log(`   Full page load: ${(pageLoad/1000).toFixed(2)}s`);
    console.log('');
  }
  
  // Step 7: Reload option
  console.log('🔄 Ready to reload with cleared cache.');
  console.log('   Run this command to reload:');
  console.log('   location.reload(true);');
  console.log('\n   Or wait 3 seconds for auto-reload...\n');
  
  setTimeout(() => {
    console.log('🔄 Reloading now...');
    location.reload(true);
  }, 3000);
  
  return results;
})();

