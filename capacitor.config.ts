import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "co.signature.tv",
  appName: "Signature TV",
  webDir: "dist",
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#1A1C24",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
  },
};

export default config;
