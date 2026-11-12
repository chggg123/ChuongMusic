import { useState, useRef, useEffect } from 'react';
import { AccountControl } from './AccountControl';

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
  setTheme,
  setSidebarOpen,
  handlePlayFromLink,
  cardAnimation,
  setCardAnimation,
  accountUser,
  authLoading,
  syncStatus,
  onAuthenticate,
  onLogout,
  onAvatarChange
}) => {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [inputLink, setInputLink] = useState('');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  const searchWrapperRef = useRef(null);
  const settingsMenuRef = useRef(null);

  const ledStyles = [
    { id: 'midnight', label: '🌙 Lam Đêm' },
    { id: 'sakura', label: '🌸 Hồng Sakura' },
    { id: 'ocean', label: '🌊 Xanh Đại Dương' },
    { id: 'ember', label: '🌅 Cam Hoàng Hôn' },
    { id: 'mint', label: '🍃 Xanh Ngọc' },
    { id: 'rainbow-flow', label: '🌈 RGB Cầu Vồng' },
    { id: 'rgb-breathe', label: '💫 RGB Nhịp Thở' }
  ];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target)) {
        setShowSettingsMenu(false);
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
        <AccountControl
          user={accountUser}
          loading={authLoading}
          syncStatus={syncStatus}
          onAuthenticate={onAuthenticate}
          onLogout={onLogout}
          onAvatarChange={onAvatarChange}
        />
        <div className="settings-dropdown-container" ref={settingsMenuRef}>
          <button
            className="settings-trigger glass-card glow-hover-btn"
            type="button"
            onClick={() => setShowSettingsMenu((open) => !open)}
            aria-expanded={showSettingsMenu}
          >
            ⚙️ Cài đặt
          </button>
          {showSettingsMenu && (
            <div className="settings-menu glass-card">
              <div className="settings-section">
                <strong>Hiệu ứng danh sách</strong>
                <div className="settings-choice-grid">
                  {[
                    ['zoom-in', '✨ Phóng to'],
                    ['fade-up', '⬆️ Trượt lên'],
                    ['flip-in', '🔄 Xoay 3D'],
                    ['slide-right', '➡️ Trượt ngang'],
                    ['bounce-in', '🌊 Nảy sóng'],
                    ['none', '🚫 Tắt']
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={cardAnimation === value ? 'active' : ''}
                      onClick={() => setCardAnimation(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="settings-section">
                <div className="settings-section-heading">
                  <strong>Đèn LED RGB</strong>
                  <button
                    className={`settings-led-toggle${ledEnabled ? ' active' : ''}`}
                    type="button"
                    onClick={() => setLedEnabled(!ledEnabled)}
                  >
                    {ledEnabled ? 'Đang bật' : 'Đang tắt'}
                  </button>
                </div>
                <div className="settings-choice-grid">
                  {ledStyles.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={ledMode === item.id ? 'active' : ''}
                      onClick={() => setLedMode(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <label className="settings-brightness">
                  <span>Độ sáng: {ledBrightness}%</span>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={ledBrightness}
                    onChange={(event) => setLedBrightness(Number(event.target.value))}
                  />
                </label>
              </div>
              <div className="settings-section settings-theme-section">
                <strong>Giao diện</strong>
                <div className="settings-theme-options" role="group" aria-label="Chọn giao diện">
                  <button
                    className={theme === 'light' ? 'active' : ''}
                    type="button"
                    aria-pressed={theme === 'light'}
                    onClick={() => setTheme('light')}
                  >
                    ☀️ Sáng
                  </button>
                  <button
                    className={theme === 'dark' ? 'active' : ''}
                    type="button"
                    aria-pressed={theme === 'dark'}
                    onClick={() => setTheme('dark')}
                  >
                    🌙 Tối
                  </button>
                </div>
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

        {showSuggestions && (suggestions.length > 0 || searchHistory.length > 0) && (
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

      </div>

      {showLinkModal && (
        <div className="link-modal-overlay" onClick={() => setShowLinkModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="link-modal-box glass-card" onClick={(e) => e.stopPropagation()} style={{ padding: '20px', width: '90%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '16px' }}>🔗 Mở bài hát bằng đường dẫn (Link)</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-sub)', margin: 0 }}>
              Dán link từ YouTube, YouTube Shorts, YouTube Music hoặc TikTok để phát trực tiếp.
            </p>
            <form onSubmit={handleLinkSubmit} style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="Dán link YouTube hoặc TikTok..."
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
