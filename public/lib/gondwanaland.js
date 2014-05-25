/* gondwanaland
 *
 * The model here is to step thru every visible block in gondwanaland (on the canvas)
 * and find in memory its corresponding cell. If its there, the color is used. If its
 * not, then in the future we need to register with the server we are now interested
 * in it.
 *
 * A complication here is that canvas coords start in top left where as tile coords
 * start bottom left.
 */

// need to change this!
var tileWidth = 10;
var tileHeight = 10;

var CELL_W = 12; // px
var CELL_H = 10;

var gondwanaland = (function() {
	var canvas = $("#gondwanaland")[0];
	var ctx = canvas.getContext("2d");

	var cHeight = canvas.height;
	var cWidth = canvas.width;

	// where we are looking (units are accretions coords)
	var vx = 10;
	var vy = 10;

	// how much in or out are we looking (discrete levels only)
	var zoom ; // 1-5 - bigger the zoom level the less you see

	setZoom(1);
	
	var me = {};

	// how big to draw a cell?
	var cellWidth;
	var cellHeight;

	function setZoom(level) {
		if (level==0) level = 1;
		zoom = level;

		// how big to draw a cell?
		cellWidth = CELL_W * zoom;
		cellHeight = CELL_H * zoom;
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
	function draw() {


		// how many cells fit on the page?
		var cellsX = cWidth/cellWidth;
		var cellsY = cHeight/cellHeight;

		var topLeftCellX = vx - Math.floor(cellsX/2);
		var topLeftCellY = vy + Math.floor(cellsY/2);

		ctx.clearRect(0,0,canvas.width, canvas.height);
		ctx.strokeStyle = "#22ff33";
     
		for (var a = 0; a < cellsX; a++) {
			for (var b = 0; b < cellsY; b++) {
				// get the global x,y from our view port
				gx = a + vx;
				gy = b + vy;

				drawCell(a,b,gx,gy);
			}
		}
	}	

	function drawCell(a,b,x,y) {
		// get the tile
		var tile = tiles[tileIdFromXY(x,y)];

		// get the local tile coords
		var cxy = tileXYFromGXY(x,y);

		if (!tile) { 
			ctx.strokeRect(a*cellWidth, b*cellHeight, cellWidth, cellHeight);
		} else {
			ctx.fillStyle = tile.colors[cxy.x][cxy.y].color;
			ctx.fillRect(a*cellWidth+1, b*cellHeight+1, cellWidth-1, cellHeight-1);
		}					
	}

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

	window.addEventListener("keydown", function(e){
		switch(e.keyCode)
		{
			case 37: // left arrow
				move(vx -1, vy);
				break;
			case 38: // up arrow
				move(vx, vy-1);
				break;
			case 39: // right arrow
				move(vx + 1, vy);
				break;
			case 40: // down arrow
				move(vx, vy+1);
				break;
			case 90: // zoom
				setZoom((zoom+1)%5);
				move(vx, vy);
				break;
		}
	}, false);

	window.addEventListener("keyup", function(e){
		switch(e.keyCode)
		{
			case 37: // left arrow
				Game.controls.left = false;
				break;
			case 38: // up arrow
				Game.controls.up = false;
				break;
			case 39: // right arrow
				Game.controls.right = false;
				break;
			case 40: // down arrow
				Game.controls.down = false;
				break;
			case 80: // key P pauses the game
				Game.togglePause();
				break;		
		}
	}, false);

	me.move = move;

	return me;
})();

