// 全局配置：本地模式（测试号）与云开发模式（正式号）单点切换
module.exports = {
  // true 时启用微信云开发（需要正式 AppID + 云环境）；false 时使用本地存储模拟（测试号可用）
  USE_CLOUD: true,

  // 云开发环境 ID，接入正式号后填写（例如 'poker-score-xxxx'）
  CLOUD_ENV: 'cloud1-d9giz9x074a74d580',

  // 生成小程序码时打开的版本：'release' 正式版 / 'trial' 体验版 / 'develop' 开发版
  QR_ENV_VERSION: 'trial',

  // 房间默认人数上限
  DEFAULT_MAX_PLAYERS: 4,
  MAX_PLAYERS_MIN: 2,
  MAX_PLAYERS_MAX: 8,

  // 计分面板预设分值
  PRESET_PLUS: [1, 5, 10],
  PRESET_MINUS: [1, 5, 10],

  // 单次自定义分值上限
  CUSTOM_SCORE_LIMIT: 9999,

  // 历史记录上限（用于撤销）
  MAX_HISTORY: 100,

  // 房间码长度与字符集（去掉易混淆字符 0/O/1/I）
  ROOM_CODE_LENGTH: 6,
  ROOM_CODE_CHARSET: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
}
