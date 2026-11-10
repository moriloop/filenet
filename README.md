# filenet

A small network testing utility that serves a file over a socket in chunks, with a configurable chunk size and delay between chunks.

It is built for testing and debugging programs that read from sockets: you control how much data arrives at a time and how fast, so you can reproduce slow consumers, partial reads, backpressure, and multi-client behavior against a predictable stream.

> Currently filenet uses raw TCP. UDP support is planned. Either way, the stream carries raw file bytes with no headers, framing, or handshake, so any client can read it.

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

This listens on `0.0.0.0:6016`, sends 1 MiB chunks, and pauses 500 ms between chunks. Every client that connects receives the file independently, which makes it easy to run several test clients at once.

Read it back with any TCP client, for example `netcat`:

```bash
nc 127.0.0.1 6016 > file.mp4
```

The server keeps running until it is stopped.

### Options

| Option | Default | Description |
| --- | --- | --- |
| `--port` | `6016` | Port to listen on |
| `--host` | `0.0.0.0` | Address to bind |
| `--chunksize` | `1M` | Size of each chunk. Accepts bytes or a `K`/`M`/`G` postfix, for example `10K`, `2M`, or `1.5G` |
| `--delay` | `500` | Delay between chunks, in milliseconds |

### Example

```bash
filenet serve --chunksize 2M --delay 100 --host 127.0.0.1 --port 6016 /tmp/file.mp4
```

## Use as a library

```bash
npm install filenet
```

Requires Node 22.12 or newer. The package is ESM-only; use `import`, not
`require`.

```ts
import { serveFile } from 'filenet'

const server = serveFile(6016, '0.0.0.0', '/tmp/file.mp4', {
  chunksize: 2 * 1024 * 1024, // bytes
  delay: 100, // milliseconds between chunks
})

// Stop accepting new connections when done.
server.close()
```

The library defaults differ from the CLI: 1 MiB chunks and a 1000 ms delay. `serveFile` returns the underlying `net.Server`; it does not close active client connections for you.
