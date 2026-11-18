import { useEffect, useState } from 'react'
import { AppState, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Worklet } from 'react-native-bare-kit'
import { actions } from '../src/chat/slice.js'
import { createChatStore, selectMessages } from '../src/chat/store.js'
import { createClient } from '../src/client.js'
import { storagePath } from '../src/storage.js'
import worker from 'expo-bare-kit/workers/worklet/index'

const LINGER_MS = 5000

type Message = {
  id: string
  text: string
  sender: string | null
  pending?: boolean
  failed?: boolean
  key: string | null
  seq: number | null
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets()
  const [topic, setTopic] = useState('lobby')
  const [draft, setDraft] = useState('')
  const [snapshot, setSnapshot] = useState<{ chat: ReturnType<typeof emptyChat> } | null>(null)
  const [store, setStore] = useState<ReturnType<typeof createChatStore>['store'] | null>(null)

  useEffect(() => {
    let stopped = false
    let created: ReturnType<typeof createChatStore> | null = null
    let unsubscribe = () => {}
    let ipc: { terminate?: () => unknown } | null = null

    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'background') Worklet.suspend(LINGER_MS)
      else if (next === 'active') Worklet.resume()
    })

    worker.start().then((started: { ipc: Parameters<typeof createClient>[0] & { terminate?: () => unknown } }) => {
      if (stopped) {
        if (started.ipc.terminate) started.ipc.terminate()
        return
      }
      ipc = started.ipc
      const client = createClient(started.ipc)
      created = createChatStore(client, { batchMs: 50 })
      unsubscribe = created.store.subscribe(() => {
        setSnapshot(created!.store.getState())
      })
      setStore(created.store)
      setSnapshot(created.store.getState())
      created.store.dispatch(actions.join({ topic: 'lobby', storage: storagePath(), timeout: 60000 }))
    }).catch((err: Error) => {
      if (stopped) return
      setSnapshot({
        chat: { ...emptyChat(), status: 'error', error: err.message }
      })
    })

    return () => {
      stopped = true
      if (created) created.store.dispatch(actions.stop())
      unsubscribe()
      appState.remove()
      if (ipc && ipc.terminate) ipc.terminate()
    }
  }, [])

  const chat = snapshot?.chat
  const messages = snapshot ? (selectMessages(snapshot) as Message[]) : []
  const joined = chat?.status === 'joined'

  function onJoin() {
    const next = topic.trim()
    if (!store || next.length === 0) return
    store.dispatch(actions.join({ topic: next, storage: storagePath(), timeout: 60000 }))
  }

  function onSend() {
    const text = draft.trim()
    if (!store || !joined || text.length === 0) return
    store.dispatch(
      actions.send({
        localId: 'local-' + Date.now() + '-' + Math.random().toString(16).slice(2),
        text,
        timestamp: Date.now()
      })
    )
    setDraft('')
  }

  function onEarlier() {
    if (!store || !chat) return
    const keys = Object.keys(chat.oldest)
    if (keys.length === 0) {
      store.dispatch(actions.historyRequested({ limit: 30 }))
      return
    }
    for (const key of keys) {
      const end = chat.oldest[key]
      if (end === 0) continue
      store.dispatch(actions.historyRequested({ key, start: 0, end, limit: 30 }))
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Keet Lite</Text>
        <Text style={styles.meta}>
          {chat?.status || 'starting'} · {chat?.peers.length || 0} peers
        </Text>
      </View>
      <View style={styles.topicRow}>
        <TextInput
          value={topic}
          onChangeText={setTopic}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.topicInput}
        />
        <Pressable onPress={onJoin} style={styles.join}>
          <Text style={styles.joinLabel}>Join</Text>
        </Pressable>
      </View>
      {chat?.error ? <Text style={styles.error}>{chat.error}</Text> : null}
      <View style={styles.list}>
        <FlashList
          data={messages}
          keyExtractor={(item) => item.id}
          getItemType={(item) => (item.pending ? 'pending' : item.failed ? 'failed' : 'message')}
          onStartReached={onEarlier}
          onStartReachedThreshold={0.2}
          ListHeaderComponent={
            <Pressable onPress={onEarlier} style={styles.earlier}>
              <Text style={styles.earlierLabel}>Load earlier</Text>
            </Pressable>
          }
          renderItem={({ item }) => <Bubble item={item} mine={item.sender === chat?.publicKey} />}
        />
      </View>
      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={joined ? 'Message' : 'Join a topic first'}
          placeholderTextColor="#8b949e"
          style={styles.input}
          editable={joined}
          onSubmitEditing={onSend}
        />
        <Pressable onPress={onSend} style={[styles.send, !joined && styles.sendOff]}>
          <Text style={styles.sendLabel}>Send</Text>
        </Pressable>
      </View>
    </View>
  )
}

function Bubble({ item, mine }: { item: Message; mine: boolean }) {
  return (
    <View style={[styles.bubble, mine ? styles.mine : styles.theirs, item.failed && styles.failed]}>
      <Text style={styles.body}>{item.text}</Text>
      <Text style={styles.caption}>
        {item.pending ? 'sending' : item.failed ? 'not sent' : item.sender?.slice(0, 8)}
      </Text>
    </View>
  )
}

function emptyChat() {
  return {
    status: 'idle',
    error: null as string | null,
    topic: null as string | null,
    publicKey: null as string | null,
    ids: [] as string[],
    byId: {},
    oldest: {} as Record<string, number>,
    peers: [] as string[]
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111111' },
  header: { paddingHorizontal: 16, paddingTop: 8 },
  title: { color: '#f0f6fc', fontSize: 22, fontWeight: '600' },
  meta: { color: '#8b949e', marginTop: 2 },
  topicRow: { flexDirection: 'row', gap: 8, padding: 16 },
  topicInput: {
    flex: 1,
    color: '#f0f6fc',
    borderColor: '#30363d',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  join: {
    backgroundColor: '#238636',
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 14
  },
  joinLabel: { color: '#ffffff', fontWeight: '600' },
  error: { color: '#f85149', paddingHorizontal: 16 },
  list: { flex: 1, paddingHorizontal: 12 },
  earlier: { paddingVertical: 8, alignItems: 'center' },
  earlierLabel: { color: '#58a6ff' },
  bubble: { marginVertical: 4, padding: 10, borderRadius: 12, maxWidth: '85%' },
  mine: { alignSelf: 'flex-end', backgroundColor: '#1f6feb' },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#21262d' },
  failed: { backgroundColor: '#6e2b2b' },
  body: { color: '#f0f6fc', fontSize: 16 },
  caption: { color: '#c9d1d9', fontSize: 11, marginTop: 4 },
  composer: { flexDirection: 'row', gap: 8, padding: 12 },
  input: {
    flex: 1,
    color: '#f0f6fc',
    backgroundColor: '#0d1117',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  send: { backgroundColor: '#1f6feb', borderRadius: 8, justifyContent: 'center', paddingHorizontal: 14 },
  sendOff: { opacity: 0.4 },
  sendLabel: { color: '#ffffff', fontWeight: '600' }
})
