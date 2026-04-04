
const screenshot = require('screenshot-desktop');


const socket = require('socket.io-client')('https://sl-share.herokuapp.com/');

function startShare()
{
       
  
    socket.emit("join-message", uuid);
    uuid="url2"
    console.log(' inside share room' + uuid);
    
      var interval = setInterval(function() {
      screenshot().then((img) => {
          var imgStr = new Buffer.from(img).toString('base64');
        
            var obj = {};
            obj.room = uuid;
            obj.image = imgStr;
            console.log(' inside loop')

            socket.emit("screen-data", JSON.stringify(obj));
      })
      
  }, 1000)

}
module.exports = {startShare}