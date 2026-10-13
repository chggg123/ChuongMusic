export const API_BASE = 'https://chuongmusic-sever.onrender.com/api';
export const SPEED_RATES = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export const HOT_TIKTOK_KEYWORDS = [
  'nhạc hot tiktok 2026',
  'nhạc chill tiktok',
  'nhạc tiktok trend',
  'nhạc remix tiktok hot',
  'vpop hot tiktok',
  'nhạc lofi tiktok chill',
  'nhạc edm tiktok gây nghiện',
  'nhạc tâm trạng tiktok',
    'nhạc tiktok buồn',
    'nhạc lofi cực chill',
    'nhạc tiktok remix',
    'nhạc tiktok mới nhất',
    'nhạc hot trend hiện nay',
    'nhạc tình yêu vui tươi'
];

// BỘ MẪU NỀN CÓ SẴN DÀNH CHO NGUỜI DÙNG CHỌN NHANH
export const PRESET_BACKGROUNDS = [
  {
    id: 'preset_1',
    name: '🌃 Cyberpunk Neon City',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1920&auto=format&fit=crop'
  },
  {
    id: 'preset_2',
    name: '🌌 Vũ Trụ & Dải Ngân Hà',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=1920&auto=format&fit=crop'
  },
  {
    id: 'preset_3',
    name: '🌄 Hoàng Hôn Chill Vibe',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1920&auto=format&fit=crop'
  },
  {
    id: 'preset_4',
    name: '🌧️ Lofi Anime Night',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1920&auto=format&fit=crop'
  },
  {
    id: 'preset_5',
    name: '🌿 Rừng Thần Thoại',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1511497584788-8767611136f6?q=80&w=1920&auto=format&fit=crop'
  },
  {
    id: 'preset_6',
    name: '🌊 Sóng Biển Đêm Neon',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1920&auto=format&fit=crop'
  }
];

export const extractYouTubeId = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/|music\.youtube\.com\/watch\?v=)([^#\&\?]*).*/;
  const match = url.trim().match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export const getHighResThumbnail = (song) => {
  if (!song) return '';
  if (song.id) {
    return `https://img.youtube.com/vi/${song.id}/hqdefault.jpg`;
  }
  return song.thumbnail || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&auto=format&fit=crop&q=80';
};

export const formatTime = (secs) => {
  if (isNaN(secs) || secs === 0) return '00:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
};
