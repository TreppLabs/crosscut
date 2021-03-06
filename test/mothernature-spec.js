// test mothernature.js

// encirclement testing
var mothernature = require('../lib/mothernature');
	
describe("mothernature", function() {
	beforeEach(function() {
		mothernature.reset();
	});

	it("no changes for no user", function() {
		var changes = mothernature.getChanges(null);
		expect(changes).toBe(null);
	});

	it("no changes for unknown user", function() {
		var changes = mothernature.getChanges("blah");
		expect(changes).toBe(null);
	});

	it("register an empty aoi but make no changes", function() {
		mothernature.registerAOI("julie", {});
		var changes = mothernature.getChanges("julie");
		expect(Object.keys(changes).length).toBe(0);
	});

	it("pass in an aoi but not changes", function() {
		mothernature.registerAOI("julie", {});
		var changes = mothernature.getChanges("julie");
		expect(Object.keys(changes).length).toBe(0);
	});

	it("make a change", function() {
		mothernature.registerAOI("julie", {t12: true});
		mothernature.recordChange(1,2,"color", "t12");
		var changes = mothernature.getChanges("julie");

		expect(changes["t12"]).toBeDefined();
		expect(changes["xyz"]).toBeUndefined();
	});

	it("make two changes to same item, should be no different", function() {
		mothernature.registerAOI("julie", {t12: true});
		mothernature.recordChange(1,2,"color", "t12");
		mothernature.recordChange(1,2,"color", "t12");
		var changes = mothernature.getChanges("julie");

		expect(changes["t12"]).toBeDefined();
		expect(changes["xyz"]).toBeUndefined();
	});

	it("make 1 change with two AOIs", function() {
		mothernature.registerAOI("julie", {t12: true, t333: true});
		mothernature.recordChange(1,2,"color", "t12");
		var changes = mothernature.getChanges("julie");

		expect(changes["t12"]).toBeDefined();
		expect(changes["t333"]).toBeUndefined();
	});

	it("make 1 change each of the two AOIs", function() {
		mothernature.registerAOI("julie", {t12: true, t333: true});
		mothernature.recordChange(1,2,"color", "t12");
		mothernature.recordChange(1,2,"color", "t333");
		var changes = mothernature.getChanges("julie");

		expect(changes["t12"]).toBeDefined();
		expect(changes["t333"]).toBeDefined();
	});

	it("make 1 change after previous change retrieval", function() {
		mothernature.registerAOI("julie", {t12: true, t333: true});
		mothernature.recordChange(1,2,"color", "t12");
		mothernature.recordChange(1,2,"color", "t333");
		var changes = mothernature.getChanges("julie");

		expect(changes["t12"]).toBeDefined();
		expect(changes["t333"]).toBeDefined();

		changes = mothernature.getChanges("julie");

		expect(changes["t12"]).toBeUndefined();
		expect(changes["t333"]).toBeUndefined();

		mothernature.recordChange(1,2,"color", "t333");
		mothernature.recordChange(1,2,"color", "t333");

		changes = mothernature.getChanges("julie");

		expect(changes["t12"]).toBeUndefined();
		expect(changes["t333"]).toBeDefined();

	});
});