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
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { requiresAuth: false }
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { requiresAuth: false }
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterView,
      meta: { requiresAuth: false }
    },
    {
      path: '/articles',
      name: 'articles',
      component: ArticlesView,
      meta: { requiresAuth: true }
    },
    {
      path: '/articles/:id',
      name: 'article-detail',
      component: ArticleDetailView,
      meta: { requiresAuth: true }
    },
    {
      path: '/articles/:id/view',
      name: 'article-viewer',
      component: ArticleViewer,
      meta: { requiresAuth: true }
    },
    {
      path: '/articles/new',
      name: 'article-new',
      component: ArticleEditView,
      meta: { requiresAuth: true }
    },
    {
      path: '/articles/:id/edit',
      name: 'article-edit',
      component: ArticleEditView,
      meta: { requiresAuth: true }
    },
    {
      path: '/categories',
      name: 'categories',
      component: CategoryManagementView,
      meta: { requiresAuth: true }
    },
    {
      path: '/my-articles',
      name: 'my-articles',
      component: MyArticlesView,
      meta: { requiresAuth: true }
    },
    {
      path: '/favorites',
      name: 'favorites',
      component: FavoritesView,
      meta: { requiresAuth: true }
    },
    {
      path: '/profile',
      name: 'profile',
      component: UserProfileView,
      meta: { requiresAuth: true }
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ],
})

// 路由守卫
router.beforeEach((to, from) => {
  const token = localStorage.getItem('token')
  
  // 如果路由需要认证但用户未登录，重定向到登录页
  if (to.meta.requiresAuth && !token) {
    return '/login'
  }
})

export default router
