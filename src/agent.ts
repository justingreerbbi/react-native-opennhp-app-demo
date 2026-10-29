/**
 * App-to-SDK boundary for all OpenNHP operations.
 *
 * Screens call these helpers; react-native-opennhp owns the native agent,
 * secure key storage, packet cryptography, and UDP transport. No packet is
 * constructed in this TypeScript file. Linking, enrolling a key, and knocking
 * are separate stages: saving settings or metadata does not grant access.
 *
 * Read docs/opennhp-implementation.md for call graphs, storage, and diagrams.
 */
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

/** UI-safe projection of the SDK response; contains no private key. */
export type PublicRegistration = {
  errCode: string;
  errMsg: string;
  expiresAt?: number;
  publicKey: string;
};

/**
 * Local enrollment receipt, not an authorization token or live server status.
 * expiresAt is Unix seconds supplied by the server, when present. Older saved
 * records may omit publicKey; storedKeyMatches tolerates those legacy records.
 */
export type SavedRegistration = {
  email: string;
  deviceId: string;
  expiresAt?: number;
  publicKey?: string;
};

/** Dashboard preparation result. Expired records can still be returned here;
 * the dashboard independently checks registrationIsCurrent before enabling access.
 */
export type Workspace = {
  deviceId: string;
  registration: SavedRegistration | null;
  retiredPlaintextKey: boolean;
};

function etcPath(root: string): string {
  return `${root}/etc`;
}

/** SDK working root, with a filesystem fallback for an unavailable native constant.
 * The fallback only selects a path; it cannot substitute for a linked native SDK.
 */
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

/** Revalidate disk settings before generating native configuration or requests. */
async function requireServerConfig() {
  const server = sanitizeServerConfig(await getServerConfig());
  if (!server) {
    throw new Error('No valid server is linked. Link a server before continuing.');
  }
  return server;
}

/**
 * Translate server.json into the native SDK's etc/server.toml on every operation.
 * Name must match the CLUSTER passed to registration and knockResource. The UDP
 * port belongs to NHP, not to the website. Only the server PUBLIC key goes here.
 * Inputs are allowlisted before interpolation into TOML. Returns the SDK root.
 * This writes local configuration; it does not contact or verify the server.
 */
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

// Remove only the local enrollment receipt (used when unlinking a server).
// This neither revokes the server's key record nor deletes the secure-store key.
// Cleanup is best effort: filesystem failures are currently swallowed.
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

/**
 * Migration from the older file-based private-key configuration. The module
 * rejects startup when a nonempty PrivateKeyBase64 remains in config.toml.
 * Deletes the entire legacy config file, not just the key line. A true result
 * tells prepareWorkspace to discard the associated local registration receipt.
 * This does not import the old key into secure storage.
 */
export async function removePlaintextAgentKey(root: string): Promise<boolean> {
  const path = `${etcPath(root)}/config.toml`;
  const contents = await readText(path);
  if (!contents || !/PrivateKeyBase64\s*=\s*"[^"]+"/.test(contents)) {
    return false;
  }
  await unlink(path);
  return true;
}

/**
 * Persist a label reused by OTP, registration, and knocks. It is not a secret,
 * hardware attestation, or cryptographic identity. The historical "ios-" prefix
 * is also used on Android; key possession is what identifies the native agent.
 */
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

/** Read local UI metadata. This does not query the server or verify enrollment. */
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

/** Normalize native error codes to strings for the screens' explicit "0" check. */
function publicRegistration(result: RegistrationResult): PublicRegistration {
  return {
    errCode: result.errCode == null ? '' : String(result.errCode),
    errMsg: result.errMsg ?? '',
    expiresAt: typeof result.expiresAt === 'number' ? result.expiresAt : undefined,
    publicKey: result.publicKey ?? '',
  };
}

/**
 * Common enrollment payload. The SDK maps email to the user identity, while
 * userData.email supplies the server's email delivery context. aspId selects the
 * server authorization handler; resId selects a resource, not a TCP port.
 * CURVE25519 is the requested scheme for a newly created device key; a stored
 * key retains its scheme. DEBUG is enrollment logging, not application auth.
 */
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

/** Detect a lost/replaced secure-store key before trusting a current receipt.
 * A legacy receipt without publicKey is accepted only if a stored key exists.
 */
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

/**
 * Prepare dashboard state without sending a knock: write the peer configuration,
 * migrate legacy key files, load the device label and enrollment receipt, then
 * compare a current receipt with the stored public key. A mismatch hides the
 * receipt in this result but does not remove its file. No live enrollment or
 * revocation check is made. The dashboard creates a missing key afterward.
 */
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

/**
 * Enrollment stage 1: call the patched native SDK's NHP-OTP operation.
 * It loads/creates the secure-store key; the server handles OTP delivery.
 * Success is the SDK operation result, not proof that the email arrived, and
 * no registration.json is written until submitRegistration succeeds.
 */
export async function requestCode(
  email: string,
  deviceId: string,
): Promise<PublicRegistration> {
  const root = await ensureServerConfig();
  await removePlaintextAgentKey(root);
  // Stop the current agent so enrollment reloads the secure-store key and the
  // freshly written server.toml rather than reusing a running agent's state.
  await close();
  const result = await requestRegistrationOtp(await registrationOptions(root, email, deviceId));
  return publicRegistration(result);
}

/**
 * Enrollment stage 2: submit NHP-REG using the existing device key and OTP.
 * registerDevice is supplied by this module's native registration patch; a
 * compatible server handler must validate enrollment and accept the public key.
 * Only explicit success saves the local receipt. A later disk-write failure
 * can leave server enrollment complete while the UI reports an error.
 * Registration does not itself open the protected website's network access.
 */
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

/** Local expiry gate only. Missing expiry means no local deadline, not a
 * guarantee that the server still accepts this identity. No fixed 24h TTL here.
 */
export function registrationIsCurrent(expiresAt?: number): boolean {
  if (expiresAt == null) {
    return true;
  }
  return expiresAt * 1000 > Date.now();
}

/**
 * One-shot resource access request, called by DashboardScreen.onKnock.
 *
 * Order matters: configure peer -> ensure key -> restart agent -> set identity
 * -> knock. initializeAgent loads the secure-store private key natively;
 * knockResource constructs/sends the encrypted request and returns KnockAck.
 * A resolved promise can still contain a server error; the screen checks
 * errCode before opening a URL. Startup/transport errors can reject instead.
 *
 * This helper does not enforce local registration, open a browser, validate an
 * API token, start a knock loop, or schedule renewal. Those are separate tasks.
 */
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

  // Extension data reaches the selected server plugin inside the NHP request.
  // The current app sends only email: it has no password input or token flow.
  // A custom plugin must validate any added credential/grant, bind it to the
  // authenticated key, and avoid logging secrets. Updating userData alone does
  // not bypass device enrollment or implement credential checking.
  await setKnockUser({
    userId: email,
    deviceId,
    orgId: ORG_ID,
    userData: {email},
  });
  const server = await requireServerConfig();
  // This is the actual JavaScript entry point for the native encrypted knock.
  // CLUSTER resolves the [[Servers]] Name written by ensureServerConfig.
  return knockResource(server.authServiceId ?? ASP_ID, server.resourceId ?? RES_ID, CLUSTER);
}
