import { useState } from "react";
import "./global.css";
import LoginPage from "./components/LoginPage";
import MainApp from "./components/MainApp";

export default function App() {
  // Initialize auth state from localStorage so refresh keeps you logged in
  const [auth, setAuth] = useState(() => {
    const storedToken = window.localStorage.getItem("taboo_token");
    const storedRole = window.localStorage.getItem("taboo_role");
    const storedDisplayName = window.localStorage.getItem("taboo_display_name");

    if (storedToken && storedRole && storedDisplayName) {
      return { 
        token: storedToken, 
        role: storedRole,
        displayName: storedDisplayName
      };
    }
    return { token: null, role: null, displayName: null };
  });

  const handleLogin = (token, role, displayName) => {
    // Persist to localStorage for future reloads
    window.localStorage.setItem("taboo_token", token);
    window.localStorage.setItem("taboo_role", role);
    window.localStorage.setItem("taboo_display_name", displayName);

    setAuth({ token, role, displayName });
  };

  const handleLogout = () => {
    window.localStorage.removeItem("taboo_token");
    window.localStorage.removeItem("taboo_role");
    window.localStorage.removeItem("taboo_display_name");
    setAuth({ token: null, role: null, displayName: null });
  };

  if (!auth.token || !auth.role) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <MainApp
      role={auth.role}
      token={auth.token}
      displayName={auth.displayName}
      onLogout={handleLogout}
    />
  );
}