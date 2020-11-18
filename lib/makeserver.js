var express = require('express');
var compression = require('compression');
var path = require('path');
var cors = require('cors');
import exists from "./exists";
import shareController from "./controllers/share"
var basicAuth = require('basic-auth');
var fs = require('fs');
var ExpressBrute = require('express-brute');

const getMainVhost = (multiSettings, hostnameToMatch) => {
  const configForHost = multiSettings.hosts?.find((host) => {
    if (host.vhost === hostnameToMatch) return true;
    return host.aliases.find(alias => alias === hostnameToMatch);
  });
  return configForHost?.vhost || undefined;
};

const makeSettingsForHost = (baseSettings, multiSettings, hostnameToMatch) => {
  if (!multiSettings.common || !multiSettings.hosts) {
    return baseSettings;
  }
  // Normal settings (deep clone)
  const settings = JSON.parse(JSON.stringify(baseSettings));

  // Additional common multi-settings (deep clone)
  const common = JSON.parse(JSON.stringify(multiSettings.common));

  const base = {
    ...settings,
    ...common
  };

  // Find the config that matches up with our host;
  const configForHost = multiSettings.hosts.find((host) => {
    if (host.vhost === hostnameToMatch) return true;
    return host.aliases.find(alias => alias === hostnameToMatch);
  });

  // If we find one, merge it with the base
  if (configForHost) {
    return {
      ...base,
      ...configForHost.config
    };
  }

  // Otherwise return the base
  return base;
};

/* Creates and returns a single express server. */
module.exports = function(options) {
    function endpoint(path, router) {
        if (options.verbose) {
            console.log('http://' + options.hostName + ':' + options.port + '/api/v1' + path, true);
        }
        if (path !== 'proxyabledomains') {
            // deprecated endpoint that isn't part of V1
            app.use('/api/v1' + path, router);
        }
        // deprecated endpoint at `/`
        app.use(path, router);
    }
    const isMultiTenant = Object.keys(options.multiConfig).length > 0;

    // eventually this mime type configuration will need to change
    // https://github.com/visionmedia/send/commit/d2cb54658ce65948b0ed6e5fb5de69d022bef941
    var mime = express.static.mime;
    mime.define({
        'application/json' : ['czml', 'json', 'geojson'],
        'text/plain' : ['glsl']
    });

    // initialise app with standard middlewares
    var app = express();
    app.use(compression());
    app.use(cors());
    app.disable('etag');
    if (options.verbose || isMultiTenant) {
      const morgan = require('morgan');
      if (isMultiTenant) {
        morgan.token('host', function(req, res) {
          return req.hostname;
        });
        /**
         * below is a combination of:
         *
         * - host
         * - "combined" template from morgan, matching `Standard Apache combined
         *   log output.`
         * - response time in ms
         *  */
        app.use(morgan(`:host :remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms`));
      } else {
        app.use(morgan("dev"));
      }
    }

    if (typeof options.settings.trustProxy !== 'undefined') {
        app.set('trust proxy', options.settings.trustProxy);
    }

    if (options.verbose) {
        console.log('Listening on these endpoints:', true);
    }
    endpoint('/ping', function(req, res){
      res.status(200).send('OK');
    });

    app.use(function(req, res, next) {
      const hostname = req.hostname;
      const settingsForHost = makeSettingsForHost(options.settings, options.multiConfig, hostname);
      res.locals.settingsForHost = settingsForHost;
      res.locals.mainVhost = getMainVhost(options.multiConfig, hostname);

      return next();
    });

    // We do this after the /ping service above so that ping can be used unauthenticated and without TLS for health checks.
    if (options.settings.redirectToHttps) {
        var httpAllowedHosts = options.settings.httpAllowedHosts || ["localhost"];
        app.use(function(req, res, next) {
            if (httpAllowedHosts.indexOf(req.hostname) >= 0) {
                return next();
            }

            if (req.protocol !== 'https') {
                var url = 'https://' + req.hostname + req.url;
                res.redirect(301, url);
            } else {
                if (options.settings.strictTransportSecurity) {
                    res.setHeader('Strict-Transport-Security', options.settings.strictTransportSecurity);
                }
                next();
            }
        });
    }

    var auth = options.settings.basicAuthentication;
    if (auth && auth.username && auth.password) {
        var store = new ExpressBrute.MemoryStore();
        var rateLimitOptions = {
            freeRetries: 2,
            minWait: 200,
            maxWait: 60000,
        };
        if (options.settings.rateLimit && options.settings.rateLimit.freeRetries !== undefined) {
            rateLimitOptions.freeRetries = options.settings.rateLimit.freeRetries;
            rateLimitOptions.minWait = options.settings.rateLimit.minWait;
            rateLimitOptions.maxWait = options.settings.rateLimit.maxWait;
        }
        var bruteforce = new ExpressBrute(store, rateLimitOptions);
        app.use(bruteforce.prevent, function(req, res, next) {
            var user = basicAuth(req);
            if (user && user.name === auth.username && user.pass === auth.password) {
                // Successful authentication, reset rate limiting.
                req.brute.reset(next);
            } else {
                res.statusCode = 401;
                res.setHeader('WWW-Authenticate', 'Basic realm="terriajs-server"');
                res.end('Unauthorized');
            }
        });
    }

    app.get('*', function (req, res, next) {
      // redirect stock standard help page paths paths
      const redirects = [
        { oldPath: "/about.html", newPath: "/about" },
        { oldPath: "/help/help.html", newPath: "/about/help" },
        { oldPath: "/help/faq.html", newPath: "/about/faq" },
        { oldPath: "/help/privacy.html", newPath: "/about/privacy" },
      ];
      redirects.forEach(redirect => {
        if (redirect.oldPath === req.path) res.redirect(301, redirect.newPath);
      });
      next();
      // 301 any other about pages before they get hit if they still exist (?)
      // if (req.path.indexOf("about") !== -1 && req.path.indexOf(".html") !== -1) {
      //   res.redirect(301, `${req.path.slice(0, -5)}`);
      // }
    });

    // Serve the bulk of our application as a static web directory.
    var serveWwwRoot = exists(options.wwwroot + '/index.html')
      || (options.settings.singlePageRouting && exists(options.wwwroot + options.settings.singlePageRouting.resolvePathRelativeToWwwroot));
    if (serveWwwRoot) {
        app.use(express.static(options.wwwroot));
    }

    // Proxy for servers that don't support CORS
    var bypassUpstreamProxyHostsMap = (options.settings.bypassUpstreamProxyHosts || []).reduce(function(map, host) {
            if (host !== '') {
                map[host.toLowerCase()] = true;
            }
            return map;
        }, {});

    /**
     * TODO: truly multi tenant proxyableDomains.
     *
     * here we simply concatenate all
     * available domains - with the reason being if we are happy to proxy one
     * given host, it should be OK to do so in the short term for others.
     * however it should ultimately be properly shielded from other host
     * preferences
     */
    const fullAllowProxyFor = isMultiTenant
      ? options.multiConfig.hosts?.reduce((acc, hostItem) => {
          const config = hostItem.config;
          if (config?.allowProxyFor) {
            return [...acc, ...config.allowProxyFor];
          }
          return acc;
        }, options.multiConfig.common?.allowProxyFor || [])
      : options.settings.allowProxyFor;

    endpoint('/proxy', require('./controllers/proxy')({
        proxyableDomains: fullAllowProxyFor,
        proxyAllDomains: options.settings.proxyAllDomains,
        proxyAuth: options.proxyAuth,
        proxyPostSizeLimit: options.settings.proxyPostSizeLimit,
        upstreamProxy: options.settings.upstreamProxy,
        bypassUpstreamProxyHosts: bypassUpstreamProxyHostsMap,
        basicAuthentication: options.settings.basicAuthentication,
        blacklistedAddresses: options.settings.blacklistedAddresses,
        appendParamToQueryString: options.settings.appendParamToQueryString
    }));

    var esriTokenAuth = require('./controllers/esri-token-auth')(options.settings.esriTokenAuth);
    if (esriTokenAuth) {
        endpoint('/esri-token-auth', esriTokenAuth);
    }

    endpoint('/proj4def', require('./controllers/proj4lookup'));            // Proj4def lookup service, to avoid downloading all definitions into the client.
    endpoint('/convert', require('./controllers/convert')(options).router); // OGR2OGR wrapper to allow supporting file types like Shapefile.
    endpoint('/proxyabledomains', require('./controllers/proxydomains')({   // Returns JSON list of domains we're willing to proxy for
        proxyableDomains: options.settings.allowProxyFor,
        proxyAllDomains: !!options.settings.proxyAllDomains,
    }));
    endpoint('/serverconfig', require('./controllers/serverconfig')(options));

    var errorPage = require('./errorpage');
    var show404 = serveWwwRoot && exists(options.wwwroot + '/404.html');
    var error404 = errorPage.error404(show404, options.wwwroot, serveWwwRoot);
    var show500 = serveWwwRoot && exists(options.wwwroot + '/500.html');
    var error500 = errorPage.error500(show500, options.wwwroot);
    var initPaths = options.settings.initPaths || [];

    if (serveWwwRoot) {
        initPaths.push(path.join(options.wwwroot, 'init'));
    }

    app.use('/init', require('./controllers/initfile')(initPaths, error404, options.configDir));

    var feedbackService = require('./controllers/feedback')(options.settings.feedback);
    if (feedbackService) {
        endpoint('/feedback', feedbackService);
    }
    var shareService = shareController(
        options.hostName,
        options.port,
        {
            shareUrlPrefixes: options.settings.shareUrlPrefixes,
            newShareUrlPrefix: options.settings.newShareUrlPrefix,
            shareMaxRequestSize: options.settings.shareMaxRequestSize
        }
    );
    if (shareService) {
        endpoint('/share', shareService);
    }

    app.get('/about*', function (req, res) {
      var defaultRequest = require('request');
      // TODO: 301 common historical about/help `.html` routes
      try {
        defaultRequest({
          method: req.method,
          baseUrl: "http://localhost:3000",
          url: req.path,
          headers: {
            "x-forwarded-host": req.host
          }
        }).on('response', function(response) {
          res.status(response.statusCode);
          response.on('data', function(chunk) {
            res.write(chunk);
          });
          response.on('end', function() {
            res.end();
          });
        }).on('error', function(err) {
          res.status(500).send('Proxy error');
        });
      } catch (e) {
        console.error(e.stack);
        res.status(500).send('Proxy error');
      }
    });

    if (options.settings && options.settings.singlePageRouting) {
      var singlePageRoutingService = require('./controllers/single-page-routing')(options, options.settings.singlePageRouting);
      if (singlePageRoutingService) {
          endpoint('*', singlePageRoutingService);
      }
    }


    app.use(error404);
    app.use(error500);
    var server = app;
    var osh = options.settings.https;
    if (osh && osh.key && osh.cert) {
        console.log('Launching in HTTPS mode.');
        var https = require('https');
        server = https.createServer({
            key: fs.readFileSync(osh.key),
            cert: fs.readFileSync(osh.cert)
        }, app);
    }

    return server;
};
