import { ref, onUnmounted } from 'vue'

export interface TypewriterOptions {
  /** 每秒输出字符数，默认 45 */
  speed?: number
}

/**
 * 打字机动画 composable —— 将 target 中的文本逐字输出到 displayed。
 * 流式场景：把 SSE 累积文本写入 target，用户可以逐字看到输出。
 */
export function useTypewriter(options: TypewriterOptions = {}) {
  const { speed = 45 } = options
  const target = ref('')
  const displayed = ref('')

  let timer: number | null = null
  let pos = 0
  let running = false

  function tick() {
    if (!running) return

    const remaining = target.value.length - pos
    if (remaining <= 0) {
      timer = window.setTimeout(tick, interval())
      return
    }

    // 自适应批量：落后太多时一次放出更多字符，避免等太久
    let batch = 1
    if (remaining > 200) batch = 6
    else if (remaining > 80) batch = 3
    else if (remaining > 30) batch = 2

    pos = Math.min(pos + batch, target.value.length)
    displayed.value = target.value.slice(0, pos)

    timer = window.setTimeout(tick, interval())
  }

  function interval() {
    return Math.max(16, Math.floor(1000 / speed))
  }

  function start() {
    stop()
    pos = 0
    displayed.value = ''
    running = true
    tick()
  }

  /** 立刻展示全部 target 内容，用于流结束时平滑过渡 */
  function flush() {
    stop()
    pos = target.value.length
    displayed.value = target.value
  }

  function stop() {
    running = false
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  /** 重置所有状态 */
  function reset() {
    stop()
    pos = 0
    target.value = ''
    displayed.value = ''
  }

  onUnmounted(stop)

  return { target, displayed, start, flush, stop, reset }
}
