const { EventEmitter } = require('bare-events')
const { createRpcEventChannel } = require('./event-channel.js')

test('a burst is one batch', async () => {
  const emitter = new EventEmitter()
  const channel = createRpcEventChannel(emitter, { batchMs: 20 })
  const received = []

  channel.take((batch) => received.push(batch))
  emitter.emit('event', { type: 'message', message: { text: 'a' } })
  emitter.emit('event', { type: 'message', message: { text: 'b' } })

  await new Promise((resolve) => setTimeout(resolve, 40))

  expect(received).toEqual([[
    { type: 'message', message: { text: 'a' } },
    { type: 'message', message: { text: 'b' } }
  ]])
  channel.close()
})
