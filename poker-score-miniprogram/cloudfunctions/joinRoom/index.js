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

  const doc = await db.collection('rooms').doc(roomCode).get().catch(() => null)
  if (!doc || !doc.data) return { ok: false, error: '房间不存在' }

  const room = doc.data
  if (room.status !== 'playing') return { ok: false, error: '房间已结束' }

  const idx = room.players.findIndex(p => p.id === OPENID || p.openid === OPENID)
  if (idx >= 0) {
    room.players[idx].nickname = nickname
    if (avatarFileID) room.players[idx].avatarFileID = avatarFileID
  } else {
    if (room.players.length >= room.maxPlayers) return { ok: false, error: '房间已满员' }
    room.players.push({ id: OPENID, openid: OPENID, nickname, avatarFileID, joinedAt: Date.now() })
    room.scores[OPENID] = 0
  }
  room.updatedAt = Date.now()

  await db.collection('rooms').doc(roomCode).update({
    data: { players: room.players, scores: room.scores, updatedAt: room.updatedAt }
  })

  const fresh = await db.collection('rooms').doc(roomCode).get()
  return { ok: true, room: fresh.data, playerId: OPENID }
}
