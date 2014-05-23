var utils = require('../lib/utils');

describe("create array", function() {
	it("should be size 1", function() {
		var arr = utils.createArray(1);
		expect(arr.length).toBe(1);
	});
	it("The zero case", function() {
		var arr = utils.createArray(0);
		expect(arr.length).toBe(0);
	});
	it("1d big", function() {
		var size = 1000000000;
		var arr = utils.createArray(size);
		expect(arr.length).toBe(size);
	});
	it("2d zero", function() {
		// a zero length array doesn't really make sense
		var arr = utils.createArray(0,0);
		expect(arr.length).toBe(0);
	});
	it("2d x 1", function() {
		// a zero length array doesn't really make sense
		var arr = utils.createArray(1,1);
		expect(arr.length).toBe(1);
		expect(arr[0].length).toBe(1);
		expect(arr[1]).toBe(undefined);
	});
});
