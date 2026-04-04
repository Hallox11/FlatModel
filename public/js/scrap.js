const cheerio = require("cheerio");
const pretty = require("pretty");
const request = require('request');
const fs = require('fs');



function getSlThumbs(siteUrl){

  
  videosArray=[];

request(siteUrl, function (error, response, html) {


if (!error && response.statusCode == 200) {
  
    const $ = cheerio.load(html);
   

    $('.dg-catterm-list').each((i,item)=>{
    
         
       var url= $(item).find('a').attr('href');
   
       url= 'https://secondlife.com' + url;

           getSlTp(url,videosArray);

           
                 
            }); // ENDS FILE WRITE
   
  }
});
}

function getSlTp(url, videosArray){

  request(url, function (error, response, html) {
    
   
  if (!error && response.statusCode == 200) {
    
      const $ = cheerio.load(html);
     
      var pic=$('#dg-entry')
      
         var title= $(pic).find('img').attr('alt');
         var desc=$(pic).find('p').text();
        // const url1= $(pic).find('.dg-entry-CTA');
         const url=  $('#dg-entry-CTA').find('a').attr('href');
         const thumb= $(pic).find('img').attr('src');
  
         title=title.replace(/^\s+|\s+$/gm,'');
         desc=desc.replace(/^\s+|\s+$/gm,'');
         console.log("TILE: " + title);
         console.log("href: " + url);
         console.log("thumb: " + thumb);
         console.log("desc: " + desc);
           
         var video= {'title':title,
                       'url':url,
                       'thumb':thumb,
                      'desc':desc};
        videosArray.push(video);

        const resultTxt=(JSON.stringify(videosArray, null, 2));
           fs.writeFile('./sl.txt', resultTxt, function (err) {
               if (err) throw err;
               console.log('Saved!');
               });
             
    }
  });
  }

  getSlThumbs('https://secondlife.com/destinations/new');

  module.exports = {};