// draw cypher

var art = require('./ascii_art');

var server = {
	token: "TTfsdqweqddfsdfEFRGzzZZZZr2rrreSF12D",
	server: "http://localhost:3000"
}

function stamp() {
	art.stampArt("./cypher/robot.txt", server, [0,300]);
	art.stampArt("./cypher/star_wars_logo.txt", server, [[-90,100], [-90, 30], [-90, -40]]);
	art.stampArt("./cypher/storm_trooper.txt", server, [[-150,90]]);
}

stamp();
