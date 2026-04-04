const miniget = require("miniget");
const { JSDOM } = require("jsdom");
const fs = require('fs');
const request = require('request');

   

async function getHTML(url) {
        return await miniget(url).text();
}
function getDOM(html) {
        return new JSDOM(html);
}


///////////
    var videosArray=[];

 


async function browse(url, videosArray) {
        const html = await getHTML(url);
       console.log("WEB URL " + url);
       
        const { document } = getDOM(html).window;
     //   console.log("DOM: " + html);
var url=[]
var image=[]
var title=[]

        var xx = html.split('game-gallerty inn_panel1_box stra_games')[1]
       

var urls=[]
var images=[]
var titles=[]
    var i
 
  
    for(i=1; i<36; i++)
    {
        xx = html.split('game-gallerty inn_panel1_box stra_games')[1]
      
        try {
        url = xx.split('href="')[i].split('">')[0]

             url = xx.split('href="')[i].split('"')[0]

             url='https://www.addictinggames.com/' + url
             urls.push(url)
             console.log( "URL: " + url )
        }
           catch(err) {
            console.log ("ERROR URL"); i=36;return videosArray;
          }         
    
    }

    for(i=1; i<36; i++)
    {
      
        xx = html.split('game-gallerty inn_panel1_box stra_games')[1]
      
        try {
                image = xx.split(' data-src="')[i].split('"')[0]
                images.push(image)
             //   console.log( "IMAGE II: " + i )
             //   console.log( "IMAGE: " + image )
        }
        catch(err) {
          console.log ("ERROR IMAGE"); i=36; //return videosArray;
        }

     
        
      
    }

    for(i=1; i<36; i++)
    {
        xx = html.split('game-gallerty inn_panel1_box stra_games')[1]
    
        try {  
        title = xx.split('<h4 class="txt_box">')[i].split('<')[0]
        titles.push(title)
      }
      catch(err) {
        console.log ("ERROR TITLE"); i=36;return videosArray;
      }
    }
    
   console.log("SIZE: " + urls.length);


    for(i=1; i<urls.length; i++)
    {

   
      const html = await getHTML(urls[i]);
        
      const { document } = getDOM(html).window;
      
     try{

      var xx = html.split("source: '")[1].split("'")[0]
    
      console.log( "XXX: " + xx )
    
 
      var video= {
                    'title':titles[i],
                    'thumb': images[i],
                    'url':xx,
                    'desc':'desc'
                  };

    
       videosArray.push(video)


         console.log( "IMAGE: " + images[i] )
         console.log( "URLS: " + urls[i] )
         console.log( "TITLE: " + titles[i] )
         console.log( "----------")
               
      }
      catch(err) {
        console.log ("ERROR HTML");  return videosArray; i=36;
      }
    }
      return videosArray;
     
 }
//////////////////////////////////////////////////////////////////////////



///////////////////////////////////////////////////////////////////////////
    /**
     * Returns video info
     * @param {string} url Video url
     */
    
     var videosArray=[]
  
     async function getInfo(url, image, title) {
        if (!url || typeof url !== "string") throw new Error("URL must be a string.");
        const html = await getHTML(url);
        
        const { document } = getDOM(html).window;
        
       

        var xx = html.split("source: '")[1].split("'")[0]
      
      console.log( "XXX: " + xx )
      
   
        var video= {
                      'title':title,
                      'thumb': image,
                      'url':xx,
                      'desc':'desc'
                    };

      
         videosArray.push(video)

        

} //GETINFO END

   



module.exports ={getInfo,browse}