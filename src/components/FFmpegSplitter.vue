<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'

// 定义分割点数据结构
interface SplitPoint {
  id: number    // 分割点唯一标识
  time: number  // 分割点在音频中的时间位置（秒）
  x: number     // 分割点在时间轴上的像素位置
}

// 定义音频片段数据结构
interface AudioSegment {
  id: number      // 片段唯一标识
  start: number   // 片段开始时间（秒）
  end: number     // 片段结束时间（秒）
  name: string    // 片段文件名
}

// === 路由实例 ===
const router = useRouter()

// === 响应式数据定义 ===
const audioFile = ref<File | null>(null)                    // 用户选择的音频文件
const audioUrl = ref<string>('')                            // 音频文件的URL
const audioElement = ref<HTMLAudioElement | null>(null)     // HTML audio元素引用
const timelineRef = ref<HTMLDivElement | null>(null)        // 时间轴元素引用
const timelineContainer = ref<HTMLElement | null>(null)     // 时间轴容器元素引用
const isPlaying = ref(false)                                // 音频播放状态
const currentTime = ref(0)                                  // 当前播放时间
const duration = ref(0)                                     // 音频总时长
const splitPoints = ref<SplitPoint[]>([])                   // 分割点数组
const audioSegments = ref<AudioSegment[]>([])               // 音频片段数组
const isLoading = ref(false)                                // 加载状态
const isProcessing = ref(false)                             // FFmpeg处理状态
const processingProgress = ref(0)                           // 处理进度
const processingMessage = ref('')                           // 处理消息

// === FFmpeg 相关 ===
const ffmpegLoaded = ref(false)                             // FFmpeg是否已加载
const ffmpegInstance = ref<any>(null)                       // FFmpeg实例

// === 交互状态管理 ===
const hoveredSplitPoint = ref<SplitPoint | null>(null)     // 当前悬停的分割点
const mouseX = ref(0)                                       // 鼠标X坐标
const showTimeTooltip = ref(false)                          // 是否显示时间提示
const isDragging = ref(false)                               // 是否正在拖拽
const draggedSplitPoint = ref<SplitPoint | null>(null)     // 正在拖拽的分割点
const longPressTimer = ref<NodeJS.Timeout | null>(null)    // 长按计时器
const longPressStarted = ref(false)                         // 是否开始长按

// ID生成器
let nextSplitId = 1      // 下一个分割点ID
let nextSegmentId = 1    // 下一个片段ID

/**
 * 初始化FFmpeg
 * 动态加载FFmpeg.wasm库
 */
const initFFmpeg = async () => {
  try {
    isLoading.value = true
    processingMessage.value = '正在加载FFmpeg...'
    
    // 动态导入FFmpeg
    const { FFmpeg } = await import('@ffmpeg/ffmpeg')
    const { toBlobURL } = await import('@ffmpeg/util')
    
    ffmpegInstance.value = new FFmpeg()
    
    // 加载FFmpeg核心文件
    const baseURL = window.location.origin // 例如：http://localhost:5173
    // const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
    await ffmpegInstance.value.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    
    ffmpegLoaded.value = true
    processingMessage.value = 'FFmpeg加载完成'
    
    setTimeout(() => {
      processingMessage.value = ''
    }, 2000)
    
  } catch (error) {
    console.error('FFmpeg初始化失败:', error)
    processingMessage.value = 'FFmpeg加载失败，请刷新页面重试'
  } finally {
    isLoading.value = false
  }
}

/**
 * 处理用户选择的音频文件
 */
const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (file && file.type.startsWith('audio/')) {
    audioFile.value = file
    audioUrl.value = URL.createObjectURL(file)
    splitPoints.value = []
    audioSegments.value = []
    
    await nextTick()
    if (audioElement.value) {
      audioElement.value.load()
    }
  }
}

// === 鼠标交互处理 ===

const onMouseDown = (event: MouseEvent) => {
  if (!timelineRef.value) return
  
  const rect = timelineRef.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const clampedX = Math.max(0, Math.min(x, timelineRef.value.clientWidth))
  
  const tolerance = 15
  const clickedPoint = splitPoints.value.find(point => 
    Math.abs(point.x - clampedX) < tolerance
  )
  
  if (clickedPoint) {
    longPressStarted.value = false
    
    longPressTimer.value = setTimeout(() => {
      longPressStarted.value = true
      isDragging.value = true
      draggedSplitPoint.value = clickedPoint
      
      if (timelineRef.value) {
        timelineRef.value.style.cursor = 'grabbing'
      }
    }, 500)
  }
}

const onMouseMove = (event: MouseEvent) => {
  if (!timelineRef.value) return
  
  const rect = timelineRef.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  
  mouseX.value = Math.max(0, Math.min(x, timelineRef.value.clientWidth))
  
  if (isDragging.value && draggedSplitPoint.value) {
    const clampedX = Math.max(0, Math.min(x, timelineRef.value.clientWidth))
    const newTime = getTimeFromX(clampedX)
    
    const pointIndex = splitPoints.value.findIndex(p => p.id === draggedSplitPoint.value!.id)
    if (pointIndex !== -1) {
      // 直接使用鼠标位置，避免精度损失
      splitPoints.value[pointIndex] = {
        ...splitPoints.value[pointIndex],
        time: newTime,
        x: clampedX // 直接使用鼠标位置
      }
      
      splitPoints.value.sort((a, b) => a.time - b.time)
      updateSegments()
    }
    return
  }
  
  const tolerance = 15
  const hoveredPoint = splitPoints.value.find(point => 
    Math.abs(point.x - mouseX.value) < tolerance
  )
  
  hoveredSplitPoint.value = hoveredPoint || null
  
  if (hoveredPoint) {
    if (timelineRef.value) {
      timelineRef.value.style.cursor = 'grab'
    }
    showTimeTooltip.value = false
  } else {
    if (timelineRef.value) {
      timelineRef.value.style.cursor = 'crosshair'
    }
    if (duration.value > 0) {
      showTimeTooltip.value = true
    }
  }
}

const onMouseUp = (event: MouseEvent) => {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
  
  if (isDragging.value) {
    isDragging.value = false
    draggedSplitPoint.value = null
    
    if (timelineRef.value) {
      timelineRef.value.style.cursor = 'crosshair'
    }
    
    return
  }
  
  if (!longPressStarted.value) {
    onTimelineClick(event)
  }
  
  longPressStarted.value = false
}

const onMouseLeave = () => {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
  
  if (isDragging.value) {
    isDragging.value = false
    draggedSplitPoint.value = null
  }
  
  hoveredSplitPoint.value = null
  showTimeTooltip.value = false
  longPressStarted.value = false
  
  if (timelineRef.value) {
    timelineRef.value.style.cursor = 'crosshair'
  }
}

/**
 * 坐标转换：将像素位置转换为时间
 */
const getTimeFromX = (x: number): number => {
  if (!timelineRef.value || duration.value === 0) return 0
  return (x / timelineRef.value.clientWidth) * duration.value
}

/**
 * 坐标转换：将时间转换为像素位置
 */
const getXFromTime = (time: number): number => {
  if (!timelineRef.value || duration.value === 0) return 0
  return (time / duration.value) * timelineRef.value.clientWidth
}

// === 音频播放控制 ===

const togglePlay = () => {
  if (!audioElement.value) return
  
  if (isPlaying.value) {
    audioElement.value.pause()
  } else {
    audioElement.value.play()
  }
}

const onTimeUpdate = () => {
  if (audioElement.value) {
    currentTime.value = audioElement.value.currentTime
  }
}

const onLoadedMetadata = () => {
  if (audioElement.value) {
    duration.value = audioElement.value.duration
    updateSegments()
  }
}

const onPlayStateChange = () => {
  if (audioElement.value) {
    isPlaying.value = !audioElement.value.paused
  }
}

// === 分割点管理 ===

const onTimelineClick = (event: MouseEvent) => {
  if (!timelineRef.value || duration.value === 0) return
  
  const rect = timelineRef.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  
  const clampedX = Math.max(0, Math.min(x, timelineRef.value.clientWidth))
  const time = getTimeFromX(clampedX)
  
  const tolerance = 15
  const existingPoint = splitPoints.value.find(point => Math.abs(point.x - clampedX) < tolerance)
  
  if (existingPoint) {
    // 删除现有分割点
    splitPoints.value = splitPoints.value.filter(point => point.id !== existingPoint.id)
  } else {
    // 添加新分割点
    const newPoint: SplitPoint = {
      id: nextSplitId++,
      time: time,
      x: clampedX // 直接使用点击位置
    }
    splitPoints.value.push(newPoint)
    splitPoints.value.sort((a, b) => a.time - b.time)
  }
  
  updateSegments()
}

/**
 * 更新音频片段列表
 */
const updateSegments = () => {
  if (duration.value === 0) return
  
  const segments: AudioSegment[] = []
  const sortedPoints = [...splitPoints.value].sort((a, b) => a.time - b.time)
  
  if (sortedPoints.length === 0) {
    // 没有分割点，整个音频作为一个片段
    segments.push({
      id: nextSegmentId++,
      start: 0,
      end: duration.value,
      name: `segment_1.${getFileExtension()}`
    })
  } else {
    // 第一个片段：从开始到第一个分割点
    segments.push({
      id: nextSegmentId++,
      start: 0,
      end: sortedPoints[0].time,
      name: `segment_1.${getFileExtension()}`
    })
    
    // 中间片段：从一个分割点到下一个分割点
    for (let i = 0; i < sortedPoints.length - 1; i++) {
      segments.push({
        id: nextSegmentId++,
        start: sortedPoints[i].time,
        end: sortedPoints[i + 1].time,
        name: `segment_${i + 2}.${getFileExtension()}`
      })
    }
    
    // 最后一个片段：从最后一个分割点到结束
    segments.push({
      id: nextSegmentId++,
      start: sortedPoints[sortedPoints.length - 1].time,
      end: duration.value,
      name: `segment_${sortedPoints.length + 1}.${getFileExtension()}`
    })
  }
  
  audioSegments.value = segments
}

/**
 * 获取文件扩展名
 */
const getFileExtension = (): string => {
  if (!audioFile.value) return 'mp3'
  const fileName = audioFile.value.name
  const lastDotIndex = fileName.lastIndexOf('.')
  return lastDotIndex > -1 ? fileName.substring(lastDotIndex + 1) : 'mp3'
}

/**
 * 清除所有分割点
 */
const clearSplitPoints = () => {
  splitPoints.value = []
  audioSegments.value = []
  updateSegments()
}

/**
 * 返回主页
 */
const goHome = () => {
  router.push('/')
}

/**
 * 跳转到指定时间
 */
const seekTo = (time: number) => {
  if (audioElement.value) {
    audioElement.value.currentTime = time
  }
}

/**
 * 格式化时间显示
 */
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * 使用FFmpeg生成音频片段
 */
const generateSegmentsWithFFmpeg = async () => {
  if (!audioFile.value || !ffmpegInstance.value || audioSegments.value.length === 0) return
  
  try {
    isProcessing.value = true
    processingProgress.value = 0
    
    // 将音频文件写入FFmpeg虚拟文件系统
    const inputFileName = `input.${getFileExtension()}`
    const audioData = new Uint8Array(await audioFile.value.arrayBuffer())
    await ffmpegInstance.value.writeFile(inputFileName, audioData)
    
    // 逐个处理每个片段
    for (let i = 0; i < audioSegments.value.length; i++) {
      const segment = audioSegments.value[i]
      
      processingMessage.value = `正在处理片段 ${i + 1}/${audioSegments.value.length}: ${segment.name}`
      
      // 使用FFmpeg进行无损分割
      // -ss: 开始时间, -t: 持续时间, -c copy: 复制流不重新编码
      const duration = segment.end - segment.start
      await ffmpegInstance.value.exec([
        '-i', inputFileName,
        '-ss', segment.start.toString(),
        '-t', duration.toString(),
        '-c', 'copy',
        segment.name
      ])
      
      // 读取生成的文件
      const outputData = await ffmpegInstance.value.readFile(segment.name)
      
      // 创建下载链接
      const blob = new Blob([outputData], { type: `audio/${getFileExtension()}` })
      const url = URL.createObjectURL(blob)
      
      // 自动下载
      const a = document.createElement('a')
      a.href = url
      a.download = segment.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      // 更新进度
      processingProgress.value = Math.round(((i + 1) / audioSegments.value.length) * 100)
      
      // 清理FFmpeg文件系统中的输出文件
      try {
        await ffmpegInstance.value.deleteFile(segment.name)
      } catch (e) {
        // 忽略删除文件的错误
      }
    }
    
    processingMessage.value = '所有片段处理完成！'
    
    // 清理输入文件
    try {
      await ffmpegInstance.value.deleteFile(inputFileName)
    } catch (e) {
      // 忽略删除文件的错误
    }
    
    setTimeout(() => {
      processingMessage.value = ''
      processingProgress.value = 0
    }, 3000)
    
  } catch (error) {
    console.error('FFmpeg处理失败:', error)
    processingMessage.value = 'FFmpeg处理失败，请重试'
  } finally {
    isProcessing.value = false
  }
}

// === 生命周期钩子 ===

onMounted(() => {
  initFFmpeg()
})
</script>

<template>
  <div class="ffmpeg-splitter">
    <div class="header">
      <button class="back-button" @click="goHome">
        ← 返回主页
      </button>
      <h1>⚡ FFmpeg 音频分割器</h1>
      <p>基于 FFmpeg.wasm 的无损音频分割工具</p>
    </div>
    
    <!-- FFmpeg 加载状态 -->
    <div v-if="isLoading" class="ffmpeg-loading">
      <div class="loading-spinner"></div>
      <h3>正在加载 FFmpeg...</h3>
      <p>{{ processingMessage }}</p>
      <div class="loading-tip">
        <p>💡 首次加载需要下载约 31MB 的 FFmpeg 核心文件</p>
        <p>⏳ 请耐心等待，后续使用将会更快</p>
      </div>
    </div>
    
    <!-- 主界面 -->
    <div v-else class="main-content">
      <div class="upload-section">
        <input
          type="file"
          accept="audio/*"
          @change="handleFileSelect"
          class="file-input"
          id="audioFile"
        />
        <label for="audioFile" class="file-label">
          <span class="upload-icon">📁</span>
          选择音频文件
        </label>
      </div>
      
      <div v-if="audioFile" class="audio-section">
        <audio
          ref="audioElement"
          :src="audioUrl"
          @timeupdate="onTimeUpdate"
          @loadedmetadata="onLoadedMetadata"
          @play="onPlayStateChange"
          @pause="onPlayStateChange"
          preload="metadata"
        ></audio>
        
        <div class="controls">
          <button @click="togglePlay" class="play-button">
            <span class="button-icon">{{ isPlaying ? '⏸️' : '▶️' }}</span>
            {{ isPlaying ? '暂停' : '播放' }}
          </button>
          <div class="time-info">
            <span class="current-time">{{ formatTime(currentTime) }}</span>
            <span class="separator">/</span>
            <span class="total-time">{{ formatTime(duration) }}</span>
          </div>
        </div>
        
        <div class="timeline-section" ref="timelineContainer">
          <div class="timeline-header">
            <h3>⏰ 时间轴编辑器</h3>
            <div class="timeline-controls">
              <div class="split-count">
                分割点: {{ splitPoints.length }}
              </div>
              <button @click="clearSplitPoints" class="clear-button">
                🗑️ 清除所有
              </button>
            </div>
          </div>
          
          <div class="timeline-instructions">
            <span class="instruction-item">👆 点击时间轴添加分割点</span>
            <span class="instruction-item">🎯 再次点击删除分割点</span>
            <span class="instruction-item">✋ 长按分割点拖拽调整位置</span>
          </div>
          
          <div class="timeline-container">
            <div
              ref="timelineRef"
              @mousedown="onMouseDown"
              @mousemove="onMouseMove"
              @mouseup="onMouseUp"
              @mouseleave="onMouseLeave"
              class="timeline"
            >
              <!-- 时间轴背景 -->
              <div class="timeline-background"></div>
              
              <!-- 播放进度 -->
              <div 
                v-if="duration > 0"
                class="play-progress"
                :style="{ left: (currentTime / duration * 100) + '%' }"
              ></div>
              
              <!-- 分割点 -->
              <div
                v-for="point in splitPoints"
                :key="point.id"
                class="split-point"
                :class="{
                  'split-point-hovered': hoveredSplitPoint?.id === point.id,
                  'split-point-dragging': draggedSplitPoint?.id === point.id
                }"
                :style="{ left: point.x + 'px' }"
              >
                <div class="split-line"></div>
                <div class="split-marker"></div>
                <div class="split-time">{{ formatTime(point.time) }}</div>
              </div>
              
              <!-- 时间提示 -->
              <div
                v-if="showTimeTooltip && !hoveredSplitPoint"
                class="time-tooltip"
                :style="{ left: mouseX + 'px' }"
              >
                {{ formatTime(getTimeFromX(mouseX)) }}
              </div>
              
              <!-- 拖拽提示 -->
              <div
                v-if="isDragging && draggedSplitPoint"
                class="drag-tooltip"
                :style="{ left: mouseX + 'px' }"
              >
                <div class="drag-tooltip-content">
                  <div class="drag-icon">🎯</div>
                  <div class="drag-text">拖拽调整位置</div>
                  <div class="drag-time">{{ formatTime(draggedSplitPoint.time) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div v-if="audioSegments.length > 0" class="segments-section">
          <h3>📋 音频片段列表 ({{ audioSegments.length }}个)</h3>
          <div class="segments-grid">
            <div
              v-for="(segment, index) in audioSegments"
              :key="segment.id"
              class="segment-card"
              :class="{ 'segment-active': currentTime >= segment.start && currentTime <= segment.end }"
            >
              <div class="segment-header">
                <span class="segment-number">{{ index + 1 }}</span>
                <span class="segment-name">{{ segment.name }}</span>
              </div>
              <div class="segment-info">
                <div class="segment-time">
                  <span class="time-label">开始:</span>
                  <span class="time-value">{{ formatTime(segment.start) }}</span>
                </div>
                <div class="segment-time">
                  <span class="time-label">结束:</span>
                  <span class="time-value">{{ formatTime(segment.end) }}</span>
                </div>
                <div class="segment-duration">
                  <span class="duration-label">时长:</span>
                  <span class="duration-value">{{ formatTime(segment.end - segment.start) }}</span>
                </div>
              </div>
              <button
                @click="seekTo(segment.start)"
                class="preview-button"
              >
                🎧 预览
              </button>
            </div>
          </div>
          
          <div class="generate-section">
            <div class="ffmpeg-info">
              <h4>⚡ FFmpeg 优势</h4>
              <ul>
                <li>🎯 <strong>无损分割</strong>：直接复制音频流，不重新编码</li>
                <li>🚀 <strong>速度更快</strong>：避免解码/编码过程</li>
                <li>🎵 <strong>保持原格式</strong>：输出与输入格式相同</li>
                <li>📊 <strong>保持质量</strong>：100%保持原始音频质量</li>
              </ul>
            </div>
            
            <!-- 处理进度 -->
            <div v-if="isProcessing" class="processing-status">
              <div class="progress-bar">
                <div 
                  class="progress-fill" 
                  :style="{ width: processingProgress + '%' }"
                ></div>
              </div>
              <p class="processing-message">{{ processingMessage }}</p>
              <p class="processing-progress">{{ processingProgress }}%</p>
            </div>
            
            <div class="generate-info">
              <p>将生成 <strong>{{ audioSegments.length }}</strong> 个与原文件相同格式的音频文件</p>
            </div>
            
            <button
              @click="generateSegmentsWithFFmpeg"
              :disabled="isProcessing || !ffmpegLoaded"
              class="generate-button"
            >
              <span class="button-icon">{{ isProcessing ? '⏳' : '⚡' }}</span>
              {{ isProcessing ? '处理中...' : 'FFmpeg 生成并下载所有片段' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ffmpeg-splitter {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

.header {
  text-align: center;
  margin-bottom: 30px;
  color: white;
  position: relative;
}

.back-button {
  position: absolute;
  left: 0;
  top: 0;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 0.6rem 1.2rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.back-button:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.header h1 {
  margin-bottom: 10px;
  font-size: 2.5em;
  font-weight: 700;
}

.header p {
  font-size: 16px;
  opacity: 0.9;
}

.ffmpeg-loading {
  text-align: center;
  padding: 60px 20px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.loading-spinner {
  width: 60px;
  height: 60px;
  border: 6px solid #f3f3f3;
  border-top: 6px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

.loading-tip {
  margin-top: 20px;
  color: #666;
}

.main-content {
  background: white;
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.upload-section {
  text-align: center;
  margin-bottom: 30px;
}

.file-input {
  display: none;
}

.file-label {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 15px 30px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border-radius: 12px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.file-label:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
}

.upload-icon {
  font-size: 20px;
}

.audio-section {
  margin-top: 30px;
}

.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-bottom: 30px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 12px;
}

.play-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #2ecc71, #27ae60);
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.play-button:hover {
  background: linear-gradient(135deg, #27ae60, #229954);
  transform: translateY(-1px);
}

.button-icon {
  font-size: 18px;
}

.time-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Courier New', monospace;
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
}

.separator {
  color: #7f8c8d;
}

.timeline-section {
  margin-bottom: 30px;
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.timeline-header h3 {
  color: #2c3e50;
  margin: 0;
  font-size: 1.3em;
}

.timeline-controls {
  display: flex;
  align-items: center;
  gap: 15px;
}

.split-count {
  font-size: 14px;
  color: #7f8c8d;
  font-weight: 600;
}

.clear-button {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 15px;
  background: linear-gradient(135deg, #e74c3c, #c0392b);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.clear-button:hover {
  background: linear-gradient(135deg, #c0392b, #a93226);
  transform: translateY(-1px);
}

.timeline-instructions {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 20px;
  padding: 15px;
  background: white;
  border-radius: 8px;
  border: 2px solid #ecf0f1;
}

.instruction-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #34495e;
  font-weight: 500;
}

.timeline-container {
  position: relative;
  margin-bottom: 20px;
}

.timeline {
  position: relative;
  height: 80px;
  background: white;
  border-radius: 8px;
  border: 2px solid #ecf0f1;
  cursor: crosshair;
  overflow: hidden;
}

.timeline-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to right, #ecf0f1 0%, #d5dbdb 50%, #ecf0f1 100%);
}

.play-progress {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #2ecc71;
  z-index: 5;
  transform: translateX(-50%);
}

.play-progress::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 12px;
  height: 12px;
  background: #2ecc71;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  border: 2px solid white;
}

.split-point {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 10;
  transform: translateX(-50%);
}

.split-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #e74c3c;
  left: 50%;
  transform: translateX(-50%);
  transition: all 0.3s ease;
}

.split-marker {
  position: absolute;
  top: 15px;
  left: 50%;
  width: 12px;
  height: 12px;
  background: #e74c3c;
  border-radius: 50%;
  transform: translateX(-50%);
  border: 2px solid white;
  transition: all 0.3s ease;
}

.split-time {
  position: absolute;
  top: -25px;
  left: 50%;
  transform: translateX(-50%);
  background: #e74c3c;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-family: 'Courier New', monospace;
  font-weight: 600;
  white-space: nowrap;
  transition: all 0.3s ease;
}

.split-point-hovered .split-line {
  background: #c0392b;
  width: 4px;
}

.split-point-hovered .split-marker {
  background: #c0392b;
  width: 14px;
  height: 14px;
}

.split-point-hovered .split-time {
  background: #c0392b;
}

.split-point-dragging .split-line {
  background: #8e44ad;
  width: 5px;
}

.split-point-dragging .split-marker {
  background: #8e44ad;
  width: 16px;
  height: 16px;
}

.split-point-dragging .split-time {
  background: #8e44ad;
}

.time-tooltip {
  position: absolute;
  top: -40px;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-family: 'Courier New', monospace;
  pointer-events: none;
  z-index: 10;
  white-space: nowrap;
}

.time-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.8);
}

.drag-tooltip {
  position: absolute;
  top: -80px;
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 20;
  animation: dragPulse 1s ease-in-out infinite;
}

.drag-tooltip-content {
  background: linear-gradient(135deg, #8e44ad, #9b59b6);
  color: white;
  padding: 10px 15px;
  border-radius: 10px;
  text-align: center;
  box-shadow: 0 4px 15px rgba(142, 68, 173, 0.4);
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.drag-icon {
  font-size: 20px;
  margin-bottom: 5px;
}

.drag-text {
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 3px;
}

.drag-time {
  font-family: 'Courier New', monospace;
  font-size: 14px;
  font-weight: 600;
}

.drag-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 8px solid transparent;
  border-top-color: #8e44ad;
}

@keyframes dragPulse {
  0%, 100% { transform: translateX(-50%) scale(1); }
  50% { transform: translateX(-50%) scale(1.05); }
}

.segments-section {
  margin-top: 25px;
  background: white;
  border-radius: 12px;
  padding: 20px;
}

.segments-section h3 {
  color: #2c3e50;
  margin-bottom: 20px;
  font-size: 1.3em;
}

.segments-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 15px;
  margin-bottom: 25px;
}

.segment-card {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  border: 2px solid #ecf0f1;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.segment-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  transform: scaleX(0);
  transition: transform 0.3s ease;
}

.segment-card:hover::before,
.segment-active::before {
  transform: scaleX(1);
}

.segment-card:hover {
  border-color: #667eea;
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.2);
}

.segment-active {
  border-color: #2ecc71;
  background: #f0f8f0;
}

.segment-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
}

.segment-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: #667eea;
  color: white;
  border-radius: 50%;
  font-weight: 600;
  font-size: 14px;
}

.segment-name {
  font-weight: 600;
  color: #2c3e50;
  font-size: 14px;
}

.segment-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 15px;
}

.segment-time,
.segment-duration {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.time-label,
.duration-label {
  font-size: 12px;
  color: #7f8c8d;
  font-weight: 500;
}

.time-value,
.duration-value {
  font-family: 'Courier New', monospace;
  font-size: 14px;
  color: #2c3e50;
  font-weight: 600;
}

.preview-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  background: linear-gradient(135deg, #2ecc71, #27ae60);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.preview-button:hover {
  background: linear-gradient(135deg, #27ae60, #229954);
  transform: translateY(-1px);
}

.generate-section {
  text-align: center;
  padding: 25px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
}

.ffmpeg-info {
  margin-bottom: 20px;
  text-align: left;
}

.ffmpeg-info h4 {
  margin-bottom: 15px;
  font-size: 1.2em;
}

.ffmpeg-info ul {
  list-style: none;
  padding: 0;
}

.ffmpeg-info li {
  padding: 8px 0;
  font-size: 14px;
}

.processing-status {
  margin: 20px 0;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-fill {
  height: 100%;
  background: #2ecc71;
  transition: width 0.3s ease;
}

.processing-message {
  margin: 10px 0 5px;
  font-size: 16px;
}

.processing-progress {
  font-family: 'Courier New', monospace;
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}

.generate-info {
  margin-bottom: 20px;
}

.generate-info p {
  font-size: 16px;
  margin: 0;
}

.generate-button {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 15px 30px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  cursor: pointer;
  font-size: 18px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.generate-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

.generate-button:disabled {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  cursor: not-allowed;
  transform: none;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .ffmpeg-splitter {
    padding: 15px;
  }
  
  .controls {
    flex-direction: column;
    gap: 15px;
  }
  
  .timeline-instructions {
    flex-direction: column;
    gap: 10px;
  }
  
  .segments-grid {
    grid-template-columns: 1fr;
  }
  
  .segment-info {
    grid-template-columns: 1fr;
  }
  
  .ffmpeg-info {
    text-align: center;
  }
}
</style> 