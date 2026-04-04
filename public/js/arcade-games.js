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

    // browse("", videosArray)


/**
     * Browse pages and get data. Defaults to homepage.
     * @param {string} [path] Browsing path
     */
      async function browse(path , videosArray) {
        const html = await getHTML( path );
     //  console.log("path: " + html);
       
        const { document } = getDOM(html).window;
     //   console.log("DOM: " + html);


var url=[]
var image=[]


        var xx = html.split('<div class="post-content">')[2]
       //  url = xx.split('href="')[4].split('">')[0]
   //   console.log( "XXXX " + xx )
    //  console.log( "URL: " + url )

         image = xx.split('<a href="')[1].split('"')[0]

      //   console.log( "IMAGE: " + image )


        var urls=[]
        var urls2=[]
var images=[]
var titles=[]
    var i
 
 
    for(i=1; i<37; i++)
    {
       xx = html.split('article id=')[i]
      
       url = xx.split('<a href="')[1].split('"')[0]
    
       image = xx.split('src="')[1].split('"')[0]

       title = xx.split('<div class="title">')[1].split('<')[0]
        
             urls.push(url)
             images.push(image)
             titles.push(title)
             console.log( "URL: " + url )
             console.log( "IMAGE: " + image )  
             console.log( "TITLE: " + title )     
            
       
    }

 
    for(i=1; i<urls.length; i++)
    {

   
      const html = await getHTML(urls[i]);
        
      const { document } = getDOM(html).window;
      
     try{

      var xx = html.split('.onclick = function () {window.open("')[1].split('"')[0]
    
      console.log( "XXX: " + xx )
    
      xx='https://myemulator.online/'+xx;

      urls2.push(xx)
 
          
     
               
      }
      catch(err) {
        console.log ("ERROR HTML");  return videosArray; i=36;
      }
    }

//////////////////

for(i=1; i<urls2.length; i++)
{


  const html = await getHTML(urls2[i]);
    
  const { document } = getDOM(html).window;
  
 try{

  var gameZip = html.split('var gameUrl = "')[1].split('"')[0]

  console.log( "XXX2: " + gameZip )

  

  var video= {
                'title':titles[i],
                'thumb': images[i],
                'url':gameZip,
                'desc':'desc'
              };


   videosArray.push(video)


     console.log( "IMAGE: " + images[i] )
     console.log( "URLS: " + xx )
     console.log( "TITLE: " + titles[i] )
     console.log( "----------")
           
  }
  catch(err) {
    console.log ("ERROR HTML"); 
        
  }

  
}
return videosArray; i=36;
 }
//////////////////////////////////////////////////////////////////////////







   



module.exports ={browse}