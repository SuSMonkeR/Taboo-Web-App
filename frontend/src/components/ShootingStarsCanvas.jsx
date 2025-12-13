import { useEffect, useRef } from "react";

export default function ShootingStarsCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const DPR = window.devicePixelRatio || 1;

    function resize() {
      canvas.width = window.innerWidth * DPR;
      canvas.height = window.innerHeight * DPR;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize);

    // -----------------------------
    // Shooting star model
    // -----------------------------
    const stars = [];

    function spawnStar() {
      const angle = Math.random() * Math.PI * 0.25 + Math.PI * 0.65; // mostly diagonal
      const speed = 900 + Math.random() * 600;

      const x = window.innerWidth + 100;
      const y = Math.random() * window.innerHeight * 0.6;

      stars.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        trail: [],
        maxTrail: 18,
      });
    }

    let lastSpawn = 0;
    let spawnDelay = 2000 + Math.random() * 4000;

    let lastTime = performance.now();

    function loop(now) {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Spawn logic (irregular timing)
      if (now - lastSpawn > spawnDelay) {
        spawnStar();
        lastSpawn = now;
        spawnDelay = 2500 + Math.random() * 6000;
      }

      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];

        s.life += dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;

        s.trail.unshift({ x: s.x, y: s.y });
        if (s.trail.length > s.maxTrail) s.trail.pop();

        // Draw trail
        for (let t = 0; t < s.trail.length - 1; t++) {
          const p1 = s.trail[t];
          const p2 = s.trail[t + 1];
          const alpha = 1 - t / s.trail.length;

          ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.5})`;
          ctx.lineWidth = 2 * alpha;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }

        // Draw head
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.beginPath();
        ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Kill when offscreen
        if (s.x < -200 || s.y > window.innerHeight + 200) {
          stars.splice(i, 1);
        }
      }

      requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        pointerEvents: "none",
      }}
    />
  );
}
