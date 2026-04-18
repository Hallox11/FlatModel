'use strict';

/**
 * slScraper.js
 * ------------
 * Standalone module for scraping the Second Life Destination Guide.
 *
 * Usage:
 *   const slScraper = require('./slScraper');
 *
 *   // Scrape + cache a category
 *   const destinations = await slScraper.getDestinations({
 *       url: 'https://secondlife.com/destination-guide/art',
 *       tag: 'Art'
 *   });
 *
 *   // Load saved favorites
 *   const favorites = slScraper.getFavorites();
 */

const { chromium } = require('playwright');
const fs            = require('fs');
const path          = require('path');

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const CACHE_DIR        = path.join(__dirname, 'cache/sl');
const FAV_PATH         = path.join(CACHE_DIR, 'sl-fav.json');
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

    const stats = fs.statSync(file);
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

/**
 * Scrapes the SL Destination Guide for a given category URL.
 * Returns an array of destination objects, or [] on failure.
 *
 * @param {string} categoryUrl  Full URL of the SL destination guide page
 * @returns {Promise<Array>}
 */
async function scrapeSLDestinations(categoryUrl) {
    console.log(`[SL SCRAPE] Fetching: ${categoryUrl}`);

    const browser = await chromium.launch({ headless: true });
    const page    = await browser.newPage();

    try {
        await page.goto(categoryUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('.dg-collection-item', { timeout: 10000 });

        const results = await page.$$eval('.dg-collection-item', items =>
            items.map(item => {
                const titleNode  = item.querySelector('.dg2-destination-title-h2, .dg2-destination-title-h3');
                const title      = titleNode?.innerText.trim() || 'Unknown';
                const img        = item.querySelector('img.dg2-lg-feature-image');
                const thumbnail  = img?.getAttribute('data-src') || img?.src || '';
                const teleportUrl = `secondlife://${encodeURIComponent(title)}/128/128/2`;
                const desc       = item.querySelector('.dg-destination-description')?.innerText.trim() || '';

                return { title, desc, thumbnail, teleportUrl };
            })
        );

        await browser.close();

        // Drop entries with no thumbnail or broken SVG placeholders
        return results.filter(r => r.thumbnail && !r.thumbnail.includes('.svg'));

    } catch (err) {
        console.error('[SL SCRAPE] Error:', err.message);
        await browser.close();
        return [];
    }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Returns destinations for a given tag/category.
 * Checks the 48-hour cache first; scrapes live if stale or missing.
 *
 * @param {object} options
 * @param {string} options.url   Category URL on secondlife.com
 * @param {string} options.tag   Human-readable tag used as cache key (e.g. "Art")
 * @returns {Promise<Array>}
 */
async function getDestinations({ url, tag = 'General' }) {
    ensureCacheDir();

    // 1. Return cached data if still fresh
    const cached = loadCache(tag);
    if (cached) return cached;

    // 2. Nothing in cache (or stale) — scrape live
    if (!url) {
        console.warn('[SL SCRAPER] No URL provided and cache is empty for tag:', tag);
        return [];
    }

    const destinations = await scrapeSLDestinations(url);

    // 3. Persist to cache
    if (destinations.length > 0) saveCache(tag, destinations);

    return destinations;
}

/**
 * Forces a fresh scrape, ignoring the cache.
 *
 * @param {object} options
 * @param {string} options.url
 * @param {string} options.tag
 * @returns {Promise<Array>}
 */
async function refreshDestinations({ url, tag = 'General' }) {
    if (!url) return [];

    const destinations = await scrapeSLDestinations(url);
    if (destinations.length > 0) saveCache(tag, destinations);
    return destinations;
}

/**
 * Loads the SL favorites list from disk.
 * Returns [] if the file doesn't exist yet.
 *
 * @returns {Array}
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
 *
 * @param {Array} favorites
 */
function saveFavorites(favorites) {
    ensureCacheDir();
    fs.writeFileSync(FAV_PATH, JSON.stringify(favorites, null, 2));
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
    getDestinations,
    refreshDestinations,
    getFavorites,
    saveFavorites
};