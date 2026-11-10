# filenet

`filenet` sends a file over the network in chunks. It runs a TCP server that serves a single file, and any number of clients can connect and receive it at the same time. The stream is raw file data, so clients do not need any special protocol support.

## Install

```bash
# npm
npm install -g filenet

# pnpm
pnpm install -g filenet
```

Run it with the `filenet` command, or without a global install with `npx filenet ...`.

## Serve a file

```bash
filenet serve /tmp/file.mp4
```

This starts a server on `0.0.0.0:6016` with 1 MiB chunks and a 500 ms delay between chunks.

### Options

| Option | Default | Description |
| --- | --- | --- |
| `--port` | `6016` | TCP port to listen on |
| `--host` | `0.0.0.0` | Address to bind |
| `--chunksize` | `1M` | Size of each chunk. Accepts bytes or a `K`/`M`/`G` postfix, for example `10K`, `2M`, or `1.5G` |
| `--delay` | `500` | Delay between chunks, in milliseconds |

### Example

```bash
filenet serve --chunksize 2M --delay 100 --host 127.0.0.1 --port 6016 /tmp/file.mp4
```

The server keeps running until it is stopped. Every client that connects receives the full file independently.

## Receive a file

Connect with any TCP client. For example, with `netcat`:

```bash
nc 127.0.0.1 6016 > file.mp4
```

## Use as a library

```bash
npm install filenet
```

```ts
import { serveFile } from 'filenet'

const server = serveFile(6016, '0.0.0.0', '/tmp/file.mp4', {
  chunksize: 2 * 1024 * 1024, // bytes
  delay: 100, // milliseconds between chunks
})

// Stop accepting new connections when done.
server.close()
```

`serveFile` returns the underlying `net.Server`. It does not close active client connections for you.
