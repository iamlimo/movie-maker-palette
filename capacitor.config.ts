import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'app.lovable.35c19387a3ec428da8fc4ab933986941',
  appName: 'Signature TV',
  webDir: 'dist',
  server: {
    url: 'https://35c19387-a3ec-428d-a8fc-4ab933986941.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1A1C24',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false
    }
  }
};

export default config;
