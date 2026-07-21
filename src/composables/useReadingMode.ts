import { ref, provide, inject, type InjectionKey, type Ref } from 'vue'

export const readingModeKey: InjectionKey<Ref<boolean>> = Symbol('readingMode')

export function useReadingModeProvider() {
  const isReadingMode = ref(false)
  provide(readingModeKey, isReadingMode)

  function toggle() {
    isReadingMode.value = !isReadingMode.value
    document.body.classList.toggle('reading-mode', isReadingMode.value)
  }

  function exit() {
    isReadingMode.value = false
    document.body.classList.remove('reading-mode')
  }

  return { isReadingMode, toggle, exit }
}

export function useReadingMode() {
  const isReadingMode = inject(readingModeKey, ref(false))
  return isReadingMode
}
