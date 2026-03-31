const BaseScraper = require('./baseScraper');

class UttarPradeshScraper extends BaseScraper {
  constructor() {
    super();
    this.baseUrl = 'https://up-rera.in';
    this.listingUrl = 'https://up-rera.in/projects';
  }

  async extract(maxRecords = 100, filters = {}) {
    try {
      const projects = [];
      const $ = await this.fetchWithPuppeteer(this.listingUrl, '.project-list');
      
      const projectCards = $('.project-card, .project-item, table tbody tr');
      
      for (let i = 0; i < Math.min(projectCards.length, maxRecords); i++) {
        const card = projectCards[i];
        const project = {
          name: $(card).find('.project-name, td:eq(1)').text().trim(),
          promoter: $(card).find('.promoter-name, td:eq(2)').text().trim(),
          registrationNo: $(card).find('.reg-no, td:eq(0)').text().trim(),
          district: $(card).find('.district, td:eq(3)').text().trim(),
          status: $(card).find('.status, td:eq(4)').text().trim() || 'Registered'
        };
        
        if (project.name && project.name !== '') {
          projects.push(this.formatProject(project));
        }
        await this.delay(100);
      }
      
      return projects;
    } catch (error) {
      console.error('Uttar Pradesh scraper error:', error);
      return [];
    }
  }
}

module.exports = UttarPradeshScraper;