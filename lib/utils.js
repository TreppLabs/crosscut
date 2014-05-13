// utils

module.exports.roughtSizeOfObjects = roughtSizeOfObjects;
module.exports.createArray = createArray;

// from http://www.russwurm.com/uncategorized/calculate-memory-size-of-javascript-object/ 
function roughSizeOfObject( object ) {
    var objectList = [];
    var recurse = function( value ) {
        var bytes = 0;
 
        if ( typeof value === 'boolean' ) {
            bytes = 4;
        } else if ( typeof value === 'string' ) {
            bytes = value.length * 2;
        } else if ( typeof value === 'number' ) {
            bytes = 8;
        } else if (typeof value === 'object'
                 && objectList.indexOf( value ) === -1) {
            objectList[ objectList.length ] = value;
            for( i in value ) {
                bytes+= 8; // assumed existence overhead
                bytes+= recurse( value[i] )
            }
        }
        return bytes;
    }
    return recurse( object );
}


// found on StackOverflow -- creates n-dimensional array as specified
function createArray(dimensions) {
    var arr = new Array(dimensions || 0),
        i = dimensions;

    if (arguments.length > 1) {
        var args = Array.prototype.slice.call(arguments, 1);
        while(i--) arr[dimensions-1 - i] = createArray.apply(this, args);
    }

    return arr;
}
