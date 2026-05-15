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

async function getVideos(tag, type = 'search', maxTotalResults = 50) { // Adicionado parâmetro de limite
    ensureCacheDir();
    console.log(tag);
    console.log(type);
    
    // Update cache logic to handle the new prefix
    const cached = loadCache(tag, type); 
    if (cached) return cached;

    const API_KEY = process.env.YOUTUBE_API_KEY;
    let allVideos = [];
    let nextPageToken = "";

    try {
        console.log(`[YT API FETCH] Mode: ${type} | Requesting: ${tag}`);

        // Loop para paginação
        while (allVideos.length < maxTotalResults) {
            let url = "";
            // Calcula quantos resultados faltam para não ultrapassar o maxTotalResults
            const resultsToFetch = Math.min(50, maxTotalResults - allVideos.length);

            if (type === 'channel') {
                url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${resultsToFetch}&channelId=${encodeURIComponent(tag)}&order=date&key=${API_KEY}`;
            } 
            else if (type === 'playlist') {
                url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=${resultsToFetch}&playlistId=${encodeURIComponent(tag)}&key=${API_KEY}`;
            } 
            else {
                url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${resultsToFetch}&q=${encodeURIComponent(tag)}&key=${API_KEY}`;
            }

            // Se tivermos um token de próxima página, adicionamos à URL
            if (nextPageToken) {
                url += `&pageToken=${nextPageToken}`;
            }

            const response = await fetch(url);
            if (!response.ok) throw new Error(`API Status ${response.status}`);
            
            const data = await response.json();
            
            trackQuota(type === 'playlist' ? 1 : 100);

            const videos = data.items.map(i => {
                const snippet = i.snippet;
                const id = type === 'playlist' ? snippet.resourceId.videoId : i.id.videoId;
                
                return {
                    videoId: id,
                    title: snippet.title,
                    channel: snippet.channelTitle,
                    thumbnail: snippet.thumbnails.maxres?.url || snippet.thumbnails.high?.url || snippet.thumbnails.default?.url
                };
            });

            allVideos = allVideos.concat(videos);
            nextPageToken = data.nextPageToken;

            // Se não houver mais páginas no YouTube, interrompe o loop
            if (!nextPageToken) break;
        }

        if (allVideos.length > 0) {
            fs.writeFileSync(cacheFilePath(tag, type), JSON.stringify(allVideos, null, 2));
        }
        
        return allVideos;

    } catch (err) {
        console.error('[YT API] Error:', err.message);
        return allVideos; // Retorna o que conseguiu buscar antes do erro
    }
}

module.exports = {
    getVideos,
    trackQuota
};