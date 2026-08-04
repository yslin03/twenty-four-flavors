const config = require('../../config')

Component({
  properties: {
    show: { type: Boolean, value: false },
    player: { type: Object, value: null }
  },

  data: {
    presetPlus: config.PRESET_PLUS,
    presetMinus: config.PRESET_MINUS.map(v => -v),
    selected: 1,
    custom: '',
    customMode: false,
    delta: 1
  },

  observers: {
    player(player) {
      if (player) {
        this.setData({ selected: 1, custom: '', customMode: false, delta: 1 })
      }
    }
  },

  methods: {
    selectPreset(e) {
      const value = Number(e.currentTarget.dataset.value)
      this.setData({ selected: value, customMode: false, delta: value })
    },

    onCustomInput(e) {
      const raw = e.detail.value
      this.setData({ custom: raw, customMode: true })
      const n = parseInt(raw, 10)
      this.setData({ delta: isFinite(n) && n !== 0 ? n : 0 })
    },

    onToggleSign() {
      const next = -(this.data.delta || 1)
      this.setData({ delta: next, selected: null })
      if (this.data.customMode) {
        this.setData({ custom: String(next) })
      }
    },

    onConfirm() {
      const delta = this.data.delta
      if (!delta) {
        wx.showToast({ title: '请输入有效分值', icon: 'none' })
        return
      }
      if (Math.abs(delta) > config.CUSTOM_SCORE_LIMIT) {
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
