//
// Random Walker.
//

var accretionSDK = require('../accretion_sdk');
var config = require('../config.json');

var x = Math.floor(Math.random()*200) - 100;
var y = Math.floor(Math.random()*200) - 100;

function drawOneCell() {
	x += Math.floor(Math.random()*3) -1;
	y += Math.floor(Math.random()*3) -1;

	accretionSDK.click(x,y);
	console.log("WalkerBot(tm) walked to " + x + " " + y);
}

accretionSDK.init(config.server, config.token);
setInterval(drawOneCell, 200);