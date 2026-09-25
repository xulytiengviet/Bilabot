/** Public connection configuration. NO Google Client ID or password required.
 * To use the OFFICIAL XiaoZhi server from GitHub Pages, the site owner must
 * deploy worker/ with Turnstile and supply its PUBLIC workers.dev URL.
 * Direct mode works only if a self-hosted server explicitly supports
 * cross-origin OTA and WebSocket authentication without custom headers.
 */
window.BILABOT_CONFIG=Object.freeze({ workerUrl:'',mode:'gateway',autoPair:false });
