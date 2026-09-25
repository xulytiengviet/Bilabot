/* BilaBot Google Identity Services bootstrap for a STATIC GitHub Pages site.
 * Google sign-in authenticates BilaBot only; XiaoZhi device activation is
 * separate and the real activation code is returned from OTA provisioning.
 * Google ID credentials remain in memory until sent to the trusted Worker.
 * Only the short-lived Worker session is saved in sessionStorage.
 */
(function () {
  'use strict';
  const BASE = 'bilabot-gateway-config-v1';
  const SESSION = 'bilabot-session-v1';
  const gate = document.getElementById('bilabot-gate');
  const status = document.getElementById('bb-auth-status');
  const err = document.getElementById('bb-auth-error');
  const googleBtn = document.getElementById('bb-google-btn');
  const apiInput = document.getElementById('bb-api-input');
  const clientInput = document.getElementById('bb-client-input');
  const saveBtn = document.getElementById('bb-save-config');
  const identity = document.getElementById('bb-identity');
  const userLabel = document.getElementById('bb-user-label');
  const logout = document.getElementById('bb-logout');
  const fixed = window.BILABOT_CONFIG || {};
  let local = {};
  try { local = JSON.parse(localStorage.getItem(BASE) || '{}'); } catch {}
  const settings = {
    apiBase: (local.workerUrl || fixed.workerUrl || '').trim().replace(/\/+$/, ''),
    clientId: (local.googleClientId || fixed.googleClientId || '').trim(),
    autoPair: fixed.autoPair !== false
  };
  let token = '';
  let account = null;
  let expiresAt = 0;
  let apiReady = false;

  function showError(message) {
    err.hidden = false;
    err.textContent = String(message || 'Không thể kết nối.');
    status.textContent = 'Bạn có thể kiểm tra cấu hình và thử đăng nhập lại.';
  }
  function clearError() { err.hidden = true; err.textContent = ''; }
  function readyConfig() {
    if (!settings.apiBase || !settings.clientId) return false;
    try {
      const u = new URL(settings.apiBase);
      return (u.protocol === 'https:' || (u.protocol === 'http:' &&
        (u.hostname === 'localhost' || u.hostname === '127.0.0.1'))) &&
        /^[a-zA-Z0-9_-]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(settings.clientId);
    } catch { return false; }
  }
  function login() {
    if (!apiReady) return;
    if (!window.google?.accounts?.id) {
      showError('Chưa tải được Google Identity Services. Kiểm tra Internet hoặc tiện ích chặn theo dõi.');
      return;
    }
    window.google.accounts.id.initialize({
      client_id: settings.clientId,
      callback: async function (response) {
        clearError();
        status.textContent = 'Đang xác thực tài khoản Google trên máy chủ BilaBot...';
        try {
          const res = await fetch(settings.apiBase + '/api/auth/google', {
            method: 'POST', mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential })
          });
          const data = await res.json();
          if (!res.ok || !data.session) throw new Error(data.error || 'Xác thực Google không thành công.');
          acceptSession(data);
        } catch (e) { showError(e.message); }
      },
      auto_select: false,
      cancel_on_tap_outside: true
    });
    googleBtn.replaceChildren();
    window.google.accounts.id.renderButton(googleBtn, {
      type: 'standard', theme: 'outline', size: 'large',
      text: 'signin_with', locale: 'vi', shape: 'pill', width: 290
    });
    status.textContent = 'Đăng nhập Google để yêu cầu mã kích hoạt XiaoZhi tự động.';
  }
  async function autoConnect() {
    if (!settings.autoPair) return;
    // The underlying Olivia-derived app initializes asynchronously.
    // Only request OTA after the Worker session has been verified.
    for (let i = 0; i < 35; i++) {
      if (!token) return;
      if (window.XiaozhiDebug?.quickTest) {
        try {
          status.textContent = 'Đang yêu cầu mã kích hoạt XiaoZhi...';
          await window.XiaozhiDebug.quickTest();
        } catch (e) {
          console.warn('[BilaBot] OTA auto-pair:', e.message);
        }
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 180));
    }
    console.warn('[BilaBot] Trợ lý chưa khởi tạo; có thể kết nối thủ công.');
  }
  function acceptSession(data) {
    token = data.session;
    account = data.user || {};
    expiresAt = Number(data.expiresAt) || 0;
    try {
      sessionStorage.setItem(SESSION, JSON.stringify({
        token, account, expiresAt, apiBase: settings.apiBase
      }));
    } catch {}
    document.body.classList.add('bilabot-authed');
    if (identity) identity.hidden = false;
    if (userLabel) userLabel.textContent = account.name || account.email || 'Google';
    gate.setAttribute('aria-hidden', 'true');
    autoConnect();
  }
  async function restoreSession() {
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem(SESSION) || 'null'); } catch {}
    if (!saved || saved.apiBase !== settings.apiBase ||
        !saved.token || Number(saved.expiresAt) < Date.now() + 60_000) return false;
    try {
      const res = await fetch(settings.apiBase + '/api/me', {
        headers: { Authorization: 'Bearer ' + saved.token }
      });
      if (!res.ok) return false;
      const data = await res.json();
      acceptSession({ session: saved.token, user: data.user || saved.account, expiresAt: saved.expiresAt });
      return true;
    } catch { return false; }
  }
  async function boot() {
    apiInput.value = settings.apiBase;
    clientInput.value = settings.clientId;
    if (!readyConfig()) {
      status.textContent = 'Chưa cấu hình Google OAuth và Cloudflare Worker. Mở “Tự cấu hình” bên dưới để nhập hai địa chỉ công khai.';
      document.getElementById('bb-selfconfig').open = true;
      return;
    }
    try {
      const res = await fetch(settings.apiBase + '/api/health', { mode: 'cors' });
      if (!res.ok) throw new Error('Cloudflare Worker chưa sẵn sàng.');
      const health = await res.json();
      if (!health.ready) throw new Error('Worker chưa thiết lập các bí mật xác thực.');
      apiReady = true;
    } catch (e) {
      showError('Không kết nối được Cloudflare Worker: ' + e.message);
      return;
    }
    if (await restoreSession()) return;
    for (let i = 0; i < 25 && !window.google?.accounts?.id; i++) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    login();
  }
  saveBtn.addEventListener('click', () => {
    const url = apiInput.value.trim().replace(/\/+$/, '');
    const cid = clientInput.value.trim();
    const old = settings.apiBase;
    if (old && url !== old &&
      !confirm('Chỉ nhập Worker mà bạn tin cậy. Worker mới sẽ nhận thông tin thiết bị và yêu cầu xác thực Google. Tiếp tục?')) return;
    localStorage.setItem(BASE, JSON.stringify({ workerUrl: url, googleClientId: cid }));
    sessionStorage.removeItem(SESSION);
    location.reload();
  });
  logout?.addEventListener('click', () => {
    sessionStorage.removeItem(SESSION);
    token = '';
    window.google?.accounts?.id?.disableAutoSelect();
    location.reload();
  });
  window.BilaBotAuth = {
    get apiBase() { return settings.apiBase; },
    get sessionToken() { return token && expiresAt > Date.now() + 10_000 ? token : ''; },
    signOut() { logout?.click(); }
  };
  boot();
})();
