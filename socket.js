'use strict';

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
    SECOND_LIFE: 'SECOND_LIFE'
};

const quizRooms = {};
const tomRooms  = {};
const waiRooms  = {};
const totRooms  = {};

function getQuizRoom(roomId) {
    if (!quizRooms[roomId]) {
        quizRooms[roomId] = {
            players: {}, questions: [], current: -1, active: false, answers: {}
        };
    }
    return quizRooms[roomId];
}

async function fetchQuestions() {
    try {
        const axios = require('axios');
        const res = await axios.get('https://opentdb.com/api.php', {
            params: { amount: 10, type: 'multiple', encode: 'url3986' }
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

                if      (rawPath.includes('tvytube'))         state.currentMode = MODES.YOUTUBE;
                else if (rawPath.includes('music'))           state.currentMode = MODES.MUSIC;
                else if (rawPath.includes('radio'))           state.currentMode = MODES.RADIO;
                else if (rawPath.includes('flickr'))          state.currentMode = MODES.FLICKR;
                else if (rawPath.includes('xxx'))             state.currentMode = MODES.XXX;
                else if (rawPath.includes('settings'))        state.currentMode = MODES.SETTINGS;
                else if (rawPath.includes('help'))            state.currentMode = MODES.SETTINGS;
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

        socket.on('toPlay', (data) => {
            const time = typeof data === 'object' ? data.time : data;
            state.videoTimestamp = time;
            state.videoPaused    = false;
            if (data.videoId) state.videoId = data.videoId;
            io.to(clientRoom).emit('Play', time);
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

        socket.on('stop_radio_global', () => {
            state.radioStream = null;
            state.radioName   = null;
            io.to(clientRoom).emit('force_stop_radio');
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

        // ── QUIZ ──────────────────────────────────────────────
        socket.on('quiz_join', (data) => {
            const room = data.room || clientRoom;
            const qr   = getQuizRoom(room);
            qr.players[socket.id] = { id: socket.id, name: data.name, score: 0 };
            io.to(room).emit('quiz_players_update', { players: qr.players });
        });

        socket.on('quiz_start', async (data) => {
            const room = data.room || clientRoom;
            const qr   = getQuizRoom(room);
            if (qr.active) return;
            qr.active = true; qr.current = -1;
            qr.questions = await fetchQuestions();
            for (let i = 3; i >= 1; i--) { io.to(room).emit('quiz_countdown', { count: i }); await sleep(1000); }
            for (let i = 0; i < qr.questions.length; i++) {
                qr.current = i; qr.answers = {};
                const q = qr.questions[i];
                io.to(room).emit('quiz_question', { question: q, index: i, questions: qr.questions });
                await sleep(20000);
                const scores = {};
                Object.values(qr.players).forEach(p => { scores[p.id] = p.score; });
                Object.entries(qr.answers).forEach(([sid, ans]) => {
                    if (ans.answerIndex === q.correctIndex) {
                        const pts = Math.round(500 + (ans.timeLeft / 20) * 500);
                        if (qr.players[sid]) { qr.players[sid].score += pts; scores[sid] = qr.players[sid].score; }
                    }
                });
                io.to(room).emit('quiz_result', { correctAnswer: q.correctAnswer, scores });
                if (i < qr.questions.length - 1) await sleep(4000);
            }
            const finalScores = {};
            Object.values(qr.players).forEach(p => { finalScores[p.id] = p.score; });
            io.to(room).emit('quiz_final', { scores: finalScores });
            qr.active = false;
        });

        socket.on('quiz_answer', (data) => {
            const qr = getQuizRoom(data.room || clientRoom);
            if (!qr.answers[socket.id]) qr.answers[socket.id] = { answerIndex: data.answerIndex, timeLeft: data.timeLeft };
        });

        socket.on('quiz_reset', (data) => {
            const room = data.room || clientRoom;
            const qr   = getQuizRoom(room);
            Object.keys(qr.players).forEach(id => { qr.players[id].score = 0; });
            qr.active = false; qr.current = -1;
            io.to(room).emit('quiz_reset');
            io.to(room).emit('quiz_players_update', { players: qr.players });
        });

        socket.on('quiz_leave', (data) => {
            const room = data.room || clientRoom;
            const qr   = getQuizRoom(room);
            delete qr.players[socket.id];
            io.to(room).emit('quiz_players_update', { players: qr.players });
        });

        // ── TRUE OR MYTH ──────────────────────────────────────
        socket.on('tom_join', (data) => {
            const room = data.room || clientRoom;
            const tr   = getTomRoom(room);
            tr.players[socket.id] = { id: socket.id, name: data.name, score: 0 };
            io.to(room).emit('tom_players_update', { players: tr.players });
        });

        socket.on('tom_start', async (data) => {
            const room = data.room || clientRoom;
            const tr   = getTomRoom(room);
            if (tr.active) return;
            tr.active = true; tr.current = -1;
            const stmts = [...TOM_STATEMENTS].sort(() => Math.random() - 0.5).slice(0, 10);
            for (let i = 0; i < stmts.length; i++) {
                tr.current = i; tr.votes = {};
                const s = stmts[i];
                io.to(room).emit('tom_statement', { statement: s.statement, index: i });
                await sleep(15000);
                const scores = {}; const votesCopy = { ...tr.votes };
                Object.values(tr.players).forEach(p => {
                    if (votesCopy[p.id] === s.correct) p.score += 500;
                    scores[p.id] = p.score;
                });
                io.to(room).emit('tom_reveal', { correct: s.correct, explanation: s.explanation, votes: votesCopy, scores });
                if (i < stmts.length - 1) await sleep(4000);
            }
            const finalScores = {};
            Object.values(tr.players).forEach(p => { finalScores[p.id] = p.score; });
            io.to(room).emit('tom_final', { scores: finalScores });
            tr.active = false;
        });

        socket.on('tom_vote',  (data) => { const tr = getTomRoom(data.room || clientRoom); if (!tr.votes[socket.id]) tr.votes[socket.id] = data.vote; });
        socket.on('tom_reset', (data) => {
            const room = data.room || clientRoom; const tr = getTomRoom(room);
            Object.values(tr.players).forEach(p => { p.score = 0; });
            tr.active = false; tr.current = -1;
            io.to(room).emit('tom_reset');
            io.to(room).emit('tom_players_update', { players: tr.players });
        });
        socket.on('tom_leave', (data) => { const tr = getTomRoom(data.room || clientRoom); delete tr.players[socket.id]; io.to(data.room || clientRoom).emit('tom_players_update', { players: tr.players }); });

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

        // ── THIS OR THAT ──────────────────────────────────────
        socket.on('tot_join', (data) => { const room = data.room || clientRoom; const tr = getTotRoom(room); tr.players[socket.id] = { id: socket.id, name: data.name }; io.to(room).emit('tot_players_update', { players: tr.players }); });
        socket.on('tot_start', async (data) => {
            const room = data.room || clientRoom; const tr = getTotRoom(room);
            if (tr.active) return; tr.active = true;
            const rounds = [...TOT_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 10);
            for (let i = 0; i < rounds.length; i++) {
                tr.current = i; tr.votes = {}; const q = rounds[i];
                io.to(room).emit('tot_round', { ...q, index: i, total: rounds.length });
                await sleep(12000);
                let votesA = 0, votesB = 0;
                Object.entries(tr.votes).forEach(([, choice]) => { if (choice === 'A') votesA++; if (choice === 'B') votesB++; });
                io.to(room).emit('tot_round_result', { ...q, votesA, votesB });
                if (i < rounds.length - 1) await sleep(4000);
            }
            io.to(room).emit('tot_game_end');
            tr.active = false; tr.current = -1;
        });
        socket.on('tot_vote', (data) => {
            const room = data.room || clientRoom; const tr = getTotRoom(room);
            if (!tr.votes[socket.id] && data.choice) {
                tr.votes[socket.id] = data.choice;
                let votesA = 0, votesB = 0;
                Object.entries(tr.votes).forEach(([, c]) => { if (c === 'A') votesA++; if (c === 'B') votesB++; });
                io.to(room).emit('tot_vote_update', { votesA, votesB });
            }
        });
        socket.on('tot_leave', (data) => { const tr = getTotRoom(data.room || clientRoom); delete tr.players[socket.id]; io.to(data.room || clientRoom).emit('tot_players_update', { players: tr.players }); });

        // ── DISCONNECT ────────────────────────────────────────
        socket.on('disconnect', () => {
            if (socket.gsRoom) _gsLeave(socket, socket.gsRoom);

            // Game cleanups
            [getQuizRoom, getTomRoom, getWaiRoom, getTotRoom].forEach((getFn, i) => {
                const events = ['quiz_players_update','tom_players_update','wai_players_update','tot_players_update'];
                const r = getFn(clientRoom);
                if (r.players[socket.id]) {
                    delete r.players[socket.id];
                    io.to(clientRoom).emit(events[i], { players: r.players });
                }
            });

            // Reset room state immediately if empty
            const room = io.sockets.adapter.rooms.get(clientRoom);
            if (!room || room.size === 0) {
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