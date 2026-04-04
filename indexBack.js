
const express = require('express');
const request = require('request');
const user=require('./user');
const app = express();
const ejs = require('ejs');
const http = require('http');
var path = require('path');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const screenshot = require('screenshot-desktop');
const { v4: uuidv4 } = require('uuid');
const url = require('url');


const PORT = process.env.PORT || 3000;

const YouTube = require('./public/lib/youtube');
const  XVDL  = require('./public/js/main');

const fs = require('fs');
const bodyParser = require('body-parser');

const voyApi=require('./public/js/voypics_scrap');
const Scopit=require('./public/js/scopit');
const Sl=require('./public/js/sl');
const EroticMovies=require('./public/js/erotic-movies');
const XeMovies=require('./public/js/xemovie');
const ClipGames=require('./public/js/clip-games');
const ArcadeGames=require('./public/js/arcade-games');

const Check=require('./public/js/check');

const Share=require('./public/js/share');


//app.use(bodyParser.urlencoded({extended:true}));
//app.use(bodyParser.json());

app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true, parameterLimit: 50000}));

// Render static files
app.use(express.static('public'));
// Set the view engine to ejs
app.set('view engine', 'ejs');



// *** GET Routes - display pages ***
// Root Route
app.get('/', function (req, res) {
    res.render('pages/index');
});
app.get('/display', function (req, res) {
  res.render('pages/display');
});
// OPEN XXX VER ENTRY MENU
app.get('/index-xxx', function (req, res) {
  res.render('pages/index-xxx');
});



// OPEN PG VER ENTRY MENU
app.get('/teste', function (req, res) {
 
  const queryObject = url.parse(req.url, true).query;
    console.log(queryObject);
 // res.render('pages/index-pg');  
});




// OPEN XXX VER CHECK MENU
app.get('/xxx-ver-check', function (req, res) {
  res.render('pages/xxx-ver-check');
});
// OPEN XXX VER INDEX MENU
app.get('/xxx-ver-index', function (req, res) {
  res.render('pages/xxx-ver-index');
});
////////////////////////////////////////////////////////////////////////////
// SETTINGS MENU
app.get('/settings', function (req, res) {
  res.render('pages/settings');
});
////////////////////////////////////////////////////////////////////////////
// OPEN RADIOS MENU
app.get('/radios-menu', function (req, res) {
  res.render('pages/radios-menu');
});
// OPEN TOP RADIOS MENU
app.get('/radios/top-radio', function (req, res) {
  res.render('pages/radios/top-radio');
});
// OPEN SL RADIOS MENU
app.get('/radios/sl-radio', function (req, res) {
   res.render('pages/radios/sl-radio');
});
// OPEN INTER RADIOS
app.get('/radios/inter-radio', function (req, res) {
    res.render('pages/radios/inter-radio');
 });
// OPEN SL RADIOS PLAYER
app.get('/radios/sl_radio_player', function (req, res) {
    res.render('pages/radios/sl_radio_player');
 });
// OPEN PT RADIOS 
app.get('/radios/pt', function (req, res) {
  res.render('pages/radios/pt');
});
// OPEN NZ RADIOS 
app.get('/radios/nz', function (req, res) {
  res.render('pages/radios/nz');
});
// OPEN ES RADIOS 
app.get('/radios/es', function (req, res) {
  res.render('pages/radios/es');
});
// OPEN BR RADIOS 
app.get('/radios/br', function (req, res) {
  res.render('pages/radios/br');
});
// OPEN UK RADIOS 
app.get('/radios/uk', function (req, res) {
  res.render('pages/radios/uk');
});
// OPEN FR RADIOS 
app.get('/radios/fr', function (req, res) {
  res.render('pages/radios/fr');
});
// OPEN IT RADIOS 
app.get('/radios/it', function (req, res) {
  res.render('pages/radios/it');
});
// OPEN MR RADIOS 
app.get('/radios/mr', function (req, res) {
  res.render('pages/radios/mr');
});
//////////////////////////////////////////////////////////////////////////
// OPEN MUSIC MENU
 app.get('/music-menu', function (req, res) {
    res.render('pages/music-menu');
 });
//OPEN MUSIC SLIDSHOW MENU
app.get('/music/ytmusic', function (req, res) {
  res.render('pages/music/ytmusic');
});
//OPEN MUSIC PLAYER MENU
app.get('/music/tvytube', function (req, res) {
  res.render('pages/music/tvytube');
});
 
//////////////////////////////////////////////////////////////////////////
//OPEN MOVIES MENU
 app.get('/movies-menu', function (req, res) {
  res.render('pages/movies-menu');
});
//OPEN MOVIES SLIDSHOW MENU
app.get('/movies/ytmovies', function (req, res) {
  res.render('pages/movies/ytmovies');
});
//OPEN MOVIES PLAYER MENU
app.get('/movies/tvytube', function (req, res) {
  res.render('pages/movies/tvytube');
});
//////////////////////////////////////////////////////////////////////////
//OPEN COPYRIGHT MOVIES MENU
app.get('/movies/copyright', function (req, res) {
  res.render('pages/movies/copyright');
});
//////////////////////////////////////////////////////////////////////////
//OPEN SCOPIT MENU
app.get('/scopit/scopit', function (req, res) {
  res.render('pages/scopit/scopit');
});
//////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////
//HELP MENU
app.get('/help', function (req, res) {
  res.render('pages/help');
});
//////////////////////////
//HELP VIDEOMENU
app.get('/playHtml5', function (req, res) {
  res.render('pages/playHtml5');
});
//////////////////////////////////////////////////////////////////////////
//OPEN BROWSERS MENU
app.get('/browsers', function (req, res) {
  res.render('pages/browsers');
});
//////////////////////////////////////////////////////////////////////////
//OPEN GAMES MENU
app.get('/games-menu', function (req, res) {
  res.render('pages/games-menu');
});
//////////////////////////////////////////////////////////////////////////
//OPEN ARCADE GAMES MENU
app.get('/games/arcade-games/arcade-games', function (req, res) {
  res.render('pages/games/arcade-games/arcade-games');
});
//////////////////////////////////////////////////////////////////////////
//OPEN ARCADE GAMES TV MENU
app.get('/games/arcade-games/tv-arcade-games', function (req, res) {
  res.render('pages/games/arcade-games/tv-arcade-games');
});
//////////////////////////////////////////////////////////////////////////
//OPEN CLIP GAMES MENU
app.get('/games/clip-games/clip-games', function (req, res) {
  res.render('pages/games/clip-games/clip-games');
});
//////////////////////////////////////////////////////////////////////////
//OPEN CLIP GAMES TV MENU
app.get('/games/clip-games/tv-clip-games', function (req, res) {
  res.render('pages/games/clip-games/tv-clip-games');
});
//////////////////////////////////////////////////////////////////////////
//OPEN XE MOVIES MENU
app.get('/movies/xemovie/xemovie', function (req, res) {
  res.render('pages/movies/xemovie/xemovie');
});
//////////////////////////////////////////////////////////////////////////
//OPEN XE MOVIES PLAYER MENU
app.get('/movies/xemovie/xemovietv', function (req, res) {
  res.render('pages/movies/xemovie/xemovietv');
});
//////////////////////////////////////////////////////////////////////////
//OPEN EROTIC MOVIES MENU
app.get('/xxx/eroticMovies/erotic-movies', function (req, res) {
  res.render('pages/xxx/eroticMovies/erotic-movies');
});
//OPEN EROTIC MOVIES PLAYER MENU
app.get('/XXX/eroticMovies/tvmovie', function (req, res) {
  res.render('pages/xxx/eroticMovies/tvmovie');
});
//////////////////////////////////////////////////////////////////////////
//OPEN FLICKR MENU
app.get('/flickr', function (req, res) {
  res.render('pages/flickr');
});
//////////////////////////////////////////////////////////////////////////
//OPEN SHARE MENU
app.get('/share-menu', function (req, res) {
  res.render('pages/share-menu');
});
//////////////////////////////////////////////////////////////////////////
//OPEN SECOND LIFE MENU
app.get('/sl/details', function (req, res) {
  res.render('pages/sl/details');
});
//////////////////////////////////////////////////////////////////////////
//OPEN TWITTER MENU
app.get('/sltwiter/sltwiter', function (req, res) {
  res.render('pages/sltwiter/sltwiter');
});
//////////////////////////////////////////////////////////////////////////
//OPEN TWITTER1 MENU
app.get('/sltwiter/sltwiter1', function (req, res) {
  res.render('pages/sltwiter/sltwiter1');
});
//////////////////////////////////////////////////////////////////////////
//OPEN TWITTER2 MENU
app.get('/sltwiter/sltwiter2', function (req, res) {
  res.render('pages/sltwiter/sltwiter2');
});
//////////////////////////////////////////////////////////////////////////
//OPEN TWITTER3 MENU
app.get('/sltwiter/sltwiter3', function (req, res) {
  res.render('pages/sltwiter/sltwiter3');
});
//////////////////////////////////////////////////////////////////////////
//OPEN TWITTER4 MENU
app.get('/sltwiter/sltwiter4', function (req, res) {
  res.render('pages/sltwiter/sltwiter4');
});



//////////////////////////////////////////////////////////////////////////
//OPEN YOUTUBE SLIDESHOW MENU
app.get('/youtube/yt', function (req, res) {
  res.render('pages/youtube/yt');
});
//OPEN YOUTUBE PLAYER MENU
app.get('/youtube/tvytube', function (req, res) {
  res.render('pages/youtube/tvytube');
});
//////////////////////////////////////////////////////////////////////////
//OPEN XXX-BROSWERS CHECK MENU
app.get('/xxx-browsers', function (req, res) {
  res.render('pages/xxx-browsers');
});
///////////////////////////////////
//////////////////////////////////////////////////////////////////////////
//OPEN XXX CHECK MENU
app.get('/xxx-check', function (req, res) {
  res.render('pages/xxx-check');
});
///////////////////////////////////
//OPEN XXX INDEX MENU
app.get('/xxx-index', function (req, res) {
  res.render('pages/xxx-index');
});
//////////////////////////////////////////////////////////////////////////
//OPEN XXX XVIDEOS MENU
app.get('/xvid/xvid', function (req, res) {
  res.render('pages/xvid/xvid');
});
///////////////////////////////////
//OPEN XXX XVIDEOS PLAYER MENU
app.get('/xvid/tvxvid', function (req, res) {
  res.render('pages/xvid/tvxvid');
});
//////////////////////////////////////////////////////////////////////////
//OPEN VOY PICS MENU
app.get('/voypics/voypics', function (req, res) {
    res.render('pages/voypics/voypics'); // render of voypics.ejs 
});
//////////////////////////////////////
//OPEN VOYPICS THUMBS
app.post('/getThumbs', function (req, res) {
    
     var videosArray=[];
    
     voyApi.getThumbs(videosArray, 1, function (error, data){
              videosArray=(data);
            voyApi.getThumbs(videosArray, 2, function (error, data){
              videosArray=(data);
            voyApi.getThumbs(videosArray, 3, function (error, data){
              videosArray=(data);
            voyApi.getThumbs(videosArray, 4, function (error, data){
              videosArray=(data);
            voyApi.getThumbs(videosArray, 5, function (error, data){
              videosArray=(data);
            voyApi.getThumbs(videosArray, 6, function (error, data){
              videosArray=(data);
            voyApi.getThumbs(videosArray, 7, function (error, data){
              videosArray=(data);
            voyApi.getThumbs(videosArray, 8, function (error, data){
              videosArray=(data);
            voyApi.getThumbs(videosArray, 9, function (error, data){
              videosArray=(data);
            voyApi.getThumbs(videosArray, 10, function (error, data){
              videosArray=(data);
            voyApi.getThumbs(videosArray, 11, function (error, data){
              videosArray=(data);
            voyApi.getThumbs(videosArray, 12, function (error, data){
              videosArray=(data);
            voyApi.getThumbs(videosArray, 13, function (error, data){
              videosArray=(data);
            voyApi.getThumbs(videosArray, 14, function (error, data){
              videosArray=(data);
            voyApi.getThumbs(videosArray, 15, function (error, data){
              videosArray=(data);
            voyApi.getThumbs(videosArray, 16, function (error, data){
              videosArray=(data);
            voyApi.getThumbs(videosArray, 17, function (error, data){
              videosArray=(data);
            voyApi.getThumbs(videosArray, 18, function (error, data){
              videosArray=(data);
           
                         
        const resultTxt=(JSON.stringify(videosArray, null, 2));
       
         fs.writeFile('./public/voypics/voythumbs.txt', resultTxt, function (err) {
           if (err) throw err;
           console.log('Saved!');
           res.end('done');
         }); // ENDS FILE WRITE     
    })})})})})})})})})})})})})})})})})})
}) // END POST GETTHUMBS
///////////////////////////////////////
//OPEN VOYPICS PICS
app.post('/getPics', function (req, res) {
      var picUrl=req.body.url; // get the url send by the post on voypics.ejs file
      voyApi.getPics(picUrl, function (error, data){
  
        const resultTxt=(JSON.stringify(data, null, 2));
        fs.writeFile('./public/voypics/voypics.txt', resultTxt, function (err) {
            if (err) throw err;
            console.log('Saved!');
            res.end('done');
          }); // ENDS FILE WRITE
      })
}); // END POST GETPICS
//////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////
//OPEN VOY BLACK MENU
app.get('/voyhd/black/black', function (req, res) {
  res.render('pages/voyhd/black/black'); // render of voypics.ejs 
});
//////////////////////////////////////
//OPEN WBLACK pics
app.post('/getWBPics', function (req, res) {

  var videosArray=[];
  var url=req.body.url ;

  voyApi.getBWPics( url, function (error, data){
           videosArray=(data);
      
         
                      
     const resultTxt=(JSON.stringify(videosArray, null, 2));
    
      fs.writeFile('./public/voyhd/black/xpics.txt', resultTxt, function (err) {
        if (err) throw err;
        console.log('Saved!');
        res.end('done');
      }); // ENDS FILE WRITE     
 })
}) // END POST GET BLACK PICS
//////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////
//OPEN REDBUST MENU
app.get('/xxx/redbust/redbust', function (req, res) {
  res.render('pages/xxx/redbust/redbust'); // render of voypics.ejs 
});      
//////////////////////////////////////
//OPEN REDBUST PICS
app.post('/getRedPics', function (req, res) {

  var videosArray=[];
  var url=req.body.url ;

  voyApi.getRedPics( url, function (error, data){
           videosArray=(data);
      
         
                      
     const resultTxt=(JSON.stringify(videosArray, null, 2));
    
      fs.writeFile('./public/xxx/redbust/red_pics.txt', resultTxt, function (err) {
        if (err) throw err;
        console.log('Saved!');
        res.end('done');
      }); // ENDS FILE WRITE     
 })
}) // END POST REDBUST PICS  
//////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////
//OPEN EPORNER MENU
app.get('/xxx/eporner/eporner', function (req, res) {
  res.render('pages/xxx/eporner/eporner'); // render of voypics.ejs 
});      
//////////////////////////////////////
///////////////////////////////////
//OPEN EPORNER PLAYER MENU
app.get('/xxx/eporner/tveporn', function (req, res) {
  res.render('pages/xxx/eporner/tveporn');
});







/////////////////////////////////
app.post('/playVideo', function (req, res) {
 
  var videoUrl=req.body.videoUrl;
   
XVDL.getInfo(videoUrl)
.then(function(data) { console.log(data); res.json(data);})
.catch(e => console.error(e));
       
}); // ENDS POST

app.post('/search', function (req, res) {
 
  var searchUrl=req.body.searchUrl;
  var  videosArray= [];

XVDL.browse(searchUrl, videosArray)
    .then(info => {
        
        videosArray=info;
        XVDL.browse(searchUrl+'&p=1', videosArray)
        .then(info => {
            
        videosArray=info;
        XVDL.browse(searchUrl+'&p=2', videosArray)
        .then(info => {

        videosArray=info;
        XVDL.browse(searchUrl+'&p=3', videosArray)
        .then(info => { 
      
        videosArray=info;
        XVDL.browse(searchUrl+'&p=4', videosArray)
        .then(info => {
      
        videosArray=info;
        XVDL.browse(searchUrl+'&p=5', videosArray)
        .then(info => {
      
        videosArray=info;
        XVDL.browse(searchUrl+'&p=6', videosArray)
        .then(info => {
      
        videosArray=info;
        XVDL.browse(searchUrl+'&p=7', videosArray)
        .then(info => {
            
         const resultTxt=(JSON.stringify(info, null, 2));
          
            fs.writeFile('./public/xvid/xxx.txt', resultTxt, function (err) {
              if (err) throw err;
              console.log('Saved!');
              res.end('ok');
            }); // ENDS FILE WRITE

    })})})})})})})})
}); // ENDS XVIDEO SEARCH POST
/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////
// RECEIVE USER CHANNEL SEARCH AJAX CALL  ///////////////////////
app.post('/getChannelVideos', function (req, res) {
 
   var type=req.body.type;
   var mode=req.body.mode;
   var userId=req.body.userId;
   var tag=req.body.tag;
   var order=req.body.order;
   var page="";
  
console.log("TYPE NO INDEX: " + type);
console.log("MODE NO INDEX: " + mode);
console.log("USER NO INDEX: " + userId);
console.log("TAG NO INDEX: " + tag);
console.log("ORDER NO INDEX: " + order);

   const youTube = new YouTube();
    
   youTube.getChannelById(mode, userId, tag, order, page, (error, result) => {
    if (error) { console.log(error);
    } else {
// GET FIRST 50 VIDEOS 
var totalResults = (result.message);
console.log("TOTAL: " + totalResults)
 
var nextPage = (result.nextPageToken);
      const videos = [];
  console.log("TO PAGE2: " + nextPage);
      result.items.forEach((video) => {
        videos.push(video);
   
      });
// GET 50 TO 100 VIDEOS       
     youTube.getChannelById(mode, userId, tag, order, nextPage, (error, result) => {
      if(result!=null){
         nextPage = (result.nextPageToken);
         
        result.items.forEach((video) => {
          videos.push(video);
        });
         }
// GET 100 TO 150 VIDEOS       
       youTube.getChannelById(mode, userId, tag, order, nextPage, (error, result) => {
          if(result!=null){      
          nextPage = (result.nextPageToken);
        
        result.items.forEach((video) => {
          videos.push(video);
        });
         }
// GET 150 TO 200 VIDEOS       
       youTube.getChannelById(mode, userId, tag, order, nextPage, (error, result) => {
          if(result!=null){      
          nextPage = (result.nextPageToken);
         
        result.items.forEach((video) => {
          videos.push(video);
        });
        }                

        userId=userId.replace('UU','UC');
      resultTxt=(JSON.stringify(videos, null, 2));
      var filename="./public/youtube/ytube.txt";
      var filename2='./public/movies/ytmovies.txt';
      
    if(type==="youtube")  
    {
       filename2='./public/youtube/ytube.txt';
       if(mode ==="userChannel"){
           filename="./public/youtube/txt/" + userId + ".txt";
         }
       if(mode ==="userLists"){
           filename="./public/youtube/txt/" + userId + "_list.txt";
         }
    }

    if(type==="movies")  
    {
       filename2='./public/movies/ytube.txt';
       if(mode ==="userChannel"){
           filename="./public/movies/txt/" + userId + ".txt";
         }
       if(mode ==="userLists"){
           filename="./public/movies/txt/" + userId + "_list.txt";
         }
       if(mode ==="tag"){
          filename="./public/movies/txt/" + userId + ".txt";
        }  
    }

    if(type==="music")  
    {
       filename2='./public/music/ytube.txt';
       if(mode ==="userChannel"){
           filename="./public/music/txt/" + userId + ".txt";
         }
       if(mode ==="userLists"){
           filename="./public/music/txt/" + userId + "_list.txt";
         }

         if(mode ==="tag"){
          filename="./public/music/txt/" + userId + ".txt";
        }
    }





      fs.writeFile(filename, resultTxt, function (err) {
        if (err) throw err;
        console.log('Saved!');
     //   res.end('ok');
        }); // ENDS FILE WRITE
     
        fs.writeFile(filename2, resultTxt, function (err) {
          if (err) throw err;
          console.log('Saved!');
          res.end('ok');
          }); // ENDS FILE WRITE
    
      }); // ENDS 50-100 VIDEOS
  }); // ENDS 100-150 VIDEOS
}); // ENDS 150-200 VIDEOS

         } // ENDS ELSE

      }); // ENDS GETCHANNELBYID
     
}); // ENDS POST
/////////////////////////////////////////////////////////////////////////////
app.post('/rename', function (req, res) {
  var filename=req.body.filename;
  var mode = req.body.mode;

  if(mode=='youtube'){
  var from = './public/youtube/' + filename;
  var to = './public/youtube/ytube.txt' ;
  }
  if(mode=='music'){
    var from = './public/' + filename;
    var to = './public/music/ytube.txt' ;
    }
  if(mode=='movies'){
    var from = './public/movies/' + filename;
    var to = './public/movies/ytube.txt' ;
    }  

     
  console.log('From: '+ from)
  console.log('To' + to)

  // File destination.txt will be created or overwritten by default.
fs.copyFile(from, to, (err) => {
  if (err) throw err;
  console.log(filename + ' was copied to ytube.txt');
  res.end('ok');
});
});
/////////////////////////////////////////////////////////////

app.post('/sl_rename', function (req, res) {
  var filename=req.body.filename;
  var title = req.body.mode;

  var from = './public/sl/lists/' + filename;
  var to = './public/sl/lists/sl.txt' ;
       
  console.log('From: '+ from)
  console.log('To' + to)

  // File destination.txt will be created or overwritten by default.
fs.copyFile(from, to, (err) => {
  if (err) throw err;
  console.log(filename + ' was copied to '+to);
});

fs.writeFile('./public/sl/title.txt', title, function (err) {
  if (err) throw err;
  console.log('Sl Renamed!');
  res.end('ok');
  }); // ENDS FILE WRITE

});




app.post('/saveColors', function (req, res) {

   var data=req.body.data;
   var index=req.body.index;

  fs.writeFile('./public/colors.txt', data, function (err) {
    if (err) throw err;
    console.log('Colors Saved!');
    //res.end('ok');
    }); // ENDS FILE WRITE

    fs.writeFile('./public/bkCount.txt', index, function (err) {
      if (err) throw err;
      console.log('pic index Saved!');
      res.end('ok');
      }); // ENDS FILE WRITE

});
app.post('/saveEporner', function (req, res) {

  var data=req.body.data;
  
    
 fs.writeFile('./public/xxx/eporner/eporner.txt', data, function (err) {
   if (err) throw err;
   console.log('Eporner Saved!');
   }); // ENDS FILE WRITE

  

});
//////////////////////
app.post('/saveXvidTitle', function (req, res) {

  var data=req.body.data;
  var numVideos=req.body.num;
    
 fs.writeFile('./public/xvid/title.txt', data, function (err) {
   if (err) throw err;
   console.log('Xvideo title Saved!');
   }); // ENDS FILE WRITE
  
   fs.writeFile('./public/xvid/numVideos.txt', numVideos, function (err) {
    if (err) throw err;
    console.log('Xvideo Num Videos Saved!');
    }); // ENDS FILE WRITE  

});

app.post('/saveEpornerTitle', function (req, res) {

  var data=req.body.data;
  var numVideos=req.body.num;
    
 fs.writeFile('./public/xxx/eporner/title.txt', data, function (err) {
   if (err) throw err;
   console.log('Eporner title Saved!');
   }); // ENDS FILE WRITE
   
   fs.writeFile('./public/xxx/eporner/numVideos.txt', numVideos, function (err) {
    if (err) throw err;
    console.log('Eporner Num Videos Saved!');
    }); // ENDS FILE WRITE  

});


/////////////////////////////////////////////////////////////////////////////
//// GET GIFTS //////////////////////////////////////////////////////////////
app.post('/getGifts', function (req, res) {
    
   var videos=[];
 
  Scopit.getGifts("https://www.scoop.it/topic/second-life-freebies-und-mehr",  function (error, data){
       
    data.forEach((video) => {
      videos.push(video);
    });
 
  Scopit.getGifts("https://www.scoop.it/topic/second-life-freebies-und-mehr?page=2",  function (error, data){
       
    data.forEach((video) => {
      videos.push(video);
    });

  Scopit.getGifts("https://www.scoop.it/topic/second-life-freebies-und-mehr?page=3",  function (error, data){
              
   
        data.forEach((video) => {
      videos.push(video);
         });


  const resultTxt=(JSON.stringify(videos, null, 2));
    
      fs.writeFile('./public/scopit/gifts.txt', resultTxt, function (err) {
        if (err) throw err;
        console.log('Scopit Saved!');
        res.end('ok');
      }); // ENDS FILE WRITE     
 })})})
}) 
///////////////////////////////////////////////////
app.post('/getGiftSite', function (req, res) {
    
  var url=req.body.url;

  Scopit.getSite(url,function (error, data){

       console.log("DATA" + data)
 
  const resultTxt=(JSON.stringify(data, null, 2));
    
      fs.writeFile('./public/scopit/site.txt', resultTxt, function (err) {
        if (err) throw err;
        console.log('Scopit Saved!');
        res.end('ok');
      }); // ENDS FILE WRITE     
    })
}) 



//////////////////////////////////////////////////////////////////
//// GET SL //////////////////////////////////////////////////////
app.post('/getSl', function (req, res) {
    
  var url1=req.body.url;
  var txtFile=req.body.txtFile;
  var url=url1 
 // console.log("UURRLL:" + url )
  var videos=[];
  var endFlag=0;


     Sl.getSlThumbs(url, endFlag,  function (error, data){
     
      data.forEach((video) => { videos.push(video); console.log("DATA1 " + video)});
      console.log("SIZE1 " + data.length)
  
  if(data.length===0)  { endFlag=1}
     url=url1+'/2';

     Sl.getSlThumbs(url, endFlag,  function (error, data){
   
     data.forEach((video) => { videos.push(video);  console.log("DATA2 " + video)});
     console.log("SIZE2 " + data.length)
  
     if(data.length===0)  { endFlag=1}
     url=url1+'/3';

     Sl.getSlThumbs(url, endFlag,  function (error, data){
      
     data.forEach((video) => { videos.push(video);  console.log("DATA3 " + video)});
     console.log("SIZE3 " + data.length)
  
     if(data.length===0)  { endFlag=1}
     url=url1+'/4';  
      
     Sl.getSlThumbs(url, endFlag,  function (error, data){
   
     data.forEach((video) => { videos.push(video);  console.log("DATA4 " + video)});
     console.log("SIZE4 " + data.length)
  
     if(data.length===0)  { endFlag=1}
     url=url1+'/5';
    
     Sl.getSlThumbs(url, endFlag,  function (error, data){
   
     data.forEach((video) => { videos.push(video); console.log("DATA5 " + video)});
     console.log("SIZE5 " + data.length)

     if(data.length===0)  { endFlag=1}
     url=url1+'/6';

     Sl.getSlThumbs(url, endFlag,  function (error, data){
   
     data.forEach((video) => { videos.push(video); console.log("DATA6 " + video)});
     console.log("SIZE6 " + data.length) 
  
     if(data.length===0)  { endFlag=1}
     url=url1+'/7';

     Sl.getSlThumbs(url, endFlag,  function (error, data){
   
     data.forEach((video) => { videos.push(video); console.log("DATA7 " + video)});
     console.log("SIZE7 " + data.length)
  
     if(data.length===0)  { endFlag=1}
     url=url1+'/8';

     Sl.getSlThumbs(url, endFlag,  function (error, data){
   
     data.forEach((video) => { videos.push(video); console.log("DATA8 " + video)});
     console.log("SIZE8 " + data.length)
  
     if(data.length===0)  { endFlag=1}
     url=url1+'/9';

     Sl.getSlThumbs(url, endFlag,  function (error, data){
   
     data.forEach((video) => { videos.push(video); console.log("DATA9 " + video)});
     console.log("SIZE9 " + data.length)

     if(data.length===0)  { endFlag=1}
     url=url1+'/10';

     Sl.getSlThumbs(url, endFlag,  function (error, data){
   
     data.forEach((video) => { videos.push(video); console.log("DATA10 " + video)});
     console.log("SIZE10 " + data.length)

     if(data.length===0)  { endFlag=1}
     url=url1+'/11';

     Sl.getSlThumbs(url, endFlag,  function (error, data){
   
     data.forEach((video) => { videos.push(video); console.log("DATA10 " + video)});
     console.log("SIZE11 " + data.length)

     if(data.length===0)  { endFlag=1}
     url=url1+'/12';

     Sl.getSlThumbs(url, endFlag,  function (error, data){
   
     data.forEach((video) => { videos.push(video); console.log("DATA10 " + video)});
     console.log("SIZE12 " + data.length)
     


 const resultTxt=(JSON.stringify(videos, null, 2));
   
     fs.writeFile('./public/sl/slUrls.txt', resultTxt, function (err) {
       if (err) throw err;
       console.log('SL Urls Saved!');
       res.end('ok');
     }); // ENDS FILE WRITE     

})
})
})
})
})
})
})
})
})
})
}) //second query
}) //first query
}) 

/////////////////////////////////////////////////////////////////////
//// GET SL THUMBS///////////////////////////////////////////////////
app.post('/getSlThumbs', function (req, res) {

  var url=[];
  var videos=[];
  var txtFile=req.body.txtFile;
      url=req.body.url;
  

      url=JSON.parse(url)
      var urlSize=url.length;
  console.log("NUM VIDEOS:" + urlSize )
  console.log("TXT FILE:" + txtFile )

  url.forEach(function (item, index){

     Sl.getSlTp(item,  function (error, data){
      
        data.forEach((video) => { videos.push(video); });

            if(videos.length===urlSize)  
              {
                const resultTxt=(JSON.stringify(videos, null, 2));

                fs.writeFile('./public/sl/lists/'+txtFile, resultTxt, function (err) {
                  if (err) throw err;
                  console.log('SL thumbs Saved! to lists folder');
               //   res.end('ok');
                }); // ENDS FILE WRITE    
          
                 fs.writeFile('./public/sl/lists/sl.txt', resultTxt, function (err) {
                  if (err) throw err;
                  console.log('SL thumbs Saved! to sl.txt');
                  res.end('ok');
                }); // ENDS FILE WRITE    
              } // ENDS IF 
     
        }) // ENDS FOREACH

      }) // ENDS GETSLTP
 
})// POST END


////////////////////////////////////////////////////////////////////////////
//// GET EROTIC MOVIES /////////////////////////////////////////////////////
app.post('/getEroticMovies', function (req, res) {
    
  var url1=req.body.url;
  var txtFile=req.body.txtFile;
  var url=url1 
 // console.log("UURRLL:" + url )
  var videos=[];
  var endFlag=0;


      EroticMovies.getEroticThumbs(url, endFlag,  function (error, data){
      data.forEach((video) => { videos.push(video); });
     
      if(data.length < 24)  { endFlag=1}
      url=url1+'page/2/';
console.log("SI: "+ data.length)
      EroticMovies.getEroticThumbs(url, endFlag,  function (error, data){
      data.forEach((video) => { videos.push(video); });
     
      if(data.length < 24)  { endFlag=1}
      url=url1+'page/3/';

      EroticMovies.getEroticThumbs(url, endFlag,  function (error, data){
      data.forEach((video) => { videos.push(video); });
    
      if(data.length < 24)  { endFlag=1}
      url=url1+'page/4/';

      EroticMovies.getEroticThumbs(url, endFlag,  function (error, data){
      data.forEach((video) => { videos.push(video); });

      if(data.length < 24)  { endFlag=1}
      url=url1+'page/5/';

      EroticMovies.getEroticThumbs(url, endFlag,  function (error, data){
      data.forEach((video) => { videos.push(video); });

      if(data.length < 24)  { endFlag=1}
      url=url1+'page/6/';

      EroticMovies.getEroticThumbs(url, endFlag,  function (error, data){
      data.forEach((video) => { videos.push(video); });

      
 const resultTxt=(JSON.stringify(videos, null, 2));
 
 fs.writeFile('./public/xxx/eroticMovies/lists/'+txtFile, resultTxt, function (err) {
  if (err) throw err;
  console.log('Erotic Movies Saved! to lists folder');
//   res.end('ok');
}); // ENDS FILE WRITE    

 
     fs.writeFile('./public/xxx/eroticMovies/lists/movies.txt', resultTxt, function (err) {
       if (err) throw err;
       console.log('Erotic movies Saved!');
       res.end('ok');
     }); // ENDS FILE WRITE     
})})})
})
}) //second query
}) //first query
}) // **** END POST GET EROTIC MOVIES
/////////////////////////////////////
app.post('/erotic_rename', function (req, res) {
  var filename=req.body.filename;
  var title = req.body.mode;

  var from = './public/xxx/eroticMovies/lists/' + filename;
  var to = './public/xxx/eroticMovies/lists/movies.txt' ;
       
  console.log('From: '+ from)
  console.log('To' + to)

  // File destination.txt will be created or overwritten by default.
fs.copyFile(from, to, (err) => {
  if (err) throw err;
  console.log(filename + ' was copied to '+to);
});

fs.writeFile('./public/xxx/eroticMovies/lists/title.txt', title, function (err) {
  if (err) throw err;
  console.log('Erotic Movies Renamed!');
  res.end('ok');
  }); // ENDS FILE WRITE

});


//////////////////////////////////////////////////////////////////////////////////////
//// GET MOVIES THUMBS ///////////////////////////////////////////////////////////////
app.post('/getMovieThumb', function (req, res) {

   var videos;  
   var url=req.body.url;
   var tile=req.body.txtFile;
   console.log('UURL: '+ url)
   var endFlag=0;
   XeMovies.browse(url, endFlag,  function (error, data){


    data.forEach((video) => { videos.push(video); });

      
    const resultTxt=(JSON.stringify(videos, null, 2));

    fs.writeFile('./public/movies/xemovie/movies.txt', resultTxt, function (err) {
      if (err) throw err;
      console.log('Xe Movies Saved!');
      res.end('ok');
      }); // ENDS FILE WRITE 


   });

});


//////////////////////////////////////////////////////////////////////////////////////
//// GET CLIP GAMES THUMBS ///////////////////////////////////////////////////////////////
app.post('/getClipThumb', function (req, res) {

  var videos;  
  var url=req.body.url;
  var txtFile=req.body.txtFile;
  console.log('UURL: '+ url)
  var endFlag=0;
  var videosArray=[];
getCl

  ClipGames.browse(url, videosArray)
  .then(info => {
      
      videosArray=info;

  ClipGames.browse(url+'?page=1', videosArray)
      .then(info => {

        videosArray=info;

  ClipGames.browse(url+'?page=2', videosArray)
      .then(info => {
  
        videosArray=info;    
        
  ClipGames.browse(url+'?page=3', videosArray)
        .then(info => {
    
          videosArray=info;      
  
  ClipGames.browse(url+'?page=4', videosArray)
          .then(info => {
      
            videosArray=info;

  ClipGames.browse(url+'?page=5', videosArray)
      .then(info => {
  
        videosArray=info;
        
   const resultTxt=(JSON.stringify(videosArray, null, 2));

   fs.writeFile('./public/games/clip-games/'+txtFile, resultTxt, function (err) {
    if (err) throw err;
    console.log('Clip Games Saved to lists folder');
  //   res.end('ok');
  }); // ENDS FILE WRITE   

   fs.writeFile('./public/games/clip-games/games.txt', resultTxt, function (err) {
     if (err) throw err;
     console.log('Clip Games games.txt Saved!');
     res.end('ok');
     }); // ENDS FILE WRITE 

    });
  });
});});});
});
});

//////////////////////////////////////////////////////////////////////////////////////
//// GET CLIP GAMES URL ///////////////////////////////////////////////////////////////
app.post('/getClipUrl', function (req, res) {

  var videos=req.body.video;
  var url=req.body.video.url;
  var title=req.body.video.title;
  var thumb=req.body.video.thumb;
  console.log('UURL: '+ url)
  var endFlag=0;
  var videosArray=[];


  
  ClipGames.getInfo(url, videosArray)
  .then(info => {
      
    videos.title=title;
    videos.thumb=thumb;
    videos.url=info;
    videos.desc='desc';



 
     
   const resultTxt=(JSON.stringify(videosArray, null, 2));

   fs.writeFile('./public/games/clip-games/gameUrl.txt', resultTxt, function (err) {
     if (err) throw err;
     console.log('Clip Games Saved!');
     res.end('ok');
     }); // ENDS FILE WRITE 

  
  });

});
//////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////

//////////////////////////////////////////////////////////////////////////////////////
//// GET ARCADE GAMES THUMBS ///////////////////////////////////////////////////////////////
app.post('/getArcadeThumb', function (req, res) {

  var videos;  
  var url=req.body.url;
  var txtFile=req.body.txtFile;
  console.log('UURL: '+ url)
  var endFlag=0;
  var videosArray=[];
 
url='https://myemulator.online/neo-geo';

  ArcadeGames.browse(url, videosArray)
  .then(info => {
      
      videosArray=info;
 
  ArcadeGames.browse(url+'/page/2', videosArray)
      .then(info => {
  
        videosArray=info;    
  
  ArcadeGames.browse(url+'/page/3', videosArray)
      .then(info => {
  
        videosArray=info;   

  
  
        
   const resultTxt=(JSON.stringify(videosArray, null, 2));

   fs.writeFile('./public/games/arcade-games/'+txtFile, resultTxt, function (err) {
    if (err) throw err;
    console.log('Clip Games Saved to lists folder');
  //   res.end('ok');
  }); // ENDS FILE WRITE   

   fs.writeFile('./public/games/arcade-games/games.txt', resultTxt, function (err) {
     if (err) throw err;
     console.log('Clip Games games.txt Saved!');
     res.end('ok');
     }); // ENDS FILE WRITE 

  
  });
});
});
});
/////////////////////////
app.post('/getArcadeRoms', function (req, res) {

  var gameLink=req.body.url;
  var gameName=req.body.txtFile;
  console.log("glink: " + gameLink)
  console.log("gname: " + gameName)

  request(gameLink, {encoding: 'binary'}, function(error, response, body) {
    fs.writeFile('./public/games/arcade-games/zips/'+gameName, body, 'binary', function (err) {});
    
});
     res.end('ok');
});

//////////////////////////////////////////////////////////////////////////////////////
/////////////////////////
app.post('/check_hash', function (req, res) {

  var hash=req.body.hash;
 
  console.log("hash: " + hash)

    var z=Check.check(hash);

console.log(z);
     res.end(z);
});
//////////////////////////////////////////////////////////////////////////////////////

var count=0;
var playTime=0;

const FIXED_ROOM = "global_room";

io.on('connection', function(socket) {

    // Auto-join everyone to the same room
    socket.join(FIXED_ROOM);
    console.log(`Socket ${socket.id} joined ${FIXED_ROOM}`);

    // --- STATE SYNC (SCROLL) ---
    socket.on('state_sync', (data) => {
        if (data.type === 'scroll') {
            socket.to(FIXED_ROOM).emit('state_sync', data);
            console.log(`[SCROLL]: ${data.position}px`);
        }
    });

    // --- NAVIGATION ---
    socket.on('mirror_nav', (data) => {
        const targetRoute = typeof data === 'string' ? data : data.route;

        console.log(`Navigation to: ${targetRoute}`);
        socket.to(FIXED_ROOM).emit('openPage', targetRoute);
    });

    // --- BACKGROUNDS ---
    socket.on('change_bg', function(data) {
        socket.to(FIXED_ROOM).emit('update_bg', { image: data.image });
    });

    // --- AJAX NAV ---
    socket.on('mirror_ajax_nav', (data) => {
        socket.to(FIXED_ROOM).emit('mirror_ajax_nav', {
            mode: data.mode,
            action: data.action
        });
    });

    // --- MOVIE CONTROLS ---
    socket.on('toPause', function(currenttime) {
        socket.to(FIXED_ROOM).emit('Pause', currenttime);
    });

    socket.on('toPlay', function(currenttime) {
        socket.to(FIXED_ROOM).emit('Play', currenttime);
    });

    socket.on('toSeek', function(currenttime) {
        socket.to(FIXED_ROOM).emit('Seek', currenttime);
    });

    socket.on('disconnect', function() {
        console.log('User disconnected');
    });
});

////////////////////////////////////////////////////
// FUNCTION TO SEND CLICKS  ///////////////////
app.post('/click_send', function (req, res) {

  var db_url=req.body.db_url;
  var title=req.body.title
  var id=req.body.id

  db_url=db_url+"?title="+title+"&id="+id
  console.log('DB URL: '+ db_url);

  request(db_url, function (error, response, html) {

    if (!error && response.statusCode == 200) {
  
      console.log('htm: ' + html);
        res.end('ok')        
       
      }
      else
      res.end('bad')   
    });// request end
 
});// post end

///////////////////////////////////
const scraper = require('./public/js/xv_scrap'); // Your scraper file

app.post('/api/scrape-xvideos', async (req, res) => {
    const { tag, sort } = req.body;
    
    // Construct the XVideos URL based on the tag
    // e.g., https://www.xvideos.com/?k=nature&sort=relevance
    const searchUrl = `https://www.xvideos.com/?k=${encodeURIComponent(tag)}&sort=${sort}`;
    
    try {
        const videos = await scraper.browse(searchUrl);
        res.json(videos); // Send the array of video objects back to the HTML
    } catch (error) {
        res.status(500).send("Scraping failed");
    }
});
/////////////////////////////////////////

//////////////////////////////////////////////////
// FUNCTION TO CHECK THE TV URL  ///////////////////
app.post('/check', function (req, res) {

  var status=req.body.status;
  console.log('Lock Status: '+ status);

  request(status, function (error, response, html) {

    if (!error && response.statusCode == 200) {
  
      console.log('htm: ' + html);
        res.end('ok')        
       
      }
      else
      res.end('bad')   
    });// request end
 
});// post end
///////////////////////////////////////////////////////////////////
app.get('/desk', function (req, res) {
    
        var interval = setInterval(function() {
          screenshot().then((img) => {
              var imgStr = new Buffer.from(img).toString('base64');

              var obj = {};
              obj.room = "room";
              obj.image = imgStr;
console.log("inside desk");
              socket.emit("data", JSON.stringify(obj));
          })
        }, 100)


});
////////////////////////////////////////////////////////////////////////7

///////////////////////////////////////////////////////////////////////
server.listen(PORT, () => console.log(`Listening on ${ PORT }`));