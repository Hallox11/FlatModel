
const miniget = require("miniget");
const { JSDOM } = require("jsdom");





   

    async function getHTML(url) {
        return await miniget(url).text();
    }
    function getDOM(html) {
        return new JSDOM(html);
    }
    /**
     * Browse pages and get data. Defaults to homepage.
     * @param {string} [path] Browsing path
     */
      async function browse(path = undefined, videosArray) {
        const html = await getHTML(`${'https://xvideos.com'}${path && typeof path === "string" ? path : ""}`);
       console.log("path: " + path);
       
        const { document } = getDOM(html).window;
        const videos = document.querySelectorAll('div[class="thumb-block  "]');
       
                 
       

        videos.forEach(video => {
            const paragraph = video.querySelector('p[class="title"]');

            videosArray.push({
                id: video.getAttribute("data-id"),
                title: paragraph.querySelector("a").title,
                url: `${'https://xvideos.com'}${paragraph.querySelector('a').href}`,
             
                thumbnail: video.querySelector('img').getAttribute("data-src"),
             //   link:this.getInfo(`${Constants.BASE_URL}${video.querySelector('p[class="metadata"]').querySelector('a').href}`)
               
            })
        });

       // const resultTxt=(JSON.stringify(videosArray, null, 2));
        return videosArray;
    }
//////////////////////////////////////////////////////////////////////////



///////////////////////////////////////////////////////////////////////////
    /**
     * Returns video info
     * @param {string} url Video url
     */
     async function getInfo(url) {
        if (!url || typeof url !== "string") throw new Error("URL must be a string.");
        const html = await getHTML(url);
        
        const { document } = getDOM(html).window;
        const ratings = document.querySelectorAll('.rating-inbtn');
        const vidMetadata = document.querySelector('.video-metadata');

        const info = {
            url: url,
            title: document.querySelector("meta[property='og:title']").getAttribute("content"),
            length: parseInt(document.querySelector("meta[property='og:duration']").getAttribute("content")) || 0,
          //  views: parseInt(document.querySelector("#nb-views-number").textContent.split(",").join("")) || 0,
            streams: {
                hq: html.split("html5player.setVideoUrlHigh('")[1].split("');")[0],
                lq: html.split("html5player.setVideoUrlLow('")[1].split("');")[0],
                hls: html.split("html5player.setVideoHLS('")[1].split("');")[0],
                slide_thumb: html.split("html5player.setThumbSlide('")[1].split("');")[0]
            },
            thumbnail: document.querySelector('meta[property="og:image"]').getAttribute("content"),
          //  relatedVideos: Util.parseRelated(html.split("<script>var video_related=")[1].split(";window.wpn_categories")[0]),
            ratings: {
            //    likes: ratings[0].textContent,
             //   dislikes: ratings[1].textContent
            },
         //   comments: document.querySelector('.nb-video-comments').textContent,
            channel: {
          //      name: vidMetadata.querySelector('span[class="name"]').textContent,
                url: `${'https://xvideos.com'}${vidMetadata.querySelector("a").href}`,
           //     subscribers: vidMetadata.querySelector('span[class="count"]').textContent
            }
        };

        return info;
    }

   



module.exports ={getInfo,browse}