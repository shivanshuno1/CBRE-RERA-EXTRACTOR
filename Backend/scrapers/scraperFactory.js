const GujaratScraper = require('./gujaratScraper');
const TamilnaduScraper = require('./tamilnaduScraper');
const UttarPradeshScraper = require('./uttarPradeshScraper');
const HaryanaScraper = require('./haryanaScraper');
const KeralaScraper = require('./keralaScraper');
const PunjabScraper = require('./punjabScraper');
const OdishaScraper = require('./odishaScraper');
const WestBengalScraper = require('./westBengalScraper');
const MadhyaPradeshScraper = require('./madhyaPradeshScraper');
const RajasthanScraper = require('./rajasthanScraper');
const BiharScraper = require('./biharScraper');
const AndhraPradeshScraper = require('./andhraPradeshScraper');
const TelanganaScraper = require('./telanganaScraper');
const DelhiScraper = require('./delhiScraper');
const AssamScraper = require('./assamScraper');

class ScraperFactory {
  constructor() {
    this.scrapers = {
      'Gujarat': new GujaratScraper(),
      'Tamil Nadu': new TamilnaduScraper(),
      'Uttar Pradesh': new UttarPradeshScraper(),
      'Haryana': new HaryanaScraper(),
      'Kerala': new KeralaScraper(),
      'Punjab': new PunjabScraper(),
      'Odisha': new OdishaScraper(),
      'West Bengal': new WestBengalScraper(),
      'Madhya Pradesh': new MadhyaPradeshScraper(),
      'Rajasthan': new RajasthanScraper(),
      'Bihar': new BiharScraper(),
      'Andhra Pradesh': new AndhraPradeshScraper(),
      'Telangana': new TelanganaScraper(),
      'Delhi': new DelhiScraper(),
      'Assam': new AssamScraper()
    };
  }

  getScraper(state) {
    return this.scrapers[state] || null;
  }

  getAvailableStates() {
    return Object.keys(this.scrapers);
  }
}

module.exports = new ScraperFactory();