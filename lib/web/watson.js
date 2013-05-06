(function() {
  var Benchmark, Trackers;

  Trackers = require('./trackers');

  Benchmark = window.Benchmark = require('benchmark');

  module.exports = {
    Benchmark: Benchmark,
    trackMemory: function() {
      throw new Error("Sorry, memory tracking is disabled in the browser cause I donno how to ask the VM how much memory is consumed at the moment. The future is coming however, fear not!");
    },
    benchmark: function() {
      var tracker;

      return tracker = (function(func, args, ctor) {
        ctor.prototype = func.prototype;
        var child = new ctor, result = func.apply(child, args);
        return Object(result) === result ? result : child;
      })(Trackers.TimeTracker, arguments, function(){});
    },
    ensureCommitted: function(sha, callback) {
      return callback();
    },
    makeADom: function() {
      return true;
    }
  };

}).call(this);
