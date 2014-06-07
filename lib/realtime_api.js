// real time api

var mothernature 	= require('./mothernature');
var users 			= require('./users');

module.exports = {
	configure: configure
}

function configure(app, config) {
	app.post('/aoi', users.auth, aoi);
	app.get('/changes', users.auth, changes);
}

function aoi (req,res) {
	console.log("REGISTER AOI: " + req.user.username + " tile: " + req.body);
	mothernature.registerAOI(req.user.username, req.body);
	res.send(200);
}

// Get the changes to my area of interest
function changes(req, res) {
  var username = req.user.username
  console.log("CHANGES for " + username + "?");
  res.send(mothernature.getChanges(username));
}
