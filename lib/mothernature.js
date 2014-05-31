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

function getChanges(user) {
	if (!user || aois[user] == undefined) return null;

	var c = changes[user];
	changes[user] = {};
	// TODO: get the tiles from the worldmap and actually return them here
	return c;
}

// TODO: check the delta between the new aoi and the last. Anything thats
// different is the new place we've come into and we should just refresh
// the whole tile.
function registerAOI(user, aoi) {
	aois[user] = aoi;
	changes[user] = {};
}

// Record which tiles have changer per user interest
function recordChange(x,y,color,tileId) {
	// step through every user aoi and see if they are interested
	Object.keys(aois).forEach(function (user) {
		if (aois[user][tileId]) {
			changes[user][tileId] = true;
		}
	});
}

function startListeningToCells() {
	reset();
	//worldmap.worldEmitter.on("piecePlaced", recordChange);
}

function reset() {
	aois = {};
	changes = {};
}