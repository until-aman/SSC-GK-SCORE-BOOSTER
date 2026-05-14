import { useEffect, useState, useRef } from 'react';

export default function Timer({ duration = 20, onTimeUp, resetKey }) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [soundPlayed, setSoundPlayed] = useState(false);
  const audioCtxRef = useRef(null);

  // Reset timer when resetKey changes (i.e., new question)
  useEffect(() => {
    setTimeLeft(duration);
    setSoundPlayed(false);
  }, [resetKey, duration]);

  // Soothing tick sound using Web Audio API
  const playTickSound = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      console.error('Audio tick failed:', e);
    }
  };

  // Countdown logic
  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeUp();
      return;
    }

    if (timeLeft === 7 && !soundPlayed) {
      playTickSound();
      setSoundPlayed(true);
    }

    const timer = setTimeout(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, onTimeUp, soundPlayed]);

  // SVG circle dimensions
  const size = 60;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (timeLeft / duration) * circumference;

  // Color based on time remaining
  let strokeColor = '#22c55e'; // green
  if (timeLeft <= 5) {
    strokeColor = '#ef4444'; // red
  } else if (timeLeft <= 10) {
    strokeColor = '#f59e0b'; // amber
  }

  let textColor = 'text-green-600';
  if (timeLeft <= 5) {
    textColor = 'text-red-500';
  } else if (timeLeft <= 10) {
    textColor = 'text-amber-500';
  }

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
        />
      </svg>
      <span className={`absolute text-[20px] font-[700] ${textColor}`} style={{ transition: 'color 0.5s ease' }}>
        {timeLeft}
      </span>
    </div>
  );
}
