
const express = require('express');
const request = require('request');
const axios = require("axios");
const cheerio = require("cheerio");
require('dotenv').config();
const app = express();
const ejs = require('ejs');
const http = require('http');
var path = require('path');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

const PORT = process.env.PORT || 3000;

const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const favPath = path.join(__dirname, 'favorites.json');

//app.use(bodyParser.urlencoded({extended:true}));
//app.use(bodyParser.json());

app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true, parameterLimit: 50000}));
app.use('/backgrounds', express.static(path.join(__dirname, 'backgrounds')));
app.use(express.static('public'));
app.set('view engine', 'ejs');


// Updated global state to track everything happening in the room
let lobbyState = {
    url: '/',
    videoId: null,
    timestamp: 0,
    isPaused: true,
    currentBg: null,
    radioData: null,
    radioIndex: 0,      // <--- ADD THIS: Tracks the dial position (0, 1, 2...)
    activeTag: null,
    ajaxPath: null,
    lastUpdate: Date.now()
};


// 3. Secret key for verification
const MY_SECRET = process.env.MY_SECRET || "MyUltraSecret123"; // ⚠️ move to .env
let activeTvUrl = null;
let tvRegistry = {};
let BASE_URL = process.env.BASE_URL || "https://gearldine-unintrusted-carey.ngrok-free.dev/"; // ⚠️ move to .env
const FIXED_ROOM = "Lobby";

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
    land_name TEXT,
    land_id TEXT,
    pos TEXT,
    nearby TEXT,
    object_id TEXT,
    serial TEXT,
    url TEXT, 
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// NEW: Persistent TV Registry — load after table is guaranteed to exist
db.run(`CREATE TABLE IF NOT EXISTS tv_registry (
    object_id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    owner TEXT,
    land TEXT,
    room TEXT,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
    if (err) return console.error("Failed to create tv_registry:", err.message);


    // NEW: Load registry from DB on startup
db.all("SELECT * FROM tv_registry", [], (err, rows) => {
    if (err) return console.error("Failed to load TV registry:", err.message);
    rows.forEach(row => {
        tvRegistry[row.object_id] = {
            url: row.url,
            owner: row.owner,
            land: row.land,
            room: row.room
        };
    });
    console.log(`[Registry] Loaded ${rows.length} TVs from DB.`);
});

});

/////////////////////////////////////////////////



/////////////////////////////////////////////////
// 4. Register Endpoint (LSL Handshake)
const clickerSessionMap = new Map();
const SESSION_TTL = 30 * 1000;

app.post('/register', (req, res) => {
    const {
        secret, owner, creator, clicker, land_name,
        land_id, pos, nearby, object_id, serial, url
    } = req.body;

    if (secret !== MY_SECRET) return res.status(403).send("Denied");


        console.log(`[System] Active TV URL updated to: ${activeTvUrl}`);
        console.log("Secret: ", secret);
        console.log("owner: ", owner);
        console.log("creator: ", creator);
        console.log("clicker: ", clicker);
        console.log("land_name: ", land_name);
        console.log("land_id: ", land_id);
        console.log("pos: ", pos);
        console.log("nearby: ", nearby);
        console.log("object_id: ", object_id);
        console.log("serial: ", serial);
        console.log("url: ", url);



    // Session map
    if (clicker && clicker !== "Unknown" && object_id) {
        clickerSessionMap.set(clicker, {
            object_id,
            expires: Date.now() + SESSION_TTL
        });
        console.log(`[Session] ${clicker} -> TV ${object_id}`);
            io.to(FIXED_ROOM).emit('tv_registered', { clicker, object_id });
    }

    // Memory + DB persistence
    if (object_id && url) {
        tvRegistry[object_id] = { url, owner, land: land_name, room: `room_${land_id}` };
        activeTvUrl = url;

        // NEW: Upsert into tv_registry
        db.run(`
            INSERT INTO tv_registry (object_id, url, owner, land, room, last_seen)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(object_id) DO UPDATE SET
                url        = excluded.url,
                owner      = excluded.owner,
                land       = excluded.land,
                room       = excluded.room,
                last_seen  = CURRENT_TIMESTAMP
        `, [object_id, url, owner, land_name, `room_${land_id}`], (err) => {
            if (err) console.error("[Registry] Failed to persist:", err.message);
            else console.log(`[Registry] TV ${object_id} saved.`);
        });
    }

    // Log interaction
    const sql = `INSERT INTO interactions
        (owner, creator, clicker, land_name, land_id, pos, nearby, object_id, serial, url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [owner, creator, clicker, land_name, land_id, pos, nearby, object_id, serial, url], function(err) {
        if (err) return res.status(500).send("DB Error");
        res.status(200).json({ status: "success", target_id: object_id, message: "TV Synchronized." });
    });
});

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


// Keep ONLY this one
app.post('/send-command', (req, res) => {
    const { target_id, command, value } = req.body;
console.log("Target: ",target_id)
console.log("Comand: ",command)
    // Find the specific URL for THIS TV ID
    const tvData = tvRegistry[target_id];

    if (tvData && tvData.url) {
        axios.post(tvData.url, { command, value })
            .then(() => res.json({ status: "Sent to " + target_id }))
            .catch(err => res.status(500).json({ error: "TV Unreachable" }));
    } else {
        res.status(404).json({ error: "TV not found in registry" });
    }
});

///////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////
// *** GET Routes - display pages ***
// Root Route
/*
app.get('/', function (req, res) {
    res.render('pages/index');
});
*/

///////////////////////////////////////////////////////////
// Initialize file if it doesn't exist
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
//////////////////////////////////////////////////////7777




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
app.get('/radios/sl_radio_player', function (req, res) {
    res.render('pages/radios/sl_radio_player');
 });
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
app.get('/music/ytmusic', function (req, res) {
    // Log this to your Terminal (Node console) to see what Express sees
    console.log( req.query); 

    // Explicitly pull the keys from the query object
    const id = req.query.id || ""; 
    const mode = req.query.mode || "";

    res.render('pages/music/ytmusic', { 
        targetID: id, 
        targetMode: mode 
    });
});
app.get('/music/tvytube', (req, res) => {
    // 1. EXTRACT FROM URL QUERY
    // These names MUST match what you send from the Grid's handleNav()
    const videoId = req.query.videoId;   // The YouTube ID
    const targetID = req.query.targetID; // e.g., 'jazz' or 'UC...'
    const mode = req.query.targetMode;   // e.g., 'user' or 'mix'
    const scroll = req.query.scrollPos;  // The scroll position to return to

    // 2. LOG FOR DEBUGGING (Check your terminal if it stays black!)
    console.log(`--- Loading Player ---`);
    console.log(`ID: ${videoId} | Category: ${targetID} | Scroll: ${scroll}`);

    // 3. RENDER WITH FALLBACKS
    // This prevents EJS from crashing if a variable is missing
    res.render('pages/tvytube', { 
        videoId: videoId || '', 
        targetID: targetID || 'concerts', 
        targetMode: mode || 'mix', 
        scrollPos: scroll || 0 
    });
});



//////////////////////////////////////////////////////////////////////////
//OPEN MOVIES MENU
/////////////////////////////////////////////////////////////////////////
 app.get('/movies-menu', function (req, res) {
  res.render('pages/movies-menu');
});
//OPEN MOVIES SLIDSHOW MENU
app.get('/movies/ytmovies', (req, res) => {
    // req.query.id matches the ?id=... in your handleNav call
    const id = req.query.id || ""; 
    const mode = req.query.mode || "user"; 

    res.render('pages/movies/ytmovies', { 
        targetID: id, 
        targetMode: mode 
    });
});
//OPEN MOVIES PLAYER MENU
app.get('/movies/tvytube', (req, res) => {
    // 1. EXTRACT FROM URL QUERY
    // These names match what you send from the Grid's handleNav()
    const videoId = req.query.videoId;    // The YouTube ID
    const targetID = req.query.targetID;  // e.g., 'scifi' or 'UC...'
    const mode = req.query.targetMode;    // e.g., 'user' or 'mix'
    const scroll = req.query.scrollPos;   // The scroll position to return to

    // 2. LOG FOR DEBUGGING
    console.log(`--- Loading Movie Player ---`);
    console.log(`Movie ID: ${videoId} | Category: ${targetID} | Scroll: ${scroll}`);

    // 3. RENDER WITH MOVIE-SPECIFIC FALLBACKS
    // Note: Pointing to your movies ejs folder instead of music
    res.render('pages/movies/tvytube', { 
        videoId: videoId || '', 
        targetID: targetID || 'full+movies+english+-hindi', // Movie-specific default
        targetMode: mode || 'tags', 
        scrollPos: scroll || 0 
    });
});

//////////////////////////////////////////////////////////////////////////
// SEVERAL ENDPOINTS
//////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////
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
    const tvId = req.query.tv || null; // ← captura o ID

    if (isAjax) {
        return res.render('pages/settings', { 
            baseUrl: fullBaseUrl,
            tvId: tvId,        // ← passa ao template
            layout: false 
        });
    } else {
        return res.render('pages/index', { baseUrl: fullBaseUrl });
    }
});
// RENAME ENDPOINT
app.post('/rename', function (req, res) {
  var filename=req.body.filename;
  var mode = req.body.mode;

  if(mode=='youtube'){
  var from = './public/youtube/' + filename;
  var to = './public/youtube/ytube.txt' ;
  }
  if(mode=='music'){
    var from = './public/' + filename;
    var to = './public/music/ytube.txt' ;
    }
  if(mode=='movies'){
    var from = './public/movies/' + filename;
    var to = './public/movies/ytube.txt' ;
    }  

     
  console.log('From: '+ from)
  console.log('To' + to)

  // File destination.txt will be created or overwritten by default.
fs.copyFile(from, to, (err) => {
  if (err) throw err;
  console.log(filename + ' was copied to ytube.txt');
  res.end('ok');
});
});
/////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////////////////////
//OPEN XXX-BROSWERS CHECK MENU
//////////////////////////////////////////////////////////////////////////
//OPEN XXX CHECK MENU
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
async function searchVideos(tag = "3some", limit = 100) {
    const videos = [];
    let page = 1;

    // Keep fetching until we hit the limit or run out of results
    while (videos.length < limit && page <= 5) { 
        try {
            // Added &p= parameter for pagination
            const url = `https://www.xvideos.com/?k=${encodeURIComponent(tag)}&durf=1080p&p=${page}`;
            const response = await axios.get(url, { headers: { "User-Agent": "Mozilla/5.0" } });
            const $ = cheerio.load(response.data);

            const pageItems = $(".thumb-block");
            
            // If no more videos are found, break the loop
            if (pageItems.length === 0) break;

            pageItems.each((i, el) => {
                if (videos.length >= limit) return false; // Stop if we hit 100

                const title = $(el).find("p.title a").attr("title") || "";
                const pageUrl = $(el).find("p.title a").attr("href");
                const thumbnail = $(el).find("img").attr("data-src") || $(el).find("img").attr("src");

                if (title && pageUrl) {
                    videos.push({
                        title: title.replace(/'/g, "&apos;"), // Sanitize for JS
                        thumbnail,
                        pageUrl: pageUrl.startsWith("http") ? pageUrl : `https://www.xvideos.com${pageUrl}`
                    });
                }
            });

            page++; // Move to the next page for the next loop
        } catch (err) { 
            console.error("Scrape error on page " + page, err); 
            break; 
        }
    }
    return videos;
}
// --- ROUTES ---
app.get('/xvideos-grid', async (req, res) => {
    // 1. Setup variables
    const tag = req.query.tag || "3some";
    const cacheDir = path.join(__dirname, 'cache');
    const cacheFile = path.join(cacheDir, `videos_${tag.replace(/\s+/g, '_')}.json`);
    const CACHE_EXPIRATION = 24 * 60 * 60 * 1000; // 24 Hours

    // Ensure cache folder exists
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

    try {
        let videos = [];

        // 2. Check if Cache exists and is fresh
        if (fs.existsSync(cacheFile)) {
            const stats = fs.statSync(cacheFile);
            const isFresh = (Date.now() - stats.mtimeMs) < CACHE_EXPIRATION;

            if (isFresh) {
                console.log(`[CACHE] Loading results for: ${tag}`);
                videos = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            }
        }

        // 3. If no cache, call your searchVideos function
        if (videos.length === 0) {
            console.log(`[SCRAPE] Fetching live data for: ${tag}`);
            
            // CALLING YOUR FUNCTION HERE
            videos = await searchVideos(tag, 100); 

            // Save to JSON for next time
            if (videos.length > 0) {
                fs.writeFileSync(cacheFile, JSON.stringify(videos, null, 2));
            }
        }

        // 4. Render the page
        res.render('pages/xvideos', { 
            videos: videos, 
            tag: tag 
        });

    } catch (err) {
        console.error("Route Error:", err);
        res.status(500).send("Failed to load videos.");
    }
});
app.get("/get-xxx-stream", async (req, res) => {
    const targetUrl = req.query.url;
    try {
        const response = await axios.get(targetUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
        const match = response.data.match(/html5player\.setVideoHLS\(['"](.*?)['"]\)/);
        if (match) return res.json({ streamUrl: match[1] });
    } catch (err) { res.status(500).send(); }
});
app.get("/xxx-player", (req, res) => {
    res.render("pages/xxx_player", { 
        stream: req.query.stream, 
        title: req.query.title 
    });
});
////////////////////////////////////////////////////////////////////////7

///////////////////////////////////////////////////////////////////
// YOUTUBE ENDPOINTS
///////////////////////////////////////////////////////////////////
async function fetchYouTubeVideos(query, isChannel = false) {
    const key = process.env.YOUTUBE_API_KEY;
    let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=50&relevanceLanguage=en&regionCode=US&key=${key}`;

    if (isChannel) {
        url += `&channelId=${encodeURIComponent(query)}&order=date`;
    } else {
        const searchQuery = query + " english";
        url += `&q=${encodeURIComponent(searchQuery)}`;
    }

    try {
        const searchRes = await fetch(url);
        
        // 1. Check if the response is okay (status 200-299)
        if (!searchRes.ok) {
            const errorData = await searchRes.json();
            
            // Handle Quota Exceeded specifically (Error code 403)
            if (searchRes.status === 403) {
                console.error("🚨 YOUTUBE QUOTA EXCEEDED:", errorData.error.message);
                return []; 
            }
            
            throw new Error(`YouTube API Error: ${searchRes.status} - ${errorData.error.message}`);
        }

        const searchData = await searchRes.json();

        // 2. Only track quota if the request was actually successful
        trackQuota(100);

        if (!searchData.items || searchData.items.length === 0) {
            console.warn(`[YT] No results found for: ${query}`);
            return [];
        }

        return searchData.items.map(i => ({
            videoId: i.id.videoId,
            title: i.snippet.title,
            channel: i.snippet.channelTitle,
            thumbnail:
                i.snippet.thumbnails.maxres?.url ||
                i.snippet.thumbnails.high?.url ||
                i.snippet.thumbnails.default?.url
        }));

    } catch (err) {
        // 3. Catch network timeouts or other unexpected crashes
        console.error("❌ FETCH ERROR:", err.message);
        return []; // Return empty array so the UI doesn't break
    }
}
async function getYouTubeVideos(query, isChannel = false) {
    const cacheDir  = path.join(__dirname, 'cache/youtube');
    
    // Create a unique filename for channels vs tags
    const prefix = isChannel ? 'chan' : 'tag';
    const safeQuery = query.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const cacheFile = path.join(cacheDir, `yt_${prefix}_${safeQuery}.json`);
    
    const CACHE_EXPIRATION = 24 * 60 * 60 * 1000; // 24 hours

    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

    // 1. Check cache
    if (fs.existsSync(cacheFile)) {
        const stats = fs.statSync(cacheFile);
        const isFresh = (Date.now() - stats.mtimeMs) < CACHE_EXPIRATION;
        
        if (isFresh) {
            console.log(`[YT CACHE] Hit: ${prefix}_${query}`);
            return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        }
    }

    // 2. Fetch live
    console.log(`[YT FETCH] ${isChannel ? 'Channel' : 'Tag'}: ${query}`);
    const videos = await fetchYouTubeVideos(query, isChannel);
    
    // 3. Save to cache
    if (videos && videos.length > 0) {
        fs.writeFileSync(cacheFile, JSON.stringify(videos, null, 2));
    }

    return videos;
}
// index.js - The Only YouTube Route You Need
app.get('/youtube', async (req, res) => {
    let favoritesData = [];
    const favPath = path.join(__dirname, 'config', 'YT-favorites.json');

    // 1. Extract all needed query params
    const tag = req.query.tag || 'secondlife';
    const isChannel = req.query.isChannel === 'true';
    const scrollPos = req.query.scrollPos || 0; // Capture scroll to pass it back to the grid view

    try {
        // 2. Always Load Favorites
        if (fs.existsSync(favPath)) {
            const raw = fs.readFileSync(favPath, 'utf8').trim();
            if (raw) favoritesData = JSON.parse(raw);
        }

        // 3. Fetch Videos
        const videos = await getYouTubeVideos(tag, isChannel);

        // 4. Render the grid with all variables needed by your EJS and JS logic
        res.render('pages/youtube', { 
            videos: videos, 
            favorites: favoritesData, 
            tag: tag,
            isChannel: isChannel, // Fixes your ReferenceError
            scrollPos: scrollPos,  // Allows the grid to auto-scroll on load
            req: req               // Safety: passes the full request object
        });

    } catch (err) {
        console.error("❌ YOUTUBE ROUTE ERROR:", err.message);
        res.render('pages/youtube', { 
            videos: [], 
            favorites: favoritesData, 
            tag: tag,
            isChannel: isChannel,
            scrollPos: scrollPos,
            req: req
        });
    }
});
app.get('/tvytube', (req, res) => {
    const videoId = req.query.videoId || '';
    const title   = req.query.title   || '';
    
    // Extract origin and scrollPos from query if they exist, 
    // otherwise set sensible defaults.
    const origin    = req.query.origin    || 'youtube'; 
    const scrollPos = req.query.scrollPos || 0;
    const isChannel = req.query.isChannel || 'false';

    res.render('pages/tvytube', { 
        videoId, 
        targetID:   videoId, 
        targetMode: 'user', 
        scrollPos:  scrollPos,
        origin:     origin,    // <--- Fixes your error
        isChannel:  isChannel  // <--- Also needed for your script
    });
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
///////////////////////////////////////////////////////////////////////
const quotaPath = path.join(__dirname, 'cache/quota.json');

function loadQuota() {
    if (!fs.existsSync(quotaPath)) return { date: '', used: 0 };
    return JSON.parse(fs.readFileSync(quotaPath, 'utf8'));
}

function trackQuota(units) {
    let q = loadQuota();
    if (q.date !== new Date().toDateString()) {
        q = { date: new Date().toDateString(), used: 0 };
    }
    q.used += units;
    fs.writeFileSync(quotaPath, JSON.stringify(q, null, 2));
    console.log(`[QUOTA] Used today: ${q.used} / 10000`);
    return q;
}

app.get('/api/quota', (req, res) => {
    const q = loadQuota();
    const today = new Date().toDateString();
    if (q.date !== today) return res.json({ used: 0, remaining: 10000 });
    res.json({
        used: q.used,
        remaining: 10000 - q.used,
        date: q.date
    });
});

//////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////
var count=0;
var playTime=0;

// ===============================
// GLOBAL CONFIG & CONSTANTS
// ===============================


// ===============================
// SOCKET.IO LOGIC
// ===============================

// 1. Create a global object to track the room's current "Live" status




io.on('connection', function(socket) {
    // 1. AUTO-JOIN FIXED ROOM
    socket.join(FIXED_ROOM);

    // 2. IMMEDIATE SYNC: Send the full current state to the new arrival
    console.log(`Viewer ${socket.id} joined. Syncing to: ${lobbyState.url}`);
   
   
    socket.emit('force_sync_arrival', {
        ...lobbyState,
        timestamp: lobbyState.isPaused
            ? lobbyState.timestamp
            : lobbyState.timestamp + (Date.now() - (lobbyState.lastUpdate || Date.now())) / 1000
    });

    // ... inside io.on('connection', function(socket) { ...

// Inside your io.on('connection', (socket) => { ... })
socket.on('sync_radio_dial', (data) => {
    // Store it in the global state
    lobbyState.radioIndex = data.index;
    
    // Send to everyone in the FIXED_ROOM except the sender
    socket.to(FIXED_ROOM).emit('update_radio_ui', { 
        index: data.index 
    });
});
    // 3. NAVIGATION SYNC
// Inside your io.on('connection', ...) block in index.js

socket.on('mirror_nav', (data) => {
    const route = typeof data === 'string' ? data : data.route;
    // Se a rota for apenas '/', fechamos o overlay para todos
    if (route === '/' || route === '') {
        lobbyState.ajaxPath = null;
    } else {
        lobbyState.ajaxPath = route.split('?')[0];
    }
    socket.to(FIXED_ROOM).emit('mirror_ajax_nav', data);
});

socket.on('mirror_ajax_nav', (data) => {
    // 1. Extração segura do caminho (prioridade para .path que adicionamos no handleNav)
    const rawPath = data.path || data.route || data.mode || '';
    const cleanPath = rawPath.split('?')[0]; // Remove query strings para validação limpa

    // 2. Ação de Fecho Agressivo (Botão X ou fechar overlay)
    if (data.action === 'CLOSE') {
        lobbyState.videoId = null;
        lobbyState.ajaxPath = null;
        lobbyState.timestamp = 0;
        lobbyState.isPaused = true;
        console.log("[Sync] Overlay fechado. Estado limpo.");
    } 
    else {
        // 3. Atualização de Navegação
        lobbyState.ajaxPath = cleanPath;

        // REGRA CRÍTICA: Se não for uma rota de vídeo, o videoId TEM de ser null
        // Adicionamos 'youtube' e 'ytmusic' para cobrir todas as tuas possibilidades
        const isVideoRoute = cleanPath.includes('tvytube') || 
                             cleanPath.includes('player') || 
                             cleanPath.includes('youtube') ||
                             cleanPath.includes('ytmusic');

        if (!isVideoRoute) {
            if (lobbyState.videoId !== null) {
                console.log(`[Sync] Navegou para ${cleanPath}. Removendo vídeo: ${lobbyState.videoId}`);
                lobbyState.videoId = null;
                lobbyState.timestamp = 0;
                lobbyState.isPaused = true;
            }
        }
    }

    // 4. Replicar para os outros utilizadores
    socket.to(FIXED_ROOM).emit('mirror_ajax_nav', data);
});



    // 4. VIDEO CONTROLS & TIME TRACKING
// In your server-side socket logic
socket.on('report_current_time', (data) => {
    // 1. Se o videoId for explicitamente null ou vazio, limpamos o lobbyState
    if (!data.videoId) {
        lobbyState.videoId = null;
        lobbyState.timestamp = 0;
        lobbyState.isPaused = true;
        return; // Para a execução aqui
    }

    // 2. Caso contrário, atualiza a memória do servidor normalmente
    lobbyState.timestamp = data.time;
    lobbyState.isPaused = data.paused;
    lobbyState.videoId = data.videoId;
    lobbyState.lastUpdate = Date.now();
    
    // console.log(`[Sync] ${data.videoId} at ${Math.floor(data.time)}s`);
});

socket.on('toPlay', function(data) {
    // Standardize data as an object: { time: 120, videoId: 'H66Y...' }
    const time = typeof data === 'object' ? data.time : data;
    lobbyState.timestamp = time; 
    lobbyState.isPaused = false;
    if (data.videoId) lobbyState.videoId = data.videoId;

    io.to(FIXED_ROOM).emit('Play', time); 
});

    socket.on('toPause', function(time) {
        lobbyState.timestamp = time;
        lobbyState.isPaused = true;
        io.to(FIXED_ROOM).emit('Pause', time);
    });

    socket.on('toSeek', function(time) {
        lobbyState.timestamp = time;
        io.to(FIXED_ROOM).emit('Seek', time);
    });

    // 5. RADIO CONTROLS
    socket.on('toTuneRadio', (data) => {
        // data: { stream, name }
        lobbyState.radioData = data;
        lobbyState.url = '/radios/sl_radio_player'; 
        socket.to(FIXED_ROOM).emit('TuneRadio', data);
    });

    socket.on('stop_radio_global', () => {
        lobbyState.radioData = null;
        io.to(FIXED_ROOM).emit('force_stop_radio');
    });

    // 6. APPEARANCE (Backgrounds)
// Dentro de window.onload
socket.on('change_bg', function(data) {
    if (data.image || data.url) {
        lobbyState.currentBg = data.image || data.url; // ✅ guarda no estado
        socket.to(FIXED_ROOM).emit('change_bg', data);  // ✅ replica para os outros
    }
});
socket.on('change_bg_index', (index) => {
    // 1. Update Memory
    lobbyState.currentBg = index;

    // 2. SAVE TO DISK (HD)
    saveToDisk({ bgIndex: index });

    // 3. Tell everyone else to change their screen
    io.to(FIXED_ROOM).emit('update_bg_ui', index);
});
    // 7. UI & SLIDERS (For Main Page/Grid Sync)
    socket.on('control_event', function(data) {
        socket.to(FIXED_ROOM).emit('sync_ui', { action: data.action });
    });

    socket.on('slider_event', function(data) {
        socket.to(FIXED_ROOM).emit('sync_slider', data);
    });

    socket.on('state_sync', (data) => {
        // Broadcast scroll position or specific UI states
        socket.to(FIXED_ROOM).emit('state_sync', data);
    });

    // 8. NEW USER REQUESTING STATE FROM PEERS
    // (Used as a fallback if the server's lobbyState isn't enough)
    socket.on('request_current_state', () => {
        socket.to(FIXED_ROOM).emit('get_sync_state', { requesterId: socket.id });
    });

    socket.on('report_sync_state', (data) => {
        io.to(data.requesterId).emit('apply_sync_state', data);
    });

socket.on('disconnect', function() {
    const room = io.sockets.adapter.rooms.get(FIXED_ROOM);
    if (!room || room.size === 0) {
        console.log("Room empty. Resetting global state...");

    }
});


});


server.listen(PORT, () => console.log(`Listening on ${ PORT }`));