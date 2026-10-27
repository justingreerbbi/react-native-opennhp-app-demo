# react-native-opennhp-app-demo

React Native demo app for linking an OpenNHP server, registering a device, and requesting resource access on iOS and Android.

## Source setup

Install JavaScript dependencies with `npm ci`. For iOS, run `bundle install`, then run `bundle exec pod install` from the `ios` directory. Follow the platform build steps below after installing dependencies.

Source control includes the app source, tests, native projects, Gradle wrapper, and dependency lockfiles. Dependencies, generated builds, local environment settings, and private signing/provisioning files are excluded. The standard Android debug keystore is included for local development; configure your own signing credentials for distribution.

## Device configuration

Fresh installs include no connection server host, UDP port, or public key. Scan a server QR code containing `{schemaVersion: 1, host, port, serverPublicKey, authServiceId, resourceId}`, or open **Edit server details** and enter all three values before linking. The scanner validates the version and field types, a hostname or IPv4 address, UDP port (1–65535), canonical 32-byte base64 public key, and simple service/resource identifiers. Invalid packages show an error and are not accepted. Accepted details are shown for review before linking; validation is repeated before saving and generating native configuration. This validates structure, not server ownership or authenticity. Legacy complete `{host, port, pubkey}` packages and bare public keys remain supported. Settings are saved on that device; existing installations retain their saved settings until the server is unlinked.

The iOS app bundle identifier (Debug and Release) is `org.reactjs.native.example.OpenNHPAgent`. Use this identifier when creating its provisioning profile. Open `ios/OpenNHPAgent.xcworkspace` in Xcode to configure the signing team and profile for the OpenNHPAgent target.

This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.

# TODO
- Match the param names from the server to the qr code generator
- Add identifier in the scanner schema.
- Look for ways that the system admin can gauruntee authenticity of qr code so it can be checked by the app in an open protocol.
