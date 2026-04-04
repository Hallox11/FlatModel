const axios = require("axios");
const cheerio = require("cheerio");
const pretty = require("pretty");
const request = require('request');
const fs = require('fs');



///////////////////////////////////////////////////////////////////////////////////////
function getThumbs(videosArray,pages, callback){

     const siteUrl='https://www.voyeurshd.com/galleries/all-recent-'+pages+'.html';

     request(siteUrl, function (error, response, html) {
  

if (!error && response.statusCode == 200) {
  
    const $ = cheerio.load(html);
   
    $('.th2').each((i,item)=>{

       const title= $(item).find('a').text();
       const url= $(item).find('a').attr('href');
       const thumb= $(item).find('img').attr('src');

     //  console.log("TILE: " + title);
     //  console.log("href: " + url);
    //   console.log("thumb: " + thumb);
         
       const video= {'title':title,
                     'url':url,
                     'thumb':thumb};
                    
                     videosArray.push(video);
                     
    }); // ends for each
    callback(null, videosArray);
    
  } // ends response ok
 
}); // ends request
     
}
//////////////////////////////////////////////////////////////////////////////
//getPics('https://www.voyeurshd.com/gallery/housewife-in-the-kitchen-YkvRp1imTKI.html');

function getPics(picUrl, callback){

  request(picUrl, function (error, response, html) {
    
  videosArray=[];
  
  if (!error && response.statusCode == 200) {
    
      const $ = cheerio.load(html);
     
      $('.highslide').each((i,item)=>{
  
         const title= $(item).find('img').attr('alt');
         const pic= $(item).find('img').attr('src');
  
         console.log("TILE: " + title);
         console.log("pic: " + pic);
           
         const video= {'title':title,
                       'thumb':pic};
        
                       videosArray.push(video);
  
      });

      callback(null, videosArray);

          
     
    }
  });
  }
///////////////////////////////////////////////////////////////////////////////////
// get black and white pics

function getBWPics(picUrl, callback){

  request(picUrl, function (error, response, html) {
    
  videosArray=[];
  
  if (!error && response.statusCode == 200) {
    
      const $ = cheerio.load(html);
     
      $('.gallery-icon').each((i,item)=>{
  
         const title= $(item).find('img').attr('alt');
         const pic= $(item).find('img').attr('src');
  
         console.log("TILE: " + title);
         console.log("pic: " + pic);
           
         const video= {'title':title,
                       'thumb':pic};
        
                       videosArray.push(video);
  
      });

      callback(null, videosArray);

          
     
    }
  });
  }
///////////////////////////////////////////////////////////////////////////////////
// get red pics

function getRedPics(picUrl, callback){

  request(picUrl, function (error, response, html) {
    
  videosArray=[];
  
  if (!error && response.statusCode == 200) {
    
      const $ = cheerio.load(html);
     
      $('.gallery-icon').each((i,item)=>{
  
         const title= $(item).find('img').attr('alt');
         const pic= $(item).find('img').attr('src');
  
         console.log("TILE: " + title);
         console.log("pic: " + pic);
           
         const video= {'title':title,
                       'imag':pic};
        
                       videosArray.push(video);
  
      });

      callback(null, videosArray);

          
     
    }
  });
  }

  ///////////////////////////////////////////////////////////////////////////////////
// get secondlife thumbs pics

function getSlThumbs(picUrl, callback){

  request(picUrl, function (error, response, html) {
    
  videosArray=[];
  
  if (!error && response.statusCode == 200) {
    
      const $ = cheerio.load(html);
     
      $('.gallery-icon').each((i,item)=>{
  
         const title= $(item).find('img').attr('alt');
         const pic= $(item).find('img').attr('src');
  
         console.log("TILE: " + title);
         console.log("pic: " + pic);
           
         const video= {'title':title,
                       'thumb':pic};
        
                       videosArray.push(video);
  
      });

      callback(null, videosArray);

          
     
    }
  });
  }
  module.exports = {getPics, getThumbs, getBWPics, getRedPics, getSlThumbs};