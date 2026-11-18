const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const entry = path.join(root, 'worklet', 'index.js')
const link = path.join(root, 'node_modules', 'bare-link', 'bin.js')

if (!fs.existsSync(entry) || !fs.existsSync(link)) {
  process.stderr.write('bare-link skipped: entry or bare-link is not installed yet\n')
  process.exit(0)
}

const targets = [
  {
    dir: path.join(root, 'bare-addons', 'ios'),
    hosts: ['ios-arm64', 'ios-arm64-simulator', 'ios-x64-simulator']
  },
  {
    dir: path.join(root, 'bare-addons', 'android'),
    hosts: ['android-arm64', 'android-x64']
  }
]

let failed = false

for (const target of targets) {
  fs.mkdirSync(target.dir, { recursive: true })
  const args = [link, '--out', target.dir]
  for (const host of target.hosts) args.push('--host', host)
  args.push(entry)

  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' })
  if (result.status !== 0) {
    process.stderr.write('bare-link failed for ' + target.dir + '\n')
    failed = true
  }
}

if (failed) process.exit(1)
