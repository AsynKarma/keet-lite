const { Duplex, PassThrough } = require('stream')
const b4a = require('b4a')
const serve = require('../worklet/index.js')
const { createClient } = require('./client.js')

test('join, send, history, and events cross bare-rpc', async () => {
  const [local, remote] = pair()
  const sent = []
  const chat = {
    async join () {
      return { publicKey: b4a.alloc(32, 1), topic: b4a.alloc(32, 2) }
    },
    async send (text) {
      sent.push(text)
    },
    async history () {
      return [{
        sender: b4a.alloc(32, 1),
        timestamp: 5,
        text: 'stored',
        seq: 0,
        key: b4a.alloc(32, 1)
      }]
    },
    onMessage (fn) {
      chat.emitMessage = fn
      return () => {}
    },
    onPeer () {
      return () => {}
    }
  }

  serve(local, { create: () => chat })
  const client = createClient(remote)

  const joined = await client.join('lobby', '/tmp/keet-lite')
  expect(joined.publicKey).toBe('01'.repeat(32))

  await client.send('hello')
  expect(sent).toEqual(['hello'])

  const history = await client.history({ limit: 30 })
  expect(history[0].text).toBe('stored')
  expect(history[0].seq).toBe(0)

  const pending = new Promise((resolve) => client.events.once('event', resolve))
  chat.emitMessage({
    sender: b4a.alloc(32, 1),
    timestamp: 6,
    text: 'live',
    seq: 1,
    key: b4a.alloc(32, 1)
  })
  const event = await pending
  expect(event.type).toBe('message')
  expect(event.message.text).toBe('live')

  local.destroy()
  remote.destroy()
})

function pair () {
  const forward = new PassThrough()
  const backward = new PassThrough()
  return [
    Duplex.from({ writable: forward, readable: backward }),
    Duplex.from({ writable: backward, readable: forward })
  ]
}
