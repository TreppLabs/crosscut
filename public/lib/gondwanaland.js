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
var MAX_ZOOM = 7; // 1-7
var INITIAL_ZOOM = 5;

var gondwanaland = (function() {
	var canvas = $("#gondwanaland")[0];
	var ctx = canvas.getContext("2d");

	// Constants
	var MATRIX_COLOR = "#22ff33";
	var EMPTY_COLOR = "#B99F67"; // should read from config
	var tileWidth = 10;
	var tileHeight = 10;
	var CELL_W = 12; // px
	var CELL_H = 12;

	// Variables

	// Canvas size
	var cHeight;
	var cWidth;

	// how many cells fit on the page?
	var cellsX = 0;
	var cellsY = 0;

	// The middle of where we are currently looking (units are accretions coords)
	var vx = 0;
	var vy = 0;

	// how much in or out are we looking (discrete levels only)
	var zoom ; // 1-5 - bigger the zoom level the less you see
	var zoomLevel; // internal use

	var me = {};

	// the set of tiles we are interested in (i.e., looking at) that the server
	// should give us updates about, periodically
	var aoi = {};

	// how big to draw a cell?
	var cellWidth;
	var cellHeight;

	function setZoom(level) {
		// bound the zoom limits
		zoom = level;
		if (level >= MAX_ZOOM) { zoom = MAX_ZOOM; }
		if (level < 1) { zoom = 1; }
		
		// convert the zoom to the internal zoom level magnifier
		if (zoom >= 6) { zoomLevel = zoom - 5; }
		else {
			zoomLevel = zoom/MAX_ZOOM;
		}

		// how big to draw a cell?
		cellWidth = Math.ceil(CELL_W * zoomLevel);
		cellHeight = Math.ceil(CELL_H * zoomLevel);

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

	}

	// Draw only the visible items on the list
	// Q: trigger this again when networking provides us with a new tile?
	// But what about if a single cell is changed, and its visible?
	// Maybe only draw the whole then when we move. Otherwise its spot changes only
	// Unless this is cheap enough.
	function draw(tileId) {
		// only update one tile if provided
		if (tileId) {
			drawTile(tileId);
			return;
		}

		// reset the area of interests
		var oldAoi = aoi;
		aoi = {};

		// redraw the whole screen.
		ctx.clearRect(0,0,cWidth, cHeight);

		// step over each cell on the screen
		for (var a = 0; a < cellsX; a++) {
			for (var b = 0; b < cellsY; b++) {
				// get the accretion global coords (agc) based on our view port
				var gx = a + (vx - Math.floor(cellsX/2));
				var gy = b + (vy - Math.floor(cellsY/2));

				drawCell(a,b,gx,gy);
			}
		}

		// register all our new area of interest based on what was drawn
		server.registerAOI(aoi);

		requestKnownTilesNewlyExposed(oldAoi, aoi);
	}	

	function requestKnownTilesNewlyExposed(oldAoi, newAoi) {
		for (var t in newAoi) {
			if (!oldAoi[t] && tiles[t]) { // in the new aoi, not in the old, and we have an old version of it
				server.requestTileFromServer(t, draw);
			}
		}
	}

	function dumpWorldAttributes() {
		console.log(" === world === ");
		console.log("Canvas width: " + cWidth);
		console.log("Canvas height: " + cHeight);
		console.log("Cell Width, Height: " + cellWidth + ","+ cellHeight);
		console.log("Tile Width, Height: " + tileWidth + ","+ tileHeight);
		console.log("Cells on view: " + cellsX + ","+ cellsY);
		console.log(" === world === ");
	}

	// Draw a single tile in the right place on the viewport
	function drawTile(id) {
		//dumpWorldAttributes();

		var gxy = getXYFromId(id);

		var viewX = gxy.x - vx + Math.floor(cellsX/2);
		var viewY = gxy.y - vy + Math.floor(cellsY/2);

		// fill the tile background with black
		ctx.clearRect(viewX*cellWidth, cHeight - (viewY+tileHeight)*cellHeight,tileWidth*cellWidth, tileHeight*cellHeight);

		// draw a red line around newly arrived tiles for debugging
		/*
		ctx.strokeStyle = "#ff3311"; 
		ctx.lineWidth=4;
		ctx.strokeRect(viewX*cellWidth, cHeight - (viewY+tileHeight)*cellHeight,tileWidth*cellWidth, tileHeight*cellHeight);		
		*/

		// draw each of the 10x10 tile cells
		for (var a = viewX; a < viewX+tileWidth; a++) {
			for (var b = viewY; b < viewY+tileHeight; b++) {
				drawCell(a,b,gxy.x+a-viewX, gxy.y+b-viewY);
			}
		} 
	}

	// convert "xNNNynnnnn" to NNN,nnnnn
	var re = /(-?\d+)y(-?\d+)/;
	function getXYFromId(id) {
		var rr = re.exec(id);
		var xy = {x: parseInt(rr[1]), y: parseInt(rr[2])}
		return xy;
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
			if (zoom > 2) outlineCell(a,b, MATRIX_COLOR);
			server.requestTileFromServer(tileId, draw);
		} else {
			var cellColor = tile.cells[cxy.x][cxy.y].color;
			if (cellColor == EMPTY_COLOR) {
				cellColor = randomScapeColor(x,y);
			}
			fillCell(a,b, cellColor);
		}					
	}

	function userMove(event) {
		var xy = utils.getClickPosition(event, canvas);

		// translate click position to gondandwanaland coords.
		var clickedX = Math.floor(xy.x / cellWidth);
		var clickedY = Math.floor((cHeight - xy.y)/ cellHeight); // flip the Y 

		//console.log("X Y cell click ["+(xy.y/ cellHeight)+"] (" + xy.x+","+xy.y+ ") " + clickedX + "," + clickedY);

		// Locally change the color
		fillCell(clickedX, clickedY, userColorChoice);

		// Send click to the server (in accretion global coords)
		server.recordClick(clickedX + vx - Math.floor(cellsX/2), clickedY + vy - Math.floor(cellsY/2), draw);   
	}

	// Draw a filled cell at viewport coordinates (in agc botom left = 0,0) 
	// hence we need to convert to canvas coord which are top left = 0,0
	function fillCell(x, y, color) {
		var border = 1; // px around each cell

		// no border when its really small
		if (zoom <= 4) border = 0;

		ctx.fillStyle = color;
		ctx.fillRect(x * cellWidth+border, cHeight-(y+1)*cellHeight+border, cellWidth-border, cellHeight-border);
	}

	function outlineCell(x,y,color) {
		ctx.lineWidth=1;
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
	

	function resize() {
		cHeight = canvas.height = $("#mapContainer").height();
  		cWidth = canvas.width =  $("#mapContainer").width();

		// how many cells now fit on the page?
		setZoom(zoom);

  		draw();
	} 

	function init() {
		setZoom(INITIAL_ZOOM);
		resize();

		canvas.addEventListener("mousedown", userMove, false);
		addKeypressListeners();
	}

	function unInit() {
		removeKeypressListeners();	
	}

	function addKeypressListeners() {
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
	}

	$(window).resize(function() {
		resize();
	});
 
	me.move = move;
	me.init = init;
	me.draw = draw;

	return me;
})();

// low-budget 'random' generator
// found this on Stack Overflow
var seed = 1;
function cheesyRandom() {
    var x = Math.sin(seed++) * 1000000;
    return x - Math.floor(x);
}

function r(i, j) {
	// random int between i, j
	return i + Math.floor(cheesyRandom()*((j-i)+1));
}

// generate a random sort-of-landscape
// 
// elevation between 0..100
//
// model is random hilly rectangles, combined
// can compute (x,y) height just from x,y
// [lots of recomputation at other x,y; could speed this up]
//
// height at (global) (x,y) is a combination of hills (& dents) each centered in 10x10 boxes
// we need to look at height contributions from neighboring 10x10 boxes which may overlap x,y
// so generate several hills in each of 9 boxes
// hills are rectangles, overlapping hills "add"
function randomScape(miniSeed, x, y) {
	var height = 0;
	var xmod = x % 10;
	var ymod = y % 10;
	if (xmod < 0) xmod += 10;
	if (ymod < 0) ymod += 10;
	var llx = x-xmod;
	var lly = y-ymod;
	for (var xx=llx-10; xx<=llx+10; xx+=10) {
		for (var yy=lly-10; yy<=lly+10; yy+=10) {
			seed = miniSeed + (xx * 100000) + yy;
			//console.log('for x,y: ' + x + ',' + y + ', doing box at ' + xx + ',' + yy);				
			//console.log('seed: ' + seed);
			// random rectangles in each 10x10, each centered at a random spot
			for (var i=0; i<8; i++) {
				// half vertically oriented, half horizontal:
				var rectHeight;
				var rectWidth;
				if (i%2 == 0) {
					rectWidth = r(3,8) + r(3,8);
					rectHeight =  r(1,5);
				} else {
					rectHeight = r(3,8) + r(3,8);
					rectWidth =  r(1,5);
				}
				var	rectCenterX = xx + r(0,9);
				var	rectCenterY = yy + r(0,9);
				var lowX = rectCenterX - Math.floor(rectWidth/2);
				var highX = lowX + rectWidth;
				var lowY = rectCenterY - Math.floor(rectHeight/2);
				var highY = lowY + rectHeight;
				//console.log('rect' + i + ' @ ' + lowX + ',' + lowY + ', w: ' + rectWidth + ', h: ' + rectHeight);
				// height contribution of rectangle is 10, except less around borders
				var heightIncrement = 0;
				if ((x>=lowX && x<=highX) && (y>=lowY && y<=highY)) {
					height += 14;
					// Following code is a way to "smooth" the rectangles' edges
					//heightIncrement += 10;
					//if (x==lowX || x==highX) {
					//	heightIncrement -= 4;
					//} else if (x==lowX+1 || x==highX-1) {
					//	heightIncrement -= 2;
					//}
					//if (y==lowY || y==highY) {
					//	heightIncrement -= 4;
					//} else if (y==lowY+1 || y==highY-1) {
					//	heightIncrement -= 2;
					//}
				}
				//height += heightIncrement;
			}
		}
	}
	if (height > 100) height = 100;
	return height;
}

function randomScapeColor(x,y) {
	//var EMPTY_COLOR = "#A1D4C4"; // should read from config
	//var r = 0xa1;
	//var g = 0xd4;
	//var b = 0xc4;
	// Scale smoothly from a semi-bright green at "sea level" to a darkish grey at peaks
	var EMPTY_COLOR = "#50E080"; // should read from config
	var PEAK_COLOR = "#707060";

	// decimal components of colors, above
	var r = 80;
	var g = 224;
	var b = 128;
	var rPeak = 112;
	var gPeak = 112;
	var bPeak = 96;

	var ht = randomScape(0, x, y);

	r = r + (ht / 100) * (rPeak-r);
	g = g + (ht / 100) * (gPeak-g);
	b = b + (ht / 100) * (bPeak-b);

	// trim just in case
	if (r > 255) r = 255;
	if (r < 0)   r = 0;
	if (g > 255) g = 255;
	if (g < 0)   g = 0;
	if (b > 255) b = 255;
	if (b < 0)   b = 0;

	var rgb = b | (g << 8) | (r << 16);
	return '#' + (0x1000000 | rgb).toString(16).substring(1)
}


