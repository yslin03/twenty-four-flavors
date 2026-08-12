// 语音播报：基于百度翻译免费 TTS（需网络）。
// 真机使用需在小程序后台把 fanyi.baidu.com 加入 downloadFile 合法域名，或调试时勾选「不校验合法域名」。
const KEY = 'poker:voice'

function isEnabled() {
  try { return wx.getStorageSync(KEY) !== false } catch (e) { return true }
}

function setEnabled(on) {
  try { wx.setStorageSync(KEY, !!on) } catch (e) { /* ignore */ }
}

let audio = null

function speak(text) {
  if (!isEnabled() || !text) return
  try {
    if (!audio) audio = wx.createInnerAudioContext()
    audio.stop()
    audio.src = 'https://fanyi.baidu.com/gettts?lan=zh&text=' + encodeURIComponent(text) + '&spd=5&source=web'
    audio.play()
  } catch (e) { /* 语音不可用时静默 */ }
}

module.exports = { isEnabled, setEnabled, speak }
