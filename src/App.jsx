import { useState, useRef, useEffect } from 'react';
import './App.css';

// TỰ ĐỘNG CHUYỂN API BASE: Nhận diện chạy Local thì dùng localhost, chạy Online thì gọi Server Render
const API_BASE = 'https://chuongmusic-sever.onrender.com/api';
const SPEED_RATES = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

const HOT_TIKTOK_KEYWORDS = [
  'nhạc hot tiktok 2026',
  'nhạc chill tiktok',
  'nhạc tiktok trend',
  'nhạc remix tiktok hot',
  'vpop hot tiktok',
  'nhạc lofi tiktok chill',
  'nhạc edm tiktok gây nghiện',
  'nhạc tâm trạng tiktok'
];

const getHighResThumbnail = (song) => {
  if (!song) return '';
  if (song.id) {
    return `https://img.youtube.com/vi/${song.id}/hqdefault.jpg`;
  }
  return song.thumbnail || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&auto=format&fit=crop&q=80';
};

function App() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const [theme, setTheme] = useState('light');
  const [ledEnabled, setLedEnabled] = useState(true);

  // QUẢN LÝ PHÁT TRONG NỀN
  const [backgroundPlay, setBackgroundPlay] = useState(() => {
    const saved = localStorage.getItem('liquid_bgplay');
    return saved !== null ? JSON.parse(saved) : true;
  });

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
    return saved ? JSON.parse(saved) : [
      { id: 'p1', name: 'Nhạc Chill Đêm Khuya', songs: [] }
    ];
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
  const [videoError, setVideoError] = useState(false);
  const [searchRenderKey, setSearchRenderKey] = useState(0);

  const [customMediaList, setCustomMediaList] = useState([]);
  const [activeBackground, setActiveBackground] = useState(null);
  const fileInputRef = useRef(null);

  const playerRef = useRef(null);
  const canvasRef = useRef(null);
  const bgCanvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const timerRef = useRef(null);

  const currentSong = currentIndex >= 0 ? songs[currentIndex] : null;

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    localStorage.setItem('liquid_bgplay', JSON.stringify(backgroundPlay));
  }, [backgroundPlay]);

  // XỬ LÝ TỰ ĐỘNG DỪNG NHẠC KHI TẮT NỀN VÀ CHUYỂN TAB
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (!backgroundPlay && isPlaying && playerRef.current && playerRef.current.pauseVideo) {
          playerRef.current.pauseVideo();
          setIsPlaying(false);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [backgroundPlay, isPlaying]);

  // CẤU HÌNH MEDIA SESSION API ĐỂ PHÁT TRÊN MÀN HÌNH KHÓA/THANH THÔNG BÁO
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentSong) return;

    if (backgroundPlay) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title || 'Bài Hát',
        artist: currentSong.artist || 'Liquid Neon',
        album: 'Liquid Neon Music',
        artwork: [
          { src: getHighResThumbnail(currentSong), sizes: '512x512', type: 'image/jpeg' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
        if (playerRef.current && playerRef.current.playVideo) {
          playerRef.current.playVideo();
          setIsPlaying(true);
        }
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        if (playerRef.current && playerRef.current.pauseVideo) {
          playerRef.current.pauseVideo();
          setIsPlaying(false);
        }
      });

      navigator.mediaSession.setActionHandler('previoustrack', handlePrev);
      navigator.mediaSession.setActionHandler('nexttrack', handleNext);
    } else {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
    }
  }, [currentSong, backgroundPlay, songs, currentIndex]);

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
    const randomKeyword = HOT_TIKTOK_KEYWORDS[randomIndex];
    executeSearch(randomKeyword, false);
  };

  const handleResetUserData = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử nghe nhạc, bài hát yêu thích và gợi ý cũ không?')) {
      localStorage.removeItem('liquid_history');
      localStorage.removeItem('liquid_favs');
      localStorage.removeItem('liquid_playlists');
      localStorage.removeItem('liquid_search_history');
      setPlayHistory([]);
      setFavorites([]);
      setSearchHistory([]);
      setPlaylists([{ id: 'p1', name: 'Nhạc Chill Đêm Khuya', songs: [] }]);
      setNextSongToPlay(null);
      setShowRecommendPopup(false);
      alert('Đã làm mới dữ liệu người dùng thành công!');
    }
  };

  useEffect(() => {
    handleRefreshRecommendations();
  }, []);

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const newMediaItems = files.map((file) => {
      let type = 'image';
      if (file.type.startsWith('video/')) {
        type = 'video';
      } else if (file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')) {
        type = 'gif';
      }

      return {
        id: Date.now() + Math.random().toString(36).substring(2, 9),
        name: file.name,
        type: type,
        url: URL.createObjectURL(file)
      };
    });

    setCustomMediaList((prev) => [...prev, ...newMediaItems]);

    if (!activeBackground && newMediaItems.length > 0) {
      setActiveBackground(newMediaItems[0]);
    }

    e.target.value = null;
  };

  const handleDeleteMedia = (idToDelete, e) => {
    if (e) e.stopPropagation();

    setCustomMediaList((prev) => {
      const itemToDelete = prev.find((item) => item.id === idToDelete);
      if (itemToDelete && itemToDelete.url) {
        URL.revokeObjectURL(itemToDelete.url);
      }
      return prev.filter((item) => item.id !== idToDelete);
    });

    if (activeBackground && activeBackground.id === idToDelete) {
      setActiveBackground(null);
    }
  };

  const createPlaylist = () => {
    if (!newPlaylistName.trim()) return;
    const newPl = {
      id: Date.now().toString(),
      name: newPlaylistName,
      songs: []
    };
    const updated = [...playlists, newPl];
    setPlaylists(updated);
    localStorage.setItem('liquid_playlists', JSON.stringify(updated));
    setNewPlaylistName('');
  };

  const deletePlaylist = (playlistId, e) => {
    if (e) e.stopPropagation();
    if (window.confirm('Bạn có chắc chắn muốn xóa Playlist này không?')) {
      const updated = playlists.filter((pl) => pl.id !== playlistId);
      setPlaylists(updated);
      localStorage.setItem('liquid_playlists', JSON.stringify(updated));
      if (selectedPlaylistId === playlistId) setSelectedPlaylistId(null);
    }
  };

  const addSongToPlaylist = (song, playlistId) => {
    if (!playlistId) return;
    const updated = playlists.map((pl) => {
      if (pl.id === playlistId) {
        if (pl.songs.some((s) => s.id === song.id)) {
          alert('Bài hát đã có trong Playlist này!');
          return pl;
        }
        alert(`Đã thêm "${song.title}" vào Playlist!`);
        return { ...pl, songs: [...pl.songs, song] };
      }
      return pl;
    });
    setPlaylists(updated);
    localStorage.setItem('liquid_playlists', JSON.stringify(updated));
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

  useEffect(() => {
    localStorage.setItem('liquid_favs', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('liquid_autoplay', JSON.stringify(autoPlay));
  }, [autoPlay]);

  const toggleFavorite = (song, e) => {
    if (e) e.stopPropagation();
    setFavorites(prev => {
      const exists = prev.some(f => f.id === song.id);
      if (exists) return prev.filter(f => f.id !== song.id);
      return [...prev, song];
    });
  };

  const isFav = (songId) => favorites.some(f => f.id === songId);

  const formatTime = (secs) => {
    if (isNaN(secs) || secs === 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getSmartRecommendation = () => {
    if (!songs || songs.length === 0) return null;
    if (songs.length === 1) return songs[0];

    const artistScore = {};
    playHistory.forEach((s) => {
      if (s.artist) {
        artistScore[s.artist] = (artistScore[s.artist] || 0) + 1;
      }
    });

    const candidateSongs = songs.filter((_, idx) => idx !== currentIndex);

    candidateSongs.sort((a, b) => {
      const scoreA = artistScore[a.artist] || 0;
      const scoreB = artistScore[b.artist] || 0;
      return scoreB - scoreA;
    });

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
  }, [currentIndex]);

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/suggestions?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSuggestions(data);
      } catch (err) {
        setSuggestions([]);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!currentSong) return;
    setVideoError(false);

    const initPlayer = () => {
      try {
        if (playerRef.current && playerRef.current.loadVideoById) {
          playerRef.current.loadVideoById({ videoId: currentSong.id });
        } else {
          playerRef.current = new window.YT.Player('yt-player-instance', {
            height: '100%',
            width: '100%',
            videoId: currentSong.id,
            playerVars: {
              autoplay: 1,
              controls: 1,
              modestbranding: 1,
              rel: 0,
              origin: window.location.origin
            },
            events: {
              onReady: (event) => {
                event.target.setVolume(volume);
                event.target.setPlaybackRate(playbackRate);
                event.target.playVideo();
                setIsPlaying(true);
              },
              onStateChange: (event) => {
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
                setVideoError(true);
              }
            }
          });
        }
      } catch (err) {
        setVideoError(true);
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }
  }, [currentIndex]);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        if (playerRef.current && playerRef.current.getCurrentTime) {
          const cur = playerRef.current.getCurrentTime() || 0;
          const dur = playerRef.current.getDuration() || 0;
          setCurrentTime(cur);
          setDuration(dur);

          const remaining = dur - cur;

          if (remaining <= 30 && remaining > 0 && !showRecommendPopup && !dismissedRecommend && songs.length > 0) {
            const recommended = getSmartRecommendation();
            if (recommended) {
              setNextSongToPlay(recommended);
              setShowRecommendPopup(true);
            }
          } else if (remaining > 30 && showRecommendPopup) {
            setShowRecommendPopup(false);
          }
        }
      }, 500);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, showRecommendPopup, dismissedRecommend, songs]);

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

  // GIỮ HIỆU ỨNG HẠT NỀN LUNG LINH (TỰ ĐIỀU CHỈNH 15 HẠT CHO MOBILE, 40 HẠT CHO DESKTOP)
  useEffect(() => {
    if (activeBackground) return;

    const canvas = bgCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const colors = ['#00f2fe', '#ff007f', '#38ef7d', '#ffb100', '#9900ff'];
    const particleCount = window.innerWidth < 768 ? 15 : 40;

    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 2 + 1,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      alpha: Math.random() * 0.5 + 0.3,
      pulseSpeed: Math.random() * 0.02 + 0.008,
    }));

    const renderBg = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        const speed = isPlaying ? 1.2 : 0.6;
        p.x += p.vx * speed;
        p.y += p.vy * speed;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        p.alpha += Math.sin(Date.now() * p.pulseSpeed) * 0.01;
        const currentAlpha = Math.max(0.15, Math.min(0.75, p.alpha));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 2, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = currentAlpha * 0.2;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = currentAlpha;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });

      animationFrameId = requestAnimationFrame(renderBg);
    };

    renderBg();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, activeBackground]);

  // VISUALIZER CANVAS SÓNG NHẠC
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const bars = window.innerWidth < 768 ? 16 : 26;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = canvas.width / bars;

      for (let i = 0; i < bars; i++) {
        const height = isPlaying
          ? Math.random() * (canvas.height - 4) + 4
          : 3;

        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        if (theme === 'dark') {
          gradient.addColorStop(0, '#00f2fe');
          gradient.addColorStop(0.5, '#38ef7d');
          gradient.addColorStop(1, '#ff007f');
        } else {
          gradient.addColorStop(0, '#ff0844');
          gradient.addColorStop(0.5, '#ff4e50');
          gradient.addColorStop(1, '#f9d423');
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(i * barWidth, canvas.height - height, barWidth - 2, height, [3, 3, 0, 0]);
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, theme]);

  const executeSearch = async (searchKeyword, saveToHistory = true) => {
    const term = searchKeyword || query;
    if (!term.trim()) return;

    if (saveToHistory) {
      saveToSearchHistory(term);
    }

    setShowSuggestions(false);
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(term)}&limit=30`);
      const data = await response.json();
      setSongs(data);
      if (data.length > 0) setCurrentIndex(-1);
      setActiveTab('home');
      setSearchRenderKey(prev => prev + 1);
    } catch (error) {
      alert('Không kết nối được Backend!');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    executeSearch();
  };

  const playSong = (index, songList = songs) => {
    if (songList !== songs) setSongs(songList);
    setCurrentIndex(index);
    setIsPlaying(true);
  };

  const togglePlayPause = () => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
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
    if (playerRef.current && playerRef.current.seekTo) {
      playerRef.current.seekTo(time, true);
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setVolume(val);
    if (playerRef.current && playerRef.current.setVolume) {
      playerRef.current.setVolume(val);
    }
  };

  const changeSpeed = (rate) => {
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
    if (playerRef.current && playerRef.current.setPlaybackRate) {
      playerRef.current.setPlaybackRate(rate);
    }
  };

  const getDisplayedSongs = () => {
    if (activeTab === 'favorites') return favorites;
    return songs;
  };

  const displayedSongs = getDisplayedSongs();
  const halfCount = Math.ceil(displayedSongs.length / 2);
  const remainingSeconds = Math.ceil(Math.max(0, duration - currentTime));

  return (
    <div className={`app-container ${theme}`}>
      {activeBackground ? (
        <div className="custom-bg-container">
          {activeBackground.type === 'video' ? (
            <video src={activeBackground.url} autoPlay loop muted playsInline className="custom-bg-media" />
          ) : (
            <img src={activeBackground.url} alt="Custom Background" className="custom-bg-media" />
          )}
          <div className="custom-bg-overlay" />
        </div>
      ) : (
        <>
          <canvas ref={bgCanvasRef} className="bg-particles-canvas" />
          <div className="liquid-bg">
            <div className="blob blob-1"></div>
            <div className="blob blob-2"></div>
            <div className="blob blob-3"></div>
            <div className="blob blob-4"></div>
            <div className="blob blob-5"></div>
          </div>
        </>
      )}

      {/* SIDEBAR MENU */}
      <aside className={`liquid-sidebar glass-card ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Menu</h2>
          <button className="close-btn glow-hover-btn" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>
        <nav className="sidebar-menu">
          <button
            className={`menu-item glow-hover-btn ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => { setActiveTab('home'); setSidebarOpen(false); }}
          >
            🏠 Trang chủ & Tìm kiếm
          </button>
          <button
            className={`menu-item glow-hover-btn ${activeTab === 'queue' ? 'active' : ''}`}
            onClick={() => { setActiveTab('queue'); setSidebarOpen(false); }}
          >
            📑 Danh sách chờ ({songs.length})
          </button>
          <button
            className={`menu-item glow-hover-btn ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => { setActiveTab('favorites'); setSidebarOpen(false); }}
          >
            ❤️ Yêu thích ({favorites.length})
          </button>
          <button
            className={`menu-item glow-hover-btn ${activeTab === 'playlist' ? 'active' : ''}`}
            onClick={() => { setActiveTab('playlist'); setSidebarOpen(false); }}
          >
            🎵 Playlists ({playlists.length})
          </button>
          <button
            className={`menu-item glow-hover-btn ${activeTab === 'custom-media' ? 'active' : ''}`}
            onClick={() => { setActiveTab('custom-media'); setSidebarOpen(false); }}
          >
            🖼️ Import Nền (Ảnh/GIF/Video)
          </button>
        </nav>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}

      {/* HEADER NAVBAR */}
      <header className="glass-nav">
        <div className="nav-left">
          <button className="hamburger-btn glass-card glow-hover-btn" onClick={() => setSidebarOpen(true)} title="Mở Menu">☰</button>
          <div className="brand">
            <span className="logo-icon floating-icon">🎧</span>
            <h1>Chương Music</h1>
          </div>
        </div>

        <div className="search-wrapper">
          <form onSubmit={handleSearchSubmit} className={`search-bar glass-card search-rgb ${ledEnabled ? 'rgb-chase-box' : 'no-led-border'}`}>
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
                      🗑️ Xóa lịch sử
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
            🧹 Reset All
          </button>

          <button
            className={`led-toggle-btn glass-card glow-hover-btn ${ledEnabled ? 'active' : ''}`}
            onClick={() => setLedEnabled(!ledEnabled)}
            title="Bật/Tắt LED Bo Viền"
          >
            {ledEnabled ? '🌈 LED: BẬT' : '⚪ LED: TẮT'}
          </button>

          <button className="theme-toggle glass-card glow-hover-btn" onClick={toggleTheme}>
            {theme === 'dark' ? '☀️ Sáng' : '🌙 Tối'}
          </button>
        </div>
      </header>

      {/* KHUNG VIDEO YOUTUBE */}
      <div className={`video-container-wrapper ${showVideo ? 'visible' : 'hidden'}`}>
        <div className={`video-glass-box glass-card ${ledEnabled ? 'rgb-chase-box' : 'no-led-border'}`}>
          {videoError && currentSong ? (
            <iframe
              title="YouTube Fallback Player"
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

      {/* POPUP GỢI Ý BÀI HÁT TỰ ĐỘNG */}
      {showRecommendPopup && nextSongToPlay && (
        <div className={`recommend-popup-card glass-card ${ledEnabled ? 'rgb-chase-box' : 'no-led-border'}`}>
          <div className="recommend-header">
            <span className="recommend-badge">✨ Bài Tiếp Theo ({remainingSeconds}s)</span>
            <button className="recommend-close-btn glow-hover-btn" onClick={() => { setDismissedRecommend(true); setShowRecommendPopup(false); }}>
              ✕
            </button>
          </div>

          <div className="recommend-body">
            <img
              src={getHighResThumbnail(nextSongToPlay)}
              alt={nextSongToPlay.title}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = nextSongToPlay.thumbnail || `https://img.youtube.com/vi/${nextSongToPlay.id}/mqdefault.jpg`;
              }}
            />
            <div className="recommend-info">
              <h5>{nextSongToPlay.title}</h5>
              <p>{nextSongToPlay.artist}</p>
            </div>
          </div>

          <div className="recommend-actions">
            <button
              className="play-now-btn glow-hover-btn"
              onClick={() => {
                const targetIdx = songs.findIndex((s) => s.id === nextSongToPlay.id);
                if (targetIdx !== -1) playSong(targetIdx);
                setShowRecommendPopup(false);
              }}
            >
              ▶ Phát ngay
            </button>
            <button
              className="cancel-recommend-btn glow-hover-btn"
              onClick={() => { setDismissedRecommend(true); setShowRecommendPopup(false); }}
            >
              Bỏ qua
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="main-content">
        {activeTab === 'custom-media' && (
          <div className="custom-media-manager glass-card">
            <div className="media-manager-header">
              <h2>🎨 Quản Lý Nền Tùy Chỉnh</h2>
              <p>Tải lên Ảnh, GIF động hoặc Video (MP4) để làm nền chiếu toàn màn hình</p>
            </div>

            <div className="upload-controls">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*,video/*,.gif"
                multiple
                style={{ display: 'none' }}
              />
              <button className="import-btn glow-hover-btn" onClick={() => fileInputRef.current && fileInputRef.current.click()}>
                ➕ Import Ảnh / GIF / Video
              </button>

              {activeBackground && (
                <button className="reset-bg-btn glow-hover-btn" onClick={() => setActiveBackground(null)}>
                  🔄 Gỡ Nền (Về Mặc Định)
                </button>
              )}
            </div>

            <div className="media-grid">
              {customMediaList.length === 0 ? (
                <div className="empty-media-msg">
                  <p>Chưa có tệp nền nào được tải lên. Hãy bấm nút Import ở trên!</p>
                </div>
              ) : (
                customMediaList.map((item) => {
                  const isSelected = activeBackground?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`media-card glass-card ${isSelected ? 'active-bg-card' : ''}`}
                      onClick={() => setActiveBackground(item)}
                    >
                      <div className="media-preview-box">
                        {item.type === 'video' ? (
                          <video src={item.url} muted className="preview-thumb" />
                        ) : (
                          <img src={item.url} alt={item.name} className="preview-thumb" />
                        )}
                        <span className="type-badge">{item.type.toUpperCase()}</span>
                      </div>

                      <div className="media-card-footer">
                        <span className="media-name" title={item.name}>{item.name}</span>
                        <div className="media-actions">
                          {isSelected && <span className="status-tag">Đang Chiếu</span>}
                          <button
                            className="delete-media-btn glow-hover-btn"
                            title="Xóa tệp này"
                            onClick={(e) => handleDeleteMedia(item.id, e)}
                          >
                            🗑️ Xóa
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'playlist' && (
          <div className="playlist-manager glass-card">
            <div className="tab-title-bar">
              <h2>🎵 Danh Sách Phát (Playlists)</h2>
            </div>

            <div className="create-playlist-box">
              <input
                type="text"
                placeholder="Nhập tên playlist mới..."
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
              />
              <button className="import-btn glow-hover-btn" onClick={createPlaylist}>
                ➕ Tạo Playlist
              </button>
            </div>

            <div className="playlists-list-grid">
              {playlists.map((pl) => (
                <div
                  key={pl.id}
                  className={`playlist-card glass-card ${selectedPlaylistId === pl.id ? 'active-pl' : ''}`}
                  onClick={() => setSelectedPlaylistId(selectedPlaylistId === pl.id ? null : pl.id)}
                >
                  <div className="pl-info">
                    <h3>🎧 {pl.name}</h3>
                    <p>{pl.songs.length} bài hát</p>
                  </div>
                  <div className="pl-actions">
                    <button className="glow-hover-btn toggle-songs-btn">
                      {selectedPlaylistId === pl.id ? '🔼 Thu gọn' : '🔽 Xem bài hát'}
                    </button>
                    <button
                      className="delete-pl-btn glow-hover-btn"
                      title="Xóa Playlist này"
                      onClick={(e) => deletePlaylist(pl.id, e)}
                    >
                      🗑️ Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {selectedPlaylistId && (
              <div className="playlist-songs-section">
                <h3>🎶 Các bài hát trong Playlist</h3>
                <div className="songs-grid">
                  {playlists
                    .find((p) => p.id === selectedPlaylistId)
                    ?.songs.map((song, idx) => (
                      <div
                        key={song.id}
                        className="song-card glass-card float-3d-card"
                        onClick={() => playSong(idx, playlists.find((p) => p.id === selectedPlaylistId).songs)}
                      >
                        <div className="thumb-container">
                          <img src={getHighResThumbnail(song)} alt={song.title} />
                          <div className="play-overlay">▶</div>
                        </div>
                        <div className="song-info">
                          <h3>{song.title}</h3>
                          <p>{song.artist}</p>
                        </div>
                        <button
                          className="remove-song-pl-btn glow-hover-btn"
                          title="Xóa khỏi Playlist"
                          onClick={(e) => removeSongFromPlaylist(selectedPlaylistId, song.id, e)}
                        >
                          ✕
                        </button>
                        <span className="song-duration">{song.duration}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'queue' && (
          <div className="queue-manager glass-card">
            <div className="tab-title-bar">
              <h2>📑 Hàng Chờ Phát Nhạc ({songs.length} bài)</h2>
            </div>

            {currentSong && (
              <div className="now-playing-banner glass-card rgb-chase-box">
                <span className="badge-tag">🔴 ĐANG PHÁT</span>
                <img src={getHighResThumbnail(currentSong)} alt={currentSong.title} />
                <div className="banner-info">
                  <h3>{currentSong.title}</h3>
                  <p>{currentSong.artist}</p>
                </div>
              </div>
            )}

            <div className="songs-grid">
              {songs.map((song, index) => {
                const isCurrent = currentIndex === index;
                return (
                  <div
                    key={song.id}
                    className={`song-card glass-card float-3d-card ${isCurrent ? 'active playing-rgb ' + (ledEnabled ? 'rgb-chase-box' : 'no-led-border') : ''
                      }`}
                    onClick={() => playSong(index)}
                  >
                    <div className="thumb-container">
                      <img src={getHighResThumbnail(song)} alt={song.title} />
                      <div className="play-overlay">{isCurrent && isPlaying ? '⏸' : '▶'}</div>
                    </div>
                    <div className="song-info">
                      <h3>{index + 1}. {song.title}</h3>
                      <p>{song.artist}</p>
                    </div>
                    <span className="song-duration">{song.duration}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(activeTab === 'home' || activeTab === 'favorites') && (
          <>
            <div className="tab-title-bar">
              <h2>
                {activeTab === 'favorites'
                  ? '❤️ Danh Sách Yêu Thích'
                  : `🔥 Kết Quả Tìm Kiếm (${displayedSongs.length} bài hát)`}
              </h2>
            </div>

            {loading && <p className="status-text pulse-text">⏳ Đang lấy 30 bài hát ngẫu nhiên hot nhất...</p>}

            <div className="songs-grid" key={searchRenderKey}>
              {displayedSongs.map((song, index) => {
                const isPlayingThis = currentIndex === index;
                const isLeft = index < halfCount;
                const animClass = isLeft ? 'fly-left' : 'fly-right';
                const animDelay = `${(index % 12) * 0.04}s`;

                return (
                  <div
                    key={song.id}
                    className={`song-card glass-card float-3d-card ${animClass} ${isPlayingThis ? `active playing-rgb ${ledEnabled ? 'rgb-chase-box' : 'no-led-border'}` : ''
                      }`}
                    style={{ animationDelay: animDelay }}
                    onClick={() => playSong(index, displayedSongs)}
                  >
                    <div className="thumb-container">
                      <img
                        src={getHighResThumbnail(song)}
                        alt={song.title}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = song.thumbnail || `https://img.youtube.com/vi/${song.id}/mqdefault.jpg`;
                        }}
                      />
                      <div className="play-overlay">{isPlayingThis && isPlaying ? '⏸' : '▶'}</div>
                    </div>

                    <div className="song-info">
                      <h3>{song.title}</h3>
                      <p>{song.artist}</p>
                    </div>

                    {activeTab === 'favorites' && playlists.length > 0 && (
                      <select
                        className="add-to-pl-select glow-hover-btn"
                        onChange={(e) => {
                          if (e.target.value) {
                            addSongToPlaylist(song, e.target.value);
                            e.target.value = '';
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        defaultValue=""
                      >
                        <option value="" disabled>➕ Thêm Playlist</option>
                        {playlists.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    )}

                    <button
                      className={`fav-btn glow-hover-btn ${isFav(song.id) ? 'active' : ''}`}
                      onClick={(e) => toggleFavorite(song, e)}
                      title="Lưu yêu thích"
                    >
                      {isFav(song.id) ? '❤️' : '🤍'}
                    </button>

                    <span className="song-duration">{song.duration}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <footer className="site-footer glass-card">
          <p>© All rights reserved by <strong>Chuong</strong> ❤️❤️❤️</p>
          <p className="sub-msg">✨ Chúc các bạn nghe nhạc vui vẻ và thư giãn cùng Chương music! ✨</p>
          <p>✨✨✨Zalo 0812234259✨✨✨</p>
        </footer>
      </main>

      {/* PLAYER DOCK */}
      {currentSong && (
        <footer className={`player-dock dock-rgb ${ledEnabled ? 'rgb-chase-box' : 'no-led-border'}`}>
          <div className="player-left">
            <div className="album-art-wrapper">
              <img
                src={getHighResThumbnail(currentSong)}
                alt={currentSong.title}
                className={isPlaying ? 'spinning' : ''}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = currentSong.thumbnail || `https://img.youtube.com/vi/${currentSong.id}/mqdefault.jpg`;
                }}
              />
            </div>
            <div className="song-meta">
              <h4>{currentSong.title}</h4>
              <p>{currentSong.artist}</p>
            </div>
            <button className="fav-dock-btn glow-hover-btn" onClick={() => toggleFavorite(currentSong)}>
              {isFav(currentSong.id) ? '❤️' : '🤍'}
            </button>
          </div>

          <div className="player-center">
            <canvas ref={canvasRef} width={220} height={26} className="visualizer-canvas" />

            <div className="controls-group">
              <button className="ctrl-btn glow-hover-btn" onClick={handlePrev} title="Bài trước">⏮</button>
              <button className="ctrl-btn play-btn pulse-play glow-hover-btn" onClick={togglePlayPause} title="Phát/Tạm dừng">
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button className="ctrl-btn glow-hover-btn" onClick={handleNext} title="Bài tiếp">⏭</button>
            </div>

            <div className="progress-container">
              <span className="time-text">{formatTime(currentTime)}</span>
              <input
                type="range"
                className="progress-bar"
                min="0"
                max={duration || 0}
                step="1"
                value={currentTime}
                onChange={handleSeek}
              />
              <span className="time-text">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="player-right">
            <button
              className={`bgplay-toggle-btn glow-hover-btn ${backgroundPlay ? 'active' : ''}`}
              onClick={() => setBackgroundPlay(!backgroundPlay)}
              title="Bật/Tắt chế độ phát nhạc khi chuyển tab"
            >
              {backgroundPlay ? '🎧 Nền: BẬT' : '🔇 Nền: TẮT'}
            </button>

            <button
              className={`autoplay-toggle-btn glow-hover-btn ${autoPlay ? 'active' : ''}`}
              onClick={() => setAutoPlay(!autoPlay)}
              title="Bật/Tắt Tự Động Phát Nhạc Khi Hết Bài"
            >
              {autoPlay ? '🔄 Auto: BẬT' : '⏸️ Auto: TẮT'}
            </button>

            <button
              className={`video-toggle-btn glow-hover-btn ${showVideo ? 'active' : ''}`}
              onClick={() => setShowVideo(!showVideo)}
              title="Bật/Tắt xem Video"
            >
              {showVideo ? '🎵 Tắt Video' : '📹 Bật Video'}
            </button>

            <div className="speed-menu-container">
              <button className="speed-toggle-btn glow-hover-btn" onClick={() => setShowSpeedMenu(!showSpeedMenu)}>
                ⚡ {playbackRate}x
              </button>

              {showSpeedMenu && (
                <div className="speed-dropdown-options glass-card">
                  <p className="speed-title">Tốc độ phát</p>
                  {SPEED_RATES.map((rate) => (
                    <button
                      key={rate}
                      className={`speed-option-item glow-hover-btn ${playbackRate === rate ? 'active' : ''}`}
                      onClick={() => changeSpeed(rate)}
                    >
                      {rate === 1.0 ? '1.0x (Gốc)' : `${rate}x`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="vol-icon">{volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊'}</span>
            <input
              type="range"
              className="volume-bar"
              min="0"
              max="100"
              value={volume}
              onChange={handleVolumeChange}
            />
          </div>
        </footer>
      )}
    </div>
  );
}

export default App;
