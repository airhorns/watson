cli    = require 'cli'
Watson = require './watson'

cli.enable 'status'
cli.parse
  config: ['c', 'Path to configuration file', 'path', './watson.json']
  files: ['f', "Glob of tests to run (run command only)", 'string']
  suppress: ['s', "Supress errors in benchmarks (run command only)", 'boolean', false]
  'link-node-modules': ['l', "Link node-modules from source dir in temp test dir instead of re-installing in tmp dir (run command only)", 'boolean', true]
, ['run', 'truncate', 'bootstrap']

global.ACTIVE_CHILDREN = []

process.on 'uncaughtException', (error) ->
  console.error error.stack
  child.kill() for child in global.ACTIVE_CHILDREN
  process.exit 1

cli.main (args, options) ->
  config = Watson.Utils.getConfiguration(options.config)
  {command} = require "./commands/#{cli.command}"
  command(args, options, config)
