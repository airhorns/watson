# Watson
### Sleuth out JS performance issues.

### Purpose

Watson is a tool for automating the execution and logging of both speed and memory benchmarks for JavaScript applications. Watson isn't a suite of benchmarks or a statistics tool: it just generates data. It is up to you to write the benchmarks and to interpret your results. Boy wouldn't that be nice if computers could just tell us their problems. 

Watson is most useful because it logs all the data it generates to a tool we already know how to use: MySQL. You can ask MySQL arbitrary questions through SQL (duh), use a tool like tiller to generate graphs of the data, and use any other tooling built around MySQL to operate on the data. 

Watson is also useful because it automates away the process of managing out a bunch of different versions of code and trying to keep track of what output came from what version by again using a tool we know how to use already: git. Watson can automatically checkout different git shas and run the same benchmark files on those shas, allowing you to let it go crazy in the background while you think about how to make your code faster.

### Getting started

Watson uses a MySQL database to store the results it generates in, so it needs to be given some configuration on how to connect to the database. In the case of [Batman](https://github.com/Shopify/batman), the principal user of Watson, this configuration file is stored in `tests/prof/watson.json`. All the following examples concern this example install of Watson, and __assume they are being run from the `tests/prof` directory of Batman__.

Watson provides a `watson bootstrap` command to create the various tables in the database. All these commands need `watson boostrap` to have been run.

The `watson stack` series of commands also expect you to have provided some BrowserStack credentials. 

### Structure.

Watson has two modes of running: inside a fake DOM in node.js, and also in a variety of real browsers using BrowserStack. Watson's data is oriented around two principal notions: the `report`, and the `sha`.  A report is the result of running a benchmark (usually a simple CoffeeScript file) on a particular git `sha` of the target application under profile. By generating the same report across many shas using Watson, you can compare different ideas against one another and make informed decisions about weather or not to include your changed sha in the target application. Benchmarks are composed of CoffeeScript files which call into the Watson `Tracker` API. There are two classes of benchmark: memory profiles which track memory consumption over time, and CPU profiles which track how long a particular block of code takes to execute. 

The tracker API is as follows:

#### `Watson.trackMemory(name, iterations, benchmarkFunction)`

The `trackMemory` function allows database logging of the amount of memory consumed over time by executing a given `benchmarkFunction` some `iterations` number of times.  The generated points are logged under a report named with the given `name`. 

Here's an example use:


```coffescript
Batman = require '../../../../lib/dist/batman.node'
Watson = require 'watson'

objects = []

Watson.trackMemory 'object instantiation memory usage', 2000, (i) ->
  objects.push new Batman.Object(foo: i)
```

The above example tracks the amount of memory consumed by repeatedly instantiating a `Batman.Object`. The objects are purposefully added to an array in order to prevent them from being garbage collected during the duration of the experiment. This benchmark is useful because when memory usage is graphed over time, if the amount of memory each `Batman.Object` occupies has decreased on a particular sha, we'd see a slower growing slope compared to the original sha.

`trackMemory` is also useful for proving a memory leak has been fixed. An example:

```coffeescript
Batman = require '../../../../lib/dist/batman.node'
Watson = require 'watson'

generateAttributes = (count) ->
  attributes = {}
  attributes["attribute#{i}"] = "value#{i}" for i in [0...count]
  JSON.stringify(attributes)

class Product extends Batman.Model
  @persist TestStorageAdapter
  @encode "attribute#{i}" for i in [0..50]

products = []
Watson.trackMemory "models with 50 attributes", 2000, 1, (i) ->
  product = new Product
  product.fromJSON(generateAttributes(attributeCount))  if attributeCount > 0
  products.push product
  products = [] if i % 500 == 0
```

In the above snippet of code, we create a new `Product` model every iteration, and add it to an array of products. Most interestingly however, we clear the array of products every 500 iterations of the benchmark. This means we should see a "sawtooth" style graph where 4 times the memory usage drops down to exactly where it started because all the `Product` instances get garbage collected when the array is cleared. In the event that there is a memory leak, we might see memory usage just continually  climb, or when the GC event happens, memory usage might only drop down to twice where it started if some particular internal object is still being referenced. By constructing situations where you hypothesize about the usage of memory over time, and then actually generate the data, you can test that you have actually affected (fixed) whatever exessive memory usage problem you supposed you did.


#### `Watson.benchmark(name, suiteFunction)`

The `benchmark` function allows database logging of the statisitcally significant duration of a particular function's execution time. This is accomplished by leveraging the wicked-cool [`Benchmark.js`](http://benchmarkjs.com/) library. Benchmark's [API documentation](http://benchmarkjs.com/docs) describes how to register a function for evaluation.

`Watson.benchmark` calls the given `suiteFunction` with an instantiated `Benchmark.JS` benchmark suite. That suite's results will be logged, and prefixed under the given `name`. Watson expects the `suiteFunction` to attach a number of test cases to the suite passed as the argument, and then the `suiteFunction` to call the `run` function on the passed suite once all cases have been attached.

Here's an example CPU benchmark suite:

```coffeescript
Batman = require '../../../../lib/dist/batman.node'
Watson = require 'watson'

Watson.benchmark 'event firing', (error, suite) ->
  throw error if error

  do ->
    objects = (new Batman.Object({i}) for i in [0..200])
    suite.add 'once per object with no handlers', ->
      for object in objects
        object.fire('foo')
      true

  do ->
    objects = for i in [0..200]
      object = new Batman.Object({i})
      object 'foo', (newer, older) ->
      object

    suite.add 'once per object with one handler', ->
      for object in objects
        object.fire('foo')
      true

  suite.run()
```

This suite asks Watson to run two different `Benchmark.JS` cases: one which fires an event on an object with 0 event handlers, and one with fires an event on an object with 1 handler. Once the average runtimes of these functions have been established, we can compare to see how much more expensive firing an event with a handler is. Note the `suite.run()` call at the bottom of the callback passed to `benchmark` which is critical to getting the thing to actually do something.

### Modes of Operation

Watson's modes of operation are as follows:

#### node

Watson's first mode of operation is to run your benchmarks inside of `node`. This is handy because node is fast, and node lets you ask it's VM how much memory is occupied. 

Here's some example output of watson when running in the node mode:

```
 ➜  watson run --files=tests/view/loop_rendering_performance.coffee HEAD HEAD~10 HEAD~20
OK: Cloned repo to temp dir /private/var/folders/5k/_m7hl3gs7kn4b6200s356s_m0000gn/T/d-11342-48832-1pl5735.
INFO: Running these tests:
 - /Users/hornairs/Code/batman/tests/prof/tests/view/loop_rendering_performance.coffee
INFO: Running across these revisions:
 - 2b8fded9154af85d5f6311c2a532a92fc00ec30f (HEAD)
 - 541e36d307af17124b4895fadaa1dba7c5a9f208 (HEAD~10)
 - 6aab74c7460f24b9091fb6d9bab927b3cfa23662 (HEAD~20)
OK: Checked out 6aab74c7460f24b9091fb6d9bab927b3cfa23662 (HEAD).
Installing depenencies... done!
INFO: Running tests.
[##########################################################################] 100%
OK: Checked out 541e36d307af17124b4895fadaa1dba7c5a9f208 (HEAD~10).
Installing depenencies... done!
INFO: Running tests.
[##########################################################################] 100%
OK: Checked out 2b8fded9154af85d5f6311c2a532a92fc00ec30f (HEAD~20).
Installing depenencies... done!
INFO: Running tests.
[##########################################################################] 100%
OK: All tests run.
```

You can find more information on the `run` command below, but the gist is this: you call the `watson run` command with an array of `.coffee` files to execute, and an array of git refs to run the files on. Here's what watson does this information:

1. Clone the project to a temporary directory
2. Check out each revision, one at a time
3. Run `npm install` in case your dependencies changed between shas
4. Copy in the newest version of your benchmark code from the files you listed
5. Run the benchmark which will log its results to the database
6. Move on to the next revision
 
#### stack

Watson's second mode of operation is to run your benchmarks in virtualized but real-life browsers using [BrowserStack](http://www.browserstack.com/). This is handy because real browsers are accurate with regards to how much time DOM touches take, and allow you to compare results across different types of browsers to ensure a performance win is in fact a win in the browsers you care about.

`stack` is unfortunately a little complicated. Since a browser needs a page to visit, watson has a `watson serve` command which spawns a webserver to serve the benchmark code. Watson also includes a `watson stack start` command to create a bunch of jobs in the BrowserStack API to visit the various benchmark pages in an array of browsers in order to report the benchmark results. 

The benchmark code is written for `node`, so the node [browserify](https://github.com/substack/node-browserify) module is used to serve up a bundle of code. BrowserStack jobs visit the pages served by `watson serve`, run the benchmark code, and then report back to the web server with an AJAX request. Once all the requests are done, the benchmark harness will issue a kill request for the current BrowserStack job so that BrowserStack will begin the next job in the queue. 

The procedure for running watson benchmarks is as follows:

1. Run the `watson serve` command to spawn the webserver for serving tests and accepting results.
2. Create a tunnel to the server to make it web accessible. You can use the `localtunnel` gem or BrowserStacks's [Local Testing](http://www.browserstack.com/local-testing) JAR's for this. I find `localtunnel` works better.
3. Run the `watson stack start` command with an array of URLs to hit in all the browsers.
4. Check that the BrowserStack workers have been successfully created with the `watson stack list_workers` command.
5. Watch the workers do their work and report back in the `watson serve` webserver output.
6. Wait for the workers to kill them selves, and if you are in a hurry or something goes wrong, use the `watson stack kill_all` command.

Here's an example of running `watson stack`:

In one terminal, run: 

```
 ➜  watson serve
INFO: Watson listening on port 5000
```

In another terminal, make the watson server available to BrowserStack. The easiest way to do this is using [localtunnel](http://progrium.com/localtunnel/):

```
 ➜  gem install localtunnel
Successfully installed localtunnel-0.3
1 gem installed
 ➜  localtunnel 5000
   This localtunnel service is brought to you by Twilio.
   Port 5000 is now publicly accessible from http://3tja.localtunnel.com ...
```

Watson's test index should now be available at the local tunnel url:

```
 ➜  curl http://3tja.localtunnel.com
Moved Temporarily. Redirecting to /tests/⏎
```

Now, use `watson stack start` to enqueue some BrowserStack jobs to run some tests across browsers:

```
 ➜ watson stack  start "http://3jta.localtunnel.com/report.html?file=/object/property_getting_speed.coffee"
INFO: Created worker ID=1132734 heading to http://3jta.localtunnel.com/report.html?file=/object/property_getting_speed.coffee&token=ee8ad0707fafb2cb878a7ead112482dc69dabf0f using opera v12.0 on OS X Mountain Lion, on default device
INFO: Created worker ID=1132733 heading to http://3jta.localtunnel.com/report.html?file=/object/property_getting_speed.coffee&token=a8278d8569ba79046c5215ca5a5987d81939f841 using firefox v20.0 on OS X Mountain Lion, on default device
INFO: Created worker ID=1132735 heading to http://3jta.localtunnel.com/report.html?file=/object/property_getting_speed.coffee&token=c3ec83021b1c64c4a505f3ee5873b6e5adc912a1 using chrome v27.0 on OS X Mountain Lion, on default device
INFO: Created worker ID=1132736 heading to http://3jta.localtunnel.com/report.html?file=/object/property_getting_speed.coffee&token=5cc03a9a78a36028dcd918731d1ddaa351a2009f using chrome v18.0 on Windows XP, on default device
INFO: Created worker ID=1132737 heading to http://3jta.localtunnel.com/report.html?file=/object/property_getting_speed.coffee&token=b8110ccab8f0761e6bb3504ddfa78ec210e0c5d7 using firefox v5.0 on Windows XP, on default device
INFO: Created worker ID=1132738 heading to http://3jta.localtunnel.com/report.html?file=/object/property_getting_speed.coffee&token=8d907530be969a180a1c3f54b372ca2b5a763203 using ie v8.0 on Windows XP, on default device
INFO: Created worker ID=1132739 heading to http://3jta.localtunnel.com/report.html?file=/object/property_getting_speed.coffee&token=837d0b5cd1d5550ddf796534e656a2cd9d4de48e using safari v5.0 on Windows XP, on default device
INFO: Created worker ID=1132740 heading to http://3jta.localtunnel.com/report.html?file=/object/property_getting_speed.coffee&token=8269f0f4356dae77a5ad61c5cc3463fc18ddf04a using safari v6.0 on OS X Mountain Lion, on default device
INFO: Created worker ID=1132741 heading to http://3jta.localtunnel.com/report.html?file=/object/property_getting_speed.coffee&token=298afed490c131736d104c9ba5ad3e1669fd317f using ie v10.0 on Windows 8, on default device
INFO: Created worker ID=1132742 heading to http://3jta.localtunnel.com/report.html?file=/object/property_getting_speed.coffee&token=c19746108e28af12b331ebdfc50383586a1b964e using ie v9.0 on Windows 7, on default device
INFO: Created worker ID=1132743 heading to http://3jta.localtunnel.com/report.html?file=/object/property_getting_speed.coffee&token=c9f80b9fbe52435ccc9dcb25e3c15c5f95d916d6 using undefined on ios 5.0, on iPad 2 (5.0)
```

If we ask Watson what workers have been created, we can see a list of the jobs created:

```
 ➜  watson stack list_workers
INFO: Workers:
 - Worker 1132733 with status running
 - Worker 1132734 with status running
 - Worker 1132735 with status running
 - Worker 1132736 with status running
 - Worker 1132737 with status running
 - Worker 1132738 with status queue
 - Worker 1132739 with status queue
 - Worker 1132740 with status queue
 - Worker 1132741 with status queue
 - Worker 1132742 with status queue
 - Worker 1132743 with status queue
```

If you look at the output of the `watson serve` command, we should see entries created by the BrowserStack workers visiting the pages:

```
. . . snip . . .
INFO: Serving /view/loop_rendering_performance.coffee
127.0.0.1 - - [Wed, 29 May 2013 01:13:34 GMT] "GET /report.html?file=/view/loop_rendering_performance.coffee HTTP/1.0" 200 809904 "http://3tja.localtunnel.com/tests/view" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.20 Safari/537.36"
- - - [Wed, 29 May 2013 01:13:35 GMT] "GET /watson/es5-shim.min.js HTTP/1.0" 200 11353 "http://3tja.localtunnel.com/report.html?file=/view/loop_rendering_performance.coffee" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.20 Safari/537.36"
- - - [Wed, 29 May 2013 01:13:35 GMT] "GET /watson/html5shiv.js HTTP/1.0" 200 2380 "http://3tja.localtunnel.com/report.html?file=/view/loop_rendering_performance.coffee" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.20 Safari/537.36"
- - - [Wed, 29 May 2013 01:13:35 GMT] "GET /watson/es5-sham.min.js HTTP/1.0" 200 4710 "http://3tja.localtunnel.com/report.html?file=/view/loop_rendering_performance.coffee" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.20 Safari/537.36"
. . . snip . . .
```

As the benchmarks complete in the various browsers, we should see HTTP POSTs reporting the results to the `watson serve` logs:

```
. . . snip . . .
- - - [Wed, 29 May 2013 01:14:10 GMT] "POST /save_results HTTP/1.0" 200 21 "http://3tja.localtunnel.com/report.html?file=/view/loop_rendering_performance.coffee" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.20 Safari/537.36"
- - - [Wed, 29 May 2013 01:14:10 GMT] "POST /save_results HTTP/1.0" 200 21 "http://3tja.localtunnel.com/report.html?file=/view/loop_rendering_performance.coffee" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.20 Safari/537.36"
. . . snip . . . 
```

You can also kill workers if you are impatient or something has gone wrong:

```
 ➜  watson stack kill_all
INFO: Terminated worker 1132769
INFO: Terminated worker 1132770
INFO: Terminated worker 1132771
```

### Commands

#### Global Options

 - `-c, --config [PATH]`: Path to configuration file (Default is ./watson.json)
 - `-k, --no-color`: Omit color from output
 - `--debug`: Show debug information
 - `-h, --help`: Display help and usage details

#### `watson bootstrap`

`watson bootstrap` sets up your local MySQL database schema to match the one Watson expects. Kinda akin to `rake db:migrate`, but not quite as smart.

#### `watson run`

Template: `watson run --files=some/*/file/glob/**.coffee refA refB refC`

Options:

 - `-f, --files STRING`: Glob of tests to run
 - `-s, --suppress BOOLEAN`: Supress errors in benchmarks
 - `-l, --link-node-modules [BOOLEAN]`: Link node-modules from source dir in temp test dir instead of re-installing in tmp dir (Default is true)
 - varargs: list of git refs to run the passed files across
 
`watson run` runs the provided files across the provided git refs using the procedure described in the __node__ example. The files are passed using the `--files` option as a `sh` glob, and the git refs are passed as successive freestanding arguments to the program. Here refs means anything `git rev-parse` can turn into a `SHA`, like `HEAD`, `master~10`, `my-cool-branch`, or `v1.0.10`. 

`watson run` does this by actually checking out each passed rev, and then executing each specified file in its own isolated child process. This means each file executes in its own clean global context, and each file starts even with regards to memory. There is no parallel execution in favour of repeatable CPU profiling results and in opposition to total run duration. The individual child processes are executed with the node `--prof` option to enable the V8 profiler and allow things like the node `profiler` module to inspect VM state. Each child process is also responsible for connecting to the database and logging it's results through the `Tracker` API.

#### `watson serve`

`watson serve` spawns the watson web server on port `5000`. Do feel free to make that configurable.
  
#### `watson stack start`

`watson stack start [firstURL] [secondURL]` spawns BrowserStack worker jobs for the default stack of browsers to visit each URL listed in the varargs. Usually these will be urls pointing to some tunnel to a running `watson serve` instance.
 
#### `watson stack kill_all`

#### `watson truncate`

#### `watson report`


## Contributing

License: MIT