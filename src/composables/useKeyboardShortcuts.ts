import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

export interface Shortcut {
  keys: string
  description: string
  handler: () => void
}

export function useKeyboardShortcuts(
  getShortcuts: () => Shortcut[],
) {
  const showHelp = ref(false)

  function handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      target.closest('.vditor')
    ) {
      return
    }

    const parts: string[] = []
    if (e.ctrlKey || e.metaKey) parts.push('ctrl')
    if (e.altKey) parts.push('alt')
    if (e.shiftKey && e.key !== 'Shift') parts.push('shift')
    parts.push(e.key.toLowerCase())

    const key = parts.join('+')
    const shortcut = getShortcuts().find((s) => s.keys === key)
    if (shortcut) {
      e.preventDefault()
      shortcut.handler()
    }
  }

  onMounted(() => document.addEventListener('keydown', handleKeydown))
  onUnmounted(() => document.removeEventListener('keydown', handleKeydown))

  return { showHelp }
}
