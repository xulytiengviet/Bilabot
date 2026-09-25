import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('docs/static/app.js', 'utf8');
const auth = readFileSync('docs/auth.js', 'utf8');
const html = readFileSync('docs/index.html', 'utf8');
const first = app.indexOf('const ProvisioningManager = (() => {');
const last = app.indexOf('// MODULE: AudioEngine', first);
assert.ok(first >= 0 && last > first);
const factory = new Function('AssistantManager','Logger','BilaBotGateway',
  'navigator','setTimeout','clearTimeout',
  app.slice(first,last) + '\nreturn ProvisioningManager;');

function device(overrides, fetcher) {
  const values = {
    deviceId:'aa:bb:cc:dd:ee:ff',
    clientId:'11111111-1111-4111-8111-111111111111',
    otaUrl:'https://api.tenclass.net/xiaozhi/ota/',
    paired:false, token:'', ...overrides
  };
  const manager = {
    getFlatField:(_,key)=>values[key],
    setFlatField:(_,key,value)=>{values[key]=value;},
    getFlatSnapshot:()=>({...values})
  };
  const logger={auth(){},warn(){},error(){}};
  const provision=factory(manager,logger,{fetch:fetcher},{language:'vi-VN'},
    fn=>{Promise.resolve().then(fn);return 1;},()=>{}).create('test-assistant');
  return {values,provision};
}

test('a fresh device never treats test-token as completed pairing', async()=>{
  const {values,provision}=device({},async()=>({
    ok:true,status:200,json:async()=>({websocket:{token:'test-token'}})
  }));
  await assert.rejects(provision.provision(),/OTA chưa cấp mã kích hoạt/);
  assert.equal(values.paired,false);
});

test('six-digit OTA code preserves leading zeros and requires approval + second OTA check', async()=>{
  let polls=0,confirmed=false;
  const {values,provision}=device({},async path=>{
    if(path==='/api/ota/check')return {ok:true,status:200,
      json:async()=>confirmed
        ?{websocket:{token:'device-token',url:'wss://api.tenclass.net/xiaozhi/v1/'}}
        :{activation:{code:'004201',challenge:'challenge'},
          websocket:{token:'test-token'}}};
    if(path==='/api/ota/activate'){
      polls++;if(polls>=2)confirmed=true;
      return {status:confirmed?200:202,json:async()=>({})};
    }
    throw new Error('Unexpected request '+path);
  });
  const result=await provision.provision();
  assert.equal(result.code,'004201');
  assert.equal(values.paired,false);
  await provision.waitForActivation();
  assert.equal(polls,2);
  assert.equal(values.paired,true);
  assert.equal(values.token,'device-token');
});

test('challenge-only OTA responses do not result in fake pairing',async()=>{
  const {values,provision}=device({},async()=>({
    ok:true,status:200,json:async()=>({activation:{challenge:'without-code'}})
  }));
  await assert.rejects(provision.provision(),/challenge nhưng không cấp mã/);
  assert.equal(values.paired,false);
});

test('inline setup displays and copies server code; chat opens only after hello',async()=>{
  for(const id of ['bb-code-preview','bb-code-value','bb-copy-code','bb-code-actions','bb-pair-progress'])
    assert.ok(html.includes('id="'+id+'"'),'missing element '+id);
  const listeners={},elements=new Map(),opened=new Set(),timers=[],copied=[];
  function el(id){
    if(!elements.has(id))elements.set(id,{
      textContent:'',hidden:true,disabled:false,value:'',dataset:{},handlers:{},
      addEventListener(name,fn){this.handlers[name]=fn;},
      setAttribute(name,value){this[name]=value;},replaceChildren(){}
    });
    return elements.get(id);
  }
  class FakeURL{
    constructor(url){
      if(!String(url).startsWith('https://'))throw Error('Invalid URL');
      this.protocol='https:';this.hostname=String(url).split('/')[2];
    }
  }
  const win={
    BILABOT_CONFIG:{workerUrl:'https://bilabot.example.pages.dev',sameOrigin:true,mode:'gateway'},
    addEventListener(name,fn){listeners[name]=fn;}
  };
  const doc={getElementById:el,body:{classList:{
    add(name){opened.add(name);},remove(name){opened.delete(name);}
  }}};
  const memory={getItem(){return null;},setItem(){},removeItem(){}};
  new Function('window','document','localStorage','sessionStorage','location',
    'navigator','URL','setTimeout','confirm',auth)(
    win,doc,memory,memory,{origin:'https://bilabot.example.pages.dev'},
    {clipboard:{async writeText(code){copied.push(code);}}},
    FakeURL,fn=>{timers.push(fn);},()=>true
  );
  const emit=(phase,rest={})=>listeners['bilabot:pairing']({detail:{phase,...rest}});
  emit('checking');emit('code',{code:'004201'});
  assert.equal(el('bb-code-value').textContent,'004201');
  assert.equal(el('bb-code-actions').hidden,false);
  await el('bb-copy-code').handlers.click();
  assert.deepEqual(copied,['004201']);
  emit('paired');assert.equal(opened.has('bilabot-open'),false);
  emit('connected');assert.equal(opened.has('bilabot-open'),false);
  timers.forEach(fn=>fn());assert.equal(opened.has('bilabot-open'),true);
  emit('error',{message:'Gateway unavailable'});
  assert.equal(el('bb-auth-error').textContent,'Gateway unavailable');
});
