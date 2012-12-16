fs     = require 'fs'
temp   = require 'temp'
path   = require 'path'
glob   = require 'glob'
cli    = require 'cli'
async  = require 'async'
{exec, spawn} = require 'child_process'
Watson = require '../watson'

syncTables = (callback) ->
  Watson.connect()
  Watson.Utils.sync().complete (err) ->
    cli.debug "Synced tables" unless err
    callback(err)
  
cloneToTemp = (callback) ->
  tmpDir = temp.mkdirSync()

  # Clone repo to tmpdir
  exec "git rev-parse --show-cdup", (err, stdout, stderr) ->
    return callback(err) if err
    rootDir = path.resolve(stdout.toString().trim())

    exec "git clone #{rootDir} #{tmpDir}", (err, stdout, stderr) ->
      cli.ok "Cloned repo to temp dir #{tmpDir}." unless err
      callback(err, {tmpDir, rootDir})

parseRevs = (revs, callback) ->
  if !revs || revs.length == 0
    revs = ['HEAD']

  exec "git rev-parse #{revs.join(' ')}", (err, stdout, stderr) ->
    unless err
      shas = stdout.toString().trim().split('\n')
      cli.debug "Parsed revs."
    callback(err , {shas, revs})

getTestFiles = (options, config, callback) ->
  testDir = config['tests']
  if options.files
    testGlob = options.files
  else
    testGlob = "#{testDir}/**/*.coffee"
  glob testGlob, {}, (err, files) ->
    cli.debug "Got test files." unless err
    callback(err, files)

checkoutSHAWithTests = (sha, rev, tmpDir, rootDir, options, config, callback) ->
  tmpExec = (args...) -> exec "cd #{tmpDir} && #{args.shift()}", args...
  testDir = config['tests']

  async.series [
    checkout = (callback) ->
      tmpExec "git reset --hard && git checkout #{sha}", (err, stdout, stderr) ->
        unless err
          cli.ok "Checked out #{rev} (#{sha})."
        return callback(err)
    ,
    install = (callback) ->
      cli.spinner "Installing dependencies... "
      command = if options['link-node-modules']
        "rm -rf #{tmpDir}/node_modules && ln -s #{rootDir}/node_modules #{tmpDir}/node_modules"
      else
        "npm install"
      tmpExec command, (err) ->
        cli.spinner "Installing depenencies... done!\n", true
        callback(err)
    ,
    copyTests = (callback) ->
      tmpTestDir = testDir.replace(rootDir, tmpDir)
      rootWatsonConfig = path.resolve(process.cwd(), options.config)
      tmpWatsonConfig = path.join(tmpDir, 'watson.json')
      cmd = "rm -rf #{tmpTestDir} &&
             rm -f #{tmpWatsonConfig} &&
             mkdir -p #{tmpTestDir} &&
             cp -r #{testDir}/* #{tmpTestDir} &&
             ln -s #{rootWatsonConfig} #{tmpWatsonConfig}"

      tmpExec cmd, (err, stdout, stderr) ->
        cli.debug "Tests copied to temp dir."
        callback(err)
  ], callback

runTest = (tmpDir, testFile, callback) ->
  child = spawn 'coffee', ['--nodejs', '--prof', testFile], {cwd: tmpDir}
  testFile = path.basename(testFile)
  global.ACTIVE_CHILDREN.push child

  child.stderr.on 'data', (data) ->
    console.warn "From #{testFile} stderr:\n" + data.toString()

  child.stdout.on 'data', (data) ->
    data = data.toString()
    unless data.match(/Tracker run/ig) || data.match(/(Report saved)|(Benchmarks completed)|(ops\/sec)/ig)
      console.warn "From #{testFile} stdout:\n" + data.toString()

  child.on 'exit', (code) ->
    global.ACTIVE_CHILDREN.splice(global.ACTIVE_CHILDREN.indexOf(child))
    cli.debug "#{testFile} ran with exit code #{code}"
    if code != 0
      callback(Error("Benchmark #{testFile} didn't run successfully on #{currentGitStatus}! See error above."))
    else
      callback(undefined)

runAllTests = (tmpDir, tests, callback) ->
  cli.info "Running tests."
  worker = runTest.bind(@, tmpDir)
  queue = async.queue worker, 4
  queue.drain = ->
    callback(undefined)

  cli.progress 0
  count = 0
  for test in tests
    queue.push test, ->
      cli.progress (++count / tests.length)
  true

exports.command =  (args, options, config) ->
  # Clone to tmp dir
  # Parse revs
  # Get tests

  async.auto
    cloneToTemp: cloneToTemp
    parseRevs: parseRevs.bind(@, args)
    syncTables: syncTables
    getTestFiles: getTestFiles.bind(@, options, config)
    runTests: ['syncTables', 'cloneToTemp', 'getTestFiles', 'parseRevs', (callback, results) ->
      tests = results.getTestFiles
      tmpDir = results.cloneToTemp.tmpDir
      rootDir = results.cloneToTemp.rootDir
      revisions = results.parseRevs.revs
      shas = results.parseRevs.shas

      if tests.length == 0
        cli.error "No tests given! Glob used: #{testGlob}"
        process.exit 1
      else
        tests = tests.map (test) -> path.resolve(process.cwd(), test)
        cli.info "Running these tests: \n - " + tests.join('\n - ')
        localTests = (test.replace(rootDir, tmpDir) for test in tests)

      if revisions.length == 0
        cli.error "No revisions given!"
        process.exit 1
      else
        strs = for revision, i in revisions
          sha = shas[i]
          "#{sha} (#{revision})"
        cli.info "Running across these revisions: \n - " + strs.join('\n - ')

      async.forEachSeries(revisions, (revision, callback) ->
        sha = shas.pop()
        cli.debug "Running tests for sha #{sha}"
        checkoutSHAWithTests revision, sha, tmpDir, rootDir, options, config, (err) ->
          return callback(err) if err
          runAllTests(tmpDir, localTests, callback)
      , callback)
    ],
    printSummary: ['runTests', (results, callback) ->
      cli.ok "All tests run."
    ]
  , (err) ->
    cli.error "Error encountered!"
    console.log err
    throw err
