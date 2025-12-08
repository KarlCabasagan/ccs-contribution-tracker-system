import { createContext, useContext } from "react";
import { useAuthStatus } from "../hooks/useAuthStatus";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const auth = useAuthStatus();

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
