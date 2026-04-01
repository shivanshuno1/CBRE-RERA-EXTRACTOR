const BaseScraper = require('./baseScraper');

/**
 * Odisha RERA Scraper
 * Site: https://rera.odisha.gov.in/projects/project-list
 * Type: Project list with a "Detail" button per row — details in modal/page.
 * Strategy: Puppeteer — scrape list for basic info, optionally click Detail for more.
 * Note: Fetching every detail page is slow. Set filters.detailedFetch=true to enable it.
 */
class OdishaScraper extends BaseScraper {
  constructor() {
    super();
    this.baseUrl = 'https://rera.odisha.gov.in';
    this.url = 'https://rera.odisha.gov.in/projects/project-list';
  }

  async extract(maxRecords = 100, filters = {}) {
    const allProjects = [];
    const detailedFetch = filters.detailedFetch === true;
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(this.headers['User-Agent']);
      await page.goto(this.url, { waitUntil: 'networkidle2', timeout: 45000 });
      await page.waitForSelector('table, .project-list', { timeout: 15000 }).catch(() => {});
      await this.delay(2000);

      let pageNum = 1;
      while (allProjects.length < maxRecords) {
        console.log(`Odisha RERA: page ${pageNum}`);
        const cheerio = require('cheerio');
        const content = await page.content();
        const $ = cheerio.load(content);
        const rows = $('table tbody tr');
        let rowsOnPage = 0;

        for (let i = 0; i < rows.length && allProjects.length < maxRecords; i++) {
          const row = rows[i];
          const cells = $(row).find('td');
          if (cells.length < 3) continue;

          // Basic info from list row
          const basicProject = {
            name: cells.eq(2).text().trim() || cells.eq(1).text().trim(),
            promoter: cells.eq(3).text().trim(),
            registrationNo: cells.eq(1).text().trim(),
            district: cells.eq(4).text().trim(),
            status: cells.eq(5).text().trim() || 'Registered',
            url: 'N/A'
          };

          if (detailedFetch) {
            // Click the detail button for this row
            try {
              const detailBtn = await page.$(`table tbody tr:nth-child(${i + 1}) a, table tbody tr:nth-child(${i + 1}) button`);
              if (detailBtn) {
                await detailBtn.click();
                await this.delay(1500);
                const detailContent = await page.content();
                const $d = cheerio.load(detailContent);

                // Extract from detail page/modal — look for labeled fields
                basicProject.name = this._extractField($d, 'project name') || basicProject.name;
                basicProject.promoter = this._extractField($d, 'promoter') || basicProject.promoter;
                basicProject.registrationNo = this._extractField($d, 'registration') || basicProject.registrationNo;
                basicProject.district = this._extractField($d, 'district') || basicProject.district;
                basicProject.status = this._extractField($d, 'status') || basicProject.status;
                basicProject.url = page.url();

                // Go back to list
                await page.goBack({ waitUntil: 'networkidle2', timeout: 15000 });
                await this.delay(1000);
              }
            } catch (err) {
              console.warn(`Detail fetch failed for row ${i}:`, err.message);
            }
          }

          allProjects.push(this.formatProject(basicProject));
          rowsOnPage++;
        }

        if (rowsOnPage === 0) break;

        // Paginate
        const nextClicked = await page.evaluate(() => {
          const btn = document.querySelector('a[aria-label="Next"], .next a, li.next:not(.disabled) a');
          if (btn) { btn.click(); return true; }
          return false;
        });
        if (!nextClicked) break;
        await this.delay(2000);
        pageNum++;
      }
    } catch (err) {
      console.error('Odisha scraper error:', err.message);
    } finally {
      await browser.close();
    }

    return allProjects;
  }

  // Extract a field value from a detail page by searching for a label
  _extractField($, label) {
    let value = null;
    $('td, th, label, dt, .field-label').each((_, el) => {
      if ($(el).text().trim().toLowerCase().includes(label)) {
        const sibling = $(el).next('td, dd, .field-value');
        if (sibling.length) { value = sibling.text().trim(); return false; }
      }
    });
    return value;
  }
}

module.exports = OdishaScraper;