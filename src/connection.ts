// Fixed demo identity. The server this demo knocks is the OpenNHP "example"
// plugin exposing the "web" resource. These stay constant; the server address
// and public key are configured by the user at link time (see serverStore.ts).
export const ASP_ID = 'example';
export const RES_ID = 'web';
export const CLUSTER = 'opennhp';
export const ORG_ID = 'opennhp';
// Peer expiry far in the future. The device key itself lasts 24 hours.
export const SERVER_KEY_EXPIRE = 1924991999;

// The site that a successful knock opens.
export function siteUrl(host: string): string {
  return `http://${host}/`;
}
