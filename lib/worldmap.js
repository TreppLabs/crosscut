/*
 *
 */
"use strict";

var AWS = require('aws-sdk');
var Q = require('q');
var utils = require('./utils');
var events      = require('events');
var eventEmitter = new events.EventEmitter();
var Cell = require('./cell');

// exports
module.exports = {
  setConfig:      setConfig,
  readMapTile:    readMapTile,
  writeMapTile:   writeMapTile,
  theBigCrunch:   theBigCrunch,
  move:           move,
  expire:         expire,
  worldEmitter:   eventEmitter,
  lastUpdateTime: lastUpdateTime,
  tileIdFromXY:   tileIdFromXY,
  tileXYFromGXY:  tileXYFromGXY,
  readMapTiles:   readMapTiles,
  getTileFromXY:  getTileFromXY,
  getCell:        getCell,
  writeMapTileGlobal: writeMapTileGlobal
}

// Time of last global map update
// Caveats:
//   for now this is just approximate, should be generated in DB txn 
//   for now this is "global" for map.  should be on per-tile basis
//   click on player's own piece is counted as "update" , though only changes click-count
var lastUpdateTime = (new Date()).getTime();

// NOTE: there is only one for the moment at x0y0
var localMapTileHash = {}; // The world map storage
var config = {};

// pass us to encirclement so we don't get a dependancy loop
//encirclement.setWorldMap(this);

function setConfig(globalConfig) {
  config = globalConfig;
}

//Create DynamoDB client and pass in region.
var db = new AWS.DynamoDB({region: config.AWS_REGION});

// Set the universe back to nothing once again (in prep for loading)
function theBigCrunch() {
  console.log("The Big CRUNCH!");
  localMapTileHash = {};
}

function lastUpdateTime() {
  return lastUpdateTime;
}

function createEmptyLocalMapTile(tileId) {
  console.log('creating empty map tile, id: ' + tileId);
  var mapTile = {};
  var emptyCellArray = utils.createArray(config.tileWidth, config.tileHeight);
  for (var i=0; i<config.tileWidth; i++) {
    for (var j=0; j<config.tileHeight; j++) {
      emptyCellArray[i][j] = new Cell(config.emptyCellColor, 0,0);
    }
  }
  mapTile.id = tileId;
  mapTile.updateTime = '0';
  mapTile.cells = emptyCellArray;

  return mapTile;
}


// Returns the tile based on the tileId. TileId is a string of the format "xnyn"
function readMapTile(tileId) {
  if (localMapTileHash.hasOwnProperty(tileId)) {
    return localMapTileHash[tileId];
  } 

  var mapTile = createEmptyLocalMapTile(tileId);
  localMapTileHash[tileId] = mapTile;

  console.log('New tile created, id: ' + tileId);
    
  return mapTile;
}

// Updates the color of a single cell
//
// The tile its on is passed in.
// lx and ly are local coordinates on the tile (have been translated from the global x,y)
// TODO: Check if it has been updated since our data was read.  If so, complain but write anyway.
// TODO: consolidate other writes with this
function writeMapTile(tile, xy, color) {
  console.log("writing to cell " + xy.x + "," + xy.y + ": " + color + ', strength: ' + config.startingCellStrength);
  lastUpdateTime          = (new Date()).getTime();
  var cell = new Cell(color, lastUpdateTime, config.startingCellStrength)
  tile.cells[xy.x][xy.y] = cell;
  tile.updateTime         = lastUpdateTime;
}

// Takes a global x, y position and converts it before saving
function writeMapTileGlobal(xy, color) {
  var tile = getTileFromXY(xy.x, xy.y);
  var lxy = tileXYFromGXY(xy.x, xy.y);
  writeMapTile(tile, lxy, color);
}

// TODO: remove promises
// each element of tileList is an [x,y] that specifies lower left corner of a maptile
// read them all and return in a list
function readMapTiles(tileList, callback) {

  var readList = [];
  for (var i = 0; i<tileList.length; i++) {
    readList.push(readMapTile(tileIdFromXY(tileList[i][0], tileList[i][1])));
  }

  Q.all(readList).done(function(mapTileList) { 
    callback(mapTileList);
  });

}

// beginner version of "decay" -- piece goes away
function expire(gx, gy) {
  var tileId = tileIdFromXY(gx,gy);
  var mapTile = readMapTile(tileId);
  var xy = tileXYFromGXY(gx,gy);

  console.log("Expire request (" + tileId + ") @: " + xy.x + ', ' + xy.y);
  
  writeMapTile(mapTile, xy, config.emptyCellColor);
  eventEmitter.emit('pieceExpired', gx, gy);

  return mapTile;
}

// is it ok to place "color" at x,y?
// if so, do it!
function move(gx, gy, pieceColor) {
  var tileId = tileIdFromXY(gx,gy);
  var mapTile = readMapTile(tileId);
  var xy = tileXYFromGXY(gx,gy);

  console.log("Move request (" + tileId + "): " + gx + "," + gy + " color: " + pieceColor);
  // check that the cell is empty space
  if (!isCosmicBackgroundRadiation(mapTile.cells[xy.x][xy.y])) {
    console.log("Already a color there. Doh. Can't click");
    return mapTile;
  }
  console.log("all good, setting a new color");

  // save this move and check for encirclements, then tell the world
  writeMapTile(mapTile, tileXYFromGXY(gx,gy), pieceColor);
  require('./encirclement').encirclement(gx, gy, pieceColor);
  eventEmitter.emit('piecePlaced', gx, gy, pieceColor, tileId); // bigbang listens to this for saving

  return mapTile;
}

function tileXYFromGXY(gx, gy) {
  var x = gx%config.tileWidth;
  var y = gy%config.tileHeight;
  if (x < 0) x = config.tileWidth + x;
  if (y < 0) y = config.tileHeight + y;
  return {x: x, y: y}
}

function isCosmicBackgroundRadiation(cell) {
  return (cell.color == config.emptyCellColor);
}

// global x,y converted to tileID coords
function tileIdFromXY(x,y) {
  return  "x" + Math.floor(x/config.tileWidth)*config.tileWidth + 
          "y" + Math.floor(y/config.tileHeight)*config.tileHeight;
}

// global x,y coordinates
function getTileFromXY(x,y) {
  return readMapTile(tileIdFromXY(x,y));
}

function getCell(x,y) {
  var tile = getTileFromXY(x,y);
  var localXY = tileXYFromGXY(x,y);
  return tile.cells[localXY.x][localXY.y];
}

/////////////////////////////////////////////////////
//        DataBase Oriented Map Tile Stuff         //
/////////////////////////////////////////////////////

function readMapTileDB(x,y) {
  var deferred = Q.defer();
  var dbGetObject = {
    Key:
    {
      'MapTileId': {'S': 'x' + x + 'y' + y}
    },
  
    TableName: config.CROSSCUT_MAPTILE_TABLE
  }

  db.getItem(dbGetObject, function(err,data) {
    var mapTile = {};
    if (err) {
      console.log('Error db.getting map tile: ' + err);
    } else if (!('Item' in data)) {
      console.log('got no tile in rmt() at x,y: ' + x + ',' + y + ', creating an empty one'); // 55555
      mapTile = createEmptyMapTile(x,y);
    } else {
      // for occasional debugging -- as of v1051 a map tile was "roughly" 7724 bytes
      //                          -- as of v1151 a map tile was "roughly" 4132 bytes (just colors now, dropped x.y)
      // DynamoDB has a max return size of 64k
      //console.log('map tile object size: ' + utils.roughSizeOfObject(data));

      mapTile.id = data.Item.MapTileId.S;
      mapTile.updateTime = data.Item.UpdateTime.S;
      mapTile.cells = JSON.parse(data.Item.JsonTile.S);
    }
    deferred.resolve(mapTile);
  });
  return deferred.promise;
}

function writeMapTileDB(x, y, cellContents, callback) {
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
