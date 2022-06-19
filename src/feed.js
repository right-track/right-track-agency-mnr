'use strict';

const getData = require('./gtfsrt.js');
const core = require('right-track-core');
const DateTime = core.utils.DateTime;
const StationFeed = core.classes.StationFeed.StationFeed;
const Departure = core.classes.StationFeed.StationFeedDeparture;
const Status = core.classes.StationFeed.StationFeedDepartureStatus;


const DEPARTED_TIME = 5*60;   // Max time to display departed trains (5 min)
const MAX_TIME = 3*60*60;     // Max time to display future departures (3 hours)


/**
 * Get the requested Stop's `StationFeed`.  This function will load the agency's
 * real-time status sources and populate a `StationFeed` with `StationFeedDeparture`s
 * containing the real-time status information.
 * @param {RightTrackDB} db The Right Track DB to query GTFS data from
 * @param {Stop} origin Origin Stop
 * @param {Object} config Agency configuration
 * @param {function} callback Station Feed Callback
 * @private
 */
function feed(db, origin, config, callback) {

  // Make sure we have a valid status id
  if ( origin.statusId === '-1' ) {
    return callback(
      new Error('4007|Unsupported Station|The Stop does not support real-time status information.')
    );
  }

  // Get the GTFS-RT Data
  getData(config, function(err, data) {
    if ( err ) return callback(err);

    // Build the feed for the requested stop
    _buildFeed(db, origin, data, function(err, feed) {
      if ( err ) return callback(err);

      // Return the feed
      return callback(null, feed);

    });
  });
}


/**
 * Build the Station Feed for the requested Stop
 * @param {RightTrackDB} db The Right Track DB to query GTFS data from
 * @param {Stop} origin Origin Stop
 * @param {Object} data GTFS-RT data, including stops and trips
 * @param {function} callback Callback function(err, feed)
 * @private
 */
function _buildFeed(db, origin, data, callback) {
  try {
    let updated = DateTime.createFromJSDate(new Date(data.updated));
    let stop_data = data.stops.hasOwnProperty(origin.id) ? data.stops[origin.id] : [];
    let trip_data = data.trips;

    // Build each of the departures
    let p = [];
    for ( let i = 0; i < stop_data.length; i++ ) {
      let departure = stop_data[i];
      let departure_trip = trip_data[departure.trip_id];
      p.push(_buildDeparture(db, origin, departure, departure_trip));
    }

    // Execute promises
    Promise.all(p).then(function(departures) {

      // Drop filtered departures
      let rtn = [];
      for ( let i = 0; i < departures.length; i++ ) {
        if ( departures[i] ) {
          rtn.push(departures[i]);
        }
      }

      // Build the feed
      rtn.sort(Departure.sort);
      let feed = new StationFeed(origin, updated, rtn);

      // Return the Feed
      return callback(null, feed);

    });
  }
  catch (err) {
    return callback(new Error('5003|Could not build MNR Station Feed|' + err));
  }
}


/**
 * Build a StationFeedDeparture with the specified stop and trip info
 * @param {RightTrackDB} db The Right Track DB to query GTFS data from
 * @param {Stop} origin Origin Stop
 * @param {Object} departure GTFS-RT stop data for the departure
 * @param {Object} departure_trip GTFS-RT trip data for the departure
 * @returns {StationFeedDeparture} A SFDeparture or undefined
 * @private
 */
function _buildDeparture(db, origin, departure, departure_trip) {
  return new Promise(function(resolve, reject) {
    try {

      // Get the Estimated Departure
      let estDepartureDT = DateTime.createFromJSDate(new Date(departure.departure));

      // Get the Destination Stop
      core.query.stops.getStop(db, departure_trip.destination, function(err, destination) {

        // Get the scheduled Trip
        core.query.trips.getTripByShortName(db, departure.trip_id, departure_trip.date, function(err, trip) {

          // Get the delay between scheduled stop time and estimated stop time
          let schedDepartureDT = estDepartureDT.clone();
          if ( trip && trip.hasStopTime(origin) ) {
            let stopTime = trip.getStopTime(origin);
            schedDepartureDT = stopTime.departure;
          }
          let delay = estDepartureDT.getTimeSeconds() - schedDepartureDT.getTimeSeconds();

          // Set the Status Text
          let statusText = departure.status;
          if ( (statusText === "On Time" || statusText === "Late") && delay > 0 ) {
            statusText = `Late ${delay/60}m`;
          }

          // FILTER DEPARTURES
          // Drop recently departed Trips or Trips too far in the future
          let now_s = new Date().getTime();
          let dep_s = departure.departure;
          let delta = (dep_s - now_s)/1000;
          if ( statusText === "Departed" && delta < (-1*DEPARTED_TIME) ) {
            return resolve();
          }
          else if ( delta > (MAX_TIME) ) {
            return resolve();
          }

          // Drop arrivals to GCT
          if ( origin.id === "1" && destination?.id === "1" ) {
            return resolve();
          }

          // Build Remarks
          // let remarks = `Status: ${departure_trip.vehicle.status} | Stop: ${departure_trip.vehicle.stop}`;

          // Build Status
          let status = new Status(
            statusText,
            delay,
            estDepartureDT,
            {
              track: departure.track,
              scheduled: statusText === "Scheduled"
            }
          );

          // Build the Departure
          let rtn = new Departure(
            schedDepartureDT,
            destination,
            trip,
            status
          );

          return resolve(rtn);

        });
      });
    }
    catch (err) {
      console.log("ERROR: Could not build departure for " + origin.name);
      console.log(departure);
      resolve();
    }
  });
}


// MODULE EXPORTS
module.exports = feed;