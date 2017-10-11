'use strict';

/**
 * ### Right Track Agency: Metro North Railroad & SLE
 * This module contains agency-specific configuration and functions
 * for Metro North Railroad & Shore Line East
 * @module /
 */

// Export functions
module.exports = {

  /**
   * Agency Configuration
   * @see module:config
   */
  config: require('./config.js'),

  /**
   * Agency Station Feed
   * @see module:feed
   */
  feed: require('./feed.js')
};