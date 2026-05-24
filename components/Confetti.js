import { useEffect, useRef } from 'react';

const COLORS = [
  '#f59e0b', '#10b981', '#3b82f6', '#ec4899',
  '#8b5cf6', '#ef4444', '#06b6d4', '#fbbf24',
];

function makeParticles(count, w, h) {
  return Array.from({ length: count }, () => ({
    x:        Math.random() * w,
    y:        -(Math.random() * h * 0.5),   // start above viewport
    pw:       Math.random() * 10 + 6,
    ph:       Math.random() * 5 + 3,
    color:    COLORS[Math.floor(Math.random() * COLORS.length)],
    rot:      Math.random() * 360,
    rotSpeed: (Math.random() - 0.5) * 7,
    vx:       (Math.random() - 0.5) * 2.5,
    vy:       Math.random() * 4 + 2.5,
    opacity:  1,
  }));
}

/**
 * Confetti — renders a canvas burst when `active` flips to true.
 * Auto-fades out after ~2.5 s of particles falling.
 */
export default function Confetti({ active }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width  = W;
    canvas.height = H;

    const ctx = canvas.getContext('2d');
    const particles = makeParticles(90, W, H);

    let animId;
    let frame = 0;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      frame++;

      let alive = false;
      particles.forEach(p => {
        p.y   += p.vy;
        p.x   += p.vx;
        p.rot += p.rotSpeed;
        // Start fading after first second (≈60 frames)
        if (frame > 60) p.opacity = Math.max(0, p.opacity - 0.013);
        if (p.opacity > 0) alive = true;

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x + p.pw / 2, p.y + p.ph / 2);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        // Alternate between rect and circle for variety
        if (Math.round(p.pw) % 2 === 0) {
          ctx.fillRect(-p.pw / 2, -p.ph / 2, p.pw, p.ph);
        } else {
          ctx.arc(0, 0, p.ph / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      if (alive) {
        animId = requestAnimationFrame(draw);
      }
    }

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
}
