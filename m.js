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
        const html = await getHTML('https://xemovie.co/genres/movies/adventure' );
    //   console.log("path: " + html);
       
        const { document } = getDOM(html).window;
     //   console.log("DOM: " + html);
var url=[]
var image=[]

        var xx = html.split('<h1 class="text-primary text-3xl leading-7 font-extrabold float-left"')[1].split("nav")[0]
         url = xx.split('href="')[4].split('">')[0]
    //  console.log( "XXXX " + xx )
    //  console.log( "URL: " + url )

         image = xx.split('src="')[3].split('"')[0]

        

       // console.log( "IMAGE: " + image )
var urls=[]
var images=[]
var titles=[]
    var i
 
  
    for(i=0; i<48; i++)
    {
        url = xx.split('href="')[i].split('">')[0]

        if(url!=="#")
        {
             url = xx.split('href="')[i].split('">')[0]
             urls.push(url)
          //   console.log( "URL: " + url )
                   
            
        }
    }

    for(i=0; i<25; i++)
    {
        image = xx.split('src="')[i].split('"')[0]
       
        images.push(image)
      //  console.log( "IMAGE: " + image )
    }
    
    for(i=0; i<25; i++)
    {
         title = xx.split('nowrap">')[i].split('</h6>')[0]
       
        titles.push(title)
      //  console.log( "TITLE: " + title )
    }


    for(i=0; i<25; i++)
    {

        getInfo(urls[i] + '/watch', titles[i])



        var video= {
            'title':titles[i],
            'url':urls[i],
            'thumb':images[i],
            'desc':'desc'
         };
   
         videosArray.push(video)
      
       //  console.log( "IMAGE: " + images[i] )
       //  console.log( "URLS: " + urls[i] )
       //  console.log( "----------")

      }
  
     
 }
//////////////////////////////////////////////////////////////////////////



///////////////////////////////////////////////////////////////////////////
    /**
     * Returns video info
     * @param {string} url Video url
     */
    
     var videosMP4=[]
  
     async function getInfo(url, title) {
        if (!url || typeof url !== "string") throw new Error("URL must be a string.");
        const html = await getHTML(url);
        
        const { document } = getDOM(html).window;
        
         var image = document.querySelector("meta[property='og:image']").getAttribute("content")

        console.log( "IMAGE " + image )

        var xx = html.split('playlist')[1].split(',')[0]
        var mp4 = xx.split('"file": "')[1].split('"')[0]
   
        console.log( "MP4: " + mp4 )
        console.log( "IMAGE: " + image )
        console.log( "TITLE: " + title )
        console.log( "--------------"  )
        
        title=title.replace(':','')

        var video= {
            'title':title,
            'url':mp4,
            'thumb':image,
            'desc':'desc'
         };

                 

         request(image, {encoding: 'binary'}, function(error, response, body) {
          fs.writeFile('./public/movies/xemovie/'+title + '.jpg', body, 'binary', function (err) {});
        });


      //   request(image).pipe(fs.createWriteStream('./public/movies/xemovie/' + title+'.jpg'));

         videosMP4.push(video)

         const resultTxt=(JSON.stringify(videosMP4, null, 2));
          
      fs.writeFile('./public/movies/xemovie/movies.txt', resultTxt, function (err) {
        if (err) throw err;
        console.log('Movies MP4 Saved!');
       //   res.end('ok');
      }); // ENDS FILE WRITE

} //GETINFO END

   



module.exports ={getInfo,browse}