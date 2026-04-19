import { useState, useCallback } from 'react'

interface UseEditableTableProps<T> {
  data: T[]
  onSave?: (changes: Map<string, Partial<T>>) => Promise<void>
  initialEditMode?: boolean
}

export function useEditableTable<T extends { id: string }>({ 
  data, 
  onSave,
  initialEditMode = false 
}: UseEditableTableProps<T>) {
  const [isEditMode, setIsEditMode] = useState(initialEditMode)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pendingChanges, setPendingChanges] = useState<Map<string, Partial<T>>>(new Map())
  const [saving, setSaving] = useState(false)
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
  const [batchData, setBatchData] = useState<any[]>([])

  const enterEditMode = useCallback(() => {
    setIsEditMode(true)
    setSelectedIds(new Set())
    setPendingChanges(new Map())
  }, [])

  const cancelEditMode = useCallback(() => {
    setIsEditMode(false)
    setSelectedIds(new Set())
    setPendingChanges(new Map())
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback((ids: string[]) => {
    if (selectedIds.size === ids.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(ids))
    }
  }, [selectedIds.size])

  const applyChange = useCallback((ids: string[], field: keyof T, value: any) => {
    setPendingChanges(prev => {
      const next = new Map(prev)
      for (const id of ids) {
        const existing = next.get(id) || {}
        const original = data.find(item => item.id === id)
        if (!original) continue
        
        const updated = { ...existing, [field]: value }
        
        // If the value matches the original, remove this field from pending
        if (original[field] === value) {
          delete (updated as any)[field]
        }
        
        if (Object.keys(updated).length === 0) {
          next.delete(id)
        } else {
          next.set(id, updated)
        }
      }
      return next
    })
  }, [data])

  const handleFieldChange = useCallback((id: string, field: keyof T, value: any) => {
    const targetIds = selectedIds.size > 0 && selectedIds.has(id)
      ? Array.from(selectedIds)
      : [id]
    applyChange(targetIds, field, value)
  }, [selectedIds, applyChange])

  const getEffectiveValue = useCallback((item: T, field: keyof T) => {
    const changes = pendingChanges.get(item.id)
    if (changes && field in changes) return (changes as any)[field]
    return item[field]
  }, [pendingChanges])

  const handleSave = async () => {
    if (!onSave || pendingChanges.size === 0) return
    setSaving(true)
    try {
      await onSave(pendingChanges)
      cancelEditMode()
    } catch (err) {
      console.error('Error saving changes:', err)
      throw err
    } finally {
      setSaving(false)
    }
  }

  return {
    isEditMode, setIsEditMode,
    selectedIds, setSelectedIds,
    pendingChanges, setPendingChanges,
    saving, setSaving,
    isBatchModalOpen, setIsBatchModalOpen,
    batchData, setBatchData,
    enterEditMode, cancelEditMode,
    toggleSelect, toggleSelectAll,
    handleFieldChange, getEffectiveValue,
    handleSave,
    changeCount: pendingChanges.size
  }
}
