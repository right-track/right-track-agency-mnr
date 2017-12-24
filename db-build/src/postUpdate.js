'use strict';

const fs = require('fs');
const path = require('path');
const rl = require('readline');


// LOCATION OF GTFS DATA
const SLE_DIR = '../sle/';
const MNR_DIR = '../gtfs/';

// LIST OF SLE FILES TO COPY
const FILES = [
  'agency.txt', 
  'calendar_dates.txt', 
  'calendar.txt',
  'routes.txt',
  'stop_times.txt',
  'stops.txt',
  'trips.txt'
];


/**
 * MNR Post-Update Script
 * This script appends the SLE data tables to the MNR data tables
 * @private
 */
function postUpdate(agencyOptions, callback) {

  // Run when the GTFS data was updated
  if ( agencyOptions.updateComplete === true ) {
    console.log("    Copying SLE GTFS data into MNR data...");

    // Get Directory Paths
    let sleDir = path.normalize(__dirname + '/' + SLE_DIR);

    // Make sure SLE Directory exists
    if ( fs.existsSync(sleDir) ) {

      // Get files in directory
      let files = fs.readdirSync(sleDir);

      // Process the Files
      _process(0, files, callback);

    }
    
  }
}


/**
 * Start processing the SLE Files
 */
function _process(count, files, callback) {
  if ( count < files.length ) {
    _processFile(files[count], function() {
      _process(count+1, files, callback);
    });
  }
  else {
    return callback();
  }
}


/**
 * Process a specific SLE File
 */
function _processFile(filename, callback) {

  // Make sure file is a txt file
  if ( FILES.indexOf(filename) > -1 ) {
    console.log("    ... " + filename);

    // Set file paths
    let sleFile = path.normalize(__dirname + '/' + SLE_DIR + '/' + filename);
    let mnrFile = path.normalize(__dirname + '/' + MNR_DIR + '/' + filename);
    

    // Read MNR file for header fields
    let mnr = fs.readFileSync(mnrFile, 'utf-8');
    let mnrHeaders = mnr.split(/\r|\n/)[0].split(',');
    for ( let i = 0; i < mnrHeaders.length; i++ ) {
      mnrHeaders[i] = mnrHeaders[i].trim();
    }


    // Set SLE Headers
    let sleHeaders = [];
    let readHeaders = false;

    // Set SLE Data
    let sleData = [];

    // Set SLE RL Interface
    let rd = rl.createInterface({
      input: fs.createReadStream(sleFile),
      crlfDelay: Infinity
    });

    // Read SLE File Line by Line
    rd.on('line', function(line) {
      if ( line.toString().length > 0 ) {
        let data = line.split(',');
        if ( !readHeaders ) {
          readHeaders = true;
          for ( let i = 0; i < data.length; i++ ) {
            sleHeaders[i] = data[i].trim();
          }
        }
        else {
          let dataObj = {};
          for ( let i = 0; i < data.length; i++ ) {
            dataObj[sleHeaders[i]] = data[i];
          }
          sleData.push(dataObj);
        }
      }
    });

    // Parse the read data
    rd.on('close', function() {

      // Output data to append to MNR File
      let output = [];

      // Parse each of the sleData items
      for ( let i = 0; i < sleData.length; i++ ) {
        let sle = sleData[i];
        let line = [];

        // Loop through MNR Header
        for ( let j = 0; j < mnrHeaders.length; j++ ) {
          let header = mnrHeaders[j];
          let item = sle[header];
          if ( item === undefined ) {
            item = '';
          }
          line.push(item);
        }

        // Collapse line array
        line = line.join(',');

        // Add line to output
        output.push(line);

      }

      // Collapse output array
      output = output.join('\n');

      // Append output to MNR file
      fs.appendFileSync(mnrFile, output, 'utf-8');

      return callback();
    });

  }
  else {
    return callback();
  }

}


module.exports = postUpdate;