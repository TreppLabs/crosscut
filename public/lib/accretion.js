// accretion.js

// the following should agree with values in server.js
var emptyCellColor = '#B99F67'


////////

/// move to server
var c1 = '#78856D';
var c2 = '#9A772C';
var c3 = '#675B3F';
var c4 = '#766457';

var userColorChoice = c2;

// TODO make these client-side settable by user
var lowerLeftX = 5;
var lowerLeftY = 5;
var topRightX = 25;
var topRightY = 18;

var timeOfLastServerUpdate = 1;  // *server* time -- what server tells us
var timeOfLastClientUpdate = 0; // also *server* time -- do we need this?  TODO

var POLLING_INTERVAL = 2000;

var loggedIn = false;
/* not needed. Server setting

      $('.color-button').css('border', '5px solid transparent')
      $('#color1').css('background-color', c1);
      $('#color2').css('background-color', c2);
      $('#color3').css('background-color', c3);
      $('#color4').css('background-color', c4);
      $('#color1').click(function() {
        userColorChoice = c1;
        $('.color-button').css('border', '5px solid transparent')
        $('#color1').css('border', 'solid 5px black');
      });
      $('#color2').click(function() {
        userColorChoice = c2;
        $('.color-button').css('border', '5px solid transparent')
        $('#color2').css('border', 'solid 5px black');
      });
      $('#color3').click(function() {
        userColorChoice = c3;
        $('.color-button').css('border', '5px solid transparent')
        $('#color3').css('border', 'solid 5px black');
      });
      $('#color4').click(function() {
        userColorChoice = c4;
        $('.color-button').css('border', '5px solid transparent')
        $('#color4').css('border', 'solid 5px black');
      });
});
*/

// set map size per window
$(document).ready(function(){
	initHandlers();

});

function initHandlers() {
	$(".mapcell").click(cellClick);
  $("#login").click(login);
}

function login() {
  // select user color
  var username = $("#username").val();
  if (username == "jim") {
    userColorChoice = c1;
  } else if (username == "simon") {
    userColorChoice = c2;
  }  

  $("#mapContainer").show();
  loggedIn = true;
  initMap();
  resizeMap();
  initHandlers();
  startUpdaterPoll();
  updateMap();
}

$(window).resize(function() {
  resizeMap();
}); 
 

function resizeMap() {
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

function initMap() {
  // clear the map
  $('#mapTable').empty();

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
/*
div$("#signup").click(function() {
    $.post( "/signup", $("#signupForm").serialize(),
            function(data) {
              $("#signupSuccess").show();
            }
          )
          .error(function(xhr) {
            switch(xhr.status) {
              case 409:
                $("#signupDuplicate").show();
                break;
              default:
                $("#signupError").show();
            }
          })
          .always(function() {
            $("#signupModal").modal('hide');
          });
  })
})
*/



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
    $.post( "/getupdatetime", 'get update time', function(data) {
		  timeOfLastServerUpdate = data;
		  done && done();
    });
}

// Request an updated region from the server
function updateMap() {
    $.post( "/getmapregion", {
			"lowerLeftX" : lowerLeftX, 
			"lowerLeftY" : lowerLeftY, 
			"topRightX" : topRightX, 
			"topRightY" : topRightY 
		}, processMapTileList);
    console.log("Updated map received");
}

function processMapTileList(mapTileList) {
      var updateTime = 0;


  	// mapTile.id looks like x0yo  or x10y20 ... coords of lower left corner

  	for (i = 0; i<mapTileList.length; i++) {
	    var mapTile = mapTileList[i];
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
				  var color = mapTile.colors[x][y].color;
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
