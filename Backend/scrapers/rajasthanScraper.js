const BaseScraper = require('./baseScraper');

class RajasthanScraper extends BaseScraper {
  constructor() {
    super();
    this.baseUrl = 'https://rera.rajasthan.gov.in';
    this.listingUrl = 'https://rera.rajasthan.gov.in/ProjectList?status=0';
  }

  async extract(maxRecords = 100, filters = {}) {
    try {
      console.log('🔍 Scraping Rajasthan RERA...');
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
              district: cells[3] ? $(cells[3]).text().trim() : 'Rajasthan',
              status: cells[4] ? $(cells[4]).text().trim() : 'Registered',
              url: this.listingUrl
            };
            
            if (project.name && project.name !== '') {
              projects.push(this.formatProject(project));
            }
          }
          
          if (projects.length >= maxRecords) break;
        }
        
        if (projects.length >= maxRecords) break;
      }
      
      console.log(`✅ Extracted ${projects.length} projects from Rajasthan`);
      return projects;
    } catch (error) {
      console.error('Rajasthan scraper error:', error);
      return [];
    }
  }
}

module.exports = RajasthanScraper;