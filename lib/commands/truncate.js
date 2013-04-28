(function() {
  var Watson, cli;

  cli = require('cli');

  Watson = require('../watson');

  exports.command = function(args, options, config) {
    var key, _i, _len, _results;

    Watson.connect();
    if (args.length === 0) {
      return Watson.Report.getAvailableKeys().error(function(error) {
        throw error;
      }).success(function(keys) {
        cli.info("Available keys for truncation:");
        console.warn(' -', keys.join("\n - "));
        return cli.fatal("Please provide some keys for truncation.");
      });
    } else {
      _results = [];
      for (_i = 0, _len = args.length; _i < _len; _i++) {
        key = args[_i];
        _results.push((function(key) {
          return Watson.Report.truncateKeyPattern(key).success(function() {
            return cli.info("'" + key + "' truncated.");
          });
        })(key));
      }
      return _results;
    }
  };

}).call(this);
