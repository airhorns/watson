profiler = require 'profiler'
{exec} = require 'child_process'
Data = require './objects'
Utils = require './utils'
Benchmark = require 'benchmark'
microtime = require 'microtime'
async = require 'async'

class Tracker
  metric: ''
  constructor: ->
    @points = []

  setup: (callback) ->
    @report = Data.Report.build(key: @key, metric: @metric)
    @_getSHADescription (err, sha, human) =>
      return callback(err) if err
      @report.sha = sha
      @report.human = human
      callback()

  finish: (callback) ->
    Data.Report.findAll(where: {sha: @report.sha, key: @key, metric: @metric}).success((oldReports) =>
      oldReport.destroyWithPoints() for oldReport in oldReports

      @report.save().error((error) ->
        callback(error)
      ).success(=>
        points = for point in @points
          Data.Point.build(x: point[0], y: point[1])

        @report.setPoints(points).success(->
          callback()
        ).error((error) ->
          callback(error)
        )
      )
    ).error (err) ->
      callback(err)

  _getSHADescription: (callback) ->
    exec 'git name-rev HEAD && git describe HEAD && git log --pretty=format:"%s (%an)" HEAD...HEAD~1', (err, stdout, stderr) ->
      [branch, sha, human] = stdout.toString().trim().split('\n')
      branch = branch.replace('HEAD ', '')
      human = "[#{branch}] #{human}"
      callback(err, sha, human)

class MemoryTracker extends Tracker
  metric: 'memory'
  defaultOptions:
    step: 10
    async: false

  constructor: (@key, @iterations, options, @f) ->
    super
    unless @f?
      @f = options
      options = {}
      unless @f?
        @f = @iterations
        @iterations = 1000

    if typeof options is 'number'
      options = {step: options}
    @options = Utils.extend {}, @defaultOptions, options

  run: (callback) ->
    @setup (err) =>
      return callback(err) if err
      poll = (i) =>
        if i % @options.step == 0
          profiler.gc()
          @record(i)

      finish = =>
        @finish (err) ->
          callback(err)

      unless @options.async
        for i in [0..@iterations]
          @f(i)
          poll(i)
        finish()
      else
        @i = 0
        step = =>
          @f @i, =>
            poll(@i)
            @i++

            # Pop the stack every 25 iterations
            if @i == @iterations
              return finish()
            else
              setTimeout step, 0
        step()

  record: (i) ->
    @points.push [i, process.memoryUsage().heapUsed]

class TimeTracker extends Tracker
  metric: 'time'
  constructor: (@name, callback) ->
    super
    @setup (error) =>
      @suite = new Benchmark.Suite name
      @suite.on 'error', (error, bench) =>
        @suite.abort()
        throw bench.error
      @suite.on 'complete', =>
        @suite.forEach (bench) =>
          console.log String(bench)
          @_saveReport bench, (err) ->
            throw err if err
            console.log "Report saved!"
      callback(error, @suite)

  setup: (callback) ->
    @_getSHADescription (err, sha, human) =>
      unless err
        @sha = sha
        @human = human
      callback(err)

  _saveReport: (benchmark, callback) =>
    key = "#{@name}: #{benchmark.name}"
    Data.Report.findAll(where: {sha: @sha, key: key, metric: @metric})
      .success((oldReports) =>
        oldReport.destroyWithPoints() for oldReport in oldReports

        report = Data.Report.build({sha: @sha, human: @human, key, metric: @metric})
        report.save().error((error) ->
          callback(error)
        ).success(=>
          dataPoint = Data.Point.build(x: 0, y: benchmark.stats.mean, note: "mean")
          marginOfErrorPoint = Data.Point.build(x: 1, y: benchmark.stats.rme, note: "relative margin of error")
          deviationPoint = Data.Point.build(x: 2, y: benchmark.stats.deviation, note: "deviation")
          sizeDataPoint = Data.Point.build(x: 3, y: benchmark.stats.sample.length, note: "size")

          report.setPoints([dataPoint, marginOfErrorPoint, deviationPoint, sizeDataPoint]).error((error) ->
            callback(error, report)
          ).success(->
            callback(undefined, report)
          )
        )
      )
      .error(callback)
    true

module.exports = {Tracker, MemoryTracker, TimeTracker}
