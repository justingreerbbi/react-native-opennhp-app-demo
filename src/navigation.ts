import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {ServerConfig} from './serverStore';

// Shown while no server is linked.
export type SetupStackParamList = {
  ServerSetup: {scanned?: Partial<ServerConfig>} | undefined;
  Scanner: undefined;
};

// Shown once a server is linked.
export type AppStackParamList = {
  Dashboard: undefined;
  RegisterEmail: undefined;
  ManualRegister: undefined;
  EnterCode: {email: string};
};

export type SetupScreenProps<T extends keyof SetupStackParamList> =
  NativeStackScreenProps<SetupStackParamList, T>;

export type AppScreenProps<T extends keyof AppStackParamList> =
  NativeStackScreenProps<AppStackParamList, T>;
