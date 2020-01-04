'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const URL = require('url');
const UnZip = require('decompress-zip');


const GTFS_DIR_MNR = "./db-build/gtfs";
const GTFS_DIR_SLE = "./db-build/sle";


/**
 * MNR Update function - check for MNR and SLE updates and download
 * the GTFS files if an update is available
 * @param {Object} agencyOptions MNR Agency Options
 * @param {function} log DB-Build Log functions
 * @param {Object} errors DB-Build Error functions
 * @param {function} callback Callback function
 */
function update(agencyOptions, log, errors, callback) {
  log("    Checking for MNR & SLE GTFS data updates...");

  // Get force flag
  let force = agencyOptions.update;


  // Check the SLE GTFS
  log("    ==== GTFS SOURCE: SLE ====");
  let url_sle  = agencyOptions.agency.config.build.updateURL_SLE;
  let dir_sle = path.normalize(agencyOptions.agency.moduleDirectory + "/" + GTFS_DIR_SLE);
  _runUpdate(url_sle, dir_sle, force, log, errors, function(update_sle, success_sle) {



    // Check the MNR GTFS
    log("    ==== GTFS SOURCE: MNR ====");
    let url_mnr  = agencyOptions.agency.config.build.updateURL_MNR;
    let dir_mnr = path.normalize(agencyOptions.agency.moduleDirectory + "/" + GTFS_DIR_MNR);
    _runUpdate(url_mnr, dir_mnr, force || success_sle, log, errors, function(update_mnr, success_mnr) {


      // Set path to last modified file
      let lm_path = undefined;
      if ( (!update_mnr || !success_mnr) && (update_sle && success_sle) ) {
        lm_path = path.normalize(agencyOptions.agency.moduleDirectory + "/" + GTFS_DIR_SLE + "/published.txt");
      }
      else {
        lm_path = path.normalize(agencyOptions.agency.moduleDirectory + "/" + GTFS_DIR_MNR + "/published.txt");
      }

      // Get published date
      let lm = fs.readFileSync(lm_path).toString().trim().split('\n');
      let published = new Date(lm[0]);

      // Set notes
      let now = new Date();
      let notes = "This schedule database was automatically compiled on " + now.toLocaleString();
      if ( update_mnr && success_mnr && update_sle && success_sle ) {
        notes += " due to a schedule data update from Metro North Railroad and Shore Line East.";
      }
      else if ( update_mnr && success_mnr ) {
        notes += " due to a schedule data update from Metro North Railroad.";
      }
      else if ( update_sle && success_sle ) {
        notes += " due to a schedule data update from Shore Line East.";
      }


      // RETURN WITH THE UPDATE AND SUCCESS FLAGS
      let success = ((update_mnr && success_mnr) || !update_mnr) && ((update_sle && success_sle) || !update_sle);
      return callback(force || update_mnr || update_sle, success, published, notes);


    });


  });


}


/**
 * Run the GTFS Update check and install, if required
 * @param {string} url Remote GTFS Zip URL
 * @param {string} dir Local GTFS install directory
 * @param {boolean} force DB-Build force flag
 * @param {function} log DB-Build log functions
 * @param {object} errors DB-Build error functions
 * @param {function} callback Callback function
 * @param {boolean} callback.update
 * @private
 */
function _runUpdate(url, dir, force, log, errors, callback) {

  // Create the directory, if necessary
  if ( !fs.existsSync(dir) ) {
    fs.mkdirSync(dir);
  }

  // Check for GTFS Update
  _checkForUpdate(url, dir, log, errors, function(update) {
    log("       GTFS Update: " + update);

    // Download and Install files, if an update is required or requested
    if ( update || force ) {
      _updateFiles(url, dir, log, errors, function(success) {
        log("       Install Success: " + success);

        // Return update and install status
        return callback(update, success);

      });
    }

    // No update...
    else {
      return callback(false, false);
    }

  });

}




/**
 * Check the remote source Update URL if an update is available
 * @param {string} updateUrl Remote Update URL
 * @param {string} dir Local install directory
 * @param {function} log DB-Build Log functions
 * @param {object} errors DB-Build Errors functions
 * @param {function} callback Callback function
 * @param {boolean} callback.update GTFS Update requested
 * @private
 */
function _checkForUpdate(updateUrl, dir, log, errors, callback) {
  log("    ...Checking for GTFS Update");
  log("       URL: " + updateUrl);

  // Parse the URL
  let url = URL.parse(updateUrl);

  // Get the protocol
  let protocol = http;
  if ( url.protocol.includes('https:') ) {
    protocol = https;
  }

  // Set request options
  let options = {
    method: 'HEAD',
    host: url.host,
    path: url.path
  };

  // Make the request
  let req = protocol.request(options, function(res) {
    let headers = res.headers;
    let serverLastModified = new Date(headers['last-modified']);

    // Ignore MNR updates at 1 AM
    if ( updateUrl.includes('mnr') ) {
      let h = serverLastModified.toLocaleString('en-US', {hour: 'numeric', hour12: false, timeZone: 'America/New_York' })
      if ( h === "00" ) {
        log("       server: " + serverLastModified);
        log("       GTFS Update: IGNORE");
        return callback(false);
      }
    }

    // Compare the Last Modified Date/Times
    _compare(serverLastModified);

  });

  // Handle Request Error
  req.on('error', function(err) {
    let msg = "Could not make HEAD request to agency update url";
    log.error("ERROR: " + msg);
    log.error("URL: " + updateUrl);
    log.error("Check the network settings and agency update url");
    errors.error(msg, err.stack, "mnr");

    return callback(false);
  });

  // Make the request
  req.end();


  /**
   * Compare the server and local Last Modified Dates
   * @param server
   * @private
   */
  function _compare(server) {

    let lastModifiedFile = path.normalize(dir + '/published.txt');

    // Check if our last modified file exists
    if ( fs.existsSync(lastModifiedFile) ) {

      let lm = fs.readFileSync(lastModifiedFile).toString().trim().split('\n');
      let local = new Date(lm[0]);
      let compiled = lm[1] && lm[1].split('=').length === 2 && lm[1].split('=')[0] === 'compiled' ? lm[1].split('=')[1] : undefined;

      log("       server: " + server);
      log("       local: " + local);
      log("       compiled: DB Version " + compiled);

      // No update required...
      if ( compiled && server <= local ) {
        return callback(false);
      }

    }

    // Update the GTFS Files
    return callback(true);

  }

}


/**
 * Download and Install the new GTFS Files
 * @param {string} url Remote GTFS Zip URL
 * @param {string} dir Local install directory
 * @param {function} log DB-Build Log functions
 * @param {object} errors DB-Build Error functions
 * @param {function} callback Callback function
 * @param {boolean} callback.success Install success
 * @private
 */
function _updateFiles(url, dir, log, errors, callback) {
  log("    ...Installing Zip File: " + url);

  // Download the Zip File
  _downloadZip(url, dir, log, errors, function(serverLastModified) {

    // Unzip and Install Files
    if ( serverLastModified ) {
      _unzipFiles(serverLastModified, dir, log, errors, function(success) {

        // Return install success
        return callback(success);

      });
    }

    else {
      return callback(false);
    }

  });

}


/**
 * Download the GTFS Zip file
 * @param {string} url Remote GTFS Zip URL
 * @param {string} dir Local install directory
 * @param {function} log DB-Build Log functions
 * @param {object} errors DB-Build Error functions
 * @param {function} callback Callback function
 * @private
 */
function _downloadZip(url, dir, log, errors, callback) {
  let gtfsZip = path.normalize(dir + '/gtfs.zip');

  // Set output file
  let zip = fs.createWriteStream(gtfsZip);

  // Parse protocol
  let protocol = http;
  if ( url.includes('https:') ) {
    protocol = https;
  }

  // Make the request
  protocol.get(url, function(response) {
    let serverLastModified = response.headers['last-modified'];
    response.pipe(zip);

    zip.on('finish', function() {
      zip.close(callback(serverLastModified));
    });
  }).on('error', function(err) {
    let msg = "Could not download GTFS zip file for agency";
    log.error("ERROR: " + msg);
    log.error("URL: " + url);
    errors.error(msg, err.stack, "mnr");
    return callback();
  });

}


/**
 * Unzip the GTFS zip into the install directory
 * @param {string} serverLastModified Server Last Modified Date/Time
 * @param {string} dir local install directory
 * @param {function} log DB-Build Log functions
 * @param {object} errors DB-Build Error functions
 * @param {function} callback Callback function
 * @param {boolean} callback.success Install success
 * @private
 */
function _unzipFiles(serverLastModified, dir, log, errors, callback) {
  let gtfsDir = path.normalize(dir);
  let gtfsZip = path.normalize(dir + '/gtfs.zip');
  let lastModifiedFile = path.normalize(dir + '/published.txt');

  // Unzip the GTFS Files
  let zip = new UnZip(gtfsZip);
  zip.extract({
    path: gtfsDir
  });

  // Unzip error
  zip.on('error', function(err) {
    let msg = "Could not unzip GTFS zip file";
    log.error("ERROR: " + msg);
    log.error("FILE: " + gtfsZip);
    errors.error(msg, err.message, "mnr");
    return callback(false);
  });

  // Finished Unzipping
  zip.on('extract', function() {

    // Remove zip file
    fs.unlink(gtfsZip, function() {});

    // Update the lastModified file...
    fs.writeFile(lastModifiedFile, serverLastModified, function() {

      // Return with update flag
      return callback(true)

    });

  });

}




module.exports = update;
