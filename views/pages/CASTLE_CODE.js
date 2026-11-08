var ROOM = LCROOM
  , BASE = "https://look.slecastle.com/tv"
  , CID = Math.random().toString(36).slice(2, 10)
  , OFF = 0
  , S = null
  , rev = 0
  , P = null
  , ready = false
  , loaded = ""
  , metaSent = ""
  , lastSeek = 0
  , tapNeeded = false
  , started = 0
  , volSet = -1;
// the watch page starts with a tap: the browser lets it play with sound after one
var WGO = !W || EMB
  , lpz = false
  , bufAt2 = 0;
// sync tuning: jump only when clearly off; a screen that keeps missing (a slow viewer) gets a wider margin, not a jump storm
var TH = 1.2
  , MINGAP = 8000
  , LEAD = .3
  , seeks = []
  , ST = {
    seeks: 0,
    buf: 0,
    bufMs: 0,
    drift: 0,
    n: 0
}
  , bufAt = 0;
function $(i) {
    return document.getElementById(i);
}
function srv() {
    return Date.now() + OFF;
}
function sync(n) {
    var best = 1e9;
    (function one(k) {
        var t0 = Date.now();
        fetch(BASE + "/api/time", {
            cache: "no-store"
        }).then(function(r) {
            return r.json();
        }).then(function(j) {
            var t1 = Date.now()
              , rtt = t1 - t0;
            if (rtt < best) {
                best = rtt;
                OFF = j.now - (t0 + t1) / 2;
            }
            if (k > 1)
                setTimeout(function() {
                    one(k - 1);
                }, 150);
        }).catch(function() {});
    }
    )(n || 5);
}
sync(5);
setInterval(function() {
    sync(3);
}, 120000);
function expected() {
    if (!S || !S.cur || S.cur.photo)
        return 0;
    return S.cur.paused ? S.cur.pos : Math.max(0, (srv() - S.cur.start) / 1000);
}
function fmt(s) {
    s = Math.max(0, Math.floor(s || 0));
    var h = Math.floor(s / 3600)
      , m = Math.floor(s % 3600 / 60)
      , x = s % 60;
    return (h ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (x < 10 ? "0" : "") + x;
}
// the clock: each viewer's own time, or Second Life time (Pacific, from the server's clock) when the owner picked it
// the date in the screen's language (i18n.js): its own weekday and month names and order
var LOCS = {
    en: "en-GB",
    es: "es-ES",
    pt: "pt-BR",
    fr: "fr-FR",
    de: "de-DE",
    it: "it-IT",
    nl: "nl-NL",
    pl: "pl-PL",
    ru: "ru-RU",
    tr: "tr-TR",
    ja: "ja-JP",
    zh: "zh-CN"
};
function LOC() {
    return LOCS[window.LCI18N ? LCI18N.lang() : "en"] || "en-GB";
}
var WDN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  , MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function sltParts(t) {
    try {
        var o = {};
        new Intl.DateTimeFormat("en-GB",{
            timeZone: "America/Los_Angeles",
            hourCycle: "h23",
            hour: "2-digit",
            minute: "2-digit",
            weekday: "long",
            day: "numeric",
            month: "long"
        }).formatToParts(new Date(t)).forEach(function(x) {
            o[x.type] = x.value;
        });
        if (o.hour != null) {
            var ds = o.weekday + " " + o.day + " " + o.month;
            try {
                ds = new Intl.DateTimeFormat(LOC(),{
                    timeZone: "America/Los_Angeles",
                    weekday: "long",
                    day: "numeric",
                    month: "long"
                }).format(new Date(t));
            } catch (e) {}
            return {
                h: +o.hour % 24,
                m: +o.minute,
                ds: ds
            };
        }
    } catch (e) {}
    // no time zones in this browser: Pacific by the US rule (summer time from the 2nd Sunday of March to the 1st Sunday of November)
    var y = new Date(t).getUTCFullYear()
      , s1 = new Date(Date.UTC(y, 2, 1)).getUTCDay()
      , n1 = new Date(Date.UTC(y, 10, 1)).getUTCDay()
      , a = Date.UTC(y, 2, 1 + (7 - s1) % 7 + 7, 10)
      , b = Date.UTC(y, 10, 1 + (7 - n1) % 7, 9)
      , d = new Date(t + (t >= a && t < b ? -7 : -8) * 3600000);
    return {
        h: d.getUTCHours(),
        m: d.getUTCMinutes(),
        ds: WDN[d.getUTCDay()] + " " + d.getUTCDate() + " " + MON[d.getUTCMonth()]
    };
}
function clock() {
    var slt = !!(S && S.idle && S.idle.tz === "slt"), h, m, ds = "";
    if (slt) {
        var p = sltParts(Date.now() + OFF);
        h = p.h;
        m = p.m;
        ds = p.ds + " - Second Life time";
    } else {
        var d = new Date();
        h = d.getHours();
        m = d.getMinutes();
        try {
            ds = d.toLocaleDateString(LOC(), {
                weekday: "long",
                day: "numeric",
                month: "long"
            });
        } catch (e) {
            ds = WDN[d.getDay()] + " " + d.getDate() + " " + MON[d.getMonth()];
        }
    }
    $("clock").textContent = (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
    var hc = $("hclk");
    if (hc)
        hc.textContent = $("clock").textContent;
    $("date").textContent = ds;
}
clock();
setInterval(clock, 10000);
if (window.LCI18N)
    LCI18N.on(clock);
function nameOf(c) {
    return c ? c.title || (c.photo ? "Photo" : c.url ? "Video" : "YouTube video") : "";
}
function th(c, sz) {
    return c ? (/^u_/.test(c.id) ? BASE + "/th/" + c.id + ".jpg" : "https://i.ytimg.com/vi/" + c.id + "/" + (sz || "mqdefault") + ".jpg") : "";
}
var VER = "3f74c911af"
  , verGo = 0;
function poll() {
    fetch(BASE + "/api/st/" + ROOM + "?c=" + CID + (W ? "&w=1" : "") + (EMB ? "&cast=1" : "") + (rev ? "&r=" + rev : ""), {
        cache: "no-store"
    }).then(function(r) {
        return r.json();
    }).then(function(j) {
        if (j && j.ver && j.ver !== VER && !verGo) {
            verGo = setTimeout(function() {
                location.reload();
            }, 1000 + Math.random() * 6000);
        }
        if (j && j.rev) {
            S = j;
            rev = j.rev;
            if (MODE === "s" && window.LCI18N && !LCI18N.forced && (j.lang || "en") !== LCI18N.lang())
                LCI18N.set(j.lang || "en");
            demoTk();
            apply();
            if (UIon)
                uiDraw();
        }
        setTimeout(poll, 200);
    }).catch(function() {
        setTimeout(poll, 4000);
    });
}
var npHide = 0;
function card(show) {
    var c = $("np");
    if (!S || !S.cur || UIon) {
        c.className = "";
        return;
    }
    c.className = "on" + (S.cur.paused ? " paused" : "") + (S.cur.live ? " live" : "");
    clearTimeout(npHide);
    if (!S.cur.paused && !show)
        c.className = "";
    if (!S.cur.paused && show)
        npHide = setTimeout(function() {
            c.className = "";
        }, 8000);
}

// ---- the YouTube player (made when its API is ready, kept): t() seconds, st() 1 playing / 2 paused / 3 buffering /
// -1 not started / 0 ended, dur(), live(), play(), pause(), seek(s), vol(0..100), title(), kill()
var A = null;
var YTA = {
    k: "yt",
    rd: true,
    live: function() {
        try {
            return !!(P.getVideoData() || {}).isLive;
        } catch (e) {
            return false;
        }
    },
    t: function() {
        try {
            return P.getCurrentTime() || 0;
        } catch (e) {
            return 0;
        }
    },
    st: function() {
        try {
            return P.getPlayerState();
        } catch (e) {
            return -1;
        }
    },
    dur: function() {
        try {
            return P.getDuration() || 0;
        } catch (e) {
            return 0;
        }
    },
    play: function() {
        YC("p");
        try {
            P.playVideo();
        } catch (e) {}
    },
    pause: function() {
        YC("z");
        try {
            P.pauseVideo();
        } catch (e) {}
    },
    seek: function(s) {
        YC("s");
        try {
            P.seekTo(s, true);
        } catch (e) {}
    },
    vol: function(v) {
        try {
            if (v > 0) {
                P.unMute();
                P.setVolume(v);
            } else
                P.mute();
        } catch (e) {}
    },
    title: function() {
        try {
            return (P.getVideoData() || {}).title || "";
        } catch (e) {
            return "";
        }
    },
    kill: function() {
        try {
            P.stopVideo();
        } catch (e) {}
        $("pl").style.visibility = "hidden";
    }
};
// ---- A photo is displayed directly from its host, with no upload, player clock or auto-advance.
var PHOTO = $("photo")
  , photoError = "";
var PA = {
    k: "photo",
    rd: true,
    live: function() {
        return false;
    },
    t: function() {
        return 0;
    },
    st: function() {
        return PHOTO.complete && PHOTO.naturalWidth ? 1 : 3;
    },
    dur: function() {
        return 0;
    },
    play: function() {},
    pause: function() {},
    seek: function() {},
    vol: function() {},
    title: function() {
        return S && S.cur && S.cur.title || "Photo";
    },
    kill: function() {
        PHOTO.onload = PHOTO.onerror = null;
        PHOTO.style.display = "none";
        PHOTO.removeAttribute("src");
    }
};
function showPhoto(c) {
    var old = PHOTO;
    PHOTO = document.createElement("img");
    PHOTO.id = "photo";
    PHOTO.alt = c.title || "Photo";
    PHOTO.referrerPolicy = "no-referrer";
    old.parentNode.replaceChild(PHOTO, old);
    PHOTO.style.display = "block";
    photoError = "";
    PHOTO.onload = function() {
        if (S && S.cur && S.cur.id === c.id && S.cur.photo) {
            $("spin").style.display = "none";
        }
    }
    ;
    PHOTO.onerror = function() {
        if (!S || !S.cur || S.cur.id !== c.id || !S.cur.photo)
            return;
        photoError = c.id;
        $("spin").style.display = "none";
        $("errt").textContent = "That photo could not be loaded. Check that the link is public and still works.";
        $("err").style.display = "block";
    }
    ;
    PHOTO.src = c.url;
}
// ---- a video FILE (S.cur.url): the browser's own video element, the same calls as the YouTube one
var VD = $("vd")
  , VDE = 0
  , VDP = false;
var VA = {
    k: "vd",
    rd: true,
    live: function() {
        return false;
    },
    t: function() {
        return VD.currentTime || 0;
    },
    st: function() {
        if (!VD.src)
            return -1;
        if (VD.ended)
            return 0;
        if (VD.paused)
            return VDP ? 2 : -1;
        return VD.readyState < 3 ? 3 : 1;
    },
    dur: function() {
        var d = VD.duration;
        return isFinite(d) && d > 0 ? d : 0;
    },
    play: function() {
        VDP = true;
        var r = VD.play();
        if (r && r.catch)
            r.catch(function() {
                if (!tapNeeded && S && S.cur && !S.cur.paused) {
                    tapNeeded = true;
                    $("tap").style.display = "flex";
                }
            });
    },
    pause: function() {
        VD.pause();
    },
    seek: function(s) {
        try {
            VD.currentTime = Math.max(0, s);
        } catch (e) {}
    },
    vol: function(v) {
        VD.muted = v <= 0;
        VD.volume = Math.max(0, Math.min(1, v / 100));
    },
    title: function() {
        return "";
    },
    kill: function() {
        VDP = false;
        try {
            VD.pause();
        } catch (e) {}
        VD.removeAttribute("src");
        try {
            VD.load();
        } catch (e) {}
        VD.style.display = "none";
    }
};
VD.addEventListener("error", function() {
    if (!S || !S.cur || !S.cur.url || loaded !== S.cur.id || !VD.getAttribute("src"))
        return;
    var c = VD.error ? VD.error.code : 0;
    $("errb").textContent = "This video can't play here";
    $("errt").textContent = (c === 4 ? "Its file or format doesn't play in this browser." : "Its link stopped answering.") + (W ? "" : " Moving on to the next video.");
    $("err").style.display = "block";
    setTimeout(function() {
        $("err").style.display = "none";
    }, 6000);
    if (!W && Date.now() - VDE > 5000) {
        VDE = Date.now();
        post({
            id: S.cur.id,
            err: "f" + c,
            c: CID
        });
    }
});
VD.addEventListener("waiting", function() {
    bufAt = Date.now();
    ST.buf++;
});
VD.addEventListener("playing", function() {
    if (bufAt) {
        ST.bufMs += Date.now() - bufAt;
        bufAt = 0;
    }
    if (A === VA)
        drift(true);
});
// ---- the screen when nothing is on
var IDLE0 = {
    style: "clock",
    clock: 1,
    tz: "slt",
    text: "",
    pic: ""
}
  , iRAF = 0
  , iT0 = 0
  , iLast = 0
  , iStars = null
  , iNeb = null
  , iHor = null
  , IANIM = {
    aurora: 1,
    stars: 1,
    waves: 1,
    nebula: 1,
    lava: 1,
    horizon: 1,
    silk: 1
};
function idleOf() {
    return (S && S.idle) || IDLE0;
}
function idleDraw() {
    var I = idleOf()
      , el = $("idle");
    clock();
    el.className = "st-" + I.style + (I.clock ? "" : " noclock") + (I.text ? " txt" : "");
    $("itext").textContent = I.text || "";
    var pc = $("ipic")
      , u = I.style === "picture" ? I.pic || "" : "";
    if (pc.getAttribute("data-u") !== u) {
        pc.setAttribute("data-u", u);
        pc.style.backgroundImage = u ? 'url("' + u.replace(/["\\()]/g, "") + '")' : "none";
    }
    iRun();
}
function iOn() {
    return $("idle").style.display !== "none" && !!IANIM[idleOf().style];
}
function iRun() {
    if (iOn()) {
        if (!iRAF) {
            iT0 = performance.now();
            iRAF = requestAnimationFrame(iFrame);
        }
    } else if (iRAF) {
        cancelAnimationFrame(iRAF);
        iRAF = 0;
    }
}
function iFrame(now) {
    iRAF = 0;
    if (!iOn())
        return;
    iRAF = requestAnimationFrame(iFrame);
    if (now - iLast < 40)
        return;
    iLast = now;
    var c = $("ican")
      , x = c.getContext("2d")
      , t = (now - iT0) / 1000
      , st = idleOf().style;
    if (st === "aurora")
        aurora(x, c.width, c.height, t);
    else if (st === "stars")
        stars(x, c.width, c.height);
    else if (st === "nebula")
        nebula(x, c.width, c.height, t);
    else if (st === "lava")
        lava(x, c.width, c.height, t);
    else if (st === "horizon")
        horizon(x, c.width, c.height, t);
    else if (st === "silk")
        silk(x, c.width, c.height, t);
    else
        waves(x, c.width, c.height, t);
    if (S && S.demo && iRAF) {
        cancelAnimationFrame(iRAF);
        iRAF = 0;
    }
}
// a demo TV: this one frame stays (LITE)
// slow coloured light, like the northern lights behind glass
function aurora(x, w, h, t) {
    x.globalCompositeOperation = "source-over";
    x.fillStyle = "#050507";
    x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = "lighter";
    var B = [[.24, .58, "64,170,190"], [.70, .38, "150,110,230"], [.50, .78, "220,225,235"], [.86, .72, "210,120,170"], [.14, .30, "90,140,255"]];
    for (var i = 0; i < B.length; i++) {
        var b = B[i]
          , cx = (b[0] + .13 * Math.sin(t * .07 + i * 1.7)) * w
          , cy = (b[1] + .11 * Math.cos(t * .05 + i * 2.3)) * h
          , r = (.40 + .08 * Math.sin(t * .09 + i)) * w
          , g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, "rgba(" + b[2] + ",.32)");
        g.addColorStop(.5, "rgba(" + b[2] + ",.10)");
        g.addColorStop(1, "rgba(" + b[2] + ",0)");
        x.fillStyle = g;
        x.fillRect(0, 0, w, h);
    }
    x.globalCompositeOperation = "source-over";
}
// stars coming slowly closer
function stars(x, w, h) {
    if (!iStars) {
        iStars = [];
        for (var i = 0; i < 220; i++)
            iStars.push([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * .98 + .02, Math.random() * 6.283]);
    }
    x.fillStyle = "#050507";
    x.fillRect(0, 0, w, h);
    var cx = w / 2
      , cy = h / 2;
    for (var j = 0; j < iStars.length; j++) {
        var s = iStars[j];
        s[2] -= .0016;
        if (s[2] <= .02) {
            s[0] = Math.random() * 2 - 1;
            s[1] = Math.random() * 2 - 1;
            s[2] = 1;
        }
        var k = .5 / s[2]
          , px = cx + s[0] * k * w * .5
          , py = cy + s[1] * k * h * .5;
        if (px < 0 || px > w || py < 0 || py > h) {
            s[2] = 1;
            continue;
        }
        var a = Math.min(1, (1 - s[2]) * 1.3) * (.65 + .35 * Math.sin(performance.now() / 500 + s[3]));
        x.fillStyle = "rgba(234,236,242," + a.toFixed(3) + ")";
        x.beginPath();
        x.arc(px, py, Math.max(.6, (1 - s[2]) * 2.2), 0, 6.283);
        x.fill();
    }
}
// platinum lines, a slow swell
function waves(x, w, h, t) {
    x.fillStyle = "#050507";
    x.fillRect(0, 0, w, h);
    x.lineWidth = 1.4;
    for (var j = 0; j < 7; j++) {
        var g = x.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, "rgba(217,218,223,0)");
        g.addColorStop(.5, "rgba(236,237,241," + (.12 + .06 * j).toFixed(2) + ")");
        g.addColorStop(1, "rgba(217,218,223,0)");
        x.strokeStyle = g;
        x.beginPath();
        for (var X = 0; X <= w; X += 8) {
            var y = h * .74 + Math.sin(X * .006 + t * .35 + j * .55) * (16 + j * 6) + Math.sin(X * .013 - t * .22 + j) * 8;
            if (X === 0)
                x.moveTo(X, y);
            else
                x.lineTo(X, y);
        }
        x.stroke();
    }
}
// a nebula: coloured gas clouds turning slowly round the middle, faint stars through them
function nebula(x, w, h, t) {
    x.globalCompositeOperation = "source-over";
    x.fillStyle = "#05040b";
    x.fillRect(0, 0, w, h);
    if (!iNeb) {
        iNeb = [];
        for (var n = 0; n < 130; n++)
            iNeb.push([Math.random(), Math.random(), Math.random() * .9 + .1, Math.random() * 6.283]);
    }
    x.globalCompositeOperation = "lighter";
    var C = [[.30, .42, .34, "190,60,170"], [.66, .56, .38, "40,160,190"], [.52, .30, .30, "90,80,230"], [.42, .70, .26, "230,120,90"], [.78, .30, .24, "150,70,210"]]
      , a = t * .012;
    for (var i = 0; i < C.length; i++) {
        var c = C[i]
          , dx = c[0] - .5
          , dy = c[1] - .5
          , ca = Math.cos(a + i * .4)
          , sa = Math.sin(a + i * .4)
          , cx = (.5 + dx * ca - dy * sa * .6) * w
          , cy = (.5 + dx * sa * .5 + dy * ca) * h
          , r = (c[2] + .05 * Math.sin(t * .11 + i * 1.9)) * w
          , g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, "rgba(" + c[3] + ",.38)");
        g.addColorStop(.45, "rgba(" + c[3] + ",.15)");
        g.addColorStop(1, "rgba(" + c[3] + ",0)");
        x.fillStyle = g;
        x.fillRect(0, 0, w, h);
    }
    x.globalCompositeOperation = "source-over";
    for (var j = 0; j < iNeb.length; j++) {
        var s = iNeb[j]
          , k = s[2] * (.55 + .45 * Math.sin(t * 1.3 * s[2] + s[3]));
        x.fillStyle = "rgba(236,238,246," + (k * .8).toFixed(3) + ")";
        x.fillRect(s[0] * w, s[1] * h, s[2] > .8 ? 2 : 1.3, s[2] > .8 ? 2 : 1.3);
    }
}
// a lava lamp: warm blobs that rise and sink slowly, glowing where they meet
function lava(x, w, h, t) {
    x.globalCompositeOperation = "source-over";
    var bg = x.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#0c0410");
    bg.addColorStop(1, "#1d0812");
    x.fillStyle = bg;
    x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = "lighter";
    var B = [[.18, .11, 52, "255,150,70"], [.36, .14, 64, "250,95,85"], [.55, .10, 46, "255,120,60"], [.72, .13, 58, "240,80,120"], [.86, .09, 40, "255,170,90"], [.28, .08, 38, "250,110,100"], [.64, .12, 70, "255,135,75"]];
    for (var i = 0; i < B.length; i++) {
        var b = B[i]
          , ph = t * 6.283 / b[2] + i * 1.3
          , cx = (b[0] + .04 * Math.sin(ph * 1.7 + i)) * w
          , cy = (.55 - .42 * Math.sin(ph)) * h
          , r = b[1] * w * (1 + .12 * Math.sin(ph * 2.3))
          , g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, "rgba(" + b[3] + ",.80)");
        g.addColorStop(.55, "rgba(" + b[3] + ",.45)");
        g.addColorStop(.8, "rgba(" + b[3] + ",.10)");
        g.addColorStop(1, "rgba(" + b[3] + ",0)");
        x.fillStyle = g;
        x.beginPath();
        x.arc(cx, cy, r, 0, 6.283);
        x.fill();
    }
    var gl = x.createRadialGradient(w / 2, h * 1.15, 0, w / 2, h * 1.15, h * .8);
    gl.addColorStop(0, "rgba(255,120,60,.28)");
    gl.addColorStop(1, "rgba(255,120,60,0)");
    x.fillStyle = gl;
    x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = "source-over";
}
// a neon horizon: a striped sun going down behind a grid that runs towards you
function horizon(x, w, h, t) {
    x.globalCompositeOperation = "source-over";
    var hz = h * .72
      , sky = x.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, "#05040f");
    sky.addColorStop(.7, "#1a0830");
    sky.addColorStop(1, "#4a1048");
    x.fillStyle = sky;
    x.fillRect(0, 0, w, hz);
    x.fillStyle = "#07040e";
    x.fillRect(0, hz, w, h - hz);
    if (!iHor) {
        iHor = [];
        for (var n = 0; n < 70; n++)
            iHor.push([Math.random(), Math.random() * .6, Math.random() * 6.283]);
    }
    for (var j = 0; j < iHor.length; j++) {
        var s = iHor[j];
        x.fillStyle = "rgba(230,225,255," + (.25 + .25 * Math.sin(t * .9 + s[2])).toFixed(3) + ")";
        x.fillRect(s[0] * w, s[1] * hz, 1.4, 1.4);
    }
    var r = h * .17
      , sx = w / 2
      , sy = hz - r * .15
      , sg = x.createLinearGradient(0, sy - r, 0, sy + r);
    sg.addColorStop(0, "rgba(255,214,120,.62)");
    sg.addColorStop(.55, "rgba(255,90,150,.55)");
    sg.addColorStop(1, "rgba(200,40,170,.45)");
    x.save();
    x.beginPath();
    x.rect(0, 0, w, hz);
    x.clip();
    x.fillStyle = sg;
    x.beginPath();
    x.arc(sx, sy, r, 0, 6.283);
    x.fill();
    x.globalCompositeOperation = "destination-out";
    var off = (t * 6) % 14;
    for (var y = sy - r * .1 + off; y < sy + r; y += 14) {
        x.fillRect(sx - r, y, 2 * r, 2 + ((y - sy) / r) * 5);
    }
    x.restore();
    var hg = x.createLinearGradient(0, hz - 18, 0, hz + 18);
    hg.addColorStop(0, "rgba(255,60,160,0)");
    hg.addColorStop(.5, "rgba(255,80,170,.55)");
    hg.addColorStop(1, "rgba(255,60,160,0)");
    x.fillStyle = hg;
    x.fillRect(0, hz - 18, w, 36);
    x.lineWidth = 1.2;
    var p = (t * .35) % 1;
    for (var k = 0; k < 14; k++) {
        var z = k + 1 - p
          , yy = hz + (h - hz) * (1 / z) * .98;
        if (yy < hz + 1)
            continue;
        x.strokeStyle = "rgba(80,210,255," + Math.min(.6, .9 / z).toFixed(3) + ")";
        x.beginPath();
        x.moveTo(0, yy);
        x.lineTo(w, yy);
        x.stroke();
    }
    for (var v = -12; v <= 12; v++) {
        x.strokeStyle = "rgba(255,80,200,.38)";
        x.beginPath();
        x.moveTo(sx + v * w * .02, hz);
        x.lineTo(sx + v * w * .22, h);
        x.stroke();
    }
}
// silk: soft ribbons of colour flowing across the screen
function silk(x, w, h, t) {
    x.globalCompositeOperation = "source-over";
    x.fillStyle = "#050507";
    x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = "lighter";
    var R = [["40,180,200", "120,90,230"], ["150,80,220", "230,90,160"], ["60,120,240", "40,200,180"], ["230,110,150", "250,180,110"], ["110,90,230", "60,170,220"]];
    for (var i = 0; i < R.length; i++) {
        var g = x.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, "rgba(" + R[i][0] + ",0)");
        g.addColorStop(.3, "rgba(" + R[i][0] + ",.20)");
        g.addColorStop(.7, "rgba(" + R[i][1] + ",.20)");
        g.addColorStop(1, "rgba(" + R[i][1] + ",0)");
        var top = [], bot = [], X;
        for (X = 0; X <= w; X += 10) {
            var c = h * (.32 + .09 * i) + Math.sin(X * .004 + t * .16 + i * 1.1) * h * .12 + Math.sin(X * .0105 - t * .11 + i * 2.1) * h * .04
              , th = h * (.05 + .035 * Math.sin(X * .006 + t * .2 + i * 1.7));
            top.push(c - th);
            bot.push(c + th);
        }
        x.fillStyle = g;
        x.beginPath();
        x.moveTo(0, top[0]);
        for (X = 1; X < top.length; X++)
            x.lineTo(X * 10, top[X]);
        for (X = bot.length - 1; X >= 0; X--)
            x.lineTo(X * 10, bot[X]);
        x.closePath();
        x.fill();
        x.strokeStyle = g;
        x.lineWidth = 1;
        x.beginPath();
        x.moveTo(0, top[0]);
        for (X = 1; X < top.length; X++)
            x.lineTo(X * 10, top[X]);
        x.stroke();
    }
    x.globalCompositeOperation = "source-over";
}
// can this browser draw WebGL (three.js) - in the screen's report, to know what Second Life's browser can do
var GL = (function() {
    try {
        var c = document.createElement("canvas");
        return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
    } catch (e) {
        return false;
    }
}
)();
// which video files this browser plays (2026-10-16: video links - Second Life's browser may lack H.264): in the report
var CP = (function() {
    try {
        var v = document.createElement("video")
          , t = {
            h264: 'video/mp4; codecs="avc1.42E01E"',
            aac: 'audio/mp4; codecs="mp4a.40.2"',
            vp8: 'video/webm; codecs="vp8, vorbis"',
            vp9: 'video/webm; codecs="vp9, opus"',
            av1: 'video/mp4; codecs="av01.0.05M.08"',
            hls: 'application/vnd.apple.mpegurl'
        }
          , o = {};
        for (var k in t)
            o[k] = (v.canPlayType(t[k]) || "no").slice(0, 5);
        return o;
    } catch (e) {
        return {
            err: 1
        };
    }
}
)();

// the room on this screen: the player at the room's moment. A TV that plays another TV's channel is silent when the
// owner keeps the sound on that TV only (no echo in one room)
// embedded in the remote (Watch here): one volume - the remote's slider (the TV's); its own button only turns its sound on / off
// the demo TV: a guest's sound buttons and the number change the sound on their own screen only (owner 2026-10-17: "bireysel
// mute yapabilir isterse ama sadece ona kısılsın") - the TV plays on for everyone; kept in this viewer (tvd_vol)
var DV = 100
  , DV1 = 100;
try {
    var dv0 = localStorage.getItem("tvd_vol");
    if (dv0 != null && dv0 !== "")
        DV = Math.max(0, Math.min(100, +dv0 || 0));
} catch (e) {}
if (DV > 0)
    DV1 = DV;
function demoMine() {
    return !!(S && S.demo && !OWN && !W);
}
function demoVol(by, toggle) {
    if (toggle)
        DV = DV > 0 ? 0 : (DV1 || 100);
    else
        DV = Math.max(0, Math.min(100, DV + by));
    if (DV > 0)
        DV1 = DV;
    try {
        localStorage.setItem("tvd_vol", DV);
    } catch (e) {}
    volSet = -1;
    vol();
    uiDraw();
    toast(DV > 0 ? "Sound on your screen: " + DV + "% - only for you. The TV plays on for everyone." : "Muted on your screen only - the TV plays on for everyone. Tap the number for sound.", 3400);
}
function vol() {
    if (A === PA)
        return;
    var tv = S && S.vol != null ? S.vol : 100
      , v = EMB ? (WV > 0 ? tv : 0) : W ? WV : S && S.mute ? 0 : tv;
    if (demoMine())
        v = Math.round(v * DV / 100);
    if (!W && S && S.home)
        v = 0;
    if (A && (ready || A === VA) && v !== volSet) {
        volSet = v;
        A.vol(v);
    }
}
var IH0 = null;
// the DEMO TV's ticker (the TV's own screen only): built once, twice over so it loops without a seam, about 55 px a second
var DEMO_T = [["Watch together", "everyone near the TV sees the same moment"], ["YouTube and video links", "search YouTube, or paste a Gyazo, mp4, webm or Dropbox link"], ["Live 8-zone ambilight", "the wall behind the TV takes the colours of the picture"], ["Room lights", "Floor Lamp, Wall Bars and Orb Light follow the video"], ["Sync Speakers add-on", "a tower, a subwoofer and two soundbars light up and kick with the TV, sold apart"], ["Music pulse", "tap the beat and the neon lamps flash with it"], ["Sync TV picks", "ready lists and two Top 100s, new every day"], ["One remote, no menus", "the Remote HUD, a phone or a browser"], ["Watch on your phone", "share a link and friends watch along"], ["Your TV, your rules", "everyone, a PIN, your group or only you"], ["Your style", "3 models, 10 finishes, 55 to 200 inch"], ["No account, no password", "rez it, touch it, watch"], ["Touch the TV to try it", "everything works here"]];
// (2026-10-20) the demo TVs show no ticker any more: demoTk only marks them LITE
function demoTk() {
    var on = !W && !!S && !!S.demo;
    document.documentElement.classList.toggle("dlite", on);
    document.documentElement.classList.toggle("lq", on && !!S.lq);
}
// the DEMO TV: the A4 feature card, 12 s after the page opens, then 14 s on and 30 s off (owner asked every 10 s; with the
// ticker always running that covered the picture most of the time), the cards in turn (Sync TV, Ambilight, Speakers - each with
// its price on the Marketplace now: S.mp the TV, S.mps the speakers); only on the
// TV's own screen (not the phone / HUD watch page), never over the controls
var DEMO_I = {
    tv: '<rect x="5" y="8" width="38" height="26" rx="3"/><path d="M17 41h14M24 34v7"/><path d="M20.5 15.5l10 5.5-10 5.5z"/>',
    find: '<circle cx="21" cy="21" r="12.5"/><path d="M30.5 30.5L42 42"/>',
    picks: '<path d="M6 11h22M6 20h22M6 29h13M6 38h10"/><path d="M34.5 23l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z"/>',
    remote: '<rect x="15" y="4" width="18" height="40" rx="5"/><circle cx="24" cy="14" r="4"/><path d="M20 24.5h8M20 30.5h8M20 36.5h8"/>',
    size: '<rect x="4" y="8" width="40" height="27" rx="2.5"/><path d="M17 42h14M14 28.5l20-14M27.5 14h7v7M13.5 22v7h7"/>',
    glow: '<rect x="13" y="15" width="22" height="16" rx="2"/><path d="M24 4v6M24 36v6M3 23h6M39 23h6M8 7l4.5 4.5M35.5 34.5L40 39M40 7l-4.5 4.5M12.5 34.5L8 39"/>',
    lamps: '<rect x="8" y="4" width="7" height="31" rx="3.5"/><path d="M5 43h13M11.5 35v8"/><path d="M27 32a9.5 9.5 0 0 1 19 0z"/><path d="M28 32h17v5a4 4 0 0 1-4 4h-9a4 4 0 0 1-4-4z"/>',
    pulse: '<path d="M3 25h8l4-10 6 23 6-30 5 17h13"/>',
    lock: '<rect x="10" y="21" width="28" height="21" rx="3"/><path d="M16 21v-6a8 8 0 0 1 16 0v6"/><circle cx="24" cy="31.5" r="2.6"/>',
    phone: '<rect x="14" y="4" width="20" height="40" rx="4"/><path d="M21 17l8 5-8 5z"/><path d="M21 38h6"/>',
    spk: '<rect x="14" y="3" width="20" height="42" rx="5"/><circle cx="24" cy="14" r="5"/><circle cx="24" cy="31" r="7"/>',
    sub: '<rect x="6" y="6" width="36" height="36" rx="5"/><circle cx="24" cy="24" r="11"/><circle cx="24" cy="24" r="4"/>',
    bar: '<rect x="3" y="17" width="42" height="14" rx="4"/><circle cx="11" cy="24" r="2.6"/><circle cx="19" cy="24" r="2.6"/><circle cx="29" cy="24" r="2.6"/><circle cx="37" cy="24" r="2.6"/>',
    sound: '<rect x="4" y="10" width="28" height="20" rx="2.5"/><path d="M12 38h12M18 30v8"/><path d="M37 15a7 7 0 0 1 0 10M41.5 11a13 13 0 0 1 0 18"/>'
};
var DEMO_C = [["Sync TV", "A YouTube TV for Second Life", [["tv", "Watch together", "Everyone near the TV sees the same moment"], ["find", "YouTube and video links", "Search, or paste a Gyazo, mp4 or Dropbox link"], ["picks", "Sync TV picks", "Ready lists and two Top 100s, new every day"], ["remote", "One remote, no menus", "The Remote HUD, a phone or a browser"], ["size", "Your style", "3 models, 10 finishes, 55 to 200 inch"]], "mp", "on the Marketplace", "Touch the TV to try it"], ["Ambilight", "The room plays along", [["glow", "Live 8-zone glow", "The wall behind the TV takes the colours of the picture"], ["lamps", "Room lights", "Floor Lamp, Wall Bars and Orb Light follow the video"], ["pulse", "Music pulse", "Tap the beat and the neon lamps flash with it"], ["lock", "Your TV, your rules", "Everyone, a PIN, your group or only you"], ["phone", "Watch on your phone", "Share a link and friends watch along"]], "mp", "on the Marketplace", "Touch the TV to try it"], ["Speakers", "The add-on that moves with the picture", [["spk", "Sync Speaker", "A 1.07 m tower: 4 LED rings take its side of the picture"], ["sub", "Sync Subwoofer", "An 11-inch woofer with the biggest kick"], ["bar", "Two Soundbars", "For the console or the wall, 6 rings each"], ["pulse", "On the beat", "Rings flash and cones kick with Music pulse"], ["sound", "The sound stays in the TV", "The speakers show the music in light and motion"]], "mps", "add-on on the Marketplace", "Works with every Sync TV"]];
var demoN = 0
  , demoBusy = false;
function demoOff() {
    var d = $("demo");
    if (d)
        d.className = "";
    document.documentElement.classList.remove("demoon");
    demoBusy = false;
}
function demoRun() {
    var d = $("demo");
    if (!d || W || !S || !S.demo)
        return setTimeout(demoRun, 75000);
    if (UIon || demoBusy)
        return setTimeout(demoRun, 10000);
    var C = DEMO_C[demoN++ % DEMO_C.length]
      , M = S[C[3]];
    d.innerHTML = '<div class="dh"><span class="tag">DEMO</span><span class="lc">LECASTLE</span></div><h2></h2><div class="sb"></div><div class="rl"></div><div class="ls">' + C[2].map(function(x, i) {
        return '<div class="it" style="transition-delay:' + (0.35 + i * 0.14) + 's"><span class="ic"><svg viewBox="0 0 48 48">' + DEMO_I[x[0]] + '</svg></span><div><b></b><small></small></div></div>';
    }).join("") + '</div>' + (M && M.price ? '<div class="pr"><b>L$' + Number(M.price).toLocaleString("en-US") + '</b><span></span>' + (M.sale ? '<em>SALE</em>' : '') + '</div>' : '') + '<div class="ft"><i></i><span></span></div>';
    d.querySelector("h2").textContent = C[0];
    d.querySelector(".sb").textContent = C[1];
    d.querySelector(".ft span").textContent = C[5];
    if (M && M.price)
        d.querySelector(".pr span").textContent = C[4];
    [].forEach.call(d.querySelectorAll(".it"), function(e, i) {
        e.querySelector("b").textContent = C[2][i][1];
        e.querySelector("small").textContent = C[2][i][2];
    });
    demoBusy = true;
    document.documentElement.classList.add("demoon");
    void d.offsetWidth;
    d.className = "on";
    setTimeout(demoOff, 14000);
    setTimeout(demoRun, 44000);
}
// (2026-10-20) the feature card no longer runs on the demo TVs (demoRun is not started)
function apply() {
    homeApply();
    document.documentElement.classList.toggle("photo-on", !!(S && S.cur && S.cur.photo));
    $("nps").textContent = S && S.cur && S.cur.photo ? "Photo" : "Now playing";
    $("br").textContent = (S && S.name) || "Sync TV";
    wDraw();
    var cast = !!(S && S.cast && !W);
    if (IH0 === null)
        IH0 = $("ihint").textContent;
    $("ihint").textContent = cast ? "Playing on the owner's HUD now - it comes back here when they close it." : IH0;
    if (!S || !S.cur || cast) {
        $("idle").style.display = "block";
        idleDraw();
        $("tap").style.display = W && !WGO ? "flex" : "none";
        $("spin").style.display = "none";
        card(false);
        if (A) {
            A.kill();
            A = null;
        }
        VA.kill();
        PA.kill();
        loaded = "";
        return;
    }
    $("idle").style.display = "none";
    iRun();
    $("err").style.display = "none";
    var c = S.cur;
    if ($("npi").getAttribute("src") !== th(c))
        $("npi").src = th(c);
    $("npt").textContent = nameOf(c);
    if (c.photo) {
        $("tap").style.display = "none";
        tapNeeded = false;
        $("spin").style.display = "none";
        if (loaded !== c.id || A !== PA) {
            if (A)
                A.kill();
            VA.kill();
            A = PA;
            loaded = c.id;
            metaSent = c.id;
            volSet = -1;
            showPhoto(c);
            card(true);
        }
        if (photoError === c.id) {
            $("errt").textContent = "That photo could not be loaded. Check that the link is public and still works.";
            $("err").style.display = "block";
        }
        return;
    }
    if (A === PA) {
        PA.kill();
        A = null;
        loaded = "";
    }
    if (W && !WGO) {
        $("tap").style.display = "flex";
        return;
    }
    // a live stream paused and on again: made again, so it plays from now (its live edge)
    if (c.live && lpz && !c.paused && loaded === c.id)
        loaded = "";
    lpz = !!(c.live && c.paused);
    if (loaded !== c.id) {
        if (c.url) {
            if (A === YTA)
                YTA.kill();
            A = VA;
            volSet = -1;
            loaded = c.id;
            metaSent = "";
            started = Date.now();
            seeks = [];
            TH = 1.2;
            bufAt2 = 0;
            VD.style.display = "block";
            VD.src = c.url;
            var at = expected();
            VD.addEventListener("loadedmetadata", function once() {
                VD.removeEventListener("loadedmetadata", once);
                if (loaded !== c.id)
                    return;
                VA.seek(S.cur.paused ? S.cur.pos : expected() + .2);
                if (!S.cur.paused)
                    VA.play();
            }, {
                once: true
            });
            if (at < .5 && !c.paused)
                VA.play();
            vol();
            card(true);
            return;
        }
        if (!ready)
            return;
        if (A === VA)
            VA.kill();
        A = YTA;
        $("pl").style.visibility = "visible";
        volSet = -1;
        loaded = c.id;
        metaSent = "";
        started = Date.now();
        seeks = [];
        TH = 1.2;
        bufAt2 = 0;
        var o = {
            videoId: c.id
        };
        if (!c.live)
            o.startSeconds = expected();
        YC("l");
        P.loadVideoById(o);
        if (c.paused)
            setTimeout(function() {
                YTA.pause();
            }, 600);
        vol();
        card(true);
        return;
    }
    if (!A)
        return;
    vol();
    if (c.paused) {
        A.pause();
        if (!c.live && Math.abs(A.t() - c.pos) > .6)
            A.seek(c.pos);
        card(true);
    } // the Now playing card only when a video starts (owner 2026-10-18, a buyer: it came back every 10-20 s - every room update showed it again)
    else {
        if (A.st() !== 1)
            A.play();
        if ($("np").classList.contains("paused"))
            card(false);
        drift(true);
    }
}
function drift(force) {
    if (!A || !S || !S.cur || S.cur.photo || S.cur.paused || S.cur.live || loaded !== S.cur.id || (!ready && A !== VA))
        return;
    if (A.live())
        return;
    var st = A.st();
    if (st !== 1 && !force)
        return;
    var e = expected()
      , c = A.t()
      , d = c - e;
    // the room is past the end of the video (its length was never told, or the server was away): tell it, the server moves on - never jump past the end
    var pd = A.dur();
    if (pd > 0 && e > pd + 1) {
        if (!S.cur.dur)
            post({
                id: S.cur.id,
                dur: pd
            });
        return;
    }
    if (S.cur.dur && e > S.cur.dur)
        return;
    ST.drift += Math.abs(d);
    ST.n++;
    var t = Date.now();
    if (Math.abs(d) > TH && (force || t - lastSeek > MINGAP)) {
        lastSeek = t;
        seeks.push(t);
        seeks = seeks.filter(function(x) {
            return t - x < 60000;
        });
        if (seeks.length >= 3)
            TH = Math.min(5, TH * 1.6);
        ST.seeks++;
        A.seek(e + LEAD);
        setTimeout(learn, 2500);
    }
}
function learn() {
    if (!A || !S || !S.cur || S.cur.paused || S.cur.live || A.st() !== 1)
        return;
    var d = A.t() - expected();
    if (Math.abs(d) < 3)
        LEAD = Math.max(0, Math.min(1.5, LEAD - d * .6));
}
setInterval(function() {
    if (S && S.cur && S.cur.photo)
        return;
    if (S && S.cur) {
        var p = expected()
          , d = S.cur.dur || 0;
        $("npb").style.width = d ? Math.min(100, p / d * 100) + "%" : "0";
        var left = d ? d - p : 1e9
          , nx = S.q && S.q[0];
        if (nx && left < 20 && !S.cur.paused && !S.repeat && !UIon) {
            $("nxt").textContent = nameOf(nx);
            $("nx").className = "on";
        } else
            $("nx").className = "";
    }
    drift(false);
    if (W && !WGO)
        return;
    if (S && S.cur && !S.cur.url && !ready && !S.cur.paused && Date.now() - T0 > 8000 && !tapNeeded) {
        tapNeeded = true;
        $("tap").style.display = "flex";
    }
    if (!A || !S || !S.cur || loaded !== S.cur.id)
        return;
    var st = A.st();
    if (st === 3) {
        if (!bufAt2)
            bufAt2 = Date.now();
    } else
        bufAt2 = 0;
    $("spin").style.display = (bufAt2 && Date.now() - bufAt2 > 900) ? "block" : "none";
    if (!S.cur.paused && Date.now() - started > 3500 && (st === -1 || st === 5 || st === 2 || (bufAt2 && Date.now() - bufAt2 > 6000)) && !tapNeeded) {
        tapNeeded = true;
        $("tap").style.display = "flex";
    }
    if (st === 1 && tapNeeded) {
        tapNeeded = false;
        $("tap").style.display = "none";
    }
    // the length, the title, or that it is live: YouTube and the others tell these only to their player
    if (metaSent !== S.cur.id && st === 1) {
        if (A.live()) {
            metaSent = S.cur.id;
            if (!S.cur.live)
                post({
                    id: S.cur.id,
                    live: 1
                });
        } else {
            var dd = A.dur()
              , t = A.title();
            if (dd > 0) {
                metaSent = S.cur.id;
                post({
                    id: S.cur.id,
                    dur: dd,
                    title: t
                });
            }
        }
    }
}, 1000);
function post(o) {
    fetch(BASE + "/api/meta/" + ROOM, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(o)
    }).catch(function() {});
}
// how this screen is doing (the server keeps the last reports per room, to tune the sync)
setInterval(function() {
    if (W || !S || !S.cur || S.cur.photo || S.cur.paused || !A)
        return;
    post({
        id: S.cur.id,
        stats: {
            seeks: ST.seeks,
            buf: ST.buf,
            bufMs: ST.bufMs,
            drift: ST.n ? +(ST.drift / ST.n).toFixed(2) : 0,
            th: TH,
            lead: +LEAD.toFixed(2),
            q: (P && P.getPlaybackQuality && P.getPlaybackQuality()) || "",
            ua: navigator.userAgent.slice(0, 120),
            c: CID
        }
    });
    ST = {
        seeks: 0,
        buf: 0,
        bufMs: 0,
        drift: 0,
        n: 0
    };
}, 30000);
$("tap").onclick = function() {
    tapNeeded = false;
    $("tap").style.display = "none";
    if (!WGO) {
        WGO = true;
        apply();
        if (A && (A.k === "vd" || ready))
            A.play();
        return;
    }
    if (S && S.cur && !S.cur.url && !ready) {
        remakes = 0;
        makePlayer();
        return;
    }
    if (A) {
        A.play();
        if (S && S.cur && !S.cur.live)
            A.seek(expected() + LEAD);
    }
}
;
function onErr(e) {
    if (!S || !S.cur)
        return;
    var c = e.data
      , msg = (c === 101 || c === 150) ? "Its owner doesn't allow it outside YouTube." : c === 100 ? "It was removed or made private." : "YouTube refused to play it here.";
    $("errt").textContent = msg + (W ? "" : " Moving on to the next video.");
    $("err").style.display = "block";
    setTimeout(function() {
        $("err").style.display = "none";
    }, 6000);
    if (!W)
        post({
            id: S.cur.id,
            err: c,
            c: CID
        });
}
var T0 = Date.now()
  , madeAt = 0
  , remakes = 0
  , apiAt = 0;
window.onYouTubeIframeAPIReady = function() {
    apiAt = Date.now();
    makePlayer();
}
;
// a player that never says ready (seen in the Second Life viewer): thrown away and made again, at most 3 times
function makePlayer() {
    madeAt = Date.now();
    ready = false;
    A = null;
    loaded = "";
    if (P) {
        try {
            P.destroy();
        } catch (e) {}
        P = null;
        var pl = $("pl");
        if (!$("yt")) {
            var d = document.createElement("div");
            d.id = "yt";
            pl.insertBefore(d, pl.firstChild);
        }
    }
    // Keep source quality adaptive: no fixed-resolution requests; selection belongs to YouTube.
    P = new YT.Player("yt",{
        width: "100%",
        height: "100%",
        playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            origin: location.origin
        },
        events: {
            onReady: function() {
                ready = true;
                volSet = -1;
                apply();
            },
            onError: onErr,
            onStateChange: function(ev) {
                if (ev.data === 3) {
                    bufAt = Date.now();
                    ST.buf++;
                } else if (bufAt) {
                    ST.bufMs += Date.now() - bufAt;
                    bufAt = 0;
                }
                YC(String(ev.data));
                if (ev.data === 1 && A === YTA)
                    drift(true);
            }
        }
    });
}
setInterval(function() {
    if (!ready && P && madeAt && Date.now() - madeAt > 10000 && remakes < 3) {
        remakes++;
        makePlayer();
    }
}, 2000);
// how this screen is (also before the player is ready): to the server's log, to see what a viewer does
function diag() {
    if (W)
        return;
    var st = -9;
    try {
        st = A ? A.st() : P && P.getPlayerState ? P.getPlayerState() : -8;
    } catch (e) {}
    post({
        id: S && S.cur ? S.cur.id : "",
        diag: {
            env: ENV,
            ready: ready,
            gl: GL,
            st: st,
            t: +(A ? A.t() : 0).toFixed(1),
            api: typeof YT !== "undefined" && !!YT.Player,
            apiMs: apiAt ? apiAt - T0 : -1,
            remakes: remakes,
            tap: tapNeeded,
            vis: document.visibilityState,
            up: Math.round((Date.now() - T0) / 1000),
            cp: CP,
            ua: navigator.userAgent.slice(0, 140),
            c: CID
        }
    });
}
// (2026-10-18) YouTube's own play / pause button stays on some screens in Second Life: what this browser is like there - the
// YouTube frame seen as on screen or not (a hidden cross-origin frame gets its timers slowed), timers, animation frames, sizes
var ENV = {}
  , YCL = [];
function YC(k) {
    if (!YCL)
        return;
    var t = Math.round((Date.now() - T0) / 1000);
    YCL.push(t + k);
    while (YCL.length && t - parseInt(YCL[0], 10) > 120)
        YCL.shift();
    ENV.yc = YCL.slice(-20).join(" ");
}
(function() {
    try {
        var f = document.querySelector("#pl iframe");
        ENV.ow = outerWidth + "x" + outerHeight;
        ENV.sc = screen.width + "x" + screen.height;
        ENV.dpr = devicePixelRatio;
        ENV.foc = document.hasFocus();
        ENV.mm = ["(hover:hover)", "(pointer:fine)", "(pointer:coarse)", "(prefers-reduced-motion:reduce)"].map(function(q) {
            return matchMedia(q).matches ? 1 : 0;
        }).join("");
        ENV.tp = navigator.maxTouchPoints;
        ENV.ua2 = navigator.userAgent.slice(120, 260);
        var n = 0
          , t0 = performance.now();
        (function rf() {
            n++;
            if (performance.now() - t0 < 1000)
                requestAnimationFrame(rf);
            else
                ENV.raf = n;
        }
        )();
        var s0 = Date.now();
        setTimeout(function() {
            ENV.to = Date.now() - s0;
        }, 1000);
        if (window.IntersectionObserver) {
            var io = new IntersectionObserver(function(es) {
                var e = es[es.length - 1];
                ENV.io = (e.isIntersecting ? 1 : 0) + "/" + e.intersectionRatio.toFixed(2);
            }
            );
            setTimeout(function() {
                var g = document.querySelector("#pl iframe");
                if (g)
                    io.observe(g);
            }, 3000);
        }
    } catch (e) {
        ENV.err = String(e).slice(0, 60);
    }
}
)();
setTimeout(diag, 6000);
setTimeout(diag, 20000);
setInterval(diag, 60000);

// ---- the watch page: the screen fitted to the window, its own volume, full screen
var WV = 100;
try {
    var wv0 = localStorage.getItem("tvw_vol");
    if (wv0 != null && wv0 !== "")
        WV = Math.max(0, Math.min(100, +wv0 || 0));
    else if (EMB)
        WV = 0;
} catch (e) {
    if (EMB)
        WV = 0;
}
var WV1 = WV || 100;
var ICW = {
    on: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 10v4h4l5 4V6L8 10z" fill="currentColor" stroke="none"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    off: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 10v4h4l5 4V6L8 10z" fill="currentColor" stroke="none"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/></svg>'
};
function fit() {
    if (!W)
        return;
    var b = $("box")
      , w = b.clientWidth
      , h = b.clientHeight
      , k = Math.min(w / 910, h / 512);
    $("stage").style.transform = "translate(" + ((w - 910 * k) / 2) + "px," + ((h - 512 * k) / 2) + "px) scale(" + k + ")";
}
function wVol(v, keep) {
    WV = Math.max(0, Math.min(100, Math.round(v)));
    if (WV > 0)
        WV1 = WV;
    try {
        localStorage.setItem("tvw_vol", WV);
    } catch (e) {}
    if (!keep) {
        $("wvr").value = WV;
    }
    $("wvr").style.setProperty("--v", WV + "%");
    $("wmute").innerHTML = WV > 0 ? ICW.on : ICW.off;
    $("wmute").setAttribute("aria-pressed", WV > 0 ? "false" : "true");
    vol();
}
function wDraw() {
    if (!W)
        return;
    var c = S && S.cur
      , n = (S ? S.viewers || 0 : 0) + (S ? S.webv || 0 : 0);
    document.title = "Watch " + ((S && S.name) || "Sync TV");
    $("wnm").textContent = (S && S.name) || "Sync TV";
    var L = $("wlv");
    L.className = "wl" + (n ? " on" : "");
    L.lastChild.textContent = n ? n + " watching" : "Connecting";
    $("wti").textContent = c ? nameOf(c) : "Nothing on yet";
    $("wst").textContent = !c ? "It starts here when the TV plays something." : c.photo ? "Photo on every screen" : c.paused ? "Paused on the TV in Second Life" : c.live ? "Live, with the TV in Second Life" : "Playing with the TV in Second Life";
}
if (W) {
    $("ihint").textContent = "Nothing on yet. It starts here when the TV plays something.";
    $("tapb").textContent = "Tap to watch together";
    $("taps").textContent = "You'll see the same moment as the TV in Second Life.";
    $("tap").style.display = WGO ? "none" : "flex";
    wVol(WV);
    $("wvr").addEventListener("input", function() {
        wVol(+this.value, true);
    });
    $("wmute").onclick = function() {
        wVol(WV > 0 ? 0 : WV1);
    }
    ;
    $("wfs").onclick = function() {
        var b = $("box")
          , fe = document.fullscreenElement || document.webkitFullscreenElement;
        if (fe) {
            (document.exitFullscreen || document.webkitExitFullscreen).call(document);
            return;
        }
        var rq = b.requestFullscreen || b.webkitRequestFullscreen;
        if (rq) {
            try {
                var r = rq.call(b);
                if (r && r.catch)
                    r.catch(function() {
                        document.documentElement.classList.toggle("fs");
                        fit();
                    });
            } catch (e) {
                document.documentElement.classList.toggle("fs");
            }
        } else
            document.documentElement.classList.toggle("fs");
        setTimeout(fit, 60);
    }
    ;
    $("box").addEventListener("dblclick", function() {
        $("wfs").onclick();
    });
    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape" && document.documentElement.classList.contains("fs")) {
            document.documentElement.classList.remove("fs");
            fit();
        }
    });
    window.addEventListener("resize", fit);
    document.addEventListener("fullscreenchange", fit);
    document.addEventListener("webkitfullscreenchange", fit);
    fit();
    setTimeout(fit, 300);
    wDraw();
}

// ---- the touch dashboard (this viewer only). Anyone can look; changing things needs the owner's PIN once (a 12 h
// session on this viewer), nothing at all when the TV is public, and is closed to everyone else in "owner only" mode
var SK = ""
  , pend = null
  , pinv = ""
  , uiT = 0
  , UIon = false
  , PANELS = ["pq", "padd", "ppin", "pl2", "pw"]
  , IC = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    open: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    top: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 4h12M12 20V9M7 13l5-5 5 5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
};
if (!W) {
    try {
        SK = localStorage.getItem("tvs_" + ROOM) || "";
    } catch (e) {}
    if (SK)
        fetch(BASE + "/api/sess/" + ROOM, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                s: SK
            })
        }).then(function(r) {
            return r.json();
        }).then(function(j) {
            if (!j.ok)
                setSK("");
        }).catch(function() {});
}
// the owner's key (left by the owner's remote in this same browser): the owner controls the screen in every mode
var OWN = "";
if (!W)
    try {
        var o0 = JSON.parse(localStorage.getItem("tvo_" + ROOM) || "null");
        if (o0 && o0.s)
            OWN = o0.s;
    } catch (e) {}
if (OWN)
    fetch(BASE + "/api/sess/" + ROOM, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            s: OWN
        })
    }).then(function(r) {
        return r.json();
    }).then(function(j) {
        if (!j.ok) {
            OWN = "";
            try {
                localStorage.removeItem("tvo_" + ROOM);
            } catch (e) {}
        }
        uiDraw();
    }).catch(function() {});
// or the server knows this computer: the owner's remote came from here (the HUD) - asked now and every 20 s until it is
function ownMe() {
    return;
    fetch(BASE + "/api/ownme/" + ROOM, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: "{}"
    }).then(function(r) {
        return r.json();
    }).then(function(j) {
        if (j && j.ok && j.s && !OWN) {
            OWN = j.s;
            uiDraw();
        }
    }).catch(function() {});
}
function ownLocal() {
    if (OWN || W)
        return;
    try {
        var o1 = JSON.parse(localStorage.getItem("tvo_" + ROOM) || "null");
        if (o1 && o1.s) {
            OWN = o1.s;
            uiDraw();
        }
    } catch (e) {}
}
if (!W) {
    setInterval(ownLocal, 5000);
    addEventListener("storage", function(e) {
        if (e.key === "tvo_" + ROOM)
            ownLocal();
    });
}
function setSK(v) {
    SK = v;
    try {
        if (v)
            localStorage.setItem("tvs_" + ROOM, v);
        else
            localStorage.removeItem("tvs_" + ROOM);
    } catch (e) {}
    uiDraw();
}
function mode() {
    return (S && S.access) || "pin";
}
function toast(m, ms) {
    var t = $("toast");
    t.textContent = m;
    t.className = "on";
    clearTimeout(toast.t);
    toast.t = setTimeout(function() {
        t.className = "";
    }, ms || 2800);
}
// THE OWNER ON THIS SCREEN BY A CODE (2026-10-16): in Second Life each media is its own browser - the owner's remote cannot
// leave its key here. This screen asks a 4-digit code, shows it, and waits; the owner taps Allow on the Remote HUD and this
// screen gets the owner's key (then the click that asked goes on). Group: the members touch the TV for their own remote.
var PAIR = {
    t: 0,
    pend: null
};
function askOwner(o) {
    if (o)
        PAIR.pend = o;
    var m = mode();
    fetch(BASE + "/api/pair/" + ROOM, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            c: CID
        })
    }).then(function(r) {
        return r.json();
    }).then(function(j) {
        if (!j.code) {
            toast(j.error || "Try again in a moment.");
            return;
        }
        toast((m === "group" ? "This TV is for its group: touch the TV (its frame, not the screen) for your own remote. " : "Only the owner can change this TV. ") + "The owner? Tap Allow on your Remote HUD - code " + j.code + ".", 12000);
        clearInterval(PAIR.t);
        var n = 0;
        PAIR.t = setInterval(function() {
            if (++n > 90) {
                clearInterval(PAIR.t);
                return;
            }
            fetch(BASE + "/api/pair/" + ROOM + "?c=" + CID, {
                cache: "no-store"
            }).then(function(r) {
                return r.json();
            }).then(function(x) {
                if (x.s) {
                    clearInterval(PAIR.t);
                    if (x.g) {
                        setSK(x.s);
                        toast("Unlocked. You can control the TV now.");
                    } else {
                        OWN = x.s;
                        try {
                            localStorage.setItem("tvo_" + ROOM, JSON.stringify({
                                s: x.s,
                                at: Date.now()
                            }));
                        } catch (e) {}
                        uiDraw();
                        toast("You're the owner - the controls are yours on this screen.");
                    }
                    var p = PAIR.pend;
                    PAIR.pend = null;
                    if (p)
                        act(p);
                } else if (x.gone)
                    clearInterval(PAIR.t);
            }).catch(function() {});
        }, 2000);
    }).catch(function() {
        toast("No connection. Try again.");
    });
}
function isOn(id) {
    return $(id).className.indexOf(" on") > -1;
}
function panel(id) {
    PANELS.forEach(function(p) {
        $(p).className = "pn hit" + (p === id ? " on" : "");
    });
    if (id === "padd")
        setTimeout(function() {
            $("uurl").focus();
        }, 50);
    if (id === "ppin") {
        pinv = "";
        pinDraw();
        $("pm").textContent = "";
    }
    if (id === "pw" && !$("qrimg").getAttribute("src"))
        $("qrimg").src = BASE + "/qr/" + ROOM + ".svg";
    kick();
}
function openPanel() {
    return PANELS.some(isOn);
}
function typing() {
    var a = document.activeElement;
    return a && (a.id === "uurl" || a.id === "ulname");
}
function ui(on) {
    if (on) {
        ownLocal();
        demoOff();
    }
    $("dtk").style.visibility = on ? "hidden" : "";
    UIon = on;
    $("ui").className = on ? "on" : "";
    if (!on)
        panel(null);
    else {
        uiDraw();
        kick();
    }
    card(false);
    $("nx").className = "";
}
function kick() {
    clearTimeout(uiT);
    uiT = setTimeout(function() {
        if (!openPanel() && !typing())
            ui(false);
        else
            kick();
    }, 9000);
}
$("cover").onclick = function() {
    ui(!UIon);
}
;
$("uclose").onclick = function() {
    ui(false);
}
;
$("ui").addEventListener("click", function(e) {
    var x = e.target.closest("[data-x]");
    if (x) {
        panel(null);
        return;
    }
    var p = e.target.closest("[data-p]");
    if (p) {
        var id = p.getAttribute("data-p");
        panel(isOn(id) ? null : id);
        return;
    }
    var k = e.target.closest("[data-a]");
    if (k) {
        var a = k.getAttribute("data-a")
          , o = {
            act: a
        };
        if (a === "vol" && demoMine()) {
            demoVol(+k.getAttribute("data-by") || 0);
            kick();
            return;
        }
        if (a === "pp")
            o.act = (S && S.cur && S.cur.paused) ? "resume" : "pause";
        if (k.hasAttribute("data-by"))
            o.by = +k.getAttribute("data-by");
        if (k.hasAttribute("data-i"))
            o.i = +k.getAttribute("data-i");
        if (k.hasAttribute("data-n"))
            o.name = k.getAttribute("data-n");
        if (a === "load")
            o.play = 1;
        if (a === "clear" && !(S && S.q && S.q.length))
            return;
        act(o).then(function(j) {
            if (!j)
                return;
            if (a === "load")
                toast("Playing " + o.name + ".");
            if (a === "clear")
                toast("Queue cleared.");
        });
    }
    kick();
});
$("uvol").addEventListener("click", function(e) {
    if (!demoMine())
        return;
    e.stopPropagation();
    demoVol(0, true);
    kick();
});
var UDRAG = null
  , UGHOST = null;
function uSeekValid() {
    return !!(S && S.cur && !S.cur.photo && !S.cur.live && S.cur.dur > 0);
}
function uSeekPaint(p) {
    if (!uSeekValid())
        return;
    var d = S.cur.dur;
    p = Math.max(0, Math.min(d, p));
    $("uc").textContent = fmt(p);
    $("ubu").style.width = (p / d * 100) + "%";
    $("ubar").setAttribute("aria-valuenow", String(Math.round(p)));
    $("ubar").setAttribute("aria-valuetext", fmt(p) + " / " + fmt(d));
}
function uSeekPos(x) {
    var r = $("ubar").getBoundingClientRect();
    return Math.max(0, Math.min(1, (x - r.left) / Math.max(1, r.width))) * S.cur.dur;
}
function uSeekCancel() {
    if (!UDRAG)
        return;
    var id = UDRAG.pointer;
    UDRAG = null;
    $("ubar").classList.remove("dragging");
    try {
        $("ubar").releasePointerCapture(id);
    } catch (e) {}
    if (uSeekValid())
        uSeekPaint(expected());
}
function uSeekCommit(p) {
    if (!uSeekValid())
        return;
    p = Math.max(0, Math.min(S.cur.dur, p));
    UGHOST = {
        id: S.cur.id,
        pos: p,
        until: Date.now() + 1500
    };
    uSeekPaint(p);
    act({
        act: "seek",
        to: p
    });
    kick();
}
$("ubar").addEventListener("pointerdown", function(e) {
    if (e.button !== 0 || e.isPrimary === false || !uSeekValid())
        return;
    e.preventDefault();
    e.stopPropagation();
    kick();
    UDRAG = {
        pointer: e.pointerId,
        id: S.cur.id,
        pos: uSeekPos(e.clientX)
    };
    UGHOST = null;
    this.classList.add("dragging");
    this.focus({
        preventScroll: true
    });
    try {
        this.setPointerCapture(e.pointerId);
    } catch (x) {}
    uSeekPaint(UDRAG.pos);
});
window.addEventListener("pointermove", function(e) {
    if (!UDRAG || e.pointerId !== UDRAG.pointer)
        return;
    e.preventDefault();
    if (!uSeekValid() || S.cur.id !== UDRAG.id) {
        uSeekCancel();
        return;
    }
    UDRAG.pos = uSeekPos(e.clientX);
    uSeekPaint(UDRAG.pos);
});
window.addEventListener("pointerup", function(e) {
    if (!UDRAG || e.pointerId !== UDRAG.pointer)
        return;
    e.preventDefault();
    var ok = uSeekValid() && S.cur.id === UDRAG.id
      , p = ok ? uSeekPos(e.clientX) : 0;
    uSeekCancel();
    if (ok)
        uSeekCommit(p);
});
window.addEventListener("pointercancel", function(e) {
    if (UDRAG && e.pointerId === UDRAG.pointer)
        uSeekCancel();
});
window.addEventListener("blur", uSeekCancel);
$("ubar").addEventListener("keydown", function(e) {
    if (e.key === "Escape" && UDRAG) {
        e.preventDefault();
        uSeekCancel();
        return;
    }
    if (!uSeekValid())
        return;
    var p = UGHOST && UGHOST.id === S.cur.id && UGHOST.until > Date.now() ? UGHOST.pos : expected()
      , d = S.cur.dur;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown")
        p -= 5;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp")
        p += 5;
    else if (e.key === "Home")
        p = 0;
    else if (e.key === "End")
        p = d;
    else
        return;
    e.preventDefault();
    e.stopPropagation();
    uSeekCommit(p);
});

$("lock").onclick = function() {
    if (OWN) {
        toast("You're the owner - the controls are always yours here.");
        return;
    }
    if (mode() === "public")
        return;
    if (mode() === "owner" || mode() === "group") {
        askOwner(null);
        return;
    }
    if (SK) {
        setSK("");
        toast("Locked on this screen.");
    } else
        panel("ppin");
}
;
function api(path, o) {
    return fetch(BASE + path + ROOM, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(o)
    }).then(function(r) {
        return r.json().then(function(j) {
            return {
                r: r,
                j: j
            };
        });
    });
}
// locked again: the PIN pad - or, where there is no PIN (Only me, Group), the owner's code
function relock(o) {
    var m = mode();
    if (m === "owner" || m === "group")
        askOwner(o);
    else {
        pend = o;
        panel("ppin");
    }
}
function act(o) {
    if (S && S.cur && S.cur.photo && /^(pause|resume|seek|restart)$/.test(o.act))
        return Promise.resolve();
    ownLocal();
    var m = mode();
    if (!OWN && (m === "owner" || (m === "group" && !SK))) {
        askOwner(o);
        return Promise.resolve();
    }
    if (OWN)
        o.s = OWN;
    else if (m === "public")
        o.pub = 1;
    else if (!SK) {
        pend = o;
        panel("ppin");
        return Promise.resolve();
    }
    if (SK && !OWN)
        o.s = SK;
    return api("/api/ctl/", o).then(function(x) {
        if (x.r.status === 403 && x.j.locked && OWN && !o._again) {
            OWN = "";
            try {
                localStorage.removeItem("tvo_" + ROOM);
            } catch (e) {}
            return fetch(BASE + "/api/ownme/" + ROOM, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: "{}"
            }).then(function(r) {
                return r.json();
            }).then(function(j) {
                if (j && j.ok && j.s) {
                    OWN = j.s;
                    uiDraw();
                    o._again = 1;
                    delete o.s;
                    return act(o);
                }
                relock(o);
            });
        }
        if (x.r.status === 403 && x.j.locked) {
            setSK("");
            relock(o);
            return;
        }
        if (x.r.status === 403) {
            toast(x.j.error || "Not allowed.");
            return;
        }
        if (!x.r.ok) {
            toast(x.j.error || "That didn't work.");
            return;
        }
        return x.j;
    }).catch(function() {
        toast("No connection. Try again.");
    });
}
// one box: a YouTube video link, a playlist link, or words to search for
function ytId(s) {
    s = String(s || "").trim();
    if (/^[\w-]{11}$/.test(s))
        return s;
    var u;
    try {
        u = new URL(/^https?:\/\//i.test(s) ? s : "https://" + s);
    } catch (e) {
        return "";
    }
    var h = u.hostname.replace(/^(www|m|music)\./, "");
    if (h === "youtu.be") {
        var m = /^\/([\w-]{11})/.exec(u.pathname);
        return m ? m[1] : "";
    }
    if (h === "youtube.com" || h === "youtube-nocookie.com") {
        var v = u.searchParams.get("v");
        if (v && /^[\w-]{11}$/.test(v))
            return v;
        var m2 = /^\/(?:shorts|embed|live|v)\/([\w-]{11})/.exec(u.pathname);
        return m2 ? m2[1] : "";
    }
    return "";
}
function ytList(s) {
    try {
        var t = String(s || "").trim()
          , u = new URL(/^https?:\/\//i.test(t) ? t : "https://" + t);
        if (!/youtu/.test(u.hostname))
            return "";
        var l = u.searchParams.get("list");
        return l && /^[\w-]{10,64}$/.test(l) ? l : "";
    } catch (e) {
        return "";
    }
}
function isLink(s) {
    s = String(s || "").trim();
    return /^https?:\/\/\S+$/i.test(s) || /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(s);
}
var HINT0 = "Search YouTube, or paste a video or photo link (Gyazo, Dropbox, JPG, PNG, WebP). Photos stay until Next or Stop. Save them in a list; no uploads.";
function addKind() {
    var v = $("uurl").value.trim()
      , id = ytId(v)
      , li = ytList(v)
      , link = !id && !li && isLink(v)
      , other = link && !/youtu/i.test(v)
      , words = v && !id && !li && !link;
    $("bvid").hidden = !(id || !v || link);
    $("blist").hidden = !li;
    $("bsrch").hidden = !(words && S && S.search);
    $("uhint").textContent = li && id ? "This link has a video and a playlist: play the video, or add the whole playlist." : li ? "A playlist: add all its videos (up to 200) to the queue." : other ? "A video or photo link: it opens on every screen. Photos stay until Next or Stop." : words && !(S && S.search) ? "Search isn't on for this TV yet. Paste a YouTube link instead." : words ? "Press Enter to search YouTube." : HINT0;
    if (!words)
        $("ures").innerHTML = "";
}
$("uhint").textContent = HINT0;
$("uurl").addEventListener("input", addKind);
function addUrl(a) {
    var v = $("uurl").value.trim();
    if (!v) {
        $("uurl").focus();
        return;
    }
    if (!ytId(v) && !isLink(v)) {
        toast("That isn't a link.");
        return;
    }
    if (!ytId(v))
        toast("Checking the media link...");
    act({
        act: a,
        url: v
    }).then(function(j) {
        if (j && j.ok) {
            if ($("uurl").value.trim() === v) {
                $("uurl").value = "";
                addKind();
            }
            panel(null);
            toast(a === "play" ? "Playing for everyone." : "Added to the queue.");
        }
    });
}
$("uplay").onclick = function() {
    addUrl("play");
}
;
$("uqueue").onclick = function() {
    addUrl("queue");
}
;
$("uurl").addEventListener("keydown", function(e) {
    e.stopPropagation();
    kick();
    if (e.key !== "Enter")
        return;
    var v = $("uurl").value.trim();
    if (ytList(v) && !ytId(v))
        readList(false);
    else if (ytId(v) || isLink(v))
        addUrl("queue");
    else if (S && S.search)
        doSearch();
});
// a playlist: a hidden YouTube player cues it and hands over its video ids (YouTube gives at most 200 this way)
var LP = null
  , lpWant = null
  , lpT = 0;
function readList(replace) {
    var li = ytList($("uurl").value);
    if (!li)
        return;
    if (mode() !== "public" && mode() !== "owner" && !SK && !OWN) {
        pend = null;
        panel("ppin");
        toast("Unlock with the PIN first, then add the playlist.");
        return;
    }
    $("uimp").disabled = $("urep").disabled = true;
    $("uhint").textContent = "Reading the playlist...";
    lpWant = {
        list: li,
        replace: replace
    };
    clearTimeout(lpT);
    lpT = setTimeout(function() {
        lpDone(null);
    }, 12000);
    if (!LP) {
        var d = document.createElement("div");
        d.id = "plrx";
        $("plr").appendChild(d);
        LP = new YT.Player("plrx",{
            width: 2,
            height: 2,
            playerVars: {
                autoplay: 0,
                mute: 1,
                controls: 0
            },
            events: {
                onReady: function() {
                    LP.cuePlaylist({
                        listType: "playlist",
                        list: lpWant.list
                    });
                },
                onStateChange: function(e) {
                    if (e.data === 5 || e.data === -1) {
                        var ids = LP.getPlaylist();
                        if (ids && ids.length)
                            lpDone(ids);
                    }
                },
                onError: function() {
                    lpDone(null);
                }
            }
        });
    } else
        LP.cuePlaylist({
            listType: "playlist",
            list: li
        });
}
function lpDone(ids) {
    if (!lpWant)
        return;
    var w = lpWant;
    lpWant = null;
    clearTimeout(lpT);
    $("uimp").disabled = $("urep").disabled = false;
    if (!ids) {
        toast("That playlist couldn't be read. It may be private.");
        addKind();
        return;
    }
    act({
        act: "import",
        ids: ids,
        replace: w.replace
    }).then(function(j) {
        if (j && j.ok) {
            $("uurl").value = "";
            addKind();
            panel(null);
            toast(j.added + " videos added" + (j.skipped ? " (" + j.skipped + " didn't fit)" : "") + ".");
        }
    });
}
$("uimp").onclick = function() {
    readList(false);
}
;
$("urep").onclick = function() {
    readList(true);
}
;
function doSearch() {
    var q = $("uurl").value.trim();
    if (!q)
        return;
    var o = {
        q: q
    };
    if (mode() === "public")
        o.pub = 1;
    if (SK)
        o.s = SK;
    if (OWN)
        o.s = OWN;
    if (mode() !== "public" && !SK && !OWN) {
        panel("ppin");
        return;
    }
    $("ures").innerHTML = '<div class="qe">Searching YouTube...</div>';
    api("/api/search/", o).then(function(x) {
        if (x.j.locked) {
            setSK("");
            panel("ppin");
            return;
        }
        if (x.j.off) {
            $("ures").innerHTML = '<div class="qe">Search isn\'t on for this TV yet.</div>';
            return;
        }
        if (x.j.error) {
            $("ures").innerHTML = '<div class="qe"></div>';
            $("ures").firstChild.textContent = x.j.error;
            return;
        }
        var it = x.j.items || [];
        if (!it.length) {
            $("ures").innerHTML = '<div class="qe">No videos found. Try other words.</div>';
            return;
        }
        $("ures").innerHTML = it.map(function(v, i) {
            return '<div class="qi"><img src="https://i.ytimg.com/vi/' + v.id + '/default.jpg" alt=""><div class="tt"><span class="n"></span><small></small></div><span class="ib2" data-sp="' + i + '" title="Play now">' + IC.play + '</span><span class="ib2" data-sq="' + i + '" title="Add to the queue">' + IC.plus + '</span></div>';
        }).join("");
        [].forEach.call($("ures").querySelectorAll(".qi"), function(r, i) {
            r.querySelector(".n").textContent = it[i].title;
            r.querySelector("small").textContent = (it[i].ch || "") + (it[i].live ? ", live" : it[i].dur ? ", " + fmt(it[i].dur) : "");
        });
        $("ures")._it = it;
    }).catch(function() {
        $("ures").innerHTML = '<div class="qe">No connection. Try again.</div>';
    });
}
$("usrch").onclick = doSearch;
$("ures").addEventListener("click", function(e) {
    var b = e.target.closest("[data-sp],[data-sq]");
    if (!b)
        return;
    var it = $("ures")._it || []
      , i = +(b.getAttribute("data-sp") || b.getAttribute("data-sq"))
      , v = it[i];
    if (!v)
        return;
    var a = b.hasAttribute("data-sp") ? "play" : "queue";
    act({
        act: a,
        url: v.id,
        title: v.title,
        live: v.live ? 1 : 0
    }).then(function(j) {
        if (j && j.ok)
            toast(a === "play" ? "Playing for everyone." : "Added to the queue.");
    });
    kick();
});
$("ulsave").onclick = function() {
    var n = $("ulname").value.trim();
    if (!n) {
        $("ulname").focus();
        return;
    }
    act({
        act: "save",
        name: n
    }).then(function(j) {
        if (j && j.ok) {
            $("ulname").value = "";
            toast("Saved as " + n + ".");
        }
    });
}
;
$("ulname").addEventListener("keydown", function(e) {
    e.stopPropagation();
    kick();
    if (e.key === "Enter")
        $("ulsave").onclick();
});
function pinDraw() {
    var h = "";
    for (var i = 0; i < 6; i++)
        h += '<i class="' + (i < pinv.length ? "f" : "") + '"></i>';
    $("dots").innerHTML = h;
}
function pinKey(k) {
    if (k === "del")
        pinv = pinv.slice(0, -1);
    else if (k === "ok") {
        unlock();
        return;
    } else if (/^\d$/.test(k) && pinv.length < 6)
        pinv += k;
    pinDraw();
    if (pinv.length === 6)
        unlock();
}
$("kp").onclick = function(e) {
    var b = e.target.closest("button");
    if (!b)
        return;
    pinKey(b.getAttribute("data-k") || b.textContent);
    kick();
}
;
document.addEventListener("keydown", function(e) {
    if (!isOn("ppin"))
        return;
    if (/^\d$/.test(e.key))
        pinKey(e.key);
    else if (e.key === "Backspace")
        pinKey("del");
    else if (e.key === "Enter")
        pinKey("ok");
});
function unlock() {
    var v = pinv;
    pinv = "";
    pinDraw();
    if (v.length < 6) {
        $("pm").textContent = "The PIN has 6 digits.";
        return;
    }
    api("/api/unlock/", {
        pin: v
    }).then(function(x) {
        if (!x.r.ok) {
            $("pm").textContent = (x.j.error || "Wrong PIN.") + (x.j.left != null && x.j.left < 3 ? " " + x.j.left + (x.j.left === 1 ? " try" : " tries") + " left." : "");
            return;
        }
        setSK(x.j.s);
        panel(null);
        toast("Unlocked. You can control the TV now.");
        if (pend) {
            var o = pend;
            pend = null;
            act(o);
        }
    }).catch(function() {
        $("pm").textContent = "No connection. Try again.";
    });
}
var UIPaint = Object.create(null);
function uiPaint(k, v) {
    var x = JSON.stringify(v);
    if (UIPaint[k] === x)
        return false;
    UIPaint[k] = x;
    return true;
}
function uiDraw() {
    var c = S && S.cur
      , m = mode();
    $("ubr").textContent = (S && S.name) || "Sync TV";
    if (uiPaint("access", [!!OWN, m, !!SK])) {
        var L = $("lock");
        if (OWN) {
            L.className = "chip hit un";
            L.innerHTML = IC.open + "You're the owner";
        } else if (m === "public") {
            L.className = "chip hit un";
            L.innerHTML = IC.globe + "Open to everyone";
        } else if (m === "owner") {
            L.className = "chip hit lk";
            L.innerHTML = IC.lock + "Owner only";
        } else if (m === "group" && !SK) {
            L.className = "chip hit lk";
            L.innerHTML = IC.lock + "Group only";
        } else {
            L.className = "chip hit " + (SK ? "un" : "lk");
            L.innerHTML = (SK ? IC.open + "Unlocked" : IC.lock + "Locked");
        }
    }
    $("uvol").textContent = demoMine() ? (DV > 0 ? DV : "Off") : (S && S.vol != null ? S.vol : 100);
    $("uvol").style.cursor = demoMine() ? "pointer" : "";
    if (uiPaint("play", !!(c && !c.paused)))
        $("upp").innerHTML = c && !c.paused ? IC.pause : IC.play;
    var valid = uSeekValid();
    $("ubar").setAttribute("aria-disabled", valid ? "false" : "true");
    $("ubar").tabIndex = valid ? 0 : -1;
    $("ubar").setAttribute("aria-valuemax", String(c && c.dur || 0));
    if (UDRAG && (!valid || UDRAG.id !== c.id))
        uSeekCancel();
    var lv = !!(c && c.live);
    $("dctl").className = "dctl" + (lv ? " lv" : "");
    $("ubar").className = "dprog" + (lv ? " lv" : "") + (UDRAG ? " dragging" : "");
    if (c) {
        $("uth").style.visibility = "visible";
        if ($("uth").getAttribute("src") !== th(c))
            $("uth").src = th(c);
        $("ust").textContent = c.photo ? "Photo" : c.paused ? "Paused" : lv ? "Live" : "Now playing";
        $("uti").textContent = nameOf(c);
        $("ud").textContent = c.dur && !lv ? "/ " + fmt(c.dur) : "";
    } else {
        $("uth").style.visibility = "hidden";
        $("ust").textContent = "Nothing playing";
        $("uti").textContent = "Add a video to start";
        $("ud").textContent = "";
        $("uc").textContent = "";
        $("ubu").style.width = "0";
    }
    $("mshuf").className = "md" + (S && S.shuffle ? " on" : "");
    $("mrep").className = "md" + (S && S.repeat ? " on" : "");
    $("mloop").className = "md" + (S && S.loop ? " on" : "");
    var q = (S && S.q) || [];
    $("uqn").textContent = q.length ? q.length : "";
    if (uiPaint("queue", q)) {
        $("uql").innerHTML = q.length ? q.map(function(x, i) {
            return '<div class="qi"><img src="' + th(x, "default") + '" alt=""><span class="n"></span>' + (i ? '<span class="ib2" data-a="top" data-i="' + i + '" title="Play next">' + IC.top + '</span>' : '') + '<span class="ib2" data-a="jump" data-i="' + i + '" title="Play now">' + IC.play + '</span><span class="ib2" data-a="remove" data-i="' + i + '" title="Remove">' + IC.x + '</span></div>';
        }).join("") : '<div class="qe">The queue is empty. Add a video or load a saved list.</div>';
        [].forEach.call($("uql").querySelectorAll(".qi .n"), function(s, i) {
            s.textContent = q[i].title || "Loading title...";
            s.title = q[i].title || "";
        });
    }
    var ls = (S && S.lists) || [];
    if (uiPaint("lists", ls)) {
        $("ulists").innerHTML = ls.length ? ls.map(function(l) {
            return '<div class="li"><b></b><small>' + l.n + (l.n === 1 ? " item" : " items") + '</small><span class="ib2" data-a="load" data-n="" title="Play this list">' + IC.play + '</span></div>';
        }).join("") : '<div class="qe">No saved lists yet. Name the current queue below to keep it.</div>';
        [].forEach.call($("ulists").querySelectorAll(".li"), function(r, i) {
            r.querySelector("b").textContent = ls[i].name;
            r.querySelector("[data-a]").setAttribute("data-n", ls[i].name);
        });
    }
    $("wlink").textContent = BASE.replace(/^https?:\/\//, "") + "/w/" + ROOM;
}
setInterval(function() {
    if (!UIon || !S || !S.cur)
        return;
    if (UDRAG) {
        if (uSeekValid() && UDRAG.id === S.cur.id)
            uSeekPaint(UDRAG.pos);
        else
            uSeekCancel();
        return;
    }
    var g = UGHOST && UGHOST.id === S.cur.id && UGHOST.until > Date.now() ? UGHOST : null
      , p = g ? g.pos : expected()
      , d = S.cur.dur || 0;
    if (uSeekValid())
        uSeekPaint(p);
    else {
        $("uc").textContent = S.cur.photo ? "Photo" : S.cur.live ? "Live" : fmt(p);
        $("ubu").style.width = d ? Math.min(100, p / d * 100) + "%" : "0";
    }
}, 100);

// THE HOME SCREEN (2026-10-16): the rows of the launcher. m = how it opens: app = inside this screen, under its Home / Sync TV
// bar (the site lets itself be shown in a frame - checked; owner: "herhangi bir düğme yok" on a whole-screen site), web = the
// whole screen goes to the site (it does not let itself be framed: back from the remote), radio = a station plays here; ask =
// a box first (a channel, a station, an address). The TV page only: the watch page (/w/) keeps the paused video.
function hic(p) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
}
var HIC = {
    play: '<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
    live: '<circle cx="12" cy="12" r="2"/><path d="M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7M5.6 18.4a9 9 0 0 1 0-12.8M18.4 5.6a9 9 0 0 1 0 12.8"/>',
    radio: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M7 8l9-5"/><circle cx="15.5" cy="14" r="2.5"/><path d="M6.5 12.5h4M6.5 15.5h4"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    bomb: '<circle cx="11" cy="14" r="7"/><path d="M15.5 9.5l2-2M18 4.5l1.5-1.5M20 8h1.5M16.5 3V2"/>',
    words: '<rect x="3" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="4" width="8" height="7" rx="1.5"/><rect x="3" y="13" width="8" height="7" rx="1.5"/><rect x="13" y="13" width="8" height="7" rx="1.5"/>',
    grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
    cards: '<rect x="3" y="6" width="11" height="15" rx="2"/><path d="M8 6V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-5"/>',
    hex: '<path d="M12 2l8.5 5v10L12 22l-8.5-5V7z"/><path d="M12 8l4 2.3v4.6L12 17l-4-2.1v-4.6z"/>',
    chess: '<path d="M8 21h8M9 17h6l1 4H8zM10 17l-1-6h6l-1 6M12 4v4M10 6h4"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 7h6"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    pin: '<path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
    bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    yt: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor" stroke="none"/>',
    tv: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 3l4 3 4-3M8 21h8"/>',
    film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    headph: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
    party: '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M3 20a5 5 0 0 1 10 0M11 20a5 5 0 0 1 10 0"/>',
    coffee: '<path d="M4 9h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M16 11h2a2 2 0 0 1 0 4h-2M8 3v3M12 3v3"/>',
    antenna: '<path d="M12 13v8M8 21h8"/><circle cx="12" cy="11" r="2"/><path d="M8.5 7.5a5 5 0 0 0 0 7M15.5 7.5a5 5 0 0 1 0 7"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'
};
// (2026-10-16, owner: the competitor's remote - Kosmi, Lofi Girl, YouTube, Pluto TV, Plex, Stirr, Kick, Twitch: "oyun siteleri
// onlar olsun") four rows. go: yt = back to the player with the TV's YouTube search open; lofi = Lofi Girl's live stream in
// the player, the same moment for everyone
var HROWS = [["Watch", [{
    id: "sync",
    t: "Sync TV",
    s: "Back to the player",
    ic: "play",
    c: "linear-gradient(135deg,#5b3fd6,#14b8d6)",
    w: 1,
    go: "back"
}, {
    t: "YouTube",
    ic: "yt",
    si: "youtube",
    c: "#ff0000",
    go: "yt"
}, {
    t: "Lofi Girl",
    ic: "headph",
    lg: "lofigirl.com",
    c: "#2d1f44",
    go: "lofi"
}, {
    t: "Pluto TV",
    ic: "tv",
    lg: "pluto.tv",
    c: "#0b0b0b",
    m: "app",
    u: "https://pluto.tv/live-tv"
}, {
    t: "Plex",
    ic: "film",
    si: "plex",
    fg: "#e5a00d",
    c: "#1f1f1f",
    m: "web",
    u: "https://watch.plex.tv/"
}, {
    t: "Stirr",
    ic: "antenna",
    lg: "stirr.com",
    c: "#ffcf00",
    dk: 1,
    m: "web",
    u: "https://stirr.com/"
}]], ["Live and music", [{
    t: "Twitch",
    ic: "live",
    si: "twitch",
    c: "#9146ff",
    m: "web",
    u: "https://www.twitch.tv/"
}, {
    t: "Kick",
    ic: "live",
    si: "kick",
    fg: "#0b0e0f",
    c: "#53fc18",
    dk: 1,
    m: "web",
    u: "https://kick.com/"
}, {
    t: "Radio",
    ic: "radio",
    c: "#a3401f",
    ask: "radio"
}, {
    t: "Radio Paradise",
    ic: "music",
    lg: "radioparadise.com",
    c: "#1b3a57",
    m: "radio",
    u: "https://stream.radioparadise.com/mp3-192",
    k: "Listener-supported, no ads"
}, {
    t: "RP Mellow",
    ic: "music",
    lg: "radioparadise.com",
    c: "#2f5446",
    m: "radio",
    u: "https://stream.radioparadise.com/mellow-192",
    k: "Radio Paradise"
}, {
    t: "Lofi Cafe",
    ic: "coffee",
    lg: "lofi.cafe",
    c: "#0e1410",
    m: "app",
    u: "https://www.lofi.cafe/"
}]], ["Play together", [{
    t: "Poki",
    ic: "grid",
    lg: "poki.com",
    c: "#002b50",
    m: "web",
    u: "https://poki.com/"
}, {
    t: "CrazyGames",
    ic: "grid",
    lg: "crazygames.com",
    c: "#6842ff",
    m: "web",
    u: "https://www.crazygames.com/"
}, {
    t: "Kosmi",
    ic: "party",
    lg: "kosmi.io",
    c: "#3b1f8f",
    m: "web",
    u: "https://app.kosmi.io/"
}, {
    t: "skribbl.io",
    ic: "pencil",
    lg: "skribbl.io",
    c: "#1d4ea0",
    m: "app",
    u: "https://skribbl.io/"
}, {
    t: "BombParty",
    ic: "bomb",
    lg: "jklm.fun",
    c: "#6b46c1",
    m: "web",
    u: "https://jklm.fun/"
}, {
    t: "Codenames",
    ic: "words",
    lg: "codenames.game",
    c: "#1f2937",
    m: "app",
    u: "https://codenames.game/"
}, {
    t: "Colonist",
    ic: "hex",
    lg: "colonist.io",
    c: "#1565c0",
    m: "app",
    u: "https://colonist.io/"
}]], ["Web", [{
    t: "Type an address",
    s: "Any website, or a search",
    ic: "globe",
    c: "#2a2a31",
    w: 1,
    ask: "web"
}, {
    t: "Google",
    ic: "search",
    si: "google",
    c: "#4285f4",
    m: "web",
    u: "https://www.google.com/"
}, {
    t: "Wikipedia",
    ic: "book",
    si: "wikipedia",
    fg: "#111",
    c: "#f3f3f3",
    dk: 1,
    m: "app",
    u: "https://www.wikipedia.org/"
}, {
    t: "Reddit",
    ic: "chat",
    si: "reddit",
    c: "#ff4500",
    m: "web",
    u: "https://www.reddit.com/"
}, {
    t: "Pinterest",
    ic: "pin",
    si: "pinterest",
    c: "#e60023",
    m: "web",
    u: "https://www.pinterest.com/"
}, {
    t: "Marketplace",
    ic: "bag",
    lg: "secondlife.com",
    c: "#00a3d9",
    m: "web",
    u: "https://marketplace.secondlife.com/"
}]]];
var HALL = [];
HROWS.forEach(function(r) {
    r[1].forEach(function(x) {
        HALL.push(x);
    });
});
// a few big channels as one-tap chips in the Twitch / Kick box (live or not, the player shows it)
var HCH = {
    twitch: ["kaicenat", "xqc", "ibai", "shroud", "summit1g", "pokimane", "chess", "esl_csgo"],
    kick: ["xqc", "adinross", "trainwreckstv", "amouranth", "cuffem", "hstikkytokky"]
};
var HGEN = [["Pop", "pop"], ["Rock", "rock"], ["Jazz", "jazz"], ["Chill", "chillout"], ["Lo-fi", "lofi"], ["Dance", "dance"], ["Classical", "classical"], ["80s", "80s"], ["Hip hop", "hip hop"], ["Turkish", "turkish"], ["News", "news"]];
var SIC = "https://cdn.jsdelivr.net/npm/simple-icons@11.14.0/icons/";
function tileArt(x) {
    if (x.si) {
        var u = "url(" + SIC + x.si + ".svg)";
        return '<i class="hg" style="-webkit-mask-image:' + u + ';mask-image:' + u + ';background:' + (x.fg || "#fff") + '"></i>';
    }
    if (x.lg)
        return '<img class="hf" alt="" src="https://www.google.com/s2/favicons?domain=' + x.lg + '&sz=128" onerror="this.remove()">';
    return '<span class="hi">' + hic(HIC[x.ic]) + '</span>';
}
function homeGrid() {
    $("hrows").innerHTML = HROWS.map(function(r) {
        return '<div class="hrow"><h5>' + r[0] + '</h5><div class="htl">' + r[1].map(function(x) {
            var i = HALL.indexOf(x)
              , ex = x.m === "web" ? '<svg class="ex" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + HIC.ext + '</svg>' : '';
            if (x.w)
                return '<div class="ht w" data-ht="' + i + '" style="--c:' + x.c + '"' + (x.id ? ' id="ht_' + x.id + '"' : '') + '>' + (x.id === "sync" ? '<img class="bg" id="hsyi" alt=""><i class="sh"></i>' : '') + hic(HIC[x.ic]) + '<b>' + x.t + '</b><small' + (x.id === "sync" ? ' id="hsys"' : '') + '>' + x.s + '</small></div>';
            return '<div class="ht a' + (x.dk ? " dk" : "") + '" data-ht="' + i + '" style="--c:' + x.c + '">' + tileArt(x) + ex + '<b>' + x.t + '</b></div>';
        }).join("") + '</div></div>';
    }).join("");
    homeNow();
}
// the Sync TV tile: the video that waits (paused while the TV is away)
function homeNow() {
    var c = S && S.cur
      , im = $("hsyi")
      , sm = $("hsys");
    if (!im)
        return;
    if (c) {
        var u = th(c, "hqdefault");
        if (im.getAttribute("src") !== u)
            im.src = u;
        im.style.display = "";
        sm.textContent = nameOf(c);
    } else {
        im.style.display = "none";
        sm.textContent = "Back to the player";
    }
    $("hnm").textContent = (S && S.name) || "";
}
var HK = ""
  , RA = null
  , HASK = ""
  , HWG = 0
  , HB = !W && /[?&]hb=1/.test(location.search) ? {
    sent: 0
} : null;
function homeApply() {
    var h = !W && S && S.home ? S.home : null;
    document.documentElement.classList.toggle("homeon", !!h);
    // the demo TV (the LECASTLE store): no Home button for its visitors (owner: "demo modunda home menüsüne girmesinler")
    var hc = document.querySelector('#ui [data-a="home"]');
    if (hc)
        hc.style.display = S && S.demo ? "none" : "";
    if (!h) {
        if (HK) {
            HK = "";
            $("home").className = "";
            $("hif").src = "about:blank";
            radioStop();
            hpClose();
        }
        return;
    }
    var k = h.m + "|" + h.u + "|" + h.at;
    if (k !== HK) {
        HK = k;
        $("home").className = "on m-" + h.m;
        if (h.m !== "app" && $("hif").getAttribute("src") !== "about:blank")
            $("hif").src = "about:blank";
        if (h.m !== "radio")
            radioStop();
        if (h.m !== "home")
            hpClose();
        if (h.m === "home" && !$("hrows").firstChild)
            homeGrid();
        if (h.m === "app") {
            $("hat").textContent = h.t;
            $("hif").src = h.u;
        } else if (h.m === "radio")
            radioPlay(h);
        else if (h.m === "web") {
            $("hwh").textContent = hostOf(h.u);
            clearTimeout(HWG);
            // Second Life's Home button (its media bar, TV v0.5.8) opened this page: the TV goes back to its Home screen, not to the site
            if (HB) {
                if (!HB.sent) {
                    HB.sent = 1;
                    fetch(BASE + "/api/ctl/" + ROOM, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            act: "homeup"
                        })
                    }).catch(function() {});
                }
                $("hwh").textContent = "the home screen";
            } // the TV script (v0.5.9) puts the website on the screen itself; this page still here after 12 s = an older TV script: it
            // could not bring the TV back from the site, so the site is not opened - the server marks the TV and the Home screen comes back
            else
                HWG = setTimeout(function() {
                    if (S && S.home && S.home.m === "web" && S.home.u === h.u)
                        fetch(BASE + "/api/tvold/" + ROOM, {
                            method: "POST"
                        }).catch(function() {});
                }, 12000);
        }
    }
    if (h.m === "home")
        homeNow();
    if (RA)
        RA.volume = radioV();
    if (h.o && h.at !== homeApply.o) {
        homeApply.o = h.at;
        toast("This site opens after the TV update (TV script v0.5.9). LECASTLE sends it.", 7000);
    }
}
function hostOf(u) {
    try {
        return new URL(u).hostname.replace(/^www\./, "");
    } catch (e) {
        return "the site";
    }
}
function radioV() {
    var v = S && S.vol != null ? S.vol : 100;
    if (S && S.mute)
        v = 0;
    return Math.max(0, Math.min(1, v / 100));
}
function radioPlay(h) {
    radioStop();
    $("hrt").textContent = h.t;
    $("hrs").textContent = h.k || "";
    $("hart").innerHTML = h.i ? '<img alt="" src="' + h.i.replace(/"/g, "%22") + '">' : hic(HIC.radio);
    var im = $("hart").querySelector("img");
    if (im)
        im.onerror = function() {
            $("hart").innerHTML = hic(HIC.radio);
        }
        ;
    RA = new Audio();
    RA.preload = "none";
    RA.volume = radioV();
    RA.onerror = function() {
        if (RA)
            toast("This station does not play here. Pick another one.", 4500);
    }
    ;
    RA.src = h.u;
    var p = RA.play();
    if (p && p.catch)
        p.catch(function() {});
}
function radioStop() {
    if (!RA)
        return;
    try {
        RA.onerror = null;
        RA.pause();
        RA.removeAttribute("src");
        RA.load();
    } catch (e) {}
    RA = null;
}
// a box first: a Twitch / Kick channel, a station (genres, a search), an address
function hpOpen(kind) {
    HASK = kind;
    var t = {
        twitch: "Twitch channel",
        kick: "Kick channel",
        radio: "Radio",
        web: "Open a website"
    }[kind];
    $("hpt").textContent = t;
    $("hin").value = "";
    $("hin").placeholder = kind === "radio" ? "A station's name, like jazz fm" : kind === "web" ? "An address like example.com, or words to search" : "The channel's name";
    $("hgo").textContent = kind === "radio" ? "Search" : "Open";
    $("hl").innerHTML = "";
    $("hch").innerHTML = kind === "radio" ? HGEN.map(function(g) {
        return '<span data-hg="' + g[1] + '">' + g[0] + '</span>';
    }).join("") : HCH[kind] ? HCH[kind].map(function(c) {
        return '<span data-hc="' + c + '">' + c + '</span>';
    }).join("") : "";
    $("hnt").textContent = kind === "web" ? "The TV goes to the site for everyone here. Back to the home screen: the lit Home button on the remote." : kind === "radio" ? "Pick a kind of music, or search for a station." : "It plays here, live, for everyone.";
    $("hpn").className = "hpn on";
    setTimeout(function() {
        $("hin").focus();
    }, 60);
    if (kind === "radio")
        radioList("tag", "pop");
}
function hpClose() {
    HASK = "";
    $("hpn").className = "hpn";
}
function radioList(by, v) {
    [].forEach.call(document.querySelectorAll("#hch span"), function(x) {
        x.className = by === "tag" && x.getAttribute("data-hg") === v ? "on" : "";
    });
    $("hl").innerHTML = '<p class="hnote">Looking...</p>';
    fetch(BASE + "/api/radio/" + ROOM + "?" + by + "=" + encodeURIComponent(v), {
        cache: "no-store"
    }).then(function(r) {
        return r.json();
    }).then(function(j) {
        var it = (j && j.items) || [];
        homeRad = it;
        $("hl").innerHTML = it.length ? it.map(function(x, i) {
            return '<div class="r" data-hr="' + i + '">' + (x.i ? '<img alt="" loading="lazy" src="' + x.i.replace(/"/g, "%22") + '" onerror="this.style.visibility=\'hidden\'">' : '<i></i>') + '<span><b>' + esc(x.n) + '</b><small>' + esc([x.c, x.g].filter(Boolean).join(" - ")) + '</small></span></div>';
        }).join("") : '<p class="hnote">' + esc(j && j.error || "No stations found. Try other words.") + '</p>';
    }).catch(function() {
        $("hl").innerHTML = '<p class="hnote">No connection. Try again.</p>';
    });
}
var homeRad = [];
function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function(c) {
        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;"
        }[c];
    });
}
// the PIN pad (or the owner's code) comes in front of the home screen: Second Life does not tell the page who clicks, so a
// screen not unlocked asks first (it remembers the PIN 12 hours)
function hAct(o) {
    var p = act(o);
    if (isOn("ppin")) {
        hpClose();
        if (!UIon)
            ui(true);
    }
    return p.then(function(j) {
        if (j && j.ok)
            hpClose();
        return j;
    });
}
function hGo() {
    var v = $("hin").value.trim();
    if (HASK === "radio") {
        if (v)
            radioList("q", v);
        return;
    }
    if (!v) {
        $("hin").focus();
        return;
    }
    if (HASK === "twitch" || HASK === "kick") {
        hAct({
            act: "homeopen",
            m: HASK,
            ch: v
        });
        return;
    }
    if (HASK === "web") {
        if (isLink(v))
            hAct({
                act: "homeopen",
                m: "web",
                u: v
            });
        else
            hAct({
                act: "homeopen",
                m: "web",
                u: "https://www.google.com/search?q=" + encodeURIComponent(v),
                ti: "Google - " + v.slice(0, 50)
            });
    }
}
$("hin").addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
        e.preventDefault();
        hGo();
    }
});
$("home").addEventListener("click", function(e) {
    var t = e.target.closest("[data-ht],[data-h],[data-hg],[data-hr],[data-hc]");
    if (!t)
        return;
    if (t.hasAttribute("data-hc")) {
        hAct({
            act: "homeopen",
            m: HASK,
            ch: t.getAttribute("data-hc")
        });
        return;
    }
    if (t.hasAttribute("data-hg")) {
        radioList("tag", t.getAttribute("data-hg"));
        return;
    }
    if (t.hasAttribute("data-hr")) {
        var r = homeRad[+t.getAttribute("data-hr")];
        if (r)
            hAct({
                act: "homeopen",
                m: "radio",
                u: r.u,
                ti: r.n,
                i: r.i,
                k: [r.c, r.g].filter(Boolean).join(" - ")
            });
        return;
    }
    if (t.hasAttribute("data-ht")) {
        var x = HALL[+t.getAttribute("data-ht")];
        if (!x)
            return;
        if (x.go === "back") {
            hAct({
                act: "homeback"
            });
            return;
        }
        if (x.go === "yt") {
            hAct({
                act: "homeback"
            }).then(function(j) {
                if (j && j.ok) {
                    ui(true);
                    panel("padd");
                }
            });
            return;
        }
        if (x.go === "lofi") {
            hAct({
                act: "play",
                url: "https://www.youtube.com/watch?v=4xDzrJKXOOY",
                title: "synthwave radio - beats to chill/game to",
                live: 1
            });
            return;
        }
        if (x.ask) {
            hpOpen(x.ask);
            return;
        }
        hAct({
            act: "homeopen",
            m: x.m,
            u: x.u,
            ti: x.t,
            k: x.k || ""
        });
        return;
    }
    var h = t.getAttribute("data-h");
    if (h === "close")
        hpClose();
    else if (h === "go")
        hGo();
    else if (h === "back")
        hAct({
            act: "homeback"
        });
    else if (h === "home")
        hAct({
            act: "home"
        });
    else if (h === "radio") {
        hAct({
            act: "home"
        }).then(function(j) {
            if (j && j.ok)
                setTimeout(function() {
                    hpOpen("radio");
                }, 400);
        });
    } else if (h === "vol")
        act({
            act: "vol",
            by: +t.getAttribute("data-by")
        });
});
poll();
