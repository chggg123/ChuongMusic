import React, { useState, useRef, useEffect } from 'react';

export const HeaderNav = ({
  query,
  setQuery,
  suggestions,
  showSuggestions,
  setShowSuggestions,
  searchHistory,
  executeSearch,
  clearSearchHistory,
  handleRefreshRecommendations,
  handleResetUserData,
  ledEnabled,
  setLedEnabled,
  ledMode,
  setLedMode,
  ledBrightness,
  setLedBrightness,
  theme,
  toggleTheme,
  setSidebarOpen,
  handlePlayFromLink,
  cardAnimation,
  setCardAnimation
}) => {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [inputLink, setInputLink] = useState('');
  const [showLedStyleMenu, setShowLedStyleMenu] = useState(false);
  const [showAnimMenu, setShowAnimMenu] = useState(false);

  const searchWrapperRef = useRef(null);
  const ledMenuRef = useRef(null);
  const animMenuRef = useRef(null);

  const ledStyles = [
    { id: 'ltr', label: ' Trái ➔ Phải' },
    { id: 'rtl', label: ' Phải ➔ Trái' },
    { id: 'ttb', label: ' Trên ➔ Dưới' },
    { id: 'btt', label: ' Dưới ➔ Trên' },
    { id: 'diagonal', label: ' Chạy Chéo 45°' },
    { id: 'pulse', label: ' Nhịp Thở Pulse' }
  ];

  const currentStyleLabel = ledStyles.find(s => s.id === ledMode)?.label || ' Trái ➔ Phải';

  const getAnimLabel = (mode) => {
    switch (mode) {
      case 'zoom-in': return '✨ Phóng To';
      case 'fade-up': return '✨ Trượt Lên';
      case 'flip-in': return '✨ Xoay 3D';
      case 'slide-right': return '✨ Trượt Ngang';
      case 'bounce-in': return '✨ Nảy Sóng';
      case 'none': return '🚫 Tắt';
      default: return '✨ Phóng To';
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
      if (ledMenuRef.current && !ledMenuRef.current.contains(event.target)) {
        setShowLedStyleMenu(false);
      }
      if (animMenuRef.current && !animMenuRef.current.contains(event.target)) {
        setShowAnimMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [setShowSuggestions]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    executeSearch();
  };

  const handleLinkSubmit = (e) => {
    e.preventDefault();
    if (!inputLink.trim()) return;
    handlePlayFromLink(inputLink);
    setInputLink('');
    setShowLinkModal(false);
  };

  return (
    <header className="glass-nav">
      <div className="nav-left">
        <button className="hamburger-btn glass-card glow-hover-btn" onClick={() => setSidebarOpen(true)} title="Mở Menu">☰</button>
        <div className="brand">
          <span className="logo-icon">🎧</span>
          <h1>Chương Music</h1>
        </div>

        {/* NÚT VÀ MENU CHỌN HIỆU ỨNG ANIMATION XUẤT HIỆN BÀI HÁT */}
        <div className="song-anim-dropdown-container" ref={animMenuRef}>
          <button
            className="song-anim-btn glass-card glow-hover-btn"
            onClick={() => setShowAnimMenu(!showAnimMenu)}
            title="Tùy chọn hiệu ứng xuất hiện danh sách bài hát"
          >
            🎬 Hiệu ứng: {getAnimLabel(cardAnimation)} ▾
          </button>

          {showAnimMenu && (
            <div className="song-anim-menu glass-card">
              <div className="anim-menu-title">HIỆU ỨNG XUẤT HIỆN</div>
              <button className={`anim-menu-item ${cardAnimation === 'zoom-in' ? 'active' : ''}`} onClick={() => { setCardAnimation('zoom-in'); setShowAnimMenu(false); }}>✨ Phóng To (Zoom In)</button>
              <button className={`anim-menu-item ${cardAnimation === 'fade-up' ? 'active' : ''}`} onClick={() => { setCardAnimation('fade-up'); setShowAnimMenu(false); }}>✨ Trượt Lên (Fade Up)</button>
              <button className={`anim-menu-item ${cardAnimation === 'flip-in' ? 'active' : ''}`} onClick={() => { setCardAnimation('flip-in'); setShowAnimMenu(false); }}>✨ Xoay 3D (Flip 3D)</button>
              <button className={`anim-menu-item ${cardAnimation === 'slide-right' ? 'active' : ''}`} onClick={() => { setCardAnimation('slide-right'); setShowAnimMenu(false); }}>✨ Trượt Ngang (Slide Right)</button>
              <button className={`anim-menu-item ${cardAnimation === 'bounce-in' ? 'active' : ''}`} onClick={() => { setCardAnimation('bounce-in'); setShowAnimMenu(false); }}>✨ Nảy Sóng (Bounce In)</button>

              <div className="menu-divider"></div>

              <button className={`anim-menu-item off-btn ${cardAnimation === 'none' ? 'active' : ''}`} onClick={() => { setCardAnimation('none'); setShowAnimMenu(false); }}>🚫 Tắt Animation</button>
            </div>
          )}
        </div>

        {/* MENU TÙY CHỌN PHONG CÁCH LED & ĐỘ SÁNG */}
        <div className="led-style-dropdown-container" ref={ledMenuRef}>
          <button
            className="led-style-btn glass-card glow-hover-btn"
            onClick={() => setShowLedStyleMenu(!showLedStyleMenu)}
            title="Tùy chọn phong cách & độ sáng LED RGB"
          >
            🎨 {currentStyleLabel} ▾
          </button>

          {showLedStyleMenu && (
            <div className="led-style-menu glass-card">
              <div className="led-menu-title">Phong Cách LED</div>
              {ledStyles.map((item) => (
                <button
                  key={item.id}
                  className={`led-menu-item ${ledMode === item.id ? 'active' : ''}`}
                  onClick={() => {
                    setLedMode(item.id);
                    setShowLedStyleMenu(false);
                  }}
                >
                  {item.label}
                </button>
              ))}

              <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '6px 0' }} />

              <div className="led-brightness-section" style={{ padding: '4px 8px' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-sub)', marginBottom: '4px', textTransform: 'uppercase' }}>
                  💡 Độ Sáng LED: {ledBrightness}%
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={ledBrightness}
                  onChange={(e) => setLedBrightness(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#00f2fe', cursor: 'pointer' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="search-wrapper" ref={searchWrapperRef}>
        <form onSubmit={handleSearchSubmit} className={`search-bar glass-card search-rgb ${ledEnabled ? `rgb-chase-box mode-${ledMode}` : 'no-led-border'}`}>
          <input
            type="text"
            placeholder="Nhập tên bài hát, ca sĩ..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
          />
          <button type="submit" className="search-submit-btn glow-hover-btn">Tìm kiếm</button>
        </form>

        {showSuggestions && (
          <div className="suggestions-dropdown glass-card">
            {suggestions.length > 0 && (
              <div className="suggestion-section">
                <div className="suggestion-title-bar">
                  <span>🔍 Gợi ý tìm kiếm</span>
                </div>
                <ul>
                  {suggestions.map((item, idx) => (
                    <li key={idx} onClick={() => { setQuery(item); executeSearch(item); }}>
                      🔍 {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {searchHistory.length > 0 && (
              <div className="suggestion-section history-section">
                <div className="suggestion-title-bar">
                  <span>🕒 Lịch sử tìm kiếm</span>
                  <button className="clear-history-btn glow-hover-btn" onClick={clearSearchHistory}>
                    🗑️ Xóa
                  </button>
                </div>
                <ul>
                  {searchHistory.map((item, idx) => (
                    <li key={idx} onClick={() => { setQuery(item); executeSearch(item); }}>
                      🕒 {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="header-controls">
        <button
          className="refresh-recommend-btn glass-card glow-hover-btn"
          onClick={() => setShowLinkModal(!showLinkModal)}
          style={{ borderColor: '#ff007f', color: '#ff007f' }}
          title="Dán link bài hát trực tiếp"
        >
          🔗 Dán Link
        </button>

        <button
          className="refresh-recommend-btn glass-card glow-hover-btn"
          onClick={handleRefreshRecommendations}
          title="Đổi danh sách bài hát gợi ý ngẫu nhiên"
        >
          🔄 Đổi gợi ý
        </button>

        <button
          className="reset-user-data-btn glass-card glow-hover-btn"
          onClick={handleResetUserData}
          title="Xóa toàn bộ dữ liệu & làm mới ứng dụng"
        >
          🧹 Reset
        </button>

        <button
          className={`led-toggle-btn glass-card glow-hover-btn ${ledEnabled ? 'active' : ''}`}
          onClick={() => setLedEnabled(!ledEnabled)}
          title="Bật/Tắt LED Bo Viền"
        >
          {ledEnabled ? '🌈 LED: BẬT' : '⚪ LED: TẮT'}
        </button>

        <button className="theme-toggle glass-card glow-hover-btn" onClick={toggleTheme}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      {showLinkModal && (
        <div className="link-modal-overlay" onClick={() => setShowLinkModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="link-modal-box glass-card" onClick={(e) => e.stopPropagation()} style={{ padding: '20px', width: '90%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '16px' }}>🔗 Mở bài hát bằng đường dẫn (Link)</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-sub)', margin: 0 }}>
              Dán link nhạc từ YouTube, YouTube Shorts, YouTube Music... vào đây để phát trực tiếp.
            </p>
            <form onSubmit={handleLinkSubmit} style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="https://www.youtube.com/watch?v=..."
                value={inputLink}
                onChange={(e) => setInputLink(e.target.value)}
                autoFocus
                style={{ flex: 1, padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-main)', outline: 'none' }}
              />
              <button type="submit" className="import-btn glow-hover-btn">Phát Ngay</button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
