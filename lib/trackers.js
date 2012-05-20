(function() {
  var Benchmark, Data, MemoryTracker, TimeTracker, Tracker, Utils, async, exec, microtime, profiler,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  profiler = require('profiler');

  exec = require('child_process').exec;

  Data = require('./objects');

  Utils = require('./utils');

  Benchmark = require('benchmark');

  microtime = require('microtime');

  async = require('async');

  Tracker = (function() {

    Tracker.prototype.metric = '';

    function Tracker() {
      this.points = [];
    }

    Tracker.prototype.setup = function(callback) {
      var _this = this;
      this.report = Data.Report.build({
        key: this.key,
        metric: this.metric
      });
      return this._getSHADescription(function(err, sha, human) {
        if (err) {
          return callback(err);
        }
        _this.report.sha = sha;
        _this.report.human = human;
        return callback();
      });
    };

    Tracker.prototype.finish = function(callback) {
      var _this = this;
      return Data.Report.findAll({
        where: {
          sha: this.report.sha,
          key: this.key,
          metric: this.metric
        }
      }).success(function(oldReports) {
        var oldReport, _i, _len;
        for (_i = 0, _len = oldReports.length; _i < _len; _i++) {
          oldReport = oldReports[_i];
          oldReport.destroyWithPoints();
        }
        return _this.report.save().error(function(error) {
          return callback(error);
        }).success(function() {
          var point, points;
          points = (function() {
            var _j, _len1, _ref, _results;
            _ref = this.points;
            _results = [];
            for (_j = 0, _len1 = _ref.length; _j < _len1; _j++) {
              point = _ref[_j];
              _results.push(Data.Point.build({
                x: point[0],
                y: point[1]
              }));
            }
            return _results;
          }).call(_this);
          return _this.report.setPoints(points).success(function() {
            return callback();
          }).error(function(error) {
            return callback(error);
          });
        });
      }).error(function(err) {
        return callback(err);
      });
    };

    Tracker.prototype._getSHADescription = function(callback) {
      return exec('git name-rev HEAD && git describe HEAD && git log --pretty=format:"%s (%an)" HEAD...HEAD~1', function(err, stdout, stderr) {
        var branch, human, sha, _ref;
        _ref = stdout.toString().trim().split('\n'), branch = _ref[0], sha = _ref[1], human = _ref[2];
        branch = branch.replace('HEAD ', '');
        human = "[" + branch + "] " + human;
        return callback(err, sha, human);
      });
    };

    return Tracker;

  })();

  MemoryTracker = (function(_super) {

    __extends(MemoryTracker, _super);

    MemoryTracker.prototype.metric = 'memory';

    MemoryTracker.prototype.defaultOptions = {
      step: 10,
      async: false
    };

    function MemoryTracker(key, iterations, options, f) {
      this.key = key;
      this.iterations = iterations;
      this.f = f;
      MemoryTracker.__super__.constructor.apply(this, arguments);
      if (this.f == null) {
        this.f = options;
        options = {};
        if (this.f == null) {
          this.f = this.iterations;
          this.iterations = 1000;
        }
      }
      if (typeof options === 'number') {
        options = {
          step: options
        };
      }
      this.options = Utils.extend({}, this.defaultOptions, options);
    }

    MemoryTracker.prototype.run = function(callback) {
      var _this = this;
      return this.setup(function(err) {
        var finish, i, poll, step, _i, _ref;
        if (err) {
          return callback(err);
        }
        poll = function(i) {
          if (i % _this.options.step === 0) {
            profiler.gc();
            return _this.record(i);
          }
        };
        finish = function() {
          return _this.finish(function(err) {
            return callback(err);
          });
        };
        if (!_this.options.async) {
          for (i = _i = 0, _ref = _this.iterations; 0 <= _ref ? _i <= _ref : _i >= _ref; i = 0 <= _ref ? ++_i : --_i) {
            _this.f(i);
            poll(i);
          }
          return finish();
        } else {
          _this.i = 0;
          step = function() {
            return _this.f(_this.i, function() {
              poll(_this.i);
              _this.i++;
              if (_this.i === _this.iterations) {
                return finish();
              } else {
                return setTimeout(step, 0);
              }
            });
          };
          return step();
        }
      });
    };

    MemoryTracker.prototype.record = function(i) {
      return this.points.push([i, process.memoryUsage().heapUsed]);
    };

    return MemoryTracker;

  })(Tracker);

  TimeTracker = (function(_super) {

    __extends(TimeTracker, _super);

    TimeTracker.prototype.metric = 'time';

    function TimeTracker(name, callback) {
      var _this = this;
      this.name = name;
      this._saveReport = __bind(this._saveReport, this);

      TimeTracker.__super__.constructor.apply(this, arguments);
      this.setup(function(error) {
        _this.suite = new Benchmark.Suite(name);
        _this.suite.on('error', function(error, bench) {
          _this.suite.abort();
          throw bench.error;
        });
        _this.suite.on('complete', function() {
          return _this.suite.each(function(bench) {
            console.log(String(bench));
            return _this._saveReport(bench, function(err) {
              if (err) {
                throw err;
              }
              return console.log("Report saved!");
            });
          });
        });
        return callback(error, _this.suite);
      });
    }

    TimeTracker.prototype.setup = function(callback) {
      var _this = this;
      return this._getSHADescription(function(err, sha, human) {
        if (!err) {
          _this.sha = sha;
          _this.human = human;
        }
        return callback(err);
      });
    };

    TimeTracker.prototype._saveReport = function(benchmark, callback) {
      var key,
        _this = this;
      key = "" + this.name + ": " + benchmark.name;
      Data.Report.findAll({
        where: {
          sha: this.sha,
          key: key,
          metric: this.metric
        }
      }).success(function(oldReports) {
        var oldReport, report, _i, _len;
        for (_i = 0, _len = oldReports.length; _i < _len; _i++) {
          oldReport = oldReports[_i];
          oldReport.destroyWithPoints();
        }
        report = Data.Report.build({
          sha: _this.sha,
          human: _this.human,
          key: key,
          metric: _this.metric
        });
        return report.save().error(function(error) {
          return callback(error);
        }).success(function() {
          var dataPoint, deviationPoint, marginOfErrorPoint, sizeDataPoint;
          dataPoint = Data.Point.build({
            x: 0,
            y: benchmark.stats.mean,
            note: "mean"
          });
          marginOfErrorPoint = Data.Point.build({
            x: 1,
            y: benchmark.stats.rme,
            note: "relative margin of error"
          });
          deviationPoint = Data.Point.build({
            x: 2,
            y: benchmark.stats.deviation,
            note: "deviation"
          });
          sizeDataPoint = Data.Point.build({
            x: 3,
            y: benchmark.stats.size,
            note: "size"
          });
          return report.setPoints([dataPoint, marginOfErrorPoint, deviationPoint, sizeDataPoint]).error(function(error) {
            return callback(error, report);
          }).success(function() {
            return callback(void 0, report);
          });
        });
      }).error(callback);
      return true;
    };

    return TimeTracker;

  })(Tracker);

  module.exports = {
    Tracker: Tracker,
    MemoryTracker: MemoryTracker,
    TimeTracker: TimeTracker
  };

}).call(this);
