const express = require('express');
const cors = require('cors');
const ytSearch = require('yt-search');
const { Ytdl, Quality, chooseFormat, parseVideoId } = require('@distube/ytdl-core');
const { Readable } = require('node:stream');

const app = express();
const youtube = new Ytdl();
const tikTokMediaHosts = [
    'tiktok.com',
    'tiktokcdn.com',
    'tiktokcdn-us.com',
    'tiktokv.com',
    'byteoversea.com',
    'ibytedtos.com',
    'muscdn.com',
    'tikwm.com',
    'akamaized.net'
];

const isTikTokHost = (hostname) => tikTokMediaHosts.some((host) =>
    hostname === host || hostname.endsWith(`.${host}`)
);

const parseTikTokMediaUrl = (value) => {
    try {
        const url = new URL(value);
        if (url.protocol === 'https:' && !url.username && !url.password && isTikTokHost(url.hostname)) return url;
    } catch (error) {
        return null;
    }
    return null;
};

// Cấu hình CORS mở cho tất cả tên miền truy cập
app.use(cors());
app.use(express.json());

// Stream YouTube audio through the site so Web Audio can apply DSP effects.
app.get('/api/stream', async (req, res) => {
    const videoId = req.query.id;
    if (typeof videoId !== 'string' || parseVideoId(videoId) !== videoId) {
        return res.status(400).json({ error: 'Video ID YouTube không hợp lệ' });
    }

    try {
        const info = await youtube.getInfo(videoId);
        const format = chooseFormat(info.formats, {
            filter: { hasAudio: true, hasVideo: false },
            quality: Quality.HighestAudio
        });
        const contentLength = Number(format.contentLength);
        if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
            throw new Error('YouTube audio format has no valid content length');
        }
        const rangeHeader = req.headers.range;
        let range;

        if (rangeHeader) {
            const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
            if (!match || (!match[1] && !match[2])) {
                return res.status(416).set('Content-Range', `bytes */${contentLength}`).end();
            }

            const start = match[1] ? Number(match[1]) : Math.max(0, contentLength - Number(match[2]));
            const end = match[2] && match[1] ? Number(match[2]) : contentLength - 1;
            if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
                start < 0 || start > end || end >= contentLength) {
                return res.status(416).set('Content-Range', `bytes */${contentLength}`).end();
            }
            range = { start, end };
            res.status(206);
            res.set('Content-Range', `bytes ${start}-${end}/${contentLength}`);
            res.set('Content-Length', String(end - start + 1));
        } else {
            res.set('Content-Length', String(contentLength));
        }

        res.set({
            'Accept-Ranges': 'bytes',
            'Content-Type': format.mimeType || 'audio/webm',
            'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range, Content-Type'
        });

        const audioStream = youtube.open(info, format).read({ range });
        audioStream.on('error', (error) => {
            console.error(`Lỗi stream YouTube (${videoId}):`, error);
            if (!res.headersSent) {
                res.status(502).json({ error: 'Không thể stream âm thanh YouTube' });
            } else {
                res.destroy();
            }
        });
        res.once('close', () => {
            if (!res.writableEnded) audioStream.destroy();
        });
        audioStream.pipe(res);
    } catch (error) {
        console.error(`Lỗi chuẩn bị stream YouTube (${videoId}):`, error);
        if (!res.headersSent) {
            res.status(502).json({ error: 'Không thể stream âm thanh YouTube' });
        }
    }
});

// 1. API TÌM KIẾM BÀI HÁT YOUTUBE
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ error: 'Thiếu từ khóa tìm kiếm' });

        const searchResult = await ytSearch(query);
        const songs = searchResult.videos.slice(0, 30).map(video => ({
            id: video.videoId,
            title: video.title,
            artist: video.author.name,
            duration: video.timestamp,
            thumbnail: video.thumbnail,
            type: 'youtube'
        }));

        res.json(songs);
    } catch (error) {
        console.error('Lỗi tìm kiếm YouTube:', error);
        res.status(500).json({ error: 'Lỗi tìm kiếm YouTube' });
    }
});

// 2. API GỢI Ý TỪ KHÓA TÌM KIẾM (YOUTUBE AUTO-SUGGEST)
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

// 3. API XỬ LÝ & GIẢI MÃ LINK TIKTOK (HỖ TRỢ CẢ LINK RÚT GỌN vt.tiktok.com / vm.tiktok.com)
app.get('/api/tiktok', async (req, res) => {
    try {
        const submittedUrl = req.query.url;
        if (typeof submittedUrl !== 'string') {
            return res.status(400).json({ error: 'Thiếu đường dẫn TikTok' });
        }
        let parsedTikTokUrl;
        try {
            const value = submittedUrl.trim();
            parsedTikTokUrl = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
        } catch (error) {
            return res.status(400).json({ error: 'Đường dẫn TikTok không hợp lệ' });
        }
        const hostname = parsedTikTokUrl.hostname.toLowerCase().replace(/\.$/, '');
        if (!['http:', 'https:'].includes(parsedTikTokUrl.protocol) ||
            (hostname !== 'tiktok.com' && !hostname.endsWith('.tiktok.com')) ||
            parsedTikTokUrl.pathname === '/' || parsedTikTokUrl.username || parsedTikTokUrl.password) {
            return res.status(400).json({ error: 'Đường dẫn TikTok không hợp lệ' });
        }
        parsedTikTokUrl.protocol = 'https:';
        const tiktokUrl = parsedTikTokUrl.toString();

        const response = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(tiktokUrl)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        if (!response.ok) {
            throw new Error(`TikWM trả về HTTP ${response.status}`);
        }
        const result = await response.json();
        const data = result.data;
        const mediaUrl = data?.play || data?.wmplay;
        if (Number(result.code) !== 0 || !data?.id || !mediaUrl) {
            return res.status(502).json({ error: 'TikTok không trả về dữ liệu video hợp lệ' });
        }

        if (!parseTikTokMediaUrl(mediaUrl)) {
            throw new Error(`TikTok trả về host media không được hỗ trợ: ${new URL(mediaUrl).hostname}`);
        }

        res.json({
            id: `tiktok_${data.id}`,
            tiktokVideoId: String(data.id),
            videoUrl: `tiktok-stream?url=${encodeURIComponent(mediaUrl)}`,
            title: data.title || 'Video TikTok',
            artist: data.author?.nickname ? `@${data.author.nickname}` : 'TikTok Creator',
            thumbnail: data.cover || 'https://sf16-sg.tiktokcdn.com/obj/eden-sg/u3kwyb_l_zlp/ljhwZfsne22q_wq_u3kwyb/tiktok_icon.png',
            duration: data.duration || 0,
            type: 'tiktok'
        });
    } catch (error) {
        console.error('Lỗi xử lý TikTok:', error);
        res.status(500).json({ error: 'Không thể lấy dữ liệu TikTok từ Server' });
    }
});

app.get('/api/tiktok-stream', async (req, res) => {
    const mediaUrl = typeof req.query.url === 'string' ? parseTikTokMediaUrl(req.query.url) : null;
    if (!mediaUrl) {
        return res.status(400).json({ error: 'Đường dẫn media TikTok không hợp lệ' });
    }

    try {
        let upstreamUrl = mediaUrl;
        let upstream;
        for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
            upstream = await fetch(upstreamUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    ...(req.headers.range ? { Range: req.headers.range } : {})
                },
                redirect: 'manual'
            });
            if (![301, 302, 303, 307, 308].includes(upstream.status)) break;
            const location = upstream.headers.get('location');
            if (!location || redirectCount === 5) {
                throw new Error('TikTok media redirect không hợp lệ');
            }
            upstreamUrl = new URL(location, upstreamUrl);
            if (!parseTikTokMediaUrl(upstreamUrl.href)) {
                throw new Error('TikTok media chuyển hướng đến máy chủ không được hỗ trợ');
            }
        }

        if (!upstream || (!upstream.ok && upstream.status !== 416)) {
            throw new Error(`TikTok media trả về HTTP ${upstream?.status || 'không xác định'}`);
        }

        res.status(upstream.status);
        res.set({
            'Accept-Ranges': upstream.headers.get('accept-ranges') || 'bytes',
            'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range, Content-Type'
        });
        for (const header of ['content-length', 'content-range', 'content-type']) {
            const value = upstream.headers.get(header);
            if (value) res.set(header, value);
        }
        if (!upstream.body) return res.end();

        const mediaStream = Readable.fromWeb(upstream.body);
        res.once('close', () => {
            if (!res.writableEnded) mediaStream.destroy();
        });
        mediaStream.on('error', (error) => {
            console.error('Lỗi stream TikTok:', error);
            if (!res.headersSent) res.status(502).json({ error: 'Không thể stream video TikTok' });
            else res.destroy();
        });
        mediaStream.pipe(res);
    } catch (error) {
        console.error('Lỗi chuẩn bị stream TikTok:', error);
        if (!res.headersSent) {
            res.status(502).json({ error: 'Không thể stream video TikTok' });
        }
    }
});

// KHỞI ĐỘNG SERVER
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server backend đã chạy thành công tại cổng ${PORT}`);
});
