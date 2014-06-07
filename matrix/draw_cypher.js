// draw cypher

var art = require('./ascii_art');

var destination = {
	token: "rrr2342323k4l2j3LKJLKJDFD",
	server: "http://localhost:3000"
}

function stamp() {
	art.stampArt("./cypher/robot.txt", destination, [0,300]);
	art.stampArt("./cypher/star_wars_logo.txt", destination, [[-90,100], [-90, 30], [-90, -40]]);
	art.stampArt("./cypher/storm_trooper.txt", destination, [[-50,-200]]);
}

stamp();
