import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  getIdToken,
  signInWithEmailAndPassword,
  signOut,
  getAuth,
} from "firebase/auth";
import { auth } from "../services/firebase/firebase";
import axios from "axios";
import { getEffectivePermissions } from "../utils/permissions";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * ✅ Helper: Lấy năm học hiện tại đang active
 * Ưu tiên: settings/public -> null (backend sẽ tự động fallback)
 */
const getCurrentActiveSchoolYear = async (): Promise<string | null> => {
  try {
    const settingsRes = await axios.get(`${API_BASE_URL || 'http://localhost:3000/api'}/settings/public`, {
      timeout: 5000, // 5 giây timeout
    });
    const settingData = settingsRes?.data;
    if (settingData && settingData.currentSchoolYear) {
      return String(settingData.currentSchoolYear);
    }
  } catch (error: any) {
    // ✅ Không log lỗi connection refused ở đây vì đây là optional call
    // Backend sẽ tự động fallback về năm học mặc định
    if (error?.code !== 'ERR_NETWORK' && error?.code !== 'ERR_CONNECTION_REFUSED') {
      console.warn('⚠️ [Auth] Không lấy được năm học từ settings:', error);
    }
  }
  return null;
};

interface BackendUser {
  name: string;
  email: string;
  role: string;
  idToken: string;
  phone: string;

  uid:string;
  _id: string;
    teacherId?: string;
  studentId?: string;
  adminId?: string;
  subjects?: any[];
  class?: string | null;
  position?: string | null;
  department?: string | null;
  teacherFlags?: {
    isHomeroom?: boolean;
    isDepartmentHead?: boolean;
    isLeader?: boolean;
    permissions?: any[];
  };
  effectivePermissions?: string[]; // ✅ Permissions đã được mở rộng dựa trên role và teacherFlags
  currentSchoolYear?: string | null; // ✅ Năm học hiện tại đang active
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  backendUser: BackendUser | null;
  loading: boolean;
  setBackendUser: React.Dispatch<React.SetStateAction<BackendUser | null>>; // ✅ đổi dòng này
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  // ✅ Không load từ localStorage nữa, đợi Firebase xác thực
  const [backendUser, setBackendUser] = useState<BackendUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper: lưu user vào localStorage
  const persistUser = (user: BackendUser | null) => {
    if (user) {
      localStorage.setItem("backendUser", JSON.stringify(user));
    } else {
      localStorage.removeItem("backendUser");
    }
  };

  // Lắng nghe trạng thái Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (user) {
        try {
          // ✅ Luôn lấy token mới từ Firebase (force refresh nếu cần)
          const token = await getIdToken(user, true); // forceRefresh = true
          console.log("✅ [Auth] Đã lấy token mới từ Firebase");
          
          // ✅ Lấy năm học hiện tại đang active
          const effectiveYear = await getCurrentActiveSchoolYear();

          // Request backend account info with optional x-school-year header so backend returns flags for that year
          const accountRes = await axios.get(`${API_BASE_URL || 'http://localhost:3000/api'}/accounts/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
              ...(effectiveYear ? { 'x-school-year': effectiveYear } : {}),
            },
            timeout: 10000, // 10 giây timeout
          });

          // ✅ Tính toán effective permissions từ role và teacherFlags
          const userData: BackendUser = { ...accountRes.data, idToken: token };
          const effectivePermissions = getEffectivePermissions(userData);
          
          const data: BackendUser = {
            ...userData,
            effectivePermissions,
            currentSchoolYear: effectiveYear,
          };
          
          setBackendUser(data);
          persistUser(data);
          console.log("✅ [Auth] Đã lấy thông tin user từ backend:", {
            role: data.role,
            schoolYear: effectiveYear,
            permissionsCount: effectivePermissions.length,
            isLeader: data.teacherFlags?.isLeader,
            isHomeroom: data.teacherFlags?.isHomeroom,
            isDepartmentHead: data.teacherFlags?.isDepartmentHead,
          });
        } catch (error: any) {
          // ✅ Kiểm tra lỗi kết nối backend
          const isConnectionError = 
            error?.code === 'ERR_NETWORK' || 
            error?.code === 'ERR_CONNECTION_REFUSED' ||
            error?.code === 'ECONNREFUSED' ||
            error?.message?.includes('ERR_CONNECTION_REFUSED') ||
            error?.message?.includes('Network Error') ||
            (error?.response === undefined && error?.request);
          
          if (isConnectionError) {
            console.error("❌ [Check backend user failed] Backend server không chạy hoặc không thể kết nối:", {
              message: 'Backend server không chạy. Vui lòng kiểm tra backend server đã chạy chưa (port 3000).',
              code: error?.code
            });
          } else {
            console.error("❌ [Check backend user failed]", {
              message: error?.response?.data?.message || error.message,
              code: error?.response?.data?.code,
              status: error?.response?.status
            });
          }
          
          // Nếu lỗi 401, clear localStorage và đăng xuất
          if (error?.response?.status === 401) {
            console.log("⚠️ [Auth] Token không hợp lệ, đang clear session...");
            setBackendUser(null);
            persistUser(null);
            // Không logout Firebase vì user vẫn đăng nhập trên Firebase
            // Chỉ clear backend session
          } else {
            setBackendUser(null);
            persistUser(null);
          }
        }
      } else {
        // User đã logout từ Firebase
        setBackendUser(null);
        persistUser(null);
      }

      setLoading(false);
    });

    // ✅ Tự động refresh token định kỳ (mỗi 50 phút, token Firebase hết hạn sau 1 giờ)
    const refreshTokenInterval = setInterval(async () => {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const freshToken = await getIdToken(currentUser, true);
          const backendUser = localStorage.getItem("backendUser");
          if (backendUser) {
            try {
              const userData = JSON.parse(backendUser);
              userData.idToken = freshToken;
              localStorage.setItem("backendUser", JSON.stringify(userData));
              setBackendUser(userData);
              console.log("✅ [Auth] Đã refresh token tự động");
            } catch (err) {
              console.warn('Không thể cập nhật token trong localStorage');
            }
          }
        } catch (error) {
          console.error("❌ [Auth] Lỗi refresh token tự động:", error);
        }
      }
    }, 50 * 60 * 1000); // 50 phút

    return () => {
      unsubscribe();
      clearInterval(refreshTokenInterval);
    };
  }, []);

  // Google Sign-In
  const loginWithGoogle = async () => {
    try {
      const { signInWithPopup } = await import("firebase/auth");
      const { auth, googleProvider } = await import("@/services/firebase/firebase");
      
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const idToken = await getIdToken(user, true);
      
      // ✅ Lấy năm học hiện tại đang active
      let effectiveYear: string | null = null;
      try {
        effectiveYear = await getCurrentActiveSchoolYear();
      } catch (error) {
        console.warn('⚠️ [Google Login] Không lấy được năm học từ settings');
      }

      const res = await axios.get(`${API_BASE_URL || 'http://localhost:3000/api'}/accounts/me`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
          ...(effectiveYear ? { 'x-school-year': effectiveYear } : {}),
        },
        timeout: 10000,
      });

      const userData: BackendUser = { ...res.data, idToken };
      const effectivePermissions = getEffectivePermissions(userData);
      
      const data: BackendUser = {
        ...userData,
        effectivePermissions,
        currentSchoolYear: effectiveYear,
      };
      
      setFirebaseUser(user);
      setBackendUser(data);
      persistUser(data);
      
      console.log("✅ [Google Login] Đăng nhập thành công:", {
        role: data.role,
        email: user.email,
        schoolYear: effectiveYear,
      });
    } catch (err: any) {
      console.error("❌ [Google Login error]", err);
      throw err;
    }
  };

  // Login
  const login = async (email: string, password: string) => {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const user = credential.user;
      // ✅ Force refresh token khi login
      const token = await getIdToken(user, true);
      
      // ✅ Lấy năm học hiện tại đang active
      let effectiveYear: string | null = null;
      try {
        effectiveYear = await getCurrentActiveSchoolYear();
      } catch (error) {
        // Nếu không lấy được năm học từ settings, vẫn tiếp tục (backend sẽ tự động fallback)
        console.warn('⚠️ [Login] Không lấy được năm học từ settings, backend sẽ tự động fallback');
      }

      const res = await axios.get(`${API_BASE_URL || 'http://localhost:3000/api'}/accounts/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(effectiveYear ? { 'x-school-year': effectiveYear } : {}),
        },
        timeout: 10000, // 10 giây timeout
      });

      // ✅ Tính toán effective permissions từ role và teacherFlags
      const userData: BackendUser = { ...res.data, idToken: token };
      const effectivePermissions = getEffectivePermissions(userData);
      
      const data: BackendUser = {
        ...userData,
        effectivePermissions,
        currentSchoolYear: effectiveYear,
      };
      
      setFirebaseUser(user);
      setBackendUser(data);
      persistUser(data);
      console.log("✅ [Login] Đăng nhập thành công:", {
        role: data.role,
        schoolYear: effectiveYear,
        permissionsCount: effectivePermissions.length,
        isLeader: data.teacherFlags?.isLeader,
        isHomeroom: data.teacherFlags?.isHomeroom,
        isDepartmentHead: data.teacherFlags?.isDepartmentHead,
      });
    } catch (err: any) {
      // ✅ Kiểm tra lỗi kết nối backend
      const isConnectionError = 
        err?.code === 'ERR_NETWORK' || 
        err?.code === 'ERR_CONNECTION_REFUSED' ||
        err?.code === 'ECONNREFUSED' ||
        err?.message?.includes('ERR_CONNECTION_REFUSED') ||
        err?.message?.includes('Network Error') ||
        (err?.response === undefined && err?.request);
      
      if (isConnectionError) {
        const errorMessage = new Error('ERR_BACKEND_CONNECTION_REFUSED');
        (errorMessage as any).code = 'ERR_BACKEND_CONNECTION_REFUSED';
        (errorMessage as any).message = 'Không thể kết nối đến backend server. Vui lòng kiểm tra backend server đã chạy chưa (port 3000).';
        throw errorMessage;
      }
      
      console.error("❌ [Login error]", {
        message: err?.response?.data?.message || err.message,
        code: err?.code,
        status: err?.response?.status
      });
      throw err;
    }
  };

  // Logout
  const logout = async () => {
    await signOut(auth);
    setFirebaseUser(null);
    setBackendUser(null);
    persistUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ firebaseUser, backendUser, loading, setBackendUser, login, loginWithGoogle, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
