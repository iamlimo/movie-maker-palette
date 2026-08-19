# iOS Fastlane + GitHub Actions Deployment

This document explains the GitHub Actions + Fastlane setup for deploying the iOS app to the App Store.

Files added/updated:
- `ios/fastlane/Appfile` — `app_identifier` set to `com.leoblueprints.signaturetv` (update if needed)
- `.github/workflows/ios-deploy.yml` — workflow that runs Fastlane `ios release` lane

Required GitHub secrets (add in repo Settings → Secrets):
- `APP_STORE_CONNECT_KEY` — optional: the contents of your App Store Connect private key (*.p8). Store the full multiline key as a secret.
- `APP_STORE_CONNECT_KEY_B64` — optional: base64-encoded .p8 key (workflow supports this format too).
- `APP_STORE_CONNECT_KEY_ID` — the Key ID from App Store Connect.
- `APP_STORE_CONNECT_ISSUER_ID` — the Issuer ID from App Store Connect.
- `FASTLANE_USER` — optional Apple ID email (if you use username/password instead of API key).
- `FASTLANE_PASSWORD` — optional app-specific password for `FASTLANE_USER`.
- `MATCH_PASSWORD` — optional, if you use `match` for code signing.

Checked-in key file:
- If you uploaded a key into the repo (for example `ios/fastlane/AuthKey_JU8UAQT8UV.p8`), the workflow will prefer that file automatically and copy it to `ios/fastlane/AuthKey.p8` before running Fastlane. This is useful for CI where you already placed the key in the repo (ensure the repo is private).

How it works:
- Workflow runs on `macos-latest` and performs:
  - `bundle install` in `ios/fastlane`
  - `pod install` in `ios/App`
  - writes `ios/fastlane/AuthKey.p8` from `APP_STORE_CONNECT_KEY` (if provided)
  - runs `bundle exec fastlane ios release`

How to trigger:
- Push to the `main` branch, push a release tag matching `v*.*.*`, or manually trigger via GitHub Actions UI (`workflow_dispatch`).

Notes / next steps:
- Ensure `ios/fastlane/Fastfile` lane `:release` meets your build settings (scheme, export options).
- If you use `match` for signing, set up your match repository and provide `MATCH_PASSWORD`.
- Replace `apple_id` in `ios/fastlane/Appfile` with your Apple ID or set `FASTLANE_USER` secret.

If you want, I can adjust the Fastfile to support separate `beta` and `release` lanes, or wire up `match` integration next.
