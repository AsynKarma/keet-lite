const { spawnSync } = require('child_process')
const path = require('path')

const root = path.join(__dirname, '..')
const pack = path.join(root, 'node_modules', 'bare-pack', 'bin.js')
const entry = path.join(root, 'worklet', 'index.js')
const out = path.join(root, 'worklet', 'packed.js')

const hosts = [
  'ios-arm64',
  'ios-arm64-simulator',
  'ios-x64-simulator',
  'android-arm64',
  'android-x64'
]

const args = [pack, '--linked', '--format', 'bundle.cjs', '--out', out]
for (const host of hosts) args.push('--host', host)
args.push(entry)

const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' })
process.exit(result.status == null ? 1 : result.status)
