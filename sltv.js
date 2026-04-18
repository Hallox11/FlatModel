
const express = require('express');

require('dotenv').config();
const app = express();
const ejs = require('ejs');
const http = require('http');
var path = require('path');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const axios = require('axios');
const PORT = process.env.PORT || 3000;
const crypto = require('crypto');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const favPath = path.join(__dirname, 'favorites.json');

const slScraper = require('./slScraper');
const xvideosScraper = require('./Xvideosscraper');
const eroticScraper = require('./eroticScraper');
const youtubeScraper = require('./youtubeScraper');
const ytMusicScraper = require('./ytMusicScraper');


app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true, parameterLimit: 50000}));
app.use('/backgrounds', express.static(path.join(__dirname, 'backgrounds')));
app.use(express.static('public'));
app.set('view engine', 'ejs');


// Updated global state to track everything happening in the room
const MODES = {
    HOME: 'HOME',           // Grid principal / Lobby
    RADIO: 'RADIO',         // Player de rádio ativo
    YOUTUBE: 'YOUTUBE',     // Vídeos (Movies/YouTube)
    MUSIC: 'MUSIC',         // YouTube Music player
    FLICKR: 'FLICKR',       // Galeria de fotos
    XXX: 'XXX',             // Conteúdo adulto
    SETTINGS: 'SETTINGS',   // Menu de configurações
    BROWSER: 'BROWSER'      // Navegação web
};
let lobbyState = {
    // Estado Mestre
    currentMode: MODES.HOME,
    ajaxPath: null,
    lastUpdate: Date.now(),
        // UI & Aparência
    currentBg: null,
    textContrast: 'light',
        // Dados de Vídeo / Media
    videoId: null,
    videoTimestamp: 0,
    videoPaused: true,
    videoOrigin: 'youtube', // youtube, music, movies
        // Dados de Rádio
    radioStream: null,
    radioName: null,
    radioDialIndex: null,
        // Dados de Flickr
    flickrQuery: '',
    flickrActiveImage: null,
    flickrIsSlideshow: false
};


// 3. Secret key for verification
const MY_SECRET = process.env.MY_SECRET || "MyUltraSecret123"; // ⚠️ move to .env
let activeTvUrl = null;
let tvRegistry = {};
let BASE_URL = process.env.BASE_URL || "https://gearldine-unintrusted-carey.ngrok-free.dev/"; // ⚠️ move to .env
const FIXED_ROOM = "Lobby";
const pendingTokens = {};
/////////////////////////////////////////////////
// 1. Initialize the Database File
const db = new sqlite3.Database('./sltv_data.sqlite', (err) => {
    if (err) console.error("Database opening error:", err.message);
    else console.log("Connected to SQLite database.");
});

/////////////////////////////////////////////////
// 2. Create the Table if it doesn't exist
// 2. Create Tables if they don't exist
// 2. Create Tables if they don't exist
db.run(`CREATE TABLE IF NOT EXISTS interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner TEXT,
    creator TEXT,
    clicker TEXT,
    status TEXT,
    land_name TEXT,
    land_id TEXT,
    pos TEXT,
    object_id TEXT,
    serial TEXT,
    url TEXT, 
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// NEW: Persistent TV Registry — load after table is guaranteed to exist
db.serialize(() => {
    // Cria a tabela básica se não existir
    db.run(`CREATE TABLE IF NOT EXISTS tv_registry (
        object_id TEXT PRIMARY KEY,
        url TEXT,
        status,
        status2,
        serial,
        owner TEXT,
        land TEXT,
        room TEXT,
        ip,
        last_seen DATETIME
    )`);


});
/////////////////////////////////////////////////
// GET /api/tvs — returns all rows from tv_registry
app.get('/api/tvs', (req, res) => {
    db.all(`SELECT * FROM tv_registry ORDER BY last_seen DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// GET /api/interactions — returns all rows from interactions
app.get('/api/interactions', (req, res) => {
    db.all(`SELECT * FROM interactions ORDER BY timestamp DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});


/////////////////////////////////////////////////
// 4. Register Endpoint (LSL Handshake)
const clickerSessionMap = new Map();
const SESSION_TTL = 30 * 1000;

const pendingRegistry = {};

app.post('/register', async (req, res) => {
    const tvIp = activeTvUrl;

    const {
        secret, owner, creator, clicker, status, land_name,
        land_id, pos, object_id, serial, url
    } = req.body;

    console.log("***************************************");
    console.log(`[System] Active TV URL updated to: ${activeTvUrl}`);
    console.log("Secret: ", secret);
    console.log("owner: ", owner);
    console.log("creator: ", creator);
    console.log("clicker: ", clicker);
    console.log("land_name: ", land_name);
    console.log("land_id: ", land_id);
    console.log("pos: ", pos);
    console.log("object_id: ", object_id);
    console.log("serial: ", serial);
    console.log("url: ", url);
    console.log("status: ", status);
    console.log("***************************************");

    // 1. VALIDAÇÃO DO SEGREDO
    if (secret !== MY_SECRET) {
        console.warn(`[Security] Denied register attempt from IP: ${tvIp}`);
        return res.status(403).send("Denied");
    }

    // 2. HISTÓRICO DE INTERAÇÕES (sempre, independente da verificação)
    db.run(`INSERT INTO interactions
        (owner, creator, clicker, status, land_name, land_id, pos, object_id, serial, url)
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

    // 4. TV_OFF — não precisa de verificação, regista e responde imediatamente
    if (!object_id || !url || status === 'TV_OFF') {
        console.log(`[Registry] TV_OFF or no URL — skipping verification for ${object_id}`);

        if (object_id) {
            tvRegistry[object_id] = {
                url, status, serial, owner,
                land: land_name,
                room: `room_${land_id}`,
                ip: tvIp
            };

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
            `, [object_id, status, serial, url, owner, land_name, `room_${land_id}`, tvIp], (err) => {
                if (err) console.error("[Registry] DB Error:", err.message);
                else console.log(`[Registry] TV ${object_id} synced (TV_OFF)`);
            });

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
            console.warn(`[Verify] ❌ TV ${object_id} responded but not verified:`, verifyResponse.data);
            return res.status(403).send("Verification failed");
        }

        console.log(`[Verify] ✅ TV ${object_id} verified OK`);

        // 6. REGISTO EM MEMÓRIA
        tvRegistry[object_id] = {
            url, status, serial, owner,
            land: land_name,
            room: `room_${land_id}`,
            ip: tvIp
        };
        activeTvUrl = url;

        // 7. EMIT tv_registered (para o dashboard)
        io.emit('tv_registered', { id: object_id, location: land_name });
        if (clicker && clicker !== "Unknown") {
            io.to(FIXED_ROOM).emit('tv_registered', { clicker, object_id });
        }

        // 8. PERSISTÊNCIA NO SQLite
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
        `, [object_id, status, serial, url, owner, land_name, `room_${land_id}`, tvIp], (err) => {
            if (err) console.error("[Registry] DB Error:", err.message);
            else console.log(`[Registry] TV ${object_id} synced at IP ${tvIp}`);
        });

        // 9. GERA TOKEN ONE-TIME para o browser
        const token = crypto.randomBytes(16).toString('hex');
        pendingTokens[token] = {
            object_id,
            owner,
            expires: Date.now() + 30000 // 30 segundos para abrir o browser
        };
        console.log(`[Token] Generated for ${object_id}: ${token}`);

        // 10. RESPONDE 200 AO LSL COM O TOKEN
        // LSL usa o token para abrir o browser com URL autenticado
        return res.status(200).json({ 
            status: "success", 
            target_id: object_id,
            token: token
        });

    } catch (err) {
        console.warn(`[Verify] ❌ TV ${object_id} unreachable:`, err.message);
        return res.status(403).send("Verification failed - TV unreachable");
    }
});
////////////////////////////////////////////////////////////
app.get('/validate-token', (req, res) => {
    const { token } = req.query;

    if (!token || !pendingTokens[token]) {
        return res.status(403).json({ valid: false });
    }

    if (Date.now() > pendingTokens[token].expires) {
        delete pendingTokens[token];
        return res.status(403).json({ valid: false, reason: "expired" });
    }

    // One-time use — consome o token
    const entry = pendingTokens[token];
    delete pendingTokens[token];

    res.status(200).json({ valid: true, object_id: entry.object_id, owner: entry.owner });
});
////////////////////////////////////////////////////////////
async function pingTvs() {
    // 1. Get all TVs from the registry
    db.all(`SELECT object_id, url FROM tv_registry`, [], async (err, rows) => {
        if (err) return console.error(err);

        for (const tv of rows) {
            try {
                
                // 2. Send a "ping" command to the SL object
                // The SL script must be programmed to respond to "ping|"
                await axios.post(tv.url, "ping|", { 
                    headers: { 'Content-Type': 'text/plain' },
                    timeout: 5000 // Give up after 5 seconds
                });

                // 3. If successful, update status to ONLINE
                db.run(`UPDATE tv_registry SET status = 'ONLINE', last_seen = CURRENT_TIMESTAMP WHERE object_id = ?`, [tv.object_id]);
                console.log(`TV ${tv.object_id} is still rezzed.`);
            } catch (error) {
                // 4. If it fails, the object is likely gone or the URL changed
                db.run(`UPDATE tv_registry SET status = 'OFFLINE' WHERE object_id = ?`, [tv.object_id]);
               // console.log(`TV ${tv.object_id} is unreachable.`);
            }
        }
    });
}

// Run the ping check every 5 minutes
setInterval(pingTvs, 1 * 10 * 1000);
//////////////////////////////////////////////////////////

// Agora o endpoint recebe o nome do clicker como parâmetro
// O LSL envia: /get-session-id?clicker=NomeDoAvatar
app.get('/get-session-id', (req, res) => {
    const clicker = req.query.clicker;

    if (!clicker) {
        return res.status(400).json({ error: "Missing clicker param" });
    }

    const session = clickerSessionMap.get(clicker);

    // Sessão não existe ou expirou
    if (!session || Date.now() > session.expires) {
        clickerSessionMap.delete(clicker); // limpeza
        return res.status(404).json({ error: "No active session" });
    }

    res.json({ target_id: session.object_id });
});




////////////////////////////////////////////////////////////
// Objeto temporário para guardar quem clicou por último em cada IP
// Objeto global simples para armazenar a URL ativa por IP
let activeTvs = {}; 
let global_TV_Url;
app.post('/activate', (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const { TV_url, clicker } = req.body;
global_TV_Url=TV_url;
    // Guardamos a URL da TV vinculada ao IP de quem clicou
    activeTvs[ip] = TV_url;

    console.log(`[Status] TV de ${clicker} pronta na URL ${TV_url}`);
    res.sendStatus(200);
});

app.post('/send-command', async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const { command, value } = req.body;
console.log("comand sent: " ,command," Value: ",value)
    // Buscamos a URL que foi salva no último 'activate' desse IP
    const targetUrl = global_TV_Url;

    if (!targetUrl) {
        return res.status(404).send("Nenhuma TV ativa encontrada para este IP.");
    }

    try {
        // Enviamos o comando direto para a URL guardada
        await axios.post(targetUrl, `${command}|${value}`, {
            headers: { 'Content-Type': 'text/plain' }
        });
        res.send({ success: true });
    } catch (error) {
        res.status(500).send("Erro ao enviar para o Second Life.");
    }
});












///////////////////////////////////////////////////////
// THE MAIN PAGE ENDPOINT (The "App" UI)
app.get('/', (req, res) => {
    const userAgent = req.headers['user-agent'] || "";
    const isSL = /SecondLife|Dullahan|Firestorm/i.test(userAgent);

    // Se for Second Life, renderiza e encerra a função
    if (isSL) {
        return res.render('pages/index'); 
    } 

    // Se não for Second Life, renderiza e encerra a função
    return res.render('pages/index');
});
///////////////////////////////////77



//////////////////////////////////////////////////////7777


app.get('/tv-dashboard', function (req, res) {
  res.render('pages/tv-dashboard');
});

////////////////////////////////////////////////////////////////////////////
// OPEN RADIOS MENU
////////////////////////////////////////////////////////////////////////////
app.get('/radios-menu', function (req, res) {
  res.render('pages/radios-menu');
});
// OPEN SL RADIOS MENU
app.get('/radios/sl-radio', function (req, res) {
   res.render('pages/radios/sl-radio');
});
// OPEN INTER RADIOS
app.get('/radios/inter-radio', function (req, res) {
    res.render('pages/radios/inter-radio');
 });
// OPEN SL RADIOS PLAYER

// OPEN PT RADIOS 
app.get('/radios/pt', function (req, res) {
  res.render('pages/radios/pt');
});
// OPEN NZ RADIOS 
app.get('/radios/nz', function (req, res) {
  res.render('pages/radios/nz');
});
// OPEN ES RADIOS 
app.get('/radios/es', function (req, res) {
  res.render('pages/radios/es');
});
// OPEN BR RADIOS 
app.get('/radios/br', function (req, res) {
  res.render('pages/radios/br');
});
// OPEN UK RADIOS 
app.get('/radios/uk', function (req, res) {
  res.render('pages/radios/uk');
});
// OPEN FR RADIOS 
app.get('/radios/fr', function (req, res) {
  res.render('pages/radios/fr');
});
// OPEN IT RADIOS 
app.get('/radios/it', function (req, res) {
  res.render('pages/radios/it');
});
// OPEN MR RADIOS 
app.get('/radios/mr', function (req, res) {
  res.render('pages/radios/mr');
});


//////////////////////////////////////////////////////////////////////////
// OPEN MUSIC MENU
/////////////////////////////////////////////////////////////////////////
app.get('/music-menu', function (req, res) {
    res.render('pages/music-menu');
});


//////////////////////////////////////////////////////////////////////////
//OPEN MOVIES MENU
/////////////////////////////////////////////////////////////////////////
 app.get('/movies-menu', function (req, res) {
  res.render('pages/movies-menu');
});
//OPEN MOVIES SLIDSHOW MENU
// OPEN MOVIES GRID (Using YouTube Scraper)
app.get('/movies-grid', async (req, res) => {
    console.log('[movies-grid] params:', req.query);

    // Se não vier gênero, usamos 'full movies' para melhores resultados no YouTube normal
    const query     = req.query.genre || 'full movies action';
    const scrollPos = req.query.scrollPos || 0;
    const menu      = req.query.menu || '/movies-menu';

    try {
        // MUDANÇA AQUI: Usamos o youtubeScraper.getVideos em vez do ytMusic
        // O segundo parâmetro 'false' indica que é uma busca por termos, não por canal
        const results = await youtubeScraper.getVideos(query, false);

        res.render('pages/generic_grid', {
            title: `Cinema: ${query.toUpperCase()}`,
            type: "movies", // Mantemos movies para o tema visual
            searchQuery: query,
            scrollPos: scrollPos,
            menu: menu,
            req: req,
            results: results.map(m => ({
                id: m.videoId,
                title: m.title,
                thumbnail: m.thumbnail,
                subtitle: m.channel, // No YouTube normal, mostramos o Canal
                badge: "MOVIE"
            }))
        });
    } catch (err) {
        console.error("❌ Movies Route Error:", err);
        res.status(500).send("Error loading movies via YouTube.");
    }
});

///////////////////////////////////////////////////////////////////
// Rota para renderizar o menu de pesquisa do YouTube
app.get('/youtube-menu', (req, res) => {
    // Renderiza o ficheiro youtube-menu.ejs que criaste em views/pages/
    res.render('pages/youtube-menu', {
        title: "YouTube Search",
        req: req
    });
});
app.get('/youtube-grid', async (req, res) => {
    const query = req.query.genre || 'Trending';
    const menu = req.query.menu || '/youtube-menu';

    try {
        // Usamos o seu youtubeScraper já existente
        const results = await youtubeScraper.getVideos(query, false);

        res.render('pages/generic_grid', {
            title: `YouTube: ${query}`,
            type: "youtube", // Novo tipo para cor vermelha
            searchQuery: query,
            menu: menu,
            results: results.map(v => ({
                id: v.videoId,
                title: v.title,
                thumbnail: v.thumbnail,
                subtitle: v.channel,
                badge: "YT"
            }))
        });
    } catch (err) {
        res.status(500).send("Erro na busca do YouTube");
    }
});

///////////////////////////////////////////////////////////////////
// SEVERAL ENDPOINTS
///////////////////////////////////////////////////////////////////

//OPEN BACKGROUNDS
app.get('/api/backgrounds', (req, res) => {
    const dir = path.join(__dirname, 'backgrounds');

    fs.readdir(dir, (err, files) => {
        if (err) return res.status(500).send([]);

       // files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        const images = files
            .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
            .map(f => '/backgrounds/' + f);

        res.json(images);
    });
});
//HELP MENU
app.get('/help', function (req, res) {
  res.render('pages/help');
});
//OPEN BROWSERS MENU
app.get('/browsers', function (req, res) {
  res.render('pages/browsers');
});
//OPEN FLICKR MENU
app.get('/flickr', (req, res) => {
    // Pass the API key to the template
    res.render('pages/flickr', { 
        apiKey: process.env.FLICKR_API_KEY || 'c90dea5c7207bea531ac489747938f44',
        theme: 'goldenrod' 
    });
});
// SETTINGS MENU
app.get('/settings', (req, res) => {
    const isAjax = req.xhr || req.headers.accept.indexOf('json') > -1;
    const fullBaseUrl = `https://${req.get('host')}`;
    const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Tenta pegar o ID pela URL (fallback) ou pelo IP (preferencial)
    let tvId = req.query.tv;

    if (!tvId) {
        // Busca na memória qual TV registrou com esse IP recentemente
        const foundTvId = Object.keys(tvRegistry).find(id => tvRegistry[id].ip === userIp);
        if (foundTvId) {
            tvId = foundTvId;
            console.log(`[Settings] Auto-detected TV: ${tvId} via IP: ${userIp}`);
        }
    }

    if (isAjax) {
        return res.render('pages/settings', { 
            baseUrl: fullBaseUrl,
            tvId: tvId, // Injeta o ID no script da página
            layout: false 
        });
    } else {
        // Se não for AJAX, carrega a moldura principal do site
        return res.render('pages/index', { baseUrl: fullBaseUrl });
    }
});
///////////////////////////////////////////////////////////
// FLICKER FAVORITES
if (!fs.existsSync(favPath)) fs.writeFileSync(favPath, JSON.stringify([]));

// Route to get all favorites
app.get('/api/favorites', async (req, res) => {
    try {
        const data = await fs.promises.readFile(favPath, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        res.status(500).send("Error reading favorites");
    }
});

app.post('/api/favorites/channels', (req, res) => {
    const { name, id } = req.body; 
    let data = JSON.parse(fs.readFileSync(favPath));

    // Force the structure to be a single object {}
    if (Array.isArray(data) || !data) data = {};

    // Save the pair
    data[name] = id;
    
    fs.writeFileSync(favPath, JSON.stringify(data, null, 2));
    res.json({ success: true });
});

/////////////////////////////////////////////////////////////



///////////////////////////////////////////////////////////////////
//OPEN XXX-BROSWERS CHECK MENU
///////////////////////////////////////////////////////////////////
app.get('/xxx-check', function (req, res) {
  res.render('pages/xxx-check');
});
app.get('/xxx-index', function (req, res) {
  res.render('pages/xxx-index');
});
app.get('/xxx-browsers', function (req, res) {
  res.render('pages/xxx-browsers');
});


///////////////////////////////////////////////////////////////////
// XVIDEOS ENDPOINTS
///////////////////////////////////////////////////////////////////
app.get('/xvideos-grid', async (req, res) => {
    const tag = req.query.tag || 'top';
    try {
        const videos = await xvideosScraper.getVideos({ tag });
        res.render('pages/xvideos', { videos, tag });
    } catch (err) {
        console.error('[XV Route] Error:', err);
        res.status(500).send('Failed to load videos.');
    }
});
app.get('/get-xxx-stream', async (req, res) => {
    const streamUrl = await xvideosScraper.getStream(req.query.url);
    if (streamUrl) return res.json({ streamUrl });
    res.status(500).send();
});
app.get("/xxx-player", (req, res) => {
    res.render("pages/xxx_player", { 
        stream: req.query.stream, 
        title: req.query.title 
    });
});
///////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////
// YOUTUBE ENDPOINTS
///////////////////////////////////////////////////////////////////
app.get('/youtube', async (req, res) => {
    let favoritesData = [];
    const favPath = path.join(__dirname, 'config', 'YT-favorites.json');
    const tag = req.query.tag || 'secondlife';
    const isChannel = req.query.isChannel === 'true';
    const scrollPos = req.query.scrollPos || 0;

    try {
        // Load favorites if they exist
        if (fs.existsSync(favPath)) {
            const raw = fs.readFileSync(favPath, 'utf8').trim();
            if (raw) favoritesData = JSON.parse(raw);
        }

        // Call the module!
        const videos = await youtubeScraper.getVideos(tag, isChannel);

        res.render('pages/youtube', { 
            videos: videos, 
            favorites: favoritesData, 
            tag: tag,
            isChannel: isChannel,
            scrollPos: scrollPos,
            req: req
        });
    } catch (err) {
        console.error("❌ ROUTE ERROR:", err.message);
        res.render('pages/youtube', { videos: [], favorites: favoritesData, tag, isChannel, scrollPos, req });
    }
});
app.get('/youtube-favorites', async (req, res) => {
    try {
        const favPath = path.join(__dirname, 'config', 'YT-favorites.json');
        const favorites = JSON.parse(fs.readFileSync(favPath, 'utf8'));

        // Render a menu that shows your favorite channels
        // When a user clicks a channel, it triggers handleNav('/youtube-grid?id=CHANNEL_ID&mode=user')
        res.render('fragments/youtube-favorites-menu', { 
            favorites,
            room: req.query.room 
        });
    } catch (err) {
        res.status(500).send("Error loading favorites");
    }
});
app.get('/youtube/refresh', async (req, res) => {
    const tag = req.query.tag || 'secondlife';
    const isChannel = req.query.isChannel === 'true';
    const cacheDir = path.join(__dirname, 'cache/youtube');
    const prefix = isChannel ? 'chan' : 'tag';
    const safeQuery = tag.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const cacheFile = path.join(cacheDir, `yt_${prefix}_${safeQuery}.json`);

    // Delete the cache file so next request fetches fresh
    if (fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile);

    // Redirect back to the grid — it will fetch fresh automatically
    res.redirect(`/youtube?tag=${encodeURIComponent(tag)}&isChannel=${isChannel}`);
});
app.get('/api/quota', (req, res) => {
    const quotaPath = path.join(__dirname, 'cache/youtube/quota.json'); // Updated path
    if (!fs.existsSync(quotaPath)) return res.json({ used: 0, remaining: 10000 });
    
    const q = JSON.parse(fs.readFileSync(quotaPath, 'utf8'));
    res.json({
        used: q.used,
        remaining: 10000 - q.used,
        date: q.date
    });
});
///////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////
// EROTIC MOVIES ENDPOINTS
///////////////////////////////////////////////////////////////////
app.get('/erotic-grid', async (req, res) => {
    try {
        // Replace with the actual URL you want to scrape
        const targetSite = 'https://eroticmv.com/category/genre/classic-erotica/'; 
        
        // Use the scraper module we built in the previous step
        const videos = await eroticScraper.getEroticVideos(targetSite);

        // Render using your existing xvideos.ejs template to keep the same UI
        res.render('pages/eroticVideos', { 
            videos: videos, 
            tag: 'Erotic Movies' 
        });
    } catch (err) {
        console.error('[Erotic Route] Error:', err);
        res.status(500).send('Failed to load erotic movies.');
    }
});
///////////////////////////////////////////////////////////////////

///////////////////////////////////////////////////////////////////
// SECOND LIFE ENDPOINTS
///////////////////////////////////////////////////////////////////
app.get('/sl-destinations', async (req, res) => {
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

app.get('/music-grid', async (req, res) => {
    const query     = req.query.genre || req.query.q || 'Blues';
    const scrollPos = req.query.scrollPos || 0;
    const menu      = req.query.menu || '/music-menu';   // ← add this

    try {
        const musicResults = await ytMusicScraper.getMusic(query);
        const playableMusic = musicResults;

        res.render('pages/generic_grid', {
            title: `Music: ${query.toUpperCase()}`,
            type: "music",
            searchQuery: query, 
            scrollPos: scrollPos,
            menu: menu,                                  // ← add this
            req: req,
            results: playableMusic.map(m => ({
                id: m.videoId,
                title: m.title,
                thumbnail: m.thumbnail,
                subtitle: m.artist, 
                badge: "MUSIC"
            }))
        });
    } catch (err) {
        console.error("❌ Music Route Error:", err);
        res.status(500).send("Error loading music.");
    }
});
// ONE PLAYER TO RULE THEM ALL
app.get('/tvytube', (req, res) => {
    const videoId   = req.query.videoId   || '';
    const scrollPos = req.query.scrollPos || 0;
    const origin    = req.query.origin    || 'youtube';
    const targetID  = req.query.targetID  || req.query.tag || videoId;
    const targetMode = req.query.targetMode || 'user';
    const menu      = req.query.menu      || '';        // ← add this

    console.log(`[Player Sync] Mode: ${origin} | ID: ${videoId} | Context: ${targetID}`);

    res.render('pages/tvytube', { 
        videoId, 
        targetID, 
        targetMode, 
        scrollPos,
        origin,
        menu                                            // ← add this
    });
});

// ===============================
// SOCKET.IO LOGIC
// ===============================

// 1. Create a global object to track the room's current "Live" status




// ==========================================
// SOCKET.IO: CENTRAL DE SINCRONIZAÇÃO
// ==========================================
io.on('connection', function(socket) {
    // 1. AUTO-JOIN À SALA FIXA
    socket.join(FIXED_ROOM);

    console.log(`[Join] Viewer ${socket.id} entrou. Modo atual: ${lobbyState.currentMode}`);

    // 2. SINCRONIZAÇÃO IMEDIATA (Envio do estado completo para quem chega)
    socket.emit('force_sync_arrival', {
        ...lobbyState,
        timestamp: lobbyState.isPaused
            ? lobbyState.timestamp
            : lobbyState.videoTimestamp+ (Date.now() - (lobbyState.lastUpdate || Date.now())) / 1000
    });

    // 3. NAVEGAÇÃO E AJAX
    socket.on('mirror_nav', (data) => {
        const route = typeof data === 'string' ? data : data.route;
        if (route === '/' || route === '') {
            lobbyState.ajaxPath = null;
            lobbyState.currentMode = MODES.HOME;
        } else {
            lobbyState.ajaxPath = route.split('?')[0];
        }
        socket.to(FIXED_ROOM).emit('mirror_ajax_nav', data);
    });

    socket.on('mirror_ajax_nav', (data) => {
        const rawPath = data.path || data.route || data.mode || '';
        
        if (data.action === 'CLOSE') {
            lobbyState.currentMode = MODES.HOME;
            lobbyState.ajaxPath = null;
            lobbyState.videoId = null;
            lobbyState.radioStream = null;
            lobbyState.radioName = null;
        } else {
            lobbyState.ajaxPath = rawPath;
            
            // Atribuição Inteligente de Modo
            if (rawPath.includes('tvytube'))      lobbyState.currentMode = MODES.YOUTUBE;
            else if (rawPath.includes('music'))   lobbyState.currentMode = MODES.MUSIC;
            else if (rawPath.includes('radio'))   lobbyState.currentMode = MODES.RADIO;
            else if (rawPath.includes('flickr'))  lobbyState.currentMode = MODES.FLICKR;
            else if (rawPath.includes('xxx'))     lobbyState.currentMode = MODES.XXX;
            else if (rawPath.includes('settings')) lobbyState.currentMode = MODES.SETTINGS;
            else if (rawPath.includes('help'))     lobbyState.currentMode = MODES.SETTINGS;
            else                                   lobbyState.currentMode = MODES.HOME;
        }

        console.log(`[Nav] Mode: ${lobbyState.currentMode} | Path: ${lobbyState.ajaxPath}`);
        socket.to(FIXED_ROOM).emit('mirror_ajax_nav', data);
    });

    // 4. CONTROLO DE VÍDEO E TRACKING DE TEMPO
    socket.on('report_current_time', (data) => {
        if (!data.videoId) {
            lobbyState.videoId = null;
            lobbyState.videoTimestamp= 0;
            lobbyState.videoPaused= true;
            return;
        }
        lobbyState.videoTimestamp= data.time;
        lobbyState.videoPaused= data.paused;
        lobbyState.videoId = data.videoId;
        lobbyState.lastUpdate = Date.now();
    });

    socket.on('toPlay', function(data) {
        const time = typeof data === 'object' ? data.time : data;
        lobbyState.videoTimestamp= time; 
        lobbyState.videoPaused= false;
        if (data.videoId) lobbyState.videoId = data.videoId;
        io.to(FIXED_ROOM).emit('Play', time); 
    });

    socket.on('toPause', function(time) {
        lobbyState.videoTimestamp= time;
        lobbyState.videoPaused= true;
        io.to(FIXED_ROOM).emit('Pause', time);
    });

    socket.on('toSeek', function(time) {
        lobbyState.videoTimestamp= time;
        io.to(FIXED_ROOM).emit('Seek', time);
    });

    // 5. RÁDIO
    socket.on('sync_radio_dial', (data) => {
        lobbyState.radioDialIndex = data.index;
        lobbyState.currentMode = MODES.RADIO;
        socket.to(FIXED_ROOM).emit('update_radio_ui', { index: data.index });
    });

    socket.on('stop_radio_global', () => {
        lobbyState.radioStream = null;
        lobbyState.radioName = null;
        io.to(FIXED_ROOM).emit('force_stop_radio');
    });

    // 6. APARÊNCIA (Backgrounds)
socket.on('change_bg', function(data) {
    const url = data.image || data.url;
    if (url) {
        lobbyState.currentBg = url; // ✅ O servidor memoriza o fundo
        socket.to(FIXED_ROOM).emit('background', { url: url });
    }
});

    socket.on('change_bg_index', (index) => {
        lobbyState.currentBg = index;
        // Se tiveres a função saveToDisk definida no sltv.js:
        if (typeof saveToDisk === 'function') saveToDisk({ bgIndex: index });
        io.to(FIXED_ROOM).emit('update_bg_ui', index);
    });

    // 7. UI, SLIDERS & HOVER SYNC
    socket.on('control_event', function(data) {
        socket.to(FIXED_ROOM).emit('sync_ui', { action: data.action });
    });

    socket.on('slider_event', function(data) {
        socket.to(FIXED_ROOM).emit('sync_slider', data);
    });

    socket.on('state_sync', (data) => {
        // Captura background via state_sync (usado no Flickr/Settings)
        if (data.type === 'background') {
            lobbyState.currentBg = data.url || data.value;
        }
        socket.to(FIXED_ROOM).emit('state_sync', data);
    });

    // 8. PEDIDOS DE ESTADO ENTRE PEERS (Fallback)
socket.on('request_current_state', () => {
    // Em vez de pedir aos outros (peers), o servidor responde logo com o que tem na memória
    socket.emit('force_sync_arrival', lobbyState); 
    
    // E também avisa os outros para mandarem o estado deles por precaução
    socket.to(FIXED_ROOM).emit('get_sync_state', { requesterId: socket.id });
});

    socket.on('report_sync_state', (data) => {
        if (data.requesterId) {
            io.to(data.requesterId).emit('apply_sync_state', data);
        }
    });

    // 9. DESCONEXÃO E LIMPEZA
    socket.on('disconnect', function() {
        const room = io.sockets.adapter.rooms.get(FIXED_ROOM);

        if (!room || room.size === 0) {
            console.log("--- Sala Vazia: Reiniciando Estado Global ---");
            lobbyState.currentMode = MODES.HOME;
            lobbyState.ajaxPath = null;
            lobbyState.videoId = null;
            lobbyState.videoTimestamp= 0;
            lobbyState.videoPaused= true;
            lobbyState.radioStream = null;
            lobbyState.radioName = null;
            lobbyState.radioDialIndex = 5;
            lobbyState.currentBg = null;
            lobbyState.lastUpdate = Date.now();
        } else {
            console.log(`[Out] Dispositivos restantes: ${room.size}`);
        }
    });
});


server.listen(PORT, () => console.log(`Listening on ${ PORT }`));