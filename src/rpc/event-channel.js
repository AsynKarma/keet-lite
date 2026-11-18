const { eventChannel, buffers } = require('redux-saga')

// Batches RPC push events so a burst becomes one Redux update.
function createRpcEventChannel (emitter, opts = {}) {
  const batchMs = opts.batchMs == null ? 50 : opts.batchMs

  return eventChannel((emit) => {
    let batch = []
    let timer = null

    const flush = () => {
      timer = null
      if (batch.length === 0) return
      const items = batch
      batch = []
      emit(items)
    }

    const onEvent = (event) => {
      batch.push(event)
      if (timer == null) timer = setTimeout(flush, batchMs)
    }

    emitter.on('event', onEvent)

    return () => {
      emitter.removeListener('event', onEvent)
      if (timer != null) {
        clearTimeout(timer)
        timer = null
      }
    }
  }, buffers.expanding(64))
}

module.exports = { createRpcEventChannel }
