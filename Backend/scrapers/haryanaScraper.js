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
    
    // Create downloads directory if it doesn't exist
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
        headless: false, // Set to false to see the download
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      try {
        const page = await browser.newPage();
        
        // Set download behavior
        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
          behavior: 'allow',
          downloadPath: this.downloadDir
        });
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log(`Navigating to: ${baseUrl}`);
        await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Wait for page to load
        await this.delay(3000);
        
        // Look for Excel button
        console.log('Looking for Excel button...');
        
        // Click on the Excel button
        const excelClicked = await page.evaluate(() => {
          // Find button with exact text "Excel"
          const buttons = document.querySelectorAll('button, a, .btn, input[type="button"]');
          for (const btn of buttons) {
            const text = (btn.innerText || btn.value || '').trim();
            if (text === 'Excel' || text.toLowerCase() === 'excel') {
              console.log(`Found Excel button with text: "${text}"`);
              btn.click();
              return true;
            }
          }
          return false;
        });
        
        if (excelClicked) {
          console.log('✅ Excel button clicked! Waiting for download...');
          
          // Wait for download to complete (give it 10 seconds)
          await this.delay(10000);
          
          // Find the downloaded Excel file
          const files = fs.readdirSync(this.downloadDir);
          const excelFiles = files.filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
          
          if (excelFiles.length === 0) {
            console.log('❌ No Excel file found after clicking button');
            return [];
          }
          
          // Get the most recently downloaded file
          const latestFile = excelFiles
            .map(f => ({ 
              name: f, 
              time: fs.statSync(path.join(this.downloadDir, f)).mtimeMs 
            }))
            .sort((a, b) => b.time - a.time)[0].name;
          
          const filePath = path.join(this.downloadDir, latestFile);
          console.log(`📥 Downloaded file: ${latestFile}`);
          
          // Read the Excel file
          const projects = await this.readExcelFile(filePath, region);
          
          // Save a copy with timestamp and ID range
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const savedPath = path.join(this.downloadDir, `haryana_${region}_${timestamp}.xlsx`);
          fs.copyFileSync(filePath, savedPath);
          console.log(`📁 Excel file saved to: ${savedPath}`);
          
          // Get the ID range (first and last registration numbers)
          if (projects.length > 0) {
            const firstId = projects[0].registrationNo;
            const lastId = projects[projects.length - 1].registrationNo;
            console.log(`📊 ID Range: ${firstId} to ${lastId}`);
            console.log(`📊 Total records: ${projects.length}`);
          }
          
          // Filter projects by year (2025-2026)
          const filteredProjects = projects.filter(project => {
            const yearMatch = project.registrationNo?.match(/20\d{2}/);
            if (yearMatch) {
              const year = parseInt(yearMatch[0]);
              return year >= 2025 && year <= 2026;
            }
            return false;
          });
          
          console.log(`📊 Projects from 2025-2026: ${filteredProjects.length}`);
          
          // Sort by year
          const sortedProjects = filteredProjects.sort((a, b) => {
            const yearA = parseInt(a.registrationNo?.match(/20\d{2}/)?.[0] || '0');
            const yearB = parseInt(b.registrationNo?.match(/20\d{2}/)?.[0] || '0');
            return yearB - yearA;
          });
          
          const finalProjects = sortedProjects.slice(0, maxRecords);
          console.log(`✅ Returning ${finalProjects.length} projects`);
          
          return finalProjects.map(project => this.formatProject(project));
          
        } else {
          console.log('❌ Excel button not found');
          return [{
            projectName: 'Excel button not found',
            promoterName: 'Please check the page structure',
            registrationNumber: 'Manual extraction needed',
            district: region === 'panchkula' ? 'Panchkula' : 'Gurugram',
            status: 'Error',
            url: baseUrl,
            extractedAt: new Date().toISOString()
          }];
        }
        
      } finally {
        await this.delay(2000);
        await browser.close();
      }
      
    } catch (error) {
      console.error('Haryana scraper error:', error);
      return [];
    }
  }
  
  /**
   * Read data from downloaded Excel file
   */
  async readExcelFile(filePath, region) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      
      const worksheet = workbook.worksheets[0];
      const projects = [];
      
      // Get all rows
      const rows = [];
      worksheet.eachRow((row, rowNumber) => {
        const rowData = [];
        row.eachCell((cell, colNumber) => {
          rowData.push(cell.value ? cell.value.toString().trim() : '');
        });
        rows.push(rowData);
      });
      
      if (rows.length < 2) {
        console.log('No data rows found in Excel');
        return [];
      }
      
      // Find header row (usually first row with "Serial No." or "Registration")
      let headerRowIndex = 0;
      let headers = [];
      
      for (let i = 0; i < Math.min(5, rows.length); i++) {
        const firstCell = rows[i][0] || '';
        if (firstCell.includes('Serial') || firstCell.includes('Registration') || firstCell.includes('S.No')) {
          headerRowIndex = i;
          headers = rows[i];
          break;
        }
      }
      
      if (headers.length === 0) {
        // Use first row as headers
        headers = rows[0];
        headerRowIndex = 0;
      }
      
      console.log('Excel headers:', headers.slice(0, 10));
      
      // Find column indices based on header text
      const colMap = {
        serialNo: this.findColumnIndex(headers, ['serial', 's.no', 'sr no']),
        registrationNo: this.findColumnIndex(headers, ['registration', 'certificate', 'reg no']),
        projectId: this.findColumnIndex(headers, ['project id', 'id']),
        projectName: this.findColumnIndex(headers, ['project name', 'project']),
        builder: this.findColumnIndex(headers, ['builder', 'promoter', 'developer']),
        location: this.findColumnIndex(headers, ['location', 'address']),
        district: this.findColumnIndex(headers, ['district']),
        registeredWith: this.findColumnIndex(headers, ['registered with', 'authority']),
        registrationUpTo: this.findColumnIndex(headers, ['up-to', 'upto', 'valid till'])
      };
      
      console.log('Column mapping:', colMap);
      
      // Process data rows
      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        
        const registrationNo = row[colMap.registrationNo] || '';
        const projectName = row[colMap.projectName] || '';
        const builder = row[colMap.builder] || '';
        const district = row[colMap.district] || '';
        const location = row[colMap.location] || '';
        const registeredWith = row[colMap.registeredWith] || '';
        const registrationUpTo = row[colMap.registrationUpTo] || '';
        
        // Skip empty rows
        if (!registrationNo && !projectName) continue;
        
        // Skip password policy rows
        if (projectName.includes('Password') || registrationNo.includes('Password')) continue;
        
        // Determine status
        let status = 'Registered';
        if (registrationUpTo && registrationUpTo !== '--' && registrationUpTo !== '-') {
          const upToDate = new Date(registrationUpTo);
          const today = new Date();
          if (!isNaN(upToDate) && upToDate < today) {
            status = 'Expired';
          }
        }
        
        // Extract year from registration number
        const yearMatch = registrationNo.match(/20\d{2}/);
        const year = yearMatch ? parseInt(yearMatch[0]) : null;
        
        projects.push({
          name: projectName || 'N/A',
          promoter: builder || registeredWith || 'N/A',
          registrationNo: registrationNo,
          district: district || (region === 'panchkula' ? 'Panchkula' : 'Gurugram'),
          location: location || 'N/A',
          status: status,
          registrationUpTo: registrationUpTo,
          year: year
        });
      }
      
      console.log(`📊 Read ${projects.length} projects from Excel file`);
      return projects;
      
    } catch (error) {
      console.error('Error reading Excel file:', error);
      return [];
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
    return 1; // Default fallback
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
      totalArea: project.location || 'N/A',
      url: 'https://haryanarera.gov.in/',
      extractedAt: new Date().toISOString(),
      registrationUpTo: project.registrationUpTo || 'N/A',
      year: project.year || 'N/A'
    };
  }
  
  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = HaryanaScraper;