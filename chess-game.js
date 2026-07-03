'use strict';

// ── CHESS GAME MODULE ────────────────────────────────────────────
// Requires: npm install chess.js
// Wire into socket.js via registerChessHandlers(io, socket, clientRoom)
// and call chessHandleDisconnect(io, socket) from the main disconnect handler.

const { Chess } = require('chess.js');

const chessRooms      = {};   // roomName -> game session
const chessWaitingPool = {};  // roomName -> [{socketId, name}] waiting for random match

const TIME_CONTROL_SECONDS = 10 * 60; // 10 minutes per side

function createChessSession(room, whiteSocket, whiteName, blackSocket, blackName) {
    const chess = new Chess();
    const session = {
        room,
        chess,
        whiteId: whiteSocket,
        blackId: blackSocket,
        whiteName,
        blackName,
        whiteTime: TIME_CONTROL_SECONDS,
        blackTime: TIME_CONTROL_SECONDS,
        lastMoveAt: Date.now(),
        captured: { w: [], b: [] },
        gameOver: false,
        result: null,
        winner: null,
        clockInterval: null,
        pendingPromotion: null,
        rematchVotes: new Set()
    };
    chessRooms[room] = session;
    return session;
}

function getChessSession(room) {
    return chessRooms[room];
}

function boardToArray(chess) {
    // chess.board() already returns 8x8 array of {square,type,color}|null — normalize to {type,color}
    return chess.board().map(row => row.map(cell => cell ? { type: cell.type, color: cell.color } : null));
}

function inCheckSquareFor(chess) {
    if (!chess.isCheck()) return null;
    const color = chess.turn();
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = board[r][c];
            if (cell && cell.type === 'k' && cell.color === color) return cell.square;
        }
    }
    return null;
}

function buildStatePayload(session) {
    const { chess } = session;
    let gameOver = session.gameOver;
    let result   = session.result;
    let winner   = session.winner;

    if (!gameOver && chess.isGameOver()) {
        gameOver = true;
        if (chess.isCheckmate()) {
            result = 'checkmate';
            winner = chess.turn() === 'w' ? 'b' : 'w'; // side to move is the loser
        } else if (chess.isStalemate()) {
            result = 'stalemate';
        } else if (chess.isDraw()) {
            result = 'draw';
        }
        session.gameOver = true;
        session.result = result;
        session.winner = winner;
        stopClock(session);
    }

    return {
        board: boardToArray(chess),
        turn: chess.turn(),
        lastMove: session.lastMove || null,
        inCheckSquare: inCheckSquareFor(chess),
        history: chess.history(),
        captured: session.captured,
        whiteTime: Math.max(0, Math.round(session.whiteTime)),
        blackTime: Math.max(0, Math.round(session.blackTime)),
        gameOver,
        result,
        winner
    };
}

function startClock(io, session) {
    stopClock(session);
    session.lastTick = Date.now();
    session.clockInterval = setInterval(() => {
        if (session.gameOver) { stopClock(session); return; }
        const now = Date.now();
        const elapsed = (now - session.lastTick) / 1000;
        session.lastTick = now;

        if (session.chess.turn() === 'w') session.whiteTime -= elapsed;
        else session.blackTime -= elapsed;

        if (session.whiteTime <= 0 || session.blackTime <= 0) {
            session.gameOver = true;
            session.result = 'timeout';
            session.winner = session.whiteTime <= 0 ? 'b' : 'w';
            stopClock(session);
        }

        io.to(session.room).emit('chess_state', buildStatePayload(session));
    }, 1000);
}

function stopClock(session) {
    if (session.clockInterval) {
        clearInterval(session.clockInterval);
        session.clockInterval = null;
    }
}

// Guard against matchmaking/joining into a room the socket doesn't actually belong to.
// Assumes the socket has already joined a Socket.io room named after the TV room elsewhere
// in the connection handler (as with the other game modules).
function socketInRoom(socket, room) {
    return !!(socket.rooms && socket.rooms.has(room));
}

function _removeFromWaitingPools(socket, room) {
    if (room) {
        chessWaitingPool[room] = (chessWaitingPool[room] || []).filter(p => p.socketId !== socket.id);
    } else {
        Object.keys(chessWaitingPool).forEach(r => {
            chessWaitingPool[r] = (chessWaitingPool[r] || []).filter(p => p.socketId !== socket.id);
        });
    }
}

function _abandonIfPlaying(io, socket, room) {
    const session = chessRooms[room];
    if (!session || session.gameOver) return;
    if (socket.id !== session.whiteId && socket.id !== session.blackId) return;

    const opponentId = socket.id === session.whiteId ? session.blackId : session.whiteId;
    io.to(opponentId).emit('chess_opponent_left');

    session.gameOver = true;
    session.result = 'abandoned';
    session.winner = socket.id === session.whiteId ? 'b' : 'w';
    stopClock(session);
}

function registerChessHandlers(io, socket, clientRoom) {

    // ── CREATE GAME (waits for a 2nd player in the same TV room) ──
    socket.on('chess_create', (data) => {
        const room = data.room || clientRoom;
        if (!socketInRoom(socket, room)) return;

        const existing = chessRooms[room];
        if (existing && !existing.gameOver) {
            socket.emit('chess_room_busy');
            return;
        }

        const name = (data.name || 'Player').slice(0, 16);

        if (!chessWaitingPool[room]) chessWaitingPool[room] = [];
        const pool = chessWaitingPool[room];

        // Remove any stale entry for this socket first
        chessWaitingPool[room] = pool.filter(p => p.socketId !== socket.id);

        chessWaitingPool[room].push({ socketId: socket.id, name });
        socket.chessName = name;
        socket.emit('chess_waiting');

        _tryMatch(io, room);
    });

    // ── JOIN RANDOM (alias of create — matches whoever is waiting) ──
    socket.on('chess_join_random', (data) => {
        const room = data.room || clientRoom;
        if (!socketInRoom(socket, room)) return;

        const existing = chessRooms[room];
        if (existing && !existing.gameOver) {
            socket.emit('chess_room_busy');
            return;
        }

        const name = (data.name || 'Player').slice(0, 16);

        if (!chessWaitingPool[room]) chessWaitingPool[room] = [];
        const pool = chessWaitingPool[room];
        chessWaitingPool[room] = pool.filter(p => p.socketId !== socket.id);
        chessWaitingPool[room].push({ socketId: socket.id, name });
        socket.chessName = name;
        socket.emit('chess_waiting');

        _tryMatch(io, room);
    });

    // ── REQUEST LEGAL MOVES FOR A SQUARE ──
    socket.on('chess_get_moves', (data) => {
        const session = getChessSession(data.room);
        if (!session || session.gameOver) return;

        const myColor = socket.id === session.whiteId ? 'w' : (socket.id === session.blackId ? 'b' : null);
        if (!myColor || session.chess.turn() !== myColor) return;

        const moves = session.chess.moves({ square: data.square, verbose: true }) || [];
        socket.emit('chess_legal_moves', {
            square: data.square,
            moves: moves.map(m => ({ to: m.to, capture: !!m.captured, promotion: !!m.promotion }))
        });
    });

    // ── ATTEMPT A MOVE ──
    socket.on('chess_move', (data) => {
        const session = getChessSession(data.room);
        if (!session || session.gameOver) return;

        const myColor = socket.id === session.whiteId ? 'w' : (socket.id === session.blackId ? 'b' : null);
        if (!myColor || session.chess.turn() !== myColor) return;

        // Detect promotion need (pawn reaching last rank) before committing
        const verboseMoves = session.chess.moves({ square: data.from, verbose: true }) || [];
        const target = verboseMoves.find(m => m.to === data.to);
        if (!target) {
            socket.emit('chess_invalid_move');
            return;
        }

        if (target.promotion && !data.promotion) {
            session.pendingPromotion = { from: data.from, to: data.to, color: myColor };
            socket.emit('chess_promotion_needed', { from: data.from, to: data.to });
            return;
        }

        const moveResult = session.chess.move({ from: data.from, to: data.to, promotion: data.promotion || 'q' });
        if (!moveResult) {
            socket.emit('chess_invalid_move');
            return;
        }

        if (moveResult.captured) {
            session.captured[myColor].push(moveResult.captured);
        }
        session.lastMove = { from: moveResult.from, to: moveResult.to };
        session.pendingPromotion = null;

        io.to(session.room).emit('chess_state', buildStatePayload(session));
    });

    // ── COMPLETE A PROMOTION MOVE ──
    socket.on('chess_promote', (data) => {
        const session = getChessSession(data.room);
        if (!session || session.gameOver || !session.pendingPromotion) return;

        const myColor = socket.id === session.whiteId ? 'w' : (socket.id === session.blackId ? 'b' : null);
        if (!myColor || session.pendingPromotion.color !== myColor) return;

        const moveResult = session.chess.move({ from: data.from, to: data.to, promotion: data.promotion || 'q' });
        if (!moveResult) {
            socket.emit('chess_invalid_move');
            return;
        }

        if (moveResult.captured) {
            session.captured[myColor].push(moveResult.captured);
        }
        session.lastMove = { from: moveResult.from, to: moveResult.to };
        session.pendingPromotion = null;

        io.to(session.room).emit('chess_state', buildStatePayload(session));
    });

    // ── DRAW OFFER ──
    socket.on('chess_draw_offer', (data) => {
        const session = getChessSession(data.room);
        if (!session || session.gameOver) return;
        const opponentId = socket.id === session.whiteId ? session.blackId : session.whiteId;
        io.to(opponentId).emit('chess_draw_offered');
    });

    socket.on('chess_draw_response', (data) => {
        const session = getChessSession(data.room);
        if (!session || session.gameOver) return;
        if (data.accepted) {
            session.gameOver = true;
            session.result = 'draw';
            session.winner = null;
            stopClock(session);
            io.to(session.room).emit('chess_state', buildStatePayload(session));
        }
    });

    // ── RESIGN ──
    socket.on('chess_resign', (data) => {
        const session = getChessSession(data.room);
        if (!session || session.gameOver) return;

        const myColor = socket.id === session.whiteId ? 'w' : (socket.id === session.blackId ? 'b' : null);
        if (!myColor) return;

        session.gameOver = true;
        session.result = 'resign';
        session.winner = myColor === 'w' ? 'b' : 'w';
        stopClock(session);
        io.to(session.room).emit('chess_state', buildStatePayload(session));
    });

    // ── REMATCH ──
    socket.on('chess_rematch', (data) => {
        const session = getChessSession(data.room);
        // Rematch only makes sense once the current game has actually ended —
        // otherwise a stray click mid-game could later spawn a second, orphaned
        // session whose clock interval keeps ticking in the background.
        if (!session || !session.gameOver) return;

        session.rematchVotes.add(socket.id);
        const opponentId = socket.id === session.whiteId ? session.blackId : session.whiteId;

        if (session.rematchVotes.size === 1) {
            io.to(opponentId).emit('chess_rematch_offer');
            return;
        }

        // Make sure the old session's clock is fully stopped before it's replaced —
        // createChessSession() below only overwrites the chessRooms[room] reference,
        // it does NOT touch the old session object, so its setInterval would otherwise
        // keep running forever in the background (zombie timer).
        stopClock(session);

        // Both agreed — swap colours and start fresh
        const newSession = createChessSession(
            session.room,
            session.blackId, session.blackName,   // swap sides
            session.whiteId, session.whiteName
        );
        startClock(io, newSession);

        io.to(newSession.whiteId).emit('chess_game_start', {
            room: newSession.room, yourColor: 'w',
            whiteName: newSession.whiteName, blackName: newSession.blackName,
            board: boardToArray(newSession.chess)
        });
        io.to(newSession.blackId).emit('chess_game_start', {
            room: newSession.room, yourColor: 'b',
            whiteName: newSession.whiteName, blackName: newSession.blackName,
            board: boardToArray(newSession.chess)
        });
        io.to(newSession.room).emit('chess_state', buildStatePayload(newSession));
    });

    // ── LEAVE / CLOSE (player closed the chess UI, but the TV socket stays connected) ──
    // Frees the room for a fresh game: removes them from any waiting pool and,
    // if a game was in progress, treats it the same way a disconnect would —
    // notifies the opponent and marks the session abandoned so chess_room_busy
    // doesn't block the room forever.
    socket.on('chess_leave', (data) => {
        const room = data.room || clientRoom;
        if (!room) return;
        _removeFromWaitingPools(socket, room);
        _abandonIfPlaying(io, socket, room);
    });
}

// ── MATCH TWO WAITING PLAYERS IN THE SAME ROOM ──
function _tryMatch(io, room) {
    const pool = chessWaitingPool[room];
    if (!pool || pool.length < 2) return;

    const [p1, p2] = pool.splice(0, 2);
    const session = createChessSession(room, p1.socketId, p1.name, p2.socketId, p2.name);
    startClock(io, session);

    io.to(p1.socketId).emit('chess_game_start', {
        room, yourColor: 'w',
        whiteName: p1.name, blackName: p2.name,
        board: boardToArray(session.chess)
    });
    io.to(p2.socketId).emit('chess_game_start', {
        room, yourColor: 'b',
        whiteName: p1.name, blackName: p2.name,
        board: boardToArray(session.chess)
    });
}

// ── DISCONNECT CLEANUP ──
function chessHandleDisconnect(io, socket) {
    _removeFromWaitingPools(socket, null);

    Object.keys(chessRooms).forEach(room => {
        _abandonIfPlaying(io, socket, room);
    });
}

module.exports = { registerChessHandlers, chessHandleDisconnect };
