import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

export const useAppStorage = () => {
  const isNative = Capacitor.isNativePlatform();

  const setItem = async (key: string, value: string): Promise<void> => {
    if (isNative) {
      await Preferences.set({ key, value });
    } else {
      localStorage.setItem(key, value);
    }
  };

  const getItem = async (key: string): Promise<string | null> => {
    if (isNative) {
      const { value } = await Preferences.get({ key });
      return value;
    } else {
      return localStorage.getItem(key);
    }
  };

  const removeItem = async (key: string): Promise<void> => {
    if (isNative) {
      await Preferences.remove({ key });
    } else {
      localStorage.removeItem(key);
    }
  };

  return { setItem, getItem, removeItem, isNative };
};
