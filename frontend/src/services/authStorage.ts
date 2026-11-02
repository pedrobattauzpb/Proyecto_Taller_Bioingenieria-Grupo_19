import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const REFRESH_TOKEN_KEY = 'gmao_refresh_token';

// El access token vive estrictamente en memoria del módulo (cierre de seguridad)
let inMemoryAccessToken: string | null = null;

export const authStorage = {
  getAccessToken(): string | null {
    return inMemoryAccessToken;
  },

  setAccessToken(token: string | null): void {
    inMemoryAccessToken = token;
  },

  async getRefreshToken(): Promise<string | null> {
    try {
      if (Capacitor.isNativePlatform()) {
        const { value } = await Preferences.get({ key: REFRESH_TOKEN_KEY });
        return value;
      }
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch (err) {
      console.warn('[authStorage] Error al recuperar refresh token:', err);
      return null;
    }
  },

  async setRefreshToken(token: string | null): Promise<void> {
    try {
      if (!token) {
        if (Capacitor.isNativePlatform()) {
          await Preferences.remove({ key: REFRESH_TOKEN_KEY });
        } else {
          localStorage.removeItem(REFRESH_TOKEN_KEY);
        }
        return;
      }

      if (Capacitor.isNativePlatform()) {
        await Preferences.set({ key: REFRESH_TOKEN_KEY, value: token });
      } else {
        localStorage.setItem(REFRESH_TOKEN_KEY, token);
      }
    } catch (err) {
      console.warn('[authStorage] Error al persistir refresh token:', err);
    }
  },

  async clearTokens(): Promise<void> {
    inMemoryAccessToken = null;
    await this.setRefreshToken(null);
  },
};
