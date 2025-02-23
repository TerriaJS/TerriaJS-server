### Next version

* Require Node 20.

### 4.0.1

* Fixed proxied upstream POST request being aborted when the stream associated with the downstream request is closed on Node v16+. This will now again correctly be triggered only when the socket is closed early.

### 4.0.0

* Removed conversion service (no longer used in TerriaJS 8+).
* Removed pm2. Use containers and kubernetes to run terriajs-server concurrently and run terriajs-server on startup.
    * See https://github.com/TerriaJS/terriajs/discussions/6731 (includes details on how to continue running terriajs-server with).
    * `yarn/npm start` now runs terriajs-server in the foreground.
    * Removed `yarn/npm stop`.

### 3.3.4

* Add GDA2020 proj4 definition

### 3.3.3

* Authorisation token for feedback to be placed in header as per https://developer.github.com/changes/2020-02-10-deprecating-auth-through-query-param/

### 3.3.2

* Fixed a bug with the proxy route and certain redirect responses.

### 3.3.1

* Improved support with `resolvePathRelativeToWwwroot` triggering `serveWwwRoot`

### 3.3.0

* Added option to configure post limit on `share` endpoint (see `shareMaxRequestSize` in `serverconfig.json.example`)
* Added option for resolving unmatched paths/routes to index.html for single page applications via `resolveUnmatchedPathsWithIndexHtml`

### 3.2.0

* Support appending additional parameters to a querystring via the `/proxy` endpoint.

### 3.1.0

* Added support for the HTTP Strict-Transport-Security (HSTS) header.

### 3.0.2

* Stop setting cache-control directives for error responses.

### 3.0.1

* Increase post limit to 200kb on `share` endpoint.

### 3.0.0

* Switched to [pm2](http://pm2.keymetrics.io/) for managing the server process.

### 2.9.3

* Removed support for Google URL shortener creation and resolving.

### 2.9.2

* Fixed throwing an exception in a worker after conversion service runs on Nodejs verions 10+.

### 2.9.1

* Added automatic rate limiting of failed authentication attempts.

### 2.9.0

* Added support for additional feedback parameters. These additional parameters are described in `feedback.additionalParameters` in the config file.

### 2.8.0

* Added the ability to set `redirectToHttps` in the server config to automatically redirect requests. The list `httpAllowedHosts` in the server config can be used to specify specific hosts for which `http` access is still allowed.

### 2.7.4

* The `proxy` now verifies that the target of a server-side redirect (e.g. HTTP 301 status code) is in the whitelist. If it's not, the redirect is returned to the client instead of handled on the server.
* Added a list of IP addresses that the proxy will refuse to connect to, even if resolved from a hostname that is in the proxy whitelist. By default, the list includes all IP addresses that are not normal, internet-routable addresses. The list can be customized by setting `blackedlistedAddresses` in the config file. If your server has privileged access to any internet-routable addresses, be sure to add those addresses to the blacklist.

### 2.7.3

* Proxy authentication can now optionally be specified with the `proxyAuth` key in the `--config-file`, as an alternative to `--proxy-auth`.

### 2.7.2

* When using `--proxy-auth` to automatically supply HTTP basic authentication credentials, and the remote server returns 403 (Forbidden), we now retry the request without the credentials. This will usually result in the server responding with a 401 (Unauthorized), causing the user's browser to prompt for credentials. This is useful when some of the resources on the server are not available with the automatic credentials but will work if more powerful credentials are supplied.

### 2.7.1

* Added support for server-supplied custom headers, by extending the process used to insert the basic http auth header `authorization`.
* Running with `--public false` now runs just a single server process, to support easier debugging.
* Improved validation of the Esri token configuration.
* Fixed a problem where a proxy error (such as an invalid content length) detected after the proxy had started sending the response would cause the worker to crash with an exception saying "Can't set headers after they are sent."
* Added `Strict-Transport-Security` to the list of response headers that are not passed through to the client by the proxy.

### 2.7.0

* Added esri-token-auth service which is able to request tokens from ESRI token servers with username / password authentication and forward them on to anonymous clients.

### 2.6.7

* Allow setting the size limit for proxy POST requests using `proxyPostSizeLimit` in the server config. If no unit is specified bytes is assumed, or use some reasonable unit like 'kb' for kilobytes or 'mb' for megabytes.

### 2.6.6

* Fixed a bug that caused `Content-Length: 0` to be included in proxied GET requests.

### 2.6.5

* No code changes, but fixes permissions on the run_server script which prevented it from starting (due to 2.6.4 being published from a Windows system, again).

### 2.6.4

* Made `npm stop` / `stop_server.sh` work on Windows systems.

### 2.6.3

* Don't let Express URL decode the path passed to the proxy service.

### 2.6.2

* No code changes, but fixes permissions on the run_server script which prevented it from starting (due to 2.6.1 being published from a Windows system).

### 2.6.1

* The `feedback` service now includes the Share URL for the current state of the map, if provided.

### 2.6.0

* Support HTTPS.
* Fix node engines specification in package.json.  terriajs-server requires at least node v4.0, but 5.x, 6.x, etc. are fine.

### 2.5.1

* Fix bug in finding the path of config files, which shows up under Node 6.

### 2.5.0

* Support AWS S3 as a share data (URL shortener) backend.
* Tweak behaviour of data provided by `/share` when behind proxies.
* v2.4.0 accidentally required NodeJS 5, when previously it worked on 0.10.  This version restores support back to NodeJS 4.

### 2.4.0

* Support `maxConversionSize` parameter to determine what sized files can be converted. Still defaults to 1MB.
* Remove warning message when no proxy auth file specified. (Still warn when it's specified but not available.)
* Support repeated command line parameters, such as `--port 3001 --port 4000`. The rightmost one wins.
* Enable 'strict' argument mode. This helps catch mistyped argument names.
* Support creating and resolving short URLs with different, prefixed providers.
* Provide /serverconfig endpoint to retrieve information about how the server is configured, including version.
* Config files (config.json and proxyauth.json) are now interpreted as JSON5, so they can include `//` and `/* */` comments.
* Deprecation warning: `#` comments in config files will be removed in version 3.
* With "--public false", now run just one CPU and don't restart on crashes, to facilitate development and testing.
* All API features are now being moved to `/api/v1` (eg `/api/v1/ping`). They are currently available also under `/ping` but will be removed.
* Verbose output and logging can be enabled with `--verbose`.
* Support `hostName` parameter in config file, to provide better URLs.

### 2.3.0

* The `feedback` service now includes the `User-Agent` header sent by the user's browser.
* Added support for requiring HTTP basic authentication on all requests by supplying something like the following in the server configuration file:

```json
{
    "basicAuthentication": {
        "username": "myusername",
        "password": "mypassword"
    }
}
```

### 2.2.2

* Fixed a bug that caused the proxy to proxy any domain, even when given a whitelist.

### 2.2.1

* Add `trustProxy` setting to configuration file, which is passed through to Express.  See serverconfig.json.example.

### 2.2.0

* Add support for the `feedback` service.  See serverconfig.json.example for how to enable and configure it.

### 2.1.0

* Support "port" parameter in config file.

### 2.0.0

* Expect a server-specific configuration file, serverconfig.json, instead of one shared with the client.
* Move bypassProxyHosts option to that configuration file as bypassUpStreamProxyFor.
* Move upstreamProxy to config file.
* Rename proxyAuth.json to proxyauth.json
* Allow single line # comments in config files.
* Add /proxyableDomains endpoint which returns JSON list of domains we can proxy for.
* Allow catalog files outside your codebase to be specified using `initPaths: [...]`
* Config files are only looked for in the current directory, not in wwwroot or wwwroot/..

### 1.4.1

* Fixed a bug that caused all headers to be passed to the remote server by the proxy service, including headers that should be excluded.

### 1.4.0

* Added `run_server.sh` and `stop_server.sh` scripts.
* Fixed a bug that would cause the server to crash if `config.json` was missing.
* Added support for HTTP error code 500.

### 1.0.1

* Remove supervisor, as it wasn't doing anything useful and caused CPU and other issues.

### 1.0.0

* First stable release.
