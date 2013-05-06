Benchmark = require 'benchmark'
reqwest   = require './reqwest.min'

class Tracker
  constructor: ->
    @points = []

  _saveReport: (data, callback) ->
    reqwest
      url: '/save_results'
      method: 'post'
      type: 'json'
      contentType: 'application/json'
      data: JSON.stringify {
        metric: @metric
        name: @name
        data: data
      }
      success: (resp) -> callback(null)
      error: (err) -> callback(err)

class TimeTracker extends Tracker
  metric: 'times'

  constructor: (@name, callback) ->
    super
    @suite = new Benchmark.Suite name
    @suite.on 'error', (error, bench) =>
      @suite.abort()
      throw bench.error
    @suite.on 'complete', =>
      @suite.forEach (bench) =>
        @_saveReport bench, (err) ->
          throw err if err
          console.log "Report saved!"
    callback(null, @suite, @)

module.exports = {TimeTracker}
