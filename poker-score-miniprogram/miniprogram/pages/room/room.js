const store = require('../../utils/store')
const roomUtil = require('../../utils/room')

Page({
  data: {
    roomCode: '',
    room: null,
    playerList: [],
    historyPreview: [],
    myId: '',
    panel: { show: false, player: null },
    invite: { show: false, fileID: '', qrError: '', qrLoading: false },
    redirecting: false
  },

  offWatch: null,

  async onLoad(options) {
    const roomCode = roomUtil.decodeRoomCode(options)
    if (!roomCode) {
      wx.showToast({ title: '缺少房间码', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1000)
      return
    }
    this.setData({ roomCode, myId: store.getMyId() })
    await this.loadRoom(false)
    this.startWatch()
  },

  onShow() {
    if (this.data.roomCode) this.loadRoom(true)
  },

  onUnload() {
    if (this.offWatch) {
      this.offWatch()
      this.offWatch = null
    }
  },

  onPullDownRefresh() {
    this.loadRoom(true).then(() => wx.stopPullDownRefresh())
  },

  async loadRoom(silent) {
    if (!silent) wx.showLoading({ title: '加载房间', mask: true })
    const room = await store.getRoom(this.data.roomCode)
    if (!silent) wx.hideLoading()
    if (!room) {
      wx.showToast({ title: '房间不存在', icon: 'none' })
      setTimeout(() => wx.reLaunch({ url: '/pages/index/index' }), 1200)
      return
    }
    this.applyRoom(room)
  },

  applyRoom(room) {
    if (!room) return
    if (this.data.redirecting) return
    if (room.status === 'ended') {
      this.setData({ redirecting: true })
      wx.redirectTo({ url: `/pages/settle/settle?room=${room.code}` })
      return
    }
    const myId = store.getMyId()
    if (!room.players.some(p => p.id === myId)) {
      this.setData({ redirecting: true })
      wx.redirectTo({ url: `/pages/join/join?mode=join&room=${room.code}` })
      return
    }
    const playerList = room.players.map(p => ({
      ...p,
      avatar: roomUtil.playerAvatar(p),
      score: room.scores[p.id] || 0,
      avatarColor: roomUtil.avatarColor(p.nickname),
      avatarText: roomUtil.avatarText(p.nickname)
    }))
    const historyPreview = room.history.slice(-5).reverse().map(h => {
      const target = room.players.find(x => x.id === h.playerId)
      const by = room.players.find(x => x.id === h.byOpenId)
      const sign = h.delta > 0 ? '+' : ''
      return { ts: h.ts, text: `${by ? by.nickname : '某人'} 给 ${target ? target.nickname : '玩家'} ${sign}${h.delta} 分` }
    })
    this.setData({ room, playerList, historyPreview })
    store.saveRecentRoom(room)
  },

  startWatch() {
    if (this.offWatch) this.offWatch()
    this.offWatch = store.watchRoom(this.data.roomCode, (room) => {
      if (room) this.applyRoom(room)
    })
  },

  onPlayerTap(e) {
    const index = e.currentTarget.dataset.index
    const player = this.data.playerList[index]
    if (!player) return
    this.setData({ panel: { show: true, player } })
  },

  onPanelClose() {
    this.setData({ panel: { show: false, player: null } })
  },

  async onScoreConfirm(e) {
    const { playerId, delta } = e.detail
    this.onPanelClose()
    wx.showLoading({ title: '计分中', mask: true })
    try {
      await store.updateScore({ roomCode: this.data.roomCode, playerId, delta })
      wx.hideLoading()
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: (err && err.message) || '计分失败', icon: 'none' })
    }
  },

  onUndo() {
    wx.showModal({
      title: '撤销上一笔',
      content: '确认撤销最近一次计分？',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '撤销中', mask: true })
        try {
          await store.undoScore({ roomCode: this.data.roomCode })
          wx.hideLoading()
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: (err && err.message) || '撤销失败', icon: 'none' })
        }
      }
    })
  },

  onRefresh() {
    this.loadRoom(true)
  },

  onEnd() {
    wx.showModal({
      title: '结束本局',
      content: '结束后将进入结算页，不可继续计分，确认结束？',
      confirmColor: '#e04f4f',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '结算中', mask: true })
        try {
          await store.endRoom({ roomCode: this.data.roomCode })
          wx.hideLoading()
          if (!this.data.redirecting) {
            wx.redirectTo({ url: `/pages/settle/settle?room=${this.data.roomCode}` })
          }
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: (err && err.message) || '结束失败', icon: 'none' })
        }
      }
    })
  },

  async onInvite() {
    this.setData({ invite: { show: true, fileID: '', qrError: '', qrLoading: true } })
    if (store.isCloud()) {
      try {
        const res = await store.getRoomQrcode({ roomCode: this.data.roomCode })
        if (res && res.fileID) {
          this.setData({ invite: { show: true, fileID: res.fileID, qrError: '', qrLoading: false } })
        } else {
          this.setData({
            invite: { show: true, fileID: '', qrError: (res && res.error) || '生成小程序码失败，请用房间码或转发', qrLoading: false }
          })
        }
      } catch (e) {
        this.setData({
          invite: { show: true, fileID: '', qrError: '生成小程序码失败，请用房间码或转发', qrLoading: false }
        })
      }
    } else {
      this.setData({ invite: { show: true, fileID: '', qrError: '', qrLoading: false } })
    }
  },

  onInviteClose() {
    this.setData({ invite: { show: false } })
  },

  onCopyCode() {
    const code = this.data.room && this.data.room.code
    if (!code) return
    wx.setClipboardData({ data: code })
  },

  onSaveQr() {
    const fileID = this.data.invite.fileID
    if (!fileID) return
    wx.showLoading({ title: '保存中', mask: true })
    wx.cloud.downloadFile({ fileID })
      .then(res => new Promise((resolve, reject) => {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: resolve,
          fail: reject
        })
      }))
      .then(() => {
        wx.hideLoading()
        wx.showToast({ title: '已保存到相册', icon: 'success' })
      })
      .catch(() => {
        wx.hideLoading()
        wx.showToast({ title: '保存失败，请长按图片保存', icon: 'none' })
      })
  },

  noop() {},

  onShareAppMessage() {
    const room = this.data.room || {}
    return {
      title: `加入「${room.name || '打牌'}」牌局，一起记账！`,
      path: `/pages/join/join?room=${this.data.roomCode}`
    }
  }
})


