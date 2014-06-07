//
// Loads files of ascii art and returns an object with the lines.
// 

var rest			= require('restler');
var fs 				= require('fs');
var readline 		= require("readline");

module.exports = {
	stampArt: stampArt
}

// locations = [[x,y], [x1,y1], ...]
function stampArt(filename, token, locations) {
	loadArt(filename, function(art) {
		for (var l in locations) {
			draw(art, token, locations[l]);
		}
	});
}

function draw(art, token, xy) {
	console.log("Drawing art at " + xy[0] + "," + xy[1])
	for (var l = 0; l < art.lines.length; l++) {
		for (var c = 0; c < art.lines[l].length; c++) {
			var char = art.lines[l][c];
			if (char != " ") {
				click(xy[0]+c, xy[1]-l, token);
			}
		}
	}
}

// Call the server
function click(x,y,token) {
	console.log("x,y,t: " + x + "," + y + ", " + token);
	rest.post('http://localhost:3000/clicker?token=' + token, {data: 
		{"cellX" : x, "cellY" : y}
	}).on('complete', function(result) {
		if (result instanceof Error) {
			console.log('Error:', result.message);
		} else {
			console.log(result);
		}
	});	
}

function loadArt(fileName, callback) {
	var lines = [];
	var asciiFile = {
		lines: lines
	}

	var file = fs.createReadStream(fileName);
	file.on('error', function(err) { 
		console.log("Couldn't load ascii art from " + fileName);
		return;
	});

	var line = 0;
	readline.createInterface({
    	input: file,
    	terminal: false
	}).on("line", function(artline){
		lines[line++] = artline;
	}).on("close", function() {
		callback(asciiFile);
	});
}