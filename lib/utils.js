(function() {
  var Sequelize, Utils, async, browserstack, cli, exec, fs, path, resolvePath, spawn, temp, url, _ref,
    __slice = [].slice;

  fs = require('fs');

  path = require('path');

  url = require('url');

  Sequelize = require("sequelize");

  _ref = require('child_process'), exec = _ref.exec, spawn = _ref.spawn;

  cli = require('cli');

  temp = require('temp');

  async = require('async');

  browserstack = require('browserstack');

  resolvePath = function(p) {
    p = p.replace(/^~\//, process.env.HOME + '/');
    return path.resolve(p);
  };

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
      var dbInfo, json, pathKey, _i, _len, _ref1;

      if (configPath == null) {
        configPath = './watson.json';
      }
      configPath = resolvePath(configPath);
      if (fs.existsSync(configPath)) {
        json = JSON.parse(fs.readFileSync(configPath));
        json.configPath = configPath;
        _ref1 = ['path', 'tests'];
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          pathKey = _ref1[_i];
          json[pathKey] = path.resolve(path.dirname(configPath), json[pathKey]);
        }
        dbInfo = json['databases']['default'];
        json.database = dbInfo.database;
        json.username = dbInfo.user;
        json.password = dbInfo.pass;
        json.host = dbInfo.host;
        json.port = dbInfo.port;
        Utils.getConfiguration = function() {
          return json;
        };
        return json;
      } else {
        throw new Error("Couldn't find configuration at " + configPath + "!");
      }
    },
    browserStack: function(configPath) {
      var _ref1;

      if (configPath == null) {
        configPath = '~/.browserstack_credentials';
      }
      configPath = resolvePath(configPath);
      if ((_ref1 = this._browserStackClient) == null) {
        this._browserStackClient = (function() {
          var json;

          if (fs.existsSync(configPath)) {
            json = JSON.parse(fs.readFileSync(configPath));
            return browserstack.createClient(json);
          } else {
            throw new Error("Couldn't find browserstack credentials at " + configPath);
          }
        })();
      }
      return this._browserStackClient;
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
    },
    checkCommited: function(sha, callback) {
      var cmd;

      cmd = "[ $(git merge-base " + sha + " HEAD) = $(git rev-parse --verify " + sha + "^{commit}) ]";
      return exec(cmd, function(err, stdout, stderr) {
        if (err) {
          return callback(null, false);
        } else {
          return callback(null, true);
        }
      });
    },
    cloneToTemp: function(callback) {
      var tmpDir;

      tmpDir = temp.mkdirSync();
      return exec("git rev-parse --show-cdup", function(err, stdout, stderr) {
        var rootDir;

        if (err) {
          return callback(err);
        }
        rootDir = path.resolve(stdout.toString().trim());
        return exec("git clone " + rootDir + " " + tmpDir, function(err, stdout, stderr) {
          if (!err) {
            cli.ok("Cloned repo to temp dir " + tmpDir + ".");
          }
          return callback(err, {
            tmpDir: tmpDir,
            rootDir: rootDir
          });
        });
      });
    },
    checkoutSHAWithTests: function(sha, rev, tmpDir, rootDir, options, config, callback) {
      var checkout, copyTests, install, testDir, tmpExec;

      tmpExec = function() {
        var args;

        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        return exec.apply(null, ["cd " + tmpDir + " && " + (args.shift())].concat(__slice.call(args)));
      };
      testDir = config['tests'];
      return async.series([
        checkout = function(callback) {
          return tmpExec("git reset --hard && git clean -f && git checkout " + sha, function(err, stdout, stderr) {
            if (!err) {
              cli.ok("Checked out " + rev + " (" + sha + ").");
            }
            return callback(err);
          });
        }, install = function(callback) {
          var command;

          cli.spinner("Installing dependencies... ");
          command = options['link-node-modules'] ? "rm -rf " + tmpDir + "/node_modules && ln -s " + rootDir + "/node_modules " + tmpDir + "/node_modules" : "npm install";
          return tmpExec(command, function(err) {
            cli.spinner("Installing depenencies... done!\n", true);
            return callback(err);
          });
        }, copyTests = function(callback) {
          var cmd, rootWatsonConfig, tmpTestDir, tmpWatsonConfig;

          tmpTestDir = testDir.replace(rootDir, tmpDir);
          rootWatsonConfig = path.resolve(process.cwd(), options.config);
          tmpWatsonConfig = path.join(tmpDir, 'watson.json');
          cmd = "rm -rf " + tmpTestDir + " &&               rm -f " + tmpWatsonConfig + " &&               mkdir -p " + tmpTestDir + " &&               cp -r " + testDir + "/* " + tmpTestDir + " &&               ln -s " + rootWatsonConfig + " " + tmpWatsonConfig;
          return tmpExec(cmd, function(err, stdout, stderr) {
            cli.debug("Tests copied to temp dir.");
            return callback(err);
          });
        }
      ], callback);
    }
  };

}).call(this);
