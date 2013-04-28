(function() {
  var Utils, cli, mysql;

  Utils = require('../utils');

  cli = require('cli');

  mysql = require('mysql');

  exports.command = function(args, options, config) {
    var connection;

    config = Utils.getConfiguration(options);
    options = {
      host: config.host,
      user: config.username,
      password: config.password,
      port: config.port
    };
    connection = mysql.createConnection(options);
    connection.connect();
    return connection.query("CREATE DATABASE IF NOT EXISTS watson;", function(err, rows, fields) {
      if (err) {
        throw err;
      }
      if (rows < 0) {
        cli.fatal("Couldn't automatically create database, please create manually or give the user " + config.user + " permission to create databases.");
      }
      cli.info("Database created.");
      require('../objects');
      return Utils.sync().error(function(e) {
        throw e;
      }).success(function() {
        cli.info("Tables synced.");
        cli.info("Watson is bootstrapped!");
        return process.exit(0);
      });
    });
  };

}).call(this);
