import { useState, useRef, useEffect } from 'react';
import './App.css';
import './responsive.css';
import { API_BASE, HOT_TIKTOK_KEYWORDS, extractYouTubeId, formatTime } from './constants';
import { Background } from './Background';
import { HeaderNav } from './HeaderNav';
import { SidebarMenu } from './SidebarMenu';
import { SongCard, RecommendPopup } from './SongGrid';
import { PlayerDock } from './PlayerDock';
import { CustomMediaManager, PlaylistManager, QueueManager } from './Managers';
import { AudioManager } from './AudioManager';
import { useAudioDSP } from './useAudioDSP';

const getSafeArray = (key, fallback = []) => {
  try {
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    const parsed = JSON.parse(item);
    if (!Array.isArray(parsed)) return fallback;
    return parsed.filter((x) => x && typeof x === 'object' && x.id);
  } catch (e) {
    return fallback;
  }
};

const getSafeStorage = (key, fallback) => {
  try {
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    return JSON.parse(item);
  } catch (e) {
    return fallback;
  }
};

const isTikTokUrl = (url) => {
  return /(tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com)/i.test(url);
};

const DB_NAME = 'ChuongMusicDB';
const STORE_NAME = 'custom_media';

const initDB = () => {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
};

const saveMediaDB = async (item) => {
  const db = await initDB();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(item);
  } catch (e) {}
};

const getAllMediaDB = async () => {
  const db = await initDB();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch (e) {
      resolve([]);
    }
  });
};

const deleteMediaDB = async (id) => {
  const db = await initDB();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
  } catch (e) {}
};

function App() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('✨ Đang gợi ý các bài hát HOT Trend TikTok...');
  const [currentSearchTitle, setCurrentSearchTitle] = useState('✨ Đang gợi ý các bài hát HOT Trend TikTok');
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [playbackRate, setPlaybackRate] = useState(1.0);
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

  const [theme, setTheme] = useState('light');
  const [ledEnabled, setLedEnabled] = useState(true);
  const [ledMode, setLedMode] = useState(() => localStorage.getItem('liquid_led_mode') || 'ltr');
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
    return getSafeStorage('liquid_bgplay', true);
  });

  useEffect(() => {
    localStorage.setItem('liquid_bgplay', JSON.stringify(backgroundPlay));
  }, [backgroundPlay]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !backgroundPlay && isPlaying) {
        if (nativeAudioRef.current && !nativeAudioRef.current.paused) {
          nativeAudioRef.current.pause();
        }
        if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
          try { playerRef.current.pauseVideo(); } catch (e) { }
        }
        setIsPlaying(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [backgroundPlay, isPlaying]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  const [searchHistory, setSearchHistory] = useState(() => getSafeStorage('liquid_search_history', []));
  const [favorites, setFavorites] = useState(() => getSafeArray('liquid_favs', []));
  const [playlists, setPlaylists] = useState(() => getSafeStorage('liquid_playlists', [{ id: 'p1', name: 'Nhạc Chill Đêm Khuya', songs: [] }]));
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);

  const [autoPlay, setAutoPlay] = useState(() => getSafeStorage('liquid_autoplay', true));
  const [playHistory, setPlayHistory] = useState(() => getSafeArray('liquid_history', []));

  const [showRecommendPopup, setShowRecommendPopup] = useState(false);
  const [nextSongToPlay, setNextSongToPlay] = useState(null);
  const [dismissedRecommend, setDismissedRecommend] = useState(false);

  const [showVideo, setShowVideo] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const [customMediaList, setCustomMediaList] = useState([]);

  const [activeBackground, setActiveBackground] = useState(() => getSafeStorage('liquid_active_bg', null));

  const fileInputRef = useRef(null);
  const playerRef = useRef(null);
  const nativeAudioRef = useRef(null);
  const tiktokVideoRef = useRef(null);
  const timerRef = useRef(null);

  const currentSong = currentIndex >= 0 && currentIndex < songs.length ? songs[currentIndex] : null;

  const destroyYTPlayer = () => {
    if (playerRef.current) {
      try {
        if (typeof playerRef.current.destroy === 'function') {
          playerRef.current.destroy();
        }
      } catch (e) {}
      playerRef.current = null;
    }
  };

  useEffect(() => {
    localStorage.removeItem('liquid_custom_media');
    getAllMediaDB().then((items) => {
      if (Array.isArray(items)) {
        const listWithUrls = items.map((item) => ({
          ...item,
          url: item.file ? URL.createObjectURL(item.file) : item.url
        }));
        setCustomMediaList(listWithUrls);
      }
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
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const saveToSearchHistory = (term) => {
    if (!term || !term.trim()) return;
    const cleanTerm = term.trim();
    setSearchHistory((prev) => {
      const updated = [cleanTerm, ...prev.filter((item) => typeof item === 'string' && item.toLowerCase() !== cleanTerm.toLowerCase())].slice(0, 10);
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
      try { indexedDB.deleteDatabase(DB_NAME); } catch (e) {}
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

  const handlePlayFromLink = async (url) => {
    if (!url || !url.trim()) return;
    const cleanUrl = url.trim();

    try {
      if (isTikTokUrl(cleanUrl)) {
        setLoading(true);
        setLoadingText('⏳ Đang tải video TikTok...');

        try {
          const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}`);
          if (!res.ok) throw new Error("Lỗi kết nối TikWM");
          const json = await res.json();

          if (json.code === 0 && json.data) {
            const data = json.data;
            const songId = `tiktok_${data.id || Date.now()}`;
            const newSong = {
              id: songId,
              type: 'tiktok',
              tiktokVideoId: data.id,
              videoUrl: data.play || '',
              musicUrl: data.music || '',
              title: data.title || 'Video TikTok',
              artist: data.author?.nickname ? `@${data.author.nickname}` : 'TikTok Creator',
              thumbnail: data.cover || '',
              duration: formatTime(data.duration || 0)
            };

            destroyYTPlayer();
            setSongs((prev) => [newSong, ...prev.filter((s) => s && s.id !== songId)]);
            setCurrentIndex(0);
            setIsPlaying(true);
            setShowVideo(true);
            setActiveTab('home');
          } else {
            alert('Không thể lấy video từ link TikTok này. Bạn hãy kiểm tra lại link nhé!');
          }
        } catch (err) {
          console.error('Lỗi TikWM API:', err);
          alert('Lỗi kết nối khi tải video TikTok!');
        } finally {
          setLoading(false);
        }
        return;
      }

      const ytId = extractYouTubeId(cleanUrl);
      if (ytId) {
        let songTitle = 'Bài hát từ YouTube Link';
        let artistName = 'YouTube';

        try {
          const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${ytId}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.title) {
              songTitle = data.title;
              artistName = data.author_name || 'YouTube Source';
            }
          }
        } catch (err) {}

        const newSong = {
          id: ytId,
          type: 'youtube',
          title: songTitle,
          artist: artistName,
          thumbnail: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
          duration: '--:--'
        };

        destroyYTPlayer();
        setSongs((prev) => [newSong, ...prev.filter((s) => s && s.id !== ytId)]);
        setCurrentIndex(0);
        setIsPlaying(true);
        setShowVideo(true);
        setActiveTab('home');
        return;
      }

      alert('Vui lòng dán link YouTube hoặc TikTok hợp lệ!');
    } catch (globalErr) {
      console.error("Lỗi xử lý link:", globalErr);
      alert("Đã xảy ra lỗi khi xử lý link!");
    }
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
        return { ...pl, songs: (pl.songs || []).filter((s) => s && s.id !== songId) };
      }
      return pl;
    });
    setPlaylists(updated);
    localStorage.setItem('liquid_playlists', JSON.stringify(updated));
  };

  const toggleFavorite = (song, e) => {
    if (e) e.stopPropagation();
    if (!song || !song.id) return;
    setFavorites((prev) => {
      const exists = prev.some((f) => f && f.id === song.id);
      const updated = exists ? prev.filter((f) => f && f.id !== song.id) : [...prev, song];
      localStorage.setItem('liquid_favs', JSON.stringify(updated));
      return updated;
    });
  };

  const isFav = (songId) => favorites.some((f) => f && f.id === songId);

  const getSmartRecommendation = () => {
    if (!songs || songs.length === 0) return null;
    const validSongs = songs.filter(Boolean);
    if (validSongs.length <= 1) return validSongs[0] || null;
    const candidateSongs = validSongs.filter((s, idx) => idx !== currentIndex);
    return candidateSongs[0] || validSongs[(currentIndex + 1) % validSongs.length];
  };

  useEffect(() => {
    if (currentSong) {
      setDismissedRecommend(false);
      setShowRecommendPopup(false);
      setPlayHistory((prev) => {
        const validPrev = Array.isArray(prev) ? prev.filter(Boolean) : [];
        const updated = [currentSong, ...validPrev.filter((s) => s.id !== currentSong.id)].slice(0, 40);
        localStorage.setItem('liquid_history', JSON.stringify(updated));
        return updated;
      });
    }
  }, [currentIndex]);

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      }
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

  useEffect(() => {
    if (!currentSong || !currentSong.id) return;
    setVideoError(false);

    if (currentSong.type === 'tiktok') {
      destroyYTPlayer();
      if (nativeAudioRef.current) {
        nativeAudioRef.current.pause();
        nativeAudioRef.current.src = '';
      }
      setShowVideo(true);
      setIsPlaying(true);
      if (tiktokVideoRef.current) {
        tiktokVideoRef.current.play().catch(() => { });
      }
      return;
    }

    if (nativeAudioRef.current) {
      nativeAudioRef.current.src = `${API_BASE}/stream?id=${currentSong.id}`;
      nativeAudioRef.current.playbackRate = playbackRate;
      nativeAudioRef.current.volume = volume / 100;

      nativeAudioRef.current.play().then(() => {
        setIsPlaying(true);
        audioDSP.initAudioContext(nativeAudioRef.current);
        audioDSP.resumeAudioContext();
      }).catch(() => {
        if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
          try {
            playerRef.current.loadVideoById({ videoId: currentSong.id, startSeconds: 0 });
            playerRef.current.playVideo();
          } catch (e) {}
        }
      });
    }

    const playCurrentSong = () => {
      try {
        if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
          playerRef.current.loadVideoById({ videoId: currentSong.id, startSeconds: 0 });
          if (typeof playerRef.current.playVideo === 'function') playerRef.current.playVideo();
          setIsPlaying(true);
        } else if (window.YT && window.YT.Player) {
          const ytContainer = document.getElementById('yt-player-instance');
          if (!ytContainer) return;

          playerRef.current = new window.YT.Player('yt-player-instance', {
            height: '100%',
            width: '100%',
            videoId: currentSong.id,
            playerVars: { autoplay: 1, controls: 1, modestbranding: 1, rel: 0, origin: window.location.origin },
            events: {
              onReady: (event) => {
                try {
                  event.target.setVolume(volume);
                  event.target.setPlaybackRate(playbackRate);
                  event.target.playVideo();
                  setIsPlaying(true);
                } catch (e) {}
              },
              onStateChange: (event) => {
                try {
                  if (event.data === window.YT.PlayerState.PLAYING) {
                    setIsPlaying(true);
                    if (playerRef.current && typeof playerRef.current.getDuration === 'function') {
                      setDuration(playerRef.current.getDuration() || 0);
                    }
                  } else if (event.data === window.YT.PlayerState.PAUSED) {
                    setIsPlaying(false);
                  } else if (event.data === window.YT.PlayerState.ENDED) {
                    handleAutoNext();
                  }
                } catch (e) {}
              },
              onError: () => setVideoError(true)
            }
          });
        }
      } catch (err) {
        setVideoError(true);
      }
    };

    if (window.YT && window.YT.Player) playCurrentSong();
    else window.onYouTubeIframeAPIReady = playCurrentSong;
  }, [currentSong?.id]);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        try {
          if (currentSong?.type === 'tiktok' && tiktokVideoRef.current) {
            const cur = tiktokVideoRef.current.currentTime || 0;
            const dur = tiktokVideoRef.current.duration || 0;
            setCurrentTime(cur);
            setDuration(dur);
          } else if (nativeAudioRef.current && nativeAudioRef.current.duration) {
            const cur = nativeAudioRef.current.currentTime || 0;
            const dur = nativeAudioRef.current.duration || 0;
            setCurrentTime(cur);
            setDuration(dur);
            const remaining = dur - cur;

            if (remaining <= 30 && remaining > 0 && !showRecommendPopup && !dismissedRecommend && songs.length > 0) {
              const recommended = getSmartRecommendation();
              if (recommended) {
                setNextSongToPlay(recommended);
                setShowRecommendPopup(true);
              }
            }
          } else if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
            const cur = playerRef.current.getCurrentTime() || 0;
            const dur = playerRef.current.getDuration() || 0;
            setCurrentTime(cur);
            setDuration(dur);
          }
        } catch (e) {}
      }, 500);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, showRecommendPopup, dismissedRecommend, songs, currentSong]);

  const handleAutoNext = () => {
    if (!autoPlay || songs.length === 0) return;
    if (nextSongToPlay) {
      const targetIdx = songs.findIndex((s) => s && s.id === nextSongToPlay.id);
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
      const validList = Array.isArray(newList) ? newList.filter((s) => s && s.id) : [];
      setSongs(validList);
      if (currentSong) {
        const foundIndex = validList.findIndex((s) => s && s.id === currentSong.id);
        setCurrentIndex(foundIndex);
      } else {
        setCurrentIndex(-1);
      }
    };

    if (!isRecommendation && searchCacheRef.current.has(cleanTerm)) {
      const cachedData = searchCacheRef.current.get(cleanTerm);
      if (Array.isArray(cachedData) && cachedData.length > 0) {
        updateSongListAndActiveIndex(cachedData);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    if (searchAbortControllerRef.current) searchAbortControllerRef.current.abort();
    const controller = new AbortController();
    searchAbortControllerRef.current = controller;

    try {
      const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(term)}&limit=30`, {
        signal: controller.signal
      });
      const resJson = await response.json();
      let songList = Array.isArray(resJson) ? resJson : (resJson.songs || resJson.data || []);

      if (Array.isArray(songList) && songList.length > 0) {
        searchCacheRef.current.set(cleanTerm, songList);
        updateSongListAndActiveIndex(songList);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const playSong = (index, songList = songs) => {
    if (songList !== songs) setSongs(songList);
    setCurrentIndex(index);
    setIsPlaying(true);
    audioDSP.resumeAudioContext();
  };

  const handleShufflePlay = (songList = displayedSongs) => {
    if (!songList || songList.length === 0) return;
    playSong(Math.floor(Math.random() * songList.length), songList);
  };

  const togglePlayPause = () => {
    audioDSP.resumeAudioContext();

    if (currentSong?.type === 'tiktok' && tiktokVideoRef.current) {
      if (isPlaying) {
        tiktokVideoRef.current.pause();
        setIsPlaying(false);
      } else {
        tiktokVideoRef.current.play().catch(() => {});
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
      setIsPlaying(false);
    } else {
      let hasPlayed = false;

      if (nativeAudioRef.current && nativeAudioRef.current.src) {
        nativeAudioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(() => {
          if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
            try { playerRef.current.playVideo(); } catch (e) { }
            setIsPlaying(true);
          }
        });
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
    setCurrentIndex((prev) => (prev + 1) % songs.length);
  };

  const handlePrev = () => {
    if (songs.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + songs.length) % songs.length);
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (currentSong?.type === 'tiktok' && tiktokVideoRef.current) {
      tiktokVideoRef.current.currentTime = time;
    } else {
      if (nativeAudioRef.current) nativeAudioRef.current.currentTime = time;
      if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
        try { playerRef.current.seekTo(time, true); } catch (e) {}
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
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      try { playerRef.current.setVolume(val); } catch (e) {}
    }
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
    if (playerRef.current && typeof playerRef.current.setPlaybackRate === 'function') {
      try {
        playerRef.current.setPlaybackRate(numericRate);
      } catch (e) { }
    }
  };

  const displayedSongs = (activeTab === 'favorites' ? favorites : songs).filter((s) => s && s.id);

  return (
    <div
      className={`app-container ${theme}`}
      style={{ '--led-opacity': ledBrightness / 100 }}
    >
      <audio
        ref={nativeAudioRef}
        crossOrigin="anonymous"
        onEnded={handleAutoNext}
        onError={() => {
          if (autoPlay) handleAutoNext();
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        style={{ display: 'none' }}
      />

      <Background activeBackground={activeBackground} isPlaying={isPlaying} />

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
        <div className={`video-container-wrapper ${showVideo ? 'visible' : 'hidden'}`}>
          <div className={`video-glass-box glass-card ${ledEnabled ? `rgb-chase-box mode-${ledMode}` : 'no-led-border'}`} style={{ background: '#000000' }}>
            {currentSong?.type === 'tiktok' ? (
              <video
                ref={tiktokVideoRef}
                key={currentSong.id}
                src={currentSong.videoUrl}
                controls
                autoPlay
                playsInline
                referrerPolicy="no-referrer"
                onEnded={handleAutoNext}
                onError={() => {
                  if (autoPlay) handleAutoNext();
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '14px', background: '#000000', position: 'relative', zIndex: 10 }}
              />
            ) : videoError && currentSong ? (
              <iframe
                title="YouTube Fallback"
                src={`https://www.youtube-nocookie.com/embed/${currentSong.id}?autoplay=1&enablejsapi=1`}
                className="fallback-yt-iframe"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div id="yt-player-instance"></div>
            )}
          </div>
        </div>

        {activeTab === 'audio-fx' && (
          <AudioManager
            audioDSP={audioDSP}
            playbackRate={playbackRate}
            changeSpeed={changeSpeed}
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
        setShowVideo={setShowVideo}
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
