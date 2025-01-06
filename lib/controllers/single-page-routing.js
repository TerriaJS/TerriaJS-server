/* jshint node: true */
'use strict';
import fs from 'fs';
import { Router } from "express";

var router = Router();

export default function(options, spaOptions) {
    if (!options || !spaOptions.resolveUnmatchedPathsWithIndexHtml) {
        return;
    }

    const resolvePathRelativeToWwwroot = spaOptions.resolvePathRelativeToWwwroot;

    // throw because a tjs-server user really intended to resolve unmatched paths, but we can't find the file to resolve
    if (!fs.existsSync(options.wwwroot + resolvePathRelativeToWwwroot)) {
      throw new Error("`resolveUnmatchedPathsWithIndexHtml` was true but path specified on `resolvePathRelativeToWwwroot` does not exist");
    }

    router.get('*', function (req, res, next) {
      res.sendFile(resolvePathRelativeToWwwroot, {root: options.wwwroot});
    });
    if (options.verbose) {
        console.log('Resolving unmatched routes to index.html');
    }

    return router;
};
