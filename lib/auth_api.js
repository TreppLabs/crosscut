// 
// Auth
//
// Will become the oAuth server.
'use strict'

var users = require('./users');

module.exports = {
	configure: configure
}

function configure(app) {
  app.post('/authenticate', auth);	
}

// Get a token to use with the API given a valid username and password. These
// will ultimately be oAuth tokens, but just putting in a rough solution for now.
function auth (req,res) {
  var username = req.body.username;
  var password = req.body.password;

  var user = users.login(username, password);
  if (user != false)  {  
    console.log("Login good for: " + username + " -> " + password);

    res.send({
      token:    user.token,
      realname: user.realname,
      color:    user.color
    }); 
  } else {
    console.log("Invalid username or password: " + username + " -> " + password);
    res.send(403);
  }
}

