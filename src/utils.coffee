fs = require 'fs'
path = require 'path'
url = require 'url'
Sequelize = require "sequelize"

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
    if fs.existsSync(configPath)
      json = JSON.parse(fs.readFileSync(configPath))
      for pathKey in ['path', 'tests']
        json[pathKey] = path.resolve(path.dirname(configPath), json[pathKey])

      dbInfo = url.parse(json['db'])
      json.database = dbInfo.pathname.slice(1)
      [json.username, json.password] = dbInfo.auth.split(':')
      json.host = dbInfo.hostname
      json.port = parseInt(dbInfo.port)

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
