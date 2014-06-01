// server.js

var server = (function() {
	var me = {
		requestTileFromServer: 	requestTileFromServer,
		recordClick: 			recordClick,
		registerAOI:  			registerAOI,
		getChanges: 			getChanges
	}

	// The current outstanding requests to the server for tiles so we don't repeat.
	var serverRequestsInProgress = {};

	function requestTileFromServer(id, callback) {
		// check there is not existing request
		if (serverRequestsInProgress[id]) return;

		// store the fact that we are requesting
		serverRequestsInProgress[id] = true;

		// make request
		$.get("/tile/"+id, function(tile) {
			// clear the request in progress
			delete serverRequestsInProgress[id];
			tiles[id] = tile; // save it in our current database
			callback(id); // draw just that tile
		});
	}

	function recordClick(x,y, draw) {
		$.post( "/clicker", {"cellX" : x, "cellY" : y}, function(tile) {
			tiles[tile.id] = tile; // save it in our current database
		 	draw();
		});
	}	

	function registerAOI(aoi) {
		$.post("/aoi", aoi);
	}

	function getChanges(callback) {
		
		// DO NOTHING FOR DEBUGGING
		return;

		$.get("/changes", function (tiles) {
			Object.keys(tiles).forEach(function(t) {
				console.log("Got a tile from our AOI: " + t.id);
				tiles[i.id] = t;
			});
		});
	}

	return me;
})();
