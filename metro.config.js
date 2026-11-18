const { getDefaultConfig } = require('expo/metro-config')
const withBareKit = require('expo-bare-kit/metro')

module.exports = withBareKit(getDefaultConfig(__dirname))
