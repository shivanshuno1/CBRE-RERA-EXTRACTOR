const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

class BaseScraper {
  constructor() {
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    };
  }

  async fetchHTML(url, usePuppeteer = false, waitForSelector = null) {
    try {
      if (usePuppeteer) {
        return await this.fetchWithPuppeteer(url, waitForSelector);
      }
      
      const response = await axios.get(url, { 
        headers: this.headers,
        timeout: 30000,
        maxRedirects: 5
      });
      return cheerio.load(response.data);
    } catch (error) {
      console.error(`Error fetching ${url}:`, error.message);
      throw error;
    }
  }

  async fetchWithPuppeteer(url, waitForSelector = null) {
    const browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    try {
      const page = await browser.newPage();
      await page.setUserAgent(this.headers['User-Agent']);
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout: 10000 });
      }
      
      const content = await page.content();
      return cheerio.load(content);
    } finally {
      await browser.close();
    }
  }

  async extract(maxRecords, filters) {
    throw new Error('Extract method must be implemented by subclass');
  }

  formatProject(project) {
    return {
      projectName: project.name || 'N/A',
      promoterName: project.promoter || 'N/A',
      registrationNumber: project.registrationNo || 'N/A',
      district: project.district || 'N/A',
      status: project.status || 'Registered',
      totalArea: project.area || 'N/A',
      url: project.url || 'N/A',
      extractedAt: new Date().toISOString()
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = BaseScraper;