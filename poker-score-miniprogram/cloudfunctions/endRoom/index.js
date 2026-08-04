// 云函数：结束本局，写入 settlements 快照
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const roomCode = String(event.roomCode || '').trim().toUpperCase()
  if (!roomCode) return { ok: false, error: '房间码无效' }

  const doc = await db.collection('rooms').doc(roomCode).get().catch(() => null)
  if (!doc || !doc.data) return { ok: false, error: '房间不存在' }

  const room = doc.data
  if (room.status === 'ended') return { ok: true, room }

  const now = Date.now()
  await db.collection('rooms').doc(roomCode).update({
    data: { status: 'ended', endedAt: now, updatedAt: now }
  })

  // 结算快照（仅记录，不涉及金额）
  await db.collection('settlements').add({
    data: {
      roomId: roomCode,
      roomName: room.name,
      players: room.players,
      finalScores: room.scores,
      history: room.history,
      finishedAt: now
    }
  }).catch(() => { /* 快照失败不影响主流程 */ })

  const fresh = await db.collection('rooms').doc(roomCode).get()
  return { ok: true, room: fresh.data }
}
