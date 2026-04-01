const BaseScraper = require('./baseScraper');

/**
 * Kerala RERA Scraper
 * Site: https://rera.kerala.gov.in/explore-projects
 * Type: Single Page Application (React/Vue) — data loaded via XHR/fetch.
 * Strategy: Puppeteer — intercept API response OR scrape rendered DOM.
 */
class KeralaScraper extends BaseScraper {
  constructor() {
    super();
    this.baseUrl = 'https://rera.kerala.gov.in';
    this.url = 'https://rera.kerala.gov.in/explore-projects';
  }

  async extract(maxRecords = 100, filters = {}) {
    const allProjects = [];
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(this.headers['User-Agent']);

      // Intercept API calls for project data
      let apiProjects = null;
      page.on('response', async (res) => {
        const url = res.url();
        const ct = res.headers()['content-type'] || '';
        if (ct.includes('application/json') && url.includes('project') && !apiProjects) {
          try {
            const json = await res.json();
            const records = Array.isArray(json) ? json
              : json.data || json.projects || json.result || json.items || [];
            if (records.length > 0) apiProjects = records;
          } catch (_) {}
        }
      });

      await page.goto(this.url, { waitUntil: 'networkidle2', timeout: 45000 });
      await page.waitForSelector('table, .project-card, [class*="project"]', { timeout: 15000 }).catch(() => {});
      await this.delay(3000);

      // Use intercepted API data if available
      if (apiProjects) {
        for (const rec of apiProjects.slice(0, maxRecords)) {
          allProjects.push(this.formatProject({
            name: rec.projectName || rec.project_name || rec.name || 'N/A',
            promoter: rec.promoterName || rec.promoter || rec.developer || 'N/A',
            registrationNo: rec.registrationNo || rec.reg_no || rec.reraNo || 'N/A',
            district: rec.district || rec.location || rec.city || 'N/A',
            status: rec.status || rec.projectStatus || 'Registered',
            url: rec.detailUrl || rec.url || 'N/A'
          }));
        }
        return allProjects;
      }

      // Fallback: DOM scraping with pagination
      let pageNum = 1;
      while (allProjects.length < maxRecords) {
        const cheerio = require('cheerio');
        const content = await page.content();
        const $ = cheerio.load(content);
        const colIndex = this._detectColumns($);
        let rowsOnPage = 0;

        $('table tbody tr').each((i, row) => {
          if (allProjects.length >= maxRecords) return false;
          const cells = $(row).find('td');
          if (cells.length < 3) return;
          const href = $(row).find('a').first().attr('href');
          allProjects.push(this.formatProject({
            name: cells.eq(colIndex.projectName).text().trim(),
            promoter: cells.eq(colIndex.promoter).text().trim(),
            registrationNo: cells.eq(colIndex.registrationNo).text().trim(),
            district: cells.eq(colIndex.district).text().trim(),
            status: cells.eq(colIndex.status).text().trim() || 'Registered',
            url: href ? (href.startsWith('http') ? href : this.baseUrl + href) : 'N/A'
          }));
          rowsOnPage++;
        });

        if (rowsOnPage === 0) break;

        const nextClicked = await page.evaluate(() => {
          const btn = document.querySelector('a[aria-label="Next"], .next a, button.next, [class*="next"]');
          if (btn && !btn.closest('li')?.classList.contains('disabled')) { btn.click(); return true; }
          return false;
        });
        if (!nextClicked) break;
        await this.delay(2000);
        pageNum++;
      }
    } catch (err) {
      console.error('Kerala scraper error:', err.message);
    } finally {
      await browser.close();
    }

    return allProjects;
  }

  _detectColumns($) {
    const fallback = { sNo: 0, registrationNo: 1, projectName: 2, promoter: 3, district: 4, status: 5 };
    const headerCells = $('table thead tr th, table tr:first-child th');
    if (headerCells.length === 0) return fallback;
    const result = { ...fallback };
    headerCells.each((i, el) => {
      const text = $(el).text().trim().toLowerCase();
      if (text.includes('registration')) result.registrationNo = i;
      else if (text.includes('project')) result.projectName = i;
      else if (text.includes('promoter') || text.includes('developer')) result.promoter = i;
      else if (text.includes('district') || text.includes('location')) result.district = i;
      else if (text.includes('status')) result.status = i;
    });
    return result;
  }
}

module.exports = KeralaScraper;