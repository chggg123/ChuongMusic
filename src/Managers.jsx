import React from 'react';
import { getHighResThumbnail, PRESET_BACKGROUNDS } from './constants';

export const CustomMediaManager = ({
  fileInputRef,
  handleFileUpload,
  activeBackground,
  setActiveBackground,
  customMediaList,
  handleDeleteMedia
}) => {
  return (
    <div className="custom-media-manager glass-card">
      <div className="media-manager-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2>🎨 Quản Lý & Chọn Hình Nền</h2>
          <p style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text-sub)' }}>
            Chọn mẫu nền có sẵn hoặc tải lên Ảnh / GIF / Video của riêng bạn làm nền chiếu full màn hình.
          </p>
        </div>

        <div className="upload-controls">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*,video/*,.gif"
            multiple
            style={{ display: 'none' }}
          />
          <button className="import-btn glow-hover-btn" onClick={() => fileInputRef.current && fileInputRef.current.click()}>
            ➕ Tải Nền Mới
          </button>

          {activeBackground && (
            <button className="reset-bg-btn glow-hover-btn" onClick={() => setActiveBackground(null)}>
              🔄 Mặc Định
            </button>
          )}
        </div>
      </div>

      {/* --- MỤC 1: BỘ NỀN MẪU CÓ SẮN --- */}
      <div className="preset-section" style={{ marginTop: '10px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          ✨ Kho Nền Mẫu Đẹp Có Sẵn (1-Click)
        </h3>
        <div className="media-grid">
          {PRESET_BACKGROUNDS.map((preset) => {
            const isSelected = activeBackground?.id === preset.id;
            return (
              <div
                key={preset.id}
                className={`media-card glass-card ${isSelected ? 'active-bg-card' : ''}`}
                onClick={() => setActiveBackground(preset)}
                style={{
                  border: isSelected ? '2px solid #00f2fe' : '1px solid var(--glass-border)',
                  boxShadow: isSelected ? '0 0 16px rgba(0, 242, 254, 0.4)' : 'none'
                }}
              >
                <div className="media-preview-box">
                  <img src={preset.url} alt={preset.name} className="preview-thumb" />
                  <span className="type-badge" style={{ background: 'rgba(0, 242, 254, 0.8)', color: '#000', fontWeight: 'bold' }}>PRESET</span>
                </div>

                <div className="media-card-footer" style={{ justifyContent: 'center' }}>
                  <span className="media-name" style={{ fontWeight: '700' }}>{preset.name}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '16px 0' }} />

      {/* --- MỤC 2: BÀI NỀN TẢI LÊN CỦA NGƯỜI DÙNG --- */}
      <div className="user-custom-section">
        <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px' }}>
          📁 Nền Do Bạn Tải Lên ({customMediaList.length})
        </h3>

        <div className="media-grid">
          {customMediaList.length === 0 ? (
            <div className="empty-media-msg" style={{ gridColumn: '1 / -1', padding: '20px', textAlign: 'center', color: 'var(--text-sub)', fontSize: '13px' }}>
              <p>Chưa có tệp nền cá nhân nào. Hãy bấm nút <strong>"➕ Tải Nền Mới"</strong> ở trên để thêm!</p>
            </div>
          ) : (
            customMediaList.map((item) => {
              const isSelected = activeBackground?.id === item.id;
              return (
                <div
                  key={item.id}
                  className={`media-card glass-card ${isSelected ? 'active-bg-card' : ''}`}
                  onClick={() => setActiveBackground(item)}
                  style={{
                    border: isSelected ? '2px solid #ff007f' : '1px solid var(--glass-border)',
                    boxShadow: isSelected ? '0 0 16px rgba(255, 0, 127, 0.4)' : 'none'
                  }}
                >
                  <div className="media-preview-box">
                    {item.type === 'video' ? (
                      <video src={item.url} muted className="preview-thumb" />
                    ) : (
                      <img src={item.url} alt={item.name} className="preview-thumb" />
                    )}
                    <span className="type-badge">{item.type.toUpperCase()}</span>
                  </div>

                  <div className="media-card-footer">
                    <span className="media-name" title={item.name}>{item.name}</span>
                    <button
                      className="delete-media-btn glow-hover-btn"
                      onClick={(e) => handleDeleteMedia(item.id, e)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export const PlaylistManager = ({
  newPlaylistName,
  setNewPlaylistName,
  createPlaylist,
  playlists,
  selectedPlaylistId,
  setSelectedPlaylistId,
  deletePlaylist,
  playSong,
  removeSongFromPlaylist,
  handleShufflePlay
}) => {
  const selectedPl = playlists.find((p) => p.id === selectedPlaylistId);

  return (
    <div className="playlist-manager glass-card">
      <div className="tab-title-bar">
        <h2>🎵 Playlists</h2>
      </div>

      <div className="create-playlist-box">
        <input
          type="text"
          placeholder="Nhập tên playlist mới..."
          value={newPlaylistName}
          onChange={(e) => setNewPlaylistName(e.target.value)}
        />
        <button className="import-btn glow-hover-btn" onClick={createPlaylist}>
          ➕ Tạo
        </button>
      </div>

      <div className="playlists-list-grid">
        {playlists.map((pl) => (
          <div
            key={pl.id}
            className={`playlist-card glass-card ${selectedPlaylistId === pl.id ? 'active-pl' : ''}`}
            onClick={() => setSelectedPlaylistId(selectedPlaylistId === pl.id ? null : pl.id)}
          >
            <div className="pl-info">
              <h3>🎧 {pl.name}</h3>
              <p>{pl.songs.length} bài hát</p>
            </div>
            <div className="pl-actions">
              <button
                className="delete-pl-btn glow-hover-btn"
                onClick={(e) => deletePlaylist(pl.id, e)}
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedPl && (
        <div className="playlist-songs-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <h3>🎶 Các bài hát trong Playlist "{selectedPl.name}"</h3>
            {selectedPl.songs.length > 0 && (
              <button
                className="import-btn glow-hover-btn"
                onClick={() => handleShufflePlay(selectedPl.songs)}
                style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                🔀 Phát Ngẫu Nhiên
              </button>
            )}
          </div>
          <div className="songs-grid">
            {selectedPl.songs.map((song, idx) => (
              <div
                key={song.id}
                className="song-card glass-card float-3d-card"
                onClick={() => playSong(idx, selectedPl.songs)}
              >
                <div className="thumb-container">
                  <img src={getHighResThumbnail(song)} alt={song.title} />
                  <div className="play-overlay">▶</div>
                </div>
                <div className="song-info">
                  <h3>{song.title}</h3>
                  <p>{song.artist}</p>
                </div>
                <button
                  className="remove-song-pl-btn glow-hover-btn"
                  onClick={(e) => removeSongFromPlaylist(selectedPlaylistId, song.id, e)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const QueueManager = ({ songs, currentIndex, isPlaying, ledEnabled, playSong }) => {
  return (
    <div className="queue-manager glass-card">
      <div className="tab-title-bar">
        <h2>📑 Danh sách chờ ({songs.length} bài)</h2>
      </div>

      <div className="songs-grid">
        {songs.map((song, index) => {
          const isCurrent = currentIndex === index;
          return (
            <div
              key={song.id}
              className={`song-card glass-card float-3d-card ${isCurrent ? 'active playing-rgb ' + (ledEnabled ? 'rgb-chase-box' : 'no-led-border') : ''}`}
              onClick={() => playSong(index)}
            >
              <div className="thumb-container">
                <img src={getHighResThumbnail(song)} alt={song.title} />
                <div className="play-overlay">{isCurrent && isPlaying ? '⏸' : '▶'}</div>
              </div>
              <div className="song-info">
                <h3>{index + 1}. {song.title}</h3>
                <p>{song.artist}</p>
              </div>
              <span className="song-duration">{song.duration}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
