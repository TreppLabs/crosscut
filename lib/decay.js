// exports
module.exports = {
  startRotter:    startRotter
}

var worldmap = require('./worldmap');


// how often we perform checks for cell decay
var DECAY_INTERVAL = 30000;
// life time of a cell (other factors may modify)
var CELL_LIFETIME = 3000000;  // 5 mins for debugging

function startRotter() {
  console.log('checking decay...');
  setInterval(cellRotter, DECAY_INTERVAL);
}

function cellRotter() {
  // look through worldmap, decaying cells
  // for first go, just expire the old ones.
  for (var x=0; x<10; x++) {
    for (var y=0; y<10; y++) {
      cell = worldmap.getCell(x,y);
      console.log('xy: ' + x + ',' + y + ', color: ' + cell.color);
    }
  }
}