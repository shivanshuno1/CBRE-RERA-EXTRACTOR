const BaseScraper = require('./baseScraper');

class GujaratScraper extends BaseScraper {
  constructor() {
    super();
    this.baseUrl = 'https://gujrera.gujarat.gov.in';
    this.listingUrl = 'https://gujrera.gujarat.gov.in/#/home-p/registered-project-listing';
  }

  async extract(maxRecords = 100, filters = {}) {
    try {
      const projects = [];
      
      // Using Puppeteer for dynamic content
      const $ = await this.fetchWithPuppeteer(this.listingUrl, '.project-listing');
      
      // Find project listing table
      const tableRows = $('table tbody tr');
      
      if (tableRows.length === 0) {
        console.log('No projects found in Gujarat RERA');
        return projects;
      }
      
      for (let i = 0; i < Math.min(tableRows.length, maxRecords); i++) {
        const row = tableRows[i];
        const project = {
          name: $(row).find('td').eq(0).text().trim(),
          promoter: $(row).find('td').eq(1).text().trim(),
          registrationNo: $(row).find('td').eq(2).text().trim(),
          district: $(row).find('td').eq(3).text().trim(),
          status: $(row).find('td').eq(4).text().trim() || 'Registered',
          url: `${this.baseUrl}/project-details/${$(row).find('td').eq(0).find('a').attr('href') || ''}`
        };
        
        projects.push(this.formatProject(project));
        await this.delay(100); // Be respectful to the server
      }
      
      return projects;
    } catch (error) {
      console.error('Gujarat scraper error:', error);
      return [];
    }
  }
}

module.exports = GujaratScraper;