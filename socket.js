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

function getQuizRoom(roomId) {
    if (!quizRooms[roomId]) {
        quizRooms[roomId] = {
            players:   {},   // { socketId: { name, score, id } }
            questions: [],
            current:   -1,
            active:    false,
            answers:   {}    // { socketId: { answerIndex, timeLeft } }
        };
    }
    return quizRooms[roomId];
}

// Fetch questions from Open Trivia DB
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
                question:     decodeURIComponent(q.question),
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

module.exports = function initSocketIO(io, lobbyState, FIXED_ROOM) {

    io.on('connection', function(socket) {

        // 1. AUTO-JOIN À SALA FIXA
        socket.join(FIXED_ROOM);
        console.log(`[Join] Viewer ${socket.id} entrou. Modo atual: ${lobbyState.currentMode}`);



//////////////////////////////////////////////////////////////////
        // ── 5. ADD GAME STREAM SOCKET EVENTS ────────────────────────
// Add this block inside your initSocketIO() function,
// alongside the other socket.on() handlers.
// In your socket.js file, paste this inside the
// io.on('connection', (socket) => { ... }) block:



    // ── GAME STREAM SIGNALING ──────────────────────────────
    // gs_join: a peer (streamer or viewer) joins a GS room
        socket.on('gs_join', (data) => {
        const { room, role, peerId } = data;
        socket.join(room);
        socket.gsRoom = room;
        socket.gsRole = role;

        console.log(`[GS] ${role} joined room ${room} with peer ${peerId}`);

        if (role === 'viewer') {
            // Tell the streamer (others in room) a viewer arrived
            socket.to(room).emit('gs_viewer_joined', { peerId });
        }

        if (role === 'streamer') {
            // Tell any viewers already waiting that streamer is here
            socket.to(room).emit('gs_streamer_present', { peerId });
        }
    });

    // gs_stream_started: streamer screen capture is active
    socket.on('gs_stream_started', (data) => {
        socket.to(data.room).emit('gs_stream_started');
    });

    // gs_stream_stopped: streamer paused/stopped sharing
    socket.on('gs_stream_stopped', (data) => {
        socket.to(data.room).emit('gs_stream_stopped');
    });

    // gs_leave: user left the game stream module
    socket.on('gs_leave', (data) => {
        const room = data.room || socket.gsRoom;
        if (!room) return;
        socket.leave(room);
        if (socket.gsRole === 'streamer') {
            socket.to(room).emit('gs_streamer_left');
        }
        socket.gsRoom = null;
        socket.gsRole = null;
    });

    // Cleanup on disconnect
    socket.on('disconnect', () => {
        if (socket.gsRoom && socket.gsRole === 'streamer') {
            socket.to(socket.gsRoom).emit('gs_streamer_left');
        }
    });
///////////////////////////////////////////////////////////////



        // 2. SINCRONIZAÇÃO IMEDIATA
        socket.emit('force_sync_arrival', {
            ...lobbyState,
            timestamp: lobbyState.videoPaused
                ? lobbyState.videoTimestamp
                : lobbyState.videoTimestamp + (Date.now() - (lobbyState.lastUpdate || Date.now())) / 1000
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
        lobbyState.ajaxPath    = null;
        lobbyState.videoId     = null;
        lobbyState.radioStream = null;
        lobbyState.radioName   = null;
    } else {
        lobbyState.ajaxPath = rawPath;

        if      (rawPath.includes('tvytube'))        lobbyState.currentMode = MODES.YOUTUBE;
        else if (rawPath.includes('music'))          lobbyState.currentMode = MODES.MUSIC;
        else if (rawPath.includes('radio'))          lobbyState.currentMode = MODES.RADIO;
        else if (rawPath.includes('flickr'))         lobbyState.currentMode = MODES.FLICKR;
        else if (rawPath.includes('xxx'))            lobbyState.currentMode = MODES.XXX;
        else if (rawPath.includes('settings'))       lobbyState.currentMode = MODES.SETTINGS;
        else if (rawPath.includes('help'))           lobbyState.currentMode = MODES.SETTINGS;
        else if (rawPath.includes('movies'))         lobbyState.currentMode = MODES.MOVIES;
        else if (rawPath.includes('game-stream'))    lobbyState.currentMode = MODES.GAME_STREAM;
        else if (rawPath.includes('live-tv'))        lobbyState.currentMode = MODES.LIVE_TV;
        else if (rawPath.includes('games'))          lobbyState.currentMode = MODES.GAMES;
        else if (rawPath.includes('freebies'))       lobbyState.currentMode = MODES.FREEBIES;
        else if (rawPath.includes('sl-destinations')) lobbyState.currentMode = MODES.SECOND_LIFE;
        else                                         lobbyState.currentMode = MODES.HOME;
    }

    console.log(`[Nav] Mode: ${lobbyState.currentMode} | Path: ${lobbyState.ajaxPath}`);
    socket.to(FIXED_ROOM).emit('mirror_ajax_nav', data);
});

        // 4. CONTROLO DE VÍDEO E TRACKING DE TEMPO
        socket.on('report_current_time', (data) => {
            if (!data.videoId) {
                lobbyState.videoId = null;
                lobbyState.videoTimestamp = 0;
                lobbyState.videoPaused = true;
                return;
            }
            lobbyState.videoTimestamp = data.time;
            lobbyState.videoPaused = data.paused;
            lobbyState.videoId = data.videoId;
            lobbyState.lastUpdate = Date.now();
        });

        socket.on('toPlay', function(data) {
            const time = typeof data === 'object' ? data.time : data;
            lobbyState.videoTimestamp = time;
            lobbyState.videoPaused = false;
            if (data.videoId) lobbyState.videoId = data.videoId;
            io.to(FIXED_ROOM).emit('Play', time);
        });

        socket.on('toPause', function(time) {
            lobbyState.videoTimestamp = time;
            lobbyState.videoPaused = true;
            io.to(FIXED_ROOM).emit('Pause', time);
        });

        socket.on('toSeek', function(time) {
            lobbyState.videoTimestamp = time;
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
                lobbyState.currentBg = url;
                socket.to(FIXED_ROOM).emit('background', { url: url });
            }
        });

        socket.on('change_bg_index', (index) => {
            lobbyState.currentBg = index;
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
            if (data.type === 'background') {
                lobbyState.currentBg = data.url || data.value;
            }
            socket.to(FIXED_ROOM).emit('state_sync', data);
        });

        // 8. PEDIDOS DE ESTADO ENTRE PEERS (Fallback)
        socket.on('request_current_state', () => {
            socket.emit('force_sync_arrival', lobbyState);
            socket.to(FIXED_ROOM).emit('get_sync_state', { requesterId: socket.id });
        });

        socket.on('report_sync_state', (data) => {
            if (data.requesterId) {
                io.to(data.requesterId).emit('apply_sync_state', data);
            }
        });

socket.on('quiz_join', (data) => {
    const qr = getQuizRoom(data.room || FIXED_ROOM);
    qr.players[socket.id] = { id: socket.id, name: data.name, score: 0 };
    io.to(data.room || FIXED_ROOM).emit('quiz_players_update', { players: qr.players });
    console.log(`[Quiz] ${data.name} joined`);
});

socket.on('quiz_start', async (data) => {
    const room = data.room || FIXED_ROOM;
    const qr   = getQuizRoom(room);
    if (qr.active) return;

    qr.active    = true;
    qr.current   = -1;
    qr.questions = await fetchQuestions();

    // Countdown 3..2..1
    for (let i = 3; i >= 1; i--) {
        io.to(room).emit('quiz_countdown', { count: i });
        await sleep(1000);
    }

    // Send questions one by one
    for (let i = 0; i < qr.questions.length; i++) {
        qr.current = i;
        qr.answers = {};
        const q = qr.questions[i];

        io.to(room).emit('quiz_question', {
            question: q,
            index:    i,
            questions: qr.questions
        });

        // Wait 20 seconds for answers
        await sleep(20000);

        // Send result
        const scores = {};
        Object.values(qr.players).forEach(p => { scores[p.id] = p.score; });

        // Award points — faster answer = more points (max 1000)
        Object.entries(qr.answers).forEach(([sid, ans]) => {
            if (ans.answerIndex === q.correctIndex) {
                const pts = Math.round(500 + (ans.timeLeft / 20) * 500);
                if (qr.players[sid]) {
                    qr.players[sid].score += pts;
                    scores[sid] = qr.players[sid].score;
                }
            }
        });

        io.to(room).emit('quiz_result', {
            correctAnswer: q.correctAnswer,
            scores
        });

        // Wait before next question
        if (i < qr.questions.length - 1) await sleep(4000);
    }

    // Final scores
    const finalScores = {};
    Object.values(qr.players).forEach(p => { finalScores[p.id] = p.score; });
    io.to(room).emit('quiz_final', { scores: finalScores });
    qr.active = false;
});

socket.on('quiz_answer', (data) => {
    const qr = getQuizRoom(data.room || FIXED_ROOM);
    if (!qr.answers[socket.id]) {
        qr.answers[socket.id] = {
            answerIndex: data.answerIndex,
            timeLeft:    data.timeLeft
        };
    }
});

socket.on('quiz_reset', (data) => {
    const room = data.room || FIXED_ROOM;
    const qr   = getQuizRoom(room);
    Object.keys(qr.players).forEach(id => { qr.players[id].score = 0; });
    qr.active  = false;
    qr.current = -1;
    io.to(room).emit('quiz_reset');
    io.to(room).emit('quiz_players_update', { players: qr.players });
});

socket.on('quiz_leave', (data) => {
    const qr = getQuizRoom(data.room || FIXED_ROOM);
    delete qr.players[socket.id];
    io.to(data.room || FIXED_ROOM).emit('quiz_players_update', { players: qr.players });
});




// ═══════════════════════════════════════════════════════
// ── TRUE OR MYTH ────────────────────────────────────────
// ═══════════════════════════════════════════════════════
const tomRooms = {};
function getTomRoom(roomId) {
    if (!tomRooms[roomId]) {
        tomRooms[roomId] = {
            players: {},
            active:  false,
            current: -1,
            votes:   {}
        };
    }
    return tomRooms[roomId];
}

const TOM_STATEMENTS = [
    { statement: "Humans only use 10% of their brain.",            correct: 'false', explanation: "We use virtually all parts of our brain — the 10% myth is a popular misconception." },
    { statement: "A day on Venus is longer than a year on Venus.",  correct: 'true',  explanation: "Venus rotates so slowly that its day (243 Earth days) exceeds its year (225 Earth days)." },
    { statement: "Goldfish have a 3-second memory.",                correct: 'false', explanation: "Goldfish can remember things for months, not seconds." },
    { statement: "Hot water freezes faster than cold water.",       correct: 'true',  explanation: "This is known as the Mpemba effect, observed under certain conditions." },
    { statement: "The Great Wall of China is visible from space.",  correct: 'false', explanation: "It is too narrow to be seen from low Earth orbit with the naked eye." },
    { statement: "Bananas are technically berries.",                correct: 'true',  explanation: "Botanically, bananas qualify as berries. Strawberries do not." },
    { statement: "Lightning never strikes the same place twice.",   correct: 'false', explanation: "Lightning often strikes the same place repeatedly, especially tall structures." },
    { statement: "Cleopatra lived closer in time to the Moon landing than to the pyramids.", correct: 'true', explanation: "The pyramids are ~2500 BCE, Cleopatra ~30 BCE, Moon landing 1969 CE." },
    { statement: "Diamonds are made of compressed coal.",           correct: 'false', explanation: "Diamonds form from carbon deep in the mantle, unrelated to coal." },
    { statement: "Sharks can blink.",                               correct: 'false', explanation: "Sharks don't have eyelids — some have a nictitating membrane but don't blink." },
    { statement: "Honey never expires.",                            correct: 'true',  explanation: "3000-year-old honey found in Egyptian tombs was still edible." },
    { statement: "Humans share 50% of their DNA with bananas.",     correct: 'true',  explanation: "About 50-60% of human genes have a functional counterpart in bananas." },
    { statement: "Napoleon was unusually short for his time.",      correct: 'false', explanation: "Napoleon was ~5'7\" (170cm), average for his era. The myth came from British propaganda." },
    { statement: "Glass is a slow-moving liquid.",                  correct: 'false', explanation: "Glass is an amorphous solid. Old glass is thicker at the bottom due to manufacturing." },
    { statement: "Octopuses have three hearts.",                    correct: 'true',  explanation: "Two pump blood to the gills, one to the rest of the body." },
    { statement: "The human body has more bacterial cells than human cells.", correct: 'true', explanation: "Estimates suggest at least as many bacterial cells as human cells." },
    { statement: "Bulls are enraged by the colour red.",            correct: 'false', explanation: "Bulls are partially colour-blind — it's the motion of the cape that triggers them." },
    { statement: "Pure water conducts electricity.",                correct: 'false', explanation: "Pure water is a poor conductor — dissolved minerals are what conduct." },
    { statement: "A group of flamingos is called a flamboyance.",   correct: 'true',  explanation: "Yes — a flamboyance of flamingos is the correct collective noun." },
    { statement: "Cats always land on their feet.",                 correct: 'false', explanation: "Cats have a righting reflex but can still be injured in falls." },
];

socket.on('tom_join', (data) => {
    const tr = getTomRoom(data.room || FIXED_ROOM);
    tr.players[socket.id] = { id: socket.id, name: data.name, score: 0 };
    io.to(data.room || FIXED_ROOM).emit('tom_players_update', { players: tr.players });
});

socket.on('tom_start', async (data) => {
    const room = data.room || FIXED_ROOM;
    const tr   = getTomRoom(room);
    if (tr.active) return;
    tr.active  = true;
    tr.current = -1;

    const stmts = [...TOM_STATEMENTS].sort(() => Math.random() - 0.5).slice(0, 10);

    for (let i = 0; i < stmts.length; i++) {
        tr.current = i;
        tr.votes   = {};
        const s    = stmts[i];

        io.to(room).emit('tom_statement', { statement: s.statement, index: i });
        await sleep(15000);

        const scores    = {};
        const votesCopy = { ...tr.votes };
        Object.values(tr.players).forEach(p => {
            if (votesCopy[p.id] === s.correct) p.score += 500;
            scores[p.id] = p.score;
        });

        io.to(room).emit('tom_reveal', {
            correct: s.correct, explanation: s.explanation,
            votes: votesCopy, scores
        });

        if (i < stmts.length - 1) await sleep(4000);
    }

    const finalScores = {};
    Object.values(tr.players).forEach(p => { finalScores[p.id] = p.score; });
    io.to(room).emit('tom_final', { scores: finalScores });
    tr.active = false;
});

socket.on('tom_vote', (data) => {
    const tr = getTomRoom(data.room || FIXED_ROOM);
    if (!tr.votes[socket.id]) tr.votes[socket.id] = data.vote;
});

socket.on('tom_reset', (data) => {
    const room = data.room || FIXED_ROOM;
    const tr   = getTomRoom(room);
    Object.values(tr.players).forEach(p => { p.score = 0; });
    tr.active = false; tr.current = -1;
    io.to(room).emit('tom_reset');
    io.to(room).emit('tom_players_update', { players: tr.players });
});

socket.on('tom_leave', (data) => {
    const tr = getTomRoom(data.room || FIXED_ROOM);
    delete tr.players[socket.id];
    io.to(data.room || FIXED_ROOM).emit('tom_players_update', { players: tr.players });
});


// ═══════════════════════════════════════════════════════
// ── WHO AM I? ───────────────────════════════════════════
// ═══════════════════════════════════════════════════════
const waiRooms = {};
function getWaiRoom(roomId) {
    if (!waiRooms[roomId]) {
        waiRooms[roomId] = {
            players: {}, active: false,
            guesserIndex: 0, currentWord: null,
            currentQ: null, questionsLeft: 20, lives: 3
        };
    }
    return waiRooms[roomId];
}

const WAI_WORDS = [
    'Albert Einstein','Napoleon Bonaparte','Cleopatra','Sherlock Holmes','Batman',
    'Mickey Mouse','Elvis Presley','Marilyn Monroe','Steve Jobs','Elon Musk',
    'Harry Potter','Darth Vader','James Bond','Superman','Dracula',
    'Leonardo da Vinci','Shakespeare','Mozart','Marie Curie','Lionel Messi',
    'The Pope','A Mermaid','Santa Claus','Gandalf','Homer Simpson',
];

function startWaiRound(room, wr) {
    const ids = Object.keys(wr.players);
    if (!ids.length) return;
    wr.guesserIndex  = (wr.guesserIndex + 1) % ids.length;
    const guesserId  = ids[wr.guesserIndex];
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

socket.on('wai_join', (data) => {
    const wr = getWaiRoom(data.room || FIXED_ROOM);
    wr.players[socket.id] = { id: socket.id, name: data.name };
    io.to(data.room || FIXED_ROOM).emit('wai_players_update', { players: wr.players });
});

socket.on('wai_start', (data) => {
    const room = data.room || FIXED_ROOM;
    const wr   = getWaiRoom(room);
    if (wr.active) return;
    wr.active = true;
    startWaiRound(room, wr);
});

socket.on('wai_ask', (data) => {
    const room = data.room || FIXED_ROOM;
    const wr   = getWaiRoom(room);
    wr.currentQ = data.question;
    io.to(room).emit('wai_question', { question: data.question });
});

socket.on('wai_answer', (data) => {
    const room = data.room || FIXED_ROOM;
    const wr   = getWaiRoom(room);
    wr.questionsLeft = Math.max(0, wr.questionsLeft - 1);
    io.to(room).emit('wai_answered', {
        question: wr.currentQ, answer: data.answer, questionsLeft: wr.questionsLeft
    });
    wr.currentQ = null;
    if (wr.questionsLeft <= 0) {
        io.to(room).emit('wai_round_end', { word: wr.currentWord, won: false, guesserName: '' });
    }
});

socket.on('wai_guess', (data) => {
    const room        = data.room || FIXED_ROOM;
    const wr          = getWaiRoom(room);
    const guesserName = wr.players[socket.id]?.name || '';
    const correct     = data.guess.trim().toLowerCase() === wr.currentWord.toLowerCase();
    if (correct) {
        io.to(room).emit('wai_round_end', { word: wr.currentWord, won: true, guesserName });
    } else {
        wr.lives = Math.max(0, wr.lives - 1);
        if (wr.lives <= 0) {
            io.to(room).emit('wai_round_end', { word: wr.currentWord, won: false, guesserName });
        } else {
            io.to(room).emit('wai_wrong_guess', { lives: wr.lives });
        }
    }
});

socket.on('wai_next_round', (data) => {
    const room = data.room || FIXED_ROOM;
    startWaiRound(room, getWaiRoom(room));
});

socket.on('wai_leave', (data) => {
    const wr = getWaiRoom(data.room || FIXED_ROOM);
    delete wr.players[socket.id];
    io.to(data.room || FIXED_ROOM).emit('wai_players_update', { players: wr.players });
});


// ═══════════════════════════════════════════════════════
// ── THIS OR THAT ────────────────────────────────────────
// ═══════════════════════════════════════════════════════
const totRooms = {};
function getTotRoom(roomId) {
    if (!totRooms[roomId]) {
        totRooms[roomId] = { players: {}, active: false, current: -1, votes: {} };
    }
    return totRooms[roomId];
}

const TOT_QUESTIONS = [
    { question: "Which would you rather?", optionA: "Beach",          optionB: "Mountains",      emojiA: "🏖️", emojiB: "🏔️" },
    { question: "Which would you rather?", optionA: "Pizza",          optionB: "Sushi",           emojiA: "🍕", emojiB: "🍣" },
    { question: "Which would you rather?", optionA: "Cats",           optionB: "Dogs",            emojiA: "🐱", emojiB: "🐶" },
    { question: "Which would you rather?", optionA: "Coffee",         optionB: "Tea",             emojiA: "☕", emojiB: "🍵" },
    { question: "Which would you rather?", optionA: "Movies",         optionB: "TV Series",       emojiA: "🎬", emojiB: "📺" },
    { question: "Which would you rather?", optionA: "Summer",         optionB: "Winter",          emojiA: "☀️", emojiB: "❄️" },
    { question: "Which would you rather?", optionA: "Morning",        optionB: "Night",           emojiA: "🌅", emojiB: "🌙" },
    { question: "Which would you rather?", optionA: "Fly",            optionB: "Teleport",        emojiA: "✈️", emojiB: "⚡" },
    { question: "Which would you rather?", optionA: "Space",          optionB: "Deep Ocean",      emojiA: "🚀", emojiB: "🌊" },
    { question: "Which would you rather?", optionA: "Rich & Unknown", optionB: "Famous & Poor",   emojiA: "💰", emojiB: "🌟" },
    { question: "Which would you rather?", optionA: "No Internet",    optionB: "No TV",           emojiA: "📵", emojiB: "📺" },
    { question: "Which would you rather?", optionA: "Past",           optionB: "Future",          emojiA: "⏪", emojiB: "⏩" },
    { question: "Which would you rather?", optionA: "Rock",           optionB: "Electronic",      emojiA: "🎸", emojiB: "🎧" },
    { question: "Which would you rather?", optionA: "City Life",      optionB: "Countryside",     emojiA: "🏙️", emojiB: "🌾" },
    { question: "Which would you rather?", optionA: "Book",           optionB: "Audiobook",       emojiA: "📖", emojiB: "🎙️" },
];

socket.on('tot_join', (data) => {
    const tr = getTotRoom(data.room || FIXED_ROOM);
    tr.players[socket.id] = { id: socket.id, name: data.name };
    io.to(data.room || FIXED_ROOM).emit('tot_players_update', { players: tr.players });
});

socket.on('tot_start', async (data) => {
    const room = data.room || FIXED_ROOM;
    const tr   = getTotRoom(room);
    if (tr.active) return;
    tr.active  = true;

    const rounds = [...TOT_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 10);

    for (let i = 0; i < rounds.length; i++) {
        tr.current = i;
        tr.votes   = {};
        const q    = rounds[i];

        io.to(room).emit('tot_round', { ...q, index: i, total: rounds.length });
        await sleep(12000);

        let votesA = 0, votesB = 0, names = [];
        Object.entries(tr.votes).forEach(([sid, choice]) => {
            if (choice === 'A') votesA++;
            if (choice === 'B') votesB++;
            if (tr.players[sid]) names.push(tr.players[sid].name);
        });

        io.to(room).emit('tot_round_result', { ...q, votesA, votesB });
        if (i < rounds.length - 1) await sleep(4000);
    }

    io.to(room).emit('tot_game_end');
    tr.active = false; tr.current = -1;
});

socket.on('tot_vote', (data) => {
    const room = data.room || FIXED_ROOM;
    const tr   = getTotRoom(room);
    if (!tr.votes[socket.id] && data.choice) {
        tr.votes[socket.id] = data.choice;
        let votesA = 0, votesB = 0, names = [];
        Object.entries(tr.votes).forEach(([sid, c]) => {
            if (c === 'A') votesA++;
            if (c === 'B') votesB++;
            if (tr.players[sid]) names.push(tr.players[sid].name);
        });
        io.to(room).emit('tot_vote_update', { votesA, votesB, names });
    }
});

socket.on('tot_leave', (data) => {
    const tr = getTotRoom(data.room || FIXED_ROOM);
    delete tr.players[socket.id];
    io.to(data.room || FIXED_ROOM).emit('tot_players_update', { players: tr.players });
});

        // 9. DESCONEXÃO E LIMPEZA
socket.on('disconnect', function() {
    // ── GAME STREAM CLEANUP ──
    if (socket.gsRoom && socket.gsRole === 'streamer') {
        socket.to(socket.gsRoom).emit('gs_streamer_left');
    }

    // ── QUIZ CLEANUP ──
    const qr = getQuizRoom(FIXED_ROOM);
    if (qr.players[socket.id]) {
        delete qr.players[socket.id];
        io.to(FIXED_ROOM).emit('quiz_players_update', { players: qr.players });
    }

    // ── TRUE OR MYTH CLEANUP ──
    const tr = getTomRoom(FIXED_ROOM);
    if (tr.players[socket.id]) {
        delete tr.players[socket.id];
        io.to(FIXED_ROOM).emit('tom_players_update', { players: tr.players });
    }

    // ── WHO AM I CLEANUP ──
    const wr = getWaiRoom(FIXED_ROOM);
    if (wr.players[socket.id]) {
        delete wr.players[socket.id];
        io.to(FIXED_ROOM).emit('wai_players_update', { players: wr.players });
    }

    // ── THIS OR THAT CLEANUP ──
    const totR = getTotRoom(FIXED_ROOM);
    if (totR.players[socket.id]) {
        delete totR.players[socket.id];
        io.to(FIXED_ROOM).emit('tot_players_update', { players: totR.players });
    }

    // ── LOBBY STATE RESET ──
    const room = io.sockets.adapter.rooms.get(FIXED_ROOM);
    if (!room || room.size === 0) {
        console.log("--- Sala Vazia: Reiniciando Estado Global ---");
        Object.assign(lobbyState, {
            currentMode:    MODES.HOME,
            ajaxPath:       null,
            videoId:        null,
            videoTimestamp: 0,
            videoPaused:    true,
            radioStream:    null,
            radioName:      null,
            radioDialIndex: 5,
            currentBg:      null,
            lastUpdate:     Date.now()
        });
    
            } else {
                console.log(`[Out] Dispositivos restantes: ${room.size}`);
            }
        });
    });
};
