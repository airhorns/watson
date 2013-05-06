Watson = require '../watson'
Data   = require '../objects'
async  = require 'async'
cli    = require 'cli'

messageWithList = (message, list) ->
  message + " \n - " + list.join('\n - ')

uniq = (arr) ->
  Object.keys(arr.reduce ((acc, item) -> acc[item] = true; acc), {} )

indexedBy = (arr, key) ->
  arr.reduce(((acc, item) ->
    itemKey = item[key]
    acc[itemKey] ?= []
    acc[itemKey].push item
    acc
  ), {})

report = (shasAndRevs, reports) ->
  cli.info messageWithList("Reporting on these keys:", uniq(reports.map((r) -> r.key)))

  shasList = for sha, i in shasAndRevs.shas
    "#{sha} (#{shasAndRevs.revs[i]})"
  if shasList.length > 0
    cli.info messageWithList("across these SHAs:", shasList)
  else
    cli.info "across all available shas"

  reports = indexedBy(reports, 'key')

  async.eachSeries Object.keys(reports), (key, callback) ->
    cli.info "Report: #{key}"

    reportsForSha = reports[key]
    reportsForSha.forEach (report) ->
      report.getPoints().on('error', (e) -> throw e).on('success', (points) ->
        if points.length > 0
          points = indexedBy(points, 'note')
          console.log "Result on #{report.sha}: #{points.mean[0].y * 1000} +- #{points["relative margin of error"][0].y} #{report.human}"
        else
          console.warn "No points found for #{report.sha}"
        callback()
      )

getReports = (options, callback, gitResults) ->
  if !options.reports? || (reportNames = options.reports.split(',')).length == 0
    Watson.Report.getAvailableKeys().error(callback).success (keys) ->
      cli.info messageWithList("No reports given. Available reports:", keys)
      callback(new Error())
  else
    conditions = {key: [reportNames]}
    conditions.sha = gitResults.getGits.shas if gitResults.getGits.shas.length > 0

    Watson.Report.findAll(where: conditions).error(callback).success (reports) ->
      if reports.length > 0
        callback(null, reports)
      else
        cli.error messageWithList("Couldn't find any reports matching the provided keys:", reportNames)
        callback(new Error())

getGitShas = (shas, callback) ->
  if shas.length == 0
    callback(null, {shas: [], revs: []})
  else
    Watson.Utils.describeRevs(shas, callback)

exports.command = (args, options, config) ->
  Watson.connect()

  async.auto({
    getGits: getGitShas.bind(@, args)
    getReports: ['getGits', getReports.bind(@, options)]
    report: ['getGits', 'getReports', ((callback, results) ->
      report(results.getGits, results.getReports)
    )]}
  , (err) ->
    if err
      cli.error(err)
      process.exit(1)
  )

exports.report = report
