'use strict';

const RightTrackAgency = require('right-track-agency');
const feed = require('./feed.js');

const moduleDirectory = __dirname + "/../";


/**
 * `RightTrackAgency` implementation for **Metro North Railroad & SLE**.
 *
 * For more information, see:
 * - Right Track Agency project ({@link https://github.com/right-track/right-track-agency})
 * - Right Track Agency documentation ({@link https://docs.righttrack.io/right-track-agency})
 * @class
 */
class MNR extends RightTrackAgency {

  /**
   * Create a new `RightTrackAgency` for Metro North Railroad & SLE
   */
  constructor() {
    super(moduleDirectory);
  }

  isFeedSupported() {
    return true;
  }

  loadFeed(db, origin, callback) {
    return feed(db, origin, this.config, callback);
  }

}


// Export functions
module.exports = new MNR();