import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import { useRouter } from 'vue-router'

function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    ('ontouchstart' in window && navigator.maxTouchPoints > 1)
  )
}

export function useSwipeBack() {
  const router = useRouter()
  const swipeIndicator = ref(false)

  let startX = 0
  let startY = 0
  let tracking = false

  function onTouchStart(e: TouchEvent) {
    const touch = e.touches[0]
    if (!touch) return
    if (touch.clientX <= 30) {
      startX = touch.clientX
      startY = touch.clientY
      tracking = true
    }
  }

  function onTouchMove(e: TouchEvent) {
    if (!tracking) return
    const touch = e.touches[0]
    if (!touch) return
    const dx = touch.clientX - startX
    const dy = Math.abs(touch.clientY - startY)
    if (dx > 20 && dy < 50) {
      swipeIndicator.value = true
    }
  }

  function onTouchEnd(e: TouchEvent) {
    if (!tracking) return
    const touch = e.changedTouches[0]
    if (!touch) return
    const dx = touch.clientX - startX
    const dy = Math.abs(touch.clientY - startY)
    if (dx > 100 && dy < 50) {
      router.back()
    }
    tracking = false
    swipeIndicator.value = false
  }

  onMounted(() => {
    if (!isTouchDevice()) return
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
  })

  onUnmounted(() => {
    document.removeEventListener('touchstart', onTouchStart)
    document.removeEventListener('touchmove', onTouchMove)
    document.removeEventListener('touchend', onTouchEnd)
  })

  return { swipeIndicator }
}

export function usePullToRefresh(
  containerRef: Ref<HTMLElement | null>,
  onRefresh: () => Promise<void>,
) {
  const isPulling = ref(false)
  const pullDistance = ref(0)

  let startY = 0
  let pulling = false

  function onTouchStart(e: TouchEvent) {
    const container = containerRef.value
    if (!container || container.scrollTop > 0) return
    const touch = e.touches[0]
    if (!touch) return
    startY = touch.clientY
    pulling = true
  }

  function onTouchMove(e: TouchEvent) {
    if (!pulling) return
    const touch = e.touches[0]
    if (!touch) return
    const dy = touch.clientY - startY
    if (dy > 0 && dy < 150) {
      pullDistance.value = dy
      isPulling.value = dy > 60
    }
  }

  async function onTouchEnd() {
    if (!pulling) return
    if (isPulling.value) {
      await onRefresh()
    }
    pulling = false
    isPulling.value = false
    pullDistance.value = 0
  }

  onMounted(() => {
    if (!isTouchDevice()) return
    const el = containerRef.value
    if (!el) return
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
  })

  onUnmounted(() => {
    const el = containerRef.value
    if (!el) return
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchmove', onTouchMove)
    el.removeEventListener('touchend', onTouchEnd)
  })

  return { isPulling, pullDistance }
}
