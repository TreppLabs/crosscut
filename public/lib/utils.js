var utils = (function() {
	var me = {
		rgb2hex: 			rgb2hex,
		getClickPosition: 	getCanvasClickPosition
	}

	// http://stackoverflow.com/questions/1740700/how-to-get-hex-color-value-rather-than-rgb-value
	function rgb2hex(rgb) {
	    rgb = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
	    function hex(x) {
	        return ("0" + parseInt(x).toString(16)).slice(-2).toUpperCase();
	    }
	    return "#" + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3]);
	}

	// code found on stack exchange.
	function getCanvasClickPosition(event, canvas) {
        var x = new Number();
        var y = new Number();

        if (event.x != undefined && event.y != undefined) {
			x = event.x;
			y = event.y;
	    } else {// Firefox method to get the position
          x = event.clientX + document.body.scrollLeft +
              document.documentElement.scrollLeft;
          y = event.clientY + document.body.scrollTop +
              document.documentElement.scrollTop;
        }

        x -= canvas.offsetLeft;
        y -= canvas.offsetTop;

        // This is a little extra that is needed. At least for chrome & Safari on mac.
        // It makes it relative to the scroll position of the window. No idea why.
        // TODO: test in other browsers! Especially on Windows.
        var rect = canvas.getBoundingClientRect();
  		x -= rect.left;
  		y -= rect.top;

        return {x:x,y:y}
	}

	return me;
}());