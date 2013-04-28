Utils = require '../utils'
cli    = require 'cli'
mysql = require 'mysql'

exports.command = (args, options, config) ->
  config = Utils.getConfiguration(options)
  options =
    host: config.host
    user: config.username
    password: config.password
    port: config.port
  connection = mysql.createConnection(options)
  connection.connect()
  connection.query "CREATE DATABASE IF NOT EXISTS watson;", (err, rows, fields) ->
    throw err if err
    cli.fatal("Couldn't automatically create database, please create manually or give the user #{config.user} permission to create databases.") if rows < 0
    cli.info("Database created.")

    require '../objects'
    Utils.sync().error((e) -> throw e).success ->
      cli.info("Tables synced.")
      cli.info("Watson is bootstrapped!")
      process.exit(0)
