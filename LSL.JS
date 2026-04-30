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
integer legs=1;
rotation rot;  
integer frame=2;

integer button_face=0;
integer screen_face=1;
integer frame_face=2;
integer logo_face=3;
integer back_face=4; 
integer web_face=5;

integer button;
integer menu;

float pulse = 0.5;
integer pulsing = FALSE;


set_model(string model)
{
    if(model=="model1")
    {
            list params = llGetLinkPrimitiveParams(frame, [PRIM_COLOR, back_face]);
            llSetLinkPrimitiveParamsFast(frame, [PRIM_COLOR, back_face, llList2Vector(params, 0), 0.8]);
            llSetLinkPrimitiveParamsFast(frame, [PRIM_COLOR, screen_face, llList2Vector(params, 0), 0.8]);
    }
    if(model=="model2")
    {
            list params = llGetLinkPrimitiveParams(frame, [PRIM_COLOR, back_face]);
            llSetLinkPrimitiveParamsFast(frame, [PRIM_COLOR, back_face, llList2Vector(params, 0), 1]);
            llSetLinkPrimitiveParamsFast(frame, [PRIM_COLOR, screen_face, llList2Vector(params, 0), 1]);
    }
}
set_ambilight(float intensity)
{
    // Cores sugeridas: 
    // <0.2, 0.4, 1.0> (Azul Neon)
    // <1.0, 1.0, 1.0> (Branco Quente)
    vector light_color = <0.2, 0.5, 1.0>; 
    llOwnerSay("LIGHT ON");
    float radius = 4.0;    // Raio menor para concentrar o efeito perto da parede
    float falloff = 2.0;   // Falloff máximo para a luz ser bem suave e dispersa

    if (intensity > 0.0)
    {
        // Aplicamos ao Link da carcaça ou ao Root
        llSetLinkPrimitiveParamsFast(LINK_THIS, [
            PRIM_POINT_LIGHT, TRUE, light_color, intensity, radius, falloff,
            // Opcional: Um leve brilho nas bordas externas (Glow)
            PRIM_GLOW, ALL_SIDES, 0.05 * intensity 
        ]);
    }
    else
    {
        llSetLinkPrimitiveParamsFast(LINK_THIS, [PRIM_POINT_LIGHT, FALSE, <0,0,0>, 0, 0, 0]);
    }
}
set_ratio(string ratio)
{
    // 1. Pegar o tamanho atual do frame
    list params = llGetLinkPrimitiveParams(frame, [PRIM_SIZE]);
    vector current_size = llList2Vector(params, 0);
    float h = current_size.y; // Usamos a altura (Y no frame) como base constante
    float new_w;              // Nova largura (X no frame)
    
    // 2. Determinar a nova largura baseada no ratio
    if (ratio == "16/9")      new_w = h * (16.0 / 9.0);
    else if (ratio == "21/9") new_w = h * (21.0 / 9.0);
    else if (ratio == "4/3")  new_w = h * (4.0 / 3.0);
    else if (ratio == "3/2")  new_w = h * (3.5 / 2.0); // Ajuste fino para o seu 3/2
    else if (ratio == "18/9") new_w = h * (18.0 / 9.0);
    else return; // Se não for um ratio conhecido, ignora

    // 3. Aplicar ao Frame
    // Mantemos a altura (Y) e profundidade (Z) e mudamos apenas a largura (X)
    llSetLinkPrimitiveParamsFast(frame, [PRIM_SIZE, <new_w, h, current_size.z>]);

    // 4. Ajustar as Pernas (Legs) proporcionalmente
    // Geralmente as pernas seguem a largura da TV. 
    // Baseado no seu código original, a largura da perna é ~63% da largura do frame
    float leg_w = new_w * 0.631; 
    list leg_params = llGetLinkPrimitiveParams(legs, [PRIM_SIZE]);
    vector current_leg = llList2Vector(leg_params, 0);
    llSetLinkPrimitiveParamsFast(legs, [PRIM_SIZE, <leg_w, current_leg.y, current_leg.z>]);

    // 5. Resetar o script de ajuste fino (opcional, dependendo de como ele funciona)
    llResetOtherScript("WebTV_resize");
    
    llOwnerSay("Ratio ajustado para " + ratio + " mantendo a altura de " + (string)h + "m");
}

set_preset(string mode)
{
     if (mode=="default")
    {
        llSetLinkPrimitiveParamsFast(frame,  [ PRIM_POS_LOCAL,<-0.004300, 1.340200, -0.230200>]);            
        llSetLinkPrimitiveParamsFast(frame,  [ PRIM_SIZE,<5.705921, 3.244647, 0.082034>]);
        llSetLinkPrimitiveParamsFast(legs,   [ PRIM_SIZE,<3.603157, 1.418333, 0.908407>]);
    }
         if (mode=="outside")
    {
        llSetLinkPrimitiveParamsFast(frame,  [ PRIM_POS_LOCAL,<-0.001800, 0.558400, -0.095900>]);            
        llSetLinkPrimitiveParamsFast(frame,  [ PRIM_SIZE,<2.377467, 1.351936, 0.034181>]);
        llSetLinkPrimitiveParamsFast(legs,   [ PRIM_SIZE,<1.501315, 0.590972, 0.378503>]);
    }
         if (mode=="cinema")
    {
        llSetLinkPrimitiveParamsFast(frame,  [ PRIM_POS_LOCAL,<-0.001300, 0.423000, -0.072700>]);            
        llSetLinkPrimitiveParamsFast(frame,  [ PRIM_SIZE,<1.801111, 1.024194, 0.025895>]);
        llSetLinkPrimitiveParamsFast(legs,   [ PRIM_SIZE,<1.137360, 0.447706, 0.286745>]);
    }
}

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


generate_serial()
{
    string owner_name = llKey2Name(llGetOwner());
    string obj_uuid   = (string)llGetKey();
    string unique_part = llToUpper(llGetSubString(obj_uuid, 24, 35));
    my_serial = "TV-" + owner_name + "-" + unique_part;
}
set_texture(string uuid)
{
    llSetLinkPrimitiveParamsFast(legs,  [PRIM_TEXTURE, 0, uuid, <1,1,1>, <0,0,0>, PI/2]);
    llSetLinkPrimitiveParamsFast(frame, [PRIM_TEXTURE, 1, uuid, <1,1,1>, <0,0,0>, PI/2]);
    llSetLinkPrimitiveParamsFast(frame, [PRIM_TEXTURE, 2, uuid, <1,1,1>, <0,0,0>, PI/2]);
    llSetLinkPrimitiveParamsFast(frame, [PRIM_TEXTURE, 3, uuid, <1,1,1>, <0,0,0>, PI/2]);
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


//////////////////////////////////////////////////////////////////////////////////
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

//////////////////////////////////////////////////////////////////////////////////
register_tv(key user_id, string trigger)
{

    last_clicker    = user_id;
    current_trigger = trigger;
    llOwnerSay("Ligando ao servidor... [" + trigger + "]");
    url_request = llRequestSecureURL();
}
//////////////////////////////////////////////////////////////////////////////////
vector HexToVector(string hex) {
    if (llGetSubString(hex, 0, 0) == "#") hex = llGetSubString(hex, 1, -1);
    integer r = (integer)("0x" + llGetSubString(hex, 0, 1));
    integer g = (integer)("0x" + llGetSubString(hex, 2, 3));
    integer b = (integer)("0x" + llGetSubString(hex, 4, 5));
    return <r / 255.0, g / 255.0, b / 255.0>;
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
        llClearLinkMedia(frame, web_face);
    }
}

default {

state_entry()
{
    generate_serial();
}

link_message(integer sn, integer num, string msg, key id)
{
    if(msg == "TV_ON")       init(id, "TV_ON");
    else if(msg == "TV_OFF") init(id, "TV_OFF");
}

touch_start(integer n)
{

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

        if (cmd=="legs" && val=="hide") { llSetLinkAlpha(legs, 0.0, ALL_SIDES);}
        if (cmd=="legs" && val=="show") {llSetLinkAlpha(legs, 1.0, ALL_SIDES);}
        
        if (cmd=="frame" && val=="hide") { llSetLinkPrimitiveParamsFast(frame, [ PRIM_COLOR, 1,<1.0,1.0,1.0>,0.0]);
                                           llSetLinkPrimitiveParamsFast(frame, [ PRIM_COLOR, 2,<1.0,1.0,1.0>,0.0]); 
                                           llSetLinkPrimitiveParamsFast(frame, [ PRIM_COLOR, 3,<1.0,1.0,1.0>,0.0]);
                                           llSetLinkPrimitiveParamsFast(frame, [ PRIM_COLOR, 0,<1.0,1.0,1.0>,0.0]); }
                                            
        if (cmd=="frame" && val=="show") { llSetLinkPrimitiveParamsFast(frame, [ PRIM_COLOR, 1,<1.0,1.0,1.0>,1.0]);
                                           llSetLinkPrimitiveParamsFast(frame, [ PRIM_COLOR, 2,<1.0,1.0,1.0>,1.0]);    
                                           llSetLinkPrimitiveParamsFast(frame, [ PRIM_COLOR, 3,<1.0,1.0,1.0>,1.0]); 
                                           llSetLinkPrimitiveParamsFast(frame, [ PRIM_COLOR, 0,<1.0,1.0,1.0>,1.0]); }
// SET MODEL 
        if (cmd == "model") 
        {
            if (val == "model1")       set_model("model1");
            else if (val == "model2")  set_model("model2");
            else if (val == "model3")  set_model("model3");
            llOwnerSay("Model Preset: " + val);
        }
// SET SCREEN RATIO                                           
        if (cmd=="ratio")  { set_ratio(val);  } 
//////////////////////////////////////////////////////////////////////
// SET TEXTURE        
        if (cmd=="texture") { set_texture(val); }
/////////////////////////////////////////////////////////////////////
// SET SCALE AND PRESET SCALE
        if (cmd=="SCALE") {
            llMessageLinked(LINK_THIS, 100, val, ""); 
            llOwnerSay("Resizing by " + val);
        }
        if (cmd == "PRESET") 
        {
            if (val == "house")         set_preset("default");
            else if (val == "outside")  set_preset("outside");
            else if (val == "cinema")   set_preset("cinema");
            llOwnerSay("Preset de ambiente aplicado: " + val);
        }
/////////////////////////////////////////////////////////////////////        
// SET LIGTH
        if (cmd == "LIGHT_ALL") {
        // Pegamos a cor (índice 1) e a intensidade (índice 2)
        vector g_LightColor = (vector)llList2String(parse, 1);
        float  g_LightIntensity = (float)llList2String(parse, 2);

        if (g_LightIntensity > 0.0) {
            llOwnerSay("Luz Ligada: Cor " + (string)g_LightColor + " Brilho: " + (string)g_LightIntensity);
            llSetLinkPrimitiveParamsFast(3, [PRIM_POINT_LIGHT, TRUE, g_LightColor, g_LightIntensity, 8.0, 1.5]);
            llSetLinkPrimitiveParamsFast(1, [PRIM_POINT_LIGHT, TRUE, g_LightColor, g_LightIntensity, 8.0, 1.5]);
        } else {
            llOwnerSay("Luz Desligada");
            llSetLinkPrimitiveParamsFast(3, [PRIM_POINT_LIGHT, FALSE, <0,0,0>, 0, 0, 0]);
            llSetLinkPrimitiveParamsFast(1, [PRIM_POINT_LIGHT, FALSE, <0,0,0>, 0, 0, 0]);
        }
    }

/////////////////////////////////////////////////////////////////
        
        // Muda a cor da carcaça traseira (logo_face)
        if (cmd == "back_color") {
            vector col = HexToVector(val);
            llSetLinkPrimitiveParamsFast(frame, [PRIM_COLOR, back_face, col, 1.0]);
            llOwnerSay("Cor da traseira atualizada.");
        }

        // Ajusta a transparência da traseira (Relativo +/-)
        if (cmd == "back_alpha") {
            list params = llGetLinkPrimitiveParams(frame, [PRIM_COLOR, back_face]);
            float currentAlpha = llList2Float(params, 1);
            float newAlpha = currentAlpha + (float)val;
            if(newAlpha > 1.0) newAlpha = 1.0; if(newAlpha < 0.0) newAlpha = 0.0;
            llSetLinkPrimitiveParamsFast(frame, [PRIM_COLOR, back_face, llList2Vector(params, 0), newAlpha]);
        }

        // Ajusta a transparência da tela (Relativo +/-)
        if (cmd == "screen_alpha") {
            list params = llGetLinkPrimitiveParams(frame, [PRIM_COLOR, screen_face]);
            float currentAlpha = llList2Float(params, 1);
            float newAlpha = currentAlpha + (float)val;
            if(newAlpha > 1.0) newAlpha = 1.0; if(newAlpha < 0.0) newAlpha = 0.0;
            llSetLinkPrimitiveParamsFast(frame, [PRIM_COLOR, screen_face, llList2Vector(params, 0), newAlpha]);
        }
        
        // Define transparência absoluta (usado pelo botão SOLID)
        if (cmd == "screen_alpha_set") {
            list params = llGetLinkPrimitiveParams(frame, [PRIM_COLOR, screen_face]);
            llSetLinkPrimitiveParamsFast(frame, [PRIM_COLOR, screen_face, llList2Vector(params, 0), (float)val]);
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

        llSetLinkMedia(frame, web_face, [
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
timer()
{
    pulse += 0.1;
    if (pulse > 1.0) pulse = 0.4;
    set_ambilight(pulse);
}
} // end default