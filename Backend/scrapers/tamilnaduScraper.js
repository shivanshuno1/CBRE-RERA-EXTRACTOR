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
    const allProjects = [];
    const type = filters.type || 'building';
    const url = this.urls[type] || this.urls.building;
    
    try {
      const $ = await this.fetchHTML(url);
      
      const tableRows = $('table tbody tr');
      
      if (tableRows.length === 0) {
        console.log('No projects found in Tamil Nadu RERA');
        return allProjects;
      }
      
      for (let i = 0; i < Math.min(tableRows.length, maxRecords); i++) {
        const row = tableRows[i];
        const project = {
          name: $(row).find('td').eq(1).text().trim(),
          promoter: $(row).find('td').eq(2).text().trim(),
          registrationNo: $(row).find('td').eq(0).text().trim(),
          district: $(row).find('td').eq(3).text().trim(),
          status: $(row).find('td').eq(4).text().trim() || 'Registered'
        };
        
        allProjects.push(this.formatProject(project));
        await this.delay(100);
      }
      
      return allProjects;
    } catch (error) {
      console.error('Tamil Nadu scraper error:', error);
      return [];
    }
  }
}

module.exports = TamilnaduScraper;