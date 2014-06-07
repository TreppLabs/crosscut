//
// Accretion Node SDK
//
var rest = require('restler');

module.exports = {
	init: 	init,
	click: 	click
}

var serverUrl;
var token;

function init(server, theToken) {
	serverUrl = server;
	token = theToken;
}

// Call the server for a click
function click(x,y) {
	console.log("x,y,t: " + x + "," + y + ", " + token);
	rest.post('http://localhost:3000/clicker?token=' + token, { data: 
			{"cellX" : x, "cellY" : y}
		}).on('complete', function(result) {
		if (result instanceof Error) {
			console.log('Error:', result.message);
		} 
	});	
}
