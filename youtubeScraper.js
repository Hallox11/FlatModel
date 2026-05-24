'use strict';

const fs = require('fs');
const path = require('path');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const CACHE_DIR = path.join(__dirname, 'cache/youtube');
const QUOTA_PATH = path.join(CACHE_DIR, 'quota.json');
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000; // 24 hours

const SHORTS_MAX_DURATION = 60;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function ensureCacheDir() {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
}

function cacheFilePath(tag, type) {
    const prefix = type === 'channel' ? 'chan' : 'tag';
    const safeTag = tag.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return path.join(CACHE_DIR, `yt_${prefix}_${safeTag}.json`);
}

function loadCache(tag, type) {
    const file = cacheFilePath(tag, type);

    if (!fs.existsSync(file)) return null;

    const stats = fs.statSync(file);
    const isFresh = (Date.now() - stats.mtimeMs) < CACHE_EXPIRATION;

    if (!isFresh) return null;

    try {
        console.log(`[YT CACHE] Hit: ${tag}`);
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return null;
    }
}

function trackQuota(units) {
    ensureCacheDir();

    let q = {
        date: new Date().toDateString(),
        used: 0
    };

    if (fs.existsSync(QUOTA_PATH)) {
        try {
            q = JSON.parse(fs.readFileSync(QUOTA_PATH, 'utf8'));
        } catch {}
    }

    if (q.date !== new Date().toDateString()) {
        q = { date: new Date().toDateString(), used: 0 };
    }

    q.used += units;

    fs.writeFileSync(QUOTA_PATH, JSON.stringify(q, null, 2));

    console.log(`[YT QUOTA] Used: ${q.used}/10000`);
}

// Parse ISO8601 duration
function parseDuration(duration) {
    if (!duration) return 0;

    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);

    const hours = parseInt(match?.[1] || 0);
    const minutes = parseInt(match?.[2] || 0);
    const seconds = parseInt(match?.[3] || 0);

    return (hours * 3600) + (minutes * 60) + seconds;
}

// ─── GET UPLOADS PLAYLIST (IMPORTANT FIX) ────────────────────────────────────
async function getUploadsPlaylist(channelId, API_KEY) {
    const url =
        `https://www.googleapis.com/youtube/v3/channels` +
        `?part=contentDetails` +
        `&id=${channelId}` +
        `&key=${API_KEY}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`channels.list ${res.status}`);

    const data = await res.json();

    trackQuota(1);

    return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────
async function getVideos(tag, type = 'search', maxTotalResults = 50) {
    ensureCacheDir();

    // 1. Check cache using the original type parameter
    const cached = loadCache(tag, type);
    if (cached) return cached;

    const API_KEY = process.env.YOUTUBE_API_KEY;
    const originalType = type; // <--- ✅ FIX 1: Save the original type here

    let allVideos = [];
    let nextPageToken = "";

    try {
        console.log(`[YT API FETCH] Mode: ${type} | ${tag}`);

        let playlistId = null;

        if (type === 'channel') {
            playlistId = await getUploadsPlaylist(tag, API_KEY);
            type = 'playlist'; // Changing this internally for the API query is fine now
        }

        while (allVideos.length < maxTotalResults) {

            const resultsToFetch = Math.min(
                50,
                maxTotalResults - allVideos.length
            );

            let url = "";

            if (type === 'playlist') {
                url =
                    `https://www.googleapis.com/youtube/v3/playlistItems` +
                    `?part=snippet` +
                    `&maxResults=${resultsToFetch}` +
                    `&playlistId=${encodeURIComponent(playlistId || tag)}` +
                    `&key=${API_KEY}`;
            } else {
                url =
                    `https://www.googleapis.com/youtube/v3/search` +
                    `?part=snippet` +
                    `&type=video` +
                    `&maxResults=${resultsToFetch}` +
                    `&q=${encodeURIComponent(tag)}` +
                    `&key=${API_KEY}`;
            }

            if (nextPageToken) {
                url += `&pageToken=${nextPageToken}`;
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`API ${response.status}`);
            }

            const data = await response.json();
            trackQuota(1);

            // ─── EXTRACT IDS ─────────────────────────────────────────────
            const videoIds = [...new Set(
                data.items
                    .map(i =>
                        type === 'playlist'
                            ? i?.snippet?.resourceId?.videoId
                            : i?.id?.videoId
                    )
                    .filter(Boolean)
            )];

            if (!videoIds.length) break;

            // ─── FETCH DURATION DATA ─────────────────────────────────────
            const detailsUrl =
                `https://www.googleapis.com/youtube/v3/videos` +
                `?part=contentDetails` +
                `&id=${videoIds.join(',')}` +
                `&key=${API_KEY}`;

            const detailsRes = await fetch(detailsUrl);
            if (!detailsRes.ok) {
                throw new Error(`videos.list ${detailsRes.status}`);
            }

            const detailsData = await detailsRes.json();
            trackQuota(1);

            const durationMap = {};
            for (const item of detailsData.items) {
                durationMap[item.id] = item.contentDetails.duration;
            }

            // ─── BUILD RESULTS ───────────────────────────────────────────
            const videos = data.items
                .map(i => {
                    const snippet = i.snippet;

                    const id = type === 'playlist'
                        ? snippet?.resourceId?.videoId
                        : i?.id?.videoId;

                    return {
                        videoId: id,
                        title: snippet.title,
                        channel: snippet.channelTitle,
                        thumbnail:
                            snippet.thumbnails?.maxres?.url ||
                            snippet.thumbnails?.high?.url ||
                            snippet.thumbnails?.medium?.url ||
                            snippet.thumbnails?.default?.url,
                        duration: durationMap[id]
                    };
                })
                .filter(v => v.videoId)
                .filter(v => parseDuration(v.duration) >= 90);

            allVideos = allVideos.concat(videos);

            nextPageToken = data.nextPageToken;
            if (!nextPageToken) break;
        }

        // 2. Save cache file to disk using the preserved original type format
        if (allVideos.length) {
            fs.writeFileSync(
                cacheFilePath(tag, originalType), // <--- ✅ FIX 2: Use originalType here
                JSON.stringify(allVideos, null, 2)
            );
        }

        return allVideos;

    } catch (err) {
        console.error('[YT API] Error:', err.message);
        return allVideos;
    }
}

module.exports = {
    getVideos,
    trackQuota
};