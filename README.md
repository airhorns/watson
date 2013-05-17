# Watson

Sleuth out JS performance issues.

## How it works

Watson works by cloning the whole batman repo to a temporary directory, checking out each SHA, running the tests you specified via 'coffee' sub processes, and then tracking the data, allowing you to report on it using Tiller.


# NOTE for V8 Profiling
Grab the source distro of node that matches your current install.
Compile the v8 engine in $(nodesrc)/deps/v8
set the environment variable D8_PATH=$(nodesrc)/deps/v8


