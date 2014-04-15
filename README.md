ocean-stream
============

Create a temporary digital ocean instance, stream commands to it over ssh, and receive a stream of the output.  Automatically destroy the instance on end (if you want to keep it open, don't emit end on the stream).

For this to work, requires that your image either be pre-loaded with your ssh keys, or your ssh key be one of the existing keys in your account (they are all added automatically, unless you specify a list of key ids).

## Example

```javascript
fs.createReadStream('./task.sh')
  .pipe(es.split())
  .pipe(oceanStream({
    key: '<your API key>',
    client: '<your client ID>',
    size: '4GB',
    name: 'task runner',
    username: 'task'
  }))
  .pipe(consoleStream());
```

## Options

- `key` your digital ocean api key
- `client` your digital ocean client id
- `size` the size (in units of memory) of the instance you want (as a string, e.g. '4GB')
- `name` the name of the image you want to create this instance from
- `ssh_keys` the ssh keys that you want to have automatically added to this instance (an array of either the names, in your digital ocean account of the keys, or their id's as returned by the digital ocean ssh_keys api call)
- `username` the username you want to login to the instance with, once its started up (defaults to root).
- `region` digital ocean region id
- `privateKey` the key you want to use to connect to the instance.  Defaults to ~/.ssh/id_rsa if you don't specify.
