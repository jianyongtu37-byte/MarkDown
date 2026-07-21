<script setup lang="ts">
import { ElBreadcrumb, ElBreadcrumbItem } from 'element-plus'

defineProps<{
  items: Array<{ label: string; to?: string }>
}>()
</script>

<template>
  <div class="breadcrumb-wrapper">
    <el-breadcrumb separator="/">
      <el-breadcrumb-item v-for="(item, idx) in items" :key="idx" :to="item.to">
        {{ item.label }}
      </el-breadcrumb-item>
    </el-breadcrumb>
  </div>
</template>

<style scoped>
.breadcrumb-wrapper {
  padding: 12px 0;
  margin-bottom: 4px;
}
.breadcrumb-wrapper :deep(.el-breadcrumb__inner) {
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
  transition: color 0.15s;
}
.breadcrumb-wrapper :deep(.el-breadcrumb__inner.is-link:hover) {
  color: #ea580c;
}
.breadcrumb-wrapper :deep(.el-breadcrumb__separator) {
  color: #cbd5e1;
  font-weight: 400;
  margin: 0 6px;
}

[data-theme="dark"] .breadcrumb-wrapper :deep(.el-breadcrumb__inner) {
  color: #94a3b8;
}
[data-theme="dark"] .breadcrumb-wrapper :deep(.el-breadcrumb__separator) {
  color: #64748b;
}
</style>
