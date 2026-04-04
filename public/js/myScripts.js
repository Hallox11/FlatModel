// ===============================
// GLOBAL CONFIG
// ===============================
window.socket = io(); // Initialize immediately
window.isRemoteAction = false;
const params = new URLSearchParams(window.location.search);
window.myRoom = params.get('room') || 'Lobby';  // ← define AQUI, globalmente


// ===============================
// UNIFIED NAV CONFIG
// ===============================
const NAV_CONFIG = {

    // --- AJAX MENUS (Fragments) ---
    menus: {
        'radios': '/radios-menu',
        'inter-radio': '/radios/inter-radio',
        'sl-radio': '/radios/sl-radio',
        'music': '/music-menu',
        'movies': '/movies-menu',
        'sl': '/sl-menu',
        'flickr': '/flickr',
        'youtube': '/youtube',

        'tvytube': '/tvytube',
        'xxx': '/xxx-check',
        'xxx-index': '/xxx-index',
        'xvideos': '/xvideos-grid',
        'get-xxx-stream': '/get-xxx-stream',
        'xxx-player': '/xxx-player',
        'ytmusic_player': '/music/ytmusic',
        'browsers': '/browsers',
        'help': '/help'
    },

    // --- RADIO ROOT (Redirect Logic) ---
    radioRoot: {
        'inter': 'inter-radio',
        'sl': 'sl-radio' 
    },

    // --- RADIO COUNTRIES ---
    radio: {
        'pt': './radios/pt',
        'nz': './radios/nz',
        'es': './radios/es',
        'br': './radios/br',
        'fr': './radios/fr',
        'it': './radios/it',
        'mr': './radios/mr'
    },

    // --- MUSIC ---
    music: {
        'concerts': 'id=concerts&mode=mix',
        'full': 'id=UCXynnXkWjVqGgZo02vCfl9g&mode=user',
        'blues': 'id=UCYY_YLVWFI_IZ51Eu6x9bgA&mode=user',
        'blues_list': 'id=UCYY_YLVWFI_IZ51Eu6x9bgA&mode=list',
        'jazz': 'id=UCNJFXYXkXt_P8bJUxb21MpA&mode=user',
        'jazz_list': 'id=UCNJFXYXkXt_P8bJUxb21MpA&mode=list',
        'classic': 'id=UC68KnvCZ-nJzmmuSu_tKASA&mode=user',
        'classic_list': 'id=UC68KnvCZ-nJzmmuSu_tKASA&mode=list',
        'relax': 'id=UCjzHeG1KWoonmf9d5KBvSiw&mode=user',
        'relax_list': 'id=UCjzHeG1KWoonmf9d5KBvSiw&mode=list',
        'slowrock': 'id=UC3CX2e-ej3wsG_nA4r4uykg&mode=user',
        'love': 'id=UChR6kXdFtHNPNkIc5S17B2w&mode=user',
        'rap': 'id=UCMu5gPmKp5av0QCAajKTMhw&mode=user',
        'pmb': 'id=UCFm4zM6-08kb9abXDk4fxXQ&mode=user',
        'pmb_list': 'id=UCFm4zM6-08kb9abXDk4fxXQ&mode=list',
        'boiler': 'id=UCGBpxWJr9FNOcFYA5GkKrMg&mode=user',
        'boiler_list': 'id=UCGBpxWJr9FNOcFYA5GkKrMg&mode=list',
        'majestic': 'id=UCXIyz409s7bNWVcM-vjfdVA&mode=user',
        'majestic_list': 'id=UCXIyz409s7bNWVcM-vjfdVA&mode=list'
    },

    // --- MOVIES ---
    movies: {
        'mixmovies': 'mixmovies&mix',
        'movie_trailers': 'UCi8e0iOVk1fEOogdfu4YgfA',
        'mojo': 'UCaWd5_7JhbQBe4dknZhsHJg',
        'movie_central': 'UCGBzBkV-MinlBvHBzZawfLQ',
        'popcornflix': 'UCVFYikepF-avelvuIaQ_lHA',
        'v_movies': 'UCPPPrnT5080hPMxK1N4QSjA',
        'retrospective': 'UCibOdW_Yj0-pj5SQGZxZIgA',
        'western': 'UCyJYCQ6WaEMhdZAuPo799bA',
        'mr_bean': 'UCkAGrHCLFmlK3H2kd6isipg',
        'pink_panther': 'UCFeUyPY6W8qX8w2o6oSiRmw',
        'warner_kids': 'UC9trsD1jCTXXtN3xIOIU8gg'
    }
};

// ===============================
// UTILITY FUNCTIONS
// ===============================
function cleanURL(path) {
    try {
        let url = new URL(path, window.location.origin);
        url.searchParams.delete('room');
        if (typeof myRoom !== 'undefined' && myRoom) {
            url.searchParams.append('room', myRoom);
        }
        return url.pathname + url.search;
    } catch (e) {
        if (typeof myRoom !== 'undefined' && myRoom) {
            return path.includes('?') ? path + "&room=" + myRoom : path + "?room=" + myRoom;
        }
        return path;
    }
}

function toggleTextContrast(isRemote = false) {
    const body = $('body');
    body.toggleClass('dark-text');
    
    const isDark = body.hasClass('dark-text');
    localStorage.setItem("text_contrast", isDark ? "dark" : "light");

    if (!isRemote && window.socket && window.socket.connected) {
        window.socket.emit('state_sync', {
            type: 'text_contrast',
            state: isDark,
            room: window.myRoom
        });
    }
}

$(document).ready(function() {
    if (localStorage.getItem("text_contrast") === "dark") {
        $('body').addClass('dark-text');
    }
});

// ===============================
// CORE NAVIGATION FUNCTION
// ===============================
function handleNav(mode, isRemote = false) {
    if (!mode) return;
    window.killRadio();

    // 1. Limpeza de listeners antigos para evitar que o player "reapareça" por comandos de socket
    if (window.socket) {
        window.socket.off('Play').off('Pause');
    }

    const menuKey = Object.keys(NAV_CONFIG.menus).find(k => NAV_CONFIG.menus[k] === mode.split('?')[0]);

    let isAjaxMenu = !!NAV_CONFIG.menus[mode] || 
                     !!menuKey ||
                     mode.includes('xxx') ||
                     mode.includes('xvideos') ||
                     mode.includes('music/') ||  
                     mode.includes('movies/') || 
                     mode.includes('radios/') || 
                     mode.includes('tvytube') || 
                     mode.includes('ytmusic') || 
                     mode.includes('youtube') ||
                     mode.includes('radio_player') ||
                     mode.includes('-menu');

    let targetUrl = NAV_CONFIG.menus[mode] || mode;
    const finalUrl = cleanURL(targetUrl); 

    // 2. Sincronização com o Servidor
    if (!isRemote && window.socket && window.socket.connected) {
        window.socket.emit(isAjaxMenu ? 'mirror_ajax_nav' : 'mirror_nav', {
            mode: mode, 
            route: finalUrl,
            path: finalUrl, // ADICIONADO: Garante que o servidor receba o 'path' para validar a limpeza do vídeo
            room: myRoom
        });

        // Se NÃO for para o player, forçamos o servidor a limpar o ID do vídeo agora
        if (!finalUrl.includes('tvytube')) {
            window.socket.emit('report_current_time', {
                videoId: null,
                time: 0,
                paused: true
            });
        }
    }

    if (isAjaxMenu) {
        window.lastRadioUrl = targetUrl; 
        window.currentAjaxPath = targetUrl; 

        $('.status-bar').fadeOut(200);
        $('#theme-slider').fadeOut(200);

        $.get(finalUrl, function(data) {
            // Se o player antigo ainda estiver no DOM, removemos antes de injetar o novo
            $('#sub-content-overlay').empty(); 
            
            $('#main-grid').hide();
            
            const wrappedData = `
                <script>
                    window.$ = window.jQuery; 
                    window.myRoom = "${myRoom}";
                <\/script>
                ${data}
            `;

            $('#sub-content-overlay')
                .html(wrappedData) 
                .css('display', 'flex')
                .hide()
                .fadeIn(300);
        });
    } else {
        setTimeout(() => { window.location.href = finalUrl; }, 150);
    }
}

function closeSubMenu(isRemote = false) {
    const audio = document.getElementById('sl_native_player');
          
    if (audio) {
        console.log("Stopping Radio Stream...");
        audio.pause();
        audio.src = "";
        audio.load();
        audio.remove();
    }

if (!isRemote && window.socket && window.socket.connected) {
        // Informe o servidor explicitamente que o estado do vídeo deve ser limpo
        window.socket.emit('report_current_time', { 
            videoId: null, 
            time: 0, 
            paused: true 
        });

        window.socket.emit('mirror_ajax_nav', { 
            action: 'CLOSE', 
            path: '/', // Define o path como raiz para o servidor limpar o estado
            room: myRoom 
        });
    }

    $('#sub-content-overlay').fadeOut(200, function() {
        $(this).html('').hide();
        $('#main-grid').show().css({'opacity': '1', 'transform': 'scale(1)'});
        $('.status-bar').fadeIn(200);
        $('#theme-slider').fadeIn(200);
    });
}

// ===============================
// GLOBAL CLICK HANDLER
// ===============================
$(document).on('click', '.btn', function(e) {
    e.preventDefault();
    const $el = $(this);
    let mode = $el.data('mode') || $el.attr('id');
    let type = $el.data('type') || "";

    if (type === "external") {
        return handleNav(mode); 
    }

    if (type === "menu") return handleNav(mode);

    if (type === "radio-root") {
        let route = NAV_CONFIG.radioRoot[mode];
        let stream = $el.data('stream');
        let name = $el.data('name');

        if (route) {
            let target = (stream && name) 
                ? `/radios/sl_radio_player?stream=${encodeURIComponent(stream)}&name=${encodeURIComponent(name)}`
                : route;
            return handleNav(target);
        }
    }

    if (type === "radio") {
        let path = NAV_CONFIG.radio[mode];
        if (path) return handleNav(path);
    }

    if (type === "movie") {
        let ytParams = NAV_CONFIG.movies[mode];
        if (ytParams) {
            const route = ytParams.includes('=') 
                ? `/movies/ytmovies?${ytParams}` 
                : `/movies/ytmovies?id=${ytParams}&mode=user`;
            return handleNav(route);
        }
    }

    if (type === "music") {
        let ytParams = NAV_CONFIG.music[mode];
        if (ytParams) {
            console.log(`/music/ytmusic?${ytParams}`);
            return handleNav(`/music/ytmusic?${ytParams}`);
        }
    }

    if (type === "radio-station") {
        const slug = $el.data('slug'); 
        const $overlay = $('#sub-content-overlay');

        if ($overlay.is(':visible')) {
            window.location.hash = slug; 
            $('#radio-logo-active').attr('src', `https://cdn.webrad.io/images/logos/radio-co-ma/${slug}.png`);

            if (window.socket && !window.isRemoteAction) {
                window.socket.emit('state_sync', {
                    type: 'radio_hash_change',
                    hash: slug,
                    room: window.myRoom
                });
            }
            return;
        } else {
            return handleNav('/radios-menu'); 
        }
    }
});

// ===============================
// SCROLL SYNC
// ===============================
$(document).on('scroll', '#conteiner, .conteiner, #xxx-module', function() {
    if (socket && socket.connected && !window.isSyncing) { 
        socket.emit('state_sync', {
            type: 'scroll',
            position: $(this).scrollTop(),
            room: myRoom
        });
    }
});

window.killRadio = function() {
    const audio = document.getElementById('sl_native_player');
    if (audio) {
        console.log("Stopping Radio Stream via Global Killer...");
        audio.pause();
        audio.src = "";
        audio.load();
        audio.remove();
    }
};

// ===============================
// HOVER & INPUT SYNC (senders only — no listener here)
// ===============================
const syncSelectors = '.btn, .video-card, .cat-item, .radio-card, .menu-item, .thumb-wrap, .flickr-card, .fav-chip';

$(document).on('mouseenter mouseleave', syncSelectors, function(e) {
    if (window.isRemoteAction) return;

    const isEnter = e.type === 'mouseenter';
    const primaryClass = $(this).attr('class').split(' ')[0];
    const index = $(`.${primaryClass}`).index(this);

    socket.emit('state_sync', {
        type: 'global_hover',
        selector: `.${primaryClass}`,
        index: index,
        state: isEnter ? 'enter' : 'leave',
        room: window.myRoom
    });
});

$(document).on('focus blur', 'input[type="text"]', function(e) {
    if (window.isRemoteAction) return;
    
    socket.emit('state_sync', { 
        type: 'input_focus', 
        id: this.id, 
        action: e.type,
        room: window.myRoom
    });
});

// ===============================
// SOCKET INITIALIZATION
// ===============================
$(function() { 
    if (typeof io !== 'undefined') {

        socket.on('connect', () => {
            console.log("Socket connected! Joining room:", myRoom);
            socket.emit('join_room', myRoom);
        });

        // -------------------------------------------------------
        // force_sync_arrival — sync new arrival to lobby state
        // -------------------------------------------------------
let syncArrivalDone = false;
        socket.on('force_sync_arrival', function(state) {
            if (syncArrivalDone) return;
            syncArrivalDone = true;
            console.log("--- SYNCING TO LOBBY STATE ---", state);

            // 1. SYNC BACKGROUND (Sempre atualiza o fundo)
            if (state.currentBg) {
                document.body.style.backgroundImage = `url('${state.currentBg}')`;
                document.body.style.backgroundSize = "cover";
            }

            // 2. PRIORIDADE: SYNC AJAX OVERLAY (Menus, Grids, etc.)
            // Se houver um menu ativo, ele deve ser a prioridade visual.
            if (state.ajaxPath) {
                console.log("Syncing to Menu/Overlay:", state.ajaxPath);
                handleNav(state.ajaxPath, true);
                
                // IMPORTANTE: Se o menu NÃO for o player (tvytube), 
                // paramos aqui para não forçar a abertura do vídeo por baixo.
                if (!state.ajaxPath.includes('tvytube')) {
                    return; 
                }
            }

            // 3. SYNC VIDEO PLAYER (Apenas se não houver menu ou se o menu for o player)
            if (state.videoId) {
                const alreadyPlaying = window.ytPlayerInstance && 
                                       window.ytPlayerInstance.getVideoData &&
                                       window.ytPlayerInstance.getVideoData().video_id === state.videoId;

                if (alreadyPlaying) {
                    console.log("Already playing, seeking to:", state.timestamp);
                    window.ytPlayerInstance.seekTo(state.timestamp, true);
                    if (!state.isPaused) window.ytPlayerInstance.playVideo();
                    return;
                }

                const syncPath = `/tvytube?videoId=${state.videoId}`;
                window.syncTargetTime = state.timestamp;
                window.syncIsPaused   = state.isPaused;
                handleNav(syncPath, true);
                return;
            }

            // 4. SYNC RADIO (Se não houver vídeo nem menu impeditivo)
            if (state.radioData && state.radioData.stream) {
                if (typeof tuneRadio === 'function') {
                    tuneRadio(state.radioData.stream, state.radioData.name);
                }
            }
        });

        // -------------------------------------------------------
        // state_sync — SINGLE unified listener (was duplicated)
        // -------------------------------------------------------
        socket.on('state_sync', function(data) {
            switch (data.type) {

                case 'text_contrast':
                    if (data.state) { $('body').addClass('dark-text'); }
                    else            { $('body').removeClass('dark-text'); }
                    break;

                case 'global_hover':
                    $('.remote-hover').removeClass('remote-hover');
                    if (data.state === 'enter') {
                        const $target = $(data.selector).eq(data.index);
                        $target.addClass('remote-hover');

                        if (data.selector === '.flickr-card') {
                            const $flickrGrid = $('#flickr-results-grid');
                            if ($flickrGrid.length) {
                                $flickrGrid.stop().animate({
                                    scrollTop: $target.position().top + $flickrGrid.scrollTop() - 60
                                }, 400);
                            }
                        }
                    }
                    break;

                case 'input_focus': {
                    const $input = $(`#${data.id}`);
                    const isFocus = data.action === 'focus';
                    $input.toggleClass('remote-focus-style', isFocus);
                    $input.attr('placeholder', isFocus ? 'Remote user typing...' : 'Search...');
                    break;
                }

                case 'yt_modal': {
                    const $modal = $('#yt-cat-modal');
                    if ($modal.length) {
                        window.isRemoteAction = true;
                        $modal.css('display', data.show ? 'flex' : 'none');
                        setTimeout(() => { window.isRemoteAction = false; }, 100);
                    }
                    break;
                }

                case 'scroll': {
                    const $scrollTarget = $('#yt-content-scroll').length  ? $('#yt-content-scroll') :
                                          $('#xxx-module').length          ? $('#xxx-module') :
                                          $('#flickr-results-grid').length ? $('#flickr-results-grid') :
                                          $('#conteiner');

                    if ($scrollTarget.length > 0) {
                        window.isSyncing = true;
                        $scrollTarget.scrollTop(data.position);
                        setTimeout(() => { window.isSyncing = false; }, 50);
                    }
                    break;
                }

                case 'start_slideshow':
                    if (typeof window.startSlideshow === 'function') {
                        window.startSlideshow(data.index, true);
                    } else {
                        $('#flickr-main-ui').hide();
                        $('#flickr-lightbox').fadeIn(200).css('display', 'flex');
                    }
                    break;

                case 'exit_slideshow':
                    if (typeof window.exitSlideshow === 'function') { window.exitSlideshow(true); }
                    else { $('#flickr-lightbox').fadeOut(200); $('#flickr-main-ui').fadeIn(200); }
                    break;

                case 'flickr_remote_nav':
                    window.currentIndex = data.index;
                    const $lbox = $('#flickr-lightbox');
                    if ($lbox.length) {
                        if ($lbox.is(':hidden')) $lbox.show().css('display', 'flex');
                        $('#lightbox-img').attr('src', data.url);
                        $('#img-title').text(data.title || '');
                    }
                    break;

                case 'flickr_channel_sync':
                    if (typeof window.viewChannel === 'function') { window.viewChannel(data.userId, true); }
                    break;

                case 'background':
                    $('body').css({ 'background-image': `url(${data.url})`, 'background-size': 'cover', 'background-position': 'center' });
                    break;

                case 'flickr_results_sync':
                    window.runFlickrSearch(data.query, data.photos, true);
                    break;

                case 'flickr_show_channels':
                    if (typeof window.showFavoritesPage === 'function') { window.showFavoritesPage(true); }
                    else { $('#flickr-results-grid, #categories-manager').hide(); $('#favorites-manager').show(); }
                    break;

                case 'flickr_show_categories':
                    window.showCategoriesPage(true);
                    break;

                case 'flickr_view_switch':
                    window.switchView(data.style, null, true);
                    $('.view-btn').removeClass('active').eq(data.style === 'compact' ? 0 : 1).addClass('active');
                    break;

                case 'flickr_loading_start':
                    $('#flickr-search').val(data.query);
                    $('#favorites-manager, #categories-manager, #flickr-results-grid').hide();
                    $('#flickr-loader').fadeIn(100);
                    break;

                case 'flickr_scroll': {
                    const $flickrGrid = $('#flickr-results-grid');
                    if ($flickrGrid.length) {
                        window.isSyncingScroll = true;
                        $flickrGrid.scrollTop(data.scrollTop);
                        setTimeout(() => { window.isSyncingScroll = false; }, 50);
                    }
                    break;
                }

                case 'radio_hash_change':
                    window.isRemoteAction = true;
                    window.location.hash = data.hash;
                    $('#radio-logo-active').attr('src',
                        `https://cdn.webrad.io/images/logos/radio-co-ma/${data.hash}.png`);
                    setTimeout(() => { window.isRemoteAction = false; }, 100);
                    break;
            }
        });

        // -------------------------------------------------------
        // mirror_ajax_nav — remote menu changes
        // -------------------------------------------------------
        socket.on('mirror_ajax_nav', function(data) {
            if (data.action === 'CLOSE') {
                closeSubMenu(true); 
            } else if (data.mode) {
                $('.status-bar').fadeOut(200);
                $('#theme-slider').fadeOut(200);
                $('#main-grid').hide();
                handleNav(data.mode, true); 
            }
        });

        // -------------------------------------------------------
        // mirror_nav — full page redirects
        // -------------------------------------------------------
        socket.on('mirror_nav', function(data) {
            if (data.route && !window.location.href.includes(data.route)) {
                setTimeout(() => { 
                    window.location.href = data.route; 
                }, 150);
            }
        });

        // -------------------------------------------------------
        // TuneRadio — sync radio station
        // -------------------------------------------------------
        socket.on('TuneRadio', function(data) {
            console.log("Room Sync: Tuning to " + data.name);

            const $display = $('#station_display');
            if ($display.length > 0) {
                $display.fadeOut(200, function() {
                    $(this).text(data.name).fadeIn(200);
                });
            }

            const syncRoute = `radios/radio_player?stream=${encodeURIComponent(data.stream)}&name=${encodeURIComponent(data.name)}`;
            handleNav(syncRoute, true);
        });

        // -------------------------------------------------------
        // force_stop_radio
        // -------------------------------------------------------
        socket.on('force_stop_radio', function() {
            console.log("Global Stop received: Killing all audio tags.");
            $('iframe[src*="muses"], audio, object, embed').remove();
            $('#radio_glass').empty().html('<div id="muses_target"></div>');
            $('#station_display').text("Station Stopped");
        });

        // -------------------------------------------------------
        // openPage — triggered by remote video click
        // -------------------------------------------------------
        socket.on('openPage', function(fullRoute) {
            console.log("Global Nav Triggered:", fullRoute);
            handleNav(fullRoute, true);
        });

    } else {
        console.error("Socket.io not found. Check script order in your EJS header.");
    }
});