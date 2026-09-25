import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html=readFileSync('docs/index.html','utf8');
const css=readFileSync('docs/direct-setup.css','utf8');
const source=readFileSync('docs/direct-setup.js','utf8');
const auth=readFileSync('docs/auth.js','utf8');
const app=readFileSync('docs/static/app.js','utf8');

function bootstrap({paired=false,backend=''}={}){
  const events={};
  const elements=new Map();
  const classes=new Set(['bilabot-open']);
  const focus=[];
  const settings=[];
  const data={};
  const makeElement=id=>{
    if(!elements.has(id))elements.set(id,{
      id,textContent:'',dataset:{},style:{},open:false,scrollTop:10,attributes:{},
      handlers:{},classList:{
        values:new Set(),
        add(s){this.values.add(s);},remove(s){this.values.delete(s);}
      },
      focus(){focus.push(id);},
      setAttribute(k,v){this.attributes[k]=v;},
      addEventListener(k,fn){this.handlers[k]=fn;}
    });
    return elements.get(id);
  };
  const body={classList:{
    add(...names){names.forEach(n=>classes.add(n));},
    remove(...names){names.forEach(n=>classes.delete(n));},
    contains(n){return classes.has(n);}
  }};
  const document={
    body,getElementById:makeElement,
    addEventListener(k,fn){events['document:'+k]=fn;}
  };
  const window={
    location:{hash:'',pathname:'/Bilabot/',search:''},
    BilaBotAppReady:false,
    BilaBotBridge:{apiBase:backend},
    addEventListener(k,fn){events['window:'+k]=fn;},
    XiaozhiDebug:{
      assistants:{getActiveId:()=> 'assistant-1',isPairedById:()=>paired},
      protocol:{isConnected:()=>false},
      ui:{openSettingsFor(id){settings.push(id);}}
    }
  };
  new Function('window','document',source)(window,document);
  const emit=(name,detail={})=>events['window:'+name]({detail});
  const click=id=>makeElement(id).handlers.click({currentTarget:makeElement(id),
    target:makeElement(id)});
  return {window,document,events,classes,focus,settings,elements,el:makeElement,emit,click};
}

test('root opens the real Olivia-style app and contains direct setup controls',()=>{
  assert.match(html,/<body class="bilabot-open">/);
  for(const id of ['app','bb-setup','bb-open-setup-sidebar','bb-open-setup-chat',
    'bb-close-setup','bb-open-assistant-settings','bb-pair-start','bb-code-value','bb-copy-code']){
    assert.equal(html.split('id="'+id+'"').length-1,1,'missing or duplicate '+id);
  }
  assert.ok(html.includes('./direct-setup.css?v=direct1'));
  assert.ok(html.includes('./direct-setup.js?v=direct1'));
  assert.ok(css.includes('body.bilabot-open.bb-setup-open'));
  assert.ok(css.includes('@media(max-width:768px)'));
  assert.ok(app.includes('window.BilaBotDirect?.isOpen?.()'));
  assert.ok(app.includes('openSettingsFor,'));
  assert.ok(auth.includes('window.BilaBotDirect?.closeSetup?.('));
});

test('unpaired first visit opens setup, allows gateway configuration and safe closing',()=>{
  const ctx=bootstrap({backend:''});
  ctx.emit('bilabot:app-ready');
  assert.equal(ctx.classes.has('bilabot-open'),true);
  assert.equal(ctx.classes.has('bb-setup-open'),true);
  assert.equal(ctx.el('bilabot-gate').attributes['aria-hidden'],'false');
  assert.equal(ctx.el('bb-selfconfig').open,true);
  assert.equal(ctx.focus.at(-1),'bb-close-setup');
  ctx.click('bb-close-setup');
  assert.equal(ctx.classes.has('bb-setup-open'),false);
  assert.equal(ctx.classes.has('bilabot-open'),true);
  assert.equal(ctx.el('bilabot-gate').attributes['aria-hidden'],'true');
  ctx.click('bb-open-setup-sidebar');
  assert.equal(ctx.classes.has('bb-setup-open'),true);
  ctx.click('bb-open-assistant-settings');
  assert.equal(ctx.classes.has('bb-setup-open'),false);
  assert.deepEqual(ctx.settings,['assistant-1']);
});

test('paired first visit keeps chat visible; connect button can reopen OTA setup',()=>{
  const ctx=bootstrap({paired:true,backend:'https://example.pages.dev'});
  ctx.emit('bilabot:app-ready');
  assert.equal(ctx.classes.has('bb-setup-open'),false);
  assert.match(ctx.el('bb-sidebar-pair-state').textContent,/đã ghép nối/i);
  ctx.emit('bilabot:pairing',{phase:'checking'});
  assert.equal(ctx.classes.has('bb-setup-open'),true);
  ctx.emit('bilabot:pairing',{phase:'code',code:'001234'});
  assert.match(ctx.el('bb-sidebar-pair-state').textContent,/Mã OTA/);
  ctx.events['document:keydown']({key:'Escape',preventDefault(){}});
  assert.equal(ctx.classes.has('bb-setup-open'),false);
  assert.equal(ctx.classes.has('bilabot-open'),true);
});

test('explicit setup fragment opens drawer for previously paired user',()=>{
  const ctx=bootstrap({paired:true});
  ctx.window.location.hash='#bb-setup';
  ctx.emit('bilabot:app-ready');
  assert.equal(ctx.classes.has('bb-setup-open'),true);
});
