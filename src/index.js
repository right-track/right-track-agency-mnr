'use strict';

const RightTrackAgency = require('right-track-agency');
const feed = require('./feed.js');

const moduleDirectory = __dirname + "/../";


/**
 * RightTrackAgency implementation for Metro North Railroad & SLE.
 *
 * See the Right Track Agency project ({@link https://github.com/right-track/right-track-agency})
 * for more information.
 * @class
 */
class MNR extends RightTrackAgency {

  /**
   * Create a new RightTrackAgency for Metro North Railroad & SLE
   */
  constructor() {
    super(moduleDirectory);
  }

  loadFeed(db, origin, callback) {
    return feed(db, origin, this.config, callback);
  }

}


// Export functions
module.exports = new MNR();