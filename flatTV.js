const express = require('express');

require('dotenv').config();
const app = express();
const http = require('http');
var path = require('path');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const axios = require('axios');
const PORT = process.env.PORT || 3000;
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const createRouter = require('./routes');
const initSocketIO = require('./socket');

app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true, parameterLimit: 50000}));
app.use('/backgrounds', express.static(path.join(__dirname, 'backgrounds')));
app.use(express.static('public'));
app.set('view engine', 'ejs');

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
    BROWSER: 'BROWSER'
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
    flickrIsSlideshow: false
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
// ROUTES
app.use(createRouter({ io, db, tvRegistry, pendingTokens, clickerSessionMap, SESSION_TTL, FIXED_ROOM }));

/////////////////////////////////////////////////
// SOCKET.IO
initSocketIO(io, lobbyState, FIXED_ROOM);

/////////////////////////////////////////////////
// TV PING — every 5 minutes (was incorrectly 10s before)
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
server.listen(PORT, () => console.log(`Listening on ${PORT}`));
