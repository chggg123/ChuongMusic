const express = require('express');
const cors = require('cors');
const ytSearch = require('yt-search');

const app = express();
app.use(cors());

// 1. API Tìm kiếm bài hát
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ error: 'Thiếu từ khóa' });

        const searchResult = await ytSearch(query);
        // SỬA TẠI ĐÂY: Lấy đủ 30 bài hát ngẫu nhiên hot
        const songs = searchResult.videos.slice(0, 30).map(video => ({
            id: video.videoId,
            title: video.title,
            artist: video.author.name,
            duration: video.timestamp,
            thumbnail: video.thumbnail
        }));

        res.json(songs);
    } catch (error) {
        console.error('Lỗi tìm kiếm:', error);
        res.status(500).json({ error: 'Lỗi tìm kiếm' });
    }
});

// 2. API Gợi ý từ khóa tìm kiếm (YouTube Auto-Suggest)
app.get('/api/suggestions', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.json([]);

        const response = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}`);
        const data = await response.json();
        const suggestions = data[1] || [];
        res.json(suggestions.slice(0, 8));
    } catch (error) {
        res.json([]);
    }
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`🚀 Backend v4 chạy tại http://localhost:${PORT}`);
});
