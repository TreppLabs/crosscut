//Copyright 2013-2014 Amazon.com, Inc. or its affiliates. All Rights Reserved.
//Licensed under the Apache License, Version 2.0 (the "License"). 
//You may not use this file except in compliance with the License. 
//A copy of the License is located at
//
//    http://aws.amazon.com/apache2.0/
//
//or in the "license" file accompanying this file. This file is distributed 
//on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, 
//either express or implied. See the License for the specific language 
//governing permissions and limitations under the License.

//Get modules.
var express = require('express');
//var routes = require('./routes');
var http = require('http');
var path = require('path');
var AWS = require('aws-sdk');
var fs = require('fs');
var Q = require('q');
var app = express();
var utils = require('./lib/utils');
var bigbang = require('./lib/bigbang');
var worldmap = require('./lib/worldmap');
var decay = require('./lib/decay');
var mothernature = require('./lib/mothernature');

app.set('port', process.env.PORT || 3000);
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.static(path.join(__dirname, 'public')));
app.locals.theme = process.env.theme; //Make the THEME environment variable available to the app. 

// For sessions
app.use(express.cookieParser());
app.use(express.session({secret: 'meconium'}));

//Read config values from a JSON file.
var config = fs.readFileSync('./app_config.json', 'utf8');
config = JSON.parse(config);

// Global Server Variables

// these should agree with client & bot.js definitions, see .../index.jade
config.tileWidth=10;  // x
config.tileHeight=10;  // y

// should agree with client, see .../index.jade
config.emptyCellColor = '#B99F67';

config.startingCellStrength = 100;

// can decide whether diagonal cells are "connected" and thus can encircle
// NOTE: false case won't work completely if (below) we are only checking encirclement on 4 sides.
//  for non-diagonal, a new piece could have nbrs on all 4 sides, we've gotta check at diagonals too
config.diagonalsConnected = true;

worldmap.setConfig(config);
bigbang.loadWorld();
mothernature.grow();
decay.startRotter();

// User DB temporarily in config. Needs to move to its own file. Probably with
// node-dirty to start.
app.post("/login", function(req,res) {
  var username = req.body.username;
  var password = req.body.password;

  console.log("LOGIN: " + username + ", pw: " + password);

  var user = config.users[username];
  if (!user) { 
    console.log("Non-existent user: " + username);
    res.send(403); 
    return 
  }

  if (user.password === password) {
    req.session.user = user;
    res.send(user); // color here, tile width, etc. Not user
  } else {
    console.log("Pasword don't match! " + password + " -> " + user.password);
    res.send(403);
  }
});

app.get("/tile/:id", function (req, res) {
  var id = req.params.id;
  res.send(worldmap.readMapTile(id));
});

app.post('/aoi', function (req,res) {
  if (!req.session.user.username) { res.send(401); return }
  console.log("REGISTER AOI: " + req.session.user.username + " tile: " + req.body);
  mothernature.registerAOI(req.session.user.username, req.body);
  res.send(200);
});

// Get the changes to my area of interest
app.get('/changes', function(req, res) {
  if (!req.session.user) {
    res.send(401);
    return;
  }
  
  var username = req.session.user.username
  console.log("CHANGES for " + username + "?");
  res.send(mothernature.getChanges(req.session.user.username));
});

app.post('/clicker', function(req, res) {
  var cellX = parseInt(req.body.cellX);
  var cellY = parseInt(req.body.cellY);
  var color = req.session.user.color;

  console.log("CLICK: " + req.session.user.username + " color: " + color);

  var tile = worldmap.move(cellX, cellY, color);
  res.send(tile);
});

http.createServer(app).listen(app.get('port'), function(){
  console.log('Accretion server listening on port ' + app.get('port'));
});
