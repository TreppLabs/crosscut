/* Welcome to Gondwanaland.
 *
 * The model here is to step thru every visible block in gondwanaland (on the canvas)
 * and find in memory its corresponding cell. If its there, the color is used. If its
 * not, then in the future we need to register with the server we are now interested
 * in it.
 *
 * A complication here is that canvas coords start in top left where as tile coords
 * start bottom left.
 */

"use strict";

// need to change this dynamicall!?
var tileWidth = 10;
var tileHeight = 10;

var CELL_W = 12; // px
var CELL_H = 10;

var MAX_ZOOM = 10;
var gondwanaland = (function() {
	var canvas = $("#gondwanaland")[0];
	var ctx = canvas.getContext("2d");

	var cHeight;
	var cWidth;

	// how many cells fit on the page?
	var cellsX = 0;
	var cellsY = 0;

	// where we are currently looking (units are accretions coords)
	var vx = 10;
	var vy = 10;

	// how much in or out are we looking (discrete levels only)
	var zoom ; // 1-5 - bigger the zoom level the less you see

	var me = {};

	// the set of tiles we are interested in (i.e., looking at) that the server
	// should give us updates about, periodically
	var aoi = {};

	// how big to draw a cell?
	var cellWidth;
	var cellHeight;

	function setZoom(level) {
		if (level <= 0) level = 0.5;
		if (level >= 1) level = Math.floor(level);
		if (level >= MAX_ZOOM) level = MAX_ZOOM;

		zoom = level;

		// how big to draw a cell?
		cellWidth = Math.ceil(CELL_W * zoom);
		cellHeight = Math.ceil(CELL_H * zoom);

		// how many cells fit on the page?
		cellsX = Math.ceil(cWidth/cellWidth);
		cellsY = Math.ceil(cHeight/cellHeight);
	}

	// x,y cell coords that should be in the middle of our screen
	function move(x,y) {
		// change the view point
		vx = x;
		vy = y;

		// indicate a draw is required (should set flag for framerate pick up)
		draw();

		// register all our new area of interest based on what was drawn
		server.registerAOI(aoi);
	}

	// Draw only the visible items on the list
	// Q: trigger this again when networking provides us with a new tile?
	// But what about if a single cell is changed, and its visible?
	// Maybe only draw the whole then when we move. Otherwise its spot changes only
	// Unless this is cheap enough.
	function draw(tileId) {
		// only update one tile if provided
		//if (tileId) {
		//	drawTile(tileId);
		//	return;
		//}
		// redraw the whole screen.
		ctx.clearRect(0,0,cWidth, cHeight);
		aoi = {};
		// step over each cell on the screen
		for (var a = 0; a < cellsX; a++) {
			for (var b = 0; b < cellsY; b++) {
				// get the accretion global coords (agc) based on our view port
				var gx = a + (vx - Math.floor(cellsX/2));
				var gy = b + (vy - Math.floor(cellsY/2));

				drawCell(a,b,gx,gy);
			}
		}
	}	

	function drawTile(id) {
		// how to work this out??
	}

	// Draw a cell on a square in our viewport. Oh.. and while we are at, make a list
	// of every tile id we come across and give that to the server as our AOI (area of
	// interest)
	function drawCell(a,b,x,y) {
		// get the tile
		var tileId = tileIdFromXY(x,y);
		var tile = tiles[tileId];
		var cxy = tileXYFromGXY(x,y);

		// record that we are drawing here, so need updates in the future
		aoi[tileId] = true; 

		if (!tile) { 
			outlineCell(a,b, "#22ff33");
			server.requestTileFromServer(tileId, draw);
		} else {
			fillCell(a,b, tile.cells[cxy.x][cxy.y].color);
		}					
	}

	function userMove(event) {
		var xy = utils.getClickPosition(event, canvas);

		// translate click position to gondandwanaland coords.
		var clickedX = Math.floor(xy.x / cellWidth);
		var clickedY = Math.floor((cHeight - xy.y)/ cellHeight); // flip the Y 

		console.log("X Y cell click ["+(xy.y/ cellHeight)+"] (" + xy.x+","+xy.y+ ") " + clickedX + "," + clickedY);

		// Locally change the color
		fillCell(clickedX, clickedY, userColorChoice);

		// Send click to the server (in accretion global coords)
		server.recordClick(clickedX + vx - Math.floor(cellsX/2), clickedY + vy - Math.floor(cellsY/2), userColorChoice, draw);   
	}


	// Draw a filled cell at viewport coordinates (in agc botom left = 0,0) 
	// hence we need to convert to canvas coord which are top left = 0,0
	function fillCell(x, y, color) {
		var border = 1; // px around each cell
		ctx.fillStyle = color;
		ctx.fillRect(x * cellWidth+border, cHeight-(y+1)*cellHeight+border, cellWidth-1, cellHeight-1);
	}

	function outlineCell(x,y,color) {
		ctx.strokeStyle = "#22ff33"; // the matrix style colors for cool effect. Or not.
		ctx.strokeRect(x * cellWidth, cHeight-(y+1)*cellHeight, cellWidth, cellHeight);		
	}

	/////////////////////////
	// stolen from the server. Find a way to reuse
	function tileXYFromGXY(gx, gy) {
	  var x = gx%tileWidth;
	  var y = gy%tileHeight;
	  if (x < 0) x = tileWidth + x;
	  if (y < 0) y = tileHeight + y;
	  return {x: x, y: y}
	}

	function tileIdFromXY(x,y) {
 		return  "x" + Math.floor(x/tileWidth)*tileWidth + 
        	"y" + Math.floor(y/tileHeight)*tileHeight;
	}
	///////////////////////// end stolen section

	// TODO: abstract this to an array of config.
	var shiftOn = false;
	window.addEventListener("keydown", function(e){
		var jump = 1;
		if (shiftOn) jump += 5;

		switch(e.keyCode)
		{
			case 37: // left arrow
				move(vx + jump, vy);
				break;
			case 38: // up arrow
				move(vx, vy-jump);
				break;
			case 39: // right arrow
				move(vx - jump, vy);
				break;
			case 40: // down arrow
				move(vx, vy+jump);
				break;
			case 90: // z - zoom
				var dir = shiftOn?-1:1;
				setZoom(zoom+dir);
				draw();
				break;
			case 16: // shift
				shiftOn = true;
				break;
		}
	}, false);

	window.addEventListener("keyup", function(e){
		switch(e.keyCode)
		{
			case 16: // key P pauses the game
				shiftOn = false;
				break;		
		}
	}, false);

	function resize() {
		cHeight = canvas.height = $("#mapContainer").height();
  		cWidth = canvas.width =  $("#mapContainer").width();

		// how many cells now fit on the page?
		setZoom(zoom);

  		draw();
	} 

	function init() {
		setZoom(2);
		//resize();
		$(window).trigger('resize');

		canvas.addEventListener("mousedown", userMove, false);
	}

	function start() {
		init();
	}

	$(window).resize(function() {
		resize();
	});
 
	me.move = move;
	me.start = start;

	return me;
})();
