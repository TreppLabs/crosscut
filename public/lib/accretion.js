// accretion.js

// the following should agree with values in server.js
var emptyCellColor = '#B99F67'
var userColorChoice;
var POLLING_INTERVAL = 10000;
var loggedIn = false;
var tiles = {};

// set map size per window
$(document).ready(function(){
	initHandlers();
});

function initHandlers() {
	$("#login").click(login);
}

function login() {
  // select user color
  var username = $("#username").val();
  var password = $("#password").val();

  // login and get the users color
  // TODO: get more info from server (e.g., empty color and more user details)
  $.post("/login", {username: username, password: password}, function (user) {
    userColorChoice = user.color;
    loggedIn = true;
    bang();
  });
}

// Kick off the world
function bang() {
  gondwanaland.init();
  $("#gondwanaland").show();
  
  setInterval(getCellUpdates, POLLING_INTERVAL);
}

// Move to socket.io soon
function getCellUpdates() {
  if (!loggedIn) return;
  server.getChanges(gondwanaland.draw);
}
