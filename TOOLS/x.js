const cheerio = require("cheerio");
const axios = require("axios");

async function getEroticThumbs(siteUrl, endFlag, callback) {
  let videosArray = [];

  if (endFlag !== 0) return callback(null, videosArray);

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };

    // 1. Get the list of videos
    const { data: listHtml } = await axios.get(siteUrl, { headers });
    const $ = cheerio.load(listHtml);
    const initialList = [];

    $('article').each((i, item) => {
      initialList.push({
        title: $(item).find('a').attr('title') || 'No Title',
        pageUrl: $(item).find('a').attr('href'), // The link to the actual movie page
        thumb: $(item).find('img').attr('src'),
      });
    });

    // 2. Visit each movie page to find the stream link
    for (const video of initialList) {
      try {
        const { data: videoPageHtml } = await axios.get(video.pageUrl, { headers });
        
        // Find the m3u8 link in the source of the specific video page
        const streamMatch = videoPageHtml.match(/https?:\/\/[^"']+\.m3u8/);
        const streamUrl = streamMatch ? streamMatch[0] : null;

        videosArray.push({
          title: video.title,
          url: streamUrl || video.pageUrl, // Use stream if found, otherwise the page link
          thumb: video.thumb,
          desc: streamUrl ? 'Full Stream Found' : 'Stream Not Found'
        });
        
        console.log(`Finished: ${video.title}`);
      } catch (e) {
        console.error(`Could not deep-scrape ${video.title}`);
        videosArray.push(video); // Push original data if deep scrape fails
      }
    }

    callback(null, videosArray);
  } catch (error) {
    callback(error, null);
  }
}

module.exports = { getEroticThumbs };