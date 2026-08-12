const KEY = 'poker:themeMode'

function systemTheme() {
  try {
    return wx.getSystemInfoSync().theme === 'dark' ? 'dark' : 'light'
  } catch (e) {
    return 'light'
  }
}

function getMode() {
  const mode = wx.getStorageSync(KEY)
  return ['system', 'light', 'dark'].includes(mode) ? mode : 'system'
}

function resolve(mode = getMode()) {
  return mode === 'system' ? systemTheme() : mode
}

function setMode(mode) {
  const next = ['system', 'light', 'dark'].includes(mode) ? mode : 'system'
  wx.setStorageSync(KEY, next)
  applyNavigation(resolve(next))
  return { mode: next, theme: resolve(next) }
}

function applyNavigation(theme = resolve()) {
  wx.setNavigationBarColor({
    frontColor: theme === 'dark' ? '#ffffff' : '#000000',
    backgroundColor: theme === 'dark' ? '#111216' : '#f2f2f7',
    animation: { duration: 180, timingFunc: 'easeIn' }
  })
}

function pageThemeData() {
  const mode = getMode()
  const theme = resolve(mode)
  applyNavigation(theme)
  return { themeMode: mode, theme, darkMode: theme === 'dark' }
}

function nextMode(mode = getMode()) {
  return mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system'
}

module.exports = { getMode, resolve, setMode, applyNavigation, pageThemeData, nextMode }
