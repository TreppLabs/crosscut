// worldmap testing
var worldmap = require('../lib/worldmap');
worldmap.setConfig({tileHeight: 10, tileWidth: 10});
	
describe("worldmap", function() {
	beforeEach(function() {
		worldmap.theBigCrunch();
	});
	it("move 0x0", function() {
		var cell = worldmap.getCell(0,0);		// get the cell color
		expect(cell.color).not.toBe("#red");	// its not red (its empty)
		var move = worldmap.move(0,0,"#red");	// click the cell to red
		cell = worldmap.getCell(0,0); 			// WHY DO I NEED TO DO THIS??!!? WHO IS OVERWRITING THIS
		expect(cell.color).toBe("#red");		// now it should be red
		expect(move).not.toBe(false);			// and should not have failed being set
	});

	it("move on non-empty location", function () {
		var cell = worldmap.getCell(0,0);		// get a cell
		expect(cell.color).not.toBe("#red");	// its not blue
		expect(cell.color).not.toBe("#blue");	// and its not red
		var move = worldmap.move(0,0,"#red");	// click it red
		expect(move).not.toBe(false);			// this should work
		cell = worldmap.getCell(0,0);			
		expect(cell.color).toBe("#red");		// and the cell should be red
		var move = worldmap.move(0,0,"#blue");	// try to make it blue
		expect(move).toBe(false);				// this should fail
		expect(cell.color).toBe("#red");		// and it should still be red
	})
});
