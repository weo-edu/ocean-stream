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

  function notifyIfNotDestroyed(seq) {
    if(! seq.destroyed) {
      console.log('DROPLET NOT DESTROYED, Make sure that you'
        + ' destroy it manually in your digital ocean account,'
        + ' otherwise you will continue to be billed for it', err);
    }
  }

  function ensureDestroyed(seq, droplet, die) {
    if(! seq.destroyed) {
      client.dropletDestroy(droplet.id, function(err) {
        seq.destroyed = ! err;
        notifyIfNotDestroyed(seq);
        die && process.exit(1);
      });
    } else
      die && process.exit(1);
  }

  Seq()
    .seq(function() {
      client.sizeGetAll(this);
    })
    .seq(function(sizes) {
      // Sizes are all upper-case, but our interface can be
      // forgiving in that regard
      config.size = (config.size || '2GB').toUpperCase();

      var size = _.find(sizes, {name: config.size});
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
      droplet.image = _.find(images, {name: config.image}).id;
      client.dropletNew(droplet.name, droplet.size, droplet.image, droplet.region, {
        ssh_key_ids: droplet.ssh_keys
      }, this);
    })
    .seq(function(instance) {
      var self = this;
      this.destroyed = false;
      // Do our best to guarantee that the droplet is destroyed
      // no matter what
      var destroy = ensureDestroyed.bind(null, this, instance, true);
      process.on('SIGINT', destroy);
      process.on('uncaughtException', destroy);
      process.on('exit', notifyIfNotDestroyed.bind(null, self));

      var last = 0;
      var bar = new ProgressBar(' Provisioning droplet [:bar] :percent :etas', {
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
      console.log('Waiting for the server to start...');
      pollPort(22, droplet.ip_address, 60000, function(err) {
        self(err, droplet);
      });
    })
    .seq(function(droplet) {
      stream.connect({
        host: droplet.ip_address,
        username: config.user,
        privateKey: config.privateKey,
        shell: {}
      }).on('end', this.bind(null, null, droplet));
    })
    .catch(function(err) {
      stream.emit('error', err);
      this();
    })
    .seq(function(droplet) {
      console.log('destroying...');
      client.dropletDestroy(droplet.id, this);
    })
    .seq(function(id) {
      this.destroyed = true;
      console.log(id, 'destroyed');
      this();
    })
    .catch(function(err) {
      console.log('Error destroying, you MUST shutdown the instance manually');
      this();
    });

  return stream;
};