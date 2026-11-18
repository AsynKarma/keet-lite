/* global Bare */

const os = require('os')
const path = require('path')
const RPC = require('bare-rpc')
const c = require('compact-encoding')
const KeetLite = require('keet-lite-core')
const CMD = require('../src/commands.js')

function serve (ipc, opts = {}) {
  let chat = null
  let topic = null
  let session = null

  const commands = new RPC.CommandRouter({ valueEncoding: c.raw.utf8 })

  commands.respond(CMD.join, async (req, data) => {
    const body = JSON.parse(data)
    topic = body.topic
    if (!chat) chat = openChat(opts, body.storage, () => session)
    const info = await chat.join(topic)
    return JSON.stringify({
      publicKey: hex(info.publicKey),
      topic: hex(info.topic)
    })
  })

  commands.respond(CMD.send, async (req, data) => {
    const body = JSON.parse(data)
    if (!chat) throw new Error('Join a topic before sending')
    await chat.send(body.text)
    return JSON.stringify({ ok: true })
  })

  commands.respond(CMD.history, async (req, data) => {
    const body = JSON.parse(data)
    if (!chat) return JSON.stringify([])
    const messages = await chat.history(body)
    return JSON.stringify(messages.map(toJson))
  })

  session = new RPC(ipc, commands)

  if (typeof Bare !== 'undefined' && Bare.on) {
    Bare.on('suspend', () => {
      if (chat) chat.stop().catch(noop)
    })
    Bare.on('resume', () => {
      if (chat && topic) chat.join(topic).catch(noop)
    })
  }

  return session
}

function openChat (opts, storage, getSession) {
  const chat = opts.create
    ? opts.create(storage)
    : new KeetLite(storage || path.join(os.tmpdir(), 'keet-lite'))

  chat.onMessage((message) => {
    getSession().event(CMD.message).send(JSON.stringify(toJson(message)))
  })

  chat.onPeer((peer) => {
    getSession().event(CMD.peer).send(JSON.stringify({
      remotePublicKey: hex(peer.remotePublicKey)
    }))
  })

  return chat
}

function toJson (message) {
  return {
    sender: hex(message.sender),
    timestamp: message.timestamp,
    text: message.text,
    seq: message.seq,
    key: hex(message.key)
  }
}

function hex (value) {
  if (typeof value === 'string') return value
  const b4a = require('b4a')
  return b4a.toString(value, 'hex')
}

function noop () {}

// bare-stow calls start(ipc, ready). Tests call start(stream, opts).
function start (ipc, readyOrOpts) {
  const opts = readyOrOpts && typeof readyOrOpts === 'object' ? readyOrOpts : undefined
  const ready = typeof readyOrOpts === 'function' ? readyOrOpts : null
  const session = serve(ipc, opts)
  if (ready) ready()
  return function stop () {
    if (session && session.destroy) session.destroy()
  }
}

module.exports = start
