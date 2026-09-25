/** Shared Cloudflare Pages application and optional GitHub Pages entry.
 * Both UI and Hono gateway have the same origin on Cloudflare Pages.
 * No Google GIS or XiaoZhi website cookie access is needed.
 */
(() => {
 'use strict';
 const github = location.hostname.toLowerCase() === 'xulytiengviet.github.io';
 let deployed = '';
 try {
  const input=String(window.BILABOT_DEPLOY_URL||'').trim();
  if(input){const u=new URL(input);if(u.protocol==='https:'&&u.hostname!==location.hostname&&!u.username&&!u.password)deployed=u.origin;}
 }catch{}
 if(github&&deployed)location.replace(deployed+'/'+location.search+location.hash);
 window.BILABOT_CONFIG=Object.freeze({
  workerUrl:github?deployed:location.origin,sameOrigin:!github,
  mode:'gateway',autoPair:false
 });
})();
