cli    = require 'cli'
Watson = require '../watson'

exports.command = (args, options, config) ->
  Watson.connect()
  if args.length == 0
    Watson.Report.getAvailableKeys().error((error) -> throw error).success (keys) ->
      cli.info("Available keys for truncation:")
      console.warn(' -', keys.join("\n - "))
      cli.fatal("Please provide some keys for truncation.")
  else
    for key in args
      do (key) ->
        Watson.Report.truncateKeyPattern(key).success ->
          cli.info "'#{key}' truncated."

