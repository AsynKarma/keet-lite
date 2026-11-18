const { call, cancel, delay, fork, put, race, take, takeEvery, takeLatest } = require('redux-saga/effects')
const { actions } = require('./slice.js')
const { createRpcEventChannel } = require('../rpc/event-channel.js')

function * joinSaga (client, action) {
  const timeoutMs = action.payload.timeout == null ? 10000 : action.payload.timeout
  const { response, timeout } = yield race({
    response: call([client, client.join], action.payload.topic, action.payload.storage),
    timeout: delay(timeoutMs)
  })

  if (timeout || !response) {
    yield put(actions.joinFailed('join timed out'))
    return
  }

  yield put(actions.joined(response))
  yield put(actions.historyRequested({ limit: 30 }))
}

function * sendSaga (client, action) {
  const timeoutMs = action.payload.timeout == null ? 10000 : action.payload.timeout
  const { response, timeout } = yield race({
    response: call([client, client.send], action.payload.text),
    timeout: delay(timeoutMs)
  })

  if (timeout || !response) {
    yield put(actions.sendFailed({ localId: action.payload.localId, error: 'send timed out' }))
  }
}

function * historySaga (client, action) {
  const timeoutMs = action.payload.timeout == null ? 10000 : action.payload.timeout
  const { response, timeout } = yield race({
    response: call([client, client.history], action.payload),
    timeout: delay(timeoutMs)
  })

  if (timeout || !response) return
  yield put(actions.historyReceived(response))
}

function * eventsSaga (client, batchMs) {
  const channel = yield call(createRpcEventChannel, client.events, { batchMs })
  try {
    while (true) {
      const batch = yield take(channel)
      yield put(actions.eventsReceived(batch))
    }
  } finally {
    channel.close()
  }
}

function * rootSaga (client, opts = {}) {
  yield takeLatest(actions.join.type, joinSaga, client)
  yield takeEvery(actions.send.type, sendSaga, client)
  yield takeEvery(actions.historyRequested.type, historySaga, client)

  const events = yield fork(eventsSaga, client, opts.batchMs)
  yield take(actions.stop.type)
  yield cancel(events)
}

module.exports = {
  rootSaga,
  joinSaga,
  sendSaga,
  historySaga,
  eventsSaga
}
