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

     browse("", videosArray)


/**
     * Browse pages and get data. Defaults to homepage.
     * @param {string} [path] Browsing path
     */
      async function browse(path = undefined, videosArray) {
        const html = await getHTML('https://www.addictinggames.com/puzzle-games/index.jsp' );
    //   console.log("path: " + html);
       
        const { document } = getDOM(html).window;
     //   console.log("DOM: " + html);
var url=[]
var image=[]
var title=[]

        var xx = html.split('game-gallerty inn_panel1_box stra_games')[1]
        //   console.log( "XXXX " + xx )
         url = xx.split('href="')[1].split('"')[0]
         console.log( "URL: " + url )

         image = xx.split(' data-src="')[1].split('"')[0]
         console.log( "IMAGE: " + image )
    
         title = xx.split('<h4 class="txt_box">')[1].split('<')[0]
         console.log( "TITLE: " + title )

var urls=[]
var images=[]
var titles=[]
    var i
 
  
    for(i=0; i<36; i++)
    {
        url = xx.split('href="')[i].split('">')[0]

             url = xx.split('href="')[i].split('"')[0]

             url='https://www.addictinggames.com/' + url
             urls.push(url)
          //   console.log( "URL: " + url )
                   
    
    }

    for(i=0; i<36; i++)
    {
        image = xx.split(' data-src="')[i].split('"')[0]
        images.push(image)
       //  console.log( "IMAGE: " + image )
    }

    for(i=0; i<36; i++)
    {
        title = xx.split('<h4 class="txt_box">')[i].split('<')[0]
        titles.push(title)
       //  console.log( "IMAGE: " + image )
    }
    
   


    for(i=1; i<36; i++)
    {

        getInfo(urls[i], images[i], titles[i])

     
         console.log( "IMAGE: " + images[i] )
         console.log( "URLS: " + urls[i] )
         console.log( "TITLE: " + titles[i] )
         console.log( "----------")

      }
      
     
 }
//////////////////////////////////////////////////////////////////////////



///////////////////////////////////////////////////////////////////////////
    /**
     * Returns video info
     * @param {string} url Video url
     */
    
     var videosMP4=[]
  
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

      
         videosMP4.push(video)

         const resultTxt=(JSON.stringify(videosMP4, null, 2));
          
      fs.writeFile('./PPPP.txt', resultTxt, function (err) {
        if (err) throw err;
        console.log('Movies MP4 Saved!');
       //   res.end('ok');
      }); // ENDS FILE WRITE

} //GETINFO END

   



module.exports ={getInfo,browse}