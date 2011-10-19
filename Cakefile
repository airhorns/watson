muffin = require 'muffin'

option '-w', '--watch',  'continue to watch the files and rebuild them when they change'
option '-c', '--commit', 'operate on the git index instead of the working tree'

task 'build', 'compile Batman.js and all the tools', (options) ->
  muffin.run
    files: './src/**/*'
    options: options
    map:
      'src/cli.coffee'   : (matches) -> muffin.compileScript(matches[0], "lib/cli.js", muffin.extend({}, options, {mode: 0755, bare: true}))
      'src/(.+)\.coffee'   : (matches) -> muffin.compileScript(matches[0], "lib/#{matches[1]}.js", options)
