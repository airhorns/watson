(function() {
  var Benchmark, Coffee, Trackers, Utils, Watson, exec;

  Coffee = require('coffee-script');

  Benchmark = require('benchmark');

  exec = require('child_process').exec;

  Utils = require('./utils');

  Trackers = false;

  Watson = {
    Utils: Utils,
    Benchmark: Benchmark,
    trackMemory: function() {
      var tracker;
      Watson.connect();
      tracker = (function(func, args, ctor) {
        ctor.prototype = func.prototype;
        var child = new ctor, result = func.apply(child, args), t = typeof result;
        return t == "object" || t == "function" ? result || child : child;
      })(Trackers.MemoryTracker, arguments, function(){});
      return tracker.run(function(err) {
        if (err) {
          throw err;
        }
        return console.log("Tracker run!");
      });
    },
    benchmark: function() {
      var tracker;
      Watson.connect();
      return tracker = (function(func, args, ctor) {
        ctor.prototype = func.prototype;
        var child = new ctor, result = func.apply(child, args), t = typeof result;
        return t == "object" || t == "function" ? result || child : child;
      })(Trackers.TimeTracker, arguments, function(){});
    },
    ensureCommitted: function(sha, callback) {
      var cmd;
      cmd = "[ $(git merge-base " + sha + " HEAD) = $(git rev-parse --verify " + sha + "^{commit}) ]";
      return exec(cmd, function(err, stdout, stderr) {
        if (err) {
          console.error("" + sha + " isn't an ancestor, skipping this test.");
          return process.exit(0);
        } else {
          return typeof callback === "function" ? callback() : void 0;
        }
      });
    },
    connect: function(options) {
      var connection, k, v, _ref;
      if (options == null) {
        options = {};
      }
      Utils.getConfiguration(options.config);
      connection = Utils.connect();
      Trackers = require('./trackers');
      _ref = require('./objects');
      for (k in _ref) {
        v = _ref[k];
        Watson[k] = v;
      }
      return connection;
    }
  };

  module.exports = Watson;

}).call(this);
