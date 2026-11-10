
# Changelog

All considerable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## v0.2.1

[compare changes](https://github.com/moriloop/filenet/compare/v0.1.3...v0.2.1)

### 🩹 Fixes

- Keep the server running when a client aborts or the file disappears ([b581b77](https://github.com/moriloop/filenet/commit/b581b77))
- **build:** Fix previous version ([5643c65](https://github.com/moriloop/filenet/commit/5643c65))
- Fix npm release config ([d5c8960](https://github.com/moriloop/filenet/commit/d5c8960))
- **release:** Set explicit git tag name ([acf0242](https://github.com/moriloop/filenet/commit/acf0242))

### 💅 Refactors

- Remove the leftover library starter export ([3c1b632](https://github.com/moriloop/filenet/commit/3c1b632))

### 📖 Documentation

- Update usage documentation ([8326ceb](https://github.com/moriloop/filenet/commit/8326ceb))
- Document error handling and the test layout in AGENTS.md ([ce7d8c0](https://github.com/moriloop/filenet/commit/ce7d8c0))
- Refocus README on network testing ([28bea29](https://github.com/moriloop/filenet/commit/28bea29))

### 📦 Build

- Allow esbuild to run its build scripts ([89f115d](https://github.com/moriloop/filenet/commit/89f115d))
- Replace unbuild with tsc and publish ESM only ([1744581](https://github.com/moriloop/filenet/commit/1744581))

### 🏡 Chore

- Point the package metadata at the current repository ([e43aefd](https://github.com/moriloop/filenet/commit/e43aefd))
- Update author email ([c5711ca](https://github.com/moriloop/filenet/commit/c5711ca))
- Sanitize build and lint configs ([5a56e73](https://github.com/moriloop/filenet/commit/5a56e73))

### ✅ Tests

- Cover util, socket chunker, server and the serve command ([a8718a2](https://github.com/moriloop/filenet/commit/a8718a2))

### 🤖 CI

- Modernize workflow and run the build ([3893c3f](https://github.com/moriloop/filenet/commit/3893c3f))

### ❤️ Contributors

- Mori ([@moriloop](https://github.com/moriloop))

## v0.1.3

[compare changes](https://github.com/mohammadGh/filenet/compare/v0.1.2...v0.1.3)

### 🩹 Fixes

- **ci:** Add package-manager ([64880f1](https://github.com/mohammadGh/filenet/commit/64880f1))
- Add status for each socket and exception handling when socket is closed ([50091cd](https://github.com/mohammadGh/filenet/commit/50091cd))

### ❤️ Contributors

- Mgh <m.ghoreshi@gmail.com>

## v0.1.2

[compare changes](https://github.com/mohammadGh/filenet/compare/v0.1.1...v0.1.2)

### 🩹 Fixes

- **docs:** Update README.md ([f65b6d8](https://github.com/mohammadGh/filenet/commit/f65b6d8))
- Re-ordering package json fields ([6cdc4c4](https://github.com/mohammadGh/filenet/commit/6cdc4c4))

### 📦 Build

- Add git repo and issue management links to the project ([510499c](https://github.com/mohammadGh/filenet/commit/510499c))

### ❤️ Contributors

- Mgh <m.ghoreshi@gmail.com>

## v0.1.1

[compare changes](https://github.com/mohammadGh/filenet/compare/v0.1.0...v0.1.1)

### 📖 Documentation

- Add basic readme and usage guidelines ([f65bba7](https://github.com/mohammadGh/filenet/commit/f65bba7))

### ❤️ Contributors

- Mgh <m.ghoreshi@gmail.com>

## v0.1.0


### 🚀 Enhancements

- Init the project's structure and deps ([f904f66](https://github.com/mohammadGh/filenet/commit/f904f66))
- Add progress-bar for serving file ([92fd57e](https://github.com/mohammadGh/filenet/commit/92fd57e))
- Cli serve command added to serve a file through network ([0293d05](https://github.com/mohammadGh/filenet/commit/0293d05))

### 💅 Refactors

- Refactor server-file.ts to some classes ([c9d52da](https://github.com/mohammadGh/filenet/commit/c9d52da))

### 📦 Build

- Add source-map config to debug ([e75db82](https://github.com/mohammadGh/filenet/commit/e75db82))

### 🏡 Chore

- Basic tcp server with multiple clients ([7c89a4a](https://github.com/mohammadGh/filenet/commit/7c89a4a))

### 🤖 CI

- Basic github-action to auto build, typecheck and test ([2e8d01a](https://github.com/mohammadGh/filenet/commit/2e8d01a))

### ❤️ Contributors

- Mgh <m.ghoreshi@gmail.com>

## v1.1.1

[compare changes](https://github.com/mohammadGh/my-typescript-library-starter/compare/v1.1.0...v1.1.1)

### 🩹 Fixes

- Fix bug to ignore auto spell checking for staged deleted files ([4d339df](https://github.com/mohammadGh/my-typescript-library-starter/commit/4d339df))

### ❤️ Contributors

- Mgh <m.ghoreshi@gmail.com>

## v1.1.0

[compare changes](https://github.com/mohammadGh/my-typescript-library-starter/compare/v1.0.6...v1.1.0)

### 🚀 Enhancements

- **git:** Only allow release on main branch ([58b3bfa](https://github.com/mohammadGh/my-typescript-library-starter/commit/58b3bfa))
- Use CSpell for spell checking staged files and commit messages ([55dc2ea](https://github.com/mohammadGh/my-typescript-library-starter/commit/55dc2ea))

### 🩹 Fixes

- **github:** Fix prefix v for version for tagAnnotation and releaseName ([858fce6](https://github.com/mohammadGh/my-typescript-library-starter/commit/858fce6))

### 📖 Documentation

- **readme:** Add CSpell section and how to configure auto spell checker ([3b06b05](https://github.com/mohammadGh/my-typescript-library-starter/commit/3b06b05))
- **readme:** Fix typo ([58c676b](https://github.com/mohammadGh/my-typescript-library-starter/commit/58c676b))
- Fix typo ([1b487c5](https://github.com/mohammadGh/my-typescript-library-starter/commit/1b487c5))

### 🏡 Chore

- **dependencies:** Update dependencies ([e1e1bab](https://github.com/mohammadGh/my-typescript-library-starter/commit/e1e1bab))

### ❤️ Contributors

- Mgh <m.ghoreshi@gmail.com>

## v1.0.6

[compare changes](https://github.com/mohammadGh/my-typescript-library-starter/compare/v1.0.5...v1.0.6)

### 🚀 Enhancements

- Use release-it-beautiful-changelog plugin to generate changelog ([6a745d9](https://github.com/mohammadGh/my-typescript-library-starter/commit/6a745d9))

### 🩹 Fixes

- **build:** Changelog version title fixed ([cadf929](https://github.com/mohammadGh/my-typescript-library-starter/commit/cadf929))
- **changelog:** Cleaning up the mess from old version changes ([708a86b](https://github.com/mohammadGh/my-typescript-library-starter/commit/708a86b))

### ❤️ Contributors

- Mgh <m.ghoreshi@gmail.com>

## v1.0.5

[compare changes](https://github.com/mohammadGh/my-typescript-library-starter/compare/1.0.4...v1.0.5)

### 🚀 Enhancements

- **build:** Release-it tag name configured to prefix `v` ([c382d62](https://github.com/mohammadGh/my-typescript-library-starter/commit/c382d62))
- **build:** Add release to github ([d35ee30](https://github.com/mohammadGh/my-typescript-library-starter/commit/d35ee30))

### 🩹 Fixes

- **build:** Exclude root config files from coverage ([ed88519](https://github.com/mohammadGh/my-typescript-library-starter/commit/ed88519))

### 💅 Refactors

- **build:** Use es module export for commitlint config ([c5fe096](https://github.com/mohammadGh/my-typescript-library-starter/commit/c5fe096))

### 📖 Documentation

- **changelog:** Add title and short desc for changelog.md file ([ada7a71](https://github.com/mohammadGh/my-typescript-library-starter/commit/ada7a71))
- **readme:** Add desc for test and coverage section ([48a4e17](https://github.com/mohammadGh/my-typescript-library-starter/commit/48a4e17))

### ❤️ Contributors

- Mgh <m.ghoreshi@gmail.com>

## 1.0.4

[compare changes](https://github.com/mohammadGh/my-typescript-library-starter/compare/1.0.3...1.0.4)

### 🩹 Fixes

- **build:** Fix configuration to use changelogen tool for updating changelog.md ([2edea7d](https://github.com/mohammadGh/my-typescript-library-starter/commit/2edea7d))

### ❤️ Contributors

- Mgh <m.ghoreshi@gmail.com>

## v1.0.1


### 🏡 Chore

- **init:** Initialize project with required dependency and configuration ([0067d35](https://github.com/mohammadGh/my-typescript-library-starter/commit/0067d35))

### ❤️ Contributors

- Mgh <m.ghoreshi@gmail.com>

