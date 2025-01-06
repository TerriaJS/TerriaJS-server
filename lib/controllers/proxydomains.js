/* jshint node: true */
'use strict';
import { Router } from "express";

var router = Router();

export default function(options) {
    router.get('/', function(req, res, next) {
        res.status(200).send(options);
    });
    return router;
};
