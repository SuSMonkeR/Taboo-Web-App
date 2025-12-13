// frontend/src/components/LoginPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import "./login.css";
import ShootingStarsCanvas from "./ShootingStarsCanvas";
import buildAmogusPalettes from "./amogusPalette";

// ✅ Public-root paths (because files are in frontend/public/)
const amongusBase = "/amogus.png";

/**
 * ✅ IMPORTANT:
 * - Login/auth logic is untouched.
 * - Amogus are rendered in their own absolute layer (NOT inside .loginBG)
 * - Background layers still never block input.
 *
 * Behavior goal:
 * - "Window into space": sprites drift across screen and exit the other side.
 * - They NEVER slow to a stop (no friction).
 * - You can click-drag and fling; on release they continue drifting with the new velocity.
 *
 * CRITICAL NOTE:
 * - Click/drag was failing because .loginFG covers the whole screen at z-index:10
 *   and steals pointer events. CSS fix included in login.css rewrite:
 *   .loginFG { pointer-events:none } but .loginCard and its children stay pointer-events:auto.
 */

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

  // ================================
  // Recolor setup (lazy + cached)
  // ================================
  const BASE_MID = useMemo(() => ({ r: 132, g: 134, b: 202 }), []); // #8486CA
  const BASE_SHADOW = useMemo(() => ({ r: 113, g: 95, b: 211 }), []); // #715FD3
  const MID_T = 55;
  const SHADOW_T = 55;

  const distSq = (r, g, b, t) => {
    const dr = r - t.r;
    const dg = g - t.g;
    const db = b - t.b;
    return dr * dr + dg * dg + db * db;
  };

  const PALETTES = useMemo(
    () =>
      buildAmogusPalettes({
        count: 360,
        sat: 0.86,
        midL: 0.56,
        shadowL: 0.36,
        hueJitter: 0.9,
        addNeutrals: true,
      }),
    []
  );

  const baseImgRef = useRef(null);
  const offCanvasRef = useRef(null);
  const offCtxRef = useRef(null);

  const spriteCacheRef = useRef(new Map());
  const [baseReady, setBaseReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const img = new Image();
    img.src = amongusBase;

    img.onload = () => {
      if (cancelled) return;

      baseImgRef.current = img;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      canvas.width = img.width;
      canvas.height = img.height;

      offCanvasRef.current = canvas;
      offCtxRef.current = ctx;

      spriteCacheRef.current = new Map();
      setBaseReady(true);
    };

    img.onerror = () => {
      console.warn("Could not load /amogus.png from public root");
      setBaseReady(false);
    };

    return () => {
      cancelled = true;
    };
  }, []);

  const getRecoloredSrc = (paletteKey) => {
    if (!baseReady) return amongusBase;

    const cache = spriteCacheRef.current;
    const hit = cache.get(paletteKey);
    if (hit) return hit;

    const pal = PALETTES[paletteKey];
    if (!pal) return amongusBase;

    const img = baseImgRef.current;
    const canvas = offCanvasRef.current;
    const ctx = offCtxRef.current;

    if (!img || !canvas || !ctx) return amongusBase;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (distSq(r, g, b, BASE_MID) <= MID_T * MID_T) {
        data[i] = pal.mid.r;
        data[i + 1] = pal.mid.g;
        data[i + 2] = pal.mid.b;
      } else if (distSq(r, g, b, BASE_SHADOW) <= SHADOW_T * SHADOW_T) {
        data[i] = pal.shadow.r;
        data[i + 1] = pal.shadow.g;
        data[i + 2] = pal.shadow.b;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    const url = canvas.toDataURL("image/png");
    cache.set(paletteKey, url);
    return url;
  };

  // ================================
  // Amogus drift + drag/fling
  // ================================
  const amogusLayerRef = useRef(null);
  const rafRef = useRef(0);
  const lastTRef = useRef(0);

  const spritesRef = useRef([]);
  const elsRef = useRef(new Map());

  const dragRef = useRef({
    id: null,
    offsetX: 0,
    offsetY: 0,
    samples: [],
  });

  // ✅ window listeners (works regardless of overlay layers)
  const moveListenerRef = useRef(null);
  const upListenerRef = useRef(null);

  const paletteKeys = useMemo(() => Object.keys(PALETTES), [PALETTES]);

  const rand = (seed) => {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  const getBounds = () => {
    // We purposely use viewport bounds so drift always matches visible window.
    return { w: window.innerWidth, h: window.innerHeight };
  };

  const spawnOne = (seed = Math.random() * 9999) => {
    const { w, h } = getBounds();

    const SIZE_MIN = 38;
    const SIZE_MAX = 96;

    // ✅ "lazy river" speeds (px/sec)
    const SPEED_MIN = 70;
    const SPEED_MAX = 150;

    const sidePick = rand(seed * 1.11);
    const side =
      sidePick < 0.25
        ? "left"
        : sidePick < 0.5
        ? "right"
        : sidePick < 0.75
        ? "top"
        : "bottom";

    const size = Math.round(
      SIZE_MIN + rand(seed * 2.22) * (SIZE_MAX - SIZE_MIN)
    );

    const pk =
      paletteKeys[Math.floor(rand(seed * 3.33) * paletteKeys.length)] ||
      paletteKeys[0];

    const buffer = 60;

    let x = 0,
      y = 0;

    if (side === "left") {
      x = -buffer - size;
      y = rand(seed * 4.44) * (h - size);
    } else if (side === "right") {
      x = w + buffer;
      y = rand(seed * 4.44) * (h - size);
    } else if (side === "top") {
      x = rand(seed * 4.44) * (w - size);
      y = -buffer - size;
    } else {
      x = rand(seed * 4.44) * (w - size);
      y = h + buffer;
    }

    const speed = SPEED_MIN + rand(seed * 7.77) * (SPEED_MAX - SPEED_MIN);
    const lateral = (rand(seed * 6.66) - 0.5) * (speed * 0.45);

    let vx = 0;
    let vy = 0;

    if (side === "left") {
      vx = +speed;
      vy = lateral;
    } else if (side === "right") {
      vx = -speed;
      vy = lateral;
    } else if (side === "top") {
      vx = lateral;
      vy = +speed;
    } else {
      vx = lateral;
      vy = -speed;
    }

    const curved = rand(seed * 8.88) < 0.55;
    const curveStrength = curved ? 8 + rand(seed * 9.99) * 18 : 0; // px/s^2
    const curveFreq = curved ? 0.25 + rand(seed * 10.01) * 0.55 : 0;
    const curvePhase = rand(seed * 11.11) * Math.PI * 2;
    const curveDir = rand(seed * 12.12) < 0.5 ? 1 : -1;

    const spins = rand(seed * 13.13) < 0.9;
    const vr = spins
      ? (rand(seed * 14.14) < 0.5 ? -1 : 1) *
        (10 + rand(seed * 15.15) * 34)
      : 0;

    const rot = rand(seed * 16.16) * 360;

    return {
      id: `a_${Math.floor(seed * 1e9)}_${Date.now()}`,
      paletteKey: pk,
      size,
      x,
      y,
      vx,
      vy,
      rot,
      vr,
      curveStrength,
      curveFreq,
      curvePhase,
      curveDir,
      age: 0,
      grabbed: false,
    };
  };

  const ensurePopulation = () => {
    const MAX = 11;
    const arr = spritesRef.current;
    while (arr.length < MAX) arr.push(spawnOne(Math.random() * 9999));
  };

  useEffect(() => {
    ensurePopulation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paletteKeys.length, baseReady]);

  const shouldDespawn = (s, w, h) => {
    const buffer = 220;
    return (
      s.x < -buffer - s.size ||
      s.x > w + buffer ||
      s.y < -buffer - s.size ||
      s.y > h + buffer
    );
  };

  useEffect(() => {
    let cancelled = false;

    const tick = (t) => {
      if (cancelled) return;

      const { w, h } = getBounds();

      const last = lastTRef.current || t;
      const dtMs = Math.min(32, t - last);
      const dt = dtMs / 1000;
      lastTRef.current = t;

      const arr = spritesRef.current;

      for (let i = arr.length - 1; i >= 0; i--) {
        const s = arr[i];

        s.age += dt;

        if (!s.grabbed) {
          if (s.curveStrength > 0) {
            const a =
              Math.sin(s.age * s.curveFreq * Math.PI * 2 + s.curvePhase) *
              s.curveStrength *
              s.curveDir;

            const vlen = Math.hypot(s.vx, s.vy) || 1;
            const nx = -s.vy / vlen;
            const ny = s.vx / vlen;

            s.vx += nx * a * dt;
            s.vy += ny * a * dt;
          }

          // ✅ NO damping — constant drift
          s.x += s.vx * dt;
          s.y += s.vy * dt;
        }

        // spin always
        s.rot += s.vr * dt;

        const el = elsRef.current.get(s.id);
        if (el) {
          el.style.width = `${s.size}px`;
          el.style.transform = `translate3d(${s.x}px, ${s.y}px, 0) rotate(${s.rot}deg)`;
          el.classList.toggle("grabbing", s.grabbed);
        }

        if (!s.grabbed && shouldDespawn(s, w, h)) {
          arr.splice(i, 1);
          elsRef.current.delete(s.id);
        }
      }

      ensurePopulation();
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseReady, paletteKeys.length]);

  // ================================
  // Pointer handlers (FIXED)
  // ================================
  const recordSample = (x, y) => {
    const now = performance.now();
    const d = dragRef.current;
    d.samples.push({ x, y, t: now });
    if (d.samples.length > 6) d.samples.shift();
  };

  const computeVelocity = () => {
    const d = dragRef.current;
    const s = d.samples;
    if (s.length < 2) return { vx: 0, vy: 0, speed: 0 };

    const a = s[0];
    const b = s[s.length - 1];
    const dt = Math.max(1, b.t - a.t) / 1000;

    const vx = (b.x - a.x) / dt;
    const vy = (b.y - a.y) / dt;
    const speed = Math.hypot(vx, vy);
    return { vx, vy, speed };
  };

  const removeWindowDragListeners = () => {
    if (moveListenerRef.current) {
      window.removeEventListener("pointermove", moveListenerRef.current);
      moveListenerRef.current = null;
    }
    if (upListenerRef.current) {
      window.removeEventListener("pointerup", upListenerRef.current);
      window.removeEventListener("pointercancel", upListenerRef.current);
      upListenerRef.current = null;
    }
  };

  const releaseDrag = () => {
    const d = dragRef.current;

    if (!d.id) {
      removeWindowDragListeners();
      return;
    }

    const arr = spritesRef.current;
    const s = arr.find((x) => x.id === d.id);

    removeWindowDragListeners();

    if (!s) {
      d.id = null;
      d.samples = [];
      return;
    }

    const { vx, vy, speed } = computeVelocity();

    const MAX_FLING = 1800;
    const fx = Math.max(-MAX_FLING, Math.min(MAX_FLING, vx));
    const fy = Math.max(-MAX_FLING, Math.min(MAX_FLING, vy));

    // If it was basically a click, keep original drift.
    if (speed >= 35) {
      s.vx = fx;
      s.vy = fy;

      const bonus = Math.min(80, speed * 0.05);
      const dir = fx * 0.001 + fy * 0.001 >= 0 ? 1 : -1;
      s.vr += dir * bonus;
    }

    s.grabbed = false;

    d.id = null;
    d.samples = [];
  };

  const onSpritePointerDown = (e, id) => {
    e.preventDefault();
    e.stopPropagation();

    const arr = spritesRef.current;
    const s = arr.find((x) => x.id === id);
    if (!s) return;

    // bring clicked sprite "on top" by moving it to end of array
    const idx = arr.findIndex((x) => x.id === id);
    if (idx >= 0) {
      const [picked] = arr.splice(idx, 1);
      arr.push(picked);
    }

    s.grabbed = true;

    // ✅ FIX: Use viewport coordinates (because we track move on window)
    const px = e.clientX;
    const py = e.clientY;

    dragRef.current.id = id;
    dragRef.current.offsetX = px - s.x;
    dragRef.current.offsetY = py - s.y;
    dragRef.current.samples = [];
    recordSample(px, py);

    // pointer capture is fine but not required; keep it for consistency
    e.currentTarget.setPointerCapture?.(e.pointerId);

    const onMove = (ev) => {
      ev.preventDefault?.();

      const d = dragRef.current;
      if (!d.id) return;

      const arr2 = spritesRef.current;
      const s2 = arr2.find((x) => x.id === d.id);
      if (!s2) return;

      const mx = ev.clientX;
      const my = ev.clientY;

      s2.x = mx - d.offsetX;
      s2.y = my - d.offsetY;

      // keep velocity untouched during drag; we set it on release if fling
      // (do NOT force vx/vy to 0 here; it can cause "dead" feel on click-release)
      recordSample(mx, my);
    };

    const onUp = () => releaseDrag();

    moveListenerRef.current = onMove;
    upListenerRef.current = onUp;

    // passive:false so preventDefault works (touch)
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });
  };

  useEffect(() => {
    return () => removeWindowDragListeners();
  }, []);

  // Render list (React only creates nodes; rAF updates transforms)
  const [renderList, setRenderList] = useState([]);
  useEffect(() => {
    setRenderList([...spritesRef.current]);

    const id = setInterval(() => {
      setRenderList([...spritesRef.current]);
    }, 140);

    return () => clearInterval(id);
  }, []);

  return (
    <div className="loginPage">
      {/* BACKGROUND (never steals clicks) */}
      <div className="loginBG" aria-hidden="true">
        <div className="nebula n1" />
        <div className="nebula n2" />
        <div className="nebula n3" />
        <div className="nebula n4" />

        <ShootingStarsCanvas />

        <div className="spaceDust" />
        <div className="vignette" />
        <div className="grain" />
      </div>

      {/* AMOGUS LAYER */}
      <div className="amogusLayer" ref={amogusLayerRef}>
        {renderList.map((s) => {
          const src = getRecoloredSrc(s.paletteKey);
          return (
            <img
              key={s.id}
              ref={(el) => {
                if (el) elsRef.current.set(s.id, el);
              }}
              src={src}
              alt=""
              draggable={false}
              className="amogusSprite"
              style={{
                width: `${s.size}px`,
                transform: `translate3d(${s.x}px, ${s.y}px, 0) rotate(${s.rot}deg)`,
              }}
              onPointerDown={(e) => onSpritePointerDown(e, s.id)}
            />
          );
        })}
      </div>

      {/* FOREGROUND */}
      <div className="loginFG">
        <div className="loginCard">
          <div className="cardHalo" />
          <div className="cardHolo" />

          <h2 className="loginTitle">Taboo Staff Login</h2>

          <form className="loginForm" onSubmit={handleSubmit}>
            <div className="inputRow">
              <input
                type="password"
                placeholder="Enter password…"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="loginInput"
                autoFocus
              />
            </div>

            <button type="submit" className="loginButton">
              Login
            </button>
          </form>

          <div className="loginHints">
            {error && <div className="hint err">{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
