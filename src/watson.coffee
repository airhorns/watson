Coffee = require 'coffee-script'
Benchmark = require 'benchmark'
{exec} = require 'child_process'
Utils = require './utils'

Trackers = false

Watson =
  Utils: Utils
  Benchmark: Benchmark

  makeADom: ->
    jsdom = require 'jsdom'
    global.window = jsdom.jsdom("<html><head><script></script></head><body></body></html>").createWindow()
    global.document = window.document
    global.Benchmark = Benchmark

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
    Watson.Utils.checkCommited sha, (err, committed) ->
    throw err if err
    if committed
      callback?()
    else
      console.error "#{sha} isn't an ancestor, skipping this test."
      process.exit 0

  connect: (options = {}) ->
    Utils.getConfiguration(options.config)
    connection = Utils.connect()
    Trackers = require './trackers'
    Watson[k] = v for k, v of (require './objects')
    connection

module.exports = Watson
