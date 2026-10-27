import {
  devicePublicKey,
  knockWeb,
  prepareWorkspace,
  requestCode,
  submitRegistration,
} from '../src/agent';

jest.mock('../src/serverStore', () => ({
  ...jest.requireActual('../src/serverStore'),
  getServerConfig: jest.fn(async () => ({
    host: 'demo.example.com',
    port: 62206,
    pubkey: 'a'.repeat(42) + 'Y=',
  })),
}));

jest.mock('react-native-opennhp', () => ({
  Cipher: { CURVE25519: 0, SM2: 1 },
  LogLevel: { SILENT: 0, ERROR: 1, INFO: 2, DEBUG: 3, VERBOSE: 4 },
  getDefaultWorkingDirectory: () => '/tmp/opennhp-test',
  getPublicKey: jest.fn(async () => 'stored-public'),
  generateKeys: jest.fn(async () => ({ publicKey: 'generated-public' })),
  close: jest.fn(async () => {}),
  initializeAgent: jest.fn(async () => true),
  setKnockUser: jest.fn(async () => true),
  knockResource: jest.fn(async () => ({ errCode: '0', opnTime: 60 })),
  requestRegistrationOtp: jest.fn(async () => ({
    errCode: '0',
    publicKey: 'stored-public',
  })),
  registerDevice: jest.fn(async () => ({
    errCode: '0',
    expiresAt: 1792809534,
    publicKey: 'stored-public',
  })),
}));

jest.mock('@dr.pogodin/react-native-fs', () => ({
  DocumentDirectoryPath: '/tmp/opennhp-test',
  mkdir: jest.fn(async () => {}),
  writeFile: jest.fn(async () => {}),
  readFile: jest.fn(async (path: string) => {
    if (path.endsWith('config.toml')) {
      return 'PrivateKeyBase64 = "device-secret"\nUserId = "old@example.com"\n';
    }
    if (path.endsWith('registration.json')) {
      return JSON.stringify({
        email: 'old@example.com',
        deviceId: 'ios-old',
        expiresAt: 1792809534,
      });
    }
    if (path.endsWith('device-id.txt')) {
      return 'ios-device\n';
    }
    return '';
  }),
  exists: jest.fn(async () => true),
  unlink: jest.fn(async () => {}),
}));

const opennhp = jest.requireMock('react-native-opennhp');
const fs = jest.requireMock('@dr.pogodin/react-native-fs');

beforeEach(() => {
  jest.clearAllMocks();
  fs.exists.mockImplementation(async () => true);
});

test('copies the stored public key and creates one only when missing', async () => {
  await expect(devicePublicKey()).resolves.toBe('stored-public');
  expect(opennhp.generateKeys).not.toHaveBeenCalled();

  opennhp.getPublicKey.mockResolvedValueOnce('');
  await expect(devicePublicKey()).resolves.toBe('generated-public');
  expect(opennhp.generateKeys).toHaveBeenCalledWith(0);
});

test('drops a plaintext config key and does not pass it to OTP', async () => {
  const workspace = await prepareWorkspace();
  expect(workspace.retiredPlaintextKey).toBe(true);
  expect(workspace.registration).toBeNull();
  expect(fs.unlink).toHaveBeenCalledWith('/tmp/opennhp-test/etc/config.toml');
  expect(fs.unlink).toHaveBeenCalledWith('/tmp/opennhp-test/registration.json');

  const result = await requestCode('user@example.com', 'ios-device');
  expect(result.errCode).toBe('0');
  expect(result.publicKey).toBe('stored-public');
  const options = opennhp.requestRegistrationOtp.mock.calls[0][0];
  expect(options).toMatchObject({
    email: 'user@example.com',
    deviceId: 'ios-device',
    cipher: 0,
    aspId: 'example',
    resId: 'web',
    cluster: 'opennhp',
    userData: { email: 'user@example.com' },
  });
  expect(options.privateKey).toBeUndefined();
  expect(opennhp.close.mock.invocationCallOrder[0]).toBeLessThan(
    opennhp.requestRegistrationOtp.mock.invocationCallOrder[0],
  );
  const written = fs.writeFile.mock.calls.map((call: unknown[]) =>
    String(call[1]),
  );
  expect(written.join('\n')).not.toContain('PrivateKeyBase64');
});

test('registers with the stored key and knocks without a config private key', async () => {
  fs.exists.mockImplementation(
    async (path: string) => !path.endsWith('config.toml'),
  );

  const registered = await submitRegistration(
    'user@example.com',
    'ios-device',
    '123456',
  );
  expect(registered.errCode).toBe('0');
  expect(opennhp.registerDevice).toHaveBeenCalledWith(
    expect.objectContaining({
      email: 'user@example.com',
      otp: '123456',
      cipher: 0,
    }),
  );
  expect(opennhp.registerDevice.mock.calls[0][0].privateKey).toBeUndefined();
  expect(opennhp.close.mock.invocationCallOrder[0]).toBeLessThan(
    opennhp.registerDevice.mock.invocationCallOrder[0],
  );

  const saved = fs.writeFile.mock.calls.find((call: unknown[]) =>
    String(call[0]).endsWith('registration.json'),
  );
  expect(JSON.parse(String(saved[1]))).toMatchObject({
    email: 'user@example.com',
    deviceId: 'ios-device',
    publicKey: 'stored-public',
    expiresAt: 1792809534,
  });

  const ack = await knockWeb('user@example.com', 'ios-device');
  expect(ack.errCode).toBe('0');
  expect(opennhp.initializeAgent).toHaveBeenCalledWith('/tmp/opennhp-test', 2);
  expect(opennhp.setKnockUser).toHaveBeenCalledWith({
    userId: 'user@example.com',
    deviceId: 'ios-device',
    orgId: 'opennhp',
    userData: { email: 'user@example.com' },
  });
  expect(opennhp.knockResource).toHaveBeenCalledWith(
    'example',
    'web',
    'opennhp',
  );
});

test('uses provisioned service and resource identifiers for OTP and knocks', async () => {
  const store = jest.requireMock('../src/serverStore');
  const server = {host: 'server.example.com', port: 62206, pubkey: 'a'.repeat(42) + 'Y=', authServiceId: 'tenant-service', resourceId: 'private-web'};
  for (let i = 0; i < 4; i++) {
    store.getServerConfig.mockResolvedValueOnce(server);
  }
  await requestCode('user@example.com', 'ios-device');
  expect(opennhp.requestRegistrationOtp).toHaveBeenCalledWith(expect.objectContaining({aspId: 'tenant-service', resId: 'private-web'}));
  await knockWeb('user@example.com', 'ios-device');
  expect(opennhp.knockResource).toHaveBeenCalledWith('tenant-service', 'private-web', 'opennhp');
});

test('rejects unsafe host before writing native configuration', async () => {
  jest.requireMock('../src/serverStore').getServerConfig.mockResolvedValueOnce({
    host: 'server"\nInjected = true', port: 62206, pubkey: 'a'.repeat(42) + 'Y=',
  });
  await expect(prepareWorkspace()).rejects.toThrow('No valid server is linked');
  expect(fs.writeFile).not.toHaveBeenCalled();
});
