import { useEffect, useState, useCallback } from "react";
import settingApi from "@/services/settingApi";

export type PublicSchoolInfoPayload = {
  schoolName: string;
  slogan: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  facebook: string;
  schoolLogo?: {
    url: string;
    publicId: string;
    format: string;
  } | null;
};

export type FlattenedSchoolInfo = {
  name: string;
  slogan: string;
  description: string;
  logoUrl: string;
  raw?: PublicSchoolInfoPayload;
};

const DEFAULT_INFO: FlattenedSchoolInfo = {
  name: "EduManage",
  slogan: "Quản lý trường học",
  description: "",
  logoUrl: "",
};

let cachedInfo: FlattenedSchoolInfo | null = null;
let loadingPromise: Promise<FlattenedSchoolInfo> | null = null;

const mapApiToInfo = (payload: PublicSchoolInfoPayload | undefined): FlattenedSchoolInfo => {
  if (!payload) {
    return DEFAULT_INFO;
  }

  return {
    name: payload.schoolName?.trim() || DEFAULT_INFO.name,
    slogan: payload.slogan?.trim() || DEFAULT_INFO.slogan,
    description: payload.description || "",
    logoUrl: payload.schoolLogo?.url || "",
    raw: payload,
  };
};

const fetchPublicSchoolInfo = async (force = false): Promise<FlattenedSchoolInfo> => {
  if (!force && cachedInfo) {
    return cachedInfo;
  }

  if (!force && loadingPromise) {
    return loadingPromise;
  }

  const load = settingApi
    .getPublicSchoolInfo()
    .then((data) => {
      const mapped = mapApiToInfo(data);
      cachedInfo = mapped;
      loadingPromise = null;
      return mapped;
    })
    .catch((error) => {
      loadingPromise = null;
      throw error;
    });

  if (!force) {
    loadingPromise = load;
  }

  const result = await load;
  if (force) {
    cachedInfo = result;
  }

  return result;
};

export const invalidatePublicSchoolInfoCache = () => {
  cachedInfo = null;
  loadingPromise = null;
};

export const prefetchPublicSchoolInfo = async () => {
  try {
    await fetchPublicSchoolInfo();
  } catch (error) {
    console.error("[usePublicSchoolInfo] Prefetch failed:", error);
  }
};

export const usePublicSchoolInfo = () => {
  const [info, setInfo] = useState<FlattenedSchoolInfo>(cachedInfo || DEFAULT_INFO);
  const [loading, setLoading] = useState<boolean>(!cachedInfo);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let mounted = true;
    if (cachedInfo) {
      setInfo(cachedInfo);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    setLoading(true);
    fetchPublicSchoolInfo()
      .then((data) => {
        if (!mounted) return;
        setInfo(data);
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error("[usePublicSchoolInfo] Fetch failed:", err);
        setError(err);
        setInfo(DEFAULT_INFO);
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPublicSchoolInfo(true);
      setInfo(data);
      setError(null);
      setLoading(false);
    } catch (err) {
      console.error("[usePublicSchoolInfo] Refresh failed:", err);
      setError(err);
      setInfo(DEFAULT_INFO);
      setLoading(false);
    }
  }, []);

  return { info, loading, error, refresh };
};

export const getCachedPublicSchoolInfo = () => cachedInfo;
