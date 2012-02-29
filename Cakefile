muffin = require 'muffin'

option '-w', '--watch',  'continue to watch the files and rebuild them when they change'
option '-c', '--commit', 'operate on the git index instead of the working tree'

task 'build', 'compile watson and all the tools', (options) ->
  muffin.run
    files: './src/**/*'
    options: options
    map:
      'src/cli.coffee'     : (matches) ->
        source = muffin.readFile(matches[0], options).then (source) ->
          compiled = muffin.compileString(source, options)
          compiled = "#!/usr/bin/env node\n\n" + compiled
          muffin.writeFile("lib/cli.js", compiled, muffin.extend({}, options, {mode: 0755})).then ->
            muffin.notify "lib/cli.js", "Compiled bin successfully."
      'src/(.+)\.coffee'   : (matches) -> muffin.compileScript(matches[0], "lib/#{matches[1]}.js", options)
