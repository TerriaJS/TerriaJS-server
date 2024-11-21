"use strict";

var fs = require('fs');
var makeServer = require('../lib/makeserver');
var singlePageRouting = require('../lib/controllers/single-page-routing');
var request = require('supertest');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe('single-page-routing', function() {
    var appOptions = {
      wwwroot: "./spec/mockwwwroot"
    };
    var badAppOptions = {
      wwwroot: "./spec/nonexistentwwwroot"
    };

    var routingOffOptions = {
      resolveUnmatchedPathsWithIndexHtml: false
    };

    var routingOnOptions = {
      resolvePathRelativeToWwwroot: "/index.html",
      resolveUnmatchedPathsWithIndexHtml: true
    };

    describe('using controller', function() {
      const errorMatcher = (error) => {
        if (error.message.indexOf('`resolvePathRelativeToWwwroot` does not exist')) {
          return true;
        }
      }
      describe('should throw', function() {
        it('with bad wwwroot', function() {
          expect(() => {
            const serverOptions = {
              ...badAppOptions,
              settings: {
                singlePageRouting: {
                  ...routingOnOptions
                }
              }
            };
            singlePageRouting(serverOptions, routingOnOptions);
          }).toThrow();
        });
        it('with good wwwroot, specifying invalid path', function() {
          expect(() => {
            const serverOptions = {
              ...badAppOptions,
              settings: {
                singlePageRouting: {
                  resolvePathRelativeToWwwroot: "/does-not-exist.html",
                  resolveUnmatchedPathsWithIndexHtml: true
                }
              }
            };
            singlePageRouting(serverOptions, routingOnOptions);
          }).toThrowMatching(errorMatcher);
        });
      });
      describe('should not throw', function() {
        it('with good wwwroot and routing off', function() {
          expect(() => {
            const serverOptions = {
              ...appOptions,
              settings: {
                singlePageRouting: {
                  ...routingOffOptions
                }
              }
            };
            singlePageRouting(serverOptions, routingOffOptions);
          }).not.toThrow();
        });
        it('with good wwwroot', function() {
          expect(() => {
            const serverOptions = {
              ...appOptions,
              settings: {
                singlePageRouting: {
                  ...routingOnOptions
                }
              }
            };
            singlePageRouting(serverOptions, routingOnOptions);
          }).not.toThrow();
        });
      });
    })

    describe('on get with routing off,', function() {
      it('should 404 blah route', function(done) {
        request(buildApp(routingOffOptions))
            .get('/blah')
            .expect(404)
            .end(assert(done));
      });
      it('should resolve an actual html file', function() {
        request(buildApp(routingOffOptions))
            .get('/actual-html-file.html')
            .expect(200)
            .expect('Content-Type', /html/)
            .then(response => {
              expect(response.text).toBe(fs.readFileSync(appOptions.wwwroot + "/actual-html-file.html", "utf8"))
            });
      });
      it('should resolve an actual json file', function() {
        request(buildApp(routingOffOptions))
            .get('/actual-json.json')
            .expect(200)
            .expect('Content-Type', /json/)
            .then(response => {
              expect(response.text).toBe(fs.readFileSync(appOptions.wwwroot + "/actual-json.json", "utf8"))
            });
      });
    });

    describe('on get with routing on,', function() {
      it('should resolve unmatched route with the optioned path', function() {
        request(buildApp(routingOnOptions))
            .get('/blah')
            .expect(200)
            .expect('Content-Type', /html/)
            .then(response => {
              expect(response.text).toBe(fs.readFileSync(appOptions.wwwroot + routingOnOptions.resolvePathRelativeToWwwroot, "utf8"))
            });
      });
      it('should resolve an actual html file', function() {
        request(buildApp(routingOnOptions))
            .get('/actual-html-file.html')
            .expect(200)
            .expect('Content-Type', /html/)
            .then(response => {
              expect(response.text).toBe(fs.readFileSync(appOptions.wwwroot + "/actual-html-file.html", "utf8"))
            });
      });
      it('should resolve an actual json file', function() {
        request(buildApp(routingOnOptions))
            .get('/actual-json.json')
            .expect(200)
            .expect('Content-Type', /json/)
            .then(response => {
              expect(response.text).toBe(fs.readFileSync(appOptions.wwwroot + "/actual-json.json", "utf8"))
            });
      });
    });

    describe('on post,', function() {
        it('should error out with routing off', function(done) {
            request(buildApp(routingOffOptions))
                .post('/mochiRoute')
                .expect(404)
                .end(assert(done));
        });
        it('should error out with routing on', function(done) {
            request(buildApp(routingOnOptions))
                .post('/mochiRoute')
                .expect(404)
                .end(assert(done));
        });
    });

    function buildApp(spaOptions) {
        var options = require('../lib/options').init(true);
        const serverOptions = {
          ...appOptions,
          settings: {
            singlePageRouting: {
              ...spaOptions
            }
          }
        };
        const mergedOptions = Object.assign(options, serverOptions);
        var app = makeServer(mergedOptions);
        app.use(function(err, req, res, next) {
            console.error(err.stack);
            res.status(500).send('Something broke!');
        });
        return app;
    }

    function assert(done) {
        return function(err) {
            if (err) {
                fail(err);
            }
            done();
        };
    }
});
