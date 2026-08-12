// 云函数：生成小程序码（scene=r=房间码），保存到云存储
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const roomCode = String(event.roomCode || '').trim().toUpperCase()
  const envVersion = ['develop', 'trial', 'release'].indexOf(event.envVersion) >= 0 ? event.envVersion : 'release'

  if (!roomCode) return { ok: false, error: '房间码无效' }

  const doc = await db.collection('rooms').doc(roomCode).get().catch(() => null)
  if (!doc || !doc.data) return { ok: false, error: '房间不存在' }

  // 已生成过则直接返回缓存的小程序码，避免重复调用 wxacode（慢）
  if (doc.data.qrFileID) {
    return { ok: true, fileID: doc.data.qrFileID, urlLink: doc.data.inviteUrl || '', cached: true }
  }

  try {
    const res = await cloud.openapi.wxacode.getUnlimited({
      scene: `r=${roomCode}`,
      page: 'pages/join/join',
      checkPath: false,
      envVersion,
      width: 430
    })
    const upload = await cloud.uploadFile({
      cloudPath: `qrcodes/${roomCode}_${Date.now()}.png`,
      fileContent: Buffer.from(res.buffer)
    })
    let urlLink = ''
    try {
      const linkRes = await cloud.openapi.urllink.generate({
        page: 'pages/join/join',
        query: 'room=' + roomCode,
        envVersion,
        isExpire: true,
        expireType: 1,
        expireInterval: 7
      })
      urlLink = linkRes.urlLink || ''
    } catch (e) { /* 邀请链接生成失败不影响小程序码 */ }
    await db.collection('rooms').doc(roomCode).update({
      data: { qrFileID: upload.fileID, inviteUrl: urlLink, updatedAt: Date.now() }
    }).catch(() => { /* 缓存写入失败不影响返回 */ })
    return { ok: true, fileID: upload.fileID, urlLink }
  } catch (e) {
    return { ok: false, error: e.errMsg || e.message || '生成小程序码失败' }
  }
}
