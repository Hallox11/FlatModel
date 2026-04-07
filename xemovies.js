// ============================================================
//  WebTV + Touch Tracker v2 (Instant Push Version)
// ============================================================

// 1. Configuration
string  BASE_URL        = "https://gearldine-unintrusted-carey.ngrok-free.dev";
string  SECRET          = "MyUltraSecret123";
integer WEB_FACE        = 6;  // The face showing the web content
integer logo_face       = 1;  // The back/logo face
integer screen_face     = 5;  // The static screen face
string  BACK_PICT_UUID  = "7bcc390c-2918-9aa9-6857-baacd35b4a31";

// 2. System Variables
string  SERIAL;
key     gUrlRequest;
string  gMyTvUrl;
integer FRAME;
integer button;
integer legs = 1; // Root prim
string  gDataPacket;

// ── Find Prims by Name ──────────────────────────────────────
GetLinkNum() {
    integer primCount = llGetNumberOfPrims();
    integer i; // <--- This must be here!
    for (i = 0; i <= primCount; i++) {
        string name = llGetLinkName(i); // Double check the parentheses here
        if (name == "frame")  FRAME  = i;
        if (name == "button") button = i;
    }
    llOwnerSay("System: Frame found at link " + (string)FRAME + ", Button at " + (string)button);
}

// ── Rotation/Texture Correction ─────────────────────────────
turn(integer link, vector angle1, vector angle2) {
    angle1 *= DEG_TO_RAD;
    rotation rot = llEuler2Rot(angle1);
    llSetLinkPrimitiveParams(link,  [PRIM_ROT_LOCAL, rot]);
    llSetLinkPrimitiveParams(FRAME, [PRIM_ROT_LOCAL, rot]);
    llSleep(0.2);
    
    angle2 *= DEG_TO_RAD;
    rot = llEuler2Rot(angle2);
    llSetLinkPrimitiveParams(link,  [PRIM_ROT_LOCAL, rot]);

    if (angle1.z == 0) { // Landscape Mode
        llSetLinkPrimitiveParamsFast(FRAME, [
            PRIM_TEXTURE, WEB_FACE,  llGetInventoryName(INVENTORY_TEXTURE, 0), <1.0, 1.0, 0.0>, <0.0, 0.0, 0.0>, 0,
            PRIM_TEXTURE, logo_face, BACK_PICT_UUID, <1.0, 1.0, 0.0>, <0.0, -0.15, 0.0>, 0
        ]);
    } else { // Portrait Mode
        llSetLinkPrimitiveParamsFast(FRAME, [
            PRIM_TEXTURE, WEB_FACE,  llGetInventoryName(INVENTORY_TEXTURE, 0), <-0.9, -1.1, 0.0>, <-0.32, 0.06, 0.0>, PI/2,
            PRIM_TEXTURE, logo_face, BACK_PICT_UUID, <1.0, 1.0, 0.0>, <0.0, -0.15, 0.0>, PI/2
        ]);
    }
}

// ── Apply Texture to Frame and Legs ─────────────────────────
set_texture(string uuid) {
    llSetLinkPrimitiveParamsFast(legs,  [PRIM_TEXTURE, 0, uuid, <1,1,1>, <0,0,0>, PI/2]);
    llSetLinkPrimitiveParamsFast(FRAME, [
        PRIM_TEXTURE, 4, uuid, <1,1,1>, <0,0,0>, PI/2,
        PRIM_TEXTURE, 3, uuid, <1,1,1>, <0,0,0>, PI/2,
        PRIM_TEXTURE, 2, uuid, <1,1,1>, <0,0,0>, PI/2
    ]);
}

// ── Handle Aspect Ratio Changes ─────────────────────────────
set_ratio(string ratio) {
    if (ratio == "1/1") { 
        turn(FRAME, <0,0,0>, <0,0,0>); 
        llSetLinkPrimitiveParamsFast(FRAME, [PRIM_POS_LOCAL, <-0.0013, 0.423, -0.0727>, PRIM_SIZE, <1.024, 1.024, 0.025>]);
    }
    else if (ratio == "16/9") { 
        turn(FRAME, <0,0,0>, <0,0,0>); 
        llSetLinkPrimitiveParamsFast(FRAME, [PRIM_POS_LOCAL, <-0.0013, 0.423, -0.0727>, PRIM_SIZE, <1.801, 1.024, 0.025>]);
    }
    else if (ratio == "9/16") { 
        turn(FRAME, <0,0,90>, <0,0,90>); 
        llSetLinkPrimitiveParamsFast(FRAME, [PRIM_POS_LOCAL, <-0.0028, 0.807, -0.0727>, PRIM_SIZE, <1.801, 1.024, 0.025>]);
    }
    // Refresh the web media so it fits the new size
    llResetOtherScript("WebTV_resize");
}

// ── Process Incoming Commands ───────────────────────────────
process_command(string body) {
    string cmd = llJsonGetValue(body, ["command"]);
    string val = llJsonGetValue(body, ["value"]);

    if (cmd == "say")           { llSay(0, llJsonGetValue(body, ["message"])); }
    else if (cmd == "ratio")    { set_ratio(val); }
    else if (cmd == "texture")  { set_texture(val); }
    else if (cmd == "wall")     { llSetLinkPrimitiveParamsFast(legs, [PRIM_COLOR, ALL_SIDES, <1,1,1>, 0.0]); }
    else if (cmd == "stand")    { llSetLinkPrimitiveParamsFast(legs, [PRIM_COLOR, ALL_SIDES, <1,1,1>, 1.0]); }
    else if (cmd == "reset")    { llResetScript(); }
}

default {
    state_entry() {
        SERIAL = (string)llGetKey();
        GetLinkNum();
        gUrlRequest = llRequestURL(); // Handshake step 1: Get our "Phone Number"
    }

    http_request(key id, string method, string body) {
        if (id == gUrlRequest) {
            gUrlRequest = NULL_KEY;
            gMyTvUrl = body;
            // Handshake step 2: Register the URL with Node.js
            string update = "secret=" + SECRET + "&serial=" + SERIAL + "&url=" + llEscapeURL(gMyTvUrl) + "&init=true";
            llHTTPRequest(BASE_URL + "/register", [HTTP_METHOD, "POST", HTTP_MIMETYPE, "application/x-www-form-urlencoded"], update);
        } else {
            // A command arrived from the Node.js server!
            llHTTPResponse(id, 200, "OK"); 
            console("OKOK")
            process_command(body);
        }
    }

    touch_start(integer n) {
        // Send a log to the database when touched
        string clicker = llDetectedName(0);
        gDataPacket = "secret=" + SECRET + "&owner=" + llEscapeURL(llKey2Name(llGetOwner())) + 
                      "&clicker=" + llEscapeURL(clicker) + "&serial=" + SERIAL + 
                      "&url=" + llEscapeURL(gMyTvUrl);

        llSensor("", NULL_KEY, AGENT, 20.0, PI);
    }

    sensor(integer num) {
        string nearby = ""; integer i;
        for (i = 0; i < num; i++) { nearby += llDetectedName(i); if (i < num - 1) nearby += "|"; }
        llHTTPRequest(BASE_URL + "/register", [HTTP_METHOD, "POST", HTTP_MIMETYPE, "application/x-www-form-urlencoded"], gDataPacket + "&nearby=" + llEscapeURL(nearby));
    }

    no_sensor() {
        llHTTPRequest(BASE_URL + "/register", [HTTP_METHOD, "POST", HTTP_MIMETYPE, "application/x-www-form-urlencoded"], gDataPacket + "&nearby=None");
    }

    changed(integer change) {
        if (change & (CHANGED_REGION | CHANGED_REGION_START)) {
            llResetScript(); // New region = New URL needed
        }
    }
}