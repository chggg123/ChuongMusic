import { useState, useRef, useEffect } from 'react';
import './App.css';
import './responsive.css';
import { API_BASE, HOT_TIKTOK_KEYWORDS, SPEED_RATES, extractYouTubeId, formatTime, normalizeTikTokUrl } from './constants';
import { Background } from './Background';
import { HeaderNav } from './HeaderNav';
import { SidebarMenu } from './SidebarMenu';
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
const VIDEO_SIZE_WIDTHS = {
  small: 480,
  medium: 680,
  large: 960
};

const loadSavedPlayback = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('liquid_current_playback') || 'null');
    if (!saved?.song?.id || !['youtube', 'tiktok'].includes(saved.song.type)) return null;
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
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
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

function App() {
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
  const [currentSong, setCurrentSong] = useState(() => savedPlayback?.song || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState('');
  const [currentTime, setCurrentTime] = useState(() => savedPlayback?.currentTime || 0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    const savedVolume = Number(localStorage.getItem('liquid_volume'));
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

  const searchCacheRef = useRef(new Map());
  const suggestionCacheRef = useRef(new Map());
  const searchAbortControllerRef = useRef(null);
  const suggestionAbortControllerRef = useRef(null);

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
        if (nativeAudioRef.current && !nativeAudioRef.current.paused) {
          nativeAudioRef.current.pause();
        }
        if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
          try { playerRef.current.pauseVideo(); } catch (e) { }
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

  const [playHistory, setPlayHistory] = useState(() => {
    const saved = localStorage.getItem('liquid_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [showRecommendPopup, setShowRecommendPopup] = useState(false);
  const [nextSongToPlay, setNextSongToPlay] = useState(null);
  const [dismissedRecommend, setDismissedRecommend] = useState(false);

  const [showVideo, setShowVideo] = useState(false);
  const [videoSize, setVideoSize] = useState(() => {
    const savedSize = localStorage.getItem('liquid_video_size');
    return VIDEO_SIZE_WIDTHS[savedSize] ? savedSize : 'medium';
  });
  const [videoError, setVideoError] = useState(false);
  const [isUsingIframeAudio, setIsUsingIframeAudio] = useState(false);
  const [videoFrameStyle, setVideoFrameStyle] = useState(null);

  const [customMediaList, setCustomMediaList] = useState([]);

  const [activeBackground, setActiveBackground] = useState(() => {
    const saved = localStorage.getItem('liquid_active_bg');
    return saved ? JSON.parse(saved) : null;
  });

  const fileInputRef = useRef(null);
  const savedPlaybackRef = useRef(savedPlayback);
  const playerRef = useRef(null);
  const videoPlayerRef = useRef(null);
  const videoPlayerReadyRef = useRef(false);
  const youtubePlayerMountRef = useRef(null);
  const videoPlayerMountRef = useRef(null);
  const nativeAudioRef = useRef(null);
  const tiktokVideoRef = useRef(null);
  const timerRef = useRef(null);
  const currentTimeRef = useRef(currentTime);
  const isPlayingRef = useRef(isPlaying);
  const showVideoRef = useRef(showVideo);
  const videoPlayerSongRef = useRef(null);

  currentTimeRef.current = currentTime;
  isPlayingRef.current = isPlaying;

  useEffect(() => {
    showVideoRef.current = showVideo;
  }, [showVideo]);

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
    localStorage.setItem('liquid_video_size', videoSize);
  }, [videoSize]);

  useEffect(() => {
    localStorage.setItem('liquid_led_enabled', JSON.stringify(ledEnabled));
  }, [ledEnabled]);

  useEffect(() => {
    localStorage.setItem('liquid_volume', String(volume));
  }, [volume]);

  useEffect(() => {
    localStorage.setItem('liquid_playback_rate', String(playbackRate));
  }, [playbackRate]);

  useEffect(() => {
    localStorage.setItem('liquid_favs', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    if (!currentSong) {
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

    const savePlaybackPosition = () => {
      const mediaElement = currentSong.type === 'tiktok'
        ? tiktokVideoRef.current
        : nativeAudioRef.current;
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

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

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
      alert('Đã làm mới dữ liệu thành công!');
    }
  };

  // PHÁT BÀI HÁT TỪ LINK YOUTUBE HOẶC TIKTOK TRỰC TIẾP
  const handlePlayFromLink = async (url) => {
    if (!url || !url.trim()) return;
    const cleanUrl = url.trim();
    const tikTokUrl = normalizeTikTokUrl(cleanUrl);

    // 1. LẤY VIDEO TIKTOK QUA SERVER ĐỂ CÙNG ÁP DỤNG DSP
    if (tikTokUrl) {
      setLoading(true);
      setLoadingText('⏳ Đang tải video TikTok...');

      try {
        const response = await fetch(`${API_BASE}/tiktok?url=${encodeURIComponent(tikTokUrl)}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Không thể lấy video TikTok');
        }
        let videoUrl = data.videoUrl ? `${API_BASE}/${data.videoUrl}` : null;
        let songData = data;

        if (!videoUrl && data.id) {
          const fallbackResponse = await fetch(
            `https://www.tikwm.com/api/?url=${encodeURIComponent(data.tiktokUrl || tikTokUrl)}`
          );
          const fallbackResult = await fallbackResponse.json();
          const fallbackData = fallbackResult.data;
          const directVideoUrl = fallbackData?.play || fallbackData?.wmplay;
          if (!fallbackResponse.ok || Number(fallbackResult.code) !== 0 || !directVideoUrl) {
            throw new Error(fallbackResult.msg || 'Không thể lấy luồng video TikTok');
          }

          songData = {
            ...data,
            id: `tiktok_${fallbackData.id}`,
            title: fallbackData.title || data.title,
            artist: fallbackData.author?.nickname ? `@${fallbackData.author.nickname}` : data.artist,
            thumbnail: fallbackData.cover || data.thumbnail,
            duration: fallbackData.duration || data.duration
          };
          videoUrl = directVideoUrl;
        }

        if (songData.id && videoUrl) {
          const newSong = {
            ...songData,
            type: 'tiktok',
            videoUrl,
            duration: formatTime(songData.duration || 0)
          };

          setCurrentSong(newSong);
          setSongs((prev) => [newSong, ...prev.filter((song) => song.id !== newSong.id)]);
          setCurrentIndex(0);
          setIsPlaying(true);
          setActiveTab('home');
        } else {
          throw new Error('TikTok không trả về dữ liệu video hợp lệ');
        }
      } catch (err) {
        console.error('Lỗi tải video TikTok:', err);
        alert(err.message || 'Lỗi kết nối khi tải video TikTok!');
      } finally {
        setLoading(false);
      }
      return;
    }

    // 2. XỬ LÝ LINK YOUTUBE
    const ytId = extractYouTubeId(cleanUrl);
    if (ytId) {
      const newSong = {
        id: ytId,
        type: 'youtube',
        title: 'Bài hát từ YouTube Link',
        artist: 'YouTube',
        thumbnail: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
        duration: '--:--'
      };

      setCurrentSong(newSong);
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
    localStorage.setItem('liquid_playlists', JSON.stringify(updated));
    setNewPlaylistName('');
  };

  const deletePlaylist = (playlistId, e) => {
    if (e) e.stopPropagation();
    if (window.confirm('Xóa Playlist này?')) {
      const updated = playlists.filter((pl) => pl.id !== playlistId);
      setPlaylists(updated);
      localStorage.setItem('liquid_playlists', JSON.stringify(updated));
      if (selectedPlaylistId === playlistId) setSelectedPlaylistId(null);
    }
  };

  const removeSongFromPlaylist = (playlistId, songId, e) => {
    if (e) e.stopPropagation();
    const updated = playlists.map((pl) => {
      if (pl.id === playlistId) {
        return { ...pl, songs: pl.songs.filter((s) => s.id !== songId) };
      }
      return pl;
    });
    setPlaylists(updated);
    localStorage.setItem('liquid_playlists', JSON.stringify(updated));
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
    if (currentSong) {
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
    if (!trimmedQuery) {
      setSuggestions([]);
      return;
    }

    if (suggestionCacheRef.current.has(trimmedQuery)) {
      setSuggestions(suggestionCacheRef.current.get(trimmedQuery));
      return;
    }

    if (suggestionAbortControllerRef.current) suggestionAbortControllerRef.current.abort();
    const controller = new AbortController();
    suggestionAbortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/suggestions?q=${encodeURIComponent(query)}`, {
          signal: controller.signal
        });
        const json = await res.json();
        const data = Array.isArray(json) ? json : [];
        suggestionCacheRef.current.set(trimmedQuery, data);
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
    setIsUsingIframeAudio(false);
    setVideoFrameStyle(null);
    setCurrentTime(savedPosition);
    setDuration(0);
    let isCurrentPlayback = true;

    if (playerRef.current && typeof playerRef.current.destroy === 'function') {
      try {
        playerRef.current.destroy();
      } catch (error) {
        console.error('Không thể đóng trình phát YouTube cũ:', error);
      }
      playerRef.current = null;
    }

    // TRƯỜNG HỢP NHẠC TIKTOK
    if (currentSong.type === 'tiktok') {
      const isRestoring = savedPlaybackRef.current?.song.id === currentSong.id;
      if (nativeAudioRef.current) {
        nativeAudioRef.current.pause();
        nativeAudioRef.current.src = '';
      }
      if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
        try { playerRef.current.pauseVideo(); } catch (e) { }
      }
      setIsPlaying(!isRestoring);
      if (tiktokVideoRef.current) {
        tiktokVideoRef.current.volume = volume / 100;
        tiktokVideoRef.current.playbackRate = playbackRate;
        audioDSP.initAudioContext(tiktokVideoRef.current);
        audioDSP.resumeAudioContext();
        if (isRestoring) {
          const restorePosition = () => {
            if (!isCurrentPlayback) return;
            tiktokVideoRef.current.currentTime = Math.min(savedPosition, tiktokVideoRef.current.duration || savedPosition);
            setCurrentTime(tiktokVideoRef.current.currentTime);
            setDuration(tiktokVideoRef.current.duration || 0);
            savedPlaybackRef.current = null;
          };
          if (tiktokVideoRef.current.readyState >= 1) restorePosition();
          else tiktokVideoRef.current.addEventListener('loadedmetadata', restorePosition, { once: true });
        } else {
          tiktokVideoRef.current.play().catch((error) => {
            if (isCurrentPlayback) {
              console.error('Không thể phát video TikTok:', error);
              setIsPlaying(false);
            }
          });
        }
      }
      return () => {
        isCurrentPlayback = false;
      };
    }

    // TRƯỜNG HỢP NHẠC YOUTUBE
    if (nativeAudioRef.current) {
      const streamUrl = `${API_BASE}/stream?id=${currentSong.id}`;
      if (nativeAudioRef.current.getAttribute('src') !== streamUrl) {
        nativeAudioRef.current.src = streamUrl;
      }
      nativeAudioRef.current.playbackRate = playbackRate;
      nativeAudioRef.current.volume = volume / 100;
    }

    const playCurrentSong = () => {
      if (!isCurrentPlayback) return;
      try {
        if (window.YT && window.YT.Player) {
          const playerMount = youtubePlayerMountRef.current;
          if (!playerMount) return;
          const playerTarget = document.createElement('div');
          playerTarget.id = 'yt-player-instance';
          playerTarget.className = 'yt-player-target';
          playerMount.replaceChildren(playerTarget);
          playerRef.current = new window.YT.Player(playerTarget.id, {
            height: '200',
            width: '200',
            videoId: currentSong.id,
            playerVars: {
              autoplay: 1,
              controls: 1,
              playsinline: 1,
              rel: 0,
              origin: window.location.origin
            },
            events: {
              onReady: (event) => {
                if (!isCurrentPlayback) {
                  event.target.destroy();
                  return;
                }
                event.target.setVolume(volume);
                event.target.setPlaybackRate(playbackRate);
                if (savedPlaybackRef.current?.song.id === currentSong.id) {
                  event.target.seekTo(savedPosition, true);
                  event.target.pauseVideo();
                  setCurrentTime(savedPosition);
                  setDuration(event.target.getDuration() || 0);
                  savedPlaybackRef.current = null;
                  return;
                }
                event.target.playVideo();
                setIsPlaying(true);
              },
              onStateChange: (event) => {
                if (!isCurrentPlayback) return;
                if (event.data === window.YT.PlayerState.PLAYING) {
                  setIsPlaying(true);
                  setDuration(playerRef.current.getDuration() || 0);
                } else if (event.data === window.YT.PlayerState.PAUSED) {
                  setIsPlaying(false);
                } else if (event.data === window.YT.PlayerState.ENDED) {
                  handleAutoNext();
                }
              },
              onError: () => {
                if (!isCurrentPlayback) return;
                try {
                  playerRef.current?.destroy();
                } catch (error) {
                  console.error('Không thể đóng trình phát YouTube lỗi:', error);
                }
                playerRef.current = null;
                setVideoError(true);
              }
            }
          });
        }
      } catch (err) {
        setVideoError(true);
      }
    };

    let fallbackStarted = false;
    const startIframeFallback = () => {
      if (!isCurrentPlayback || fallbackStarted) return;
      fallbackStarted = true;
      setIsUsingIframeAudio(true);
      if (window.YT && window.YT.Player) playCurrentSong();
      else window.onYouTubeIframeAPIReady = playCurrentSong;
    };
    const audioElement = nativeAudioRef.current;
    audioElement?.addEventListener('error', startIframeFallback);

    if (savedPlaybackRef.current?.song.id === currentSong.id && audioElement) {
      const restorePosition = () => {
        if (!isCurrentPlayback || !Number.isFinite(audioElement.duration)) return;
        audioElement.currentTime = Math.min(savedPosition, audioElement.duration || savedPosition);
        setCurrentTime(audioElement.currentTime);
        setDuration(audioElement.duration || 0);
        savedPlaybackRef.current = null;
      };
      audioElement.addEventListener('loadedmetadata', restorePosition, { once: true });
      if (audioElement.readyState >= 1) restorePosition();
      return () => {
        isCurrentPlayback = false;
        audioElement.removeEventListener('error', startIframeFallback);
        audioElement.removeEventListener('loadedmetadata', restorePosition);
      };
    }

    if (nativeAudioRef.current) {
      audioDSP.initAudioContext(nativeAudioRef.current);
      audioDSP.resumeAudioContext();
      nativeAudioRef.current.play().then(() => {
        if (isCurrentPlayback) setIsPlaying(true);
      }).catch((error) => {
        if (error.name === 'NotAllowedError') {
          if (isCurrentPlayback) {
            setIsPlaying(false);
            setPlaybackError('Trình duyệt chặn tự phát. Hãy bấm Phát để bắt đầu nghe.');
          }
          return;
        }
        startIframeFallback();
      });
    } else if (window.YT && window.YT.Player) {
      playCurrentSong();
    } else {
      window.onYouTubeIframeAPIReady = playCurrentSong;
    }
    return () => {
      isCurrentPlayback = false;
      audioElement?.removeEventListener('error', startIframeFallback);
      if (window.onYouTubeIframeAPIReady === playCurrentSong) {
        window.onYouTubeIframeAPIReady = null;
      }
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch (error) {
          console.error('Không thể đóng trình phát YouTube:', error);
        }
        playerRef.current = null;
      }
    };
  }, [currentSong?.id]);

  useEffect(() => {
    if (!currentSong || currentSong.type !== 'youtube' || !showVideo || videoError) return;
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
            controls: 0,
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
              event.target.mute();
              event.target.setPlaybackRate(playbackRate);
              const audioTime = nativeAudioRef.current?.currentTime || currentTimeRef.current;
              if (audioTime > 0) event.target.seekTo(audioTime, true);
              if (showVideoRef.current && isPlayingRef.current) event.target.playVideo();
              else event.target.pauseVideo();
              setDuration(event.target.getDuration() || 0);
            },
            onStateChange: (event) => {
              if (videoPlayerSongRef.current !== songId) return;
              const audio = nativeAudioRef.current;
              if (event.data === window.YT.PlayerState.PLAYING) {
                if (!showVideoRef.current) {
                  event.target.pauseVideo();
                  return;
                }
                if (!isPlayingRef.current) {
                  event.target.pauseVideo();
                  return;
                }
                if (audio?.src) {
                  if (audio.paused) {
                    audio.play().catch((error) => {
                      console.error('Không thể đồng bộ âm thanh với video:', error);
                    });
                  }
                }
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                if (isPlayingRef.current && showVideoRef.current) {
                  event.target.playVideo();
                }
              } else if (event.data === window.YT.PlayerState.BUFFERING) {
                return;
              } else if (event.data === window.YT.PlayerState.ENDED) {
                if (audio?.ended) handleAutoNext();
              }
            },
            onPlaybackRateChange: (event) => {
              if (videoPlayerSongRef.current !== songId || !showVideoRef.current) return;
              if (!SPEED_RATES.includes(event.data)) return;
              if (nativeAudioRef.current) nativeAudioRef.current.playbackRate = event.data;
              setPlaybackRate(event.data);
            },
            onVolumeChange: (event) => {
              if (showVideoRef.current && !event.target.isMuted()) event.target.mute();
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
  }, [currentSong?.id, currentSong?.type, showVideo, videoError]);

  useEffect(() => {
    if (!currentSong || currentSong.type !== 'youtube' || !videoPlayerReadyRef.current) return;
    if (showVideo) {
      const audioTime = nativeAudioRef.current?.currentTime || currentTimeRef.current;
      if (audioTime > 0) videoPlayerRef.current.seekTo(audioTime, true);
      videoPlayerRef.current.mute();
      if (isPlaying) videoPlayerRef.current.playVideo();
      else videoPlayerRef.current.pauseVideo();
    } else {
      videoPlayerRef.current.pauseVideo();
    }
  }, [currentSong?.id, isPlaying, showVideo]);

  useEffect(() => {
    if (!showVideo || !videoPlayerReadyRef.current || !currentSong || currentSong.type !== 'youtube') return;
    try {
      videoPlayerRef.current.setPlaybackRate(playbackRate);
    } catch (error) {
      console.error('Không thể đổi tốc độ video YouTube:', error);
    }
  }, [playbackRate, showVideo, currentSong?.id, currentSong?.type]);

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
        let cur = 0;
        let dur = 0;
        const mediaElement = currentSong?.type === 'tiktok'
          ? tiktokVideoRef.current
          : showVideo && videoPlayerReadyRef.current
            ? null
            : nativeAudioRef.current;

        if (mediaElement && Number.isFinite(mediaElement.duration) && mediaElement.duration > 0) {
          cur = mediaElement.currentTime || 0;
          dur = mediaElement.duration;
        } else if (showVideo && videoPlayerReadyRef.current && videoPlayerRef.current?.getCurrentTime) {
          const audio = nativeAudioRef.current;
          const video = videoPlayerRef.current;
          const videoTime = video.getCurrentTime() || 0;

          if (audio?.src && Number.isFinite(audio.duration) && audio.duration > 0) {
            cur = audio.currentTime || 0;
            dur = audio.duration;
            if (video.getPlayerState() === window.YT?.PlayerState.PLAYING && Math.abs(videoTime - cur) > 0.5) {
              video.seekTo(cur, true);
            }
            if (isPlaying && audio.paused) {
              audio.play().catch((error) => {
                console.error('Không thể đồng bộ âm thanh với video:', error);
              });
            }
          } else {
            cur = videoTime;
            dur = video.getDuration() || 0;
          }
        } else if (playerRef.current && playerRef.current.getCurrentTime) {
          cur = playerRef.current.getCurrentTime() || 0;
          dur = playerRef.current.getDuration() || 0;
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
  }, [isPlaying, showVideo, showRecommendPopup, dismissedRecommend, songs, currentSong]);

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

  const executeSearch = async (searchKeyword, saveToHistory = true, isRecommendation = false) => {
    const term = searchKeyword || query;
    if (!term || !term.trim()) return;

    if (extractYouTubeId(term) || isTikTokUrl(term)) {
      handlePlayFromLink(term);
      setQuery('');
      return;
    }

    const cleanTerm = term.trim().toLowerCase();
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
      const cachedData = searchCacheRef.current.get(cleanTerm);
      if (Array.isArray(cachedData) && cachedData.length > 0) {
        setSearchError('');
        updateSongListAndActiveIndex(cachedData);
        setLoading(false);
        return;
      }
    }

    setSearchError('');
    setLoading(true);
    if (searchAbortControllerRef.current) searchAbortControllerRef.current.abort();
    const controller = new AbortController();
    searchAbortControllerRef.current = controller;

    try {
      const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(term)}&limit=30`, {
        signal: controller.signal
      });
      const resJson = await response.json();
      if (!response.ok) {
        throw new Error(resJson.error || `Máy chủ tìm kiếm trả về lỗi ${response.status}`);
      }
      const resultList = Array.isArray(resJson) ? resJson : (resJson.songs || resJson.data || []);
      const songList = Array.isArray(resultList)
        ? resultList.map((song) => ({ ...song, type: song.type || 'youtube' }))
        : [];

      if (Array.isArray(songList) && songList.length > 0) {
        searchCacheRef.current.set(cleanTerm, songList);
        updateSongListAndActiveIndex(songList);
      } else {
        setSongs([]);
        setCurrentIndex(-1);
        setSearchError('Không tìm thấy video phù hợp. Thử từ khóa khác nhé.');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Lỗi tìm kiếm video:', error);
        setSearchError(error.message === 'Failed to fetch'
          ? 'Không kết nối được backend. Hãy chạy server và kiểm tra VITE_API_BASE.'
          : (error.message || 'Không thể tìm kiếm video. Hãy kiểm tra kết nối backend.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const playSong = (index, songList = songs) => {
    const selectedSong = songList[index];
    if (!selectedSong) return;
    setPlaybackError('');
    setIsUsingIframeAudio(false);
    const mediaElement = selectedSong.type === 'tiktok'
      ? tiktokVideoRef.current
      : nativeAudioRef.current;
    audioDSP.initAudioContext(mediaElement);
    audioDSP.resumeAudioContext();
    if (songList !== songs) setSongs(songList);
    setCurrentSong(selectedSong);
    setCurrentIndex(index);
    setIsPlaying(true);
    audioDSP.resumeAudioContext();
  };

  const handleShufflePlay = (songList = displayedSongs) => {
    if (!songList || songList.length === 0) return;
    playSong(Math.floor(Math.random() * songList.length), songList);
  };

  const toggleVideo = () => {
    setShowVideo(!showVideo);
  };

  const togglePlayPause = () => {
    const mediaElement = currentSong?.type === 'tiktok'
      ? tiktokVideoRef.current
      : nativeAudioRef.current;
    audioDSP.initAudioContext(mediaElement);
    audioDSP.resumeAudioContext();
    setPlaybackError('');

    if (currentSong?.type === 'tiktok' && tiktokVideoRef.current) {
      if (isPlaying) {
        tiktokVideoRef.current.pause();
        setIsPlaying(false);
      } else {
        tiktokVideoRef.current.play();
        setIsPlaying(true);
      }
      return;
    }

    if (isPlaying) {
      if (nativeAudioRef.current) {
        nativeAudioRef.current.pause();
      }
      if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
        try { playerRef.current.pauseVideo(); } catch (e) { }
      }
      if (videoPlayerReadyRef.current && typeof videoPlayerRef.current?.pauseVideo === 'function') {
        videoPlayerRef.current.pauseVideo();
      }
      setIsPlaying(false);
    } else {
      let hasPlayed = false;

      if (nativeAudioRef.current && nativeAudioRef.current.src) {
        nativeAudioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch((error) => {
          if (error.name === 'NotAllowedError') {
            setIsPlaying(false);
            setPlaybackError('Trình duyệt chặn phát âm thanh. Hãy bấm Phát để thử lại.');
            return;
          }
          if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
            try { playerRef.current.playVideo(); } catch (e) { }
            setIsPlaying(true);
          }
        });
        hasPlayed = true;
      }

      if (showVideo && videoPlayerReadyRef.current && typeof videoPlayerRef.current?.playVideo === 'function') {
        const audioTime = nativeAudioRef.current?.currentTime || currentTimeRef.current;
        videoPlayerRef.current.mute();
        if (audioTime > 0) videoPlayerRef.current.seekTo(audioTime, true);
        videoPlayerRef.current.playVideo();
        hasPlayed = true;
      }

      if (!hasPlayed && playerRef.current && typeof playerRef.current.playVideo === 'function') {
        try { playerRef.current.playVideo(); } catch (e) { }
        setIsPlaying(true);
      } else {
        setIsPlaying(true);
      }
    }
  };

  const handleNext = () => {
    if (songs.length === 0) return;
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % songs.length;
    setCurrentSong(songs[nextIndex]);
    setCurrentIndex(nextIndex);
  };

  const handlePrev = () => {
    if (songs.length === 0) return;
    const previousIndex = currentIndex < 0 ? songs.length - 1 : (currentIndex - 1 + songs.length) % songs.length;
    setCurrentSong(songs[previousIndex]);
    setCurrentIndex(previousIndex);
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (currentSong?.type === 'tiktok' && tiktokVideoRef.current) {
      tiktokVideoRef.current.currentTime = time;
    } else {
      if (nativeAudioRef.current?.src) nativeAudioRef.current.currentTime = time;
      if (showVideo && videoPlayerReadyRef.current && videoPlayerRef.current?.seekTo) {
        videoPlayerRef.current.seekTo(time, true);
      } else if (playerRef.current?.seekTo) {
        playerRef.current.seekTo(time, true);
      }
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setVolume(val);
    if (currentSong?.type === 'tiktok' && tiktokVideoRef.current) {
      tiktokVideoRef.current.volume = val / 100;
    }
    if (nativeAudioRef.current) nativeAudioRef.current.volume = val / 100;
    if (playerRef.current && playerRef.current.setVolume) playerRef.current.setVolume(val);
  };

  const changeSpeed = (rate) => {
    const numericRate = parseFloat(Number(rate).toFixed(2));
    setPlaybackRate(numericRate);
    setShowSpeedMenu(false);

    if (currentSong?.type === 'tiktok' && tiktokVideoRef.current) {
      tiktokVideoRef.current.playbackRate = numericRate;
    }
    if (nativeAudioRef.current) {
      nativeAudioRef.current.playbackRate = numericRate;
    }
    if (videoPlayerReadyRef.current && typeof videoPlayerRef.current?.setPlaybackRate === 'function') {
      try {
        videoPlayerRef.current.setPlaybackRate(numericRate);
      } catch (error) {
        console.error('Không thể đổi tốc độ video YouTube:', error);
      }
    }
    if (playerRef.current && typeof playerRef.current.setPlaybackRate === 'function') {
      try {
        playerRef.current.setPlaybackRate(numericRate);
      } catch (e) { }
    }
  };

  const displayedSongs = activeTab === 'favorites' ? favorites : songs;

  return (
    <div
      className={`app-container ${theme}`}
      style={{ '--led-opacity': ledBrightness / 100 }}
    >
      <audio
        ref={nativeAudioRef}
        crossOrigin="anonymous"
        onEnded={handleAutoNext}
        onPlay={() => {
          setIsPlaying(true);
          setPlaybackError('');
        }}
        onPause={() => setIsPlaying(false)}
        style={{ display: 'none' }}
      />

      <Background activeBackground={activeBackground} />

      <SidebarMenu
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        songsCount={songs.length}
        favoritesCount={favorites.length}
        playlistsCount={playlists.length}
        handleGoHome={handleGoHome}
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
        toggleTheme={toggleTheme}
        setSidebarOpen={setSidebarOpen}
        handlePlayFromLink={handlePlayFromLink}
        cardAnimation={cardAnimation}
        setCardAnimation={setCardAnimation}
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
        <div className={`video-container-wrapper ${showVideo ? 'visible' : 'hidden'} ${isUsingIframeAudio ? 'iframe-audio-fallback' : ''}`}>
          <div
            className="video-glass-box glass-card video-player-frame"
            style={{
              ...(videoFrameStyle || {}),
              ...(currentSong?.type === 'youtube'
                ? { width: '100%', maxWidth: `${VIDEO_SIZE_WIDTHS[videoSize]}px` }
                : {})
            }}
          >
            {currentSong?.type === 'tiktok' ? (
              <video
                ref={tiktokVideoRef}
                key={currentSong.id}
                src={currentSong.videoUrl}
                crossOrigin="anonymous"
                controls
                autoPlay
                playsInline
                onEnded={handleAutoNext}
                onLoadedMetadata={(event) => {
                  const { videoWidth, videoHeight } = event.currentTarget;
                  if (!videoWidth || !videoHeight) return;
                  const aspectRatio = videoWidth / videoHeight;
                  const width = Math.min(
                    680,
                    window.innerWidth - 48,
                    window.innerHeight * 0.72 * aspectRatio
                  );
                  setVideoFrameStyle({
                    width: `${Math.max(220, width)}px`,
                    aspectRatio: `${videoWidth} / ${videoHeight}`
                  });
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '14px' }}
              />
            ) : videoError && currentSong ? (
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
                <div
                  ref={youtubePlayerMountRef}
                  className="video-poster"
                  role="img"
                  aria-label={currentSong?.title || 'Ảnh bìa bài hát'}
                  style={{
                    backgroundImage: `url("${currentSong?.thumbnail || `https://img.youtube.com/vi/${currentSong?.id}/hqdefault.jpg`}")`
                  }}
                />
                {currentSong && (
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
            isUsingIframeAudio={isUsingIframeAudio}
            playbackError={playbackError}
            />
        )}

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
        setBackgroundPlay={setBackgroundPlay}
        autoPlay={autoPlay}
        setAutoPlay={setAutoPlay}
        showVideo={showVideo}
        toggleVideo={toggleVideo}
        videoSize={videoSize}
        setVideoSize={setVideoSize}
        canResizeVideo={currentSong?.type === 'youtube'}
        playbackRate={playbackRate}
        showSpeedMenu={showSpeedMenu}
        setShowSpeedMenu={setShowSpeedMenu}
        changeSpeed={changeSpeed}
        volume={volume}
        handleVolumeChange={handleVolumeChange}
      />
    </div>
  );
}

export default App;
