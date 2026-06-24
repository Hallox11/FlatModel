'use strict';

const MODES = {
    HOME:        'HOME',
    RADIO:       'RADIO',
    YOUTUBE:     'YOUTUBE',
    MUSIC:       'MUSIC',
    FLICKR:      'FLICKR',
    XXX:         'XXX',
    SETTINGS:    'SETTINGS',
    HELP:        'HELP',
    BROWSER:     'BROWSER',
    MOVIES:      'MOVIES',
    GAME_STREAM: 'GAME_STREAM',
    LIVE_TV:     'LIVE_TV',
    GAMES:       'GAMES',
    FREEBIES:    'FREEBIES',
    SECOND_LIFE: 'SECOND_LIFE'
};

const quizRooms = {};
const tomRooms  = {};
const waiRooms  = {};
const totRooms  = {};




async function fetchQuestions() {
    try {
        const axios = require('axios');
        const res = await axios.get('https://opentdb.com/api.php', {
            params: { amount: 3, type: 'multiple', encode: 'url3986' }
        });
        return res.data.results.map(q => {
            const answers = [...q.incorrect_answers, q.correct_answer]
                .map(a => decodeURIComponent(a))
                .sort(() => Math.random() - 0.5);
            const correctIndex = answers.indexOf(decodeURIComponent(q.correct_answer));
            return {
                question:      decodeURIComponent(q.question),
                answers,
                correctIndex,
                correctAnswer: decodeURIComponent(q.correct_answer)
            };
        });
    } catch (err) {
        console.error('[Quiz] Failed to fetch questions:', err.message);
        return [];
    }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─────────────────────────────────────────────────────────────
// TRUE OR MYTH data
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
const TOM_STATEMENTS = [
    { statement: "Humans only use 10% of their brain.",            correct: 'false', explanation: "We use virtually all parts of our brain." },
    { statement: "A day on Venus is longer than a year on Venus.", correct: 'true',  explanation: "Venus rotates so slowly its day (243 Earth days) exceeds its year (225 Earth days)." },
    { statement: "Goldfish have a 3-second memory.",               correct: 'false', explanation: "Goldfish can remember things for months." },
    { statement: "Hot water freezes faster than cold water.",      correct: 'true',  explanation: "This is known as the Mpemba effect." },
    { statement: "The Great Wall of China is visible from space.", correct: 'false', explanation: "It is too narrow to be seen from low Earth orbit." },
    { statement: "Bananas are technically berries.",               correct: 'true',  explanation: "Botanically, bananas qualify as berries." },
    { statement: "Lightning never strikes the same place twice.",  correct: 'false', explanation: "Lightning often strikes the same place repeatedly." },
    { statement: "Cleopatra lived closer in time to the Moon landing than to the pyramids.", correct: 'true', explanation: "The pyramids are ~2500 BCE, Cleopatra ~30 BCE, Moon landing 1969 CE." },
    { statement: "Diamonds are made of compressed coal.",          correct: 'false', explanation: "Diamonds form from carbon deep in the mantle." },
    { statement: "Honey never expires.",                           correct: 'true',  explanation: "3000-year-old honey found in Egyptian tombs was still edible." },
    { statement: "Humans share 50% of their DNA with bananas.",    correct: 'true',  explanation: "About 50-60% of human genes have a functional counterpart in bananas." },
    { statement: "Napoleon was unusually short for his time.",     correct: 'false', explanation: "Napoleon was ~5'7\", average for his era." },
    { statement: "Glass is a slow-moving liquid.",                 correct: 'false', explanation: "Glass is an amorphous solid." },
    { statement: "Octopuses have three hearts.",                   correct: 'true',  explanation: "Two pump blood to the gills, one to the rest of the body." },
    { statement: "Bulls are enraged by the colour red.",           correct: 'false', explanation: "Bulls are partially colour-blind — it's the motion of the cape." },

    { statement: "Sharks existed before trees.",                   correct: 'true',  explanation: "Sharks date back ~400 million years; the earliest trees appeared ~350 million years ago." },
    { statement: "A group of crows is called a 'murder'.",         correct: 'true',  explanation: "This is a real, traditional collective noun for crows." },
    { statement: "Mount Everest is the tallest mountain on Earth.", correct: 'false', explanation: "Mauna Kea is taller base-to-peak, though Everest has the highest sea-level elevation." },
    { statement: "Chameleons change colour mainly to camouflage themselves.", correct: 'false', explanation: "They mainly change colour to communicate mood and regulate temperature." },
    { statement: "The human body contains more bacterial cells than human cells.", correct: 'false', explanation: "Recent estimates show roughly a 1:1 ratio, not bacteria dominating." },
    { statement: "Vikings wore horned helmets in battle.",          correct: 'false', explanation: "No archaeological evidence supports horned battle helmets; it's a 19th-century invention." },
    { statement: "An ostrich can run faster than a horse.",         correct: 'true',  explanation: "Ostriches can reach about 70 km/h, faster than most horses." },
    { statement: "It takes seven years to digest swallowed gum.",   correct: 'false', explanation: "Gum passes through the digestive system in a few days, undigested." },
    { statement: "The Eiffel Tower can be taller in summer than in winter.", correct: 'true', explanation: "Thermal expansion of the iron can add several centimetres to its height in heat." },
    { statement: "All polar bears are left-handed.",                correct: 'false', explanation: "There's no scientific evidence for paw-handedness preference in polar bears; this is a myth." },
    { statement: "Sea otters hold hands while sleeping.",           correct: 'true',  explanation: "They do this to avoid drifting apart in the water." },
    { statement: "Albert Einstein failed math in school.",          correct: 'false', explanation: "He excelled at math from a young age; this is a popular myth." },
    { statement: "The shortest war in history lasted under an hour.", correct: 'true', explanation: "The Anglo-Zanzibar War of 1896 lasted around 38-45 minutes." },
    { statement: "Penguins propose to their mates with pebbles.",   correct: 'true',  explanation: "Some species, like Gentoo penguins, offer pebbles as part of courtship." },
    { statement: "Humans and dinosaurs coexisted.",                 correct: 'false', explanation: "Dinosaurs went extinct ~65 million years before humans appeared." },
    { statement: "A bolt of lightning is hotter than the surface of the Sun.", correct: 'true', explanation: "Lightning can reach ~30,000 K, far hotter than the Sun's surface (~5,500 K)." },
    { statement: "Coca-Cola was originally green.",                 correct: 'false', explanation: "Coca-Cola has always been brown due to caramel colouring." },
    { statement: "Oxford University is older than the Aztec Empire.", correct: 'true', explanation: "Oxford has taught since 1096; the Aztec Empire began around 1428." },
    { statement: "Touching a baby bird will make its mother abandon it.", correct: 'false', explanation: "Most birds don't abandon chicks due to human scent; this is a common myth." },
    { statement: "Wombat poop is cube-shaped.",                     correct: 'true',  explanation: "Wombats produce distinctly cube-shaped droppings due to their intestinal structure." },

    { statement: "Bats are blind.",                                 correct: 'false', explanation: "Most bats can see; many also use echolocation to navigate." },
    { statement: "The shortest commercial flight in the world lasts under two minutes.", correct: 'true', explanation: "A Scottish inter-island flight covers ~2.7km in under two minutes." },
    { statement: "Mount Fuji is in mainland Asia.",                 correct: 'false', explanation: "Mount Fuji is in Japan, an island nation, not mainland Asia." },
    { statement: "A 'jiffy' is an actual unit of time.",            correct: 'true',  explanation: "In physics, a jiffy can refer to 1/100th of a second or the time light takes to travel one centimetre." },
    { statement: "Peanuts are technically nuts.",                   correct: 'false', explanation: "Peanuts are legumes, growing underground in pods." },
    { statement: "The inventor of the Pringles can is buried in one.", correct: 'true', explanation: "Fredric Baur's ashes were partly placed in a Pringles can per his request." },
    { statement: "Sound travels faster in water than in air.",      correct: 'true',  explanation: "Sound moves about four times faster through water than through air." },
    { statement: "Cracking your knuckles causes arthritis.",        correct: 'false', explanation: "Studies have found no link between knuckle cracking and arthritis." },
    { statement: "The Sahara Desert was once a lush, green landscape.", correct: 'true', explanation: "Around 6,000-10,000 years ago, the Sahara had lakes, rivers, and vegetation." },
    { statement: "Most heat loss from the body occurs through the head.", correct: 'false', explanation: "Heat loss is roughly proportional to exposed skin area, not concentrated in the head." },
    { statement: "Saturn could float in water due to its low density.", correct: 'true', explanation: "Saturn's average density is less than water's, so it would theoretically float." },
    { statement: "The Statue of Liberty was originally a copper colour.", correct: 'true', explanation: "It was reddish-brown before oxidation turned it green over decades." },
    { statement: "Tomatoes were once believed to be poisonous in Europe.", correct: 'true', explanation: "Wealthy Europeans got lead poisoning from acidic tomatoes reacting with pewter plates, blaming the fruit." },
    { statement: "Antarctica is the world's largest desert.",       correct: 'true',  explanation: "By definition (low precipitation), Antarctica is the largest desert on Earth." },
    { statement: "Komodo dragons can reproduce without a mate.",    correct: 'true',  explanation: "Female Komodo dragons can reproduce via parthenogenesis without fertilization." },
];

const WAI_WORDS = [
    'Albert Einstein','Napoleon Bonaparte','Cleopatra','Sherlock Holmes','Batman',
    'Mickey Mouse','Elvis Presley','Marilyn Monroe','Steve Jobs','Elon Musk',
    'Harry Potter','Darth Vader','James Bond','Superman','Dracula',
    'Leonardo da Vinci','Shakespeare','Mozart','Marie Curie','Lionel Messi',
];

const TOT_QUESTIONS = [
    { question: "Which would you rather?", optionA: "Beach",    optionB: "Mountains", emojiA: "🏖️", emojiB: "🏔️" },
    { question: "Which would you rather?", optionA: "Pizza",    optionB: "Sushi",      emojiA: "🍕", emojiB: "🍣" },
    { question: "Which would you rather?", optionA: "Cats",     optionB: "Dogs",       emojiA: "🐱", emojiB: "🐶" },
    { question: "Which would you rather?", optionA: "Coffee",   optionB: "Tea",        emojiA: "☕", emojiB: "🍵" },
    { question: "Which would you rather?", optionA: "Summer",   optionB: "Winter",     emojiA: "☀️", emojiB: "❄️" },
    { question: "Which would you rather?", optionA: "Morning",  optionB: "Night",      emojiA: "🌅", emojiB: "🌙" },
    { question: "Which would you rather?", optionA: "Fly",      optionB: "Teleport",   emojiA: "✈️", emojiB: "⚡" },
    { question: "Which would you rather?", optionA: "Space",    optionB: "Deep Ocean", emojiA: "🚀", emojiB: "🌊" },
    { question: "Which would you rather?", optionA: "Past",     optionB: "Future",     emojiA: "⏪", emojiB: "⏩" },
    { question: "Which would you rather?", optionA: "City Life",optionB: "Countryside",emojiA: "🏙️", emojiB: "🌾" },
    { question: "Which would you rather?", optionA: "Sweet",    optionB: "Savory",     emojiA: "🍩", emojiB: "🥨" },
    { question: "Which would you rather?", optionA: "Books",    optionB: "Movies",     emojiA: "📚", emojiB: "🎬" },
    { question: "Which would you rather?", optionA: "Texting",  optionB: "Calling",    emojiA: "💬", emojiB: "📞" },
    { question: "Which would you rather?", optionA: "Rain",     optionB: "Sunshine",   emojiA: "🌧️", emojiB: "🌤️" },
    { question: "Which would you rather?", optionA: "Adventure",optionB: "Relaxation", emojiA: "🧗", emojiB: "🛋️" },
    { question: "Which would you rather?", optionA: "Burgers",  optionB: "Tacos",      emojiA: "🍔", emojiB: "🌮" },
    { question: "Which would you rather?", optionA: "Cars",     optionB: "Motorcycles",emojiA: "🚗", emojiB: "🏍️" },
    { question: "Which would you rather?", optionA: "Movies at Home", optionB: "Movies at the Cinema", emojiA: "🏠", emojiB: "🎟️" },
    { question: "Which would you rather?", optionA: "Karaoke",  optionB: "Dancing",    emojiA: "🎤", emojiB: "💃" },
    { question: "Which would you rather?", optionA: "Camping",  optionB: "Hotel",      emojiA: "⛺", emojiB: "🏨" },
    { question: "Which would you rather?", optionA: "Superpower: Invisibility", optionB: "Superpower: Flight", emojiA: "🫥", emojiB: "🦸" },
    { question: "Which would you rather?", optionA: "Early Bird", optionB: "Night Owl", emojiA: "🐦", emojiB: "🦉" },
    { question: "Which would you rather?", optionA: "Gaming",   optionB: "Sports",     emojiA: "🎮", emojiB: "⚽" },
    { question: "Which would you rather?", optionA: "Cooking",  optionB: "Eating Out", emojiA: "👨‍🍳", emojiB: "🍽️" },
    { question: "Which would you rather?", optionA: "Cash",     optionB: "Credit Card",emojiA: "💵", emojiB: "💳" },
    { question: "Which would you rather?", optionA: "Spicy Food", optionB: "Mild Food",emojiA: "🌶️", emojiB: "🥛" },
    { question: "Which would you rather?", optionA: "Road Trip", optionB: "Flight",    emojiA: "🚙", emojiB: "✈️" },
    { question: "Which would you rather?", optionA: "Big Party", optionB: "Small Gathering", emojiA: "🎉", emojiB: "🤝" },
    { question: "Which would you rather?", optionA: "Photos",   optionB: "Videos",     emojiA: "📸", emojiB: "🎥" },
    { question: "Which would you rather?", optionA: "Streaming Music", optionB: "Vinyl Records", emojiA: "🎧", emojiB: "💿" },
];

function getTomRoom(roomId) {
    if (!tomRooms[roomId]) tomRooms[roomId] = { players: {}, active: false, current: -1, votes: {} };
    return tomRooms[roomId];
}
function getWaiRoom(roomId) {
    if (!waiRooms[roomId]) waiRooms[roomId] = { players: {}, active: false, guesserIndex: 0, currentWord: null, currentQ: null, questionsLeft: 20, lives: 3 };
    return waiRooms[roomId];
}
function getTotRoom(roomId) {
    if (!totRooms[roomId]) totRooms[roomId] = { players: {}, active: false, current: -1, votes: {} };
    return totRooms[roomId];
}
function startWaiRound(room, wr) {
    const ids = Object.keys(wr.players);
    if (!ids.length) return;
    wr.guesserIndex = (wr.guesserIndex + 1) % ids.length;
    const guesserId = ids[wr.guesserIndex];
    if (!wr.players[guesserId]) return;
    wr.currentWord   = WAI_WORDS[Math.floor(Math.random() * WAI_WORDS.length)];
    wr.questionsLeft = 20;
    wr.lives         = 3;
    wr.currentQ      = null;
    io.to(room).emit('wai_round_start', {
        guesserId, guesserName: wr.players[guesserId].name,
        word: wr.currentWord, questionsLeft: wr.questionsLeft, lives: wr.lives
    });
}

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────
const axios = require('axios');
let io;
let clickerSessionMap;
let tvRegistry;

// ── GAME STREAM STATE ─────────────────────────────────────────
const gsRooms = {};
function getGsRoom(roomId) {
    if (!gsRooms[roomId]) gsRooms[roomId] = { streamer: null, viewers: [] };
    return gsRooms[roomId];
}
function gsCleanup(roomId) {
    const gs = gsRooms[roomId];
    if (gs && !gs.streamer && gs.viewers.length === 0) delete gsRooms[roomId];
}

module.exports = function initSocketIO(_io, getRoomState, FIXED_ROOM, _clickerSessionMap, _tvRegistry) {
    io                = _io;
    clickerSessionMap = _clickerSessionMap;
    tvRegistry        = _tvRegistry;

    io.on('connection', function(socket) {

        // ── DETERMINE ROOM ────────────────────────────────────
        const clientRoom = socket.handshake.query.room || FIXED_ROOM;
        const state      = getRoomState(clientRoom);

        socket.join(clientRoom);
        console.log(`[Join] ${socket.id} → room: ${clientRoom} | mode: ${state.currentMode}`);

        // ── GAME STREAM ───────────────────────────────────────

        // Streamer chose role → ask TV to llLoadURL the clicker's browser
        socket.on('gs_request_open_url', (data) => {
            const { clicker, room, url } = data;
            if (!clicker || !url) {
                socket.emit('gs_open_url_error', { reason: 'missing_params' });
                return;
            }

            const session = [...clickerSessionMap.entries()]
                .find(([name]) => name === clicker);

            if (!session) {
                console.warn(`[GS] No TV session for clicker: ${clicker}`);
                socket.emit('gs_open_url_error', { reason: 'no_tv_session' });
                return;
            }

            const { object_id } = session[1];
            const tv = tvRegistry[object_id];

            if (!tv || !tv.url) {
                console.warn(`[GS] TV offline for: ${object_id}`);
                socket.emit('gs_open_url_error', { reason: 'tv_offline' });
                return;
            }

            axios.post(tv.url, `open_url|${url}`, {
                headers: { 'Content-Type': 'text/plain' },
                timeout: 5000
            })
            .then(() => {
                console.log(`[GS] open_url sent to TV ${object_id} for ${clicker}`);
                socket.emit('gs_open_url_sent');
            })
            .catch(err => {
                console.error(`[GS] Failed to reach TV ${object_id}:`, err.message);
                socket.emit('gs_open_url_error', { reason: 'tv_unreachable' });
            });
        });
        socket.on('gs_join', (data) => {
            const { room, role, peerId } = data;
            socket.join(room);
            socket.gsRoom   = room;
            socket.gsRole   = role;
            socket.gsPeerId = peerId;

            const gs = getGsRoom(room);

            if (role === 'streamer') {
                gs.streamer = { socketId: socket.id, peerId };
                if (gs.viewers.length > 0) {
                    const peerIds = gs.viewers.map(v => v.peerId);
                    socket.emit('gs_pending_viewers', { peerIds });
                    console.log(`[GS] ${peerIds.length} pending viewer(s) sent to streamer in "${room}"`);
                }
            }

            if (role === 'viewer') {
                gs.viewers.push({ socketId: socket.id, peerId });
                if (gs.streamer) {
                    io.to(gs.streamer.socketId).emit('gs_viewer_joined', { peerId });
                    socket.emit('gs_streamer_present', { peerId: gs.streamer.peerId });
                }
            }
        });

        socket.on('gs_stream_started', (data) => { socket.to(data.room).emit('gs_stream_started'); });
        socket.on('gs_stream_stopped', (data) => { socket.to(data.room).emit('gs_stream_stopped'); });
        socket.on('gs_leave', (data) => {
            const room = data.room || socket.gsRoom;
            if (room) _gsLeave(socket, room);
        });

        // ── INITIAL SYNC ──────────────────────────────────────
        socket.emit('force_sync_arrival', {
            ...state,
            timestamp: state.videoPaused
                ? state.videoTimestamp
                : state.videoTimestamp + (Date.now() - (state.lastUpdate || Date.now())) / 1000
        });

        // ── NAVIGATION ────────────────────────────────────────
        socket.on('mirror_nav', (data) => {
            const route = typeof data === 'string' ? data : data.route;
            if (route === '/' || route === '') {
                state.ajaxPath    = null;
                state.currentMode = MODES.HOME;
            } else {
                state.ajaxPath = route.split('?')[0];
            }
            socket.to(clientRoom).emit('mirror_ajax_nav', data);
        });

        socket.on('mirror_ajax_nav', (data) => {
            const rawPath = data.path || data.route || data.mode || '';

            if (data.action === 'CLOSE') {
                state.currentMode = MODES.HOME;
                state.ajaxPath    = null;
                state.videoId     = null;
                state.radioStream = null;
                state.radioName   = null;
            } else {
                state.ajaxPath = rawPath;

                if      (rawPath.includes('youtube'))         state.currentMode = MODES.YOUTUBE;
                else if (rawPath.includes('music'))           state.currentMode = MODES.MUSIC;
                else if (rawPath.includes('radio'))           state.currentMode = MODES.RADIO;
                else if (rawPath.includes('flickr'))          state.currentMode = MODES.FLICKR;
                else if (rawPath.includes('xxx'))             state.currentMode = MODES.XXX;
                else if (rawPath.includes('settings'))        state.currentMode = MODES.SETTINGS;
                else if (rawPath.includes('help'))            state.currentMode = MODES.HELP;
                else if (rawPath.includes('movies'))          state.currentMode = MODES.MOVIES;
                else if (rawPath.includes('game-stream'))     state.currentMode = MODES.GAME_STREAM;
                else if (rawPath.includes('live-tv'))         state.currentMode = MODES.LIVE_TV;
                else if (rawPath.includes('games'))           state.currentMode = MODES.GAMES;
                else if (rawPath.includes('freebies'))        state.currentMode = MODES.FREEBIES;
                else if (rawPath.includes('sl-destinations')) state.currentMode = MODES.SECOND_LIFE;
                else                                          state.currentMode = MODES.HOME;
            }

            console.log(`[Nav] Room: ${clientRoom} | Mode: ${state.currentMode}`);
            socket.to(clientRoom).emit('mirror_ajax_nav', data);
        });

        // ── VIDEO ─────────────────────────────────────────────
        socket.on('report_current_time', (data) => {
            if (!data.videoId) {
                state.videoId = null; state.videoTimestamp = 0; state.videoPaused = true;
                return;
            }
            state.videoTimestamp = data.time;
            state.videoPaused    = data.paused;
            state.videoId        = data.videoId;
            state.lastUpdate     = Date.now();
        });

        // Locate this in your provided file:
        socket.on('toPlay', (data) => {
            const time = typeof data === 'object' ? data.time : data;
            const vId = typeof data === 'object' ? data.videoId : state.videoId;

            state.videoTimestamp = time;
            state.videoPaused    = false;
            state.lastUpdate     = Date.now(); // <--- CRITICAL: Store the sync time
            if (vId) state.videoId = vId;

            // Send an OBJECT instead of just a number
            io.to(clientRoom).emit('Play', {
                timestamp: time,
                lastUpdate: state.lastUpdate,
                videoId: state.videoId
            });
        });

        socket.on('toPause', (time) => {
            state.videoTimestamp = time;
            state.videoPaused    = true;
            io.to(clientRoom).emit('Pause', time);
        });

        socket.on('toSeek', (time) => {
            state.videoTimestamp = time;
            io.to(clientRoom).emit('Seek', time);
        });

        // ── RADIO ─────────────────────────────────────────────
        socket.on('sync_radio_dial', (data) => {
            state.radioDialIndex = data.index;
            state.currentMode    = MODES.RADIO;
            socket.to(clientRoom).emit('update_radio_ui', { index: data.index });
        });

        // FIXED: Now clears the dial index memory too!
        socket.on('stop_radio_global', () => {
            state.radioStream = null;
            state.radioName   = null;
            state.radioDialIndex = null; // Clear the tuning memory completely
            io.to(clientRoom).emit('force_stop_radio');
        });
    // Add this to your socket server handling logic
    socket.on('RequestRadioGrid', (data) => {
        // Send to everyone in the room, INCLUDING the sender
        io.to(data.room).emit('UpdateRadioGrid', data);
    });
    // Add this to your server-side socket logic
    socket.on('RequestRadioBack', (data) => {
        // Tell all clients in the room to go back and kill their players
        io.to(data.room).emit('UpdateRadioBack');
    });
        // ── BACKGROUNDS ───────────────────────────────────────
        socket.on('change_bg', (data) => {
            const url = data.image || data.url;
            if (url) {
                state.currentBg = url;
                socket.to(clientRoom).emit('background', { url });
            }
        });

        socket.on('change_bg_index', (index) => {
            state.currentBg = index;
            io.to(clientRoom).emit('update_bg_ui', index);
        });

        // ── WATCH TOGETHER SYNC ──
socket.on('wt_sync', (data) => {
    const room = data.room || clientRoom;
    socket.to(room).emit('wt_sync', data);
});

        // ── UI SYNC ───────────────────────────────────────────
        socket.on('control_event', (data) => {
            socket.to(clientRoom).emit('sync_ui', { action: data.action });
        });

        socket.on('slider_event', (data) => {
            socket.to(clientRoom).emit('sync_slider', data);
        });

        socket.on('state_sync', (data) => {
            if (data.type === 'background') state.currentBg = data.url || data.value;
            socket.to(clientRoom).emit('state_sync', data);
        });

        // ── STATE REQUEST ─────────────────────────────────────
        socket.on('request_current_state', () => {
            socket.emit('force_sync_arrival', state);
            socket.to(clientRoom).emit('get_sync_state', { requesterId: socket.id });
        });

        socket.on('report_sync_state', (data) => {
            if (data.requesterId) io.to(data.requesterId).emit('apply_sync_state', data);
        });

        // ── ROOM SWITCH (viewer joins another TV's room) ──────
        socket.on('switch_room', (data) => {
            const newRoom = data.room;
            if (!newRoom) return;

            // Leave current room
            socket.leave(clientRoom);

            // Join new room and sync state
            socket.join(newRoom);
            const newState = getRoomState(newRoom);
            socket.emit('force_sync_arrival', {
                ...newState,
                timestamp: newState.videoPaused
                    ? newState.videoTimestamp
                    : newState.videoTimestamp + (Date.now() - (newState.lastUpdate || Date.now())) / 1000
            });

            console.log(`[Room Switch] ${socket.id} → ${newRoom}`);
        });
/////////////////////////////////////////////////////////
// ── QUIZ ──────────────────────────────────────────────
// Global memory storage for the quiz rooms

function getQuizRoom(roomName) {
    if (!quizRooms[roomName]) {
        console.log('[getQuizRoom] Creating NEW room:', roomName, new Error().stack);
        quizRooms[roomName] = {
            players: {},
            questions: [],
            answers: {},
            active: false,
            current: -1,
            hostId: null,
            nextStepPromise: null
        };
    }
    return quizRooms[roomName];
}

// Inside your main io.on('connection', (socket) => { ... }) scope:

    // ── JOIN ROOM ──
socket.on('quiz_join', (data) => {
    const room = data.room || clientRoom;
    const qr = getQuizRoom(room);

    console.log('[quiz_join] socket.id:', socket.id, '| name:', data.name);
    console.log('[quiz_join] players BEFORE:', JSON.stringify(qr.players));

    if (!qr.hostId || Object.keys(qr.players).length === 0) {
        qr.hostId = socket.id;
        socket.emit('quiz_host_assigned');
    }

    const existing = Object.values(qr.players).find(p => p.name === data.name);
    if (existing) {
        delete qr.players[existing.id];
        existing.id = socket.id;
        qr.players[socket.id] = existing;
    } else {
        qr.players[socket.id] = { id: socket.id, name: data.name, score: 0 };
    }

    console.log('[quiz_join] players AFTER:', JSON.stringify(qr.players));

    io.to(room).emit('quiz_players_update', { players: qr.players });
});

    // ── MANUAL CONTROL TRANSITION STEP ──
    socket.on('quiz_next', (data) => {
        const room = data.room || clientRoom;
        const qr = getQuizRoom(room);

        // Security check: Only allow room steps forward if triggered by the active Host
        if (socket.id !== qr.hostId) return; 

        if (qr.nextStepPromise) {
            qr.nextStepPromise();
            qr.nextStepPromise = null; // Flush clean after completing step resolving action
        }
    });

    // ── RUN GAME LOOP SEQUENCE ──
    socket.on('quiz_start', async (data) => {
        const LOBBY_COUNTDOWN = 3;
        const NUMBER_OF_QUESTIONS = 3;
        const QUESTION_TIME = 5000;
        const room = data.room || clientRoom;
        const qr = getQuizRoom(room);
        
        // Security check: Ensure only host can initiate start, and prevent double triggers
        if (socket.id !== qr.hostId || qr.active) return;
        
        qr.active = true; 
        qr.current = -1;
        qr.questions = await fetchQuestions(); // Pull game array data structures

        // 1. Uniform Start Countdowns (FIXED: Now uses LOBBY_COUNTDOWN instead of NUMBER_OF_QUESTIONS)
        for (let i = LOBBY_COUNTDOWN; i >= 1; i--) { 
            if (!qr.active) return; // Clean exit catch point if closed unexpectedly
            io.to(room).emit('quiz_countdown', { count: i }); 
            await new Promise(resolve => setTimeout(resolve, 1000)); 
        }

        // 2. Continuous Match Progression Processing Loops
        for (let i = 0; i < qr.questions.length; i++) {
            if (!qr.active) return;
            qr.current = i; 
            qr.answers = {}; // Wipe submissions clear to start clean interval phase
            const q = qr.questions[i];

            // PHASE 1: Active Question Transmissions (Fully Automatic Windows)
            io.to(room).emit('quiz_question', { question: q, index: i, questions: qr.questions });
            await new Promise(resolve => setTimeout(resolve, QUESTION_TIME)); 

            // Live evaluation math tracking operations
            const scores = {};
            Object.values(qr.players).forEach(p => { scores[p.id] = p.score; });
            
            Object.entries(qr.answers).forEach(([sid, ans]) => {
                if (ans.answerIndex === q.correctIndex) {
                    // Score formulation model scale (Matches up to client parameters)
                    const pts = Math.round(500 + (ans.timeLeft / 5) * 500); 
                    if (qr.players[sid]) { 
                        qr.players[sid].score += pts; 
                        scores[sid] = qr.players[sid].score; 
                    }
                }
            });

            // PHASE 2: Standby Result Assessment Screens (Fully Manual Halts)
            io.to(room).emit('quiz_result', { correctAnswer: q.correctAnswer, scores });
            
            // Pauses processing workflow context lines until Host fires 'quiz_next' event loop skips
            await new Promise(resolve => {
                qr.nextStepPromise = resolve;
            }); 
        }

        // 3. Final Screens Deliveries 
        if (!qr.active) return;
        const finalScores = {};
        Object.values(qr.players).forEach(p => { finalScores[p.id] = p.score; });
        io.to(room).emit('quiz_final', { scores: finalScores });
        qr.active = false;
    });

    // ── LOG INCOMING USER RESPONSES ──
    socket.on('quiz_answer', (data) => {
        // FIXED: Standardized scope declaration variables
        const room = data.room || clientRoom;
        const qr = getQuizRoom(room);
        if (!qr.active || qr.current !== data.questionIndex) return; // Drop outdated entries
        
        if (!qr.answers[socket.id]) {
            qr.answers[socket.id] = { 
                answerIndex: data.answerIndex, 
                timeLeft: data.timeLeft 
            };
        }
    });

    // ── MATCH SYSTEM CLEAN RESETS ──
socket.on('quiz_reset', (data) => {
    const room = data.room || clientRoom;
    const qr = getQuizRoom(room);
    if (socket.id !== qr.hostId) return;

    Object.keys(qr.players).forEach(id => { qr.players[id].score = 0; });
    qr.active = false;
    qr.current = -1;
    qr.questions = [];
    qr.answers = {};
    if (qr.nextStepPromise) { qr.nextStepPromise(); qr.nextStepPromise = null; }

    io.to(room).emit('quiz_reset');
    io.to(room).emit('quiz_players_update', { players: qr.players });
    io.to(qr.hostId).emit('quiz_host_assigned'); // ← re-assign host after reset
});

    // ── SYSTEM REBOOT HARD RESET CORES ──
    socket.on('quiz_force_reboot', (data) => {
        const room = data.room || clientRoom;
        const qr = getQuizRoom(room);
        if (socket.id !== qr.hostId) return; // Host security gate check
        
        if (qr && qr.nextStepPromise) qr.nextStepPromise(); // Kill running processes

        delete quizRooms[room]; // Full wipe out target from dictionary index mapping
        io.to(room).emit('force_navigate', { target: 'games-menu' });
    });


/////////////////////////////////////////////////////////
// ── TRUE OR MYTH ──────────────────────────────────────
function getTomRoom(roomName) {
    if (!tomRooms[roomName]) {
        tomRooms[roomName] = {
            players: {},
            votes: {},
            active: false,
            current: -1,
            hostId: null,
            nextStepPromise: null
        };
    }
    return tomRooms[roomName];
}

// ── Inside your io.on('connection', (socket) => { }) scope: ──────────────────

    // ── JOIN ──
    socket.on('tom_join', (data) => {
        const room = data.room || clientRoom;
        const tr = getTomRoom(room);

        // First player becomes host
        if (!tr.hostId || Object.keys(tr.players).length === 0) {
            tr.hostId = socket.id;
            socket.emit('tom_host_assigned');
        }

        // Re-join by name (DOM reload resilience — same as quiz)
        const existing = Object.values(tr.players).find(p => p.name === data.name);
        if (existing) {
            delete tr.players[existing.id];
            existing.id = socket.id;
            tr.players[socket.id] = existing;
        } else {
            tr.players[socket.id] = { id: socket.id, name: data.name, score: 0 };
        }

        io.to(room).emit('tom_players_update', { players: tr.players });
    });

    // ── HOST ADVANCES TO NEXT STATEMENT ──
    socket.on('tom_next', (data) => {
        const room = data.room || clientRoom;
        const tr = getTomRoom(room);

        // Security: only host can advance
        if (socket.id !== tr.hostId) return;

        if (tr.nextStepPromise) {
            tr.nextStepPromise();
            tr.nextStepPromise = null;
        }
    });

    // ── GAME LOOP ──
    socket.on('tom_start', async (data) => {
        const LOBBY_COUNTDOWN  = 3;
        const TOTAL_STATEMENTS = 10;
        const VOTE_TIME        = 15000; // ms — matches frontend TIME = 15

        const room = data.room || clientRoom;
        const tr = getTomRoom(room);

        // Host-only + prevent double start
        if (socket.id !== tr.hostId || tr.active) return;

        tr.active  = true;
        tr.current = -1;

        // Shuffle and slice statements
        const stmts = [...TOM_STATEMENTS]
            .sort(() => Math.random() - 0.5)
            .slice(0, TOTAL_STATEMENTS);

        // 1. Countdown
        for (let i = LOBBY_COUNTDOWN; i >= 1; i--) {
            if (!tr.active) return;
            io.to(room).emit('tom_countdown', { count: i });
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // 2. Statement loop
        for (let i = 0; i < stmts.length; i++) {
            if (!tr.active) return;

            tr.current = i;
            tr.votes   = {};
            const s    = stmts[i];

            // PHASE 1: Voting window (automatic, timed)
            io.to(room).emit('tom_statement', { statement: s.statement, index: i });

            // Wait for full vote window OR all players voted — whichever comes first
            const totalPlayers = Object.keys(tr.players).length;
            await new Promise(resolve => {
                const deadline = Date.now() + VOTE_TIME;
                const check = setInterval(() => {
                    const votedCount = Object.values(tr.votes)
                        .filter(v => v !== undefined).length;
                    if (votedCount >= totalPlayers || Date.now() >= deadline) {
                        clearInterval(check);
                        resolve();
                    }
                }, 200);
            });

            // Score calculation — same formula as quiz (speed bonus)
            const scores    = {};
            const votesCopy = { ...tr.votes };

            // Pre-fill current scores before delta
            Object.values(tr.players).forEach(p => { scores[p.id] = p.score; });

            Object.entries(votesCopy).forEach(([sid, vote]) => {
                if (vote === s.correct && tr.players[sid]) {
                    // Base 500 pts — no speed bonus for binary choice
                    tr.players[sid].score += 500;
                    scores[sid] = tr.players[sid].score;
                }
            });

            // PHASE 2: Reveal (manual — host must press Next)
            io.to(room).emit('tom_reveal', {
                correct:     s.correct,
                explanation: s.explanation,
                votes:       votesCopy,
                scores
            });

            // Pause until host fires tom_next
            await new Promise(resolve => {
                tr.nextStepPromise = resolve;
            });
        }

        // 3. Final
        if (!tr.active) return;
        const finalScores = {};
        Object.values(tr.players).forEach(p => { finalScores[p.id] = p.score; });
        io.to(room).emit('tom_final', { scores: finalScores });
        tr.active = false;
    });

    // ── VOTE ──
    socket.on('tom_vote', (data) => {
        const room = data.room || clientRoom;
        const tr   = getTomRoom(room);
        if (!tr.active) return;
        // undefined check so null (timeout) votes register correctly
        if (tr.votes[socket.id] === undefined) {
            tr.votes[socket.id] = data.vote;
        }
    });

    // ── RESET (host only) ──
    socket.on('tom_reset', (data) => {
        const room = data.room || clientRoom;
        const tr   = getTomRoom(room);
        if (socket.id !== tr.hostId) return;

        Object.keys(tr.players).forEach(id => { tr.players[id].score = 0; });
        tr.active  = false;
        tr.current = -1;
        tr.votes   = {};
        if (tr.nextStepPromise) { tr.nextStepPromise(); tr.nextStepPromise = null; }

        io.to(room).emit('tom_reset');
        io.to(room).emit('tom_players_update', { players: tr.players });
        io.to(tr.hostId).emit('tom_host_assigned'); // Re-confirm host after reset
    });

    // ── LEAVE ──
// ── LEAVE ──
    socket.on('tom_leave', (data) => {
        const room = data.room || clientRoom;
        const tr   = getTomRoom(room);
        if (!tr) return;

        if (tr.nextStepPromise) { tr.nextStepPromise(); tr.nextStepPromise = null; }
        tr.active  = false;
        tr.current = -1;
        tr.votes   = {};

        delete tomRooms[room];

        // Notify everyone else in the room — but not the one who left
        socket.to(room).emit('tom_kicked');
    });
/////////////////////////////////////////////////////////
// ── WHO AM I ──────────────────────────────────────────
        socket.on('wai_join',  (data) => { const room = data.room || clientRoom; const wr = getWaiRoom(room); wr.players[socket.id] = { id: socket.id, name: data.name }; io.to(room).emit('wai_players_update', { players: wr.players }); });
        socket.on('wai_start', (data) => { const room = data.room || clientRoom; const wr = getWaiRoom(room); if (wr.active) return; wr.active = true; startWaiRound(room, wr); });
        socket.on('wai_ask',   (data) => { const room = data.room || clientRoom; const wr = getWaiRoom(room); wr.currentQ = data.question; io.to(room).emit('wai_question', { question: data.question }); });
        socket.on('wai_answer',(data) => {
            const room = data.room || clientRoom; const wr = getWaiRoom(room);
            wr.questionsLeft = Math.max(0, wr.questionsLeft - 1);
            io.to(room).emit('wai_answered', { question: wr.currentQ, answer: data.answer, questionsLeft: wr.questionsLeft });
            wr.currentQ = null;
            if (wr.questionsLeft <= 0) io.to(room).emit('wai_round_end', { word: wr.currentWord, won: false, guesserName: '' });
        });
        socket.on('wai_guess', (data) => {
            const room = data.room || clientRoom; const wr = getWaiRoom(room);
            const guesserName = wr.players[socket.id]?.name || '';
            const correct = data.guess.trim().toLowerCase() === wr.currentWord.toLowerCase();
            if (correct) {
                io.to(room).emit('wai_round_end', { word: wr.currentWord, won: true, guesserName });
            } else {
                wr.lives = Math.max(0, wr.lives - 1);
                if (wr.lives <= 0) io.to(room).emit('wai_round_end', { word: wr.currentWord, won: false, guesserName });
                else io.to(room).emit('wai_wrong_guess', { lives: wr.lives });
            }
        });
        socket.on('wai_next_round', (data) => { startWaiRound(data.room || clientRoom, getWaiRoom(data.room || clientRoom)); });
        socket.on('wai_leave',      (data) => { const wr = getWaiRoom(data.room || clientRoom); delete wr.players[socket.id]; io.to(data.room || clientRoom).emit('wai_players_update', { players: wr.players }); });

/////////////////////////////////////////////////////////
// ── THIS OR THAT ──────────────────────────────────────
function getTotRoom(roomName) {
    if (!totRooms[roomName]) {
        totRooms[roomName] = {
            players: {},
            votes: {},
            active: false,
            current: -1,
            hostId: null,
            nextStepPromise: null
        };
    }
    return totRooms[roomName];
}

// ── Inside your io.on('connection', (socket) => { }) scope: ──────────────────

    // ── JOIN ──
    socket.on('tot_join', (data) => {
        const room = data.room || clientRoom;
        const tr = getTotRoom(room);

        // First player becomes host
        if (!tr.hostId || Object.keys(tr.players).length === 0) {
            tr.hostId = socket.id;
            socket.emit('tot_host_assigned');
        }

        // Re-join by name (DOM reload resilience — same as TOM/quiz)
        const existing = Object.values(tr.players).find(p => p.name === data.name);
        if (existing) {
            delete tr.players[existing.id];
            existing.id = socket.id;
            tr.players[socket.id] = existing;
        } else {
            tr.players[socket.id] = { id: socket.id, name: data.name, score: 0 };
        }

        io.to(room).emit('tot_players_update', { players: tr.players });
    });

    // ── HOST ADVANCES TO NEXT ROUND ──
    socket.on('tot_next', (data) => {
        const room = data.room || clientRoom;
        const tr = getTotRoom(room);

        // Security: only host can advance
        if (socket.id !== tr.hostId) return;

        if (tr.nextStepPromise) {
            tr.nextStepPromise();
            tr.nextStepPromise = null;
        }
    });

    // ── GAME LOOP ──
    socket.on('tot_start', async (data) => {
        const LOBBY_COUNTDOWN = 3;
        const TOTAL_ROUNDS    = 10;
        const VOTE_TIME       = 12000; // ms — matches frontend TIME = 12

        const room = data.room || clientRoom;
        const tr = getTotRoom(room);

        // Host-only + prevent double start
        if (socket.id !== tr.hostId || tr.active) return;

        tr.active  = true;
        tr.current = -1;

        // Reset scores
        Object.values(tr.players).forEach(p => { p.score = 0; });

        // Shuffle and slice questions
        const rounds = [...TOT_QUESTIONS]
            .sort(() => Math.random() - 0.5)
            .slice(0, TOTAL_ROUNDS);

        // 1. Countdown
        for (let i = LOBBY_COUNTDOWN; i >= 1; i--) {
            if (!tr.active) return;
            io.to(room).emit('tot_countdown', { count: i });
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // 2. Round loop
        for (let i = 0; i < rounds.length; i++) {
            if (!tr.active) return;

            tr.current = i;
            tr.votes   = {};
            const q    = rounds[i];

            // PHASE 1: Voting window (automatic, timed)
            io.to(room).emit('tot_round', { ...q, index: i, total: rounds.length });

            // Wait for full vote window OR all players voted — whichever comes first
            const totalPlayers = Object.keys(tr.players).length;
            await new Promise(resolve => {
                const deadline = Date.now() + VOTE_TIME;
                const check = setInterval(() => {
                    const votedCount = Object.values(tr.votes)
                        .filter(v => v !== undefined).length;
                    if (votedCount >= totalPlayers || Date.now() >= deadline) {
                        clearInterval(check);
                        resolve();
                    }
                }, 200);
            });

            // Tally votes
            let votesA = 0, votesB = 0;
            Object.values(tr.votes).forEach(choice => {
                if (choice === 'A') votesA++;
                if (choice === 'B') votesB++;
            });

            const total = votesA + votesB;
            const majority = votesA > votesB ? 'A' : votesB > votesA ? 'B' : null;
            const majorityPct = total ? Math.round((Math.max(votesA, votesB) / total) * 100) : 0;

            // Pick a discussion tip based on the vote split
            const tip = getTotTip(majorityPct, majority, total);

            // PHASE 2: Reveal (manual — host must press Next)
            io.to(room).emit('tot_reveal', {
                optionA: q.optionA,
                optionB: q.optionB,
                votesA,
                votesB,
                majority,
                tip
            });

            // Pause until host fires tot_next
            await new Promise(resolve => {
                tr.nextStepPromise = resolve;
            });
        }

        // 3. End — no scores, just close the game
        if (!tr.active) return;
        io.to(room).emit('tot_game_end');
        tr.active = false;
    });

    // ── VOTE ──
    socket.on('tot_vote', (data) => {
        const room = data.room || clientRoom;
        const tr   = getTotRoom(room);
        if (!tr.active) return;
        // undefined check so null (timeout) votes register correctly
        if (tr.votes[socket.id] === undefined) {
            tr.votes[socket.id] = data.choice;
        }
    });

    // ── RESET (host only) ──
    socket.on('tot_reset', (data) => {
        const room = data.room || clientRoom;
        const tr   = getTotRoom(room);
        if (socket.id !== tr.hostId) return;

        tr.active  = false;
        tr.current = -1;
        tr.votes   = {};
        if (tr.nextStepPromise) { tr.nextStepPromise(); tr.nextStepPromise = null; }

        io.to(room).emit('tot_reset');
        io.to(room).emit('tot_players_update', { players: tr.players });
        io.to(tr.hostId).emit('tot_host_assigned');
    });

    // ── LEAVE ──
    socket.on('tot_leave', (data) => {
        const room = data.room || clientRoom;
        const tr   = getTotRoom(room);
        if (!tr) return;

        if (tr.nextStepPromise) { tr.nextStepPromise(); tr.nextStepPromise = null; }
        tr.active  = false;
        tr.current = -1;
        tr.votes   = {};

        delete totRooms[room];

        // Notify everyone else in the room — same as TOM
        socket.to(room).emit('tot_kicked');
    });
// ── DISCUSSION TIP HELPER ──────────────────────────────
function getTotTip(majorityPct, majority, total) {
    if (total === 0) return "No votes this round — speak up next time!";

    const pick = r => r[Math.floor(Math.random() * r.length)];

    // Exact tie
    if (majority === null) return pick([
        "Perfect split. The only way to settle this is to talk it out.",
        "Dead even — you literally cannot agree on this one.",
        "50/50. The most honest result possible. Pick a side and defend it.",
        "The room is divided. Someone convince the other half they're wrong.",
    ]);

    // Unanimous (100%)
    if (majorityPct === 100) return pick([
        "Everyone agrees — but why? Is this actually obvious, or just groupthink?",
        "Unanimous! Does anyone secretly disagree but didn't dare say so?",
        "Full consensus. Make the case for the other side — someone has to.",
        "No rebels this round. Is this genuinely clear-cut, or did everyone just follow the crowd?",
    ]);

    // Strong majority (70–99%)
    if (majorityPct >= 70) return pick([
        "The crowd has spoken — but what do the rebels know that the rest don't?",
        "Most people agree, but the minority might have a point. Hear them out.",
        "Clear winner, but the outliers are interesting. Why did they pick differently?",
        "Majority rules — but majority isn't always right. Defend your corner.",
    ]);

    // Slight majority (51–69%)
    return pick([
        "Almost down the middle — this one's genuinely divisive. Debate time.",
        "Too close to call. What does your pick say about you?",
        "The room is split. Half of you are wrong — figure out which half.",
        "Nearly 50/50. This is exactly the kind of thing that starts arguments at dinner.",
    ]);
}

/////////////////////////////////////////////////////////        
// ── SLITHER IO ──────────────────────────────────────



        // ── DISCONNECT ────────────────────────────────────────
socket.on('disconnect', () => {

    // ── GAME SHOW ──
    if (socket.gsRoom) _gsLeave(socket, socket.gsRoom);

    // ── QUIZ ──
    Object.keys(quizRooms).forEach(roomName => {
        const qr = quizRooms[roomName];
        if (!qr || !qr.players[socket.id]) return;
        delete qr.players[socket.id];
        if (qr.hostId === socket.id && Object.keys(qr.players).length > 0) {
            qr.hostId = Object.keys(qr.players)[0];
            io.to(qr.hostId).emit('quiz_host_assigned');
        }
        io.to(roomName).emit('quiz_players_update', { players: qr.players });
    });

    // ── TRUE OR MYTH ──
    Object.keys(tomRooms).forEach(roomName => {
        const tr = tomRooms[roomName];
        if (!tr || !tr.players[socket.id]) return;
        delete tr.players[socket.id];
        if (tr.hostId === socket.id && Object.keys(tr.players).length > 0) {
            tr.hostId = Object.keys(tr.players)[0];
            io.to(tr.hostId).emit('tom_host_assigned');
        }
        io.to(roomName).emit('tom_players_update', { players: tr.players });
    });

    // ── THIS OR THAT ──
    Object.keys(totRooms).forEach(roomName => {
        const tr = totRooms[roomName];
        if (!tr || !tr.players[socket.id]) return;
        delete tr.players[socket.id];
        if (tr.hostId === socket.id && Object.keys(tr.players).length > 0) {
            tr.hostId = Object.keys(tr.players)[0];
            io.to(tr.hostId).emit('tot_host_assigned');
        }
        io.to(roomName).emit('tot_players_update', { players: tr.players });
    });

    // ── ROOM STATE CLEANUP ──
    const room = io.sockets.adapter.rooms.get(clientRoom);
    if (!room || room.size === 0) {
        delete roomStates[clientRoom];
        console.log(`[Room] Empty: ${clientRoom} — resetting state`);
        const s = getRoomState(clientRoom);
        Object.assign(s, {
            currentMode:    MODES.HOME,
            ajaxPath:       null,
            videoId:        null,
            videoTimestamp: 0,
            videoPaused:    true,
            radioStream:    null,
            radioName:      null,
            radioDialIndex: null,
            currentBg:      null,
            lastUpdate:     Date.now(),
            movieQuery:     null,
            liveChannel:    null,
            gameStreamUrl:  null,
            currentGame:    null
        });
    } else {
        console.log(`[Room] ${clientRoom} has ${room.size} viewers remaining`);
    }
});


    });
};

// ── GAME STREAM LEAVE HELPER ──────────────────────────────────
function _gsLeave(socket, room) {
    const gs = gsRooms[room];
    if (gs) {
        if (socket.gsRole === 'streamer' && gs.streamer && gs.streamer.socketId === socket.id) {
            gs.streamer = null;
            socket.to(room).emit('gs_streamer_left');
            console.log(`[GS] Streamer left room "${room}"`);
        } else {
            gs.viewers = gs.viewers.filter(v => v.socketId !== socket.id);
        }
        gsCleanup(room);
    }
    socket.leave(room);
    socket.gsRoom   = null;
    socket.gsRole   = null;
    socket.gsPeerId = null;
}