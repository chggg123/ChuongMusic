import React from 'react';

export const SidebarMenu = ({
  sidebarOpen,
  setSidebarOpen,
  activeTab,
  setActiveTab,
  songsCount,
  favoritesCount,
  playlistsCount,
  handleGoHome
}) => {
  return (
    <>
      <aside className={`liquid-sidebar glass-card ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Menu</h2>
          <button className="close-btn glow-hover-btn" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>
        <nav className="sidebar-menu">
          <button
            className={`menu-item glow-hover-btn ${activeTab === 'home' ? 'active' : ''}`}
            onClick={handleGoHome}
          >
            🏠 Trang chủ (Nhạc HOT)
          </button>

          <button
            className={`menu-item glow-hover-btn ${activeTab === 'audio-fx' ? 'active' : ''}`}
            onClick={() => { setActiveTab('audio-fx'); setSidebarOpen(false); }}
          >
            🎛️ Tùy Chỉnh Âm Thanh (8D/Bass)
          </button>

          <button
            className={`menu-item glow-hover-btn ${activeTab === 'queue' ? 'active' : ''}`}
            onClick={() => { setActiveTab('queue'); setSidebarOpen(false); }}
          >
            📑 Danh sách chờ ({songsCount})
          </button>
          <button
            className={`menu-item glow-hover-btn ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => { setActiveTab('favorites'); setSidebarOpen(false); }}
          >
            ❤️ Yêu thích ({favoritesCount})
          </button>
          <button
            className={`menu-item glow-hover-btn ${activeTab === 'playlist' ? 'active' : ''}`}
            onClick={() => { setActiveTab('playlist'); setSidebarOpen(false); }}
          >
            🎵 Playlists ({playlistsCount})
          </button>
          <button
            className={`menu-item glow-hover-btn ${activeTab === 'custom-media' ? 'active' : ''}`}
            onClick={() => { setActiveTab('custom-media'); setSidebarOpen(false); }}
          >
            🖼️ Import Nền (Ảnh/GIF/Video)
          </button>
        </nav>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}
    </>
  );
};
