import { useEffect, useRef } from 'react';

const COLORS = [
  '#FF7A1A', '#FF5A00', '#FDBA3B', '#14B8A6',
  '#38BDF8', '#A78BFA', '#F472B6', '#F8FAFC',
];

function makeParticles(count, w, h, origin = 'top') {
  return Array.from({ length: count }, () => ({
    x:        origin === 'center' ? w / 2 + (Math.random() - 0.5) * 90 : Math.random() * w,
    y:        origin === 'center' ? h * 0.32 + (Math.random() - 0.5) * 70 : -(Math.random() * h * 0.5),
    pw:       Math.random() * 11 + 6,
    ph:       Math.random() * 6 + 4,
    color:    COLORS[Math.floor(Math.random() * COLORS.length)],
    rot:      Math.random() * 360,
    rotSpeed: (Math.random() - 0.5) * 9,
    vx:       origin === 'center' ? (Math.random() - 0.5) * 9 : (Math.random() - 0.5) * 2.8,
    vy:       origin === 'center' ? -(Math.random() * 8 + 5) : Math.random() * 4 + 2.5,
    gravity:  Math.random() * 0.12 + 0.10,
    shape:    Math.random() > 0.72 ? 'circle' : 'rect',
    opacity:  1,
  }));
}

export default function Confetti({ active, intensity = 'normal' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext('2d');
    const particleCount = intensity === 'grand' ? 190 : 90;
    const particles = [
      ...makeParticles(Math.round(particleCount * 0.55), W, H, 'center'),
      ...makeParticles(Math.round(particleCount * 0.45), W, H, 'top'),
    ];

    let animId;
    let frame = 0;
    let burstRadius = 0;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      frame++;
      burstRadius += 6;

      if (intensity === 'grand' && frame < 38) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 0.28 - frame * 0.006);
        ctx.strokeStyle = '#FF7A1A';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(W / 2, H * 0.32, burstRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      let alive = false;
      particles.forEach(p => {
        p.vy += p.gravity;
        p.y += p.vy;
        p.x += p.vx;
        p.rot += p.rotSpeed;
        if (frame > 82) p.opacity = Math.max(0, p.opacity - 0.010);
        if (p.opacity > 0) alive = true;

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x + p.pw / 2, p.y + p.ph / 2);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') {
          ctx.fillRect(-p.pw / 2, -p.ph / 2, p.pw, p.ph);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.pw / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      if (alive) animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [active, intensity]);

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
