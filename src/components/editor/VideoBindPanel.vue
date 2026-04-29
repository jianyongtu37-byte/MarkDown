<template>
  <div class="video-bind-panel">
    <div class="bind-input-row">
      <el-input
        v-model="inputUrl"
        placeholder="粘贴 YouTube / Bilibili 链接，或本地视频路径"
        clearable
        @change="onUrlChange"
      >
        <template #prepend>
          <el-icon><VideoPlay /></el-icon>
        </template>
      </el-input>
      <el-button @click="onUrlChange" :loading="resolving">识别</el-button>
    </div>

    <!-- 识别结果预览 -->
    <div v-if="resolved" class="resolved-badge">
      <el-tag :type="platformTagType" effect="light">
        {{ platformLabel }}
      </el-tag>
      <span class="video-id-text">{{ resolved.videoId || resolved.videoUrl }}</span>
      <el-button link type="danger" @click="clear">移除</el-button>
    </div>

    <p class="bind-tip">
      在正文中用 <code>[01:27]</code> 格式插入时间戳，绑定视频后可点击跳转
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { VideoPlay } from '@element-plus/icons-vue'
import type { VideoMeta } from '@/types/article'

const emit = defineEmits<{
  'update:modelValue': [meta: VideoMeta | null]
}>()

const inputUrl = ref('')
const resolved = ref<VideoMeta | null>(null)
const resolving = ref(false)

// 简单的前端识别（保存时后端会再次精确解析）
async function onUrlChange() {
  const url = inputUrl.value.trim()
  if (!url) { clear(); return }

  resolving.value = true
  try {
    const meta = resolveVideoUrl(url)
    resolved.value = meta
    emit('update:modelValue', meta)
  } finally {
    resolving.value = false
  }
}

function clear() {
  inputUrl.value = ''
  resolved.value = null
  emit('update:modelValue', null)
}

// 提取B站BV号（兼容包含中文标题的原始字符串）
function extractBvIdFromUrl(rawInput: string): string | null {
  if (!rawInput) return null
  
  // 确保输入是字符串
  const inputStr = String(rawInput)
  
  // 先尝试直接匹配BV开头的字符串
  const bvMatch = inputStr.match(/(BV[a-zA-Z0-9]+)/)
  if (bvMatch && bvMatch[1]) return bvMatch[1]
  
  // 如果没有找到BV号，尝试匹配b23.tv短链接或标准URL
  const urlMatch = inputStr.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/i)
  if (urlMatch && urlMatch[1]) return urlMatch[1]
  
  // 匹配b23.tv短链接
  const shortUrlMatch = inputStr.match(/b23\.tv\/[a-zA-Z0-9]+/i)
  if (shortUrlMatch) {
    // 对于短链接，无法直接提取BV号，返回原字符串让后端处理
    return inputStr.trim()
  }
  
  return null
}

function resolveVideoUrl(url: string): VideoMeta {
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const match = url.match(/(?:v=|youtu\.be\/)([^&?/]{11})/)
    return {
      id: 0, articleId: 0, duration: 0,
      videoUrl: url,
      videoSource: 'YOUTUBE',
      videoId: match?.[1] || ''
    }
  }
  if (url.includes('bilibili.com') || url.includes('b23.tv')) {
    const bvid = extractBvIdFromUrl(url)
    return {
      id: 0, articleId: 0, duration: 0,
      videoUrl: url,
      videoSource: 'BILIBILI',
      videoId: bvid || url // 如果提取不到BV号，使用原始URL
    }
  }
  return {
    id: 0, articleId: 0, duration: 0,
    videoUrl: url,
    videoSource: 'LOCAL',
    videoId: ''
  }
}

const platformLabel = computed(() => ({
  YOUTUBE: 'YouTube', BILIBILI: 'Bilibili', LOCAL: '本地视频'
}[resolved.value?.videoSource || 'LOCAL']))

const platformTagType = computed(() => ({
  YOUTUBE: 'danger', BILIBILI: 'primary', LOCAL: 'info'
}[resolved.value?.videoSource || 'LOCAL'] as any))
</script>

<style scoped>
.video-bind-panel { display: flex; flex-direction: column; gap: 10px; }
.bind-input-row { display: flex; gap: 8px; align-items: center; }
.resolved-badge { display: flex; align-items: center; gap: 10px; padding: 8px 12px;
  background: var(--color-background-secondary);
  border-radius: 6px; font-size: 13px; }
.video-id-text { color: var(--color-text-secondary);
  font-family: monospace; font-size: 12px; flex: 1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bind-tip { font-size: 12px; color: var(--color-text-secondary); }
.bind-tip code { background: var(--color-background-secondary);
  padding: 1px 5px; border-radius: 3px; font-size: 12px; }
</style>