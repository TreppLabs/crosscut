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
  lastUpdateTime: lastUpdateTime
}

// Time of last global map update
// Caveats:
//   for now this is just approximate, should be generated in DB txn 
//   for now this is "global" for map.  should be on per-tile basis
//   click on player's own piece is counted as "update" , though only changes click-count
var lastUpdateTime = (new Date()).getTime();

var localMapTile = {}; // The world map storage
var config = {};

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
  localMapTile.colors = utils.createArray(config.tileWidth, config.tileHeight); 
  localMapTile.id='x0y0';
  localMapTile.updateTime = 0;
  for (var x=0;x<config.tileWidth;x++) {
    for (var y=0;y<config.tileHeight;y++) {
      localMapTile.colors[x][y] = {color: config.emptyCellColor}
    }
  }
}

// this is currently not used but close to working
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


// async tile read -- returns promise so can be called in parallel
// x,y are world coords of lower left corner of tile
function readMapTile(x, y) {
  var deferred = Q.defer();

  if (config.localMode) {
    // NOte: x and y are ignored in local mode for now. There is only one
    // tile map 10x10 in size 
    deferred.resolve(localMapTile);
    return deferred.promise;
  }

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


// Write single map tile to database.
// lower left corner at x,y
// TODO: Check if it has been updated since our data was read.  If so, complain but write anyway.
// TODO: consolidate other writes with this
function writeMapTile(x, y, cellContents, callback) {
  var updateTime = (new Date()).getTime();
  lastUpdateTime = updateTime;

  if (config.localMode) {
    localMapTile.colors = cellContents;
    localMapTile.updateTime = updateTime;
    callback();
    return;
  }

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

// is it ok to place "color" at x,y?
// if so, do it!
function move(x, y, pieceColor) {
  var lowerLeftX = Math.floor(x/config.tileWidth)*config.tileWidth;
  var lowerLeftY = Math.floor(y/config.tileHeight)*config.tileHeight;

  console.log("Client click request (" + x + "," + y + "): " + pieceColor);

  readMapTile(lowerLeftX, lowerLeftY).then(function(mapTile) {
    if (!isCosmicBackgroundRadiation(mapTile.colors[x][y])) {
      console.log("Already a color there. Doh. Can't click");
      return;
    }

    console.log("all good, setting a new color");
    
    mapTile.colors[x][y].color = pieceColor;
    writeMapTile(lowerLeftX, lowerLeftY, mapTile.colors, function() {
      // new piece placed successfully
      // trigger anything else that needs doing
      lastUpdateTime = (new Date()).getTime();
      eventEmitter.emit('piecePlaced', x, y, pieceColor);
    });
  }).fail(function(err) {
     console.log('error1 reading map tile: ' + err);
  }).done();
}

function isCosmicBackgroundRadiation(cell) {
  return (cell.color == config.emptyCellColor);
}

