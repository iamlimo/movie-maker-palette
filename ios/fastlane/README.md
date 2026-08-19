# Fastlane for iOS

This folder contains a minimal Fastlane setup to build and upload the iOS app to App Store Connect via GitHub Actions.

Required GitHub secrets (recommended names):
- `APP_STORE_CONNECT_KEY_ID` — App Store Connect API Key ID (eg. "ABCD1234")
- `APP_STORE_CONNECT_ISSUER_ID` — App Store Connect Issuer ID (UUID)
- `APP_STORE_CONNECT_KEY` — Base64-encoded contents of the .p8 private key file for App Store Connect API
- `APP_STORE_TEAM_ID` — (optional) Apple Team ID

Usage notes:
- Store the `.p8` key file content base64-encoded in `APP_STORE_CONNECT_KEY` and the workflow will decode it into `ios/fastlane/AuthKey.p8` during the run.
- Update `Appfile` with your actual `app_identifier` and `apple_id` or provide them via environment variables.
- Adjust `XCODE_WORKSPACE` and `XCODE_SCHEME` environment variables in the workflow if your project uses different names.
