'use strict';

const axios   = require('axios');
const cheerio = require('cheerio');
const fs      = require('fs');
const path    = require('path');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const CACHE_DIR      = path.join(__dirname, 'cache/xxx');
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000; // 24 horas
const DEFAULT_LIMIT    = 100;
const MAX_PAGES        = 5;
const BASE_URL         = 'https://www.xvideos.com';
const USER_AGENT       = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function ensureCacheDir() {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function cacheFilePath(tag) {
    const safeTag = tag.replace(/\s+/g, '_').toLowerCase();
    return path.join(CACHE_DIR, `xv_${safeTag}.json`);
}

function loadCache(tag) {
    const file = cacheFilePath(tag);
    if (!fs.existsSync(file)) return null;

    const stats   = fs.statSync(file);
    const isFresh = (Date.now() - stats.mtimeMs) < CACHE_EXPIRATION;
    
    if (!isFresh) {
        console.log(`[XV CACHE] Stale: ${tag}`);
        return null;
    }

    try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        console.log(`[XV CACHE] Hit: ${tag}`);
        return data;
    } catch (e) {
        return null;
    }
}

function saveCache(tag, data) {
    ensureCacheDir();
    fs.writeFileSync(cacheFilePath(tag), JSON.stringify(data, null, 2));
}

// ─── CORE SCRAPER ─────────────────────────────────────────────────────────────

async function scrapeVideos(tag = 'top', limit = DEFAULT_LIMIT) {
    console.log(`[XV SCRAPE] Fetching: "${tag}" (limit: ${limit})`);
    const videos = [];
    let page = 1;

    // Ajuste da URL: Se a tag for 'top', usamos a home, senão usamos a busca
    const getUrl = (p) => {
        if (tag.toLowerCase() === 'top') return `${BASE_URL}/best/1080p/${p}`;
        return `${BASE_URL}/?k=${encodeURIComponent(tag)}&p=${p}`;
    };

    while (videos.length < limit && page <= MAX_PAGES) {
        try {
            const url = getUrl(page);
            const response = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
            const $ = cheerio.load(response.data);
            const items = $('.thumb-block');

            if (items.length === 0) break;

            items.each((i, el) => {
                if (videos.length >= limit) return false;

                const title = $(el).find('p.title a').attr('title') || '';
                const pageUrl = $(el).find('p.title a').attr('href');
                const thumbnail = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');

                if (title && pageUrl) {
                    videos.push({
                        title: title.replace(/'/g, '&apos;'),
                        thumbnail,
                        pageUrl: pageUrl.startsWith('http') ? pageUrl : `${BASE_URL}${pageUrl}`
                    });
                }
            });
            page++;
        } catch (err) {
            console.error(`[XV SCRAPE] Error on page ${page}:`, err.message);
            break;
        }
    }
    return videos;
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Esta é a função que a sua rota chama. 
 * Ela agora recebe a tag corretamente e usa o sistema de cache por arquivo.
 */
async function getVideos(tag = 'Hardcore') {
    // 1. Tentar carregar do cache de arquivo primeiro
    const cachedData = loadCache(tag);
    if (cachedData) return cachedData;

    // 2. Se não houver cache, faz o scrape real
    try {
        const videos = await scrapeVideos(tag);
        
        // 3. Se encontrou vídeos, salva no cache
        if (videos && videos.length > 0) {
            saveCache(tag, videos);
        }
        return videos;
    } catch (error) {
        console.error(`[XV Scraper] Erro geral:`, error.message);
        return [];
    }
}

async function getStream(videoPageUrl) {
    try {
        const response = await axios.get(videoPageUrl, { headers: { 'User-Agent': USER_AGENT } });
        const match = response.data.match(/html5player\.setVideoHLS\(['"](.*?)['"]\)/);
        return match ? match[1] : null;
    } catch (err) {
        console.error('[XV STREAM] Failed to extract stream:', err.message);
        return null;
    }
}

async function refreshVideos(tag = 'top') {
    const videos = await scrapeVideos(tag);
    if (videos.length > 0) saveCache(tag, videos);
    return videos;
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────
module.exports = {
    getVideos,
    refreshVideos,
    getStream
};