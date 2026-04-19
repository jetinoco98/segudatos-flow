import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useProfile } from '../context/ProfileContext'
import { 
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Search, Plus, Pencil, X, Save, Check, Trash2, List as ListIcon, MessageSquareWarning, Table as TableIcon, Clipboard, AlertCircle, CheckCircle2, GripVertical } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEditableTable } from '../hooks/useEditableTable'

interface LookupValue {
  id: string
  category: string
  value: string
  label: string
  sort_order: number
  is_active: boolean
  status: 'new' | 'reviewed'
  added_by: string | null
}

const CATEGORIES = [
  { id: 'contract_status', label: 'Estado de Contrato' },
  { id: 'ticket_status', label: 'Estado de Ticket' },
  { id: 'ticket_type', label: 'Tipo de Ticket' },
  { id: 'ticket_subtype', label: 'Subtipo de Ticket' },
  { id: 'ticket_priority', label: 'Prioridad de Ticket' },
  { id: 'assignment_status', label: 'Estado de Asignación' },
  { id: 'settlement_status', label: 'Estado de Liquidación' },
  { id: 'ticket_file_type', label: 'Tipo de Archivo' },
  { id: 'system_type', label: 'Tipo de Sistema' },
  { id: 'billing_tag', label: 'Etiqueta de Facturación' },
  { id: 'responsible_party', label: 'Responsable' },
  { id: 'ticket_category', label: 'Categoría de Ticket' },
]

const columnHelper = createColumnHelper<LookupValue>()

interface SortableRowProps {
  row: any
  children: React.ReactNode
  isEditMode: boolean
  isDirty: boolean
  isSelected: boolean
  toggleSelect: (id: string) => void
}

function SortableRow({ row, children, isEditMode, isDirty, isSelected, toggleSelect }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.original.id, disabled: !isEditMode })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 'auto',
    position: 'relative' as const,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleRowClick = (e: React.MouseEvent) => {
    if (!isEditMode) return
    const target = e.target as HTMLElement
    // Don't toggle selection if clicking interactive elements or the drag handle
    if (target.closest('button, input, select, textarea, a, [data-dnd-handle]')) return
    toggleSelect(row.original.id)
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      onClick={handleRowClick}
      className={`transition-colors group ${
        !row.original.is_active && !isEditMode ? 'opacity-60 bg-gray-50' : ''
      } ${
        isEditMode ? 'cursor-pointer' : ''
      } ${
        isDirty 
          ? 'bg-amber-50/60 border-l-4 border-l-amber-400' 
          : isSelected && isEditMode
            ? 'bg-blue-50/30 border-l-4 border-l-blue-300'
            : 'hover:bg-gray-50/50 border-l-4 border-l-transparent'
      } ${isDragging ? 'shadow-lg bg-white ring-2 ring-blue-500/20 select-none' : ''}`}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && (child.props as any).columnId === 'dragHandle') {
          return React.cloneElement(child as React.ReactElement<any>, { 
            listeners, 
            attributes,
            isEditMode 
          })
        }
        return child
      })}
    </tr>
  )
}

export default function LookupPage() {
  const { profile } = useProfile()
  const [activeTab, setActiveTab] = useState<'valores' | 'sugerencias'>('valores')
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].id)
  
  const [data, setData] = useState<LookupValue[]>([])
  const [suggestions, setSuggestions] = useState<LookupValue[]>([])
  const [loading, setLoading] = useState(true)

  // Modal State for Creation
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingValue, setEditingValue] = useState<LookupValue | null>(null)
  
  // Form State for Creation
  const [formLabel, setFormLabel] = useState('')
  const [formValue, setFormValue] = useState('')
  const [formSortOrder, setFormSortOrder] = useState('0')
  const [formIsActive, setFormIsActive] = useState(true)
  const [formStatus, setFormStatus] = useState<'new' | 'reviewed'>('reviewed')

  const [searchQuery, setSearchQuery] = useState('')

  const handleSaveAll = async (pendingChanges: Map<string, Partial<LookupValue>>) => {
    const promises = Array.from(pendingChanges.entries()).map(([id, changes]) =>
      supabase.from('lookup_values').update(changes).eq('id', id)
    )
    await Promise.all(promises)
    fetchData()
  }

  const {
    isEditMode, enterEditMode, cancelEditMode,
    selectedIds, toggleSelect, toggleSelectAll,
    pendingChanges, handleFieldChange, getEffectiveValue,
    saving, handleSave, changeCount,
    isBatchModalOpen, setIsBatchModalOpen,
    batchData, setBatchData
  } = useEditableTable<LookupValue>({
    data,
    onSave: handleSaveAll
  })

  // DND Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: allLookups } = await supabase
      .from('lookup_values')
      .select('*')
      .order('sort_order', { ascending: true })
      
    if (allLookups) {
      setData(allLookups.filter(v => v.status === 'reviewed' || v.category === activeCategory))
      setSuggestions(allLookups.filter(v => v.status === 'new'))
    }
    setLoading(false)
  }

  // Derived data for tables
  const currentCategoryData = useMemo(() => {
    let filtered = data.filter(v => v.category === activeCategory)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(v => v.label.toLowerCase().includes(q) || v.value.toLowerCase().includes(q))
    }
    return filtered.sort((a, b) => a.sort_order - b.sort_order)
  }, [data, activeCategory, searchQuery])

  // Helpers
  const autoSnakeCase = (text: string) => {
    return text.trim().toLowerCase()
      .replace(/[\s-]+/g, '_')
      .replace(/[^\w_]/g, '')
  }

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setFormLabel(val)
    if (!editingValue) {
      setFormValue(autoSnakeCase(val))
    }
  }

  // Modal Actions (Creation only)
  const openAddModal = () => {
    setEditingValue(null)
    setFormLabel('')
    setFormValue('')
    setFormSortOrder((currentCategoryData.length + 1).toString())
    setFormIsActive(true)
    setFormStatus('reviewed')
    setIsModalOpen(true)
  }

  const handleAddSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        category: activeCategory,
        label: formLabel,
        value: formValue || autoSnakeCase(formLabel),
        sort_order: parseInt(formSortOrder) || 0,
        is_active: formIsActive,
        status: formStatus,
        added_by: profile?.id
      }

      await supabase.from('lookup_values').insert(payload)
      setIsModalOpen(false)
      fetchData()
    } catch (err) {
      console.error(err)
      alert("Error saving lookup value")
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    if (over && active.id !== over.id) {
      const oldIndex = currentCategoryData.findIndex(v => v.id === active.id)
      const newIndex = currentCategoryData.findIndex(v => v.id === over.id)
      
      const newOrder = arrayMove(currentCategoryData, oldIndex, newIndex)
      
      // Update sort_order for all items to be sequential 1, 2, 3...
      newOrder.forEach((item, index) => {
        const sequentialOrder = index + 1
        if (item.sort_order !== sequentialOrder) {
          handleFieldChange(item.id, 'sort_order', sequentialOrder)
        }
      })
    }
  }

  // --- Batch Add Logic ---
  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text')
    if (!text) return

    const rows = text.split(/\r?\n/).filter(line => line.trim() !== '')
    const parsed = rows.map((row, index) => {
      const cols = row.split('\t')
      
      const label = cols[0]?.trim() || ''
      const value = cols[1]?.trim() || autoSnakeCase(label)
      
      const rawStatus = cols[2]?.trim().toLowerCase() || ''
      const isActive = !['inactivo', 'inactive', '0', 'false', 'no'].includes(rawStatus)
      
      const rawReview = cols[3]?.trim().toLowerCase() || ''
      const status: 'new' | 'reviewed' = ['new', 'sugerencia', 'nuevo'].includes(rawReview) ? 'new' : 'reviewed'

      // Automatic sort order: current length + index + 1
      const sortOrder = currentCategoryData.length + index + 1

      return { 
        category: activeCategory,
        label, 
        value, 
        sort_order: sortOrder, 
        is_active: isActive, 
        status,
        isValid: label && value 
      }
    })

    setBatchData(parsed)
  }

  const handleBatchImport = async () => {
    const validRows = batchData.filter(r => r.isValid)
    if (validRows.length === 0) return
    
    try {
      const toInsert = validRows.map(({ isValid, ...rest }) => ({
        ...rest,
        added_by: profile?.id
      }))
      const { error } = await supabase.from('lookup_values').insert(toInsert)
      if (error) throw error
      
      setIsBatchModalOpen(false)
      setBatchData([])
      fetchData()
    } catch (err) {
      console.error('Error in batch import:', err)
      alert('Error al importar valores. Verifique que los valores internos no estén duplicados.')
    }
  }

  const handleApproveSuggestion = async (item: LookupValue) => {
    await supabase.from('lookup_values').update({ status: 'reviewed', is_active: true }).eq('id', item.id)
    fetchData()
  }

  const handleDeleteSuggestion = async (item: LookupValue) => {
    if (confirm(`¿Estás seguro de que deseas eliminar la sugerencia "${item.label}"?`)) {
      await supabase.from('lookup_values').delete().eq('id', item.id)
      fetchData()
    }
  }

  // Tables Setup
  const mainColumns = useMemo(() => {
    const cols = []

    if (isEditMode) {
      cols.push(
        columnHelper.display({
          id: 'dragHandle',
          header: '',
          cell: (props: any) => (
            <div 
              {...props.listeners} 
              {...props.attributes}
              data-dnd-handle
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors select-none touch-none"
            >
              <GripVertical size={16} />
            </div>
          ),
        }),
        columnHelper.display({
          id: 'select',
          header: () => (
            <input
              type="checkbox"
              checked={currentCategoryData.length > 0 && selectedIds.size === currentCategoryData.length}
              onChange={() => toggleSelectAll(currentCategoryData.map(v => v.id))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          ),
          cell: props => (
            <input
              type="checkbox"
              checked={selectedIds.has(props.row.original.id)}
              onChange={(e) => {
                e.stopPropagation() // Prevent row click from triggering twice
                toggleSelect(props.row.original.id)
              }}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          ),
        })
      )
    }

    cols.push(
      columnHelper.accessor('sort_order', {
        header: 'Orden',
        cell: info => {
          const item = info.row.original
          const effectiveValue = getEffectiveValue(item, 'sort_order') as number
          return <span className="text-gray-500 font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{effectiveValue}</span>
        },
      }),
      columnHelper.accessor('label', {
        header: 'Etiqueta (UI)',
        cell: info => {
          const item = info.row.original
          const effectiveValue = getEffectiveValue(item, 'label') as string
          if (!isEditMode) {
            return <span className="font-medium text-gray-900">{effectiveValue}</span>
          }
          return (
            <Input 
              value={effectiveValue}
              onChange={e => handleFieldChange(item.id, 'label', e.target.value)}
              className="h-8 text-sm min-w-[120px]"
            />
          )
        },
      }),
      columnHelper.accessor('value', {
        header: 'Valor Interno (BD)',
        cell: info => <span className="text-gray-500 font-mono text-xs">{info.getValue()}</span>,
      }),
      columnHelper.accessor('is_active', {
        header: 'Estado',
        cell: info => {
          const item = info.row.original
          const active = getEffectiveValue(item, 'is_active') as boolean
          if (!isEditMode) {
            return (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {active ? 'Activo' : 'Inactivo'}
              </span>
            )
          }
          return (
            <button
              onClick={() => handleFieldChange(item.id, 'is_active', !active)}
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                active ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-200' : 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200'
              }`}
            >
              {active ? 'Activo' : 'Inactivo'}
            </button>
          )
        },
      }),
      columnHelper.accessor('status', {
        header: 'Revisión',
        cell: info => {
          const item = info.row.original
          const status = getEffectiveValue(item, 'status') as string
          const isReviewed = status === 'reviewed'
          
          if (!isEditMode) {
            if (!isReviewed) {
              return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700">Sugerencia</span>
            }
            return <span className="text-gray-400 text-xs flex items-center gap-1"><Check size={12}/> Revisado</span>
          }
          
          return (
            <button
              onClick={() => handleFieldChange(item.id, 'status', isReviewed ? 'new' : 'reviewed')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                isReviewed 
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100' 
                  : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              {isReviewed ? (
                <>
                  <CheckCircle2 size={14} className="text-blue-600" />
                  <span>Revisado</span>
                </>
              ) : (
                <>
                  <AlertCircle size={14} className="text-amber-600" />
                  <span>Sugerencia</span>
                </>
              )}
            </button>
          )
        },
      })
    )

    return cols
  }, [isEditMode, selectedIds, pendingChanges, currentCategoryData, toggleSelect, toggleSelectAll, handleFieldChange, getEffectiveValue])

  const mainTable = useReactTable({
    data: currentCategoryData,
    columns: mainColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="p-8 h-full flex flex-col max-w-7xl mx-auto">
      {/* Header & Tabs */}
      <div className="flex items-end justify-between mb-8 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">Valores de Lista</h1>
          <div className="flex gap-6 text-sm font-medium">
            <button
              onClick={() => setActiveTab('valores')}
              className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'valores' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <ListIcon size={16} />
              Listas de Sistema
            </button>
            <button
              onClick={() => setActiveTab('sugerencias')}
              className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'sugerencias' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <MessageSquareWarning size={16} />
              Sugerencias Pendientes
              {suggestions.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'sugerencias' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                  {suggestions.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'valores' && (
        <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
          {/* Sidebar Category Selector */}
          <div className="w-64 shrink-0 flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-3 border-b border-gray-100 bg-gray-50/50">
              <span className="text-xs font-semibold text-gray-500 tracking-wider uppercase">Categorías</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id)
                    setSearchQuery('')
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all mb-1 ${
                    activeCategory === cat.id 
                      ? 'bg-blue-50 text-blue-700 font-medium' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main Table Area */}
          <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm min-w-0">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <Input 
                  placeholder="Buscar en esta categoría..." 
                  className="pl-9 h-9 bg-white"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                {!isEditMode ? (
                  <>
                    <Button
                      onClick={enterEditMode}
                      variant="outline"
                      className="h-9 gap-2"
                    >
                      <Pencil size={15} />
                      Editar
                    </Button>
                    <Button
                      onClick={() => setIsBatchModalOpen(true)}
                      variant="outline"
                      className="h-9 gap-2 border-dashed border-2 hover:border-blue-400 hover:bg-blue-50"
                    >
                      <TableIcon size={15} />
                      Carga Masiva
                    </Button>
                    <Button onClick={openAddModal} className="bg-blue-600 hover:bg-blue-700 text-white h-9">
                      <Plus size={16} className="mr-2" />
                      Añadir Valor
                    </Button>
                  </>
                ) : (
                  <>
                    {changeCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                        {changeCount} cambio{changeCount !== 1 ? 's' : ''} pendiente{changeCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    <Button
                      onClick={cancelEditMode}
                      variant="outline"
                      className="h-9 gap-2"
                    >
                      <X size={15} />
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={changeCount === 0 || saving}
                      className="bg-blue-600 hover:bg-blue-700 text-white h-9 gap-2 disabled:opacity-50"
                    >
                      <Save size={15} />
                      {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-5 h-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 border-b border-gray-200 z-10">
                      {mainTable.getHeaderGroups().map(headerGroup => (
                        <tr key={headerGroup.id}>
                          {headerGroup.headers.map(header => (
                            <th key={header.id} className="px-6 py-3.5 font-medium tracking-wider">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <SortableContext
                        items={currentCategoryData.map(v => v.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {mainTable.getRowModel().rows.map(row => {
                          const isDirty = pendingChanges.has(row.original.id)
                          const isSelected = selectedIds.has(row.original.id)
                          return (
                            <SortableRow
                              key={row.id}
                              row={row}
                              isEditMode={isEditMode}
                              isDirty={isDirty}
                              isSelected={isSelected}
                              toggleSelect={toggleSelect}
                            >
                              {row.getVisibleCells().map(cell => (
                                <td 
                                  key={cell.id} 
                                  {...({ columnId: cell.column.id } as any)}
                                  className={`px-6 py-3 whitespace-nowrap ${cell.column.id === 'select' ? 'w-12 px-4' : ''} ${cell.column.id === 'dragHandle' ? 'w-8 px-2' : ''}`}
                                >
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                              ))}
                            </SortableRow>
                          )
                        })}
                      </SortableContext>
                      {currentCategoryData.length === 0 && (
                        <tr>
                          <td colSpan={mainColumns.length} className="px-6 py-12 text-center text-gray-500">
                            No se encontraron valores en esta categoría
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </DndContext>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sugerencias' && (
        <div className="flex-1 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col shadow-sm">
          <div className="p-4 border-b border-gray-100 bg-amber-50/30">
            <h2 className="text-sm font-medium text-amber-800">Sugerencias de Valores</h2>
            <p className="text-xs text-amber-600 mt-0.5">Estos valores fueron añadidos por el equipo operativo y esperan revisión para ser oficializados o rechazados.</p>
          </div>
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-5 h-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
              </div>
            ) : suggestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Check size={48} className="mb-4 text-green-100" strokeWidth={1} />
                <p>No hay sugerencias pendientes de revisión.</p>
              </div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 border-b border-gray-200 z-10">
                  <tr>
                    <th className="px-6 py-3.5 font-medium tracking-wider">Categoría</th>
                    <th className="px-6 py-3.5 font-medium tracking-wider">Etiqueta Sugerida</th>
                    <th className="px-6 py-3.5 font-medium tracking-wider">Valor (BD)</th>
                    <th className="px-6 py-3.5 font-medium tracking-wider text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {suggestions.map(sug => (
                    <tr key={sug.id} className="hover:bg-amber-50/20 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {sug.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{sug.label}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-500">{sug.value}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="h-8 border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => handleApproveSuggestion(sug)}>
                            <Check size={14} className="mr-1.5" /> Aprobar
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteSuggestion(sug)}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Modal (Creation only) */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Añadir Valor de Lista
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddSave} className="p-6 flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">Etiqueta (UI)</label>
                <Input 
                  required 
                  value={formLabel} 
                  onChange={handleLabelChange} 
                  placeholder="Ej. Activo"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">Valor Interno (BD)</label>
                <Input 
                  required 
                  value={formValue} 
                  onChange={e => setFormValue(e.target.value)} 
                  placeholder="ej_activo"
                />
                <p className="text-[10px] text-gray-400">Este valor no se puede cambiar después y se usa en la base de datos.</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Orden</label>
                  <Input 
                    type="number"
                    value={formSortOrder} 
                    onChange={e => setFormSortOrder(e.target.value)} 
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Estado Inicial</label>
                  <select 
                    className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:border-ring"
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value as any)}
                  >
                    <option value="reviewed">Revisado (Activo)</option>
                    <option value="new">Sugerencia (Pendiente)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-2">
                <input 
                  type="checkbox" 
                  id="isActive" 
                  checked={formIsActive}
                  onChange={e => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700 select-none cursor-pointer">
                  Habilitado por defecto
                </label>
              </div>

              <div className="pt-4 flex gap-3 justify-end border-t border-gray-100 mt-2">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white min-w-[100px]">
                  Guardar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Add Modal */}
      {isBatchModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => { setIsBatchModalOpen(false); setBatchData([]) }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <TableIcon className="text-blue-600" />
                  Carga Masiva de Valores
                </h2>
                <p className="text-sm text-gray-500">Categoría: {CATEGORIES.find(c => c.id === activeCategory)?.label}</p>
              </div>
              <button onClick={() => { setIsBatchModalOpen(false); setBatchData([]) }} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {batchData.length === 0 ? (
                <div 
                  className="h-64 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-4 bg-gray-50/50 hover:bg-blue-50/30 hover:border-blue-300 transition-all group"
                  onPaste={handlePaste}
                  tabIndex={0}
                >
                  <div className="p-4 rounded-full bg-white shadow-sm group-hover:scale-110 transition-transform">
                    <Clipboard className="text-blue-500" size={32} />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-gray-700">Haga clic aquí y pegue su contenido (Ctrl + V)</p>
                    <p className="text-xs text-gray-500 mt-1">Orden: Etiqueta, Valor Interno, Estado (opcional), Revisión (opcional)</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="text-blue-600" size={20} />
                      <div>
                        <p className="text-sm font-bold text-blue-900">{batchData.length} filas detectadas</p>
                        <p className="text-xs text-blue-700">{batchData.filter(r => r.isValid).length} listas para importar</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setBatchData([])} className="h-8">
                      Limpiar y Pegar de Nuevo
                    </Button>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Etiqueta</th>
                          <th className="px-4 py-3 font-semibold">Valor (BD)</th>
                          <th className="px-4 py-3 font-semibold">Estado</th>
                          <th className="px-4 py-3 font-semibold">Revisión</th>
                          <th className="px-4 py-3 font-semibold text-center">Validez</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {batchData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50">
                            <td className="px-4 py-3 font-medium">{row.label}</td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.value}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                {row.is_active ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.status === 'reviewed' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                {row.status === 'reviewed' ? 'Revisado' : 'Sugerencia'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {row.isValid ? (
                                <CheckCircle2 size={16} className="text-green-500 mx-auto" />
                              ) : (
                                <AlertCircle size={16} className="text-red-500 mx-auto" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0">
              <Button variant="outline" onClick={() => { setIsBatchModalOpen(false); setBatchData([]) }}>
                Cancelar
              </Button>
              <Button 
                onClick={handleBatchImport} 
                disabled={saving || batchData.filter(r => r.isValid).length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px] gap-2 shadow-lg shadow-blue-500/20"
              >
                <Save size={16} />
                {saving ? 'Importando...' : `Importar ${batchData.filter(r => r.isValid).length} Valores`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
