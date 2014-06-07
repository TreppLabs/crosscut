// server.js
'use strict'

var server = (function() {
	var me = {
		requestTileFromServer: 	requestTileFromServer,
		recordClick: 			recordClick,
		registerAOI:  			registerAOI,
		getChanges: 			getChanges,
		authenticate: 			authenticate
	}

	// The current outstanding requests to the server for tiles so we don't repeat.
	var serverRequestsInProgress = {};

	function tokenParam() {
		return "?token="+user.token;
	}

	function requestTileFromServer(id, callback) {
		// check there is not existing request
		if (serverRequestsInProgress[id]) return;

		// store the fact that we are requesting
		serverRequestsInProgress[id] = true;

		// make request
		$.get("/tile/"+id + tokenParam(), function(tile) {
			// clear the request in progress
			delete serverRequestsInProgress[id];
			tiles[id] = tile; // save it in our current database
			callback(id); // draw just that tile
		});
	}

	function recordClick(x,y, draw) {
		$.post( "/clicker" + tokenParam(), {"cellX" : x, "cellY" : y}, function(tile) {
			tiles[tile.id] = tile; // save it in our current database
		 	draw();
		});
	}	

	function registerAOI(aoi) {
		$.post("/aoi" + tokenParam(), aoi);
	}

	function getChanges(drawer) {
		$.get("/changes" + tokenParam(), function (changedTiles) {
			Object.keys(changedTiles).forEach(function(t) {
				var id = changedTiles[t].id;
				console.log("Got a changed tile from our AOI: " + id);
				tiles[id] = changedTiles[t];
				drawer(id);
			});
		});
	}

	function authenticate(username, password, callback) {		
		$.post("/authenticate", {username: username, password: password}, function (theUser) {
  			callback(theUser);
  		});
	}

	return me;
})();
