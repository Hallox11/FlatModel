'use strict';

require('dotenv').config();

const express  = require('express');
const session  = require('express-session');
const http     = require('http');
const path     = require('path');
const fs       = require('fs');
const net      = require('net');
const tls      = require('tls');
const dns      = require('dns').promises;
const crypto   = require('crypto');
const axios    = require('axios');
const Database = require('better-sqlite3');
const { Server } = require('socket.io');
const { ExpressPeerServer } = require('peer');

const createRouter = require('./routes');
const { createTvState, ensureSchema } = require('./tvState');
const initSocketIO = require('./socket');

/////////////////////////////////////////////////
// PROCESS-LEVEL SAFETY NETS
// An async scraper/ping failing must not take the whole TV server down.
process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
    // State is undefined after this: exit and let pm2 / Render restart us.
    setTimeout(() => process.exit(1), 100);
});

/////////////////////////////////////////////////
// CONFIG
const PORT         = process.env.PORT || 3000;
const BEHIND_PROXY = !!process.env.RENDER_EXTERNAL_URL || process.env.TRUST_PROXY === '1';
const DEBUG_UA     = process.env.DEBUG_UA === '1';
const BODY_LIMIT   = process.env.BODY_LIMIT || '1mb';

// Resolve a folder next to this file, falling back to the working directory
// (keeps working if the project was previously started from another folder).
function resolveDir(name) {
    const beside = path.join(__dirname, name);
    return fs.existsSync(beside) ? beside : path.resolve(name);
}

const app    = express();
const server = http.createServer(app);

app.disable('x-powered-by');
if (BEHIND_PROXY) app.set('trust proxy', 1);   // real client IP behind Render / nginx

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
});

/////////////////////////////////////////////////
// ANTI-HIBERNATION ENDPOINT (For UptimeRobot / Cron-Job)
app.get('/ping', (req, res) => {
    res.status(200).send('Awake');
});

/////////////////////////////////////////////////
// BODY PARSERS (declared once; raise BODY_LIMIT in .env only if a route really needs it)
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ limit: BODY_LIMIT, extended: true, parameterLimit: 5000 }));

/////////////////////////////////////////////////
// DATABASE (opened early: the session store lives in it too)
const DB_FILE = (() => {
    if (process.env.DB_PATH) return process.env.DB_PATH;
    const beside = path.join(__dirname, 'sltv_data.sqlite');
    const legacy = path.resolve('./sltv_data.sqlite');
    if (fs.existsSync(beside)) return beside;
    if (fs.existsSync(legacy)) {
        console.warn(`[DB] Using existing database from the working directory: ${legacy}`);
        return legacy;
    }
    return beside;
})();

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
console.log(`Connected to SQLite database (${DB_FILE}).`);

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
    CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON interactions(timestamp);
    CREATE INDEX IF NOT EXISTS idx_tv_registry_last_seen  ON tv_registry(last_seen);
`);

// On startup: mark all TVs offline so a stale TV_ON from a previous run
// is never trusted before the TV has re-registered.
ensureSchema(db);   // adds tv_registry.online / .power and backfills power from the interactions history
// `power` is kept on purpose: the first ping restores the real TV_ON / TV_OFF state.
db.prepare(`UPDATE tv_registry SET online = 0, status = 'OFFLINE'`).run();
console.log('[Registry] All TVs marked OFFLINE on startup.');

// The TV callback url is a control capability: it must never sit in the history table.
const scrubbed = db.prepare(`UPDATE interactions SET url = NULL WHERE url IS NOT NULL`).run().changes;
if (scrubbed) console.log(`[DB] Removed stored TV urls from ${scrubbed} interaction rows.`);

// Retention: dead TVs after TV_RETENTION_DAYS (default 90); interactions only if INTERACTIONS_RETENTION_DAYS > 0.
function runRetention() {
    try {
        const tvDays = parseInt(process.env.TV_RETENTION_DAYS, 10) || 90;
        const tvDel  = db.prepare(`DELETE FROM tv_registry WHERE last_seen IS NOT NULL AND last_seen < datetime('now', ?)`)
                         .run(`-${tvDays} days`).changes;
        if (tvDel) console.log(`[Retention] Removed ${tvDel} TVs not seen for ${tvDays}+ days.`);

        const intDays = parseInt(process.env.INTERACTIONS_RETENTION_DAYS, 10) || 0;
        if (intDays > 0) {
            const intDel = db.prepare(`DELETE FROM interactions WHERE timestamp < datetime('now', ?)`)
                             .run(`-${intDays} days`).changes;
            if (intDel) console.log(`[Retention] Removed ${intDel} interactions older than ${intDays} days.`);
        }
    } catch (err) {
        console.error('[Retention] Error:', err.message);
    }
}
runRetention();
const retentionTimer = setInterval(runRetention, 24 * 60 * 60 * 1000);
retentionTimer.unref();

/////////////////////////////////////////////////
// BLACKLIST SCHEMA & HELPER
db.exec(`
    CREATE TABLE IF NOT EXISTS blacklist (
        uuid TEXT PRIMARY KEY,
        reason TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// Optional: Fallback/Sync support for a local json file if you prefer file-based storage
const BLACKLIST_FILE = path.join(__dirname, 'blacklist.json');

function isUserBlacklisted(uuid) {
    if (!uuid) return false;
    // Check SQLite database
    const row = db.prepare('SELECT 1 FROM blacklist WHERE uuid = ?').get(uuid.toLowerCase());
    if (row) return true;

    // Optional backup check: blacklist.json
    try {
        if (fs.existsSync(BLACKLIST_FILE)) {
            const data = JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf8'));
            if (data && Array.isArray(data.blacklisted_uuids)) {
                return data.blacklisted_uuids.some(e => e.uuid.toLowerCase() === uuid.toLowerCase());
            }
        }
    } catch (e) {
        // ignore parse errors
    }
    return false;
}
/////////////////////////////////////////////////
// SECURITY: SL BROWSER RESTRICTION (only the Second Life viewer may use the TV pages)
// The admin dashboard and its APIs are exempt here because routes.js protects them with login.
// /register is called by the LSL script inside the TV (llHTTPRequest), whose user-agent is
// "Second Life LSL/..." and not a viewer browser. It is protected by the shared secret instead.
const UA_EXEMPT = ['/ping', '/register', '/tv-dashboard', '/api/tvs', '/api/interactions', '/api/tv-command'];

const LOCAL_ADDRS = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

app.use((req, res, next) => {
    const ua = req.get('User-Agent') || '';
    if (DEBUG_UA) console.log('[UA]', req.method, req.path, ua);

    // Local development: a browser on this same machine, and only when not behind a proxy.
    // req.socket.remoteAddress is the real TCP peer, so headers cannot fake it.
    if (!BEHIND_PROXY && LOCAL_ADDRS.includes(req.socket.remoteAddress)) {
        return next();
    }

    if (UA_EXEMPT.some(p => req.path === p || req.path.startsWith(p + '/'))) {
        return next();
    }
    if (!/second\s?life/i.test(ua)) {
        return res.status(403).send('Loading, please wait');
    }
    return next();
});

/////////////////////////////////////////////////
// SECURITY: minimal in-memory rate limiter (per client IP, fixed window)
function rateLimit({ windowMs, max }) {
    const hits = new Map();
    const sweep = setInterval(() => {
        const now = Date.now();
        for (const [key, h] of hits) if (h.reset <= now) hits.delete(key);
    }, windowMs);
    sweep.unref();

    return (req, res, next) => {
        const now = Date.now();
        let h = hits.get(req.ip);
        if (!h || h.reset <= now) {
            h = { count: 0, reset: now + windowMs };
            hits.set(req.ip, h);
        }
        if (++h.count > max) {
            res.set('Retry-After', String(Math.ceil((h.reset - now) / 1000)));
            return res.status(429).send('Too many requests');
        }
        next();
    };
}

app.use('/register',       rateLimit({ windowMs: 60 * 1000, max: 300 }));
app.use('/validate-token', rateLimit({ windowMs: 60 * 1000, max: 120 }));
app.use('/api',            rateLimit({ windowMs: 60 * 1000, max: 600 }));

/////////////////////////////////////////////////
// SESSIONS
// Small SQLite-backed store (no extra dependency): survives restarts and does not leak like MemoryStore.
class SQLiteSessionStore extends session.Store {
    constructor(database) {
        super();
        database.exec(`
            CREATE TABLE IF NOT EXISTS sessions (
                sid     TEXT PRIMARY KEY,
                sess    TEXT NOT NULL,
                expires INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);
        `);
        this._get   = database.prepare('SELECT sess FROM sessions WHERE sid = ? AND expires > ?');
        this._set   = database.prepare(`INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?)
                                        ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires`);
        this._del   = database.prepare('DELETE FROM sessions WHERE sid = ?');
        this._touch = database.prepare('UPDATE sessions SET expires = ? WHERE sid = ?');
        this._purge = database.prepare('DELETE FROM sessions WHERE expires <= ?');

        this._timer = setInterval(() => {
            try { this._purge.run(Date.now()); } catch (_) { /* db may be closing */ }
        }, 10 * 60 * 1000);
        this._timer.unref();
    }
    _expiry(sess) {
        const c = sess && sess.cookie;
        if (c && c.expires) return new Date(c.expires).getTime();
        if (c && c.originalMaxAge) return Date.now() + c.originalMaxAge;
        return Date.now() + 10 * 60 * 1000;
    }
    get(sid, cb) {
        try {
            const row = this._get.get(sid, Date.now());
            cb(null, row ? JSON.parse(row.sess) : null);
        } catch (err) { cb(err); }
    }
    set(sid, sess, cb) {
        try { this._set.run(sid, JSON.stringify(sess), this._expiry(sess)); cb && cb(null); }
        catch (err) { cb && cb(err); }
    }
    destroy(sid, cb) {
        try { this._del.run(sid); cb && cb(null); }
        catch (err) { cb && cb(err); }
    }
    touch(sid, sess, cb) {
        try { this._touch.run(this._expiry(sess), sid); cb && cb(null); }
        catch (err) { cb && cb(err); }
    }
    close() { clearInterval(this._timer); }
}

let SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
    SESSION_SECRET = crypto.randomBytes(32).toString('hex');
    console.warn('[Security] SESSION_SECRET is not set: using a random secret for this run (sessions reset on restart). Set it in .env.');
}

const sessionStore = new SQLiteSessionStore(db);

app.use(session({
    store: sessionStore,
    secret: SESSION_SECRET,
    resave: false,             // the store implements touch(), so no forced re-save is needed
    rolling: true,             // reset the cookie expiry on every request
    saveUninitialized: false,  // only persist sessions that actually hold data
    cookie: {
        secure: 'auto',        // secure whenever the request arrived over HTTPS
        httpOnly: true,        // not readable by client-side scripts
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000 // 10 minutes of inactivity
    }
}));

// SESSION ID ROTATION (only active for sessions that carry a `room`)
// Note: it is dormant for TV sessions, which store `activeTvId`. Enabling it there would race with
// parallel requests (old cookie arrives after regenerate), so it is intentionally left as is.
app.use((req, res, next) => {
    if (!req.session || !req.session.room) return next();

    const NOW = Date.now();
    const ROTATION_INTERVAL = 10 * 60 * 1000;

    if (!req.session.lastRotated) req.session.lastRotated = NOW;
    if (NOW - req.session.lastRotated <= ROTATION_INTERVAL) return next();

    // Keep EVERYTHING on the session (not just room/tvId), then restore it on the new one.
    const saved = {};
    for (const key of Object.keys(req.session)) {
        if (key !== 'cookie') saved[key] = req.session[key];
    }

    req.session.regenerate((err) => {
        if (err) {
            console.error('[Security] Session token rotation failed:', err);
            return next();
        }
        Object.assign(req.session, saved, { lastRotated: NOW });
        console.log(`[Security] Session ID rotated for room: ${saved.room}`);
        next();
    });
});

app.use('/backgrounds', express.static(path.join(resolveDir('backgrounds'))));
app.use(express.static(resolveDir('public')));
app.set('views', resolveDir('views'));
app.set('view engine', 'ejs');

/////////////////////////////////////////////////
// SOCKET.IO
const io = new Server(server, {
    allowEIO3: true,
    perMessageDeflate: false,
    httpCompression: false,
    pingTimeout:    60000,  // SL browser is slow: 60s before disconnect
    pingInterval:   25000,  // keep-alive pulse (default)
    upgradeTimeout: 10000   // more time to upgrade polling -> websocket
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

// Keep FIXED_ROOM as the global fallback for TV-less viewers
const FIXED_ROOM = 'Lobby';

// These are indexed by text that comes from outside (room names, tokens, object ids).
// A null prototype means keys such as "__proto__" or "constructor" are plain, harmless keys.
const roomStates        = Object.create(null);
const tvRegistry        = Object.create(null);
const pendingTokens     = Object.create(null);
const clickerSessionMap = new Map();
const SESSION_TTL       = 30 * 1000;
const tvState           = createTvState({ db, tvRegistry });

const ROOM_NAME_RE = /^[\w.:-]{1,80}$/;
const MAX_ROOMS    = 2000;
const ROOM_IDLE_MS = 6 * 60 * 60 * 1000;

// Drop idle rooms nobody is connected to (never the fixed room).
function sweepRooms() {
    const now    = Date.now();
    const active = io.sockets.adapter.rooms;
    let removed  = 0;
    for (const room of Object.keys(roomStates)) {
        if (room === FIXED_ROOM || active.has(room)) continue;
        if (now - (roomStates[room].lastUpdate || 0) > ROOM_IDLE_MS) {
            delete roomStates[room];
            removed++;
        }
    }
    if (removed) console.log(`[Room] Swept ${removed} idle room state(s).`);
}

function getRoomState(room) {
    // Anything that is not a sane room name falls back to the shared lobby.
    if (typeof room !== 'string' || !ROOM_NAME_RE.test(room)) room = FIXED_ROOM;

    if (!roomStates[room]) {
        if (Object.keys(roomStates).length >= MAX_ROOMS) {
            sweepRooms();
            if (Object.keys(roomStates).length >= MAX_ROOMS && room !== FIXED_ROOM) {
                console.warn(`[Room] Room limit (${MAX_ROOMS}) reached, using ${FIXED_ROOM} instead of "${room}".`);
                room = FIXED_ROOM;
            }
        }
    }

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

// Housekeeping: expired tokens / click sessions are removed even if nobody asks for them again.
const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const token of Object.keys(pendingTokens)) {
        const e = pendingTokens[token];
        if (e && typeof e.expires === 'number' && e.expires <= now) delete pendingTokens[token];
    }
    for (const [clicker, s] of clickerSessionMap) {
        if (s && typeof s.expires === 'number' && s.expires <= now) clickerSessionMap.delete(clicker);
    }
}, 60 * 1000);
cleanupTimer.unref();

const roomSweepTimer = setInterval(sweepRooms, 30 * 60 * 1000);
roomSweepTimer.unref();

/////////////////////////////////////////////////
// ROUTES (with session support)
app.use(createRouter({ io, db, tvRegistry, pendingTokens, clickerSessionMap, SESSION_TTL, FIXED_ROOM }));


/////////////////////////////////////////////////
// BLACKLIST ENDPOINT FOR LSL TV SCRIPTS
app.post('/api/check-blacklist', (req, res) => {
    const { avatar_uuid } = req.body;

    if (!avatar_uuid) {
        return res.status(400).json({ error: "Missing avatar_uuid" });
    }

    if (isUserBlacklisted(avatar_uuid)) {
        return res.json({
            status: "blocked",
            reason: "Access revoked by store administration."
        });
    }

    return res.json({
        status: "allowed"
    });
});
/////////////////////////////////////////////////
// SOCKET.IO HANDLERS
initSocketIO(io, getRoomState, FIXED_ROOM, clickerSessionMap, tvRegistry);

/////////////////////////////////////////////////
// TV PING (bounded concurrency, no overlapping runs, dead TVs skipped)
// Only maintains `online`. The screen state (`power`) is never touched here, so a ping can never
// overwrite TV_ON / TV_OFF the way it used to.
const PING_INTERVAL     = parseInt(process.env.PING_INTERVAL_MS, 10) || 5 * 60 * 1000;
const PING_RETRY_DELAY  = parseInt(process.env.PING_RETRY_DELAY_MS, 10) || 1500;
const PING_CONCURRENCY  = 10;
const PING_MAX_AGE_DAYS = 14;

const stmtPingTargets = db.prepare(`SELECT object_id, url, serial, owner, land, room, ip FROM tv_registry
                                    WHERE url IS NOT NULL AND (last_seen IS NULL OR last_seen >= datetime('now', ?))`);

let pinging = false;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Two attempts: one slow answer from a laggy sim must not flip a TV to OFFLINE
// (OFFLINE now blocks browser access, see /check-status).
async function isReachable(url) {
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            await axios.post(url, 'ping|', { headers: { 'Content-Type': 'text/plain' }, timeout: 5000 });
            return true;
        } catch (_) {
            if (attempt === 1) await sleep(PING_RETRY_DELAY);
        }
    }
    return false;
}

async function pingOne(tv) {
    if (await isReachable(tv.url)) {
        // After a restart the in-memory registry is empty: restore the entry so commands work again.
        if (!tvRegistry[tv.object_id]) {
            tvRegistry[tv.object_id] = { url: tv.url, serial: tv.serial, owner: tv.owner, land: tv.land, room: tv.room, ip: tv.ip };
        }
        tvState.setTvState(tv.object_id, { online: 1, touch: true });
        return true;
    }
    tvState.setTvState(tv.object_id, { online: 0 });   // DB + memory + roomId aliases
    return false;
}

async function pingTvs() {
    if (pinging) return;   // previous round still running
    pinging = true;
    try {
        const rows = stmtPingTargets.all(`-${PING_MAX_AGE_DAYS} days`);
        let alive = 0;
        for (let i = 0; i < rows.length; i += PING_CONCURRENCY) {
            const results = await Promise.all(rows.slice(i, i + PING_CONCURRENCY).map(pingOne));
            alive += results.filter(Boolean).length;
        }
        if (rows.length) console.log(`[Ping] ${alive}/${rows.length} TVs still rezzed.`);
    } catch (err) {
        console.error('[Ping] Error:', err.message);
    } finally {
        pinging = false;
    }
}

const pingTimer = setInterval(pingTvs, PING_INTERVAL);
setTimeout(pingTvs, 5000).unref();   // recover TV states shortly after a restart instead of waiting a full interval

/////////////////////////////////////////////////
// SELF-PING TIMER (optional internal keep-alive loop, every 10 minutes)
if (process.env.RENDER_EXTERNAL_URL) {
    const selfPing = setInterval(async () => {
        try {
            await axios.get(`${process.env.RENDER_EXTERNAL_URL}/ping`, { timeout: 10000 });
            console.log('[Anti-Hibernation] Self-ping dispatched successfully.');
        } catch (err) {
            console.error('[Anti-Hibernation] Self-ping network error:', err.message);
        }
    }, 10 * 60 * 1000);
    selfPing.unref();
}

/////////////////////////////////////////////////
// PEER SERVER
const peerServer = ExpressPeerServer(server, {
    debug: false,
    path: '/',
    proxied: BEHIND_PROXY
});
app.use('/peerjs', peerServer);

/////////////////////////////////////////////////
// SECURE AUDIO STREAM PROXY (bypasses mixed-content blocks)
//
// Anyone able to call this route can make the server open connections, so it is locked down:
//  - only http/https, ports 80, 443 or 1024+
//  - the host is resolved here and every address must be public (no localhost / LAN / cloud metadata);
//    we then connect to that exact IP so DNS cannot change between the check and the connection
//  - redirects are followed (max 3) and re-validated each time
//  - header size, connect/idle timeouts and per-IP / global stream limits
// Set ALLOW_PRIVATE_STREAMS=1 only for local development with a radio on your own LAN.
const ALLOW_PRIVATE_STREAMS = process.env.ALLOW_PRIVATE_STREAMS === '1';
const STREAM_MAX_PER_IP = 6;
const STREAM_MAX_TOTAL  = 200;
const streamsByIp = new Map();
let   streamsTotal = 0;

function isPrivateIp(ip) {
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split('.').map(Number);
        return a === 0 || a === 10 || a === 127
            || (a === 100 && b >= 64 && b <= 127)   // CGNAT
            || (a === 169 && b === 254)             // link-local / cloud metadata
            || (a === 172 && b >= 16 && b <= 31)
            || (a === 192 && b === 168)
            || (a === 192 && b === 0)
            || (a === 198 && (b === 18 || b === 19))
            || a >= 224;                            // multicast / reserved
    }
    if (net.isIPv6(ip)) {
        const v = ip.toLowerCase();
        if (v === '::' || v === '::1') return true;
        if (v.startsWith('::ffff:')) {
            const tail = v.slice(7);
            return net.isIPv4(tail) ? isPrivateIp(tail) : true;
        }
        return v.startsWith('fc') || v.startsWith('fd')
            || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb')
            || v.startsWith('ff')
            || v.startsWith('64:ff9b:') || v.startsWith('2002:');   // NAT64 / 6to4 can embed private IPv4
    }
    return true;
}

async function resolvePublicAddress(host) {
    if (net.isIP(host)) {
        if (!ALLOW_PRIVATE_STREAMS && isPrivateIp(host)) throw new Error('address not allowed');
        return host;
    }
    const addrs = await dns.lookup(host, { all: true });
    if (!addrs.length) throw new Error('host not found');
    if (!ALLOW_PRIVATE_STREAMS && addrs.some(a => isPrivateIp(a.address))) throw new Error('address not allowed');
    return addrs[0].address;
}

function readHeaders(socket) {
    return new Promise((resolve, reject) => {
        let buf = Buffer.alloc(0);
        const timer = setTimeout(() => { cleanup(); reject(new Error('header timeout')); }, 10000);

        function cleanup() {
            clearTimeout(timer);
            socket.removeListener('data', onData);
            socket.removeListener('end', onEnd);
            socket.removeListener('error', onErr);
        }
        function onData(chunk) {
            buf = Buffer.concat([buf, chunk]);
            const i = buf.indexOf('\r\n\r\n');
            if (i !== -1) {
                cleanup();
                socket.pause();
                resolve({ head: buf.slice(0, i).toString('latin1'), rest: buf.slice(i + 4) });
            } else if (buf.length > 16384) {
                cleanup();
                reject(new Error('header too large'));
            }
        }
        function onEnd()  { cleanup(); reject(new Error('closed before headers')); }
        function onErr(e) { cleanup(); reject(e); }

        socket.on('data', onData);
        socket.once('end', onEnd);
        socket.once('error', onErr);
    });
}

async function openUpstream(urlStr, redirectsLeft) {
    if (/[\r\n\0]/.test(urlStr)) throw new Error('invalid url');

    const u = new URL(urlStr);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('unsupported protocol');
    if (u.username || u.password) throw new Error('credentials not allowed');

    const host   = u.hostname.replace(/^\[|\]$/g, '');
    const secure = u.protocol === 'https:';
    const port   = u.port ? parseInt(u.port, 10) : (secure ? 443 : 80);
    if (!(port === 80 || port === 443 || (port >= 1024 && port <= 65535))) throw new Error('port not allowed');

    const ip = await resolvePublicAddress(host);

    const socket = await new Promise((resolve, reject) => {
        const s = secure
            ? tls.connect({ host: ip, port, servername: net.isIP(host) ? undefined : host })
            : net.createConnection({ host: ip, port });
        // Permanent listener: a late socket error must never become an uncaught exception.
        s.on('error', () => {});
        const t = setTimeout(() => { s.destroy(); reject(new Error('connect timeout')); }, 8000);
        s.once(secure ? 'secureConnect' : 'connect', () => { clearTimeout(t); resolve(s); });
        s.once('error', (err) => { clearTimeout(t); reject(err); });
    });

    try {
        // Raw HTTP/1.0 request that Shoutcast v1 understands. "Icy-MetaData: 0" keeps text metadata out of the audio.
        const reqPath = (u.pathname || '/') + (u.search || '');
        socket.write(
            `GET ${reqPath} HTTP/1.0\r\n` +
            `Host: ${u.host}\r\n` +
            `User-Agent: WinampMPEG/5.0\r\n` +
            `Accept: */*\r\n` +
            `Icy-MetaData: 0\r\n` +
            `Connection: close\r\n\r\n`
        );

        const { head, rest } = await readHeaders(socket);
        const m      = /^(?:HTTP\/\d\.\d|ICY)\s+(\d{3})/.exec(head.split('\r\n')[0]);
        const status = m ? parseInt(m[1], 10) : 0;

        if ([301, 302, 303, 307, 308].includes(status)) {
            socket.destroy();
            if (redirectsLeft <= 0) throw new Error('too many redirects');
            const loc = /^location:\s*(.+)$/im.exec(head);
            if (!loc) throw new Error('redirect without location');
            return openUpstream(new URL(loc[1].trim(), u).toString(), redirectsLeft - 1);
        }
        if (status !== 200) throw new Error(`upstream status ${status || 'invalid'}`);

        const ct = /^content-type:\s*([^\r\n;]+)/im.exec(head);
        const contentType = ct && /^audio\//i.test(ct[1].trim()) ? ct[1].trim() : 'audio/mpeg';
        return { socket, rest, contentType };
    } catch (err) {
        socket.destroy();
        throw err;
    }
}

app.get('/proxy-stream', async (req, res) => {
    const target = req.query.url;
    if (typeof target !== 'string' || !target) {
        return res.status(400).send('Missing "url" target stream query parameter.');
    }

    const clientIp = req.ip;
    const mine     = streamsByIp.get(clientIp) || 0;
    if (mine >= STREAM_MAX_PER_IP || streamsTotal >= STREAM_MAX_TOTAL) {
        return res.status(429).send('Too many active streams.');
    }
    streamsByIp.set(clientIp, mine + 1);
    streamsTotal++;

    let released = false;
    let closed   = false;
    let upstream = null;
    const release = () => {
        if (released) return;
        released = true;
        streamsTotal--;
        const left = (streamsByIp.get(clientIp) || 1) - 1;
        if (left > 0) streamsByIp.set(clientIp, left); else streamsByIp.delete(clientIp);
    };

    // Browser stopped the radio / closed the page: drop the upstream connection too.
    res.on('close', () => {
        closed = true;
        release();
        if (upstream) upstream.destroy();
    });

    try {
        const { socket, rest, contentType } = await openUpstream(target, 3);
        upstream = socket;
        if (closed) { socket.destroy(); return; }

        res.status(200);
        res.set({ 'Content-Type': contentType, 'Cache-Control': 'no-store' });
        if (rest.length) res.write(rest);

        socket.setTimeout(30000, () => socket.destroy());   // stalled stream
        socket.on('error', () => res.end());
        socket.pipe(res);                                    // honours backpressure
    } catch (err) {
        console.error('[Proxy Stream]', err.message);
        if (!res.headersSent) res.status(502).send('Stream unavailable.');
        else res.end();
    }
});

/////////////////////////////////////////////////
// START + GRACEFUL SHUTDOWN
server.on('error', (err) => {
    console.error('[Server] Failed to start:', err.message);
    process.exit(1);
});

server.listen(PORT, () => {
    console.log(`Listening on ${PORT}`);
});

function shutdown(signal) {
    console.log(`[Shutdown] ${signal} received, closing...`);
    const force = setTimeout(() => process.exit(1), 10000);
    force.unref();
    clearInterval(pingTimer);
    io.close(() => {   // also closes the HTTP server
        try { sessionStore.close(); db.close(); } catch (_) { /* already closed */ }
        console.log('[Shutdown] Done.');
        process.exit(0);
    });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));