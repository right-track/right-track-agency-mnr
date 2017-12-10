'use strict';

const fs = require('fs');
const path = require('path');


// LOCATION OF GTFS DATA
const SLE_DIR = '../sle/';
const MNR_DIR = '../gtfs/';


/**
 * MNR Post-Update Script
 * This script appends the SLE data tables to the MNR data tables
 * @private
 */
function postUpdate(agencyOptions, callback) {

  // Run when the GTFS data was updated
  if ( agencyOptions.updateComplete === true ) {
    console.log("    Copying SLE GTFS data into MNR data...");

    // Get paths to directories
    let sleDir = path.normalize(__dirname + '/' + SLE_DIR);
    let mnrDir = path.normalize(__dirname + '/' + MNR_DIR);

    // Make sure SLE Directory exists
    if ( fs.existsSync(sleDir) ) {

      // Get files in directory
      let files = fs.readdirSync(sleDir);

      // Parse each of the files
      for ( let i = 0; i < files.length; i++ ) {
        let filename = files[i];
        let sleFile = path.normalize(sleDir + '/' + filename);
        let mnrFile = path.normalize(mnrDir + '/' + filename);

        // Make sure file is a txt file
        if ( filename.indexOf('.txt') > -1 ) {
          console.log("    ... " + filename);
          
          // Read SLE File
          let data = fs.readFileSync(sleFile, 'utf-8');
          let lines = data.split('\n');
          lines = lines.slice(1);
          lines = lines.join('\n');
          
          // Append to MNR File
          fs.appendFileSync(mnrFile, lines, 'utf-8');

        }
      }

    }
    
  }
  
  // Return to the main script
  return callback();
}


module.exports = postUpdate;