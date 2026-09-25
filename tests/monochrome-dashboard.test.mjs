import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync('docs/index.html','utf8');
const css=readFileSync('docs/monochrome-dashboard.css','utf8');
const dashboard=readFileSync('docs/monochrome-dashboard.js','utf8');
const app=readFileSync('docs/static/app.js','utf8');

function mount({health={ready:true,turnstileSiteKey:'site-key'},sameOrigin=false}={}){
  const elements=new Map(),listeners=new Map(),events=[],calls=[];
  function element(id){
    if(!elements.has(id))elements.set(id,{
      id,value:'',textContent:'',hidden:false,disabled:false,scrollTop:10,dataset:{},
      attributes:{},handlers:{},children:[],style:{},
      setAttribute(k,v){this.attributes[k]=v;},
      removeAttribute(k){delete this.attributes[k];},
      addEventListener(k,fn){this.handlers[k]=fn;},
      click(){calls.push('click:'+this.id);this.handlers.click?.({preventDefault(){},stopImmediatePropagation(){}});},
      appendChild(node){this.children.push(node);},
      querySelector(){return null;}
    });
    return elements.get(id);
  }
  const tabs=['overview','assistant','connection','device','protocol','audio','data'].map(p=>{
    const el=element('tab:'+p);el.dataset.pane=p;
    el.classList={
      values:new Set(),toggle(k,on){if(on)this.values.add(k);else this.values.delete(k);}
    };return el;
  });
  const panel=element('settingsPanel');
  panel.querySelectorAll=sel=>sel==='.bb-db-tab'?tabs:sel==='[data-go-pane]'?[element('quick-connection')]:[];
  element('quick-connection').dataset.goPane='connection';
  panel.classList={contains:()=>true};
  const backup=element('backup-card');
  element('globalSettingsPanel').querySelector=()=>backup;
  element('bb-relay-mode').value='gateway';
  element('bb-api-input').value='https://gateway.pages.dev';
  element('wsUrlInput').value='wss://api.xiaozhi.me/xiaozhi/v1/';
  element('otaUrlInput').value='https://api.tenclass.net/xiaozhi/ota/';
  const body={classList:{add(name){events.push('body:'+name);}}};
  const document={body,getElementById:element,
    addEventListener(k,fn){listeners.set('document:'+k,fn);}};
  const api={
    assistants:{
      getActiveId:()=> 'assistant-1',getById:()=>({name:'BilaBot AI'}),
      getAllAssistants:()=>[{name:'BilaBot AI'}],isPairedById:()=>true
    },
    ui:{getSettingsTargetIdPublic:()=> 'assistant-1',openSettingsFor:id=>calls.push('open:'+id)},
    sessionManager:{getSession:()=>({protocol:{isConnected:()=>false}})},
    backup:{updateLastBackupDisplay:()=>calls.push('backup-refresh')}
  };
  const window={
    BILABOT_CONFIG:{sameOrigin},BilaBotBridge:{apiBase:'https://gateway.pages.dev',mode:'gateway'},
    location:{origin:'https://xulytiengviet.github.io'},
    XiaozhiDebug:api,BilaBotDirect:{openSetup(){calls.push('pairing-open');}},
    addEventListener(k,fn){listeners.set('window:'+k,fn);}
  };
  const fakeFetch=async url=>{calls.push('fetch:'+url);return {ok:true,json:async()=>health};};
  new Function('window','document','fetch','URL','setTimeout','clearTimeout','AbortController',dashboard)(
    window,document,fakeFetch,URL,()=>1,()=>{},class{signal={};abort(){}}
  );
  return {elements,element,tabs,panel,window,document,calls,events,
    dispatch:(name,detail={})=>listeners.get('window:'+name)?.({detail})};
}

test('Vietnamese dashboard has seven unique tabs and preserves original assistant controls',()=>{
  for(const pane of ['overview','assistant','connection','device','protocol','audio','data']){
    assert.match(html,new RegExp('class="bb-db-tab(?: active)?" data-pane="'+pane+'"'));
    assert.match(html,new RegExp('data-pane="'+pane+'" id="bb-dash-'+pane+'"'));
  }
  for(const id of ['settingsPanel','saveSettingsBtn','wsUrlInput','otaUrlInput','audioEnabled',
    'ttsPlayback','protocolVersionInput','deviceIdInput','clientIdInput','bb-db-proxy-url',
    'bb-db-save-gateway','bb-db-backup-slot']){
    assert.equal(html.split('id="'+id+'"').length-1,1,'ID missing/duplicated: '+id);
  }
  assert.ok(html.includes('monochrome-dashboard.css?v=mono1'));
  assert.ok(html.includes('monochrome-dashboard.js?v=mono1'));
  assert.ok(css.includes('background:#171717'));
  assert.ok(css.includes('@media(max-width:600px)'));
  assert.ok(app.includes('bilabot:settings-open'));
  assert.ok(app.includes("BilaBotDashboard?.activate('data')"));
});

test('dashboard uses the actual active assistant and moves native backup controls',()=>{
  const t=mount();t.dispatch('bilabot:settings-open');
  assert.equal(t.panel.dataset.pane,'overview');
  assert.equal(t.element('bb-db-assistant-name').textContent,'BilaBot AI');
  assert.equal(t.element('bb-db-pairing').textContent,'Đã ghép nối');
  assert.equal(t.element('bb-db-backup-slot').children.length,1);
  assert.ok(t.events.includes('body:bb-mono-settings'));
  t.tabs.find(b=>b.dataset.pane==='data').handlers.click();
  assert.equal(t.panel.dataset.pane,'data');
  assert.ok(t.calls.includes('backup-refresh'));
});

test('gateway health readiness is based on live ready:true and Turnstile',async()=>{
  const t=mount();t.window.BilaBotDashboard.activate('connection');
  await t.window.BilaBotDashboard.checkGateway();
  assert.ok(t.calls.includes('fetch:https://gateway.pages.dev/api/health'));
  assert.equal(t.element('bb-db-gateway').textContent,'Sẵn sàng');
  assert.equal(t.element('bb-db-check-gateway').disabled,false);
  const missing=mount({health:{ready:false}});
  missing.window.BilaBotDashboard.activate('connection');
  await missing.window.BilaBotDashboard.checkGateway();
  assert.equal(missing.element('bb-db-gateway').textContent,'Chưa sẵn sàng');
});

test('gateway URL validation rejects credentials and reuses existing secure save',()=>{
  const t=mount();t.window.BilaBotDashboard.activate('connection');
  t.element('bb-db-proxy-url').value='https://user:secret@unknown.example';
  t.element('bb-db-save-gateway').handlers.click();
  assert.equal(t.calls.filter(s=>s==='click:bb-save-config').length,0);
  t.element('bb-db-proxy-url').value='https://gateway.pages.dev';
  t.element('bb-db-save-gateway').handlers.click();
  assert.ok(t.calls.includes('click:bb-save-config'));
  assert.equal(t.element('bb-api-input').value,'https://gateway.pages.dev');
});

test('quick OTA opens the native XiaoZhi setup and invalid WebSocket settings cannot be saved',()=>{
  const t=mount();t.element('bb-db-open-pairing').handlers.click();
  assert.ok(t.calls.includes('click:closeSettingsBtn'));
  assert.ok(t.calls.includes('pairing-open'));
  t.element('wsUrlInput').value='http://insecure.example';
  let prevented=false;let stopped=false;
  t.element('saveSettingsBtn').handlers.click({
    preventDefault(){prevented=true;},
    stopImmediatePropagation(){stopped=true;}
  });
  assert.equal(prevented,true);assert.equal(stopped,true);
  assert.equal(t.panel.dataset.pane,'connection');
  assert.match(t.element('bb-db-validation').textContent,/WebSocket/);
});

test('direct dashboard URL opens assistant settings after app initialization',()=>{
  const t=mount();
  t.window.location.hash='#bb-dashboard';
  t.dispatch('bilabot:app-ready');
  assert.ok(t.calls.includes('open:assistant-1'));
  assert.equal(t.panel.dataset.pane,'overview');
});
