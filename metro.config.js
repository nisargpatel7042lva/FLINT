const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Keep Metro's file watcher out of native build output.
 *
 * On Windows there is no watchman, so Metro falls back to a recursive fs.watch
 * crawl. CMake creates and deletes short-lived probe directories under
 * `android/.cxx/**` while Gradle runs; if the watcher is crawling one as it
 * disappears, Metro dies with an unhandled ENOENT. Nothing in these directories
 * is ever part of the JS bundle, so excluding them is free.
 *
 * Written as one literal RegExp rather than via
 * `metro-config/src/defaults/exclusionList` — that subpath is not listed in
 * metro-config's `exports` map, so requiring it throws ERR_PACKAGE_PATH_NOT_EXPORTED.
 *
 * `[\\/]` matches either path separator so this works on Windows and POSIX.
 */
const blockList =
  /[\\/](?:android[\\/](?:\.cxx|build)|android[\\/]app[\\/]build|ios[\\/](?:build|Pods))[\\/].*/;

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    blockList,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
