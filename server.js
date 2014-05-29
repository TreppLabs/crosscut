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

app.set('port', process.env.PORT || 3000);
// app.set('views', __dirname + '/views');
// app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
//app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));
app.locals.theme = process.env.theme; //Make the THEME environment variable available to the app. 

//Read config values from a JSON file.
var config = fs.readFileSync('./app_config.json', 'utf8');
config = JSON.parse(config);

//Create DynamoDB client and pass in region.
var db = new AWS.DynamoDB({region: config.AWS_REGION});
//Create SNS client and pass in region.
var sns = new AWS.SNS({ region: config.AWS_REGION});


// Global Server Variables

// Client can grab messages, mostly for debugging
var serverStatus = 'Server Status';

// these should agree with client & bot.js definitions, see .../index.jade
config.tileWidth=10;  // x
config.tileHeight=10;  // y

// should agree with client, see .../index.jade
config.emptyCellColor = '#B99F67';

config.startingCellStrength = 100;

// Local mode: 
//   true:  read/write tiles from (AWS) DB
//   false: tiles kept in memory, runnable on local machine
config.localMode=true;
// can decide whether diagonal cells are "connected" and thus can encircle
// NOTE: false case won't work completely if (below) we are only checking encirclement on 4 sides.
//  for non-diagonal, a new piece could have nbrs on all 4 sides, we've gotta check at diagonals too
config.diagonalsConnected = true;

worldmap.setConfig(config);
bigbang.loadWorld();

// console.log(process.env);

//GET home page.
//app.get('/', routes.index);

//POST signup form.
app.post('/signup', function(req, res) {
  var nameField = req.body.name,
      emailField = req.body.email,
      previewBool = req.body.previewAccess;
  res.send(200);
  signup(nameField, emailField, previewBool);
});


//Add signup form data to database.
var signup = function (nameSubmitted, emailSubmitted, previewPreference) {
  if (config.localMode) {
    console.log('signup -- skipping in local mode');
    return;
  }
  var formData = {
    TableName: config.STARTUP_SIGNUP_TABLE,
    Item: {
      email: {'S': emailSubmitted}, 
      name: {'S': nameSubmitted},
      preview: {'S': previewPreference}
    }
  };
  db.putItem(formData, function(err, data) {
    if (err) {
      console.log('Error adding item to database: ', err);
    } else {
      console.log('Form data added to database.');
      var snsMessage = 'New signup: %EMAIL%'; //Send SNS notification containing email from form.
      snsMessage = snsMessage.replace('%EMAIL%', formData.Item.email['S']);
      sns.publish({ TopicArn: config.NEW_SIGNUP_TOPIC, Message: snsMessage }, function(err, data) {
        if (err) {
          console.log('Error publishing SNS message: ' + err);
        } else {
          console.log('SNS message sent.');
        }
      });  
    }
  });
};

// return a rectangular region of the map
// whatever the client asks for
// internally this is stored as "tiles" -- get all the needed tiles and return them to client
// client may get more map than it needs -- will have to parse
app.post('/getmapregion', function(req, res) {
  var lowerLeftX = parseInt(req.body.lowerLeftX);
  var lowerLeftY = parseInt(req.body.lowerLeftY);
  var topRightX = parseInt(req.body.topRightX);
  var topRightY = parseInt(req.body.topRightY);
  
  var leftmostTileX = Math.floor(lowerLeftX/config.tileWidth)*config.tileWidth;
  var rightmostTileX = Math.floor(topRightX/config.tileWidth)*config.tileWidth;
  var lowestTileY = Math.floor(lowerLeftY/config.tileHeight)*config.tileHeight;
  var topmostTileY = Math.floor(topRightY/config.tileHeight)*config.tileHeight;

  var tileList = [];
  for (var tileX = leftmostTileX; tileX <= rightmostTileX; tileX += config.tileWidth) {
    for (var tileY = lowestTileY; tileY <= topmostTileY; tileY += config.tileHeight) {
      tileList.push([tileX, tileY]);
    }
  }

  worldmap.readMapTiles(tileList, function(mapTileList) {
    // client doesn't know mapTile size, so we'll tell it in each tile we send
    for (var i = 0; i<mapTileList.length; i++) {
      mapTileList[i].tileWidth = config.tileWidth;
      mapTileList[i].tileHeight = config.tileHeight;
    }
    res.send(mapTileList);
  });
});

app.post('/status', function(req, res) {
  res.send(serverStatus);
});

app.post('/getupdatetime', function(req, res) {
  res.send('' + worldmap.lastUpdateTime());
}); 

app.get("/tile/:id", function (req, res) {
  var id = req.params.id;
  res.send(worldmap.readMapTile(id));
});

app.post('/clicker', function(req, res) {
  var cellX = parseInt(req.body.cellX);
  var cellY = parseInt(req.body.cellY);
  var color = req.body.color;

  var tile = worldmap.move(cellX, cellY, color);
  res.send(tile);
});

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
