import React from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ServerProvider, useServer } from './src/ServerContext';
import ServerSetupScreen from './src/screens/ServerSetupScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import RegisterEmailScreen from './src/screens/RegisterEmailScreen';
import ManualRegisterScreen from './src/screens/ManualRegisterScreen';
import EnterCodeScreen from './src/screens/EnterCodeScreen';
import type { AppStackParamList, SetupStackParamList } from './src/navigation';
import { colors } from './src/ui/theme';

const SetupStack = createNativeStackNavigator<SetupStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

const screenOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerShadowVisible: false,
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '600' as const, fontSize: 15 },
  contentStyle: { backgroundColor: colors.bg },
};

function Root() {
  const { linked, loading } = useServer();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {linked ? (
        <AppStack.Navigator screenOptions={screenOptions}>
          <AppStack.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{ title: 'OpenNHP' }}
          />
          <AppStack.Screen
            name="RegisterEmail"
            component={RegisterEmailScreen}
            options={{ title: 'Register device' }}
          />
          <AppStack.Screen
            name="ManualRegister"
            component={ManualRegisterScreen}
            options={{ title: 'Manual registration' }}
          />
          <AppStack.Screen
            name="EnterCode"
            component={EnterCodeScreen}
            options={{ title: 'Verification' }}
          />
        </AppStack.Navigator>
      ) : (
        <SetupStack.Navigator screenOptions={screenOptions}>
          <SetupStack.Screen
            name="ServerSetup"
            component={ServerSetupScreen}
            options={{ title: 'OpenNHP' }}
          />
          <SetupStack.Screen
            name="Scanner"
            component={ScannerScreen}
            options={{ title: 'Scan QR code' }}
          />
        </SetupStack.Navigator>
      )}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <ServerProvider>
        <Root />
      </ServerProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
});
