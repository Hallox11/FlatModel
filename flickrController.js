'use strict';

const axios = require('axios');
const fs    = require('fs');
const path  = require('path');

const FLICKR_URL = 'https://www.flickr.com/services/rest/';
const FLICKR_KEY = process.env.FLICKR_API_KEY || 'c90dea5c7207bea531ac489747938f44';
const PER_PAGE   = 150;
const CACHE_TTL  = 10 * 60 * 1000; // 10 minutes
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// ── CACHE DIR ────────────────────────────────────────────────
const CACHE_DIR = path.join(__dirname, 'cache/flickr');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

function safeName(str) {
    return str.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

function getCacheFile(prefix, key) {
    return path.join(CACHE_DIR, `${prefix}_${safeName(key)}.json`);
}

function readCache(file) {
    try {
        if (!fs.existsSync(file)) return null;
        const { timestamp, photos } = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (Date.now() - timestamp > CACHE_TTL) return null;
        return photos;
    } catch { return null; }
}

function writeCache(file, photos) {
    try {
        fs.writeFileSync(file, JSON.stringify({ timestamp: Date.now(), photos }, null, 2));
    } catch (err) {
        console.error('[Flickr Cache] Write error:', err.message);
    }
}

// ── FLICKR REQUEST HELPER ────────────────────────────────────
async function flickrGet(params) {
    const response = await axios.get(FLICKR_URL, {
        params: { ...params, api_key: FLICKR_KEY, format: 'json', nojsoncallback: 1 },
        headers: { 'User-Agent': USER_AGENT }
    });
    if (response.data.stat === 'fail') throw new Error(response.data.message);
    return response.data;
}

// ── SEARCH PHOTOS ────────────────────────────────────────────
async function searchPhotos(tags, sort = 'interestingness-desc') {
    // 1. Incluímos o 'sort' no nome do arquivo de cache para evitar conflitos
    // Se você buscar "Nature" por Relevância e depois por Data, serão arquivos diferentes.
    const cacheKey = `${tags}_${sort}`;
    const file = getCacheFile('search', cacheKey);
    
    const cached = readCache(file);
    if (cached) { 
        console.log(`[Flickr Cache] Hit: ${tags} (Sort: ${sort})`); 
        return cached; 
    }

    console.log(`[Flickr] Searching: ${tags} with sort: ${sort}`);
    
    const data = await flickrGet({
        method:      'flickr.photos.search',
        tags:        tags,
        tag_mode:    'any',
        per_page:    PER_PAGE,
        sort:        sort, // Agora usa o parâmetro dinâmico vindo do frontend
        safe_search: 1
    });

    const photos = data.photos?.photo || [];
    
    // Só grava no cache se houver resultados
    if (photos.length > 0) {
        writeCache(file, photos);
    }
    
    return photos;
}

// ── CHANNEL PHOTOS ───────────────────────────────────────────
async function getChannelPhotos(userId) {
    const file   = getCacheFile('channel', userId);
    const cached = readCache(file);
    if (cached) { console.log(`[Flickr Cache] Channel hit: ${userId}`); return cached; }

    console.log(`[Flickr] Channel: ${userId}`);
    const data = await flickrGet({
        method:   'flickr.people.getPublicPhotos',
        user_id:  userId,
        per_page: PER_PAGE
    });

    const photos = data.photos?.photo || [];
    writeCache(file, photos);
    return photos;
}

module.exports = { searchPhotos, getChannelPhotos };