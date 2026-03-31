const express = require('express');
const router = express.Router();
const scraperController = require('../controllers/scraperController');

router.post('/extract', scraperController.extractData);
router.get('/states', scraperController.getAvailableStates);
router.post('/download', scraperController.downloadExcel);

module.exports = router;