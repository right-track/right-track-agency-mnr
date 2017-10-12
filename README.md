Metro North Railroad & SLE
==========================

#### node module: [right-track-agency-mnr](https://www.npmjs.com/package/right-track-agency-mnr)

---

This module is an implementation of a [right-track-agency](https://github.com/right-track/right-track-agency) 
used to add agency-specific configuration and functionality to various [Right Track Projects](https://github.com/right-track).

### Features

This module provides the following agency-specific information:

* The latest compiled Right Track Database for MNR
* The archived Right Track Databases for MNR
* Agency configuration properties to be used in various _Right Track_ projects
* The functions to generate a MNR Station Feed for the [right-track-server](https://github.com/right-track/right-track-server) 

### Documentation

Documentation can be found in the **/doc/** directory of this repository 
or online at [https://docs.righttrack.io/right-track-agency-mnr](https://docs.righttrack.io/right-track-agency-mnr).

### Configuration

Configuration functions are located in `agency.config`. 

#### Default Configuration

When the module is loaded via `require()`, the default configuration file (`agency.json` 
located in the module's root directory) is loaded.

```javascript
const agency = require("right-track-agency-mnr");   // loads the default configuration  
``` 

#### Custom Configuration

If you need to override any variables in the default configuration, create a new 
json file and include any variable definitions to change.

Any relative paths in the configuration file (such as the database location) will 
be loaded relative to the directory this configuration file is located in.

```json
{
    "db": {
        "location": "/path/to/database.db"    
    }
}
```

### Usage

#### Read Custom Configuration File

To load a custom configuration file, use the `read(location)` function.

A relative path passed as the location of the new config file will be loaded 
relative to the module's root directory.

```javascript
agency.config.read("/path/to/config.json");               // override config variables
```


#### Get Configuration Variables

Use the `get()` function to get the agency's configuration variables (including 
any merged in from an additional file via `read()`).

```javascript
let config = agency.config.get();
```

where `config` is an Object containing the agency's configuration.

```
{
   name:'Metro North Railroad & SLE',
   id:'mnr',
   maintainer:{
      name:'David Waring',
      email:'dev@davidwaring.net',
      website:'https://www.davidwaring.net/'
   },
   db:{
      location:'/right-track/src/agency-mnr/static/db/latest/database.db',
      archiveDir:'/right-track/src/agency-mnr/static/db/archive/'
   },
   stationFeed:{
      stationURL:'http://as0.mta.info/mnr/mstations/station_status_display.cfm?P_AVIS_ID={{STATUS_ID}}',
      gtfsrt:{
         url:'https://mnorth.prod.acquia-sites.com/wse/gtfsrtwebapi/v1/gtfsrt/{{GTFS_RT_API_KEY}}/getfeed',
         apiKey:''
      }
   },
   static:{
      img:{
         icon:'/right-track/src/agency-mnr/static/img/icon.png'
      }
   }
}
```