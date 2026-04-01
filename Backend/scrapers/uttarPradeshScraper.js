const BaseScraper = require('./baseScraper');

/**
 * Uttar Pradesh RERA Scraper
 * Site: https://up-rera.in/projects
 * Type: Dynamic JS-rendered table with server-side pagination.
 * Strategy: Puppeteer — wait for table, scrape page, click Next, repeat.
 */
class UttarPradeshScraper extends BaseScraper {
  constructor() {
    super();
    this.baseUrl = 'https://up-rera.in';
    this.url = 'https://up-rera.in/projects';
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
      await page.goto(this.url, { waitUntil: 'networkidle2', timeout: 45000 });
      await page.waitForSelector('table, .datatable, [id*="project"]', { timeout: 15000 });
      await this.delay(2000);

      let pageNum = 1;
      while (allProjects.length < maxRecords) {
        console.log(`UP RERA: scraping page ${pageNum}...`);

        const cheerio = require('cheerio');
        const content = await page.content();
        const $ = cheerio.load(content);
        const colIndex = this._detectColumns($);
        let rowsOnPage = 0;

        $('table tbody tr').each((i, row) => {
          if (allProjects.length >= maxRecords) return false;
          const cells = $(row).find('td');
          if (cells.length < 3) return;

          const href = cells.eq(colIndex.registrationNo).find('a').attr('href')
            || $(row).find('a').first().attr('href');

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

        if (rowsOnPage === 0 || allProjects.length >= maxRecords) break;

        // Try to click the "Next" pagination button
        const nextClicked = await page.evaluate(() => {
          const btn = document.querySelector(
            'a[aria-label="Next"], .next a, button.next, [id*="next"], a:contains("Next"), li.next a'
          );
          if (btn && !btn.closest('li')?.classList.contains('disabled')) {
            btn.click();
            return true;
          }
          return false;
        });

        if (!nextClicked) break;
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
        await this.delay(1500);
        pageNum++;
      }
    } catch (err) {
      console.error('Uttar Pradesh scraper error:', err.message);
    } finally {
      await browser.close();
    }

    return allProjects;
  }

  _detectColumns($) {
    const fallback = { sNo: 0, registrationNo: 1, projectName: 2, promoter: 3, district: 4, status: 5 };
    const headerCells = $('table thead tr th, table thead tr td, table tr:first-child th');
    if (headerCells.length === 0) return fallback;

    const result = { ...fallback };
    headerCells.each((i, el) => {
      const text = $(el).text().trim().toLowerCase();
      if (text.includes('registration') || text.includes('rera no')) result.registrationNo = i;
      else if (text.includes('project')) result.projectName = i;
      else if (text.includes('promoter') || text.includes('developer')) result.promoter = i;
      else if (text.includes('district') || text.includes('location') || text.includes('city')) result.district = i;
      else if (text.includes('status')) result.status = i;
    });
    return result;
  }
}

module.exports = UttarPradeshScraper;