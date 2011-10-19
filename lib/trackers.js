(function() {
  var Benchmark, Data, MemoryTracker, TimeTracker, Tracker, Utils, exec, microtime, profiler;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; }, __slice = Array.prototype.slice, __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) {
    for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; }
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor;
    child.__super__ = parent.prototype;
    return child;
  };
  profiler = require('profiler');
  exec = require('child_process').exec;
  Data = require('./objects');
  Utils = require('./utils');
  Benchmark = require('benchmark');
  microtime = require('microtime');
  Tracker = (function() {
    Tracker.prototype.metric = '';
    function Tracker() {
      this.points = [];
    }
    Tracker.prototype.setup = function(callback) {
      this.report = Data.Report.build({
        key: this.key,
        metric: this.metric
      });
      return this._getSHADescription(__bind(function(err, sha, human) {
        if (err) {
          return callback(err);
        }
        this.report.sha = sha;
        this.report.human = human;
        return callback();
      }, this));
    };
    Tracker.prototype.finish = function(callback) {
      return Data.Report.findAll({
        where: {
          sha: this.report.sha,
          key: this.key,
          metric: this.metric
        }
      }).on('success', __bind(function(oldReports) {
        var oldReport, _i, _len;
        for (_i = 0, _len = oldReports.length; _i < _len; _i++) {
          oldReport = oldReports[_i];
          oldReport.destroyWithPoints();
        }
        return this.report.save().on('failure', function(error) {
          return callback(error);
        }).on('success', __bind(function() {
          var point, points;
          points = (function() {
            var _j, _len2, _ref, _results;
            _ref = this.points;
            _results = [];
            for (_j = 0, _len2 = _ref.length; _j < _len2; _j++) {
              point = _ref[_j];
              _results.push(Data.Point.build({
                x: point[0],
                y: point[1]
              }));
            }
            return _results;
          }).call(this);
          return this.report.setPoints(points).on('success', function() {
            return callback();
          }).on('error', function(error) {
            return callback(error);
          });
        }, this));
      }, this));
    };
    Tracker.prototype._getSHADescription = function(callback) {
      return exec('git describe HEAD && git log --pretty=format:"%s (%an)" HEAD...HEAD~1', function(err, stdout, stderr) {
        return callback.apply(null, [err].concat(__slice.call(stdout.toString().trim().split('\n'))));
      });
    };
    return Tracker;
  })();
  MemoryTracker = (function() {
    __extends(MemoryTracker, Tracker);
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
      return this.setup(__bind(function(err) {
        var finish, i, poll, step, _ref;
        if (err) {
          return callback(err);
        }
        poll = __bind(function(i) {
          if (i % this.options.step === 0) {
            profiler.gc();
            return this.record(i);
          }
        }, this);
        finish = __bind(function() {
          return this.finish(function(err) {
            return callback(err);
          });
        }, this);
        if (!this.options.async) {
          for (i = 0, _ref = this.iterations; 0 <= _ref ? i <= _ref : i >= _ref; 0 <= _ref ? i++ : i--) {
            this.f(i);
            poll(i);
          }
          return finish();
        } else {
          this.i = 0;
          step = __bind(function() {
            return this.f(this.i, __bind(function() {
              poll(this.i);
              this.i++;
              if (this.i === this.iterations) {
                return finish();
              } else {
                return setTimeout(step, 0);
              }
            }, this));
          }, this);
          return step();
        }
      }, this));
    };
    MemoryTracker.prototype.record = function(i) {
      return this.points.push([i, process.memoryUsage().heapUsed]);
    };
    return MemoryTracker;
  })();
  TimeTracker = (function() {
    __extends(TimeTracker, Tracker);
    TimeTracker.prototype.metric = 'time';
    function TimeTracker(name, callback) {
      this.name = name;
      TimeTracker.__super__.constructor.apply(this, arguments);
      this.setup(__bind(function(error) {
        this.suite = new Benchmark.Suite(name);
        this.suite.on('error', __bind(function(error, bench) {
          this.suite.abort();
          throw bench.error;
        }, this));
        this.suite.on('complete', __bind(function() {
          console.log("Benchmarks completed.");
          return this.suite.each(__bind(function(bench) {
            console.log(String(bench));
            return this._saveReport(bench, __bind(function(error, report) {
              if (error) {
                throw error;
              }
              return console.log("Report saved!");
            }, this));
          }, this));
        }, this));
        return callback(error, this.suite);
      }, this));
    }
    TimeTracker.prototype.setup = function(callback) {
      return this._getSHADescription(__bind(function(err, sha, human) {
        if (!err) {
          this.sha = sha;
          this.human = human;
        }
        return callback(err);
      }, this));
    };
    TimeTracker.prototype._saveReport = function(benchmark, callback) {
      var key;
      key = "" + this.name + ": " + benchmark.name;
      return Data.Report.findAll({
        where: {
          sha: this.sha,
          key: key,
          metric: this.metric
        }
      }).on('success', __bind(function(oldReports) {
        var oldReport, report, _i, _len;
        for (_i = 0, _len = oldReports.length; _i < _len; _i++) {
          oldReport = oldReports[_i];
          oldReport.destroyWithPoints();
        }
        report = Data.Report.build({
          sha: this.sha,
          human: this.human,
          key: key,
          metric: this.metric
        });
        return report.save().on('failure', function(error) {
          return callback(error);
        }).on('success', __bind(function() {
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
          return report.setPoints([dataPoint, marginOfErrorPoint, deviationPoint, sizeDataPoint]).on('error', function(error) {
            return callback(error, report);
          }).on('success', function() {
            return callback(void 0, report);
          });
        }, this));
      }, this));
    };
    return TimeTracker;
  })();
  module.exports = {
    Tracker: Tracker,
    MemoryTracker: MemoryTracker,
    TimeTracker: TimeTracker
  };
}).call(this);
