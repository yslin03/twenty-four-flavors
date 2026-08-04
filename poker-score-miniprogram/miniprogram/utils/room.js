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

// ---------- 优化转账清单 ----------
// 净额 = 分数 × 汇率，按“分”取整计算，避免浮点误差
// 贪心配对：最大债务人 ↔ 最大债权人，逐笔冲销，最小化转账笔数

function parseRate(v) {
  const n = Number(v)
  if (!isFinite(n) || n <= 0) return 1
  return n
}

function formatYuan(cents) {
  const n = Math.round(cents || 0) / 100
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}

// playerList: [{ id, nickname, score }]（settle 页的 playerList 已带 score）
// rate: 1 分兑换多少元（默认 1）
// 返回 { transfers: [{ key, fromId, fromName, toId, toName, amountText }], totalDebt, totalCredit }
// totalDebt / totalCredit 单位为“分”，用于差额提示
function buildTransfers(playerList, rate) {
  const r = parseRate(rate)
  const entries = (Array.isArray(playerList) ? playerList : [])
    .filter(p => p)
    .map(p => ({
      id: p.id,
      name: p.nickname || '玩家',
      cents: Math.round((p.score || 0) * r * 100)
    }))
    .filter(b => b.cents !== 0)
  if (entries.length < 2) {
    return { transfers: [], totalDebt: 0, totalCredit: 0 }
  }
  const debtors = entries.filter(b => b.cents < 0).sort((a, b) => a.cents - b.cents) // 欠款最多在前
  const creditors = entries.filter(b => b.cents > 0).sort((a, b) => b.cents - a.cents) // 应收最多在前
  const totalDebt = debtors.reduce((s, b) => s - b.cents, 0)
  const totalCredit = creditors.reduce((s, b) => s + b.cents, 0)
  const transfers = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]
    const c = creditors[j]
    const pay = Math.min(-d.cents, c.cents)
    transfers.push({
      key: transfers.length,
      fromId: d.id,
      fromName: d.name,
      toId: c.id,
      toName: c.name,
      amountText: `${formatYuan(pay)}元`
    })
    d.cents += pay
    c.cents -= pay
    if (d.cents === 0) i++
    if (c.cents === 0) j++
  }
  return { transfers, totalDebt, totalCredit }
}

function buildTransferText(roomName, result, rate) {
  const transfers = result && result.transfers ? result.transfers : []
  const totalDebt = result ? result.totalDebt : 0
  const totalCredit = result ? result.totalCredit : 0
  const r = parseRate(rate)
  const lines = [`「${roomName}」转账清单（1分=${formatYuan(Math.round(r * 100))}元）`]
  if (!transfers.length) {
    lines.push('无需转账，已全部结清')
    return lines.join('\n')
  }
  transfers.forEach(t => lines.push(`${t.fromName} 转给 ${t.toName} ${t.amountText}`))
  const diff = Math.abs(totalDebt - totalCredit)
  if (diff >= 1) lines.push(`注：总分未归零，差额 ${formatYuan(diff)} 元请自行处理`)
  lines.push('请通过微信「收付款 / 转账」完成以上款项')
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
  buildTransfers,
  buildTransferText,
  avatarColor,
  avatarText,
  timeAgo
}
