fs            = require 'fs'
path          = require 'path'
url           = require 'url'
Sequelize     = require "sequelize"
{exec, spawn} = require 'child_process'
cli           = require 'cli'
temp          = require 'temp'
async         = require 'async'
browserstack  = require 'browserstack'

resolvePath = (p) ->
  p = p.replace(/^~\//, process.env.HOME + '/');
  path.resolve(p)

Utils = module.exports =
  connect: ->
    config = Utils.getConfiguration()

    options =
      host: config.host
      logging: false
    options.port = config.port if config.port

    sequelize = new Sequelize(config.database, config.username, config.password, options)
    Utils.connect = -> sequelize
    sequelize

  getConfiguration: (configPath = './watson.json') ->
    configPath = resolvePath(configPath)

    if fs.existsSync(configPath)
      json = JSON.parse(fs.readFileSync(configPath))
      json.configPath = configPath
      for pathKey in ['path', 'tests']
        json[pathKey] = path.resolve(path.dirname(configPath), json[pathKey])

      dbInfo = json['databases']['default']
      json.database = dbInfo.database
      json.username = dbInfo.user
      json.password = dbInfo.pass
      json.host     = dbInfo.host
      json.port     = dbInfo.port

      Utils.getConfiguration = -> json
      json
    else
      throw new Error("Couldn't find configuration at #{configPath}!")

  browserStack: (configPath = '~/.browserstack_credentials') ->
    configPath = resolvePath(configPath)
    @_browserStackClient ?= do ->
      if fs.existsSync(configPath)
        json = JSON.parse(fs.readFileSync(configPath))
        browserstack.createClient(json)
      else
        throw new Error("Couldn't find browserstack credentials at #{configPath}")

    @_browserStackClient

  extend: (onto, objects...) ->
    for object in objects
      for k, v of object
        onto[k] = v
    onto

  sync: (callback) -> Utils.connect().sync()

  parseRevs: (revs, callback) ->
    exec "git rev-parse #{revs.join(' ')}", (err, stdout, stderr) ->
      unless err
        shas = stdout.toString().trim().split('\n')
        cli.debug "Parsed revs."
      callback(err , {shas, revs})

  describeRevs: (revs, callback) ->
    exec "git describe #{revs.join(' ')}", (err, stdout, stderr) ->
      unless err
        shas = stdout.toString().trim().split('\n')
        cli.debug "Described revs."
      callback(err , {shas, revs})

  checkCommited: (sha, callback) ->
    cmd = "[ $(git merge-base #{sha} HEAD) = $(git rev-parse --verify #{sha}^{commit}) ]"
    exec cmd, (err, stdout, stderr) ->
      if err
        callback(null, false)
      else
        callback(null, true)

  cloneToTemp: (callback) ->
    tmpDir = temp.mkdirSync()

    # Clone repo to tmpdir
    exec "git rev-parse --show-cdup", (err, stdout, stderr) ->
      return callback(err) if err
      rootDir = path.resolve(stdout.toString().trim())

      exec "git clone #{rootDir} #{tmpDir}", (err, stdout, stderr) ->
        cli.ok "Cloned repo to temp dir #{tmpDir}." unless err
        callback(err, {tmpDir, rootDir})

  checkoutSHAWithTests: (sha, rev, tmpDir, rootDir, options, config, callback) ->
    tmpExec = (args...) -> exec "cd #{tmpDir} && #{args.shift()}", args...
    testDir = config['tests']

    async.series [
      checkout = (callback) ->
        tmpExec "git reset --hard && git clean -f && git checkout #{sha}", (err, stdout, stderr) ->
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
