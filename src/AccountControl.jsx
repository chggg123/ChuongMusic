import { useEffect, useRef, useState } from 'react';

const avatarOptions = ['🎧', '🌙', '🌊', '🌸', '🔥', '⚡', '🐱', '🐼', '🎵', '⭐'];

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 11) return 'Chào buổi sáng';
  if (hour < 13) return 'Chào buổi trưa';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
};

export const AccountControl = ({
  user,
  loading,
  syncStatus,
  onAuthenticate,
  onLogout,
  onAvatarChange
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [greeting, setGreeting] = useState(getGreeting);
  const rootRef = useRef(null);

  useEffect(() => {
    const timer = window.setInterval(() => setGreeting(getGreeting()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const openDialog = (nextMode) => {
    setMode(nextMode);
    setFormError('');
    setPassword('');
    setConfirmPassword('');
    setDialogOpen(true);
    setMenuOpen(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    if (mode === 'register' && password !== confirmPassword) {
      setFormError('Mật khẩu xác nhận chưa khớp.');
      return;
    }

    setSubmitting(true);
    try {
      await onAuthenticate(mode, { username, password });
      setDialogOpen(false);
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      setFormError(error.message || 'Không thể xác thực tài khoản lúc này.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="account-control" ref={rootRef}>
      <button
        className={`account-trigger glass-card${user ? ' is-signed-in' : ''}`}
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-label={user ? `${greeting}, ${user.username}` : 'Đăng nhập hoặc tiếp tục với khách'}
      >
        <span className="account-avatar">{user?.avatar || '👤'}</span>
        <span className="account-trigger-copy">
          <strong>{user ? user.username : loading ? 'Đang tải...' : 'Tài khoản'}</strong>
          <small>{user ? greeting : 'Đăng nhập / Khách'}</small>
        </span>
        <span className="account-trigger-chevron">⌄</span>
      </button>

      {menuOpen && (
        <div className="account-menu glass-card">
          {user ? (
            <>
              <div className="account-menu-heading">
                <strong>{greeting}, {user.username}!</strong>
                <span>{user.role === 'admin' ? 'Quản trị viên' : 'Tài khoản đã đăng nhập'}</span>
              </div>
              <div className="account-avatar-picker" aria-label="Chọn avatar">
                {avatarOptions.map((avatar) => (
                  <button
                    key={avatar}
                    type="button"
                    className={`account-avatar-option${user.avatar === avatar ? ' active' : ''}`}
                    onClick={() => onAvatarChange(avatar)}
                    aria-label={`Dùng avatar ${avatar}`}
                  >
                    {avatar}
                  </button>
                ))}
              </div>
              <p className="account-sync-status">{syncStatus}</p>
              <button
                type="button"
                className="account-menu-action"
                onClick={async () => {
                  try {
                    await onLogout();
                    setMenuOpen(false);
                  } catch (error) {
                    setFormError(error.message || 'Không thể đăng xuất lúc này.');
                  }
                }}
              >
                Đăng xuất
              </button>
              {formError && <p className="account-form-error" role="alert">{formError}</p>}
            </>
          ) : (
            <>
              <div className="account-menu-heading">
                <strong>Chào mừng đến Chương Music</strong>
                <span>Đăng nhập để đồng bộ dữ liệu giữa các thiết bị.</span>
              </div>
              <p className="account-sync-status">{loading ? 'Đang kiểm tra phiên đăng nhập...' : syncStatus}</p>
              <button type="button" className="account-menu-action primary" onClick={() => openDialog('login')}>
                Đăng nhập
              </button>
              <button type="button" className="account-menu-action" onClick={() => openDialog('register')}>
                Tạo tài khoản
              </button>
              <button type="button" className="account-guest-action" onClick={() => setMenuOpen(false)}>
                Tiếp tục với tư cách khách
              </button>
            </>
          )}
        </div>
      )}

      {dialogOpen && (
        <div className="account-dialog-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDialogOpen(false);
        }}>
          <section className="account-dialog glass-card" role="dialog" aria-modal="true" aria-labelledby="account-dialog-title">
            <button
              className="account-dialog-close"
              type="button"
              onClick={() => setDialogOpen(false)}
              aria-label="Đóng"
            >
              ×
            </button>
            <div className="account-dialog-mark">🎧</div>
            <h2 id="account-dialog-title">{mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</h2>
            <p>{mode === 'login' ? 'Dữ liệu đã đồng bộ sẽ được khôi phục.' : 'Tên đăng nhập và mật khẩu được lưu an toàn.'}</p>
            <form onSubmit={handleSubmit} className="account-form">
              <label>
                Tên đăng nhập
                <input
                  autoComplete="username"
                  maxLength={30}
                  minLength={3}
                  pattern="[a-zA-Z0-9._-]{3,30}"
                  required
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </label>
              <label>
                Mật khẩu
                <input
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={mode === 'register' ? 12 : 1}
                  maxLength={128}
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              {mode === 'register' && (
                <label>
                  Nhập lại mật khẩu
                  <input
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </label>
              )}
              {mode === 'register' && (
                <small className="account-password-hint">Dùng mật khẩu riêng, tối thiểu 12 ký tự.</small>
              )}
              {formError && <p className="account-form-error" role="alert">{formError}</p>}
              <button className="account-submit" type="submit" disabled={submitting}>
                {submitting ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
              </button>
            </form>
            <button
              className="account-mode-switch"
              type="button"
              onClick={() => {
                setMode((currentMode) => currentMode === 'login' ? 'register' : 'login');
                setFormError('');
              }}
            >
              {mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
            </button>
            <button className="account-guest-action" type="button" onClick={() => setDialogOpen(false)}>
              Tiếp tục với tư cách khách
            </button>
          </section>
        </div>
      )}
    </div>
  );
};
