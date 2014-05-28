module.exports = Cell;


// cell object
function Cell(color, birthdate, strength) {
  this.color = color;
  this.birthdate = birthdate;
  this.strength = strength;
}

Cell.prototype.printStuff = function() {
	console.log('color: ' + this.color + ', birthdate: ' + this.birthdate + ', strength: ' + this.strength);
}
