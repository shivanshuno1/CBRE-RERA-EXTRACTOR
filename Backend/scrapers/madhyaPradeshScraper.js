const BaseScraper = require('./baseScraper');

class MadhyaPradeshScraper extends BaseScraper {
  constructor() {
    super();
    this.urls = {
      ongoing: 'https://www.rera.mp.gov.in/projects-ongoing/',
      completed: 'https://www.rera.mp.gov.in/projects-completed/',
      extended: 'https://www.rera.mp.gov.in/projects-extended/',
      withdrawn: 'https://www.rera.mp.gov.in/projects-withdrawn/',
      revoked: 'https://www.rera.mp.gov.in/revoked-registration/'
    };
  }

  async extract(maxRecords = 100, filters = {}) {
    try {
      console.log('🔍 Scraping Madhya Pradesh RERA...');
      const allProjects = [];
      const status = filters.status || 'ongoing';
      const url = this.urls[status] || this.urls.ongoing;
      
      console.log(`Fetching ${status} projects from: ${url}`);
      const $ = await this.fetchHTML(url);
      
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
              district: cells[3] ? $(cells[3]).text().trim() : 'Madhya Pradesh',
              status: status.charAt(0).toUpperCase() + status.slice(1),
              url: url
            };
            
            if (project.name && project.name !== '') {
              allProjects.push(this.formatProject(project));
            }
          }
          
          if (allProjects.length >= maxRecords) break;
        }
        
        if (allProjects.length >= maxRecords) break;
      }
      
      console.log(`✅ Extracted ${allProjects.length} projects from Madhya Pradesh (${status})`);
      return allProjects;
    } catch (error) {
      console.error('Madhya Pradesh scraper error:', error);
      return [];
    }
  }
}

module.exports = MadhyaPradeshScraper;