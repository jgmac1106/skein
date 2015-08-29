///<reference path="../typings/tsd.d.ts"/>
import assert = require('assert');
import util = require('../util');
import fs = require('fs');

function tryDelete(p) {
    try {
        fs.unlinkSync(p);
    } catch (e) {}
}

describe('writeFile', function() {
    before(function() {
        tryDelete('test/foo/bar/baz.txt');
        tryDelete('test/foo/bar');
        tryDelete('test/foo');
    });
    it('should work', function(done) {
        util.writeFile('test/foo/bar/baz.txt', 'hello world').
            then(function () {
                assert.equal(fs.readFileSync('test/foo/bar/baz.txt'), 'hello world');
            }).
            then(done).
            catch(done);
    }) ;
});

describe('chunk', function() {
    it('should return [] for (3, [])', function () {
        assert.deepEqual(util.chunk(3, []), []);
    });
    it('should return [[1,2,3],[4,5]] for (3, [1,2,3,4,5])', function () {
        assert.deepEqual(util.chunk(3, [1,2,3,4,5]), [[1,2,3],[4,5]]);
    })
});