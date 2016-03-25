/* jshint node: true */
"use strict";

var express = require('express');
var request = require('request');
var url = require('url');

var DO_NOT_PROXY_REGEX = /^(?:Host|X-Forwarded-Host|Proxy-Connection|Connection|Keep-Alive|Transfer-Encoding|TE|Trailer|Proxy-Authorization|Proxy-Authenticate|Upgrade|Expires|pragma)$/i;
var PROTOCOL_REGEX = /^\w+:\//;
var DURATION_REGEX = /^([\d.]+)(ms|s|m|h|d|w|y)$/;
var DURATION_UNITS = {
    ms: 1.0 / 1000,
    s: 1.0,
    m: 60.0,
    h: 60.0 * 60.0,
    d: 24.0 * 60.0 * 60.0,
    w: 7.0 * 24.0 * 60.0 * 60.0,
    y: 365 * 24.0 * 60.0 * 60.0
};
/** Age to override cache instructions with for proxied files */
var DEFAULT_MAX_AGE_SECONDS = 1209600; // two weeks

/**
 * Creates an express middleware that proxies calls to '/proxy/http://example' to 'http://example', while forcing them
 * to be cached by the browser and overrwriting CORS headers.
 *
 * @param {Object} options
 * @param {Array[String]} options.proxyDomains An array of domains to be proxied
 * @param {boolean} options.proxyAllDomains A boolean indicating whether or not we should proxy ALL domains - overrides
 *                      the configuration in options.proxyDomains
 * @param {String} options.proxyAuth A map of domains to tokens that will be passed to those domains via basic auth
 *                      when proxying through them.
 * @param {String} options.upstreamProxy Url of a standard upstream proxy that will be used to retrieve data.
 * @param {String} options.bypassUpstreamProxyHosts An object of hosts (as strings) to 'true' values.
 *
 * @returns {*} A middleware that can be used with express.
 */
module.exports = function(options) {
    var proxyDomains = options.proxyDomains || [];
    var proxyAllDomains = options.proxyAllDomains || !proxyDomains.length;
    var proxyAuth = options.proxyAuth || {};

    //Non CORS hosts and domains we proxy to
    function proxyAllowedHost(host) {
        if (proxyAllDomains) {
            return true;
        }
        host = host.toLowerCase();
        //check that host is from one of these domains
        for (var i = 0; i < proxyDomains.length; i++) {
            if (host.indexOf(proxyDomains[i], host.length - proxyDomains[i].length) !== -1) {
                return true;
            }
        }
        return false;
    }

    function doProxy(req, res, next, callback) {
        var remoteUrlString = req.params[0];

        if (!remoteUrlString || remoteUrlString.length === 0) {
            return res.status(400).send('No url specified.');
        }

        // Does the proxy URL include a max age?
        var maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS;
        if (remoteUrlString[0] === '_') {
            var slashIndex = remoteUrlString.indexOf('/');
            if (slashIndex < 0) {
                return res.status(400).send('No url specified.');
            }

            var maxAgeString = remoteUrlString.substring(1, slashIndex);
            remoteUrlString = remoteUrlString.substring(slashIndex + 1);

            if (remoteUrlString.length === 0) {
                return res.status(400).send('No url specified.');
            }

            // Interpret the max age as a duration in Varnish notation.
            // https://www.varnish-cache.org/docs/trunk/reference/vcl.html#durations
            var parsedMaxAge = DURATION_REGEX.exec(maxAgeString);
            if (!parsedMaxAge || parsedMaxAge.length < 3) {
                return res.status(400).send('Invalid duration.');
            }

            var value = parseFloat(parsedMaxAge[1]);
            if (value !== value) {
                return res.status(400).send('Invalid duration.');
            }

            var unitConversion = DURATION_UNITS[parsedMaxAge[2]];
            if (!unitConversion) {
                return res.status(400).send('Invalid duration unit ' + parsedMaxAge[2]);
            }

            maxAgeSeconds = value * unitConversion;
        }

        // Add http:// if no protocol is specified.
        var protocolMatch = PROTOCOL_REGEX.exec(remoteUrlString);
        if (!protocolMatch || protocolMatch.length < 1) {
            remoteUrlString = 'http://' + remoteUrlString;
        } else {
            var matchedPart = protocolMatch[0];

            // If the protocol portion of the URL only has a single slash after it, the extra slash was probably stripped off by someone
            // along the way (NGINX will do this).  Add it back.
            if (remoteUrlString[matchedPart.length] !== '/') {
                remoteUrlString = matchedPart + '/' + remoteUrlString.substring(matchedPart.length);
            }
        }

        var remoteUrl = url.parse(remoteUrlString);

        // Copy the query string
        remoteUrl.search = url.parse(req.url).search;

        if (!remoteUrl.protocol) {
            remoteUrl.protocol = 'http:';
        }

        var proxy;
        if (options.upstreamProxy && !((options.bypassUpstreamProxyHosts || {})[remoteUrl.host])) {
            proxy = options.upstreamProxy;
        }

        // Are we allowed to proxy for this host?
        if (!proxyAllowedHost(remoteUrl.host)) {
            res.status(403).send('Host is not in list of allowed hosts: ' + remoteUrl.host);
            return;
        }

        // encoding : null means "body" passed to the callback will be raw bytes

        var proxiedRequest;
        req.on('close', function() {
            if (proxiedRequest) {
                proxiedRequest.abort();
            }
        });

        var filteredReqHeaders = filterHeaders(req.headers);
        if (!filteredReqHeaders['x-forwarded-for']) {
            filteredReqHeaders['x-forwarded-for'] = req.connection.remoteAddress;
        }

        // http basic auth
        var authRequired = proxyAuth[remoteUrl.host];
        if (authRequired) {
            filteredReqHeaders['authorization'] = authRequired.authorization;
        }

        proxiedRequest = callback(remoteUrl, filteredReqHeaders, proxy, maxAgeSeconds);
    }

    function buildReqHandler(httpVerb, passRequestBody) {
        return function(req, res, next) {
            return doProxy(req, res, next, function(remoteUrl, filteredRequestHeaders, proxy, maxAgeSeconds) {
                var proxiedRequest = request[httpVerb]({
                    url: url.format(remoteUrl),
                    headers: filteredRequestHeaders,
                    encoding: null,
                    proxy: proxy
                }, function(error, response, body) {
                    var code;

                    if (response) {
                        code = response.statusCode;
                        res.header(processHeaders(response.headers, maxAgeSeconds));
                    } else {
                        code = 500;
                    }

                    res.status(code).send(body);
                });

                if (passRequestBody) {
                    req.pipe(proxiedRequest);
                }

                return proxiedRequest;
            });
        }
    }

    var router = express.Router();
    router.get('/*', buildReqHandler('get', false));
    router.post('/*', buildReqHandler('post', true));

    return router;
};

/**
 * Filters headers that are not matched by {@link DO_NOT_PROXY_REGEX} out of an object containing headers. This does not
 * mutate the original list.
 *
 * @param headers The headers to filter
 * @returns {Object} A new object with the filtered headers.
 */
function filterHeaders(headers) {
    var result = {};
    // filter out headers that are listed in the regex above
    Object.keys(headers).forEach(function(name) {
        if (!DO_NOT_PROXY_REGEX.test(name)) {
            result[name] = headers[name];
        }
    });

    return result;
}

/**
 * Filters out headers that shouldn't be proxied, overrides caching so files are retained for {@link DEFAULT_MAX_AGE_SECONDS},
 * and sets CORS headers to allow all origins
 *
 * @param headers The original object of headers. This is not mutated.
 * @param maxAgeSeconds the amount of time in seconds to cache for. This will override what the original server
 *          specified because we know better than they do.
 * @returns {Object} The new headers object.
 */
function processHeaders(headers, maxAgeSeconds) {
    var result = filterHeaders(headers);

    result['Cache-Control'] = 'public,max-age=' + maxAgeSeconds;
    result['Access-Control-Allow-Origin'] = '*';

    return result;
}