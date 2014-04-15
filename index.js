var ssh = require('stream-ssh');
var DigitalOceanApi = require('digitalocean-api');
var Seq = require('seq');
var _ = require('lodash');
var ProgressBar = require('progress');
var pollPort = require('poll-port');

module.exports = function(config) {
  var stream = ssh();
  var client  = new DigitalOceanApi(config.client, config.key);
  var droplet = {
    region: config.region || 3,
    name: 'Ocean-Stream-' + (new Date).toISOString().replace(/:/g, '-')
  };

  config.username = config.username || 'root';

  Seq()
    .seq(function() {
      client.sizeGetAll(this);
    })
    .seq(function(sizes) {
      var size = _.find(sizes, {name: config.size || '2GB'});
      droplet.size = droplet.size || size.id;
      client.sshKeyGetAll(this);
    })
    .seq(function(keys) {
      if(config.ssh_keys) {
        droplet.ssh_keys = [].concat(config.ssh_keys);
        // If the user has passed in keys, allow them to
        // refer to them by name instead of by id
        droplet.ssh_keys = droplet.ssh_keys.map(function(key) {
          if(isNaN(Number(key))) {
            key = _.find(keys, {name: key});
            if(! key) throw new Error('SSH Key: "' + key.name + '" not found');
            key = key.id;
          }
          return key;
        });
      } else {
        // If not, default to all the keys listed in the
        // account
        droplet.ssh_keys = _.pluck(keys, 'id');
      }

      client.imageGetMine(this)
    })
    .seq(function(images) {
      droplet.image = _.find(images, {name: config.name}).id;
      client.dropletNew(droplet.name, droplet.size, droplet.image, droplet.region, {
        ssh_key_ids: droplet.ssh_keys
      }, this);
    })
    .seq(function(instance) {
      var self = this;
      var last = 0;
      var bar = new ProgressBar(' Booting droplet [:bar] :percent :etas', {
        complete: '=',
        incomplete: ' ',
        width: 20,
        total: 100,
        callback: function() {
          clearInterval(interval);
          self(null, instance);
        }
      });
      var interval = setInterval(function() {
        client.eventGet(instance.event_id, function(err, evt) {
          if(err) throw err;
          var p = Number(evt.percentage);
          bar.tick(p - last);
          last = p;
        });
      }, 2000);
    })
    .seq(function(instance) {
      client.dropletGet(instance.id, this);
    })
    .seq(function(droplet) {
      // Wait for the server to *really* be finished starting up, as
      // its not usually accepting incoming connections quite yet
      var self = this;
      pollPort(22, droplet.ip_address, 30000, function(err) {
        self(err, droplet);
      });
    })
    .seq(function(droplet) {
      stream.connect({
        host: droplet.ip_address,
        username: config.username,
        privateKey: config.privateKey
      }).on('end', this.bind(null, null, droplet));
    })
    .seq(function(droplet) {
      console.log('destroying...');
      client.dropletDestroy(droplet.id, this);
    })
    .seq(function(id) {
      console.log(id, 'destroyed');
      this();
    })
    .catch(function(err) {
      stream.emit('error', err);
    });

  return stream;
};