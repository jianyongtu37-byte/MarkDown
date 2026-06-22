import { useBreakpoints, breakpointsTailwind } from '@vueuse/core'

export function useLayout() {
  const breakpoints = useBreakpoints(breakpointsTailwind)
  const isMobile = breakpoints.smaller('md') // < 768px
  const isTablet = breakpoints.between('md', 'lg') // 768-1024
  const isDesktop = breakpoints.greaterOrEqual('lg') // >= 1024

  return { isMobile, isTablet, isDesktop, breakpoints }
}
