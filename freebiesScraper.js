'use strict';

const axios   = require('axios');
const cheerio = require('cheerio');
const path    = require('path');
const fs      = require('fs');

const CACHE_DIR  = path.join(__dirname, 'cache/freebies');
const CACHE_FILE = path.join(CACHE_DIR, 'freebies.json');
const CACHE_TTL  = 30 * 60 * 1000; 
const SITE_URL   = 'https://www.scoop.it/topic/second-life-freebies-und-mehr';
const PAGES      = [1, 2, 3, 4];

const SLURL_RE = /(?:secondlife:\/\/|https?:\/\/maps\.secondlife\.com\/secondlife\/)[^\s"'<>]+/i;

const HUMAN_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
};

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

function readCache() {
    try {
        if (!fs.existsSync(CACHE_FILE)) return null;
        const { timestamp, items } = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        return (Date.now() - timestamp > CACHE_TTL) ? null : items;
    } catch { return null; }
}

function writeCache(items) {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify({ timestamp: Date.now(), items }, null, 2));
    } catch (err) { console.error('[Cache Error]:', err.message); }
}

/**
 * ESTA FUNÇÃO SÓ DEVE SER CHAMADA PELA ROTA DA API QUANDO CLICAM NO BOTÃO
 */
async function extractSlurl(articleUrl) {
    try {
        const response = await axios.get(articleUrl, {
            headers: {
                // Identifica o scraper como um Chrome no Windows
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.teleporthub.com/category/freebies-2/' 
            },
            timeout: 10000 // 10 segundos de limite
        });

        const html = response.data;
        // Aqui continuas com a tua lógica de extrair o link (regex ou cheerio)
        const slurlMatch = html.match(/secondlife:\/\/app\/teleport\/[^\s"']+/);
        
        return slurlMatch ? slurlMatch[0] : null;

    } catch (err) {
        if (err.response && err.response.status === 403) {
            console.error("ERRO 403: O site bloqueou o scraper. Verifica os Headers.");
        } else {
            console.error("Erro ao extrair SLURL:", err.message);
        }
        return null;
    }
}

async function scrapePage(page) {
    const url = page === 1 ? SITE_URL : `${SITE_URL}?page=${page}`;
    const { data: html } = await axios.get(url, { headers: HUMAN_HEADERS });
    const $ = cheerio.load(html);
    const items = [];

    $('article').each((i, item) => {
        const $item = $(item);
        let image = $item.find('img.postDisplayedImage').attr('src') || 
                    $item.find('img').attr('data-src') || '';
        if (image.startsWith('//')) image = 'https:' + image;

        const titleLink = $item.find('.postTitleView a');
        const desc = $item.find('.post-description, .tCustomization_post_description').text().trim();

        if (titleLink.text()) {
            items.push({
                title: titleLink.text().trim(),
                url: titleLink.attr('href') || '',
                image: image,
                desc: desc,
                date: $item.find('.tCustomization_post_metas span').first().text().trim(),
                slurl: null // SEMPRE NULL NO SCRAP INICIAL
            });
        }
    });
    return items;
}

/**
 * SCRAPER PRINCIPAL: Rápido e sem acessos a sites externos bloqueados
 */
async function getGifts() {
    const cached = readCache();
    if (cached) return cached;

    let allItems = [];
    for (const page of PAGES) {
        try {
            const pageItems = await scrapePage(page);
            allItems.push(...pageItems);
        } catch (err) { console.error(`Erro Scoop.it pág ${page}`); }
    }

    const seen = new Set();
    const deduped = allItems.filter(item => {
        const id = item.url.split('?')[0];
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    });

    // Removida toda a lógica de loops/batches e extractSlurl daqui!
    console.log(`[Freebies] Cache atualizado com ${deduped.length} itens.`);
    
    writeCache(deduped);
    return deduped;
}

module.exports = { getGifts, extractSlurl };