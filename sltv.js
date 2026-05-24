const express = require('express');
const session = require('express-session'); // 1. Importar o módulo de sessão

require('dotenv').config();
const app = express();
const http = require('http');
var path = require('path');
const server = http.createServer(app);
const { Server } = require("socket.io");

const axios = require('axios');
const PORT = process.env.PORT || 3000;
const fs = require('fs');
const Database = require('better-sqlite3');

const createRouter = require('./routes');
const initSocketIO = require('./socket');
const { ExpressPeerServer } = require('peer');

// --- MIDDLEWARES BASE ---
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true, parameterLimit: 50000}));

// 2. CONFIGURAÇÃO DA SESSÃO (Deve vir antes das rotas e depois do parser de JSON)
// --- MIDDLEWARES BASE ---
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true, parameterLimit: 50000}));

// 2. SECURE ROLLING CONFIGURATION FOR EXPRESS-SESSION
app.use(session({
    secret: process.env.SESSION_SECRET || 'sltv_secret_key_123', 
    resave: true,              // Enforces saving back to store to update access timers
    rolling: true,             // Resets cookie maxAge expiration on every single network request
    saveUninitialized: false,  // Don't save empty sessions; only save when variables are set
    cookie: { 
        secure: false,         // Set to true if using HTTPS
        httpOnly: true,        // Prevents client-side scripts from stealing the session cookie
        maxAge: 10 * 60 * 1000 // 10 Minutes: Inactive links/copied URLs die rapidly
    }
}));

// 3. ENHANCED SECURITY MIDDLEWARE: SESSION STRING ROTATION
app.use((req, res, next) => {
    // Skip if there's no active room session assigned yet
    if (!req.session || !req.session.room) {
        return next();
    }

    const NOW = Date.now();
    const ROTATION_INTERVAL = 10 * 60 * 1000; // Force-rotate IDs every 10 minutes

    // Initialize rotation tracking timestamp if it doesn't exist
    if (!req.session.lastRotated) {
        req.session.lastRotated = NOW;
    }

    // Has it been longer than 10 minutes since this specific browser changed its security ID token?
    if (NOW - req.session.lastRotated > ROTATION_INTERVAL) {
        
        // Step A: Cache the critical synchronization state data 
        const savedRoomState = req.session.room;
        const savedTvIdState = req.session.tvId;

        // Step B: Explicitly regenerate the physical server session identifier
        req.session.regenerate((err) => {
            if (err) {
                console.error("[Security] Session token rotation failed:", err);
                return next();
            }

            // Step C: Restore data properties back onto the brand new session token mapping
            req.session.room = savedRoomState;
            req.session.tvId = savedTvIdState;
            req.session.lastRotated = NOW;

            console.log(`[Security] Session ID successfully rotated for Room: ${savedRoomState}`);
            next();
        });
    } else {
        next();
    }
});

// ============================================================
// ANTI-HIBERNATION ENDPOINT (For UptimeRobot / Cron-Job)
// ============================================================
app.get('/ping', (req, res) => {
    res.status(200).send('Awake');
});

app.use('/backgrounds', express.static(path.join(__dirname, 'backgrounds')));
app.use(express.static('public'));
app.set('view engine', 'ejs');

const io = new Server(server, {
    allowEIO3: true,
    perMessageDeflate: false,
    httpCompression: false,
    pingTimeout:    60000,  // SL browser is slow — 60s before disconnect
    pingInterval:   25000,  // keep-alive pulse (default)
    upgradeTimeout: 10000   // more time to upgrade polling → websocket
});

/////////////////////////////////////////////////
// SHARED STATE
const MODES = {
    HOME:        'HOME',
    RADIO:       'RADIO',
    YOUTUBE:     'YOUTUBE',
    MUSIC:       'MUSIC',
    FLICKR:      'FLICKR',
    XXX:         'XXX',
    SETTINGS:    'SETTINGS',
    BROWSER:     'BROWSER',
    MOVIES:      'MOVIES',
    GAME_STREAM: 'GAME_STREAM',
    LIVE_TV:     'LIVE_TV',
    GAMES:       'GAMES',
    FREEBIES:    'FREEBIES',
    SECOND_LIFE: 'SECOND_LIFE',
    WATCH_TOGETHER: 'WATCH_TOGETHER',
    KOSMI:       'KOSMI',
    CYTUBE:      'CYTUBE',
    CLIP_GAMES:  'CLIP_GAMES'
};

// Instead of a single lobbyState, each TV room gets its own state
const roomStates = {};

function getRoomState(room) {
    if (!roomStates[room]) {
        roomStates[room] = {
            currentMode:      MODES.HOME,
            ajaxPath:         null,
            lastUpdate:       Date.now(),
            currentBg:        null,
            textContrast:     'light',
            videoId:          null,
            videoTimestamp:   0,
            videoPaused:      true,
            videoOrigin:      'youtube',
            radioStream:      null,
            radioName:        null,
            radioDialIndex:   null,
            flickrQuery:      '',
            flickrActiveImage: null,
            flickrIsSlideshow: false,
            movieQuery:       null,
            liveChannel:      null,
            gameStreamUrl:    null,
            currentGame:      null
        };
        console.log(`[Room] Created state for room: ${room}`);
    }
    return roomStates[room];
}

// Keep FIXED_ROOM as the global fallback for TV-less viewers
const FIXED_ROOM = "Lobby";

let tvRegistry          = {};
const pendingTokens     = {};
const clickerSessionMap = new Map();
const SESSION_TTL       = 30 * 1000;


/////////////////////////////////////////////////
// DATABASE
const db = new Database('./sltv_data.sqlite');
console.log("Connected to SQLite database.");

db.exec(`
    CREATE TABLE IF NOT EXISTS interactions (
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
    );
    CREATE TABLE IF NOT EXISTS tv_registry (
        object_id TEXT PRIMARY KEY,
        url TEXT,
        status TEXT,
        status2 TEXT,
        serial TEXT,
        owner TEXT,
        land TEXT,
        room TEXT,
        ip TEXT,
        last_seen DATETIME
    );
`);

// On startup: mark all TVs offline in DB and clear in-memory registry.
// This prevents stale TV_ON entries from a previous session causing
// the browser to think a TV is online before it has re-registered.
db.prepare(`UPDATE tv_registry SET status = 'OFFLINE'`).run();
console.log("[Registry] All TVs marked OFFLINE on startup.");

/////////////////////////////////////////////////
// ROUTES (Agora com suporte a sessão)
app.use(createRouter({ io, db, tvRegistry, pendingTokens, clickerSessionMap, SESSION_TTL, FIXED_ROOM }));

/////////////////////////////////////////////////
// SOCKET.IO
initSocketIO(io, getRoomState, FIXED_ROOM, clickerSessionMap, tvRegistry);

/////////////////////////////////////////////////
// TV PING
const PING_INTERVAL = parseInt(process.env.PING_INTERVAL_MS) || 5 * 60 * 1000;

async function pingTvs() {
    const rows = db.prepare(`SELECT object_id, url FROM tv_registry`).all();

    for (const tv of rows) {
        try {
            await axios.post(tv.url, "ping|", {
                headers: { 'Content-Type': 'text/plain' },
                timeout: 5000
            });
            db.prepare(`UPDATE tv_registry SET status = 'ONLINE', last_seen = CURRENT_TIMESTAMP WHERE object_id = ?`).run(tv.object_id);
            console.log(`TV ${tv.object_id} is still rezzed.`);
        } catch (error) {
            db.prepare(`UPDATE tv_registry SET status = 'OFFLINE' WHERE object_id = ?`).run(tv.object_id);
        }
    }
}

setInterval(pingTvs, PING_INTERVAL);
////////////////////////////////////////////////
// ============================================================
// SELF-PING TIMER (Optional Internal Keep-Alive Loop)
// ============================================================
if (process.env.RENDER_EXTERNAL_URL) {
    setInterval(async () => {
        try {
            const selfUrl = `${process.env.RENDER_EXTERNAL_URL}/ping`;
            await axios.get(selfUrl);
            console.log("[Anti-Hibernation] Self-ping dispatched successfully.");
        } catch (err) {
            console.error("[Anti-Hibernation] Self-ping network error:", err.message);
        }
    }, 10 * 60 * 1000); // Triggers every 12 minutes to beat the 15-minute idle cutoff
}
/////////////////////////////////////////////////
// PEER SERVER
const peerServer = ExpressPeerServer(server, {
    debug: false,
    path: '/'
});
app.use('/peerjs', peerServer);

// ============================================================
// NEW: SECURE AUDIO STREAM PROXY (Bypasses Mixed Content Blocks)
// ============================================================
app.get('/proxy-stream', (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).send('Missing "url" target stream query parameter.');
    }

    // Security check: validate that the requested URL is an unencrypted http audio stream
    if (!targetUrl.startsWith('http://')) {
        return res.status(400).send('Proxy target must be a standard http stream.');
    }

    // Set response headers to inform the browser it is treating this stream as an audio chunk
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Pipe the external audio data directly through our server response
    http.get(targetUrl, (streamRes) => {
        streamRes.pipe(res);
    }).on('error', (err) => {
        console.error("[Audio Proxy Error]:", err.message);
        if (!res.headersSent) {
            res.status(500).send('Unable to stream source audio material.');
        }
    });
});


// START SERVER
server.listen(PORT, () => {
    console.log(`Listening on ${PORT}`);
});