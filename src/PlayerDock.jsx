import React, { useEffect, useRef } from 'react';
import { getHighResThumbnail, formatTime } from './constants';

export const PlayerDock = ({
  currentSong,
  isPlaying,
  ledEnabled,
  ledMode = 'ltr',
  toggleFavorite,
  isFav,
  theme,
  handlePrev,
  togglePlayPause,
  handleNext,
  currentTime,
  duration,
  handleSeek,
  backgroundPlay,
  setBackgroundPlay,
  autoPlay,
  setAutoPlay,
  showVideo,
  setShowVideo,
  playbackRate,
  showSpeedMenu,
  setShowSpeedMenu,
  changeSpeed,
  volume,
  handleVolumeChange
}) => {
  const canvasRef = useRef(null);
  const speedMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (speedMenuRef.current && !speedMenuRef.current.contains(event.target)) {
        setShowSpeedMenu(false);
      }
    };
    if (showSpeedMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSpeedMenu, setShowSpeedMenu]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const bars = window.innerWidth < 768 ? 12 : 22;

    let animId;
    let lastTime = 0;
    const fpsInterval = 1000 / 30;

    const render = (timestamp) => {
      animId = requestAnimationFrame(render);
      const elapsed = timestamp - lastTime;
      if (elapsed < fpsInterval) return;
      lastTime = timestamp - (elapsed % fpsInterval);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = canvas.width / bars;

      const rgbGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      rgbGradient.addColorStop(0, '#ff007f');
      rgbGradient.addColorStop(0.33, '#00f2fe');
      rgbGradient.addColorStop(0.66, '#38ef7d');
      rgbGradient.addColorStop(1, '#ffb100');

      for (let i = 0; i < bars; i++) {
        const height = isPlaying ? Math.random() * (canvas.height - 4) + 4 : 3;
        ctx.fillStyle = ledEnabled ? rgbGradient : (theme === 'dark' ? '#00f2fe' : '#ff0844');
        ctx.fillRect(i * barWidth, canvas.height - height, barWidth - 2, height);
      }
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, theme, ledEnabled]);

  if (!currentSong || !currentSong.id) return null;

  return (
    <footer className={`player-dock ${ledEnabled ? `rgb-chase-box mode-${ledMode}` : 'no-led-border'}`}>
      <div className="player-left">
        <div className="album-art-wrapper">
          <img
            key={currentSong.id}
            src={getHighResThumbnail(currentSong)}
            alt={currentSong.title || 'Bài hát'}
            className={isPlaying ? 'spinning' : ''}
            referrerPolicy="no-referrer"
            onLoad={(e) => {
              e.target.style.display = 'block';
            }}
            onError={(e) => {
              // Khi TikTok chặn ảnh, ẩn thẻ img đi để đĩa than Vinyl tự thiết kế lộ ra chuẩn 100%
              e.target.style.display = 'none';
            }}
          />
        </div>
        <div className="song-meta">
          <h4>{currentSong.title || 'Chưa rõ tiêu đề'}</h4>
          <p>{currentSong.artist || 'Nghệ sĩ'}</p>
        </div>
        <button className="fav-dock-btn glow-hover-btn" onClick={() => toggleFavorite && toggleFavorite(currentSong)}>
          {isFav && isFav(currentSong.id) ? '❤️' : '🤍'}
        </button>
      </div>

      <div className="player-center">
        <canvas ref={canvasRef} width={200} height={22} className="visualizer-canvas" />

        <div className="controls-group">
          <button className="ctrl-btn glow-hover-btn" onClick={handlePrev}>⏮</button>
          <button className="ctrl-btn play-btn glow-hover-btn" onClick={togglePlayPause}>
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button className="ctrl-btn glow-hover-btn" onClick={handleNext}>⏭</button>
        </div>

        <div className="progress-container">
          <span className="time-text">{formatTime(currentTime)}</span>
          <input
            type="range"
            className="progress-bar"
            min="0"
            max={duration || 0}
            step="1"
            value={currentTime || 0}
            onChange={handleSeek}
          />
          <span className="time-text">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-right">
        <button
          className={`bgplay-toggle-btn glow-hover-btn ${backgroundPlay ? 'active' : ''}`}
          onClick={() => setBackgroundPlay(!backgroundPlay)}
        >
          {backgroundPlay ? '🎧 Nền: BẬT' : '🔇 Nền: TẮT'}
        </button>

        <button
          className={`autoplay-toggle-btn glow-hover-btn ${autoPlay ? 'active' : ''}`}
          onClick={() => setAutoPlay(!autoPlay)}
        >
          {autoPlay ? '🔄 Auto: BẬT' : '⏸️ Auto: TẮT'}
        </button>

        <button
          className={`video-toggle-btn glow-hover-btn ${showVideo ? 'active' : ''}`}
          onClick={() => setShowVideo(!showVideo)}
        >
          {showVideo ? '🎵 Tắt Video' : '📹 Bật Video'}
        </button>

        <div className="speed-menu-container" ref={speedMenuRef}>
          <button className="speed-toggle-btn glow-hover-btn" onClick={() => setShowSpeedMenu(!showSpeedMenu)}>
            ⚡ {playbackRate === 1 ? '1x' : `${playbackRate}x`}
          </button>

          {showSpeedMenu && (
            <div className="speed-dropdown-options speed-liquid-glass">
              <div className="speed-quick-presets horizontal">
                {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    className={`speed-preset-btn ${playbackRate === rate ? 'active' : ''}`}
                    onClick={() => {
                      changeSpeed(rate);
                      setShowSpeedMenu(false);
                    }}
                  >
                    {rate === 1 ? '1x' : `${rate}x`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <input
          type="range"
          className="volume-bar"
          min="0"
          max="100"
          value={volume}
          onChange={handleVolumeChange}
        />
      </div>
    </footer>
  );
};
