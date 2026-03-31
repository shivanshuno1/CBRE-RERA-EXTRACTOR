const BaseScraper = require('./baseScraper');

class OdishaScraper extends BaseScraper {
  constructor() {
    super();
    this.baseUrl = 'https://rera.odisha.gov.in';
    this.listingUrl = 'https://rera.odisha.gov.in/projects/project-list';
  }

  async extract(maxRecords = 100, filters = {}) {
    try {
      console.log('🔍 Scraping Odisha RERA...');
      const projects = [];
      
      const $ = await this.fetchWithPuppeteer(this.listingUrl, 'table');
      
      const tables = $('table');
      
      for (let tableIndex = 0; tableIndex < tables.length; tableIndex++) {
        const table = tables[tableIndex];
        const rows = $(table).find('tbody tr');
        
        for (let i = 0; i < Math.min(rows.length, maxRecords); i++) {
          const row = rows[i];
          const cells = $(row).find('td');
          
          if (cells.length >= 3) {
            const project = {
              name: $(cells[1]).text().trim(),
              promoter: $(cells[2]).text().trim(),
              registrationNo: $(cells[0]).text().trim(),
              district: $(cells[3]).text().trim() || 'Odisha',
              status: cells[4] ? $(cells[4]).text().trim() : 'Registered',
              url: this.listingUrl
            };
            
            // Get detail URL if available
            const detailLink = $(row).find('a').attr('href');
            if (detailLink) {
              project.url = detailLink.startsWith('http') ? detailLink : `${this.baseUrl}${detailLink}`;
            }
            
            if (project.name && project.name !== '') {
              projects.push(this.formatProject(project));
            }
          }
          
          if (projects.length >= maxRecords) break;
        }
        
        if (projects.length >= maxRecords) break;
      }
      
      console.log(`✅ Extracted ${projects.length} projects from Odisha`);
      return projects;
    } catch (error) {
      console.error('Odisha scraper error:', error);
      return [];
    }
  }
}

module.exports = OdishaScraper;