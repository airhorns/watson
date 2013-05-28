Benchmark = require 'benchmark'
async     = require 'async'
reqwest   = require './reqwest.min'

getUrlVars = ->
  vars = {}
  window.location.href.replace /[?&]+([^=&]+)=([^&]*)/gi, (m,key,value) ->
    vars[key] = value
  vars


class Tracker
  constructor: ->
    @points = []

  _saveReport: (data, callback) =>
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
      success: (resp) ->
        console.log "Report saved!"
        callback(null)
      error: (err) -> callback(err)

  _killWorker: (callback) ->
    token = getUrlVars()['token']
    if token?
      reqwest
        url: "/kill_worker/#{token}"
        method: 'post'
        type: 'json'
        data: '{"success":true}'
        contentType: 'application/json'
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
      async.each @suite, @_saveReport, @_killWorker
    callback(null, @suite, @)

module.exports = {TimeTracker}
