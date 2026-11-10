# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this project is

`filenet` is a small TypeScript utility that serves a single file over raw TCP,
in chunks, to multiple clients at once. It ships as both a CLI
(`filenet serve <file>`) and a library (`serveFile(...)`). There is no HTTP and
no protocol framing: clients connect with `nc` and stream the bytes out.

## Commands

Run everything from the repository root. Use pnpm; the lockfile and
`packageManager` field assume it. Node LTS (20+) is expected.

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install dependencies |
| `pnpm dev` | TypeScript watch build for development |
| `pnpm build` | Production build into `dist/` (ESM + `.d.ts`) |
| `pnpm start` | Build, then run the CLI from `dist/` |
| `pnpm test` | One-shot test run |
| `pnpm test:watch` | Vitest watch mode |
| `pnpm coverage` | Test coverage |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint with `@antfu/eslint-config` |
| `pnpm release` | release-it; only from `main` |

Before declaring work done: `pnpm lint`, `pnpm typecheck`, and `pnpm test` must
pass. Run `pnpm build` too if exports or build inputs changed.

Spell checking is not a standalone script. It runs from the Husky hooks; run it
manually with:

```bash
pnpm exec cspell --no-summary --no-progress <files>
```

## Layout

- `src/index.ts`: public library entry point. Keep the public surface here.
- `src/cli.ts`: citty root command. Subcommands are registered here.
- `src/commands/serve.ts`: the `serve` command and its argument parsing.
- `src/core/server-file.ts`: TCP server, connection lifecycle, wiring between
  `SocketChunker` instances and progress bars.
- `src/core/socket-chunker.ts`: per-socket read/write loop, chunk delay, EOF
  and closed-socket handling.
- `src/core/progress-bars.ts`: `cli-progress` `MultiBar` wrapper, one bar per
  connected client.
- `src/core/util.ts`: size formatting/parsing and socket naming.
- `test/`: Vitest tests. Keep test names aligned with the source module.

## Architecture notes

- One `SocketChunker` exists per connection. It reads `chunkSize` bytes at
  `_position` via `read-chunk`, writes them to the socket, reports progress,
  then schedules the next chunk after `delay` ms.
- A transfer ends when the socket is closed (`socketIsClosed`) or when a short
  or empty read is returned. In the latter case the chunker calls
  `socket.end()` and `socket.destroy()`.
- `nextChunk` never rejects. A failed read (the file was deleted or replaced
  mid transfer) calls `onError` to report it and destroys the socket, because a
  rejected floating promise would kill the process. Anything that reads the
  file per chunk has to keep that property.
- `serveFile` returns the `net.Server` but does not manage its lifecycle. There
  is no SIGINT handling, and the CLI currently ignores the returned server.
- Per-client progress totals are `ceil(fileSize / chunkSize)` chunks, keyed by
  `remoteAddress:remotePort`.
- `chunkSize` and `delay` have different defaults in the CLI (1M, 500 ms) and in
  the library (1 MiB, 1000 ms). If you change one, decide whether the other
  should follow.
- Every accepted socket needs an `'error'` listener. Node rethrows an unhandled
  `'error'` event, so a single client that aborts with `ECONNRESET` would kill
  the process. The socket is destroyed right after the error, which fires
  `'close'` and stops the chunker.
- Capture the client name when the connection opens. `remoteAddress` and
  `remotePort` are gone once the socket is destroyed, so the `'close'` handler
  must not re-read them.
- Do not introduce framing, headers, or handshakes into the stream.
  `nc host port > file` compatibility is the core promise.

## Coding conventions

- TypeScript strict mode, ESM first, bundler module resolution for typecheck.
- Source relative imports use explicit `.js` extensions: the build is plain
  `tsc` with `NodeNext` resolution and the package is ESM only.
- Style comes from `@antfu/eslint-config`: single quotes, no semicolons,
  2-space indentation, sorted imports. Do not add Prettier. Format through
  ESLint.
- Prefer small, focused modules under `src/core/` and explicit relative
  imports (for example `./core/socket-chunker`) over `..` barrel imports in new
  code.
- Use the `node:` prefix for built-ins and type-only imports, for example
  `import type { Socket } from 'node:net'`.
- Route user-facing output and errors through `consola`.
- Define CLI options in citty `args` with defaults and descriptions, and parse
  numeric values explicitly.
- Do not use em dashes in prose, comments, commit messages, or documentation.
  Use a plain hyphen.
- `chunksize` is intentionally one word. Add legitimate new terms to
  `project-words.txt` instead of disabling spell checking.

## Tests

- Vitest files live in `test/*.test.ts`, one file per source module.
- `test/util.test.ts` covers size formatting and parsing with table style
  assertions.
- `test/socket-chunker.test.ts` drives the chunker directly: a temp file plus a
  fake `EventEmitter` socket, so chunk boundaries, EOF, the delay and the
  closed-socket guard can be asserted without a real connection. Copy that
  fake when you need to test socket behavior.
- `test/server-file.test.ts` is the integration test. It serves a temp file on
  port `0`, reads it back over a real TCP socket, and mocks `cli-progress` and
  `consola` to keep the output clean. Prefer this style for end-to-end checks.
- `test/serve-command.test.ts` covers CLI argument parsing with `serveFile`
  mocked. Keep its expectations in sync with the README option table.
- `test/index.test.ts` checks that the package entry point exports `serveFile`.
- CI (`.github/workflows/build-typecheck-test.yml`) runs lint, typecheck,
  tests, and the build on pushes and pull requests to `main`.
- Do not bind fixed ports in tests without cleanup. Prefer port `0` or close
  the server in `afterEach`.

## Git and releases

- Use Conventional Commits, enforced by commitlint:
  `<type>(optional scope): <summary>`, no trailing period.
- Valid types: `feat`, `fix`, `docs`, `refactor`, `test`, `build`, `ci`,
  `chore`, `perf`, `revert`.
- The pre-commit hook runs `lint-staged` (`eslint --fix`) and cspell on staged
  files. The commit-msg hook runs commitlint and cspell on the message.
- `CHANGELOG.md` is generated by release-it with
  `release-it-beautiful-changelog`. Never edit it by hand.
- Never hand-edit `dist/` (gitignored) or `pnpm-lock.yaml`.
- Releases happen through `pnpm release` on `main`. Do not create tags or
  GitHub releases manually.
- Never add an AI agent as a co-author or add an agent co-author trailer.

## Gotchas and known drift

- The CLI version is hardcoded to `0.0.1` in `src/cli.ts` and does not track
  `package.json`. If you touch it, prefer deriving it from one source.
- `serveFile` calls `fs.statSync` eagerly, so a missing file throws
  synchronously before the server starts, but nothing checks the file again
  afterwards. Deleting the file mid transfer drops that client's connection and
  is reported through `onError`; the server itself stays up.
- `humanFileSizeToBytes` treats a bare number as bytes and only inspects the
  last character for a unit. Keep the CLI help text in sync with that behavior.
- `humanFileSize(0)` returns `NaN undefined` because `Math.log(0)` is
  `-Infinity`. Serving an empty file prints that in the banner. Untested on
  purpose; fix the formatter if you touch it.
- A file whose size is an exact multiple of `chunkSize` costs one extra read
  that returns an empty buffer, and that empty chunk still reports progress.
  `test/socket-chunker.test.ts` pins this behavior.
- `pnpm-workspace.yaml` lists workspace packages that do not exist. This is a
  single-package repository.

## Definition of done

- `pnpm lint`, `pnpm typecheck`, and `pnpm exec vitest run` pass.
- `pnpm build` succeeds if public exports or build inputs changed.
- New CLI behavior is reflected in the README.
- Tests cover new non-trivial logic.
- Commits are Conventional Commits without agent attribution.
