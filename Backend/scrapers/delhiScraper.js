const BaseScraper = require('./baseScraper');

/**
 * Delhi RERA Scraper
 * Site: https://rera.delhi.gov.in/registered_promoters_list
 * Type: Static HTML table.
 * Strategy: Cheerio, single fetch.
 */
class DelhiScraper extends BaseScraper {
  constructor() {
    super();
    this.baseUrl = 'https://rera.delhi.gov.in';
    this.url = 'https://rera.delhi.gov.in/registered_promoters_list';
  }

  async extract(maxRecords = 100, filters = {}) {
    const allProjects = [];
    try {
      const $ = await this.fetchHTML(this.url);
      const colIndex = this._detectColumns($);

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
      });
    } catch (err) {
      console.error('Delhi scraper error:', err.message);
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
      if (text.includes('registration')) result.registrationNo = i;
      else if (text.includes('project')) result.projectName = i;
      else if (text.includes('promoter') || text.includes('developer')) result.promoter = i;
      else if (text.includes('district') || text.includes('location') || text.includes('zone')) result.district = i;
      else if (text.includes('status')) result.status = i;
    });
    return result;
  }
}

module.exports = DelhiScraper;