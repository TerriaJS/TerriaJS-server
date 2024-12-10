/* jshint node: true, esnext: true */
"use strict";
import { Router } from 'express';
import pkg from '../../package.json' with { type: "json" };

// Expose a whitelisted set of configuration attributes to the world. This definitely doesn't include authorisation tokens, local file paths, etc.
// It mirrors the structure of the real config file.
export default function(options) {
    var router = Router();
    var settings = Object.assign({}, options.settings), safeSettings = {};
    var safeAttributes = ['allowProxyFor', 'newShareUrlPrefix', 'proxyAllDomains'];
    safeAttributes.forEach(key => safeSettings[key] = settings[key]);
    safeSettings.version = pkg.version;
    if (typeof settings.shareUrlPrefixes === 'object') {
        safeSettings.shareUrlPrefixes = {};
        Object.keys(settings.shareUrlPrefixes).forEach(function(key) {
            safeSettings.shareUrlPrefixes[key] = { service: settings.shareUrlPrefixes[key].service };
        });
    }
    if (settings.feedback && settings.feedback.additionalParameters) {
        safeSettings.additionalFeedbackParameters = settings.feedback.additionalParameters;
    }

    router.get('/', function(req, res, next) {
        res.status(200).send(safeSettings);
    });
    return router;
};
