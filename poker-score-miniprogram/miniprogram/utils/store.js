const config = require('../config')
const roomUtil = require('./room')

const KEYS = {
  rooms: 'poker:rooms',
  recent: 'poker:recent',
  profile: 'poker:profile',
  deviceId: 'poker:deviceId',
  openId: 'poker:openId',
  settlements: 'poker:settlements'
}

function readStorage(key, fallback) {
  try {
    const v = wx.getStorageSync(key)
    return v === '' || v == null ? fallback : v
  } catch (e) {
    return fallback
  }
}

function writeStorage(key, value) {
  try { wx.setStorageSync(key, value) } catch (e) { /* 存储异常忽略 */ }
}

// ---------- 通用（本地身份/资料/最近房间） ----------
function getDeviceId() {
  let id = readStorage(KEYS.deviceId, '')
  if (!id) {
    id = 'l_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
    writeStorage(KEYS.deviceId, id)
  }
  return id
}

function getMyOpenId() { return readStorage(KEYS.openId, '') }
function setMyOpenId(id) { if (id) writeStorage(KEYS.openId, id) }

// ---------- 历史战绩（本机累计，按本机结束过的局数统计） ----------
function saveLocalSettlement(room) {
  if (!room || !room.code) return
  const list = readStorage(KEYS.settlements, [])
  list.push({
    roomId: room.code,
    roomName: room.name || '',
    players: (room.players || []).map(p => ({
      id: p.id,
      openid: p.openid || p.id,
      nickname: p.nickname || '玩家',
      avatar: p.avatar || p.avatarFileID || ''
    })),
    finalScores: room.scores || {},
    finishedAt: Date.now()
  })
  writeStorage(KEYS.settlements, list.slice(-200))
}

function getPlayerStats() {
  const list = readStorage(KEYS.settlements, [])
  const map = {}
  list.forEach(s => {
    const players = s.players || []
    const scores = s.finalScores || {}
    const ranked = players.slice().sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0))
    const winId = ranked.length > 1 ? ranked[0].id : ''
    players.forEach(p => {
      const st = map[p.id] || (map[p.id] = { id: p.id, nickname: p.nickname, games: 0, wins: 0, losses: 0, total: 0, rate: 0 })
      st.nickname = p.nickname
      st.games += 1
      if (winId) {
        if (p.id === winId) st.wins += 1
        else st.losses += 1
      }
      st.total += scores[p.id] || 0
    })
  })
  return Object.keys(map).map(k => {
    const s = map[k]
    s.rate = s.games ? Math.round((s.wins / s.games) * 100) : 0
    return s
  }).sort((a, b) => b.total - a.total)
}

function getSettlements() { return readStorage(KEYS.settlements, []) }

function getMyId() {
  return config.USE_CLOUD ? getMyOpenId() : getDeviceId()
}

function getProfile() { return readStorage(KEYS.profile, null) }
function saveProfile(p) { writeStorage(KEYS.profile, p || null) }

function getRecentRooms() { return readStorage(KEYS.recent, []) }

function saveRecentRoom(room) {
  if (!room || !room.code) return
  const list = getRecentRooms()
  const idx = list.findIndex(r => r.code === room.code)
  const entry = { code: room.code, name: room.name, status: room.status, updatedAt: room.updatedAt || Date.now() }
  if (idx >= 0) list.splice(idx, 1)
  list.unshift(entry)
  writeStorage(KEYS.recent, list.slice(0, 10))
}

// 云开发模式下把微信头像临时路径上传为云存储 fileID，供多端展示
async function ensureAvatar(avatar) {
  if (!config.USE_CLOUD || !avatar) return avatar
  if (avatar.indexOf('cloud://') === 0) return avatar
  try {
    const res = await wx.cloud.uploadFile({
      cloudPath: `avatars/${Date.now()}_${Math.floor(Math.random() * 1e6)}.png`,
      filePath: avatar
    })
    return res.fileID
  } catch (e) {
    return avatar
  }
}

// ================= 本地实现（USE_CLOUD=false，测试号可用） =================
const local = {
  listeners: {},

  notify(code, room) {
    const set = this.listeners[code]
    if (!set) return
    set.forEach(cb => {
      try { cb(roomUtil.normalizeRoom(room)) } catch (e) { /* ignore */ }
    })
  },

  getRoomsMap() { return readStorage(KEYS.rooms, {}) },
  saveRoomsMap(map) { writeStorage(KEYS.rooms, map) },

  exists(code) { return !!this.getRoomsMap()[code] },

  uniqueCode() {
    let code = roomUtil.genRoomCode()
    let guard = 0
    while (this.exists(code) && guard++ < 50) code = roomUtil.genRoomCode()
    return code
  },

  async createRoom({ name, maxPlayers, profile, players, rate } = {}) {
    const deviceId = getDeviceId()
    const code = this.uniqueCode()
    const nickname = (profile && profile.nickname) || '房主'
    const avatar = (profile && profile.avatar) || ''
    const max = roomUtil.clamp(maxPlayers, config.MAX_PLAYERS_MIN, config.MAX_PLAYERS_MAX, config.DEFAULT_MAX_PLAYERS)
    const seed = Array.isArray(players) ? players.slice(0, max) : []
    const playerList = seed.length
      ? seed.map(p => ({
          id: p.id,
          openid: p.openid || p.id,
          nickname: p.nickname || '玩家',
          avatar: roomUtil.playerAvatar(p),
          joinedAt: p.joinedAt || Date.now(),
          seat: Number.isInteger(p.seat) ? p.seat : -1
        }))
      : [{ id: deviceId, openid: deviceId, nickname, avatar, joinedAt: Date.now(), seat: -1 }]
    if (!playerList.some(p => p.id === deviceId)) {
      playerList.unshift({ id: deviceId, openid: deviceId, nickname, avatar, joinedAt: Date.now(), seat: -1 })
    }
    roomUtil.assignSeats(playerList, max, deviceId)
    const scores = {}
    playerList.forEach(p => { scores[p.id] = 0 })
    const now = Date.now()
    const room = roomUtil.normalizeRoom({
      _id: code,
      name: (name || '').trim() || `牌局 ${code}`,
      hostOpenId: deviceId,
      status: 'playing',
      maxPlayers: max,
      rate: rate || config.DEFAULT_RATE,
      players: playerList,
      scores,
      history: [],
      createdAt: now,
      updatedAt: now
    })
    const map = this.getRoomsMap()
    map[code] = room
    this.saveRoomsMap(map)
    saveRecentRoom(room)
    this.notify(code, room)
    return { room, playerId: deviceId }
  },

  // 仅本地模式：一键建房 + 3 个模拟玩家，方便单机演示
  async createDemoRoom() {
    const deviceId = getDeviceId()
    const profile = getProfile()
    const now = Date.now()
    const players = [
      { id: deviceId, openid: deviceId, nickname: (profile && profile.nickname) || '房主', avatar: (profile && profile.avatar) || '', joinedAt: now },
      { id: 'b_2', openid: 'b_2', nickname: '玩家B', avatar: '', joinedAt: now + 1 },
      { id: 'b_3', openid: 'b_3', nickname: '玩家C', avatar: '', joinedAt: now + 2 },
      { id: 'b_4', openid: 'b_4', nickname: '玩家D', avatar: '', joinedAt: now + 3 }
    ]
    return this.createRoom({ name: '演示牌局', maxPlayers: 4, profile, players })
  },

  async joinRoom({ roomCode, profile } = {}) {
    const code = String(roomCode || '').trim().toUpperCase()
    const map = this.getRoomsMap()
    const room = map[code]
    if (!room) throw new Error('房间不存在')
    if (room.status !== 'playing') throw new Error('房间已结束')
    const deviceId = getDeviceId()
    const nickname = (profile && profile.nickname) || '玩家'
    const avatar = (profile && profile.avatar) || ''
    const existing = room.players.find(p => p.id === deviceId || p.openid === deviceId)
    if (existing) {
      existing.nickname = nickname
      existing.avatar = avatar
    } else {
      if (room.players.length >= room.maxPlayers) throw new Error('房间已满员')
      const seat = roomUtil.lowestFreeSeat(room.players, room.maxPlayers)
      room.players.push({ id: deviceId, openid: deviceId, nickname, avatar, joinedAt: Date.now(), seat })
      room.scores[deviceId] = 0
    }
    room.updatedAt = Date.now()
    map[code] = room
    this.saveRoomsMap(map)
    saveRecentRoom(room)
    this.notify(code, room)
    return { room: roomUtil.normalizeRoom(room), playerId: deviceId }
  },

  async getRoom(roomCode) {
    const code = String(roomCode || '').trim().toUpperCase()
    const room = this.getRoomsMap()[code]
    return room ? roomUtil.normalizeRoom(room) : null
  },

  async updateScore({ roomCode, playerId, delta } = {}) {
    const code = String(roomCode || '').trim().toUpperCase()
    const map = this.getRoomsMap()
    const room = map[code]
    if (!room) throw new Error('房间不存在')
    if (room.status !== 'playing') throw new Error('房间已结束')
    const d = Math.round(Number(delta) || 0)
    if (d <= 0) throw new Error('仅支持加分')
    if (d > config.CUSTOM_SCORE_LIMIT) throw new Error('分值过大')
    if (!room.players.some(p => p.id === playerId)) throw new Error('玩家不存在')
    room.scores[playerId] = (room.scores[playerId] || 0) + d
    room.history.push({ playerId, delta: d, byOpenId: getDeviceId(), ts: Date.now() })
    if (room.history.length > config.MAX_HISTORY) room.history = room.history.slice(-config.MAX_HISTORY)
    room.updatedAt = Date.now()
    map[code] = room
    this.saveRoomsMap(map)
    saveRecentRoom(room)
    this.notify(code, room)
    return roomUtil.normalizeRoom(room)
  },

  async undoScore({ roomCode } = {}) {
    const code = String(roomCode || '').trim().toUpperCase()
    const map = this.getRoomsMap()
    const room = map[code]
    if (!room) throw new Error('房间不存在')
    if (room.status !== 'playing') throw new Error('房间已结束')
    if (!room.history.length) throw new Error('暂无撤销记录')
    const last = room.history[room.history.length - 1]
    room.scores[last.playerId] = (room.scores[last.playerId] || 0) - last.delta
    room.history.pop()
    room.updatedAt = Date.now()
    map[code] = room
    this.saveRoomsMap(map)
    saveRecentRoom(room)
    this.notify(code, room)
    return roomUtil.normalizeRoom(room)
  },

  async setSeat({ roomCode, seat } = {}) {
    const code = String(roomCode || '').trim().toUpperCase()
    const map = this.getRoomsMap()
    const room = map[code]
    if (!room) throw new Error('房间不存在')
    if (room.status !== 'playing') throw new Error('房间已结束')
    const s = Math.floor(Number(seat))
    if (!Number.isInteger(s) || s < 0 || s >= room.maxPlayers) throw new Error('座位无效')
    const deviceId = getDeviceId()
    const me = room.players.find(p => p.id === deviceId)
    if (!me) throw new Error('非本房间成员')
    const target = room.players.find(p => p.id !== deviceId && p.seat === s)
    if (target) {
      const mySeat = me.seat
      me.seat = s
      target.seat = mySeat
    } else {
      me.seat = s
    }
    room.updatedAt = Date.now()
    map[code] = room
    this.saveRoomsMap(map)
    saveRecentRoom(room)
    this.notify(code, room)
    return roomUtil.normalizeRoom(room)
  },

  async endRoom({ roomCode } = {}) {
    const code = String(roomCode || '').trim().toUpperCase()
    const map = this.getRoomsMap()
    const room = map[code]
    if (!room) throw new Error('房间不存在')
    if (room.status === 'ended') return roomUtil.normalizeRoom(room)
    room.status = 'ended'
    room.endedAt = Date.now()
    room.updatedAt = Date.now()
    map[code] = room
    this.saveRoomsMap(map)
    saveRecentRoom(room)
    saveLocalSettlement(roomUtil.normalizeRoom(room))
    this.notify(code, room)
    return roomUtil.normalizeRoom(room)
  },

  async setRoomRate({ roomCode, rate } = {}) {
    const code = String(roomCode || '').trim().toUpperCase()
    const map = this.getRoomsMap()
    const room = map[code]
    if (!room) throw new Error('房间不存在')
    room.rate = roomUtil.clampRate(rate)
    room.updatedAt = Date.now()
    map[code] = room
    this.saveRoomsMap(map)
    saveRecentRoom(room)
    this.notify(code, room)
    return roomUtil.normalizeRoom(room)
  },

  async getRoomQrcode() {
    return { fileID: '', error: '' }
  },

  watch(roomCode, cb) {
    const code = String(roomCode || '').trim().toUpperCase()
    if (!this.listeners[code]) this.listeners[code] = new Set()
    this.listeners[code].add(cb)
    return () => {
      const set = this.listeners[code]
      if (set) {
        set.delete(cb)
        if (!set.size) delete this.listeners[code]
      }
    }
  }
}

// ================= 云开发实现（USE_CLOUD=true，正式号） =================
let cloudReady = false

function ensureCloud() {
  if (cloudReady) return
  wx.cloud.init({ env: config.CLOUD_ENV || undefined, traceUser: true })
  cloudReady = true
}

async function callFn(name, data) {
  ensureCloud()
  const res = await wx.cloud.callFunction({ name, data })
  const r = res && res.result
  if (!r || !r.ok) {
    throw new Error((r && r.error) || '操作失败，请重试')
  }
  return r
}

const cloud = {
  async createRoom(args = {}) {
    const r = await callFn('createRoom', {
      name: args.name,
      maxPlayers: args.maxPlayers,
      nickname: args.profile && args.profile.nickname,
      avatarFileID: (args.profile && args.profile.avatar) || '',
      players: args.players || []
    })
    setMyOpenId(r.playerId)
    return { room: roomUtil.normalizeRoom(r.room), playerId: r.playerId }
  },

  async createDemoRoom() {
    throw new Error('演示模式仅本地模式可用')
  },

  async joinRoom(args = {}) {
    const r = await callFn('joinRoom', {
      roomCode: args.roomCode,
      nickname: args.profile && args.profile.nickname,
      avatarFileID: (args.profile && args.profile.avatar) || ''
    })
    setMyOpenId(r.playerId)
    return { room: roomUtil.normalizeRoom(r.room), playerId: r.playerId }
  },

  async getRoom(roomCode) {
    ensureCloud()
    try {
      const res = await wx.cloud.database().collection('rooms')
        .doc(String(roomCode || '').trim().toUpperCase())
        .get()
      return roomUtil.normalizeRoom(res.data)
    } catch (e) {
      return null
    }
  },

  async updateScore(args = {}) {
    const r = await callFn('updateScore', {
      roomCode: args.roomCode,
      playerId: args.playerId,
      delta: args.delta
    })
    return roomUtil.normalizeRoom(r.room)
  },

  async undoScore(args = {}) {
    const r = await callFn('undoScore', { roomCode: args.roomCode })
    return roomUtil.normalizeRoom(r.room)
  },

  async endRoom(args = {}) {
    const r = await callFn('endRoom', { roomCode: args.roomCode })
    const room = roomUtil.normalizeRoom(r.room)
    saveLocalSettlement(room)
    return room
  },

  async setSeat(args = {}) {
    const r = await callFn('setSeat', { roomCode: args.roomCode, seat: args.seat })
    return roomUtil.normalizeRoom(r.room)
  },

  async setRoomRate(args = {}) {
    const r = await callFn('setRoomRate', {
      roomCode: args.roomCode,
      rate: args.rate
    })
    return roomUtil.normalizeRoom(r.room)
  },

  async getRoomQrcode(args = {}) {
    ensureCloud()
    try {
      const res = await wx.cloud.callFunction({
        name: 'getRoomQrcode',
        data: { roomCode: args.roomCode, envVersion: config.QR_ENV_VERSION }
      })
      const r = res && res.result
      if (r && r.ok && r.fileID) return { fileID: r.fileID }
      return { fileID: '', error: (r && r.error) || '生成小程序码失败' }
    } catch (e) {
      return { fileID: '', error: '生成小程序码失败' }
    }
  },

  watch(roomCode, cb) {
    ensureCloud()
    let closed = false
    let watcher = null
    try {
      watcher = wx.cloud.database().collection('rooms')
        .doc(String(roomCode || '').trim().toUpperCase())
        .watch({
          onChange: (snapshot) => {
            if (closed) return
            const doc = snapshot && snapshot.docs && snapshot.docs[0]
            if (doc) cb(roomUtil.normalizeRoom(doc))
          },
          onError: (err) => {
            if (closed) return
            cb(null, err)
          }
        })
    } catch (e) {
      cb(null, e)
    }
    return () => {
      closed = true
      if (watcher) {
        try { watcher.close() } catch (e) { /* ignore */ }
      }
    }
  }
}

// ================= 对外 API =================
function pick() {
  return config.USE_CLOUD ? cloud : local
}

function init() {
  if (config.USE_CLOUD) ensureCloud()
}

module.exports = {
  config,
  init,
  isCloud: () => !!config.USE_CLOUD,
  createRoom: (args) => pick().createRoom(args),
  createDemoRoom: (args) => pick().createDemoRoom(args),
  joinRoom: (args) => pick().joinRoom(args),
  getRoom: (args) => pick().getRoom(args),
  updateScore: (args) => pick().updateScore(args),
  undoScore: (args) => pick().undoScore(args),
  endRoom: (args) => pick().endRoom(args),
  setSeat: (args) => pick().setSeat(args),
  setRoomRate: (args) => pick().setRoomRate(args),
  getRoomQrcode: (args) => pick().getRoomQrcode(args),
  watchRoom: (code, cb) => pick().watch(code, cb),
  ensureAvatar,
  getRecentRooms,
  saveRecentRoom,
  getPlayerStats,
  getSettlements,
  getProfile,
  saveProfile,
  getDeviceId,
  getMyOpenId,
  setMyOpenId,
  getMyId
}
