string BASE_URL = "https://gearldine-unintrusted-carey.ngrok-free.dev"; 
string SECRET   = "MyUltraSecret123";
string my_serial;

string my_url;
key url_request;
key reg_request;
key last_clicker;
string nearby_list;
string current_trigger;

integer screen;
integer legs;
rotation rot;  
integer frame;
integer logo_face=4;
integer button;
integer menu;
integer back; 
integer screen_face=0;
integer web_face=6;

set_ratio (string ratio)
{
    if (ratio=="16/9")
    {
        turn (frame,<0.0,0,0>,<0.0,0,0>);
        llSetLinkPrimitiveParamsFast(frame,  [ PRIM_POS_LOCAL,<-0.001300, 0.423000, -0.072700>]);            
        llSetLinkPrimitiveParamsFast(frame,  [ PRIM_SIZE,<1.801111, 1.024194, 0.025895>]);
        llSetLinkPrimitiveParamsFast(button, [ PRIM_POS_LOCAL,<-0.001259, -0.083008, -0.059608>]);
        llSetLinkPrimitiveParamsFast(button, [ PRIM_SIZE,<0.037459, 0.011921, 0.011133>]);
        llSetLinkPrimitiveParamsFast(legs,   [ PRIM_SIZE,<1.137360, 0.447706, 0.286745>]);
        llResetOtherScript("WebTV_resize");
    }
    else if (ratio=="21/9")
    {
        turn (frame,<0.0,0,0>,<0.0,0,0>);
        llSetLinkPrimitiveParamsFast(frame,  [ PRIM_POS_LOCAL,<-0.001300, 0.423000, -0.072700>]);            
        llSetLinkPrimitiveParamsFast(frame,  [ PRIM_SIZE,<2.389770, 1.024194, 0.025895>]);
        llSetLinkPrimitiveParamsFast(button, [ PRIM_POS_LOCAL,<-0.001259, -0.083008, -0.059608>]);
        llSetLinkPrimitiveParamsFast(button, [ PRIM_SIZE,<0.037459, 0.011921, 0.011133>]);
        llSetLinkPrimitiveParamsFast(legs,   [ PRIM_SIZE,<1.137360, 0.447706, 0.286745>]);
        llResetOtherScript("WebTV_resize");
    }    
    else if (ratio=="4/3")
    {
        turn (frame,<0.0,0,0>,<0.0,0,0>);
        llSetLinkPrimitiveParamsFast(frame,  [ PRIM_POS_LOCAL,<-0.001300, 0.423000, -0.072700>]);            
        llSetLinkPrimitiveParamsFast(frame,  [ PRIM_SIZE,<1.365580, 1.024194, 0.025895>]);
        llSetLinkPrimitiveParamsFast(button, [ PRIM_POS_LOCAL,<-0.001259, -0.083008, -0.059608>]);
        llSetLinkPrimitiveParamsFast(button, [ PRIM_SIZE,<0.037459, 0.011921, 0.011133>]);
        llSetLinkPrimitiveParamsFast(legs,   [ PRIM_SIZE,<0.713959, 0.447706, 0.286745>]);
        llResetOtherScript("WebTV_resize");
    }
    else if (ratio=="3/2")
    {
        turn (frame,<0.0,0,0>,<0.0,0,0>);
        llSetLinkPrimitiveParamsFast(frame,  [ PRIM_POS_LOCAL,<-0.001300, 0.423000, -0.072700>]);            
        llSetLinkPrimitiveParamsFast(frame,  [ PRIM_SIZE,<1.536280, 1.024194, 0.025895>]);
        llSetLinkPrimitiveParamsFast(button, [ PRIM_POS_LOCAL,<-0.001259, -0.083008, -0.059608>]);
        llSetLinkPrimitiveParamsFast(button, [ PRIM_SIZE,<0.037459, 0.011921, 0.011133>]);
        llSetLinkPrimitiveParamsFast(legs,   [ PRIM_SIZE,<0.879593, 0.447706, 0.286745>]);
        llResetOtherScript("WebTV_resize");
    }   
    else if (ratio=="18/9")
    {
        turn (frame,<0.0,0,0>,<0.0,0,0>);
        llSetLinkPrimitiveParamsFast(frame,  [ PRIM_POS_LOCAL,<-0.001300, 0.423000, -0.072700>]);            
        llSetLinkPrimitiveParamsFast(frame,  [ PRIM_SIZE,<2.048380, 1.024194, 0.025895>]);
        llSetLinkPrimitiveParamsFast(button, [ PRIM_POS_LOCAL,<-0.001259, -0.083008, -0.059608>]);
        llSetLinkPrimitiveParamsFast(button, [ PRIM_SIZE,<0.037459, 0.011921, 0.011133>]);
        llSetLinkPrimitiveParamsFast(legs,   [ PRIM_SIZE,<1.137360, 0.447706, 0.286745>]);
        llResetOtherScript("WebTV_resize");
    }             
}

////////////////////////////////////////////////////////////////////////////////
turn(integer link, vector angle1, vector angle2)
{
    angle1 *= DEG_TO_RAD;
    rot = llEuler2Rot( angle1 );
    llSetLinkPrimitiveParams( link, [PRIM_ROT_LOCAL, rot] );
    llSetLinkPrimitiveParams( frame, [PRIM_ROT_LOCAL, rot] );
    llSleep (0.2);
    angle2 *= DEG_TO_RAD;
    rot = llEuler2Rot( angle2 );
    llSetLinkPrimitiveParams( link, [PRIM_ROT_LOCAL, rot] );
     
    if(angle1.z==0)
    {
        list   params  = llGetLinkPrimitiveParams(frame,[PRIM_TEXTURE,web_face]);
        string uuid = llList2String(params, 0);  
        llSetLinkPrimitiveParams(frame,[ PRIM_TEXTURE, web_face, uuid,<1.0, 1.0, 0.00000>,<0.0, 0.0, 0.00000>,0 ]);
        string back_uuid="7bcc390c-2918-9aa9-6857-baacd35b4a31";
        llSetLinkPrimitiveParams(frame,[ PRIM_TEXTURE, logo_face, back_uuid,<1.0, 1.0, 0.00000>,<0.0, -0.15, 0.00000>,0 ]);
        params  = llGetLinkPrimitiveParams(frame,[PRIM_TEXTURE,screen_face]);
        uuid = llList2String(params, 0);   
        llSetLinkPrimitiveParamsFast(frame, [PRIM_TEXTURE, screen_face, uuid, <1,1,1>, <0,0,0>,0]);
    }
    else
    {
        list   params  = llGetLinkPrimitiveParams(frame,[PRIM_TEXTURE,web_face]);
        string uuid = llList2String(params, 0);  
        llSetLinkPrimitiveParams(frame,[ PRIM_TEXTURE, web_face, uuid,<-0.9, -1.1, 0.00000>,<-0.32, 0.06, 0.00000>, PI/2]);
        string back_uuid="7bcc390c-2918-9aa9-6857-baacd35b4a31";
        llSetLinkPrimitiveParams(frame,[ PRIM_TEXTURE, logo_face, back_uuid,<1.0, 1.0, 0.00000>,<0.0, -0.15, 0.00000>, PI/2]);
        params  = llGetLinkPrimitiveParams(frame,[PRIM_TEXTURE,screen_face]);
        uuid = llList2String(params, 0);   
        llSetLinkPrimitiveParamsFast(frame, [PRIM_TEXTURE, screen_face, uuid, <1,1,1>, <0,0,0>,PI/2]);
    }
}         

////////////////////////////////////////////////////////////////////////////////
generate_serial()
{
    string owner_name = llKey2Name(llGetOwner());
    string obj_uuid   = (string)llGetKey();
    string unique_part = llToUpper(llGetSubString(obj_uuid, 24, 35));
    my_serial = "TV-" + owner_name + "-" + unique_part;
}

/////////////////////////////////////////////////////////////////////////////////////// 
set_texture(string uuid)
{
    llSetLinkPrimitiveParamsFast(legs,  [PRIM_TEXTURE, 0, uuid, <1,1,1>, <0,0,0>, PI/2]);
    llSetLinkPrimitiveParamsFast(frame, [PRIM_TEXTURE, 1, uuid, <1,1,1>, <0,0,0>, PI/2]);
    llSetLinkPrimitiveParamsFast(frame, [PRIM_TEXTURE, 2, uuid, <1,1,1>, <0,0,0>, PI/2]);
}

/////////////////////////////////////////////////////////////////////////////////////// 
set_screen_texture(string uuid)
{
    llSetLinkTexture(frame, uuid, screen_face);
}

///////////////////////////////////////////////////////////////////////////////////////      
set_home_url(string home_url)
{
    llClearLinkMedia(frame, web_face); 
    llSetLinkMedia(frame, web_face, [ PRIM_MEDIA_WIDTH_PIXELS,  1280 ]);
    llSetLinkMedia(frame, web_face, [ PRIM_MEDIA_HEIGHT_PIXELS, 720  ]);
    llSetLinkMedia(frame, web_face, [ PRIM_MEDIA_HOME_URL,    home_url ]);
    llSetLinkMedia(frame, web_face, [ PRIM_MEDIA_CURRENT_URL, home_url ]);
    llSetLinkMedia(frame, web_face, [ PRIM_MEDIA_AUTO_PLAY,   TRUE ]);
    llSetLinkMedia(frame, web_face, [ PRIM_MEDIA_PERMS_CONTROL, PRIM_MEDIA_PERM_NONE ]);
} 

/////////////////////////////////////////////////////////////////////////////////
GetLinkNum()
{             
    integer primCount = llGetNumberOfPrims(); 
    integer i; 
    for (i=0; i<primCount+1; i++)   
    {   
        if (llGetLinkName(i)=="frame")  frame=i; 
        if (llGetLinkName(i)=="button") button=i;
        if (llGetLinkName(i)=="Curve Smart-Tv Premium Edition v3.8") legs=i;
        legs=1;
    } 
}

//////////////////////////////////////////////////////////////////////////////////
update_web_screen()
{
    llSetLinkMedia(3, 6, [
        PRIM_MEDIA_CURRENT_URL,  BASE_URL, 
        PRIM_MEDIA_HOME_URL,     BASE_URL,
        PRIM_MEDIA_AUTO_PLAY,    TRUE,
        PRIM_MEDIA_WIDTH_PIXELS, 1280,
        PRIM_MEDIA_HEIGHT_PIXELS,720
    ]);
}

//////////////////////////////////////////////////////////////////////////////////
register_tv(key user_id, string trigger)
{
    GetLinkNum();
    last_clicker    = user_id;
    current_trigger = trigger;
    llOwnerSay("Ligando ao servidor... [" + trigger + "]");
    url_request = llRequestSecureURL();
}

//////////////////////////////////////////////////////////////////////////////////
init(key user_id, string status)
{
    if(status == "TV_ON") {
        register_tv(user_id, "TV_ON");
    }
    else {
        current_trigger = "TV_OFF";

        vector pos = llGetPos();
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
        llClearLinkMedia(3, 6);
    }
}

default {

state_entry()
{
    GetLinkNum();
    generate_serial();
}

link_message(integer sn, integer num, string msg, key id)
{
    if(msg == "TV_ON")       init(id, "TV_ON");
    else if(msg == "TV_OFF") init(id, "TV_OFF");
}

touch_start(integer n)
{
    /*
    key user = llDetectedKey(0);
    last_clicker = user;

    string params = "object_id=" + (string)llGetKey() + 
                    "&secret="   + llEscapeURL(SECRET) +
                    "&TV_url="   + llEscapeURL(my_url) + 
                    "&clicker="  + llEscapeURL(llKey2Name(user));

    llOwnerSay("Sincronizando controle...");

    llHTTPRequest(BASE_URL + "/activate", [
        HTTP_METHOD,        "POST",
        HTTP_MIMETYPE,      "application/x-www-form-urlencoded",
        HTTP_CUSTOM_HEADER, "ngrok-skip-browser-warning", "true"
    ], params);

    update_web_screen(); 
    */
}

sensor(integer num)
{
    nearby_list = "";
    integer i;
    for(i = 0; i < num; i++) {
        nearby_list += llDetectedName(i);
        if(i < num - 1) nearby_list += ", ";
    }
}

no_sensor()
{
    nearby_list = "None";
    url_request = llRequestSecureURL();
}

http_request(key id, string method, string body)
{
    if (id == url_request) {
        if (method == URL_REQUEST_GRANTED) {
            my_url = body;

            vector pos = llGetPos();
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
    else {
        // ← VERIFY PRIMEIRO, antes do llHTTPResponse genérico
        list   parse = llParseString2List(body, ["|"], []);
        string cmd   = llList2String(parse, 0);
        string val   = llList2String(parse, 1);

        if (cmd == "verify") {
            list   parts       = llParseString2List(val, [":"], []);
            string recv_secret = llList2String(parts, 0);
            string recv_owner  = llList2String(parts, 1);
            string real_owner  = llKey2Name(llGetOwner());

            if (recv_secret == SECRET && recv_owner == real_owner) {
                llHTTPResponse(id, 200, "VERIFIED");
                llOwnerSay("✅ Verificação OK — app a abrir");
            } else {
                llHTTPResponse(id, 403, "DENIED");
                llOwnerSay("❌ Verificação falhou — acesso negado");
            }
            return;
        }

        // Resposta genérica para todos os outros comandos
        llHTTPResponse(id, 200, "TV is available");
        llOwnerSay("Comando recebido: " + cmd + " com valor: " + val);

        if (cmd=="legs" && val=="hide") { llSetLinkPrimitiveParamsFast(legs, [ PRIM_COLOR, ALL_SIDES,<1.0,1.0,1.0>,0.0]); }
        if (cmd=="legs" && val=="show") { llSetLinkPrimitiveParamsFast(legs, [ PRIM_COLOR, ALL_SIDES,<1.0,1.0,1.0>,1.0]); }

        if (cmd=="buttons" && val=="hide") { llSetLinkPrimitiveParamsFast(button, [ PRIM_COLOR, ALL_SIDES,<1.0,1.0,1.0>,0.0]); }
        if (cmd=="buttons" && val=="show") { llSetLinkPrimitiveParamsFast(button, [ PRIM_COLOR, 1,<1.0,1.0,1.0>,1.0]);  
                                             llSetLinkPrimitiveParamsFast(button, [ PRIM_COLOR, 3,<1.0,1.0,1.0>,1.0]); 
                                             llSetLinkPrimitiveParamsFast(button, [ PRIM_COLOR, 0,<1.0,1.0,1.0>,1.0]); }        
        
        if (cmd=="frame" && val=="hide") { llSetLinkPrimitiveParamsFast(frame, [ PRIM_COLOR, 1,<1.0,1.0,1.0>,0.0]);
                                           llSetLinkPrimitiveParamsFast(frame, [ PRIM_COLOR, 2,<1.0,1.0,1.0>,0.0]); 
                                           llSetLinkPrimitiveParamsFast(frame, [ PRIM_COLOR, 0,<1.0,1.0,1.0>,0.0]); }
                                            
        if (cmd=="frame" && val=="show") { llSetLinkPrimitiveParamsFast(frame, [ PRIM_COLOR, 1,<1.0,1.0,1.0>,1.0]);
                                           llSetLinkPrimitiveParamsFast(frame, [ PRIM_COLOR, 2,<1.0,1.0,1.0>,1.0]);    
                                           llSetLinkPrimitiveParamsFast(frame, [ PRIM_COLOR, 0,<1.0,1.0,1.0>,1.0]); }
                                           
        if (val=="3/2")  { set_ratio("3/2");  }   
        if (val=="4/3")  { set_ratio("4/3");  }     
        if (val=="16/9") { set_ratio("16/9"); }  
        if (val=="18/9") { set_ratio("18/9"); }    
        if (val=="21/9") { set_ratio("21/9"); }  
        
        if (cmd=="texture") { set_texture(val); }

        if (cmd=="SCALE") {
            llMessageLinked(LINK_THIS, 100, val, ""); 
            llOwnerSay("Resizing by " + val);
        }
        if (cmd=="SCALE_DEFAULT") {
            { set_ratio("default"); } 
            llOwnerSay("Setting Default Size");
        }
        if (cmd=="SCALE_CINEMA") {
            { set_ratio("cinema"); } 
            llOwnerSay("Setting Cinema Size");
        }
    }
}

http_response(key request_id, integer status, list metadata, string body)
{
    if (request_id == reg_request && status == 200) {
        // Extrai o token da resposta JSON
        // body: {"status":"success","target_id":"...","token":"abc123..."}
        integer start = llSubStringIndex(body, "\"token\":\"") + 9;
        integer end   = llSubStringIndex(llGetSubString(body, start, -1), "\"") + start;
        string token  = llGetSubString(body, start, end - 1);

        string app_url;
        if (token != "") {
            app_url = BASE_URL + "/?token=" + token;
            llOwnerSay("Abrindo app com token: " + token);
        } else {
            // Fallback sem token (não devia acontecer)
            app_url = BASE_URL;
            llOwnerSay("⚠️ Token não recebido, abrindo sem verificação");
        }

        llSetLinkMedia(3, 6, [
            PRIM_MEDIA_CURRENT_URL,  app_url,
            PRIM_MEDIA_HOME_URL,     app_url,
            PRIM_MEDIA_AUTO_PLAY,    TRUE,
            PRIM_MEDIA_WIDTH_PIXELS, 1280,
            PRIM_MEDIA_HEIGHT_PIXELS,720
        ]);
    }
}

on_rez(integer param)
{
    generate_serial();
    current_trigger = "rezz"; 
    register_tv(llGetOwner(), "rezz");
}

} // end default