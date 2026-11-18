const { actions } = require('./slice.js')
const reducer = require('./slice.js')

test('optimistic send is replaced by the echoed record', () => {
  let state = reducer(undefined, { type: '@@init' })
  state = reducer(state, actions.joined({ publicKey: 'aa', topic: 'topic' }))
  state = reducer(state, actions.send({
    localId: 'local-1',
    text: 'hello',
    timestamp: 10
  }))

  expect(state.ids).toEqual(['local-1'])
  expect(state.byId['local-1'].pending).toBe(true)

  state = reducer(state, actions.eventsReceived([{
    type: 'message',
    message: { key: 'aa', seq: 0, sender: 'aa', timestamp: 10, text: 'hello' }
  }]))

  expect(state.ids).toEqual(['aa:0'])
  expect(state.byId['aa:0'].pending).toBe(false)
  expect(state.byId['local-1']).toBeUndefined()
})

test('history range keeps the oldest sequence per core', () => {
  let state = reducer(undefined, { type: '@@init' })
  state = reducer(state, actions.historyReceived([
    { key: 'aa', seq: 4, sender: 'aa', timestamp: 4, text: 'newer' },
    { key: 'aa', seq: 2, sender: 'aa', timestamp: 2, text: 'older' }
  ]))

  expect(state.oldest.aa).toBe(2)
  expect(state.ids.map((id) => state.byId[id].text)).toEqual(['older', 'newer'])
})

test('peer events are stored once', () => {
  let state = reducer(undefined, { type: '@@init' })
  const event = { type: 'peer', peer: { remotePublicKey: 'bb' } }
  state = reducer(state, actions.eventsReceived([event, event]))
  expect(state.peers).toEqual(['bb'])
})
