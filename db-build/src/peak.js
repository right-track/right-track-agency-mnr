'use strict';


const core = require('right-track-core');
const DateTime = core.utils.DateTime;


// All Times relative to Arrivals/Departures from GCT
const GCT_STOP_ID = '1';

// SET TIME SECONDS
const FIVE_AM = 18000;          // 5:00 AM
const FIVE_THIRTY_AM = 19800;   // 5:30 AM
const NINE_AM = 32400;          // 9:00 AM
const TEN_AM = 36000;           // 10:00 AM
const FOUR_PM = 57600;          // 4:00 PM
const EIGHT_PM = 72000;         // 8:00 PM


/**
 * Determine the Peak Status of the specified Trip
 * @param {Object} db SQLite Database
 * @param {string} tripId The GTFS Trip ID
 * @param {function} callback Callback function
 * @param {boolean} callback.peak Trip peak status
 */
function peak(db, tripId, callback) {

  // Check if the Trip Stops at GCT
  _stopsAtGrandCentral(db, tripId, function(gct) {

    // Stops at GCT...
    if ( gct ) {


      // Check if the Trip operates on a weekday
      _operatesOnWeekday(db, tripId, function(weekday) {

        // Operates on Weekday...
        if ( weekday ) {


          // Check if the Trip operates during peak times
          _isPeak(db, tripId, function(peak) {

            // Return the Peak Status
            return callback(peak);

          });

        }

        // Does not Operate on Weekday...
        else {
          return callback(false);
        }

      });

    }

    // Does not Stop at GCT...
    else {
      return callback(false)
    }

  });

}


/**
 * Check if the Trip stops at Grand Central Terminal
 * @param db SQLite Database
 * @param tripId GTFS Trip ID
 * @param callback Callback function(boolean)
 * @private
 */
function _stopsAtGrandCentral(db, tripId, callback) {

  // Build Select Statement
  let select = "SELECT COUNT(stop_id) AS count FROM gtfs_stop_times " +
    "WHERE trip_id='" + tripId + "' AND stop_id='" + GCT_STOP_ID + "';";

  // Run Query
  db.get(select, function(err, row) {
    return callback(row && row.count && row.count > 0);
  });

}

/**
 * Check if the Trip ever operates on a weekday
 * @param db SQLite Database
 * @param tripId GTFS Trip ID
 * @param callback Callback function(boolean)
 * @private
 */
function _operatesOnWeekday(db, tripId, callback) {

  // Check default weekday status
  let select = "SELECT monday, tuesday, wednesday, thursday, friday, saturday, sunday " +
    "FROM gtfs_calendar WHERE service_id = " +
    "(SELECT service_id FROM gtfs_trips WHERE trip_id = '" + tripId + "');";

  // Run Query
  db.get(select, function(err, row) {
    if ( err ) {
      return callback(false);
    }

    // Weekday Flag
    let weekday = false;

    // Check Default Weekday
    if ( row.monday === 1 || row.tuesday === 1 || row.wednesday === 1 ||
          row.thursday === 1 || row.friday === 1 ) {
      weekday = true;
    }


    // Get Service Exceptions
    select = "SELECT date FROM gtfs_calendar_dates " +
      "WHERE exception_type = 1 AND service_id = " +
      "(SELECT service_id FROM gtfs_trips WHERE trip_id = '" + tripId + "');";

    // Run Query
    db.all(select, function(err, rows) {
      if ( err ) {
        return callback(weekday);
      }

      // Parse the dates
      for ( let i = 0; i < rows.length; i++ ) {
        let date = rows[i].date;
        let dow = DateTime.createFromDate(date).getDateDOW();
        if ( dow !== "saturday" && dow !== "sunday" ) {
          weekday = true;
        }
      }

      // Return the weekday state
      return callback(weekday);

    });

  });

}


/**
 * Determine if the Trip operates during Peak times
 * @param db SQlite Database
 * @param tripId GTFS Trip ID
 * @param callback Callback function(boolean)
 * @private
 */
function _isPeak(db, tripId, callback) {

  // Get Grand Central Info
  let select = "SELECT arrival_time, departure_time, direction_id " +
    "FROM gtfs_stop_times " +
    "INNER JOIN gtfs_trips ON gtfs_trips.trip_id = gtfs_stop_times.trip_id " +
    "WHERE gtfs_stop_times.trip_id = '" + tripId + "' " +
    "AND stop_id = '" + GCT_STOP_ID + "'";

  // Run Query
  db.get(select, function(err, row) {
    if ( err ) {
      return callback(false);
    }

    // Set values
    let arrivalTime = row.arrival_time;
    let departureTime = row.departure_time;
    let direction = row.direction_id;


    // INBOUND TRIPS
    if ( direction === 1 ) {
      let arrival = DateTime.createFromTime(arrivalTime).getTimeSeconds();

      // Peak: Arrival time between 5 and 10 AM
      if ( arrival >= FIVE_AM && arrival <= TEN_AM ) {
        return callback(true);
      }

    }

    // OUTBOUND TRIPS
    else if ( direction === 0 ) {
      let departure = DateTime.createFromTime(departureTime).getTimeSeconds();

      // Peak: Departure between 4 and 8 PM
      if ( departure >= FOUR_PM && departure <= EIGHT_PM ) {
        return callback(true);
      }

      // Reverse Peak: Departure between 5:30 and 9 AM
      else if ( departure >= FIVE_THIRTY_AM && departure <= NINE_AM ) {
        return callback(true);
      }

    }

    // Default: Not peak
    return callback(false);

  });

}




module.exports = peak;