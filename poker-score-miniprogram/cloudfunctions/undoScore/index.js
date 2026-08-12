// 云函数：撤销最后一笔计分（事务回滚）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const ERRORS = {
  ROOM_NOT_FOUND: '房间不存在',
  ROOM_ENDED: '房间已结束',
  NOT_HOST: '仅房主可撤销',
  NO_HISTORY: '暂无撤销记录'
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const roomCode = String(event.roomCode || '').trim().toUpperCase()
  if (!roomCode) return { ok: false, error: '房间码无效' }

  try {
    const room = await db.runTransaction(async (t) => {
      const doc = await t.collection('rooms').doc(roomCode).get()
      const room = doc.data
      if (!room) throw new Error('ROOM_NOT_FOUND')
      if (room.status !== 'playing') throw new Error('ROOM_ENDED')
      if (room.hostOpenId !== OPENID) throw new Error('NOT_HOST')

      const history = Array.isArray(room.history) ? room.history : []
      if (!history.length) throw new Error('NO_HISTORY')

      const last = history[history.length - 1]
      const current = room.scores && room.scores[last.playerId] != null ? room.scores[last.playerId] : 0
      const now = Date.now()

      await t.collection('rooms').doc(roomCode).update({
        data: {
          [`scores.${last.playerId}`]: current - last.delta,
          history: history.slice(0, -1),
          updatedAt: now
        }
      })

      return {
        ...room,
        scores: { ...room.scores, [last.playerId]: current - last.delta },
        history: history.slice(0, -1),
        updatedAt: now
      }
    })

    return { ok: true, room }
  } catch (e) {
    const msg = e.message || '撤销失败，请重试'
    return { ok: false, error: ERRORS[msg] || '撤销失败，请重试' }
  }
}
