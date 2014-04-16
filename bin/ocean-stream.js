#!/usr/bin/env node
var argv = require('minimist')(process.argv.slice(1 + (process.argv[0] === 'node')));

// Default to stdin so that things can be piped from the shell
var stream = process.stdin;

// If a non-optional argument is specified, assume its a shell script of commands
if(argv._.length)
  stream = fs.createReadStream(argv._[0]);

var oceanStream = require('../');
stream.pipe(oceanStream({
  key: process.env.DIGITAL_OCEAN_KEY,
  client: process.env.DIGITAL_OCEAN_CLIENT,
  size: argv.size,
  image: argv.image,
  user: argv.user
}))
.on('error', function(code) {
  console.log('Task failed with code: ' + code);
  throw new Error;
})
.on('end', function() {
  console.log('stream ended');
})
.pipe(require('console-stream')());
