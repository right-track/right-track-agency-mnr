'use strict';

const core = require('right-track-core');
const StopTime = core.gtfs.StopTime;
const DateTime = core.utils.DateTime;
const VF = core.classes.VehicleFeed;
const VehicleFeed = VF.VehicleFeed;
const VehicleFeedPosition = VF.VehicleFeedPosition;
const loadGtfsRt = require('./gtfsRt');


/**
 * Get the Agency's GTFS-RT and parse it into Vehicle Feeds
 * @param {RightTrackDB} db The Right Track DB to query
 * @param {Object} config Agency config
 * @param {function} callback Callback function
 * @param {Error} callback.error Load/Parse error
 * @param {VehicleFeed[]} callback.feeds Parsed Vehicle Feeds
 */
function vehicleFeed(db, config, callback) {

    // Load the GTFS RT data
    loadGtfsRt(config, function(err, feed) {

        // Server Error
        if ( err ) {
            return callback(new Error("5002|Server Error|Could not load the GTFS-RT feed for the agency."));
        }

        // Parse the Feed
        _parseFeed(db, feed).then(function(vfs) {
            return callback(null, vfs);
        }).catch(function(err) {
            return callback(new Error("5002|Server Error|Could not parse the GTFS-RT feed for the agency."));
        });

    });
}


/**
 * Parse the GTFS-RT into an array of Vehicle Feeds
 * @param {RightTrackDB} db The Right Track DB to query
 * @param {Object} feed Decoded GTFS-RT feed
 * @param {Function} callback Callback function
 * @returns 
 */
async function _parseFeed(db, feed) {

    // Get the entities
    let entities = feed?.entity ? feed.entity : [];

    // Parse each entity
    let vfs = [];
    for ( let i = 0; i < entities.length; i++ ) {
        let e = entities[i];
        if ( e.vehicle && e.vehicle.position && e.vehicle.position.latitude && e.vehicle.position.longitude ) {
            let vf = await _parseEntity(db, e);
            vfs.push(vf);
        }
    }

    // Return the vehicle feeds
    return vfs;
}


/**
 * Parse the GTFS-RT entity into a Vehicle Feed with a Vehicle Feed Position
 * and remaining Stops
 * @param {RightTrackDB} db Right Track DB to query
 * @param {Object} e GTFS-RT entity to parse
 * @returns {VehicleFeed} parsed Vehicle Feed
 */
async function _parseEntity(db, e) {
    let tu = e?.tripUpdate;
    let startDate = tu?.trip?.startDate;
    let stu = tu?.stopTimeUpdate;
    let v = e?.vehicle;
    let id = v?.vehicle?.label;
    let tripId = v?.trip?.tripId;
    let timestamp = v?.timestamp;
    let currentStatus = v?.currentStatus;
    let stopId = v?.stopId;
    let lat = v?.position?.latitude;
    let lon = v?.position?.longitude;

    let date = parseInt(startDate.substring(4,8) + startDate.substring(0,2) + startDate.substring(2,4));
    let updated = DateTime.createFromJSDate(new Date(timestamp*1000));
    let status = VehicleFeedPosition.VEHICLE_STATUS[currentStatus] ? VehicleFeedPosition.VEHICLE_STATUS[currentStatus] : VehicleFeedPosition.VEHICLE_STATUS.IN_TRANSIT_TO;
    let stop = await _getStop(db, stopId);
    let trip = await _getTrip(db, tripId, date);
    
    let stops = [];
    if ( stu ) {
        let next = false;
        for ( let i = 0; i < stu.length; i++ ) {
            let st = stu[i];
            if ( st.stopId === stopId ) {
                next = true;
            }
            if ( next ) {
                let s = await _getStop(db, st.stopId);
                let a = DateTime.createFromJSDate(new Date(st.arrival.time.low*1000)).getTimeGTFS();
                let d = DateTime.createFromJSDate(new Date(st.departure.time.low*1000)).getTimeGTFS();
                let stopTime = new StopTime(s, a, d, i+1, { date: date });
                stops.push(stopTime);
            }
        }
    }

    let vfp = new VehicleFeedPosition(lat, lon, updated, {
        status: status,
        stop: stop
    });
    let vf = new VehicleFeed(id, vfp, {
        trip: trip,
        stops: stops
    });

    return vf;
}


/**
 * Helper function to query the DB for a Stop
 * @param {RightTrackDB} db Right Track DB to query
 * @param {string} id Stop ID
 * @returns {Stop}
 */
function _getStop(db, id) {
    return new Promise(function(resolve, reject) {
        core.query.stops.getStop(db, id, function(err, stop) {
            if ( err ) {
                return reject(err);
            }
            return resolve(stop);
        })
    });
}


/**
 * Helper function to query the DB for a Trip
 * @param {RightTrackDB} db Right Track DB to query
 * @param {string} shortName Trip short name
 * @param {int} date Date in YYYYMMDD format
 * @returns {Trip}
 */
function _getTrip(db, shortName, date) {
    return new Promise(function(resolve, reject) {
        core.query.trips.getTripByShortName(db, shortName, date, function(err, trip) {
            if ( err ) {
                return reject(err);
            }
            return resolve(trip);
        })
    })
}



module.exports = vehicleFeed;