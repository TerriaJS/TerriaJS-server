// TODO: If these are const we get `Cannot redeclare block-scoped variable 'supertest'` across all spec files
var fs = require("fs");
var makeServer = require("../lib/makeserver");
var singlePageRouting = require("../lib/controllers/single-page-routing");
var request = require("supertest");

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe("single-page-routing", function() {
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

  describe("using controller", function() {
    const errorMatcher = (error: any) => {
      if (
        error.message.indexOf("`resolvePathRelativeToWwwroot` does not exist")
      ) {
        return true;
      }
      return false;
    };
    describe("should throw", function() {
      it("with bad wwwroot", function() {
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
      it("with good wwwroot, specifying invalid path", function() {
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
    describe("should not throw", function() {
      it("with good wwwroot and routing off", function() {
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
      it("with good wwwroot", function() {
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
  });

  describe("on get with routing off,", function() {
    it("should 404 blah route", function(done) {
      request(buildApp(routingOffOptions))
        .get("/blah")
        .expect(404)
        .end(assert(done));
    });
    it("should resolve an actual html file", function() {
      request(buildApp(routingOffOptions))
        .get("/actual-html-file.html")
        .expect(200)
        .expect("Content-Type", /html/)
        .then((response: any) => {
          expect(response.text).toBe(
            fs.readFileSync(
              appOptions.wwwroot + "/actual-html-file.html",
              "utf8"
            )
          );
        });
    });
    it("should resolve an actual json file", function() {
      request(buildApp(routingOffOptions))
        .get("/actual-json.json")
        .expect(200)
        .expect("Content-Type", /json/)
        .then((response: any) => {
          expect(response.text).toBe(
            fs.readFileSync(appOptions.wwwroot + "/actual-json.json", "utf8")
          );
        });
    });
  });

  describe("on get with routing on,", function() {
    it("should resolve unmatched route with the optioned path", function() {
      request(buildApp(routingOnOptions))
        .get("/blah")
        .expect(200)
        .expect("Content-Type", /html/)
        .then((response: any) => {
          expect(response.text).toBe(
            fs.readFileSync(
              appOptions.wwwroot +
                routingOnOptions.resolvePathRelativeToWwwroot,
              "utf8"
            )
          );
        });
    });
    describe("with an actual html file on main vhost", function() {
      it("should resolve without robots tag on main vhost", function() {
        request(buildApp(routingOnOptions, { isMultiConfig: true }))
          .get("/some-spa-route")
          .set("host", "main.host.terria.io")
          .expect(200)
          .expect("Content-Type", /html/)
          .then((response: any) => {
            expect(response.text.includes("robots")).toBeFalse();
          });
      });
      it("should resolve a non matched file to index.html", function() {
        request(buildApp(routingOnOptions, { isMultiConfig: true }))
          .get("/some-spa-route")
          .expect(200)
          .expect("Content-Type", /html/)
          .then((response: any) => {
            expect(response.text.includes("robots")).toBeTrue();
          });
      });
    });
    it("should resolve an actual html file", function() {
      request(buildApp(routingOnOptions))
        .get("/actual-html-file.html")
        .expect(200)
        .expect("Content-Type", /html/)
        .then((response: any) => {
          expect(response.text).toBe(
            fs.readFileSync(
              appOptions.wwwroot + "/actual-html-file.html",
              "utf8"
            )
          );
        });
    });
    it("should resolve an actual json file", function() {
      request(buildApp(routingOnOptions))
        .get("/actual-json.json")
        .expect(200)
        .expect("Content-Type", /json/)
        .then((response: any) => {
          expect(response.text).toBe(
            fs.readFileSync(appOptions.wwwroot + "/actual-json.json", "utf8")
          );
        });
    });
  });

  describe("on post,", function() {
    it("should error out with routing off", function(done) {
      request(buildApp(routingOffOptions))
        .post("/mochiRoute")
        .expect(404)
        .end(assert(done));
    });
    it("should error out with routing on", function(done) {
      request(buildApp(routingOnOptions))
        .post("/mochiRoute")
        .expect(404)
        .end(assert(done));
    });
  });

  function buildApp(spaOptions: any, overrides = { isMultiConfig: false }) {
    const { isMultiConfig } = overrides;
    const multiConfig = {
      common: {
        registryConfigurationId: "map-config-common",
        newShareUrlPrefix: "commonPrefix",
        allowProxyFor: ["base.allowed.domain"]
      },
      hosts: [
        {
          vhost: "main.host.terria.io",
          aliases: [
            "localhost",
            "alias.host.terria.io",
            "other.domain.example.com"
          ],
          config: {}
        }
      ]
    };
    var options = require("../lib/options").init(true);
    const serverOptions = {
      ...appOptions,
      settings: {
        singlePageRouting: {
          ...spaOptions
        }
      }
    };
    const mergedOptions = Object.assign(options, serverOptions, {
      multiConfig: isMultiConfig ? multiConfig : {}
    });
    var app = makeServer(mergedOptions);
    app.use(function(err: any, req: any, res: any, next: any) {
      console.error(err.stack);
      res.status(500).send("Something broke!");
    });
    return app;
  }

  function assert(done: any) {
    return function(err: any) {
      if (err) {
        fail(err);
      }
      done();
    };
  }
});
