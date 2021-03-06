//
// Rest API
//

var worldmap 	= require('./worldmap');
var users 		= require('./users');
var utils     = require('./utils');

module.exports = {
	configure: configure
}

function configure(app, config) {
	app.get("/tile/:id", users.auth, tile);
	app.post('/clicker', users.auth, clicker);
}

function tile(req, res) {
  var id = req.params.id;
  res.send(worldmap.readMapTile(id));
}

function clicker (req, res) {
  var cellX = parseInt(req.body.cellX);
  var cellY = parseInt(req.body.cellY);

  var color = req.user.color;

  console.log("CLICK: " + req.user.username + " color: " + color);

  // validate the arguments
  if (utils.isInteger(cellX) && utils.isInteger(cellY)) {
    res.send(worldmap.move(cellX, cellY, color));
  } else {
    send(400);
  }
}
