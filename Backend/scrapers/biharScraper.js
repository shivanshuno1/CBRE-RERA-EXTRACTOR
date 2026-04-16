const BaseScraper = require('./baseScraper');
const fs = require('fs');
const path = require('path');

class BiharScraper extends BaseScraper {
  constructor() {
    super();
    this.baseUrl = 'https://rera.bihar.gov.in';
    this.listingUrl = 'https://rera.bihar.gov.in/RegisteredPP.aspx';
  }

  async extract(maxRecords = 100, filters = {}) {
    try {
      console.log('🔍 Scraping Bihar RERA (robust mode)...');
      const allProjects = [];
      let currentPage = 1;
      let hasMorePages = true;

      while (hasMorePages && allProjects.length < maxRecords) {
        const pageUrl = `${this.listingUrl}?page=${currentPage}`;
        console.log(`\n📄 Fetching page ${currentPage}: ${pageUrl}`);

        const $ = await this.fetchWithPuppeteer(pageUrl, 'table', { timeout: 30000 });

        // Debug: save first page HTML for inspection
        if (currentPage === 1 && process.env.DEBUG_RERA === 'true') {
          const debugPath = path.join(__dirname, '../debug_bihar.html');
          fs.writeFileSync(debugPath, $.html());
          console.log(`💾 Debug HTML saved to ${debugPath}`);
        }

        const pageProjects = this.extractAnyTableData($, pageUrl);
        console.log(`✅ Page ${currentPage}: extracted ${pageProjects.length} projects`);

        if (pageProjects.length === 0) {
          console.log(`No data found on page ${currentPage}. Stopping.`);
          break;
        }

        allProjects.push(...pageProjects);

        // Check for next page link
        const hasNext = $('a:contains("Next"), a:contains("›"), a:contains("»")').filter((i, el) => {
          const href = $(el).attr('href');
          return href && href !== '#' && !$(el).parent().hasClass('disabled');
        }).length > 0;

        if (!hasNext) break;
        currentPage++;
        await this.delay(2000);
      }

      // Apply year filter if needed
      let filtered = allProjects;
      if (filters.yearFrom && filters.yearTo) {
        filtered = allProjects.filter(p => p.year && p.year >= filters.yearFrom && p.year <= filters.yearTo);
        console.log(`📊 Filtered by year ${filters.yearFrom}-${filters.yearTo}: ${filtered.length} projects`);
      }

      const finalProjects = filtered.slice(0, maxRecords);
      console.log(`✅ Total projects: ${finalProjects.length}`);
      return finalProjects;

    } catch (error) {
      console.error('Bihar scraper error:', error);
      return [];
    }
  }

  /**
   * Extract ANY table data – no assumptions about headers or tbody
   * Returns projects with normalized field names
   */
  extractAnyTableData($, url) {
    const tables = $('table');
    console.log(`Found ${tables.length} table(s) on page`);

    let allRows = [];

    tables.each((i, table) => {
      // Get all rows: could be direct children tr, or inside tbody/thead
      const rows = $(table).find('tr');
      console.log(`  Table ${i}: ${rows.length} rows`);

      rows.each((j, row) => {
        const cells = $(row).find('td');
        if (cells.length === 0) return; // header row? we still capture if needed

        const rowData = cells.map((k, cell) => $(cell).text().trim()).get();
        // Only keep rows that have at least 3 non-empty cells
        const nonEmpty = rowData.filter(cell => cell.length > 0).length;
        if (nonEmpty >= 3) {
          allRows.push(rowData);
        }
      });
    });

    if (allRows.length === 0) {
      console.log('No data rows found in any table');
      return [];
    }

    console.log(`Total data rows extracted: ${allRows.length}`);
    console.log('Sample raw row (first 3 columns):', allRows[0]?.slice(0, 3));

    // Convert rows to project objects using heuristic mapping
    const projects = [];
    for (const row of allRows) {
      // Heuristic: assume column 0 = project name, 1 = registration no, 2 = promoter, 3 = address, 4 = date
      let projectName = row[0] || '';
      let regNo = row[1] || '';
      let promoter = row[2] || '';
      let address = row[3] || '';
      let regDate = row[4] || '';

      // If first column is very short (like "1", "2") maybe it's a serial number, shift columns
      if (projectName.length < 3 && /^\d+$/.test(projectName) && row[1] && row[1].length > 5) {
        projectName = row[1];
        regNo = row[2];
        promoter = row[3];
        address = row[4];
        regDate = row[5];
      }

      if (!projectName && !regNo && !promoter) continue;

      // Clean text
      projectName = projectName.replace(/\s+/g, ' ').substring(0, 200);
      regNo = regNo.replace(/\s+/g, ' ');
      promoter = promoter.replace(/\s+/g, ' ');
      address = address.replace(/\s+/g, ' ');

      // Extract year
      let year = null;
      const yearMatch = regDate.match(/\d{4}/) || address.match(/\d{4}/);
      if (yearMatch) year = parseInt(yearMatch[0]);

      // Determine status based on year (if available)
      let status = 'Registered';
      if (year) {
        const currentYear = new Date().getFullYear();
        if (year > currentYear) status = 'Upcoming';
        else if (year < currentYear) status = 'Registered';
      }

      // District extraction
      let district = 'Bihar';
      const knownDistricts = ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Nalanda', 'Saran', 'Vaishali', 'Darbhanga', 'Purnia', 'Begusarai', 'Arrah', 'Bettiah', 'Katihar', 'Munger'];
      for (const d of knownDistricts) {
        if (address.includes(d) || promoter.includes(d) || projectName.includes(d)) {
          district = d;
          break;
        }
      }

      // Push with normalized field names (frontend expects these)
      projects.push({
        project_name: projectName,
        registration_number: regNo,
        promoter_name: promoter,
        project_address: address,
        district: district,
        registration_date: regDate,
        status: status,
        year: year,
        url: url,
        extracted_at: new Date().toISOString()
      });
    }

    console.log(`Mapped ${projects.length} projects. Sample:`, projects[0]);
    return projects;
  }
}

module.exports = BiharScraper;