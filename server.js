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
var routes = require('./routes');
var http = require('http');
var path = require('path');
var fs = require('fs');
var AWS = require('aws-sdk');
var events = require('events');
var app = express();
var utils = require('./lib/utils');

app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));
app.locals.theme = process.env.theme; //Make the THEME environment variable available to the app. 

//Read config values from a JSON file.
var config = fs.readFileSync('./app_config.json', 'utf8');
config = JSON.parse(config);

//Create DynamoDB client and pass in region.
var db = new AWS.DynamoDB({region: config.AWS_REGION});
//Create SNS client and pass in region.
var sns = new AWS.SNS({ region: config.AWS_REGION});

console.log(process.env);


// Global Server Variables

// Client can grab messages, mostly for debugging
var serverStatus = 'Server Status';

// these should agree with client & bot.js definitions, see .../index.jade
var tileWidth = 10;  // x
var tileHeight = 10; // y

// can decide whether diagonal cells are "connected" and thus can encircle
// NOTE: false case won't work completely if (below) we are only checking encirclement on 4 sides.
//  for non-diagonal, a new piece could have nbrs on all 4 sides, we've gotta check at diagonals too
var diagonalsConnected = true;

// time of last map update
// Caveats:
//   for now this is just approximate, should be generated in DB txn 
//   for now this is "global" for map.  should be on per-tile basis
//   click on player's own piece is counted as "update" , though only changes click-count
var lastUpdateTime = (new Date()).getTime();
serverStatus += ' ' + lastUpdateTime;

//GET home page.
app.get('/', routes.index);

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

// Following are utilities for encirclement
function directionToVector(direction) {
  if (direction == 'L') {
    return [-1,0];
  } else if (direction == 'U') {
    return [0,1];
  } else if (direction == 'R') {
    return [1,0];
  } else {
    return [0,-1];
  }
}

// right turn *relative* to vector 
function rightTurn(vector) {
  // this can be easily done using 17-th order Quaternions and quantum electrodynamics but we'll use "if-then-else"
  var rightVector = new Array(2);
  
  if (vector[0] == 0) {
    rightVector[0] = vector[1];
  } else {
    rightVector[0] = 0;
  }
  if (vector[1] == 0) {
    rightVector[1] = -(vector[0]);
  } else {
    rightVector[1] = 0;
  }
  return rightVector;
}

// get position *relative* to our current position and vector of travel
function getRightCell(left, vector) {
  var rightVector = rightTurn(vector);
  return [left[0] + rightVector[0], left[1] + rightVector[1]];
}

function getForwardRightCell(left, vector) {
  var rightVector = rightTurn(vector);
  return [left[0] + vector[0] + rightVector[0], left[1] + vector[1] + rightVector[1]];
}

function getForwardLeftCell(left, vector) {
  return [left[0] + vector[0], left[1] + vector[1]];
}

function outOfBounds(position) {
  if (position[0] < 0 || position[0] >= tileWidth) {
    return true;
  }
  if (position[1] < 0 || position[1] >= tileHeight) {
    return true;
  } else {
    return false;
  }
}

function samePosition(pos1, pos2) {
  return((pos1[0] == pos2[0]) && (pos1[1] == pos2[1]));
}

function sameVector(vec1, vec2) {
  return((vec1[0] == vec2[0]) && (vec1[1] == vec2[1]));
}


function isMine(position, myColor, mapTile) {
  if (outOfBounds(position)) {
    return false;
  } else if (myColor == mapTile.colors[position[0]][position[1]].color) {
    return true;
  } else {
    // empty or belongs to someone else
    return false;
  }
}

// read single tile of map 
// lower left corner at x,y

function readMapTile(x, y, callback) {
  var dbGetObject = {
    Key:
    {
      'MapTileId': {'S': 'x' + x + 'y' + y}
    },
  
    TableName: config.CROSSCUT_MAPTILE_TABLE
  }

  db.getItem(dbGetObject, function(err,data) {
    if (err) {
      console.log('Error db.getting map tile: ' + err);
      return;
    } else {
      // for occasional debugging -- as of v1051 a map tile was "roughly" 7724 bytes
      //                          -- as of v1151 a map tile was "roughly" 4132 bytes (just colors now, dropped x.y)
      // DynamoDB has a max return size of 64k
      //console.log('map tile object size: ' + utils.roughSizeOfObject(data));

      var mapTile = {};
      mapTile.id = data.Item.MapTileId.S;
      mapTile.updateTime = data.Item.UpdateTime.S;
      // TODO  make new column CellContents
      // each cell's contents is an object -- color only now; in future, may contain a bunch of stuff
      mapTile.colors = JSON.parse(data.Item.JsonTile.S);
      //following is what we expect, and returns what we expects
      callback(mapTile);
    }
  });
}

// Write single map tile to database.
// lower left corner at x,y
// TODO: Check if it has been updated since our data was read.  If so, complain but write anyway.
// TODO: consolidate other writes with this
var writeMapTile = function (x, y, cellContents, callback) {
  var updateTime = (new Date()).getTime();
  lastUpdateTime = updateTime;

  var mapTileData = {
    TableName: config.CROSSCUT_MAPTILE_TABLE,
    Item: {
      MapTileId: {'S': 'x' + x + 'y' + y}, 
      UpdateTime: {'S': '' + updateTime},
      JsonTile: {'S': JSON.stringify(cellContents)}
    }
  };
  db.putItem(mapTileData, function(err, data) {
    if (err) {
      console.log('Error adding map tile to database: ', err);
    } else {
      callback();
    }
  });
};

function getCellInDirection(x, y, direction) {
  if (direction == 'U') {
    return [x, y+1];
  } else if (direction == 'R') {
    return [x+1, y];
  } else if (direction == 'D') {
    return [x, y-1];
  } else {
    return [x-1, y];
  }
}

// fillList includes 1-4 cells that were recently "encircled"
// starting at each, fill their "regions" -- out to the enclosing ring of playerColor
// some of the fill regions may connect, so we mark as we go
function fillEnclosures(fillList, mapTile, playerColor) {
  var fillCells = [];
  var regionBound = 1000; // drop in a number so no infinite loop
  var numPops = 0;
  while(fillList.length > 0) {
    var cellObj = fillList.pop();
    numPops += 1;
    if (numPops>regionBound) {
      console.log('Too many cells during fill: ' + numPops + 'halting!!');
      return;
    }
    var x = cellObj.x;
    var y = cellObj.y;
    if (mapTile.colors[x][y].mark == undefined || mapTile.colors[x][y].mark == false) {
      mapTile.colors[x][y].mark = true;
      fillCells.push([x,y]);
      // numSteps was roughly "perimeter" of enclosed region, so will be a bound on fill region
      // (numSteps/4)^2 is really the bound
      //var numSteps = cellObj.numSteps;
      //var regionBound = Math.floor(numSteps * numSteps / 10) + 1;  // TODO not yet used
      ['L', 'U', 'R', 'D'].forEach(function(direction) {
        var adjacentCell = getCellInDirection(x, y, direction);
        var adjX = adjacentCell[0];
        var adjY = adjacentCell[1];
        if (!outOfBounds(adjacentCell) && !isMine(adjacentCell, playerColor, mapTile)) {
          if (mapTile.colors[adjX][adjY].mark == undefined || mapTile.colors[adjX][adjY].mark == false) {
            fillList.push({x: adjX, y: adjY, numSteps: numPops});
          }
        }
      });
    }
  }
  
  fillCells.forEach(function(cell) {
    serverStatus += ' ' + cell[0] + ',' + cell[1];
  });

  // overwrite with new "fill" values on cells
  // then write to DB
  var updatedColors = utils.createArray(tileWidth, tileHeight);
  for (var x=0; x<tileWidth; x++) {
    for (var y=0; y<tileHeight; y++) {
      updatedColors[x][y] = {color: mapTile.colors[x][y].color};
    }
  }
  fillCells.forEach(function(cell) {
    var x = cell[0];
    var y = cell[1];
    updatedColors[x][y].color = playerColor;
  });
  writeMapTile(0, 0, updatedColors, function() {
  });
}


var eventEmitter = new events.EventEmitter();
eventEmitter.on('piecePlaced', function(x,y, color) {
  encirclement(x, y, color);
});

// test whether the move at cell (x,y) has "encircled" opposing pieces
// convert if so
// start on each side of newly played cell and traverse border
// if circuit closes and turns Clockwise (net of 4 right turns) in the process,
// we have encircled.  
// recursive fill
// Initial version works in single tile.  Eventual version should read neighboring tiles as needed.
// TODO: breakout reading of mapTile into separate fn
var encirclement = function encirclement(placedX, placedY, playerColor) {

  readMapTile(0, 0, function(mapTile) {
    // Test if newly placed piece created an "encirclement" of cells not belonging to the player.
    // Will look at each side as potential start.  Then traverse.
    // Establish and maintain this invariant:
    //   We're on an edge between two cells, headed in one direction
    //   Player owns cell to left, does NOT own cell to right (could be other player, empty, or out-of-bounds)

    // left : [x,y] cell to our left
    // direction : 'L' or 'U' or 'R' or 'D' representing "absolute" direction we're pointing
    // directionVector : corresponding unit vector [-1,0] or [0,1] or [1,0] or [0,-1]
    // startingLeft : cell to our left at "start" of traversal (so we can tell when we've returned)
    // startingDirection : "absolute" direction of start
    // numRightTurns : net number of right-hand turns we've made

    // other notes:
    //   diagonal connections do count for encirclement (for now)
    //   a single piece could generate two encircled regions (potentially 4 if diagonal connections count)
    //   player owning a cell currently determined by color, this will change when we have registration
    //   out-of-bounds beyond current tile -- eventually extend to infinite


    if (mapTile.colors[placedX][placedY].color != playerColor) {
      console.log('GAAH!  == unexpected color at x.y, while running encirclement!  bailing out!!!');
      return;
    }

    var fillList = [];
    ['L', 'U', 'R', 'D'].forEach(function(startingDirection) {
      var left = [placedX, placedY];
      var startingLeft = [placedX, placedY];
      var startingVector = directionToVector(startingDirection);
      var directionVector = directionToVector(startingDirection);
      var right = getRightCell(left, directionVector);
      if (!outOfBounds(right) && !isMine(right, playerColor, mapTile)) {
        var backAtStart = false;
        var numRightTurns = 0;
        var numSteps = 0;
        while (!backAtStart) {
          numSteps += 1;
          if (numSteps > 1000) {
            console.log('Too many steps (> 1000) during encirclement from (' + placedX + ',' + placedY + '): ' + numSteps);
            return;
          }
          // figure out next traversal step based on what is in front of us
          var forwardLeft = getForwardLeftCell(left, directionVector);
          var forwardRight = getForwardRightCell(left, directionVector);
          if (isMine(forwardLeft, playerColor, mapTile)&&
              isMine(forwardRight, playerColor, mapTile)) {
            //
            //  Turn right
            //
            directionVector = rightTurn(directionVector);
            left[0] = forwardRight[0];
            left[1] = forwardRight[1];
            numRightTurns += 1;
          } else if (!isMine(forwardLeft, playerColor, mapTile)&&
                      isMine(forwardRight, playerColor, mapTile)) {
            //
            //  "Diagonal case" -- 
            //     if diagonal connections count -- turn right
            //     if diagonal connections don't count -- turn left
            //
            if (diagonalsConnected) {
              // turn right
              directionVector = rightTurn(directionVector);
              left[0] = forwardRight[0];
              left[1] = forwardRight[1];
              numRightTurns += 1;
            } else {
              // turn left
              // left cell stays the same
              directionVector = rightTurn(rightTurn(rightTurn(directionVector)));
              numRightTurns -= 1; 
            }
          } else if (isMine(forwardLeft, playerColor, mapTile)) {
            //
            // Go straight ahead
            //
            // direction doesn't' change
            left[0] = forwardLeft[0];
            left[1] = forwardLeft[1];
            // no right turn
          } else {
            //
            // Turn left
            //
            // left cell stays the same
            directionVector = rightTurn(rightTurn(rightTurn(directionVector)));
            numRightTurns -= 1; 
          }
          if (samePosition(left, startingLeft) && sameVector(directionVector, startingVector)) {
            backAtStart = true;
            if (numRightTurns == 4) {
              //
              // We Encircled something!
              //
              var right = getRightCell(left, directionVector);
              //
              // The cell to the right (not belonging to player) has been encircled
              // save it as one of the places to go fill
              fillList.push({x: right[0], y: right[1], numSteps : numSteps});
            }
          }
        }
        console.log(serverStatus);
      }
    });
    // if we encircled anything, fill it
    if (fillList.length > 0) {
      fillEnclosures(fillList, mapTile, playerColor);
    }
  });
}

// is it ok to place "color" at x,y?
// if so, do it!
function move(x, y, pieceColor) {

  readMapTile(0, 0, function(mapTile) {
    var cellColor = mapTile.colors[x][y].color;
  
    if (cellColor == pieceColor) {
      return;
    } else {
      mapTile.colors[x][y].color = pieceColor;
      writeMapTile(0, 0, mapTile.colors, function() {


        // new piece placed successfully
        // trigger anything else that needs doing
        lastUpdateTime = (new Date()).getTime();
        eventEmitter.emit('piecePlaced', x, y, pieceColor);
      });
    }
  });
}

app.post('/getmap', function(req, res) {
  readMapTile(0, 0, function(mapTile) {
    res.send(mapTile);
  });
});

app.post('/status', function(req, res) {
  res.send(serverStatus);
});

app.post('/getupdatetime', function(req, res) {
  res.send('' + lastUpdateTime);
}); 

app.post('/clicker', function(req, res) {
  var cellX = parseInt(req.body.cellX);
  var cellY = parseInt(req.body.cellY);
  var color = req.body.color;

  move(cellX, cellY, color);

  res.send('click');
});

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
