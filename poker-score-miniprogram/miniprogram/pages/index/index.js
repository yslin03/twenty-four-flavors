const store = require('../../utils/store')
const roomUtil = require('../../utils/room')

Page({
  data: {
    roomCodeInput: '',
    career: { games: 0, wins: 0, losses: 0, rate: 0, total: 0, rankText: '' },
    showDemo: !store.isCloud()
  },

  onShow() {
    const myId = store.getMyId()
    const stats = store.getPlayerStats()
    let career = { games: 0, wins: 0, losses: 0, rate: 0, total: 0, rankText: '' }
    const idx = stats.findIndex(s => s.id === myId)
    if (idx >= 0) {
      const s = stats[idx]
      career = { games: s.games, wins: s.wins, losses: s.losses || 0, rate: s.rate, total: s.total, rankText: '第' + (idx + 1) + '名' }
    }
    this.setData({ career })
  },

  onScan() {
    wx.scanCode({
      onlyFromCamera: false,
      success: (res) => {
        const code = roomUtil.parseScanResult(res && res.result)
        if (!code) {
          wx.showToast({ title: '未识别到房间码', icon: 'none' })
          return
        }
        wx.navigateTo({ url: '/pages/join/join?mode=join&room=' + code })
      }
    })
  },

  onCodeInput(e) {
    this.setData({ roomCodeInput: String(e.detail.value || '').toUpperCase() })
  },

  onCreate() {
    wx.navigateTo({ url: '/pages/join/join?mode=create' })
  },

  onJoin() {
    const code = this.data.roomCodeInput.trim()
    if (!code) {
      wx.showToast({ title: '请输入房间码', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/join/join?mode=join&room=${code}` })
  },

  onDemo() {
    wx.showLoading({ title: '创建演示房间', mask: true })
    store.createDemoRoom()
      .then(({ room }) => {
        wx.hideLoading()
        wx.redirectTo({ url: `/pages/room/room?room=${room.code}` })
      })
      .catch(err => {
        wx.hideLoading()
        wx.showToast({ title: (err && err.message) || '创建失败', icon: 'none' })
      })
  },

})
