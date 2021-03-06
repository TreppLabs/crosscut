// encireclement
var worldmap = require('./worldmap');
module.exports = {
	encirclement: encirclement
	//setWorldMap: setWorldMap
}

// CONFIG
// NO idea how to pass this in without dependancy cycles kicking in
var tileWidth = 10;
var tileHeight = 10;
var diagonalsConnected = true;

//var worldmap = {};
//function setWorldMap(map) { worldmap = map }

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

function samePosition(pos1, pos2) {
  return((pos1[0] == pos2[0]) && (pos1[1] == pos2[1]));
}

function sameVector(vec1, vec2) {
  return((vec1[0] == vec2[0]) && (vec1[1] == vec2[1]));
}

function isMine(position, myColor) {
  return (myColor == worldmap.getCell(position[0], position[1]).color);
}

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
function fillEnclosures(fillList, playerColor) {
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
    if (!isMarked(x,y)) {
      mark(x,y);
      fillCells.push([x,y]);
  	  worldmap.writeMapTileGlobal({x:x, y:y}, playerColor);
  	  var tileId = worldmap.tileIdFromXY(x,y);
  	  worldmap.worldEmitter.emit('pieceEncircled', x,y, playerColor, tileId);
      // numSteps was roughly "perimeter" of enclosed region, so will be a bound on fill region
      // (numSteps/4)^2 is really the bound
      //var numSteps = cellObj.numSteps;
      //var regionBound = Math.floor(numSteps * numSteps / 10) + 1;  // TODO not yet used
      ['L', 'U', 'R', 'D'].forEach(function(direction) {
        var adjacentCell = getCellInDirection(x, y, direction);
        var adjX = adjacentCell[0];
        var adjY = adjacentCell[1];
        if (!isMine(adjacentCell, playerColor)) {
          if (!isMarked(adjX, adjY)) {
          	var xy = {x: adjX, y: adjY, numSteps: numPops}
            fillList.push(xy);
          }
        }
      });
    }
  } //while

/*  
  fillCells.forEach(function(cell) {
    serverStatus += ' ' + cell[0] + ',' + cell[1];
  });

  // overwrite with new "fill" values on cells
  // then write to DB
  var updatedColors = utils.createArray(config.tileWidth, config.tileHeight);
  for (var x=0; x<config.tileWidth; x++) {
    for (var y=0; y<config.tileHeight; y++) {
      updatedColors[x][y] = {color: mapTile.colors[x][y].color};
    }
  }
  fillCells.forEach(function(cell) {
    var x = cell[0];
    var y = cell[1];
    updatedColors[x][y].color = playerColor;
  });
  console.log("writing encirclement to the world map");
  worldmap.writeMapTile(0, 0, updatedColors, function() {
  });
*/
}

function mark(x,y) {
  worldmap.getCell(x,y).mark = true;
}

function isMarked(x,y) {
  return (worldmap.getCell(x,y).mark == true);
}

// test whether the move at cell (x,y) has "encircled" opposing pieces
// convert if so
// start on each side of newly played cell and traverse border
// if circuit closes and turns Clockwise (net of 4 right turns) in the process,
// we have encircled.  
// recursive fill
// Initial version works in single tile.  Eventual version should read neighboring tiles as needed.
function encirclement(placedX, placedY, playerColor) {
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

	//var lowerLeftX = Math.floor(placedX/config.tileWidth)*config.tileWidth;
	//var lowerLeftY = Math.floor(placedY/config.tileHeight)*config.tileHeight;
  var tileId = worldmap.tileIdFromXY(placedX,placedY);
	var mapTile = worldmap.readMapTile(tileId); //GRRR. This should be in worldmap
  var xy = worldmap.tileXYFromGXY(placedX,placedY);

  console.log("Encirclement check @ " + placedX + "," + placedY +" -> " + xy.x + "," + xy.y );

	if (mapTile.cells[xy.x][xy.y].color != playerColor) {
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
	  if (!isMine(right, playerColor)) {
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
	      if (isMine(forwardLeft, playerColor) &&
	          isMine(forwardRight, playerColor)) {
	        //
	        //  Turn right
	        //
	        directionVector = rightTurn(directionVector);
	        left[0] = forwardRight[0];
	        left[1] = forwardRight[1];
	        numRightTurns += 1;
	      } else if (!isMine(forwardLeft, playerColor) &&
	                  isMine(forwardRight, playerColor)) {
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
	      } else if (isMine(forwardLeft, playerColor)) {
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
	    //console.log(serverStatus);
	  }
	});
    // if we encircled anything, fill it
    if (fillList.length > 0) {
      console.log("Encirclement detected - filling");
      fillEnclosures(fillList, playerColor);
    }
}



