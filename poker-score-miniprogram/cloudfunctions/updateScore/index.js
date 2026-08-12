// 云函数：加减分（事务保证并发不丢，写历史供撤销）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const MAX_HISTORY = 100
const MAX_DELTA = 9999
const ERRORS = {
  ROOM_NOT_FOUND: '房间不存在',
  ROOM_ENDED: '房间已结束',
  PLAYER_NOT_FOUND: '玩家不存在',
  NOT_MEMBER: '非本房间成员'
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const roomCode = String(event.roomCode || '').trim().toUpperCase()
  const playerId = String(event.playerId || '')
  const delta = Math.round(Number(event.delta) || 0)

  if (!roomCode || !playerId) {
    return { ok: false, error: '参数无效' }
  }
  if (delta <= 0) {
    return { ok: false, error: '仅支持加分' }
  }
  if (Math.abs(delta) > MAX_DELTA) {
    return { ok: false, error: '分值过大' }
  }

  try {
    const room = await db.runTransaction(async (t) => {
      const doc = await t.collection('rooms').doc(roomCode).get()
      const room = doc.data
      if (!room) throw new Error('ROOM_NOT_FOUND')
      if (room.status !== 'playing') throw new Error('ROOM_ENDED')
      if (!room.players.some(p => p.id === playerId)) throw new Error('PLAYER_NOT_FOUND')
      if (!room.players.some(p => p.id === OPENID)) throw new Error('NOT_MEMBER')

      const current = room.scores && room.scores[playerId] != null ? room.scores[playerId] : 0
      const next = current + delta
      const history = Array.isArray(room.history) ? room.history.slice(-(MAX_HISTORY - 1)) : []
      const now = Date.now()
      history.push({ playerId, delta, byOpenId: OPENID, ts: now })

      await t.collection('rooms').doc(roomCode).update({
        data: {
          [`scores.${playerId}`]: next,
          history,
          updatedAt: now
        }
      })

      // Return the committed shape so the client does not need a second read.
      return { ...room, scores: { ...room.scores, [playerId]: next }, history, updatedAt: now }
    })

    return { ok: true, room }
  } catch (e) {
    const msg = e.message || '计分失败，请重试'
    return { ok: false, error: ERRORS[msg] || '计分失败，请重试' }
  }
}
