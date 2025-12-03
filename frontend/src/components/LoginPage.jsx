import { useState } from "react";

export default function LoginPage({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch("http://127.0.0.1:8000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok) {
        onLogin(data.token);
      } else {
        setError(data.detail || "Invalid password");
      }
    } catch (err) {
      setError("Server unavailable");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.box}>
        <h2>Taboo Admin Login</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Enter password…"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />

          <button type="submit" style={styles.button}>
            Login
          </button>
        </form>

        {error && <p style={styles.error}>{error}</p>}
      </div>
    </div>
  );
}

const styles = {
  container: {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f7f7f7",
  },
  box: {
    padding: 30,
    borderRadius: 12,
    background: "#fff",
    boxShadow: "0 0 12px rgba(0,0,0,0.1)",
    textAlign: "center",
  },
  input: {
    width: "100%",
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    width: "100%",
    padding: 10,
    fontSize: 16,
    background: "#333",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    borderRadius: 6,
  },
  error: { color: "red", marginTop: 10 },
};
