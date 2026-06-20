//string BASE_URL = "https://flatmodel.onrender.com"; 
//string BASE_URL = "https://sltv.hallox2010.workers.dev"; 
string BASE_URL = "https://letdown-unheard-vaguely.ngrok-free.dev"; 
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

vector currentcolor = <1.0, 0.0, 0.0>;
integer currentangle = 0;
integer currentdir = 0;
integer angle_increment = 3;
vector pos_offset = <0.0, 0.0, 0.0>;
float unsaturation = 0.0;
float neon_speed = 0.1;
key texture_backup;
integer screen;

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

key pending_nearby_request = NULL_KEY;  // Store HTTP request ID

integer gAlertEnabled = TRUE;  // Default alert system state
integer gTvLocked    = FALSE; // Default access lock state
key last_detected_agent;


////////////////////////////////////////////////////////
init(key user_id, string status)
{
    if (status == "TV_ON")
    {
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

        llReleaseURL(my_url);
        my_url = "";
        llClearLinkMedia(frame, web_face);
    }
}
////////////////////////////////////////////////////////
register_tv(key user_id, string trigger)
{
    last_clicker    = user_id;
    current_trigger = trigger;
    llOwnerSay("Ligando ao servidor... [" + trigger + "]");
    url_request = llRequestSecureURL();
}
////////////////////////////////////////////////////////
generate_serial()
{
    string owner_name  = llKey2Name(llGetOwner());
    string obj_uuid    = (string)llGetKey();
    string unique_part = llToUpper(llGetSubString(obj_uuid, 24, 35));
    my_serial = "TV-" + owner_name + "-" + unique_part;
}

/////////////////////////////////////////////////////////
set_visual_defaults()
{
    current_model = "model1";
    toggle_stand("model1");
    
    string carbon_uuid = "369104f6-cb0e-4920-a41a-ac2f8c42337e"; 
    set_texture(carbon_uuid);
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

    llOwnerSay("📺 TV Reset to Factory Defaults (16:9 House Mode)");
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
colorchange()
{
    float a = ((float)currentangle) * DEG_TO_RAD;
    float s = llSin(a) * (1.0 - unsaturation) + unsaturation;
    float c = llCos(a) * (1.0 - unsaturation) + unsaturation;

    if (currentdir == 0)      currentcolor = <c, s, 0>;
    else if (currentdir == 1) currentcolor = <0, c, s>;
    else if (currentdir == 2) currentcolor = <s, 0, c>;
   
    if(current_neon_status=="on")
    {
                current_neon_status="on";
                llSetTimerEvent(0); // stop cycle

                list params = llGetLinkPrimitiveParams(frame, [PRIM_TEXTURE, frame_face]);
                texture_backup = llList2Key(params, 0); // save original texture   

             llSetLinkPrimitiveParamsFast(frame, [
                PRIM_COLOR, frame_face, currentcolor, 1.0, 
                PRIM_FULLBRIGHT, frame_face, TRUE, 
                PRIM_TEXTURE, frame_face, TEXTURE_BLANK, <2.0, 2.0, 0.0>, <0.0, 0.0, 0.0>, 0.0
            ]);
    }
    if(current_light_status=="on")
    {
    llRegionSay(-987654, (string)currentcolor);
    set_ambilight_from_neon();
    }
    
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
}
////////////////////////////////////////////////////////
set_ambilight_off()
{
    llSetTimerEvent(0);
    llSetLinkPrimitiveParamsFast(LINK_SET, [PRIM_POINT_LIGHT, FALSE, <0,0,0>, 0, 0, 0]);
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
    llOwnerSay("Ratio updated to " + ratio + ". Resizer memory refreshed.");
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
set_texture(string uuid)
{
    llSetLinkPrimitiveParamsFast(stand1,  [PRIM_TEXTURE, ALL_SIDES,  uuid, <2,2,1>, <0,0,0>, PI/2]);
    llSetLinkPrimitiveParamsFast(frame, [PRIM_TEXTURE, frame_face, uuid, <2,2,1>, <0,0,0>, PI/2]);
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
                if (llGetLinkName(i)=="NEW PLANE TV v4.9") stand1=i; 
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
    llOwnerSay("All scripts reset successfully.");
    llResetScript();   
}

////////////////////////////////////////////////////////
default
{
state_entry()
{
    generate_serial();
    GetLinkNum();
    update_current_reference();    // STORE BASE POSITION (LINKSET ANCHOR)
    list p = llGetLinkPrimitiveParams(LINK_ROOT, [PRIM_POS_LOCAL]);
    original_position = llList2Vector(p, 0);

    // STORE FRAME ROTATION ONLY
    list r = llGetLinkPrimitiveParams(frame, [PRIM_ROT_LOCAL]);
    original_rotation = llList2Rot(r, 0);
    llSensorRepeat("", NULL_KEY, AGENT, 10.0, TWO_PI, 10.0);
}

link_message(integer sn, integer num, string msg, key id)
{
        if (msg == "TV_ON")  
        {
            // 🔒 SECURITY ACCESS LOCK CHECK
            // Checks if the configuration system is locked and whether the avatar triggering TV_ON is NOT the owner
            if (gTvLocked && id != llGetOwner())
            {
                llRegionSayTo(id, PUBLIC_CHANNEL, "⚠️ Access Denied: The control configuration for this TV is currently locked by the owner.");
                return; // Aborts registration and cuts off the login sequence for guests
            }
            
            init(id, "TV_ON");
        }
        else if (msg == "TV_OFF") 
        {
            init(id, "TV_OFF");
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
            llInstantMessage(owner, "🔔 [TV Alert] " + detected_name + " está perto da sua TV!");
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
                    llOwnerSay("✅ Verificação OK — app a abrir");
                }
                else
                {
                    llHTTPResponse(id, 403, "DENIED");
                    llOwnerSay("❌ Verificação falhou — acesso negado");
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
            if (cmd == "kill")
            {
                llDie();
            }  
            if (cmd == "fullreset")
            {
                reset_all_scripts();
            }          
///////////////////////////////////////////////////////////
            // Generic response for all other commands
            llHTTPResponse(id, 200, "TV is available");
            llOwnerSay("CMD: " + cmd + " VAL: " + val);

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
            if (cmd == "lock")
            {
                if (val == "on")
                {
                    gTvLocked = TRUE;
                    llOwnerSay("🔒 Security System: TV Access Lock is now ACTIVE. Configurations restricted to owner.");
                }
                else if (val == "off")
                {
                    gTvLocked = FALSE;
                    llOwnerSay("🔓 Security System: TV Access Lock is now INACTIVE. Public control access restored.");
                }
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
            if (cmd == "texture") set_texture(val);

//// SCALE  //////////////////////////////////////////////////////////////////////
            if (cmd == "SCALE")
            {
                llMessageLinked(LINK_THIS, 100, val, "");
                llOwnerSay("Resizing: " + val);
            }

//// PRESET SIZE //////////////////////////////////////////////////////////////////////
            if (cmd == "PRESET")
            {
                if      (val == "house")   set_preset("house");
                else if (val == "outside") set_preset("outside");
                else if (val == "cinema")  set_preset("cinema");
                llOwnerSay("Preset: " + val);
            }
//// FACTORY SIZE RESET ///////////////////////////////////////////////////////////
            if (cmd == "reset")
            {
                if(val=="size") set_factory_default();
                if (val == "visual")  set_visual_defaults();
                llOwnerSay("Reset: " + val);
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

    llOwnerSay("Frame Rotation Y: " + (string)((integer)angle) + "°");
}

//// RESET CONTROLS /////////////////////////////////////////////////////////////
if (cmd == "rot_reset")
{
    llSetLinkPrimitiveParamsFast(frame, [
        PRIM_ROT_LOCAL, original_rotation
    ]);

    vector e = llRot2Euler(original_rotation) * RAD_TO_DEG;
    llOwnerSay("✓ Frame Rotation Reset: " + (string)((integer)e.y) + "°");
}

if (cmd == "pos_reset")
{
    pos_offset = <0.0,0.0,0.0>;

    llSetLinkPrimitiveParamsFast(LINK_SET, [
        PRIM_POS_LOCAL, original_position
    ]);

    llOwnerSay("✓ TV Position Reset (Full Linkset)");
}
//////////////////////////////////////////////////////////////////////////////
          

// AMBILIGHT ON/OFF ////////////////////////////////////////////////////////////
// AMBILIGHT COLOR — send as: LIGHT_ON|<1,0,0>
if (cmd == "LIGHT_ON")
{
            current_light_status="on";
            set_ambilight_color((vector)val); // raw vector fallback
            llOwnerSay("💡 Ambilight: " + val);
}
// AMBILIGHT OFF
if (cmd == "LIGHT_OFF")
{
            current_light_status="off";
            set_ambilight_off();
            llOwnerSay("💡 Ambilight OFF");
}
// AMBILIGHT INTENSITY (softness)
if (cmd == "ambi_intensity")
{
            intensity = (float)val * 1.0; // scale for nicer effect (tweak if needed)
            llOwnerSay("intensity: " + (string)intensity);

            llSetLinkPrimitiveParamsFast(LINK_SET, [
                PRIM_POINT_LIGHT, TRUE, currentcolor, intensity, radius, falloff
            ]);
}
// AMBILIGHT FALL (softness)
if (cmd == "ambi_fall")
{
            falloff = (float)val * 2.0; // scale for nicer effect (tweak if needed)
            llOwnerSay("Falloff: " + (string)falloff);

            llSetLinkPrimitiveParamsFast(LINK_SET, [
                PRIM_POINT_LIGHT, TRUE, currentcolor, intensity, radius, falloff
            ]);
}
// AMBILIGHT RANGE (distance)
if (cmd == "ambi_range")
{
            radius = (float)val * 20.0; // scale for better visual spread
            llOwnerSay("Radius: " + (string)radius);

            llSetLinkPrimitiveParamsFast(LINK_SET, [
                PRIM_POINT_LIGHT, TRUE, currentcolor, intensity, radius, falloff
            ]);
}

//// NEON ON/OFF ////////////////////////////////////////////////////////////
if (cmd == "neon" && val == "on")
{
                current_neon_status="on";
                llSetTimerEvent(neon_speed);
                llOwnerSay("🌈 Neon RGB ON");
}
  

// NEON ON
if (cmd == "NEON_ON")
            {
                current_neon_status="on";
                vector color = (vector)val; // color in vector
                llSetTimerEvent(0); // stop cycle

                list params = llGetLinkPrimitiveParams(frame, [PRIM_TEXTURE, frame_face]);
                texture_backup = llList2Key(params, 0); // save original texture   

             llSetLinkPrimitiveParamsFast(frame, [
                PRIM_COLOR, frame_face, color, 1.0, 
                PRIM_FULLBRIGHT, frame_face, TRUE, 
                PRIM_TEXTURE, frame_face, TEXTURE_BLANK, <2.0, 2.0, 0.0>, <0.0, 0.0, 0.0>, 0.0
            ]);
           
           //  llSetLinkPrimitiveParamsFast(LINK_SET, [
             //   PRIM_POINT_LIGHT, TRUE, color, intensity, radius, falloff]); // apply ligth to full link
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
                     
                //llSetLinkPrimitiveParamsFast(LINK_SET, [
                  //  PRIM_POINT_LIGHT, FALSE, color, intensity, radius, falloff]);
                    
                 llOwnerSay("Neon OFF");
}
if (cmd == "glow")
            {
                current_glow_status="on";
                float glow= (float)val; // to restore white color
                llSetLinkPrimitiveParamsFast(frame, [
                    PRIM_GLOW,  frame_face, glow,
                    PRIM_GLOW,  back_face, 0.1,
                    PRIM_GLOW,  web_face, 0.08
                ]);
                llSetLinkPrimitiveParamsFast(stand1, [
                    PRIM_GLOW,  ALL_SIDES, glow
                ]);

                 llOwnerSay("GLOW ON");
}


            
if (cmd == "neon_speed")
{
    neon_speed = (float)val;
   // if (neon_on)
        llSetTimerEvent(neon_speed); // restart timer with new speed
    llOwnerSay("Neon speed: " + val);
}

     
}
}

http_response(key request_id, integer status, list metadata, string body)
{
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
            llOwnerSay("Abrindo app: token=" + token + " room=" + room);
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
    generate_serial();
    current_trigger = "rezz";
    //register_tv(llGetOwner(), "rezz");

    // ✔ STORE LINKSET REFERENCE POSITION
    list p = llGetLinkPrimitiveParams(LINK_ROOT, [PRIM_POS_LOCAL]);
    original_position = llList2Vector(p, 0);

    // ✔ STORE FRAME ROTATION ONLY (correct)
    list r = llGetLinkPrimitiveParams(frame, [PRIM_ROT_LOCAL]);
    original_rotation = llList2Rot(r, 0);
    llSensorRepeat("", NULL_KEY, AGENT, 10.0, TWO_PI, 10.0);
}
////////////////////////////////////////////////////////
timer()
{
        if (current_neon_status=="on" || current_light_status=="on")
        {
            llSay(0,"updating");
            colorupdate();
            colorchange();
        }
}

} // end default