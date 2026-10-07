const path = require('path')
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')

const workspaceRoot = path.resolve(__dirname, '../..')

/**
 * Metro needs to be told about the monorepo: @pitchup/shared is a symlink
 * outside the app directory, and pnpm stores real packages in .pnpm at the
 * workspace root rather than hoisting them into apps/mobile/node_modules.
 */
module.exports = mergeConfig(getDefaultConfig(__dirname), {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
    unstable_enableSymlinks: true,
  },
})
