// 云函数：创建房间（支持再来一局时复用玩家列表）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 4
const MIN_PLAYERS = 2
const MAX_PLAYERS = 8
const DEFAULT_MAX_PLAYERS = 4

function genCode() {
  let s = ''
  for (let i = 0; i < CODE_LENGTH; i++) s += CHARSET[Math.floor(Math.random() * CHARSET.length)]
  return s
}

function clampMax(v) {
  const n = Number(v)
  if (!isFinite(n)) return DEFAULT_MAX_PLAYERS
  return Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.round(n)))
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const name = String(event.name || '').trim().slice(0, 20)
  const maxPlayers = clampMax(event.maxPlayers)
  const nickname = String(event.nickname || '房主').slice(0, 20) || '房主'
  const avatarFileID = String(event.avatarFileID || '')

  // 再来一局：复用原房间玩家（v1 简化：按形状校验）
  const seed = Array.isArray(event.players)
    ? event.players.slice(0, MAX_PLAYERS).map(p => ({
        id: String(p.id || ''),
        openid: String(p.openid || p.id || ''),
        nickname: String(p.nickname || '玩家').slice(0, 20),
        avatarFileID: String(p.avatarFileID || p.avatar || ''),
        joinedAt: Number(p.joinedAt) || Date.now(),
        seat: Number.isInteger(p.seat) ? p.seat : -1
      })).filter(p => p.id)
    : []

  let code = ''
  for (let i = 0; i < 10; i++) {
    code = genCode()
    const exists = await db.collection('rooms').doc(code).get().then(() => true).catch(() => false)
    if (!exists) break
  }

  const host = { id: OPENID, openid: OPENID, nickname, avatarFileID, joinedAt: Date.now(), seat: -1 }
  const players = seed.slice()
  if (!players.some(p => p.id === OPENID)) players.unshift(host)
  if (!players.length) players.push(host)

  // 分配座位：保留已有合法座位；房主无座默认 0；其余填最小空位
  const usedSeats = new Set()
  players.forEach(p => {
    if (Number.isInteger(p.seat) && p.seat >= 0 && p.seat < maxPlayers && !usedSeats.has(p.seat)) {
      usedSeats.add(p.seat)
    } else {
      p.seat = -1
    }
  })
  const hostPlayer = players.find(p => p.id === OPENID)
  if (hostPlayer && hostPlayer.seat === -1 && !usedSeats.has(0)) {
    hostPlayer.seat = 0
    usedSeats.add(0)
  }
  players.forEach(p => {
    if (p.seat === -1) {
      for (let i = 0; i < maxPlayers; i++) {
        if (!usedSeats.has(i)) {
          p.seat = i
          usedSeats.add(i)
          break
        }
      }
    }
  })

  const scores = {}
  players.forEach(p => { scores[p.id] = 0 })

  const now = Date.now()
  const room = {
    name: name || `牌局 ${code}`,
    hostOpenId: OPENID,
    status: 'playing',
    maxPlayers,
    players,
    scores,
    history: [],
    createdAt: now,
    updatedAt: now
  }
  await db.collection('rooms').doc(code).set({ data: room })
  return { ok: true, room: { ...room, _id: code }, playerId: OPENID }
}
