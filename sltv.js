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
app.use(session({
    secret: process.env.SESSION_SECRET || 'sltv_secret_key_123', // Use uma string forte no .env
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false, // Defina como true se estiver usando HTTPS
        maxAge: 24 * 60 * 60 * 1000 // A sessão dura 24 horas
    }
}));

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

/////////////////////////////////////////////////
// PEER SERVER
const peerServer = ExpressPeerServer(server, {
    debug: false,
    path: '/'
});
app.use('/peerjs', peerServer);

// START SERVER
server.listen(PORT, () => {
    console.log(`Listening on ${PORT}`);
});