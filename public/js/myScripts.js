// ===============================
// GLOBAL CONFIG
// ===============================
const params = new URLSearchParams(window.location.search);
window.myRoom = params.get('room') || window.__ROOM__ || 'Lobby';

// Pass room in handshake so socket.js knows which room to join
window.socket = io({ 
    query: { 
        room: window.myRoom,
        // If window.isRemoteAction is true, they are a viewer. If not, they are the controller.
        isController: (typeof window.isRemoteAction !== 'undefined') ? !window.isRemoteAction : true
    } 
});
window.isRemoteAction = false;



// Função para entrar numa sala específica (ex: 'Global')
function joinGlobalRoom() {
    const newRoom = 'Global_Public';
    window.myRoom = newRoom;
    socket.emit('switch_room', { room: newRoom });
    const newUrl = window.location.origin + '/?room=' + newRoom;
    window.history.pushState({ path: newUrl }, '', newUrl);
    alert("Entraste na Sala Global!");
}

// Função para partilhar a tua sala atual
function shareMyRoom() {
    const shareLink = window.location.origin + '/?room=' + encodeURIComponent(window.myRoom);
    navigator.clipboard.writeText(shareLink).then(() => {
        alert("Link da tua sala copiado! Envia a outros espectadores para eles sincronizarem contigo.");
    });
}


// Add this to your main JS file
// In your global script (main.js)
window.showLoader = function() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'flex';
};

window.hideLoader = function() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
};
// ===============================
// UNIFIED NAV CONFIG
// ===============================
const NAV_CONFIG = {

    // --- AJAX MENUS (Fragments) ---
    menus: {
        'radios': '/radios/radios-menu',
        'inter-radio': '/radios/inter-radio',
        'sl-radio': '/radios/sl-radio',
        'music': '/music-menu',
        'music-grid': '/music-grid',
        'movies': '/movies-menu',
        'sl-destinations': '/sl-destinations',
        'flickr': '/flickr',
        'flickr-erotic': '/flickr-erotic',
        'flickr-grid': '/flickr-grid',
        'youtube': '/youtube-menu',
        'settings': '/settings',
        'tvytube': '/tvytube',
        'erotic': '/erotic-grid',        // Add this
        'erotic-grid': '/erotic-grid',   // Add this for safety
        'xxx': '/xxx-check',
        'xxx-index': '/xxx-index',
        'xvideos': '/xvideos-grid',
        'get-xxx-stream': '/get-xxx-stream',
        'xxx-player': '/xxx-player',
        'ytmusic_player': '/music/ytmusic',
        'browsers': '/browsers',
        'game-stream': '/game-stream',
        'stream-cam': '/stream-cam-page',
        'live-tv': '/live-tv',
        'games': '/games-menu',
        'quiz': '/quiz',
        'truth-or-myth': '/truth-or-myth',
        'who-am-i': '/who-am-i',
        'this-or-that': '/this-or-that',
                'slither-io': '/slither-io',
        'freebies': '/freebies',
        'help': '/help',
        'clip-games': '/clip-games',
        'tv-clip-games': '/tv-clip-games',
        'watch-together': '/watch-together-menu',
        'art-gallery': '/art-gallery',
        'art-menu': '/art-menu',
        'eporner':'/eporner-grid',
         'eporner-player':'/eporner-player',
         'eporner-player':'/eporner-player',
         '/spankbang-grid':'/spankbang-grid',

    },

    // --- RADIO ROOT (Redirect Logic) ---
    radioRoot: {
        'inter': 'inter-radio',
        'sl': 'sl-radio' 
    },




};





// ===============================
// UTILITY FUNCTIONS
// ===============================
function cleanURL(path) {
    try {
        let url = new URL(path, window.location.origin);
        // Preserva o que já lá está (como ?source=met) e apenas garante a room
        if (typeof myRoom !== 'undefined' && myRoom) {
            url.searchParams.set('room', myRoom); // .set evita duplicados
        }
        return url.pathname + url.search;
    } catch (e) {
        // Fallback simples se o path for relativo
        if (typeof myRoom !== 'undefined' && myRoom) {
            const separator = path.includes('?') ? '&' : '?';
            return path.includes('room=') ? path : path + separator + "room=" + myRoom;
        }
        return path;
    }
}

$(document).ready(function() {
    // 1. Aplicar contraste guardado
    if (localStorage.getItem("text_contrast") === "dark") {
        $('body').addClass('dark-text');
    }

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const roomId = window.myRoom; // ID da TV definido no Global Config

    // EXCEPÇÃO PARA MODO DEVELOPER
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.warn("Dev Mode: Ignorando validações de segurança.");
        return;
    }

    // --- LÓGICA DE ACESSO: STATUS -> TOKEN ---

    // Passo 1: Verificar se a TV já está online no registro de memória
    $.get(`/check-status/${roomId}`)
        .done(function(data) {
            if (data.online) {
                // A TV já está a funcionar. Acesso total como Viewer.
                console.log("✅ Acesso concedido: TV está Online.");
                
                // Limpamos o token do URL para segurança e estética, mantendo a room
                if (token) {
                    window.history.replaceState({}, '', `/?room=${roomId}`);
                }
            } 
            else {
                // Passo 2: TV não está online. Precisamos obrigatoriamente de um token.
                console.log("⚠️ TV não detectada como Online. Verificando token...");

                if (!token) {
                    // Sem TV online e sem token no URL = Bloqueio
                    console.error("❌ Acesso negado: TV offline e nenhum token fornecido.");
                    window.location.href = '/access-denied';
                } else {
                    // Tentar validar o token que veio no URL
                    $.get(`/validate-token?token=${token}`)
                        .done(function(valData) {
                            if (valData.valid) {
                                console.log("✅ Token validado! Bem-vindo, Owner.");
                                // Limpa o token para evitar reutilização acidental
                                window.history.replaceState({}, '', `/?room=${roomId}`);
                            } else {
                                console.error("❌ Token inválido ou expirado.");
                                window.location.href = '/access-denied';
                            }
                        })
                        .fail(function() {
                            window.location.href = '/access-denied';
                        });
                }
            }
        })
        .fail(function() {
            // Em caso de erro crítico no servidor
            console.error("Erro na comunicação com o servidor de validação.");
            window.location.href = '/access-denied';
        });
});


// ===============================
// CORE NAVIGATION FUNCTION
// ===============================
function handleNav(mode, isRemote = false) {

    if (!mode) return;
    window.killRadio();

    if (window.socket) {
        window.socket.off('Play').off('Pause');
    }

    // --- CORREÇÃO AQUI ---
    // 1. Extraímos o nome limpo (sem parâmetros)
    const cleanPath = mode.split('?')[0]; 
    
    // 2. Verificamos se existe no NAV_CONFIG (tentando com e sem barra)
    const isKnownMenu = !!NAV_CONFIG.menus[cleanPath] || 
                        !!NAV_CONFIG.menus[cleanPath.replace(/^\//, '')] || // tenta sem barra
                        !!Object.keys(NAV_CONFIG.menus).find(k => NAV_CONFIG.menus[k] === cleanPath || NAV_CONFIG.menus[k] === '/' + cleanPath);

    let isAjaxMenu = isKnownMenu || 
                     mode.includes('xxx') ||
                     mode.includes('clip-games') || // Força detecção para clip-games
                     mode.includes('tv-clip-games') || 
                     mode.includes('music/') ||  
                     mode.includes('movies/') || 
                     mode.includes('radios/') || 
                     mode.includes('tvytube') || 
                     mode.includes('ytmusic') || 
                     mode.includes('youtube') ||
                     mode.includes('slither-io') ||
                     mode.includes('-menu');

    let targetUrl = NAV_CONFIG.menus[mode] || mode;
    const finalUrl = cleanURL(targetUrl); 

    // 2. Sincronização com o Servidor
    if (!isRemote && window.socket && window.socket.connected) {
        window.socket.emit(isAjaxMenu ? 'mirror_ajax_nav' : 'mirror_nav', {
            mode: mode, 
            route: finalUrl,
            path: finalUrl,
            room: window.myRoom
        });

        if (!finalUrl.includes('tvytube')) {
            window.socket.emit('report_current_time', {
                videoId: null,
                time: 0,
                paused: true,
                room: window.myRoom
            });
        }
    }

    if (isAjaxMenu) {
        window.lastRadioUrl = targetUrl; 
        window.currentAjaxPath = targetUrl; 

        // --- NEW: UI CLEANUP FOR MAIN PAGE ELEMENTS ---
        $('.status-bar').fadeOut(200);
        $('#theme-slider').fadeOut(200);
        $('#burger-menu-btn').fadeOut(200); // Hide burger on sub-pages
        $('#controls').removeClass('active').fadeOut(200); // Close controls if open
        $('#room-indicator').fadeOut(200).addClass('hidden');
        // ----------------------------------------------

        if (window.ytPlayerInstance) {
            window.ytPlayerInstance.destroy(); 
            window.ytPlayerInstance = null;
        }

        window.socket.off('Play');
        window.socket.off('Pause');
        window.socket.off('Seek');

        $.get(finalUrl, function(data) {
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

    // Tell the server to trigger the global wipe out
    if (!isRemote && window.socket) {
        window.socket.emit('stop_radio_global');
    }


    if (!isRemote && window.socket && window.socket.connected) {
        window.socket.emit('report_current_time', { 
            videoId: null, 
            time: 0, 
            paused: true,
            room: window.myRoom
        });

        window.socket.emit('mirror_ajax_nav', { 
            action: 'CLOSE', 
            path: '/',
            room: window.myRoom
        });
    }

    // Clear any stuck animations on the burger before showing it
    $('#burger-menu-btn').stop(true, true);

    $('#sub-content-overlay').fadeOut(200, function() {
        $(this).html('').hide();
        
        // Show the main grid again
        $('#main-grid').show().css({'opacity': '1', 'transform': 'scale(1)'});
        
        // --- RESTORE UI ELEMENTS ---
        $('.status-bar').fadeIn(200);
        $('#burger-menu-btn').fadeIn(200); // Add this line!
        $('#room-indicator').removeClass('hidden').fadeIn(200);
        // Optional: If you want the theme slider to stay hidden 
        // until the burger is clicked, change this to .hide()
        $('#theme-slider').fadeOut(200); 
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
            return handleNav('/radios/radios-menu'); 
        }
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
const syncSelectors =
  '.main-genre-btn1, ' +
  '.chip, ' +
  '.list-row, ' +
  '.card, ' +
     '.close-menu-btn, ' +
     '.side-arrow, ' + // sl stations arrows
     '.ir-btn, ' + //inter radios contry selector
          '.ir-card, ' + //inter radios cards
     '.freebie-card, ' + //freebies cards
     '.layout-btn, ' + //freebies layout buttons
     '.ltv-nav-btn, ' + //freebies / live-tv back / menu
     '.ch-card, ' + // live-tv cards
     '.game-card, ' + // clip games cards
     '.search-btn, ' + // youtube search buttons
  '.btn, ' +
  '.video-card, ' +
  '.nav-btn-glass, ' +
  '.theme-thumb, ' +
  '.cat-item, ' +
  '.radio-card, ' +
  '.menu-item, ' +
  '.thumb-wrap, ' +
  '.flickr-card, ' +
  '.fav-chip, ' +
  '.btn-group, ' +
  '.feature-btn, ' +
  '.main-genre-btn1, ' +
  '.sub-btn-group, ' +
  '.tag-card, ' +
  '.action-btn, ' +
  '.fav-item';

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



function aplicarBackground(url) {
    $('body').css({
        'background-image': `url('${url}')`,
        'background-size': 'cover',
        'background-position': 'center',
        'background-attachment': 'fixed'
    });
}

// ===============================
// SCROLL SYNC (VERSÃO CORRIGIDA)
// ===============================
let scrollTimeout;

// Todos os seletores dentro de UMA única string
const globalScrollTargets = '#sl-main-scroll-area, #conteiner, .conteiner, #xxx-module, #grid-content, #yt-content-scroll,#flickr-results-grid,#content-wrapper';

$(document).on('scroll', globalScrollTargets, function() {
    // 1. Só envia se o socket existir e se não for um scroll vindo de fora (remote)
    if (window.socket && window.socket.connected && !window.isSyncing) { 
        
        const $el = $(this);
        // Descobrir qual o ID ou Classe do elemento que disparou o scroll
        const activeSelector = $el.attr('id') ? '#' + $el.attr('id') : '.conteiner';

        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            // Enviamos a posição em pixels (scrollTop)
            socket.emit('state_sync', {
                type: 'scroll',
                selector: activeSelector, // <-- Adicionamos isto para o outro saber ONDE rolar
                position: $el.scrollTop(),
                room: window.myRoom
            });
        }, 150); 
    }
});
// ===============================
// SOCKET INITIALIZATION
// ===============================
$(function() { 
    if (typeof io !== 'undefined') {


        // -------------------------------------------------------
        // force_sync_arrival — sync new arrival to lobby state
        // -------------------------------------------------------
let syncArrivalDone = false;
     

socket.on('gs_active_stream_detected', function(data) {
    // You can use a confirm dialog or a custom HTML popup
    const join = confirm("Someone is live streaming in this room! Would you like to join the Game Stream?");
    if (join) {
        handleNav('game-stream'); // This opens your game stream module automatically
    }
});


socket.on('force_sync_arrival', function(state) {
            if (syncArrivalDone) return;
            syncArrivalDone = true;
            console.log("--- SYNCING TO LOBBY STATE ---", state);

            // 1. SYNC BACKGROUND (Sempre atualiza o fundo)
            if (state.currentBg) {
                   // console.log("Aplicando fundo vindo do servidor:", state.currentBg);
                    aplicarBackground(state.currentBg);
                } else {
                    // Se o servidor não tem fundo definido, usa o local ou padrão
                    let localBG = localStorage.getItem("selectedBG");
                    if (localBG) {
                        aplicarBackground(localBG);
                        // Opcional: Avisar o servidor que este é o novo fundo da sala
                        socket.emit('change_bg', { url: localBG });
                    }
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
                    console.log("Already playing, seeking to:", state.videoTimestamp);
                    window.ytPlayerInstance.seekTo(state.videoTimestamp, true);
                    if (!state.isPaused) window.ytPlayerInstance.playVideo();
                    return;
                }

                const syncPath = `/tvytube?videoId=${state.videoId}`;
                window.syncTargetTime = state.videoTimestamp;
                window.syncIsPaused   = state.videoPaused;
                window.syncArrivalTime = Date.now();
                handleNav(syncPath, true);
                return;
            }

            // 4. SYNC RADIO (Se não houver vídeo nem menu impeditivo)
            let ind=state.radioDialIndex
            if (state.currentMode==="RADIO" ) {
               handleNav(`/radios/sl-radio?stream=${encodeURIComponent(state.radioStream)}&name=${encodeURIComponent(state.radioName || '')}`, true);
            }
        });

socket.on('room_switched', function(data) {
    window.myRoom = data.room;
    console.log('[Room] Switched to:', data.room);
});
        
// -------------------------------------------------------
// state_sync — SINGLE unified listener (was duplicated)
// -------------------------------------------------------
socket.on('state_sync', function(data) {
    
            switch (data.type) {


                case 'global_hover':
                // 1. Clear previous highlights
                    $('.remote-hover').removeClass('remote-hover');
                    
                // 2. Only add the class if it is explicitly an 'enter' event
                    if (data.state === 'enter') {
                        const $target = $(data.selector).eq(data.index);
                        if ($target.length > 0) {
                            $target.addClass('remote-hover');
                        }
                    }

    
    break;
                case 'new_results':
                document.getElementById('category-modal').style.display = 'none';
                        // Renderizar a lista exata que o host enviou
                        renderResults(data.results, data.category);
                    break;
                case 'input_focus': {
                    const $input = $(`#${data.id}`);
                    const isFocus = data.action === 'focus';
                    $input.toggleClass('remote-focus', isFocus);
                    $input.attr('placeholder', isFocus ? 'Remote user typing...' : 'Search...');
                    break;
                }

                case 'yt_cat_modal': {
                    const $modal = $('#yt-cat-modal-new'); // Added '-new'
                    if ($modal.length) {
                        window.isRemoteAction = true;
                        $modal.css('display', data.show ? 'flex' : 'none');
                        
                        // IMPORTANT: If opening, we must trigger the render function
                        if (data.show && typeof renderCategories === 'function') {
                            renderCategories();
                        }
                        
                        setTimeout(() => { window.isRemoteAction = false; }, 100);
                    }
                    break;
                }

                case 'yt_fav_modal': {
                    const $modal = $('#yt-fav-modal-new'); // Added '-new'
                    if ($modal.length) {
                        window.isRemoteAction = true;
                        $modal.css('display', data.show ? 'flex' : 'none');
                        
                        // IMPORTANT: If opening, we must trigger the render function
                        if (data.show && typeof renderFavorites === 'function') {
                            renderFavorites();
                        }
                        
                        setTimeout(() => { window.isRemoteAction = false; }, 100);
                    }
                    break;
                }
  
                case 'xxx_modal': {
                    const $modal = $('#xxx-cat-modal');
                    if ($modal.length) {
                        console.log("Recebendo comando remoto para XXX Modal:", data.show);
                        window.isRemoteAction = true;
                        
                        // Ativa ou esconde o modal para o outro espectador
                        $modal.css('display', data.show ? 'flex' : 'none');
                        
                        // Se estiver abrindo, garante que a interface interna esteja pronta
                        if (data.show && typeof initInterface === 'function') {
                            initInterface();
                        }
                        
                        setTimeout(() => { window.isRemoteAction = false; }, 100);
                    }
                    break;
                }
                case 'scroll': {
                    const $scrollTarget = $('#channel-list-target').length ? $('#channel-list-target') : // Add this line
                                        $('#grid-content').length        ? $('#grid-content') :
                                        $('#yt-content-scroll').length   ? $('#yt-content-scroll') :
                                        $('#xxx-module').length          ? $('#xxx-module') :
                                        $('#flickr-results-grid').length ? $('#flickr-results-grid') :
                                        $('#content-wrapper').length     ? $('#content-wrapper') :
                                        $('#conteiner');

                    if ($scrollTarget.length > 0) {
                        window.isSyncing = true;
                        $scrollTarget.scrollTop(data.position);
                        setTimeout(() => { window.isSyncing = false; }, 100);
                    }
                    break;
                }
////////////////////////////
// FLICKR CASES
                case 'start_slideshow': //flickr slideshow start
                    if (typeof window.startSlideshow === 'function') {
                        window.startSlideshow(data.index, true);
                    } else {
                        $('#flickr-main-ui').hide();
                        $('#flickr-lightbox').fadeIn(200).css('display', 'flex');
                    }
                    break;

                case 'exit_slideshow': // flickr exit slideshow
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

                case 'flickr_close_categories':
                    window.closeCategoriesPage(true); // Executa remotamente sem ecoar de volta
                    break;

                case 'flickr_close_channels':
                    window.closeFavoritesPage(true);  // Executa remotamente sem ecoar de volta
                    break;
                             
                case 'flickr_channel_sync':
                if (typeof window.viewChannel === 'function') { window.viewChannel(data.userId, true); }
                break;

                case 'flickr_album_sync':
                    window.loadAlbumPhotos(data.photosetId, data.userId, true);
                break;

                case 'flickr_show_albums_modal':
                    window.viewUserAlbums(data.userId, true);
                break;
                
                case 'flickr_group_sync':
                    window.viewGroup(data.groupId, true); // True to avoid feedback loop
                    break;
                
                case 'flickr_results_sync':
                    window.runFlickrSearch(data.query, data.photos, true);
                    break;

                case 'flickr_show_channels':
                    const mode = data.mode || 'sl'; // Use the mode from the socket, or default to 'sl'
                    window.showFavoritesPage(mode, true);
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

                case 'flickr_layout_change':
                   // Alguém mudou o layout! Vamos mudar o nosso também.
                    window.changeLayout(data.layoutType, null, true);
                    break;    
 // FLICKR CASES END
/////////////////////////// 
                case 'background':
                    $('body').css({ 'background-image': `url(${data.url})`, 'background-size': 'cover', 'background-position': 'center' });
                    break;

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
// Locate this block near the bottom of your file
socket.on('mirror_ajax_nav', function(data) {
    if (data.action === 'CLOSE') {
        closeSubMenu(true); 
        $('#burger-menu-btn').fadeIn(200);
        $('.status-bar').fadeIn(200);
        // ADICIONE ESTA LINHA:
        $('#room-indicator').removeClass('hidden').fadeIn(200);
    } else if (data.mode) {
        $('.status-bar').fadeOut(200);
        $('#theme-slider').fadeOut(200);
        $('#burger-menu-btn').fadeOut(200);
        // ADICIONE ESTA LINHA:
        $('#room-indicator').fadeOut(200).addClass('hidden');
        
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
///////////////////////////////////
// Inside your socket listener block in myScripts.js
// This tells all clients: "When the server says 'UpdateRadioGrid', run the load function"
window.socket.on('UpdateRadioGrid', function(data) {
    if (typeof window.irExecuteLoad === 'function') {
        window.irExecuteLoad(data.type, data.value, data.label);
    }
});
// Add this inside your window.socket.on block
window.socket.on('UpdateRadioBack', () => {
    window.irShowMenu();
});


        // -------------------------------------------------------
        // openPage — triggered by remote video click
        // -------------------------------------------------------
        socket.on('openPage', function(fullRoute) {
            console.log("Global Nav Triggered:", fullRoute);
            handleNav(fullRoute, true);
        });

        // ── GAME STREAM — viewer toast ────────────────────────
        socket.on('gs_stream_started', function() {
            if (typeof window.gsToastShow === 'function') window.gsToastShow();
        });
        socket.on('gs_stream_stopped', function() {
            if (typeof window.gsToastDismiss === 'function') window.gsToastDismiss();
        });
        socket.on('gs_streamer_left', function() {
            if (typeof window.gsToastDismiss === 'function') window.gsToastDismiss();
        });

    } else {
        console.error("Socket.io not found. Check script order in your EJS header.");
    }
});