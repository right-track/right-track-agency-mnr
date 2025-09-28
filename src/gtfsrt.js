'use strict';

const https = require('https');
const protobuf = require('protobufjs');
const cache = require('memory-cache');
const DateTime = require('right-track-core').utils.DateTime;


// Amount of time (ms) to keep cached data
const CACHE_TIME = 45*1000;


/**
 * Get the MNR GTFS-RT data, either cached or fresh
 * @param {Object} config Agency configuration
 * @param {function} callback Callback function(err, data)
 * @private
 */
function getData(config, callback) {

  // Check for cached data
  let data = cache.get('GTFS-RT');
  if ( data ) return callback(null, data);

  // Update data from source
  _updateData(config, function(err, data) {
    if ( err ) return callback(err);

    // Decode the protobuf
    _decodeData(data, function(err, decoded) {
      if ( err ) return callback(err);

      // Parse the decoded data
      _parseData(decoded, function(err, parsed) {
        if ( err ) return callback(err);

        // Store the parsed data in the cache
        if ( parsed ) {
          cache.put('GTFS-RT', parsed, CACHE_TIME);
          return callback(null, parsed);
        }
        else {
          return callback(new Error('5003|No MNR GTFS-RT Data returned|The MNR GTFS-RT feed did not return any parsed data'));
        }

      });
    });
  });
}
  

/**
 * Get fresh GTFS-RT data, as a binary buffer
 * @param {Object} config Agency configuration
 * @param {function} callback Callback function(err, data)
 * @private
 */
function _updateData(config, callback) {
  try {
    const options = {
      method: 'GET',
      hostname: config.stationFeed.host,
      port: 443,
      path: config.stationFeed.path,
      headers: {
          'x-api-key': config.stationFeed.apiKey
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


/**
 * Decode the protobuf data into JSON
 * @param {Buffer} data GTFS-RT data
 * @param {function} callback Callback function(err, decoded)
 * @private
 */
function _decodeData(data, callback) {
  protobuf.load(__dirname + "/gtfs-realtime.proto", function(err, root) {
    if ( err ) callback(new Error('5003|Could not load MNR GTFS-RT proto file|' + err));
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
  

/**
 * Parse the GTFS-RT data and organize it by stop and trip
 * @param {Object} data Decoded GTFS-RT data
 * @param {function} callback Callback function(err, parsed)
 * @private
 */
function _parseData(data, callback) {
  try {
    let updated = data && data.header && data.header.timestamp ? _convertTimestamp(data.header.timestamp) : new Date().getTime();
    let entities = data && data.entity ? data.entity : [];

    let stops = {};   // Parsed Stops
    let trips = {};   // Parsed Trips

    // Parse the trips
    for ( let i = 0; i < entities.length; i++ ) {
      let entity = entities[i];

      // Get Vehicle-level Details
      let vehicle_lat = entity.vehicle?.position?.latitude;
      let vehicle_lon = entity.vehicle?.position?.longitude;
      let vehicle_status = entity.vehicle?.currentStatus;
      let vehicle_stop = entity.vehicle?.stopId;
      let vehicle_updated = _convertTimestamp(entity.vehicle?.timestamp);
      
      // Get Trip-level Details
      let trip_id = entity.id;
      let trip_date = entity.tripUpdate.trip.startDate;
      let trip_route = entity.tripUpdate.trip.routeId;
      let trip_stops = [];

      // Parse the stops
      let stop_time_updates = entity.tripUpdate.stopTimeUpdate;
      for ( let j = 0; j < stop_time_updates.length; j++ ) {
        let stop_time_update = stop_time_updates[j];
        
        // Get Stop-level details
        let stop_id = stop_time_update.stopId;
        let stop_arrival = _convertTimestamp(stop_time_update.arrival.time);
        let stop_departure = _convertTimestamp(stop_time_update.departure.time);
        let stop_track;
        let stop_status;

        // Parse the status
        let statuses = stop_time_update.status;
        for ( let k = 0; k < statuses.length; k++ ) {
          stop_track = statuses[k].track ? statuses[k].track : stop_track;
          stop_status = statuses[k].trainStatus ? statuses[k].trainStatus : stop_status;
        }
        stop_status = stop_status === "On-Time" ? "On Time" : stop_status;

        // Add Stop to Trip
        trip_stops.push({
          id: stop_id,
          arrival: stop_arrival,
          departure: stop_departure,
          track: stop_track,
          status: stop_status,
          sequence: j
        });

        // Save Departure from Stop
        if ( !stops.hasOwnProperty(stop_id) ) stops[stop_id] = [];
        stops[stop_id].push({
          stop_id: stop_id,
          trip_id: trip_id,
          arrival: stop_arrival,
          departure: stop_departure,
          track: stop_track,
          status: stop_status
        });
      }

      // Save Trip
      let trip_destination = trip_stops[trip_stops.length-1];
      trips[trip_id] = {
        id: trip_id,
        date: trip_date,
        route: trip_route,
        destination: trip_destination?.id,
        stops: trip_stops,
        vehicle: {
          lat: vehicle_lat,
          lon: vehicle_lon,
          status: vehicle_status,
          stop: vehicle_stop,
          updated: vehicle_updated
        }
      }

    }

    // Build Return Data
    let rtn = {
      updated: updated,
      trips: trips,
      stops: stops
    }

    return callback(null, rtn);
  }
  catch (err) {
    console.log(err);
    return callback(new Error('5003|Could not parse the MNR GTFS-RT feed|' + err));
  }
}


function _convertTimestamp(ts) {
  return ts * 1000;
}

function _convertDate(date) {
  let dt = DateTime.createFromDate(date);
  return dt.getDateInt();
}

module.exports = getData;