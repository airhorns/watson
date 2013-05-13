Watson     = require '../watson'
Trackers   = require '../trackers'
coffee     = require 'coffee-script'
express    = require 'express'
cli        = require 'cli'
fs         = require 'fs'
path       = require 'path'
url        = require 'url'
browserify = require 'browserify'
coffeeify  = require 'coffeeify'
uaparser   = require 'ua-parser'
{fork}     = require 'child_process'

TEMPLATE   = (filename, script) ->
  """
  <html>
    <head>
      <title>Watson - #{filename}</title>
      <script type="text/javascript" src="/watson/html5shiv.js"></script>
      <script type="text/javascript" src="/watson/es5-shim.min.js"></script>
      <script type="text/javascript" src="/watson/es5-sham.min.js"></script>
    </head>
    <body>
      <h1>Watson - #{filename}</h1>
      <ul id="results"></ul>
      <script type="text/javascript">
      #{script}
      </script>
    </body>
  </html>
  """

exports.command = (args, options, config) ->
  if args[0]?
    # Serve a rev instead of the local dir
    revision = sha = args[0]
    cli.debug "Checking out #{revision} to serve."
    rev = args[0]
    Watson.Utils.cloneToTemp (err, {tmpDir, rootDir}) ->
      throw err if err
      Watson.Utils.checkoutSHAWithTests revision, sha, tmpDir, rootDir, options, config, (err) ->
        throw err if err
        configPath = Watson.Utils.getConfiguration()['configPath']
        cwd = path.dirname(configPath.replace(rootDir, tmpDir))

        server = fork(path.join(__dirname, '..', 'cli.js'), ['serve'], {cwd})
        cli.debug "Spawned server as #{server.pid}"
        server.on 'close', ->
          process.exit()
  else
    testDir = config['tests']
    app = express()

    app.use(express.logger())
    app.use(express.json())

    app.get '/', (req, res, next) -> res.redirect("/tests/")

    app.get '/report.html', (req, res, next) ->
      res.set('Content-Type', 'text/html')
      testFile = req.query['file']
      cli.info "Serving #{testFile}"
      unless testFile?
        next(new Error("File parameter needed"))
        return

      testFilePath = path.join testDir, testFile
      packager = browserify(testFilePath)
      packager.transform(coffeeify)
      packager.bundle (err, script) ->
        return next(err) if err
        res.send(TEMPLATE(testFilePath, script))

    app.use '/tests', (req, res, next) ->
      return next() if 'GET' isnt req.method and 'HEAD' isnt req.method
      pathname = url.parse(req.url).pathname
      if /\.coffee$/.test pathname
        res.redirect("/report.html?file=#{pathname}")
      else
        next()

    app.use '/tests', express.directory(testDir)
    app.use '/tests', express.static(testDir)
    app.post '/save_results', (req, res, next) ->
      data = req.body
      userAgent = uaparser.parse(req.get("User-Agent"))

      switch data.metric
        when 'times'
          new Trackers.TimeTracker data.name, (err, suite, tracker) ->
            return next(err) if err
            tracker.userAgent = userAgent.ua.toString()
            tracker.os        = userAgent.os.toString()
            tracker._saveReport data.data, (err) ->
              return next(err) if err
              res.json({success: true})
              res.end()
        else
          res.json(402, {status: "unknown metric"})

    app.use '/watson', express.static(path.join(__dirname, '..', 'web'))
    app.listen(5000)
    cli.info "Watson listening on port 5000"
