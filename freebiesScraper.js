'use strict';

const axios   = require('axios');
const cheerio = require('cheerio');
const path    = require('path');
const fs      = require('fs');

const CACHE_DIR  = path.join(__dirname, 'cache/freebies');
const CACHE_FILE = path.join(CACHE_DIR, 'freebies.json');
const CACHE_TTL  = 30 * 60 * 1000; // 30 minutes
const SITE_URL   = 'https://www.scoop.it/topic/second-life-freebies-und-mehr';
const PAGES      = [1, 2, 3, 4];

// Strict SLurl pattern
const SLURL_RE = /(?:secondlife:\/\/|https?:\/\/maps\.secondlife\.com\/secondlife\/)[^\s"'<>]+/i;

if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function readCache() {
    try {
        if (!fs.existsSync(CACHE_FILE)) return null;
        const { timestamp, items } = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        if (Date.now() - timestamp > CACHE_TTL) return null;
        return items;
    } catch {
        return null;
    }
}

function writeCache(items) {
    try {
        fs.writeFileSync(
            CACHE_FILE,
            JSON.stringify({ timestamp: Date.now(), items }, null, 2)
        );
    } catch (err) {
        console.error('[Freebies Cache] Write error:', err.message);
    }
}

// ✅ ONLY extract SLurl from article "Location:" field
async function extractSlurl(articleUrl) {
    if (!articleUrl || !articleUrl.startsWith('http')) return null;

    try {
        const { data: html } = await axios.get(articleUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });

        const $ = cheerio.load(html);
        let slurl = null;

        $('strong').each((_, el) => {
            const text = $(el).text().trim().toLowerCase();

            if (text.includes('location')) {
                const link = $(el)
                    .parent()
                    .find('a[href*="maps.secondlife.com"], a[href^="secondlife://"]')
                    .first()
                    .attr('href');

                if (link && SLURL_RE.test(link)) {
                    slurl = link;
                    return false; // break loop
                }
            }
        });

        return slurl;

    } catch (err) {
        console.log(`[SLurl ERROR] ${articleUrl}: ${err.message}`);
        return null;
    }
}

async function scrapePage(page) {
    const url = page === 1 ? SITE_URL : `${SITE_URL}?page=${page}`;
    console.log(`[Freebies] Fetching page ${page}...`);

    const { data: html } = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 15000
    });

    const $     = cheerio.load(html);
    const items = [];

    $('article').each((i, item) => {
        const $item = $(item);

        let image =
            $item.find('div.thisistherealimage img.postDisplayedImage').attr('src') ||
            $item.find('div.thisistherealimage img').attr('data-src') ||
            $item.find('div.post-image img').attr('src') ||
            '';

        if (image && image.startsWith('//')) {
            image = 'https:' + image;
        }

        const titleLink = $item.find('.postTitleView a');
        const url       = titleLink.attr('href') || '';
        const title     = titleLink.text().trim();
        const desc      = $item.find('.post-description, .tCustomization_post_description').text().trim();
        const date      = $item.find('.tCustomization_post_metas span').first().text().trim();

        if (title && image) {
            items.push({
                title,
                url,
                image,
                desc,
                date,
                slurl: null
            });
        } else if (title) {
            console.log(`[Scraper Debug] No image found for: ${title}`);
        }
    });

    return items;
}

async function getGifts() {
    const cached = readCache();
    if (cached) {
        console.log('[Freebies] Cache hit');
        return cached;
    }

    // 1. Scrape listing pages
    const allItems = [];
    for (const page of PAGES) {
        try {
            const items = await scrapePage(page);
            allItems.push(...items);
            console.log(`[Freebies] Page ${page}: ${items.length} items`);
        } catch (err) {
            console.error(`[Freebies] Page ${page} failed:`, err.message);
        }
    }

    // 2. Deduplicate by URL
    const seen = new Set();
    const deduped = allItems.filter(item => {
        const cleanUrl = item.url.split('?')[0];
        if (seen.has(cleanUrl)) return false;
        seen.add(cleanUrl);
        return true;
    });

    // 3. Extract SLurls (batched)
    console.log(`[Freebies] Extracting SLurls for ${deduped.length} items...`);

    const BATCH = 5;
    for (let i = 0; i < deduped.length; i += BATCH) {
        const batch = deduped.slice(i, i + BATCH);

        await Promise.all(
            batch.map(async item => {
                item.slurl = await extractSlurl(item.url);

                if (item.slurl) {
                    console.log(`[Freebies] SLurl found: ${item.slurl}`);
                }
            })
        );
    }

    console.log(`[Freebies] Total after dedup: ${deduped.length}`);

    writeCache(deduped);
    return deduped;
}

module.exports = { getGifts };