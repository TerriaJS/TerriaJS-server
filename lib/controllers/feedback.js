/* jshint node: true */
'use strict';

var bodyParser = require('body-parser');
var router = require('express').Router();
let got;
(async () => {
    got = await import("got");
})();

module.exports = function(options) {
    if (!options || !options.issuesUrl || !options.accessToken) {
        return;
    }

    router.use(bodyParser.json());
    router.post('/', async function (req, res, next) {
        var parameters = req.body;

        const response = await got({
            url: options.issuesUrl,
            method: 'POST',
            headers: {
                'User-Agent': options.userAgent || 'TerriaBot (TerriaJS Feedback)',
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `token ${options.accessToken}`
            },
            json: {
                title: parameters.title ? parameters.title : 'User Feedback',
                body: formatBody(req, parameters, options.additionalParameters)
            }
        });
        res.set('Content-Type', 'application/json');
        if (response.statusCode < 200 || response.statusCode >= 300) {
            res.status(response.statusCode).send(JSON.stringify({result: 'FAILED'}));
        } else {
            res.status(200).send(JSON.stringify({result: 'SUCCESS'}));
        }
    });

    return router;
};

function formatBody(request, parameters, additionalParameters) {
    var result = '';

    result += parameters.comment ? parameters.comment : 'No comment provided';
    result += '\n### User details\n';
    result += '* Name: '          + (parameters.name ? parameters.name : 'Not provided') + '\n';
    result += '* Email Address: ' + (parameters.email ? parameters.email : 'Not provided') + '\n';
    result += '* IP Address: '    + request.ip + '\n';
    result += '* User Agent: '    + request.header('User-Agent') + '\n';
    result += '* Referrer: '      + request.header('Referrer') + '\n';
    result += '* Share URL: '     + (parameters.shareLink ? parameters.shareLink : 'Not provided') + '\n';
    if (additionalParameters) {
        additionalParameters.forEach((parameter) => {
            result += `* ${parameter.descriptiveLabel}: ${parameters[parameter.name] || 'Not provided'}\n`;
        });
    }

    return result;
}
