(function() {
  var Benchmark, TimeTracker, Tracker, reqwest,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Benchmark = require('benchmark');

  reqwest = require('./reqwest.min');

  Tracker = (function() {
    function Tracker() {
      this.points = [];
    }

    Tracker.prototype._saveReport = function(data, callback) {
      return reqwest({
        url: '/save_results',
        method: 'post',
        type: 'json',
        contentType: 'application/json',
        data: JSON.stringify({
          metric: this.metric,
          name: this.name,
          data: data
        }),
        success: function(resp) {
          return callback(null);
        },
        error: function(err) {
          return callback(err);
        }
      });
    };

    return Tracker;

  })();

  TimeTracker = (function(_super) {
    __extends(TimeTracker, _super);

    TimeTracker.prototype.metric = 'times';

    function TimeTracker(name, callback) {
      var _this = this;

      this.name = name;
      TimeTracker.__super__.constructor.apply(this, arguments);
      this.suite = new Benchmark.Suite(name);
      this.suite.on('error', function(error, bench) {
        bject;        _this.suite.abort();
        throw bench.error;
      });
      this.suite.on('complete', function() {
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
      callback(null, this.suite, this);
    }

    return TimeTracker;

  })(Tracker);

  module.exports = {
    TimeTracker: TimeTracker
  };

}).call(this);
