import DefaultTheme from 'vitepress/theme'
import AdminLayout from './AdminLayout.vue'
import './admin.css'

export default {
  extends: DefaultTheme,
  Layout: AdminLayout
}
