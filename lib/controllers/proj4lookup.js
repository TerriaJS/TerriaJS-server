/* jshint node: true */
"use strict";
import { Router } from 'express';
var router = Router();

import proj4 from 'proj4';

//TODO: check if this loads the file into each core and if so then,
import epsg from "proj4js-defs/epsg.js";

epsg(proj4);

// GDA2020 proj4 string from https://gis.stackexchange.com/questions/349780/is-there-a-proj4-string-for-gda2020-epsg7844-that-we-use-to-transform-from-38
proj4.defs["EPSG:7844"] = "+proj=longlat +ellps=GRS80 +towgs84=-0.06155,0.01087,0.04019,-0.0394924,-0.0327221,-0.03289790,0.009994 +no_defs";
proj4.defs["EPSG:7855"] = "+proj=utm +zone=55 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs";
//provide REST service for proj4 definition strings
router.get('/:crs', function(req, res, next) {
    var epsg = proj4.defs[req.params.crs.toUpperCase()];
    if (epsg !== undefined) {
        res.status(200).send(epsg);
    } else {
        res.status(404).send('No proj4 definition available for this CRS.');
    }
});

export default router;
