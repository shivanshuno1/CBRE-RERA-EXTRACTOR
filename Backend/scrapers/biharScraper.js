const BaseScraper = require('./baseScraper');

class BiharScraper extends BaseScraper {
  constructor() {
    super();
    this.baseUrl = 'https://rera.bihar.gov.in';
    this.listingUrl = 'https://rera.bihar.gov.in/RegisteredPP.aspx';
  }

  async extract(maxRecords = 100, filters = {}) {
    try {
      console.log('🔍 Scraping Bihar RERA...');
      const allProjects = [];
      let currentPage = 1;
      let hasMorePages = true;
      
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({ 
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 800 });
        
        while (hasMorePages && allProjects.length < maxRecords) {
          console.log(`📄 Fetching page ${currentPage}...`);
          
          // Build paginated URL
          let pageUrl;
          if (currentPage === 1) {
            pageUrl = this.listingUrl;
          } else {
            pageUrl = `${this.listingUrl}?page=${currentPage}`;
          }
          
          console.log(`  URL: ${pageUrl}`);
          await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 60000 });
          
          // Wait for table to load
          await this.delay(2000);
          
          // Extract projects with correct column mapping
          const projects = await page.evaluate(() => {
            const results = [];
            
            // Find the main data table
            const tables = document.querySelectorAll('table');
            let dataTable = null;
            
            // Look for table with project data
            for (let i = 0; i < tables.length; i++) {
              const headers = tables[i].querySelectorAll('th');
              const headerTexts = Array.from(headers).map(th => th.innerText.trim());
              
              if (headerTexts.some(h => h.includes('Project Name') || h.includes('Registration'))) {
                dataTable = tables[i];
                break;
              }
            }
            
            if (!dataTable) {
              // Fallback: take the first table with rows
              for (let i = 0; i < tables.length; i++) {
                if (tables[i].querySelectorAll('tbody tr').length > 0) {
                  dataTable = tables[i];
                  break;
                }
              }
            }
            
            if (!dataTable) {
              return results;
            }
            
            // Get headers
            const headers = Array.from(dataTable.querySelectorAll('th')).map(th => th.innerText.trim());
            console.log('Headers:', headers);
            
            // Bihar RERA table structure from your screenshot:
            // Column 0: Project Name
            // Column 1: Registration No.
            // Column 2: Promoter Name
            // Column 3: Project Address
            // Column 4: Date of Registration
            
            const projectNameCol = 0;  // Project Name
            const regNoCol = 1;        // Registration No.
            const promoterCol = 2;     // Promoter Name
            const addressCol = 3;      // Project Address
            const dateCol = 4;         // Date of Registration
            
            // Get all data rows (skip header row)
            const rows = dataTable.querySelectorAll('tbody tr');
            
            for (let i = 0; i < rows.length; i++) {
              const cells = rows[i].querySelectorAll('td');
              if (cells.length < 5) continue;
              
              // Extract data using correct column indices
              let projectName = cells[projectNameCol] ? cells[projectNameCol].innerText.trim() : '';
              let registrationNo = cells[regNoCol] ? cells[regNoCol].innerText.trim() : '';
              let promoterName = cells[promoterCol] ? cells[promoterCol].innerText.trim() : '';
              let address = cells[addressCol] ? cells[addressCol].innerText.trim() : '';
              let registrationDate = cells[dateCol] ? cells[dateCol].innerText.trim() : '';
              
              // Skip empty rows
              if (!projectName && !registrationNo) continue;
              
              // Clean up data
              projectName = projectName.replace(/\s+/g, ' ').trim();
              registrationNo = registrationNo.replace(/\s+/g, ' ').trim();
              promoterName = promoterName.replace(/\s+/g, ' ').trim();
              address = address.replace(/\s+/g, ' ').trim();
              
              // Extract district from address
              let district = 'Bihar';
              // Look for "District - " pattern
              const districtMatch = address.match(/District[-\s]+([^,\n]+)/i);
              if (districtMatch) {
                district = districtMatch[1].trim();
              }
              // Also try to find district name in address
              const districts = ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Nalanda', 'Saran', 'Vaishali', 'Darbhanga', 'Purnia'];
              for (const d of districts) {
                if (address.includes(d)) {
                  district = d;
                  break;
                }
              }
              
              // Extract year from registration date
              let year = null;
              if (registrationDate) {
                const dateMatch = registrationDate.match(/\d{4}/);
                if (dateMatch) year = parseInt(dateMatch[0]);
              }
              
              // Determine status (based on registration date)
              let status = 'Registered';
              if (registrationDate) {
                const date = new Date(registrationDate);
                const today = new Date();
                if (!isNaN(date) && date < today) {
                  status = 'Registered';
                }
              }
              
              results.push({
                name: projectName,
                registrationNo: registrationNo,
                promoter: promoterName,
                address: address,
                district: district,
                registrationDate: registrationDate,
                status: status,
                year: year
              });
            }
            
            return results;
          });
          
          console.log(`✅ Page ${currentPage}: extracted ${projects.length} projects`);
          
          if (projects.length === 0) {
            console.log(`No projects found on page ${currentPage}, stopping`);
            break;
          }
          
          // Add to all projects
          for (const p of projects) {
            allProjects.push({
              name: p.name,
              registrationNo: p.registrationNo,
              promoter: p.promoter,
              address: p.address,
              district: p.district,
              registrationDate: p.registrationDate,
              status: p.status,
              year: p.year,
              url: pageUrl
            });
          }
          
          // Check if we have enough records
          if (allProjects.length >= maxRecords) {
            console.log(`Reached max records (${maxRecords}), stopping`);
            break;
          }
          
          // Check for next page
          const hasNextPage = await page.evaluate(() => {
            const nextLinks = [
              ...document.querySelectorAll('a:contains("Next")'),
              ...document.querySelectorAll('a:contains("›")'),
              ...document.querySelectorAll('a:contains("»")')
            ];
            
            for (const link of nextLinks) {
              const href = link.getAttribute('href');
              const isDisabled = link.classList.contains('disabled');
              if (href && !isDisabled && href !== '#') {
                return true;
              }
            }
            return false;
          });
          
          if (hasNextPage) {
            currentPage++;
            await this.delay(1500);
          } else {
            hasMorePages = false;
          }
        }
        
        // Filter projects by year (2025-2026)
        const filteredProjects = allProjects.filter(project => {
          if (project.year) {
            return project.year >= 2025 && project.year <= 2026;
          }
          // Also check registration date string
          if (project.registrationDate) {
            const yearMatch = project.registrationDate.match(/\d{4}/);
            if (yearMatch) {
              const year = parseInt(yearMatch[0]);
              return year >= 2025 && year <= 2026;
            }
          }
          return false;
        });
        
        console.log(`📊 Projects from 2025-2026: ${filteredProjects.length}`);
        
        // Sort by year (newest first)
        const sortedProjects = filteredProjects.sort((a, b) => {
          const yearA = a.year || 0;
          const yearB = b.year || 0;
          return yearB - yearA;
        });
        
        const finalProjects = sortedProjects.slice(0, maxRecords);
        console.log(`✅ Extracted ${finalProjects.length} total projects from Bihar (2025-2026)`);
        
        return finalProjects.map(project => this.formatProject(project));
        
      } finally {
        await browser.close();
      }
      
    } catch (error) {
      console.error('Bihar scraper error:', error);
      return [];
    }
  }
  
  /**
   * Format project to standard format
   */
  formatProject(project) {
    return {
      projectName: project.name,
      promoterName: project.promoter,
      registrationNumber: project.registrationNo,
      district: project.district,
      status: project.status,
      totalArea: project.address || 'N/A',
      url: project.url,
      extractedAt: new Date().toISOString(),
      registrationDate: project.registrationDate || 'N/A'
    };
  }
  
  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = BiharScraper;