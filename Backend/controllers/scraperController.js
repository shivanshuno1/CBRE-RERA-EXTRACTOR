const scraperFactory = require('../scrapers/scraperFactory');
const excelGenerator = require('../utils/excelGenerator');
const logger = require('../utils/logger');

class ScraperController {
  async extractData(req, res) {
    try {
      const { state, maxRecords = 100, filters = {} } = req.body;
      
      if (!state) {
        return res.status(400).json({ error: 'State is required' });
      }

      logger.info(`Starting extraction for ${state} with max ${maxRecords} records`);
      
      const scraper = scraperFactory.getScraper(state);
      if (!scraper) {
        return res.status(400).json({ error: 'Invalid state or scraper not available' });
      }

      const data = await scraper.extract(parseInt(maxRecords), filters);
      
      logger.info(`Extracted ${data.length} records for ${state}`);
      
      res.json({
        success: true,
        state,
        records: data.length,
        data
      });
    } catch (error) {
      logger.error(`Extraction error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  async getAvailableStates(req, res) {
    const states = scraperFactory.getAvailableStates();
    res.json({ states });
  }

  async downloadExcel(req, res) {
    try {
      const { data, state } = req.body;
      
      if (!data || !state) {
        return res.status(400).json({ error: 'Data and state are required' });
      }

      const buffer = await excelGenerator.generateExcel(data, state);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=rera_${state.replace(/\s/g, '_')}_${Date.now()}.xlsx`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (error) {
      logger.error(`Excel generation error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new ScraperController();