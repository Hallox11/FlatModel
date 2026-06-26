'use strict';

/**
 * slScraper.js
 * ------------
 * Totalmente otimizado para Render.com utilizando Cheerio e Fetch nativo.
 * Carrega listas e busca teleports sob demanda em milissegundos sem usar Chromium.
 */

const fs      = require('fs');
const path    = require('path');
const cheerio = require('cheerio');

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const CACHE_DIR        = path.join(__dirname, 'cache/sl');
const FAV_PATH         = path.join(__dirname, 'config/sl/sl-fav.json');
const CACHE_EXPIRATION = 48 * 60 * 60 * 1000; // 48 horas
const USER_AGENT       = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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

// ─── CORE SCRAPER (CHEERIO VERSION) ───────────────────────────────────────────

async function scrapeSLDestinations(categoryUrl) {
    console.log(`[SL SCRAPE] Fetching listing via Cheerio (Ultra Fast): ${categoryUrl}`);

    try {
        const response = await fetch(categoryUrl, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(20000)
        });

        if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);
        
        const html = await response.text();
        const $ = cheerio.load(html);
        const results = [];

$('.dg-collection-item').each((index, element) => {
            const item = $(element);
            
            const titleNode = item.find('.dg2-destination-title-h2, .dg2-destination-title-h3');
            const title     = titleNode.text().trim() || 'Unknown';
            
            const img       = item.find('img.dg2-lg-feature-image');
            const thumbnail = img.attr('data-src') || img.attr('src') || '';
            
            const desc      = item.find('.dg-destination-description').text().trim() || '';
            
            // 🔥 CORREÇÃO AQUI: Garante que o link seja absoluto
            let detailLink = item.find('a').attr('href') || '';
            if (detailLink && detailLink.startsWith('/')) {
                detailLink = `https://secondlife.com${detailLink}`;
            }

            results.push({ title, desc, thumbnail, detailLink, teleportUrl: null });
        });

        const filtered = results.filter(r => r.thumbnail && !r.thumbnail.includes('.svg'));
        
        console.log(`[SL SCRAPE] Found ${filtered.length} destinations via HTML parsing.`);
        return filtered;

    } catch (err) {
        console.error('[SL SCRAPE] Fatal fetch error:', err.message);
        return [];
    }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Busca o teleport de forma instantânea processando apenas a string HTML.
 */
async function getTeleportOnDemand(detailLink) {
    if (!detailLink) return null;
    console.log(`[SL CHEERIO SCRAPE] Fetching SLurl on-demand for: ${detailLink}`);

    try {
        const response = await fetch(detailLink, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(12000)
        });

        if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);
        
        const html = await response.text();
        const $ = cheerio.load(html);

        // 1. Tenta extrair o link diretamente do botão principal CTA
        let slurl = $('#dg-entry-CTA a:nth-child(2)').attr('href') || null;

        // 2. Fallback: Varre todos os links da página procurando a assinatura da SL
        if (!slurl) {
            $('a[href]').each((index, element) => {
                const href = $(element).attr('href');
                if (href && (href.startsWith('secondlife://') || href.includes('maps.secondlife.com/secondlife/'))) {
                    slurl = href;
                    return false; // Interrompe o loop do Cheerio
                }
            });
        }

        // 3. Formata links HTTP da web diretamente no protocolo do visualizador in-world
        if (slurl && slurl.includes('maps.secondlife.com/secondlife/')) {
            slurl = slurl.replace(/^https:\/\/maps\.secondlife\.com\/secondlife\//i, 'secondlife://');
        }

        console.log(`[SL SCRAPE SUCCESS] Found destination address: ${slurl}`);
        return slurl;

    } catch (err) {
        console.error(`[SL SCRAPE] Failed to get teleport for ${detailLink}:`, err.message);
        return null;
    }
}

async function getDestinations({ url, tag = 'General' }) {
    ensureCacheDir();

    const cached = loadCache(tag);
    if (cached) return cached;

    if (!url) return [];

    const destinations = await scrapeSLDestinations(url);
    if (destinations.length > 0) saveCache(tag, destinations);
    return destinations;
}

async function refreshDestinations({ url, tag = 'General' }) {
    if (!url) return [];
    const destinations = await scrapeSLDestinations(url);
    if (destinations.length > 0) saveCache(tag, destinations);
    return destinations;
}

function getFavorites() {
    if (!fs.existsSync(FAV_PATH)) return [];
    try {
        return JSON.parse(fs.readFileSync(FAV_PATH, 'utf8'));
    } catch {
        return [];
    }
}

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
    getTeleportOnDemand,
    getFavorites,
    saveFavorites
};