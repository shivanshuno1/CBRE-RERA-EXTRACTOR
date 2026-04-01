const BaseScraper = require('./baseScraper');

/**
 * Madhya Pradesh RERA Scraper
 * Sites (5 status tabs):
 *   Ongoing:    https://www.rera.mp.gov.in/projects-ongoing/
 *   Completed:  https://www.rera.mp.gov.in/projects-completed/
 *   Extended:   https://www.rera.mp.gov.in/projects-extended/
 *   Withdrawn:  https://www.rera.mp.gov.in/projects-withdrawn/
 *   Revoked:    https://www.rera.mp.gov.in/revoked-registration/
 * Type: Static HTML tables (WordPress-based site).
 * Strategy: Cheerio, fetch each status URL, merge results.
 */
class MadhyaPradeshScraper extends BaseScraper {
  constructor() {
    super();
    this.baseUrl = 'https://www.rera.mp.gov.in';
    this.statusUrls = {
      ongoing:   'https://www.rera.mp.gov.in/projects-ongoing/',
      completed: 'https://www.rera.mp.gov.in/projects-completed/',
      extended:  'https://www.rera.mp.gov.in/projects-extended/',
      withdrawn: 'https://www.rera.mp.gov.in/projects-withdrawn/',
      revoked:   'https://www.rera.mp.gov.in/revoked-registration/'
    };
  }

  async extract(maxRecords = 100, filters = {}) {
    const allProjects = [];
    // filters.status can be one of the keys above, or 'all' (default)
    const status = filters.status || 'all';
    const targets = status === 'all'
      ? Object.entries(this.statusUrls)
      : [[status, this.statusUrls[status] || this.statusUrls.ongoing]];

    for (const [statusName, url] of targets) {
      if (allProjects.length >= maxRecords) break;
      try {
        const $ = await this.fetchHTML(url);
        const colIndex = this._detectColumns($, statusName);
        const remaining = maxRecords - allProjects.length;

        $('table tbody tr, .wp-block-table tbody tr').each((i, row) => {
          if (i >= remaining) return false;
          const cells = $(row).find('td');
          if (cells.length < 3) return;

          const href = cells.eq(colIndex.registrationNo).find('a').attr('href')
            || $(row).find('a').first().attr('href');

          allProjects.push(this.formatProject({
            name: cells.eq(colIndex.projectName).text().trim(),
            promoter: cells.eq(colIndex.promoter).text().trim(),
            registrationNo: cells.eq(colIndex.registrationNo).text().trim(),
            district: cells.eq(colIndex.district).text().trim(),
            status: statusName.charAt(0).toUpperCase() + statusName.slice(1),
            url: href ? (href.startsWith('http') ? href : this.baseUrl + href) : 'N/A'
          }));
        });

        await this.delay(500);
      } catch (err) {
        console.error(`Madhya Pradesh (${statusName}) scraper error:`, err.message);
      }
    }

    return allProjects;
  }

  _detectColumns($, statusName) {
    // MP RERA typical column order:
    // col[0]=S.No, col[1]=Reg No, col[2]=Project Name, col[3]=Promoter, col[4]=District, col[5]=Status(optional)
    const fallback = { sNo: 0, registrationNo: 1, projectName: 2, promoter: 3, district: 4, status: 5 };
    const headerCells = $('table thead tr th, table thead tr td, .wp-block-table thead tr th, table tr:first-child th');
    if (headerCells.length === 0) return fallback;

    const result = { ...fallback };
    headerCells.each((i, el) => {
      const text = $(el).text().trim().toLowerCase();
      if (text.includes('registration') || text.includes('reg no') || text.includes('rera no')) result.registrationNo = i;
      else if (text.includes('project')) result.projectName = i;
      else if (text.includes('promoter') || text.includes('developer') || text.includes('applicant')) result.promoter = i;
      else if (text.includes('district') || text.includes('city') || text.includes('location')) result.district = i;
      else if (text.includes('status')) result.status = i;
    });
    return result;
  }
}

module.exports = MadhyaPradeshScraper;