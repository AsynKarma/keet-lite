const { configureStore } = require('@reduxjs/toolkit')
const createSagaMiddleware = require('redux-saga').default
const reducer = require('./slice.js')
const { rootSaga } = require('./sagas.js')

function createChatStore (client, opts = {}) {
  const sagaMiddleware = createSagaMiddleware()
  const store = configureStore({
    reducer: { chat: reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({ thunk: false }).concat(sagaMiddleware)
  })
  const task = sagaMiddleware.run(rootSaga, client, opts)
  return { store, task }
}

function selectMessages (state) {
  return state.chat.ids.map((id) => state.chat.byId[id])
}

module.exports = { createChatStore, selectMessages }
