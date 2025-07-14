<template>
  <div class="home-container">
    <div class="hero-section">
      <h1 class="title">🎵 音频分割工具</h1>
      <p class="subtitle">选择你喜欢的音频分割方式</p>
      
      <div class="tool-cards">
        <div class="tool-card" @click="goToAudio">
          <div class="card-icon">🌊</div>
          <h3 class="card-title">Web Audio API</h3>
          <p class="card-description">
            使用浏览器原生音频API<br>
            显示真实音频波形<br>
            适合实时预览
          </p>
          <div class="card-features">
            <span class="feature-tag">真实波形</span>
            <span class="feature-tag">实时处理</span>
            <span class="feature-tag">轻量级</span>
          </div>
          <button class="card-button">开始使用</button>
        </div>

        <div class="tool-card" @click="goToFFmpeg">
          <div class="card-icon">⚡</div>
          <h3 class="card-title">FFmpeg.wasm</h3>
          <p class="card-description">
            强大的音频处理引擎<br>
            精确的时间轴界面<br>
            支持多种格式
          </p>
          <div class="card-features">
            <span class="feature-tag">时间轴</span>
            <span class="feature-tag">高精度</span>
            <span class="feature-tag">多格式</span>
          </div>
          <button class="card-button">开始使用</button>
        </div>
      </div>

      <div class="comparison-table">
        <h3>功能对比</h3>
        <table>
          <thead>
            <tr>
              <th>特性</th>
              <th>Web Audio API</th>
              <th>FFmpeg.wasm</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>界面显示</td>
              <td>真实波形图</td>
              <td>时间轴</td>
            </tr>
            <tr>
              <td>文件支持</td>
              <td>MP3, WAV, OGG等</td>
              <td>更多格式支持</td>
            </tr>
            <tr>
              <td>处理速度</td>
              <td>快速</td>
              <td>中等</td>
            </tr>
            <tr>
              <td>精确度</td>
              <td>高</td>
              <td>非常高</td>
            </tr>
            <tr>
              <td>文件大小</td>
              <td>轻量</td>
              <td>较大(需要FFmpeg核心)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goToAudio = () => {
  router.push('/audio')
}

const goToFFmpeg = () => {
  router.push('/ffmpeg')
}
</script>

<style scoped>
.home-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.hero-section {
  max-width: 1200px;
  width: 100%;
  text-align: center;
}

.title {
  font-size: 3.5rem;
  font-weight: 700;
  color: white;
  margin-bottom: 1rem;
  text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.subtitle {
  font-size: 1.3rem;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 3rem;
  font-weight: 300;
}

.tool-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
  margin-bottom: 4rem;
}

.tool-card {
  background: white;
  border-radius: 20px;
  padding: 2.5rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.tool-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #667eea, #764ba2);
}

.tool-card:hover {
  transform: translateY(-10px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.card-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.card-title {
  font-size: 1.8rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 1rem;
}

.card-description {
  color: #666;
  line-height: 1.6;
  margin-bottom: 1.5rem;
  font-size: 1rem;
}

.card-features {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
  margin-bottom: 2rem;
}

.feature-tag {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 0.3rem 0.8rem;
  border-radius: 15px;
  font-size: 0.8rem;
  font-weight: 500;
}

.card-button {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  padding: 0.8rem 2rem;
  border-radius: 25px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  width: 100%;
}

.card-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}

.comparison-table {
  background: white;
  border-radius: 15px;
  padding: 2rem;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
  margin-top: 2rem;
}

.comparison-table h3 {
  color: #333;
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
  font-weight: 600;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

th, td {
  padding: 0.8rem;
  border-bottom: 1px solid #eee;
}

th {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  font-weight: 600;
}

td {
  color: #555;
}

tr:hover {
  background: #f8f9fa;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .title {
    font-size: 2.5rem;
  }
  
  .subtitle {
    font-size: 1.1rem;
  }
  
  .tool-cards {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  
  .tool-card {
    padding: 2rem;
  }
  
  .comparison-table {
    padding: 1.5rem;
    overflow-x: auto;
  }
  
  table {
    font-size: 0.9rem;
  }
}

@media (max-width: 480px) {
  .home-container {
    padding: 10px;
  }
  
  .title {
    font-size: 2rem;
  }
  
  .tool-card {
    padding: 1.5rem;
  }
}
</style> 