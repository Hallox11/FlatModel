

var crypto = require('crypto');



function check(hash)
{
var password= 'Touch';
// var hash="be427aa5f360100837af2cd98a731b5c960"

    var nonce=hash.slice(-3);
    console.log (nonce)

var x = password +":"+ nonce;

var ha1 = crypto.createHash('md5').update(x).digest('hex');

var check_ok;

var local_key = ha1 + nonce;

if(hash==local_key) check_ok = "valid";
else check_ok = "invalid";

//console.log("Local Key:" + local_key);
//console.log("To Check:" +hash);
//console.log("OK:" +check_ok);


return check_ok;

}

module.exports ={check}