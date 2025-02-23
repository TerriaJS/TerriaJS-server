import express from 'express';
import proj4lookup from '../lib/controllers/proj4lookup.js';
import request from 'supertest';
import makeserver from '../lib/makeserver.js';
import { default as opts } from '../lib/options.js';

var server;

describe('proj4lookup', function() {
    beforeEach(function() {
        var options = opts.init(true);
        server = makeserver(options);
    });

    describe('on get', function() {
        it('should return a definition for EPSG:4326', function(done) {
            request(server)
                .get('/api/v1/proj4def/EPSG:4326')
                .expect(200, '+proj=longlat +datum=WGS84 +no_defs')
                .end(assert(done));
        });

        it('should 404 unknown projection', function(done) {
            request(server)
                .get('/api/v1/proj4def/EPSG:Notarealthing')
                .expect(404, done);
        });
    });

    function assert(done) {
        return (err) => err ? done.fail(err) : done();
    }
});
