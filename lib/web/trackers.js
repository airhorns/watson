(function() {
  var Benchmark, TimeTracker, Tracker, async, getUrlVars, reqwest,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Benchmark = require('benchmark');

  async = require('async');

  reqwest = require('./reqwest.min');

  getUrlVars = function() {
    var vars;

    vars = {};
    window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m, key, value) {
      return vars[key] = value;
    });
    return vars;
  };

  Tracker = (function() {
    function Tracker() {
      this._saveReport = __bind(this._saveReport, this);      this.points = [];
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
          console.log("Report saved!");
          return callback(null);
        },
        error: function(err) {
          return callback(err);
        }
      });
    };

    Tracker.prototype._killWorker = function(callback) {
      var token;

      token = getUrlVars()['token'];
      if (token != null) {
        return reqwest({
          url: "/kill_worker/" + token,
          method: 'post',
          type: 'json',
          data: '{"success":true}',
          contentType: 'application/json',
          success: function(resp) {
            return callback(null);
          },
          error: function(err) {
            return callback(err);
          }
        });
      }
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
        _this.suite.abort();
        throw bench.error;
      });
      this.suite.on('complete', function() {
        return async.each(_this.suite, _this._saveReport, _this._killWorker);
      });
      callback(null, this.suite, this);
    }

    return TimeTracker;

  })(Tracker);

  module.exports = {
    TimeTracker: TimeTracker
  };

}).call(this);
