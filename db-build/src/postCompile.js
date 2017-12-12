'use strict';

/**
 * MNR Post-Compile Script
 * This script performs the MNR-specific Database fixes
 * @param {Object} agencyOptions Agency DB-Build Options
 * @param {Object} db SQLite database
 * @param {function} callback Callback function()
 * @private
 */
function postCompile(agencyOptions, db, callback) {

  // Perform post-compile if a compile was requested...
  if ( agencyOptions.compile === true ) {

    db.serialize(function() {
      db.exec("BEGIN TRANSACTION");

      // Remove unused agencies
      console.log("    ... Removing unused agencies");
      db.exec("DELETE FROM gtfs_agency WHERE agency_id <> '1' AND agency_id <> '111';");

      // Remove unused routes
      console.log("    ... Removing unused routes");
      db.exec("DELETE FROM gtfs_routes WHERE agency_id <> '1' AND agency_id <> '111';");

      // Update Route Long Names
      console.log("    ... Updating route names");
      db.exec("UPDATE gtfs_routes SET route_long_name='New Haven Line' WHERE route_short_name='New Haven';");
      db.exec("UPDATE gtfs_routes SET route_long_name='New Canaan Branch' WHERE route_short_name='New Canaan';");
      db.exec("UPDATE gtfs_routes SET route_long_name='Danbury Branch' WHERE route_short_name='Danbury';");
      db.exec("UPDATE gtfs_routes SET route_long_name='Waterbury Branch' WHERE route_short_name='Waterbury';");
      db.exec("UPDATE gtfs_routes SET route_long_name='Hudson Line' WHERE route_short_name='Hudson';");
      db.exec("UPDATE gtfs_routes SET route_long_name='Harlem Line' WHERE route_short_name='Harlem';");

      // Remove unused stops
      console.log("    ... Removing unused stops");
      db.exec("DELETE FROM gtfs_stops WHERE stop_id IN ('40001', '40002', " +
        "'502', '504', '505', '506', '507', '508', '510', '512', '514', '516', '518', " +
        "'602', '604', '606', '608', '610', '612', '614', '616', '618', '620');");

      // Set direction descriptions
      console.log("    ... Setting direction descriptions");
      db.exec("UPDATE gtfs_directions SET description='Outbound' WHERE direction_id=0;");
      db.exec("UPDATE gtfs_directions SET description='Inbound' WHERE direction_id=1;");

      // Set pickup_type and drop_off_type = 0 at all stops EXCEPT:
      // 125th St (4) and Fordham (56) White Plains (74) and Croton-Harmon (33)
      console.log("    ... Fixing pickup/drop-off types");
      db.exec("UPDATE gtfs_stop_times SET pickup_type=0, drop_off_type=0 WHERE stop_id <> 4 AND stop_id <> 56 AND stop_id <> 74 AND stop_id <> 33;");

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