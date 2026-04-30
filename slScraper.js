'use strict';

/**
 * slScraper.js
 * ------------
 * Scrapes the Second Life Destination Guide.
 * - Listing page: gets title, thumbnail, desc, detail link
 * - Detail page:  gets the real teleport SLurl from #dg-entry-CTA
 */

const { chromium } = require('playwright');
const fs            = require('fs');
const path          = require('path');

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const CACHE_DIR        = path.join(__dirname, 'cache/sl');
const FAV_PATH         = path.join(__dirname, 'config/sl/sl-fav.json');
const CACHE_EXPIRATION = 48 * 60 * 60 * 1000; // 48 hours

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function ensureCacheDir() {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function cacheFilePath(tag) {
    const safeTag = tag.replace(/\s+/g, '_').toLowerCase();
    return path.join(CACHE_DIR, `sl_${safeTag}.json`);
}

function loadCache(tag) {
    const file = cacheFilePath(tag);
    if (!fs.existsSync(file)) return null;

    const stats   = fs.statSync(file);
    const isFresh = (Date.now() - stats.mtimeMs) < CACHE_EXPIRATION;
    if (!isFresh) return null;

    try {
        console.log(`[SL CACHE] Hit: ${tag}`);
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

async function scrapeSLDestinations(categoryUrl) {
    console.log(`[SL SCRAPE] Fetching listing: ${categoryUrl}`);

    const browser = await chromium.launch({ headless: true });
    const page    = await browser.newPage();

    try {
        // ── STEP 1: Scrape the listing page ──────────────────
        await page.goto(categoryUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('.dg-collection-item', { timeout: 10000 });

        const results = await page.$$eval('.dg-collection-item', items =>
            items.map(item => {
                const titleNode = item.querySelector('.dg2-destination-title-h2, .dg2-destination-title-h3');
                const title     = titleNode?.innerText.trim() || 'Unknown';
                const img       = item.querySelector('img.dg2-lg-feature-image');
                const thumbnail = img?.getAttribute('data-src') || img?.src || '';
                const desc      = item.querySelector('.dg-destination-description')?.innerText.trim() || '';
                const detailLink = item.querySelector('a')?.href || '';

                return { title, desc, thumbnail, detailLink, teleportUrl: null };
            })
        );

        // Drop entries without thumbnail or broken SVG placeholders
        const filtered = results.filter(r => r.thumbnail && !r.thumbnail.includes('.svg'));

        console.log(`[SL SCRAPE] Found ${filtered.length} destinations — fetching SLurls...`);

        // ── STEP 2: Visit each detail page to get the real SLurl ──
        for (const dest of filtered) {
            if (!dest.detailLink) continue;

            try {
                await page.goto(dest.detailLink, {
                    waitUntil: 'domcontentloaded',
                    timeout: 15000
                });

                // The CTA block has two links:
                // [0] = "Visit on Web" or similar
                // [1] = the actual secondlife:// teleport link
                const slurl = await page.$eval(
                    '#dg-entry-CTA a:nth-child(2)',
                    el => el.href
                ).catch(() => null);

                // Fallback: scan all links for a secondlife:// href
                if (!slurl) {
                    const fallback = await page.$$eval('a[href]', links => {
                        const match = links.find(l =>
                            l.href.startsWith('secondlife://') ||
                            l.href.includes('maps.secondlife.com/secondlife/')
                        );
                        return match ? match.href : null;
                    }).catch(() => null);

                    dest.teleportUrl = fallback;
                } else {
                    dest.teleportUrl = slurl;
                }

                if (dest.teleportUrl) {
                    console.log(`[SL SCRAPE] ✓ SLurl for "${dest.title}": ${dest.teleportUrl}`);
                } else {
                    console.log(`[SL SCRAPE] ✗ No SLurl found for "${dest.title}"`);
                }

            } catch (err) {
                console.warn(`[SL SCRAPE] Detail page failed for "${dest.title}":`, err.message);
                dest.teleportUrl = null;
            }
        }

        await browser.close();
        return filtered;

    } catch (err) {
        console.error('[SL SCRAPE] Fatal error:', err.message);
        await browser.close();
        return [];
    }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Returns destinations for a given tag/category.
 * Checks the 48-hour cache first; scrapes live if stale or missing.
 */
async function getDestinations({ url, tag = 'General' }) {
    ensureCacheDir();

    const cached = loadCache(tag);
    if (cached) return cached;

    if (!url) {
        console.warn('[SL SCRAPER] No URL provided and cache is empty for tag:', tag);
        return [];
    }

    const destinations = await scrapeSLDestinations(url);
    if (destinations.length > 0) saveCache(tag, destinations);
    return destinations;
}

/**
 * Forces a fresh scrape, ignoring the cache.
 */
async function refreshDestinations({ url, tag = 'General' }) {
    if (!url) return [];
    const destinations = await scrapeSLDestinations(url);
    if (destinations.length > 0) saveCache(tag, destinations);
    return destinations;
}

/**
 * Loads the SL favorites list from disk.
 */
function getFavorites() {
    if (!fs.existsSync(FAV_PATH)) return [];
    try {
        return JSON.parse(fs.readFileSync(FAV_PATH, 'utf8'));
    } catch {
        return [];
    }
}

/**
 * Saves a favorites list to disk.
 */
function saveFavorites(favorites) {
    ensureCacheDir();
    const dir = path.dirname(FAV_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FAV_PATH, JSON.stringify(favorites, null, 2));
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
    getDestinations,
    refreshDestinations,
    getFavorites,
    saveFavorites
};