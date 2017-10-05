'use strict';


const config = require('./config.js');
const feed = require('./stationFeed.js');



// Export functions
module.exports = {
  config: {
    read: config.read,
    get: config.get,
    reset: config.reset
  },
  feed: feed
};