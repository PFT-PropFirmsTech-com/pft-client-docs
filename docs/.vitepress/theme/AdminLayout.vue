<script setup>
import { useRoute } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { ref, computed, watch } from 'vue'

const { Layout } = DefaultTheme
const route = useRoute()

// Add new password hashes here — any of them will unlock the admin docs
const HASHES = [
  '67ece7f33d6d02bbc2f86fb9d6723d13698523eb322f3776cfe8bf3168cf6af6', // PFT-Admin-2026!
  '48689e9681ddd6f6ac3a907519cd5a79edc73694f23b25cfa444041e244d1743', // PFT-Client-2026!
]
const STORAGE_KEY = 'pft-admin-auth'

const password = ref('')
const error = ref('')
const authenticated = ref(
  typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true'
)

const isAdminRoute = computed(() => route.path.includes('/admin/') || route.path.endsWith('/admin'))

const locked = computed(() => isAdminRoute.value && !authenticated.value)
const showLogout = computed(() => isAdminRoute.value && authenticated.value)

async function sha256(message) {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function unlock() {
  error.value = ''
  const hash = await sha256(password.value)
  if (HASHES.includes(hash)) {
    authenticated.value = true
    localStorage.setItem(STORAGE_KEY, 'true')
  } else {
    error.value = 'Incorrect password'
  }
}

function logout() {
  authenticated.value = false
  localStorage.removeItem(STORAGE_KEY)
  password.value = ''
}
</script>

<template>
  <div :class="{ 'admin-locked': locked }">
    <Layout />

    <!-- Logout button for authenticated admin pages -->
    <button v-if="showLogout" class="admin-logout" @click="logout" title="Logout from admin docs">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      Logout
    </button>

    <!-- Password gate overlay -->
    <div v-if="locked" class="admin-gate">
      <div class="admin-gate-box">
        <h2>Admin Access Required</h2>
        <p>This section is restricted to authorized personnel.</p>
        <form @submit.prevent="unlock">
          <input
            v-model="password"
            type="password"
            placeholder="Enter password"
            class="admin-input"
            autofocus
          />
          <button type="submit" class="admin-btn">Unlock</button>
        </form>
        <p v-if="error" class="admin-error">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-logout {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 500;
  color: #666;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
.admin-logout:hover {
  color: #e53e3e;
  background: #fff5f5;
  border-color: #feb2b2;
}

:root.dark .admin-logout {
  color: #999;
  background: #1a1a1a;
  border-color: #333;
}
:root.dark .admin-logout:hover {
  color: #fc8181;
  background: #1a0a0a;
  border-color: #5a2020;
}
</style>
