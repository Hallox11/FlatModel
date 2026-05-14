'use strict';

const fs = require('fs');
const path = require('path');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const CACHE_DIR = path.join(__dirname, 'cache/youtube');
const QUOTA_PATH = path.join(CACHE_DIR, 'quota.json');
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000; // 24 hours (YT content moves faster than SL guides)

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function ensureCacheDir() {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function cacheFilePath(tag, isChannel) {
    const prefix = isChannel ? 'chan' : 'tag';
    const safeTag = tag.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return path.join(CACHE_DIR, `yt_${prefix}_${safeTag}.json`);
}

function loadCache(tag, isChannel) {
    const file = cacheFilePath(tag, isChannel);
    if (!fs.existsSync(file)) return null;

    const stats = fs.statSync(file);
    const isFresh = (Date.now() - stats.mtimeMs) < CACHE_EXPIRATION;
    
    if (isFresh) {
        try {
            console.log(`[YT CACHE] Hit: ${tag}`);
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch { return null; }
    }
    return null;
}

function trackQuota(units) {
    ensureCacheDir();
    let q = { date: new Date().toDateString(), used: 0 };
    if (fs.existsSync(QUOTA_PATH)) {
        try { q = JSON.parse(fs.readFileSync(QUOTA_PATH, 'utf8')); } catch(e){}
    }
    if (q.date !== new Date().toDateString()) {
        q = { date: new Date().toDateString(), used: 0 };
    }
    q.used += units;
    fs.writeFileSync(QUOTA_PATH, JSON.stringify(q, null, 2));
    console.log(`[YT QUOTA] Used: ${q.used}/10000`);
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

async function getVideos(tag, type = 'search') { // type can be 'search', 'channel', or 'playlist'
    ensureCacheDir();
    
    // Update cache logic to handle the new prefix
    const cached = loadCache(tag, type); 
    if (cached) return cached;

    const API_KEY = process.env.YOUTUBE_API_KEY;
    let url = "";

    if (type === 'channel') {
        url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=50&channelId=${encodeURIComponent(tag)}&order=date&key=${API_KEY}`;
    } 
    else if (type === 'playlist') {
        // Use playlistItems endpoint for actual playlists
        url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${encodeURIComponent(tag)}&key=${API_KEY}`;
    } 
    else {
        // Standard keyword search
        url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=50&q=${encodeURIComponent(tag)}&key=${API_KEY}`;
    }

    try {
        console.log(`[YT API FETCH] Mode: ${type} | Requesting: ${tag}`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API Status ${response.status}`);
        const data = await response.json();
        
        trackQuota(type === 'playlist' ? 1 : 100); // playlistItems is much cheaper (1 unit) than search (100 units)

        const videos = data.items.map(i => {
            // Snippet structure is slightly different for playlistItems vs search
            const snippet = i.snippet;
            const id = type === 'playlist' ? snippet.resourceId.videoId : i.id.videoId;
            
            return {
                videoId: id,
                title: snippet.title,
                channel: snippet.channelTitle,
                thumbnail: snippet.thumbnails.maxres?.url || snippet.thumbnails.high?.url || snippet.thumbnails.default?.url
            };
        });

        if (videos.length > 0) {
            fs.writeFileSync(cacheFilePath(tag, type), JSON.stringify(videos, null, 2));
        }
        return videos;
    } catch (err) {
        console.error('[YT API] Error:', err.message);
        return [];
    }
}

module.exports = {
    getVideos,
    trackQuota
};