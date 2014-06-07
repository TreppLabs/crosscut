/*
 *  worldmap.js
 *
 *  maintain / persist the view of the world , provide read/write access
 *  perhaps maptiles should not be visible outside
 */
"use strict";

var Q             = require('q');
var utils         = require('./utils');
var events        = require('events');
var eventEmitter  = new events.EventEmitter();
var Cell          = require('./cell');

// exports
module.exports = {
  setConfig:      setConfig,
  readMapTile:    readMapTile,
  writeMapTile:   writeMapTile,
  theBigCrunch:   theBigCrunch,
  move:           move,
  expire:         expire,
  updatePiece:    updatePiece,
  worldEmitter:   eventEmitter,
  lastUpdateTime: lastUpdateTime,
  tileIdFromXY:   tileIdFromXY,
  tileXYFromGXY:  tileXYFromGXY,
  readMapTiles:   readMapTiles,
  getTileFromXY:  getTileFromXY,
  getCell:        getCell,
  getActiveBoundingBox: getActiveBoundingBox,
  globalXYFromTileId:  globalXYFromTileId,
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

// This can be used to search the "entire active world"
// Note that it could include significant empty areas or areas that have become empty
function getActiveBoundingBox() {
  var xMin=Number.MAX_VALUE, yMin=Number.MAX_VALUE, xMax=Number.MIN_VALUE, yMax=Number.MIN_VALUE;
  for(var key in localMapTileHash){
    var xy = globalXYFromTileId(key);
    if (xy.x < xMin) xMin = xy.x;
    if (xy.y < yMin) yMin = xy.y;

    var tileXMax = xy.x+config.tileWidth-1;
    var tileYMax = xy.y+config.tileHeight-1;
    if (tileXMax > xMax) xMax = tileXMax;
    if (tileYMax > yMax) yMax = tileYMax;
  }
  return {xMin: xMin, yMin: yMin, xMax: xMax, yMax: yMax};
}


// Returns the tile based on the tileId. TileId is a string of the format "xnyn"
function readMapTile(tileId) {
  if (localMapTileHash.hasOwnProperty(tileId)) {
    return localMapTileHash[tileId];
  } 

  var mapTile = createEmptyLocalMapTile(tileId);
  localMapTileHash[tileId] = mapTile;

  return mapTile;
}

function createEmptyCell() {
  var cell = new Cell();
  cell.birthdate = 0;
  cell.color = config.emptyCellColor;
  cell.strength = 0;
  return cell;
}

// Updates a single cell -- 
//
// The tile its on is passed in.
// lx and ly are local coordinates on the tile (have been translated from the global x,y)
// 
// assume all game logic has been applied -- we may be updating, overwriting, or emptying a cell
function writeMapTile(tile, xy, cell) {
  if (cell==null) {
    // delete anything in the cell , for instance, delete the piece
    cell = createEmptyCell();
  }
  tile.cells[xy.x][xy.y] = cell;
  lastUpdateTime         = (new Date()).getTime();
  tile.updateTime        = lastUpdateTime;
}

// Takes a global x, y position and converts it before saving
function writeMapTileGlobal(xy, color) {
  var cell = new Cell(color, (new Date()).getTime(), config.startingCellStrength);
  var tile = getTileFromXY(xy.x, xy.y);
  var lxy = tileXYFromGXY(xy.x, xy.y);
  writeMapTile(tile, lxy, cell);
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

  writeMapTile(mapTile, xy, createEmptyCell());
  eventEmitter.emit('pieceExpired', gx, gy, "", tileId);  // not yet used

//  console.log('in expire(), did wmt(), now color: ' + getCell(gx,gy).color);

  return mapTile;
}

// update strength or other properties of existing cell
function updatePiece(gx, gy, cell) {
  var tileId = tileIdFromXY(gx,gy);
  var mapTile = readMapTile(tileId);
  var xy = tileXYFromGXY(gx,gy);

  writeMapTile(mapTile, tileXYFromGXY(gx,gy), cell);

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

  var birthdate = (new Date()).getTime();
  var cell = new Cell(pieceColor, birthdate, config.startingCellStrength)

  // save this move and check for encirclements, then tell the world
  writeMapTile(mapTile, tileXYFromGXY(gx,gy), cell);
  require('./encirclement').encirclement(gx, gy, pieceColor);
  eventEmitter.emit('piecePlaced', gx, gy, pieceColor, tileId); // bigbang listens to this for saving

  return mapTile;
}

// return coords of tile's lower left corner
function globalXYFromTileId(tileId) {
  // parse 2 integer values x,y id string that looks like this example: "x-70y30"
  // those define lower left of tile in world coords
  var tileX = parseInt(tileId.substring(1,tileId.indexOf("y")));
  var tileY = parseInt(tileId.substring(tileId.indexOf("y")+1));
  return {x:tileX, y:tileY};
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
