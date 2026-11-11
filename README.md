# filenet

filenet is a small network utility that serves a single file over raw TCP (or
best-effort UDP) in chunks, to many clients at once. There is no HTTP, no
protocol framing, and no handshake: the TCP stream is exactly the file bytes,
so `nc host port > file` works out of the box. You control the chunk size and
the delay between chunks, which makes filenet a controlled-network-transfer
test and debug harness for programs that read from sockets.

Typical applications:

- Reproduce slow consumers, partial reads, and backpressure against a
  predictable byte stream.
- Test multi-client behavior: every connected client receives the file
  independently.
- Check how an application behaves over lossy, unordered UDP datagrams.
- Push a file to one address with `filenet send` instead of waiting for a
  client to connect.
- Use it as a library (`serveFile`, `sendFile`) in your own test scripts.

## Quick start

Install:

```bash
# npm
npm install -g filenet

# pnpm
pnpm install -g filenet
```

Or run without installing via `npx filenet ...`.

### Serve a file

```bash
filenet serve /tmp/file.mp4
```

This listens on `0.0.0.0:6016` (TCP) and sends 1 MiB chunks with a 500 ms pause
between chunks. Every client that connects gets the full file independently.

Read it back with any TCP client:

```bash
nc 127.0.0.1 6016 > file.mp4
```

Stop the server with `Ctrl-C`.

### Also: serve over UDP

```bash
filenet serve --udp --chunksize 1400 /tmp/file.mp4
```

UDP binds to `127.0.0.1` by default. A transfer starts when the peer sends any
datagram to the bound port:

```bash
printf 'go' | nc -u -w 1 127.0.0.1 6016 > file.mp4
```

UDP is lossy by design: one chunk per datagram, no EOF marker, no
retransmission, no ordering guarantee. The receiver must know how many bytes to
expect or use an idle timeout.

### Also: send a file to one peer

`send` pushes the file to a single `host:port` instead of listening:

```bash
filenet send --tcp --target 192.168.1.50:9000 --chunksize 2K --delay 300 /tmp/file.mp4
```

On the receiver, just listen:

```bash
nc -l 9000 > file.mp4
```

UDP send works the same way with `--udp`; the receiver must be bound before the
first datagram arrives.

## Examples

Serve a big file slowly, two megabytes at a time, to a local client only:

```bash
filenet serve --chunksize 2M --delay 100 --host 127.0.0.1 /tmp/backup.iso
```

Serve over UDP from a small test file:

```bash
filenet serve --udp --chunksize 1K --delay 300 ~/test.txt
```

Send that same file to a peer on port 9000:

```bash
filenet send --udp --target 127.0.0.1:9000 --chunksize 1K --delay 300 ~/test.txt
```

Send over TCP (the default):

```bash
filenet send --target 192.168.1.50:9000 --chunksize 2M --delay 500 /tmp/file.mp4
```

IPv6 targets use brackets:

```bash
filenet send --target '[::1]:9000' ~/test.txt
```

### Notes

- TCP carries raw file bytes with no headers or framing, so any TCP client can
  read the stream. Do not expect an EOF marker from UDP: datagrams are
  independent and may be lost or reordered.
- `--tcp` and `--udp` are mutually exclusive in `send`; `serve` uses `--udp` to
  switch transport.
- Chunk size accepts bytes or a `K`/`M`/`G` postfix, for example `10K`, `2M`,
  `1.5G`. UDP chunks cannot exceed 65507 bytes, the largest IPv4 UDP payload.
- Exposing a UDP listener to the public internet is risky: a small datagram can
  make the server stream a whole file to a spoofed address. Only bind
  `0.0.0.0` on a trusted network.
- Serving an empty file prints a garbled size in the banner (`humanFileSize(0)`
  is `NaN undefined`). This is a known wart, not a feature.

## Command reference

### `filenet serve <file>`

| Option | Default | Description |
| --- | --- | --- |
| `--port` | `6016` | Port to listen on |
| `--udp` | `false` | Serve over UDP instead of TCP |
| `--host` | `0.0.0.0` (TCP), `127.0.0.1` (UDP) | Address to bind |
| `--chunksize` | `1M` (TCP), `1400` (UDP) | Chunk size in bytes or `K`/`M`/`G` postfix |
| `--delay` | `500` (TCP), `0` (UDP) | Delay between chunks in milliseconds |

### `filenet send --target <host:port> <file>`

| Option | Default | Description |
| --- | --- | --- |
| `--target` | required | `host:port` or `[ipv6]:port` to send to |
| `--udp` | `false` | Send over UDP instead of TCP |
| `--tcp` | `false` | Send over TCP (the default) |
| `--chunksize` | `1M` (TCP), `1400` (UDP) | Chunk size in bytes or `K`/`M`/`G` postfix |
| `--delay` | `500` (TCP), `0` (UDP) | Delay between chunks in milliseconds |

## Use as a library

```bash
npm install filenet
```

Requires Node 22.12 or newer. The package is ESM-only; use `import`, not
`require`.

```ts
import { sendFile, serveFile } from 'filenet'

const server = serveFile(6016, '0.0.0.0', '/tmp/file.mp4', {
  chunksize: 2 * 1024 * 1024,
  delay: 100,
  protocol: 'tcp',
})

server.close()

await sendFile({ host: '192.168.1.50', port: 9000 }, '/tmp/file.mp4', {
  chunksize: 2 * 1024 * 1024,
  delay: 300,
  protocol: 'udp',
})
```

Library defaults differ from the CLI: 1 MiB chunks and a 1000 ms delay for TCP,
1400-byte chunks and a 0 ms delay for UDP. `serveFile` returns the underlying
`net.Server` for TCP or `dgram.Socket` for UDP; it does not close active client
connections. `sendFile` resolves when the file has been sent and rejects on
lookup, connect, write, or read errors.

## Developing

Clone the repo and install dependencies:

```bash
git clone https://github.com/moriloop/filenet.git
cd filenet
pnpm install
```

Run the built CLI from `dist/`:

```bash
pnpm start serve ~/test.txt
pnpm start send --udp --target 127.0.0.1:9000 --chunksize 1K --delay 300 ~/test.txt
```

`pnpm start` builds first, so it reflects the current source. For iterative
work, run the TypeScript watch build:

```bash
pnpm dev
```

Then run `dist/cli.js` directly, or import from `src/` in a Vitest test.

### Using as a library during development

Import from the source tree in your own scripts or tests:

```ts
import { serveFile } from './src/core/server-file.js'

const server = serveFile(6016, '127.0.0.1', '~/test.txt', {
  chunksize: 1024,
  delay: 300,
  protocol: 'udp',
})
```

The repo has one Vitest file per source module under `test/`:

```bash
pnpm test        # one-shot run
pnpm test:watch  # watch mode
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
```

Before declaring work done, `pnpm lint`, `pnpm typecheck`, and `pnpm test`
must pass; run `pnpm build` too if public exports or build inputs changed.

## Contributing

filenet wants to be a very easy and useful controlled-network-transfer-files
test/debug harness. Ideas and contributions are welcome:

- More send/serve knobs (rate limits, burst sizes, per-client limits).
- A tiny receiver counterpart that counts datagrams and verifies the bytes.
- Library helpers for common test scenarios (slow reader, abrupt close,
  flaky UDP loss).
- Better progress reporting or a JSON/structured log mode.

Open an issue or send a pull request. Keep commit messages conventional
(`feat:`, `fix:`, `docs:`, ...), no trailing period, and never add an AI agent
as co-author.
