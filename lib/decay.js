// exports
module.exports = {
  setConfig:      setConfig,
  startRotter:    startRotter
}

var worldmap = require('./worldmap');


// how often we perform checks for cell decay
var DECAY_INTERVAL = 15000;
// life time of a cell (other factors may modify)
var CELL_LIFETIME = 3000000;  // 5 mins for debugging

var config = {};

function setConfig(globalConfig) {
  config = globalConfig;
}

function startRotter() {
  setInterval(cellRotter, DECAY_INTERVAL);
}

function cellRotter() {
  // look through worldmap, decaying cells
  // for first go, just expire the old ones.
  var boundingBox = worldmap.getActiveBoundingBox();
  console.log('rotting, world bbox = ' + boundingBox.xMin + ',' + boundingBox.yMin + ' ::: ' + boundingBox.xMax + ',' + boundingBox.yMax);
  var now = (new Date()).getTime();
  for (var x=boundingBox.xMin+1; x<boundingBox.xMax; x++) {
    for (var y=boundingBox.yMin+1; y<boundingBox.yMax; y++) {
      cell = worldmap.getCell(x,y);
      if (cell.color != config.emptyCellColor) {
        var exposure = 0;
        if (cell.color != worldmap.getCell(x+1,y).color) exposure += 1;
        if (cell.color != worldmap.getCell(x-1,y).color) exposure += 1;
        if (cell.color != worldmap.getCell(x,y+1).color) exposure += 1;
        if (cell.color != worldmap.getCell(x,y-1).color) exposure += 1;

        var age = now-cell.birthdate;

        cell.strength -= (5*exposure);  // for now, 10% regardless, every interval
        //console.log('rotter:: changed cell ' + x + ',' + y + ' strength to: ' + cell.strength);
        if (cell.strength <= 0) {
          worldmap.expire(x,y);
        } else {
          worldmap.updatePiece(x, y, cell);
        }
        //console.log('rotter:: post-update/expire cell ' + x + ',' + y + ' color now: ' + worldmap.getCell(x,y).color + ' strength now: ' + worldmap.getCell(x,y).strength);
      }
    }
  }
}