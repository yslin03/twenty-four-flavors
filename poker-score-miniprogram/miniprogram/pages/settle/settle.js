const store = require('../../utils/store')
const roomUtil = require('../../utils/room')

function formatDate(value) {
  const d = new Date(Number(value) || Date.now())
  const pad = n => String(n).padStart(2, '0')
  return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

Page({
  data: {
    room: null,
    playerList: [],
    summary: '',
    statsList: [],
    historyModal: { show: false },
    historyList: []
  },

  async onLoad(options) {
    try { wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] }) } catch (e) { /* ignore */ }
    const code = roomUtil.decodeRoomCode(options)
    if (!code) {
      wx.navigateBack()
      return
    }
    wx.showLoading({ title: '加载记分结果', mask: true })
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
      rankText: `第${i + 1}名`
    }))
    const statsMap = {}
    store.getPlayerStats().forEach(s => { statsMap[s.id] = s })
    const statsList = playerList.map(p => {
      const s = statsMap[p.id] || { games: 0, wins: 0, losses: 0, total: 0, rate: 0 }
      return {
        id: p.id,
        nickname: p.nickname,
        games: s.games,
        wins: s.wins,
        losses: s.losses || 0,
        rate: s.rate,
        total: s.total
      }
    }).sort((a, b) => b.total - a.total)
      .map((item, i) => ({ ...item, rankText: '第' + (i + 1) + '名' }))
    this.setData({
      room,
      playerList,
      summary: roomUtil.buildSettlementText(room),
      statsList
    })
    store.saveRecentRoom(room)
  },

  onCopy() {
    if (!this.data.summary) return
    wx.setClipboardData({ data: this.data.summary })
  },

  onHistoryOpen() {
    const list = store.getSettlements().slice().reverse()
    const historyList = list.map(s => {
      const players = (s.players || []).slice().sort((a, b) => (s.finalScores[b.id] || 0) - (s.finalScores[a.id] || 0))
      return {
        roomId: s.roomId,
        roomName: s.roomName || '牌局',
        date: formatDate(s.finishedAt),
        players: players.map((p, i) => ({
          id: p.id,
          nickname: p.nickname || '玩家',
          rankText: '第' + (i + 1) + '名',
          score: s.finalScores[p.id] || 0
        }))
      }
    })
    this.setData({ historyModal: { show: true }, historyList })
  },

  onHistoryClose() {
    this.setData({ historyModal: { show: false } })
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
            avatar: roomUtil.playerAvatar(p),
            seat: Number.isInteger(p.seat) ? p.seat : -1
          }))
          const created = await store.createRoom({
            name: room.name,
            maxPlayers: room.maxPlayers,
            profile,
            players: seedPlayers
          })
          wx.hideLoading()
          if (store.isCloud()) {
            store.getRoomQrcode({ roomCode: created.room.code }).catch(() => { /* ignore */ })
          }
          wx.redirectTo({ url: `/pages/room/room?room=${created.room.code}&invite=1` })
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: (err && err.message) || '开新局失败', icon: 'none' })
        }
      }
    })
  },

  onHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  },

  onShareAppMessage() {
    return { title: '牌局记分 · 聚会娱乐记分结果', path: '/pages/index/index' }
  },

  onShareTimeline() {
    return { title: '牌局记分 · 聚会娱乐记分结果' }
  }
})
