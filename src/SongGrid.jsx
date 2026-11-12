import React from 'react';

export const SongCard = ({
  song,
  index,
  isPlayingThis,
  isPlaying,
  ledEnabled,
  ledMode,
  playSong,
  displayedSongs,
  toggleFavorite,
  isFav,
  cardAnimation = 'zoom-in'
}) => {
  const animClass = cardAnimation !== 'none' ? `anim-${cardAnimation}` : 'anim-none';
  const animDelay = cardAnimation !== 'none' ? `${Math.min(index * 0.04, 0.8)}s` : '0s';
  const hasLedBorder = isPlayingThis && ledEnabled;

  return (
    <div
      className={`song-card glass-card ${hasLedBorder ? `rgb-chase-box mode-${ledMode}` : 'no-led-border'} ${isPlayingThis ? 'active' : ''} ${animClass}`}
      style={{ animationDelay: animDelay }}
      onClick={() => playSong(index, displayedSongs)}
    >
      <div className="thumb-container">
        <img src={song.thumbnail} alt={song.title} loading="lazy" />
        <div className="play-overlay">
          {isPlayingThis && isPlaying ? '⏸' : '▶'}
        </div>
      </div>

      <div className="song-info">
        <h3>{song.title}</h3>
        <p>{song.artist || 'Chương Music'}</p>
      </div>

      <button
        className="fav-btn glow-hover-btn"
        onClick={(e) => toggleFavorite(song, e)}
      >
        {isFav(song.id) ? '❤️' : '🤍'}
      </button>
    </div>
  );
};

export const RecommendPopup = ({
  nextSongToPlay,
  remainingSeconds,
  setDismissedRecommend,
  setShowRecommendPopup,
  songs,
  playSong,
  ledEnabled,
  ledMode
}) => {
  if (!nextSongToPlay) return null;

  return (
    <div className={`recommend-popup-card glass-card ${ledEnabled ? `rgb-chase-box mode-${ledMode}` : 'no-led-border'}`}>
      <div className="recommend-header">
        <span className="recommend-badge">✨ GỢI Ý BÀI TIẾP THEO ({remainingSeconds}s)</span>
        <button
          className="recommend-close-btn"
          onClick={() => {
            setDismissedRecommend(true);
            setShowRecommendPopup(false);
          }}
        >
          ✕
        </button>
      </div>

      <div className="recommend-body">
        <img src={nextSongToPlay.thumbnail} alt={nextSongToPlay.title} />
        <div className="recommend-info">
          <h5>{nextSongToPlay.title}</h5>
          <p>{nextSongToPlay.artist || 'Chương Music'}</p>
        </div>
      </div>

      <div className="recommend-actions">
        <button
          className="play-now-btn glow-hover-btn"
          onClick={() => {
            const idx = songs.findIndex((s) => s.id === nextSongToPlay.id);
            if (idx !== -1) playSong(idx);
            setShowRecommendPopup(false);
          }}
        >
          ▶ Phát Ngay
        </button>
        <button
          className="cancel-recommend-btn glow-hover-btn"
          onClick={() => {
            setDismissedRecommend(true);
            setShowRecommendPopup(false);
          }}
        >
          Bỏ qua
        </button>
      </div>
    </div>
  );
};
