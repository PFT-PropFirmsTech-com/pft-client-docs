<script setup>
import { useRoute } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { ref, computed, watch } from 'vue'

const { Layout } = DefaultTheme
const route = useRoute()

const HASH = '3ea4b6a4e95b22096353f655c5bcc1f633e2f00128cd424861af44fa10e9b774'
const STORAGE_KEY = 'pft-admin-auth'

const password = ref('')
const error = ref('')
const authenticated = ref(
  typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'true'
)

const isAdminRoute = computed(() => route.path.includes('/admin/') || route.path.endsWith('/admin'))

const locked = computed(() => isAdminRoute.value && !authenticated.value)

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
  if (hash === HASH) {
    authenticated.value = true
    localStorage.setItem(STORAGE_KEY, 'true')
  } else {
    error.value = 'Incorrect password'
  }
}
</script>

<template>
  <div :class="{ 'admin-locked': locked }">
    <Layout />
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
