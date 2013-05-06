cli          = require 'cli'
browserstack = require 'browserstack'

$extend = (root, objs...) ->
  for obj in objs
    root[k] = v for own k,v of obj
  root

printBrowser = (b) -> "#{b.browser}#{if b.browser_version then ' v'+b.browser_version else ''} on #{b.os} #{b.os_version}, on #{b.device || 'default device'}"
printWorker  = (w) -> "Worker #{w.id} with status #{w.status}"

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
  ["Android Browser", null, "android", "4.0", "Samsung Galaxy Nexus"]
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
  client = browserstack.createClient({username: options.username, password: options.password})
  switch args[0]
    when 'kill'
      client.getWorkers (err, workers) ->
        throw err if err
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
          settings = $extend({url}, settings)
          client.createWorker settings, (err, worker) ->
            throw err if err
            cli.info "Created worker ID=#{worker.id} heading to #{url} using #{printBrowser(settings)}"

    when 'list_browsers'
      client.getBrowsers (err, browsers) ->
        throw err if err
        cli.info "Browsers: \n - " + browsers.map(printBrowser).join('\n - ')

    when 'list_workers'
      client.getWorkers (err, workers) ->
        throw err if err
        cli.info "Workers: \n - " + workers.map(printWorker).join('\n - ')

    else
      cli.error "Unknown stack command #{args[0]}!"
