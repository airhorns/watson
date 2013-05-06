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

TEMPLATE   = (filename, script) ->
  """
  <html>
    <head>
      <title>Watson - #{filename}</title>
    </head>
    <body>
      <h1>Watson - #{filename}</h1>
    </body>
    <script>
    #{script}
    </script>
  </html>
  """

exports.command = (args, options, config) ->
  testDir = config['tests']
  app = express()

  app.use(express.logger())
  app.use(express.json())

  app.get '/', (req, res, next) -> res.redirect("/tests/")

  app.get '/report.html', (req, res, next) ->
    res.set('Content-Type', 'text/html')
    cli.info "Serving #{req.params}"
    testFile = req.query['file']
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
    data = res.body

    switch data.metric
      when 'time'
        report = new Trackers.TimeTracker(data.name, ->)
        report._saveReport data.bench, (err) ->
          if err
            next(err)
          else
            res.json(null)

  app.listen(5000)
  cli.info "Watson listening on port 5000"
