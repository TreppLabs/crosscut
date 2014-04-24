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

// from http://www.russwurm.com/uncategorized/calculate-memory-size-of-javascript-object/ 
function roughSizeOfObject( object ) {
    var objectList = [];
    var recurse = function( value ) {
        var bytes = 0;
 
        if ( typeof value === 'boolean' ) {
            bytes = 4;
        } else if ( typeof value === 'string' ) {
            bytes = value.length * 2;
        } else if ( typeof value === 'number' ) {
            bytes = 8;
        } else if (typeof value === 'object'
                 && objectList.indexOf( value ) === -1) {
            objectList[ objectList.length ] = value;
            for( i in value ) {
                bytes+= 8; // assumed existence overhead
                bytes+= recurse( value[i] )
            }
        }
        return bytes;
    }
    return recurse( object );
}


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


function isMine(position, color, mapTile) {
  if (outOfBounds(position)) {
    return false;
  } else if (mapTile[position[0]][position[1]].cellColor == color) {
    return true;
  } else {
    // empty or belongs to someone else
    return false;
  }
}


var eventEmitter = new events.EventEmitter();
eventEmitter.on('piecePlaced', function(x,y) {
  encirclement(x,y);
});

// test whether the move at cell (x,y) has "encircled" opposing pieces
// convert if so
// start on each side of newly played cell and traverse border
// if circuit closes and turns Clockwise (net of 4 right turns) in the process,
// we have encircled.  
// recursive fill
// Initial version works in single tile.  Eventual version should read neighboring tiles as needed.
// TODO: breakout reading of mapTile into separate fn
var encirclement = function encirclement(placedX, placedY) {
  var scanObject = {
    TableName: config.CROSSCUT_SIMPLE_CELL_COUNTS,
  }

  var mapTileCells = createArray(tileWidth, tileHeight);

  db.scan(scanObject, function(err,data) {
    if (err) {
      console.log('Error getting map tile: ' + err);
      return;
    } else {
      console.log("99999 " + data.Count);  // 55555 delete
      
      // for occasional debugging -- as of v1051 a map tile was roughly 7724 bytes
      // DynamoDB has a max return size of 64k
      //console.log('map tile object size: ' + roughSizeOfObject(data));

      // read map tile from db
      data.Items.forEach(function(item) {
        var cellNum = item.cellnum.N;
        var cellColor = item.Color.S;
        var cellX = (cellNum-1) % tileWidth;
        var cellY = Math.floor((cellNum-1)/tileHeight);

        mapTileCells[cellX][cellY] = {cellNum : cellNum, cellColor : cellColor};
      });
    }
    


    // for debugging readmaptile
    // console.log('99999 in encirclement: ')
    //for (var y=9; y>=0; y--) {
    //  var rowColors = "";
    //  for (var x=0; x<10; x++) {
    //    rowColors += mapTileCells[x][y].cellColor + ", ";
    //  }
    //  console.log("y=" + y + ": " + rowColors);
    //}
    
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
    //   diagonal connections do not count for encirclement (for now)
    //   a single piece could generate two encircled regions (potentially 4 if diagonal connections count)
    //   player owning a cell currently determined by color, this will change when we have registration
    //   out-of-bounds beyond current tile -- eventually extend to infinite

    var playerColor = mapTileCells[placedX][placedY].cellColor;
    serverStatus = '  Encirc @ (' + placedX + ',' + placedY + ') ';
    ['L', 'U', 'R', 'D'].forEach(function(startingDirection) {
      var left = [placedX, placedY];
      var startingLeft = [placedX, placedY];
      var startingVector = directionToVector(startingDirection);
      var directionVector = directionToVector(startingDirection);
      var right = getRightCell(left, directionVector);
      if (!outOfBounds(right) && !isMine(right, playerColor, mapTileCells)) {
        serverStatus += '  Direction:' + startingDirection + ' suitable. ';
        var backAtStart = false;
        var numRightTurns = 0;
        while (!backAtStart) {
          // figure out next traversal step based on what is in front of us
          var forwardLeft = getForwardLeftCell(left, directionVector);
          var forwardRight = getForwardRightCell(left, directionVector);
          if (isMine(forwardRight, playerColor, mapTileCells)) {
            //
            //  Turn right
            //
            serverStatus += 'RT:[[[' + left[0] + ',' + left[1] + '][' + directionVector[0] + ',' + directionVector[1] + ']]]===>';
            directionVector = rightTurn(directionVector);
            left[0] = forwardRight[0];
            left[1] = forwardRight[1];
            numRightTurns += 1;
            serverStatus += '[[[' + left[0] + ',' + left[1] + '][' + directionVector[0] + ',' + directionVector[1] + ']]]';
          } else if (isMine(forwardLeft, playerColor, mapTileCells)) {
            //
            // Go straight ahead
            //
            // direction doesn't' change
            serverStatus += 'SA:[[[' + left[0] + ',' + left[1] + '][' + directionVector[0] + ',' + directionVector[1] + ']]]===>';
            left[0] = forwardLeft[0];
            left[1] = forwardLeft[1];
            // no right turn
            serverStatus += '[[[' + left[0] + ',' + left[1] + '][' + directionVector[0] + ',' + directionVector[1] + ']]]';
          } else {
            //
            // Turn left
            //
            serverStatus += 'LT:[[[' + left[0] + ',' + left[1] + '][' + directionVector[0] + ',' + directionVector[1] + ']]]===>';
            // left cell stays the same
            directionVector = rightTurn(rightTurn(rightTurn(directionVector)));
            numRightTurns -= 1; 
            serverStatus += '[[[' + left[0] + ',' + left[1] + '][' + directionVector[0] + ',' + directionVector[1] + ']]]';
          }
          serverStatus += '...left: (' + left[0] + ',' + left[1] + '), dir: (' + directionVector[0] + ',' + directionVector[1] + ')';
          if (samePosition(left, startingLeft) && sameVector(directionVector, startingVector)) {
            backAtStart = true;
            serverStatus += 'back at start! ... numrights = ' + numRightTurns;
            if (numRightTurns == 4) {
              //
              // We Encircled something!
              //
              serverStatus += '...BINGO!';
              // TODO do stuff
            }
          }
        }
        console.log(serverStatus);
      }
    });
  });
}


app.post('/getmap', function(req, res) {

  var scanObject = {
    TableName: config.CROSSCUT_SIMPLE_CELL_COUNTS,
  }

  db.scan(scanObject, function(err,data) {
    if (err) {
      console.log('Error getting new map data: ' + err);
      res.send('scan error getting map');
    } else {
      res.send(data);
    }
  });
});

var serverStatus = 'Server Status';

app.post('/status', function(req, res) {
  res.send(serverStatus);
})

var postCount = 0;
app.post('/inquiry', function(req, res) {
  postCount += 1;
  res.send('c' + postCount);
});


// found on StackOverflow -- creates n-dimensional array as specified
function createArray(dimensions) {
    var arr = new Array(dimensions || 0),
        i = dimensions;

    if (arguments.length > 1) {
        var args = Array.prototype.slice.call(arguments, 1);
        while(i--) arr[dimensions-1 - i] = createArray.apply(this, args);
    }

    return arr;
}


// these should agree with client & bot.js definitions, see .../index.jade
var tileWidth = 10;  // x
var tileHeight = 10; // y

app.post('/clicker', function(req, res) {
  var cellX = parseInt(req.body.cellX);
  var cellY = parseInt(req.body.cellY);
  var color = req.body.color;

  serverStatus = 'cell x, y = ' + cellX + ', ' + cellY + ' clicked';

  var cellNum = tileWidth*(cellY) + cellX + 1;  // should be 1-100
  var cellString = 'cell'+cellNum;


  // update in CSCC table
  var countData = {
    TableName: config.CROSSCUT_SIMPLE_CELL_COUNTS,
    Key: {
      'cellnum': {'N': cellNum.toString()}
    },
    AttributeUpdates: {'ClickCount': {'Value': {'N': '1'},'Action': 'ADD'},
                       'Color': {'Value': {'S': color}, 'Action': 'PUT'}
                      },
    ReturnValues: "ALL_NEW"
  }

  db.updateItem(countData, function(err, data) {
    if (err) {
      console.log('Error adding CSCC to database: ', err);
    } else {
    }
  });

  console.log('in /clicker  ... emitting event...');
  // TODO: emit placedPiece event to trigger this!
  eventEmitter.emit('piecePlaced', cellX, cellY);
  //encirclement(cellX, cellY);

  // above, we're updating cumulative clicks in the DB
  // don't return anything -- client's map will pick up via periodic polling update
  res.send("click");
});

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
