// server.js

var server = (function() {
	var me = {
		requestTileFromServer: 	requestTileFromServer,
		recordClick: 			recordClick,
		registerAOI:  			registerAOI
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
			// clear the request
			delete serverRequestsInProgress[id];
			tiles[id] = tile; // save it in our current database
			callback(tile);
		});
	}

	// TODO: color should be in a server side session
	function recordClick(x,y, callback) {
		$.post( "/clicker", {"cellX" : x, "cellY" : y}, function(tile) {
			tiles[tile.id] = tile; // save it in our current database
		 	callback();
		});
	}	

	function registerAOI(aoi) {
		$.post("/aoi", aoi);
	}

	return me;
})();
