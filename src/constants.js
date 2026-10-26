const configuredApiBase = import.meta.env.VITE_API_BASE?.trim();

export const API_BASE = (
  configuredApiBase ||
  (import.meta.env.DEV
    ? 'http://localhost:5000/api'
    : 'https://chuongmusic-server.onrender.com/api')
).replace(/\/+$/, '');
export const SPEED_RATES = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export const HOT_TIKTOK_KEYWORDS = [
  'nhạc hot tiktok hiện nay',
  'nhạc chill tâm trạng vui',
  'nhạc tình yêu vui tươi',
  'nhạc tình yêu vui vẻ',
  'nhạc chill quán cafe',
  'nhạc lofi chill',
  'nhạc trung học bài',
  'nhạc tình yêu trung',
  'nhạc tâm trạng buồn',
  'nhạc trung yêu đời',
  'nhạc trung cute',
  'nhạc chill mới nhất',
  'nhạc hot trend hiện nay',
  'nhạc track',
  'nhạc mashup hot nhất hiện nay',
  'nhạc tình yêu vui tươi'
];

// BỘ 12 MẪU NỀN ẢNH HD SẮC NÉT - ĐÃ FIX LINK SAKURA ANIME CHILL
export const PRESET_BACKGROUNDS = [
  {
    id: 'preset_1',
    name: '🌃 Cyberpunk Neon City',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?q=80&w=1920&auto=format&fit=crop'
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
    name: '🌲 Rừng Thần Thoại',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=1920&auto=format&fit=crop'
  },
  {
    id: 'preset_6',
    name: '🌊 Sóng Biển Đêm Neon',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1920&auto=format&fit=crop'
  },
  {
    id: 'preset_7',
    name: '💖 Pink Venom Blink Stage',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1920&auto=format&fit=crop'
  },
  {
    id: 'preset_8',
    name: '🌸 Anime Sakura Blossom',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?q=80&w=1920&auto=format&fit=crop'
  },
  {
    id: 'preset_9',
    name: '🌸 Sakura Anime Chill',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1920&auto=format&fit=crop'
  },
  {
    id: 'preset_10',
    name: '🌌 Bầu Trời Đêm Đầy Sao',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1920&auto=format&fit=crop'
  },
  {
    id: 'preset_11',
    name: '⚡ Laser Neon Wave 3D',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1920&auto=format&fit=crop'
  },
  {
    id: 'preset_12',
    name: '🌐 Digital Cyber Grid',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1920&auto=format&fit=crop'
  }
];

export const extractYouTubeId = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/|music\.youtube\.com\/watch\?v=)([^#\&\?]*).*/;
  const match = url.trim().match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export const normalizeTikTokUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null;

  const candidate = value.trim().replace(/^[<[(]+|[>\]),.!?]+$/g, '');
  const withProtocol = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;

  try {
    const url = new URL(withProtocol);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    const isTikTokHost = hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com');
    if (!isTikTokHost || !url.pathname || url.pathname === '/') return null;

    url.protocol = 'https:';
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    return null;
  }
};

export const getHighResThumbnail = (song) => {
  if (!song) return '';
  if (song.type === 'tiktok') {
    return song.thumbnail || 'https://sf16-sg.tiktokcdn.com/obj/eden-sg/u3kwyb_l_zlp/ljhwZfsne22q_wq_u3kwyb/tiktok_icon.png';
  }
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
