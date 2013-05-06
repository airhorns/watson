(function() {
  var Data, Watson, async, cli, getGitShas, getReports, indexedBy, messageWithList, report, uniq;

  Watson = require('../watson');

  Data = require('../objects');

  async = require('async');

  cli = require('cli');

  messageWithList = function(message, list) {
    return message + " \n - " + list.join('\n - ');
  };

  uniq = function(arr) {
    return Object.keys(arr.reduce((function(acc, item) {
      acc[item] = true;
      return acc;
    }), {}));
  };

  indexedBy = function(arr, key) {
    return arr.reduce((function(acc, item) {
      var itemKey, _ref;

      itemKey = item[key];
      if ((_ref = acc[itemKey]) == null) {
        acc[itemKey] = [];
      }
      acc[itemKey].push(item);
      return acc;
    }), {});
  };

  report = function(shasAndRevs, reports) {
    var i, sha, shasList;

    cli.info(messageWithList("Reporting on these keys:", uniq(reports.map(function(r) {
      return r.key;
    }))));
    shasList = (function() {
      var _i, _len, _ref, _results;

      _ref = shasAndRevs.shas;
      _results = [];
      for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
        sha = _ref[i];
        _results.push("" + sha + " (" + shasAndRevs.revs[i] + ")");
      }
      return _results;
    })();
    if (shasList.length > 0) {
      cli.info(messageWithList("across these SHAs:", shasList));
    } else {
      cli.info("across all available shas");
    }
    reports = indexedBy(reports, 'key');
    return async.eachSeries(Object.keys(reports), function(key, callback) {
      var reportsForSha;

      cli.info("Report: " + key);
      reportsForSha = reports[key];
      return reportsForSha.forEach(function(report) {
        return report.getPoints().on('error', function(e) {
          throw e;
        }).on('success', function(points) {
          if (points.length > 0) {
            points = indexedBy(points, 'note');
            console.log("Result on " + report.sha + ": " + (points.mean[0].y * 1000) + " +- " + points["relative margin of error"][0].y + " " + report.human);
          } else {
            console.warn("No points found for " + report.sha);
          }
          return callback();
        });
      });
    });
  };

  getReports = function(options, callback, gitResults) {
    var conditions, reportNames;

    if ((options.reports == null) || (reportNames = options.reports.split(',')).length === 0) {
      return Watson.Report.getAvailableKeys().error(callback).success(function(keys) {
        cli.info(messageWithList("No reports given. Available reports:", keys));
        return callback(new Error());
      });
    } else {
      conditions = {
        key: [reportNames]
      };
      if (gitResults.getGits.shas.length > 0) {
        conditions.sha = gitResults.getGits.shas;
      }
      return Watson.Report.findAll({
        where: conditions
      }).error(callback).success(function(reports) {
        if (reports.length > 0) {
          return callback(null, reports);
        } else {
          cli.error(messageWithList("Couldn't find any reports matching the provided keys:", reportNames));
          return callback(new Error());
        }
      });
    }
  };

  getGitShas = function(shas, callback) {
    if (shas.length === 0) {
      return callback(null, {
        shas: [],
        revs: []
      });
    } else {
      return Watson.Utils.describeRevs(shas, callback);
    }
  };

  exports.command = function(args, options, config) {
    Watson.connect();
    return async.auto({
      getGits: getGitShas.bind(this, args),
      getReports: ['getGits', getReports.bind(this, options)],
      report: [
        'getGits', 'getReports', (function(callback, results) {
          return report(results.getGits, results.getReports);
        })
      ]
    }, function(err) {
      if (err) {
        cli.error(err);
        return process.exit(1);
      }
    });
  };

  exports.report = report;

}).call(this);
