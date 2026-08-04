// 云函数：加减分（事务保证并发不丢，写历史供撤销）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const MAX_HISTORY = 100
const MAX_DELTA = 9999
const ERRORS = {
  ROOM_NOT_FOUND: '房间不存在',
  ROOM_ENDED: '房间已结束',
  PLAYER_NOT_FOUND: '玩家不存在'
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const roomCode = String(event.roomCode || '').trim().toUpperCase()
  const playerId = String(event.playerId || '')
  const delta = Math.round(Number(event.delta) || 0)

  if (!roomCode || !playerId || delta === 0 || Math.abs(delta) > MAX_DELTA) {
    return { ok: false, error: '参数无效' }
  }

  try {
    await db.runTransaction(async (t) => {
      const doc = await t.collection('rooms').doc(roomCode).get()
      const room = doc.data
      if (!room) throw new Error('ROOM_NOT_FOUND')
      if (room.status !== 'playing') throw new Error('ROOM_ENDED')
      if (!room.players.some(p => p.id === playerId)) throw new Error('PLAYER_NOT_FOUND')

      const current = room.scores && room.scores[playerId] != null ? room.scores[playerId] : 0
      const next = current + delta
      const history = Array.isArray(room.history) ? room.history.slice(-(MAX_HISTORY - 1)) : []
      history.push({ playerId, delta, byOpenId: OPENID, ts: Date.now() })

      await t.collection('rooms').doc(roomCode).update({
        data: {
          [`scores.${playerId}`]: next,
          history,
          updatedAt: Date.now()
        }
      })
    })

    const fresh = await db.collection('rooms').doc(roomCode).get()
    return { ok: true, room: fresh.data }
  } catch (e) {
    const msg = e.message || '计分失败，请重试'
    return { ok: false, error: ERRORS[msg] || '计分失败，请重试' }
  }
}
