const store = require('../../utils/store')
const roomUtil = require('../../utils/room')

Page({
  data: {
    room: null,
    playerList: [],
    summary: '',
    rate: '1',        // 1 分 = 几元，字符串以兼容 input
    transfers: [],    // 转账列表
    transferText: ''  // 复制用的文案
  },

  async onLoad(options) {
    const code = roomUtil.decodeRoomCode(options)
    if (!code) {
      wx.navigateBack()
      return
    }
    wx.showLoading({ title: '加载结算', mask: true })
    const room = await store.getRoom(code)
    wx.hideLoading()
    if (!room) {
      wx.showToast({ title: '房间不存在', icon: 'none' })
      setTimeout(() => wx.reLaunch({ url: '/pages/index/index' }), 1200)
      return
    }
    this.applyRoom(room)
  },

  applyRoom(room) {
    const playerList = roomUtil.sortedPlayers(room).map((p, i) => ({
      ...p,
      avatar: roomUtil.playerAvatar(p),
      avatarColor: roomUtil.avatarColor(p.nickname),
      avatarText: roomUtil.avatarText(p.nickname),
      rankText: ['🥇', '🥈', '🥉'][i] || `${i + 1}.`
    }))
    this.setData({
      room,
      playerList,
      summary: roomUtil.buildSettlementText(room)
    })
    store.saveRecentRoom(room)
    this.recomputeTransfers()
  },

  recomputeTransfers() {
    const room = this.data.room
    const playerList = this.data.playerList || []
    if (!room || !playerList.length) {
      this.setData({ transfers: [], transferText: '' })
      return
    }
    const result = roomUtil.buildTransfers(playerList, this.data.rate)
    this.setData({
      transfers: result.transfers,
      transferText: roomUtil.buildTransferText(room.name, result, this.data.rate)
    })
  },

  onRateInput(e) {
    this.setData({ rate: String(e.detail.value || '') }, () => this.recomputeTransfers())
  },

  onRateBlur(e) {
    // 失焦时归一化：空/非法回退为 1
    const v = String(e.detail.value || '').trim()
    const rate = (v && isFinite(Number(v)) && Number(v) > 0) ? v : '1'
    this.setData({ rate }, () => this.recomputeTransfers())
  },

  onCopyTransfer() {
    if (!this.data.transferText) return
    wx.setClipboardData({ data: this.data.transferText })
  },

  onCopy() {
    if (!this.data.summary) return
    wx.setClipboardData({ data: this.data.summary })
  },

  onRestart() {
    wx.showModal({
      title: '再来一局',
      content: '使用当前玩家列表开新局，分数清零并生成新房间码，需重新邀请好友。',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '开新局中', mask: true })
        try {
          const room = this.data.room
          const profile = store.getProfile() || { nickname: '房主', avatar: '' }
          const seedPlayers = room.players.map(p => ({
            id: p.id,
            openid: p.openid || p.id,
            nickname: p.nickname,
            avatar: roomUtil.playerAvatar(p)
          }))
          const created = await store.createRoom({
            name: room.name,
            maxPlayers: room.maxPlayers,
            profile,
            players: seedPlayers
          })
          wx.hideLoading()
          wx.redirectTo({ url: `/pages/room/room?room=${created.room.code}` })
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: (err && err.message) || '开新局失败', icon: 'none' })
        }
      }
    })
  },

  onHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  }
})
