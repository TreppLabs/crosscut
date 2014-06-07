module.exports = {
	getUser: 	getUser,
	login: 		login,
	auth: 		isAuth
}

// TODO: MOVE TO READ FROM FILE
var users = {
	"jim":
	{
		"username": "jim",
		"realname": "Jim R.",
		"password": "ben",
		"color": 	"#ff22dd",
		"token": 	"434h3DFXsdffs3423oisjfs"
	},
	"simon":
	{
		"username": "simon",
		"realname": "Simon R-A.",
		"password": "zak",
		"color": 	"#55aa11",
		"token": 	"DSFGSDfghjguk73SDfsGD13446uth"
	},
	"gabe":
	{
		"username": "gabe",
		"realname": "Gabe R-A",
		"password": "rj",
		"color": 	"#eeee11",
		"token": 	"rrr2342323k4l2j3LKJLKJDFD"
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
		}
	}
	res.send(403);
}

function login(username, password) {
	var user = getUser(username);
	if (user && user.password === password) {
		return user;
	} 
	return false;
}