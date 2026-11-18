const { EventEmitter } = require('bare-events')
const RPC = require('bare-rpc')
const c = require('compact-encoding')
const CMD = require('./commands.js')

function createClient (stream) {
  const events = new EventEmitter()
  const commands = new RPC.CommandRouter({ valueEncoding: c.raw.utf8 })

  commands.respond(CMD.message, (req, data) => {
    events.emit('event', { type: 'message', message: JSON.parse(data) })
  })

  commands.respond(CMD.peer, (req, data) => {
    events.emit('event', { type: 'peer', peer: JSON.parse(data) })
  })

  const rpc = new RPC(stream, commands)

  return {
    events,
    rpc,
    join (topic, storage) {
      return request(rpc, CMD.join, { topic, storage: storage || null })
    },
    send (text) {
      return request(rpc, CMD.send, { text })
    },
    history (range) {
      return request(rpc, CMD.history, range || {})
    }
  }
}

async function request (rpc, command, body) {
  const req = rpc.request(command)
  req.send(JSON.stringify(body))
  const raw = await req.reply(c.raw.utf8)
  return JSON.parse(raw)
}

module.exports = { createClient }
