'use strict';

const express        = require('express');
const router         = express.Router();
const axios          = require('axios');
const crypto         = require('crypto');
const fs             = require('fs');
const path           = require('path');

const slScraper      = require('./slScraper');
const xvideosScraper = require('./Xvideosscraper');
const eroticScraper  = require('./eroticScraper');
const youtubeScraper = require('./youtubeScraper');
const ytMusicScraper = require('./ytMusicScraper');

const MY_SECRET = process.env.MY_SECRET || "MyUltraSecret123"; // ⚠️ move to .env
const favPath   = path.join(__dirname, 'favorites.json');

if (!fs.existsSync(favPath)) fs.writeFileSync(favPath, JSON.stringify([]));

// Factory — receives shared state from sltv.js
module.exports = function createRouter({ io, db, tvRegistry, pendingTokens, clickerSessionMap, SESSION_TTL, FIXED_ROOM }) {


/////////////////////////////
// Rota para simular o comportamento da TV LSL

router.post('/dev/mock-tv', (req, res) => {
    console.log("[DEV MODE] TV recebeu comando:", req.body);
    res.status(200).send("OK");
});

    /////////////////////////////////////////////////
    // GET /api/tvs
    router.get('/api/tvs', (req, res) => {
        db.all(`SELECT * FROM tv_registry ORDER BY last_seen DESC`, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });

    // GET /api/interactions  (+ optional pagination: ?limit=100&offset=0)
    router.get('/api/interactions', (req, res) => {
        const limit  = parseInt(req.query.limit)  || 200;
        const offset = parseInt(req.query.offset) || 0;
        db.all(`SELECT * FROM interactions ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
            [limit, offset],
            (err, rows) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(rows);
            }
        );
    });

    /////////////////////////////////////////////////
    // REGISTER ENDPOINT (LSL Handshake)
    router.post('/register', async (req, res) => {
        const {
            secret, owner, creator, clicker, status, land_name,
            land_id, pos, object_id, serial, url
        } = req.body;

        const tvIp = tvRegistry[object_id]?.ip || null;

        console.log("***************************************");
        console.log(`[Register] object_id: ${object_id} | owner: ${owner} | status: ${status}`);
        console.log("***************************************");

        // 1. VALIDAÇÃO DO SEGREDO
        if (secret !== MY_SECRET) {
            console.warn(`[Security] Denied register attempt`);
            return res.status(403).send("Denied");
        }

        // 2. HISTÓRICO DE INTERAÇÕES
        db.run(
            `INSERT INTO interactions (owner, creator, clicker, status, land_name, land_id, pos, object_id, serial, url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [owner, creator, clicker, status, land_name, land_id, pos, object_id, serial, url],
            (err) => { if (err) console.error("[Interactions] DB Error:", err.message); }
        );

        // 3. MAPEAMENTO DE SESSÃO
        if (clicker && clicker !== "Unknown" && object_id) {
            clickerSessionMap.set(clicker, {
                object_id,
                expires: Date.now() + SESSION_TTL
            });
            io.to(FIXED_ROOM).emit('tv_registered', { clicker, object_id });
        }

        // 4. TV_OFF — skips verification
        if (!object_id || !url || status === 'TV_OFF') {
            console.log(`[Registry] TV_OFF or no URL — skipping verification for ${object_id}`);

            if (object_id) {
                tvRegistry[object_id] = { url, status, serial, owner, land: land_name, room: `room_${land_id}`, ip: tvIp };
                _upsertTv(db, { object_id, status, serial, url, owner, land_name, land_id, ip: tvIp });
                io.emit('tv_registered', { id: object_id, location: land_name });
            }

            return res.status(200).json({ status: "success", target_id: object_id });
        }

        // 5. CALLBACK À TV — verifica se o segredo e owner batem certo
        try {
            console.log(`[Verify] Calling back TV ${object_id} at ${url}`);

            const verifyResponse = await axios.post(url, `verify|${MY_SECRET}:${owner}`, {
                headers: { 'Content-Type': 'text/plain' },
                timeout: 10000
            });

            if (verifyResponse.data !== 'VERIFIED') {
                console.warn(`[Verify] ❌ TV ${object_id} not verified:`, verifyResponse.data);
                return res.status(403).send("Verification failed");
            }

            console.log(`[Verify] ✅ TV ${object_id} verified OK`);

            // 6. REGISTO EM MEMÓRIA
            tvRegistry[object_id] = { url, status, serial, owner, land: land_name, room: `room_${land_id}`, ip: tvIp };

            // 7. EMIT tv_registered
            io.emit('tv_registered', { id: object_id, location: land_name });
            if (clicker && clicker !== "Unknown") {
                io.to(FIXED_ROOM).emit('tv_registered', { clicker, object_id });
            }

            // 8. PERSISTÊNCIA NO SQLite
            _upsertTv(db, { object_id, status, serial, url, owner, land_name, land_id, ip: tvIp });

            // 9. GERA TOKEN ONE-TIME
            const token = crypto.randomBytes(16).toString('hex');
            pendingTokens[token] = { object_id, owner, expires: Date.now() + 30000 };
            console.log(`[Token] Generated for ${object_id}: ${token}`);

            return res.status(200).json({ status: "success", target_id: object_id, token });

        } catch (err) {
            console.warn(`[Verify] ❌ TV ${object_id} unreachable:`, err.message);
            return res.status(403).send("Verification failed - TV unreachable");
        }
    });

    /////////////////////////////////////////////////
    // VALIDATE TOKEN
    router.get('/validate-token', (req, res) => {
        const { token } = req.query;

        if (!token || !pendingTokens[token]) {
            return res.status(403).json({ valid: false });
        }

        if (Date.now() > pendingTokens[token].expires) {
            delete pendingTokens[token];
            return res.status(403).json({ valid: false, reason: "expired" });
        }

        const entry = pendingTokens[token];
        delete pendingTokens[token];

        res.status(200).json({ valid: true, object_id: entry.object_id, owner: entry.owner });
    });

    /////////////////////////////////////////////////
    // GET SESSION ID
    router.get('/get-session-id', (req, res) => {
        const clicker = req.query.clicker;

        if (!clicker) return res.status(400).json({ error: "Missing clicker param" });

        const session = clickerSessionMap.get(clicker);

        if (!session || Date.now() > session.expires) {
            clickerSessionMap.delete(clicker);
            return res.status(404).json({ error: "No active session" });
        }

        res.json({ target_id: session.object_id });
    });

    /////////////////////////////////////////////////
    // ACTIVATE (legacy — keeps compatibility)
    let activeTvs    = {};
    let global_TV_Url;

    router.post('/activate', (req, res) => {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const { TV_url, clicker } = req.body;
        global_TV_Url = TV_url;
        activeTvs[ip] = TV_url;
        console.log(`[Status] TV de ${clicker} pronta na URL ${TV_url}`);
        res.sendStatus(200);
    });

    // SEND COMMAND
    // ✅ Fixed: prefers object_id lookup in tvRegistry; falls back to global_TV_Url for legacy clients
    router.post('/send-command', async (req, res) => {
        const { object_id, command, value } = req.body;
        console.log("Command sent:", command, "| Value:", value, "| Target:", object_id || 'global');

        let targetUrl;

        if (object_id && tvRegistry[object_id]?.url) {
            targetUrl = tvRegistry[object_id].url;
        } else {
            targetUrl = global_TV_Url;
        }

        if (!targetUrl) {
            return res.status(404).send("Nenhuma TV ativa encontrada.");
        }

        try {
            await axios.post(targetUrl, `${command}|${value}`, {
                headers: { 'Content-Type': 'text/plain' }
            });
            res.send({ success: true });
        } catch (error) {
            console.error("[Command Error]", error.message);
            res.status(500).send("Erro ao enviar para o Second Life.");
        }
    });

    ///////////////////////////////////////////////////////
    // MAIN PAGE
    router.get('/', (req, res) => {
        res.render('pages/index');
    });

    router.get('/tv-dashboard', (req, res) => res.render('pages/tv-dashboard'));

    ////////////////////////////////////////////////////////////////////////////
    // RADIOS
    router.get('/radios-menu',          (req, res) => res.render('pages/radios-menu'));
    router.get('/radios/sl-radio',      (req, res) => res.render('pages/radios/sl-radio'));
    router.get('/radios/inter-radio',   (req, res) => res.render('pages/radios/inter-radio'));
    router.get('/radios/pt',            (req, res) => res.render('pages/radios/pt'));
    router.get('/radios/nz',            (req, res) => res.render('pages/radios/nz'));
    router.get('/radios/es',            (req, res) => res.render('pages/radios/es'));
    router.get('/radios/br',            (req, res) => res.render('pages/radios/br'));
    router.get('/radios/uk',            (req, res) => res.render('pages/radios/uk'));
    router.get('/radios/fr',            (req, res) => res.render('pages/radios/fr'));
    router.get('/radios/it',            (req, res) => res.render('pages/radios/it'));
    router.get('/radios/mr',            (req, res) => res.render('pages/radios/mr'));

    //////////////////////////////////////////////////////////////////////////
    // MUSIC
    router.get('/music-menu', (req, res) => res.render('pages/music-menu'));

    router.get('/music-grid', async (req, res) => {
        const query     = req.query.genre || req.query.q || 'Blues';
        const scrollPos = req.query.scrollPos || 0;
        const menu      = req.query.menu || '/music-menu';

        try {
            const musicResults  = await ytMusicScraper.getMusic(query);
            const playableMusic = musicResults;

            res.render('pages/generic_grid', {
                title:       `Music: ${query.toUpperCase()}`,
                type:        "music",
                searchQuery: query,
                scrollPos,
                menu,
                req,
                results: playableMusic.map(m => ({
                    id:        m.videoId,
                    title:     m.title,
                    thumbnail: m.thumbnail,
                    subtitle:  m.subtitle,
                    badge:     "MUSIC"
                }))
            });
        } catch (err) {
            console.error("❌ Music Route Error:", err);
            res.status(500).send("Error loading music.");
        }
    });

    //////////////////////////////////////////////////////////////////////////
    // MOVIES
    router.get('/movies-menu', (req, res) => res.render('pages/movies-menu'));

    router.get('/movies-grid', async (req, res) => {
        console.log('[movies-grid] params:', req.query);
        const query     = req.query.genre || 'full movies action';
        const scrollPos = req.query.scrollPos || 0;
        const menu      = req.query.menu || '/movies-menu';

        try {
            const results = await youtubeScraper.getVideos(query, false);

            res.render('pages/generic_grid', {
                title:       `Cinema: ${query.toUpperCase()}`,
                type:        "movies",
                searchQuery: query,
                scrollPos,
                menu,
                req,
                results: results.map(m => ({
                    id:        m.videoId,
                    title:     m.title,
                    thumbnail: m.thumbnail,
                    subtitle:  m.channel,
                    badge:     "MOVIE"
                }))
            });
        } catch (err) {
            console.error("❌ Movies Route Error:", err);
            res.status(500).send("Error loading movies via YouTube.");
        }
    });

    ///////////////////////////////////////////////////////////////////
    // YOUTUBE
    router.get('/youtube-menu', (req, res) => {
        res.render('pages/youtube-menu', { title: "YouTube Search", req });
    });

    router.get('/youtube-grid', async (req, res) => {
        const query = req.query.genre || 'Trending';
        const menu  = req.query.menu  || '/youtube-menu';

        try {
            const results = await youtubeScraper.getVideos(query, false);

            res.render('pages/generic_grid', {
                title:       `YouTube: ${query}`,
                type:        "youtube",
                searchQuery: query,
                menu,
                results: results.map(v => ({
                    id:        v.videoId,
                    title:     v.title,
                    thumbnail: v.thumbnail,
                    subtitle:  v.channel,
                    badge:     "YT"
                }))
            });
        } catch (err) {
            res.status(500).send("Erro na busca do YouTube");
        }
    });

    router.get('/youtube', async (req, res) => {
        let favoritesData = [];
        const ytFavPath   = path.join(__dirname, 'config', 'YT-favorites.json');
        const tag         = req.query.tag      || 'secondlife';
        const isChannel   = req.query.isChannel === 'true';
        const scrollPos   = req.query.scrollPos || 0;

        try {
            if (fs.existsSync(ytFavPath)) {
                const raw = fs.readFileSync(ytFavPath, 'utf8').trim();
                if (raw) favoritesData = JSON.parse(raw);
            }

            const videos = await youtubeScraper.getVideos(tag, isChannel);

            res.render('pages/youtube', {
                videos, favorites: favoritesData, tag, isChannel, scrollPos, req
            });
        } catch (err) {
            console.error("❌ ROUTE ERROR:", err.message);
            res.render('pages/youtube', { videos: [], favorites: favoritesData, tag, isChannel, scrollPos, req });
        }
    });

    router.get('/youtube-favorites', async (req, res) => {
        try {
            const ytFavPath = path.join(__dirname, 'config', 'YT-favorites.json');
            const favorites = JSON.parse(fs.readFileSync(ytFavPath, 'utf8'));
            res.render('fragments/youtube-favorites-menu', { favorites, room: req.query.room });
        } catch (err) {
            res.status(500).send("Error loading favorites");
        }
    });

    router.get('/youtube/refresh', async (req, res) => {
        const tag       = req.query.tag || 'secondlife';
        const isChannel = req.query.isChannel === 'true';
        const cacheDir  = path.join(__dirname, 'cache/youtube');
        const prefix    = isChannel ? 'chan' : 'tag';
        const safeQuery = tag.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const cacheFile = path.join(cacheDir, `yt_${prefix}_${safeQuery}.json`);

        if (fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile);
        res.redirect(`/youtube?tag=${encodeURIComponent(tag)}&isChannel=${isChannel}`);
    });

    router.get('/api/quota', (req, res) => {
        const quotaPath = path.join(__dirname, 'cache/youtube/quota.json');
        if (!fs.existsSync(quotaPath)) return res.json({ used: 0, remaining: 10000 });
        const q = JSON.parse(fs.readFileSync(quotaPath, 'utf8'));
        res.json({ used: q.used, remaining: 10000 - q.used, date: q.date });
    });

    ///////////////////////////////////////////////////////////////////
    // SEVERAL ENDPOINTS
    router.get('/api/backgrounds', (req, res) => {
        const dir = path.join(__dirname, 'backgrounds');
        fs.readdir(dir, (err, files) => {
            if (err) return res.status(500).send([]);
            const images = files
                .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
                .map(f => '/backgrounds/' + f);
            res.json(images);
        });
    });

    router.get('/help',     (req, res) => res.render('pages/help'));
    router.get('/browsers', (req, res) => res.render('pages/browsers'));

const axios = require('axios'); // Certifique-se de que o axios está instalado

// 1. Rota para carregar a página
router.get('/flickr', (req, res) => {
    res.render('pages/flickr', {
        theme: 'goldenrod'
    });
});

// 2. Rota da API de Busca (Onde o erro 500 acontece)
router.get('/api/flickr/search', async (req, res) => {
    const { tags } = req.query;
    
    // Teste direto com a string (sem process.env)
    const TEST_KEY = 'c90dea5c7207bea531ac489747938f44'; 

    try {
        const response = await axios.get('https://www.flickr.com/services/rest/', {
            params: {
                method: 'flickr.photos.search',
                api_key: TEST_KEY, // Use a variável de teste aqui
                text: tags,
                format: 'json',
                nojsoncallback: 1,
                per_page: 50,
                sort: 'interestingness-desc'
            }
        });
        console.log(response)
        res.json(response.data.photos.photo);
    } catch (error) {
        console.error("ERRO REAL:", error.message);
        res.status(500).json({ error: error.message });
    }
});

    router.get('/settings', (req, res) => {
        const isAjax    = req.xhr || req.headers.accept.indexOf('json') > -1;
        const fullBaseUrl = `https://${req.get('host')}`;
        const userIp    = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        let tvId = req.query.tv;
        if (!tvId) {
            const foundTvId = Object.keys(tvRegistry).find(id => tvRegistry[id].ip === userIp);
            if (foundTvId) {
                tvId = foundTvId;
                console.log(`[Settings] Auto-detected TV: ${tvId} via IP: ${userIp}`);
            }
        }

        if (isAjax) {
            return res.render('pages/settings', { baseUrl: fullBaseUrl, tvId, layout: false });
        } else {
            return res.render('pages/index', { baseUrl: fullBaseUrl });
        }
    });

    ///////////////////////////////////////////////////////////
    // FLICKR FAVORITES
    router.get('/api/favorites', async (req, res) => {
        try {
            const data = await fs.promises.readFile(favPath, 'utf8');
            res.json(JSON.parse(data));
        } catch (err) {
            res.status(500).send("Error reading favorites");
        }
    });

    router.post('/api/favorites/channels', (req, res) => {
        const { name, id } = req.body;
        let data = JSON.parse(fs.readFileSync(favPath));
        if (Array.isArray(data) || !data) data = {};
        data[name] = id;
        fs.writeFileSync(favPath, JSON.stringify(data, null, 2));
        res.json({ success: true });
    });

    ///////////////////////////////////////////////////////////////////
    // XXX
    router.get('/xxx-check',    (req, res) => res.render('pages/xxx-check'));
    router.get('/xxx-index',    (req, res) => res.render('pages/xxx-index'));
    router.get('/xxx-browsers', (req, res) => res.render('pages/xxx-browsers'));

router.get('/xvideos-grid', async (req, res) => {
    // 1. Pegamos a tag da URL ou usamos 'Hardcore' como padrão
    const { tag = 'Hardcore' } = req.query; 
    
    // 2. Caminho para o seu novo arquivo de favoritos
    const xxxFavPath = path.join(__dirname, 'config/xxx-fav.json'); 

    let XXX_CATEGORIES = [];

    try {
        // 3. Carregar as categorias do JSON (Isso substitui o getCategories que deu erro)
        if (fs.existsSync(xxxFavPath)) {
            const rawData = fs.readFileSync(xxxFavPath, 'utf8');
            const favs = JSON.parse(rawData);
            XXX_CATEGORIES = favs.map(f => f.tag || f.name);
        } else {
            // Se o arquivo não existir, usamos estas para não quebrar a tela
            XXX_CATEGORIES = ["Hardcore", "Amateur", "Anal", "Asian"];
        }

        // 4. CHAMADA AO SCRAPER (Atenção ao nome da variável!)
        // Note que aqui usamos APENAS o getVideos, que é o que você já tinha funcionando
       
        const videos = await xvideosScraper.getVideos(tag);

        // 5. Renderizar a página
        res.render('pages/xvideos', { 
            videos, 
            tag, 
            XXX_CATEGORIES 
        });

    } catch (err) {
        console.error('[XXX Route] Erro Crítico:', err);
        res.status(500).send('Erro ao carregar vídeos: ' + err.message);
    }
});

    router.get('/get-xxx-stream', async (req, res) => {
        const streamUrl = await xvideosScraper.getStream(req.query.url);
        if (streamUrl) return res.json({ streamUrl });
        res.status(500).send();
    });

    router.get('/xxx-player', (req, res) => {
        res.render('pages/xxx_player', { stream: req.query.stream, title: req.query.title });
    });

    ///////////////////////////////////////////////////////////////////
    // EROTIC MOVIES
    router.get('/erotic-grid', async (req, res) => {
        try {
            const videos = await eroticScraper.getEroticVideos('https://eroticmv.com/category/genre/classic-erotica/');
            res.render('pages/eroticVideos', { videos, tag: 'Erotic Movies' });
        } catch (err) {
            console.error('[Erotic Route] Error:', err);
            res.status(500).send('Failed to load erotic movies.');
        }
    });

    ///////////////////////////////////////////////////////////////////
    // SECOND LIFE DESTINATIONS
    router.get('/sl-destinations', async (req, res) => {
        const { url, tag = 'General' } = req.query;
        try {
            const [destinations, favorites] = await Promise.all([
                slScraper.getDestinations({ url, tag }),
                Promise.resolve(slScraper.getFavorites())
            ]);
            res.render('pages/sl_grid', { destinations, tag, favorites });
        } catch (err) {
            console.error('[SL Route] Error:', err);
            res.status(500).send('Failed to load destinations.');
        }
    });

    ///////////////////////////////////////////////////////////////////
    // PLAYER
    router.get('/tvytube', (req, res) => {
        const videoId    = req.query.videoId   || '';
        const scrollPos  = req.query.scrollPos || 0;
        const origin     = req.query.origin    || 'youtube';
        const targetID   = req.query.targetID  || req.query.tag || videoId;
        const targetMode = req.query.targetMode || 'user';
        const menu       = req.query.menu      || '';

        console.log(`[Player Sync] Mode: ${origin} | ID: ${videoId} | Context: ${targetID}`);

        res.render('pages/tvytube', { videoId, targetID, targetMode, scrollPos, origin, menu });
    });

    return router;
};

///////////////////////////////////////////////////////////////////
// Helper: upsert TV in SQLite
function _upsertTv(db, { object_id, status, serial, url, owner, land_name, land_id, ip }) {
    db.run(`
        INSERT INTO tv_registry (object_id, status, serial, url, owner, land, room, ip, last_seen)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(object_id) DO UPDATE SET
            status    = excluded.status,
            serial    = excluded.serial,
            url       = excluded.url,
            owner     = excluded.owner,
            land      = excluded.land,
            room      = excluded.room,
            ip        = excluded.ip,
            last_seen = CURRENT_TIMESTAMP
    `, [object_id, status, serial, url, owner, land_name, `room_${land_id}`, ip],
    (err) => {
        if (err) console.error("[Registry] DB Error:", err.message);
        else console.log(`[Registry] TV ${object_id} synced`);
    });
}
