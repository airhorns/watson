(function() {
  var Watson, async, cli, exec, fs, getTestFiles, glob, parseRevs, parseV8Log, path, runAllTests, runTest, saveProfilerReport, spawn, syncTables, temp, _ref;

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

  runTest = function(tmpDir, options, testFile, callback) {
    var child, out;

    if (options.trace) {
      child = spawn('coffee', ['--nodejs', '--trace-inlining --trace-deopt --trace-opt --prof', testFile], {
        cwd: tmpDir
      });
    } else {
      child = spawn('coffee', ['--nodejs', '--prof', testFile], {
        cwd: tmpDir
      });
    }
    testFile = path.basename(testFile);
    global.ACTIVE_CHILDREN.push(child);
    out = [];
    child.stderr.on('data', function(data) {
      return console.warn(("From " + testFile + " stderr:\n") + data.toString());
    });
    child.stdout.on('data', function(data) {
      data = data.toString();
      if (!(data.match(/Tracker run/ig) || data.match(/(Report saved)|(Benchmarks completed)|(ops\/sec)/ig))) {
        if (options.trace) {
          return fs.appendFile("./" + testFile + "-trace.log", data);
        } else {
          return console.warn(("From " + testFile + " stdout:\n") + data);
        }
      } else {
        return out.push(data);
      }
    });
    return child.on('exit', function(code) {
      var destFile;

      global.ACTIVE_CHILDREN.splice(global.ACTIVE_CHILDREN.indexOf(child));
      cli.debug("" + testFile + " ran with exit code " + code + ". Output:");
      console.log(out.join(''));
      destFile = path.resolve("./" + testFile + "-v8.log");
      if (fs.existsSync(tmpDir + "/v8.log")) {
        fs.rename(tmpDir + "/v8.log", destFile, function(err) {
          if (err) {
            return console.warn("couldn't rename file: " + destFile + ": " + err);
          }
        });
        if (options.v8prof) {
          cli.debug("Running V8 Profile Analyzer");
          parseV8Log(destFile, testFile, tmpDir, function(err) {
            return fs.unlink(destFile, function(err) {
              if (err) {
                return console.warn("rename failed: " + err);
              }
            });
          });
        }
      }
      if (code !== 0) {
        return callback(Error("Benchmark " + testFile + " didn't run successfully on " + currentGitStatus + "! See error above."));
      } else {
        return callback(void 0);
      }
    });
  };

  saveProfilerReport = function(output, testFile, tmpDir) {
    var pf, t;

    t = require('../trackers');
    pf = new t.ProfileTracker();
    pf.cwd = tmpDir;
    return pf.setup(function(err) {
      if (err) {
        throw Error(err);
      }
      pf.text = output.join('');
      pf.test = testFile.match(/^(.*)\.coffee/)[1];
      return pf.finish(function(err) {
        if (err) {
          throw Error(error);
        }
        return cli.debug("v8 profile saved sucessfully");
      });
    });
  };

  parseV8Log = function(logFile, testFile, tmpDir, callback) {
    var child, out, v8_command, v8path;

    v8path = process.env.D8_PATH;
    if (!v8path) {
      cli.error("D8_PATH must be set when using the v8 profiler");
      callback(Error("d8 path must be set"));
    }
    v8_command = v8path + "/tools/mac-tick-processor";
    child = spawn(v8_command, [path.resolve(logFile)], {
      cwd: v8path
    });
    global.ACTIVE_CHILDREN.push(child);
    out = [];
    child.stdout.on('data', function(data) {
      return out.push(data.toString());
    });
    return child.on('exit', function(code) {
      global.ACTIVE_CHILDREN.splice(global.ACTIVE_CHILDREN.indexOf(child));
      cli.debug("v8 processed successfully");
      saveProfilerReport(out, testFile, tmpDir);
      return callback();
    });
  };

  runAllTests = function(tmpDir, options, tests, callback) {
    var count, queue, test, worker, _i, _len;

    cli.info("Running tests.");
    worker = runTest.bind(this, tmpDir, options);
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
      cloneToTemp: Watson.Utils.cloneToTemp,
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
            return Watson.Utils.checkoutSHAWithTests(revision, sha, tmpDir, rootDir, options, config, function(err) {
              if (err) {
                return callback(err);
              }
              return runAllTests(tmpDir, options, localTests, callback);
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
