import { useState } from "react";
import "./global.css";
import LoginPage from "./components/LoginPage";
import MainApp from "./components/MainApp";

export default function App() {
  const [token, setToken] = useState(null);

  if (!token) {
    return <LoginPage onLogin={setToken} />;
  }

  return <MainApp />;
}
