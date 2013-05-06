(function() {
  var TEMPLATE, Trackers, Watson, browserify, cli, coffee, coffeeify, express, fs, path, uaparser, url;

  Watson = require('../watson');

  Trackers = require('../trackers');

  coffee = require('coffee-script');

  express = require('express');

  cli = require('cli');

  fs = require('fs');

  path = require('path');

  url = require('url');

  browserify = require('browserify');

  coffeeify = require('coffeeify');

  uaparser = require('ua-parser');

  TEMPLATE = function(filename, script) {
    return "<html>\n  <head>\n    <title>Watson - " + filename + "</title>\n    <script type=\"text/javascript\" src=\"/watson/html5shiv.js\"></script>\n    <script type=\"text/javascript\" src=\"/watson/es5-shim.min.js\"></script>\n    <script type=\"text/javascript\" src=\"/watson/es5-sham.min.js\"></script>\n  </head>\n  <body>\n    <h1>Watson - " + filename + "</h1>\n    <ul id=\"results\"></ul>\n    <script type=\"text/javascript\">\n    " + script + "\n    </script>\n  </body>\n</html>";
  };

  exports.command = function(args, options, config) {
    var app, testDir;

    testDir = config['tests'];
    app = express();
    app.use(express.logger());
    app.use(express.json());
    app.get('/', function(req, res, next) {
      return res.redirect("/tests/");
    });
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
    app.post('/save_results', function(req, res, next) {
      var data, userAgent;

      data = req.body;
      userAgent = uaparser.parse(req.get("User-Agent"));
      switch (data.metric) {
        case 'times':
          return new Trackers.TimeTracker(data.name, function(err, suite, tracker) {
            if (err) {
              return next(err);
            }
            tracker.userAgent = userAgent.ua.toString();
            tracker.os = userAgent.os.toString();
            return tracker._saveReport(data.data, function(err) {
              if (err) {
                return next(err);
              }
              res.json({
                success: true
              });
              return res.end();
            });
          });
        default:
          return res.json(402, {
            status: "unknown metric"
          });
      }
    });
    app.use('/watson', express["static"](path.join(__dirname, '..', 'web')));
    app.listen(5000);
    return cli.info("Watson listening on port 5000");
  };

}).call(this);
