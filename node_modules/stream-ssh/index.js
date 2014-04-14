var ssh2 = require('ssh2');
var consoleStream = require('console-stream');
var fs = require('fs');
var path = require('path');
var through = require('through');
var es = require('event-stream');


module.exports = function(config) {
  var conn = new ssh2();
  var ready = false;
  var commandStream = es.through();
  commandStream.pause();

  var outStream = es.through(function(data) {
    commandStream.queue(data);
  }, function(){
    commandStream.queue(null);
  });

  commandStream.pipe(es.through(function(cmd) {
    var self = this;
    this.pause();
    console.log(cmd);
    conn.exec(cmd, function(err, stream) {
      stream.on('data', function(data) {
        outStream.emit('data', data)
      });
      stream.on('end', function() {
        self.resume();
      }); 
    });
  }, function(){
    outStream.emit('end');
    conn.end();
  }))

  conn.connect(config);
  conn.on('ready', function() {
    ready = true;
    commandStream.resume();
  });

  return outStream;
}



/* Example:
fs.createReadStream('./test.sh')
  .pipe(es.split())
  .pipe(module.exports({
  host: '107.170.198.91',
  username: 'task',
  privateKey: fs.readFileSync(path.resolve(process.env.HOME, '.ssh/id_rsa'))
}))
  .pipe(consoleStream());

*/