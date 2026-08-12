const store = require('../../utils/store')
const roomUtil = require('../../utils/room')
const config = require('../../config')
const tts = require('../../utils/tts')

function formatScoreTime(value) {
  const date = new Date(Number(value) || Date.now())
  const pad = n => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

Page({
  data: {
    roomCode: '',
    room: null,
    playerList: [],
    historyPreview: [],
    myId: '',
    isHost: false,
    panel: { show: false, player: null },
    invite: { show: false, fileID: '', qrPath: '', qrError: '', qrLoading: false },
    nicknameModal: { show: false },
    nicknameInput: '',
    voiceOn: true,
    redirecting: false,
    rateOptions: config.RATE_OPTIONS,
    customRateMode: false,
    customRate: '',
    customRateActive: false
  },

  offWatch: null,

  async onLoad(options) {
    const roomCode = roomUtil.decodeRoomCode(options)
    if (!roomCode) {
      wx.showToast({ title: '缺少房间码', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1000)
      return
    }
    this.setData({
      roomCode,
      myId: store.getMyId(),
      voiceOn: tts.isEnabled()
    })
    this.autoInvite = options.invite === '1'
    await this.loadRoom(false)
    this.startWatch()
    if (this.autoInvite && this.data.isHost) {
      this.onInvite()
    }
  },

  onShow() {
    this.setData({ voiceOn: tts.isEnabled() })
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
    const rateInOptions = config.RATE_OPTIONS.includes(room.rate)
    const customRateActive = !rateInOptions
    if (this.data.customRateMode && !customRateActive) {
      this.setData({ customRateMode: false })
    }
    this.setData({
      customRateActive,
      customRate: customRateActive ? String(room.rate) : this.data.customRate
    })
    const historyPreview = room.history.slice(-5).reverse().map(h => {
      const target = room.players.find(x => x.id === h.playerId)
      const by = room.players.find(x => x.id === h.byOpenId)
      const sign = h.delta > 0 ? '+' : ''
      return {
        ts: h.ts,
        time: formatScoreTime(h.ts),
        text: `${by ? by.nickname : '某人'} 给 ${target ? target.nickname : '玩家'} ${sign}${h.delta} 积分`
      }
    })
    this.setData({ room, playerList, historyPreview, isHost: myId === room.hostOpenId })
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
    if (player.id === this.data.myId) {
      this.setData({ nicknameModal: { show: true }, nicknameInput: player.nickname || '' })
      return
    }
    this.setData({ panel: { show: true, player } })
  },

  onNicknameInput(e) {
    this.setData({ nicknameInput: e.detail.value })
  },

  onNicknameClose() {
    this.setData({ nicknameModal: { show: false } })
  },

  async onNicknameSave() {
    const nickname = (this.data.nicknameInput || '').trim()
    if (!nickname) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    wx.showLoading({ title: '保存中', mask: true })
    try {
      const profile = store.getProfile() || {}
      await store.joinRoom({ roomCode: this.data.roomCode, profile: { nickname, avatar: profile.avatar || '' } })
      store.saveProfile({ ...profile, nickname })
      this.setData({ nicknameModal: { show: false } })
      wx.hideLoading()
      this.loadRoom(true)
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: (err && err.message) || '保存失败', icon: 'none' })
    }
  },

  onPanelClose() {
    this.setData({ panel: { show: false, player: null } })
  },

  async onScoreConfirm(e) {
    const { playerId, delta } = e.detail
    const rate = (this.data.room && this.data.room.rate) || 1
    const scoredDelta = Math.round(delta * rate)
    this.onPanelClose()
    const currentRoom = this.data.room
    const target = currentRoom && currentRoom.players.find(p => p.id === playerId)

    // Show the score instantly; the cloud transaction and room watcher reconcile it.
    if (target && scoredDelta > 0) {
      const optimisticRoom = {
        ...currentRoom,
        scores: {
          ...currentRoom.scores,
          [playerId]: (currentRoom.scores[playerId] || 0) + scoredDelta
        }
      }
      this.applyRoom(optimisticRoom)
    }
    try {
      // The result comes from the transaction; `watch()` also broadcasts it to every player.
      const room = await store.updateScore({ roomCode: this.data.roomCode, playerId, delta: scoredDelta })
      if (room) this.applyRoom(room)
      if (target && scoredDelta > 0) {
        tts.speak('给' + target.nickname + '加' + scoredDelta + '分')
      }
    } catch (err) {
      // Restore the authoritative state if the transaction was rejected.
      this.loadRoom(true)
      wx.showToast({ title: (err && err.message) || '计分失败', icon: 'none' })
    }
  },

  async onRateTap(e) {
    const rate = Number(e.currentTarget.dataset.rate)
    if (!rate || rate === this.data.room.rate) return
    this.setData({ customRateMode: false })
    wx.showLoading({ title: '切换倍率', mask: true })
    try {
      await store.setRoomRate({ roomCode: this.data.roomCode, rate })
      wx.hideLoading()
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: (err && err.message) || '切换失败', icon: 'none' })
    }
  },

  onRateCustom() {
    const cur = this.data.room && this.data.room.rate
    this.setData({ customRateMode: true, customRate: cur != null ? String(cur) : '' })
  },

  onRateInput(e) {
    this.setData({ customRate: e.detail.value })
  },

  async onRateCustomConfirm() {
    const raw = this.data.customRate
    const rate = roomUtil.clampRate(raw)
    const target = Number(raw)
    if (!isFinite(target) || target <= 0) {
      wx.showToast({ title: '请输入有效的倍率', icon: 'none' })
      return
    }
    if (target !== rate) {
      wx.showToast({
        title: `倍率已自动限制在 ${config.MIN_RATE} ~ ${config.MAX_RATE} 之间`,
        icon: 'none'
      })
    }
    wx.showLoading({ title: '切换倍率', mask: true })
    try {
      await store.setRoomRate({ roomCode: this.data.roomCode, rate })
      this.setData({ customRateMode: false })
      wx.hideLoading()
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: (err && err.message) || '切换失败', icon: 'none' })
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
      content: '结束后将进入记分结果页，不可继续记分，确认结束？',
      confirmColor: '#e04f4f',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '结束中', mask: true })
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
    this.setData({ invite: { show: true, fileID: '', qrPath: '', qrError: '', qrLoading: true } })
    if (store.isCloud()) {
      try {
        const res = await store.getRoomQrcode({ roomCode: this.data.roomCode })
        if (res && res.fileID) {
          this.setData({ invite: { show: true, fileID: res.fileID, qrPath: '', qrError: '', qrLoading: false } })
        } else {
          this.setData({
            invite: { show: true, fileID: '', qrPath: '', qrError: (res && res.error) || '生成小程序码失败，请用房间码或转发', qrLoading: false }
          })
        }
      } catch (e) {
        this.setData({
          invite: { show: true, fileID: '', qrPath: '', qrError: '生成小程序码失败，请用房间码或转发', qrLoading: false }
        })
      }
    } else {
      try {
        const qrPath = await this.drawLocalQr('r=' + this.data.roomCode)
        this.setData({ invite: { show: true, fileID: '', qrPath, qrError: '', qrLoading: false } })
      } catch (e) {
        this.setData({
          invite: { show: true, fileID: '', qrPath: '', qrError: '生成二维码失败，请用房间码或转发', qrLoading: false }
        })
      }
    }
  },

  drawLocalQr(text) {
    return new Promise((resolve, reject) => {
      const qrcode = require('../../utils/qrcode')
      const qr = qrcode(0, 'M')
      qr.addData(String(text || ''))
      qr.make()
      const count = qr.getModuleCount()
      const size = 220
      const cell = size / (count + 8)
      wx.nextTick(() => {
        const query = wx.createSelectorQuery().in(this)
        query.select('#inviteQrCanvas').fields({ node: true, size: true }).exec((res) => {
          const canvas = res && res[0] && res[0].node
          if (!canvas) {
            reject(new Error('canvas 不可用'))
            return
          }
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext('2d')
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, size, size)
          ctx.fillStyle = '#000000'
          const offset = 4 * cell
          for (let r = 0; r < count; r++) {
            for (let c = 0; c < count; c++) {
              if (qr.isDark(r, c)) {
                ctx.fillRect(offset + c * cell, offset + r * cell, Math.ceil(cell), Math.ceil(cell))
              }
            }
          }
          wx.canvasToTempFilePath({
            canvas,
            success: (res2) => {
              if (res2 && res2.tempFilePath) {
                resolve(res2.tempFilePath)
              } else {
                reject(new Error('导出二维码失败'))
              }
            },
            fail: (err) => reject(err || new Error('导出二维码失败'))
          }, this)
        })
      })
    })
  },

  onInviteClose() {
    this.setData({ invite: { show: false } })
  },

  onVoiceToggle() {
    const next = !this.data.voiceOn
    tts.setEnabled(next)
    this.setData({ voiceOn: next })
    wx.showToast({ title: next ? '语音已开启' : '语音已关闭', icon: 'none' })
  },

  onCopyCode() {
    const code = this.data.room && this.data.room.code
    if (!code) return
    wx.setClipboardData({ data: code })
  },

  onSaveQr() {
    const fileID = this.data.invite.fileID
    const qrPath = this.data.invite.qrPath
    wx.showLoading({ title: '保存中', mask: true })
    const save = (filePath) => new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({ filePath, success: resolve, fail: reject })
    })
    const task = fileID
      ? wx.cloud.downloadFile({ fileID }).then(res => save(res.tempFilePath))
      : qrPath
        ? save(qrPath)
        : Promise.reject(new Error('无二维码'))
    task
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
      title: `加入「${room.name || '牌局'}」一起娱乐记分！`,
      path: `/pages/join/join?room=${this.data.roomCode}`
    }
  }
})
