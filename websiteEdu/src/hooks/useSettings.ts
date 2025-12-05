import { useCallback, useEffect, useState } from "react";
import settingApi from "@/services/settingApi";

export type SettingsData = Awaited<ReturnType<typeof settingApi.getSettings>>;

let cachedSettings: SettingsData | null = null;
let settingsPromise: Promise<SettingsData> | null = null;

const fetchSettings = async (force = false): Promise<SettingsData> => {
  if (!force && cachedSettings) {
    return cachedSettings;
  }

  if (!force && settingsPromise) {
    return settingsPromise;
  }

  const load = settingApi
    .getSettings()
    .then((data) => {
      cachedSettings = data;
      settingsPromise = null;
      return data;
    })
    .catch((error) => {
      settingsPromise = null;
      throw error;
    });

  if (!force) {
    settingsPromise = load;
  }

  const result = await load;
  if (force) {
    cachedSettings = result;
  }

  return result;
};

export const invalidateSettingsCache = () => {
  cachedSettings = null;
  settingsPromise = null;
};

export const prefetchSettings = async () => {
  try {
    await fetchSettings();
  } catch (error) {
    console.error("[useSettings] Prefetch failed:", error);
  }
};

export const useSettings = () => {
  const [settings, setSettings] = useState<SettingsData | null>(cachedSettings);
  const [loading, setLoading] = useState<boolean>(!cachedSettings);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let mounted = true;

    if (cachedSettings) {
      setSettings(cachedSettings);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    setLoading(true);
    fetchSettings()
      .then((data) => {
        if (!mounted) return;
        setSettings(data);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error("[useSettings] Fetch failed:", err);
        setError(err);
        setSettings(null);
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSettings(true);
      setSettings(data);
      setError(null);
      setLoading(false);
      return data;
    } catch (err) {
      console.error("[useSettings] Refresh failed:", err);
      setError(err);
      setLoading(false);
      throw err;
    }
  }, []);

  const updateSettings = useCallback(async (payload: Record<string, unknown>) => {
    setLoading(true);
    try {
      const data = await settingApi.updateSettings(payload);
      cachedSettings = data;
      setSettings(data);
      setError(null);
      setLoading(false);
      return data;
    } catch (err) {
      console.error("[useSettings] Update failed:", err);
      setError(err);
      setLoading(false);
      throw err;
    }
  }, []);

  const resetSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await settingApi.resetSettings();
      cachedSettings = data;
      setSettings(data);
      setError(null);
      setLoading(false);
      return data;
    } catch (err) {
      console.error("[useSettings] Reset failed:", err);
      setError(err);
      setLoading(false);
      throw err;
    }
  }, []);

  const sendTestEmail = useCallback(async (email: string) => {
    try {
      return await settingApi.sendTestEmail(email);
    } catch (err) {
      console.error("[useSettings] Send test email failed:", err);
      setError(err);
      throw err;
    }
  }, []);

  const sendBulkEmail = useCallback(async (payload: Parameters<typeof settingApi.sendBulkEmail>[0]) => {
    try {
      return await settingApi.sendBulkEmail(payload);
    } catch (err) {
      console.error("[useSettings] Send bulk email failed:", err);
      setError(err);
      throw err;
    }
  }, []);

  const testEmail = useCallback(async (payload: Record<string, unknown>) => {
    try {
      return await settingApi.testEmail(payload);
    } catch (err) {
      console.error("[useSettings] SMTP test failed:", err);
      setError(err);
      throw err;
    }
  }, []);

  return {
    settings,
    loading,
    error,
    refresh,
    updateSettings,
    resetSettings,
    sendTestEmail,
    sendBulkEmail,
    testEmail,
  };
};

export const getCachedSettings = () => cachedSettings;
