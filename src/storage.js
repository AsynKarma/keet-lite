function storagePath () {
  try {
    const FileSystem = require('expo-file-system')
    const uri =
      FileSystem.documentDirectory ||
      (FileSystem.Paths && FileSystem.Paths.document && FileSystem.Paths.document.uri)
    if (!uri || typeof uri !== 'string') return null
    return uri.replace(/^file:\/\//, '').replace(/\/$/, '') + '/keet-lite'
  } catch (err) {
    return String(err) && null
  }
}

module.exports = { storagePath }
