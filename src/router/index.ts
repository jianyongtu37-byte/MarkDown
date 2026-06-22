import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import LoginView from '@/views/LoginView.vue'
import RegisterView from '@/views/RegisterView.vue'
import ArticlesView from '@/views/ArticlesView.vue'
import ArticleDetailView from '@/views/ArticleDetailView.vue'
import ArticleEditView from '@/views/ArticleEditView.vue'
import CategoryManagementView from '@/views/CategoryManagementView.vue'
import MyArticlesView from '@/views/MyArticlesView.vue'
import ArticleViewer from '@/views/article/ArticleViewer.vue'
import FavoritesView from '@/views/FavoritesView.vue'
import UserProfileView from '@/views/UserProfileView.vue'
import ForgotPasswordView from '@/views/ForgotPasswordView.vue'
import ResetPasswordView from '@/views/ResetPasswordView.vue'
import MyCommentsView from '@/views/MyCommentsView.vue'
import ReadingHistoryView from '@/views/ReadingHistoryView.vue'
import SeriesListView from '@/views/SeriesListView.vue'
import SeriesDetailView from '@/views/SeriesDetailView.vue'
import AdminLayout from '@/layouts/AdminLayout.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { requiresAuth: false },
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { requiresAuth: false },
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterView,
      meta: { requiresAuth: false },
    },
    {
      path: '/articles',
      name: 'articles',
      component: ArticlesView,
      meta: { requiresAuth: true },
    },
    {
      path: '/articles/:id/view',
      name: 'article-viewer',
      component: ArticleViewer,
      meta: { requiresAuth: true },
    },
    {
      path: '/articles/:id',
      name: 'article-detail',
      component: ArticleDetailView,
      meta: { requiresAuth: true },
    },
    {
      path: '/articles/new',
      name: 'article-new',
      component: ArticleEditView,
      meta: { requiresAuth: true },
    },
    {
      path: '/articles/:id/edit',
      name: 'article-edit',
      component: ArticleEditView,
      meta: { requiresAuth: true },
    },
    {
      path: '/categories',
      name: 'categories',
      component: CategoryManagementView,
      meta: { requiresAuth: true },
    },
    {
      path: '/my-articles',
      name: 'my-articles',
      component: MyArticlesView,
      meta: { requiresAuth: true },
    },
    {
      path: '/favorites',
      name: 'favorites',
      component: FavoritesView,
      meta: { requiresAuth: true },
    },
    {
      path: '/profile',
      name: 'profile',
      component: UserProfileView,
      meta: { requiresAuth: true },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: ForgotPasswordView,
      meta: { requiresAuth: false },
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: ResetPasswordView,
      meta: { requiresAuth: false },
    },
    {
      path: '/my-comments',
      name: 'my-comments',
      component: MyCommentsView,
      meta: { requiresAuth: true },
    },
    {
      path: '/reading-history',
      name: 'reading-history',
      component: ReadingHistoryView,
      meta: { requiresAuth: true },
    },
    {
      path: '/series',
      name: 'series',
      component: SeriesListView,
      meta: { requiresAuth: true },
    },
    {
      path: '/series/:id',
      name: 'series-detail',
      component: SeriesDetailView,
      meta: { requiresAuth: true },
    },
    {
      path: '/rag',
      name: 'rag-chat',
      component: () => import('@/views/RagChat.vue'),
      meta: { requiresAuth: true },
    },
    // 管理员路由
    {
      path: '/admin',
      component: AdminLayout,
      meta: { requiresAuth: true, requiresAdmin: true },
      children: [
        {
          path: '',
          name: 'admin-dashboard',
          component: () => import('@/views/admin/Dashboard.vue'),
        },
        {
          path: 'comments',
          name: 'admin-comments',
          component: () => import('@/views/admin/CommentReview.vue'),
        },
        {
          path: 'users',
          name: 'admin-users',
          component: () => import('@/views/admin/UserManagement.vue'),
        },
        {
          path: 'backup',
          name: 'admin-backup',
          component: () => import('@/views/admin/BackupManagement.vue'),
        },
        {
          path: 'search',
          name: 'admin-search',
          component: () => import('@/views/admin/SearchManagement.vue'),
        },
        {
          path: 'maintenance',
          name: 'admin-maintenance',
          component: () => import('@/views/admin/DataMaintenance.vue'),
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

function parseJwt(token: string) {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

// 路由守卫
router.beforeEach((to) => {
  const token = localStorage.getItem('token')

  if (to.meta.requiresAuth && !token) {
    return '/login'
  }

  // 验证 token 是否过期（过期则清除并跳转登录）
  if (to.meta.requiresAuth && token) {
    const decoded = parseJwt(token)
    if (!decoded || (decoded.exp && decoded.exp * 1000 < Date.now())) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      return '/login'
    }
  }

  if (to.meta.requiresAdmin && token) {
    const decoded = parseJwt(token)
    const authorities: string[] = decoded?.authorities ?? []
    if (!authorities.includes('ROLE_ADMIN')) {
      return '/'
    }
  }
})

export default router
