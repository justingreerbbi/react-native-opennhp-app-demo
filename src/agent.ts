import {
  DocumentDirectoryPath,
  exists,
  mkdir,
  readFile,
  unlink,
  writeFile,
} from '@dr.pogodin/react-native-fs';
import {
  Cipher,
  LogLevel,
  close,
  generateKeys,
  getDefaultWorkingDirectory,
  getPublicKey,
  initializeAgent,
  knockResource,
  registerDevice,
  requestRegistrationOtp,
  setKnockUser,
  type KnockAck,
  type RegistrationResult,
} from 'react-native-opennhp';
import {ASP_ID, CLUSTER, ORG_ID, RES_ID, SERVER_KEY_EXPIRE} from './connection';
import {getServerConfig, sanitizeServerConfig} from './serverStore';

export type PublicRegistration = {
  errCode: string;
  errMsg: string;
  expiresAt?: number;
  publicKey: string;
};

export type SavedRegistration = {
  email: string;
  deviceId: string;
  expiresAt?: number;
  publicKey?: string;
};

export type Workspace = {
  deviceId: string;
  registration: SavedRegistration | null;
  retiredPlaintextKey: boolean;
};

function etcPath(root: string): string {
  return `${root}/etc`;
}

export function workingDirectory(): string {
  try {
    const directory = getDefaultWorkingDirectory();
    if (directory) {
      return directory.replace(/\/$/, '');
    }
  } catch {
    // The native constant is missing until the module is linked.
  }
  return DocumentDirectoryPath.replace(/\/$/, '');
}

async function requireServerConfig() {
  const server = sanitizeServerConfig(await getServerConfig());
  if (!server) {
    throw new Error('No valid server is linked. Link a server before continuing.');
  }
  return server;
}

export async function ensureServerConfig(): Promise<string> {
  const root = workingDirectory();
  const etc = etcPath(root);
  await mkdir(etc);
  const server = await requireServerConfig();
  // Host for a DNS name, Ip for a numeric address.
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(server.host);
  const addrLine = isIp ? `  Ip = "${server.host}"` : `  Host = "${server.host}"`;
  const serverToml = `[[Servers]]
Name = "${CLUSTER}"
PubKeyBase64 = "${server.pubkey}"
ExpireTime = ${SERVER_KEY_EXPIRE}

  [[Servers.Instances]]
${addrLine}
  Port = ${server.port}
`;
  await writeFile(`${etc}/server.toml`, serverToml, 'utf8');
  return root;
}

// The stable per-install device id used across registration and knock.
export async function currentDeviceId(): Promise<string> {
  return loadDeviceId(workingDirectory());
}

// Remove any saved registration record (used when unlinking a server).
export async function unlinkRegistration(): Promise<void> {
  const root = workingDirectory();
  const path = `${root}/registration.json`;
  try {
    if (await exists(path)) {
      await unlink(path);
    }
  } catch {
    // ignore
  }
}

async function readText(path: string): Promise<string | null> {
  if (!(await exists(path))) {
    return null;
  }
  const contents = await readFile(path, 'utf8');
  return typeof contents === 'string' ? contents : null;
}

// The module rejects startup while PrivateKeyBase64 is in config.toml.
// The private key now lives in the device secure store.
export async function removePlaintextAgentKey(root: string): Promise<boolean> {
  const path = `${etcPath(root)}/config.toml`;
  const contents = await readText(path);
  if (!contents || !/PrivateKeyBase64\s*=\s*"[^"]+"/.test(contents)) {
    return false;
  }
  await unlink(path);
  return true;
}

export async function loadDeviceId(root: string): Promise<string> {
  const path = `${root}/device-id.txt`;
  const existing = (await readText(path))?.trim();
  if (existing) {
    return existing;
  }
  const created = `ios-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  await writeFile(path, `${created}\n`, 'utf8');
  return created;
}

export async function loadRegistration(
  root: string,
): Promise<SavedRegistration | null> {
  const raw = await readText(`${root}/registration.json`);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as SavedRegistration;
    if (!parsed.email || !parsed.deviceId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function saveRegistration(root: string, record: SavedRegistration) {
  await writeFile(`${root}/registration.json`, JSON.stringify(record), 'utf8');
}

function publicRegistration(result: RegistrationResult): PublicRegistration {
  return {
    errCode: result.errCode == null ? '' : String(result.errCode),
    errMsg: result.errMsg ?? '',
    expiresAt: typeof result.expiresAt === 'number' ? result.expiresAt : undefined,
    publicKey: result.publicKey ?? '',
  };
}

async function registrationOptions(root: string, email: string, deviceId: string) {
  const server = await requireServerConfig();
  return {
    workingDirectory: root,
    logLevel: LogLevel.DEBUG,
    cipher: Cipher.CURVE25519,
    email,
    deviceId,
    orgId: ORG_ID,
    userData: {email},
    aspId: server.authServiceId ?? ASP_ID,
    resId: server.resourceId ?? RES_ID,
    cluster: CLUSTER,
  };
}

async function storedKeyMatches(record: SavedRegistration): Promise<boolean> {
  let publicKey = '';
  try {
    publicKey = await getPublicKey();
  } catch {
    return false;
  }
  if (!publicKey) {
    return false;
  }
  return record.publicKey == null || record.publicKey === publicKey;
}

export async function prepareWorkspace(): Promise<Workspace> {
  const root = await ensureServerConfig();
  const retiredPlaintextKey = await removePlaintextAgentKey(root);
  const deviceId = await loadDeviceId(root);
  if (retiredPlaintextKey) {
    const registrationPath = `${root}/registration.json`;
    if (await exists(registrationPath)) {
      await unlink(registrationPath);
    }
    return {deviceId, registration: null, retiredPlaintextKey: true};
  }
  const registration = await loadRegistration(root);
  if (
    registration &&
    registrationIsCurrent(registration.expiresAt) &&
    !(await storedKeyMatches(registration))
  ) {
    return {deviceId, registration: null, retiredPlaintextKey: false};
  }
  return {deviceId, registration, retiredPlaintextKey: false};
}

export async function requestCode(
  email: string,
  deviceId: string,
): Promise<PublicRegistration> {
  const root = await ensureServerConfig();
  await removePlaintextAgentKey(root);
  // A running knock agent is left as-is. Stop it so this call can generate
  // or load the secure-store key and read server.toml.
  await close();
  const result = await requestRegistrationOtp(await registrationOptions(root, email, deviceId));
  return publicRegistration(result);
}

export async function submitRegistration(
  email: string,
  deviceId: string,
  otp: string,
): Promise<PublicRegistration> {
  const root = await ensureServerConfig();
  await removePlaintextAgentKey(root);
  await close();
  const result = await registerDevice({
    ...await registrationOptions(root, email, deviceId),
    otp: otp.trim(),
  });
  const view = publicRegistration(result);
  if (view.errCode === '0') {
    await saveRegistration(root, {
      email,
      deviceId,
      expiresAt: view.expiresAt,
      publicKey: view.publicKey || undefined,
    });
  }
  return view;
}

// The public key of the key stored on this device. A missing key is created
// once so an admin can add it to the trusted list before registration.
export async function devicePublicKey(): Promise<string> {
  let publicKey = '';
  try {
    publicKey = (await getPublicKey())?.trim() ?? '';
  } catch {
    publicKey = '';
  }
  if (publicKey) {
    return publicKey;
  }
  const generated = await generateKeys(Cipher.CURVE25519);
  return generated.publicKey;
}

export function registrationIsCurrent(expiresAt?: number): boolean {
  if (expiresAt == null) {
    return true;
  }
  return expiresAt * 1000 > Date.now();
}

export async function knockWeb(
  email: string,
  deviceId: string,
): Promise<KnockAck> {
  const root = await ensureServerConfig();
  await removePlaintextAgentKey(root);
  // Use the key already in the secure store. Create one if this install has none.
  await devicePublicKey();
  await close();
  const ready = await initializeAgent(root, LogLevel.INFO);
  if (!ready) {
    throw new Error('OpenNHP failed to start from the device key.');
  }
  await setKnockUser({
    userId: email,
    deviceId,
    orgId: ORG_ID,
    userData: {email},
  });
  const server = await requireServerConfig();
  return knockResource(server.authServiceId ?? ASP_ID, server.resourceId ?? RES_ID, CLUSTER);
}
