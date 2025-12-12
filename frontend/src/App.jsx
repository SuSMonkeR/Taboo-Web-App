import { useState } from "react";
import "./global.css";
import LoginPage from "./components/LoginPage";
import MainApp from "./components/MainApp";

export default function App() {
  // Initialize auth state from localStorage so refresh keeps you logged in
  const [auth, setAuth] = useState(() => {
    const storedToken = window.localStorage.getItem("taboo_token");
    const storedRole = window.localStorage.getItem("taboo_role");

    if (storedToken && storedRole) {
      return { token: storedToken, role: storedRole };
    }
    return { token: null, role: null };
  });

  const handleLogin = (token, role) => {
    // Persist to localStorage for future reloads
    window.localStorage.setItem("taboo_token", token);
    window.localStorage.setItem("taboo_role", role);

    setAuth({ token, role });
  };

  const handleLogout = () => {
    window.localStorage.removeItem("taboo_token");
    window.localStorage.removeItem("taboo_role");
    setAuth({ token: null, role: null });
  };

  if (!auth.token || !auth.role) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <MainApp
      role={auth.role}
      token={auth.token}
      onLogout={handleLogout}
    />
  );
}
