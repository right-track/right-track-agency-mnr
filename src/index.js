'use strict';


const config = require('./config.js');
const feed = require('./feed.js');



// Export functions
module.exports = {
  config: {
    read: config.read,
    get: config.get,
    reset: config.reset
  },
  feed: feed
};