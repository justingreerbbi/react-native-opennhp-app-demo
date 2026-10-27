import React from 'react';
import Renderer, {act} from 'react-test-renderer';
import {Button} from '../src/ui/components';
import ScannerScreen from '../src/screens/ScannerScreen';

jest.mock('react-native-safe-area-context', () => ({SafeAreaView: require('react-native').View}));
jest.mock('@react-navigation/native', () => ({useIsFocused: () => true}));
jest.mock('@dr.pogodin/react-native-fs', () => ({}));
jest.mock('react-native-opennhp', () => ({}));
jest.mock('react-native-vision-camera', () => ({
  Camera: 'Camera',
  useCameraDevice: () => ({id: 'back'}),
  useCameraPermission: () => ({hasPermission: true, requestPermission: jest.fn()}),
  useCodeScanner: (options: unknown) => options,
}));
const popTo = jest.fn();
function button(title: string) {
  return renderer.root.findAllByType(Button).find(node => node.props.title === title)!;
}
const config = {host: 'server.example.com', port: 62206, pubkey: 'a'.repeat(42) + 'Y='};
let renderer: Renderer.ReactTestRenderer;
let scan: (codes: {value?: string}[]) => void;
beforeEach(async () => {
  jest.clearAllMocks();
  await act(async () => {
    renderer = Renderer.create(<ScannerScreen {...({navigation: {popTo}} as any)} />);
  });
  scan = renderer.root.findByType('Camera' as any).props.codeScanner.onCodeScanned;
});
afterEach(async () => {await act(async () => renderer.unmount());});

test('scans every detected code and returns the valid server only once', async () => {
  await act(async () => scan([{value: 'unrelated'}, {value: JSON.stringify(config)}]));
  expect(popTo).not.toHaveBeenCalled();
  expect(renderer.root.findByType('Camera' as any).props.isActive).toBe(false);
  expect(JSON.stringify(renderer.toJSON())).toContain(config.host);
  await act(async () => button('Use These Details').props.onPress());
  expect(popTo).toHaveBeenCalledWith('ServerSetup', {scanned: config});
  await act(async () => scan([{value: JSON.stringify(config)}]));
  expect(popTo).toHaveBeenCalledTimes(1);
});

test('unsupported QR code shows feedback and allows another scan', async () => {
  await act(async () => scan([{value: 'https://example.com'}]));
  expect(JSON.stringify(renderer.toJSON())).toContain('not a supported server code');
  expect(popTo).not.toHaveBeenCalled();
  await act(async () => scan([{value: config.pubkey}]));
  expect(popTo).not.toHaveBeenCalled();
  await act(async () => button('Use These Details').props.onPress());
  expect(popTo).toHaveBeenCalledWith('ServerSetup', {scanned: {pubkey: config.pubkey}});
});

test('camera failures are visible', async () => {
  await act(async () => renderer.root.findByType('Camera' as any).props.onError({code: 'device/error', message: 'Unavailable'}));
  expect(JSON.stringify(renderer.toJSON())).toContain('Camera error (device/error): Unavailable');
  expect(renderer.root.findByType('Camera' as any).props.isActive).toBe(false);
});


test('versioned package is validated and maps serverPublicKey into config', async () => {
  const payload = {schemaVersion: 1, host: config.host, port: config.port,
    serverPublicKey: config.pubkey, authServiceId: 'example', resourceId: 'web'};
  await act(async () => scan([{value: JSON.stringify({...payload, host: 'bad"\nPort = 1'})}]));
  expect(popTo).not.toHaveBeenCalled();
  await act(async () => scan([{value: JSON.stringify(payload)}]));
  expect(popTo).not.toHaveBeenCalled();
  await act(async () => button('Use These Details').props.onPress());
  expect(popTo).toHaveBeenCalledWith('ServerSetup', {scanned: {...config, authServiceId: 'example', resourceId: 'web'}});
});


test('rejecting review resumes scanning without accepting server settings', async () => {
  await act(async () => scan([{value: JSON.stringify(config)}]));
  await act(async () => button('Scan Again').props.onPress());
  expect(popTo).not.toHaveBeenCalled();
  expect(renderer.root.findByType('Camera' as any).props.isActive).toBe(true);
  await act(async () => scan([{value: JSON.stringify(config)}]));
  expect(button('Use These Details')).toBeDefined();
});
