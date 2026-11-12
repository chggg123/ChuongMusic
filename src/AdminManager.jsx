import { useCallback, useEffect, useRef, useState } from 'react';
import { requestAccountApi } from './api';

const PAGE_SIZE = 25;

const formatDate = (value) => {
  if (!value) return 'Chưa hoạt động';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Không xác định' : date.toLocaleString('vi-VN');
};

export const AdminManager = () => {
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [lockReason, setLockReason] = useState('');
  const [busyUserId, setBusyUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const searchRef = useRef('');
  const offsetRef = useRef(0);

  const loadDashboard = useCallback(async (query = '', pageOffset = 0, showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const encodedQuery = encodeURIComponent(query);
      const [dashboard, userResult] = await Promise.all([
        requestAccountApi('/admin/overview'),
        requestAccountApi(`/admin/users?q=${encodedQuery}&limit=${PAGE_SIZE}&offset=${pageOffset}`)
      ]);
      setOverview(dashboard);
      setUsers(userResult.users);
      setTotalUsers(userResult.total);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => loadDashboard(), 0);
    const timer = window.setInterval(() => {
      loadDashboard(searchRef.current, offsetRef.current, false);
    }, 30_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [loadDashboard]);

  const searchUsers = (event) => {
    event.preventDefault();
    const nextSearch = search.trim();
    searchRef.current = nextSearch;
    offsetRef.current = 0;
    setAppliedSearch(nextSearch);
    setOffset(0);
    loadDashboard(nextSearch, 0);
  };

  const changePage = (nextOffset) => {
    const safeOffset = Math.max(0, nextOffset);
    offsetRef.current = safeOffset;
    setOffset(safeOffset);
    loadDashboard(searchRef.current, safeOffset);
  };

  const toggleLock = async (user) => {
    const nextLocked = !user.is_locked;
    const action = nextLocked ? 'khóa' : 'mở khóa';
    if (!window.confirm(`Bạn có chắc muốn ${action} tài khoản "${user.username}"?`)) return;

    setBusyUserId(user.id);
    setError('');
    setNotice('');
    try {
      await requestAccountApi(`/admin/users/${user.id}/lock`, {
        method: 'PATCH',
        body: JSON.stringify({
          locked: nextLocked,
          reason: nextLocked ? lockReason.trim() : ''
        })
      });
      setNotice(`Đã ${action} tài khoản ${user.username}.`);
      if (nextLocked) setLockReason('');
      await loadDashboard(searchRef.current, offsetRef.current, false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyUserId('');
    }
  };

  const stats = overview?.stats;

  return (
    <section className="admin-dashboard" aria-labelledby="admin-dashboard-title">
      <div className="admin-dashboard-heading">
        <div>
          <p className="admin-eyebrow">CHUONG MUSIC</p>
          <h2 id="admin-dashboard-title">Quản lý hệ thống</h2>
          <p>Theo dõi tài khoản đang hoạt động, khóa tài khoản và lượt truy cập.</p>
        </div>
        <button
          className="admin-refresh-button"
          type="button"
          onClick={() => loadDashboard(appliedSearch, offset)}
          disabled={loading}
        >
          {loading ? 'Đang tải…' : '↻ Làm mới'}
        </button>
      </div>

      {error && <p className="admin-message error" role="alert">{error}</p>}
      {notice && <p className="admin-message success" role="status">{notice}</p>}

      <div className="admin-stats-grid">
        <article className="admin-stat-card">
          <span>Tổng tài khoản</span>
          <strong>{stats?.totalUsers ?? '—'}</strong>
        </article>
        <article className="admin-stat-card">
          <span>Đang hoạt động · 5 phút</span>
          <strong>{stats?.activeUsers ?? '—'}</strong>
        </article>
        <article className="admin-stat-card">
          <span>Lượt xem hôm nay</span>
          <strong>{stats?.viewsToday ?? '—'}</strong>
        </article>
        <article className="admin-stat-card">
          <span>Khách duy nhất hôm nay</span>
          <strong>{stats?.visitorsToday ?? '—'}</strong>
        </article>
        <article className="admin-stat-card">
          <span>Lượt xem · 7 ngày</span>
          <strong>{stats?.views7Days ?? '—'}</strong>
        </article>
        <article className="admin-stat-card">
          <span>Tài khoản đang khóa</span>
          <strong>{stats?.lockedUsers ?? '—'}</strong>
        </article>
      </div>

      <div className="admin-panels-grid">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h3>Người dùng đang hoạt động</h3>
              <p>Được xác định bằng heartbeat trong 5 phút gần nhất.</p>
            </div>
            <strong>{overview?.activeUsers?.length ?? 0}</strong>
          </div>
          {overview?.activeUsers?.length ? (
            <ul className="admin-active-list">
              {overview.activeUsers.map((user) => (
                <li key={user.id}>
                  <span className="admin-user-avatar">{user.avatar || '🎧'}</span>
                  <span className="admin-user-name">{user.username}</span>
                  <time>{formatDate(user.last_seen_at)}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-empty">Chưa có tài khoản đăng nhập nào hoạt động gần đây.</p>
          )}
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div>
              <h3>Lượt truy cập 7 ngày</h3>
              <p>Lưu thống kê tổng hợp; mã khách được băm theo ngày, không lưu IP.</p>
            </div>
          </div>
          {overview?.dailyTraffic?.length ? (
            <ul className="admin-traffic-list">
              {overview.dailyTraffic.map((day) => (
                <li key={day.day}>
                  <time>{new Date(`${day.day}T00:00:00`).toLocaleDateString('vi-VN')}</time>
                  <span>{day.pageViews} lượt xem</span>
                  <strong>{day.uniqueVisitors} khách/ngày</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-empty">Chưa có dữ liệu truy cập.</p>
          )}
        </section>
      </div>

      <section className="admin-panel admin-users-panel">
        <div className="admin-panel-heading">
          <div>
            <h3>Quản lý tài khoản</h3>
            <p>{totalUsers} kết quả · Có thể mở khóa lại tài khoản đã khóa.</p>
          </div>
        </div>
        <form className="admin-search-form" onSubmit={searchUsers}>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên đăng nhập"
            aria-label="Tìm theo tên đăng nhập"
            maxLength={50}
          />
          <button type="submit">Tìm kiếm</button>
        </form>
        <label className="admin-lock-reason">
          Lý do khóa (không bắt buộc)
          <input
            value={lockReason}
            onChange={(event) => setLockReason(event.target.value)}
            maxLength={200}
            placeholder="Nhập lý do để ghi vào nhật ký quản trị"
          />
        </label>
        <div className="admin-users-table-wrap">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>Tài khoản</th>
                <th>Vai trò</th>
                <th>Hoạt động gần nhất</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <span className="admin-account-cell">
                      <span className="admin-user-avatar">{user.avatar || '🎧'}</span>
                      <span>
                        <strong>{user.username}</strong>
                        <small>Tham gia {formatDate(user.created_at)}</small>
                      </span>
                    </span>
                  </td>
                  <td>{user.role === 'admin' ? 'Quản trị' : 'Người dùng'}</td>
                  <td>{user.is_active ? 'Đang hoạt động' : formatDate(user.last_seen_at)}</td>
                  <td>
                    <span className={`admin-status ${user.is_locked ? 'locked' : 'enabled'}`}>
                      {user.is_locked ? 'Đã khóa' : 'Bình thường'}
                    </span>
                    {user.is_locked && user.lock_reason && <small className="admin-lock-note">{user.lock_reason}</small>}
                  </td>
                  <td>
                    {user.role === 'admin' ? (
                      <span className="admin-protected-label">Được bảo vệ</span>
                    ) : (
                      <button
                        className={`admin-lock-button${user.is_locked ? ' unlock' : ''}`}
                        type="button"
                        disabled={busyUserId === user.id}
                        onClick={() => toggleLock(user)}
                      >
                        {busyUserId === user.id ? 'Đang xử lý…' : user.is_locked ? 'Mở khóa' : 'Khóa'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!users.length && (
                <tr>
                  <td className="admin-empty-row" colSpan="5">
                    {loading ? 'Đang tải danh sách…' : 'Không tìm thấy tài khoản.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="admin-pagination">
          <span>{totalUsers ? `${offset + 1}–${Math.min(offset + users.length, totalUsers)} / ${totalUsers}` : '0 kết quả'}</span>
          <div>
            <button type="button" onClick={() => changePage(offset - PAGE_SIZE)} disabled={offset === 0 || loading}>
              Trước
            </button>
            <button
              type="button"
              onClick={() => changePage(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= totalUsers || loading}
            >
              Tiếp
            </button>
          </div>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h3>Nhật ký quản trị gần đây</h3>
            <p>Lưu lại các thao tác khóa và mở khóa tài khoản.</p>
          </div>
        </div>
        {overview?.recentActions?.length ? (
          <ul className="admin-audit-list">
            {overview.recentActions.map((action) => (
              <li key={`${action.action}-${action.created_at}-${action.target_username}`}>
                <span className="admin-audit-action">
                  {action.action === 'account_locked' ? 'Đã khóa' : 'Đã mở khóa'}{' '}
                  <strong>{action.target_username || 'tài khoản đã xóa'}</strong>
                </span>
                {action.details?.reason && <span className="admin-audit-reason">{action.details.reason}</span>}
                <span className="admin-audit-meta">
                  Bởi {action.actor_username || 'quản trị viên'} · {formatDate(action.created_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin-empty">Chưa có thao tác quản trị nào.</p>
        )}
      </section>
    </section>
  );
};
