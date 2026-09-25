/**
 * BilaBot interface with integrated Cloudflare Pages Hono gateway.
 * Google login remains exclusively at the official XiaoZhi website.
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
    workerUrl: fixed.sameOrigin ? location.origin : String(saved.workerUrl || fixed.workerUrl || '').trim().replace(/\/+$/,''),
    mode: saved.mode==='direct'?'direct':(fixed.mode==='direct'?'direct':'gateway')
  };
  let transportSession='', expiresAt=0, healthCache=null, pending=null;
  const setStatus=message=>{if(ui('bb-auth-status'))ui('bb-auth-status').textContent=message;const pill=ui('bb-server-state');if(pill)pill.textContent=/sẵn sàng|Đăng nhập|Đang yêu cầu/i.test(message)?'Sẵn sàng':'Kiểm tra kết nối';};
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
    if(!validBase())throw new Error('Cloudflare Pages chưa được triển khai hoặc chưa cấu hình.');
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
  let pairingInFlight=null, lastActivationCode='', currentPhase='idle';
  const preview=()=>ui('bb-code-preview');
  function pairProgress(phase,message){
    currentPhase=phase;
    if(preview())preview().dataset.phase=phase;
    if(ui('bb-pair-progress'))ui('bb-pair-progress').textContent=message;
    setStatus(message);
  }
  function handlePairingEvent(event){
    const d=event?.detail||{}, phase=d.phase;
    if(phase==='checking'){
      lastActivationCode='';
      if(ui('bb-code-value'))ui('bb-code-value').textContent='— — — — — —';
      if(ui('bb-code-hint'))ui('bb-code-hint').textContent='Đang yêu cầu mã thật từ máy chủ OTA…';
      if(ui('bb-code-actions'))ui('bb-code-actions').hidden=true;
      pairProgress('checking','Đang kiểm tra thiết bị ảo với XiaoZhi OTA…');
    }else if(phase==='code'){
      // Only accept the code obtained from the active device's OTA result.
      const code=String(d.code||'').trim();
      if(!code)return handlePairingEvent({detail:{phase:'error',message:'OTA chưa trả về mã kích hoạt hợp lệ.'}});
      lastActivationCode=code;
      if(ui('bb-code-value')){ui('bb-code-value').textContent=code;ui('bb-code-value').setAttribute('aria-label','Mã kích hoạt '+code);}
      if(ui('bb-code-hint'))ui('bb-code-hint').textContent='Sao chép mã, mở XiaoZhi → AI Agents → thêm thiết bị và nhập mã này.';
      if(ui('bb-code-actions'))ui('bb-code-actions').hidden=false;
      pairProgress('code','Đã nhận mã OTA. Đang tự kiểm tra ghép nối sau mỗi 3 giây…');
    }else if(phase==='paired'){
      pairProgress('paired','XiaoZhi đã xác nhận ghép nối! Đang thiết lập kết nối giọng nói…');
      if(ui('bb-code-hint'))ui('bb-code-hint').textContent='Mã đã được xác nhận. Đang kết nối WebSocket…';
    }else if(phase==='connecting'){
      pairProgress('connecting','Đang chờ XiaoZhi xác nhận kết nối WebSocket…');
    }else if(phase==='connected'){
      pairProgress('connected','Đã kết nối XiaoZhi. Đang mở giao diện BilaBot…');
      if(ui('bb-code-hint'))ui('bb-code-hint').textContent='Thiết bị đã hoạt động. Nhấn micro để cấp quyền và bắt đầu trò chuyện.';
      if(ui('bb-pair-start'))ui('bb-pair-start').disabled=false;
      setTimeout(()=>document.body.classList.add('bilabot-open'),700);
    }else if(phase==='disconnected'){
      if(currentPhase!=='connected'&&currentPhase!=='error')
        handlePairingEvent({detail:{phase:'error',message:d.message||'XiaoZhi đóng WebSocket trước khi xác nhận kết nối.'}});
    }else if(phase==='error'){
      const message=String(d.message||'Không thể lấy mã hoặc kết nối tới XiaoZhi.');
      pairProgress('error',message);
      showError(message);
      if(ui('bb-pair-start'))ui('bb-pair-start').disabled=false;
      if(ui('bb-code-hint')&&!lastActivationCode)ui('bb-code-hint').textContent='Không có mã giả. Kiểm tra kết nối và nhấn Lấy mã để thử lại.';
    }
  }
  window.addEventListener('bilabot:pairing',handlePairingEvent);
  async function startPair(){
    if(pairingInFlight)return pairingInFlight;
    hideError();
    if(ui('bb-pair-start'))ui('bb-pair-start').disabled=true;
    handlePairingEvent({detail:{phase:'checking'}});
    pairingInFlight=(async()=>{
      try{
        if(settings.mode==='gateway')await ensureSession();
        // Leave the setup card visible while OTA responds and the user enters
        // the code at xiaozhi.me. The app opens only after server hello.
        for(let i=0;i<50;i++){
          if(window.XiaozhiDebug?.quickTest){
            await window.XiaozhiDebug.quickTest();
            return;
          }
          await new Promise(resolve=>setTimeout(resolve,120));
        }
        throw new Error('Giao diện chưa khởi tạo; vui lòng tải lại trang.');
      }catch(e){
        handlePairingEvent({detail:{phase:'error',message:e?.message||'Không thể ghép nối.'}});
      }
    })().finally(()=>{
      pairingInFlight=null;
      if(ui('bb-pair-start'))ui('bb-pair-start').disabled=false;
    });
    return pairingInFlight;
  }
  ui('bb-copy-code')?.addEventListener('click',async()=>{
    if(!lastActivationCode)return;
    try{
      await navigator.clipboard.writeText(lastActivationCode);
      if(ui('bb-code-hint'))ui('bb-code-hint').textContent='Đã sao chép! Dán mã vào mục Thêm thiết bị trên XiaoZhi.';
    }catch{
      if(ui('bb-code-hint'))ui('bb-code-hint').textContent='Không thể truy cập clipboard. Hãy chọn mã phía trên và sao chép thủ công.';
    }
  });
  ui('bb-pair-start')?.addEventListener('click',startPair);
  ui('bb-open-app')?.addEventListener('click',()=>document.body.classList.add('bilabot-open'));
  ui('bb-return-home')?.addEventListener('click',()=>document.body.classList.remove('bilabot-open'));
  ui('bb-save-config')?.addEventListener('click',()=>{
    const url=ui('bb-api-input').value.trim().replace(/\/+$/,'');
    const mode=ui('bb-relay-mode').value;
    if(url&&!fixed.sameOrigin&&url!==settings.workerUrl&&!confirm(
      'Worker do bạn chọn sẽ nhận token thiết bị và âm thanh của bạn. Chỉ kết nối Worker mà bạn tin cậy. Tiếp tục?'))return;
    localStorage.setItem(SAVE,JSON.stringify({workerUrl:fixed.sameOrigin?location.origin:url,mode}));
    sessionStorage.removeItem(SESSION);location.reload();
  });
  if(ui('bb-api-input'))ui('bb-api-input').value=settings.workerUrl;
  if(ui('bb-relay-mode'))ui('bb-relay-mode').value=settings.mode;
  if(settings.mode==='direct')setStatus('Chế độ trực tiếp: chỉ dùng với máy chủ cho phép CORS và không yêu cầu custom WebSocket headers.');
  else if(!validBase())setStatus('GitHub Pages đang chờ địa chỉ Cloudflare Pages. Bạn vẫn có thể xem giao diện BilaBot.');
  else setStatus('Đăng nhập trên XiaoZhi, sau đó nhấn Tạo mã kích hoạt.');
  window.BilaBotBridge={
    get mode(){return settings.mode;},
    get apiBase(){return settings.workerUrl;},
    get sessionToken(){return transportSession&&expiresAt>Date.now()+10_000?transportSession:'';},
    ensureSession, startPair, official
  };
})();
