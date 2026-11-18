const fs = require('fs')
const path = require('path')
const { withDangerousMod, withGradleProperties } = require('expo/config-plugins')

// Keeps the New Architecture and Hermes on. expo-bare-kit links Bare Kit and
// the worklet addons; this plugin does not copy a second set of libraries.
//
// expo-bare-kit pulls bare-kit-kotlin, whose classes were compiled with Kotlin
// 2.4. This SDK's KSP has no 2.4 entry, and the worklet does not call those
// classes: react-native-bare-kit dlopens libbare-kit.so. Keep the project's
// Kotlin on the release KSP knows, and take the AAR for that library only.
function withKeetLite (config) {
  config = withGradleProperties(config, (config) => {
    setProp(config.modResults, 'newArchEnabled', 'true')
    setProp(config.modResults, 'hermesEnabled', 'true')
    setProp(config.modResults, 'android.kotlinVersion', '2.1.20')
    return config
  })

  return withDangerousMod(config, [
    'android',
    (config) => {
      const root = config.modRequest.platformProjectRoot
      patchAddonGradle(path.join(root, 'bare-kit-addons', 'build.gradle'))
      dropEmptyLibraries(path.join(root, 'bare-kit-addons', 'src', 'main', 'addons'))
      return config
    }
  ])
}

function patchAddonGradle (file) {
  if (!fs.existsSync(file)) return

  const source = fs.readFileSync(file, 'utf8')
  const dependency = [
    'implementation("com.github.holepunchto.bare-kit-kotlin:bare-kit-kotlin:v0.2.6") {',
    '    exclude group: "org.jetbrains.kotlin"',
    '  }'
  ].join('\n')

  const next = source.replace(
    /api\s+["']com\.github\.holepunchto\.bare-kit-kotlin:bare-kit-kotlin:v0\.2\.\+["']/,
    dependency
  )

  if (next !== source) fs.writeFileSync(file, next)
}

function dropEmptyLibraries (dir) {
  if (!fs.existsSync(dir)) return

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) dropEmptyLibraries(file)
    else if (entry.isFile() && entry.name.endsWith('.so') && fs.statSync(file).size === 0) {
      fs.unlinkSync(file)
    }
  }
}

function setProp (items, key, value) {
  const found = items.find((item) => item.type === 'property' && item.key === key)
  if (found) found.value = value
  else items.push({ type: 'property', key, value })
}

module.exports = withKeetLite
