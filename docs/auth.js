/**
 * BilaBot GitHub Pages onboarding.
 * Google Identity Services: separate BilaBot login; its ID token is verified
 * by the owner's Worker, never forwarded to XiaoZhi. XiaoZhi authorization
 * happens only at its official console, with OTA device-code pairing.
 */
(() => {
  'use strict';
  const SAVE = 'bilabot-connection-v2';
  const SESSION = 'bilabot-transport-session-v3';
  const PROFILE = 'bilabot-gis-profile-v1';
  const ui = id => document.getElementById(id);
  const fixed = window.BILABOT_CONFIG || {};
  let storedSettings = {};
  try { storedSettings = JSON.parse(localStorage.getItem(SAVE) || '{}'); } catch {}
  const settings = {
    workerUrl: String(storedSettings.workerUrl || fixed.workerUrl || '').trim().replace(/\/+$/, ''),
    mode: storedSettings.mode === 'direct' ? 'direct' : (fixed.mode === 'direct' ? 'direct' : 'gateway'),
    googleClientId: String(fixed.googleClientId || '').trim()
  };
  let transportSession = '';
  let expiresAt = 0;
  let googleToken = '';
  let verifiedProfile = null;
  let healthCache = null;
  let pendingSession = null;
  let pendingPair = null;
  let googleInitialized = false;
  const setText = (id, value) => { if (ui(id)) ui(id).textContent = value; };
  function status(message, state = 'idle') {
    setText('bb-auth-status', message);
    const pill = ui('bb-server-state');
    if (pill) {
      pill.dataset.state = state;
      pill.textContent = state === 'ready' ? 'Sẵn sàng kết nối' :
        state === 'busy' ? 'Đang kết nối…' :
        state === 'error' ? 'Cần cấu hình' : 'Kiểm tra kết nối';
    }
  }
  function showError(message) {
    const el = ui('bb-auth-error');
    if (el) { el.hidden = false; el.textContent = message; }
    status('Xem thông báo và kiểm tra cấu hình, sau đó thử lại.', 'error');
  }
  function clearError() {
    const el = ui('bb-auth-error');
    if (el) { el.hidden = true; el.textContent = ''; }
  }
  function validBase() {
    try {
      const url = new URL(settings.workerUrl);
      return url.protocol === 'https:' ||
        (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
    } catch { return false; }
  }
  async function health() {
    if (healthCache) return healthCache;
    if (!validBase()) throw new Error('Chủ website chưa cấu hình URL Cloudflare Worker. GitHub Pages không thể tự tạo mã từ XiaoZhi.');
    const r = await fetch(settings.workerUrl + '/api/health', { mode: 'cors', cache: 'no-store' });
    if (!r.ok) throw new Error('Không truy cập được Worker (HTTP ' + r.status + ').');
    const data = await r.json();
    if (!data.ready || !data.turnstileSiteKey) throw new Error('Worker chưa thiết lập đủ Turnstile và khóa bí mật.');
    if (settings.googleClientId && !data.googleConfigured)
      throw new Error('Worker chưa khai báo GOOGLE_CLIENT_ID tương ứng với BilaBot.');
    if (!settings.googleClientId && data.googleConfigured)
      throw new Error('Worker yêu cầu Google nhưng landing chưa khai báo googleClientId trong docs/config.js.');
    healthCache = data;
    return data;
  }
  async function challenge(siteKey) {
    if (!window.turnstile?.render) throw new Error('Không tải được Cloudflare Turnstile; hãy kiểm tra tiện ích chặn nội dung.');
    const holder = ui('bb-turnstile');
    if (!holder) throw new Error('Thiếu vùng xác minh an toàn.');
    holder.hidden = false;
    holder.replaceChildren();
    status('Vui lòng hoàn thành xác minh Turnstile để tạo phiên chuyển tiếp.', 'busy');
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Turnstile hết thời gian xác minh.')), 90_000);
      try {
        window.turnstile.render(holder, {
          sitekey: siteKey, theme: 'light',
          callback: token => { clearTimeout(timeout); holder.hidden = true; resolve(token); },
          'error-callback': () => { clearTimeout(timeout); reject(new Error('Turnstile không xác minh được.')); },
          'expired-callback': () => { clearTimeout(timeout); reject(new Error('Turnstile đã hết hạn.')); }
        });
      } catch (e) { clearTimeout(timeout); reject(e); }
    });
  }
  function showProfile(profile) {
    verifiedProfile = profile || null;
    const box = ui('bb-google-profile');
    if (!box) return;
    box.hidden = !profile;
    if (profile) {
      setText('bb-google-name', profile.name || profile.email || 'Tài khoản Google');
      setText('bb-google-email', profile.email || 'Đã xác minh với Worker');
      const pic = ui('bb-google-avatar');
      if (pic) { pic.hidden = !profile.picture; if (profile.picture) pic.src = profile.picture; }
      setText('bb-google-state', 'Google đã xác minh');
      if (ui('bb-google-wrap')) ui('bb-google-wrap').hidden = true;
    } else {
      setText('bb-google-state', settings.googleClientId ? 'Chưa đăng nhập Google' : 'Google chưa cấu hình');
      if (ui('bb-google-wrap')) ui('bb-google-wrap').hidden = !settings.googleClientId;
    }
  }
  async function ensureSession() {
    if (settings.mode === 'direct') return '';
    if (transportSession && expiresAt > Date.now() + 15_000) return transportSession;
    if (pendingSession) return pendingSession;
    pendingSession = (async () => {
      const info = await health();
      let saved = null;
      try { saved = JSON.parse(sessionStorage.getItem(SESSION) || 'null'); } catch {}
      if (saved?.workerUrl === settings.workerUrl && saved.expiresAt > Date.now() + 20_000) {
        const r = await fetch(settings.workerUrl + '/api/me', {
          mode: 'cors', headers: { Authorization: 'Bearer ' + saved.token }
        });
        if (r.ok) {
          transportSession = saved.token;
          expiresAt = saved.expiresAt;
          if (saved.profile) showProfile(saved.profile);
          return transportSession;
        }
        sessionStorage.removeItem(SESSION);
      }
      if (settings.googleClientId && !googleToken)
        throw new Error('Vui lòng đăng nhập Google trên BilaBot trước khi tạo phiên chuyển tiếp.');
      const turnstileToken = await challenge(info.turnstileSiteKey);
      const r = await fetch(settings.workerUrl + '/api/auth/session', {
        method: 'POST', mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turnstileToken, googleIdToken: googleToken || undefined })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.session) throw new Error(data.error || 'Không tạo được phiên chuyển tiếp BilaBot.');
      if (settings.googleClientId && !data.googleVerified)
        throw new Error('Worker không xác nhận được Google Identity Services.');
      transportSession = data.session;
      expiresAt = data.expiresAt;
      if (data.profile) showProfile(data.profile);
      sessionStorage.setItem(SESSION, JSON.stringify({
        workerUrl: settings.workerUrl, token: transportSession,
        expiresAt, profile: data.profile || null
      }));
      status('Đã xác minh. BilaBot có thể yêu cầu mã kích hoạt XiaoZhi.', 'ready');
      return transportSession;
    })().finally(() => { pendingSession = null; });
    return pendingSession;
  }
  async function startPair() {
    if (pendingPair) return pendingPair;
    pendingPair = (async () => {
      clearError();
      status('Đang khởi tạo thiết bị ESP32 ảo và bắt đầu OTA provisioning…', 'busy');
      try {
        if (settings.mode === 'gateway') await ensureSession();
        document.body.classList.add('bilabot-open');
        for (let n = 0; n < 60; n++) {
          if (window.XiaozhiDebug?.quickTest) {
            await window.XiaozhiDebug.quickTest();
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error('Giao diện giọng nói chưa khởi tạo. Hãy thử lại bằng nút Kết nối trong BilaBot.');
      } catch (e) {
        document.body.classList.remove('bilabot-open');
        showError(e.message || 'Không thể ghép nối.');
      }
    })().finally(() => { pendingPair = null; });
    return pendingPair;
  }
  function signOut() {
    googleToken = '';
    transportSession = '';
    expiresAt = 0;
    sessionStorage.removeItem(SESSION);
    sessionStorage.removeItem(PROFILE);
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
    showProfile(null);
    status('Đã đăng xuất BilaBot. Việc ghép nối thiết bị XiaoZhi vẫn được lưu riêng trong trình duyệt.', 'idle');
  }
  async function googleCallback(response) {
    clearError();
    if (typeof response?.credential !== 'string' || !response.credential)
      return showError('Google không trả về ID token hợp lệ.');
    // A new Google identity must never reuse an earlier relay session.
    sessionStorage.removeItem(SESSION);
    transportSession = '';
    expiresAt = 0;
    verifiedProfile = null;
    googleToken = response.credential; // memory only; never put ID tokens in localStorage or URLs
    status('Đã nhận thông tin Google. Đang xác minh chữ ký tại Worker…', 'busy');
    try {
      await ensureSession();
      if (fixed.autoPair !== false) await startPair();
    } catch (e) { showError(e.message || 'Đăng nhập Google thất bại.'); }
  }
  function initGoogle() {
    const wrap = ui('bb-google-wrap');
    const placeholder = ui('bb-google-placeholder');
    if (!settings.googleClientId) {
      if (wrap) wrap.hidden = true;
      if (placeholder) placeholder.hidden = false;
      return true; // Absence of configuration is not a Google CDN loading failure.
    }
    if (placeholder) placeholder.hidden = true;
    if (!window.google?.accounts?.id) return false;
    if (googleInitialized) return true;
    googleInitialized = true;
    window.google.accounts.id.initialize({
      client_id: settings.googleClientId,
      callback: googleCallback,
      auto_select: false,
      cancel_on_tap_outside: true,
      ux_mode: 'popup'
    });
    const host = ui('bb-google-button');
    if (host) window.google.accounts.id.renderButton(host, {
      theme: 'outline', type: 'standard', text: 'signin_with',
      shape: 'pill', size: 'large', width: 298, logo_alignment: 'left'
    });
    return true;
  }
  function bind() {
    ui('bb-pair-start')?.addEventListener('click', startPair);
    ui('bb-open-app')?.addEventListener('click', () => document.body.classList.add('bilabot-open'));
    ui('bb-return-home')?.addEventListener('click', () => document.body.classList.remove('bilabot-open'));
    ui('bb-google-signout')?.addEventListener('click', signOut);
    ui('bb-save-config')?.addEventListener('click', () => {
      const url = ui('bb-api-input')?.value.trim().replace(/\/+$/, '') || '';
      const mode = ui('bb-relay-mode')?.value || 'gateway';
      if (url && url !== settings.workerUrl && !confirm(
        'Worker do bạn chọn sẽ tiếp nhận token thiết bị và dữ liệu thoại. Chỉ sử dụng Worker tin cậy. Lưu thay đổi?')) return;
      localStorage.setItem(SAVE, JSON.stringify({ workerUrl: url, mode }));
      sessionStorage.removeItem(SESSION);
      location.reload();
    });
    if (ui('bb-api-input')) ui('bb-api-input').value = settings.workerUrl;
    if (ui('bb-relay-mode')) ui('bb-relay-mode').value = settings.mode;
    let retries = 0;
    if (!initGoogle()) {
      const timer = setInterval(() => {
        if (initGoogle() || ++retries >= 24) {
          clearInterval(timer);
          if (retries >= 24) setText('bb-google-state', 'Không tải được Google Identity Services');
        }
      }, 350);
    }
    try {
      const previous = JSON.parse(sessionStorage.getItem(SESSION) || 'null');
      if (previous?.workerUrl === settings.workerUrl && previous.expiresAt > Date.now() + 20_000 && previous.profile && validBase()) {
        // Validate the stored relay session server-side before displaying a verified profile.
        ensureSession().catch(() => { sessionStorage.removeItem(SESSION); showProfile(null); });
      }
    } catch {}
    if (settings.mode === 'direct')
      status('Chế độ trực tiếp chỉ dành cho máy chủ tự quản hỗ trợ CORS và WebSocket của trình duyệt.', 'idle');
    else if (!validBase())
      status('Landing đã sẵn sàng. Chủ website cần cấu hình Worker để nhận mã kích hoạt thật.', 'error');
    else {
      status('Đang kiểm tra gateway OTA…', 'busy');
      health().then(() => status('Gateway sẵn sàng. Đăng nhập Google và mở XiaoZhi để ghép nối.', 'ready'))
        .catch(e => showError(e.message));
    }
  }
  window.BilaBotBridge = {
    get mode() { return settings.mode; },
    get apiBase() { return settings.workerUrl; },
    get sessionToken() { return transportSession && expiresAt > Date.now() + 10_000 ? transportSession : ''; },
    get googleProfile() { return verifiedProfile; },
    ensureSession, startPair, official: 'https://xiaozhi.me/console/agents'
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
