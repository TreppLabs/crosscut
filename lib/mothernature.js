// mothernature.js

// Responsibile for updating everyone about changes. Making sure they propagate.
// Right now the algorithm is fairly primative.
// Simply, it tiles that change in anyway to anyone who is interested whenever it can
// Very inneficient. won't scale to many users cause the server will get bogged down
// but is a good starting place
"use strict";

module.exports = {
	getChanges: 	getChanges,
	registerAOI: 	registerAOI,
	reset: 			reset,			// only for testing
	recordChange: 	recordChange, 	// exposed for testing
	grow: 			startListeningToCells
}

var worldmap 	= require('./worldmap');

var aois 		= {};
var changes 	= {};

// Get the tiles that have changes since the user indicated its aoi. After you
// get the changes, clear the list out for next time.
function getChanges(user) {
	if (!user || aois[user] == undefined) return null;

	var c = changes[user];
	changes[user] = {};
	
	return c;
}

// TODO: check the delta between the new aoi and the last. Anything thats
// different is the new place we've come into and we should just refresh
// the whole tile (although need to check time stamps). Also, anything 
// that is the same we want to keep because those are updates the user 
// needs to see. So its just the tiles that have left the AOI we want to 
// discard.
function registerAOI(user, aoi) {
	console.log("AOI Registered for " + user + ":: " + aoi);
	aois[user] = aoi;
	if (!changes[user]) changes[user] = {};
}

// Record which tiles have changer per user interest
function recordChange(x,y,color,tileId) {
	// step through every user aoi and see if they are interested
	Object.keys(aois).forEach(function (user) {
		if (aois[user][tileId]) {
			changes[user][tileId] = worldmap.readMapTile(tileId);
		}
	});
}

function startListeningToCells() {
	reset();
	worldmap.worldEmitter.on("piecePlaced", recordChange);
	worldmap.worldEmitter.on("pieceExpired", recordChange);
	worldmap.worldEmitter.on("pieceEncircled", recordChange);
}

function reset() {
	aois = {};
	changes = {};
}