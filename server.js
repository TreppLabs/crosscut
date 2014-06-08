//
// Accretion
// 

var express = require('express');

var http = require('http');
var path = require('path');
var fs = require('fs');
var Q = require('q');

// Local modules
var utils = require('./lib/utils');
var bigbang = require('./lib/bigbang');
var worldmap = require('./lib/worldmap');
var decay = require('./lib/decay');
var mothernature = require('./lib/mothernature');

var restAPI = require('./lib/rest_api');
var realtimeAPI = require('./lib/realtime_api');
var authAPI = require('./lib/auth_api');

// Set up the web server
var app = express();

app.set('port', process.env.PORT || 3000);
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.static(path.join(__dirname, 'public')));

//Read config values from a JSON file.
var config = fs.readFileSync('./app_config.json', 'utf8');
config = JSON.parse(config);

// set up and initialise all modules
worldmap.setConfig(config);
decay.setConfig(config);
bigbang.loadWorld();
mothernature.grow();
decay.startRotter();

// Set up our three APIs
authAPI.configure(app, config);
restAPI.configure(app, config);
realtimeAPI.configure(app, config);

http.createServer(app).listen(app.get('port'), function(){
  console.log('Accretion server listening on port ' + app.get('port'));
});
