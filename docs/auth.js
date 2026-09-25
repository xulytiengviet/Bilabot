/**
 * BilaBot browser shell: use official XiaoZhi website for Google login.
 * A cross-origin GitHub Pages app CANNOT read that Google/XiaoZhi session.
 * The device activation code is only obtained from XiaoZhi OTA.
 * Official XiaoZhi requires a small gateway for OTA/CORS and WebSocket
 * custom headers. A direct mode is exposed ONLY for compatible self-hosts.
 */
(function () {
  'use strict';
  const SAVE='bilabot-connection-v2', SESSION='bilabot-transport-session-v2';
  const ui=id=>document.getElementById(id), official='https://xiaozhi.me/console/agents';
  const fixed=window.BILABOT_CONFIG||{};
  let saved={};try{saved=JSON.parse(localStorage.getItem(SAVE)||'{}')}catch{}
  const settings={
    workerUrl: String(saved.workerUrl || fixed.workerUrl || '').trim().replace(/\/+$/,''),
    mode: saved.mode==='direct'?'direct':(fixed.mode==='direct'?'direct':'gateway')
  };
  let transportSession='', expiresAt=0, healthCache=null, pending=null;
  const setStatus=message=>{if(ui('bb-auth-status'))ui('bb-auth-status').textContent=message;};
  const showError=message=>{
    const el=ui('bb-auth-error');if(el){el.hidden=false;el.textContent=message;}
    setStatus('Có thể mở giao diện BilaBot để xem nhật ký kết nối và thử lại.');
  };
  const hideError=()=>{const el=ui('bb-auth-error');if(el){el.hidden=true;el.textContent='';}};
  const validBase=()=>{
    try{const u=new URL(settings.workerUrl);return u.protocol==='https:'||
      (u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname));}
    catch{return false;}
  };
  async function health(){
    if(healthCache)return healthCache;
    if(!validBase())throw new Error('Chưa cấu hình Worker hợp lệ. Chế độ chính thức cần proxy; xem mục Cấu hình kết nối nâng cao.');
    const res=await fetch(settings.workerUrl+'/api/health',{mode:'cors',cache:'no-store'});
    if(!res.ok)throw new Error('Không truy cập được Worker ('+res.status+').');
    const data=await res.json();
    if(!data.ready||!data.turnstileSiteKey)throw new Error('Worker chưa thiết lập bảo vệ Turnstile hoặc các khóa bí mật.');
    return(healthCache=data);
  }
  async function challenge(siteKey){
    if(!window.turnstile?.render)throw new Error('Không tải được Cloudflare Turnstile. Vui lòng tắt tiện ích chặn captcha rồi thử lại.');
    const holder=ui('bb-turnstile');if(!holder)throw new Error('Thiếu vùng Turnstile.');
    holder.hidden=false;holder.replaceChildren();
    setStatus('Xác nhận kết nối an toàn với proxy (không cần đăng nhập Google lần nữa)…');
    return await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('Hết thời gian xác thực Turnstile.')),90000);
      try{
        window.turnstile.render(holder,{sitekey:siteKey,theme:'light',
          callback:token=>{clearTimeout(timeout);holder.hidden=true;resolve(token);},
          'error-callback':()=>{clearTimeout(timeout);reject(new Error('Không xác thực được Turnstile.'));},
          'expired-callback':()=>{clearTimeout(timeout);reject(new Error('Turnstile đã hết hạn, vui lòng thử lại.'))}
        });
      }catch(e){clearTimeout(timeout);reject(e);}
    });
  }
  async function ensureSession(){
    if(settings.mode==='direct')return '';
    if(transportSession&&expiresAt>Date.now()+15_000)return transportSession;
    if(pending)return pending;
    pending=(async()=>{
      // Only issue a transport session; do not use or impersonate XiaoZhi login.
      const cache=await health();
      let stored=null;try{stored=JSON.parse(sessionStorage.getItem(SESSION)||'null')}catch{}
      if(stored?.workerUrl===settings.workerUrl&&stored.expiresAt>Date.now()+20_000){
        const resp=await fetch(settings.workerUrl+'/api/me',
          {headers:{Authorization:'Bearer '+stored.token}});
        if(resp.ok){transportSession=stored.token;expiresAt=stored.expiresAt;return transportSession;}
      }
      const token=await challenge(cache.turnstileSiteKey);
      const res=await fetch(settings.workerUrl+'/api/auth/session',{method:'POST',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({turnstileToken:token})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.session)throw new Error(data.error||'Không cấp được phiên chuyển tiếp.');
      transportSession=data.session;expiresAt=data.expiresAt;
      sessionStorage.setItem(SESSION,JSON.stringify({workerUrl:settings.workerUrl,token:transportSession,expiresAt}));
      setStatus('Phiên chuyển tiếp đã sẵn sàng. Đang yêu cầu mã từ XiaoZhi…');
      return transportSession;
    })().finally(()=>{pending=null;});
    return pending;
  }
  async function startPair(){
    hideError();
    setStatus('Đang khởi tạo thiết bị XiaoZhi ảo…');
    try{
      if(settings.mode==='gateway')await ensureSession();
      document.body.classList.add('bilabot-open');
      for(let i=0;i<50;i++){
        if(window.XiaozhiDebug?.quickTest){
          await window.XiaozhiDebug.quickTest();
          return;
        }
        await new Promise(resolve=>setTimeout(resolve,120));
      }
      throw new Error('Giao diện chưa khởi tạo; hãy dùng nút Kết nối trong BilaBot.');
    }catch(e){showError(e.message);document.body.classList.remove('bilabot-open');}
  }
  ui('bb-pair-start')?.addEventListener('click',startPair);
  ui('bb-open-app')?.addEventListener('click',()=>document.body.classList.add('bilabot-open'));
  ui('bb-return-home')?.addEventListener('click',()=>document.body.classList.remove('bilabot-open'));
  ui('bb-save-config')?.addEventListener('click',()=>{
    const url=ui('bb-api-input').value.trim().replace(/\/+$/,'');
    const mode=ui('bb-relay-mode').value;
    if(url&&url!==settings.workerUrl&&!confirm(
      'Worker do bạn chọn sẽ nhận token thiết bị và âm thanh của bạn. Chỉ kết nối Worker mà bạn tin cậy. Tiếp tục?'))return;
    localStorage.setItem(SAVE,JSON.stringify({workerUrl:url,mode}));
    sessionStorage.removeItem(SESSION);location.reload();
  });
  if(ui('bb-api-input'))ui('bb-api-input').value=settings.workerUrl;
  if(ui('bb-relay-mode'))ui('bb-relay-mode').value=settings.mode;
  if(settings.mode==='direct')setStatus('Chế độ trực tiếp: chỉ dùng với máy chủ cho phép CORS và không yêu cầu custom WebSocket headers.');
  else if(!validBase())setStatus('Chủ website cần cấu hình Worker để kết nối máy chủ XiaoZhi chính thức. Bạn vẫn có thể mở giao diện BilaBot.');
  else setStatus('Đăng nhập trên XiaoZhi, sau đó nhấn Tạo mã kích hoạt.');
  window.BilaBotBridge={
    get mode(){return settings.mode;},
    get apiBase(){return settings.workerUrl;},
    get sessionToken(){return transportSession&&expiresAt>Date.now()+10_000?transportSession:'';},
    ensureSession, startPair, official
  };
})();
