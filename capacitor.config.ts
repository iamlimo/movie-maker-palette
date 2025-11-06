import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.leoblueprints.signaturetv",
  appName: "Signature TV",
  webDir: "dist",
  // server: {
  //   url: "https://35c19387-a3ec-428d-a8fc-4ab933986941.lovableproject.com?forceHideBadge=true",
  //   cleartext: true
  // },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#1A1C24",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    App: {
      deepLinkScheme: "signaturetv",
    },
  },
};

export default config;
