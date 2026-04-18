const scraper = require('./x.js');

scraper.getEroticThumbs('https://eroticmv.com/category/genre/classic-erotica/', 0, (err, data) => {
    if (err) {
        console.log("Failed:", err);
    } else {
        console.log("Scraped Data:", data);
    }
});