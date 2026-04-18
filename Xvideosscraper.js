'use strict';

/**
 * xvideosScraper.js
 * -----------------
 * Standalone module for scraping xvideos search results and extracting HLS streams.
 *
 * Usage:
 *   const xvideosScraper = require('./xvideosScraper');
 *
 *   // Search + cache by tag
 *   const videos = await xvideosScraper.getVideos({ tag: 'jazz' });
 *
 *   // Force a fresh scrape
 *   const videos = await xvideosScraper.refreshVideos({ tag: 'jazz' });
 *
 *   // Extract HLS stream URL from a video page
 *   const streamUrl = await xvideosScraper.getStream('https://www.xvideos.com/video...');
 */

const axios   = require('axios');
const cheerio = require('cheerio');
const fs      = require('fs');
const path    = require('path');

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const CACHE_DIR        = path.join(__dirname, 'cache/xxx');
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_LIMIT    = 100;
const MAX_PAGES        = 5;
const BASE_URL         = 'https://www.xvideos.com';
const USER_AGENT       = 'Mozilla/5.0';

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
    if (!isFresh) return null;

    try {
        console.log(`[XV CACHE] Hit: ${tag}`);
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return null;
    }
}

function saveCache(tag, data) {
    ensureCacheDir();
    fs.writeFileSync(cacheFilePath(tag), JSON.stringify(data, null, 2));
}

// ─── CORE SCRAPER ─────────────────────────────────────────────────────────────

/**
 * Scrapes xvideos search results for a given tag.
 * Paginates up to MAX_PAGES or until the limit is reached.
 *
 * @param {string} tag    Search keyword
 * @param {number} limit  Max number of videos to return (default 100)
 * @returns {Promise<Array>}
 */
async function scrapeVideos(tag = 'top', limit = DEFAULT_LIMIT) {
    console.log(`[XV SCRAPE] Fetching: "${tag}" (limit: ${limit})`);

    const videos = [];
    let page = 1;

    while (videos.length < limit && page <= MAX_PAGES) {
        try {
            const url      = `${BASE_URL}/?k=${encodeURIComponent(tag)}&durf=1080p&p=${page}`;
            const response = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
            const $        = cheerio.load(response.data);
            const items    = $('.thumb-block');

            if (items.length === 0) break; // No more results

            items.each((i, el) => {
                if (videos.length >= limit) return false; // Stop early

                const title    = $(el).find('p.title a').attr('title') || '';
                const pageUrl  = $(el).find('p.title a').attr('href');
                const thumbnail = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');

                if (title && pageUrl) {
                    videos.push({
                        title:    title.replace(/'/g, '&apos;'), // Sanitize for inline JS
                        thumbnail,
                        pageUrl:  pageUrl.startsWith('http') ? pageUrl : `${BASE_URL}${pageUrl}`
                    });
                }
            });

            page++;
        } catch (err) {
            console.error(`[XV SCRAPE] Error on page ${page}:`, err.message);
            break;
        }
    }

    console.log(`[XV SCRAPE] Done. Found ${videos.length} videos for "${tag}"`);
    return videos;
}

/**
 * Extracts the HLS (.m3u8) stream URL from an xvideos video page.
 *
 * @param {string} videoPageUrl  Full URL of the xvideos video page
 * @returns {Promise<string|null>}  The HLS stream URL, or null if not found
 */
async function getStream(videoPageUrl) {
    try {
        const response = await axios.get(videoPageUrl, { headers: { 'User-Agent': USER_AGENT } });
        const match    = response.data.match(/html5player\.setVideoHLS\(['"](.*?)['"]\)/);
        return match ? match[1] : null;
    } catch (err) {
        console.error('[XV STREAM] Failed to extract stream:', err.message);
        return null;
    }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Returns videos for a given tag.
 * Checks the 24-hour cache first; scrapes live if stale or missing.
 *
 * @param {object} options
 * @param {string} options.tag    Search keyword (default: 'top')
 * @param {number} options.limit  Max results (default: 100)
 * @returns {Promise<Array>}
 */
async function getVideos({ tag = 'top', limit = DEFAULT_LIMIT } = {}) {
    ensureCacheDir();

    const cached = loadCache(tag);
    if (cached) return cached;

    const videos = await scrapeVideos(tag, limit);
    if (videos.length > 0) saveCache(tag, videos);
    return videos;
}

/**
 * Forces a fresh scrape, bypassing the cache.
 *
 * @param {object} options
 * @param {string} options.tag
 * @param {number} options.limit
 * @returns {Promise<Array>}
 */
async function refreshVideos({ tag = 'top', limit = DEFAULT_LIMIT } = {}) {
    const videos = await scrapeVideos(tag, limit);
    if (videos.length > 0) saveCache(tag, videos);
    return videos;
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
    getVideos,
    refreshVideos,
    getStream
};