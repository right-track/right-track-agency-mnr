'use strict';

/**
 * ### Agency Configuration
 * This module will read agency configuration files and provide the
 * configuration properties.
 * @module config
 */


const fs = require('fs');
const path = require('path');
const merge = require('deepmerge');


// DEFAULT CONFIGURATION FILE
const defaultLocation = './agency.json';


// AGENCY CONFIGURATION VARIABLES
let CONFIG = {};


// Load default properties
reset();



/**
 * Read the configuration file from the specified path and merge its properties
 * with the default configuration file.
 * @param {string} location Path to agency config file (relative paths are relative to module root)
 */
function read(location) {
  if ( location !== undefined ) {

    // Relative paths are relative to the project root directory
    if (location.charAt(0) === '.') {
      location = path.join(__dirname, '/../', location);
    }
    location = path.normalize(location);
    console.log('--> Reading Agency Config File: ' + location);

    // Read new config file
    let add = JSON.parse(fs.readFileSync(location, 'utf8'));

    // Parse relative paths relative to file location
    // TODO: generalize this into a function that parses all properties
    let dirname = path.dirname(location);
    if (add.db !== undefined && add.db.location !== undefined ) {
      if (add.db.location.charAt(0) === '.') {
        add.db.location = path.join(dirname, '/', add.db.location);
      }
    }
    if (add.db !== undefined && add.db.archiveDir !== undefined ) {
      if (add.db.archiveDir.charAt(0) === '.') {
        add.db.archiveDir = path.join(dirname, '/', add.db.archiveDir);
      }
    }
    if ( add.static !== undefined && add.static.img !== undefined && add.static.img !== undefined ) {
      if ( add.static.img.icon.charAt(0) === '.' ) {
        add.static.img.icon = path.join(dirname, '/', add.static.img.icon);
      }
    }

    // Merge configs
    CONFIG = merge(CONFIG, add, {
      arrayMerge: function (d, s) {
        return d.concat(s);
      }
    });

  }
}


/**
 * Get the agency configuration variables
 * @returns {object} Agency config variables
 */
function get() {
  return CONFIG;
}


/**
 * Clear any saved config information and reload the default configuration.  Any
 * previously added config files will have to be read again.
 */
function reset() {
  CONFIG = {};
  read(defaultLocation);
}







// Export Functions
module.exports = {
  read: read,
  get: get,
  reset: reset
};