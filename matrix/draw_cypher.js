// draw cypher

var art = require('./ascii_art');

var token = "rrr2342323k4l2j3LKJLKJDFD";

function stamp() {
	art.stampArt("./cypher/robot.txt", token, [[10,10], [60, 100], [-20, -50]]);
	art.stampArt("./cypher/star_wars_logo.txt", token, [[-50,100]]);
	art.stampArt("./cypher/storm_trooper.txt", token, [[-50,-200]]);
}

stamp();
