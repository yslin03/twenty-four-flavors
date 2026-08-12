// 云函数：修改积分倍率（仅房主）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const MIN_RATE = 0.1
const MAX_RATE = 100
const DEFAULT_RATE = 1

function clampRate(v) {
  const n = Number(v)
  if (!isFinite(n) || n <= 0) return DEFAULT_RATE
  const r = Math.round(n * 100) / 100
  return Math.min(MAX_RATE, Math.max(MIN_RATE, r))
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const roomCode = String(event.roomCode || '').trim().toUpperCase()
  const rate = clampRate(event.rate)

  if (!roomCode) return { ok: false, error: '房间码无效' }

  const doc = await db.collection('rooms').doc(roomCode).get().catch(() => null)
  if (!doc || !doc.data) return { ok: false, error: '房间不存在' }

  const room = doc.data
  if (room.status !== 'playing') return { ok: false, error: '房间已结束' }
  if (room.hostOpenId !== OPENID) return { ok: false, error: '仅房主可修改倍率' }

  await db.collection('rooms').doc(roomCode).update({
    data: { rate, updatedAt: Date.now() }
  })

  const fresh = await db.collection('rooms').doc(roomCode).get()
  return { ok: true, room: fresh.data }
}
