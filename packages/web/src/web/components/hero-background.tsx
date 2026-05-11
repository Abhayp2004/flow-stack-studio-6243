import { useEffect, useRef } from "react";

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  baseOpacity: number;
  phase: number;
  phaseSpeed: number;
  layer: number;
}

interface Packet {
  progress: number;
  speed: number;
  trail: Array<{ x: number; y: number }>;
}

interface Stream {
  pts: Array<{ x: number; y: number }>;
  packets: Packet[];
  nextSpawn: number;
  spawnInterval: number;
  rgb: string;
}

interface PulseWave {
  x: number; y: number;
  r: number; maxR: number;
  opacity: number;
}

function makeCubicBezier(
  x0: number, y0: number,
  x3: number, y3: number,
  steps = 60
): Array<{ x: number; y: number }> {
  const x1 = x0 + (x3 - x0) * 0.25 + (Math.random() - 0.5) * 350;
  const y1 = y0 + (y3 - y0) * 0.25 + (Math.random() - 0.5) * 350;
  const x2 = x0 + (x3 - x0) * 0.75 + (Math.random() - 0.5) * 350;
  const y2 = y0 + (y3 - y0) * 0.75 + (Math.random() - 0.5) * 350;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push({
      x: u*u*u*x0 + 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t*x3,
      y: u*u*u*y0 + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*y3,
    });
  }
  return pts;
}

function randomEdge(W: number, H: number) {
  const e = Math.floor(Math.random() * 4);
  if (e === 0) return { x: Math.random() * W, y: -40 };
  if (e === 1) return { x: W + 40, y: Math.random() * H };
  if (e === 2) return { x: Math.random() * W, y: H + 40 };
  return { x: -40, y: Math.random() * H };
}

export function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = window.innerWidth;
    let H = window.innerHeight;

    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
    };
    resize();

    // ── Particle constellation ──────────────────────────────────────────
    const PARTICLE_N = 70;
    const particles: Particle[] = Array.from({ length: PARTICLE_N }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      r: Math.random() * 1.3 + 0.4,
      baseOpacity: Math.random() * 0.45 + 0.15,
      phase: Math.random() * Math.PI * 2,
      phaseSpeed: 0.007 + Math.random() * 0.013,
      layer: Math.floor(Math.random() * 3),
    }));

    // ── Data streams ────────────────────────────────────────────────────
    const STREAM_COLORS = ["110,86,207", "139,114,232", "80,55,180", "160,140,255", "95,70,210"];
    const streams: Stream[] = Array.from({ length: 6 }, (_, i) => ({
      pts: makeCubicBezier(randomEdge(W, H).x, randomEdge(W, H).y, randomEdge(W, H).x, randomEdge(W, H).y),
      packets: [],
      nextSpawn: i * 25,
      spawnInterval: 50 + Math.floor(Math.random() * 70),
      rgb: STREAM_COLORS[i % STREAM_COLORS.length],
    }));

    // ── Pulse waves ──────────────────────────────────────────────────────
    const pulses: PulseWave[] = [];
    let nextPulseAt = 80;

    const TRAIL = 22;
    const MAX_CONN_D = 125;
    let frame = 0;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      frame++;

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // ── Update particles ──
      for (const p of particles) {
        p.phase += p.phaseSpeed;

        const layerSpeed = 1 - p.layer * 0.25; // depth: layer 0 fastest

        // Mouse repulsion
        const dx = p.x - mx;
        const dy = p.y - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < 180 * 180 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const force = (180 - d) / 180 * 0.003 * layerSpeed;
          p.vx += (dx / d) * force;
          p.vy += (dy / d) * force;
        }

        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (spd > 0.45 * layerSpeed) {
          p.vx = (p.vx / spd) * 0.45 * layerSpeed;
          p.vy = (p.vy / spd) * 0.45 * layerSpeed;
        }
        p.vx *= 0.995;
        p.vy *= 0.995;

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -25) p.x = W + 25;
        if (p.x > W + 25) p.x = -25;
        if (p.y < -25) p.y = H + 25;
        if (p.y > H + 25) p.y = -25;
      }

      // ── Constellation connections ──
      for (let i = 0; i < PARTICLE_N; i++) {
        for (let j = i + 1; j < PARTICLE_N; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < MAX_CONN_D) {
            const alpha = (1 - d / MAX_CONN_D) * 0.13;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(110,86,207,${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // ── Draw particles ──
      for (const p of particles) {
        const pulse = 0.6 + 0.4 * Math.sin(p.phase);
        const op = p.baseOpacity * pulse;

        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 7);
        grd.addColorStop(0, `rgba(139,114,232,${op * 0.45})`);
        grd.addColorStop(1, "rgba(139,114,232,0)");
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 7, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(215,200,255,${op})`;
        ctx.fill();
      }

      // ── Data streams ──
      for (const s of streams) {
        if (frame >= s.nextSpawn) {
          s.packets.push({
            progress: 0,
            speed: 0.006 + Math.random() * 0.007,
            trail: [],
          });
          s.nextSpawn = frame + s.spawnInterval;
        }

        for (let i = s.packets.length - 1; i >= 0; i--) {
          const pk = s.packets[i];
          pk.progress = Math.min(pk.progress + pk.speed, 1);

          const idx = Math.min(Math.floor(pk.progress * (s.pts.length - 1)), s.pts.length - 1);
          const pt = s.pts[idx];

          pk.trail.unshift({ x: pt.x, y: pt.y });
          if (pk.trail.length > TRAIL) pk.trail.pop();

          if (pk.progress >= 1) {
            s.packets.splice(i, 1);
            continue;
          }

          // Trail
          for (let k = 0; k < pk.trail.length; k++) {
            const tp = pk.trail[k];
            const ratio = (TRAIL - k) / TRAIL;
            ctx.beginPath();
            ctx.arc(tp.x, tp.y, ratio * 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${s.rgb},${ratio * 0.65})`;
            ctx.fill();
          }

          // Head glow
          const hg = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 10);
          hg.addColorStop(0, `rgba(${s.rgb},1)`);
          hg.addColorStop(0.35, `rgba(${s.rgb},0.4)`);
          hg.addColorStop(1, `rgba(${s.rgb},0)`);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 10, 0, Math.PI * 2);
          ctx.fillStyle = hg;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2.2, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(240,230,255,0.95)";
          ctx.fill();
        }
      }

      // ── Pulse waves ──
      if (frame >= nextPulseAt) {
        const src = particles[Math.floor(Math.random() * PARTICLE_N)];
        pulses.push({ x: src.x, y: src.y, r: 0, maxR: 70 + Math.random() * 80, opacity: 0.45 });
        nextPulseAt = frame + 80 + Math.floor(Math.random() * 100);
      }

      for (let i = pulses.length - 1; i >= 0; i--) {
        const pw = pulses[i];
        pw.r += 1.1;
        pw.opacity *= 0.968;
        if (pw.r >= pw.maxR || pw.opacity < 0.01) { pulses.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(pw.x, pw.y, pw.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(110,86,207,${pw.opacity})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();

    const onMouse = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouse);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}
