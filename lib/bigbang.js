/* 
 * Bigbang - store and re-create the universe from nothing.
 */
var fs 				= require('fs');
var readline 		= require("readline");
var worldmap 		= require('./worldmap');

var DEFAULT_FILE 	= "bigbang.json";
var WRITE_INTERVAL	= 5000;
var changes 		= [];

module.exports = {
	recordChange: 	recordChange,
	loadWorld: 		loadWorld
}

function recordChange(x,y,color) {
	console.log("bigband: recording a change: " + x + ',' + y + ', color: ' + color);
	changes.push({
		x:x,
		y:y,
		color: color
	});
}

function loadWorld() {
	console.log("Bigbang loading...");
	worldmap.theBigCrunch();
	stopListeningToCells();
	
	var file = fs.createReadStream(DEFAULT_FILE);
	file.on('error', function(err) { 
		console.log("Couldn't load any existing universe of cells from " + DEFAULT_FILE);
		startListeningToCells();
		return;
	});

	readline.createInterface({
    	input: file,
    	terminal: false
	}).on("line", function(line){
		var cell = JSON.parse(line);
		worldmap.move(cell.x, cell.y, cell.color);
	}).on("close", function() {
		startListeningToCells();
		console.log("Bigbang loaded.");			
	});
}

function storeChanges() {
	if (changes.length > 0) {
		console.log("Bigbang: saving " + changes.length + " clicks.");

		// take a copy of the data
		var theChanges = changes;
		changes = [];

		// write to file (flag: appending)
		var file = fs.createWriteStream(DEFAULT_FILE,  {'flags': 'a'});
		file.once("open", function() {
			theChanges.forEach(function (v) {
				file.write(JSON.stringify(v) + '\n');
			});	
			file.end();		
		})
		file.on('error', function(err) { console.log("error writing file ") + err });
	}
}

function startWriting() {
	// listen to changes on the world
	startListeningToCells();
	setInterval(storeChanges, WRITE_INTERVAL);
}

function startListeningToCells() {
	worldmap.worldEmitter.on("piecePlaced", recordChange);
}

function stopListeningToCells() {
	worldmap.worldEmitter.removeListener("piecePlaced", recordChange);
}

startWriting();