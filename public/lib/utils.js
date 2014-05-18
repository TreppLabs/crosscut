var utils = (function() {
	var me = {
		rgb2hex: rgb2hex
	}

	// http://stackoverflow.com/questions/1740700/how-to-get-hex-color-value-rather-than-rgb-value
	function rgb2hex(rgb) {
	    rgb = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
	    function hex(x) {
	        return ("0" + parseInt(x).toString(16)).slice(-2).toUpperCase();
	    }
	    return "#" + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3]);
	}

	return me;
}());