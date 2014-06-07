//
// Random Walker.
//

var accretionSDK = require('../accretion_sdk');
var token = "TTfsdqweqddfsdfEFRGzzZZZZr2rrreSF12D";

var x = Math.floor(Math.random()*100) - 50;
var y = Math.floor(Math.random()*100) - 50;

function drawOneCell() {
	x += Math.floor(Math.random()*3) -1;
	y += Math.floor(Math.random()*3) -1;

	accretionSDK.click(x,y);
	console.log("WalkerBot(tm) walked to " + x + " " + y);
}

accretionSDK.init("http://localhost:3000", token);
setInterval(drawOneCell, 2000);