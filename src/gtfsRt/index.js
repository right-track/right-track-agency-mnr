'use strict';

/**
 * MNR GTFS-RT FUNCTIONS
 * Functions to download and decode the MNR GTFS-RT Protocol Buffer Feed
 */


 const https = require('https');
 const protobuf = require('protobufjs');


// CACHED DATA
let CACHE = {
    updated: 0,
    data: undefined
}

// Maximum age of cached data, in ms
const MAX_AGE = 30*1000;


/**
 * Load and decode the Agency's GTFS-RT Feed
 * @param {Object} config Agency Config
 * @param {function} callback Callback function
 * @param {Error} callback.err Download or Decode Error
 * @param {Object} callback.feed Decoded GTFS-RT Feed
 */
function loadGtfsRt(config, callback) {

    // Return cached data, if not stale
    if ( CACHE && CACHE.updated && CACHE.data ) {
        let delta = new Date().getTime() - CACHE.updated;
        if ( delta <= MAX_AGE ) {
            return callback(null, CACHE.data);
        }
    }

    // Download the GTFS-RT data
    _download(config.gtfsRt, function(err, buffer) {
        if ( err ) {
            return callback(err);
        }

        // Decode the GTFS-RT data
        _decode(buffer, function(err, decoded) {
            
            // Store the data in cache
            CACHE.updated = new Date().getTime();
            CACHE.data = decoded;

            // Return the decoded data
            return callback(err, decoded);

        });

    });

}


/**
 * Download the Agency's GTFS-RT Protocol Buffer Feed
 * @param {Object} config Agency GTFS-RT Config
 * @param {function} callback Callback function
 * @param {Error} callback.err Download error
 * @param {Buffer} callback.buffer Binary GTFS-RT feed (as a Buffer)
 * @private
 */
function _download(config, callback) {
    const options = {
        method: 'GET',
        hostname: config.host,
        port: 443,
        path: config.path,
        headers: {
            'x-api-key': config.apiKey
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

    req.on('error', function(error) {
        return callback(error);
    });

    req.end();
}


/**
 * Decode the binary protocol buffer feed into a JS Object
 * @param {Buffer} buffer GTFS-RT binary protocol buffer feed
 * @param {function} callback Callback function
 * @param {Error} callback.err Decode error
 * @param {Object} callback.decoded Decoded feed (as JS Object)
 * @private
 */
function _decode(buffer, callback) {
    protobuf.load(__dirname + '/gtfs-realtime-mnr.proto', function(err, root){
        if ( err ) {
            return callback(err);
        }

        let FeedMessage = root.lookupType("FeedMessage");
        let msg = FeedMessage.decode(buffer);
        return callback(null, msg);
    });
}


module.exports = loadGtfsRt;