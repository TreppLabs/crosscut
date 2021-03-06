// accretion.js

// global variable
var user;
var emptyCellColor = '#B99F67'
var userColorChoice;
var MAX_POLLING_INTERVAL = 10000;
var loggedIn = false;
var tiles = {};

// set map size per window
$(document).ready(function(){
	initHandlers();
   $('#password').focus();
});

function initHandlers() {
	$("#login").click(login);
  $('#password').keypress(function(e) { if(e.which == 13) { $('#login').trigger('click') }});
}

function login() {
  var username = $("#username").val();
  var password = $("#password").val();

  server.authenticate(username, password, function (theUser) {
    user = theUser;
    if (user != false) {
      $(".loginstrip").hide();
      //$(".scorestrip").show();
      userColorChoice = user.color;
      loggedIn = true;
      bang();
    }
  });
}

// Kick off the world
function bang() {
  gondwanaland.init();
  $("#gondwanaland").show();
  $("#gondwanaland").focus(); // for keypresses to work

  // listen to the server for cell chnages, periodically
  //setInterval(getCellUpdates, POLLING_INTERVAL);
  getCellUpdates();
}

// Move to socket.io soon
var pollingInterval = 1000;
function getCellUpdates() {
  if (!loggedIn) return;

  server.getChanges(function(changedTiles) {
    for(var t in changedTiles) {
      tiles[t] = changedTiles[t];
      gondwanaland.draw(t);
    }
    if (Object.keys(changedTiles).length > 0) {
      pollingInterval = 1000;  
      getCellUpdates();
    } else {
      pollingInterval *=2;
      if (pollingInterval > MAX_POLLING_INTERVAL) pollingInterval = MAX_POLLING_INTERVAL;
      setTimeout(getCellUpdates, pollingInterval);
    } 
  });
}
