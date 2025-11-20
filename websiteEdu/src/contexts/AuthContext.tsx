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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  backendUser: BackendUser | null;
  loading: boolean;
  setBackendUser: React.Dispatch<React.SetStateAction<BackendUser | null>>; // ✅ đổi dòng này
  login: (email: string, password: string) => Promise<void>;
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
          
          const res = await axios.get(`${API_BASE_URL}/accounts/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          const data: BackendUser = { ...res.data, idToken: token };
          setBackendUser(data);
          persistUser(data);
          console.log("✅ [Auth] Đã lấy thông tin user từ backend:", data.role);
        } catch (error: any) {
          console.error("❌ [Check backend user failed]", {
            message: error?.response?.data?.message || error.message,
            code: error?.response?.data?.code,
            status: error?.response?.status
          });
          
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

  // Login
  const login = async (email: string, password: string) => {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const user = credential.user;
      // ✅ Force refresh token khi login
      const token = await getIdToken(user, true);

      const res = await axios.get(`${API_BASE_URL}/accounts/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data: BackendUser = { ...res.data, idToken: token };
      setFirebaseUser(user);
      setBackendUser(data);
      persistUser(data);
      console.log("✅ [Login] Đăng nhập thành công:", data.role);
    } catch (err: any) {
      console.error("❌ [Login error]", {
        message: err?.response?.data?.message || err.message,
        code: err?.code
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
      value={{ firebaseUser, backendUser, loading, setBackendUser, login, logout }}
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
