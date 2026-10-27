import {exists, readFile, writeFile} from '@dr.pogodin/react-native-fs';
import {getServerConfig, parseServerPayload, sanitizeServerConfig, setServerConfig} from '../src/serverStore';

jest.mock('@dr.pogodin/react-native-fs', () => ({
  DocumentDirectoryPath: '/device',
  exists: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));
jest.mock('react-native-opennhp', () => ({
  getDefaultWorkingDirectory: () => '/device',
}));

const config = {
  host: 'server.example.com',
  port: 62206,
  pubkey: 'a'.repeat(42) + 'Y=',
};

beforeEach(() => jest.clearAllMocks());

test('fresh installation has no server configured', async () => {
  (exists as jest.Mock).mockResolvedValue(false);
  expect(await getServerConfig()).toBeNull();
  expect(readFile).not.toHaveBeenCalled();
});

test('complete user settings survive a restart', async () => {
  (exists as jest.Mock).mockResolvedValue(true);
  (readFile as jest.Mock).mockResolvedValue(JSON.stringify(config));
  expect(await getServerConfig()).toEqual(config);
});

test.each([
  {...config, host: undefined},
  {...config, host: ' '},
  {...config, port: undefined},
  {...config, port: 0},
  {...config, port: 65536},
  {...config, port: 1.5},
  {...config, pubkey: ''},
])('incomplete or invalid saved settings require setup: %j', async saved => {
  (exists as jest.Mock).mockResolvedValue(true);
  (readFile as jest.Mock).mockResolvedValue(JSON.stringify(saved));
  expect(await getServerConfig()).toBeNull();
});

const packageV1 = {
  schemaVersion: 1,
  host: '3.16.107.36',
  port: 62206,
  serverPublicKey: '6JKzlwnuHiyuN1xLUat33XCot0orS1PRxgNXEIA4TTo=',
  authServiceId: 'example',
  resourceId: 'web',
};

test('accepts the supplied version 1 provisioning package', () => {
  expect(parseServerPayload(JSON.stringify(packageV1))).toEqual({
    host: packageV1.host,
    port: packageV1.port,
    pubkey: packageV1.serverPublicKey,
    authServiceId: 'example',
    resourceId: 'web',
  });
});

test.each([
  {schemaVersion: 2}, {schemaVersion: '1'},
  {host: 'server.example.com"\nPort = 1'}, {host: 'https://server.example.com/path'},
  {host: 'user@server.example.com'}, {host: '256.1.1.1'}, {host: '-bad.example.com'},
  {host: 'server.example.com:62206'}, {host: {toString: 'evil'}},
  {port: '62206'}, {port: 1.5}, {port: -1}, {port: 65536},
  {serverPublicKey: 'a'.repeat(43) + '='}, {serverPublicKey: 'not-a-key'},
  {authServiceId: undefined}, {resourceId: undefined}, {authServiceId: ''},
  {resourceId: '../web'}, {resourceId: 'web\nInjected = true'},
  {extra: 'unexpected'}, {pubkey: config.pubkey},
])('rejects malformed or unsafe provisioning fields: %j', override => {
  expect(parseServerPayload(JSON.stringify({...packageV1, ...override}))).toBeNull();
});

test.each(['null', '[]', '{broken', 'x'.repeat(4097)])('rejects invalid payload %s', payload => {
  expect(parseServerPayload(payload)).toBeNull();
});

test('normalizes harmless surrounding whitespace and strips unknown stored fields', () => {
  expect(sanitizeServerConfig({...config, host: ' SERVER.Example.com ', pubkey: ` ${config.pubkey} `, extra: 'ignored'})).toEqual(config);
});

test('revalidates unsafe settings before saving and writes nothing', async () => {
  await expect(setServerConfig({...config, host: 'bad"\nInjected = true'})).rejects.toThrow('Invalid server settings');
  expect(writeFile).not.toHaveBeenCalled();
});

test('writes only sanitized configuration fields', async () => {
  await setServerConfig({...config, host: ' SERVER.EXAMPLE.COM '});
  expect(writeFile).toHaveBeenCalledWith('/device/server.json', JSON.stringify(config), 'utf8');
});
