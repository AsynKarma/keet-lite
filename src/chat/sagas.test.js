const { EventEmitter } = require('bare-events')
const { actions } = require('./slice.js')
const { createChatStore, selectMessages } = require('./store.js')

test('join uses race and a timeout', async () => {
  const client = fakeClient({
    join: () => new Promise(() => {})
  })
  const { store } = createChatStore(client, { batchMs: 1 })

  store.dispatch(actions.join({ topic: 'lobby', timeout: 20 }))
  await delay(50)

  expect(store.getState().chat.status).toBe('error')
  expect(store.getState().chat.error).toBe('join timed out')
  store.dispatch(actions.stop())
})

test('takeLatest keeps the latest join', async () => {
  let firstStarted = false
  const client = fakeClient({
    join: (topic) => {
      if (topic === 'first') {
        firstStarted = true
        return new Promise(() => {})
      }
      return Promise.resolve({ publicKey: 'aa', topic: 'second-hex' })
    },
    history: async () => []
  })
  const { store } = createChatStore(client, { batchMs: 1 })

  store.dispatch(actions.join({ topic: 'first', timeout: 5000 }))
  store.dispatch(actions.join({ topic: 'second', timeout: 5000 }))
  await delay(30)

  expect(firstStarted).toBe(true)
  expect(store.getState().chat.status).toBe('joined')
  expect(store.getState().chat.publicKey).toBe('aa')
  store.dispatch(actions.stop())
})

test('forked event channel batches, and cancel stops it', async () => {
  const client = fakeClient()
  const { store } = createChatStore(client, { batchMs: 20 })

  client.events.emit('event', { type: 'peer', peer: { remotePublicKey: 'p1' } })
  client.events.emit('event', { type: 'peer', peer: { remotePublicKey: 'p2' } })
  await delay(50)

  expect(store.getState().chat.peers).toEqual(['p1', 'p2'])

  store.dispatch(actions.stop())
  await delay(10)
  client.events.emit('event', { type: 'peer', peer: { remotePublicKey: 'p3' } })
  await delay(40)

  expect(store.getState().chat.peers).toEqual(['p1', 'p2'])
})

test('send is optimistic and times out through race', async () => {
  const client = fakeClient({
    join: async () => ({ publicKey: 'aa', topic: 'topic' }),
    history: async () => [],
    send: () => new Promise(() => {})
  })
  const { store } = createChatStore(client, { batchMs: 1 })

  store.dispatch(actions.join({ topic: 'lobby', timeout: 500 }))
  await delay(20)
  store.dispatch(actions.send({ localId: 'local-1', text: 'hello', timestamp: 10, timeout: 20 }))

  expect(selectMessages(store.getState())[0].pending).toBe(true)
  await delay(50)
  expect(selectMessages(store.getState())[0].failed).toBe(true)
  store.dispatch(actions.stop())
})

function fakeClient (overrides = {}) {
  return {
    events: new EventEmitter(),
    async join () {
      return { publicKey: 'aa', topic: 'topic' }
    },
    async send () {
      return { ok: true }
    },
    async history () {
      return []
    },
    ...overrides
  }
}

function delay (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
