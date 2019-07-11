'use strict';


/**
 * Return peak_offpeak value
 * @param {Object} db SQLite Database
 * @param {string} tripId The GTFS Trip ID
 * @param {function} callback Callback function
 * @param {int} callback.peak Trip peak status
 */
function peak(db, tripId, callback) {
  db.get("SELECT peak_offpeak FROM gtfs_trips WHERE trip_id = '" + tripId + "';", 
    function(err, row) {
      return callback(row && row.peak_offpeak ? row.peak_offpeak : 0);
    }
  );
}







module.exports = peak;
