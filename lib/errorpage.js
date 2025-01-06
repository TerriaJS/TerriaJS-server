export const error404 = function(show404, wwwroot, serveWwwRoot) {
    return function (req, res, next) {
        if (show404) {
            res.status(404).sendFile('/404.html', {root: wwwroot});
        } else if (serveWwwRoot) {
            // Redirect unknown pages back home.
            res.redirect(303, '/');
        } else {
            res.status(404).send('No TerriaJS website here.');
        }
    };
};

export const error500 = function(show500, wwwroot) {
    return function(error, req, res, next) {
        console.error(error);
        if (show500) {
            res.status(500).sendFile('/500.html', {root: wwwroot});
        } else {
            res.status(500).send('500: Internal Server Error');
        }
    };
};
