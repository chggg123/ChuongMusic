import { useEffect, useRef, useState } from 'react';
import { ProfileAvatar } from './ProfileAvatar';

const avatarOptions = ['🎧', '🌙', '🌊', '🌸', '🔥', '⚡', '🐱', '🐼', '🎵', '⭐'];
const MAX_AVATAR_FILE_SIZE = 10 * 1024 * 1024;
const AVATAR_SIZE = 128;

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
  const [cropImageUrl, setCropImageUrl] = useState('');
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [avatarError, setAvatarError] = useState('');
  const [savingAvatar, setSavingAvatar] = useState(false);
  const rootRef = useRef(null);
  const fileInputRef = useRef(null);
  const cropImageRef = useRef(null);
  const cropViewportRef = useRef(null);
  const dragRef = useRef(null);

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

  useEffect(() => {
    if (!cropImageUrl) return undefined;
    return () => URL.revokeObjectURL(cropImageUrl);
  }, [cropImageUrl]);

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

  const handleAvatarFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setAvatarError('Chọn ảnh JPG, PNG, WebP hoặc GIF.');
      return;
    }
    if (file.size > MAX_AVATAR_FILE_SIZE) {
      setAvatarError('Ảnh tối đa 10 MB.');
      return;
    }

    setAvatarError('');
    setCropZoom(1);
    setCropOffset({ x: 0, y: 0 });
    setCropImageUrl(URL.createObjectURL(file));
  };

  const handleCropPointerDown = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  };

  const handleCropPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const viewportSize = cropViewportRef.current?.getBoundingClientRect().width || 1;
    const deltaX = (event.clientX - drag.x) / viewportSize;
    const deltaY = (event.clientY - drag.y) / viewportSize;
    const maxOffset = (cropZoom - 1) / 2;
    dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
    setCropOffset((current) => ({
      x: Math.max(-maxOffset, Math.min(maxOffset, current.x + deltaX)),
      y: Math.max(-maxOffset, Math.min(maxOffset, current.y + deltaY))
    }));
  };

  const saveCroppedAvatar = async () => {
    const image = cropImageRef.current;
    if (!image?.naturalWidth || !image.naturalHeight) {
      setAvatarError('Không thể đọc ảnh này. Hãy chọn ảnh khác.');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Trình duyệt không thể xử lý ảnh này.');

      const scale = Math.max(AVATAR_SIZE / image.naturalWidth, AVATAR_SIZE / image.naturalHeight) * cropZoom;
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      context.drawImage(
        image,
        (AVATAR_SIZE - width) / 2 + cropOffset.x * AVATAR_SIZE,
        (AVATAR_SIZE - height) / 2 + cropOffset.y * AVATAR_SIZE,
        width,
        height
      );
      const avatar = canvas.toDataURL('image/jpeg', 0.8);
      if (avatar.length > 90_000) throw new Error('Ảnh sau khi cắt vẫn quá lớn. Hãy chọn ảnh khác.');

      setSavingAvatar(true);
      setAvatarError('');
      const saved = await onAvatarChange(avatar);
      if (!saved) throw new Error('Không thể lưu ảnh đại diện. Hãy thử lại.');
      setCropImageUrl('');
      setMenuOpen(false);
    } catch (error) {
      setAvatarError(error.message || 'Không thể xử lý ảnh đại diện.');
    } finally {
      setSavingAvatar(false);
    }
  };

  return (
    <div className={`account-control${cropImageUrl ? ' avatar-cropping' : ''}`} ref={rootRef}>
      <button
        className={`account-trigger glass-card${user ? ' is-signed-in' : ''}`}
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-label={user ? `${greeting}, ${user.username}` : 'Đăng nhập hoặc tiếp tục với khách'}
      >
        <ProfileAvatar avatar={user?.avatar} className="account-avatar" />
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
              <button
                type="button"
                className="account-upload-avatar"
                onClick={() => fileInputRef.current?.click()}
              >
                📷 Tải ảnh từ thiết bị
              </button>
              <input
                ref={fileInputRef}
                className="account-avatar-file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleAvatarFileChange}
              />
              {avatarError && <p className="account-form-error" role="alert">{avatarError}</p>}
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

      {cropImageUrl && (
        <div
          className="avatar-crop-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCropImageUrl('');
          }}
        >
          <section className="avatar-crop-dialog glass-card" role="dialog" aria-modal="true" aria-labelledby="avatar-crop-title">
            <h2 id="avatar-crop-title">Căn chỉnh ảnh đại diện</h2>
            <p>Kéo ảnh để đặt vị trí, phóng to để căn trong khung tròn.</p>
            <div
              ref={cropViewportRef}
              className="avatar-crop-viewport"
              onPointerDown={handleCropPointerDown}
              onPointerMove={handleCropPointerMove}
              onPointerUp={() => { dragRef.current = null; }}
              onPointerCancel={() => { dragRef.current = null; }}
            >
              <img
                ref={cropImageRef}
                src={cropImageUrl}
                alt="Xem trước ảnh đại diện"
                draggable="false"
                style={{
                  transform: `translate(${cropOffset.x * 100}%, ${cropOffset.y * 100}%) scale(${cropZoom})`
                }}
              />
            </div>
            <label className="avatar-zoom-control">
              Thu phóng
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={cropZoom}
                onChange={(event) => {
                  const nextZoom = Number(event.target.value);
                  const maxOffset = (nextZoom - 1) / 2;
                  setCropZoom(nextZoom);
                  setCropOffset((current) => ({
                    x: Math.max(-maxOffset, Math.min(maxOffset, current.x)),
                    y: Math.max(-maxOffset, Math.min(maxOffset, current.y))
                  }));
                }}
              />
            </label>
            <div className="avatar-crop-actions">
              <button type="button" onClick={() => setCropImageUrl('')} disabled={savingAvatar}>Hủy</button>
              <button type="button" className="primary" onClick={saveCroppedAvatar} disabled={savingAvatar}>
                {savingAvatar ? 'Đang lưu...' : 'Dùng ảnh này'}
              </button>
            </div>
            {avatarError && <p className="account-form-error" role="alert">{avatarError}</p>}
          </section>
        </div>
      )}
    </div>
  );
};
