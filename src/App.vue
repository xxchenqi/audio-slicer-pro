<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const navigateTo = (routeName: string) => {
  router.push({ name: routeName })
}
</script>

<template>
  <div class="app">
    <!-- <header class="app-header">
      <div class="header-content">
        <h1 class="app-title">🎵 音频分割工具集</h1>
        <p class="app-description">提供两种不同的音频分割方案，满足不同的使用需求</p>
        
        <nav class="nav-tabs">
          <button 
            @click="navigateTo('WebAudio')"
            :class="['nav-tab', { active: route.name === 'WebAudio' }]"
          >
            <span class="tab-icon">🌐</span>
            <span class="tab-title">Web Audio API</span>
            <span class="tab-subtitle">浏览器原生</span>
          </button>
          
          <button 
            @click="navigateTo('FFmpeg')"
            :class="['nav-tab', { active: route.name === 'FFmpeg' }]"
          >
            <span class="tab-icon">⚡</span>
            <span class="tab-title">FFmpeg</span>
            <span class="tab-subtitle">专业工具</span>
          </button>
        </nav>
      </div>
    </header>
     -->
    <main class="app-main">
      <router-view />
    </main>
<!--     
    <footer class="app-footer">
      <div class="footer-content">
        <div class="comparison-table">
          <h3>📊 功能对比</h3>
          <table>
            <thead>
              <tr>
                <th>特性</th>
                <th>Web Audio API</th>
                <th>FFmpeg</th>
              </tr>
            </thead>
            <tbody>
                          <tr>
              <td>界面显示</td>
              <td>✅ 真实波形</td>
              <td>⏰ 简洁时间轴</td>
            </tr>
              <tr>
                <td>支持格式</td>
                <td>🎵 常见格式</td>
                <td>🎼 所有格式</td>
              </tr>
              <tr>
                <td>输出格式</td>
                <td>📄 WAV</td>
                <td>🎯 保持原格式</td>
              </tr>
              <tr>
                <td>音质损失</td>
                <td>⚠️ 可能有损</td>
                <td>✅ 完全无损</td>
              </tr>
              <tr>
                <td>处理速度</td>
                <td>🚀 较快</td>
                <td>⚡ 极快</td>
              </tr>
              <tr>
                <td>加载时间</td>
                <td>⚡ 即时</td>
                <td>⏳ 首次较慢</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div class="usage-tips">
          <h3>💡 使用建议</h3>
          <div class="tips-grid">
            <div class="tip-card">
              <h4>🌐 Web Audio API 适用于：</h4>
              <ul>
                <li>🎯 需要精确波形显示</li>
                <li>⚡ 快速处理小文件</li>
                <li>🔧 简单的音频编辑</li>
                <li>📱 移动设备兼容</li>
              </ul>
            </div>
            
            <div class="tip-card">
              <h4>⚡ FFmpeg 适用于：</h4>
              <ul>
                <li>🎵 专业音频处理</li>
                <li>📁 批量文件处理</li>
                <li>🔒 保持原始质量</li>
                <li>🎼 支持所有格式</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer> -->
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.app-header {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding: 20px 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  text-align: center;
}

.app-title {
  color: white;
  font-size: 2.5em;
  font-weight: 700;
  margin: 0 0 10px 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.app-description {
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.1em;
  margin: 0 0 30px 0;
}

.nav-tabs {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 20px;
}

.nav-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 30px;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 160px;
}

.nav-tab:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
}

.nav-tab.active {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
}

.tab-icon {
  font-size: 2em;
  margin-bottom: 8px;
}

.tab-title {
  font-size: 1.2em;
  font-weight: 600;
  margin-bottom: 4px;
}

.tab-subtitle {
  font-size: 0.9em;
  opacity: 0.8;
}

.app-main {
  min-height: calc(100vh - 200px);
}

.app-footer {
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 40px 0;
  margin-top: 40px;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.comparison-table {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 30px;
  margin-bottom: 30px;
  backdrop-filter: blur(10px);
}

.comparison-table h3 {
  color: white;
  text-align: center;
  margin-bottom: 20px;
  font-size: 1.5em;
}

.comparison-table table {
  width: 100%;
  border-collapse: collapse;
  color: white;
}

.comparison-table th,
.comparison-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.comparison-table th {
  background: rgba(255, 255, 255, 0.1);
  font-weight: 600;
  font-size: 1.1em;
}

.comparison-table td:first-child {
  font-weight: 500;
}

.usage-tips {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 30px;
  backdrop-filter: blur(10px);
}

.usage-tips h3 {
  color: white;
  text-align: center;
  margin-bottom: 25px;
  font-size: 1.5em;
}

.tips-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.tip-card {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.tip-card h4 {
  color: white;
  margin-bottom: 15px;
  font-size: 1.1em;
}

.tip-card ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.tip-card li {
  color: rgba(255, 255, 255, 0.9);
  padding: 6px 0;
  font-size: 0.95em;
}

@media (max-width: 768px) {
  .app-title {
    font-size: 2em;
  }
  
  .nav-tabs {
    flex-direction: column;
    align-items: center;
  }
  
  .nav-tab {
    min-width: 200px;
  }
  
  .comparison-table {
    overflow-x: auto;
  }
  
  .comparison-table table {
    min-width: 500px;
  }
  
  .tips-grid {
    grid-template-columns: 1fr;
  }
  
  .header-content,
  .footer-content {
    padding: 0 15px;
  }
}

@media (max-width: 480px) {
  .app-title {
    font-size: 1.8em;
  }
  
  .nav-tab {
    padding: 15px 20px;
    min-width: 150px;
  }
  
  .tab-title {
    font-size: 1em;
  }
  
  .comparison-table,
  .usage-tips {
    padding: 20px;
  }
}
</style>
