/* jshint node: true */
'use strict';

import proxy from './controllers/proxy.js';
import proj4lookup from './controllers/proj4lookup.js';
import proxydomains from './controllers/proxydomains.js';
import createApplication, { static as expressStatic } from 'express';
import compression from 'compression';
import path from 'path';
import cors from 'cors';
import exists from './exists.js';
import basicAuth from 'basic-auth';
import fs from 'fs';
import ExpressBrute from 'express-brute';
import moragn from 'morgan';
import esriAuth from './controllers/esri-token-auth.js';
import serverConfig from './controllers/serverconfig.js';
import { error404 as Error404, error500 as Error500 } from './errorpage.js';
import initfile from './controllers/initfile.js';
import feedback from './controllers/feedback.js';
import share from "./controllers/share.js";
import singlePageRouting from './controllers/single-page-routing.js';

/* Creates and returns a single express server. */
export default function(options) {
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

    // eventually this mime type configuration will need to change
    // https://github.com/visionmedia/send/commit/d2cb54658ce65948b0ed6e5fb5de69d022bef941
    var mime = expressStatic.mime;
    mime.define({
        'application/json' : ['czml', 'json', 'geojson'],
        'text/plain' : ['glsl']
    });

    // initialise app with standard middlewares
    var app = createApplication();
    app.use(compression());
    app.use(cors());
    app.disable('etag');
    if (options.verbose) {
        app.use(morgan('dev'));
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

    // Serve the bulk of our application as a static web directory.
    var serveWwwRoot = exists(options.wwwroot + '/index.html')
      || (options.settings.singlePageRouting && exists(options.wwwroot + options.settings.singlePageRouting.resolvePathRelativeToWwwroot));
    if (serveWwwRoot) {
        app.use(expressStatic(options.wwwroot));
    }

    // Proxy for servers that don't support CORS
    var bypassUpstreamProxyHostsMap = (options.settings.bypassUpstreamProxyHosts || []).reduce(function(map, host) {
            if (host !== '') {
                map[host.toLowerCase()] = true;
            }
            return map;
        }, {});

    endpoint('/proxy', proxy({
        proxyableDomains: options.settings.allowProxyFor,
        proxyAllDomains: options.settings.proxyAllDomains,
        proxyAuth: options.proxyAuth,
        proxyPostSizeLimit: options.settings.proxyPostSizeLimit,
        upstreamProxy: options.settings.upstreamProxy,
        bypassUpstreamProxyHosts: bypassUpstreamProxyHostsMap,
        basicAuthentication: options.settings.basicAuthentication,
        blacklistedAddresses: options.settings.blacklistedAddresses,
        appendParamToQueryString: options.settings.appendParamToQueryString
    }));

    var esriTokenAuth = esriAuth(options.settings.esriTokenAuth);
    if (esriTokenAuth) {
        endpoint('/esri-token-auth', esriTokenAuth);
    }

    endpoint('/proj4def', proj4lookup);            // Proj4def lookup service, to avoid downloading all definitions into the client.
    endpoint('/proxyabledomains', proxydomains({   // Returns JSON list of domains we're willing to proxy for
        proxyableDomains: options.settings.allowProxyFor,
        proxyAllDomains: !!options.settings.proxyAllDomains,
    }));
    endpoint('/serverconfig', serverConfig(options));

    var show404 = serveWwwRoot && exists(options.wwwroot + '/404.html');
    var error404 = Error404(show404, options.wwwroot, serveWwwRoot);
    var show500 = serveWwwRoot && exists(options.wwwroot + '/500.html');
    var error500 = Error500(show500, options.wwwroot);
    var initPaths = options.settings.initPaths || [];

    if (serveWwwRoot) {
        initPaths.push(path.join(options.wwwroot, 'init'));
    }

    app.use('/init', initfile(initPaths, error404, options.configDir));

    var feedbackService = feedback(options.settings.feedback);
    if (feedbackService) {
        endpoint('/feedback', feedbackService);
    }
    var shareService = share(
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

    if (options.settings && options.settings.singlePageRouting) {
      var singlePageRoutingService = singlePageRouting(options, options.settings.singlePageRouting);
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
