// 云函数：加入房间（重复加入只更新资料）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const roomCode = String(event.roomCode || '').trim().toUpperCase()
  const nickname = String(event.nickname || '玩家').slice(0, 20) || '玩家'
  const avatarFileID = String(event.avatarFileID || '')

  if (!roomCode) return { ok: false, error: '房间码无效' }

  try {
    await db.runTransaction(async (t) => {
      const doc = await t.collection('rooms').doc(roomCode).get()
      const room = doc && doc.data
      if (!room) throw new Error('ROOM_NOT_FOUND')
      if (room.status !== 'playing') throw new Error('ROOM_ENDED')

      const players = Array.isArray(room.players) ? room.players.slice() : []
      const scores = room.scores || {}
      const idx = players.findIndex(p => p.id === OPENID || p.openid === OPENID)
      if (idx >= 0) {
        players[idx] = { ...players[idx], nickname }
        if (avatarFileID) players[idx].avatarFileID = avatarFileID
      } else {
        if (players.length >= room.maxPlayers) throw new Error('ROOM_FULL')
        players.push({ id: OPENID, openid: OPENID, nickname, avatarFileID, joinedAt: Date.now() })
        scores[OPENID] = 0
      }

      await t.collection('rooms').doc(roomCode).update({
        data: { players, scores, updatedAt: Date.now() }
      })
    })
  } catch (e) {
    const errors = {
      ROOM_NOT_FOUND: '房间不存在',
      ROOM_ENDED: '房间已结束',
      ROOM_FULL: '房间已满员'
    }
    return { ok: false, error: errors[e.message] || '加入房间失败，请重试' }
  }

  const fresh = await db.collection('rooms').doc(roomCode).get()
  return { ok: true, room: fresh.data, playerId: OPENID }
}
