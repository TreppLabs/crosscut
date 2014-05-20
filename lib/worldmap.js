/*
 *
 */
var AWS = require('aws-sdk');
var Q = require('q');
var utils = require('./utils');
var events      = require('events');

var eventEmitter = new events.EventEmitter();

"use strict";

// exports
module.exports = {
  setConfig:      setConfig,
  initWorld:      initWorld,
  readMapTile:    readMapTile,
  writeMapTile:   writeMapTile,
  theBigCrunch:   theBigCrunch,
  move:           move,
  worldEmitter:   eventEmitter,
  lastUpdateTime: lastUpdateTime,
  tileIdFromXY:   tileIdFromXY,
  tileXYFromGXY:  tileXYFromGXY,
  readMapTiles:   readMapTiles
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
  localMapTile = {};
  initWorld();
}

function lastUpdateTime() {
  return lastUpdateTime;
}

function initWorld() {
  var localMapTile = createEmptyLocalMapTile(0,0);
  localMapTileHash[localMapTile.id] = localMapTile;
}

function createEmptyLocalMapTile(tileId) {
  console.log('creating empty map tile, id: ' + tileId);
  var mapTile = {};
  var emptyColorArray = utils.createArray(config.tileWidth, config.tileHeight);
  for (var i=0; i<config.tileWidth; i++) {
    for (var j=0; j<config.tileHeight; j++) {
      emptyColorArray[i][j] = {"color": config.emptyCellColor};
    }
  }
  mapTile.id = tileId;
  mapTile.updateTime = '0';
  mapTile.colors = emptyColorArray;

  return mapTile;
}

// this is currently not used but close to working
/*
function createEmptyMapTile(x, y) {
  var mapTile = {};
  var emptyColorArray = utils.createArray(config.tileWidth, config.tileHeight);
  var tileId = 'x' + x + 'y' + y;
  for (var i=0; i<config.tileWidth; i++) {
    for (var j=0; j<config.tileHeight; j++) {
      emptyColorArray[i][j] = {"color": config.emptyCellColor};
    }
  }
  mapTile.id = tileId;
  mapTile.updateTime = '0';
  mapTile.colors = emptyColorArray;
  // TODO -- this makes us async so need to change places where we're called
  // worldmap.writeMapTile(x, y, mapTile.colors, function(){
  //  return mapTile;
  //});
}
*/


// Returns the tile based on the tileId. TileId is a string of the format "xnyn"
function readMapTile(tileId) {
  console.log('rmt(), reading: ' + tileId);
  if (localMapTileHash.hasOwnProperty(tileId)) {
    console.log('rmt(), found in hash: ' + tileId);
    return localMapTileHash[tileId];
  } else {
    console.log('rmt(), not in hash, creating empty: ' + tileId);
    var mapTile = createEmptyLocalMapTile(tileId);
    console.log('created; now storing empty map tile id: ' + tileId);
    localMapTileHash[tileId] = mapTile;
    return mapTile;
  }
}

// Updates the color of a single cell
//
// The tile its on is passed in.
// lx and ly are local coordinates on the tile (have been translated from the global x,y)
// TODO: Check if it has been updated since our data was read.  If so, complain but write anyway.
// TODO: consolidate other writes with this
function writeMapTile(tile, xy, color) {
  console.log("writing to cell " + xy.x + "," + xy.y + ": " + color);
  lastUpdateTime          = (new Date()).getTime();
  tile.colors[xy.x][xy.y] = {"color": color};
  tile.updateTime         = lastUpdateTime;
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

// is it ok to place "color" at x,y?
// if so, do it!
function move(gx, gy, pieceColor) {
  var tileId = tileIdFromXY(gx,gy);
  var mapTile = readMapTile(tileId);
  var xy = tileXYFromGXY(gx,gy);

  console.log("Move request (" + tileId + "): " + pieceColor);
  // check that the cell is empty space
  if (!isCosmicBackgroundRadiation(mapTile.colors[xy.x][xy.y])) {
    console.log("Already a color there. Doh. Can't click");
    return false;
  }
  console.log("all good, setting a new color");

  // save this move and check for encirclements, then tell the world
  writeMapTile(mapTile, tileXYFromGXY(gx,gy), pieceColor);
  require('./encirclement').encirclement(gx, gy, pieceColor);
  eventEmitter.emit('piecePlaced', gx, gy, pieceColor); // bigbang listens to this for saving

  return mapTile;
}

function tileXYFromGXY(gx, gy) {
  return {x: gx%config.tileWidth, y: gy%config.tileHeight}
}

function isCosmicBackgroundRadiation(cell) {
  return (cell.color == config.emptyCellColor);
}

// global x,y converted to tileID coords
function tileIdFromXY(x,y) {
  return  "x" + Math.floor(x/config.tileWidth)*config.tileWidth + 
          "y" + Math.floor(y/config.tileHeight)*config.tileHeight;
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
      mapTile.colors = JSON.parse(data.Item.JsonTile.S);
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
