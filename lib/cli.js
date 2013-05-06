#!/usr/bin/env node

(function() {
  var Watson, cli;

  cli = require('cli');

  Watson = require('./watson');

  cli.enable('status');

  cli.parse({
    config: ['c', 'Path to configuration file', 'path', './watson.json'],
    files: ['f', "Glob of tests to run (run command only)", 'string'],
    suppress: ['s', "Supress errors in benchmarks (run command only)", 'boolean', false],
    reports: ['r', "List of reports to report on (report command only)", 'string'],
    username: ['u', "BrowserStack username (stack command only)", 'string'],
    password: ['p', "BrowserStack password (stack command only)", 'string'],
    'link-node-modules': ['l', "Link node-modules from source dir in temp test dir instead of re-installing in tmp dir (run command only)", 'boolean', true]
  }, ['run', 'truncate', 'bootstrap', 'report', 'serve', 'stack']);

  global.ACTIVE_CHILDREN = [];

  process.on('uncaughtException', function(error) {
    var child, _i, _len, _ref;

    console.error(error.stack);
    _ref = global.ACTIVE_CHILDREN;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      child = _ref[_i];
      child.kill();
    }
    return process.exit(1);
  });

  cli.main(function(args, options) {
    var command, config;

    config = Watson.Utils.getConfiguration(options.config);
    command = require("./commands/" + cli.command).command;
    return command(args, options, config);
  });

}).call(this);
