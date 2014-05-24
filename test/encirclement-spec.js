// encirclement testing
var worldmap = require('../lib/worldmap');
worldmap.setConfig({tileHeight: 10, tileWidth: 10});
	
describe("encirclement", function() {
	beforeEach(function() {
		worldmap.theBigCrunch();
	})
	it("encircle one in the middle of 4 mid tile", function() {
		worldmap.move(0,1,"#red");
		worldmap.move(1,0,"#red");
		worldmap.move(2,1,"#red");
		worldmap.move(1,2,"#red");
		expect(worldmap.getCell(1,1).color).toBe("#red");
	});
	// encircle across tile boundaries
	// encircle someone elses tile
});
