import { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';
import './responsive.css';
import { API_BASE, HOT_TIKTOK_KEYWORDS, SPEED_RATES, extractYouTubeId, formatTime, normalizeTikTokUrl } from './constants';
import { requestAccountApi } from './api';
import { Background } from './Background';
import { HeaderNav } from './HeaderNav';
import { SidebarMenu } from './SidebarMenu';
import { AdminManager } from './AdminManager';
import { SongCard, RecommendPopup } from './SongGrid';
import { PlayerDock } from './PlayerDock';
import { CustomMediaManager, PlaylistManager, QueueManager } from './Managers';
import { AudioManager } from './AudioManager';
import { useAudioDSP } from './useAudioDSP';

// KIỂM TRA ĐƯỜNG DẪN TIKTOK
const isTikTokUrl = (url) => {
  return Boolean(normalizeTikTokUrl(url));
};

// QUẢN LÝ BỘ NHỚ INDEXEDDB LƯU FILE DUNG LƯỢNG LỚN
const DB_NAME = 'ChuongMusicDB';
const STORE_NAME = 'custom_media';
const AUDIO_STORE_NAME = 'playlist_audio';
const SEARCH_CACHE_TTL_MS = 60_000;
const MAX_SEARCH_CACHE_ENTRIES = 50;
const ANALYTICS_VISITOR_KEY = 'chuongmusic_analytics_visitor';
const VISITOR_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let analyticsVisitStarted = false;
const getAnalyticsVisitorId = () => {
  try {
    const savedId = localStorage.getItem(ANALYTICS_VISITOR_KEY);
    if (savedId && VISITOR_ID_PATTERN.test(savedId)) return savedId;
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const visitorId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    localStorage.setItem(ANALYTICS_VISITOR_KEY, visitorId);
    return visitorId;
  } catch (error) {
    console.warn('Không thể tạo mã khách truy cập trên thiết bị:', error);
    return null;
  }
};
const getKnownDuration = (song) => {
  if (Number.isSafeInteger(song?.durationSeconds) && song.durationSeconds > 0) {
    return song.durationSeconds;
  }
  if (typeof song?.duration !== 'string') return 0;

  const parts = song.duration.split(':');
  if (parts.length < 2 || parts.some((part) => !/^\d+$/.test(part))) return 0;
  return parts.reduce((total, part) => total * 60 + Number(part), 0);
};

const loadSavedPlayback = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('liquid_current_playback') || 'null');
    if (!saved?.song?.id || !['youtube', 'tiktok', 'tiktok_embed'].includes(saved.song.type)) return null;
    return {
      song: saved.song,
      currentTime: Number.isFinite(saved.currentTime) ? Math.max(0, saved.currentTime) : 0
    };
  } catch (error) {
    console.warn('Không thể khôi phục bài hát đã phát trước đó:', error);
    return null;
  }
};

const initDB = () => {
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(AUDIO_STORE_NAME)) {
        db.createObjectStore(AUDIO_STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
};

const saveMediaDB = async (item) => {
  const db = await initDB();
  if (!db) return;
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(item);
};

const getAllMediaDB = async () => {
  const db = await initDB();
  if (!db) return [];
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
};

const deleteMediaDB = async (id) => {
  const db = await initDB();
  if (!db) return;
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
};

const saveAudioFileDB = async (id, file) => {
  const db = await initDB();
  if (!db) throw new Error('Không thể mở IndexedDB để lưu file audio.');
  const tx = db.transaction(AUDIO_STORE_NAME, 'readwrite');
  const audioBlob = file.slice(0, file.size, file.type);
  tx.objectStore(AUDIO_STORE_NAME).put({ id, file: audioBlob });
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Không thể lưu file audio.'));
    tx.onabort = () => reject(tx.error || new Error('Đã hủy lưu file audio.'));
  });
};

const getAudioFileDB = async (id) => {
  const db = await initDB();
  if (!db) throw new Error('Không thể mở IndexedDB để đọc file audio.');
  return new Promise((resolve, reject) => {
    const req = db.transaction(AUDIO_STORE_NAME, 'readonly').objectStore(AUDIO_STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result?.file || null);
    req.onerror = () => reject(req.error || new Error('Không thể đọc file audio.'));
  });
};

const deleteAudioFileDB = async (id) => {
  const db = await initDB();
  if (!db) throw new Error('Không thể mở IndexedDB để xóa file audio.');
  const tx = db.transaction(AUDIO_STORE_NAME, 'readwrite');
  tx.objectStore(AUDIO_STORE_NAME).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Không thể xóa file audio.'));
    tx.onabort = () => reject(tx.error || new Error('Đã hủy xóa file audio.'));
  });
};

const persistPlaylists = (playlists) => {
  const savedPlaylists = playlists.map((playlist) => ({
    ...playlist,
    songs: playlist.songs.map((song) => {
      const savedSong = { ...song };
      delete savedSong.audioUrl;
      return savedSong;
    })
  }));
  localStorage.setItem('liquid_playlists', JSON.stringify(savedPlaylists));
};

const createDefaultPlaylist = () => ({ id: 'p1', name: 'Nhạc Chill Đêm Khuya', songs: [] });
const createGuestDefaults = () => ({
  favorites: [],
  playlists: [createDefaultPlaylist()],
  searchHistory: [],
  playHistory: [],
  settings: {
    theme: 'light',
    ledEnabled: true,
    ledMode: 'midnight',
    ledBrightness: 80,
    backgroundPlay: true,
    autoPlay: true,
    cardAnimation: 'zoom-in',
    volume: 80,
    playbackRate: 1,
    audioDSP: {
      is8DEnabled: false,
      eightDSpeed: 0.25,
      bassGain: 0,
      vocalGain: 0,
      stereoPan: 0,
      isWideEnabled: false,
      wideMix: 0.4,
      wideDamp: 0.3,
      wideRoomSize: 0.9,
      wideGain: 0
    }
  }
});

const removeDeviceOnlyFiles = (song) => {
  const savedSong = { ...song };
  delete savedSong.audioUrl;
  delete savedSong.file;
  return savedSong;
};

const mergeAccountData = (localData, remoteData) => {
  const local = localData || {};
  const remote = remoteData || {};
  const mergeById = (first, second) => {
    const items = new Map();
    [...(first || []), ...(second || [])].forEach((item) => {
      if (item?.id) items.set(item.id, item);
    });
    return [...items.values()];
  };
  const playlists = new Map();
  [...(remote.playlists || []), ...(local.playlists || [])].forEach((playlist) => {
    if (!playlist?.id) return;
    const existing = playlists.get(playlist.id);
    playlists.set(playlist.id, {
      ...existing,
      ...playlist,
      songs: mergeById(existing?.songs, playlist.songs)
    });
  });
  const searchHistory = [];
  const searchTerms = new Set();
  [...(local.searchHistory || []), ...(remote.searchHistory || [])].forEach((term) => {
    if (typeof term !== 'string') return;
    const normalized = term.trim().toLowerCase();
    if (normalized && !searchTerms.has(normalized)) {
      searchTerms.add(normalized);
      searchHistory.push(term);
    }
  });

  return {
    favorites: mergeById(remote.favorites, local.favorites),
    playlists: playlists.size ? [...playlists.values()] : [createDefaultPlaylist()],
    searchHistory: searchHistory.slice(0, 100),
    playHistory: mergeById(remote.playHistory, local.playHistory).slice(-200),
    settings: { ...local.settings, ...remote.settings }
  };
};

const mergeDeviceLocalPlaylists = (savedPlaylists, devicePlaylists) => {
  const result = new Map((savedPlaylists || []).map((playlist) => [playlist.id, playlist]));
  (devicePlaylists || []).forEach((playlist) => {
    const localSongs = (playlist.songs || []).filter((song) => song.type === 'local');
    if (!localSongs.length) return;
    const existing = result.get(playlist.id);
    result.set(playlist.id, {
      ...(existing || playlist),
      songs: [...(existing?.songs || []), ...localSongs.filter((song) =>
        !(existing?.songs || []).some((savedSong) => savedSong.id === song.id)
      )]
    });
  });
  return result.size ? [...result.values()] : [createDefaultPlaylist()];
};

function App() {
  const [accountUser, setAccountUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('Đang sử dụng chế độ khách');
  const [lowPerformanceMode] = useState(() => {
    const cores = navigator.hardwareConcurrency || 0;
    const memory = navigator.deviceMemory || 0;
    const compactScreen = window.matchMedia('(max-width: 480px)').matches;
    return memory > 0 && memory <= 4 || cores > 0 && cores <= 4 || compactScreen && cores <= 8;
  });
  const [savedPlayback] = useState(loadSavedPlayback);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [loadingText, setLoadingText] = useState('✨ Đang gợi ý các bài hát HOT Trend TikTok...');
  const [currentSearchTitle, setCurrentSearchTitle] = useState('✨ Đang gợi ý các bài hát HOT Trend TikTok');
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState('');
  const [tiktokVideoError, setTikTokVideoError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    const savedVolumeValue = localStorage.getItem('liquid_volume');
    const hasSavedVolumePreference = localStorage.getItem('liquid_volume_initialized') === 'true';
    if (savedVolumeValue === null || (!hasSavedVolumePreference && savedVolumeValue === '0')) return 80;
    const savedVolume = Number(savedVolumeValue);
    return Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 100 ? savedVolume : 80;
  });
  const [playbackRate, setPlaybackRate] = useState(() => {
    const savedRate = Number(localStorage.getItem('liquid_playback_rate'));
    return SPEED_RATES.includes(savedRate) ? savedRate : 1;
  });
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const [cardAnimation, setCardAnimation] = useState(() => {
    return localStorage.getItem('liquid_card_anim') || 'zoom-in';
  });

  useEffect(() => {
    localStorage.setItem('liquid_card_anim', cardAnimation);
  }, [cardAnimation]);

  const audioDSP = useAudioDSP(isPlaying);
  const {
    setBassGain: setDspBassGain,
    setEightDSpeed: setDspEightDSpeed,
    setIs8DEnabled: setDspIs8DEnabled,
    setIsWideEnabled: setDspIsWideEnabled,
    setStereoPan: setDspStereoPan,
    setVocalGain: setDspVocalGain,
    setWideDamp: setDspWideDamp,
    setWideGain: setDspWideGain,
    setWideMix: setDspWideMix,
    setWideRoomSize: setDspWideRoomSize
  } = audioDSP;

  const searchCacheRef = useRef(new Map());
  const suggestionCacheRef = useRef(new Map());
  const searchAbortControllerRef = useRef(null);
  const suggestionAbortControllerRef = useRef(null);
  const accountDataReadyRef = useRef(false);
  const accountSyncQueueRef = useRef(Promise.resolve());
  const accountSyncRevisionRef = useRef(0);
  const playlistDataRevisionRef = useRef(0);

  const [theme, setTheme] = useState(() => localStorage.getItem('liquid_theme') || 'light');
  const [ledEnabled, setLedEnabled] = useState(() => {
    const saved = localStorage.getItem('liquid_led_enabled');
    return saved === null ? true : JSON.parse(saved);
  });
  const [ledMode, setLedMode] = useState(() => {
    const savedMode = localStorage.getItem('liquid_led_mode');
    const supportedModes = ['midnight', 'sakura', 'ocean', 'ember', 'mint', 'rainbow-flow', 'rgb-breathe'];
    return supportedModes.includes(savedMode) ? savedMode : 'midnight';
  });
  const [ledBrightness, setLedBrightness] = useState(() => {
    const saved = localStorage.getItem('liquid_led_brightness');
    return saved ? Number(saved) : 80;
  });

  useEffect(() => {
    localStorage.setItem('liquid_led_mode', ledMode);
  }, [ledMode]);

  useEffect(() => {
    localStorage.setItem('liquid_led_brightness', ledBrightness);
  }, [ledBrightness]);

  const [backgroundPlay, setBackgroundPlay] = useState(() => {
    const saved = localStorage.getItem('liquid_bgplay');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const nativeAudioRef = useRef(null);
  const backgroundAudioRef = useRef(null);
  const getActiveAudioRef = (song = currentSong, useBackgroundAudio = backgroundPlay) => (
    song?.type === 'local' && useBackgroundAudio
      ? backgroundAudioRef
      : nativeAudioRef
  );
  const sendTikTokPlayerMessage = (type, value = null) => {
    const playerWindow = tiktokPlayerRef.current?.contentWindow;
    if (!playerWindow) return false;
    playerWindow.postMessage(
      { type, value, 'x-tiktok-player': true },
      'https://www.tiktok.com'
    );
    return true;
  };

  useEffect(() => {
    localStorage.setItem('liquid_bgplay', JSON.stringify(backgroundPlay));
  }, [backgroundPlay]);

  // XỬ LÝ PHÁT NỀN KHI CHUYỂN TAB TRÌNH DUYỆT
  useEffect(() => {
    const syncPageVisibility = () => {
      document.documentElement.classList.toggle('page-hidden', document.hidden);
    };
    syncPageVisibility();
    document.addEventListener('visibilitychange', syncPageVisibility);
    return () => {
      document.removeEventListener('visibilitychange', syncPageVisibility);
      document.documentElement.classList.remove('page-hidden');
    };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !backgroundPlay && isPlaying) {
        const audioElement = getActiveAudioRef().current;
        if (audioElement && !audioElement.paused) {
          audioElement.pause();
        }
        if (videoPlayerReadyRef.current && typeof videoPlayerRef.current?.pauseVideo === 'function') {
          videoPlayerRef.current.pauseVideo();
        }
        setIsPlaying(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [backgroundPlay, isPlaying]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  const [searchHistory, setSearchHistory] = useState(() => {
    const saved = localStorage.getItem('liquid_search_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('liquid_favs');
    return saved ? JSON.parse(saved) : [];
  });

  const [playlists, setPlaylists] = useState(() => {
    const saved = localStorage.getItem('liquid_playlists');
    return saved ? JSON.parse(saved) : [{ id: 'p1', name: 'Nhạc Chill Đêm Khuya', songs: [] }];
  });
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);

  const [autoPlay, setAutoPlay] = useState(() => {
    const saved = localStorage.getItem('liquid_autoplay');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('liquid_autoplay', JSON.stringify(autoPlay));
  }, [autoPlay]);

  const [playHistory, setPlayHistory] = useState(() => {
    const saved = localStorage.getItem('liquid_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [showRecommendPopup, setShowRecommendPopup] = useState(false);
  const [nextSongToPlay, setNextSongToPlay] = useState(null);
  const [dismissedRecommend, setDismissedRecommend] = useState(false);

  const [showVideo, setShowVideo] = useState(() => localStorage.getItem('liquid_video_enabled') === 'true');
  const [videoError, setVideoError] = useState(false);
  const [videoFrameStyle, setVideoFrameStyle] = useState(null);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const [isVideoExpanded, setIsVideoExpanded] = useState(false);

  useEffect(() => {
    localStorage.setItem('liquid_video_enabled', String(showVideo));
  }, [showVideo]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsVideoFullscreen(document.fullscreenElement === videoPlayerFrameRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const [customMediaList, setCustomMediaList] = useState([]);

  const [activeBackground, setActiveBackground] = useState(() => {
    const saved = localStorage.getItem('liquid_active_bg');
    return saved ? JSON.parse(saved) : null;
  });

  const fileInputRef = useRef(null);
  const savedPlaybackRef = useRef(savedPlayback);
  const videoPlayerRef = useRef(null);
  const videoPlayerReadyRef = useRef(false);
  const videoPlayerMountRef = useRef(null);
  const videoPlayerFrameRef = useRef(null);
  const tiktokVideoRef = useRef(null);
  const tiktokPlayerRef = useRef(null);
  const tiktokPlayerReadyRef = useRef(false);
  const localAudioUrlsRef = useRef(new Set());
  const timerRef = useRef(null);
  const currentTimeRef = useRef(currentTime);
  const isPlayingRef = useRef(isPlaying);
  const videoPlayerSongRef = useRef(null);
  const handleAutoNextRef = useRef(null);
  const mediaSessionActionsRef = useRef(null);
  const mediaPositionStateErrorRef = useRef(false);

  const hydratePlaylistAudio = useCallback(async (sourcePlaylists) => Promise.all(
    sourcePlaylists.map(async (playlist) => ({
      ...playlist,
      songs: await Promise.all((playlist.songs || []).map(async (song) => {
        if (song.type !== 'local' || !song.audioId) return song;
        try {
          const file = await getAudioFileDB(song.audioId);
          if (!file) {
            console.warn(`Không tìm thấy file audio đã lưu: ${song.title}`);
            return song;
          }
          const audioUrl = URL.createObjectURL(file);
          localAudioUrlsRef.current.add(audioUrl);
          return { ...song, audioUrl };
        } catch (error) {
          console.error(`Không thể khôi phục file audio: ${song.title}`, error);
          return song;
        }
      }))
    }))
  ), []);

  const collectAccountData = useCallback((includeDeviceLocalFiles = false) => ({
      favorites: favorites.filter((song) => song.type !== 'local').map(removeDeviceOnlyFiles),
      playlists: playlists.map((playlist) => ({
        ...playlist,
        songs: playlist.songs
          .filter((song) => song.type !== 'local' || includeDeviceLocalFiles)
          .map(removeDeviceOnlyFiles)
      })),
      searchHistory,
      playHistory: playHistory.filter((song) => song.type !== 'local').map(removeDeviceOnlyFiles),
      settings: {
        theme,
        ledEnabled,
        ledMode,
        ledBrightness,
        backgroundPlay,
        autoPlay,
        cardAnimation,
        volume,
        playbackRate,
        audioDSP: {
          is8DEnabled: audioDSP.is8DEnabled,
          eightDSpeed: audioDSP.eightDSpeed,
          bassGain: audioDSP.bassGain,
          vocalGain: audioDSP.vocalGain,
          stereoPan: audioDSP.stereoPan,
          isWideEnabled: audioDSP.isWideEnabled,
          wideMix: audioDSP.wideMix,
          wideDamp: audioDSP.wideDamp,
          wideRoomSize: audioDSP.wideRoomSize,
          wideGain: audioDSP.wideGain
        }
      }
    }), [audioDSP.bassGain, audioDSP.eightDSpeed, audioDSP.is8DEnabled, audioDSP.isWideEnabled,
    audioDSP.stereoPan, audioDSP.vocalGain, audioDSP.wideDamp, audioDSP.wideGain, audioDSP.wideMix,
    audioDSP.wideRoomSize, autoPlay, backgroundPlay, cardAnimation, favorites, ledBrightness,
    ledEnabled, ledMode, playHistory, playbackRate, playlists, searchHistory, theme, volume]);

  const accountDataJson = JSON.stringify(collectAccountData());

  const applyAccountData = useCallback((source) => {
    const data = source || {};
    const nextFavorites = Array.isArray(data.favorites) ? data.favorites : [];
    const nextPlaylists = Array.isArray(data.playlists) && data.playlists.length
      ? data.playlists
      : [createDefaultPlaylist()];
    const nextSearchHistory = Array.isArray(data.searchHistory) ? data.searchHistory : [];
    const nextPlayHistory = Array.isArray(data.playHistory) ? data.playHistory : [];
    const settings = data.settings || {};

    playlistDataRevisionRef.current += 1;
    setFavorites(nextFavorites);
    setPlaylists(nextPlaylists);
    persistPlaylists(nextPlaylists);
    setSearchHistory(nextSearchHistory);
    setPlayHistory(nextPlayHistory);
    localStorage.setItem('liquid_search_history', JSON.stringify(nextSearchHistory));
    localStorage.setItem('liquid_history', JSON.stringify(nextPlayHistory));

    if (settings.theme === 'light' || settings.theme === 'dark') setTheme(settings.theme);
    if (typeof settings.ledEnabled === 'boolean') setLedEnabled(settings.ledEnabled);
    if (['midnight', 'sakura', 'ocean', 'ember', 'mint', 'rainbow-flow', 'rgb-breathe'].includes(settings.ledMode)) {
      setLedMode(settings.ledMode);
    }
    if (Number.isFinite(settings.ledBrightness)) {
      setLedBrightness(Math.min(100, Math.max(10, settings.ledBrightness)));
    }
    if (typeof settings.backgroundPlay === 'boolean') setBackgroundPlay(settings.backgroundPlay);
    if (typeof settings.autoPlay === 'boolean') {
      setAutoPlay(settings.autoPlay);
      localStorage.setItem('liquid_autoplay', JSON.stringify(settings.autoPlay));
    }
    if (['zoom-in', 'fade-up', 'flip-in', 'slide-right', 'bounce-in', 'none'].includes(settings.cardAnimation)) {
      setCardAnimation(settings.cardAnimation);
    }
    if (Number.isFinite(settings.volume)) setVolume(Math.min(100, Math.max(0, settings.volume)));
    if (SPEED_RATES.includes(settings.playbackRate)) setPlaybackRate(settings.playbackRate);

    const audioSettings = settings.audioDSP;
    if (audioSettings && typeof audioSettings === 'object') {
      if (typeof audioSettings.is8DEnabled === 'boolean') setDspIs8DEnabled(audioSettings.is8DEnabled);
        if (Number.isFinite(audioSettings.eightDSpeed)) setDspEightDSpeed(Math.min(0.8, Math.max(0.05, audioSettings.eightDSpeed)));
        if (Number.isFinite(audioSettings.bassGain)) setDspBassGain(Math.min(20, Math.max(0, audioSettings.bassGain)));
        if (Number.isFinite(audioSettings.vocalGain)) setDspVocalGain(Math.min(12, Math.max(-12, audioSettings.vocalGain)));
        if (Number.isFinite(audioSettings.stereoPan)) setDspStereoPan(Math.min(1, Math.max(-1, audioSettings.stereoPan)));
      if (typeof audioSettings.isWideEnabled === 'boolean') setDspIsWideEnabled(audioSettings.isWideEnabled);
      if (Number.isFinite(audioSettings.wideMix)) setDspWideMix(Math.min(1, Math.max(0, audioSettings.wideMix)));
      if (Number.isFinite(audioSettings.wideDamp)) setDspWideDamp(Math.min(1, Math.max(0, audioSettings.wideDamp)));
      if (Number.isFinite(audioSettings.wideRoomSize)) setDspWideRoomSize(Math.min(1, Math.max(0, audioSettings.wideRoomSize)));
      if (Number.isFinite(audioSettings.wideGain)) setDspWideGain(Math.min(12, Math.max(-12, audioSettings.wideGain)));
    }
  }, [setAutoPlay, setBackgroundPlay, setCardAnimation, setDspBassGain, setDspEightDSpeed,
    setDspIs8DEnabled, setDspIsWideEnabled, setDspStereoPan, setDspVocalGain, setDspWideDamp,
    setDspWideGain, setDspWideMix, setDspWideRoomSize, setFavorites, setLedBrightness,
    setLedEnabled, setLedMode, setPlayHistory, setPlaylists, setSearchHistory, setTheme,
    setVolume, setPlaybackRate]);

  const saveAccountData = useCallback(async (data) => {
    const revision = ++accountSyncRevisionRef.current;
    const pendingSave = accountSyncQueueRef.current
      .catch(() => undefined)
      .then(() => requestAccountApi('/account/data', {
        method: 'PUT',
        body: JSON.stringify(data)
      }));
    accountSyncQueueRef.current = pendingSave;
    setSyncStatus('Đang đồng bộ dữ liệu...');
    try {
      await pendingSave;
      if (revision === accountSyncRevisionRef.current) setSyncStatus('Đã đồng bộ dữ liệu');
    } catch (error) {
      if (revision === accountSyncRevisionRef.current) {
        setSyncStatus(`Chưa đồng bộ: ${error.message}`);
      }
      console.error('Không thể đồng bộ dữ liệu tài khoản:', error);
    }
  }, []);

  const handleAuthenticate = useCallback(async (mode, credentials) => {
    const guestData = collectAccountData(true);
    const localData = collectAccountData();
    localStorage.setItem('chuongmusic_guest_data', JSON.stringify(guestData));
    const result = await requestAccountApi(`/auth/${mode}`, {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    const user = result.user;
    let remoteData = {};
    try {
      const saved = await requestAccountApi('/account/data');
      remoteData = saved.data;
    } catch (error) {
      console.error('Không thể tải dữ liệu tài khoản sau khi đăng nhập:', error);
      const localPlaylists = mergeDeviceLocalPlaylists(localData.playlists, guestData.playlists);
      const hydratedPlaylists = await hydratePlaylistAudio(localPlaylists);
      applyAccountData({ ...localData, playlists: hydratedPlaylists });
      setAccountUser(user);
      accountDataReadyRef.current = true;
      setSyncStatus(`Đã đăng nhập; chưa tải được dữ liệu: ${error.message}`);
      return;
    }

    const mergedCloudData = mergeAccountData(localData, remoteData);
    const devicePlaylists = mergeDeviceLocalPlaylists(mergedCloudData.playlists, guestData.playlists);
    const hydratedPlaylists = await hydratePlaylistAudio(devicePlaylists);
    applyAccountData({ ...mergedCloudData, playlists: hydratedPlaylists });
    setAccountUser(user);
    accountDataReadyRef.current = true;
    setSyncStatus('Đang đồng bộ dữ liệu...');
    await saveAccountData(mergedCloudData);
  }, [applyAccountData, collectAccountData, hydratePlaylistAudio, saveAccountData]);

  const handleLogout = useCallback(async () => {
    if (accountUser && accountDataReadyRef.current) {
      await saveAccountData(collectAccountData());
    }
    await requestAccountApi('/auth/logout', { method: 'POST' });
    accountDataReadyRef.current = false;
    accountSyncRevisionRef.current += 1;
    setAccountUser(null);
    setActiveTab('home');
    setIsPlaying(false);
    setCurrentSong(null);
    setCurrentIndex(-1);
    setCurrentTime(0);
    const guestDataText = localStorage.getItem('chuongmusic_guest_data');
    let guestData = createGuestDefaults();
    if (guestDataText) {
      try {
        guestData = JSON.parse(guestDataText);
      } catch (error) {
        console.error('Không thể khôi phục dữ liệu khách:', error);
      }
    }
    const guestPlaylists = await hydratePlaylistAudio(
      Array.isArray(guestData.playlists) ? guestData.playlists : [createDefaultPlaylist()]
    );
    const guestDefaults = createGuestDefaults();
    guestData = {
      ...guestDefaults,
      ...guestData,
      settings: { ...guestDefaults.settings, ...guestData.settings },
      playlists: guestPlaylists
    };
    applyAccountData(guestData);
    localStorage.removeItem('chuongmusic_guest_data');
    setSyncStatus('Đang sử dụng chế độ khách');
  }, [accountUser, applyAccountData, collectAccountData, hydratePlaylistAudio, saveAccountData]);

  const handleAvatarChange = useCallback(async (avatar) => {
    try {
      const result = await requestAccountApi('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ avatar })
      });
      setAccountUser(result.user);
      return true;
    } catch (error) {
      setSyncStatus(`Không thể lưu avatar: ${error.message}`);
      console.error('Không thể lưu avatar tài khoản:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const restoreAccount = async () => {
      try {
        const { user, locked } = await requestAccountApi('/auth/me');
        if (user) {
          const { data } = await requestAccountApi('/account/data');
          if (!active) return;
          let devicePlaylists = [];
          try {
            const guestData = JSON.parse(localStorage.getItem('chuongmusic_guest_data') || 'null');
            devicePlaylists = guestData?.playlists || JSON.parse(localStorage.getItem('liquid_playlists') || '[]');
          } catch (error) {
            console.error('Không thể khôi phục playlist chỉ có trên thiết bị:', error);
          }
          const playlistsWithLocalFiles = mergeDeviceLocalPlaylists(data.playlists, devicePlaylists);
          const hydratedPlaylists = await hydratePlaylistAudio(playlistsWithLocalFiles);
          if (!active) return;
          applyAccountData({ ...data, playlists: hydratedPlaylists });
          setAccountUser(user);
          accountDataReadyRef.current = true;
          setSyncStatus('Đã đồng bộ dữ liệu');
        } else if (locked) {
          setSyncStatus('Tài khoản đã bị khóa; đang sử dụng chế độ khách');
        }
      } catch (error) {
        if (active) {
          setSyncStatus(`Chế độ khách — ${error.message}`);
        }
      } finally {
        if (active) setAuthLoading(false);
      }
    };
    restoreAccount();
    return () => {
      active = false;
    };
  }, [applyAccountData, hydratePlaylistAudio]);

  const accountUserId = accountUser?.id;
  const handleLogoutRef = useRef(handleLogout);
  useEffect(() => {
    handleLogoutRef.current = handleLogout;
  }, [handleLogout]);

  useEffect(() => {
    if (analyticsVisitStarted) return undefined;
    analyticsVisitStarted = true;
    const visitorId = getAnalyticsVisitorId();
    if (!visitorId) return undefined;
    let active = true;
    requestAccountApi('/analytics/visit', {
      method: 'POST',
      credentials: 'omit',
      body: JSON.stringify({ visitorId })
    }).catch((error) => {
      if (active) console.warn('Không thể ghi nhận lượt truy cập:', error);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!accountUserId) return undefined;
    let active = true;
    let requestPending = false;
    const sendHeartbeat = async () => {
      if (!active || requestPending || document.hidden) return;
      requestPending = true;
      try {
        await requestAccountApi('/auth/heartbeat', { method: 'POST' });
      } catch (error) {
        if (active && (error.status === 401 || error.status === 403)) {
          setActiveTab('home');
          try {
            await handleLogoutRef.current();
            setSyncStatus('Phiên đăng nhập đã hết hạn hoặc tài khoản bị khóa; đã chuyển sang khách.');
          } catch (logoutError) {
            accountDataReadyRef.current = false;
            setAccountUser(null);
            setIsPlaying(false);
            setSyncStatus('Không thể tiếp tục phiên đăng nhập; đang sử dụng chế độ khách.');
            console.error('Không thể kết thúc phiên đã hết hạn:', logoutError);
          }
        } else if (active) {
          console.warn('Không thể cập nhật trạng thái hoạt động:', error);
        }
      } finally {
        requestPending = false;
      }
    };
    const onVisibilityChange = () => {
      if (!document.hidden) sendHeartbeat();
    };
    sendHeartbeat();
    const timer = window.setInterval(sendHeartbeat, 60_000);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [accountUserId]);

  useEffect(() => {
    if (!accountUserId || !accountDataReadyRef.current) return undefined;
    const timer = window.setTimeout(() => {
      saveAccountData(JSON.parse(accountDataJson));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [accountUserId, accountDataJson, saveAccountData]);

  currentTimeRef.current = currentTime;
  isPlayingRef.current = isPlaying;

  const selectSong = (song) => {
    setCurrentSong(song);
  };

  useEffect(() => {
    localStorage.removeItem('liquid_custom_media');
    getAllMediaDB().then((items) => {
      const listWithUrls = items.map((item) => ({
        ...item,
        url: item.file ? URL.createObjectURL(item.file) : item.url
      }));
      setCustomMediaList(listWithUrls);
    });
  }, []);

  useEffect(() => {
    let active = true;
    const restoreRevision = playlistDataRevisionRef.current;
    const restorePlaylistAudio = async () => {
      try {
        const savedPlaylists = JSON.parse(localStorage.getItem('liquid_playlists') || 'null')
          || [{ id: 'p1', name: 'Nhạc Chill Đêm Khuya', songs: [] }];
        const restoredPlaylists = await hydratePlaylistAudio(savedPlaylists);
        if (active && restoreRevision === playlistDataRevisionRef.current) {
          setPlaylists(restoredPlaylists);
        }
      } catch (error) {
        console.error('Không thể khôi phục file audio trong playlist:', error);
      }
    };
    restorePlaylistAudio();
    return () => {
      active = false;
    };
  }, [hydratePlaylistAudio]);

  useEffect(() => {
    if (activeBackground) {
      localStorage.setItem('liquid_active_bg', JSON.stringify({
        id: activeBackground.id,
        name: activeBackground.name,
        type: activeBackground.type,
        url: activeBackground.url
      }));
    } else {
      localStorage.removeItem('liquid_active_bg');
    }
  }, [activeBackground]);

  useEffect(() => {
    document.body.className = theme;
    localStorage.setItem('liquid_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('liquid_led_enabled', JSON.stringify(ledEnabled));
  }, [ledEnabled]);

  useEffect(() => {
    localStorage.setItem('liquid_volume', String(volume));
    localStorage.setItem('liquid_volume_initialized', 'true');
  }, [volume]);

  useEffect(() => {
    localStorage.setItem('liquid_playback_rate', String(playbackRate));
  }, [playbackRate]);

  useEffect(() => {
    localStorage.setItem('liquid_favs', JSON.stringify(favorites.filter((song) => song.type !== 'local')));
  }, [favorites]);

  useEffect(() => {
    if (!currentSong) {
      return;
    }
    if (currentSong.type === 'local') {
      localStorage.removeItem('liquid_current_playback');
      return;
    }
    localStorage.setItem('liquid_current_playback', JSON.stringify({
      song: currentSong,
      currentTime
    }));
  }, [currentSong, currentTime]);

  useEffect(() => {
    if (!currentSong) return undefined;
    if (currentSong.type === 'local') return undefined;

    const savePlaybackPosition = () => {
      const mediaElement = getActiveAudioRef().current;
      const mediaTime = mediaElement?.currentTime;
      const mediaIsReady = mediaElement?.readyState >= 1;
      const savedTime = mediaIsReady && Number.isFinite(mediaTime)
        ? mediaTime
        : currentTimeRef.current;

      localStorage.setItem('liquid_current_playback', JSON.stringify({
        song: currentSong,
        currentTime: Math.max(0, savedTime)
      }));
    };

    window.addEventListener('pagehide', savePlaybackPosition);
    return () => window.removeEventListener('pagehide', savePlaybackPosition);
  }, [currentSong]);

  useEffect(() => () => {
    localAudioUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const saveToSearchHistory = (term) => {
    if (!term || !term.trim()) return;
    const cleanTerm = term.trim();
    setSearchHistory((prev) => {
      const updated = [cleanTerm, ...prev.filter((item) => item.toLowerCase() !== cleanTerm.toLowerCase())].slice(0, 10);
      localStorage.setItem('liquid_search_history', JSON.stringify(updated));
      return updated;
    });
  };

  const clearSearchHistory = (e) => {
    if (e) e.stopPropagation();
    if (window.confirm('Bạn có muốn xóa toàn bộ lịch sử từ khóa tìm kiếm không?')) {
      setSearchHistory([]);
      localStorage.removeItem('liquid_search_history');
    }
  };

  const handleRefreshRecommendations = () => {
    const randomIndex = Math.floor(Math.random() * HOT_TIKTOK_KEYWORDS.length);
    executeSearch(HOT_TIKTOK_KEYWORDS[randomIndex], false, true);
  };

  const handleGoHome = () => {
    setQuery('');
    handleRefreshRecommendations();
    setActiveTab('home');
    setSidebarOpen(false);
  };

  const handleResetUserData = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ dữ liệu ứng dụng không?')) {
      localStorage.clear();
      indexedDB.deleteDatabase(DB_NAME);
      setPlayHistory([]);
      setFavorites([]);
      setSearchHistory([]);
      setCustomMediaList([]);
      setActiveBackground(null);
      setPlaylists([{ id: 'p1', name: 'Nhạc Chill Đêm Khuya', songs: [] }]);
      setNextSongToPlay(null);
      setShowRecommendPopup(false);
      setShowVideo(false);
      alert('Đã làm mới dữ liệu thành công!');
    }
  };

  const handlePlaylistAudioSelected = async (playlistId, event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    if (files.some((file) => !file.type.startsWith('audio/'))) {
      alert('Chỉ có thể thêm file audio vào playlist.');
      event.target.value = '';
      return;
    }

    const addedSongs = [];
    try {
      for (const [index, file] of files.entries()) {
        const audioId = `audio_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`;
        await saveAudioFileDB(audioId, file);
        const audioUrl = URL.createObjectURL(file);
        localAudioUrlsRef.current.add(audioUrl);
        addedSongs.push({
          id: audioId,
          audioId,
          audioUrl,
          type: 'local',
          title: file.name.replace(/\.[^.]+$/, '') || file.name,
          artist: 'Tệp audio trên thiết bị',
          thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&auto=format&fit=crop&q=80',
          durationSeconds: 0,
          duration: '--:--'
        });
      }

      const updatedPlaylists = playlists.map((playlist) => (
        playlist.id === playlistId
          ? { ...playlist, songs: [...playlist.songs, ...addedSongs] }
          : playlist
      ));
      persistPlaylists(updatedPlaylists);
      setPlaylists(updatedPlaylists);
      setSongs((previousSongs) => [...addedSongs, ...previousSongs]);
      setPlaybackError('');
    } catch (error) {
      console.error('Không thể thêm file audio vào playlist:', error);
      alert(error.message || 'Không thể lưu file audio trong playlist.');
      await Promise.all(addedSongs.map(async (song) => {
        URL.revokeObjectURL(song.audioUrl);
        localAudioUrlsRef.current.delete(song.audioUrl);
        try {
          await deleteAudioFileDB(song.audioId);
        } catch (deleteError) {
          console.error('Không thể dọn file audio chưa thêm vào playlist:', deleteError);
        }
      }));
    }

    event.target.value = '';
  };

  // PHÁT BÀI HÁT TỪ LINK YOUTUBE HOẶC TIKTOK TRỰC TIẾP
  const handlePlayFromLink = async (url) => {
    if (!url || !url.trim()) return;
    const cleanUrl = url.trim();
    const tiktokUrl = normalizeTikTokUrl(cleanUrl);

    if (tiktokUrl) {
      setLoading(true);
      setLoadingText('⏳ Đang mở video TikTok...');
      setPlaybackError('');
      setTikTokVideoError(false);
      try {
        const response = await fetch(`${API_BASE}/tiktok/resolve?url=${encodeURIComponent(tiktokUrl)}`);
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Không thể phân giải link TikTok.');
        }

        if (typeof result.videoId !== 'string' || !/^\d+$/.test(result.videoId) ||
            typeof result.url !== 'string') {
          throw new Error('Backend không trả về mã bài đăng TikTok hợp lệ.');
        }
        const resolvedTikTokUrl = normalizeTikTokUrl(result.url);
        if (!resolvedTikTokUrl) throw new Error('Backend trả về link TikTok không hợp lệ.');
        const embedUrl = new URL(`https://www.tiktok.com/player/v1/${result.videoId}`);
        embedUrl.search = new URLSearchParams({
          controls: '1',
          music_info: '1',
          description: '1',
          autoplay: '0'
        }).toString();

        const newSong = {
          id: `tiktok_embed_${result.videoId}`,
          type: 'tiktok_embed',
          title: 'Video TikTok',
          artist: 'TikTok',
          thumbnail: '',
          durationSeconds: 0,
          tiktokVideoId: result.videoId,
          tiktokUrl: resolvedTikTokUrl,
          embedUrl: embedUrl.toString()
        };
        selectSong(newSong);
        setSongs((previousSongs) => [newSong, ...previousSongs.filter((song) => song.id !== newSong.id)]);
        setCurrentIndex(0);
        setIsPlaying(false);
        setActiveTab('home');
      } catch (error) {
        console.error('Không thể tải bài TikTok:', error);
        setIsPlaying(false);
        setPlaybackError(error.message || 'Không thể tải âm thanh TikTok. Hãy thử lại sau.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // 2. XỬ LÝ LINK YOUTUBE
    const ytId = extractYouTubeId(cleanUrl);
    if (ytId) {
      setLoading(true);
      setLoadingText('⏳ Đang tải thông tin video YouTube...');
      setPlaybackError('');
      let metadata = {};
      try {
        const response = await fetch(`${API_BASE}/video?id=${encodeURIComponent(ytId)}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Không thể lấy thông tin video YouTube');
        }
        metadata = data;
      } catch (error) {
        console.warn('Không lấy được thông tin video YouTube:', error);
      } finally {
        setLoading(false);
      }

      const durationSeconds = Number.isSafeInteger(metadata.durationSeconds) && metadata.durationSeconds > 0
        ? metadata.durationSeconds
        : 0;
      const newSong = {
        id: ytId,
        type: 'youtube',
        title: metadata.title || 'Bài hát từ YouTube Link',
        artist: metadata.artist || 'YouTube',
        thumbnail: metadata.thumbnail || `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
        durationSeconds,
        duration: durationSeconds ? formatTime(durationSeconds) : '--:--'
      };

      selectSong(newSong);
      setSongs((prev) => [newSong, ...prev.filter((s) => s.id !== ytId)]);
      setCurrentIndex(0);
      setIsPlaying(true);
      setActiveTab('home');
      return;
    }

    alert('Vui lòng dán link YouTube hoặc TikTok hợp lệ!');
  };

  useEffect(() => {
    handleRefreshRecommendations();
  }, []);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const newMediaItems = [];

    for (const file of files) {
      let type = 'image';
      if (file.type.startsWith('video/')) type = 'video';
      else if (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')) type = 'gif';

      const blobUrl = URL.createObjectURL(file);
      const newItem = {
        id: Date.now() + Math.random().toString(36).substring(2, 9),
        name: file.name,
        type: type,
        file: file,
        url: blobUrl
      };

      await saveMediaDB(newItem);
      newMediaItems.push(newItem);
    }

    setCustomMediaList((prev) => [...prev, ...newMediaItems]);

    if (!activeBackground && newMediaItems.length > 0) {
      setActiveBackground(newMediaItems[0]);
    }

    e.target.value = null;
  };

  const handleDeleteMedia = async (idToDelete, e) => {
    if (e) e.stopPropagation();
    await deleteMediaDB(idToDelete);
    setCustomMediaList((prev) => prev.filter((item) => item.id !== idToDelete));
    if (activeBackground && activeBackground.id === idToDelete) setActiveBackground(null);
  };

  const createPlaylist = () => {
    if (!newPlaylistName.trim()) return;
    const newPl = { id: Date.now().toString(), name: newPlaylistName, songs: [] };
    const updated = [...playlists, newPl];
    setPlaylists(updated);
    persistPlaylists(updated);
    setNewPlaylistName('');
  };

  const deletePlaylist = async (playlistId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Xóa Playlist này?')) return;

    const localSongs = playlists.find((pl) => pl.id === playlistId)?.songs
      .filter((song) => song.type === 'local') || [];
    try {
      await Promise.all(localSongs.filter((song) => song.audioId).map((song) => deleteAudioFileDB(song.audioId)));
    } catch (error) {
      console.error('Không thể xóa file audio của playlist:', error);
      alert('Không thể xóa file audio đã lưu. Hãy thử lại.');
      return;
    }

    localSongs.forEach((song) => {
      if (song.audioUrl) {
        URL.revokeObjectURL(song.audioUrl);
        localAudioUrlsRef.current.delete(song.audioUrl);
      }
    });
    const updated = playlists.filter((pl) => pl.id !== playlistId);
    setSongs((previousSongs) => previousSongs.filter((song) => !localSongs.some((localSong) => localSong.id === song.id)));
    if (localSongs.some((song) => song.id === currentSong?.id)) {
      nativeAudioRef.current?.pause();
      backgroundAudioRef.current?.pause();
      setCurrentSong(null);
      setIsPlaying(false);
    }
    setPlaylists(updated);
    persistPlaylists(updated);
    if (selectedPlaylistId === playlistId) setSelectedPlaylistId(null);
  };

  const removeSongFromPlaylist = async (playlistId, songId, e) => {
    if (e) e.stopPropagation();
    const songToRemove = playlists.find((pl) => pl.id === playlistId)?.songs.find((song) => song.id === songId);
    if (songToRemove?.type === 'local') {
      try {
        if (songToRemove.audioId) await deleteAudioFileDB(songToRemove.audioId);
        if (songToRemove.audioUrl) {
          URL.revokeObjectURL(songToRemove.audioUrl);
          localAudioUrlsRef.current.delete(songToRemove.audioUrl);
        }
        if (currentSong?.id === songId) {
          nativeAudioRef.current?.pause();
          backgroundAudioRef.current?.pause();
          setCurrentSong(null);
          setIsPlaying(false);
        }
        setSongs((previousSongs) => previousSongs.filter((song) => song.id !== songId));
      } catch (error) {
        console.error('Không thể xóa file audio khỏi playlist:', error);
        alert('Không thể xóa file audio đã lưu. Hãy thử lại.');
        return;
      }
    }
    const updated = playlists.map((pl) => {
      if (pl.id === playlistId) {
        return { ...pl, songs: pl.songs.filter((s) => s.id !== songId) };
      }
      return pl;
    });
    setPlaylists(updated);
    persistPlaylists(updated);
  };

  const toggleFavorite = (song, e) => {
    if (e) e.stopPropagation();
    setFavorites((prev) => {
      const exists = prev.some((f) => f.id === song.id);
      return exists ? prev.filter((f) => f.id !== song.id) : [...prev, song];
    });
  };

  const isFav = (songId) => favorites.some((f) => f.id === songId);

  const getSmartRecommendation = () => {
    if (!songs || songs.length === 0) return null;
    if (songs.length === 1) return songs[0];
    const candidateSongs = songs.filter((_, idx) => idx !== currentIndex);
    return candidateSongs[0] || songs[(currentIndex + 1) % songs.length];
  };

  useEffect(() => {
    if (currentSong && currentSong.type !== 'local') {
      setDismissedRecommend(false);
      setShowRecommendPopup(false);
      setPlayHistory((prev) => {
        const updated = [currentSong, ...prev.filter((s) => s.id !== currentSong.id)].slice(0, 40);
        localStorage.setItem('liquid_history', JSON.stringify(updated));
        return updated;
      });
    }
  }, [currentSong]);

  useEffect(() => {
    if (!window.YT?.Player && !document.getElementById('youtube-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }, []);

  useEffect(() => {
    const trimmedQuery = query.trim().toLowerCase();
    suggestionAbortControllerRef.current?.abort();
    suggestionAbortControllerRef.current = null;
    if (!trimmedQuery) {
      setSuggestions([]);
      return;
    }

    if (suggestionCacheRef.current.has(trimmedQuery)) {
      const cachedSuggestions = suggestionCacheRef.current.get(trimmedQuery);
      suggestionCacheRef.current.delete(trimmedQuery);
      suggestionCacheRef.current.set(trimmedQuery, cachedSuggestions);
      setSuggestions(cachedSuggestions);
      return;
    }

    const controller = new AbortController();
    suggestionAbortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/suggestions?q=${encodeURIComponent(query)}`, {
          signal: controller.signal
        });
        const json = await res.json();
        const data = Array.isArray(json) ? json : [];
        if (controller.signal.aborted) return;
        suggestionCacheRef.current.set(trimmedQuery, data);
        if (suggestionCacheRef.current.size > MAX_SEARCH_CACHE_ENTRIES) {
          suggestionCacheRef.current.delete(suggestionCacheRef.current.keys().next().value);
        }
        setSuggestions(data);
      } catch (err) {
        if (err.name !== 'AbortError') setSuggestions([]);
      }
    }, 120);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // ĐỔI BÀI HÁT VÀ PHÁT MEDIA
  useEffect(() => {
    if (!currentSong || !currentSong.id) return;
    const savedPosition = savedPlaybackRef.current?.song.id === currentSong.id
      ? savedPlaybackRef.current.currentTime
      : 0;
    setVideoError(false);
    setTikTokVideoError(false);
    setVideoFrameStyle(null);
    setCurrentTime(savedPosition);
    setDuration(getKnownDuration(currentSong));
    let isCurrentPlayback = true;

    // Playlist audio uses the native player in background mode so mobile browsers
    // can keep it playing when the page is no longer visible.
    if (currentSong.type === 'local' || currentSong.type === 'tiktok') {
      const audioElement = getActiveAudioRef(currentSong).current;
      const otherAudioElement = audioElement === nativeAudioRef.current
        ? backgroundAudioRef.current
        : nativeAudioRef.current;
      const audioUrl = currentSong.audioUrl;
      if (!audioElement || !audioUrl) {
        setIsPlaying(false);
        setPlaybackError(currentSong.type === 'tiktok'
          ? 'Không tìm thấy luồng âm thanh TikTok. Hãy dán lại link TikTok.'
          : 'Không tìm thấy file audio trong trình duyệt. Hãy thêm lại file đó vào playlist.');
        return undefined;
      }
      otherAudioElement?.pause();
      const expectedSource = new URL(audioUrl, window.location.href).href;
      const sourceAlreadySelected = audioElement.src === expectedSource;
      audioElement.crossOrigin = 'anonymous';
      if (!sourceAlreadySelected) {
        audioElement.pause();
        audioElement.src = audioUrl;
      }
      audioElement.volume = volume / 100;
      audioElement.playbackRate = playbackRate;
      audioDSP.initAudioContext(audioElement);
      audioDSP.resumeAudioContext();
      const playPromise = audioElement.paused ? audioElement.play() : Promise.resolve();
      playPromise.then(() => {
        if (isCurrentPlayback) setIsPlaying(true);
      }).catch((error) => {
        if (!isCurrentPlayback) return;
        console.error(`Không thể phát ${currentSong.type === 'tiktok' ? 'TikTok' : 'file audio'}:`, error);
        setIsPlaying(false);
        setPlaybackError(error.name === 'NotAllowedError'
          ? 'Trình duyệt đã chặn tự phát. Hãy chạm nút Phát để bắt đầu.'
          : currentSong.type === 'tiktok'
            ? 'Không thể phát luồng âm thanh TikTok. Hãy thử lại với link khác.'
            : 'Không thể phát file audio này. Hãy thử định dạng MP3, WAV, M4A hoặc OGG.');
      });
      return () => {
        isCurrentPlayback = false;
      };
    }

    // YouTube audio is played by the official embedded player, not extracted by the backend.
    nativeAudioRef.current?.pause();
    backgroundAudioRef.current?.pause();
    if (nativeAudioRef.current) nativeAudioRef.current.removeAttribute('src');
    return () => {
      isCurrentPlayback = false;
    };
  }, [currentSong?.id]);

  useEffect(() => {
    if (currentSong?.type !== 'local' || !currentSong.audioUrl) return undefined;

    const previousAudioElement = backgroundPlay
      ? nativeAudioRef.current
      : backgroundAudioRef.current;
    const nextAudioElement = backgroundPlay
      ? backgroundAudioRef.current
      : nativeAudioRef.current;
    if (!previousAudioElement || !nextAudioElement) return undefined;

    const expectedSource = new URL(currentSong.audioUrl, window.location.href).href;
    if (previousAudioElement.src !== expectedSource) return undefined;

    const position = previousAudioElement.currentTime;
    const shouldResume = !previousAudioElement.paused;
    const sourceAlreadySelected = nextAudioElement.src === expectedSource;
    let active = true;
    const resumePlayback = () => {
      nextAudioElement.removeEventListener('loadedmetadata', resumePlayback);
      if (!active) return;
      if (Number.isFinite(position) && position > 0) {
        nextAudioElement.currentTime = position;
      }
      if (shouldResume) {
        nextAudioElement.play().then(() => {
          if (active) setIsPlaying(true);
        }).catch((error) => {
          if (!active) return;
          console.error('Không thể tiếp tục phát file audio:', error);
          setIsPlaying(false);
          setPlaybackError('Không thể tiếp tục phát file audio. Hãy chạm nút Phát để thử lại.');
        });
      }
    };

    previousAudioElement.pause();
    if (!sourceAlreadySelected) nextAudioElement.pause();
    nextAudioElement.crossOrigin = 'anonymous';
    audioDSP.initAudioContext(nextAudioElement);
    audioDSP.resumeAudioContext();
    nextAudioElement.addEventListener('loadedmetadata', resumePlayback);
    if (!sourceAlreadySelected) nextAudioElement.src = currentSong.audioUrl;
    nextAudioElement.volume = volume / 100;
    nextAudioElement.playbackRate = playbackRate;
    if (nextAudioElement.readyState >= 1) resumePlayback();

    return () => {
      active = false;
      nextAudioElement.removeEventListener('loadedmetadata', resumePlayback);
    };
  }, [backgroundPlay]);

  useEffect(() => {
    if (currentSong?.type !== 'tiktok') return;
    const video = tiktokVideoRef.current;
    const audio = getActiveAudioRef().current;
    if (!video) return;

    if (audio && Number.isFinite(audio.currentTime) && video.readyState >= 1) {
      video.currentTime = audio.currentTime;
    }

    if (isPlaying && showVideo) {
      video.play().catch((error) => {
        console.warn('Không thể phát video TikTok trong trang:', error);
      });
    } else {
      video.pause();
    }
  }, [currentSong?.id, currentSong?.type, isPlaying, showVideo]);

  useEffect(() => {
    if (currentSong?.type !== 'tiktok_embed') return undefined;
    tiktokPlayerReadyRef.current = false;
    const playerReadyTimeout = setTimeout(() => {
      if (!tiktokPlayerReadyRef.current) setTikTokVideoError(true);
    }, 15000);

    const handleTikTokPlayerMessage = (event) => {
      if (event.origin !== 'https://www.tiktok.com' ||
          event.source !== tiktokPlayerRef.current?.contentWindow ||
          event.data?.['x-tiktok-player'] !== true) return;

      const { type, value } = event.data;
      if (type === 'onPlayerReady') {
        tiktokPlayerReadyRef.current = true;
        clearTimeout(playerReadyTimeout);
      } else if (type === 'onStateChange') {
        const state = Number(value);
        setIsPlaying(state === 1);
        if (state === 1) setPlaybackError('');
        if (state === 0) handleAutoNextRef.current?.();
      } else if (type === 'onCurrentTime' && value &&
          Number.isFinite(value.currentTime) && Number.isFinite(value.duration)) {
        setCurrentTime(Math.max(0, value.currentTime));
        setDuration(Math.max(0, value.duration));
      } else if (type === 'onPlayerError') {
        console.error('Lỗi player TikTok:', value);
        setTikTokVideoError(true);
        setIsPlaying(false);
      }
    };

    window.addEventListener('message', handleTikTokPlayerMessage);
    return () => {
      clearTimeout(playerReadyTimeout);
      window.removeEventListener('message', handleTikTokPlayerMessage);
      tiktokPlayerReadyRef.current = false;
    };
  }, [currentSong?.id, currentSong?.type]);

  useEffect(() => {
    if (!currentSong || currentSong.type !== 'youtube' || videoError) return;
    const songId = currentSong.id;
    let stopped = false;
    let apiPoll;
    let apiTimeout;

    const createVideoPlayer = () => {
      if (stopped || !videoPlayerMountRef.current || !window.YT?.Player || videoPlayerRef.current) return;
      try {
        const playerTarget = document.createElement('div');
        playerTarget.id = 'youtube-video-player-instance';
        playerTarget.className = 'yt-player-target';
        videoPlayerMountRef.current.replaceChildren(playerTarget);
        videoPlayerSongRef.current = songId;
        videoPlayerRef.current = new window.YT.Player(playerTarget.id, {
          height: '100%',
          width: '100%',
          videoId: currentSong.id,
          playerVars: {
            autoplay: 0,
            controls: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin
          },
          events: {
            onReady: (event) => {
              if (videoPlayerSongRef.current !== songId) {
                event.target.destroy();
                return;
              }
              videoPlayerReadyRef.current = true;
              event.target.unMute();
              event.target.setVolume(volume);
              event.target.setPlaybackRate(playbackRate);
              const savedTime = savedPlaybackRef.current?.song.id === songId
                ? savedPlaybackRef.current.currentTime
                : currentTimeRef.current;
              if (savedTime > 0) event.target.seekTo(savedTime, true);
              if (savedPlaybackRef.current?.song.id === songId) savedPlaybackRef.current = null;
              if (isPlayingRef.current) event.target.playVideo();
              else event.target.pauseVideo();
              setDuration(event.target.getDuration() || getKnownDuration(currentSong));
            },
            onStateChange: (event) => {
              if (videoPlayerSongRef.current !== songId) return;
              if (event.data === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                setPlaybackError('');
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false);
              } else if (event.data === window.YT.PlayerState.ENDED) {
                setIsPlaying(false);
                handleAutoNextRef.current?.();
              }
            },
            onAutoplayBlocked: () => {
              if (videoPlayerSongRef.current !== songId) return;
              setIsPlaying(false);
              setPlaybackError('Trình duyệt đã chặn tự động phát. Hãy chạm nút Phát hoặc nút phát trong khung YouTube.');
            },
            onPlaybackRateChange: (event) => {
              if (videoPlayerSongRef.current !== songId) return;
              if (!SPEED_RATES.includes(event.data)) return;
              setPlaybackRate(event.data);
            },
            onError: (event) => {
              if (videoPlayerSongRef.current !== songId) return;
              console.error('Lỗi phát video YouTube:', event.data);
              try {
                videoPlayerRef.current?.destroy();
              } catch (error) {
                console.error('Không thể đóng trình phát video YouTube lỗi:', error);
              }
              videoPlayerRef.current = null;
              videoPlayerReadyRef.current = false;
              videoPlayerSongRef.current = null;
              setVideoError(true);
              setIsPlaying(false);
              setPlaybackError('YouTube không cho phép phát video này trong player nhúng. Hãy mở video trực tiếp trên YouTube.');
            }
          }
        });
      } catch (error) {
        console.error('Không thể khởi tạo trình phát video YouTube:', error);
        videoPlayerSongRef.current = null;
        setVideoError(true);
      }
    };

    if (window.YT?.Player) {
      createVideoPlayer();
    } else {
      apiPoll = setInterval(() => {
        if (window.YT?.Player) {
          clearInterval(apiPoll);
          createVideoPlayer();
        }
      }, 100);
      apiTimeout = setTimeout(() => {
        clearInterval(apiPoll);
        if (!stopped && !window.YT?.Player) {
          console.error('Hết thời gian chờ YouTube IFrame API.');
          setVideoError(true);
        }
      }, 20000);
    }

    return () => {
      stopped = true;
      clearInterval(apiPoll);
      clearTimeout(apiTimeout);
    };
  }, [currentSong?.id, currentSong?.type, videoError]);

  useEffect(() => {
    if (!currentSong || currentSong.type !== 'youtube' || !videoPlayerReadyRef.current) return;
    if (isPlaying) videoPlayerRef.current.playVideo();
    else videoPlayerRef.current.pauseVideo();
  }, [currentSong?.id, isPlaying]);

  useEffect(() => {
    if (!videoPlayerReadyRef.current || !currentSong || currentSong.type !== 'youtube') return;
    try {
      videoPlayerRef.current.setPlaybackRate(playbackRate);
      videoPlayerRef.current.setVolume(volume);
    } catch (error) {
      console.error('Không thể cập nhật âm lượng hoặc tốc độ player YouTube:', error);
    }
  }, [playbackRate, volume, currentSong?.id, currentSong?.type]);

  useEffect(() => () => {
    if (videoPlayerRef.current && typeof videoPlayerRef.current.destroy === 'function') {
      videoPlayerRef.current.destroy();
      videoPlayerRef.current = null;
    }
    videoPlayerReadyRef.current = false;
    videoPlayerSongRef.current = null;
  }, [currentSong?.id]);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        if (currentSong?.type === 'tiktok_embed') return;
        let cur = 0;
        let dur = 0;
        const mediaElement = ['local', 'tiktok'].includes(currentSong?.type)
          ? getActiveAudioRef().current
          : null;

        if (currentSong?.type === 'youtube' && videoPlayerReadyRef.current && videoPlayerRef.current?.getCurrentTime) {
          cur = videoPlayerRef.current.getCurrentTime() || 0;
          dur = videoPlayerRef.current.getDuration() || getKnownDuration(currentSong);
        } else if (mediaElement && Number.isFinite(mediaElement.duration) && mediaElement.duration > 0) {
          cur = mediaElement.currentTime || 0;
          dur = mediaElement.duration;
          if (currentSong?.type === 'tiktok' && tiktokVideoRef.current?.readyState >= 2 &&
            Math.abs(tiktokVideoRef.current.currentTime - cur) > 0.5) {
            tiktokVideoRef.current.currentTime = cur;
          }
        } else {
          dur = getKnownDuration(currentSong);
        }

        setCurrentTime(cur);
        setDuration(dur);

        const remaining = dur - cur;
        if (remaining <= 30 && remaining > 0 && !showRecommendPopup && !dismissedRecommend && songs.length > 0) {
          const recommended = getSmartRecommendation();
          if (recommended && recommended.id !== currentSong?.id) {
            setNextSongToPlay(recommended);
            setShowRecommendPopup(true);
          }
        }
      }, 500);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, showRecommendPopup, dismissedRecommend, songs, currentSong]);

  const handleAutoNext = () => {
    if (!autoPlay || songs.length === 0) return;
    if (nextSongToPlay) {
      const targetIdx = songs.findIndex((s) => s.id === nextSongToPlay.id);
      if (targetIdx !== -1) {
        playSong(targetIdx);
        return;
      }
    }
    handleNext();
  };
  useEffect(() => {
    handleAutoNextRef.current = handleAutoNext;
  });

  const executeSearch = async (searchKeyword, saveToHistory = true, isRecommendation = false) => {
    const term = searchKeyword || query;
    if (!term || !term.trim()) {
      searchAbortControllerRef.current?.abort();
      searchAbortControllerRef.current = null;
      setLoading(false);
      return;
    }

    searchAbortControllerRef.current?.abort();
    searchAbortControllerRef.current = null;

    if (extractYouTubeId(term) || isTikTokUrl(term)) {
      handlePlayFromLink(term);
      setQuery('');
      return;
    }

    const normalizedTerm = term.trim().replace(/\s+/g, ' ');
    const cleanTerm = normalizedTerm.toLowerCase();
    if (saveToHistory) saveToSearchHistory(term);

    if (isRecommendation) {
      setLoadingText('✨ Đang gợi ý các bài hát HOT Trend TikTok...');
      setCurrentSearchTitle('✨ Đang gợi ý các bài hát HOT Trend TikTok');
    } else {
      setLoadingText(`⏳ Đang tìm kiếm bài hát "${term}"...`);
      setCurrentSearchTitle(`🔍 Kết quả tìm kiếm cho từ khóa: "${term}"`);
    }

    setShowSuggestions(false);
    setActiveTab('home');

    const updateSongListAndActiveIndex = (newList) => {
      setSongs(newList);
      if (currentSong) {
        const foundIndex = newList.findIndex((s) => s && s.id === currentSong.id);
        setCurrentIndex(foundIndex);
      } else {
        setCurrentIndex(-1);
      }
    };

    if (!isRecommendation && searchCacheRef.current.has(cleanTerm)) {
      const cachedEntry = searchCacheRef.current.get(cleanTerm);
      if (cachedEntry.expiresAt > Date.now() &&
        Array.isArray(cachedEntry.songs) && cachedEntry.songs.length > 0) {
        searchCacheRef.current.delete(cleanTerm);
        searchCacheRef.current.set(cleanTerm, cachedEntry);
        setSearchError('');
        updateSongListAndActiveIndex(cachedEntry.songs);
        setLoading(false);
        return;
      }
      searchCacheRef.current.delete(cleanTerm);
    }

    setSearchError('');
    setLoading(true);
    const controller = new AbortController();
    searchAbortControllerRef.current = controller;

    try {
      const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(normalizedTerm)}&limit=30`, {
        signal: controller.signal
      });
      const resJson = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) {
        throw new Error(resJson.error || `Máy chủ tìm kiếm trả về lỗi ${response.status}`);
      }
      const resultList = Array.isArray(resJson) ? resJson : (resJson.songs || resJson.data || []);
      const songList = Array.isArray(resultList)
        ? resultList.map((song) => ({ ...song, type: song.type || 'youtube' }))
        : [];

      if (Array.isArray(songList) && songList.length > 0) {
        searchCacheRef.current.delete(cleanTerm);
        searchCacheRef.current.set(cleanTerm, {
          songs: songList,
          expiresAt: Date.now() + SEARCH_CACHE_TTL_MS
        });
        if (searchCacheRef.current.size > MAX_SEARCH_CACHE_ENTRIES) {
          searchCacheRef.current.delete(searchCacheRef.current.keys().next().value);
        }
        updateSongListAndActiveIndex(songList);
      } else {
        setSongs([]);
        setCurrentIndex(-1);
        setSearchError('Không tìm thấy video phù hợp. Thử từ khóa khác nhé.');
      }
    } catch (error) {
      if (error.name !== 'AbortError' && !controller.signal.aborted) {
        console.error('Lỗi tìm kiếm video:', error);
        setSearchError(error.message === 'Failed to fetch'
          ? 'Không kết nối được backend. Hãy chạy server và kiểm tra VITE_API_BASE.'
          : (error.message || 'Không thể tìm kiếm video. Hãy kiểm tra kết nối backend.'));
      }
    } finally {
      if (searchAbortControllerRef.current === controller) {
        searchAbortControllerRef.current = null;
        setLoading(false);
      }
    }
  };

  const toggleBackgroundPlayback = () => {
    const enabled = !backgroundPlay;
    if (currentSong?.type === 'local' && currentSong.audioUrl && isPlaying) {
      const currentAudioElement = getActiveAudioRef().current;
      const nextAudioElement = enabled
        ? backgroundAudioRef.current
        : nativeAudioRef.current;
      if (currentAudioElement && nextAudioElement && !currentAudioElement.paused) {
        const expectedSource = new URL(currentSong.audioUrl, window.location.href).href;
        nextAudioElement.crossOrigin = 'anonymous';
        if (nextAudioElement.src !== expectedSource) {
          nextAudioElement.pause();
          nextAudioElement.src = currentSong.audioUrl;
        }
        nextAudioElement.volume = volume / 100;
        nextAudioElement.playbackRate = playbackRate;
        audioDSP.initAudioContext(nextAudioElement);
        audioDSP.resumeAudioContext();
        nextAudioElement.play().catch((error) => {
          console.error('Không thể đổi chế độ phát file audio:', error);
          setIsPlaying(false);
          setPlaybackError('Không thể tiếp tục phát file audio. Hãy chạm nút Phát để thử lại.');
        });
      }
    }
    setBackgroundPlay(enabled);
  };

  const playSong = (index, songList = songs) => {
    const selectedSong = songList[index];
    if (!selectedSong) return;
    setPlaybackError('');
    if (selectedSong.type === 'local') {
      startLocalAudio(selectedSong);
    }
    if (songList !== songs) setSongs(songList);
    selectSong(selectedSong);
    setCurrentIndex(index);
    setIsPlaying(true);
  };

  const startLocalAudio = (song) => {
    const audioElement = getActiveAudioRef(song).current;
    if (!audioElement || !song.audioUrl) return;

    const otherAudioElement = audioElement === nativeAudioRef.current
      ? backgroundAudioRef.current
      : nativeAudioRef.current;
    otherAudioElement?.pause();

    const expectedSource = new URL(song.audioUrl, window.location.href).href;
    const sourceAlreadySelected = audioElement.src === expectedSource;
    audioElement.crossOrigin = 'anonymous';
    if (!sourceAlreadySelected) {
      audioElement.pause();
      audioElement.src = song.audioUrl;
    }
    audioElement.volume = volume / 100;
    audioElement.playbackRate = playbackRate;
    audioDSP.initAudioContext(audioElement);
    audioDSP.resumeAudioContext();
    if (!audioElement.paused) return;

    audioElement.play().catch((error) => {
      console.error('Không thể phát file audio:', error);
      setIsPlaying(false);
      setPlaybackError('Không thể phát file audio. Hãy thử định dạng MP3, WAV, M4A hoặc OGG.');
    });
  };

  const handleShufflePlay = (songList = displayedSongs) => {
    if (!songList || songList.length === 0) return;
    playSong(Math.floor(Math.random() * songList.length), songList);
  };

  const togglePlayPause = () => {
    setPlaybackError('');

    if (currentSong?.type === 'tiktok_embed') {
      if (!tiktokPlayerReadyRef.current) {
        setPlaybackError('Player TikTok đang tải. Hãy đợi một chút rồi thử lại.');
        return;
      }
      sendTikTokPlayerMessage(isPlaying ? 'pause' : 'play');
      return;
    }

    if (currentSong?.type === 'youtube') {
      if (!videoPlayerReadyRef.current || !videoPlayerRef.current) {
        setPlaybackError('YouTube Player đang tải. Vui lòng đợi một chút rồi thử lại.');
        return;
      }
      if (isPlaying) videoPlayerRef.current.pauseVideo();
      else {
        videoPlayerRef.current.unMute();
        videoPlayerRef.current.setVolume(volume);
        videoPlayerRef.current.playVideo();
      }
      return;
    }

    const audioElement = getActiveAudioRef().current;
    if (['local', 'tiktok'].includes(currentSong?.type) && audioElement) {
      audioDSP.initAudioContext(audioElement);
      audioDSP.resumeAudioContext();
      if (isPlaying) audioElement.pause();
      else {
        audioElement.play().catch((error) => {
          console.error(`Không thể phát ${currentSong.type === 'tiktok' ? 'TikTok' : 'file audio'}:`, error);
          setPlaybackError(currentSong.type === 'tiktok'
            ? 'Không thể phát luồng âm thanh TikTok. Hãy thử lại với link khác.'
            : 'Không thể phát file audio này.');
        });
      }
      return;
    }

    setIsPlaying(false);
  };

  const handleNext = () => {
    if (songs.length === 0) return;
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % songs.length;
    if (songs[nextIndex].type === 'local') startLocalAudio(songs[nextIndex]);
    selectSong(songs[nextIndex]);
    setCurrentIndex(nextIndex);
  };

  const handlePrev = () => {
    if (songs.length === 0) return;
    const previousIndex = currentIndex < 0 ? songs.length - 1 : (currentIndex - 1 + songs.length) % songs.length;
    if (songs[previousIndex].type === 'local') startLocalAudio(songs[previousIndex]);
    selectSong(songs[previousIndex]);
    setCurrentIndex(previousIndex);
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (currentSong?.type === 'tiktok_embed' && tiktokPlayerReadyRef.current) {
      sendTikTokPlayerMessage('seekTo', time);
    } else if (currentSong?.type === 'youtube' && videoPlayerReadyRef.current) {
      videoPlayerRef.current.seekTo(time, true);
    } else {
      const audioElement = getActiveAudioRef().current;
      if (audioElement?.src) audioElement.currentTime = time;
      if (currentSong?.type === 'tiktok' && tiktokVideoRef.current?.readyState >= 1) {
        tiktokVideoRef.current.currentTime = time;
      }
    }
  };

  const seekToTime = (time) => {
    const targetTime = Math.max(0, Number(time) || 0);
    setCurrentTime(targetTime);
    if (currentSong?.type === 'tiktok_embed' && tiktokPlayerReadyRef.current) {
      sendTikTokPlayerMessage('seekTo', targetTime);
    } else if (currentSong?.type === 'youtube' && videoPlayerReadyRef.current) {
      videoPlayerRef.current.seekTo(targetTime, true);
    } else if (getActiveAudioRef().current?.src) {
      getActiveAudioRef().current.currentTime = targetTime;
      if (currentSong?.type === 'tiktok' && tiktokVideoRef.current?.readyState >= 1) {
        tiktokVideoRef.current.currentTime = targetTime;
      }
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setVolume(val);
    const audioElement = getActiveAudioRef().current;
    if (['local', 'tiktok'].includes(currentSong?.type) && audioElement) {
      audioElement.volume = val / 100;
    }
    if (currentSong?.type === 'youtube' && videoPlayerReadyRef.current) {
      videoPlayerRef.current.setVolume(val);
    }
  };

  const toggleVideoFullscreen = async () => {
    const frame = videoPlayerFrameRef.current;
    if (!frame) return;

    try {
      if (document.fullscreenElement === frame) {
        await document.exitFullscreen();
      } else if (typeof frame.requestFullscreen === 'function') {
        await frame.requestFullscreen();
      } else if (typeof tiktokVideoRef.current?.webkitEnterFullscreen === 'function') {
        tiktokVideoRef.current.webkitEnterFullscreen();
      } else {
        setIsVideoExpanded((expanded) => !expanded);
      }
    } catch (error) {
      console.error('Không thể phóng to video TikTok:', error);
      setPlaybackError('Không thể bật toàn màn hình trên trình duyệt này.');
    }
  };

  const changeSpeed = (rate) => {
    const numericRate = parseFloat(Number(rate).toFixed(2));
    setPlaybackRate(numericRate);
    setShowSpeedMenu(false);

    const audioElement = getActiveAudioRef().current;
    if (['local', 'tiktok'].includes(currentSong?.type) && audioElement) {
      audioElement.playbackRate = numericRate;
    }
    if (videoPlayerReadyRef.current && typeof videoPlayerRef.current?.setPlaybackRate === 'function') {
      try {
        videoPlayerRef.current.setPlaybackRate(numericRate);
      } catch (error) {
        console.error('Không thể đổi tốc độ video YouTube:', error);
      }
    }
  };

  useEffect(() => {
    mediaSessionActionsRef.current = {
      play: () => {
        if (!isPlaying) togglePlayPause();
      },
      pause: () => {
        if (isPlaying) togglePlayPause();
      },
      next: handleNext,
      previous: handlePrev,
      seek: seekToTime,
      getCurrentTime: () => currentTime
    };
  });

  useEffect(() => {
    if (!currentSong || !('mediaSession' in navigator)) return undefined;

    const mediaSession = navigator.mediaSession;
    try {
      if ('MediaMetadata' in window) {
        mediaSession.metadata = new window.MediaMetadata({
          title: currentSong.title || 'Chuong Music',
          artist: currentSong.artist || 'Chuong Music',
          album: 'Chuong Music',
          artwork: currentSong.thumbnail
            ? [{ src: currentSong.thumbnail, sizes: '512x512', type: 'image/jpeg' }]
            : []
        });
      }
    } catch (error) {
      console.warn('Trình duyệt không hỗ trợ thông tin bài hát trên màn hình khóa:', error);
    }

    const actions = {
      play: () => mediaSessionActionsRef.current?.play(),
      pause: () => mediaSessionActionsRef.current?.pause(),
      nexttrack: () => mediaSessionActionsRef.current?.next(),
      previoustrack: () => mediaSessionActionsRef.current?.previous(),
      seekto: (event) => {
        if (Number.isFinite(event.seekTime)) mediaSessionActionsRef.current?.seek(event.seekTime);
      },
      seekbackward: (event) => {
        const currentTimeValue = mediaSessionActionsRef.current?.getCurrentTime() || 0;
        mediaSessionActionsRef.current?.seek(currentTimeValue - (event.seekOffset || 10));
      },
      seekforward: (event) => {
        const currentTimeValue = mediaSessionActionsRef.current?.getCurrentTime() || 0;
        mediaSessionActionsRef.current?.seek(currentTimeValue + (event.seekOffset || 10));
      }
    };

    const registeredActions = [];
    Object.entries(actions).forEach(([action, handler]) => {
      try {
        mediaSession.setActionHandler(action, handler);
        registeredActions.push(action);
      } catch (error) {
        console.warn(`Trình duyệt không hỗ trợ điều khiển ${action} trên màn hình khóa:`, error);
      }
    });

    return () => {
      registeredActions.forEach((action) => {
        try {
          mediaSession.setActionHandler(action, null);
        } catch (error) {
          console.warn(`Không thể gỡ điều khiển ${action} khỏi màn hình khóa:`, error);
        }
      });
      mediaSession.metadata = null;
    };
  }, [currentSong?.id]);

  useEffect(() => {
    if (!currentSong || !('mediaSession' in navigator)) return;
    const mediaSession = navigator.mediaSession;
    try {
      mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch (error) {
      console.warn('Trình duyệt không thể đồng bộ trạng thái phát trên màn hình khóa:', error);
    }
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(currentTime)) return;

    try {
      mediaSession.setPositionState({
        duration,
        playbackRate,
        position: Math.min(Math.max(currentTime, 0), duration)
      });
      mediaPositionStateErrorRef.current = false;
    } catch (error) {
      if (!mediaPositionStateErrorRef.current) {
        console.warn('Trình duyệt không thể đồng bộ thời gian phát trên màn hình khóa:', error);
        mediaPositionStateErrorRef.current = true;
      }
    }
  }, [currentSong?.id, isPlaying, duration, currentTime, playbackRate]);

  const displayedSongs = activeTab === 'favorites' ? favorites : songs;
  const handleAudioLoadedMetadata = (event) => {
    if (event.currentTarget !== getActiveAudioRef().current) return;
    if (['local', 'tiktok'].includes(currentSong?.type)) {
      const audioDuration = event.currentTarget.duration;
      if (Number.isFinite(audioDuration) && audioDuration > 0) setDuration(audioDuration);
    }
  };
  const handleAudioError = (event) => {
    if (event.currentTarget !== getActiveAudioRef().current) return;
    if (['local', 'tiktok'].includes(currentSong?.type)) {
      setIsPlaying(false);
      setPlaybackError(currentSong.type === 'tiktok'
        ? 'Không đọc được luồng âm thanh TikTok. Hãy thử lại với link khác.'
        : 'Không đọc được file audio. Hãy thử MP3, WAV, M4A hoặc OGG.');
    }
  };
  const handleAudioPlay = (event) => {
    if (event.currentTarget !== getActiveAudioRef().current) return;
    setIsPlaying(true);
    setPlaybackError('');
  };
  const handleAudioPause = (event) => {
    if (event.currentTarget === getActiveAudioRef().current) setIsPlaying(false);
  };
  const handleAudioEnded = (event) => {
    if (event.currentTarget === getActiveAudioRef().current) handleAutoNext();
  };

  return (
    <div
      className={`app-container ${theme}${lowPerformanceMode ? ' performance-lite' : ''}`}
      style={{ '--led-opacity': ledBrightness / 100 }}
    >
      <audio
        ref={nativeAudioRef}
        crossOrigin="anonymous"
        onEnded={handleAudioEnded}
        onLoadedMetadata={handleAudioLoadedMetadata}
        onError={handleAudioError}
        onPlay={handleAudioPlay}
        onPause={handleAudioPause}
        preload="auto"
        style={{ display: 'none' }}
      />
      <audio
        ref={backgroundAudioRef}
        onEnded={handleAudioEnded}
        onLoadedMetadata={handleAudioLoadedMetadata}
        onError={handleAudioError}
        onPlay={handleAudioPlay}
        onPause={handleAudioPause}
        preload="auto"
        style={{ display: 'none' }}
      />

      <Background activeBackground={activeBackground} lowPerformanceMode={lowPerformanceMode} />

      <SidebarMenu
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        songsCount={songs.length}
        favoritesCount={favorites.length}
        playlistsCount={playlists.length}
        handleGoHome={handleGoHome}
        isAdmin={accountUser?.role === 'admin'}
      />

      <HeaderNav
        query={query}
        setQuery={setQuery}
        suggestions={suggestions}
        showSuggestions={showSuggestions}
        setShowSuggestions={setShowSuggestions}
        searchHistory={searchHistory}
        executeSearch={executeSearch}
        clearSearchHistory={clearSearchHistory}
        handleRefreshRecommendations={handleRefreshRecommendations}
        handleResetUserData={handleResetUserData}
        ledEnabled={ledEnabled}
        setLedEnabled={setLedEnabled}
        ledMode={ledMode}
        setLedMode={setLedMode}
        ledBrightness={ledBrightness}
        setLedBrightness={setLedBrightness}
        theme={theme}
        setTheme={setTheme}
        setSidebarOpen={setSidebarOpen}
        handlePlayFromLink={handlePlayFromLink}
        cardAnimation={cardAnimation}
        setCardAnimation={setCardAnimation}
        accountUser={accountUser}
        authLoading={authLoading}
        syncStatus={syncStatus}
        onAuthenticate={handleAuthenticate}
        onLogout={handleLogout}
        onAvatarChange={handleAvatarChange}
      />

      {showRecommendPopup && (
        <RecommendPopup
          nextSongToPlay={nextSongToPlay}
          remainingSeconds={Math.ceil(Math.max(0, duration - currentTime))}
          setDismissedRecommend={setDismissedRecommend}
          setShowRecommendPopup={setShowRecommendPopup}
          songs={songs}
          playSong={playSong}
          ledEnabled={ledEnabled}
          ledMode={ledMode}
        />
      )}

      <main className="main-content">
        {playbackError && (
          <div className="tiktok-player-error" role="alert">
            {playbackError}
          </div>
        )}
        <div className={`video-container-wrapper ${
          currentSong?.type === 'tiktok_embed' ||
          showVideo && (currentSong?.type === 'youtube' || currentSong?.type === 'tiktok')
            ? 'visible'
            : 'hidden'
        }`}>
          <div
            ref={videoPlayerFrameRef}
            className={`video-glass-box glass-card video-player-frame${isVideoExpanded ? ' is-expanded' : ''}`}
            style={{
              ...(videoFrameStyle || {}),
              ...(currentSong?.type === 'youtube'
                ? { width: '100%', maxWidth: '680px' }
                : currentSong?.type === 'tiktok_embed'
                  ? { width: '100%', maxWidth: '380px', aspectRatio: '9 / 16' }
                : currentSong?.type === 'tiktok'
                  ? { width: '100%', maxWidth: '680px', aspectRatio: '16 / 9' }
                  : {})
            }}
          >
            {currentSong?.type === 'tiktok' && tiktokVideoError ? (
              <div className="video-unavailable">
                <p>Không tải được video TikTok, nhưng âm thanh vẫn tiếp tục phát.</p>
                <a href={currentSong.tiktokUrl} target="_blank" rel="noreferrer">
                  Mở video trên TikTok
                </a>
              </div>
            ) : currentSong?.type === 'tiktok_embed' && tiktokVideoError ? (
              <div className="video-unavailable">
                <p>TikTok player không tải được video này. Mở trực tiếp trên TikTok hoặc thử link công khai khác.</p>
                <a href={currentSong.tiktokUrl} target="_blank" rel="noreferrer">
                  Mở video trên TikTok
                </a>
              </div>
            ) : videoError && currentSong?.type === 'youtube' ? (
              <div className="video-unavailable">
                <p>Video này không cho phép phát trực tiếp trong trang.</p>
                <a
                  href={`https://www.youtube.com/watch?v=${encodeURIComponent(currentSong.id)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Mở video trên YouTube
                </a>
              </div>
            ) : (
              <>
                {currentSong?.type === 'tiktok_embed' ? (
                  <iframe
                    ref={tiktokPlayerRef}
                    key={currentSong.id}
                    src={currentSong.embedUrl}
                    title={currentSong.title}
                    allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                    referrerPolicy="strict-origin-when-cross-origin"
                    onError={() => setTikTokVideoError(true)}
                  />
                ) : currentSong?.type === 'tiktok' && showVideo ? (
                  <video
                    ref={tiktokVideoRef}
                    key={currentSong.id}
                    src={currentSong.videoUrl}
                    poster={currentSong.thumbnail}
                    muted
                    playsInline
                    preload="auto"
                    onLoadedMetadata={(event) => {
                      const audioTime = nativeAudioRef.current?.currentTime;
                      if (Number.isFinite(audioTime) && audioTime > 0) {
                        event.currentTarget.currentTime = audioTime;
                      }
                      if (isPlayingRef.current && showVideo) {
                        event.currentTarget.play().catch((error) => {
                          console.warn('Không thể phát video TikTok trong trang:', error);
                        });
                      }
                    }}
                    onError={() => {
                      console.warn('Không thể tải video TikTok:', currentSong.videoUrl);
                      setTikTokVideoError(true);
                    }}
                  />
                ) : (
                  <div
                    className="video-poster"
                    role="img"
                    aria-label={currentSong?.title || 'Ảnh bìa bài hát'}
                    style={{
                      backgroundImage: `url("${currentSong?.thumbnail || `https://img.youtube.com/vi/${currentSong?.id}/hqdefault.jpg`}")`
                    }}
                  />
                )}
                {currentSong?.type === 'tiktok' && showVideo && (
                  <button
                    className="video-expand-button"
                    type="button"
                    onClick={toggleVideoFullscreen}
                    aria-label={isVideoFullscreen || isVideoExpanded ? 'Thu nhỏ video' : 'Phóng to video'}
                    aria-pressed={isVideoFullscreen || isVideoExpanded}
                    title={isVideoFullscreen || isVideoExpanded ? 'Thu nhỏ video' : 'Phóng to video'}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      {isVideoFullscreen || isVideoExpanded ? (
                        <path d="M8 3v5H3M16 3v5h5M8 21v-5H3m13 5v-5h5" />
                      ) : (
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3m13 5h3a2 2 0 0 0 2-2v-3" />
                      )}
                    </svg>
                  </button>
                )}
                {currentSong?.type === 'youtube' && (
                  <div
                    ref={videoPlayerMountRef}
                    className="youtube-video-overlay"
                    aria-label={`Video YouTube: ${currentSong.title}`}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {activeTab === 'audio-fx' && (
          <AudioManager
            audioDSP={audioDSP}
            playbackRate={playbackRate}
            changeSpeed={changeSpeed}
            playbackError={currentSong?.type === 'youtube'
              ? 'YouTube đang phát bằng player nhúng chính thức; DSP không áp dụng cho nguồn này.'
              : currentSong?.type === 'tiktok_embed'
                ? 'TikTok đang phát bằng player chính thức; DSP không áp dụng cho nguồn này.'
                : playbackError}
          />
        )}

        {activeTab === 'admin' && accountUser?.role === 'admin' && <AdminManager />}

        {activeTab === 'custom-media' && (
          <CustomMediaManager
            fileInputRef={fileInputRef}
            handleFileUpload={handleFileUpload}
            activeBackground={activeBackground}
            setActiveBackground={setActiveBackground}
            customMediaList={customMediaList}
            handleDeleteMedia={handleDeleteMedia}
          />
        )}

        {activeTab === 'playlist' && (
          <PlaylistManager
            newPlaylistName={newPlaylistName}
            setNewPlaylistName={setNewPlaylistName}
            createPlaylist={createPlaylist}
            playlists={playlists}
            selectedPlaylistId={selectedPlaylistId}
            setSelectedPlaylistId={setSelectedPlaylistId}
            deletePlaylist={deletePlaylist}
            playSong={playSong}
            removeSongFromPlaylist={removeSongFromPlaylist}
            handleShufflePlay={handleShufflePlay}
            handleAudioFilesSelected={handlePlaylistAudioSelected}
          />
        )}

        {activeTab === 'queue' && (
          <QueueManager
            songs={songs}
            currentIndex={currentIndex}
            isPlaying={isPlaying}
            ledEnabled={ledEnabled}
            ledMode={ledMode}
            playSong={playSong}
          />
        )}

        {(activeTab === 'home' || activeTab === 'favorites') && (
          <>
            <div className="tab-title-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0 }}>
                  {activeTab === 'favorites' ? '❤️ Danh Sách Yêu Thích' : `🔥 Kết Quả Tìm Kiếm (${displayedSongs.length} bài)`}
                </h2>
                {activeTab === 'home' && (
                  <p className="status-text" style={{ marginTop: '4px', marginBottom: 0 }}>
                    {loading ? loadingText : currentSearchTitle}
                  </p>
                )}
                {activeTab === 'home' && searchError && (
                  <p className="status-text" role="alert" style={{ color: '#ff7b7b', marginTop: '6px' }}>
                    {searchError}
                  </p>
                )}
              </div>

              {displayedSongs.length > 0 && (
                <button
                  className="import-btn glow-hover-btn"
                  onClick={() => handleShufflePlay(displayedSongs)}
                  style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  🔀 Phát Ngẫu Nhiên
                </button>
              )}
            </div>

            <div className="songs-grid">
              {displayedSongs.map((song, index) => (
                <SongCard
                  key={song.id || index}
                  song={song}
                  index={index}
                  isPlayingThis={currentSong?.id === song.id}
                  isPlaying={isPlaying}
                  ledEnabled={ledEnabled}
                  ledMode={ledMode}
                  playSong={playSong}
                  displayedSongs={displayedSongs}
                  toggleFavorite={toggleFavorite}
                  isFav={isFav}
                  cardAnimation={cardAnimation}
                />
              ))}
            </div>
          </>
        )}

        <footer className={`site-footer glass-card always-rgb-footer mode-${ledMode}`}>
          <p>© All rights reserved by <strong>Chuong Music</strong> ❤️❤️❤️</p>
          <p>🎶Trang web này được viết nhằm giải trí nghe nhạc, <b><i>không hoạt động bất kỳ nội dung nào liên quan đến kinh doanh và quảng cáo.</i></b> </p>
          <p className="sub-msg">✨ Chúc các bạn nghe nhạc vui vẻ và thư giãn cùng Chương Music! ✨</p>
          <div className="footer-contact-badge">
            Mọi thắc mắc vui lòng liên hê:📱 Contact / Zalo: <strong>0812234259</strong>
          </div>
        </footer>
      </main>

      <PlayerDock
        currentSong={currentSong}
        isPlaying={isPlaying}
        ledEnabled={ledEnabled}
        ledMode={ledMode}
        toggleFavorite={toggleFavorite}
        isFav={isFav}
        theme={theme}
        handlePrev={handlePrev}
        togglePlayPause={togglePlayPause}
        handleNext={handleNext}
        currentTime={currentTime}
        duration={duration}
        handleSeek={handleSeek}
        backgroundPlay={backgroundPlay}
        toggleBackgroundPlay={toggleBackgroundPlayback}
        autoPlay={autoPlay}
        setAutoPlay={setAutoPlay}
        showVideo={showVideo}
        toggleVideo={() => setShowVideo((visible) => !visible)}
        canToggleVideo={currentSong?.type === 'tiktok' || currentSong?.type === 'youtube'}
        canAdjustVolume={currentSong?.type !== 'tiktok_embed'}
        canChangeSpeed={currentSong?.type !== 'tiktok_embed'}
        playbackRate={playbackRate}
        showSpeedMenu={showSpeedMenu}
        setShowSpeedMenu={setShowSpeedMenu}
        changeSpeed={changeSpeed}
        volume={volume}
        handleVolumeChange={handleVolumeChange}
        lowPerformanceMode={lowPerformanceMode}
      />
    </div>
  );
}

export default App;
