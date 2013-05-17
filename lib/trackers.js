(function() {
  var Benchmark, Data, MemoryTracker, ProfileTracker, TimeTracker, Tracker, Utils, async, exec, microtime, profiler, _ref,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

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
      this.userAgent = "node " + process.version;
      this.os = process.platform;
      this.cwd = void 0;
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
      var options;

      options = {};
      if (this.cwd) {
        options.cwd = this.cwd;
      }
      return exec('git name-rev HEAD && git describe HEAD && git log --pretty=format:"%s (%an)" HEAD...HEAD~1', options, function(err, stdout, stderr) {
        var branch, human, sha, _ref;

        _ref = stdout.toString().trim().split('\n'), branch = _ref[0], sha = _ref[1], human = _ref[2];
        branch = branch.replace('HEAD ', '');
        human = "[" + branch + "] " + human;
        return callback(err, sha, human, branch);
      });
    };

    return Tracker;

  })();

  ProfileTracker = (function(_super) {
    __extends(ProfileTracker, _super);

    function ProfileTracker() {
      this.setup = __bind(this.setup, this);      _ref = ProfileTracker.__super__.constructor.apply(this, arguments);
      return _ref;
    }

    ProfileTracker.prototype.sha = null;

    ProfileTracker.prototype.human = null;

    ProfileTracker.prototype.branchy = null;

    ProfileTracker.prototype.setup = function(callback) {
      var sequelize,
        _this = this;

      sequelize = Utils.connect();
      sequelize.query('describe ProfilerReports').success(function(rows) {
        console.warn('rows.text.type = ' + rows.text.type);
        if (rows.text.type === 'TEXT') {
          return sequelize.query('alter table ProfilerReports MODIFY text LONGTEXT');
        }
      });
      return this._getSHADescription(function(err, sha, human, branch) {
        if (err) {
          return callback(err);
        }
        _this.sha = sha;
        _this.human = human;
        _this.branchy = branch;
        return callback();
      });
    };

    ProfileTracker.prototype.finish = function(callback) {
      var _this = this;

      return Data.ProfilerReport.findAll({
        where: {
          sha: this.sha,
          test: this.test
        }
      }).success(function(oldReports) {
        var oldReport, opts, profile, _i, _len;

        opts = {
          sha: _this.sha,
          test: _this.test,
          text: _this.text,
          branch: _this.branchy,
          human: _this.human
        };
        for (_i = 0, _len = oldReports.length; _i < _len; _i++) {
          oldReport = oldReports[_i];
          oldReport.destroy();
        }
        profile = Data.ProfilerReport.build(opts);
        return profile.save().error(function(err) {
          return callback(err);
        });
      }).error(function(err) {
        return callback(err);
      });
    };

    return ProfileTracker;

  })(Tracker);

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
        var finish, i, poll, step, _i, _ref1;

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
          for (i = _i = 0, _ref1 = _this.iterations; 0 <= _ref1 ? _i <= _ref1 : _i >= _ref1; i = 0 <= _ref1 ? ++_i : --_i) {
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
          return _this.suite.forEach(function(bench) {
            console.log(String(bench));
            return _this._saveReport(bench, function(err) {
              if (err) {
                throw err;
              }
              return console.log("Report saved!");
            });
          });
        });
        return callback(error, _this.suite, _this);
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
      var _this = this;

      this.key = "" + this.name + ": " + benchmark.name;
      Data.Report.findAll({
        where: this._reportParams()
      }).success(function(oldReports) {
        var oldReport, params, report, _i, _len;

        for (_i = 0, _len = oldReports.length; _i < _len; _i++) {
          oldReport = oldReports[_i];
          oldReport.destroyWithPoints();
        }
        params = _this._reportParams();
        params.human = _this.human;
        report = Data.Report.build(params);
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
            y: benchmark.stats.sample.length,
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

    TimeTracker.prototype._reportParams = function() {
      return {
        sha: this.sha,
        metric: this.metric,
        userAgent: this.userAgent,
        os: this.os,
        key: this.key
      };
    };

    return TimeTracker;

  })(Tracker);

  module.exports = {
    Tracker: Tracker,
    MemoryTracker: MemoryTracker,
    TimeTracker: TimeTracker,
    ProfileTracker: ProfileTracker
  };

}).call(this);
