const config = require('../../config')

Component({
  properties: {
    show: { type: Boolean, value: false },
    player: { type: Object, value: null },
    rate: { type: Number, value: 1 }
  },

  data: {
    presetPlus: config.PRESET_PLUS,
    selected: 1,
    custom: '',
    customMode: false,
    delta: 1,
    effective: 1
  },

  observers: {
    player(player) {
      if (player) {
        this.setData({ selected: 1, custom: '', customMode: false, delta: 1 })
        this.syncEffective()
      }
    },
    rate() {
      this.syncEffective()
    }
  },

  methods: {
    syncEffective() {
      const delta = this.data.delta || 0
      const rate = this.data.rate || 1
      this.setData({ effective: Math.round(delta * rate) })
    },

    selectPreset(e) {
      const value = Number(e.currentTarget.dataset.value)
      this.setData({ selected: value, customMode: false, delta: value })
      this.syncEffective()
    },

    onCustomInput(e) {
      const raw = e.detail.value
      this.setData({ custom: raw, customMode: true })
      const n = parseInt(raw, 10)
      this.setData({ delta: isFinite(n) && n > 0 ? n : 0 })
      this.syncEffective()
    },

    onConfirm() {
      const delta = this.data.delta
      if (!delta || delta <= 0) {
        wx.showToast({ title: '请输入有效加分值', icon: 'none' })
        return
      }
      if (delta > config.CUSTOM_SCORE_LIMIT) {
        wx.showToast({ title: '分值过大', icon: 'none' })
        return
      }
      this.triggerEvent('confirm', { playerId: this.data.player.id, delta })
    },

    onClose() {
      this.triggerEvent('close')
    },

    noop() {}
  }
})
