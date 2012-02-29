#!/usr/bin/env node

(function() {
  var Watson, activeChildren, async, checkoutSHAWithTests, cli, cloneToTemp, commands, exec, fs, getTestFiles, glob, parseRevs, path, runAllTests, runTest, spawn, temp, _ref;
  var __slice = Array.prototype.slice;

  fs = require('fs');

  temp = require('temp');

  path = require('path');

  glob = require('glob');

  cli = require('cli');

  async = require('async');

  _ref = require('child_process'), exec = _ref.exec, spawn = _ref.spawn;

  Watson = require('./watson');

  cli.enable('status');

  cli.parse({
    config: ['c', 'Path to configuration file', 'path', './watson.json'],
    files: ['f', "Glob of tests to run (run command only)", 'string'],
    suppress: ['s', "Supress errors in benchmarks (run command only)", 'boolean', false],
    'link-node-modules': ['l', "Link node-modules from source dir in temp test dir instead of re-installing in tmp dir (run command only)", 'boolean', true]
  }, ['run', 'truncate']);

  cloneToTemp = function(callback) {
    var tmpDir;
    tmpDir = temp.mkdirSync();
    return exec("git rev-parse --show-cdup", function(err, stdout, stderr) {
      var rootDir;
      if (err) return callback(err);
      rootDir = path.resolve(stdout.toString().trim());
      return exec("git clone " + rootDir + " " + tmpDir, function(err, stdout, stderr) {
        cli.ok("Cloned repo to temp dir " + tmpDir + ".");
        return callback(err, {
          tmpDir: tmpDir,
          rootDir: rootDir
        });
      });
    });
  };

  parseRevs = function(revs, callback) {
    if (!revs || revs.length === 0) revs = ['HEAD'];
    return exec("git rev-parse " + (revs.join(' ')), function(err, stdout, stderr) {
      var shas;
      if (!err) shas = stdout.toString().trim().split('\n');
      cli.debug("Parsed revs.");
      return callback(err, {
        shas: shas,
        revs: revs
      });
    });
  };

  getTestFiles = function(options, config, callback) {
    var testDir, testGlob;
    testDir = config['tests'];
    if (options.files) {
      testGlob = options.files;
    } else {
      testGlob = "" + testDir + "/**/*.coffee";
    }
    return glob(testGlob, {}, function(err, files) {
      cli.debug("Got test files.");
      return callback(err, files);
    });
  };

  checkoutSHAWithTests = function(sha, rev, tmpDir, rootDir, options, config, callback) {
    var checkout, copyTests, install, testDir, tmpExec;
    tmpExec = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return exec.apply(null, ["cd " + tmpDir + " && " + (args.shift())].concat(__slice.call(args)));
    };
    testDir = config['tests'];
    return async.series([
      checkout = function(callback) {
        return tmpExec("git checkout " + sha, function(err, stdout, stderr) {
          if (!err) cli.ok("Checked out " + rev + " (" + sha + ").");
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
        cmd = "rm -rf " + tmpTestDir + " &&             rm -f " + tmpWatsonConfig + " &&             mkdir -p " + tmpTestDir + " &&             cp -r " + testDir + "/* " + tmpTestDir + " &&             ln -s " + rootWatsonConfig + " " + tmpWatsonConfig;
        return tmpExec(cmd, function(err, stdout, stderr) {
          cli.debug("Tests copied to temp dir.");
          return callback(err);
        });
      }
    ], callback);
  };

  activeChildren = [];

  runTest = function(tmpDir, testFile, callback) {
    var child, cmd;
    cmd = "coffee --nodejs --prof " + testFile;
    child = spawn('coffee', ['--nodejs', '--prof', testFile], {
      cwd: tmpDir
    });
    activeChildren.push(child);
    child.stderr.on('data', function(data) {
      return console.warn(("From " + testFile + " stderr:\n") + data.toString());
    });
    child.stdout.on('data', function(data) {
      data = data.toString();
      if (!(data.match(/Tracker run/ig) || data.match(/(Report saved)|(Benchmarks completed)|(ops\/sec)/ig))) {
        return console.warn(("From " + testFile + " stdout:\n") + data.toString());
      }
    });
    return child.on('exit', function(code) {
      activeChildren.splice(activeChildren.indexOf(child));
      if (code !== 0) {
        return callback(Error("Benchmark " + testFile + " didn't run successfully on " + currentGitStatus + "! See error above."));
      } else {
        cli.debug("" + (path.basename(testFile)) + " ran successfully.");
        return callback(void 0);
      }
    });
  };

  process.on('uncaughtException', function(error) {
    var child, _i, _len;
    console.error(error.stack);
    for (_i = 0, _len = activeChildren.length; _i < _len; _i++) {
      child = activeChildren[_i];
      child.kill();
    }
    return process.exit(1);
  });

  runAllTests = function(tmpDir, tests, callback) {
    var count, queue, test, worker, _i, _len;
    cli.info("Running tests.");
    worker = runTest.bind(this, tmpDir);
    queue = async.queue(worker, 4);
    queue.drain = function() {
      return callback(void 0);
    };
    cli.progress(0);
    count = 0;
    for (_i = 0, _len = tests.length; _i < _len; _i++) {
      test = tests[_i];
      queue.push(test, function() {
        return cli.progress(++count / tests.length);
      });
    }
    return true;
  };

  commands = {
    truncate: function(args, options, config) {
      var key, _i, _len, _results;
      Watson.connect();
      if (args.length === 0) {
        return Watson.Report.getAvailableKeys().on('failure', function(error) {
          throw error;
        }).on('success', function(keys) {
          cli.info("Available keys for truncation:");
          console.warn(' -', keys.join("\n - "));
          return cli.fatal("Please provide some keys for truncation.");
        });
      } else {
        _results = [];
        for (_i = 0, _len = args.length; _i < _len; _i++) {
          key = args[_i];
          _results.push((function(key) {
            return Watson.Report.truncateKey(key).on('success', function() {
              return cli.info("'" + key + "' truncated.");
            });
          })(key));
        }
        return _results;
      }
    },
    run: function(args, options, config) {
      return async.auto({
        cloneToTemp: cloneToTemp,
        parseRevs: parseRevs.bind(this, args),
        getTestFiles: getTestFiles.bind(this, options, config),
        runTests: [
          'cloneToTemp', 'getTestFiles', 'parseRevs', function(callback, results) {
            var i, localTests, revision, revisions, rootDir, sha, shas, strs, test, tests, tmpDir;
            tests = results.getTestFiles;
            tmpDir = results.cloneToTemp.tmpDir;
            rootDir = results.cloneToTemp.rootDir;
            revisions = results.parseRevs.revs;
            shas = results.parseRevs.shas;
            if (tests.length === 0) {
              cli.error("No tests given! Glob used: " + testGlob);
              process.exit(1);
            } else {
              tests = tests.map(function(test) {
                return path.resolve(process.cwd(), test);
              });
              cli.info("Running these tests: \n - " + tests.join('\n - '));
              localTests = (function() {
                var _i, _len, _results;
                _results = [];
                for (_i = 0, _len = tests.length; _i < _len; _i++) {
                  test = tests[_i];
                  _results.push(test.replace(rootDir, tmpDir));
                }
                return _results;
              })();
            }
            if (revisions.length === 0) {
              cli.error("No revisions given!");
              process.exit(1);
            } else {
              strs = (function() {
                var _len, _results;
                _results = [];
                for (i = 0, _len = revisions.length; i < _len; i++) {
                  revision = revisions[i];
                  sha = shas[i];
                  _results.push("" + sha + " (" + revision + ")");
                }
                return _results;
              })();
              cli.info("Running across these reviisions: \n - " + strs.join('\n - '));
            }
            return async.forEachSeries(revisions, function(revision, callback) {
              sha = shas.pop();
              return checkoutSHAWithTests(revision, sha, tmpDir, rootDir, options, config, function(err) {
                if (err) return callback(err);
                return runAllTests(tmpDir, localTests, callback);
              });
            }, callback);
          }
        ],
        printSummary: [
          'runTests', function(results, callback) {
            return cli.ok("All tests run.");
          }
        ]
      }, function(err) {
        throw err;
      });
    }
  };

  cli.main(function(args, options) {
    var config;
    config = Watson.Utils.getConfiguration(options.config);
    return commands[cli.command](args, options, config);
  });

}).call(this);
