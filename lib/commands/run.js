(function() {
  var Watson, async, checkoutSHAWithTests, cli, cloneToTemp, exec, fs, getTestFiles, glob, parseRevs, path, runAllTests, runTest, spawn, syncTables, temp, _ref,
    __slice = [].slice;

  fs = require('fs');

  temp = require('temp');

  path = require('path');

  glob = require('glob');

  cli = require('cli');

  async = require('async');

  _ref = require('child_process'), exec = _ref.exec, spawn = _ref.spawn;

  Watson = require('../watson');

  syncTables = function(callback) {
    Watson.connect();
    return Watson.Utils.sync().complete(function(err) {
      if (!err) {
        cli.debug("Synced tables");
      }
      return callback(err);
    });
  };

  cloneToTemp = function(callback) {
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
  };

  parseRevs = function(revs, callback) {
    if (!revs || revs.length === 0) {
      revs = ['HEAD'];
    }
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
      if (!err) {
        cli.debug("Got test files.");
      }
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
        cmd = "rm -rf " + tmpTestDir + " &&             rm -f " + tmpWatsonConfig + " &&             mkdir -p " + tmpTestDir + " &&             cp -r " + testDir + "/* " + tmpTestDir + " &&             ln -s " + rootWatsonConfig + " " + tmpWatsonConfig;
        return tmpExec(cmd, function(err, stdout, stderr) {
          cli.debug("Tests copied to temp dir.");
          return callback(err);
        });
      }
    ], callback);
  };

  runTest = function(tmpDir, testFile, callback) {
    var child, out;
    child = spawn('coffee', ['--nodejs', '--prof', testFile], {
      cwd: tmpDir
    });
    testFile = path.basename(testFile);
    global.ACTIVE_CHILDREN.push(child);
    out = [];
    child.stderr.on('data', function(data) {
      return console.warn(("From " + testFile + " stderr:\n") + data.toString());
    });
    child.stdout.on('data', function(data) {
      data = data.toString();
      if (!(data.match(/Tracker run/ig) || data.match(/(Report saved)|(Benchmarks completed)|(ops\/sec)/ig))) {
        return console.warn(("From " + testFile + " stdout:\n") + data);
      } else {
        return out.push(data);
      }
    });
    return child.on('exit', function(code) {
      global.ACTIVE_CHILDREN.splice(global.ACTIVE_CHILDREN.indexOf(child));
      cli.debug("" + testFile + " ran with exit code " + code + ". Output:");
      console.log(out.join(''));
      if (code !== 0) {
        return callback(Error("Benchmark " + testFile + " didn't run successfully on " + currentGitStatus + "! See error above."));
      } else {
        return callback(void 0);
      }
    });
  };

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

  exports.command = function(args, options, config) {
    return async.auto({
      cloneToTemp: cloneToTemp,
      parseRevs: parseRevs.bind(this, args),
      syncTables: syncTables,
      getTestFiles: getTestFiles.bind(this, options, config),
      runTests: [
        'syncTables', 'cloneToTemp', 'getTestFiles', 'parseRevs', function(callback, results) {
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
              var _i, _len, _results;
              _results = [];
              for (i = _i = 0, _len = revisions.length; _i < _len; i = ++_i) {
                revision = revisions[i];
                sha = shas[i];
                _results.push("" + sha + " (" + revision + ")");
              }
              return _results;
            })();
            cli.info("Running across these revisions: \n - " + strs.join('\n - '));
          }
          return async.forEachSeries(revisions, function(revision, callback) {
            sha = shas.pop();
            cli.debug("Running tests for sha " + sha);
            return checkoutSHAWithTests(revision, sha, tmpDir, rootDir, options, config, function(err) {
              if (err) {
                return callback(err);
              }
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
      cli.error("Error encountered!");
      console.log(err);
      throw err;
    });
  };

}).call(this);
