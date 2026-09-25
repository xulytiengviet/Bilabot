/** BilaBot PUBLIC configuration; commit only public client IDs and Worker URLs here.
 * Google Identity Services (GIS) signs into BilaBot. XiaoZhi console login
 * remains separate; XiaoZhi alone issues device activation codes.
 */
window.BILABOT_CONFIG = Object.freeze({
  workerUrl: '', // https://bilabot-gateway.<your-account>.workers.dev
  googleClientId: '', // ...apps.googleusercontent.com (public, never client secret)
  mode: 'gateway',
  autoPair: true
});
