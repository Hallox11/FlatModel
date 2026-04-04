const cheerio = require("cheerio");
const pretty = require("pretty");
const request = require('request');
const fs = require('fs');


// getEroticThumbs('https://eroticmv.com/category/decades/2010s/')


function getEroticThumbs(siteUrl, endFlag, callback){

  videosArray=[];
//  console.log("END " + endFlag);
  if(endFlag===0)
{
request(siteUrl, function (error, response, html) {

  
if (!error && response.statusCode == 200) {

    const $ = cheerio.load(html);
   
  //  console.log("url: " +  html)

    $('article').each((i,item)=>{
    
      
       var image= $(item).find('img').attr('src');
       var url= $(item).find('a').attr('href');
       var title= $(item).find('a').attr('title');

       var url2= $(item).find('.preview-video').attr('data-iframepreview');
   
      console.log("IMAGE: " + image)
      console.log("URL: " + url)
      console.log("URL2: " + url2)

      var video= {
        'title':title,
        'url':url2,
        'thumb':image,
        'desc':'desc'
     };
                     videosArray.push(video)
         
                 
            }); // ENDS FILE WRITE

            callback(null, videosArray);
   
  }
});
}  // end ENDFLAG check  
else       callback(null, videosArray);
         //callback(null, videosArray);
}

  


  module.exports = {getEroticThumbs};