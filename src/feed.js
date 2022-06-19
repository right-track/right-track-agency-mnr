'use strict';

const https = require('https');
const protobuf = require('protobufjs');
const cache = require('memory-cache');
const core = require('right-track-core');
const DateTime = core.utils.DateTime;
const StationFeed = core.classes.StationFeed.StationFeed;
const Departure = core.classes.StationFeed.StationFeedDeparture;
const Status = core.classes.StationFeed.StationFeedDepartureStatus;


// Amount of time (ms) to keep cached data
const CACHE_TIME = 60*1000;

// Amount of time (ms) for download to timeout
const DOWNLOAD_TIMEOUT = 7*1000;

// Agency Configuration
let CONFIG = {};


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
  CONFIG = config;

  console.log("==> GET FEED: " + origin.statusId);

  // Make sure we have a valid status id
  if ( origin.statusId === '-1' ) {
    return callback(
      new Error('4007|Unsupported Station|The Stop does not support real-time status information.')
    );
  }

  // Get the GTFS-RT Data
  _getData(function(err, data) {
    if ( err ) return callback(err);

    // Build the feed for the requested stop
    _buildFeed(db, origin, data, function(err, feed) {
      if ( err ) return callback(err);

      // Return the feed
      return callback(null, feed);

    });

  });

}


function _buildFeed(db, origin, cached, callback) {
  console.log("--> BUILD FEED: " + origin.statusId);
  try {
    let updated = DateTime.createFromJSDate(new Date(cached.updated));
    let data = cached.data;
    let d = data.hasOwnProperty(origin.statusId) ? data[origin.statusId] : [];

    console.log("... from " + d.length + " departures");

    // Build each of the departures
    let p = [];
    for ( let i = 0; i < d.length; i++ ) {
      p.push(_buildDeparture(db, origin, d[i]));
    }
    Promise.all(p).then(function(departures) {
      console.log("ALL DONE");
      console.log(departures.length + " departures returned");

      // Build the feed
      departures.sort(Departure.sort);
      let feed = new StationFeed(origin, updated, departures);

      return callback(null, feed);
    });
  }
  catch (err) {
    return callback(new Error('5003|Could not build MNR Station Feed|' + err));
  }
}


function _buildDeparture(db, origin, departure) {
  return new Promise(function(resolve, reject) {
    console.log("--> BUILD DEPARTURE FROM " + origin.name);
    console.log(departure);

    let dateDT = DateTime.createFromDate(
      departure.trip.date.substring(4)+
      departure.trip.date.substring(0,2)+
      departure.trip.date.substring(2,4)
    );
    let estDepartureDT = DateTime.createFromJSDate(new Date(departure.departure*1000));

    // Get the destination Stop
    core.query.stops.getStop(db, departure.trip.destination, function(err, destination) {

      // Get the scheduled Trip
      core.query.trips.getTripByShortName(db, departure.trip.id, dateDT.getDateInt(), function(err, trip) {

        // Get the delay between scheduled stop time and estimated stop time
        let schedDepartureDT = estDepartureDT.clone();
        if ( trip && trip.hasStopTime(origin) ) {
          let stopTime = trip.getStopTime(origin);
          schedDepartureDT = stopTime.departure;
        }
        let delay = estDepartureDT.getTimeSeconds() - schedDepartureDT.getTimeSeconds();

        // Set the Status Text
        let statusText = departure.status;
        if ( (statusText === "On-Time" || statusText === "Late") && delay > 0 ) {
          statusText = `Late ${delay/60} min`;
        }
        else if ( statusText === "On-Time" ) {
          statusText = "On Time";
        }

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

        resolve(rtn);

      });

    });

  });
}


function _getData(callback) {
  console.log("--> GET DATA");

  // Check for cached data
  let data = cache.get('GTFS-RT');
  if ( data ) return callback(null, data);

  // Update data from source
  _updateData(function(err, data) {
    if ( err ) return callback(err);

    // Decode the protobuf
    _decodeData(data, function(err, decoded) {
      if ( err ) return callback(err);

      // Parse the decoded data
      _parseData(decoded, function(err, parsed) {
        if ( err ) return callback(err);

        // Store the parsed data in the cache
        if ( parsed && Object.keys(parsed).length > 0 ) {
          let cached = { updated: new Date().getTime(), data: parsed };
          cache.put('GTFS-RT', cached, CACHE_TIME);
          return callback(null, cached);
        }
        else {
          return callback(new Error('5003|No MNR GTFS-RT Data returned|The MNR GTFS-RT feed did not return any parsed data'));
        }

      });
    });
  });

}


function _updateData(callback) {
  console.log("--> UPDATE DATA");
  try {
    const options = {
      method: 'GET',
      hostname: CONFIG.stationFeed.host,
      port: 443,
      path: CONFIG.stationFeed.path,
      headers: {
          'x-api-key': CONFIG.stationFeed.apiKey
      }
    }

    let buffer;
    const req = https.request(options, function(res) {
        let data = [];
        res.on('data', function(d) {
            data.push(d);
        });
        res.on('end', function() {
            buffer = Buffer.concat(data);
            return callback(null, buffer);
        });
    });

    req.on('error', function(err) {
      return callback(new Error('5003|Could not download MNR GTFS-RT Data|' + err));
    });

    req.end();
  }
  catch (err) {
    return callback(new Error('5003|Could not download MNR GTFS-RT Data|' + err));
  }
}


function _decodeData(data, callback) {
  console.log("--> DECODE DATA");
  protobuf.load(__dirname + "/gtfs-realtime.proto", function(err, root) {
    if ( err ) callback(new Error('5003|Could not decode MNR GTFS-RT feed|' + err));
    try {
      let FeedMessage = root.lookupType("FeedMessage");
      let decoded = FeedMessage.decode(data);
      return callback(null, decoded);
    }
    catch (err) {
      return callback(new Error('5003|Could not decode MNR GTFS-RT feed|' + err));
    }
  });
}


function _parseData(data, callback) {
  console.log("--> PARSE DATA")
  try {
    let rtn = {};
    let entities = data && data.entity || [];

    // Parse the trips
    for ( let i = 0; i < entities.length; i++ ) {
      let entity = entities[i];
      let trip_id = entity.id;
      let trip_date = entity.tripUpdate.trip.startDate;
      let trip_route = entity.tripUpdate.trip.routeId;
      let stop_time_updates = entity.tripUpdate.stopTimeUpdate;

      // Parse the stops
      for ( let j = 0; j < stop_time_updates.length; j++ ) {
        let stop_time_update = stop_time_updates[j];
        let stop_id = stop_time_update.stopId;
        let arrival = stop_time_update.arrival.time.low;
        let departure = stop_time_update.departure.time.low;
        let statuses = stop_time_update.status;

        // Parse the status
        let track;
        let status;
        for ( let k = 0; k < statuses.length; k++ ) {
          track = statuses[k].track ? statuses[k].track : track;
          status = statuses[k].trainStatus ? statuses[k].trainStatus : status;
        }

        // Add trip to stop
        if ( !rtn.hasOwnProperty(stop_id) ) rtn[stop_id] = [];
        rtn[stop_id].push({
          trip: {
            id: trip_id,
            date: trip_date,
            route: trip_route,
            destination: stop_time_updates[stop_time_updates.length-1].stopId
          },
          arrival: arrival,
          departure: departure,
          track: track,
          status: status
        });
      }
    }
    return callback(null, rtn);
  }
  catch (err) {
    return callback(new Error('5003|Could not parse the MNR GTFS-RT feed|' + err));
  }
}




// MODULE EXPORTS
module.exports = feed;