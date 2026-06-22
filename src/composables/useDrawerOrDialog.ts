import { computed } from 'vue'
import { useLayout } from './useLayout'

/**
 * Provides responsive dialog/drawer props.
 * On mobile: renders a bottom drawer (el-drawer direction="btt").
 * On desktop: renders a standard dialog (el-dialog).
 */
export function useDrawerOrDialog() {
  const { isMobile } = useLayout()

  const drawerProps = computed(() => ({
    direction: 'btt' as const,
    size: '85%',
    showClose: true,
    'with-header': true,
  }))

  const dialogProps = computed(() => ({
    width: '500px',
    'close-on-click-modal': false,
  }))

  return { isMobile, drawerProps, dialogProps }
}
