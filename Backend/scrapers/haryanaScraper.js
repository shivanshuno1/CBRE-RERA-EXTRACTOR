const BaseScraper = require('./baseScraper');

class HaryanaScraper extends BaseScraper {
  constructor() {
    super();
    this.urls = {
      panchkula: 'https://haryanarera.gov.in/admincontrol/registered_projects/1',
      gurugram: 'https://haryanarera.gov.in/admincontrol/registered_projects/2'
    };
  }

  async extract(maxRecords = 100, filters = {}) {
    const allProjects = [];
    const region = filters.region || 'panchkula';
    const url = this.urls[region] || this.urls.panchkula;
    
    try {
      const $ = await this.fetchHTML(url);
      
      const tableRows = $('table tbody tr');
      
      for (let i = 0; i < Math.min(tableRows.length, maxRecords); i++) {
        const row = tableRows[i];
        const project = {
          name: $(row).find('td').eq(1).text().trim(),
          promoter: $(row).find('td').eq(2).text().trim(),
          registrationNo: $(row).find('td').eq(0).text().trim(),
          district: region === 'panchkula' ? 'Panchkula' : 'Gurugram',
          status: 'Registered'
        };
        
        allProjects.push(this.formatProject(project));
        await this.delay(100);
      }
      
      return allProjects;
    } catch (error) {
      console.error('Haryana scraper error:', error);
      return [];
    }
  }
}

module.exports = HaryanaScraper;