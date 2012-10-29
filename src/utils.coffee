fs = require 'fs'
path = require 'path'
url = require 'url'
Sequelize = require "sequelize"

Utils = module.exports =
  connect: ->
    dbInfo = url.parse(Utils.getConfiguration()['db'])
    database = dbInfo.pathname.slice(1)
    [username, password] = dbInfo.auth.split(':')
    host = dbInfo.hostname
    options = {host, logging: false}
    options.port = port if port = parseInt(dbInfo.port)

    sequelize = new Sequelize(database, username, password, options)
    Utils.connect = -> sequelize
    sequelize

  getConfiguration: (configPath = './watson.json') ->
    configPath = path.resolve(configPath)
    if fs.existsSync(configPath)
      json = JSON.parse(fs.readFileSync(configPath))
      for pathKey in ['path', 'tests']
        json[pathKey] = path.resolve(path.dirname(configPath), json[pathKey])
      Utils.getConfiguration = -> json
      json
    else
      throw new Error("Couldn't find configuration at #{configPath}!")

  extend: (onto, objects...) ->
    for object in objects
      for k, v of object
        onto[k] = v
    onto

  sync: (callback) -> Utils.connect().sync().success(-> callback()).error(callback)
