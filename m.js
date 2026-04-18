const {chromium}=require('playwright');
const fs= require('fs');

async function scrapeSL(){

const browser= await chromium.launch();
const page= await browser.newPage();


await page.goto('https://secondlife.com/destinations/art');

await page.waitForSelector('.dg-collection-item');


const destinations =await page.$$eval('.dg-collection-item', items =>{
      return items.map(item => {
       return{

        title:item.querySelector('.dg2-destination-title-h2')?.innerText.trim(),

        description:item.querySelector('.dg2-destination-description')?.innerText.trim(),

        image:item.querySelector('.dg2-lg-feature-image')?.src,

        link: 'https://secondlife.com' + item.querySelector('a.dg-link-block')?.getAttribute('href')

       };
      });
    });

const cleanData = destinations.filter(d => d.title);

fs.writeFileSync('destinations.json', JSON.stringify(cleanData,null,2));

await browser.close();
  }

  scrapeSL();







