// accretion.js

// the following should agree with values in server.js
var emptyCellColor = '#B99F67'

/// move to server
var c1 = '#78856D';
var c2 = '#9A772C';
var c3 = '#675B3F';
var c4 = '#766457';

var userColorChoice = c2;

// viewport settings
var lowerLeftX = 5;
var lowerLeftY = 5;
var topRightX = 25;
var topRightY = 18;

var timeOfLastServerUpdate = 1;  // *server* time -- what server tells us
var timeOfLastClientUpdate = 0; // also *server* time -- do we need this?  TODO

var POLLING_INTERVAL = 2000;

var loggedIn = false;

// set map size per window
$(document).ready(function(){
	initHandlers();
});

function initHandlers() {
	$(".mapcell").click(cellClick);
  $("#login").click(login);
  $("#xButton").click(updateLowX);
  $("#yButton").click(updateLowY);
  $("#cellsWideButton").click(updateCellsWide);
  $("#cellsHighButton").click(updateCellsHigh);
}

function updateLowX() {
  console.log('llx was: ' + lowerLeftX);
  lowerLeftX = parseInt($("#xInput").val());
  console.log('llx is: ' + lowerLeftX);
  initMap();
  resizeMap();
  initHandlers();
  updateMap();
}

function updateLowY() {
  console.log('lly was: ' + lowerLeftY);
  lowerLeftY = parseInt($("#yInput").val());
  console.log('lly was: ' + lowerLeftY);
  initMap();
  resizeMap();
  initHandlers();
  updateMap();
}

function updateCellsWide() {
  console.log('trx was: ' + topRightX);
  topRightX = lowerLeftX - 1 + parseInt($("#cellsWideInput").val());
  console.log('trx is: ' + topRightX);
  initMap();
  resizeMap();
  initHandlers();
  updateMap();
}

function updateCellsHigh() {
  console.log('try was: ' + topRightY);
  topRightY = lowerLeftY - 1 + parseInt($("#cellsHighInput").val());
  console.log('try was: ' + topRightY);
  initMap();
  resizeMap();
  initHandlers();
  updateMap();
}

function login() {
  // select user color
  var username = $("#username").val();

  // login and get the users color
  $.post("/login", {username: username, password: "blah"}, function (color) {
    userColorChoice = color;
    bang();
  });
}

function bang() {
  gondwanaland.start();

  if (window.location.hash != "#divs") {
    $("#gondwanaland").show();
    $("#mapTable").hide();
  } else {
    $("#mapTable").show();
    $("#dondwanaland").hide();
  }

  loggedIn = true;
  initMap();
  resizeMap();
  initHandlers();
  startUpdaterPoll(); // TODO: this can create multiple polls -- one per login in browser window
  updateMap();
}

$(window).resize(function() {
  //resizeMap();
}); 
 
// given the DOM structure of the map, make it fit nicely into container
function resizeMap() {
  if (window.location.hash == "#gondwanaland") return;
  
  var height = $(window).height();
  var width = $(window).width();
  var usableHeight = height*0.8;
  var usableWidth = width*0.95;
  var cellsHigh=topRightY-lowerLeftY+1;
  var cellsWide=topRightX-lowerLeftX+1;

  // is map size limited by height or width?
  var heightPerCell = usableHeight / cellsHigh;
  var widthPerCell = usableWidth / cellsWide;
  var mapContainerHeight, mapContainerWidth;
  if (heightPerCell > widthPerCell) {
    // width constrained
    mapContainerWidth = usableWidth;
    mapContainerHeight = usableWidth*(cellsHigh/cellsWide);
  } else {
    // height constrained
    mapContainerHeight = usableHeight;
    mapContainerWidth = usableHeight*(cellsWide/cellsHigh);
  }
  $('#mapContainer').width(mapContainerWidth);
  $('#mapContainer').height(mapContainerHeight);


  // size divs for map cells
  // width & height should be equal!
  var cellWidth = mapContainerWidth / cellsWide;
  var cellHeight = mapContainerHeight / cellsHigh;
  var cellBorder = 0.05 * cellWidth;
  $('.mapCell').css('border-radius', cellWidth*0.1);
  for (var y = topRightY; y >= lowerLeftY; y--) {
    for (var x = lowerLeftX; x <= topRightX; x++) {
      var cellId = 'mx' + x + "my" + y;
      var cell = $('#'+cellId);
      var xOffset = (x-lowerLeftX)*cellWidth;
      var yOffset = (y-lowerLeftY)*cellHeight;
      cell.height(cellHeight - 2*cellBorder);
      cell.width(cellWidth - 2*cellBorder);
      cell.css('left', xOffset + cellBorder);
      cell.css('bottom', yOffset + cellBorder);
    }
  }

}


// create DOM structure for map of given # cells
function initMap() {
  // clear the map
  $('#mapTable').empty();

  console.log('init-ing map: llx,y= ' + lowerLeftX + ',' + lowerLeftY);

  // set up divs for map cells
  for (var y = topRightY; y >= lowerLeftY; y--) {
    var mapRow = $("<div class='mapRow'>");
    for (var x = lowerLeftX; x <= topRightX; x++) {
      var id = 'mx' + x + "my" + y;
      mapRow.append("<div class='mapCell' id='"+id+"'/>");
    }
    $("#mapTable").append(mapRow);
  }
}

function cellClick() {
    var boxId = $(this).attr('id');
    var xPos = boxId.indexOf("mx");
    var yPos = boxId.indexOf("my");
    var cellX = boxId.substring(xPos+2, yPos);
    var cellY = boxId.substring(yPos+2);

    // make the color change immediate if the cell is empty
    // NOTE: THIS DOESN't WORK. color from css returned as rgb()
    console.log("Color of clicked cell >" + utils.rgb2hex($(this).css("background-color")) + "<");
    console.log("Color of empty cells >" + emptyCellColor +"<");
    
    if (utils.rgb2hex($(this).css("background-color")) != emptyCellColor) {
        return false;
    }

    console.log("ok to send to server so doing it locally");
    $(this).css("background-color", userColorChoice);

    // When this returns the update from the server will overwrite
    // TODO: the result of this call should include server updates
    $.post( "/clicker", {"cellX" : cellX, "cellY" : cellY, "color" : userColorChoice});
    return true;
}

// Last change to the whole map. I think this needs to be just the tile
function updateLastServerUpdateTime(done) {
    //$.post( "/getupdatetime", 'get update time', function(data) {
		//  timeOfLastServerUpdate = data;
		//  done && done();
    //});
}

// Request an updated region from the server
function updateMap() {
    //$.post( "/getmapregion", {
	//		"lowerLeftX" : lowerLeftX, 
	//		"lowerLeftY" : lowerLeftY, 
	//		"topRightX" : topRightX, 
//			"topRightY" : topRightY 
//		}, processMapTileList);
 //   console.log("Updated map received");
}

var tiles = {};
function processMapTileList(mapTileList) {
  return;
      var updateTime = 0;

      tiles = {};
  	// mapTile.id looks like x0yo  or x10y20 ... coords of lower left corner

  	for (i = 0; i<mapTileList.length; i++) {
	    var mapTile = mapTileList[i];
      tiles[mapTile.id] = mapTile; // for gondwanaland to access
	    // parse 2 integer values x,y id string that looks like this example: "x-70y30"
	    // those define lower left of tile in world coords
	    var tileX = parseInt(mapTile.id.substring(1,mapTile.id.indexOf("y")));
	    var tileY = parseInt(mapTile.id.substring(mapTile.id.indexOf("y")+1));

      // unlike server, client doesn't know tile size, so server tells us
      var tileWidth = parseInt(mapTile.tileWidth);
      var tileHeight = parseInt(mapTile.tileHeight);

	    if (mapTile.updateTime > updateTime) { 
	    	updateTime = mapTile.updateTime;
	    }
	    for (var x=0; x<tileWidth; x++) {
			for (var y=0; y<tileHeight; y++) {
				// only draw if visible on client
				var cellX = tileX + x;
				var cellY = tileY + y;
				if ((cellX >= lowerLeftX) && (cellX <= topRightX) && (cellY >= lowerLeftX) && (cellY <= topRightY)) {
				  var color = mapTile.cells[x][y].color;
				  var mapCellId = "#mx" + cellX + "my" + cellY;
				  $(mapCellId).css({backgroundColor: color});                        
			    }
			}
    	}
  	}              
  
  // server passes us the (server) time that the passed data was last updated
  // not fully accurate but we'll use the latest over all tiles
  console.log('after updating, updateTime was: ' + timeOfLastClientUpdate);
  if (updateTime > timeOfLastClientUpdate) {
    timeOfLastClientUpdate = updateTime;
    console.log('...client update time reset to: ' + updateTime);
  }

  gondwanaland.move(10,10);
}

// Periodically check for server side changes
function startUpdaterPoll(){
  // make sure we are logged in
  if (!loggedIn) return;

  updateLastServerUpdateTime(function() {
    if (timeOfLastServerUpdate > timeOfLastClientUpdate) {
      updateMap(); // TODO only update the region you are looking at
      timeOfLastClientUpdate = timeOfLastServerUpdate;
    } 
    setTimeout(startUpdaterPoll, POLLING_INTERVAL);    
  });
}
