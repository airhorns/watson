(function() {
  var Sequelize, Utils, cli, exec, fs, path, spawn, url, _ref,
    __slice = [].slice;

  fs = require('fs');

  path = require('path');

  url = require('url');

  Sequelize = require("sequelize");

  _ref = require('child_process'), exec = _ref.exec, spawn = _ref.spawn;

  cli = require('cli');

  Utils = module.exports = {
    connect: function() {
      var config, options, sequelize;

      config = Utils.getConfiguration();
      options = {
        host: config.host,
        logging: false
      };
      if (config.port) {
        options.port = config.port;
      }
      sequelize = new Sequelize(config.database, config.username, config.password, options);
      Utils.connect = function() {
        return sequelize;
      };
      return sequelize;
    },
    getConfiguration: function(configPath) {
      var dbInfo, json, pathKey, _i, _len, _ref1, _ref2;

      if (configPath == null) {
        configPath = './watson.json';
      }
      configPath = path.resolve(configPath);
      if (fs.existsSync(configPath)) {
        json = JSON.parse(fs.readFileSync(configPath));
        _ref1 = ['path', 'tests'];
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          pathKey = _ref1[_i];
          json[pathKey] = path.resolve(path.dirname(configPath), json[pathKey]);
        }
        dbInfo = url.parse(json['db']);
        json.database = dbInfo.pathname.slice(1);
        _ref2 = dbInfo.auth.split(':'), json.username = _ref2[0], json.password = _ref2[1];
        json.host = dbInfo.hostname;
        json.port = parseInt(dbInfo.port);
        Utils.getConfiguration = function() {
          return json;
        };
        return json;
      } else {
        throw new Error("Couldn't find configuration at " + configPath + "!");
      }
    },
    extend: function() {
      var k, object, objects, onto, v, _i, _len;

      onto = arguments[0], objects = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      for (_i = 0, _len = objects.length; _i < _len; _i++) {
        object = objects[_i];
        for (k in object) {
          v = object[k];
          onto[k] = v;
        }
      }
      return onto;
    },
    sync: function(callback) {
      return Utils.connect().sync();
    },
    parseRevs: function(revs, callback) {
      return exec("git rev-parse " + (revs.join(' ')), function(err, stdout, stderr) {
        var shas;

        if (!err) {
          shas = stdout.toString().trim().split('\n');
          cli.debug("Parsed revs.");
        }
        return callback(err, {
          shas: shas,
          revs: revs
        });
      });
    },
    describeRevs: function(revs, callback) {
      return exec("git describe " + (revs.join(' ')), function(err, stdout, stderr) {
        var shas;

        if (!err) {
          shas = stdout.toString().trim().split('\n');
          cli.debug("Described revs.");
        }
        return callback(err, {
          shas: shas,
          revs: revs
        });
      });
    }
  };

}).call(this);
