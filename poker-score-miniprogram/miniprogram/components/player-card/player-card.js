Component({
  properties: {
    player: { type: Object, value: null },
    myId: { type: String, value: '' },
    hostOpenId: { type: String, value: '' }
  },

  data: {
    avatarFailed: false
  },

  observers: {
    player() {
      this.setData({ avatarFailed: false })
    }
  },

  methods: {
    onTap() {
      this.triggerEvent('tap')
    },
    onAvatarError() {
      this.setData({ avatarFailed: true })
    }
  }
})
