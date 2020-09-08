"use strict";

var makeServer = require("../lib/makeserver");
var request = require("supertest");

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

const multiTenantCases = [
  {
    name: "should return default config on unmatched vhost",
    isMultiConfig: true,
    hostname: undefined,
    expectedRegistryConfigurationId: "map-config-common",
    expectedNewShareUrlPrefix: "commonPrefix"
  },
  {
    name: "should return config matching vhost",
    isMultiConfig: true,
    hostname: "main.host.terria.io",
    expectedRegistryConfigurationId: "map-config-terria",
    expectedNewShareUrlPrefix: "terriaPrefix"
  },
  {
    name: "should return config matching alias",
    isMultiConfig: true,
    hostname: "alias.another.host.terria.io",
    expectedRegistryConfigurationId: "map-config-another",
    expectedNewShareUrlPrefix: "anotherPrefix"
  }
];
const singleTenantCases = [
  {
    name: "should return default config on unmatched vhost",
    isMultiConfig: false,
    hostname: undefined,
    expectedRegistryConfigurationId: undefined,
    expectedNewShareUrlPrefix: "singleTenantPrefix"
  },
  {
    name: "should return config matching vhost",
    isMultiConfig: false,
    hostname: "main.host.terria.io",
    expectedRegistryConfigurationId: undefined,
    expectedNewShareUrlPrefix: "singleTenantPrefix"
  }
];

describe("makeserver", function() {
  describe("/serverconfig/ route", function() {
    const doTest = async testCase => {
      await request(buildApp({ isMultiConfig: testCase.isMultiConfig }))
        .get("/serverconfig/")
        .set("host", testCase.hostname || "")
        .expect(200)
        .expect("Content-Type", /application\/json/)
        .then(response => {
          const json = JSON.parse(response.text);
          expect(json.registryConfigurationId).toEqual(
            testCase.expectedRegistryConfigurationId
          );
          expect(json.newShareUrlPrefix).toEqual(
            testCase.expectedNewShareUrlPrefix
          );
        });
    };
    describe("in multi config", function() {
      multiTenantCases.map(testCase => {
        it(`${testCase.name}`, async function() {
          await doTest(testCase);
        });
      });
    });
    describe("in single config", function() {
      singleTenantCases.map(testCase => {
        it(`${testCase.name}`, async function() {
          await doTest(testCase);
        });
      });
    });
  });

  function buildApp(overrides = { isMultiConfig: false }) {
    const { isMultiConfig } = overrides;
    var options = require("../lib/options").init(true);
    const multiConfig = {
      common: {
        registryConfigurationId: "map-config-common",
        newShareUrlPrefix: "commonPrefix"
      },
      hosts: [
        {
          vhost: "main.host.terria.io",
          aliases: [
            "localhost",
            "alias.host.terria.io",
            "other.domain.example.com"
          ],
          config: {
            registryConfigurationId: "map-config-terria",
            newShareUrlPrefix: "terriaPrefix"
          }
        },
        {
          vhost: "another.host.terria.io",
          aliases: ["alias.another.host.terria.io"],
          config: {
            registryConfigurationId: "map-config-another",
            newShareUrlPrefix: "anotherPrefix"
          }
        }
      ]
    };
    const baseOptions = {
      settings: {
        newShareUrlPrefix: "singleTenantPrefix"
      }
    };
    const mergedOptions = Object.assign(options, baseOptions, {
      multiConfig: isMultiConfig ? multiConfig : {}
    });
    var app = makeServer(mergedOptions);
    app.use(function(err, req, res, next) {
      console.error(err.stack);
      res.status(500).send("Something broke!");
    });
    return app;
  }
});
