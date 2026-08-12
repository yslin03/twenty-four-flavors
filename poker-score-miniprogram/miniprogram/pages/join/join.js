const store = require('../../utils/store')
const roomUtil = require('../../utils/room')

Page({
  data: {
    mode: 'join',
    isCreate: false,
    roomCode: '',
    room: null,
    roomName: '',
    maxPlayers: 4,
    maxOptions: ['2', '3', '4', '5', '6', '7', '8'],
    maxIndex: 2,
    nickname: '',
    avatar: '',
    avatarColor: '#2ecc8f',
    avatarText: '牌',
    submitting: false
  },

  async onLoad(options) {
    const mode = options.mode === 'create' ? 'create' : 'join'
    const code = roomUtil.decodeRoomCode(options)
    const profile = store.getProfile() || {}
    this.setData({
      mode,
      isCreate: mode === 'create',
      roomCode: code,
      nickname: profile.nickname || '',
      avatar: profile.avatar || '',
      avatarColor: roomUtil.avatarColor(profile.nickname || ''),
      avatarText: roomUtil.avatarText(profile.nickname || '')
    })
    wx.setNavigationBarTitle({ title: mode === 'create' ? '创建房间' : '加入房间' })

    if (mode === 'join' && !code) {
      wx.showToast({ title: '缺少房间码', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1200)
      return
    }
    if (mode === 'join') {
      wx.showLoading({ title: '加载房间', mask: true })
      const room = await store.getRoom(code)
      wx.hideLoading()
      if (!room) {
        wx.showToast({ title: '房间不存在或已结束', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 1200)
        return
      }
      if (room.status !== 'playing') {
        wx.showToast({ title: '该房间已结束', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 1200)
        return
      }
      if (room.players.length >= room.maxPlayers && !room.players.some(p => p.id === store.getMyId())) {
        wx.showToast({ title: '房间已满员', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 1200)
        return
      }
      this.setData({ room })
    }
  },

  onNameInput(e) { this.setData({ roomName: e.detail.value }) },

  onMaxChange(e) {
    const index = Number(e.detail.value)
    this.setData({ maxIndex: index, maxPlayers: Number(this.data.maxOptions[index]) })
  },

  onNickInput(e) {
    const nickname = e.detail.value
    this.setData({
      nickname,
      avatarColor: roomUtil.avatarColor(nickname),
      avatarText: roomUtil.avatarText(nickname)
    })
  },

  onChooseAvatar(e) {
    this.setData({ avatar: e.detail.avatarUrl || '' })
  },

  async onSubmit() {
    if (this.data.submitting) return
    const nickname = (this.data.nickname || '').trim() || '玩家'
    let avatar = this.data.avatar
    wx.showLoading({ title: this.data.isCreate ? '创建中' : '加入中', mask: true })
    this.setData({ submitting: true })
    try {
      // 云开发模式：把临时头像上传为云存储 fileID，供多端显示
      avatar = await store.ensureAvatar(avatar)
      const profile = { nickname, avatar }
      store.saveProfile(profile)
      const { room } = this.data.isCreate
        ? await store.createRoom({ name: this.data.roomName, maxPlayers: this.data.maxPlayers, profile })
        : await store.joinRoom({ roomCode: this.data.roomCode, profile })
      wx.hideLoading()
      wx.redirectTo({ url: `/pages/room/room?room=${room.code}&invite=1` })
    } catch (err) {
      wx.hideLoading()
      this.setData({ submitting: false })
      wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
    }
  }
})
