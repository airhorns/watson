# Watson

Sleuth out JS performance issues.

## How it works

Watson works by cloning the whole batman repo to a temporary directory, checking out each SHA, running the tests you specified via 'coffee' sub processes, and then tracking the data, allowing you to report on it using Tiller.

