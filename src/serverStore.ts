/**
 * Provisioning boundary: validate untrusted QR/manual/disk input and persist one
 * linked NHP peer in server.json. Keys here are public. Format validation does
 * not authenticate QR ownership or establish network connectivity.
 */
import {
  DocumentDirectoryPath,
  exists,
  readFile,
  unlink,
  writeFile,
} from '@dr.pogodin/react-native-fs';
import {getDefaultWorkingDirectory} from 'react-native-opennhp';

/** host/port target the NHP UDP listener, not the protected application's URL.
 * Missing service/resource IDs fall back to connection.ts at operation time.
 */
export type ServerConfig = {
  host: string;
  port: number;
  pubkey: string;
  authServiceId?: string;
  resourceId?: string;
};

function workingDir(): string {
  try {
    const dir = getDefaultWorkingDirectory();
    if (dir) {
      return dir.replace(/\/$/, '');
    }
  } catch {
    // native module not linked yet
  }
  return DocumentDirectoryPath.replace(/\/$/, '');
}

function configPath(): string {
  return `${workingDir()}/server.json`;
}

// Canonical base64 encoding of a 32-byte Curve25519 public key.
const KEY_RE = /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** Encoding/length validation for this app's Curve25519 provisioning format. */
export function isValidPubkey(key: string): boolean {
  return KEY_RE.test(key.trim());
}

// Accept DNS names and IPv4 only. Schemes, paths, ports, and IPv6 are rejected.
function cleanHost(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const host = value.trim().toLowerCase();
  if (!host || host.length > 253) {
    return null;
  }
  if (/^[0-9.]+$/.test(host)) {
    const parts = host.split('.');
    return parts.length === 4 && parts.every(part =>
      /^(0|[1-9][0-9]{0,2})$/.test(part) && Number(part) <= 255,
    ) ? host : null;
  }
  return host.split('.').every(label =>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),
  ) ? host : null;
}

// Return only allowlisted, normalized fields. Reject unsafe input rather than
// stripping characters and silently changing which server/resource is used.
export function sanitizeServerConfig(value: unknown): ServerConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const obj = value as Record<string, unknown>;
  const host = cleanHost(obj.host);
  if (!host || typeof obj.port !== 'number' || !Number.isInteger(obj.port) ||
      obj.port < 1 || obj.port > 65535 || typeof obj.pubkey !== 'string' ||
      !isValidPubkey(obj.pubkey)) {
    return null;
  }
  const config: ServerConfig = {host, port: obj.port, pubkey: obj.pubkey.trim()};
  for (const field of ['authServiceId', 'resourceId'] as const) {
    if (obj[field] !== undefined) {
      const id = obj[field];
      if (typeof id !== 'string' || !ID_RE.test(id.trim())) {
        return null;
      }
      config[field] = id.trim();
    }
  }
  return config;
}

/** Invalid or unreadable saved settings behave as an unlinked installation. */
export async function getServerConfig(): Promise<ServerConfig | null> {
  const path = configPath();
  if (!(await exists(path))) {
    return null;
  }
  try {
    return sanitizeServerConfig(JSON.parse(await readFile(path, 'utf8')));
  } catch {
    // fall through
  }
  return null;
}

/** Save local peer settings only; no handshake, enrollment, or knock occurs. */
export async function setServerConfig(config: ServerConfig): Promise<void> {
  const safe = sanitizeServerConfig(config);
  if (!safe) {
    throw new Error('Invalid server settings. Check the host, UDP port, public key, and resource identifiers.');
  }
  await writeFile(configPath(), JSON.stringify(safe), 'utf8');
}

export async function clearServerConfig(): Promise<void> {
  const path = configPath();
  if (await exists(path)) {
    await unlink(path);
  }
}

/**
 * Parse version-1 provisioning JSON, legacy complete JSON, or a bare key.
 * A bare key returns partial settings that setup must complete before linking.
 * Version 1 requires service/resource IDs; legacy JSON permits their omission.
 * Unknown fields and ambiguous legacy key aliases are rejected. Bound input
 * size before parsing and never coerce untrusted field types. No signatures or
 * network ownership checks are performed; the user reviews the parsed details.
 */
export function parseServerPayload(text: string): Partial<ServerConfig> | null {
  if (text.length > 4096) {
    return null;
  }
  const trimmed = text.trim();
  if (isValidPubkey(trimmed)) {
    return {pubkey: trimmed};
  }
  try {
    const obj = JSON.parse(trimmed);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return null;
    }
    if ('schemaVersion' in obj) {
      const fields = ['schemaVersion', 'host', 'port', 'serverPublicKey', 'authServiceId', 'resourceId'];
      if (obj.schemaVersion !== 1 || Object.keys(obj).some(key => !fields.includes(key)) ||
          typeof obj.authServiceId !== 'string' || typeof obj.resourceId !== 'string') {
        return null;
      }
      return sanitizeServerConfig({
        host: obj.host,
        port: obj.port,
        pubkey: obj.serverPublicKey,
        authServiceId: obj.authServiceId,
        resourceId: obj.resourceId,
      });
    }
    // Compatibility with the original complete JSON QR format.
    const fields = ['host', 'port', 'pubkey', 'pubKey', 'key', 'authServiceId', 'resourceId'];
    const keys = ['pubkey', 'pubKey', 'key'].filter(key => key in obj);
    if (keys.length !== 1 || Object.keys(obj).some(key => !fields.includes(key))) {
      return null;
    }
    return sanitizeServerConfig({...obj, pubkey: obj[keys[0]]});
  } catch {
    return null;
  }
}
