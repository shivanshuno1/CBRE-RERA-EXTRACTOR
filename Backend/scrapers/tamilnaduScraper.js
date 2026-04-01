const BaseScraper = require('./baseScraper');

class TamilnaduScraper extends BaseScraper {
  constructor() {
    super();
    this.urls = {
      building: 'https://rera.tn.gov.in/cms/reg_projects_tamilnadu/Building/2025.php',
      normalLayout: 'https://rera.tn.gov.in/cms/reg_projects_tamilnadu/Normal_Layout/2025.php',
      regularisationLayout: 'https://rera.tn.gov.in/registered_reglayout'
    };
  }

  async extract(maxRecords = 100, filters = {}) {
    try {
      const type = filters.type || 'building';
      const url = this.urls[type];
      if (!url) {
        console.error(`Unknown type: ${type}`);
        return [];
      }

      console.log(`🔍 Fetching ${type} projects from: ${url}`);

      // Use Puppeteer for all types – these pages are dynamic
      let $;
      try {
        $ = await this.fetchWithPuppeteer(url, 'table');
      } catch (err) {
        console.error(`Puppeteer failed for ${url}:`, err.message);
        // Return a helpful message so the frontend shows something
        return [{
          name: '⚠️ Page could not be loaded',
          promoter: 'The Tamil Nadu RERA page may be unreachable or require manual interaction.',
          registrationNo: 'Check URL: ' + url,
          district: 'Tamil Nadu',
          status: 'Error',
          url: url,
          note: 'Please try accessing the URL directly in your browser.'
        }];
      }

      // Find the table containing project data
      const tables = $('table');
      let targetTable = null;

      // First, try to find a table with thead that contains expected headers
      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        const headers = $(table).find('thead th').map((_, th) => $(th).text().trim()).get();
        if (headers.some(h => h.includes('Registration') || h.includes('Project') || h.includes('Promoter'))) {
          targetTable = table;
          break;
        }
      }

      // If none found, take the first table with at least one row
      if (!targetTable) {
        for (let i = 0; i < tables.length; i++) {
          if ($(tables[i]).find('tbody tr').length > 0) {
            targetTable = tables[i];
            break;
          }
        }
      }

      if (!targetTable) {
        console.error('No data table found');
        return [{
          name: 'No data table found',
          promoter: 'The page structure may have changed.',
          registrationNo: 'Please inspect manually',
          district: 'Tamil Nadu',
          status: 'Error',
          url: url
        }];
      }

      // Determine column mapping from headers
      const headers = $(targetTable).find('thead th').map((_, th) => $(th).text().trim()).get();
      let colMap = { regNo: null, promoter: null, projectDetails: null, status: null };

      if (headers.length) {
        headers.forEach((header, idx) => {
          const lower = header.toLowerCase();
          if (lower.includes('registration') || lower.includes('reg no')) colMap.regNo = idx;
          else if (lower.includes('promoter') || lower.includes('name and address')) colMap.promoter = idx;
          else if (lower.includes('project') || lower.includes('details') || lower.includes('address')) colMap.projectDetails = idx;
          else if (lower.includes('status')) colMap.status = idx;
        });
      }

      // Fallback to index-based mapping if headers didn't match
      if (colMap.regNo === null) colMap.regNo = 1;
      if (colMap.promoter === null) colMap.promoter = 2;
      if (colMap.projectDetails === null) colMap.projectDetails = 3;
      if (colMap.status === null) colMap.status = 7; // observed in Building page

      const rows = $(targetTable).find('tbody tr');
      const projects = [];

      for (let i = 0; i < rows.length && projects.length < maxRecords; i++) {
        const cells = $(rows[i]).find('td');
        if (cells.length <= Math.max(...Object.values(colMap))) continue;

        const registrationNo = $(cells[colMap.regNo]).text().trim();
        const promoterName = $(cells[colMap.promoter]).text().trim();
        const projectDetails = $(cells[colMap.projectDetails]).text().trim();
        const status = colMap.status !== null ? $(cells[colMap.status]).text().trim() : 'Registered';

        // Extract project name (first part before hyphen)
        let projectName = projectDetails;
        if (projectDetails.includes('-')) {
          projectName = projectDetails.split('-')[0].trim();
        }

        // Extract district from project details
        let district = 'Tamil Nadu';
        const districtMatch = projectDetails.match(/District[:\s]+([^,\n]+)/i);
        if (districtMatch) district = districtMatch[1].trim();

        if (projectName && registrationNo) {
          projects.push(this.formatProject({
            name: projectName,
            promoter: promoterName,
            registrationNo: registrationNo,
            district: district,
            status: status,
            url: url,
            type: type
          }));
        }
      }

      console.log(`✅ Extracted ${projects.length} projects from Tamil Nadu (${type})`);
      return projects;
    } catch (error) {
      console.error('Tamil Nadu scraper error:', error);
      return [];
    }
  }
}

module.exports = TamilnaduScraper;