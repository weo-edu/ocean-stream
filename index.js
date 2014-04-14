var ssh = require('stream-ssh');
var DigitalOceanApi = require('digitalocean-api');
var moment = require('moment');
var Seq = require('seq');
var _ = require('lodash');
var streamify = require('streamify');


module.exports = function(config) {
  var api = config.api;
	var client  = new DigitalOceanApi(api.client, api.key);
  var sshKeys, defaultSize, dropletId;
  var stream = streamify();

  Seq()
    .seq(function() {
      client.sizeGetAll(this);
    })
    .seq(function(sizes) {
      defaultSize = _(sizes)
        .where({name: '2GB'})
        .value()[0];
      client.sshKeyGetAll(this);
    })
    .seq(function(keys) {
      sshKeys = keys;
      client.imageGetMine(this)
    })
    .seq(function(images) {
      var defaultImage = _(images)
        .reverse()
        .where({name: 'ocean-stream-default'})
        .value()[0];
      console.log('image', defaultImage);
      var opts = _.defaults(config.droplet || {}, {
        name: 'Ocean-Stream-' + moment().toISOString().replace(/:/g, '-'),
        size: defaultSize.id, // 2gb
        image: defaultImage.id,
        region: 3, // san fran
        ssh_keys: _.pluck(sshKeys, 'id')
      })
      console.log('opts', opts);
      client.dropletNew(opts.name, opts.size, opts.image, opts.region, {
        ssh_key_ids: opts.ssh_keys.join(',')
      }, this)
    })
    .seq(function(instance) {
      dropletId = instance.id;
      var self = this;
      var interval = setInterval(function() {
        client.eventGet(instance.event_id, function(err, evt) {
          console.log('evt', evt);
          if (evt.percentage === '100') {
            clearInterval(interval);
            self();
          }
        })
      }, 2000);
    })
    .seq(function() {
      client.dropletGet(dropletId, this);
    })
    .seq(function(droplet) {
      console.log('resolve stream');
      stream.resolve(ssh(config.ssh));
    });


  return stream;
}


fs.createReadStream('./test.sh')
  .pipe(es.split())
  .pipe(module.exports({
    api: {
      key: "7f59e7507df7b193d49a2dc46a36e4e2",
      client: "f62aa48d2408f533af8735bc1a2b6a22"
    }
    ssh: {
      username: 'task',
      privateKey: fs.readFileSync(path.resolve(process.env.HOME, '.ssh/id_rsa'))
    }
  ))
  .pipe(consoleStream());
