fs = require 'fs'
path = require 'path'
url = require 'url'
Sequelize = require "sequelize"
{exec, spawn} = require 'child_process'
cli = require 'cli'

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
    configPath = path.resolve(configPath)

    # File like
    #"databases": {
      #"default": {
        #"type": "mysql",
        #"user": "root",
        #"host": "localhost",
        #"port": 13306,
        #"poolsize": 3,
        #"database": "watson"
      #}
    #},
    #
    if fs.existsSync(configPath)
      json = JSON.parse(fs.readFileSync(configPath))
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
