(function() {
  var Sequelize, Utils, fs, path, url;
  var __slice = Array.prototype.slice;

  fs = require('fs');

  path = require('path');

  url = require('url');

  Sequelize = require("sequelize");

  Utils = module.exports = {
    connect: function() {
      var database, dbInfo, host, options, password, port, sequelize, username, _ref;
      dbInfo = url.parse(Utils.getConfiguration()['db']);
      database = dbInfo.pathname.slice(1);
      _ref = dbInfo.auth.split(':'), username = _ref[0], password = _ref[1];
      host = dbInfo.hostname;
      options = {
        host: host,
        logging: false
      };
      if (port = parseInt(dbInfo.port)) options.port = port;
      sequelize = new Sequelize(database, username, password, options);
      Utils.connect = function() {
        return sequelize;
      };
      return sequelize;
    },
    getConfiguration: function(configPath) {
      var json, pathKey, _i, _len, _ref;
      if (configPath == null) configPath = './watson.json';
      configPath = path.resolve(configPath);
      if (path.existsSync(configPath)) {
        json = JSON.parse(fs.readFileSync(configPath));
        _ref = ['path', 'tests'];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          pathKey = _ref[_i];
          json[pathKey] = path.resolve(path.dirname(configPath), json[pathKey]);
        }
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
      return Utils.connect().sync().success(function() {
        return callback();
      }).error(callback);
    }
  };

}).call(this);
