/**
 * Anti-Screenshot & Anti-Screen-Recording Protection (DRM Shield)
 * Protege imágenes, videos e información sensible contra capturas y descargas.
 */

(function () {
  'use strict';

  // CSS Protection injection
  const style = document.createElement('style');
  style.innerHTML = `
    /* Prevent image dragging, text selection, and callouts */
    body, img, video, .badoo-card, .dating-swipe-card, .gallery-item {
      -webkit-user-select: none !important;
      -moz-user-select: none !important;
      -ms-user-select: none !important;
      user-select: none !important;
      -webkit-touch-callout: none !important;
      -webkit-user-drag: none !important;
    }

    /* Protection Overlay on Images */
    .protected-media-wrapper {
      position: relative;
      display: inline-block;
    }
    .protected-media-wrapper::after {
      content: '';
      position: absolute;
      inset: 0;
      background: transparent;
      z-index: 10;
    }

    /* Screen blur on blur/print */
    @media print {
      body { display: none !important; }
    }
  `;
  document.head.appendChild(style);

  // 1. Disable Right Click Context Menu
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    return false;
  }, false);

  // 2. Disable Keyboard Shortcuts (PrintScreen, DevTools, Inspect, Save)
  document.addEventListener('keydown', function (e) {
    // PrintScreen
    if (e.key === 'PrintScreen' || e.keyCode === 44) {
      e.preventDefault();
      clearClipboard();
      blurScreen();
      return false;
    }

    // Ctrl+S, Ctrl+U, F12
    if (e.keyCode === 123 || (e.ctrlKey && (e.keyCode === 85 || e.keyCode === 83))) {
      e.preventDefault();
      return false;
    }

    // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (DevTools)
    if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
      e.preventDefault();
      return false;
    }

    // macOS Cmd+Shift+3 / Cmd+Shift+4 / Cmd+Shift+5
    if (e.metaKey && e.shiftKey && (e.keyCode === 51 || e.keyCode === 52 || e.keyCode === 53)) {
      e.preventDefault();
      blurScreen();
      return false;
    }
  }, false);

  // Clear clipboard if PrintScreen was pressed
  function clearClipboard() {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText('');
      }
    } catch (err) {}
  }

  // Temporary blur effect when screenshot shortcut detected
  function blurScreen() {
    document.body.style.filter = 'blur(30px)';
    setTimeout(function () {
      document.body.style.filter = 'none';
    }, 2000);
  }

  // Blur on window blur (prevents background screen recording tools when tab is out of focus)
  window.addEventListener('blur', function () {
    document.body.style.filter = 'blur(10px)';
  });
  window.addEventListener('focus', function () {
    document.body.style.filter = 'none';
  });
})();
