// worldmap testing
var worldmap = require('../lib/worldmap');
worldmap.setConfig({tileHeight: 10, tileWidth: 10});
	
describe("worldmap", function() {
	it("move 0x0", function() {
		var move = worldmap.move(0,0,"#red");
		var cell = worldmap.getCell(0,0);
		expect(cell.color).toBe("#red");
		expect(move).not.toBe(false);
	});
	it("same cell twice", function() {
		var move1 = worldmap.move(0,0,"#red");
		var move2 = worldmap.move(0,0,"#blue");
		expect(move2).toBe(false);
		
		var cell = worldmap.getCell(0,0);
		expect(cell.color).toBe("#red");
		
	});
});
