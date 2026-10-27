import React from 'react';
import { Clipboard, Linking, TextInput } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import ServerSetupScreen from '../src/screens/ServerSetupScreen';
import ManualRegisterScreen from '../src/screens/ManualRegisterScreen';
import DashboardScreen from '../src/screens/DashboardScreen';
import RegisterEmailScreen from '../src/screens/RegisterEmailScreen';
import EnterCodeScreen from '../src/screens/EnterCodeScreen';
import { Button } from '../src/ui/components';
import { useServer } from '../src/ServerContext';
import * as agent from '../src/agent';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) =>
    require('react').useEffect(callback, [callback]),
}));
jest.mock('@dr.pogodin/react-native-fs', () => ({}));
jest.mock('react-native-opennhp', () => ({}));
jest.mock('../src/ServerContext', () => ({ useServer: jest.fn() }));
jest.mock('../src/agent', () => ({
  currentDeviceId: jest.fn(async () => 'test-device'),
  prepareWorkspace: jest.fn(),
  devicePublicKey: jest.fn(async () => 'test-public-key'),
  registrationIsCurrent: jest.fn(() => true),
  requestCode: jest.fn(async () => ({ errCode: '0' })),
  submitRegistration: jest.fn(async () => ({ errCode: '0' })),
  knockWeb: jest.fn(async () => ({ errCode: '0' })),
}));

const navigate = jest.fn();
const navigation = { navigate, goBack: jest.fn() };
const link = jest.fn();
const config = {
  host: 'demo.example.com',
  port: 62206,
  pubkey: 'a'.repeat(42) + 'Y=',
};
let renderer: Renderer.ReactTestRenderer;
async function render(element: React.ReactElement) {
  await act(async () => {
    renderer = Renderer.create(element);
  });
}
function button(title: string) {
  return renderer.root
    .findAllByType(Button)
    .find(node => node.props.title === title)!;
}
beforeEach(() => {
  jest.clearAllMocks();
  (useServer as jest.Mock).mockReturnValue({ config, link, unlink: jest.fn() });
  (agent.prepareWorkspace as jest.Mock).mockResolvedValue({
    deviceId: 'test-device',
    registration: null,
  });
});
afterEach(async () => {
  if (renderer) {
    await act(async () => renderer.unmount());
  }
});

test('setup keeps editable details available and links the entered server', async () => {
  await render(
    <ServerSetupScreen
      {...({ navigation, route: { params: undefined } } as any)}
    />,
  );
  expect(JSON.stringify(renderer.toJSON())).not.toContain('SERVER DETAILS');
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Choose a server');
  expect(button('Link Server')).toBeUndefined();
  expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
  const edit = renderer.root.findAll(
    node =>
      node.props.accessibilityRole === 'button' &&
      node.props.accessibilityState?.expanded === false,
  )[0];
  await act(async () => edit.props.onPress());
  const inputs = renderer.root.findAllByType(TextInput);
  expect(inputs.map(input => input.props.value)).toEqual(['', '', '']);
  await act(async () => {
    inputs[0].props.onChangeText(config.host);
    inputs[1].props.onChangeText('62206');
    inputs[2].props.onChangeText(config.pubkey);
  });
  await act(async () => button('Link Server').props.onPress());
  expect(link).toHaveBeenCalledWith(config);
});

test('unregistered device is guided into registration', async () => {
  await render(<DashboardScreen {...({ navigation } as any)} />);
  expect(
    renderer.root
      .findAllByType(Button)
      .some(node => node.props.title.includes('Request Access &')),
  ).toBe(false);
  await act(async () => button('Register With OTP').props.onPress());
  expect(navigate).toHaveBeenCalledWith('RegisterEmail');
});

test('registered device knocks and opens the protected site only on success', async () => {
  (agent.prepareWorkspace as jest.Mock).mockResolvedValue({
    deviceId: 'test-device',
    registration: { email: 'user@example.com' },
  });
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await render(<DashboardScreen {...({ navigation } as any)} />);
  await act(async () => button('Request Access & Open Site').props.onPress());
  expect(agent.knockWeb).toHaveBeenCalledWith(
    'user@example.com',
    'test-device',
  );
  expect(open).toHaveBeenCalledWith('http://demo.example.com/');
  open.mockClear();
  (agent.knockWeb as jest.Mock).mockResolvedValueOnce({
    errCode: '1',
    errMsg: 'Access denied',
  });
  await act(async () => button('Request Access & Open Site').props.onPress());
  expect(open).not.toHaveBeenCalled();
  expect(JSON.stringify(renderer.toJSON())).toContain('Access denied');
  open.mockRestore();
});

test('email requests a code and verification returns to the dashboard', async () => {
  await render(<RegisterEmailScreen {...({ navigation } as any)} />);
  expect(button('Send Code').props.disabled).toBe(true);
  await act(async () =>
    renderer.root.findByType(TextInput).props.onChangeText('user@example.com'),
  );
  await act(async () => button('Send Code').props.onPress());
  expect(agent.requestCode).toHaveBeenCalledWith(
    'user@example.com',
    'test-device',
  );
  expect(navigate).toHaveBeenCalledWith('EnterCode', {
    email: 'user@example.com',
  });
  await act(async () => renderer.unmount());
  await render(
    <EnterCodeScreen
      {...({
        navigation,
        route: { params: { email: 'user@example.com' } },
      } as any)}
    />,
  );
  await act(async () =>
    renderer.root.findByType(TextInput).props.onChangeText('123456'),
  );
  await act(async () => button('Verify & Register Device').props.onPress());
  expect(agent.submitRegistration).toHaveBeenCalledWith(
    'user@example.com',
    'test-device',
    '123456',
  );
  expect(navigate).toHaveBeenCalledWith('Dashboard');
});


test('scanned server details are visible and ready to link', async () => {
  await render(<ServerSetupScreen {...({navigation, route: {params: {scanned: config}}} as any)} />);
  expect(renderer.root.findAllByType(TextInput).map(input => input.props.value)).toEqual([config.host, String(config.port), config.pubkey]);
  expect(button('Link Server')).toBeDefined();
  await act(async () => button('Link Server').props.onPress());
  expect(link).toHaveBeenCalledWith(config);
});


test('review offers manual registration and copies the device key', async () => {
  await render(<DashboardScreen {...({navigation} as any)} />);
  await act(async () => button('Manual Registration').props.onPress());
  expect(navigate).toHaveBeenCalledWith('ManualRegister');
  await act(async () => renderer.unmount());
  const copy = jest.spyOn(Clipboard, 'setString').mockImplementation(() => {});
  await render(<ManualRegisterScreen {...({navigation} as any)} />);
  expect(JSON.stringify(renderer.toJSON())).toContain('test-public-key');
  await act(async () => button('Copy Device Key').props.onPress());
  expect(copy).toHaveBeenCalledWith('test-public-key');
  expect(JSON.stringify(renderer.toJSON())).toContain('Copying this key does not register your device.');
  expect(button('Device Key Copied')).toBeDefined();
  expect(agent.submitRegistration).not.toHaveBeenCalled();
  copy.mockRestore();
});

test('manual registration handles key failure without enabling copy', async () => {
  (agent.devicePublicKey as jest.Mock).mockRejectedValueOnce(new Error('Secure store unavailable'));
  await render(<ManualRegisterScreen {...({navigation} as any)} />);
  expect(button('Copy Device Key').props.disabled).toBe(true);
  expect(JSON.stringify(renderer.toJSON())).toContain('Secure store unavailable');
});
