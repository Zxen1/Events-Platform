// ============================================================================
// CONSOLE FILTER - Suppress known third-party warnings
// ============================================================================
// 
// This file is loaded conditionally via the Admin Settings checkbox
// "Enable Console Filter" - edit patterns below to customize filtering
//
// ============================================================================

(function(){
  'use strict';
  
  const originalWarn = console.warn;
  const originalError = console.error;
  
  // ========================================
  // SUPPRESSION PATTERNS - Edit as needed
  // ========================================
  
  const suppressedWarnings = [
    // Mapbox GL JS - Navigation controls (touchmove)
    /non-passive event listener/i,
    /touchmove/i,
    
    // Mapbox GL JS - Rendering performance
    /violation.*requestAnimationFrame/i,
    
    // Mapbox GL JS - Style loading
    /featureNamespace.*selector/i,
    
    // Mapbox GL JS - Terrain rendering
    /cutoff.*disabled.*terrain/i,
    
    // Mapbox GL JS - Missing marker composites (expected during load)
    /Image "marker-label-composite.*could not be loaded/i,
    
    // Add your own patterns below:
    // /pattern to match/i,
  ];
  
  const suppressedErrors = [
    // Mapbox GL JS - Style expression evaluation (benign)
    /Failed to evaluate expression.*sizerank/i,
    
    // Add your own patterns below:
    // /pattern to match/i,
  ];
  
  // ========================================
  // FILTER LOGIC - Do not edit below
  // ========================================
  
  function shouldSuppress(patterns, args) {
    const message = args.join(' ');
    return patterns.some(pattern => pattern.test(message));
  }
  
  console.warn = function(...args) {
    if(!shouldSuppress(suppressedWarnings, args)){
      originalWarn.apply(console, args);
    }
  };
  
  console.error = function(...args) {
    if(!shouldSuppress(suppressedErrors, args)){
      originalError.apply(console, args);
    }
  };
  
  // Confirmation message
  console.log('%c[Console Filter Active]', 'color: #00ff00; font-weight: bold;', 
    'Suppressing', suppressedWarnings.length, 'warning patterns and', 
    suppressedErrors.length, 'error patterns');
  
})();

