import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import HomePage from '../components/HomePage.vue'
import WebAudioSplitter from '../components/WebAudioSplitter.vue'
import FFmpegSplitter from '../components/FFmpegSplitter.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: HomePage,
    meta: {
      title: '音频分割工具 - 选择你的分割方式'
    }
  },
  {
    path: '/audio',
    name: 'Audio',
    component: WebAudioSplitter,
    meta: {
      title: 'Web Audio API 音频分割工具'
    }
  },
  {
    path: '/ffmpeg',
    name: 'FFmpeg',
    component: FFmpegSplitter,
    meta: {
      title: 'FFmpeg 音频分割工具'
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 设置页面标题
router.beforeEach((to, from, next) => {
  if (to.meta?.title) {
    document.title = to.meta.title as string
  }
  next()
})

export default router 