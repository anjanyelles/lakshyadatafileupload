import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loginRequest, setUnauthorizedHandler } from "../services/api";

const AuthContext = createContext(null);

const STORAGE_USER_KEY = "authUser";
const STORAGE_TOKEN_KEY = "authToken";

const readStoredAuth = () => {
  const token = localStorage.getItem(STORAGE_TOKEN_KEY);
  const rawUser = localStorage.getItem(STORAGE_USER_KEY);
  const user = rawUser ? JSON.parse(rawUser) : null;

  if (!token || !user) {
    return { token: "", user: null };
  }

  return { token, user };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const stored = readStoredAuth();
    setUser(stored.user);
    setToken(stored.token);
    setIsInitializing(false);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
    });
  }, []);

  const persistAuth = (nextUser, nextToken) => {
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(nextUser));
    localStorage.setItem(STORAGE_TOKEN_KEY, nextToken);
    setUser(nextUser);
    setToken(nextToken);
  };

  const login = async ({ email, password }) => {
    const response = await loginRequest({ email, password });
    if (!response?.token || !response?.user) {
      throw new Error("Invalid login response.");
    }

    persistAuth(response.user, response.token);
    return response.user;
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_USER_KEY);
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    setUser(null);
    setToken("");
  };

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isInitializing,
      login,
      logout,
      hasRole: (role) => (role ? user?.role === role : true),
    }),
    [user, token, isInitializing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return ctx;
};
