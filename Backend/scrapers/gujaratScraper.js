const BaseScraper = require('./baseScraper');

/**
 * Gujarat RERA Scraper
 * Site: https://gujrera.gujarat.gov.in/#/home-p/registered-project-listing
 * Type: Angular SPA — the table is rendered client-side from an XHR/API call.
 * Strategy: Launch Puppeteer, intercept the JSON API response directly.
 */
class GujaratScraper extends BaseScraper {
  constructor() {
    super();
    this.baseUrl = 'https://gujrera.gujarat.gov.in';
    this.listUrl = 'https://gujrera.gujarat.gov.in/#/home-p/registered-project-listing';
  }

  async extract(maxRecords = 100, filters = {}) {
    const allProjects = [];
    const browser = await this._launchBrowser();

    try {
      const page = await browser.newPage();
      await page.setUserAgent(this.headers['User-Agent']);

      // Intercept API calls made by the Angular app
      let apiData = null;
      page.on('response', async (response) => {
        const url = response.url();
        // Gujarat RERA typically calls an endpoint like /api/projects or similar
        if (url.includes('/api/') && url.includes('project') && !apiData) {
          try {
            const json = await response.json();
            apiData = json;
          } catch (_) {}
        }
      });

      await page.goto(this.listUrl, { waitUntil: 'networkidle2', timeout: 45000 });
      // Wait for the table to render
      await page.waitForSelector('table, .project-list, [class*="project"]', { timeout: 15000 }).catch(() => {});
      await this.delay(3000);

      // If we captured API data, parse it directly
      if (apiData) {
        const records = Array.isArray(apiData) ? apiData : apiData.data || apiData.projects || apiData.result || [];
        for (const rec of records.slice(0, maxRecords)) {
          allProjects.push(this.formatProject({
            name: rec.projectName || rec.project_name || rec.name || 'N/A',
            promoter: rec.promoterName || rec.promoter_name || rec.promoter || 'N/A',
            registrationNo: rec.registrationNo || rec.registration_no || rec.regNo || 'N/A',
            district: rec.district || rec.taluka || rec.location || 'N/A',
            status: rec.status || rec.projectStatus || 'Registered',
            url: rec.url || 'N/A'
          }));
        }
        return allProjects;
      }

      // Fallback: scrape rendered HTML table
      const content = await page.content();
      const cheerio = require('cheerio');
      const $ = cheerio.load(content);

      const colIndex = this._detectColumns($);
      const rows = $('table tbody tr');

      rows.each((i, row) => {
        if (i >= maxRecords) return false;
        const cells = $(row).find('td');
        allProjects.push(this.formatProject({
          name: cells.eq(colIndex.projectName).text().trim(),
          promoter: cells.eq(colIndex.promoter).text().trim(),
          registrationNo: cells.eq(colIndex.registrationNo).text().trim(),
          district: cells.eq(colIndex.district).text().trim(),
          status: cells.eq(colIndex.status).text().trim(),
          url: this._resolveHref(cells.find('a').first().attr('href'), this.baseUrl)
        }));
      });

    } finally {
      await browser.close();
    }

    return allProjects;
  }

  async _launchBrowser() {
    const puppeteer = require('puppeteer');
    return puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  }

  _detectColumns($) {
    // Fallback column indices for Gujarat RERA table
    return { sNo: 0, registrationNo: 1, projectName: 2, promoter: 3, district: 4, status: 5 };
  }

  _resolveHref(href, base) {
    if (!href || href === '#') return 'N/A';
    if (href.startsWith('http')) return href;
    return base + (href.startsWith('/') ? '' : '/') + href;
  }
}

module.exports = GujaratScraper;