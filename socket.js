'use strict';

const MODES = {
    HOME:     'HOME',
    RADIO:    'RADIO',
    YOUTUBE:  'YOUTUBE',
    MUSIC:    'MUSIC',
    FLICKR:   'FLICKR',
    XXX:      'XXX',
    SETTINGS: 'SETTINGS',
    BROWSER:  'BROWSER'
};

module.exports = function initSocketIO(io, lobbyState, FIXED_ROOM) {

    io.on('connection', function(socket) {

        // 1. AUTO-JOIN À SALA FIXA
        socket.join(FIXED_ROOM);
        console.log(`[Join] Viewer ${socket.id} entrou. Modo atual: ${lobbyState.currentMode}`);

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
                lobbyState.ajaxPath = null;
                lobbyState.videoId = null;
                lobbyState.radioStream = null;
                lobbyState.radioName = null;
            } else {
                lobbyState.ajaxPath = rawPath;

                if (rawPath.includes('tvytube'))       lobbyState.currentMode = MODES.YOUTUBE;
                else if (rawPath.includes('music'))    lobbyState.currentMode = MODES.MUSIC;
                else if (rawPath.includes('radio'))    lobbyState.currentMode = MODES.RADIO;
                else if (rawPath.includes('flickr'))   lobbyState.currentMode = MODES.FLICKR;
                else if (rawPath.includes('xxx'))      lobbyState.currentMode = MODES.XXX;
                else if (rawPath.includes('settings')) lobbyState.currentMode = MODES.SETTINGS;
                else if (rawPath.includes('help'))     lobbyState.currentMode = MODES.SETTINGS;
                else                                   lobbyState.currentMode = MODES.HOME;
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

        // 9. DESCONEXÃO E LIMPEZA
        socket.on('disconnect', function() {
            const room = io.sockets.adapter.rooms.get(FIXED_ROOM);

            if (!room || room.size === 0) {
                console.log("--- Sala Vazia: Reiniciando Estado Global ---");
                Object.assign(lobbyState, {
                    currentMode:      MODES.HOME,
                    ajaxPath:         null,
                    videoId:          null,
                    videoTimestamp:   0,
                    videoPaused:      true,
                    radioStream:      null,
                    radioName:        null,
                    radioDialIndex:   5,
                    currentBg:        null,
                    lastUpdate:       Date.now()
                });
            } else {
                console.log(`[Out] Dispositivos restantes: ${room.size}`);
            }
        });
    });
};
