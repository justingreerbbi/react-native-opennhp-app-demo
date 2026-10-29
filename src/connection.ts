/**
 * Demo defaults and routing identifiers; no server address or secret lives here.
 * Linked settings can override ASP_ID and RES_ID. CLUSTER is the local SDK peer
 * name, while ORG_ID is sent to the server as identity/tenant context.
 */
// Authorization handler ID and resource ID must match server configuration.
export const ASP_ID = 'example';
export const RES_ID = 'web';
// Matches [[Servers]] Name in the generated etc/server.toml.
export const CLUSTER = 'opennhp';
export const ORG_ID = 'opennhp';

// Expiration of the configured SERVER peer key, as Unix seconds. This is not
// the device registration lifetime or the AC access window. Device registration
// expiry comes from the server's expiresAt; the app enforces no fixed 24h TTL.
export const SERVER_KEY_EXPIRE = 1924991999;

// Demo-only application destination: plain HTTP at the NHP server's host.
// It is independent of the NHP UDP port and ignores ACK resource mappings,
// redirect URLs, and access durations. A production API flow needs an explicit
// HTTPS destination and its own application authentication/token handling.
export function siteUrl(host: string): string {
  return `http://${host}/`;
}
