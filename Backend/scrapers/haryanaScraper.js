const BaseScraper = require('./baseScraper');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

class HaryanaScraper extends BaseScraper {
  constructor() {
    super();
    this.urls = {
      panchkula: 'https://haryanarera.gov.in/admincontrol/registered_projects/1',
      gurugram: 'https://haryanarera.gov.in/admincontrol/registered_projects/2'
    };
    this.downloadDir = path.join(__dirname, '../downloads');
    
    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }
  }

  async extract(maxRecords = 100, filters = {}) {
    try {
      const region = filters.region || 'panchkula';
      const baseUrl = this.urls[region];
      if (!baseUrl) {
        console.error(`Unknown region: ${region}`);
        return [];
      }

      console.log(`🔍 Fetching Haryana ${region} projects from: ${baseUrl}`);
      
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
        
        // Click Excel button
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
        
        // Read data from Excel including hyperlinks
        const excelData = await this.readExcelFileWithDetails(filePath, region);
        
        // Limit to maxRecords
        const projectsToProcess = excelData.slice(0, maxRecords);
        
        // Scrape detailed info for each project using the URL from Excel
        const enhancedProjects = [];
        for (const project of projectsToProcess) {
          console.log(`🔍 Fetching details for project: ${project.projectName}`);
          if (project.detailUrl && (project.detailUrl.includes('view_project') || project.detailUrl.includes('project_preview_open'))) {
            const detail = await this.scrapeProjectDetailPage(project.detailUrl);
            if (detail) {
              enhancedProjects.push({
                ...project,
                ...detail,
                extractedAt: new Date().toISOString()
              });
            } else {
              enhancedProjects.push(project);
            }
          } else {
            console.warn(`⚠️ No valid detail URL for project: ${project.projectName} (URL: ${project.detailUrl})`);
            enhancedProjects.push(project);
          }
          await this.delay(1500);
        }
        
        // Filter by year if needed
        let filtered = enhancedProjects;
        if (filters.yearFrom && filters.yearTo) {
          filtered = enhancedProjects.filter(p => p.year && p.year >= filters.yearFrom && p.year <= filters.yearTo);
        }
        
        const finalProjects = filtered.slice(0, maxRecords);
        console.log(`✅ Returning ${finalProjects.length} enhanced projects`);
        return finalProjects.map(p => this.formatProject(p));
        
      } finally {
        await browser.close();
      }
    } catch (error) {
      console.error('Haryana scraper error:', error);
      return [];
    }
  }
  
  /**
   * Read Excel file and extract all columns, including hyperlink from "Details of Project(Form A-H)"
   * Handles both native Excel hyperlinks and HTML anchor tags.
   */
  async readExcelFileWithDetails(filePath, region) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const worksheet = workbook.worksheets[0];
      const projects = [];
      
      // Read rows including hyperlink data and raw cell objects
      const rows = [];
      worksheet.eachRow((row, rowNumber) => {
        const rowData = [];
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          rowData.push({
            value: cell.value ? cell.value.toString().trim() : '',
            hyperlink: cell.hyperlink,
            cell: cell
          });
        });
        rows.push(rowData);
      });
      
      if (rows.length < 2) return [];
      
      // Find header row
      let headerRowIndex = 0;
      let headers = [];
      for (let i = 0; i < Math.min(5, rows.length); i++) {
        const firstCellValue = rows[i][0]?.value || '';
        if (firstCellValue.includes('Serial') || firstCellValue.includes('Registration') || firstCellValue.includes('S.No')) {
          headerRowIndex = i;
          headers = rows[i].map(cell => cell.value);
          break;
        }
      }
      if (headers.length === 0) {
        headers = rows[0].map(cell => cell.value);
      }
      
      // Map column indices
      const colMap = {
        serialNo: this.findColumnIndex(headers, ['serial', 's.no', 'sr no']),
        registrationNo: this.findColumnIndex(headers, ['registration', 'certificate', 'reg no']),
        projectId: this.findColumnIndex(headers, ['project id']),
        projectName: this.findColumnIndex(headers, ['project name', 'project']),
        builder: this.findColumnIndex(headers, ['builder', 'promoter', 'developer']),
        location: this.findColumnIndex(headers, ['location', 'address']),
        district: this.findColumnIndex(headers, ['district']),
        registeredWith: this.findColumnIndex(headers, ['registered with']),
        detailUrl: this.findColumnIndex(headers, ['details of project', 'form a-h', 'form a']),
        registrationUpTo: this.findColumnIndex(headers, ['up-to', 'upto', 'valid till'])
      };
      
      console.log('📊 Column mapping:', colMap);
      console.log('📊 Headers found:', headers.slice(0, 10));
      
      // Process data rows
      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        
        const getCellValue = (idx) => (idx !== -1 && row[idx]) ? row[idx].value : '';
        const getCellHyperlink = (idx) => (idx !== -1 && row[idx]) ? row[idx].hyperlink : null;
        const getCellRaw = (idx) => (idx !== -1 && row[idx]) ? row[idx] : null;
        
        const registrationNo = getCellValue(colMap.registrationNo);
        const projectName = getCellValue(colMap.projectName);
        const builder = getCellValue(colMap.builder);
        const district = getCellValue(colMap.district) || (region === 'panchkula' ? 'Panchkula' : 'Gurugram');
        const location = getCellValue(colMap.location);
        const registrationUpTo = getCellValue(colMap.registrationUpTo);
        
        // 🔥 Extract detail URL with enhanced logic
        let detailUrl = '';
        if (colMap.detailUrl !== -1) {
          const cellData = getCellRaw(colMap.detailUrl);
          if (cellData) {
            // 1. Try to get hyperlink property (native Excel hyperlink)
            if (cellData.hyperlink && cellData.hyperlink.address) {
              detailUrl = cellData.hyperlink.address;
            }
            // 2. Try to extract href from HTML anchor tag (if stored as HTML string)
            else if (typeof cellData.value === 'string') {
              // Match href="..." or href='...'
              const hrefMatch = cellData.value.match(/href=["']([^"']+)["']/i);
              if (hrefMatch) {
                detailUrl = hrefMatch[1];
              }
              // Also try to find any URL in the string
              else {
                const urlMatch = cellData.value.match(/(https?:\/\/[^\s]+)/i);
                if (urlMatch) detailUrl = urlMatch[1];
              }
            }
            // 3. If cell contains just a numeric ID, construct URL
            else if (/^\d+$/.test(String(cellData.value))) {
              detailUrl = `https://haryanarera.gov.in/view_project/project_preview_open/${cellData.value}`;
              print(`  🔧 Constructed detail URL from numeric ID: ${detailUrl}`);
            }
          }
        }
        
        if (!registrationNo && !projectName) continue;
        if (projectName.includes('Password') || registrationNo.includes('Password')) continue;
        
        let status = 'Registered';
        if (registrationUpTo && registrationUpTo !== '--' && registrationUpTo !== '-') {
          const upToDate = new Date(registrationUpTo);
          if (!isNaN(upToDate) && upToDate < new Date()) status = 'Expired';
        }
        
        const yearMatch = registrationNo.match(/20\d{2}/);
        const year = yearMatch ? parseInt(yearMatch[0]) : null;
        
        projects.push({
          projectName: projectName || 'N/A',
          promoterName: builder || 'N/A',
          registrationNumber: registrationNo,
          district: district,
          location: location,
          status: status,
          registrationUpTo: registrationUpTo,
          year: year,
          detailUrl: detailUrl || null,
          registeredWith: getCellValue(colMap.registeredWith) || ''
        });
      }
      
      console.log(`📊 Read ${projects.length} projects from Excel file`);
      const projectsWithUrls = projects.filter(p => p.detailUrl).length;
      console.log(`📊 Projects with detail URLs: ${projectsWithUrls}`);
      return projects;
      
    } catch (error) {
      console.error('Error reading Excel:', error);
      return [];
    }
  }
  
  /**
   * Scrape detailed project page (including Form A-H) using the direct URL
   */
  async scrapeProjectDetailPage(detailUrl) {
    // Validate URL format
    if (!detailUrl || (!detailUrl.includes('view_project') && !detailUrl.includes('project_preview_open'))) {
      console.log(`  ⚠️ Skipping invalid detail URL: ${detailUrl}`);
      return null;
    }
    
    console.log(`  → Fetching detail page: ${detailUrl}`);
    
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    
    try {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.goto(detailUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Wait for dynamic content
      await page.waitForSelector('body', { timeout: 10000 });
      await this.delay(3000);
      
      // Extract comprehensive details including Form A-H
      const details = await page.evaluate(() => {
        const data = {
          formAtoH: {},
          projectInfo: {},
          documents: []
        };
        
        const cleanText = (text) => text.replace(/\s+/g, ' ').trim();
        
        // Find all tables with Form content
        const tables = document.querySelectorAll('table');
        tables.forEach((table) => {
          const tableText = table.innerText;
          if (tableText.includes('Form A') || tableText.includes('Form B') ||
              tableText.includes('Form C') || tableText.includes('Form D') ||
              tableText.includes('Form E') || tableText.includes('Form F') ||
              tableText.includes('Form G') || tableText.includes('Form H') ||
              tableText.includes('Project Details') || tableText.includes('Particulars')) {
            
            const rows = table.querySelectorAll('tr');
            rows.forEach(row => {
              const cells = row.querySelectorAll('td, th');
              if (cells.length >= 2) {
                const key = cleanText(cells[0].innerText);
                const value = cleanText(cells[1].innerText);
                if (key && value && !key.includes('Form') && !key.includes('S.No')) {
                  data.formAtoH[key] = value;
                }
              } else if (cells.length === 1) {
                const header = cleanText(cells[0].innerText);
                if (header && (header.includes('Form') || header.includes('Details'))) {
                  data.formAtoH[`_section_${header}`] = true;
                }
              }
            });
          }
        });
        
        // Extract from definition lists
        const dlElements = document.querySelectorAll('dl, .detail-row, .info-row, .project-detail');
        dlElements.forEach(el => {
          const label = el.querySelector('dt, .label, .title, strong:first-child');
          const value = el.querySelector('dd, .value, .content, span:last-child');
          if (label && value) {
            data.projectInfo[cleanText(label.innerText)] = cleanText(value.innerText);
          }
        });
        
        // Extract from div pairs
        const divPairs = document.querySelectorAll('.form-group, .detail-item, .info-item');
        divPairs.forEach(el => {
          const label = el.querySelector('.label, .title, .field-label');
          const value = el.querySelector('.value, .content, .field-value');
          if (label && value) {
            data.projectInfo[cleanText(label.innerText)] = cleanText(value.innerText);
          }
        });
        
        // Extract key fields using regex
        const bodyText = document.body.innerText;
        const patterns = {
          tempProjectId: /Temp(?:orary)?\s+Project\s+ID\s*:\s*([^\n]+)/i,
          submissionDate: /Submission\s+Date\s*:\s*([^\n]+)/i,
          applicantType: /Applicant\s+Type\s*:\s*([^\n]+)/i,
          projectType: /Project\s+Type\s*:\s*([^\n]+)/i,
          promoterName: /PROMOTER\s*:\s*([^\n]+)/i,
          totalArea: /Total\s+Area\s*:\s*([^\n]+)/i,
          projectStatus: /Status\s*:\s*([^\n]+)/i,
          registrationDate: /Registration\s+Date\s*:\s*([^\n]+)/i,
          completionDate: /Completion\s+Date\s*:\s*([^\n]+)/i,
          projectAddress: /Project\s+Address\s*:\s*([^\n]+)/i,
          landArea: /Land\s+Area\s*:\s*([^\n]+)/i
        };
        
        for (const [key, pattern] of Object.entries(patterns)) {
          const match = bodyText.match(pattern);
          if (match) data.projectInfo[key] = cleanText(match[1]);
        }
        
        // Extract document links
        const links = document.querySelectorAll('a');
        links.forEach(link => {
          const href = link.getAttribute('href');
          const text = cleanText(link.innerText);
          if (href && (text.includes('View') || text.includes('Download') || text.includes('Certificate') ||
                       text.includes('Form') || text.includes('Document'))) {
            data.documents.push({
              name: text,
              url: href.startsWith('http') ? href : `https://haryanarera.gov.in${href.startsWith('/') ? '' : '/'}${href}`
            });
          }
        });
        
        return data;
      });
      
      return {
        url: detailUrl,
        tempProjectId: details.projectInfo.tempProjectId || '',
        submissionDate: details.projectInfo.submissionDate || '',
        applicantType: details.projectInfo.applicantType || '',
        projectType: details.projectInfo.projectType || '',
        promoterName: details.projectInfo.promoterName || '',
        totalArea: details.projectInfo.totalArea || '',
        projectStatus: details.projectInfo.projectStatus || '',
        registrationDate: details.projectInfo.registrationDate || '',
        completionDate: details.projectInfo.completionDate || '',
        projectAddress: details.projectInfo.projectAddress || '',
        landArea: details.projectInfo.landArea || '',
        formDetails: details.formAtoH,
        otherDetails: details.projectInfo,
        documents: details.documents
      };
      
    } catch (error) {
      console.error(`Error scraping ${detailUrl}:`, error.message);
      return null;
    } finally {
      await browser.close();
    }
  }
  
  /**
   * Find column index by header name patterns
   */
  findColumnIndex(headers, patterns) {
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i] ? headers[i].toString().toLowerCase() : '';
      for (const pattern of patterns) {
        if (header.includes(pattern.toLowerCase())) {
          return i;
        }
      }
    }
    return -1;
  }
  
  /**
   * Format project to standard output
   */
  formatProject(project) {
    return {
      projectName: project.projectName || 'N/A',
      promoterName: project.promoterName || 'N/A',
      registrationNumber: project.registrationNumber || 'N/A',
      district: project.district || 'N/A',
      status: project.status || 'Registered',
      totalArea: project.totalArea || project.location || 'N/A',
      url: project.detailUrl || 'https://haryanarera.gov.in/',
      extractedAt: project.extractedAt || new Date().toISOString(),
      registrationUpTo: project.registrationUpTo || 'N/A',
      year: project.year || 'N/A',
      tempProjectId: project.tempProjectId || 'N/A',
      submissionDate: project.submissionDate || 'N/A',
      applicantType: project.applicantType || 'N/A',
      projectType: project.projectType || 'N/A',
      projectStatus: project.projectStatus || project.status,
      registrationDate: project.registrationDate || 'N/A',
      completionDate: project.completionDate || 'N/A',
      projectAddress: project.projectAddress || 'N/A',
      landArea: project.landArea || 'N/A',
      registeredWith: project.registeredWith || 'N/A',
      formDetails: project.formDetails || {},
      otherDetails: project.otherDetails || {},
      documents: project.documents || []
    };
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = HaryanaScraper;