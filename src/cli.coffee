`#!/usr/bin/env node
`
fs     = require 'fs'
temp   = require 'temp'
path   = require 'path'
glob   = require 'glob'
cli    = require 'cli'
{exec} = require 'child_process'
Watson = require './watson'

cli.enable 'status'
cli.parse
  config: ['c', 'Path to configuration file', 'path', './watson.json']
  files: ['f', "Glob of tests to run (run command only)", 'string']
  suppress: ['s', "Supress errors in benchmarks (run command only)", 'boolean', false]
  'link-node-modules': ['l', "Link node-modules from source dir in temp test dir instead of re-installing in tmp dir (run command only)", 'boolean', true]
, ['run', 'truncate']


commands =
  truncate: (args, options, config) ->
    Watson.connect()
    if args.length == 0
      Watson.Report.getAvailableKeys().on('failure', (error) -> throw error ).on 'success', (keys) ->
        cli.info("Available keys for truncation:")
        console.warn(' -', keys.join("\n - "))
        cli.fatal("Please provide some keys for truncation.")
    else
      for key in args
        do (key) ->
          Watson.Report.truncateKey(key).on 'success', ->
            cli.info "'#{key}' truncated."

  run: (args, options, config) ->
    tmpDir = temp.mkdirSync()
    tmpExec = (args...) -> exec "cd #{tmpDir} && #{args.shift()}", args...

    # Clone repo to tmpdir
    exec "git rev-parse --show-cdup", (err, stdout, stderr) ->
      throw err if err
      rootDir = path.resolve(stdout.toString().trim())

      exec "git clone #{rootDir} #{tmpDir}", (err, stdout, stderr) ->
        throw err if err
        cli.ok "Cloned repo to temp dir #{tmpDir}."

        revs = args
        if revs.length == 0
          revs = ['HEAD']

        exec "git rev-parse #{revs.join(' ')}", (err, stdout, stderr) ->
          throw err if err

          shas = stdout.toString().trim().split('\n')
          testDir = config['tests']
          if options.files
            testGlob = options.files
          else
            testGlob = "#{testDir}/**/*.coffee"
          tests = glob.globSync(testGlob)
          if tests.length == 0
            cli.error "No tests given! Glob used: #{testGlob}"
            process.exit 1
          else
            tests = tests.map (test) -> path.resolve(process.cwd(), test)
            cli.info "Running these tests: \n - " + tests.join('\n - ')

          doSHA = =>
            sha = shas.pop()
            rev = revs.pop()
            return unless sha
            tmpExec "git checkout #{sha}", (err, stdout, stderr) ->
              throw err if err
              currentGitStatus = "#{rev} (#{sha})"
              cli.info "Checked out #{currentGitStatus}."
              cli.spinner "Installing dependencies... "
              tmpTestDir = testDir.replace(rootDir, tmpDir)
              rootWatsonConfig = path.resolve(process.cwd(), options.config)
              tmpWatsonConfig = path.join(tmpDir, 'watson.json')
              installationCallback = (err, stdout, stderr) ->
                throw err if err
                cli.spinner "Installing depenencies... done!\n", true

                cmd =  "rm -rf #{tmpTestDir} &&
                        mkdir -p #{tmpTestDir} &&
                        cp -r #{testDir}/* #{tmpTestDir} &&
                        ln -s #{rootWatsonConfig} #{tmpWatsonConfig}"
                tmpExec cmd, (err, stdout, stderr) ->
                  throw err if err
                  cli.info "Tests copied to temp dir."

                  count = tests.length
                  cli.spinner "Running tests..."
                  for testFile in tests
                    cmd = "coffee --nodejs --prof #{testFile.replace(rootDir, tmpDir)}"

                    child = tmpExec cmd, {}, (error, stdout, stderr) ->
                      if error?
                        console.error error
                        throw error
                      stderr = stderr.toString()

                      if !options.suppress && stderr.length > 0
                        # Check the for the `Watson.ensureCommitted` error and auto suppress it.
                        if stderr.match(/skipping this test/)
                          cli.info "Skipping test #{testFile} because it can't run on #{currentGitStatus}"
                        else
                          console.error "\n\n"
                          console.error stderr
                          throw new Error("Benchmark #{testFile} didn't run successfully on #{currentGitStatus}! See error above.")

                      if --count == 0
                        cli.spinner "Running tests... done!\n", true
                        cmd = "rm -rf #{tmpTestDir} &&
                               rm -f #{tmpWatsonConfig} &&
                               rm -f #{tmpDir}/node_modules &&
                               git reset --hard"
                        tmpExec cmd, (err, stdout, stderr) ->
                          throw err if err
                          cli.ok "Tests run on #{currentGitStatus}!"
                          doSHA()

                    child.stdin.end()

              if options['link-node-modules']
                tmpExec "ln -s #{rootDir}/node_modules #{tmpDir}/node_modules", installationCallback
              else
                tmpExec "npm install", installationCallback

          doSHA()

cli.main (args, options) ->
  config = Watson.Utils.getConfiguration(options.config)
  commands[cli.command](args, options, config)
