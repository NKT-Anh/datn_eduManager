import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  getIdToken,
  signInWithEmailAndPassword,
  signOut,
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
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  backendUser: BackendUser | null;
  loading: boolean;
  setBackendUser: (user: BackendUser | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [backendUser, setBackendUser] = useState<BackendUser | null>(() => {
    const stored = localStorage.getItem("backendUser");
    return stored ? JSON.parse(stored) : null;
  });
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
          const token = await getIdToken(user);
          const res = await axios.get(`${API_BASE_URL}/accounts/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          const data: BackendUser = { ...res.data, idToken: token };
          setBackendUser(data);
          persistUser(data);
        } catch (error) {
          console.error("[Check backend user failed]", error);
          setBackendUser(null);
          persistUser(null);
        }
      } else {
        setBackendUser(null);
        persistUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Login
  const login = async (email: string, password: string) => {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const user = credential.user;
      const token = await getIdToken(user);

      const res = await axios.get(`${API_BASE_URL}/accounts/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data: BackendUser = { ...res.data, idToken: token };
      setFirebaseUser(user);
      setBackendUser(data);
      persistUser(data);
    } catch (err) {
      console.error("[Login error]", err);
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
