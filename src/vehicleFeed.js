'use strict';

const core = require('right-track-core');
const StopTime = core.gtfs.StopTime;
const DateTime = core.utils.DateTime;
const VF = core.classes.VehicleFeed;
const VehicleFeed = VF.VehicleFeed;
const VehicleFeedPosition = VF.VehicleFeedPosition;
const getData = require('./gtfsrt.js');


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
    getData(config, function(err, data) {
        if ( err ) return callback(err);

        // Parse the Feed
        _buildFeed(db, data).then(function(vfs) {
            return callback(null, vfs);
        }).catch(function(err) {
            return callback(new Error("5002|Server Error|Could not parse the GTFS-RT feed for the agency (" + err + ")."));
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
async function _buildFeed(db, data) {
    let trips = data && data.trips ? data.trips : {};
    let feeds = [];

    // Parse each trip
    Object.keys(trips).forEach(async function(trip_id) {
        let d = trips[trip_id];
        let date = d.date ? parseInt(d.date) : DateTime.now().getDateInt();
        let vehicle_lat = d.vehicle?.lat;
        let vehicle_lon = d.vehicle?.lon;
        let vehicle_status_id = d.vehicle?.status;
        let vehicle_stop_id = d.vehicle?.stop;
        let vehicle_updated_s = d.vehicle?.updated;
        let vehicle_stops = d.stops ? d.stops : [];

        try {
            let vehicle_updated = DateTime.createFromJSDate(vehicle_updated_s ? new Date(vehicle_updated_s) : new Date());
            let vehicle_stop = _getStop(db, vehicle_stop_id);
            let trip = _getTrip(db, trip_id, date);

            // Set the Vehicle Status
            let vehicle_status;
            if ( vehicle_status_id === 0 ) {
                vehicle_status = VehicleFeedPosition.VEHICLE_STATUS.INCOMING_AT;
            }
            else if ( vehicle_status_id === 1 ) {
                vehicle_status = VehicleFeedPosition.VEHICLE_STATUS.STOPPED_AT;
            }
            else if ( vehicle_status_id === 2 ) {
                vehicle_status = VehicleFeedPosition.VEHICLE_STATUS.IN_TRANSIT_TO;
            }

            // Build the Position
            let vfp = new VehicleFeedPosition(vehicle_lat, vehicle_lon, vehicle_updated, {
                status: vehicle_status,
                stop: vehicle_stop
            });

            // Build the StopTimes with the GTFS-RT data
            let sts = [];
            let next = false;
            for ( let i = 0; i < vehicle_stops.length; i++ ) {
                let st = vehicle_stops[i];
                if ( st.id === vehicle_stop_id ) {
                    next = true;
                }
                if ( next ) {
                    let s = await _getStop(db, st.id);
                    let a = st.arrival ? DateTime.createFromJSDate(new Date(st.arrival)).getTimeGTFS() : undefined;
                    let d = st.departure ? DateTime.createFromJSDate(new Date(st.departure)).getTimeGTFS() : undefined;
                    let stopTime = new StopTime(s, a, d, i+1, { date: date });
                    sts.push(stopTime);
                }
            }

            // Build the Feed
            let vf = new VehicleFeed(trip_id, vfp, {
                trip: trip,
                stops: sts
            });

            // Add to list of feeds
            feeds.push(vf);

        }
        catch (err) {
            console.log("Could not build vehicle feed for trip " + trip_id + " [" + err + "]");
            console.log(err);
        }    
    });

    return feeds;
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
        });
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
        });
    });
}



module.exports = vehicleFeed;