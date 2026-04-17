const BaseScraper = require('./baseScraper');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

class TamilNaduScraper extends BaseScraper {
  constructor() {
    super();
    // TN RERA has different pages for Building, Normal Layout, Regularisation Layout.
    // We'll focus on Normal Layout for 2025 (can be extended).
    this.urls = {
      building: 'https://rera.tn.gov.in/cms/reg_projects_tamilnadu/Building/2025.php',
      normalLayout: 'https://rera.tn.gov.in/cms/reg_projects_tamilnadu/Normal_Layout/2025.php',
      regularisationLayout: 'https://rera.tn.gov.in/registered_reglayout'
    };
    this.downloadDir = path.join(__dirname, '../downloads');
    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }
  }

  async extract(maxRecords = 100, filters = {}) {
    try {
      // Default to Normal Layout if not specified
      const type = filters.type || 'normalLayout';
      const baseUrl = this.urls[type];
      if (!baseUrl) {
        console.error(`Unknown type: ${type}`);
        return [];
      }

      console.log(`🔍 Scraping Tamil Nadu ${type} projects from: ${baseUrl}`);

      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      try {
        const page = await browser.newPage();
        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
          behavior: 'allow',
          downloadPath: this.downloadDir
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log(`Navigating to: ${baseUrl}`);
        await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await this.delay(3000);

        // Click the Excel button (may be a button or link with text "Excel")
        const excelClicked = await page.evaluate(() => {
          const buttons = document.querySelectorAll('button, a, .btn, input[type="button"]');
          for (const btn of buttons) {
            const text = (btn.innerText || btn.value || '').trim();
            if (text === 'Excel' || text.toLowerCase() === 'excel') {
              btn.click();
              return true;
            }
          }
          return false;
        });

        if (!excelClicked) {
          console.log('❌ Excel button not found');
          return [];
        }

        console.log('✅ Excel button clicked! Waiting for download...');
        await this.delay(10000);

        // Find downloaded Excel file
        const files = fs.readdirSync(this.downloadDir);
        const excelFiles = files.filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
        if (excelFiles.length === 0) {
          console.log('❌ No Excel file found');
          return [];
        }

        const latestFile = excelFiles
          .map(f => ({ name: f, time: fs.statSync(path.join(this.downloadDir, f)).mtimeMs }))
          .sort((a, b) => b.time - a.time)[0].name;
        const filePath = path.join(this.downloadDir, latestFile);
        console.log(`📥 Downloaded file: ${latestFile}`);

        // Read Excel and extract projects
        const projects = await this.readExcelFile(filePath);

        // Filter by year (2025-2026) and optionally district (Chennai)
        let filteredProjects = projects;
        if (filters.yearFrom && filters.yearTo) {
          filteredProjects = projects.filter(p => p.year && p.year >= filters.yearFrom && p.year <= filters.yearTo);
          console.log(`📊 Projects ${filters.yearFrom}-${filters.yearTo}: ${filteredProjects.length}`);
        }
        if (filters.district && filters.district.toLowerCase() !== 'all') {
          filteredProjects = filteredProjects.filter(p => p.district && p.district.toLowerCase().includes(filters.district.toLowerCase()));
          console.log(`📊 Projects in district ${filters.district}: ${filteredProjects.length}`);
        }

        const finalProjects = filteredProjects.slice(0, maxRecords);
        console.log(`✅ Returning ${finalProjects.length} projects`);
        return finalProjects.map(p => this.formatProject(p));

      } finally {
        await browser.close();
      }
    } catch (error) {
      console.error('Tamil Nadu scraper error:', error);
      return [];
    }
  }

  /**
   * Read Excel file and extract project data.
   * Expected columns (based on screenshot): S.No, Project Registration No., Name and Address of the Promoter,
   * Project Details and Address, Approval Details, Project Completion Date, Other Details.
   */
  async readExcelFile(filePath) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const worksheet = workbook.worksheets[0];
      const projects = [];

      // Get all rows
      const rows = [];
      worksheet.eachRow((row, rowNumber) => {
        const rowData = [];
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          rowData.push(cell.value ? cell.value.toString().trim() : '');
        });
        rows.push(rowData);
      });

      if (rows.length < 2) return [];

      // Find header row (first row that looks like headers)
      let headerRowIndex = 0;
      let headers = [];
      for (let i = 0; i < Math.min(5, rows.length); i++) {
        const firstCell = rows[i][0] || '';
        if (firstCell.includes('S.No') || firstCell.includes('Registration')) {
          headerRowIndex = i;
          headers = rows[i];
          break;
        }
      }
      if (headers.length === 0) {
        headers = rows[0];
      }

      // Map column indices based on typical TN RERA Excel export
      const colMap = {
        serialNo: this.findColumnIndex(headers, ['s.no', 'serial']),
        regNo: this.findColumnIndex(headers, ['registration', 'reg no']),
        promoter: this.findColumnIndex(headers, ['promoter', 'name and address']),
        projectDetails: this.findColumnIndex(headers, ['project details', 'project name']),
        approvalDetails: this.findColumnIndex(headers, ['approval']),
        completionDate: this.findColumnIndex(headers, ['completion']),
        otherDetails: this.findColumnIndex(headers, ['other'])
      };

      console.log('📊 Column mapping:', colMap);

      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const regNo = row[colMap.regNo] || '';
        const promoter = row[colMap.promoter] || '';
        let projectDetails = row[colMap.projectDetails] || '';
        const completionDate = row[colMap.completionDate] || '';

        if (!regNo && !projectDetails) continue;

        // Extract project name from "Project Details and Address" column
        let projectName = projectDetails;
        const nameMatch = projectDetails.match(/Project Name:\s*"([^"]+)"/i);
        if (nameMatch) projectName = nameMatch[1];
        else if (projectDetails.includes('-')) projectName = projectDetails.split('-')[0].trim();

        // Extract district from project details or address
        let district = 'Tamil Nadu';
        const districtMatch = projectDetails.match(/District\s*[:\-]?\s*([^,\n]+)/i);
        if (districtMatch) district = districtMatch[1].trim();
        else {
          const districts = ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Erode', 'Vellore'];
          for (const d of districts) {
            if (projectDetails.includes(d) || promoter.includes(d)) {
              district = d;
              break;
            }
          }
        }

        // Extract year from registration number (e.g., TN/11/Layout/Offline/0001/2025)
        let year = null;
        const yearMatch = regNo.match(/20\d{2}/);
        if (yearMatch) year = parseInt(yearMatch[0]);

        // Determine status based on completion date
        let status = 'Registered';
        if (completionDate && completionDate.toLowerCase() === 'complete') status = 'Completed';
        else if (completionDate && completionDate.toLowerCase() === 'in progress') status = 'Ongoing';

        projects.push({
          projectName: projectName || 'N/A',
          promoterName: promoter || 'N/A',
          registrationNumber: regNo,
          district: district,
          status: status,
          projectDetails: projectDetails,
          approvalDetails: row[colMap.approvalDetails] || '',
          completionDate: completionDate,
          otherDetails: row[colMap.otherDetails] || '',
          year: year,
          url: this.urls.normalLayout
        });
      }

      console.log(`📊 Read ${projects.length} projects from Excel file`);
      return projects;

    } catch (error) {
      console.error('Error reading Excel:', error);
      return [];
    }
  }

  findColumnIndex(headers, patterns) {
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i] ? headers[i].toString().toLowerCase() : '';
      for (const pattern of patterns) {
        if (header.includes(pattern.toLowerCase())) return i;
      }
    }
    return -1;
  }

  formatProject(project) {
    return {
      projectName: project.projectName,
      promoterName: project.promoterName,
      registrationNumber: project.registrationNumber,
      district: project.district,
      status: project.status,
      totalArea: project.projectDetails.substring(0, 100) + (project.projectDetails.length > 100 ? '...' : ''),
      url: project.url,
      extractedAt: new Date().toISOString(),
      year: project.year,
      completionDate: project.completionDate,
      otherDetails: project.otherDetails
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = TamilNaduScraper;