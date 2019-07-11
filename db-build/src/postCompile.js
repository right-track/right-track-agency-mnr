'use strict';

const DateTime = require('right-track-core').utils.DateTime;


/**
 * MNR Post-Compile Script
 * This script performs the MNR-specific Database fixes
 * @param {Object} agencyOptions Agency DB-Build Options
 * @param {Object} db SQLite database
 * @param {function} log DB-Build Log functions
 * @param {Object} errors DB-Build Error functions
 * @param {function} callback Callback function()
 * @private
 */
function postCompile(agencyOptions, db, log, errors, callback) {

  // Perform post-compile if a compile was requested...
  if ( agencyOptions.compile === true ) {

    db.serialize(function() {
      db.exec("BEGIN TRANSACTION");

      // Remove unused agencies
      console.log("    ... Removing unused agencies");
      db.exec("DELETE FROM gtfs_agency WHERE agency_id <> '1' AND agency_id <> 'SLE';");

      // Remove unused routes
      console.log("    ... Removing unused routes");
      db.exec("DELETE FROM gtfs_routes WHERE agency_id <> '1' AND route_id <> 'SLE';");

      // Update Route Long Names
      console.log("    ... Updating route names");
      db.exec("UPDATE gtfs_routes SET route_long_name='New Haven Line' WHERE route_short_name='New Haven';");
      db.exec("UPDATE gtfs_routes SET route_long_name='New Canaan Branch' WHERE route_short_name='New Canaan';");
      db.exec("UPDATE gtfs_routes SET route_long_name='Danbury Branch' WHERE route_short_name='Danbury';");
      db.exec("UPDATE gtfs_routes SET route_long_name='Waterbury Branch' WHERE route_short_name='Waterbury';");
      db.exec("UPDATE gtfs_routes SET route_long_name='Hudson Line' WHERE route_short_name='Hudson';");
      db.exec("UPDATE gtfs_routes SET route_long_name='Harlem Line' WHERE route_short_name='Harlem';");

      // Set SLE Route Agency ID and Colors
      console.log("    ... Updating SLE route info");
      db.exec("UPDATE gtfs_routes SET agency_id='SLE', route_color='f43b45', route_text_color='100000' WHERE route_id='SLE';");

      // Update stop_ids in stop_times
      console.log("    ... Updating SLE Stop IDs");
      db.exec("UPDATE gtfs_stop_times SET stop_id='190' WHERE stop_id='WH';");
      db.exec("UPDATE gtfs_stop_times SET stop_id='145' WHERE stop_id='MIL';");
      db.exec("UPDATE gtfs_stop_times SET stop_id='143' WHERE stop_id='STR';");
      db.exec("UPDATE gtfs_stop_times SET stop_id='140' WHERE stop_id='BRP';");
      db.exec("UPDATE gtfs_stop_times SET stop_id='131' WHERE stop_id='SN';");
      db.exec("UPDATE gtfs_stop_times SET stop_id='124' WHERE stop_id='STM';");
      db.exec("UPDATE gtfs_stop_times SET stop_id='116' WHERE stop_id='GW';");
      db.exec("UPDATE gtfs_stop_times SET stop_id='1' WHERE stop_id='GCS';");
      db.exec("UPDATE gtfs_stop_times SET stop_id='151' WHERE stop_id='ST';");
      db.exec("UPDATE gtfs_stop_times SET stop_id='149' WHERE stop_id='NHV';");
      db.exec("UPDATE gtfs_stop_times SET stop_id='1111' WHERE stop_id='BRN';");
      db.exec("UPDATE gtfs_stop_times SET stop_id='1112' WHERE stop_id='GUIL';");
      db.exec("UPDATE gtfs_stop_times SET stop_id='1113' WHERE stop_id='MAD';");
      db.exec("UPDATE gtfs_stop_times SET stop_id='1114' WHERE stop_id='CLIN';");
      db.exec("UPDATE gtfs_stop_times SET stop_id='1115' WHERE stop_id='WES';");
      db.exec("UPDATE gtfs_stop_times SET stop_id='1116' WHERE stop_id='OSB';");
      db.exec("UPDATE gtfs_stop_times SET stop_id='1117' WHERE stop_id='NLC';");

      // Remove unused stops
      console.log("    ... Removing unused stops");
      db.exec("DELETE FROM gtfs_stops WHERE stop_id IN ('40001', '40002', " +
        "'502', '504', '505', '506', '507', '508', '510', '512', '514', '516', '518', " +
        "'602', '604', '606', '608', '610', '612', '614', '616', '618', '620', " +
        "'40702', '40704', '40706', '40708', '40710', '40712', '40714', " +
        "'WH', 'MIL', 'STR', 'BRP', 'SN', 'STM', 'GW', 'GCS', 'ST', 'NHV');");

      // Remove SLE Zone IDs
      console.log("    ... Removing SLE Stop Zones");
      db.exec("UPDATE gtfs_stops SET zone_id = null WHERE stop_id IN ('BRN', 'GUIL', 'MAD', 'CLIN', 'WES', 'OSB', 'NLC');");

      // Update SLE Stops in Stops
      console.log("    ... Updating SLE Stops");
      db.exec("UPDATE gtfs_stops SET stop_id='1111' WHERE stop_id='BRN';");
      db.exec("UPDATE gtfs_stops SET stop_id='1112' WHERE stop_id='GUIL';");
      db.exec("UPDATE gtfs_stops SET stop_id='1113' WHERE stop_id='MAD';");
      db.exec("UPDATE gtfs_stops SET stop_id='1114' WHERE stop_id='CLIN';");
      db.exec("UPDATE gtfs_stops SET stop_id='1115' WHERE stop_id='WES';");
      db.exec("UPDATE gtfs_stops SET stop_id='1116' WHERE stop_id='OSB';");
      db.exec("UPDATE gtfs_stops SET stop_id='1117' WHERE stop_id='NLC';");

      // Set SLE Trip Directions
      db.exec("UPDATE gtfs_trips SET direction_id=0 WHERE route_id='SLE' AND trip_headsign IN ('To New London', 'To Old Saybrook');");
      db.exec("UPDATE gtfs_trips SET direction_id=1 WHERE route_id='SLE' AND trip_headsign IN ('To New Haven Union Station', 'To Stamford');");

      // Set SLE Trip Short Names
      console.log("    ... Setting SLE Trip Short Names");
      db.exec("UPDATE gtfs_trips SET trip_short_name = trip_id WHERE trip_short_name = '';");

      // Set direction descriptions
      console.log("    ... Setting direction descriptions");
      db.exec("UPDATE gtfs_directions SET description='Outbound' WHERE direction_id=0;");
      db.exec("UPDATE gtfs_directions SET description='Inbound' WHERE direction_id=1;");

      // Set pickup_type and drop_off_type = 0 at all stops EXCEPT:
      // 125th St (4) and Fordham (56) White Plains (74) and Croton-Harmon (33)
      console.log("    ... Fixing pickup/drop-off types");
      db.exec("UPDATE gtfs_stop_times SET pickup_type=0, drop_off_type=0 WHERE stop_id <> 4 AND stop_id <> 56 AND stop_id <> 74 AND stop_id <> 33;");

      // Add SLE Route Graph Entries
      console.log("    ... Adding SLE to rt_route_graph");
      db.exec("INSERT INTO rt_route_graph (direction_id, stop1_id, stop2_id) VALUES (0,'149','1112'), (0,'1112','1115'), (0,'1115','1116'), (0,'1116','1117'), (0,'151','1111'), (0,'1111','1112'), (0,'1112','1113'), (0,'1113','1114'), (0,'1114','1115'), (1,'1116','1115'), (1,'1115','1114'), (1,'1114','1113'), (1,'1113','1112'), (1,'1112','1111'), (1,'1111','151'), (1,'1117','1116'), (1,'1115','1112'), (1,'1112','149'), (0,'149','1116'), (1,'1117','149'), (1,'1112','151'), (1,'1116','149');");

      // Clean Database
      console.log("    ... Removing old data");
      let date = DateTime.now().date;
      db.exec("DELETE FROM gtfs_stop_times WHERE trip_id IN (SELECT trip_id FROM gtfs_trips WHERE service_id IN (SELECT service_id FROM gtfs_calendar WHERE service_id IN (SELECT service_id FROM gtfs_calendar_dates WHERE service_id IN(SELECT service_id FROM gtfs_calendar_dates WHERE date < " + date + ") AND service_id NOT IN (SELECT service_id FROM gtfs_calendar_dates WHERE date >= " + date + ") AND exception_type = 1) AND monday = 0 AND tuesday = 0 AND wednesday = 0 AND thursday = 0 AND friday = 0 AND saturday = 0 AND sunday = 0));");
      db.exec("DELETE FROM gtfs_trips WHERE trip_id IN (SELECT trip_id FROM gtfs_trips WHERE service_id IN (SELECT service_id FROM gtfs_calendar WHERE service_id IN (SELECT service_id FROM gtfs_calendar_dates WHERE service_id IN(SELECT service_id FROM gtfs_calendar_dates WHERE date < " + date + ") AND service_id NOT IN (SELECT service_id FROM gtfs_calendar_dates WHERE date >= " + date + ") AND exception_type = 1) AND monday = 0 AND tuesday = 0 AND wednesday = 0 AND thursday = 0 AND friday = 0 AND saturday = 0 AND sunday = 0));");
      db.exec("DELETE FROM gtfs_calendar WHERE service_id IN (SELECT service_id FROM gtfs_calendar WHERE service_id IN (SELECT service_id FROM gtfs_calendar_dates WHERE service_id IN(SELECT service_id FROM gtfs_calendar_dates WHERE date < " + date + ") AND service_id NOT IN (SELECT service_id FROM gtfs_calendar_dates WHERE date >= " + date + ") AND exception_type = 1) AND monday = 0 AND tuesday = 0 AND wednesday = 0 AND thursday = 0 AND friday = 0 AND saturday = 0 AND sunday = 0);");
      db.exec("DELETE FROM gtfs_calendar_dates WHERE service_id IN (SELECT service_id FROM gtfs_calendar WHERE service_id IN (SELECT service_id FROM gtfs_calendar_dates WHERE service_id IN(SELECT service_id FROM gtfs_calendar_dates WHERE date < " + date + ") AND service_id NOT IN (SELECT service_id FROM gtfs_calendar_dates WHERE date >= " + date + ") AND exception_type = 1) AND monday = 0 AND tuesday = 0 AND wednesday = 0 AND thursday = 0 AND friday = 0 AND saturday = 0 AND sunday = 0);");
      db.exec("VACUUM;");
      
      db.exec("COMMIT", function() {
        return callback();
      });
    });

  }

  // No compile requested, skip post-compile steps...
  else {
    return callback();
  }

}


module.exports = postCompile;