cli    = require 'cli'
crypto = require 'crypto'
Utils  = require '../utils'
Data   = require '../objects'

$extend = (root, objs...) ->
  for obj in objs
    root[k] = v for own k,v of obj
  root

printBrowser = (b) -> "#{b.browser}#{if b.browser_version then ' v'+b.browser_version else ''} on #{b.os} #{b.os_version}, on #{b.device || 'default device'}"
printWorker  = (w) -> "Worker #{w.id} with status #{w.status}"

destroyRecordsForWorkerIds = (workerIds, inclusive = true, callback) ->
  sql = if workerIds.length > 0
    condition = if inclusive then "" else "NOT"
    "worker_id #{condition} IN (#{workerIds.join()})"
  else
    "1=1"

  Data.BrowserWorker.findAll({where: sql}).fail((e) -> throw e).success (records) ->
    for record in records
      record.destroy().fail((e) -> throw e)
    callback?(records)

defaultStack = [
  ["chrome", "27.0", "OS X", "Mountain Lion"]
  ["chrome", "18.0", "Windows", "XP"]
  ["firefox", "20.0", "OS X", "Mountain Lion"]
  ["firefox", "5.0", "Windows", "XP"]
  ["opera", "12.0", "OS X", "Mountain Lion"]
  ["safari", "6.0", "OS X", "Mountain Lion"]
  ["safari", "5.0", "Windows", "XP"]
  ["ie", "10.0", "Windows", "8"]
  ["ie", "9.0", "Windows", "7"]
  ["ie", "8.0", "Windows", "XP"]
  ["Mobile Safari", null, "ios", "5.0", "iPad 2 (5.0)"]
].map (settings) ->
  [browser, browser_version, os, os_version, device] = settings
  hash = {browser, browser_version, os, os_version, device}
  if hash.device
    delete hash['browser']
  else
    delete hash['device']

  for k, v of hash
    delete hash[k] unless v?

  hash

exports.command = (args, options, config) ->
  client = Utils.browserStack()

  switch args[0]
    when 'kill_all'
      client.getWorkers (err, workers) ->
        throw err if err
        destroyRecordsForWorkerIds workers.map((w) -> w.id), true
        workers.forEach (worker) ->
          client.terminateWorker worker.id, (err) ->
            throw err if err
            cli.info "Terminated worker #{worker.id}"

        if workers.length == 0
          cli.info "No workers to kill."

    when 'start'
      urls = args.slice(1)
      unless urls.length > 0
        cli.error "Please provide some URLs to hit"
        return
      for url in urls
        defaultStack.forEach (settings) ->
          token = crypto.randomBytes(20).toString('hex')
          settings = $extend({url: url + "&token=#{token}"}, settings)
          client.createWorker settings, (err, worker) ->
            throw err if err
            Data.BrowserWorker.create({token: token, worker_id: worker.id, note: settings.url}).fail((err) -> throw err).success (record) ->
              cli.info "Created worker ID=#{worker.id} heading to #{settings.url} using #{printBrowser(settings)}"

    when 'list_browsers'
      client.getBrowsers (err, browsers) ->
        throw err if err
        cli.info "Browsers: \n - " + browsers.map(printBrowser).join('\n - ')

    when 'list_workers'
      client.getWorkers (err, workers) ->
        throw err if err
        cli.info "Workers: \n - " + workers.map(printWorker).join('\n - ')

    when 'kill_some'
      workerIds = args.slice(1)
      destroyRecordsForWorkerIds workers.map((w) -> w.id), true
      workerIds.forEach (id) ->
        client.terminateWorker id, (err) ->
          throw err if err
          cli.info "Terminated worker #{worker.id}"

    when 'sync'
      client.getWorkers (err, workers) ->
        throw err if err
        ids = workers.map (w) -> w.id
        destroyRecordsForWorkerIds ids, false, (records) ->
          cli.info "Destroyed #{records.length} extraneous worker record(s)"
          cli.info "Workers listed by the API: \n - " + workers.map(printWorker).join('\n - ')

    else
      cli.error "Unknown stack command #{args[0]}!"
