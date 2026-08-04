# 打牌记账 · 微信小程序

扑克类牌局（斗地主 / 掼蛋 / 德州等）记账工具：建房 → 扫码/转发/房间码入房 → 点击玩家头像加减分（实时同步）→ 结束结算（仅显示分数与名次，金额由玩家通过微信收付款/转账自行结算）。

## 技术方案

- 原生微信小程序（WXML / WXSS / JS），无额外构建链
- 数据层双实现（`miniprogram/utils/store.js`）：
  - **本地模式**（`USE_CLOUD=false`，默认）：数据存本机 `wx.setStorageSync`，测试号即可跑通全部 UI 流程
  - **云开发模式**（`USE_CLOUD=true`）：云数据库 + 云函数 + 云存储，多端实时同步
- 实时同步：客户端 `watch()` 监听房间文档，计分通过云函数事务原子更新

## 目录结构

```
poker-score-miniprogram/
├─ project.config.json          # AppID、miniprogramRoot、cloudfunctionRoot
├─ miniprogram/
│  ├─ config.js                 # 唯一需要改的配置（USE_CLOUD / CLOUD_ENV / QR_ENV_VERSION）
│  ├─ app.js / app.json / app.wxss
│  ├─ pages/
│  │  ├─ index/                 # 首页：创建房间、输入房间码加入、最近房间、快速演示
│  │  ├─ join/                  # 入房/建房：微信头像昵称填写、创建参数
│  │  ├─ room/                  # 房间主界面：玩家牌桌、计分面板、邀请、撤销、结束
│  │  └─ settle/                # 结算：名次表、复制结算文案、再来一局
│  ├─ components/
│  │  ├─ player-card/           # 玩家卡片（头像/昵称/分数/房主/我 标识）
│  │  └─ score-panel/           # 计分面板（预设 +/- 与自定义、加减切换）
│  └─ utils/
│     ├─ store.js               # 数据层：local / cloud 双实现
│     └─ room.js                # 房间码、scene 解析、结算文案等工具
└─ cloudfunctions/
   ├─ createRoom/               # 建房（支持再来一局复用玩家）
   ├─ joinRoom/                 # 入房（重复入房只更新资料）
   ├─ updateScore/              # 加减分（事务 + 历史）
   ├─ undoScore/                # 撤销上一笔（事务）
   ├─ endRoom/                  # 结束并写 settlements 快照
   └─ getRoomQrcode/            # 生成小程序码（scene=r=房间码）
```

## 一、本地模式跑通（测试号即可，无需服务器）

1. 打开[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)，「导入项目」
2. 目录选择本文件夹，AppID 选择「测试号」（或游客模式；本地模式不用云开发）
3. 确认 `miniprogram/config.js` 中 `USE_CLOUD: false`
4. 直接编译运行：
   - 首页点「快速演示」一键建房 + 3 个模拟玩家，体验计分/撤销/结算
   - 或点「创建房间」填写资料创建真实流程
   - 加入房间可输入其他玩家分享的房间码（同一台设备上以同一个人身份入房）

## 二、云开发模式（多端实时同步，需要正式 AppID）

1. 注册小程序：前往 [mp.weixin.qq.com](https://mp.weixin.qq.com) 注册（个人主体即可），拿到 AppID
2. 微信开发者工具中把 `project.config.json` 的 `appid` 换成正式 AppID
3. 工具栏点「云开发」开通并创建环境，复制环境 ID 填入 `miniprogram/config.js`：
   ```js
   USE_CLOUD: true,
   CLOUD_ENV: '你的环境ID'
   ```
4. 部署云函数：在 `cloudfunctions/` 下对每个目录右键 →「上传并部署：云端安装依赖」
5. 建集合：云开发控制台 → 数据库 → 创建 `rooms` 和 `settlements`
6. 设置 `rooms` 集合权限为「自定义安全规则」：
   ```json
   { "read": true, "write": false }
   ```
   （写操作全部走云函数，客户端只读 + watch 实时监听；`settlements` 保持默认权限即可）
7. 真机预览（需在开发者工具「详情 → 本地设置」勾选不校验合法域名，或添加云开发域名白名单）

### 小程序码说明

- `config.js` 的 `QR_ENV_VERSION` 控制扫码打开的版本：`release`（正式版）/ `trial`（体验版）/ `develop`（开发版）
- 调试阶段用 `trial` 配合体验版；正式发布后用 `release`
- 房间页「邀请」会自动生成小程序码（点击可保存到相册），也可转发卡片或复制房间码

## 使用流程

1. 房主「创建房间」设置房名与人数上限（2–8 人）
2. 房主在房间页「邀请」：分享小程序码 / 转发卡片 / 房间码
3. 好友扫码或输入房间码 → 填写微信头像昵称 → 加入房间
4. 任意玩家点击任一玩家头像 → 弹出计分面板（预设 +1/+5/+10、-1/-5/-10，可自定义、可切换加减）→ 确认计分，所有设备实时同步
5. 「撤销」回退最近一笔；「结束本局」进入结算页
6. 结算页显示名次与每人总分，「复制结算文案」后通过微信收付款/转账自行结算；「再来一局」复用玩家列表开新局

## 边界与限制

- 本地模式数据仅存本机，不跨设备同步；多端实时必须使用云开发模式
- 测试号不支持云开发、小程序码直达（需发布或体验版），期间以转发和房间码入房为主
- 「再来一局」生成新房间码，需要重新邀请好友
- 头像优先使用微信头像昵称填写能力（需基础库 ≥ 2.21.2），未授权时回退为「昵称首字」彩色头像
- 结算页「优化转账清单」按「1 分 = X 元」（默认 1，可实时调整）生成最少转账方案并一键复制，微信无法自动生成个人收款码，故由玩家按清单自行收付款/转账
- 后续版本可加：逐笔明细、云端对账
