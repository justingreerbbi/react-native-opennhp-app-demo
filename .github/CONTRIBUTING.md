# Contributing

This repository is a demo app built with `react-native-opennhp`, which is under active development. Contributions should help developers build, understand, and test the demo on iOS and Android.

These guidelines follow the workflow in [OpenNHP’s contributing guide](https://github.com/OpenNHP/opennhp/blob/main/CONTRIBUTING.md), adapted for this React Native app. Follow the local [Code of Conduct](CODE_OF_CONDUCT.md) in all project interactions.

## Choose the right repository

| Area | Repository |
| --- | --- |
| Demo screens, navigation, app configuration, tests, and documentation | [react-native-opennhp-app-demo](https://github.com/justingreerbbi/react-native-opennhp-app-demo) |
| React Native module API, native bindings, or bundled SDK integration | [react-native-opennhp](https://github.com/justingreerbbi/react-native-opennhp) |
| OpenNHP protocol, core agent, server, or access controller | [OpenNHP/opennhp](https://github.com/OpenNHP/opennhp) |
| Ubuntu installer or server provisioning helpers | [OpenNHP-Ubuntu-Installer](https://github.com/OpenNHP/OpenNHP-Ubuntu-Installer) |

If the source of a problem is unclear, report what you observed in this repository and include enough context to reproduce it. Maintainers can help identify the affected component.

## Report a bug or suggest a change

Search [existing issues](https://github.com/justingreerbbi/react-native-opennhp-app-demo/issues) before opening a new one.

For a bug report, include:

- Expected behavior, actual behavior, and steps to reproduce.
- Device or simulator model, OS version, and whether the build is Debug or Release.
- Node, React Native, Xcode or Android toolchain versions, as applicable.
- The demo commit and module revision being tested.
- Relevant logs or screenshots with private information removed.

For a feature request, explain the use case and proposed behavior. Discuss substantial changes in an issue before implementation so maintainers can review their fit with the demo.

Do not include private keys, signing files, registration codes, credentials, or personal information in issues, screenshots, fixtures, or logs.

## Set up development

1. Fork this repository and clone your fork.
2. Follow the [README installation and platform build instructions](../README.md#download-and-install).
3. Create a branch for your change, for example `fix/qr-review` or `docs/android-setup`.
4. Keep changes focused and follow the existing TypeScript and UI conventions.

Use the checked-in dependency lockfiles. Do not commit installed dependencies, generated builds, personal environment settings, or signing credentials. Update lockfiles when intentionally changing dependencies.

## Validate changes

Run these commands from the project root:

```sh
npm test -- --runInBand
npm run lint
npx tsc --noEmit
```

For changes to native dependencies, reinstall CocoaPods dependencies and rebuild the affected platform. Test user-facing changes on the relevant platform; camera behavior requires a physical device. State which checks and devices you used, and disclose any checks you could not run.

Add meaningful regression tests for behavior changes. Update documentation when setup, configuration, or user flows change. Keep user-facing copy clear and consistent with the existing app.

## Submit a pull request

1. Review your diff for unrelated changes and sensitive information.
2. Use concise commit messages explaining the change and its purpose. OpenNHP’s prefixes such as `fix:`, `feat:`, `docs:`, `test:`, and `refactor:` are useful conventions.
3. Push your branch to your fork and open a pull request against this repository’s `main` branch.
4. Describe the problem, resulting behavior, related issues, and validation. Include screenshots for visual changes when useful.
5. Respond to review feedback and keep the pull request focused on its stated scope.

Preserve existing copyright and license notices. Do not copy code or assets unless you have permission to contribute them. The upstream project’s contribution and licensing requirements apply to contributions submitted there; this guide does not assign an upstream license to the demo.

## Security reports

Do not publish exploit details or secrets in a public issue. If GitHub’s private vulnerability reporting is enabled for the affected repository, use its **Security → Report a vulnerability** option. For upstream OpenNHP issues, follow the reporting instructions in the upstream repository’s Security section. If no private channel is listed for this demo, ask the maintainer to establish one without disclosing vulnerability details publicly.
