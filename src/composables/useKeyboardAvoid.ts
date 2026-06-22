import { onMounted, onUnmounted } from 'vue'

function isInputElement(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea') return true
  if (el.classList.contains('el-input__inner')) return true
  if (el.classList.contains('el-textarea__inner')) return true
  if (el.contentEditable === 'true') return true
  return false
}

export function useKeyboardAvoid() {
  let initialHeight = 0

  function handleViewportResize() {
    const viewport = window.visualViewport
    if (!viewport) return

    const heightDiff = initialHeight - viewport.height
    if (heightDiff > 150) {
      const activeEl = document.activeElement as HTMLElement | null
      if (activeEl && isInputElement(activeEl)) {
        setTimeout(() => {
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
      }
    }
  }

  function handleFocusIn(e: FocusEvent) {
    const target = e.target as HTMLElement
    if (isInputElement(target)) {
      setTimeout(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 300)
    }
  }

  onMounted(() => {
    const viewport = window.visualViewport
    if (viewport) {
      initialHeight = viewport.height
      viewport.addEventListener('resize', handleViewportResize)
    }
    document.addEventListener('focusin', handleFocusIn)
  })

  onUnmounted(() => {
    const viewport = window.visualViewport
    if (viewport) {
      viewport.removeEventListener('resize', handleViewportResize)
    }
    document.removeEventListener('focusin', handleFocusIn)
  })
}
