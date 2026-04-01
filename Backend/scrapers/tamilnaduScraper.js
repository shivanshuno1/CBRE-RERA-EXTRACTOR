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
      const baseUrl = this.urls[type];
      if (!baseUrl) {
        console.error(`Unknown type: ${type}`);
        return [];
      }

      console.log(`🔍 Fetching ${type} projects from: ${baseUrl}`);
      
      const allProjects = [];
      let currentPage = 1;
      let hasMorePages = true;
      
      // Try different pagination URL patterns
      const paginationPatterns = [
        (url, page) => `${url}?page=${page}`,
        (url, page) => `${url}&page=${page}`,
        (url, page) => `${url}?pageno=${page}`,
        (url, page) => `${url}&pageno=${page}`,
        (url, page) => `${url}?p=${page}`,
        (url, page) => `${url}&p=${page}`,
        (url, page) => `${url.replace(/\.php$/, '')}_${page}.php`,
      ];
      
      while (hasMorePages && allProjects.length < maxRecords) {
        console.log(`📄 Trying to fetch page ${currentPage}...`);
        
        let pageContent = null;
        let pageUrl = null;
        
        // Try different URL patterns until one works
        for (const pattern of paginationPatterns) {
          const testUrl = pattern(baseUrl, currentPage);
          console.log(`  Trying: ${testUrl}`);
          
          try {
            const $ = await this.fetchWithPuppeteer(testUrl, 'table');
            // Check if this page has content
            const tables = $('table');
            let hasData = false;
            
            for (let i = 0; i < tables.length; i++) {
              const rows = $(tables[i]).find('tbody tr');
              if (rows.length > 0) {
                hasData = true;
                break;
              }
            }
            
            if (hasData) {
              pageContent = $;
              pageUrl = testUrl;
              console.log(`  ✅ Success! Found data on: ${testUrl}`);
              break;
            }
          } catch (err) {
            // Continue to next pattern
            continue;
          }
        }
        
        if (!pageContent) {
          console.log(`❌ No data found for page ${currentPage}, stopping pagination`);
          break;
        }
        
        // Extract projects from this page
        const pageProjects = this.extractProjectsFromPage(pageContent, pageUrl, type);
        console.log(`✅ Page ${currentPage}: extracted ${pageProjects.length} projects`);
        
        if (pageProjects.length === 0) {
          console.log(`No projects found on page ${currentPage}, stopping`);
          break;
        }
        
        allProjects.push(...pageProjects);
        
        // Check if we got fewer than 10 projects (typical page size)
        if (pageProjects.length < 10) {
          console.log(`Page ${currentPage} has only ${pageProjects.length} projects (< 10), assuming last page`);
          break;
        }
        
        currentPage++;
        
        // Add delay to be respectful
        await this.delay(1500);
      }
      
      // Limit to maxRecords
      const finalProjects = allProjects.slice(0, maxRecords);
      console.log(`✅ Extracted ${finalProjects.length} total projects from Tamil Nadu (${type})`);
      return finalProjects;
      
    } catch (error) {
      console.error('Tamil Nadu scraper error:', error);
      return [];
    }
  }
  
  /**
   * Extract projects from a loaded page
   */
  extractProjectsFromPage($, url, type) {
    // Find all tables
    const tables = $('table');
    let targetTable = null;
    let bestMatch = 0;

    // Find the table with the most columns and rows
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      const rows = $(table).find('tbody tr');
      const headers = $(table).find('thead th');
      
      // Score this table
      let score = rows.length;
      if (headers.length > 0) score += headers.length;
      
      if (score > bestMatch) {
        bestMatch = score;
        targetTable = table;
      }
    }

    if (!targetTable) {
      console.error('No data table found');
      return [];
    }

    // Get headers if available
    const headers = $(targetTable).find('thead th').map((_, th) => $(th).text().trim()).get();
    console.log('Headers found:', headers);
    
    // Determine column mapping based on header text
    let colMap = { regNo: null, promoter: null, projectDetails: null, status: null };
    
    headers.forEach((header, idx) => {
      const lower = header.toLowerCase();
      if (lower.includes('registration') || lower.includes('reg no') || lower.includes('s.no')) {
        colMap.regNo = idx;
      } else if (lower.includes('promoter') || lower.includes('name')) {
        colMap.promoter = idx;
      } else if (lower.includes('project') || lower.includes('details') || lower.includes('address')) {
        colMap.projectDetails = idx;
      } else if (lower.includes('status')) {
        colMap.status = idx;
      }
    });
    
    // Fallback to index-based mapping if headers didn't match
    if (colMap.regNo === null) colMap.regNo = 1;
    if (colMap.promoter === null) colMap.promoter = 2;
    if (colMap.projectDetails === null) colMap.projectDetails = 3;
    if (colMap.status === null) colMap.status = headers.length - 1;
    
    console.log('Column mapping:', colMap);
    
    const rows = $(targetTable).find('tbody tr');
    const projects = [];

    for (let i = 0; i < rows.length; i++) {
      const cells = $(rows[i]).find('td');
      
      // Skip if we don't have enough cells
      const maxCol = Math.max(colMap.regNo, colMap.promoter, colMap.projectDetails, colMap.status);
      if (cells.length <= maxCol) {
        console.log(`Row ${i}: only ${cells.length} cells, need at least ${maxCol + 1}`);
        continue;
      }

      const registrationNo = $(cells[colMap.regNo]).text().trim();
      const promoterName = $(cells[colMap.promoter]).text().trim();
      const projectDetails = $(cells[colMap.projectDetails]).text().trim();
      const status = $(cells[colMap.status]).text().trim();

      // Skip empty rows
      if (!registrationNo && !projectDetails) continue;

      // Extract project name (first part before hyphen or first 100 chars)
      let projectName = projectDetails;
      if (projectDetails.includes('-')) {
        projectName = projectDetails.split('-')[0].trim();
      } else if (projectDetails.length > 100) {
        projectName = projectDetails.substring(0, 100) + '...';
      }

      // Try to extract district
      let district = 'Tamil Nadu';
      const districtMatch = projectDetails.match(/District[:\s]+([^,\n]+)/i);
      if (districtMatch) district = districtMatch[1].trim();
      
      // Also check promoter address for district
      const promoterMatch = promoterName.match(/(Chennai|Coimbatore|Madurai|Tiruchirappalli|Salem|Tirunelveli|Erode|Vellore)/i);
      if (district === 'Tamil Nadu' && promoterMatch) district = promoterMatch[1];

      console.log(`Row ${i}: Found project: ${projectName.substring(0, 50)}...`);

      projects.push(this.formatProject({
        name: projectName,
        promoter: promoterName,
        registrationNo: registrationNo,
        district: district,
        status: status || 'Registered',
        url: url,
        type: type
      }));
    }

    return projects;
  }
}

module.exports = TamilnaduScraper;