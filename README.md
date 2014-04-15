ocean-stream
============

Create a temporary digital ocean instance, stream commands to it over ssh, and receive a stream of the output.  Automatically destroy the instance on end (if you want to keep it open, don't emit end on the stream).

## Example

```javascript
fs.createReadStream('./test.sh')
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
