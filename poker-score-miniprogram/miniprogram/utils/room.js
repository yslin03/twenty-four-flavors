const config = require('../config')

function clamp(v, min, max, fallback) {
  const n = Number(v)
  if (!isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

// 倍率校验：保留最多两位小数，限制在 [MIN_RATE, MAX_RATE]
function clampRate(v) {
  const n = Number(v)
  if (!isFinite(n) || n <= 0) return config.DEFAULT_RATE
  const r = Math.round(n * 100) / 100
  return Math.min(config.MAX_RATE, Math.max(config.MIN_RATE, r))
}

function genRoomCode() {
  const chars = config.ROOM_CODE_CHARSET
  let code = ''
  for (let i = 0; i < config.ROOM_CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// 从页面 onLoad options 解析房间码：支持 scene(r=XXXXXX)、room、code 三种来源
function decodeRoomCode(options) {
  if (!options) return ''
  if (options.scene) {
    let decoded = ''
    try { decoded = decodeURIComponent(options.scene) } catch (e) { decoded = String(options.scene) }
    const m = decoded.match(/(?:^|[?&])r=([A-Za-z0-9]{4,12})/)
    if (m) return m[1].toUpperCase()
    return decoded.trim().toUpperCase()
  }
  return String(options.room || options.code || '').trim().toUpperCase()
}

function normalizeRoom(raw) {
  if (!raw) return null
  return {
    code: raw._id || raw.code || '',
    name: raw.name || '未命名牌局',
    hostOpenId: raw.hostOpenId || '',
    status: raw.status || 'playing',
    maxPlayers: clamp(raw.maxPlayers, 2, 8, 4),
    rate: clampRate(raw.rate),
    players: Array.isArray(raw.players) ? raw.players : [],
    scores: raw.scores && typeof raw.scores === 'object' ? raw.scores : {},
    history: Array.isArray(raw.history) ? raw.history : [],
    createdAt: raw.createdAt || Date.now(),
    updatedAt: raw.updatedAt || Date.now(),
    endedAt: raw.endedAt || 0
  }
}

function playerAvatar(p) {
  if (!p) return ''
  return p.avatar || p.avatarFileID || ''
}

function scoreOf(room, playerId) {
  return room.scores[playerId] || 0
}

function sortedPlayers(room) {
  return room.players
    .map(p => ({ ...p, score: scoreOf(room, p.id) }))
    .sort((a, b) => b.score - a.score)
}

function buildSettlementText(room) {
  const lines = [`「${room.name}」本局记分结果`]
  sortedPlayers(room).forEach((p, i) => {
    const rank = `第${i + 1}名`
    const sign = p.score > 0 ? '+' : ''
    lines.push(`${rank} ${p.nickname || '玩家'} ${sign}${p.score} 积分`)
  })
  return lines.join('\n')
}

function lowestFreeSeat(players, maxPlayers) {
  const used = new Set()
  players.forEach(p => {
    if (Number.isInteger(p.seat) && p.seat >= 0 && p.seat < maxPlayers) used.add(p.seat)
  })
  for (let i = 0; i < maxPlayers; i++) {
    if (!used.has(i)) return i
  }
  return 0
}

function assignSeats(players, maxPlayers, hostId) {
  const used = new Set()
  players.forEach(p => {
    if (Number.isInteger(p.seat) && p.seat >= 0 && p.seat < maxPlayers && !used.has(p.seat)) {
      used.add(p.seat)
    } else {
      p.seat = -1
    }
  })
  const host = players.find(p => p.id === hostId)
  if (host && host.seat === -1 && !used.has(0)) {
    host.seat = 0
    used.add(0)
  }
  players.forEach(p => {
    if (p.seat === -1) {
      for (let i = 0; i < maxPlayers; i++) {
        if (!used.has(i)) {
          p.seat = i
          used.add(i)
          break
        }
      }
    }
  })
}

const AVATAR_COLORS = ['#2ecc8f', '#f2c14e', '#5b8def', '#e07a5f', '#9b5de5', '#f15bb5', '#00b4d8', '#6a994e']

function avatarColor(name) {
  let h = 0
  const s = String(name || '')
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function avatarText(name) {
  const s = String(name || '').trim()
  return s ? s[0].toUpperCase() : '牌'
}

function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  return `${d} 天前`
}

module.exports = {
  clamp,
  clampRate,
  genRoomCode,
  decodeRoomCode,
  normalizeRoom,
  playerAvatar,
  scoreOf,
  sortedPlayers,
  buildSettlementText,
  avatarColor,
  avatarText,
  timeAgo,
  lowestFreeSeat,
  assignSeats
}
