const cheerio = require("cheerio");
const pretty = require("pretty");
const request = require('request');
const fs = require('fs');


function getSlThumbs(siteUrl, endFlag, callback){

   videosArray=[];
 //  console.log("END " + endFlag);
   if(endFlag===0)
{
request(siteUrl, function (error, response, html) {

var url;
var url1;

if (!error && response.statusCode == 200) {
  
    const $ = cheerio.load(html);
  
    $('.dg-catterm-list').each((i,item)=>{
          
           url1= $(item).find('a').attr('href');
             url= 'https://secondlife.com' + url1;
  
             videosArray.push(url);
       //         console.log("href: " + url);
               
            }); //end foreach
            
              callback(null, videosArray);
     
      } //end if connection error
             
}); // end request
}  // end ENDFLAG check  
 else         callback(null, videosArray);
}

function getSlTp(url, callback){

  request(url, function (error, response, html) {
    
    videosArray=[];

  if (!error && response.statusCode == 200) {
    
      const $ = cheerio.load(html);
     
      var pic=$('#dg-entry')
      
         var title= $(pic).find('img').attr('alt');
         var desc=$(pic).find('p').text();
                   
         var url1 = $('#dg-entry-CTA')
         var url2= $(url1).find('a').eq(1);
         url=   (url2).attr('href');


         const thumb= $(pic).find('img').attr('src');
  
         if(title !== undefined) {
        //  console.log("myProperty value is the special value `defined`");
         
         title=title.replace(/^\s+|\s+$/gm,'');
         desc=desc.replace(/^\s+|\s+$/gm,'');

        

         console.log("TILE: " + title);
       //  console.log("href: " + url);
    /*
         console.log("TILE: " + title);
         console.log("href: " + url);
         console.log("thumb: " + thumb);
         console.log("desc: " + desc);
         console.log(":");
         console.log(":");
     */ 
         var video= {
                       'title':title,
                       'url':url,
                       'thumb':thumb,
                       'desc':desc
                    };
                videosArray.push(video)
                  callback(null,videosArray)
        }    
        else        callback(null,videosArray)
    
    }
        
  })
  }

 

  module.exports = {getSlThumbs, getSlTp};