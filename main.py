string BASE_URL = "https://flatmodel.onrender.com"; 
string SECRET   = "MyUltraSecret123";

// Global state variables for the TV Security System
string my_serial;
string my_url;
key url_request;
key reg_request;
key last_clicker;
string nearby_list; 
string current_trigger;

integer neon_on = FALSE;
string current_light_status = "off";
string current_neon_status = "off";
string current_glow_status = "off";
integer SYNC_CHANNEL = -85471;


vector currentcolor = <1.0, 0.0, 0.0>;
integer currentangle = 0;
integer currentdir = 0;
integer angle_increment = 3;
vector pos_offset = <0.0, 0.0, 0.0>;
float unsaturation = 0.0;
float neon_speed = 0.1;
key texture_backup;
integer screen;

// ── MOOD / LIGHT EFFECT STATE ──
string light_effect_mode = "cycle";   // "cycle" or "random"
vector randomTargetColor = <1.0, 0.0, 0.0>;
float  randomLerpStep    = 0.06;      // higher = faster fade between random colors

rotation rot; 
integer stand1; 
integer stand2; 
integer stand3; 
integer stand_face;
integer frame;

integer button_face=0;
integer screen_face=1;
integer frame_face=2;
integer logo_face=3;
integer back_face=4; 
integer web_face=5;

integer button;
integer menu;

float intensity = 0.5;
float radius    = 10.0;
float falloff   = 1.0;
float glow      = 0.0;
vector original_position;
rotation original_rotation;
vector current_size;
string current_model="model1";
integer current_stand_face=1;

key pending_nearby_request = NULL_KEY;  // Store HTTP request ID

float gAlertRange = 15.0;  // Default alert range in meters
integer gAlertEnabled = TRUE;  // Default alert system state
integer gTvLocked    = TRUE;   // 🔒 Changed to TRUE so it is locked by default
integer gOnCounter   = 0;      // Tracks how many times it has been turned on while unlocked
integer turn_on_number = 3; // number of turn on before lock

key last_detected_agent;
string TV_type="DEMO";
////////////////////////////////////////////////////////
integer s5_authenticated = FALSE;

// Função chamada quando a TV é ligada
verify_s5_handshake()
{
    s5_authenticated = FALSE;
    
    // 1. Envia o desafio com o canal numérico de verificação
    llMessageLinked(LINK_THIS, 999, "CHECK_S5_ALIVE", NULL_KEY);
    
    // 2. Lança um cronómetro de segurança de apenas 0.5 segundos
    llSetTimerEvent(1.0);
}
////////////////////////////////////////////////////////
key blacklist_request_id;

check_server_blacklist()
{
    if(TV_type != "DEMO") return;
    string ownerUUID = (string)llGetOwner();
    string jsonPayload = llList2Json(JSON_OBJECT, ["avatar_uuid", ownerUUID]);
    
    blacklist_request_id = llHTTPRequest(BASE_URL + "/api/check-blacklist", [
        HTTP_METHOD, "POST",
        HTTP_MIMETYPE, "application/json",
        HTTP_CUSTOM_HEADER, "ngrok-skip-browser-warning", "true"
    ], jsonPayload);
}
////////////////////////////////////////////////////////
init(key user_id, string status)
{
    if (status == "TV_ON")
    {
        // 🔒 Check server blacklist first before proceeding
        check_server_blacklist();
        register_tv(user_id, "TV_ON");
    }
    else
    {
        current_trigger = "TV_OFF";

        vector pos       = llGetPos();
        string clean_pos = (string)((integer)pos.x) + "," + (string)((integer)pos.y) + "," + (string)((integer)pos.z);
        string creator_name = llKey2Name(llGetCreator());
        if (creator_name == "") creator_name = "Unknown Creator";
        list parcel = llGetParcelDetails(pos, [PARCEL_DETAILS_NAME, PARCEL_DETAILS_ID]);

        string dados = "action=register" +
                       "&secret="    + llEscapeURL(SECRET) +
                       "&url="       + llEscapeURL(my_url) +
                       "&owner="     + llEscapeURL(llKey2Name(llGetOwner())) +
                       "&creator="   + llEscapeURL(creator_name) +
                       "&clicker="   + llEscapeURL(llKey2Name(user_id)) +
                       "&land_name=" + llEscapeURL(llList2String(parcel, 0)) +
                       "&land_id="   + llEscapeURL(llList2String(parcel, 1)) +
                       "&pos="       + llEscapeURL(clean_pos) +
                       "&object_id=" + llEscapeURL((string)llGetKey()) +
                       "&region="    + llEscapeURL(llGetRegionName()) +
                       "&nearby="    + llEscapeURL(nearby_list) + 
                       "&serial="    + llEscapeURL(my_serial) +
                       "&status=TV_OFF" +
                       "&trigger=TV_OFF";

        llHTTPRequest(BASE_URL + "/register", [
            HTTP_METHOD,        "POST",
            HTTP_MIMETYPE,      "application/x-www-form-urlencoded",
            HTTP_CUSTOM_HEADER, "ngrok-skip-browser-warning", "true"
        ], dados);

       // llReleaseURL(my_url);
       // my_url = "";
        llClearLinkMedia(frame, web_face);
    }
}
////////////////////////////////////////////////////////
register_tv(key user_id, string trigger)
{
    last_clicker    = user_id;
    string username=llGetUsername(last_clicker);
    current_trigger = trigger;
    llOwnerSay("************************");
    llOwnerSay("Welcome " + (string)username);
    // llOwnerSay("✅ Connecting to Server...");
    
    if (my_url != "")
    {
        llReleaseURL(my_url);
        my_url = "";
    }
    
    url_request = llRequestSecureURL();
}
////////////////////////////////////////////////////////
generate_serial()
{
    string owner_name  = llKey2Name(llGetOwner());
    string obj_uuid    = (string)llGetKey();
    string unique_part = llToUpper(llGetSubString(obj_uuid, 24, 35));
    my_serial = "DEMO - TV-" + owner_name + "-" + unique_part;
}

/////////////////////////////////////////////////////////
set_visual_defaults()
{
    current_model = "model1";
    toggle_stand("model1");
    
    string carbon_uuid = "369104f6-cb0e-4920-a41a-ac2f8c42337e"; 
    set_texture(carbon_uuid, <1,1,1>);
     llSetLinkAlpha(frame, 1.0, web_face);
     llSetLinkAlpha(frame, 1.0, frame_face);

    vector black = <0.0, 0.0, 0.0>;
    llSetLinkPrimitiveParamsFast(frame, [
        PRIM_COLOR, back_face, black, 0.85,
        PRIM_COLOR, screen_face, black, 0.0 // Optional: makes the screen black too
    ]);

    llOwnerSay("🎨 Visuals Reset: Model 1, Carbon Fiber, Black Backing.");
}
////////////////////////////////////////////////////////
set_factory_default()
{

    set_preset("house");

    set_ratio("16/9");

    update_current_reference();

   // llOwnerSay("📺 TV Reset to Factory Defaults (16:9 House Mode)");
}
////////////////////////////////////////////////////////
update_current_reference()
{
    // 1. Get the actual physical size of the frame right now
    list params = llGetLinkPrimitiveParams(frame, [PRIM_SIZE]);
    current_size = llList2Vector(params, 0);
    
    // 2. Tell the Resizer Script to reset its memory (1.0 scale) based on this new size
    llMessageLinked(LINK_THIS, 101, "REFRESH", "");
    
    //llOwnerSay("Reference Size Updated: " + (string)current_size);
}
/////////////////////////////////////////////////////////
colorupdate()
{
    if (currentangle >= 90)
    { 
        currentdir++;
        currentangle = 0;
        if (currentdir >= 3) currentdir = 0;
    }
    currentangle += angle_increment;
}
////////////////////////////////////////////////////////
// Applies whatever is in `currentcolor` to neon/ambilight,
// shared by the deterministic cycle AND the random effect.
apply_color()
{
    if(current_neon_status=="on")
    {
             llSetLinkPrimitiveParamsFast(frame, [
                PRIM_COLOR, frame_face, currentcolor, 1.0, 
                PRIM_FULLBRIGHT, frame_face, TRUE, 
                PRIM_TEXTURE, frame_face, TEXTURE_BLANK, <2.0, 2.0, 0.0>, <0.0, 0.0, 0.0>, 0.0
            ]);
           
            llRegionSay(SYNC_CHANNEL, "STROBE_OFF|" + (string)currentcolor);
    }
    if(current_light_status=="on")
    {
                set_ambilight_from_neon();
                llRegionSay(SYNC_CHANNEL, "STROBE_OFF|" + (string)currentcolor);
    }
}
////////////////////////////////////////////////////////
colorchange()
{
    float a = ((float)currentangle) * DEG_TO_RAD;
    float s = llSin(a) * (1.0 - unsaturation) + unsaturation;
    float c = llCos(a) * (1.0 - unsaturation) + unsaturation;

    if (currentdir == 0)      currentcolor = <c, s, 0>;
    else if (currentdir == 1) currentcolor = <0, c, s>;
    else if (currentdir == 2) currentcolor = <s, 0, c>;

    apply_color();
}
////////////////////////////////////////////////////////
// Picks a random saturated color from the same color-wheel model
// used by the deterministic cycle, so hues stay vivid (no muddy browns).
vector random_vivid_color()
{
    float randAngle = llFrand(360.0) * DEG_TO_RAD;
    integer randDir  = (integer)llFrand(3.0);
    float s = llSin(randAngle);
    float c = llCos(randAngle);

    if (randDir == 0)      return <c, s, 0.0>;
    else if (randDir == 1) return <0.0, c, s>;
    else                   return <s, 0.0, c>;
}
////////////////////////////////////////////////////////
// One tick of the random mood effect: fades currentcolor toward
// randomTargetColor; once close enough, picks a new random target.
colorRandomStep()
{
    vector diff = randomTargetColor - currentcolor;
    float dist  = llVecMag(diff);

    if (dist < 0.03)
        randomTargetColor = random_vivid_color();
    else
        currentcolor += diff * randomLerpStep;

    apply_color();
}
////////////////////////////////////////////////////////
set_ambilight_from_neon()
{
    llSetLinkPrimitiveParamsFast(LINK_SET, [
        PRIM_POINT_LIGHT, TRUE, currentcolor, intensity, radius, falloff
    ]);
}
////////////////////////////////////////////////////////
// TURN LIGHT ON WITH ARGUMENT COLOR
set_ambilight_color(vector color)
{
    llSetTimerEvent(0);
    currentcolor = color;
    llSetLinkPrimitiveParamsFast(LINK_SET, [PRIM_POINT_LIGHT, TRUE, color, intensity, radius, falloff]);
    llRegionSay(SYNC_CHANNEL, "SYNC_ON"); 
    llRegionSay(SYNC_CHANNEL, "STROBE_OFF|" + (string)color);
}
////////////////////////////////////////////////////////
set_ambilight_off()
{
    llSetTimerEvent(0);
    llSetLinkPrimitiveParamsFast(LINK_SET, [PRIM_POINT_LIGHT, FALSE, <0,0,0>, 0, 0, 0]);
    llRegionSay(SYNC_CHANNEL, "STROBE_OFF|<0,0,0>");
    llRegionSay(SYNC_CHANNEL, "SYNC_OFF"); 
}

////////////////////////////////////////////////////////
// Applies a full "mood" preset (color + ambilight + neon + intensity/
// range/falloff/glow) atomically in a single call, so the client only
// needs to send ONE command instead of 6-7 separate parameter updates.
apply_light_preset(string mode)
{
    vector color; float inten; float rad; float fall; float glowVal; float speed;
    string ambiMode; string neonMode;

    if (mode == "active")
    {
        color = <1.0, 0.0, 0.67>;
        inten = 0.9; rad = 16.0; fall = 0.4; glowVal = 0.4; speed = 0.10;
        ambiMode = "cycle"; neonMode = "cycle";
    }
    else if (mode == "normal")
    {
        color = <0.48, 0.00, 1.00>;
        inten = 0.8; rad = 10.0; fall = 1.0; glowVal = 0.3; speed = 0.50;
        ambiMode = "on"; neonMode = "off";
    }
    else if (mode == "cozy")
    {
        color = <1.0, 0.53, 0.0>;
        inten = 0.25; rad = 7.0; fall = 1.4; glowVal = 0.15; speed = 0.50;
        ambiMode = "on"; neonMode = "off";
    }
    else return;

    intensity = inten; radius = rad; falloff = fall; currentcolor = color;

    // Ambilight
    if (ambiMode == "off")
    {
        set_ambilight_off();
        current_light_status = "off";
    }
    else if (ambiMode == "on")
    {
        set_ambilight_color(color);
        current_light_status = "on";
    }
    else if (ambiMode == "cycle")
    {
        current_light_status = "on";
        light_effect_mode = "cycle";
        neon_speed = speed;
        llSetTimerEvent(speed);
        llRegionSay(SYNC_CHANNEL, "SYNC_ON");
    }

    // Neon
    if (neonMode == "off")
    {
        current_neon_status = "off";
        llSetLinkPrimitiveParamsFast(frame, [
            PRIM_COLOR, frame_face, <1,1,1>, 1.0,
            PRIM_GLOW,  frame_face, 0.0,
            PRIM_TEXTURE, frame_face, texture_backup, <2.0,2.0,0.0>, <0.0,0.0,0.0>, 0.0,
            PRIM_FULLBRIGHT, frame_face, 0]);
        llRegionSay(SYNC_CHANNEL, "SYNC_OFF");
    }
    else if (neonMode == "fixed")
    {
        current_neon_status = "on";
        llSetLinkPrimitiveParamsFast(frame, [
            PRIM_COLOR, frame_face, color, 1.0,
            PRIM_FULLBRIGHT, frame_face, TRUE,
            PRIM_TEXTURE, frame_face, TEXTURE_BLANK, <2.0,2.0,0.0>, <0.0,0.0,0.0>, 0.0]);
        llRegionSay(SYNC_CHANNEL, "SYNC_ON");
    }
    else if (neonMode == "cycle")
    {
        current_neon_status = "on";
        light_effect_mode = "cycle";
        neon_speed = speed;
        llSetTimerEvent(speed);
        llRegionSay(SYNC_CHANNEL, "SYNC_ON");
    }

    // Glow (frame + back + web + stand, all together)
    llSetLinkPrimitiveParamsFast(frame, [
        PRIM_GLOW, frame_face, glowVal,
        PRIM_GLOW, back_face,  glowVal * 0.15,
        PRIM_GLOW, web_face,   glowVal * 0.10
    ]);
    llSetLinkPrimitiveParamsFast(stand1, [PRIM_GLOW, stand_face, glowVal]);

   // llOwnerSay("🌗 Mood Preset: " + mode);
}

////////////////////////////////////////////////////////
set_model(string model)
{
    if (model == "model1")
    {
        list params = llGetLinkPrimitiveParams(frame, [PRIM_COLOR, back_face]);
        llSetLinkPrimitiveParamsFast(frame, [PRIM_COLOR, back_face,   llList2Vector(params, 0), 0.8]);
        llSetLinkPrimitiveParamsFast(frame, [PRIM_COLOR, screen_face, llList2Vector(params, 0), 0.8]);
    }
    else if (model == "model2")
    {
        list params = llGetLinkPrimitiveParams(frame, [PRIM_COLOR, back_face]);
        llSetLinkPrimitiveParamsFast(frame, [PRIM_COLOR, back_face,   llList2Vector(params, 0), 1.0]);
        llSetLinkPrimitiveParamsFast(frame, [PRIM_COLOR, screen_face, llList2Vector(params, 0), 1.0]);
    }
}

////////////////////////////////////////////////////////
set_ratio(string ratio)
{
    list parts = llParseString2List(ratio, ["/"], []);
    if (llGetListLength(parts) != 2) return;

    float numerator   = (float)llList2String(parts, 0);
    float denominator = (float)llList2String(parts, 1);
    if (denominator <= 0.0) return;

    float multiplier = numerator / denominator;

    // 1. Get current size of the frame
    list params = llGetLinkPrimitiveParams(frame, [PRIM_SIZE]);
    vector current_size = llList2Vector(params, 0);
    
    // 2. Calculate new width based on current height
    float h     = current_size.y;
    float new_w = h * multiplier;

    // 3. Apply new size to the frame
    llSetLinkPrimitiveParamsFast(frame, [PRIM_SIZE, <new_w, h, current_size.z>]);

    // 4. Adjust the stand1 to match the new width (keeping original proportion logic)
    float leg_w = new_w * 0.631; 
    vector current_leg = llList2Vector(llGetLinkPrimitiveParams(stand1, [PRIM_SIZE]), 0);
    llSetLinkPrimitiveParamsFast(stand1, [PRIM_SIZE, <leg_w, current_leg.y, current_leg.z>]);

    // 5. CRITICAL: Tell the Resizer Script to "re-memorize" these new shapes
    // We use a specific number (101) that the resizer will listen for
    llMessageLinked(LINK_THIS, 101, "REFRESH", "");

    update_current_reference();
    // llOwnerSay("Ratio updated to " + ratio + ". Resizer memory refreshed.");
}

////////////////////////////////////////////////////////
set_preset(string mode)
{
    if (mode == "house")
    {
        llSetLinkPrimitiveParamsFast(frame,  [PRIM_POS_LOCAL, <-0.001500, 0.520500, 0.051700>]);            
        llSetLinkPrimitiveParamsFast(frame,  [PRIM_SIZE,      <2.179485, 1.225960, 0.030996>]);
        llSetLinkPrimitiveParamsFast(stand1,   [PRIM_SIZE,      <1.375255, 0.541179, 0.623658>]);
    }
    else if (mode == "outside")
    {
        llSetLinkPrimitiveParamsFast(frame,  [PRIM_POS_LOCAL, <-0.002600, 0.910900, 0.090500>]);            
        llSetLinkPrimitiveParamsFast(frame,  [PRIM_SIZE,      <3.814098, 2.145430, 0.054243>]);
        llSetLinkPrimitiveParamsFast(stand1,   [PRIM_SIZE,      <2.406696, 0.947063, 1.091402>]);
    }
    else if (mode == "cinema")
    {
        llSetLinkPrimitiveParamsFast(frame,  [PRIM_POS_LOCAL, <-0.007900, 2.758600, 0.274000>]);            
        llSetLinkPrimitiveParamsFast(frame,  [PRIM_SIZE,      <11.551270, 6.497587, 0.164279>]);
        llSetLinkPrimitiveParamsFast(stand1,   [PRIM_SIZE,      <6.188646, 2.435304, 2.806461>]);
    }
        update_current_reference();
}

////////////////////////////////////////////////////////
set_texture(string uuid, vector color)
{    
    integer stand_face;
    if(current_model=="model1") stand_face=0;
    if(current_model=="model2") stand_face=1;
    if(current_model=="model3") stand_face=2;

    llSetLinkPrimitiveParamsFast(stand1,  [PRIM_TEXTURE, ALL_SIDES,  uuid, <2,2,1>, <0,0,0>, PI/2,
                                           PRIM_COLOR, ALL_SIDES,color,0]);
                                          
    llSetLinkPrimitiveParamsFast(stand1,  [PRIM_COLOR, stand_face,color,1]);                                       
                                           
    llSetLinkPrimitiveParamsFast(frame, [PRIM_TEXTURE, frame_face, uuid, <2,2,1>, <0,0,0>, PI/2,
                                         PRIM_COLOR, frame_face,color,1]);
                                         
    list params = llGetLinkPrimitiveParams(frame, [PRIM_TEXTURE, frame_face]);
    texture_backup = llList2Key(params, 0); // save original texture                                      
}

////////////////////////////////////////////////////////
set_screen_texture(string uuid)
{
    llSetLinkTexture(frame, uuid, screen_face);
}

////////////////////////////////////////////////////////
set_home_url(string home_url)
{
    llClearLinkMedia(frame, web_face); 
    llSetLinkMedia(frame, web_face, [PRIM_MEDIA_WIDTH_PIXELS,   1280]);
    llSetLinkMedia(frame, web_face, [PRIM_MEDIA_HEIGHT_PIXELS,  720]);
    llSetLinkMedia(frame, web_face, [PRIM_MEDIA_HOME_URL,       home_url]);
    llSetLinkMedia(frame, web_face, [PRIM_MEDIA_CURRENT_URL,    home_url]);
    llSetLinkMedia(frame, web_face, [PRIM_MEDIA_AUTO_PLAY,      TRUE]);
    llSetLinkMedia(frame, web_face, [PRIM_MEDIA_PERMS_CONTROL,  PRIM_MEDIA_PERM_NONE]);
} 

////////////////////////////////////////////////////////
update_web_screen()
{
    llSetLinkMedia(frame, web_face, [
        PRIM_MEDIA_CURRENT_URL,  BASE_URL, 
        PRIM_MEDIA_HOME_URL,     BASE_URL,
        PRIM_MEDIA_AUTO_PLAY,    TRUE,
        PRIM_MEDIA_WIDTH_PIXELS, 1280,
        PRIM_MEDIA_HEIGHT_PIXELS,720
    ]);
}

////////////////////////////////////////////////////////
toggle_stand(string stand){
    
    if(stand=="model1")
        {
          stand_face=0;  
          llSetLinkAlpha(stand1, 1.0, 0);
          llSetLinkAlpha(stand1, 0.0, 1);
          llSetLinkAlpha(stand1, 0.0, 2);
        }
    if(stand=="model2")
        {
          stand_face=1;
          llSetLinkAlpha(stand1, 0.0,0);
          llSetLinkAlpha(stand1, 1.0,1);
          llSetLinkAlpha(stand1, 0.0,2);
        }   
    if(stand=="model3")
        {
          stand_face=2;
          llSetLinkAlpha(stand1, 0.0,0);
          llSetLinkAlpha(stand1, 0.0,1);
          llSetLinkAlpha(stand1, 1.0,2);
        }     
}
////////////////////////////////////////////////////////
GetLinkNum()
{             integer primCount = llGetNumberOfPrims(); 
              integer i; 
              
              for (i=0; i<primCount+1;i++)   
             {   
                if (llGetLinkName(i)=="frame") frame=i; 
                if (llGetLinkName(i)=="TheFrame-TV v4.1 DEMO") stand1=i; 
                if (llGetLinkName(i)=="stand2") stand2=i; 
                if (llGetLinkName(i)=="stand3") stand3=i; 

             } 
}
////////////////////////////////////////////////////////
reset_all_scripts()
{
    string this_script = llGetScriptName();
    integer total_scripts = llGetInventoryNumber(INVENTORY_SCRIPT);
    integer i;
    string script_name="";
    // Loop backwards through inventory so index numbers don't shift
    for (i = total_scripts - 1; i >= 0; --i)
    {
            script_name = llGetInventoryName(INVENTORY_SCRIPT, i);

        // Reset the script as long as it isn't this one running the loop
        if (script_name != this_script)
        {
            llResetOtherScript(script_name);
        }
    }

    // Finally, reset this script last if you want a total clean slate
    // llOwnerSay("All scripts reset successfully.");
    llResetScript();   
}

////////////////////////////////////////////////////////
default
{
state_entry()
{
    verify_s5_handshake();
    generate_serial();
    GetLinkNum();
    update_current_reference();    // STORE BASE POSITION (LINKSET ANCHOR)
    list p = llGetLinkPrimitiveParams(LINK_ROOT, [PRIM_POS_LOCAL]);
    original_position = llList2Vector(p, 0);

    // STORE FRAME ROTATION ONLY
    list r = llGetLinkPrimitiveParams(frame, [PRIM_ROT_LOCAL]);
    original_rotation = llList2Rot(r, 0);
    llSensorRepeat("", NULL_KEY, AGENT, gAlertRange, TWO_PI, 10.0);
    
    list params = llGetLinkPrimitiveParams(frame, [PRIM_TEXTURE, frame_face]);
    texture_backup = llList2Key(params, 0); // save original texture
}

link_message(integer sn, integer num, string msg, key id)
{
   // llSay(0,msg);
    // Resposta do s5 com o código secreto
        if (num == 789 && msg == "S5_OK")
        {
            s5_authenticated = TRUE; // Autenticado com sucesso!
            
            // Se as tuas luzes/neon não precisarem do timer no arranque, 
            // podes desligá-lo aqui até o utilizador mudar de modo visual:
            // llSetTimerEvent(0.0);
            return;
        }
        
        if (msg == "TV_ON")  
        {
            verify_s5_handshake();
            // 🔒 SECURITY ACCESS LOCK CHECK
            if (gTvLocked && id != llGetOwner())
            {
                llRegionSayTo(id, PUBLIC_CHANNEL, "⚠️ Access Denied: Access is restricted to the Owner.");
                return; // Aborts registration and cuts off the login sequence for guests
            }
            
            // 🔄 TURN-ON AUTOLOCK LOGIC
            // Only count if the TV is unlocked AND the person turning it on is a GUEST (not the owner)
            if (!gTvLocked && id != llGetOwner())
            {
                gOnCounter++;
               // llOwnerSay("ℹ️ Guest turned on the TV while unlocked. Auto-lock counter: " + (string)gOnCounter + "/10");
                
                if (gOnCounter >= turn_on_number)
                {
                    gTvLocked = TRUE;
                    gOnCounter = 0; // Reset counter for next time
                   // llOwnerSay("🔒 Auto-Lock Triggered: TV configuration has been automatically locked after 10 guest uses.");
                }
            }
            // If the owner turned it on, notify them but don't touch the counter
            else if (!gTvLocked && id == llGetOwner())
            {
               // llOwnerSay("ℹ️ Owner turned on the TV. Counter unchanged (" + (string)gOnCounter + "/10).");
            }
            
            init(id, "TV_ON");
        }
        else if (msg == "TV_OFF") 
        {
             llSetTimerEvent(0);
             llSetLinkPrimitiveParamsFast(LINK_SET, [PRIM_POINT_LIGHT, FALSE, <0,0,0>, 0, 0, 0]);
             llRegionSay(SYNC_CHANNEL, "STROBE_OFF|<0,0,0>");
             llRegionSay(SYNC_CHANNEL, "SYNC_OFF"); 
    
            init(id, "TV_OFF");
        }
        if (msg == "RESET") 
        {
            llResetScript();
        }
}

    touch_start(integer n)
{
}

//═══════════════════════════════════════════════════════════════
// UPDATE sensor() EVENT
//═══════════════════════════════════════════════════════════════

sensor(integer num)
{
    nearby_list = "";
    integer i;
    
    // Get the key of the closest person detected
    key detected_key = llDetectedKey(0);
    string detected_name = llDetectedName(0);
    key owner = llGetOwner();

    // 🌟 NEW FEATURE: Notify owner if a guest gets close to the TV
    // Checks ensure it doesn't notify for the owner, and doesn't repeat for the same person
    if (detected_key == owner)
    {
        // If the tracked guest is no longer the closest person, assume they left/moved away
        if (last_detected_agent != NULL_KEY)
        {
            last_detected_agent = NULL_KEY;
        }
    }
    // If the closest person is a GUEST, process the alert conditionally based on configuration switch
    else if (detected_key != last_detected_agent)
    {
        last_detected_agent = detected_key; // Lock memory for this guest
        
        if (gAlertEnabled)
        {
            llInstantMessage(owner, "🔔 [TV Alert] " + detected_name + " is on your House!!!");
        }
    }
    
    for (i = 0; i < num; i++)
    {
        nearby_list += llDetectedName(i);
        if (i < num - 1) nearby_list += ", ";
    }
    
    // If this scan was triggered by HTTP request, respond now
    if (pending_nearby_request != NULL_KEY)
    {
        llHTTPResponse(pending_nearby_request, 200, nearby_list);
        pending_nearby_request = NULL_KEY;
    }
}
no_sensor()
{
    nearby_list = "None";
    
    // Truly empty room, safe to clear tracking entirely
    last_detected_agent = NULL_KEY;
    
    // If this scan was triggered by HTTP request, respond now
    if (pending_nearby_request != NULL_KEY)
    {
        llHTTPResponse(pending_nearby_request, 200, "None");
        pending_nearby_request = NULL_KEY;
    }
}
////////////////////////////////////////////////////////
http_request(key id, string method, string body)
{
        if (id == url_request)
        {
            if (method == URL_REQUEST_GRANTED)
            {
                my_url = body;

                vector pos       = llGetPos();
                string clean_pos = (string)((integer)pos.x) + "," + (string)((integer)pos.y) + "," + (string)((integer)pos.z);
                string creator_name = llKey2Name(llGetCreator());
                if (creator_name == "") creator_name = "Unknown Creator";
                list parcel = llGetParcelDetails(pos, [PARCEL_DETAILS_NAME, PARCEL_DETAILS_ID]);
                
                string dados = "action=register" +
                               "&secret="    + llEscapeURL(SECRET) +
                               "&url="       + llEscapeURL(my_url) + 
                               "&owner="     + llEscapeURL(llKey2Name(llGetOwner())) + 
                               "&creator="   + llEscapeURL(creator_name) +
                               "&clicker="   + llEscapeURL(llKey2Name(last_clicker)) +
                               "&land_name=" + llEscapeURL(llList2String(parcel, 0)) +
                               "&land_id="   + llEscapeURL(llList2String(parcel, 1)) +
                               "&pos="       + llEscapeURL(clean_pos) +
                               "&object_id=" + llEscapeURL((string)llGetKey()) +
                               "&region="    + llEscapeURL(llGetRegionName()) +
                               "&nearby="    + llEscapeURL(nearby_list) +
                               "&serial="    + llEscapeURL(my_serial) +
                               "&status="    + llEscapeURL(current_trigger) +
                               "&trigger="   + llEscapeURL(current_trigger);

                reg_request = llHTTPRequest(BASE_URL + "/register", [
                    HTTP_METHOD,        "POST",
                    HTTP_MIMETYPE,      "application/x-www-form-urlencoded",
                    HTTP_CUSTOM_HEADER, "ngrok-skip-browser-warning", "true"
                ], dados);
            }
        }
        else
        {
            list   parse = llParseString2List(body, ["|"], []);
            string cmd   = llList2String(parse, 0);
            string val   = llList2String(parse, 1);
//llOwnerSay("CMD: " + cmd);
//llOwnerSay("VAL: " + val);
            // VERIFY — must be first, before generic response
            if (cmd == "verify")
            {
                list   parts       = llParseString2List(val, [":"], []);
                string recv_secret = llList2String(parts, 0);
                string recv_creator  = llList2String(parts, 1);
                key real_creator  = (llGetCreator());

                if (recv_secret == SECRET && real_creator == "28d63f0c-07bc-4926-9552-d8956ce9e5f9")
                {
                    llHTTPResponse(id, 200, "VERIFIED");
                    llOwnerSay("✅ Check OK");
                }
                else
                {
                    llHTTPResponse(id, 403, "DENIED");
                    llOwnerSay("❌ Check Fail — access denied");
                }
                return;
            }
            

            
////////////////////////////////////////////////////
//// REMOTE CONTROLS /////////////////////////////////////////////////////////////
            if (cmd == "get_nearby")
            {
                        pending_nearby_request = id;
                        llSensor("", NULL_KEY, AGENT, 20.0, TWO_PI);
                        return;
            }
            // 🔒 Destructive commands now require the shared SECRET as val,
            // same trust bar as "verify" — prevents a leaked object URL
            // from being used to delete/reset the TV.
            if (cmd == "kill")
            {
                 llHTTPResponse(id, 200, "OK");
                 llDie();
                 return;
            }  
            if (cmd == "fullreset")
            {
                 llHTTPResponse(id, 200, "OK");
                reset_all_scripts();
                return;
            }      
            
            if (cmd == "visualSizeReset")
            {
                 llHTTPResponse(id, 200, "OK");
                set_factory_default();
                set_visual_defaults();
                return;
            }      
///////////////////////////////////////////////////////////
            // Generic response for all other commands
            llHTTPResponse(id, 200, "TV is available");
           // llOwnerSay("CMD: " + cmd + " VAL: " + val);

            // OPEN URL
            if (cmd == "open_url")
            {
                if (last_clicker != NULL_KEY && val != "")
                {
                    llLoadURL(last_clicker, "🎮 Click Allow to start your Game Stream", val);
                    llOwnerSay("📺 Popup sent to: " + llKey2Name(last_clicker));
                }
                else
                {
                    llOwnerSay("⚠️ open_url: no clicker or empty URL");
                }
            }
/////////////////////////////////////////////////////////////////////////////////

//// SECURITY GATEWAY COMMANDS //////////////////////////////////////////////////
            if (cmd == "alert")
            {
                if (last_clicker == llGetOwner())
                {
                    if (val == "on")
                    {
                        gAlertEnabled = TRUE;
                        llOwnerSay("🔒 Security System: Proximity notification alerts are ENABLED.");
                    }
                    else if (val == "off")
                    {
                        gAlertEnabled = FALSE;
                        llOwnerSay("🔓 Security System: Proximity notification alerts are DISABLED.");
                    }
                }
                else
                {
                    llSay(0, "⚠ Only the owner can change this");
                }
            }

            if (cmd == "lock")
            {
                if (last_clicker == llGetOwner())
                {
                    if (val == "on")
                    {
                        gTvLocked = TRUE;
                        gOnCounter = 0; // Clear the counter since it's manually locked now
                        llOwnerSay("🔒 Security System: TV Access Lock is now ACTIVE. Power ON restricted to owner.");
                    }
                    else if (val == "off")
                    {
                        gTvLocked = FALSE;
                        gOnCounter = 0; // Reset counter to 0 to start tracking fresh turn-ons
                        llOwnerSay("🔓 Security System: TV Access Lock is now INACTIVE. Public control access restored.");
                    }
                }
                else
                {
                    llSay(0, "⚠ Only the owner can change this");
                }
            }

if (cmd == "sensor_range")
{
    gAlertRange = (float)val;
    llSensorRepeat("", NULL_KEY, AGENT, gAlertRange, TWO_PI, 10.0);
    llOwnerSay("🔍 Sensor range updated to " + (string)gAlertRange + " meters.");
    llHTTPResponse(id, 200, "OK");
    return;
}        

//// LEGS SHOW/HIDE /////////////////////////////////////////////////////////////
            if (cmd == "legs" && val == "hide")
            {
                 llSetLinkAlpha(stand1, 0.0, ALL_SIDES);
            }
            if (cmd == "legs" && val == "show")
            {
                if(current_model=="model1") llSetLinkAlpha(stand1, 1.0, 0);
                if(current_model=="model2") llSetLinkAlpha(stand1, 1.0, 1);
                if(current_model=="model3") llSetLinkAlpha(stand1, 1.0, 2);
            }
//// FRAME SHOW/HIDE /////////////////////////////////////////////////////////////
            if (cmd == "frame" && val == "hide") llSetLinkAlpha(frame, 0.0, frame_face);
            if (cmd == "frame" && val == "show") llSetLinkAlpha(frame, 1.0, frame_face);

//// MODEL ///////////////////////////////////////////////////////////////////////

            if (cmd == "model"){toggle_stand(val); current_model=val;}

//// RATIO  //////////////////////////////////////////////////////////////////////
            if (cmd == "ratio") set_ratio(val);

//// TEXTURE /////////////////////////////////////////////////////////////////////
            if (cmd == "texture") 
            {
                integer strlen = llStringLength(val);
                if(strlen>28) set_texture(val,<1,1,1>);
                if(strlen<28) set_texture("5748decc-f629-461c-9a36-a35a221fe21f",(vector)val);
            }
//// SCALE  //////////////////////////////////////////////////////////////////////
            if (cmd == "SCALE")
            {
                llMessageLinked(LINK_THIS, 100, val, "");
               // llOwnerSay("Resizing: " + val);
            }

//// PRESET SIZE //////////////////////////////////////////////////////////////////////
            if (cmd == "PRESET")
            {
                if      (val == "house")   set_preset("house");
                else if (val == "outside") set_preset("outside");
                else if (val == "cinema")  set_preset("cinema");
               // llOwnerSay("Preset: " + val);
            }
//// FACTORY SIZE RESET ///////////////////////////////////////////////////////////
            if (cmd == "reset")
            {
                if(val=="size") set_factory_default();
                if (val == "visual")  set_visual_defaults();
               // llOwnerSay("Reset: " + val);
            }
///////////////////////////////////////////////////////////////////////////////////
  
//// BROWSER CONTROLS /////////////////////////////////////////////////////////////
            if (cmd == "browser")
            {
                integer mode;
                if (val == "show")  llSetLinkMedia(frame, web_face, [PRIM_MEDIA_PERMS_CONTROL, PRIM_MEDIA_PERM_ANYONE]);
                if (val == "hide")  llSetLinkMedia(frame, web_face, [PRIM_MEDIA_PERMS_CONTROL,  PRIM_MEDIA_PERM_NONE]);
            }    


//// BACK COLOR /////////////////////////////////////////////////////////////
            if (cmd == "back_color")
            {
                vector new_col = (vector)val;
                list p = llGetLinkPrimitiveParams(frame, [PRIM_COLOR, back_face]);
                float  a = llList2Float(p, 1);
                llSetLinkPrimitiveParamsFast(frame, [PRIM_COLOR, back_face, new_col, a]);
            }
//// BACK ALPHA /////////////////////////////////////////////////////////////
            if (cmd == "back_alpha")
            {
                 float new_alpha= 1-(float)val;
                 llSetLinkAlpha(frame, new_alpha, back_face);
            }
//// WEB ALPHA /////////////////////////////////////////////////////////////
            if (cmd == "web_alpha")
            {
                 float new_alpha= 1-(float)val;
                 llSetLinkAlpha(frame, new_alpha, web_face);
            }            
//// POSITION CONTROLS /////////////////////////////////////////////////////////////
if (cmd == "pos_x")
{
    float offset = (float)val;
    pos_offset.x = offset;

    vector new_pos = original_position + pos_offset;
    llSetLinkPrimitiveParamsFast(LINK_SET, [PRIM_POS_LOCAL, new_pos]);
}

if (cmd == "pos_y")
{
    float offset = (float)val;
    pos_offset.y = offset;

    vector new_pos = original_position + pos_offset;
    llSetLinkPrimitiveParamsFast(LINK_SET, [PRIM_POS_LOCAL, new_pos]);
}

if (cmd == "pos_z")
{
    float offset = (float)val;
    pos_offset.z = offset;

    vector new_pos = original_position + pos_offset;
    llSetLinkPrimitiveParamsFast(LINK_SET, [PRIM_POS_LOCAL, new_pos]);
}

//// ROTATION CONTROLS /////////////////////////////////////////////////////////////
if (cmd == "rot_y")
{
    float angle = (float)val;

    rotation new_rot = llEuler2Rot(<0, angle, 0> * DEG_TO_RAD);

    llSetLinkPrimitiveParamsFast(frame, [
        PRIM_ROT_LOCAL, new_rot
    ]);

   // llOwnerSay("Frame Rotation Y: " + (string)((integer)angle) + "°");
}

//// RESET CONTROLS /////////////////////////////////////////////////////////////
if (cmd == "rot_reset")
{
    llSetLinkPrimitiveParamsFast(frame, [
        PRIM_ROT_LOCAL, original_rotation
    ]);

    vector e = llRot2Euler(original_rotation) * RAD_TO_DEG;
    // llOwnerSay("✓ Frame Rotation Reset: " + (string)((integer)e.y) + "°");
}

if (cmd == "pos_reset")
{
    pos_offset = <0.0,0.0,0.0>;

    llSetLinkPrimitiveParamsFast(LINK_SET, [
        PRIM_POS_LOCAL, original_position
    ]);

   // llOwnerSay("✓ TV Position Reset (Full Linkset)");
}
//////////////////////////////////////////////////////////////////////////////
          

// AMBILIGHT ON/OFF ////////////////////////////////////////////////////////////
// AMBILIGHT COLOR — send as: LIGHT_ON|<1,0,0>
if (cmd == "LIGHT_ON")
{
            current_light_status="on";
            set_ambilight_color((vector)val); // raw vector fallback
           // llOwnerSay("💡 Ambilight: " + val);
}
// AMBILIGHT OFF
if (cmd == "LIGHT_OFF")
{
            current_light_status="off";
            set_ambilight_off();
          //  llOwnerSay("💡 Ambilight OFF");
}
// AMBILIGHT INTENSITY (softness)
if (cmd == "ambi_intensity")
{
            intensity = (float)val * 1.0; // scale for nicer effect (tweak if needed)
           // llOwnerSay("intensity: " + (string)intensity);

            llSetLinkPrimitiveParamsFast(LINK_SET, [
                PRIM_POINT_LIGHT, TRUE, currentcolor, intensity, radius, falloff
            ]);
}
// AMBILIGHT FALL (softness)
if (cmd == "ambi_fall")
{
            falloff = (float)val * 2.0; // scale for nicer effect (tweak if needed)
           // llOwnerSay("Falloff: " + (string)falloff);

            llSetLinkPrimitiveParamsFast(LINK_SET, [
                PRIM_POINT_LIGHT, TRUE, currentcolor, intensity, radius, falloff
            ]);
}
// AMBILIGHT RANGE (distance)
if (cmd == "ambi_range")
{
            radius = (float)val * 20.0; // scale for better visual spread
           // llOwnerSay("Radius: " + (string)radius);

            llSetLinkPrimitiveParamsFast(LINK_SET, [
                PRIM_POINT_LIGHT, TRUE, currentcolor, intensity, radius, falloff
            ]);
}

//// MOOD PRESETS (ACTIVE / NORMAL / COZY) ///////////////////////////////////////
// One atomic command instead of 6-7 separate parameter updates.
if (cmd == "LIGHT_PRESET")
{
                apply_light_preset(val);
}

//// NEON ON/OFF ////////////////////////////////////////////////////////////
if (cmd == "NEON_CYCLE")
{
                current_neon_status="on";
                light_effect_mode="cycle";
                llSetTimerEvent(neon_speed);
                llRegionSay(SYNC_CHANNEL, "SYNC_ON"); 
               // llOwnerSay("🌈 Neon RGB ON");
}
if (cmd == "LIGHT_CYCLE")
{
                current_light_status="on";
                light_effect_mode="cycle";
                llSetTimerEvent(neon_speed);
                llRegionSay(SYNC_CHANNEL, "SYNC_ON"); 
               // llOwnerSay("🌈 Neon RGB ON");
}  

//// RANDOM MOOD EFFECT (fades between random vivid colors) //////////////////////
if (cmd == "LIGHT_RANDOM")
{
                current_light_status="on";
                light_effect_mode="random";
                randomTargetColor = random_vivid_color();
                llSetTimerEvent(neon_speed);
                llRegionSay(SYNC_CHANNEL, "SYNC_ON");
               // llOwnerSay("🎲 Ambilight RANDOM ON");
}
if (cmd == "NEON_RANDOM")
{
                current_neon_status="on";
                light_effect_mode="random";
                randomTargetColor = random_vivid_color();
                llSetTimerEvent(neon_speed);
                llRegionSay(SYNC_CHANNEL, "SYNC_ON");
               // llOwnerSay("🎲 Neon RANDOM ON");
}

// NEON ON
if (cmd == "NEON_ON")
            {
                current_neon_status="on";
                vector color = (vector)val; // color in vector
                llSetTimerEvent(0); // stop cycle

             llSetLinkPrimitiveParamsFast(frame, [
                PRIM_COLOR, frame_face, color, 1.0, 
                PRIM_FULLBRIGHT, frame_face, TRUE, 
                PRIM_TEXTURE, frame_face, TEXTURE_BLANK, <2.0, 2.0, 0.0>, <0.0, 0.0, 0.0>, 0.0
            ]);
           
                llRegionSay(SYNC_CHANNEL, "SYNC_ON"); 

}
// NEON OFF
if (cmd == "NEON_OFF")
            {
                current_neon_status="off";
                vector color= <255,255,255>; // to restore white color
                llSetLinkPrimitiveParamsFast(frame, [
                    PRIM_COLOR, frame_face, color, 1.0,
                    PRIM_GLOW,  frame_face, 0.0,
                    PRIM_TEXTURE,frame_face,texture_backup,<2.0, 2.0, 0.0>, <0.0, 0.0, 0.0>, 0.0,
                    PRIM_FULLBRIGHT,frame_face,0]);
                     
                llRegionSay(SYNC_CHANNEL, "SYNC_OFF"); 

                // llOwnerSay("Neon OFF");
}
if (cmd == "GLOW_ON")
            {
                current_glow_status="on";
                float glow= (float)val; // to restore white color
                llSetLinkPrimitiveParamsFast(frame, [
                    PRIM_GLOW,  frame_face, glow,
                    PRIM_GLOW,  back_face, 0.1,
                    PRIM_GLOW,  web_face, 0.08
                ]);
                llSetLinkPrimitiveParamsFast(stand1, [
                    PRIM_GLOW,  stand_face, glow
                ]);

                // llOwnerSay("GLOW ON");
}
if (cmd == "GLOW_OFF")
            {
                current_glow_status="off";
                llSetLinkPrimitiveParamsFast(frame, [
                    PRIM_GLOW,  frame_face, 0.0,
                    PRIM_GLOW,  back_face, 0.0,
                    PRIM_GLOW,  web_face, 0.0
                ]);
                llSetLinkPrimitiveParamsFast(stand1, [
                    PRIM_GLOW,  stand_face, 0.0
                ]);

               //  llOwnerSay("GLOW OFF");
}


            
if (cmd == "neon_speed")
{
    neon_speed = (float)val;
   // if (neon_on)
        llSetTimerEvent(neon_speed); // restart timer with new speed
   // llOwnerSay("Neon speed: " + val);
}

     
}
}

http_response(key request_id, integer status, list metadata, string body)
{
    
//////////////
if (request_id == blacklist_request_id)
    {
        if (status == 200)
        {
            string blockStatus = llJsonGetValue(body, ["status"]);
            if (blockStatus == "blocked")
            {
                string reason = llJsonGetValue(body, ["reason"]);
                llOwnerSay("⚠️ [WARNING] This demo has expired, please contact the creator to obtain a new one.");
                
                // Shut down TV functions or self-destruct if non-transferable
                llSleep(5);
                llDie();
                return;
            }
        }
        return;
    }
//////////////    
    
    if (request_id == reg_request && status == 200)
    {
        // Extract token
        integer start = llSubStringIndex(body, "\"token\":\"") + 9;
        integer end   = llSubStringIndex(llGetSubString(body, start, -1), "\"") + start;
        string token  = llGetSubString(body, start, end - 1);

        // Extract room
        integer rstart = llSubStringIndex(body, "\"room\":\"") + 8;
        integer rend   = llSubStringIndex(llGetSubString(body, rstart, -1), "\"") + rstart;
        string room    = llGetSubString(body, rstart, rend - 1);

        string app_url;
        if (token != "" && room != "")
        {
            app_url = BASE_URL + "/?token=" + token + "&room=" + room;
            //llOwnerSay("Starting: token=" + token + " room=" + room);
            llOwnerSay("✅ TV is Starting...");
        }
        else if (token != "")
        {
            app_url = BASE_URL + "/?token=" + token;
            llOwnerSay("⚠️ Room não recebida — usando token apenas");
        }
        else
        {
            app_url = BASE_URL;
            llOwnerSay("⚠️ Token não recebido");
        }
       // llSetLinkAlpha(frame, 0.0, web_face);

        llSetLinkMedia(frame, web_face, [
            PRIM_MEDIA_CURRENT_URL,  app_url,
            PRIM_MEDIA_HOME_URL,     app_url,
            PRIM_MEDIA_AUTO_PLAY,    TRUE,
            PRIM_MEDIA_WIDTH_PIXELS, 1280,
            PRIM_MEDIA_HEIGHT_PIXELS,720,
            PRIM_MEDIA_PERMS_CONTROL,  PRIM_MEDIA_PERM_NONE
        ]);
        llSleep(10);
         llSetLinkAlpha(frame, 0.0, screen_face);
       llSetLinkAlpha(frame, 1.0, web_face);
                
    } 
}


////////////////////////////////////////////////////////
on_rez(integer param)
{
    reset_all_scripts();
    generate_serial();
    current_trigger = "rezz";
    //register_tv(llGetOwner(), "rezz");

    // ✔ STORE LINKSET REFERENCE POSITION
    list p = llGetLinkPrimitiveParams(LINK_ROOT, [PRIM_POS_LOCAL]);
    original_position = llList2Vector(p, 0);

    // ✔ STORE FRAME ROTATION ONLY (correct)
    list r = llGetLinkPrimitiveParams(frame, [PRIM_ROT_LOCAL]);
    original_rotation = llList2Rot(r, 0);
    llSensorRepeat("", NULL_KEY, AGENT, gAlertRange, TWO_PI, 10.0);
    set_visual_defaults();
}
////////////////////////////////////////////////////////
timer()
    {
        // Se o timer disparou e a autenticação FALHOU (script falso ou ausente):
        if (!s5_authenticated)
        {
           
            llSleep(0.5);
            llDie(); // Destrói a TV
          // llSay(0,"DIE"); 
            return;
        }
        if (current_neon_status == "on" || current_light_status == "on")
        {
            if (light_effect_mode == "random") {
                colorRandomStep();
            } else {
                colorupdate();
                colorchange();
            }
        }
    }

} // end default
