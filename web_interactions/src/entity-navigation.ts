import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useInteractions } from './module'
import { errorMessage } from './api/client'
export function useEntityNavigation() {
 const router = useRouter(), interactions = useInteractions()
 const navigationError = ref(''), navigating = ref(false)
 async function openEntity(id: string) {
  if (navigating.value) return false
  navigating.value = true; navigationError.value = ''
  try {
   const target = await interactions.resolveEntityRoute(id)
   if (!target) { navigationError.value = '未找到可访问的对象详情，请刷新后重试'; return false }
   await router.push(target); return true
  } catch (error) { navigationError.value = errorMessage(error); return false }
  finally { navigating.value = false }
 }
 return { openEntity, navigationError, navigating }
}
