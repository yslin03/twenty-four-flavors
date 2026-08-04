const store = require('../../utils/store')
const roomUtil = require('../../utils/room')

Page({
  data: {
    roomCodeInput: '',
    recent: [],
    showDemo: !store.isCloud()
  },

  onShow() {
    const list = store.getRecentRooms()
    this.setData({
      recent: list.map(r => ({ ...r, timeText: roomUtil.timeAgo(r.updatedAt) }))
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

  onRecentTap(e) {
    const code = e.currentTarget.dataset.code
    if (!code) return
    wx.navigateTo({ url: `/pages/room/room?room=${code}` })
  }
})
