const BaseScraper = require('./baseScraper');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Punjab RERA Scraper
 * Site: https://rera.punjab.gov.in/pdf/registered-projects/List_of_Registered_Projects.pdf
 * Type: PDF file — the entire project list is in a single downloadable PDF.
 * Strategy: Download PDF → parse with pdf-parse → extract rows from text.
 *
 * Install dependency: npm install pdf-parse
 */
class PunjabScraper extends BaseScraper {
  constructor() {
    super();
    this.pdfUrl = 'https://rera.punjab.gov.in/pdf/registered-projects/List_of_Registered_Projects.pdf';
  }

  async extract(maxRecords = 100, filters = {}) {
    const allProjects = [];

    try {
      // 1. Download the PDF to a temp file
      const tmpPath = path.join(os.tmpdir(), 'punjab_rera_projects.pdf');
      const response = await axios.get(this.pdfUrl, {
        headers: this.headers,
        responseType: 'arraybuffer',
        timeout: 60000
      });
      fs.writeFileSync(tmpPath, response.data);

      // 2. Parse PDF text
      const pdfParse = require('pdf-parse');
      const dataBuffer = fs.readFileSync(tmpPath);
      const pdfData = await pdfParse(dataBuffer);
      const text = pdfData.text;

      // 3. Split into lines and parse rows
      // Punjab PDF columns (typical): S.No | Reg No | Project Name | Promoter | District | Status
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      for (const line of lines) {
        if (allProjects.length >= maxRecords) break;

        // Skip header/footer lines
        if (
          line.toLowerCase().includes('s.no') ||
          line.toLowerCase().includes('sr.no') ||
          line.toLowerCase().includes('page') ||
          line.toLowerCase().includes('punjab rera')
        ) continue;

        // PDF text lines are space-delimited; split on 2+ spaces as column separator
        const cols = line.split(/\s{2,}/);
        if (cols.length < 3) continue;

        // Detect if first column is a number (S.No)
        const startsWithNum = /^\d+$/.test(cols[0]);
        const offset = startsWithNum ? 1 : 0;

        allProjects.push(this.formatProject({
          registrationNo: cols[offset] || 'N/A',
          name: cols[offset + 1] || 'N/A',
          promoter: cols[offset + 2] || 'N/A',
          district: cols[offset + 3] || 'N/A',
          status: cols[offset + 4] || 'Registered',
          url: this.pdfUrl // source PDF as reference URL
        }));
      }

      // Cleanup
      fs.unlinkSync(tmpPath);
    } catch (err) {
      console.error('Punjab scraper error:', err.message);
      if (err.message.includes("Cannot find module 'pdf-parse'")) {
        console.error('→ Run: npm install pdf-parse');
      }
    }

    return allProjects;
  }
}

module.exports = PunjabScraper;