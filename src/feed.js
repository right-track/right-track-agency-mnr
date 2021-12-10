'use strict';

const http = require('http');
const JSDOM = require('jsdom').JSDOM;
const cache = require('memory-cache');
const core = require('right-track-core');
const DateTime = core.utils.DateTime;
const StationFeed = core.classes.StationFeed.StationFeed;
const Departure = core.classes.StationFeed.StationFeedDeparture;
const Status = core.classes.StationFeed.StationFeedDepartureStatus;


// Amount of time (ms) to keep cached data
const CACHE_TIME_RT = 120*1000;
const CACHE_TIME_TT = 60*1000;

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

  // Make sure we have a valid status id
  if ( origin.statusId === '-1' ) {
    return callback(
      new Error('4007|Unsupported Station|The Stop does not support real-time status information.')
    );
  }

  // Get GTFS-RT Delays
  _getGTFSRTforStop(origin.id, function(updates) {

    // Get TrainTime data and build list of Departures
    _getTrainTime(db, origin, updates, function(err, updated, departures) {

      // Station Feed Error
      if ( err ) {
        return callback(err);
      }

      // Return Station Feed
      return callback(null, new StationFeed(origin, updated, departures));

    });


  });

}




// ===== GTFS-RT FUNCTIONS ===== //


/**
 * Get the GTFS RT Trip Updates (trips with delays) for the specified Stop
 * @param {string} stopId Stop ID
 * @param callback List of Trip Updates for Stop
 * @private
 */
function _getGTFSRTforStop(stopId, callback) {

  // Get the GTFS-RT data for all Stops
  _getGTFSRT(function(data) {

    // Get delay data for Stop
    let stopData = data[stopId];

    return callback(stopData);

  });

}


/**
 * Get the GTFS RT Trip Updates (trips with delays) for all Stops.  This
 * will use cached data if available, otherwise it will update the data
 * from the source GTFS-RT feed.
 * @param callback List of Trip Updates for all Stops
 * @private
 */
function _getGTFSRT(callback) {

  // Check cache for data
  let data = cache.get('GTFS-RT');
  if ( data !== null ) {
    return callback(data);
  }

  // Update data from source
  _updateGTFSRT(function(data) {
    return callback(data);
  });

}


/**
 * Update the GTFS-RT Trip Updates (trips with delays) for all Stops.  This will
 * get fresh data from the source GTFS-RT feed and save the data in the cache.
 * @param callback List of Trip Updates for all Stops
 * @private
 */
function _updateGTFSRT(callback) {

  // Get URL parameters
  let apiKey = CONFIG.stationFeed.gtfsrt.apiKey;
  let url = CONFIG.stationFeed.gtfsrt.url.replace('{{GTFS_RT_API_KEY}}', apiKey);

  // Download the URL
  _download(url, function(data) {

    // Parse the GTFS-RT data
    _parseGTFSRT(data, callback);

  });

}


/**
 * Parse the GTFS-RT data into a list of Trip Updates:
 * {
 *   stopId: {
 *     trip: shortName,
 *     delay: seconds
 *   },
 *   ...
 * }
 * @param {String} data Data returned from the GTFS-RT Feed
 * @param callback List of Trip Updates for all Stops
 * @private
 */
function _parseGTFSRT(data, callback) {

  // Return a list of objects of {trip: shortName, stop: stopId, delay: seconds}
  let rtn = {};

  // Parse response to JSON
  try {
    data = JSON.parse(data);  
  }
  catch (err) {
    console.log("ERROR: Could not parse MNR GTFS-RT data");
    return callback(rtn);
  }

  // Make sure we have data
  if ( data !== undefined ) {

    // Get GTFS-RT Entities
    let entities = data.entity;

    // Parse each Entity
    if ( entities !== undefined ) {
      for ( let i = 0; i < entities.length; i++ ) {
        let entity = entities[i];
        let shortName = entity.id;

        // Get Trip Updates
        let updates = undefined;
        if ( entity.trip_update !== undefined ) {
          updates = entity.trip_update.stop_time_update;
        }

        // Parse each stop in the trip update
        if ( updates !== undefined ) {
          for ( let j = 0; j < updates.length; j++ ) {
            let update = updates[j];
            let stopId = update.stop_id;
            let delay = undefined;
            if ( update.departure !== undefined ) {
              delay = update.departure.delay;
            }

            // Add delays to return list
            if ( stopId !== undefined && delay !== undefined ) {  // && delay !== 0

              if ( !rtn.hasOwnProperty(stopId) ) {
                rtn[stopId] = [];
              }

              rtn[stopId].push({
                trip: shortName,
                delay: delay/60
              });

            }
          }
        }

      }
    }

  }

  // Add data to cache
  if ( Object.keys(rtn).length > 0 ) {
    cache.put('GTFS-RT', rtn, CACHE_TIME_RT);
  }

  // Return list of delays
  return callback(rtn);

}





// ===== TRAIN TIME FUNCTIONS ===== //


/**
 * Get the Train Time data for the specified Stop.  This will first check
 * to see if there is cached data for the Stop.  If there is no cached data
 * it will get fresh data from the TrainTime website.
 * @param {RightTrackDB} db Right Track DB to query
 * @param {Stop} origin Origin Stop
 * @param {Object} updates GTFS RT delays for this Stop
 * @param callback List of StationFeedDepartures
 * @private
 */
function _getTrainTime(db, origin, updates, callback) {

  // Check cache for data
  let data = cache.get('TT-' + origin.id);
  if ( data !== null ) {
    return callback(null, data.updated, data.departures);
  }

  // Get fresh data
  _updateTrainTime(db, origin, updates, callback);

}


/**
 * Download fresh TrainTime data from the source website for the specified Stop.
 * @param {RightTrackDB} db Right Track DB to query
 * @param {Stop} origin Origin Stop
 * @param {Object} updates GTFS RT delays for this Stop
 * @param callback List of StationFeedDepartures
 * @private
 */
function _updateTrainTime(db, origin, updates, callback) {

  // Get Station URL
  let url = CONFIG.stationFeed.stationURL.replace('{{STATUS_ID}}', origin.statusId);

  // Download the TrainTime Page...
  _download(url, function(data) {

    // Parse the TrainTime Page...
    _parseTrainTime(db, origin, data, updates, callback);

  });

}


/**
 * Parse the MTA Metro North TrainTime Page
 * @param {RightTrackDB} db The Right Track DB to query GTFS data from
 * @param {Stop} origin Origin Stop
 * @param {string} data The TrainTime page data
 * @param {Object} gtfsUpdates The GTFS-RT trip updates
 * @param callback Callback function accepting the Station Feed
 * @private
 */
function _parseTrainTime(db, origin, data, gtfsUpdates, callback) {

  // List of departures to return
  let DEPARTURES = [];

  // Make sure we got data
  if ( data === undefined ) {
    return callback(
      new Error('5003|Could Not Parse Station Data|The API Server did not get a response from the MTA TrainTime page. Please try again later.')
    );
  }

  // Parse the returned data
  let dom = new JSDOM(data);
  let document = dom.window.document;

  // Get tables from page
  let tables = document.getElementsByTagName("table");

  // Page has tables...
  if ( tables !== undefined && tables.length > 0 ) {

    // Get the last table
    let table = tables[tables.length-1];

    // Get the table's rows
    let rows = table.getElementsByTagName('tr');

    // Parse each row of the table, ignoring the header
    let count = 1;
    for ( let i = 1; i < rows.length; i++ ) {
      let row = rows[i];
      let cells = row.getElementsByTagName('td');


      // Get the data from the cells
      let time = cells[0].innerHTML.replace(/^\s+|\s+$/g, '');
      let destinationName = cells[1].innerHTML.replace(/^\s+|\s+$/g, '');
      let track = cells[2].innerHTML.replace(/^\s+|\s+$/g, '');
      let statusText = 'Scheduled';
      let remarks = undefined;
      if ( origin.statusId === '1' ) {
        remarks = cells[3].innerHTML.replace(/^\s+|\s+$/g, '');
      }
      else {
        statusText = cells[3].innerHTML.replace(/^\s+|\s+$/g, '');
      }


      // Create Date/Time from Departure
      let dep = DateTime.createFromTime(time, true);


      // Parse the Delay Time
      let delay = 0;
      if ( statusText.toLowerCase().indexOf('late') !== -1 ) {
        try {
          let toParse = statusText;
          toParse = toParse.toLowerCase();
          toParse = toParse.replace('late', '');
          toParse = toParse.replace('\"', '');
          toParse = toParse.replace('min', '');
          delay = parseInt(toParse);

          if ( !isNaN(delay) ) {
            statusText = "Late " + delay;
          }
        }
        catch (err) {
          delay = 0;
          statusText = "Late";
        }
      }


      // Parse Remarks
      if ( remarks !== undefined ) {
        remarks = remarks.replace("YANKEES", "Yankees");
        remarks = remarks.replace("New Canaan,Waterbury,&SLE", "New Canaan, Waterbury & SLE");
        remarks = remarks.replace("New Canaan, Danbury,SLE,", "New Canaan, Danbury & SLE");
      }




      // Get Destination Stop from Destination Name
      core.query.stops.getStopByName(db, destinationName, function(err, destination) {


        // Destination not found, use name from table
        if ( destination === undefined ) {
          destination = new core.gtfs.Stop('', destinationName, 0, 0);
        }


        // Get the Departure Trip
        core.query.trips.getTripByDeparture(db, origin.id, destination.id, dep, function(err, trip) {


          // See if there's a match in the GTFS-RT delays
          if ( trip !== undefined && gtfsUpdates !== undefined ) {
            for ( let i = 0; i < gtfsUpdates.length; i++ ) {
              if ( gtfsUpdates[i].trip === trip.shortName ) {
                let gtfsDelay = gtfsUpdates[i].delay;

                // No Delays, set status to On Time
                if ( delay === 0 && gtfsDelay === 0 ) {
                  statusText = "On Time";
                }

                // Combine GTFS and TT Delay Information
                else if ( delay === 0 && gtfsDelay > 0 ) {
                  statusText = "Late " + gtfsDelay;
                  delay = gtfsDelay;
                }
                else if ( delay < gtfsDelay ) {
                  statusText = "Late " + delay + "-" + gtfsDelay;
                }
                else if ( gtfsDelay < delay ) {
                  statusText = "Late " + gtfsDelay + "-" + delay;
                  delay = gtfsDelay;
                }

              }
            }
          }


          // Add Delay Time to estimated departure
          let estDeparture = dep.clone();
          try {
            estDeparture = estDeparture.deltaMins(delay);
          }
          catch(err) {
            console.log("WARNING: Could not add " + delay + " mins to departure (" + dep.toString() + ")");
          }


          // Build the Status
          let status = new Status(
            statusText,
            delay,
            estDeparture,
            {
              track: track,
              scheduled: statusText === "Scheduled"
            },
            remarks
          );

          // Build the Departure
          let departure = new Departure(
            dep,
            destination,
            trip,
            status
          );

          // Add to list of Departures
          DEPARTURES.push(departure);


          // Return when all departures have been built
          count++;
          if ( count === rows.length ) {
            DEPARTURES.sort(Departure.sort);

            // Add Data to Cache
            cache.put(
              'TT-' + origin.id,
              {
                updated: DateTime.now(),
                departures: DEPARTURES
              },
              CACHE_TIME_TT
            );

            // Return Data
            return callback(null, DateTime.now(), DEPARTURES);
          }

        });

      });

    }

  }

  // Could not parse Station Data
  else {
    return callback(
      new Error('5003|Could Not Parse Station Data|TrainTime page (StatusID: ' + origin.statusId + ') does not have a table to parse.')
    );
  }


}




// ===== UTILITY FUNCTIONS ===== //


/**
 * Download the specified URL
 * @param {string} url URL to download
 * @param callback Callback function accepting downloaded data
 * @private
 */
function _download(url, callback) {
  let data = '';
  let timedout = false;
  let request = http.get(url, function(res) {
    res.on('data', function(chunk) {
      data += chunk;
    });
    res.on('end', function() {
      callback(data);
    });
  });
  request.on('error', function(e) {
    if ( !timedout ) {
      console.warn('ERROR: Could not download ' + url);
      console.warn(e);
      callback(undefined);
    }
  });
  request.setTimeout(DOWNLOAD_TIMEOUT, function() {
    timedout = true;
    request.abort();
    console.warn('ERROR: Request to ' + url + ' timed out');
    callback(undefined);
  });
}




// MODULE EXPORTS
module.exports = feed;