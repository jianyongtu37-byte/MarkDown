import { ref, onUnmounted } from 'vue'

/**
 * 创建长按事件处理器（纯函数，不依赖生命周期钩子）。
 * 适用于在模板 v-for 中动态创建处理器的场景。
 */
export function createLongPressHandlers(callback: (e: TouchEvent) => void, delay = 500) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let startX = 0
  let startY = 0

  function cancel() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  return {
    handlers: {
      onTouchstart(e: TouchEvent) {
        const touch = e.touches[0]
        if (!touch) return
        startX = touch.clientX
        startY = touch.clientY
        timer = setTimeout(() => callback(e), delay)
      },
      onTouchmove(e: TouchEvent) {
        if (!timer) return
        const touch = e.touches[0]
        if (!touch) return
        const dx = Math.abs(touch.clientX - startX)
        const dy = Math.abs(touch.clientY - startY)
        if (dx > 10 || dy > 10) cancel()
      },
      onTouchend: cancel,
      onTouchcancel: cancel,
    },
  }
}

/**
 * 组合式用法：在 setup() 中调用，自动注册 onUnmounted 清理。
 * 不要在模板 v-for 中直接调用——改用 createLongPressHandlers。
 */
export function useLongPress(callback: (e: TouchEvent) => void, delay = 500) {
  const isPressed = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null
  let startX = 0
  let startY = 0

  function start(e: TouchEvent) {
    const touch = e.touches[0]
    if (!touch) return
    startX = touch.clientX
    startY = touch.clientY
    timer = setTimeout(() => {
      isPressed.value = true
      callback(e)
    }, delay)
  }

  function move(e: TouchEvent) {
    if (!timer) return
    const touch = e.touches[0]
    if (!touch) return
    const dx = Math.abs(touch.clientX - startX)
    const dy = Math.abs(touch.clientY - startY)
    if (dx > 10 || dy > 10) {
      cancel()
    }
  }

  function cancel() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    isPressed.value = false
  }

  onUnmounted(cancel)

  return {
    isPressed,
    handlers: {
      onTouchstart: start,
      onTouchmove: move,
      onTouchend: cancel,
      onTouchcancel: cancel,
    },
  }
}
