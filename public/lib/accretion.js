// accretion.js

// the following should agree with values in server.js


// login settings
var tileWidth  = 10;
var tileHeight = 10;

var emptyCellColor = '#B99F67'


////////

/// move to server
var c1 = '#78856D';
var c2 = '#9A772C';
var c3 = '#675B3F';
var c4 = '#766457';

var userColorChoice = c2;

// TODO make these client-side settable by user
var lowerLeftX = 0;
var lowerLeftY = 0;
var topRightX = 9;
var topRightY = 9;

var timeOfLastServerUpdate = 1;  // *server* time -- what server tells us
var timeOfLastClientUpdate = 0; // also *server* time -- do we need this?  TODO

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
  initHandlers();
  startUpdaterPoll();
  updateMap();
}

function initMap() {
  // clear the map
  $('#mapTable').empty();

  var height = $(window).height();
  $('#mapContainer').width(height*0.8); 
  $('#mapContainer').height(height*0.8); 

// set up divs for map cells
  for (var y = topRightY; y >= lowerLeftY; y--) {
    var mapRow = $("<div class='mapRow'>");
    for (var x = lowerLeftX; x <= topRightX; x++) {
      var id = 'mx' + x + "my" + y;
      var xOffset = x*10 + '%';
      var yOffset = y*10 + '%';
      mapRow.append("<div class='mapCell' id='"+id+"' style='left:"+xOffset+"; bottom:"+yOffset+"'/>");
      
      //$('#'+id).css('bottom', yOffset);
      //$('#'+id).css('left', xOffset);
      //console.log('can we print css for div?' + $('#'+id).css());

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
    $.post( "/clicker", {"cellX" : cellX, "cellY" : cellY, "color" : userColorChoice},
        function(data) {
	    }
	);
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
}

function processMapTileList(mapTileList) {
	console.log('got this many maptiles: ' + mapTileList.length);
      var updateTime = 0;


  	// mapTile.id looks like x0yo  or x10y20 ... coords of lower left corner

  	for (i = 0; i<mapTileList.length; i++) {
	    var mapTile = mapTileList[i];
	    // parse 2 integer values x,y id string that looks like this example: "x-70y30"
	    // those define lower left of tile in world coords
	    var tileX = parseInt(mapTile.id.substring(1,mapTile.id.indexOf("y")));
	    var tileY = parseInt(mapTile.id.substring(mapTile.id.indexOf("y")+1));

	    if (mapTile.updateTime > updateTime) { 
	    	updateTime = mapTile.updateTime;
	    }
	    console.log('Parsing tile LL: ' + tileX + ',' + tileY + ', updateTime: ' + updateTime);
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
    setTimeout(startUpdaterPoll,1000);    
  });
}

// update map when document loads and anytime cell is clicked
// and start polling

// retrieve status from server
/*
$.post("/status", 'Status Request',
      function(data) {
          $("#statusMessage").html(data);
          $("#statusMessage").show();
      })
})
});
*/
//updateMap();