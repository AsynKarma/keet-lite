# keet-lite

An Expo app that runs [keet-lite-core](https://github.com/AsynKarma/keet-lite-core) inside a Bare worklet. One screen joins a Hyperswarm topic, appends chat records to the local Hypercore, and lists messages replicated from other peers.

The native shell started from [holepunchto/bare-expo](https://github.com/holepunchto/bare-expo). This repo uses Expo SDK 55, React Native 0.83, the New Architecture (`newArchEnabled` in `app.json`), and Hermes. `expo export` writes Hermes bytecode (`.hbc`).

## Threads

```
UI thread
  Fabric renders the FlashList and the composer
        |
        | props and events
        v
React Native JS thread
  Redux Toolkit store
  Redux-Saga: takeLatest(join), takeEvery(send), takeEvery(history)
  eventChannel batches bare-rpc events, fork/cancel on stop, race for timeouts
        |
        | bare-rpc over the worklet IPC stream
        v
Bare worklet
  its own thread and heap
  keet-lite-core: Corestore, one Hypercore, Hyperswarm
        |
        | Hyperswarm topic
        v
Peers
```

Reanimated worklets are not Bare worklets. A Reanimated worklet is a function that runs on the UI thread for animation. A Bare worklet is a separate Bare runtime started by `react-native-bare-kit`.

## Suspend

`AppState` `background` calls `worklet.suspend(5000)`. `active` calls `worklet.resume()`.

`suspend(5000)` keeps the worklet alive for up to 5 seconds before it goes idle. `react-native-bare-kit` 0.15 also listens for `AppState` and calls `suspend()` with no argument, which passes `-1` and asks the runtime for its default linger. The screen listener is registered after that and calls `suspend(5000)` as well.

While the worklet is still running, Bare emits `suspend`. The worklet calls `chat.stop()`, which leaves the topic and suspends Hyperswarm. That drops the swarm connections. They do not stay open across the idle gap. On `resume`, Bare emits `resume`, and the worklet calls `join()` again. That resumes Hyperswarm and announces the same topic. Blocks appended while this process was stopped replicate after the peers reconnect.

The worklet was not profiled, so this README has no heap or memory-limit number. `new Worklet()` is called with the library default options.

## List

The transcript is a FlashList. Each row key is `local-<id>` while a send is optimistic, then `<core key hex>:<seq>` once the core echoes the block. `getItemType` returns `pending`, `failed`, or `message`.

On join, the saga requests `history({ limit: 30 })`, which reads the last 30 blocks of each known core. Scrolling to the start, or pressing Load earlier, requests `history({ key, start: 0, end: oldestSeq, limit: 30 })` for each core whose oldest loaded sequence is still above 0. Older rows are merged into the same list and sorted by timestamp.

A send is appended to the list immediately with `pending: true`. The matching echoed record replaces that row.

## Run

```sh
npm install
npm test
npm run bundle:worklet
npm run ios
npm run android
```

`postinstall` runs `bare-link` and writes the iOS and Android addon binaries to `bare-addons/`. The config plugin `plugins/with-keet-lite.js` copies those into the native projects during `expo prebuild`, and `expo-build-properties` turns on the New Architecture. Hermes is the engine this SDK uses; `expo export` produced a `.hbc` bundle for Android (6.7 MB) and for iOS (6.6 MB). Those are file sizes of the exported bundles, not memory measurements.

`npm run bundle:worklet` packs `worklet/index.js` with `bare-pack --linked` into `worklet/packed.js`. The screen starts that string in a `Worklet`. `keet-lite-core` is a git dependency, not a published npm release.

Two installs on the same topic name exchange records. The topic field defaults to `lobby`. Use a different Corestore directory per install; the app passes the Expo document directory when that API is available, and the worklet otherwise uses its temp directory.

## Tests

`npm test` runs Jest for the reducers, the sagas (`race`, `takeLatest`, `takeEvery`, `fork` / `cancel`, and the batched `eventChannel`), and a `bare-rpc` loopback of join, send, history, and a pushed message. The event channel adapter stays in this repo.

## Limits

One core per user on one shared topic. There is no multi-writer log, no push notification, no biometric unlock, and no crash reporter. A demo animation was not recorded.

## License

Apache-2.0. The Expo embedding started from holepunchto/bare-expo.
