Coffee = require 'coffee-script'
Benchmark = require 'benchmark'
{exec} = require 'child_process'
Utils = require './utils'

Trackers = false
Watson =
  Utils: Utils
  Benchmark: Benchmark
  trackMemory: ->
    Watson.connect()
    tracker = new Trackers.MemoryTracker(arguments...)
    tracker.run (err) ->
      throw err if err
      console.log "Tracker run!"

  benchmark: ->
    Watson.connect()
    tracker = new Trackers.TimeTracker(arguments...)

  ensureCommitted: (sha, callback) ->
    cmd = "[ $(git merge-base #{sha} HEAD) = $(git rev-parse --verify #{sha}^{commit}) ]"
    exec cmd, (err, stdout, stderr) ->
      if err
        console.error "#{sha} isn't an ancestor, skipping this test."
        process.exit 0
      else
        callback?()

  connect: (options = {}) ->
    Utils.getConfiguration(options.config)
    Utils.connect()
    Trackers = require './trackers'
    Watson[k] = v for k, v of (require './objects')

module.exports = Watson
