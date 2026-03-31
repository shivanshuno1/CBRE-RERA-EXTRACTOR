const BaseScraper = require('./baseScraper');

class WestBengalScraper extends BaseScraper {
  constructor() {
    super();
    this.baseUrl = 'https://rera.wb.gov.in';
    this.listingUrl = 'https://rera.wb.gov.in/district_project.php?dcode=0';
  }

  async extract(maxRecords = 100, filters = {}) {
    try {
      console.log('🔍 Scraping West Bengal RERA...');
      const projects = [];
      
      const $ = await this.fetchHTML(this.listingUrl);
      
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
              district: $(cells[3]).text().trim() || 'West Bengal',
              status: 'Registered',
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
      
      console.log(`✅ Extracted ${projects.length} projects from West Bengal`);
      return projects;
    } catch (error) {
      console.error('West Bengal scraper error:', error);
      return [];
    }
  }
}

module.exports = WestBengalScraper;