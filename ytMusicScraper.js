'use strict';

const { Innertube } = require('youtubei.js');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, 'cache/ytmusic');
const CACHE_EXPIRATION = 72 * 60 * 60 * 1000;

let yt;
let isInitialized = false;

function ensureCacheDir() {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
}

async function initYT() {
    if (!isInitialized) {
        yt = await Innertube.create();
        isInitialized = true;
    }
}

async function getMusic(query) {
    ensureCacheDir();

    const safeQuery = query.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const cacheFile = path.join(CACHE_DIR, `ytm_${safeQuery}.json`);

    if (fs.existsSync(cacheFile)) {
        const stats = fs.statSync(cacheFile);
        if ((Date.now() - stats.mtimeMs) < CACHE_EXPIRATION) {
            return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        }
    }

    try {
        await initYT();
        console.log(`[YT SEARCH] Searching: ${query}`);

        let search = await yt.search(query, { type: 'video' });
        let results = [...search.results];

        // FIX: Update 'search' so the loop moves to the next page
        while (results.length < 60 && search.has_continuation) {
            search = await search.getContinuation(); 
            if (search.results) {
                results.push(...search.results);
            }
        }

        console.log(`[DEBUG] Raw results: ${results.length}`);

// 4. Filter to valid videos only
const filtered = results.filter(v => {
    const hasId = !!v.id;
    // We check if duration exists AT ALL before checking seconds
    const hasDuration = v.duration && typeof v.duration.seconds !== 'undefined';
    
    // If it has duration, make sure it's not a tiny clip (Short)
    const isNotShort = hasDuration ? v.duration.seconds > 30 : false;

    return hasId && hasDuration && isNotShort;
});

// 5. Map to your format
const music = filtered.slice(0, 50).map(v => {
    const videoId = v.id;
    
    // Safety check for duration text
    const timeLabel = v.duration?.text || "0:00";

    return {
        id: videoId, 
        videoId: videoId,
        title: v.title?.text || v.title || "Unknown Title",
        subtitle: v.author?.name || "Unknown Artist", 
        durationText: timeLabel,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        album: 'YouTube'
    };
});

        console.log(`[YT] Final results: ${music.length}`);

        if (music.length > 0) {
            fs.writeFileSync(cacheFile, JSON.stringify(music, null, 2));
        }

        return music;

    } catch (err) {
        console.error("❌ YouTube Search Error:", err.message);
        return [];
    }
}

module.exports = { getMusic };