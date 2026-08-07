/**
 * Anti-Screenshot & DRM Protection + Mobile Touch Control
 * Protege contenidos y deshabilita Zoom por Doble-Tap y Pellizco (Pinch Zoom) en iOS/Android.
 */

(function () {
  'use strict';

  // CSS Protection & Touch Action Injection
  const style = document.createElement('style');
  style.innerHTML = `
    /* Disable double-tap and pinch zoom gestures */
    html, body {
      touch-action: manipulation !important;
      -ms-touch-action: manipulation !important;
      -webkit-user-select: none !important;
      -moz-user-select: none !important;
      -ms-user-select: none !important;
      user-select: none !important;
      -webkit-touch-callout: none !important;
      -webkit-user-drag: none !important;
      overflow-x: hidden;
    }

    /* Ensure interactive elements ALWAYS receive touch events on iOS/Android */
    a, button, input, select, textarea, .btn, .badoo-card, .dating-swipe-card, .featured-card, .gender-pill, .bottom-nav-item {
      pointer-events: auto !important;
      touch-action: manipulation !important;
      cursor: pointer !important;
    }

    /* Print Protection */
    @media print {
      body { display: none !important; }
    }
  `;
  document.head.appendChild(style);

  // 1. Disable Pinch-to-Zoom on Mobile
  document.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });

  // 2. Disable Double-Tap Zoom on Mobile
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function (e) {
    // Exclude form controls from double tap prevent
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(e.target.tagName)) {
      return;
    }
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, false);

  // 3. Disable Gesture Start (iOS Safari Zoom)
  document.addEventListener('gesturestart', function (e) {
    e.preventDefault();
  });

  // 4. Disable Right Click Context Menu
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    return false;
  }, false);

  // 5. Disable Keyboard Shortcuts (PrintScreen, DevTools, Save)
  document.addEventListener('keydown', function (e) {
    if (e.key === 'PrintScreen' || e.keyCode === 44) {
      e.preventDefault();
      clearClipboard();
      blurScreen();
      return false;
    }
    if (e.keyCode === 123 || (e.ctrlKey && (e.keyCode === 85 || e.keyCode === 83))) {
      e.preventDefault();
      return false;
    }
    if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
      e.preventDefault();
      return false;
    }
    if (e.metaKey && e.shiftKey && (e.keyCode === 51 || e.keyCode === 52 || e.keyCode === 53)) {
      e.preventDefault();
      blurScreen();
      return false;
    }
  }, false);

  function clearClipboard() {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText('');
      }
    } catch (err) {}
  }

  function blurScreen() {
    document.body.style.filter = 'blur(30px)';
    setTimeout(function () {
      document.body.style.filter = 'none';
    }, 2000);
  }

  window.addEventListener('blur', function () {
    document.body.style.filter = 'blur(10px)';
  });
  window.addEventListener('focus', function () {
    document.body.style.filter = 'none';
  });
})();
