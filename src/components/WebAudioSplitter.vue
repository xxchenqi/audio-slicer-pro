<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'

// 定义分割点数据结构
interface SplitPoint {
  id: number    // 分割点唯一标识
  time: number  // 分割点在音频中的时间位置（秒）
  x: number     // 分割点在Canvas上的像素位置
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
const audioUrl = ref<string>('')                            // 音频文件的URL（用于HTML audio元素）
const audioElement = ref<HTMLAudioElement | null>(null)     // HTML audio元素引用
const canvasRef = ref<HTMLCanvasElement | null>(null)       // Canvas元素引用（用于绘制波形）
const waveformContainer = ref<HTMLElement | null>(null)     // 波形容器元素引用
const isPlaying = ref(false)                                // 音频播放状态
const currentTime = ref(0)                                  // 当前播放时间
const duration = ref(0)                                     // 音频总时长
const splitPoints = ref<SplitPoint[]>([])                   // 分割点数组
const audioSegments = ref<AudioSegment[]>([])               // 音频片段数组
const isLoading = ref(false)                                // 加载状态

// === Web Audio API 相关 ===
const audioContext = ref<AudioContext | null>(null)        // 音频上下文（用于音频处理）
const audioBuffer = ref<AudioBuffer | null>(null)          // 音频缓冲区（包含解码后的PCM数据）

// === 交互状态管理 ===
const hoveredSplitPoint = ref<SplitPoint | null>(null)     // 当前悬停的分割点
const mouseX = ref(0)                                       // 鼠标X坐标
const showTimeTooltip = ref(false)                          // 是否显示时间提示
const isDragging = ref(false)                               // 是否正在拖拽
const draggedSplitPoint = ref<SplitPoint | null>(null)     // 正在拖拽的分割点
const longPressTimer = ref<NodeJS.Timeout | null>(null)    // 长按计时器
const longPressStarted = ref(false)                         // 是否开始长按
const dragStartX = ref(0)                                   // 拖拽开始的X坐标

// ID生成器
let nextSplitId = 1      // 下一个分割点ID
let nextSegmentId = 1    // 下一个片段ID

// === 文件处理 ===
/**
 * 处理用户选择的音频文件
 * 1. 验证文件类型
 * 2. 创建URL用于播放
 * 3. 重置分割点和片段
 * 4. 加载音频数据用于波形显示和切割
 */
const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (file && file.type.startsWith('audio/')) {
    audioFile.value = file
    audioUrl.value = URL.createObjectURL(file)  // 创建对象URL用于HTML audio元素
    splitPoints.value = []                      // 清空分割点
    audioSegments.value = []                    // 清空片段
    
    await nextTick()
    if (audioElement.value) {
      audioElement.value.load()                 // 重新加载audio元素
    }
    
    // 加载音频数据用于波形显示和音频切割
    await loadAudioData(file)
  }
}

/**
 * 加载音频数据并解码为PCM格式
 * 这是音频处理的核心步骤：
 * 1. 创建Web Audio API上下文
 * 2. 读取文件为二进制数据
 * 3. 解码为未压缩的PCM音频数据
 * 4. 存储在AudioBuffer中供后续使用
 */
const loadAudioData = async (file: File) => {
  try {
    isLoading.value = true
    
    // 创建音频上下文（Web Audio API的入口）
    if (!audioContext.value) {
      audioContext.value = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    
    // 将文件读取为ArrayBuffer（二进制数据）
    const arrayBuffer = await file.arrayBuffer()
    
    // 解码音频数据：MP3/AAC等压缩格式 → PCM浮点数组
    // 这个过程会将压缩的音频数据解码为可以直接操作的PCM样本
    audioBuffer.value = await audioContext.value.decodeAudioData(arrayBuffer)
    
    await nextTick()
    
    // 确保canvas尺寸正确，避免坐标计算错误
    if (canvasRef.value && waveformContainer.value) {
      const canvas = canvasRef.value
      const container = waveformContainer.value
      const containerWidth = container.clientWidth
      
      // 设置canvas的实际渲染尺寸
      canvas.width = containerWidth
      canvas.height = 200
      // 设置canvas的显示尺寸（避免模糊）
      canvas.style.width = containerWidth + 'px'
      canvas.style.height = '200px'
    }
    
    // 绘制波形图
    drawWaveform()
  } catch (error) {
    console.error('加载音频数据失败:', error)
  } finally {
    isLoading.value = false
  }
}

/**
 * 绘制音频波形图
 * 1. 清空canvas
 * 2. 绘制分割区域背景
 * 3. 绘制音频波形
 * 4. 绘制分割点
 * 5. 绘制播放进度
 */
const drawWaveform = () => {
  if (!canvasRef.value || !audioBuffer.value) return
  
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')!
  const width = canvas.width
  const height = canvas.height
  
  // 清空canvas
  ctx.clearRect(0, 0, width, height)
  
  // 绘制背景
  ctx.fillStyle = '#f8f9fa'
  ctx.fillRect(0, 0, width, height)
  
  // 绘制分割区域背景（不同颜色区分不同片段）
  drawSegmentBackgrounds(ctx, width, height)
  
  // 绘制音频波形
  // 获取第一个声道的音频数据（单声道或立体声的左声道）
  const data = audioBuffer.value.getChannelData(0)
  const step = Math.ceil(data.length / width)  // 每个像素对应的样本数
  const amp = height / 2                       // 波形振幅（canvas高度的一半）
  
  ctx.strokeStyle = '#3498db'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  
  // 遍历每个像素位置，绘制对应的波形
  for (let i = 0; i < width; i++) {
    let min = 1.0   // 当前像素位置的最小值
    let max = -1.0  // 当前像素位置的最大值
    
    // 在当前像素对应的样本范围内找到最大值和最小值
    for (let j = 0; j < step; j++) {
      const datum = data[(i * step) + j]
      if (datum < min) min = datum
      if (datum > max) max = datum
    }
    
    // 绘制从最小值到最大值的垂直线（形成波形效果）
    ctx.moveTo(i, (1 + min) * amp)
    ctx.lineTo(i, (1 + max) * amp)
  }
  
  ctx.stroke()
  
  // 绘制分割点
  drawSplitPoints(ctx, height)
  
  // 绘制播放进度指示器
  if (duration.value > 0) {
    const progress = currentTime.value / duration.value  // 播放进度比例
    const x = progress * width                           // 进度在canvas上的像素位置
    
    // 绘制播放进度线
    ctx.strokeStyle = '#2ecc71'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
    
    // 绘制播放进度圆点
    ctx.fillStyle = '#2ecc71'
    ctx.beginPath()
    ctx.arc(x, height / 2, 6, 0, 2 * Math.PI)
    ctx.fill()
  }
}

/**
 * 绘制分割区域背景
 * 为不同的音频片段使用不同的背景色，便于区分
 */
const drawSegmentBackgrounds = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  if (splitPoints.value.length === 0) return
  
  const sortedPoints = [...splitPoints.value].sort((a, b) => a.x - b.x)
  const colors = ['#e8f4fd', '#fff2e8', '#f0f8e8', '#fde8f4', '#e8f0f8']  // 不同片段的背景色
  
  let lastX = 0
  
  // 为每个片段绘制背景色
  sortedPoints.forEach((point, index) => {
    ctx.fillStyle = colors[index % colors.length]
    ctx.fillRect(lastX, 0, point.x - lastX, height)
    lastX = point.x
  })
  
  // 绘制最后一个片段的背景
  if (lastX < width) {
    ctx.fillStyle = colors[sortedPoints.length % colors.length]
    ctx.fillRect(lastX, 0, width - lastX, height)
  }
}

/**
 * 绘制分割点
 * 包括分割线、圆形标记和时间标签
 * 根据状态（普通、悬停、拖拽）显示不同的样式
 */
const drawSplitPoints = (ctx: CanvasRenderingContext2D, height: number) => {
  splitPoints.value.forEach(point => {
    const isHovered = hoveredSplitPoint.value?.id === point.id  // 是否悬停
    const isDragged = draggedSplitPoint.value?.id === point.id  // 是否正在拖拽
    
    // 根据状态设置分割线样式
    if (isDragged) {
      ctx.strokeStyle = '#8e44ad'  // 拖拽状态：紫色
      ctx.lineWidth = 5
    } else if (isHovered) {
      ctx.strokeStyle = '#c0392b'  // 悬停状态：深红色
      ctx.lineWidth = 4
    } else {
      ctx.strokeStyle = '#e74c3c'  // 普通状态：红色
      ctx.lineWidth = 3
    }
    
    // 绘制分割线
    ctx.beginPath()
    ctx.moveTo(point.x, 0)
    ctx.lineTo(point.x, height)
    ctx.stroke()
    
    // 绘制分割点圆形标记
    if (isDragged) {
      ctx.fillStyle = '#8e44ad'
      ctx.beginPath()
      ctx.arc(point.x, 20, 10, 0, 2 * Math.PI)
      ctx.fill()
    } else if (isHovered) {
      ctx.fillStyle = '#c0392b'
      ctx.beginPath()
      ctx.arc(point.x, 20, 8, 0, 2 * Math.PI)
      ctx.fill()
    } else {
      ctx.fillStyle = '#e74c3c'
      ctx.beginPath()
      ctx.arc(point.x, 20, 6, 0, 2 * Math.PI)
      ctx.fill()
    }
    
    // 绘制白色边框
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.stroke()
    
    // 绘制时间标签
    const timeText = formatTime(point.time)
    ctx.font = '12px Arial'
    const textWidth = ctx.measureText(timeText).width
    const labelX = Math.min(point.x + 10, canvasRef.value!.width - textWidth - 10)
    
    // 时间标签背景
    if (isDragged) {
      ctx.fillStyle = 'rgba(142, 68, 173, 0.9)'
    } else if (isHovered) {
      ctx.fillStyle = 'rgba(192, 57, 43, 0.9)'
    } else {
      ctx.fillStyle = 'rgba(231, 76, 60, 0.9)'
    }
    
    ctx.fillRect(labelX - 4, 5, textWidth + 8, 16)
    
    // 时间标签文字
    ctx.fillStyle = '#ffffff'
    ctx.fillText(timeText, labelX, 16)
  })
}

// === 鼠标交互处理 ===

/**
 * 鼠标按下处理
 * 检测是否点击在分割点上，如果是则开始长按计时
 */
const onMouseDown = (event: MouseEvent) => {
  if (!canvasRef.value) return
  
  const rect = canvasRef.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const clampedX = Math.max(0, Math.min(x, canvasRef.value.width))
  
  // 检查是否点击在分割点上（15像素容错范围）
  const tolerance = 15
  const clickedPoint = splitPoints.value.find(point => 
    Math.abs(point.x - clampedX) < tolerance
  )
  
  if (clickedPoint) {
    dragStartX.value = clampedX
    longPressStarted.value = false
    
    // 开始长按计时（500ms后触发拖拽模式）
    longPressTimer.value = setTimeout(() => {
      longPressStarted.value = true
      isDragging.value = true
      draggedSplitPoint.value = clickedPoint
      
      // 改变鼠标样式为拖拽状态
      if (canvasRef.value) {
        canvasRef.value.style.cursor = 'grabbing'
      }
      
      // 重新绘制以显示拖拽状态
      drawWaveform()
    }, 500) // 500ms长按触发
  }
}

/**
 * 鼠标移动处理
 * 1. 如果正在拖拽，更新分割点位置
 * 2. 否则检测悬停状态并更新鼠标样式
 */
const onMouseMove = (event: MouseEvent) => {
  if (!canvasRef.value) return
  
  const rect = canvasRef.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  
  // 确保x坐标在canvas范围内
  mouseX.value = Math.max(0, Math.min(x, canvasRef.value.width))
  
  // 如果正在拖拽分割点
  if (isDragging.value && draggedSplitPoint.value) {
    const clampedX = Math.max(0, Math.min(x, canvasRef.value.width))
    const newTime = getTimeFromX(clampedX)  // 将像素位置转换为时间
    
    // 更新被拖拽分割点的位置
    const pointIndex = splitPoints.value.findIndex(p => p.id === draggedSplitPoint.value!.id)
    if (pointIndex !== -1) {
      splitPoints.value[pointIndex] = {
        ...splitPoints.value[pointIndex],
        time: newTime,  // 更新时间
        x: clampedX     // 更新像素位置
      }
      
      // 重新按时间排序分割点
      splitPoints.value.sort((a, b) => a.time - b.time)
      
      // 重新计算音频片段
      updateSegments()
      
      // 重新绘制波形
      drawWaveform()
    }
    return
  }
  
  // 检查是否悬停在分割点上
  const tolerance = 15
  const hoveredPoint = splitPoints.value.find(point => 
    Math.abs(point.x - mouseX.value) < tolerance
  )
  
  hoveredSplitPoint.value = hoveredPoint || null
  
  // 更新鼠标样式
  if (hoveredPoint) {
    if (canvasRef.value) {
      canvasRef.value.style.cursor = 'grab'  // 可抓取样式
    }
    showTimeTooltip.value = false
  } else {
    if (canvasRef.value) {
      canvasRef.value.style.cursor = 'crosshair'  // 十字准星样式
    }
    // 显示时间提示
    if (duration.value > 0) {
      showTimeTooltip.value = true
    }
  }
  
  // 重新绘制波形
  drawWaveform()
}

/**
 * 鼠标抬起处理
 * 1. 清除长按计时器
 * 2. 如果正在拖拽，结束拖拽
 * 3. 否则执行普通点击逻辑
 */
const onMouseUp = (event: MouseEvent) => {
  // 清除长按计时器
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
  
  // 如果正在拖拽，结束拖拽
  if (isDragging.value) {
    isDragging.value = false
    draggedSplitPoint.value = null
    
    // 恢复鼠标样式
    if (canvasRef.value) {
      canvasRef.value.style.cursor = 'crosshair'
    }
    
    // 重新绘制
    drawWaveform()
    return
  }
  
  // 如果没有开始长按，执行正常的点击逻辑（添加/删除分割点）
  if (!longPressStarted.value) {
    onCanvasClick(event)
  }
  
  longPressStarted.value = false
}

/**
 * 鼠标离开处理
 * 清理所有交互状态
 */
const onMouseLeave = () => {
  // 清除长按计时器
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
  
  // 如果正在拖拽，结束拖拽
  if (isDragging.value) {
    isDragging.value = false
    draggedSplitPoint.value = null
  }
  
  hoveredSplitPoint.value = null
  showTimeTooltip.value = false
  longPressStarted.value = false
  
  // 恢复鼠标样式
  if (canvasRef.value) {
    canvasRef.value.style.cursor = 'crosshair'
  }
  
  drawWaveform()
}

/**
 * 坐标转换：将像素位置转换为时间
 * 核心公式：时间 = (像素位置 / Canvas宽度) × 音频总时长
 */
const getTimeFromX = (x: number): number => {
  if (!canvasRef.value || duration.value === 0) return 0
  return (x / canvasRef.value.width) * duration.value
}

// === 音频播放控制 ===

/**
 * 播放/暂停切换
 */
const togglePlay = () => {
  if (!audioElement.value) return
  
  if (isPlaying.value) {
    audioElement.value.pause()
  } else {
    audioElement.value.play()
  }
}

/**
 * 音频时间更新事件
 * 更新当前播放时间并重新绘制波形（显示播放进度）
 */
const onTimeUpdate = () => {
  if (audioElement.value) {
    currentTime.value = audioElement.value.currentTime
    drawWaveform()  // 重新绘制以更新播放进度指示器
  }
}

/**
 * 音频元数据加载完成事件
 * 获取音频总时长并重新计算分割点位置
 */
const onLoadedMetadata = () => {
  if (audioElement.value) {
    duration.value = audioElement.value.duration
    
    // 重新计算所有分割点的x坐标（适应新的音频时长）
    if (canvasRef.value && splitPoints.value.length > 0) {
      splitPoints.value = splitPoints.value.map(point => ({
        ...point,
        x: (point.time / duration.value) * canvasRef.value!.width
      }))
    }
    
    updateSegments()
  }
}

/**
 * 播放状态改变事件
 */
const onPlayStateChange = () => {
  if (audioElement.value) {
    isPlaying.value = !audioElement.value.paused
  }
}

// === 分割点管理 ===

/**
 * 处理Canvas点击事件
 * 1. 检查点击位置是否有分割点
 * 2. 如果有，删除分割点
 * 3. 如果没有，添加新分割点
 */
const onCanvasClick = (event: MouseEvent) => {
  if (!canvasRef.value || !audioBuffer.value) return
  
  const rect = canvasRef.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  
  // 确保x坐标在canvas范围内
  const clampedX = Math.max(0, Math.min(x, canvasRef.value.width))
  const time = getTimeFromX(clampedX)  // 转换为时间
  
  // 检查是否点击在已有分割点附近
  const tolerance = 15
  const existingPoint = splitPoints.value.find(point => Math.abs(point.x - clampedX) < tolerance)
  
  if (existingPoint) {
    // 删除分割点
    splitPoints.value = splitPoints.value.filter(point => point.id !== existingPoint.id)
  } else {
    // 添加新分割点
    splitPoints.value.push({
      id: nextSplitId++,
      time,           // 时间位置
      x: clampedX     // 像素位置
    })
    
    // 按时间排序分割点
    splitPoints.value.sort((a, b) => a.time - b.time)
  }
  
  drawWaveform()
  updateSegments()  // 重新计算音频片段
}

/**
 * 更新音频片段
 * 根据分割点重新计算音频片段的时间区间
 * 这是音频分割的核心逻辑
 */
const updateSegments = () => {
  audioSegments.value = []
  nextSegmentId = 1
  
  // 如果没有分割点，整个音频作为一个片段
  if (splitPoints.value.length === 0) {
    if (duration.value > 0) {
      audioSegments.value.push({
        id: nextSegmentId++,
        start: 0,
        end: duration.value,
        name: `完整音频_${formatTime(duration.value)}`
      })
    }
    return
  }
  
  // 按x坐标排序分割点，确保顺序正确
  const sortedPoints = [...splitPoints.value].sort((a, b) => a.x - b.x)
  
  // 第一个片段：从音频开始到第一个分割点
  if (sortedPoints[0].time > 0.1) {  // 避免太短的片段
    audioSegments.value.push({
      id: nextSegmentId++,
      start: 0,
      end: sortedPoints[0].time,
      name: `片段${nextSegmentId - 1}_${formatTime(0)}-${formatTime(sortedPoints[0].time)}`
    })
  }
  
  // 中间片段：分割点之间的片段
  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const segmentDuration = sortedPoints[i + 1].time - sortedPoints[i].time
    if (segmentDuration > 0.1) {  // 避免太短的片段
      audioSegments.value.push({
        id: nextSegmentId++,
        start: sortedPoints[i].time,
        end: sortedPoints[i + 1].time,
        name: `片段${nextSegmentId - 1}_${formatTime(sortedPoints[i].time)}-${formatTime(sortedPoints[i + 1].time)}`
      })
    }
  }
  
  // 最后一个片段：最后一个分割点到音频结束
  const lastPoint = sortedPoints[sortedPoints.length - 1]
  if (lastPoint.time < duration.value - 0.1) {  // 避免太短的片段
    audioSegments.value.push({
      id: nextSegmentId++,
      start: lastPoint.time,
      end: duration.value,
      name: `片段${nextSegmentId - 1}_${formatTime(lastPoint.time)}-${formatTime(duration.value)}`
    })
  }
}

// === 工具函数 ===

/**
 * 格式化时间显示
 * 将秒数转换为 MM:SS 格式
 */
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

/**
 * 跳转到指定时间
 */
const seekTo = (time: number) => {
  if (audioElement.value) {
    audioElement.value.currentTime = time
  }
}

// === 音频片段生成和下载 ===

/**
 * 生成并下载所有音频片段
 * 遍历所有片段，逐个生成并下载
 */
const generateSegments = async () => {
  if (!audioBuffer.value || !audioContext.value || audioSegments.value.length === 0) {
    alert('请先选择音频文件并设置分割点')
    return
  }
  
  try {
    isLoading.value = true
    
    // 逐个生成片段
    for (const segment of audioSegments.value) {
      await downloadSegment(segment)
      // 添加延迟避免浏览器限制多个下载
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    alert(`已成功生成 ${audioSegments.value.length} 个音频片段！`)
  } catch (error) {
    console.error('生成音频片段失败:', error)
    alert('生成音频片段失败，请重试')
  } finally {
    isLoading.value = false
  }
}

/**
 * 下载单个音频片段
 * 这是音频切割的核心实现：
 * 1. 计算时间对应的样本位置
 * 2. 创建新的音频缓冲区
 * 3. 复制指定范围的音频数据
 * 4. 转换为WAV格式
 * 5. 触发下载
 */
const downloadSegment = async (segment: AudioSegment) => {
  if (!audioBuffer.value || !audioContext.value) return
  
  // 步骤1：计算样本位置
  // 时间转换为样本索引：样本位置 = 时间 × 采样率
  const startSample = Math.floor(segment.start * audioBuffer.value.sampleRate)
  const endSample = Math.floor(segment.end * audioBuffer.value.sampleRate)
  const length = endSample - startSample  // 片段长度（样本数）
  
  // 步骤2：创建新的音频缓冲区
  // 为片段创建独立的AudioBuffer
  const segmentBuffer = audioContext.value.createBuffer(
    audioBuffer.value.numberOfChannels,  // 保持原始声道数
    length,                              // 片段长度
    audioBuffer.value.sampleRate         // 保持原始采样率
  )
  
  // 步骤3：复制音频数据
  // 从原始音频缓冲区复制指定范围的PCM数据到新缓冲区
  for (let channel = 0; channel < audioBuffer.value.numberOfChannels; channel++) {
    const sourceData = audioBuffer.value.getChannelData(channel)  // 原始数据
    const segmentData = segmentBuffer.getChannelData(channel)     // 目标数据
    
    // 逐个样本复制
    for (let i = 0; i < length; i++) {
      segmentData[i] = sourceData[startSample + i]
    }
  }
  
  // 步骤4：转换为WAV格式
  const wavBlob = audioBufferToWav(segmentBuffer)
  
  // 步骤5：触发下载
  const url = URL.createObjectURL(wavBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${segment.name}.wav`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)  // 释放内存
}

/**
 * 将AudioBuffer转换为WAV格式
 * WAV文件结构：文件头(44字节) + 音频数据
 * 这个函数手动构建WAV文件的二进制数据
 */
const audioBufferToWav = (buffer: AudioBuffer): Blob => {
  const length = buffer.length                    // 样本总数
  const numberOfChannels = buffer.numberOfChannels // 声道数
  const sampleRate = buffer.sampleRate            // 采样率
  const bitsPerSample = 16                        // 位深度（16位）
  const bytesPerSample = bitsPerSample / 8        // 每样本字节数
  const blockAlign = numberOfChannels * bytesPerSample  // 块对齐
  const byteRate = sampleRate * blockAlign        // 字节率
  const dataSize = length * blockAlign            // 音频数据大小
  const bufferSize = 44 + dataSize               // 总文件大小
  
  // 创建二进制数据缓冲区
  const arrayBuffer = new ArrayBuffer(bufferSize)
  const view = new DataView(arrayBuffer)
  
  // 写入字符串到缓冲区的辅助函数
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }
  
  // 写入WAV文件头（44字节）
  writeString(0, 'RIFF')                          // 文件标识
  view.setUint32(4, bufferSize - 8, true)         // 文件大小
  writeString(8, 'WAVE')                          // 文件类型
  writeString(12, 'fmt ')                         // 格式块标识
  view.setUint32(16, 16, true)                    // 格式块大小
  view.setUint16(20, 1, true)                     // 音频格式(1=PCM)
  view.setUint16(22, numberOfChannels, true)      // 声道数
  view.setUint32(24, sampleRate, true)            // 采样率
  view.setUint32(28, byteRate, true)              // 字节率
  view.setUint16(32, blockAlign, true)            // 块对齐
  view.setUint16(34, bitsPerSample, true)         // 位深度
  writeString(36, 'data')                         // 数据块标识
  view.setUint32(40, dataSize, true)              // 数据大小
  
  // 写入音频数据
  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      // 将浮点数样本(-1.0到1.0)转换为16位整数(-32768到32767)
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]))
      view.setInt16(offset, sample * 0x7FFF, true)
      offset += 2
    }
  }
  
  // 返回Blob对象
  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

/**
 * 清除所有分割点
 */
const clearSplitPoints = () => {
  // 清除长按计时器
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
  
  splitPoints.value = []
  audioSegments.value = []
  hoveredSplitPoint.value = null
  isDragging.value = false
  draggedSplitPoint.value = null
  longPressStarted.value = false
  
  if (canvasRef.value) {
    canvasRef.value.style.cursor = 'crosshair'
    drawWaveform()
  }
}

/**
 * 返回主页
 */
const goHome = () => {
  router.push('/')
}

// === 响应式处理 ===

/**
 * 窗口大小变化处理
 * 重新计算canvas尺寸和分割点位置
 */
const handleResize = () => {
  if (canvasRef.value && waveformContainer.value) {
    const canvas = canvasRef.value
    const container = waveformContainer.value
    const containerWidth = container.clientWidth
    
    // 重新设置canvas尺寸
    canvas.width = containerWidth
    canvas.height = 200
    canvas.style.width = containerWidth + 'px'
    canvas.style.height = '200px'
    
    // 重新计算分割点的x坐标
    if (duration.value > 0) {
      splitPoints.value = splitPoints.value.map(point => ({
        ...point,
        x: (point.time / duration.value) * containerWidth
      }))
    }
    
    // 重新绘制波形
    if (audioBuffer.value) {
      drawWaveform()
    }
  }
}

// === 生命周期钩子 ===

onMounted(() => {
  // 初始化canvas尺寸
  if (canvasRef.value) {
    const canvas = canvasRef.value
    const container = waveformContainer.value
    if (container) {
      const containerWidth = container.clientWidth
      canvas.width = containerWidth
      canvas.height = 200
      canvas.style.width = containerWidth + 'px'
      canvas.style.height = '200px'
    }
  }
  
  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)
})

// 组件卸载时清理
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div class="audio-splitter">
    <div class="header">
      <button class="back-button" @click="goHome">
        ← 返回主页
      </button>
      <h1>🎵 Web Audio API 音频分割工具</h1>
      <p>基于Web Audio API实现，选择MP3文件，点击波形图添加分割点，生成并下载音频片段</p>
    </div>
    
    <div class="file-input-section">
      <input
        type="file"
        accept="audio/*"
        @change="handleFileSelect"
        class="file-input"
      />
      <div class="file-hint">
        💡 支持MP3、WAV、AAC等音频格式
      </div>
    </div>
    
    <div v-if="audioUrl" class="audio-section">
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
      
      <div class="waveform-section" ref="waveformContainer">
        <div class="waveform-header">
          <h3>🎨 波形图编辑器</h3>
          <div class="waveform-controls">
            <div class="split-count">
              分割点: {{ splitPoints.length }}
            </div>
            <button @click="clearSplitPoints" class="clear-button">
              🗑️ 清除所有
            </button>
          </div>
        </div>
        
        <div class="waveform-instructions">
          <span class="instruction-item">👆 点击添加分割点</span>
          <span class="instruction-item">🎯 再次点击删除分割点</span>
          <span class="instruction-item">✋ 长按分割线拖拽调整位置</span>
          <span class="instruction-item">🖱️ 悬停查看详情</span>
        </div>
        
        <div class="canvas-container">
          <canvas
            ref="canvasRef"
            @mousedown="onMouseDown"
            @mousemove="onMouseMove"
            @mouseup="onMouseUp"
            @mouseleave="onMouseLeave"
            class="waveform-canvas"
            v-show="!isLoading"
          ></canvas>
          
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
          
          <div v-if="isLoading" class="loading">
            <div class="loading-spinner"></div>
            <p>正在加载音频数据...</p>
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
          <div class="generate-info">
            <p>将生成 <strong>{{ audioSegments.length }}</strong> 个WAV格式的音频文件</p>
          </div>
          <button
            @click="generateSegments"
            :disabled="isLoading"
            class="generate-button"
          >
            <span class="button-icon">{{ isLoading ? '⏳' : '📥' }}</span>
            {{ isLoading ? '生成中...' : '生成并下载所有片段' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.audio-splitter {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  min-height: 100vh;
}

.header {
  text-align: center;
  margin-bottom: 30px;
  position: relative;
}

.back-button {
  position: absolute;
  left: 0;
  top: 0;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  padding: 0.6rem 1.2rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 10px rgba(102, 126, 234, 0.3);
}

.back-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.header h1 {
  color: #2c3e50;
  margin-bottom: 10px;
  font-size: 2.5em;
  font-weight: 700;
}

.header p {
  color: #7f8c8d;
  font-size: 16px;
}

.file-input-section {
  margin-bottom: 30px;
}

.file-input {
  width: 100%;
  padding: 15px;
  border: 3px dashed #3498db;
  border-radius: 12px;
  background: white;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.file-input:hover {
  border-color: #2980b9;
  background: #e3f2fd;
  transform: translateY(-2px);
}

.file-hint {
  text-align: center;
  margin-top: 10px;
  color: #7f8c8d;
  font-size: 14px;
}

.audio-section {
  background: white;
  border-radius: 16px;
  padding: 25px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
}

.controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 25px;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
}

.play-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.play-button:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
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
}

.current-time {
  color: #2ecc71;
}

.separator {
  color: rgba(255, 255, 255, 0.7);
}

.total-time {
  color: rgba(255, 255, 255, 0.9);
}

.waveform-section {
  margin-bottom: 25px;
}

.waveform-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.waveform-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.3em;
}

.waveform-controls {
  display: flex;
  align-items: center;
  gap: 15px;
}

.split-count {
  padding: 6px 12px;
  background: #e8f4fd;
  color: #2980b9;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
}

.clear-button {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 16px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.clear-button:hover {
  background: #c0392b;
  transform: translateY(-1px);
}

.waveform-instructions {
  display: flex;
  gap: 20px;
  margin-bottom: 15px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #3498db;
}

.instruction-item {
  font-size: 14px;
  color: #7f8c8d;
}

.canvas-container {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.waveform-canvas {
  width: 100%;
  height: 200px;
  display: block;
  cursor: crosshair;
  transition: all 0.3s ease;
}

.waveform-canvas:hover {
  filter: brightness(1.05);
}

.waveform-canvas.dragging {
  cursor: grabbing !important;
}

.waveform-canvas.grab-cursor {
  cursor: grab !important;
}

.time-tooltip {
  position: absolute;
  top: -35px;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-family: 'Courier New', monospace;
  pointer-events: none;
  z-index: 10;
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

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #7f8c8d;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.segments-section {
  margin-top: 25px;
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
  background: white;
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
  background: linear-gradient(90deg, #3498db, #2ecc71);
  transform: scaleX(0);
  transition: transform 0.3s ease;
}

.segment-card:hover::before,
.segment-active::before {
  transform: scaleX(1);
}

.segment-card:hover {
  border-color: #3498db;
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(52, 152, 219, 0.2);
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
  background: #3498db;
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
  background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
  border-radius: 12px;
}

.generate-info {
  margin-bottom: 20px;
}

.generate-info p {
  color: #2c3e50;
  font-size: 16px;
  margin: 0;
}

.generate-button {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 15px 30px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 18px;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.generate-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.6);
}

.generate-button:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

@media (max-width: 768px) {
  .audio-splitter {
    padding: 15px;
  }
  
  .controls {
    flex-direction: column;
    gap: 15px;
  }
  
  .waveform-instructions {
    flex-direction: column;
    gap: 10px;
  }
  
  .segments-grid {
    grid-template-columns: 1fr;
  }
  
  .segment-info {
    grid-template-columns: 1fr;
  }
}
</style> 