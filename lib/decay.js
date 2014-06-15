// exports
module.exports = {
  setConfig:      setConfig,
  startRotter:    startRotter
}

var worldmap = require('./worldmap');


var config = {};

function setConfig(globalConfig) {
  config = globalConfig;
}

function startRotter() {
  console.log('Starting Rotter...running every ' + config.decayInterval + ' msec');
  // for now, we decay 0-20% each hour 
  setInterval(cellRotter, config.decayInterval);
}

function cellRotter() {
  // look through worldmap, decaying cells
  // for first go, just expire the old ones.
  var boundingBox = worldmap.getActiveBoundingBox();
  console.log('rotting, world bbox = ' + boundingBox.xMin + ',' + boundingBox.yMin + ' ::: ' + boundingBox.xMax + ',' + boundingBox.yMax);
  var now = (new Date()).getTime();
  var rotted = 0;
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
        if (cell.strength <= 0) {
          worldmap.expire(x,y);
          rotted++;
        } else {
          worldmap.updatePiece(x, y, cell);
        }
      }
    }
  }
  console.log(rotted + " cells rotted this round.");
}