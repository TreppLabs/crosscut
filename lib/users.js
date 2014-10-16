module.exports = {
	getUser: 	getUser,
	login: 		login,
	auth: 		isAuth
}

// TODO: MOVE TO READ FROM FILE
// replaced Simon's ugly color choices with "Flat Design Colors"
//  from http://www.pinterest.com/pin/221591244139705510/
// R G B          hex 
// 52 78 91       34  4E  5B  344E5B
// 74 178 157     4A  B2  9D  4AB29D 
// 238 200 87     EE  C8  57  EEC857
// 226 120 69     E2  78  45  E27845
// 222 92 78      DE  5C  4E  DE5C4E Jim
var users = {
	"jim":
	{
		"username": "jim",
		"realname": "Jim R.",
		"password": "ben",
		"color": 	"#DE5C4E",
		"token": 	"434h3DFXsdffs3423oisjfs"
	},
	"simon":
	{
		"username": "simon",
		"realname": "Simon R-A.",
		"password": "zak",
		"color": 	"#344E5B",
		"token": 	"DSFGSDfghjguk73SDfsGD13446uth"
	},
	"gabe":
	{
		"username": "gabe",
		"realname": "Gabe R-A",
		"password": "rj",
		"color": 	"#4AB29D",
		"token": 	"rrr2342323k4l2j3LKJLKJDFD"
	},
	"daniel":
	{
		"username": "daniel",
		"realname": "Daniel R.",
		"password": "dannycon",
		"color": 	"#F29865",
		"token": 	"ajgqwrlidf7727fh74537HDHVHS"
	},
	"r2d2":
	{
		"username": "r2d2",
		"realname": "R2D2",
		"password": "c3po",
		"color": 	"#EEC837",
		"token": 	"TTfsdqweqddfsdfEFRGzzZZZZr2rrreSF12D"
	}
}

function getUser(username) {
	return users[username];
}

// TODO: this needs to be faster... hash not cycle thru array
// UPDATE: this actually needs to be an algorithm to check the token is valid for the user
//		without hitting the database
function isAuth(req, res, next) {
	// get the token out of the request
	// NOTE: this is not where is should be. Put it in a header when I work out how! S-O-M
	var token = req.query.token;

	// find it user database
	for(var u in users) {
		if (users[u].token === token) {
			// todo: put the user into the request for down stream request users
			req.user = users[u];
			next();
			return;
		}
	}
	res.send(401);
}

function login(username, password) {
	var user = getUser(username);
	if (user && user.password === password) {
		return user;
	} 
	return false;
}