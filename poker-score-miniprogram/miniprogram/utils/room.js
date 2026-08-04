const config = require('../config')

function clamp(v, min, max, fallback) {
  const n = Number(v)
  if (!isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
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

const RANK_MEDALS = ['🥇', '🥈', '🥉']

function buildSettlementText(room) {
  const lines = [`「${room.name}」结算`]
  sortedPlayers(room).forEach((p, i) => {
    const medal = RANK_MEDALS[i] || `${i + 1}.`
    const sign = p.score > 0 ? '+' : ''
    lines.push(`${medal} ${p.nickname || '玩家'} ${sign}${p.score}`)
  })
  lines.push('请通过微信收付款/转账自行结算')
  return lines.join('\n')
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
  genRoomCode,
  decodeRoomCode,
  normalizeRoom,
  playerAvatar,
  scoreOf,
  sortedPlayers,
  buildSettlementText,
  avatarColor,
  avatarText,
  timeAgo
}
