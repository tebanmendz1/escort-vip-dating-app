/**
 * Anti-Adblock & Brave Shields Detection Script (Fix)
 * Detecta únicamente si un bloqueador o escudo está BLOQUEANDO anuncios activamente.
 */

(function () {
  function createAdBlockModal() {
    if (document.getElementById('adblockOverlay')) return;

    const modalHtml = `
      <div id="adblockOverlay" style="position: fixed; inset: 0; background: rgba(10, 10, 15, 0.95); backdrop-filter: blur(15px); z-index: 999999; display: flex; align-items: center; justify-content: center; padding: 20px;">
        <div style="background: #181824; border: 1px solid rgba(255, 42, 122, 0.4); border-radius: 24px; max-width: 480px; width: 100%; padding: 30px; text-align: center; box-shadow: 0 20px 50px rgba(255, 42, 122, 0.3);">
          <div style="width: 70px; height: 70px; background: rgba(255, 42, 122, 0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; color: #FF2A7A; font-size: 32px;">
            🛡️
          </div>
          <h3 style="color: #ffffff; font-weight: 800; margin-bottom: 12px; font-family: sans-serif;">Bloqueador de Anuncios Detectado</h3>
          <p style="color: #aaa; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
            Hemos detectado un bloqueador de anuncios o escudos de privacidad activos. Para mantener la plataforma gratuita y ofrecer visibilidad VIP a nuestras/os escorts, te pedimos deshabilitar tu bloqueador para este sitio.
          </p>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <button id="btnRetryAdblock" style="background: linear-gradient(135deg, #FF2A7A 0%, #E02875 100%); color: #fff; border: none; border-radius: 30px; padding: 14px; font-weight: 700; font-size: 15px; cursor: pointer; box-shadow: 0 6px 20px rgba(255, 42, 122, 0.4);">
              ¡Ya deshabilité mi Bloqueador! Reintentar
            </button>
            <button id="btnDismissAdblock" style="background: transparent; color: #888; border: none; font-size: 13px; cursor: pointer; text-decoration: underline;">
              Continuar de todos modos
            </button>
          </div>
        </div>
      </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = modalHtml;
    document.body.appendChild(div.firstElementChild);

    document.getElementById('btnRetryAdblock').addEventListener('click', () => {
      window.location.reload();
    });

    document.getElementById('btnDismissAdblock').addEventListener('click', () => {
      const overlay = document.getElementById('adblockOverlay');
      if (overlay) overlay.style.display = 'none';
      sessionStorage.setItem('adblock_dismissed', 'true');
    });
  }

  async function detectAdBlock() {
    if (sessionStorage.getItem('adblock_dismissed')) return;

    // Test real request blocking to popular ad server script
    let isBlocked = false;

    // Test 1: Fetch known ad script URL
    try {
      const request = new Request('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', {
        method: 'HEAD',
        mode: 'no-cors'
      });
      await fetch(request);
    } catch (e) {
      isBlocked = true;
    }

    // Test 2: DOM Bait element test
    if (!isBlocked) {
      const bait = document.createElement('div');
      bait.className = 'adsbygoogle ad-zone ad-space google-ad banner-ad';
      bait.style.position = 'absolute';
      bait.style.top = '-9999px';
      bait.style.left = '-9999px';
      bait.style.height = '10px';
      bait.style.width = '10px';
      document.body.appendChild(bait);

      if (
        bait.offsetParent === null ||
        bait.offsetHeight === 0 ||
        window.getComputedStyle(bait).display === 'none'
      ) {
        isBlocked = true;
      }
      if (bait.parentNode) bait.parentNode.removeChild(bait);
    }

    if (isBlocked) {
      setTimeout(createAdBlockModal, 1000);
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    detectAdBlock();
  } else {
    document.addEventListener('DOMContentLoaded', detectAdBlock);
  }
})();
