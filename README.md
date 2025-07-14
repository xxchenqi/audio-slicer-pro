# 🎵 AudioSlicer Pro

一个功能强大、界面优雅的在线音频分割工具，提供两种不同的技术方案来满足各种音频处理需求。

## ✨ 项目简介

AudioSlicer Pro 是一个基于 Vue 3 + TypeScript 开发的现代化音频分割工具，支持在浏览器中直接处理音频文件，无需安装任何软件。项目提供了两种不同的音频处理引擎，让用户可以根据自己的需求选择最合适的方案。

## 🚀 核心功能

### 双引擎音频处理
- **Web Audio API 引擎**: 轻量级方案，实时波形显示
- **FFmpeg.wasm 引擎**: 专业级方案，支持更多格式，无损分割

### 主要特性
- 📊 **可视化分割**: 直观的波形图或时间轴界面
- 🎯 **精确控制**: 支持点击添加分割点，拖拽调整位置
- ▶️ **实时预览**: 音频播放功能，预览分割效果
- 💾 **批量导出**: 一键导出所有分割片段
- 🎨 **现代界面**: 响应式设计，支持移动端
- ⚡ **本地处理**: 全程在浏览器中处理，保护隐私

## 🛠️ 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| Vue.js | 3.5+ | 前端框架 |
| TypeScript | 5.8+ | 类型安全 |
| Vite | 7.0+ | 构建工具 |
| Vue Router | 4.5+ | 路由管理 |
| FFmpeg.wasm | 0.12+ | 音频处理引擎 |
| Web Audio API | - | 浏览器原生音频API |

## 📦 快速开始

### 环境要求
- Node.js 18+ 
- 现代浏览器 (支持 Web Audio API 和 WebAssembly)

### 安装步骤
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

### 项目结构
```
src/
├── components/          # 组件目录
│   ├── HomePage.vue        # 主页面
│   ├── WebAudioSplitter.vue # Web Audio 分割器
│   └── FFmpegSplitter.vue   # FFmpeg 分割器
├── router/             # 路由配置
├── assets/             # 静态资源
└── main.ts            # 入口文件
```

## 🎯 使用方法

### 1. 选择分割引擎
进入主页面，根据需求选择合适的音频分割引擎：

**Web Audio API 引擎** 适合：
- 轻量级音频处理需求
- 需要实时波形显示
- 对文件大小有要求的场景

**FFmpeg.wasm 引擎** 适合：
- 专业音频处理需求
- 支持更多音频格式
- 需要无损分割的场景

### 2. 上传音频文件
点击上传按钮或拖拽文件到指定区域，支持常见音频格式：
- MP3, WAV, FLAC, AAC, OGG 等

### 3. 设置分割点
- **Web Audio 版本**: 在波形图上点击添加分割点
- **FFmpeg 版本**: 在时间轴上点击添加分割点
- 长按分割点可以拖拽调整位置
- 双击分割点可以删除

### 4. 预览和导出
- 使用播放控件预览音频
- 点击"分割并下载"按钮导出所有片段
- 文件将自动命名并压缩下载

## 🔧 配置说明

### Vite 配置
项目已针对 FFmpeg.wasm 进行了优化配置：
```typescript
// vite.config.ts
export default {
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  }
}
```

### FFmpeg 核心文件
FFmpeg 核心文件已本地化，避免 CDN 依赖：
- `public/ffmpeg-core.js`
- `public/ffmpeg-core.wasm`

## 🌟 特色亮点

1. **双引擎架构**: 提供 Web Audio API 和 FFmpeg.wasm 两种方案
2. **可视化操作**: 直观的图形界面，所见即所得
3. **响应式设计**: 完美适配桌面端和移动端
4. **隐私保护**: 全程本地处理，文件不上传服务器
5. **零依赖运行**: 无需安装额外软件或插件
6. **现代化架构**: 基于最新的前端技术栈

## 🔍 浏览器兼容性

| 浏览器 | 最低版本 | 说明 |
|--------|----------|------|
| Chrome | 66+ | 推荐使用 |
| Firefox | 60+ | 完全支持 |
| Safari | 14+ | 基本支持 |
| Edge | 79+ | 完全支持 |

## 📄 开源协议

本项目采用 [MIT 协议](LICENSE) 开源，欢迎贡献代码。

## 🙏 致谢

感谢以下开源项目的支持：
- [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) - 强大的音频处理引擎
- [Vue.js](https://vuejs.org/) - 渐进式前端框架
- [Vite](https://vitejs.dev/) - 下一代前端构建工具

---
⭐ 如果这个项目对你有帮助，请给它一个 Star！
