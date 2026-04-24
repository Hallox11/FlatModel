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
const sqlite3 = require('sqlite3').verbose();

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
    httpCompression: false
});

/////////////////////////////////////////////////
// SHARED STATE
const MODES = {
    HOME: 'HOME',
    RADIO: 'RADIO',
    YOUTUBE: 'YOUTUBE',
    MUSIC: 'MUSIC',
    FLICKR: 'FLICKR',
    XXX: 'XXX',
    SETTINGS: 'SETTINGS',
    BROWSER: 'BROWSER',
    // New modes
    MOVIES: 'MOVIES',
    GAME_STREAM: 'GAME_STREAM',
    LIVE_TV: 'LIVE_TV',
    GAMES: 'GAMES',
    FREEBIES: 'FREEBIES',
    SECOND_LIFE: 'SECOND_LIFE'
};

let lobbyState = {
    currentMode: MODES.HOME,
    ajaxPath: null,
    lastUpdate: Date.now(),
    currentBg: null,
    textContrast: 'light',
    videoId: null,
    videoTimestamp: 0,
    videoPaused: true,
    videoOrigin: 'youtube',
    radioStream: null,
    radioName: null,
    radioDialIndex: null,
    flickrQuery: '',
    flickrActiveImage: null,
    flickrIsSlideshow: false,
    // New mode states (add only what needs shared state)
    movieQuery: null,
    liveChannel: null,
    gameStreamUrl: null,
    currentGame: null
};

let tvRegistry    = {};
const pendingTokens     = {};
const clickerSessionMap = new Map();
const SESSION_TTL       = 30 * 1000;
const FIXED_ROOM        = "Lobby";

/////////////////////////////////////////////////
// DATABASE
const db = new sqlite3.Database('./sltv_data.sqlite', (err) => {
    if (err) console.error("Database opening error:", err.message);
    else console.log("Connected to SQLite database.");
});

db.serialize(() => {
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
// ROUTES (Agora com suporte a sessão)
app.use(createRouter({ io, db, tvRegistry, pendingTokens, clickerSessionMap, SESSION_TTL, FIXED_ROOM }));

/////////////////////////////////////////////////
// SOCKET.IO
initSocketIO(io, lobbyState, FIXED_ROOM);

/////////////////////////////////////////////////
// TV PING
const PING_INTERVAL = parseInt(process.env.PING_INTERVAL_MS) || 5 * 60 * 1000;

async function pingTvs() {
    db.all(`SELECT object_id, url FROM tv_registry`, [], async (err, rows) => {
        if (err) return console.error(err);

        for (const tv of rows) {
            try {
                await axios.post(tv.url, "ping|", {
                    headers: { 'Content-Type': 'text/plain' },
                    timeout: 5000
                });
                db.run(`UPDATE tv_registry SET status = 'ONLINE', last_seen = CURRENT_TIMESTAMP WHERE object_id = ?`, [tv.object_id]);
                console.log(`TV ${tv.object_id} is still rezzed.`);
            } catch (error) {
                db.run(`UPDATE tv_registry SET status = 'OFFLINE' WHERE object_id = ?`, [tv.object_id]);
            }
        }
    });
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