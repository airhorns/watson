#!/usr/bin/env node
;
var Watson, cli, commands, exec, fs, glob, path, temp;
var __slice = Array.prototype.slice, __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
fs = require('fs');
temp = require('temp');
path = require('path');
glob = require('glob');
cli = require('cli');
exec = require('child_process').exec;
Watson = require('./watson');
cli.enable('status');
cli.parse({
  config: ['c', 'Path to configuration file', 'path', './watson.json'],
  files: ['f', "Glob of tests to run (run command only)", 'string'],
  suppress: ['s', "Supress errors in benchmarks (run command only)", 'boolean', false],
  'link-node-modules': ['l', "Link node-modules from source dir in temp test dir instead of re-installing in tmp dir (run command only)", 'boolean', true]
}, ['run', 'truncate']);
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
    var tmpDir, tmpExec;
    tmpDir = temp.mkdirSync();
    tmpExec = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return exec.apply(null, ["cd " + tmpDir + " && " + (args.shift())].concat(__slice.call(args)));
    };
    return exec("git rev-parse --show-cdup", function(err, stdout, stderr) {
      var rootDir;
      if (err) {
        throw err;
      }
      rootDir = path.resolve(stdout.toString().trim());
      return exec("git clone " + rootDir + " " + tmpDir, function(err, stdout, stderr) {
        var revs;
        if (err) {
          throw err;
        }
        cli.ok("Cloned repo to temp dir " + tmpDir + ".");
        revs = args;
        if (revs.length === 0) {
          revs = ['HEAD'];
        }
        return exec("git rev-parse " + (revs.join(' ')), function(err, stdout, stderr) {
          var doSHA, shas, testDir, testGlob, tests;
          if (err) {
            throw err;
          }
          shas = stdout.toString().trim().split('\n');
          testDir = config['tests'];
          if (options.files) {
            testGlob = options.files;
          } else {
            testGlob = "" + testDir + "/**/*.coffee";
          }
          tests = glob.globSync(testGlob);
          if (tests.length === 0) {
            cli.error("No tests given! Glob used: " + testGlob);
            process.exit(1);
          } else {
            tests = tests.map(function(test) {
              return path.resolve(process.cwd(), test);
            });
            cli.info("Running these tests: \n - " + tests.join('\n - '));
          }
          doSHA = __bind(function() {
            var rev, sha;
            sha = shas.pop();
            rev = revs.pop();
            if (!sha) {
              return;
            }
            return tmpExec("git co " + sha, function(err, stdout, stderr) {
              var currentGitStatus, installationCallback, rootWatsonConfig, tmpTestDir, tmpWatsonConfig;
              if (err) {
                throw err;
              }
              currentGitStatus = "" + rev + " (" + sha + ")";
              cli.info("Checked out " + currentGitStatus + ".");
              cli.spinner("Installing dependencies... ");
              tmpTestDir = testDir.replace(rootDir, tmpDir);
              rootWatsonConfig = path.resolve(process.cwd(), options.config);
              tmpWatsonConfig = path.join(tmpDir, 'watson.json');
              installationCallback = function(err, stdout, stderr) {
                var cmd;
                if (err) {
                  throw err;
                }
                cli.spinner("Installing depenencies... done!\n", true);
                cmd = "rm -rf " + tmpTestDir + " &&                        mkdir -p " + tmpTestDir + " &&                        cp -r " + testDir + "/* " + tmpTestDir + " &&                        ln -s " + rootWatsonConfig + " " + tmpWatsonConfig;
                return tmpExec(cmd, function(err, stdout, stderr) {
                  var child, count, testFile, _i, _len, _results;
                  if (err) {
                    throw err;
                  }
                  cli.info("Tests copied to temp dir.");
                  count = tests.length;
                  cli.spinner("Running tests...");
                  _results = [];
                  for (_i = 0, _len = tests.length; _i < _len; _i++) {
                    testFile = tests[_i];
                    cmd = "coffee --nodejs --prof " + (testFile.replace(rootDir, tmpDir));
                    child = tmpExec(cmd, {}, function(error, stdout, stderr) {
                      if (error != null) {
                        console.error(error);
                        throw error;
                      }
                      stderr = stderr.toString();
                      if (!options.suppress && stderr.length > 0) {
                        if (stderr.match(/skipping this test/)) {
                          cli.info("Skipping test " + testFile + " because it can't run on " + currentGitStatus);
                        } else {
                          console.error("\n\n");
                          console.error(stderr);
                          throw new Error("Benchmark " + testFile + " didn't run successfully on " + currentGitStatus + "! See error above.");
                        }
                      }
                      if (--count === 0) {
                        cli.spinner("Running tests... done!\n", true);
                        cmd = "rm -rf " + tmpTestDir + " &&                               rm -f " + tmpWatsonConfig + " &&                               rm -f " + tmpDir + "/node_modules &&                               git reset --hard";
                        return tmpExec(cmd, function(err, stdout, stderr) {
                          if (err) {
                            throw err;
                          }
                          cli.ok("Tests run on " + currentGitStatus + "!");
                          return doSHA();
                        });
                      }
                    });
                    _results.push(child.stdin.end());
                  }
                  return _results;
                });
              };
              if (options['link-node-modules']) {
                return tmpExec("ln -s " + rootDir + "/node_modules " + tmpDir + "/node_modules", installationCallback);
              } else {
                return tmpExec("npm install", installationCallback);
              }
            });
          }, this);
          return doSHA();
        });
      });
    });
  }
};
cli.main(function(args, options) {
  var config;
  config = Watson.Utils.getConfiguration(options.config);
  return commands[cli.command](args, options, config);
});