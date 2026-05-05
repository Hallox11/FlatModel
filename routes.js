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
const flickrController = require('./flickrController');
const freebiesScraper = require('./freebiesScraper');


const MY_SECRET = process.env.MY_SECRET || "MyUltraSecret123"; // ⚠️ move to .env

const radioFavPath = path.join(__dirname, 'config', 'favorites-radios.json');
// Ensure the config folder and file exist
if (!fs.existsSync(path.join(__dirname, 'config'))) fs.mkdirSync(path.join(__dirname, 'config'));
if (!fs.existsSync(radioFavPath)) fs.writeFileSync(radioFavPath, JSON.stringify([]));

const flickrFav   = path.join(__dirname, 'config','flickr','flickr-fav.json');
if (!fs.existsSync(flickrFav)) fs.writeFileSync(flickrFav, JSON.stringify([]));

// Factory — receives shared state from sltv.js
module.exports = function createRouter({ io, db, tvRegistry, pendingTokens, clickerSessionMap, SESSION_TTL, FIXED_ROOM }) {

// ── RADIO FAVORITES ENDPOINT ────────────────────────────────
router.post('/radio-favorites', (req, res) => {
    const newStation = req.body;
    
    // 1. Get the country code from the station object (fallback to 'unknown')
    // Radio-browser API usually provides 'countrycode' (e.g., "PT", "BR")
    const countryCode = (newStation.countrycode || 'unknown').toLowerCase();
    
    // 2. Define the path: config/favorites/radios/pt.json
    const dirPath = path.join(__dirname, 'config', 'favorites', 'radios');
    const filePath = path.join(dirPath, `${countryCode}.json`);

    // 3. Ensure the folder structure exists
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    // 4. Read the specific country file
    fs.readFile(filePath, 'utf8', (err, data) => {
        let favorites = [];
        
        if (!err && data) {
            try {
                favorites = JSON.parse(data);
            } catch (parseErr) {
                favorites = [];
            }
        }

        // 5. Duplicate check within that country
        const exists = favorites.some(f => f.url_resolved === newStation.url_resolved);

        if (!exists) {
            favorites.push(newStation);
            fs.writeFile(filePath, JSON.stringify(favorites, null, 2), (writeErr) => {
                if (writeErr) {
                    console.error("[Radio Save] Write Error:", writeErr);
                    return res.status(500).json({ error: "Failed to save" });
                }
                res.json({ message: `Saved to ${countryCode}.json!` });
            });
        } else {
            res.status(400).json({ message: "Station already in favorites." });
        }
    });
});

router.get('/games-menu',    (req, res) => res.render('pages/games/games-menu'));
router.get('/quiz',          (req, res) => res.render('pages/games/quiz'));
router.get('/truth-or-myth', (req, res) => res.render('pages/games/truth-or-myth'));
router.get('/who-am-i',      (req, res) => res.render('pages/games/who-am-i'));
router.get('/this-or-that',  (req, res) => res.render('pages/games/this-or-that'));

// 1. Página principal de Freebies
router.get('/freebies', (req, res) => res.render('pages/freebies'));

// 2. API para listar os presentes (Gifts)
router.get('/api/freebies', async (req, res) => {
    try {
        // Usa a variável que já foi declarada no topo do ficheiro
        const items = await freebiesScraper.getGifts();
        res.json(items);
    } catch (err) {
        console.error('[Freebies Route] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 3. API para extrair o Teleport (SLURL)
// CORRIGIDO: de 'routers' para 'router'
router.get('/api/freebies/teleport', async (req, res) => {
    try {
        const { articleUrl } = req.query;
        
        if (!articleUrl) {
            return res.status(400).json({ error: "URL do artigo em falta" });
        }

        // Não faças 'require' aqui dentro de novo. 
        // Usa a variável 'freebiesScraper' que já tens no topo do ficheiro.
        const slurl = await freebiesScraper.extractSlurl(articleUrl);

        if (slurl) {
            res.json({ teleportUrl: slurl });
        } else {
            res.json({ teleportUrl: null });
        }
    } catch (err) {
        console.error("ERRO NO TELEPORT SCRAPER:", err.message);
        res.status(500).json({ error: "Erro ao extrair o link de teleport" });
    }
});

// ============================================================
// ADD TO routes.js
// ============================================================

// ── LIVE TV PAGE ─────────────────────────────────────────────
router.get('/live-tv', (req, res) => res.render('pages/live-tv'));

// ── HLS PROXY ────────────────────────────────────────────────
router.get('/hls-proxy', async (req, res) => {
    const streamUrl = req.query.url;
    if (!streamUrl) return res.status(400).send('Missing url param');

    try {
        const response = await axios.get(streamUrl, {
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; IPTV-Player)',
                'Referer': streamUrl,
                'Origin': new URL(streamUrl).origin
            }
        });

        const contentType = response.headers['content-type'] || '';

        if (streamUrl.endsWith('.m3u8') || contentType.includes('mpegurl') || contentType.includes('x-mpegURL')) {
            let playlist = Buffer.from(response.data).toString('utf-8');
            const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1);

            playlist = playlist.replace(/^(?!#)(.+\.m3u8.*)$/gm, (match) => {
                const absolute = match.startsWith('http') ? match : baseUrl + match;
                return `/hls-proxy?url=${encodeURIComponent(absolute)}`;
            });
            playlist = playlist.replace(/^(?!#)(.+\.ts.*)$/gm, (match) => {
                const absolute = match.startsWith('http') ? match : baseUrl + match;
                return `/hls-proxy?url=${encodeURIComponent(absolute)}`;
            });

            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'no-cache');
            return res.send(playlist);
        }

        res.setHeader('Content-Type', contentType || 'video/mp2t');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(Buffer.from(response.data));

    } catch (err) {
        console.error('[HLS Proxy] Error:', err.message);
        res.status(502).send('Stream unavailable');
    }
});

// ── CHANNELS FROM JSON ───────────────────────────────────────
// Reads channels.json, returns only active:true entries.
// Edit channels.json to add/remove/toggle channels — no restart needed.
const CHANNELS_PATH = path.join(__dirname, 'channels.json');

router.get('/api/channels', (req, res) => {
    try {
        const raw      = fs.readFileSync(CHANNELS_PATH, 'utf-8');
        const all      = JSON.parse(raw);
        const active   = all.filter(ch => ch.active !== false);
        res.json(active);
    } catch (err) {
        console.error('[Channels] Failed to read channels.json:', err.message);
        res.status(500).json({ error: 'Could not load channels' });
    }
});

/////////////////////////////
// Rota para simular o comportamento da TV LSL
/*
router.post('/dev/mock-tv', (req, res) => {
    console.log("[DEV MODE] TV recebeu comando:", req.body);
    res.status(200).send("OK");
});
*/
router.get('/game-stream', (req, res) => {
    res.render('pages/game-stream');  // renders views/game-stream.ejs
    // OR if you serve EJS fragments directly as HTML:
    // res.sendFile(path.join(__dirname, 'views', 'game-stream.ejs'));
});
////////////////77
////////////////////////////////////////////////////
// Gera um token temporário só para a stream cam
router.get('/stream-cam', (req, res) => {
    const token = crypto.randomBytes(16).toString('hex');
    pendingTokens[token] = { 
        owner: 'stream-cam',
        object_id: 'stream-cam',
        expires: Date.now() + 5 * 60 * 1000 
    };
    // Redireciona para a página principal com o token no URL
    // O myScripts.js vai validar e permitir acesso normalmente
    res.redirect(`/?token=${token}&goto=stream-cam`);
});
router.get('/stream-cam-page', (req, res) => {
    const room = req.query.room || 'Lobby';
    res.render('pages/stream-cam', { room });
});



    /////////////////////////////////////////////////
    // GET /api/tvs
    router.get('/api/tvs', (req, res) => {
        try {
            const rows = db.prepare(`SELECT * FROM tv_registry ORDER BY last_seen DESC`).all();
            res.json(rows);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // GET /api/interactions  (+ optional pagination: ?limit=100&offset=0)
    router.get('/api/interactions', (req, res) => {
        const limit  = parseInt(req.query.limit)  || 200;
        const offset = parseInt(req.query.offset) || 0;
        try {
            const rows = db.prepare(`SELECT * FROM interactions ORDER BY timestamp DESC LIMIT ? OFFSET ?`).all(limit, offset);
            res.json(rows);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    /////////////////////////////////////////////////
    // REGISTER ENDPOINT (LSL Handshake)
router.post('/register', async (req, res) => {
    const {
        secret, owner, creator, clicker, status, land_name,
        land_id, pos, object_id, serial, url
    } = req.body;

    const tvIp = tvRegistry[object_id]?.ip || req.ip;

    console.log("***************************************");
    console.log(`[Register] object_id: ${object_id} | owner: ${owner} | status: ${status}`);
    console.log("***************************************");

    // 1. VALIDAÇÃO DO SEGREDO
    if (secret !== MY_SECRET) {
        console.warn(`[Security] Denied register attempt`);
        return res.status(403).send("Denied");
    }

    // 2. HISTÓRICO DE INTERAÇÕES (DB)
    try {
        db.prepare(`INSERT INTO interactions (owner, creator, clicker, status, land_name, land_id, pos, object_id, serial, url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(owner, creator, clicker, status, land_name, land_id, pos, object_id, serial, url);
    } catch (err) { console.error("[Interactions] DB Error:", err.message); }

    // 3. MAPEAMENTO DE SESSÃO
    if (clicker && clicker !== "Unknown" && object_id) {
        clickerSessionMap.set(clicker, {
            object_id,
            expires: Date.now() + SESSION_TTL
        });
    }

    // 4. TRATAMENTO DE TV_OFF (Caso a TV esteja desligando)
    if (!object_id || !url || status === 'TV_OFF') {
        console.log(`[Registry] TV_OFF or no URL — cleaning up for ${object_id}`);
        if (object_id) {
            tvRegistry[object_id] = { url, status, serial, owner, land: land_name, room: `room_${land_id}`, ip: tvIp };
            _upsertTv(db, { object_id, status, serial, url, owner, land_name, land_id, ip: tvIp });

            // Remove any roomId aliases pointing to this TV
            Object.keys(tvRegistry).forEach(k => {
                if (k !== object_id && tvRegistry[k]?.object_id_ref === object_id) {
                    delete tvRegistry[k];
                }
            });
            io.emit('tv_registered', { object_id, id: object_id, location: land_name, status: "OFFLINE" });
        }
        return res.status(200).json({ status: "success", target_id: object_id });
    }

    // 5. CALLBACK À TV (VERIFICAÇÃO)
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

        // 6. REGISTO EM MEMÓRIA E PERSISTÊNCIA
        tvRegistry[object_id] = { url, status, serial, owner, land: land_name, room: `room_${land_id}`, ip: tvIp };
        _upsertTv(db, { object_id, status, serial, url, owner, land_name, land_id, ip: tvIp });

        // 7. EMIT SOCKET (Aqui a bolinha fica verde no Front-end)
        io.emit('tv_registered', { 
            object_id: object_id, 
            id: object_id, 
            location: land_name,
            status: "ONLINE" 
        });

        if (clicker && clicker !== "Unknown") {
            io.to(FIXED_ROOM).emit('tv_registered', { clicker, object_id });
        }

        // 8. GERA TOKEN E ROOM ID PARA A SESSÃO
        const token  = crypto.randomBytes(16).toString('hex');
        const roomId = crypto.randomBytes(8).toString('hex');
        pendingTokens[token] = { object_id, owner, roomId, expires: Date.now() + 30000 };

        // Keep roomId → object_id entry so check-status works for shared URLs
        tvRegistry[roomId] = { ...tvRegistry[object_id], object_id_ref: object_id };

        console.log(`[Token] Generated for ${object_id}: ${token} | room: ${roomId}`);

        return res.status(200).json({ 
            status:    "success", 
            target_id: object_id, 
            token:     token,
            room:      roomId
        });

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
router.post('/send-command', (req, res) => {
    const { command, value } = req.body;
    
    // Recupera o ID da TV que associamos na sessão lá no GET /
    const tvId = req.session.activeTvId;

    if (!tvId || !tvRegistry[tvId]) {
        console.error("[Command] Tentativa de comando sem sessão ativa.");
        return res.status(401).json({ error: "Nenhuma TV vinculada a esta sessão" });
    }

    const tvUrl = tvRegistry[tvId].url;

    axios.post(tvUrl, `${command}|${value}`, {
        headers: { 'Content-Type': 'text/plain' },
        timeout: 5000
    })
    .then(() => res.json({ success: "ok" }))
    .catch(err => {
        console.error(`[Command] Erro ao enviar para TV ${tvId}:`, err.message);
        res.status(500).json({ error: "TV offline ou inalcançável" });
    });
});
/////////////////////////////////////////
// Dentro do module.exports = function createRouter(...)
// A rota deve ser adicionada dentro do module.exports do createRouter
router.get('/check-room/:roomId', (req, res) => {
    // No Express, usamos req.params para parâmetros de rota (:roomId)
    const roomId = req.params.roomId; 

    // Verificamos na base de dados (db) se essa TV existe e está ONLINE
    try {
        const row = db.prepare(`SELECT object_id FROM tv_registry WHERE object_id = ? AND status = 'ONLINE'`).get(roomId);
        return res.json({ active: !!row });
    } catch (err) {
        console.error("Erro ao verificar sala:", err);
        return res.status(500).json({ active: false });
    }
});
////////////////////////////////////////
// check tv status
router.get('/check-status/:id', (req, res) => {
    const tvId = req.params.id;
    const tv = tvRegistry[tvId];

    console.log(`[check-status] id=${tvId} | found=${!!tv} | status=${tv?.status}`);

    if (tv && tv.status && tv.status !== 'TV_OFF') {
        console.log(`Status da TV ${tvId}: ${tv.status}`);
        return res.json({ online: true, location: tv.land });
    }
    
    res.json({ online: false });
});
    ///////////////////////////////////////////////////////
    // MAIN PAGE
// ── MAIN PAGE ────────────────────────────────────────────────
router.get('/', (req, res) => {
    const tvId = req.query.id || req.query.token;

    if (tvId) {
        if (pendingTokens[tvId]) {
            req.session.activeTvId = pendingTokens[tvId].object_id;
        } else {
            req.session.activeTvId = tvId;
        }
        console.log(`[Session] TV vinculada: ${req.session.activeTvId}`);
    }

    // The room defaults to the TV's object_id — each TV has its own room
    // If no TV is linked, falls back to 'Lobby'
    const defaultRoom = req.session.activeTvId || 'Lobby';
    const room        = req.query.room || defaultRoom;

    // Find clicker name for this session
    let clickerName = '';
    if (req.session.activeTvId) {
        for (const [name, sess] of clickerSessionMap.entries()) {
            if (sess.object_id === req.session.activeTvId) {
                clickerName = name;
                break;
            }
        }
    }

    res.render('pages/index', {
        tvId:    req.session.activeTvId,
        room:    room,
        clicker: clickerName
    });
});

    router.get('/tv-dashboard', (req, res) => res.render('pages/tv-dashboard'));

    ////////////////////////////////////////////////////////////////////////////
    // RADIOS
    router.get('/radios/radios-menu',          (req, res) => res.render('pages/radios/radios-menu'));
    router.get('/radios/sl-radio',      (req, res) => res.render('pages/radios/sl-radio'));
    router.get('/radios/inter-radio',   (req, res) => res.render('pages/radios/inter-radio'));
    router.get('/radios/pt',            (req, res) => res.render('pages/radios/pt'));


    //////////////////////////////////////////////////////////////////////////
    // MUSIC
    router.get('/music-menu', (req, res) => res.render('pages/music/music-menu'));

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
    router.get('/movies-menu', (req, res) => res.render('pages/movies/movies-menu'));

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
        res.render('pages/youtube/youtube-menu', { title: "YouTube Search", req });
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

            res.render('pages/youtube/youtube', {
                videos, favorites: favoritesData, tag, isChannel, scrollPos, req
            });
        } catch (err) {
            console.error("❌ ROUTE ERROR:", err.message);
            res.render('pages/youtube/youtube', { videos: [], favorites: favoritesData, tag, isChannel, scrollPos, req });
        }
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


router.get('/settings', (req, res) => {
    // 1. Busca o ID gravado na sessão do navegador
    const tvId = req.session.activeTvId;

    console.log(`[Settings] Sessão ID: ${req.sessionID} | TV Vinculada: ${tvId}`);

    // 2. Verifica se o ID existe e se a TV ainda está no registro (memória)
    if (tvId && tvRegistry[tvId]) {
        // Use 'pages/settings' se o arquivo estiver na pasta views/pages/
        res.render('pages/settings', { 
            tvId: tvId,
            dados: tvRegistry[tvId]
        });
    } else {
        console.warn(`[Settings] Acesso negado ou sessão expirada para IP: ${req.ip}`);
        // Renderiza a página com tvId null para mostrar mensagem de "Offline" ou "Reconecte"
        res.render('pages/settings', { tvId: null, dados: null });
    }
});


// 1. Rota para carregar a página
router.get('/flickr', (req, res) => {
    res.render('pages/flickr/flickr', {
        theme: 'goldenrod'
    });
});

// 2. Rota da API de Busca (Onde o erro 500 acontece)
router.get('/api/flickr/search', async (req, res) => {
    // 1. Pegamos 'tags' e 'sort' da query string
    const { tags, sort } = req.query;

    if (!tags) {
        return res.status(400).json({ error: "Tags are required" });
    }

    try {
        // 2. Passamos o parâmetro 'sort' para o controller. 
        // Se 'sort' não existir na URL, o controller usará o padrão.
        const photos = await flickrController.searchPhotos(tags, sort);
        res.json(photos);
    } catch (error) {
        console.error("Route Error:", error.message);
        
        if (error.message.includes('429') || error.message.includes('Rate limit')) {
            return res.status(429).json({ error: "Flickr rate limit reached." });
        }
        
        res.status(500).json({ error: error.message });
    }
});

// Rota para buscar fotos de um canal específico (User ID)
router.get('/api/flickr/channel/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        // Chama o controller que você já tem para buscar as fotos
        const photos = await flickrController.getChannelPhotos(userId); 
        res.json(photos);
    } catch (error) {
        console.error("Erro na rota de canal:", error.message);
        res.status(500).json({ error: "Erro ao buscar fotos do canal" });
    }
});


    ///////////////////////////////////////////////////////////
    // FLICKR FAVORITES
router.get('/api/favorites', async (req, res) => {
    try {

        const fs = require('fs').promises; 
        const data = await fs.readFile(flickrFav, 'utf8');
        res.json(JSON.parse(data));

    } catch (err) {
        console.error("ERRO NO GET FAVORITES:", err.message);
        res.status(500).json({}); 
    }
});

    ///////////////////////////////////////////////////////////////////
    // XXX
    router.get('/xxx-check',    (req, res) => res.render('pages/xxx/xxx-check'));
    router.get('/xxx-index',    (req, res) => res.render('pages/xxx/xxx-index'));
    router.get('/xxx-browsers', (req, res) => res.render('pages/xxx/xxx-browsers'));

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
        res.render('pages/xxx/xvideos', { 
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
        res.render('pages/xxx/xxx_player', { stream: req.query.stream, title: req.query.title });
    });

    ///////////////////////////////////////////////////////////////////
    // EROTIC MOVIES
    router.get('/erotic-grid', async (req, res) => {
        try {
            const videos = await eroticScraper.getEroticVideos('https://eroticmv.com/category/genre/classic-erotica/');
            res.render('pages/xxx/eroticVideos', { videos, tag: 'Erotic Movies' });
        } catch (err) {
            console.error('[Erotic Route] Error:', err);
            res.status(500).send('Failed to load erotic movies.');
        }
    });

    ///////////////////////////////////////////////////////////////////
    // SECOND LIFE DESTINATIONS
router.get('/sl-destinations', async (req, res) => {
    // Definimos os valores padrão aqui:
    // Se 'tag' não vier na query, usa 'Editor Picks'
    // Se 'url' não vier na query, usa a URL oficial dos Editor Picks
    const tag = req.query.tag || "Art";
    const url = req.query.url || "https://secondlife.com/destinations/art/galleries";

    try {
        // Executamos o scraper com os valores (sejam os vindos da query ou os padrão)
        const [destinations, favorites] = await Promise.all([
            slScraper.getDestinations({ url, tag }),
            slScraper.getFavorites() // Removi o Promise.resolve desnecessário
        ]);

        res.render('pages/secondlife/sl_grid', { destinations, tag, favorites });
    } catch (err) {
        console.error('[SL Route] Error:', err);
        res.status(500).send('Failed to load destinations.');
    }
});


// Rota para buscar o teleport apenas "on-demand"
router.get('/api/sl/teleport', async (req, res) => {
    // Usamos 'detailLink' para bater com o que o EJS envia
    const { detailLink } = req.query; 

    if (!detailLink) {
        return res.status(400).json({ error: "URL em falta" });
    }

    try {
        // O nome correto da função exportada no seu slScraper.js
        const teleportLink = await slScraper.getTeleportOnDemand(detailLink);
        
        // Retornamos 'teleportUrl' para o fetch do EJS receber corretamente
        res.json({ teleportUrl: teleportLink }); 
    } catch (err) {
        console.error('[Teleport Error]:', err);
        res.status(500).json({ error: "Não foi possível obter o teleport" });
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
    try {
        db.prepare(`
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
        `).run(object_id, status, serial, url, owner, land_name, `room_${land_id}`, ip);
        console.log(`[Registry] TV ${object_id} synced`);
    } catch (err) {
        console.error("[Registry] DB Error:", err.message);
    }
}