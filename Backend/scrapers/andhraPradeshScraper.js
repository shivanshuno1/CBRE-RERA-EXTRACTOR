const BaseScraper = require('./baseScraper');

class AndhraPradeshScraper extends BaseScraper {
  constructor() {
    super();
    this.baseUrl = 'https://rera.ap.gov.in';
    this.listingUrl = 'https://rera.ap.gov.in/RERA/Views/Reports/ApprovedProjects.aspx';
  }

  async extract(maxRecords = 100, filters = {}) {
    try {
      console.log('🔍 Scraping Andhra Pradesh RERA...');
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
              district: cells[3] ? $(cells[3]).text().trim() : 'Andhra Pradesh',
              status: 'Approved',
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
      
      console.log(`✅ Extracted ${projects.length} projects from Andhra Pradesh`);
      return projects;
    } catch (error) {
      console.error('Andhra Pradesh scraper error:', error);
      return [];
    }
  }
}

module.exports = AndhraPradeshScraper;