(function() {
  var $extend, browserstack, cli, defaultStack, printBrowser, printWorker,
    __slice = [].slice,
    __hasProp = {}.hasOwnProperty;

  cli = require('cli');

  browserstack = require('browserstack');

  $extend = function() {
    var k, obj, objs, root, v, _i, _len;

    root = arguments[0], objs = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    for (_i = 0, _len = objs.length; _i < _len; _i++) {
      obj = objs[_i];
      for (k in obj) {
        if (!__hasProp.call(obj, k)) continue;
        v = obj[k];
        root[k] = v;
      }
    }
    return root;
  };

  printBrowser = function(b) {
    return "" + b.browser + (b.browser_version ? ' v' + b.browser_version : '') + " on " + b.os + " " + b.os_version + ", on " + (b.device || 'default device');
  };

  printWorker = function(w) {
    return "Worker " + w.id + " with status " + w.status;
  };

  defaultStack = [["chrome", "27.0", "OS X", "Mountain Lion"], ["chrome", "18.0", "Windows", "XP"], ["firefox", "20.0", "OS X", "Mountain Lion"], ["firefox", "5.0", "Windows", "XP"], ["opera", "12.0", "OS X", "Mountain Lion"], ["safari", "6.0", "OS X", "Mountain Lion"], ["safari", "5.0", "Windows", "XP"], ["ie", "10.0", "Windows", "8"], ["ie", "9.0", "Windows", "7"], ["ie", "8.0", "Windows", "XP"], ["Mobile Safari", null, "ios", "5.0", "iPad 2 (5.0)"], ["Android Browser", null, "android", "4.0", "Samsung Galaxy Nexus"]].map(function(settings) {
    var browser, browser_version, device, hash, k, os, os_version, v;

    browser = settings[0], browser_version = settings[1], os = settings[2], os_version = settings[3], device = settings[4];
    hash = {
      browser: browser,
      browser_version: browser_version,
      os: os,
      os_version: os_version,
      device: device
    };
    if (hash.device) {
      delete hash['browser'];
    } else {
      delete hash['device'];
    }
    for (k in hash) {
      v = hash[k];
      if (v == null) {
        delete hash[k];
      }
    }
    return hash;
  });

  exports.command = function(args, options, config) {
    var client, url, urls, _i, _len, _results;

    client = browserstack.createClient({
      username: options.username,
      password: options.password
    });
    switch (args[0]) {
      case 'kill':
        return client.getWorkers(function(err, workers) {
          if (err) {
            throw err;
          }
          workers.forEach(function(worker) {
            return client.terminateWorker(worker.id, function(err) {
              if (err) {
                throw err;
              }
              return cli.info("Terminated worker " + worker.id);
            });
          });
          if (workers.length === 0) {
            return cli.info("No workers to kill.");
          }
        });
      case 'start':
        urls = args.slice(1);
        if (!(urls.length > 0)) {
          cli.error("Please provide some URLs to hit");
          return;
        }
        _results = [];
        for (_i = 0, _len = urls.length; _i < _len; _i++) {
          url = urls[_i];
          _results.push(defaultStack.forEach(function(settings) {
            settings = $extend({
              url: url
            }, settings);
            return client.createWorker(settings, function(err, worker) {
              if (err) {
                throw err;
              }
              return cli.info("Created worker ID=" + worker.id + " heading to " + url + " using " + (printBrowser(settings)));
            });
          }));
        }
        return _results;
        break;
      case 'list_browsers':
        return client.getBrowsers(function(err, browsers) {
          if (err) {
            throw err;
          }
          return cli.info("Browsers: \n - " + browsers.map(printBrowser).join('\n - '));
        });
      case 'list_workers':
        return client.getWorkers(function(err, workers) {
          if (err) {
            throw err;
          }
          return cli.info("Workers: \n - " + workers.map(printWorker).join('\n - '));
        });
      default:
        return cli.error("Unknown stack command " + args[0] + "!");
    }
  };

}).call(this);
