'use strict';
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, 'cache/erotic');
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000; // 24 hours

const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' };

/**
 * CORE SCRAPER: Fetches the list and deep-scrapes the m3u8 links.
 */
async function scrapeErotic(siteUrl) {
    console.log(`[EROTIC] Scrapping: ${siteUrl}`);
    const { data: listHtml } = await axios.get(siteUrl, { headers });
    const $ = cheerio.load(listHtml);
    const videosArray = [];
    const initialList = [];

$('article').each((i, item) => {
    const imgObj = $(item).find('img');
    
    // 1. Look for common lazy-load attributes used by the Vidorev theme
    // 2. If those don't exist, fall back to the standard 'src'
    const thumb = imgObj.attr('data-src') || 
                  imgObj.attr('data-lazy-src') || 
                  imgObj.attr('src');

    initialList.push({
        title: $(item).find('a').attr('title') || 'No Title',
        pageUrl: $(item).find('a').attr('href'),
        thumbnail: thumb,
    });
});

    for (const video of initialList) {
        try {
            const { data: videoPageHtml } = await axios.get(video.pageUrl, { headers });
            const streamMatch = videoPageHtml.match(/https?:\/\/[^"']+\.m3u8/);
            const streamUrl = streamMatch ? streamMatch[0] : null;

            videosArray.push({
                title: video.title,
                streamUrl: streamUrl,
                thumbnail: video.thumbnail,
                pageUrl: video.pageUrl,
                desc: streamUrl ? 'Full Stream' : 'Page Only'
            });
        } catch (e) {
            videosArray.push(video);
        }
    }
    return videosArray;
}

/**
 * PUBLIC API: With Cache Logic
 */
async function getEroticVideos(siteUrl) {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    const cacheFile = path.join(CACHE_DIR, 'erotic_list.json');

    // 1. Check Cache
    if (fs.existsSync(cacheFile)) {
        const stats = fs.statSync(cacheFile);
        if ((Date.now() - stats.mtimeMs) < CACHE_EXPIRATION) {
            return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        }
    }

    // 2. Scrape and Save
    const videos = await scrapeErotic(siteUrl);
    if (videos.length > 0) fs.writeFileSync(cacheFile, JSON.stringify(videos, null, 2));
    return videos;
}

module.exports = { getEroticVideos };