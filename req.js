
const miniget = require("miniget");
const { JSDOM } = require("jsdom");
const fs = require('fs');
const request = require('request');


const https = require('https');

image='https://myemulator.online/wp-content/uploads/2020/09/puzzledp.zip';

let name = image.substring(53);




    
      //file removed
    
  request(image, {encoding: 'binary'}, function(error, response, body) {
    fs.writeFile('./public/games/arcade-games/zips/'+name, body, 'binary', function (err) {});
  
   

//  fs.rename('./public/games/arcade-games/jogo.zip', './public/games/arcade-games/'+name, function(err) {
  //  if ( err ) console.log('ERROR: ' + err);
  //});

});