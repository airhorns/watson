(function() {
  var Data, TEMPLATE, Watson, browserify, cli, coffee, coffeeify, express, fs, path, url;

  Watson = require('../watson');

  Data = require('../objects');

  coffee = require('coffee-script');

  express = require('express');

  cli = require('cli');

  fs = require('fs');

  path = require('path');

  url = require('url');

  browserify = require('browserify');

  coffeeify = require('coffeeify');

  TEMPLATE = function(filename, script) {
    return "<html>\n  <head>\n    <title>Watson - " + filename + "</title>\n  </head>\n  <body>\n    <h1>Watson - " + filename + "</h1>\n  </body>\n  <script>\n  " + script + "\n  </script>\n</html>";
  };

  exports.command = function(args, options, config) {
    var app, testDir;

    testDir = config['tests'];
    app = express();
    app.use(express.logger());
    app.get('/report.html', function(req, res, next) {
      var packager, testFile, testFilePath;

      res.set('Content-Type', 'text/html');
      cli.info("Serving " + req.params);
      testFile = req.query['file'];
      if (testFile == null) {
        next(new Error("File parameter needed"));
        return;
      }
      testFilePath = path.join(testDir, testFile);
      packager = browserify(testFilePath);
      packager.transform(coffeeify);
      return packager.bundle(function(err, script) {
        if (err) {
          return next(err);
        }
        return res.send(TEMPLATE(testFilePath, script));
      });
    });
    app.use('/tests', function(req, res, next) {
      var pathname;

      if ('GET' !== req.method && 'HEAD' !== req.method) {
        return next();
      }
      pathname = url.parse(req.url).pathname;
      if (/\.coffee$/.test(pathname)) {
        return res.redirect("/report.html?file=" + pathname);
      } else {
        return next();
      }
    });
    app.use('/tests', express.directory(testDir));
    app.use('/tests', express["static"](testDir));
    app.post('/results', function(req, res) {});
    app.listen(5000);
    return cli.info("Watson listening on port 5000");
  };

}).call(this);
