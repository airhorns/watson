Trackers = require './trackers'
Benchmark = window.Benchmark = require 'benchmark'

module.exports =
  Benchmark: Benchmark
  trackMemory: ->
    throw new Error("Sorry, memory tracking is disabled in the browser cause I donno how to ask the VM how much memory is consumed at the moment. The future is coming however, fear not!")

  benchmark: ->
    tracker = new Trackers.TimeTracker(arguments...)

  ensureCommitted: (sha, callback) -> callback()
