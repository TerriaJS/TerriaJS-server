// TODO: If these are const we get `Cannot redeclare block-scoped variable 'supertest'` across this file and single-page-routing.spec
var request = require("supertest");
var makeserver = require("../lib/makeserver");

let server: any;

describe("proj4lookup", function() {
  beforeEach(function() {
    var options = require("../lib/options").init(true);
    server = makeserver(options);
  });

  describe("on get", function() {
    it("should return a definition for EPSG:4326", function(done) {
      request(server)
        .get("/api/v1/proj4def/EPSG:4326")
        .expect(200, "+proj=longlat +datum=WGS84 +no_defs")
        .end(assert(done));
    });

    it("should 404 unknown projection", function(done) {
      request(server)
        .get("/api/v1/proj4def/EPSG:Notarealthing")
        .expect(404, done);
    });
  });

  function assert(done: any) {
    return (err: any) => (err ? done.fail(err) : done());
  }
});
