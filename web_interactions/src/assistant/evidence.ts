import { ApiError, errorMessage } from '../api/client'
import type { Answer, KnowledgeDocument } from '../types/api'

export function readAnswer(raw: unknown): Answer {
  if (!raw || typeof raw !== 'object') throw new Error('问答接口返回格式无效')
  const result = raw as Answer
  if (typeof result.answer !== 'string' || typeof result.conversation_id !== 'string' || !['answered', 'insufficient_evidence', 'metric_tool_unavailable'].includes(result.status) || !Array.isArray(result.citations) || !Array.isArray(result.limitations) || !Array.isArray(result.used_metric_queries) || result.citations.some(c => !c || typeof c.id !== 'string' || !c.id || typeof c.title !== 'string' || !['metric', 'document', 'event'].includes(c.type))) throw new Error('问答接口的回答或引用身份不符合约定')
  return result
}
export function evidenceState(doc: KnowledgeDocument, now = Date.now()) {
  if (doc.index_status && doc.index_status !== 'ready') return '索引未就绪：资料仍在处理或索引失败，不能据此确认当前事实。'
  if (doc.valid_until && Date.parse(doc.valid_until.length === 10 ? `${doc.valid_until}T23:59:59+08:00` : doc.valid_until) < now) return '历史资料：适用期已结束，不能作为当前事实。'
  if (doc.valid_from && Date.parse(doc.valid_from.length === 10 ? `${doc.valid_from}T00:00:00+08:00` : doc.valid_from) > now) return '资料尚未到适用期，不能作为当前事实。'
  if (!doc.valid_until) return '未提供适用期终点；请核验资料时效，历史公告不能直接作为当前事实。'
  return '适用期来自资料元数据；资料中的历史数值不代表当前数值。'
}
export function assistantError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return '登录已失效，请重新登录。'
    if (error.status === 403) return '无权查看该资料，请联系管理员确认授权。'
    if (error.status === 503 || error.status === 0) return `依赖不可用：暂时不能检索或核验资料。${error.code === 'dependency_not_available' ? '' : errorMessage(error)}`
  }
  return errorMessage(error)
}
