// frontend/src/components/LoginPage.jsx
import { useEffect, useMemo, useState } from "react";
import "./login.css";

// ✅ Public-root paths (because files are in frontend/public/)
const amongusBase = "/amogus.png";

export default function LoginPage({ onLogin }) {
  // ===== DO NOT CHANGE FUNCTIONALITY =====
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch("http://127.0.0.1:8000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError((data && data.detail) || "Invalid password");
        return;
      }

      onLogin(data.token, data.role);
    } catch (err) {
      console.error(err);
      setError("Server unavailable");
    }
  };
  // ===== END FUNCTIONALITY =====

  const BASE_MID = useMemo(() => ({ r: 132, g: 134, b: 202 }), []); // #8486CA
  const BASE_SHADOW = useMemo(() => ({ r: 113, g: 95, b: 211 }), []); // #715FD3

  const PALETTES = useMemo(
    () => ({
      red: { mid: { r: 239, g: 68, b: 68 }, shadow: { r: 185, g: 28, b: 28 } },
      blue: { mid: { r: 59, g: 130, b: 246 }, shadow: { r: 29, g: 78, b: 216 } },
      green: { mid: { r: 34, g: 197, b: 94 }, shadow: { r: 22, g: 163, b: 74 } },
      yellow: { mid: { r: 250, g: 204, b: 21 }, shadow: { r: 202, g: 138, b: 4 } },
      orange: { mid: { r: 249, g: 115, b: 22 }, shadow: { r: 194, g: 65, b: 12 } },
      purple: { mid: { r: 168, g: 85, b: 247 }, shadow: { r: 126, g: 34, b: 206 } },
      cyan: { mid: { r: 34, g: 211, b: 238 }, shadow: { r: 8, g: 145, b: 178 } },
      pink: { mid: { r: 244, g: 114, b: 182 }, shadow: { r: 190, g: 24, b: 93 } },
      lime: { mid: { r: 132, g: 204, b: 22 }, shadow: { r: 101, g: 163, b: 13 } },
      white: { mid: { r: 245, g: 245, b: 245 }, shadow: { r: 210, g: 210, b: 210 } },
      gray: { mid: { r: 163, g: 163, b: 163 }, shadow: { r: 113, g: 113, b: 113 } },
      brown: { mid: { r: 120, g: 72, b: 40 }, shadow: { r: 83, g: 46, b: 24 } },
    }),
    []
  );

  function distSq(r, g, b, t) {
    const dr = r - t.r;
    const dg = g - t.g;
    const db = b - t.b;
    return dr * dr + dg * dg + db * db;
  }

  // Wider tolerance so recolor actually hits even with minor PNG edge pixels
  const MID_T = 55;
  const SHADOW_T = 55;

  const [spriteMap, setSpriteMap] = useState({});
  const [recolorReady, setRecolorReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const img = new Image();
    img.src = amongusBase;

    img.onload = () => {
      if (cancelled) return;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      canvas.width = img.width;
      canvas.height = img.height;

      const out = {};
      let totalHits = 0;

      for (const [name, pal] of Object.entries(PALETTES)) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        let hits = 0;

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] === 0) continue;

          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          if (distSq(r, g, b, BASE_MID) <= MID_T * MID_T) {
            data[i] = pal.mid.r;
            data[i + 1] = pal.mid.g;
            data[i + 2] = pal.mid.b;
            hits++;
          } else if (distSq(r, g, b, BASE_SHADOW) <= SHADOW_T * SHADOW_T) {
            data[i] = pal.shadow.r;
            data[i + 1] = pal.shadow.g;
            data[i + 2] = pal.shadow.b;
            hits++;
          }
        }

        totalHits += hits;

        ctx.putImageData(imageData, 0, 0);
        out[name] = canvas.toDataURL("image/png");
      }

      setSpriteMap(out);
      setRecolorReady(totalHits > 0);
    };

    img.onerror = () => {
      console.warn("Could not load /amongus.png from public root");
      setRecolorReady(false);
    };

    return () => {
      cancelled = true;
    };
  }, [PALETTES, BASE_MID, BASE_SHADOW]);

  const crew = useMemo(
    () => [
      { palette: "red",    size: 110, top: "12%", left: "-18%", drift: "driftA", driftDur: 42, driftDelay: -4,  spinDur: 14, spinDir:  1, depth: 0 },
      { palette: "cyan",   size: 78,  top: "20%", left: "108%", drift: "driftB", driftDur: 56, driftDelay: -18, spinDur: 0,  spinDir:  1, depth: 1 },
      { palette: "lime",   size: 62,  top: "74%", left: "110%", drift: "driftC", driftDur: 64, driftDelay: -33, spinDur: 26, spinDir: -1, depth: 2 },
      { palette: "purple", size: 96,  top: "80%", left: "-22%", drift: "driftD", driftDur: 58, driftDelay: -21, spinDur: 9,  spinDir:  1, depth: 0 },
      { palette: "yellow", size: 54,  top: "56%", left: "46%",  drift: "driftE", driftDur: 70, driftDelay: -41, spinDur: 0,  spinDir:  1, depth: 3 },
      { palette: "blue",   size: 44,  top: "34%", left: "-16%", drift: "driftF", driftDur: 88, driftDelay: -60, spinDur: 40, spinDir:  1, depth: 4 },
      { palette: "pink",   size: 66,  top: "40%", left: "112%", drift: "driftG", driftDur: 76, driftDelay: -52, spinDur: 18, spinDir: -1, depth: 2 },
    ],
    []
  );

  const shootingStars = useMemo(
    () => [
      { cls: "star1", dur: 11, delay: 2 },
      { cls: "star2", dur: 14, delay: 6 },
      { cls: "star3", dur: 17, delay: 10 },
    ],
    []
  );

  return (
    <div className="loginPage">
      <div className="loginBG" aria-hidden="true">
        <div className="nebula n1" />
        <div className="nebula n2" />
        <div className="nebula n3" />
        <div className="nebula n4" />

        <div className="stars" />
        <div className="vignette" />
        <div className="grain" />

        {shootingStars.map((s, i) => (
          <div
            key={i}
            className={`shootingStar ${s.cls}`}
            style={{
              animationDuration: `${s.dur}s`,
              animationDelay: `${-s.delay}s`,
            }}
          />
        ))}

        {crew.map((c, idx) => {
          const recolored = spriteMap[c.palette];
          const src = recolorReady && recolored ? recolored : amongusBase;

          return (
            <img
              key={idx}
              src={src}
              alt=""
              className={`crew ${c.drift} depth${c.depth} ${c.spinDur ? "spin" : "noSpin"}`}
              style={{
                width: `${c.size}px`,
                top: c.top,
                left: c.left,
                animationDuration: `${c.driftDur}s, ${c.spinDur ? c.spinDur : 0}s`,
                animationDelay: `${c.driftDelay}s, 0s`,
                "--spinDir": String(c.spinDir),
              }}
              draggable={false}
            />
          );
        })}
      </div>

      <div className="loginFG">
        <div className="loginCard">
          <h2 className="loginTitle">Taboo Staff Login</h2>

          <form className="loginForm" onSubmit={handleSubmit}>
            <input
              type="password"
              placeholder="Enter password…"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="loginInput"
              autoFocus
            />

            <button type="submit" className="loginButton">
              Login
            </button>
          </form>

          {error && <p className="loginError">{error}</p>}
        </div>
      </div>
    </div>
  );
}
