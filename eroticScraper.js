'use strict';

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, 'cache/erotic');
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000;

const headers = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

/* ---------------------------
   CACHE HELPERS
----------------------------*/
function ensureCache() {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
}

/* ---------------------------
   HLS PARSER
----------------------------*/
function parseMasterPlaylist(m3u8Text) {
    const lines = m3u8Text.split('\n');
    const streams = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.includes('#EXT-X-STREAM-INF')) {
            const nextUrl = lines[i + 1]?.trim();

            const resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/);

            streams.push({
                url: nextUrl,
                width: resMatch ? parseInt(resMatch[1]) : 0,
                height: resMatch ? parseInt(resMatch[2]) : 0
            });
        }
    }

    return streams;
}

/* ---------------------------
   PICK BEST QUALITY STREAM
----------------------------*/
function pickBestStream(streams) {
    if (!streams.length) return null;

    return streams.sort((a, b) => {
        return (b.width * b.height) - (a.width * a.height);
    })[0];
}

/* ---------------------------
   RESOLVE BEST STREAM
----------------------------*/
async function resolveBestStream(pageHtml, baseUrl) {
    const matches = [
        ...pageHtml.matchAll(/https?:\/\/[^"']+\.m3u8[^"']*/g)
    ];

    for (const m of matches) {
        try {
            const url = m[0];

            const { data } = await axios.get(url, {
                headers,
                timeout: 10000
            });

            // MASTER PLAYLIST
            if (data.includes('#EXT-X-STREAM-INF')) {
                const streams = parseMasterPlaylist(data);
                const best = pickBestStream(streams);

                if (best?.url) {
                    return new URL(best.url, url).toString();
                }
            }

            // DIRECT STREAM (NO MASTER)
            if (data.includes('#EXTINF')) {
                return url;
            }

        } catch (err) {
            continue;
        }
    }

    return null;
}

/* ---------------------------
   CORE SCRAPER
----------------------------*/
async function scrapeErotic(siteUrl) {
    console.log(`[EROTIC] Scraping: ${siteUrl}`);

    const { data: listHtml } = await axios.get(siteUrl, {
        headers,
        timeout: 10000
    });

    const $ = cheerio.load(listHtml);

    const initialList = [];

    $('article').each((i, item) => {
        const imgObj = $(item).find('img');

        const thumb =
            imgObj.attr('data-src') ||
            imgObj.attr('data-lazy-src') ||
            imgObj.attr('src');

        const a = $(item).find('a');

        initialList.push({
            title: a.attr('title') || 'No Title',
            pageUrl: a.attr('href'),
            thumbnail: thumb
        });
    });

    const videosArray = [];

    for (const video of initialList) {
        try {
            const { data: videoPageHtml } = await axios.get(video.pageUrl, {
                headers,
                timeout: 10000
            });

            const streamUrl = await resolveBestStream(
                videoPageHtml,
                video.pageUrl
            );

            videosArray.push({
                title: video.title,
                streamUrl: streamUrl,
                thumbnail: video.thumbnail,
                pageUrl: video.pageUrl,
                desc: streamUrl ? 'Best Quality Stream' : 'Page Only'
            });

        } catch (e) {
            console.error('[ERROR]', video.pageUrl, e.message);

            videosArray.push({
                ...video,
                streamUrl: null,
                desc: 'Failed to resolve'
            });
        }
    }

    return videosArray;
}

/* ---------------------------
   PUBLIC API (WITH CACHE)
----------------------------*/
async function getEroticVideos(siteUrl) {
    ensureCache();

    const cacheFile = path.join(
        CACHE_DIR,
        `erotic_${Buffer.from(siteUrl).toString('base64')}.json`
    );

    // CACHE HIT
    if (fs.existsSync(cacheFile)) {
        const stats = fs.statSync(cacheFile);

        if (Date.now() - stats.mtimeMs < CACHE_EXPIRATION) {
            return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        }
    }

    // SCRAPE
    const videos = await scrapeErotic(siteUrl);

    if (videos.length > 0) {
        fs.writeFileSync(cacheFile, JSON.stringify(videos, null, 2));
    }

    return videos;
}

module.exports = { getEroticVideos };