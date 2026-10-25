import React, { useEffect, useRef } from 'react';

export const Background = ({ activeBackground }) => {
  const bgCanvasRef = useRef(null);

  useEffect(() => {
    if (activeBackground) return;

    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId = null;
    let width = 0;
    let height = 0;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);

    const resizeCanvas = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const colors = ['#00f2fe', '#ff007f', '#38ef7d', '#ffb100'];
    const particleCount = window.innerWidth < 768 ? 10 : 20;

    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 2 + 1,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.4 + 0.2,
    }));

    let lastDrawTime = 0;
    const fpsInterval = 1000 / 24;

    const renderBg = (timestamp) => {
      const elapsed = timestamp - lastDrawTime;

      if (elapsed >= fpsInterval) {
        lastDrawTime = timestamp - (elapsed % fpsInterval);

        ctx.clearRect(0, 0, width, height);

        particles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.fill();
        });
        ctx.globalAlpha = 1;
      }

      animationFrameId = requestAnimationFrame(renderBg);
    };

    const stopAnimation = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };
    const syncVisibility = () => {
      if (document.hidden) {
        stopAnimation();
      } else if (animationFrameId === null) {
        lastDrawTime = 0;
        animationFrameId = requestAnimationFrame(renderBg);
      }
    };

    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      document.removeEventListener('visibilitychange', syncVisibility);
      stopAnimation();
    };
  }, [activeBackground]);

  if (activeBackground) {
    return (
      <div className="custom-bg-container">
        {activeBackground.type === 'video' ? (
          <video src={activeBackground.url} autoPlay loop muted playsInline className="custom-bg-media" />
        ) : (
          <img src={activeBackground.url} alt="Custom Background" className="custom-bg-media" />
        )}
        <div className="custom-bg-overlay" />
      </div>
    );
  }

  return (
    <>
      <canvas ref={bgCanvasRef} className="bg-particles-canvas" />
      <div className="liquid-bg">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
        <div className="blob blob-4"></div>
        <div className="blob blob-5"></div>
      </div>
    </>
  );
};
