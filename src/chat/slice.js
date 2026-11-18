const { createAction, createSlice } = require('@reduxjs/toolkit')

const chat = createSlice({
  name: 'chat',
  initialState: {
    status: 'idle',
    error: null,
    topic: null,
    publicKey: null,
    ids: [],
    byId: {},
    oldest: {},
    peers: []
  },
  reducers: {
    join (state, action) {
      state.status = 'joining'
      state.error = null
      state.topic = action.payload.topic
    },
    joined (state, action) {
      state.status = 'joined'
      state.error = null
      state.publicKey = action.payload.publicKey
      state.topic = action.payload.topic
    },
    joinFailed (state, action) {
      state.status = 'error'
      state.error = action.payload
    },
    send (state, action) {
      const id = action.payload.localId
      state.byId[id] = {
        id,
        text: action.payload.text,
        sender: state.publicKey,
        timestamp: action.payload.timestamp,
        seq: null,
        key: state.publicKey,
        pending: true
      }
      state.ids.push(id)
      sortIds(state)
    },
    sendFailed (state, action) {
      const item = state.byId[action.payload.localId]
      if (!item) return
      item.pending = false
      item.failed = true
    },
    historyReceived (state, action) {
      for (const message of action.payload) insertMessage(state, message)
      sortIds(state)
    },
    eventsReceived (state, action) {
      for (const event of action.payload) {
        if (event.type === 'message') insertMessage(state, event.message)
        if (event.type === 'peer') insertPeer(state, event.peer)
      }
      sortIds(state)
    }
  }
})

const historyRequested = createAction('chat/historyRequested')
const stop = createAction('chat/stop')

function insertMessage (state, message) {
  const id = message.key + ':' + message.seq
  const pendingId = state.ids.find((itemId) => {
    const item = state.byId[itemId]
    return item.pending && item.sender === message.sender && item.text === message.text
  })

  if (pendingId) {
    delete state.byId[pendingId]
    state.ids.splice(state.ids.indexOf(pendingId), 1)
  }

  state.byId[id] = {
    id,
    text: message.text,
    sender: message.sender,
    timestamp: message.timestamp,
    seq: message.seq,
    key: message.key,
    pending: false
  }

  if (!state.ids.includes(id)) state.ids.push(id)

  const oldest = state.oldest[message.key]
  if (oldest == null || message.seq < oldest) state.oldest[message.key] = message.seq
}

function insertPeer (state, peer) {
  if (!peer || !peer.remotePublicKey) return
  if (state.peers.includes(peer.remotePublicKey)) return
  state.peers.push(peer.remotePublicKey)
}

function sortIds (state) {
  state.ids.sort((a, b) => {
    const left = state.byId[a]
    const right = state.byId[b]
    const byTime = left.timestamp - right.timestamp
    if (byTime !== 0) return byTime
    return sequence(left) - sequence(right)
  })
}

function sequence (message) {
  return message.seq == null ? Number.MAX_SAFE_INTEGER : message.seq
}

module.exports = chat.reducer
module.exports.actions = {
  ...chat.actions,
  historyRequested,
  stop
}
