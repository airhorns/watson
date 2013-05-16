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

runTest = (tmpDir, options, testFile, callback) ->
  if options.trace
    child = spawn 'coffee', ['--nodejs','--trace-inlining --trace-deopt --trace-opt --prof', testFile], {cwd: tmpDir}
  else
    child = spawn 'coffee', ['--nodejs','--prof', testFile], {cwd: tmpDir}

  testFile = path.basename(testFile)
  global.ACTIVE_CHILDREN.push child

  out = []
  child.stderr.on 'data', (data) ->
    console.warn "From #{testFile} stderr:\n" + data.toString()

  child.stdout.on 'data', (data) ->
    data = data.toString()
    unless data.match(/Tracker run/ig) || data.match(/(Report saved)|(Benchmarks completed)|(ops\/sec)/ig)
      if options.trace
        fs.appendFile( "./#{testFile}-trace.log", data )
      else
        console.warn "From #{testFile} stdout:\n" + data
    else
      out.push data

  child.on 'exit', (code) ->
    global.ACTIVE_CHILDREN.splice(global.ACTIVE_CHILDREN.indexOf(child))
    cli.debug "#{testFile} ran with exit code #{code}. Output:"
    console.log out.join('')

    #v8 prof will include the path in the report so we want it to be constant
    destFile = path.resolve("./#{testFile}-v8.log") 
    
    fs.rename( tmpDir + "/v8.log", destFile, (err) -> console.warn( "couldn't rename file: #{destFile}: #{err}") if err)
  
    if options.v8prof
      cli.debug "Running V8 Profile Analyzer"
      parseV8Log( destFile, testFile, tmpDir, (err) -> fs.unlink( destFile ) )
    if code != 0
      callback(Error("Benchmark #{testFile} didn't run successfully on #{currentGitStatus}! See error above."))
    else
      callback(undefined)

saveProfilerReport = ( output, testFile, tmpDir ) ->
  t = require '../trackers'
  pf = new t.ProfileTracker()
  pf.cwd = tmpDir
  pf.setup( (err) ->
    if err
      throw Error(err)
    pf.text = output.join('')
    pf.test = testFile.match( /^(.*)\.coffee/ )[1]
    pf.finish( (err) ->
      if err
        throw Error(error)
      cli.debug "v8 profile saved sucessfully"
    )
  )

parseV8Log = ( logFile, testFile, tmpDir, callback ) ->
  v8path = process.env.D8_PATH
  if !v8path
    cli.error "D8_PATH must be set when using the v8 profiler"
    callback( Error( "d8 path must be set" ) )
  
  v8_command = v8path + "/tools/mac-tick-processor"
  child = spawn v8_command, [ path.resolve(logFile) ], { cwd: v8path }

  global.ACTIVE_CHILDREN.push child

  out = []
  child.stdout.on 'data', (data) ->
    out.push( data.toString() )

  child.on 'exit', (code) ->
    global.ACTIVE_CHILDREN.splice( global.ACTIVE_CHILDREN.indexOf(child))
    cli.debug "v8 processed successfully"
    saveProfilerReport( out, testFile, tmpDir )
    callback()

runAllTests = (tmpDir, options, tests, callback) ->
  cli.info "Running tests."
  worker = runTest.bind(@, tmpDir, options)
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
    cloneToTemp: Watson.Utils.cloneToTemp
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
        Watson.Utils.checkoutSHAWithTests revision, sha, tmpDir, rootDir, options, config, (err) ->
          return callback(err) if err
          runAllTests(tmpDir, options, localTests, callback)
      , callback)
    ],
    printSummary: ['runTests', (results, callback) ->
      cli.ok "All tests run."
    ]
  , (err) ->
    cli.error "Error encountered!"
    console.log err
    throw err
