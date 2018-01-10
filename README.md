Metro North Railroad & SLE
==========================

**node module:** [right-track-agency-mnr](https://www.npmjs.com/package/right-track-agency-mnr)  
**GitHub repo:** [right-track/right-track-agency-mnr](https://github.com/right-track/right-track-agency-mnr)

---

This module is an implementation of a [right-track-agency](https://github.com/right-track/right-track-agency) 
used to add agency-specific configuration and functionality to various [Right Track Projects](https://github.com/right-track).

### Features

This module provides the following agency-specific information:

* Build Scripts for creating a Right Track Database for MNR (using the [right-track-db-build](https://github.com/right-track/right-track-db-build) project)
* The latest compiled Right Track Database for MNR
* The archived Right Track Databases for MNR (in the git repo)
* Agency configuration properties to be used in various _Right Track_ projects
* The functions to generate a MNR Station Feed for the [right-track-server](https://github.com/right-track/right-track-server) 

### Documentation

Documentation can be found in the **/doc/** directory of this repository 
or online at [https://docs.righttrack.io/right-track-agency-mnr](https://docs.righttrack.io/right-track-agency-mnr).

Additional documentation about the `RightTrackAgency` class can be found in the 
[right-track-agency](https://github.com/right-track/right-track-agency) project 
and online at [https://docs.righttrack.io/right-track-agency](https://docs.righttrack.io/right-track-agency).

### Usage

On `require` the module will return a new instance of the **Metro North Railroad 
& SLE** implementation of a `RightTrackAgency` Class.

To get the agency configuration properties:
```javascript
const MNR = require('right-track-agency-mnr');

// Optionally load an additional configuration file
MNR.readConfig('/path/to/config.json');

// Get the merged configuration
let config = MNR.getConfig();
``` 

To get the real-time `StationFeed` for Grand Central Terminal:
```javascript
const core = require('right-track-core');
const RightTrackDB = require('right-track-db-sqlite3');
const MNR = require('right-track-agency-mnr');

// Set up the Right Track DB for Metro North
let db = new RightTrackDB(MNR);

// Get the Stop for Grand Central Terminal (id='1') by querying the RightTrackDB
core.query.stops.getStop(db, '1', function(err, stop) {
  
  // Load the StationFeed for Grand Central Terminal
  MNR.loadFeed(db, stop, function(err, feed) {
    
    // Do something with the feed
    console.log(feed);
    
  });
  
});
```