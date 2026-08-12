// 云函数：选择/互换座位
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const roomCode = String(event.roomCode || '').trim().toUpperCase()
  const seat = Number(event.seat)

  if (!roomCode) return { ok: false, error: '房间码无效' }
  if (!Number.isInteger(seat) || seat < 0) return { ok: false, error: '座位无效' }

  const errors = {
    ROOM_NOT_FOUND: '房间不存在',
    ROOM_ENDED: '房间已结束',
    INVALID_SEAT: '座位无效',
    NOT_MEMBER: '非本房间成员'
  }

  try {
    const room = await db.runTransaction(async (t) => {
      const doc = await t.collection('rooms').doc(roomCode).get()
      const room = doc && doc.data
      if (!room) throw new Error('ROOM_NOT_FOUND')
      if (room.status !== 'playing') throw new Error('ROOM_ENDED')
      if (seat >= room.maxPlayers) throw new Error('INVALID_SEAT')

      const players = Array.isArray(room.players) ? room.players.map(p => ({ ...p })) : []
      const me = players.find(p => p.id === OPENID)
      if (!me) throw new Error('NOT_MEMBER')
      if (me.seat === seat) return room

      const target = players.find(p => p.id !== OPENID && p.seat === seat)
      const now = Date.now()
      if (target) target.seat = me.seat
      me.seat = seat

      await t.collection('rooms').doc(roomCode).update({
        data: { players, updatedAt: now }
      })
      return { ...room, players, updatedAt: now }
    })
    return { ok: true, room }
  } catch (e) {
    return { ok: false, error: errors[e.message] || '切换座位失败，请重试' }
  }
}
