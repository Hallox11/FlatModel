// ===============================
// GLOBAL CONFIG
// ===============================
var socket;


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
        'xxx': '/xxx-check',
        'ytmusic_player': '/music/ytmusic',
        'browsers': '/browsers', // The route that renders browsers.ejs
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
        'concerts': 'concerts&mix',
        'full': 'UCXynnXkWjVqGgZo02vCfl9g&user',
        'blues': 'UCYY_YLVWFI_IZ51Eu6x9bgA&user',
        'blues_list': 'UCYY_YLVWFI_IZ51Eu6x9bgA&list',
        'jazz': 'UCNJFXYXkXt_P8bJUxb21MpA&user',
        'jazz_list': 'UCNJFXYXkXt_P8bJUxb21MpA&list',
        'classic': 'UC68KnvCZ-nJzmmuSu_tKASA&user',
        'classic_list': 'UC68KnvCZ-nJzmmuSu_tKASA&list',
        'relax': 'UCjzHeG1KWoonmf9d5KBvSiw&user',
        'relax_list': 'UCjzHeG1KWoonmf9d5KBvSiw&list',
        'slowrock': 'UC3CX2e-ej3wsG_nA4r4uykg&user',
        'love': 'UChR6kXdFtHNPNkIc5S17B2w&user',
        'rap': 'UCMu5gPmKp5av0QCAajKTMhw&user',
        'pmb': 'UCFm4zM6-08kb9abXDk4fxXQ&user',
        'pmb_list': 'UCFm4zM6-08kb9abXDk4fxXQ&list',
        'boiler': 'UCGBpxWJr9FNOcFYA5GkKrMg&user',
        'boiler_list': 'UCGBpxWJr9FNOcFYA5GkKrMg&list',
        'majestic': 'UCXIyz409s7bNWVcM-vjfdVA&user',
        'majestic_list': 'UCXIyz409s7bNWVcM-vjfdVA&list'
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
// CORE NAVIGATION FUNCTION
// ===============================
function handleNav(mode, isRemote = false) {
    if (!mode) return;

    // Check if it's a menu key or a direct ytmusic path
    let isAjaxMenu = !!NAV_CONFIG.menus[mode] || mode.includes('ytmusic');
    let targetUrl = NAV_CONFIG.menus[mode] || mode;

    // Build the final URL with the room for syncing
    const sep = targetUrl.includes('?') ? '&' : '?';
    const finalUrl = targetUrl + sep + 'room=' + myRoom;

    // Sync with other screens
    if (!isRemote && socket && socket.connected) {
        socket.emit(isAjaxMenu ? 'mirror_ajax_nav' : 'mirror_nav', {
            mode: mode, // Send the original mode/path
            route: finalUrl,
            room: myRoom
        });
    }

    if (isAjaxMenu) {
        // Show loading state
        $('#main-grid').css({'opacity': '0', 'transform': 'scale(0.95)'});
        
        $.get(targetUrl, function(data) {
            $('#main-grid').hide();
            $('#sub-content-overlay')
                .html(data)
                .css('display', 'flex')
                .hide()
                .fadeIn(300);
        });
    } else {
        // Full redirect only if it's NOT an AJAX target
        document.body.style.opacity = '0';
        setTimeout(() => { window.location.href = finalUrl; }, 150);
    }
}

function closeSubMenu() {
    $('#sub-content-overlay').fadeOut(200, function() {
        $(this).html('').hide();
        $('#main-grid').show().css({'opacity': '1', 'transform': 'scale(1)'});
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

// 1. ADD THIS: Handle external URLs directly
    if (type === "external") {
        return handleNav(mode); 
    }

    // --- AJAX MENU ---
    if (type === "menu") return handleNav(mode);

    // --- RADIO ROOT (Handles SL & Inter Lists) ---
    if (type === "radio-root") {
        let route = NAV_CONFIG.radioRoot[mode];
        let stream = $el.data('stream');
        let name = $el.data('name');

        if (route) {
            let target = (stream && name) 
                ? `./${route}_player?stream=${encodeURIComponent(stream)}&name=${encodeURIComponent(name)}`
                : route;
            return handleNav(target);
        }
    }

    // --- RADIO COUNTRY ---
    if (type === "radio") {
        let path = NAV_CONFIG.radio[mode];
        if (path) return handleNav(path);
    }

    // --- MUSIC & MOVIES ---
// NEW WAY (Triggers AJAX Overlay)
if (type === "music") {
    let ytParams = NAV_CONFIG.music[mode];
    if (ytParams) {
        // This path will now be caught by the 'isAjaxMenu' logic above
        return handleNav(`/music/ytmusic?${ytParams}`);
    }
}

    if (type === "movie") {
        let id = NAV_CONFIG.movies[mode];
        if (id) return handleNav(`./movies/ytmovies?${id}`);
    }
});

// ===============================
// SCROLL SYNC
// ===============================
$(document).on('scroll', '.conteiner', function() {
    if (socket && socket.connected) {
        socket.emit('state_sync', {
            type: 'scroll',
            position: $(this).scrollTop(),
            room: myRoom
        });
    }
});

// ===============================
// SOCKET INCOMING LISTENERS (The "Ears")
// ===============================
// ===============================
// SOCKET INITIALIZATION (The "Ears")
// ===============================
$(function() { 
    if (typeof io !== 'undefined') {
        // Initialize global socket
        socket = io(); 

        // Join the room as soon as connected
        socket.on('connect', () => {
            console.log("Socket connected! Joining room:", myRoom);
            socket.emit('join_room', myRoom);
        });

// --- THE SCROLL RECEIVER in myScripts.js ---
// Inside your socket block in myScripts.js
// Inside your socket block in myScripts.js
socket.on('state_sync', function(data) {

     
    if (data.type === 'scroll') {
        // 1. Log to confirm the viewer is actually 'hearing' the server
       // console.log("Viewer B received scroll:", data.position);

        // 2. Look for the container specifically within the overlay
        const $overlay = $('#sub-content-overlay');
        const $target = $overlay.find('#conteiner');
        
        if ($target.length > 0) {
            // 3. Apply the scroll
            // We use .stop() to prevent "lag" if many scroll events arrive at once
            $target.stop().scrollTop(data.position);
        } else {
           // console.warn("Scroll sync ignored: #conteiner not found in overlay.");
        }
    }
});

        // --- 2. AJAX MENU CHANGES ---
        socket.on('mirror_ajax_nav', function(data) {
            if (data.mode) {
                handleNav(data.mode, true); 
            }
        });

        // --- 3. FULL REDIRECTS ---
        socket.on('mirror_nav', function(data) {
            if (data.route && !window.location.href.includes(data.route)) {
                document.body.style.opacity = '0';
                setTimeout(() => { 
                    window.location.href = data.route; 
                }, 150);
            }
        });


        // Viewer B receives this when Viewer A clicks a video in the gallery
socket.on('openPage', function(fullRoute) {
    console.log("Global Nav Triggered:", fullRoute);
    // This uses your existing handleNav to swap the overlay content
    handleNav(fullRoute, true); 
});

// Sync Play/Pause for the global window.player object
socket.on('Play', function(time) {
    if (window.player && typeof window.player.playVideo === 'function') {
        window.player.seekTo(time, true);
        window.player.playVideo();
    }
});

socket.on('Pause', function(time) {
    if (window.player && typeof window.player.pauseVideo === 'function') {
        window.player.pauseVideo();
    }
});
        
    } else {
        console.error("Socket.io not found. Check script order in your EJS header.");
    }
});