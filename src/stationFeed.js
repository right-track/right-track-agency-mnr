'use strict';

const http = require('http');
const parse = require('node-html-parser').parse;
const core = require('right-track-core');
const c = require('./config.js');
const DateTime = core.utils.DateTime;
const StationFeed = core.rt.StationFeed.feed;
const Departure = core.rt.StationFeed.departure;
const Status = core.rt.StationFeed.status;


/**
 * REQUIRED FUNCTION: get the requested Stop's Station Feed
 * @param {RightTrackDB} db The Right Track DB to query GTFS data from
 * @param {Stop} origin Origin Stop
 * @param {Stop} destination Destination Stop
 * @param callback Callback function accepting Station Feed
 * @returns {StationFeed} Station Feed
 */
function get(db, origin, destination, callback) {

  // Check params
  if ( callback === undefined && typeof(destination) === 'function' ) {
    callback = destination;
    destination = undefined;
  }

  // Make sure we have a valid status id
  if ( origin.statusId === '-1' ) {
    return callback(
      new Error('4007|Unsupported Station|The Stop does not support real-time status information.')
    );
  }


  // TODO: In-Memory? Cache of Data

  // TODO: Load GTFS-RT

  // Load Train Time
  parseTrainTime(db, origin, function(err, departures) {

    // Return Station Feed
    let feed = new StationFeed(origin, DateTime.now(), departures);
    return callback(null, feed);

  });




}



/**
 * Download and Parse the MTA Metro North TrainTime Page
 * @param {RightTrackDB} db The Right Track DB to query GTFS data from
 * @param {Stop} origin Origin Stop
 * @param callback Callback function accepting the Station Feed
 */
function parseTrainTime(db, origin, callback) {
  let config = c.get();

  // List of departures to return
  let DEPARTURES = [];

  // Get Station URL
  let url = config.stationFeed.stationURL.replace('{{STATUS_ID}}', origin.statusId);

  // Download the TrainTime Page...
  download(url, function(data) {

    // Make sure we got data
    if ( data === undefined ) {
      return callback(
        new Error('5003|Could Not Parse Station Data|The API Server did not get a response from the MTA TrainTime page. Please try again later.')
      );
    }

    // Parse the returned data
    let parsed = parse(data);

    // Get tables from page
    let tables = parsed.querySelectorAll('table');

    // Page has tables...
    if ( tables !== undefined && tables.length > 0 ) {

      // Get the first table
      let table = tables[0];

      // Get the table's rows
      let rows = table.querySelectorAll('tr');

      // Parse each row of the table, ignoring the header
      let count = 1;
      for ( let i = 1; i < rows.length; i++ ) {
        let row = rows[i];
        let cells = row.querySelectorAll('td');


        // Get the data from the cells
        let time = cells[0].rawText.replace(/^\s+|\s+$/g, '');
        let destinationName = cells[1].rawText.replace(/^\s+|\s+$/g, '');
        let track = cells[2].rawText.replace(/^\s+|\s+$/g, '');
        let statusText = 'Scheduled';
        let remarks = undefined;
        if ( origin.statusId === '1' ) {
          remarks = cells[3].rawText.replace(/^\s+|\s+$/g, '');;
        }
        else {
          statusText = cells[3].rawText.replace(/^\s+|\s+$/g, '');;
        }


        // Create Date/Time from Departure
        let date = DateTime.now().getDateInt();
        let dep = DateTime.create(time, date);


        // Parse the Delay Time
        let delay = 0;
        if ( statusText.toLowerCase().indexOf('late') !== -1 ) {
          try {
            let toParse = statusText;
            toParse = toParse.toLowerCase();
            toParse = toParse.replace('late', '');
            toParse = toParse.replace('\"', '');
            delay = parseInt(toParse);
          }
          catch (err) {}
        }

        // Add Delay Time to estimated departure
        let estDeparture = DateTime.create(time, date);
        estDeparture.deltaMins(delay);




        // Get Destination Stop from Destination Name
        core.query.stops.getStopByName(db, destinationName, function(err, destination) {


          // Destination not found, use name from table
          if ( destination === undefined ) {
            destination = new core.gtfs.Stop('', destinationName, 0, 0);
          }


          // Get the Departure Trip
          core.query.trips.getTripByDeparture(db, origin.id, destination.id, dep, function(err, trip) {

            // Build the Status
            let status = new Status(
              statusText,
              delay,
              estDeparture,
              track,
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
              return callback(null, DEPARTURES);
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

  });

}





/**
 * Download the specified URL
 * @param {string} url URL to download
 * @param callback Callback function accepting downloaded data
 */
function download(url, callback) {
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
  request.setTimeout(5000, function() {
    timedout = true;
    request.abort();
    console.warn('ERROR: Request to ' + url + ' timed out');
    callback(undefined);
  });
}




// MODULE EXPORTS
module.exports = get;