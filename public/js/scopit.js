const cheerio = require("cheerio");
const pretty = require("pretty");
const request = require('request');
const fs = require('fs');


function getGifts(siteUrl,callback){
                    siteUrl="https://www.scoop.it/topic/second-life-freebies-und-mehr"        
    videosArray=[];
request(siteUrl, function (error, response, html) {

if (!error && response.statusCode == 200) {
  
    const $ = cheerio.load(html);
  
   //BROWSE TROUGH ARTICLES
    $('article').each((i,item)=>{
    
        var image = $(item).find('.thisistherealimage',0); // GET CLASS
            image = $(image).find('img').attr('data-original'); 
        
        var url = $(item).find('.postTitleView a',0);
            url = (url).attr('href');

        var title= $(item).find('.postTitleView a',0).text()
        var desc = $(item).find('.post-description',1).text();
      
        var date = $(item).find('.tCustomization_post_metas',0);
            date = $(date).find('span',0).text()
      
        var comtitle = $(item).find('.post-curation-comment-title',0).text()
        var comdesc = $(item).find('.tCustomization .tCustomization_post_description',0).text()


        title=title.replace(/^\s+|\s+$/gm,'');
        desc=desc.replace(/^\s+|\s+$/gm,'');
        date=date.replace(/^\s+|\s+$/gm,'');
        comtitle=comtitle.replace(/^\s+|\s+$/gm,'');
        comdesc=comdesc.replace(/^\s+|\s+$/gm,'');

    console.log("title: " + title)
    console.log("desc: " + desc)
    console.log("date: " + date)
    console.log("image: " + image)
    console.log("ComTitle: " + comtitle)
    console.log("ComDesc: " + comdesc)

console.log("url: " + url)
 const video= {
                    'title':title,
                    'url':url,
                    'image':image,
                    'desc':desc,
                    'date':date,
                    'comtitle':comtitle,
                    'comdesc':comdesc
                    };

                    videosArray.push(video);

                   
                      
                         //  console.log('Saved!');
                       
           
                
            }); // ENDS FILE WRITE
         //   callback(null, videosArray);
  }
});
}


function getSite(siteUrl,callback){
    console.log("SITE" + siteUrl)     
    var url;
 request(siteUrl, function (error, response, html) {
 
 if (!error && response.statusCode == 200) {
   
     const $ = cheerio.load(html);
   
     var cl = $('.td-post-content p')
        url= $(cl,4).find('a').eq(1);
        url=   (url).attr('href');
    console.log("URL" + url)
             callback(null, url);
 }
   
 });
 }
getGifts()

  module.exports = {getGifts, getSite}