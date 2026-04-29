<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

// 计算属性
const user = computed(() => authStore.user)
const isAuthenticated = computed(() => authStore.isAuthenticated)

// 格式化日期
const formatDate = (dateString?: string) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}
</script>

<template>
  <div class="cursor-home-container">
    <!-- 英雄区域 - 奶油色背景 -->
    <section class="cursor-section">
      <div class="cursor-container">
        <div class="cursor-hero-content">
          <h1 class="cursor-display-hero">欢迎使用 Markdown 知识库</h1>
          <p class="cursor-body-serif cursor-hero-desc">
            一个简洁高效的 Markdown 文档管理系统
          </p>
        </div>
      </div>
    </section>
    
    <!-- 快速开始区域 - 已登录用户可见 -->
    <section v-if="isAuthenticated && user" class="cursor-section-alt">
      <div class="cursor-container">
        <h2 class="cursor-section-heading cursor-quick-start-title">快速开始</h2>
        <p class="cursor-body-secondary cursor-quick-start-desc">
          欢迎回来，{{ user.nickname || user.username }}！开始您的知识之旅
        </p>
        
        <div class="cursor-quick-start-grid">
          <router-link to="/articles/new" class="cursor-quick-start-card cursor-card">
            <div class="cursor-feature-icon">✍️</div>
            <h3 class="cursor-title-small">写新文章</h3>
            <p class="cursor-body-secondary">创建您的第一篇 Markdown 文档</p>
          </router-link>
          
          <router-link to="/my-articles" class="cursor-quick-start-card cursor-card">
            <div class="cursor-feature-icon">📄</div>
            <h3 class="cursor-title-small">我的文章</h3>
            <p class="cursor-body-secondary">查看和管理您的所有文档</p>
          </router-link>
          
          <router-link to="/articles" class="cursor-quick-start-card cursor-card">
            <div class="cursor-feature-icon">📚</div>
            <h3 class="cursor-title-small">公共文章</h3>
            <p class="cursor-body-secondary">浏览社区分享的知识文档</p>
          </router-link>
          
          <router-link to="/categories" class="cursor-quick-start-card cursor-card">
            <div class="cursor-feature-icon">🏷️</div>
            <h3 class="cursor-title-small">分类管理</h3>
            <p class="cursor-body-secondary">组织和管理您的文档分类</p>
          </router-link>
        </div>
      </div>
    </section>
    
    <!-- 功能特性区域 - 交替背景色 -->
    <section class="cursor-section">
      <div class="cursor-container">
        <h2 class="cursor-section-heading cursor-features-title">
          主要功能
        </h2>
        
        <div class="cursor-features-grid">
          <div class="cursor-card cursor-feature-card">
            <div class="cursor-feature-icon">📝</div>
            <div class="cursor-feature-content">
              <h3 class="cursor-title-small">Markdown 编辑</h3>
              <p class="cursor-body-secondary cursor-card-desc">
                支持实时预览的 Markdown 编辑器，让写作更加流畅高效
              </p>
            </div>
          </div>
          
          <div class="cursor-card cursor-feature-card">
            <div class="cursor-feature-icon">📚</div>
            <div class="cursor-feature-content">
              <h3 class="cursor-title-small">知识库管理</h3>
              <p class="cursor-body-secondary cursor-card-desc">
                分类管理您的文档和笔记，构建个人知识体系
              </p>
            </div>
          </div>
          
          <div class="cursor-card cursor-feature-card">
            <div class="cursor-feature-icon">🔍</div>
            <div class="cursor-feature-content">
              <h3 class="cursor-title-small">全文搜索</h3>
              <p class="cursor-body-secondary cursor-card-desc">
                快速查找您需要的文档内容，提高信息检索效率
              </p>
            </div>
          </div>
          
          <div class="cursor-card cursor-feature-card">
            <div class="cursor-feature-icon">🔗</div>
            <div class="cursor-feature-content">
              <h3 class="cursor-title-small">分享协作</h3>
              <p class="cursor-body-secondary cursor-card-desc">
                轻松分享文档并与他人协作，促进知识共享
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.cursor-home-container {
  min-height: 100vh;
}

.cursor-hero-content {
  text-align: center;
  padding: calc(var(--space-80) * 1.5) 0;
  max-width: 800px;
  margin: 0 auto;
}

.cursor-hero-content h1 {
  margin-bottom: var(--space-20);
}

.cursor-hero-desc {
  color: var(--border-strong);
  margin-top: var(--space-20);
}

/* 快速开始区域 */
.cursor-quick-start-title {
  text-align: center;
  margin-bottom: var(--space-12);
}

.cursor-quick-start-desc {
  text-align: center;
  margin-bottom: var(--space-48);
}

.cursor-quick-start-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-24);
  margin-bottom: var(--space-60);
}

.cursor-quick-start-card {
  text-decoration: none;
  display: block;
  transition: transform 200ms ease, box-shadow 200ms ease;
  cursor: pointer;
}

.cursor-quick-start-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-card);
}

.cursor-quick-start-card .cursor-feature-icon {
  margin-bottom: var(--space-16);
}

.cursor-quick-start-card .cursor-title-small {
  margin-bottom: var(--space-8);
}

.cursor-features-title {
  text-align: center;
  margin-bottom: var(--space-48);
}

.cursor-features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-24);
}

.cursor-feature-icon {
  font-size: 56px;
  margin-bottom: var(--space-24);
  text-align: center;
  line-height: 1;
}

.cursor-feature-card {
  padding: var(--space-40) var(--space-24);
  transition: transform 200ms ease;
  cursor: default;
}

.cursor-feature-card:hover {
  transform: translateY(-8px);
}

.cursor-card-title {
  text-align: center;
}

.cursor-card-desc {
  text-align: center;
}

.cursor-feature-content {
  text-align: center;
  padding: var(--space-24);
}

/* 响应式设计 */
@media (max-width: 900px) {
  .cursor-hero-content {
    padding: var(--space-60) 0;
  }
  
  .cursor-quick-start-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-20);
  }
  
  .cursor-features-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-20);
  }
}

@media (max-width: 600px) {
  .cursor-hero-content {
    padding: var(--space-40) 0;
  }
  
  .cursor-quick-start-card {
    padding: var(--space-24);
  }
  
  .cursor-quick-start-grid {
    grid-template-columns: 1fr;
    gap: var(--space-16);
  }
  
  .cursor-features-grid {
    grid-template-columns: 1fr;
    gap: var(--space-16);
  }
}
</style>
