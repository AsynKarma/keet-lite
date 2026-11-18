const { withDangerousMod, withGradleProperties } = require('expo/config-plugins')
const fs = require('fs')
const path = require('path')

// Records that this app links Bare addons ahead of time and keeps the New Architecture on.
// bare-link writes the addon binaries to bare-addons/ during postinstall. Prebuild copies
// whatever is there into the native projects.
function withKeetLite (config) {
  config = withGradleProperties(config, (config) => {
    setProp(config.modResults, 'newArchEnabled', 'true')
    setProp(config.modResults, 'hermesEnabled', 'true')
    return config
  })

  config = withDangerousMod(config, [
    'android',
    (config) => {
      copyAddons(config.modRequest.projectRoot, 'android', path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'jniLibs'))
      return config
    }
  ])

  config = withDangerousMod(config, [
    'ios',
    (config) => {
      copyAddons(config.modRequest.projectRoot, 'ios', path.join(config.modRequest.platformProjectRoot, 'BareAddons'))
      return config
    }
  ])

  return config
}

function setProp (items, key, value) {
  const found = items.find((item) => item.type === 'property' && item.key === key)
  if (found) found.value = value
  else items.push({ type: 'property', key, value })
}

function copyAddons (root, platform, dest) {
  const from = path.join(root, 'bare-addons', platform)
  if (!fs.existsSync(from)) return
  fs.mkdirSync(dest, { recursive: true })
  fs.cpSync(from, dest, { recursive: true })
}

module.exports = withKeetLite
