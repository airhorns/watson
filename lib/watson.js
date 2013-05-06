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
    makeADom: function() {
      var jsdom;

      jsdom = require('jsdom');
      global.window = jsdom.jsdom("<html><head><script></script></head><body></body></html>").createWindow();
      global.document = window.document;
      return global.Benchmark = Benchmark;
    },
    trackMemory: function() {
      var tracker;

      Watson.connect();
      tracker = (function(func, args, ctor) {
        ctor.prototype = func.prototype;
        var child = new ctor, result = func.apply(child, args);
        return Object(result) === result ? result : child;
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
        var child = new ctor, result = func.apply(child, args);
        return Object(result) === result ? result : child;
      })(Trackers.TimeTracker, arguments, function(){});
    },
    ensureCommitted: function(sha, callback) {
      Watson.Utils.checkCommited(sha, function(err, committed) {});
      if (err) {
        throw err;
      }
      if (committed) {
        return typeof callback === "function" ? callback() : void 0;
      } else {
        console.error("" + sha + " isn't an ancestor, skipping this test.");
        return process.exit(0);
      }
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
