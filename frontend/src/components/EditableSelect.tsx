import React, { useState, useRef, useMemo } from 'react'
import { Select, Divider, Space, Input, Button, type InputRef, Tooltip } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons'
import type { SelectProps } from 'antd'

interface EditableSelectProps extends Omit<SelectProps<string>, 'options'> {
    defaultOptions: string[]
    customOptions?: string[] // External controlled options, renamed to avoid conflict
    // Unified change handler (preferred)
    onOptionsChange?: (options: string[]) => void
    // Legacy granular handlers (kept for backward compatibility or specific use cases)
    onOptionAdd?: (option: string) => void
    onOptionDelete?: (option: string) => void
    onOptionRename?: (oldVal: string, newVal: string) => void
}

export default function EditableSelect({ defaultOptions, customOptions, onOptionsChange, onOptionAdd, onOptionDelete, onOptionRename, ...props }: EditableSelectProps) {
    const [internalItems, setInternalItems] = useState<string[]>(defaultOptions)
    const items = customOptions || internalItems

    const [name, setName] = useState('')
    const [editingItem, setEditingItem] = useState<string | null>(null) // Contains the original string value of the item being edited
    const [editValue, setEditValue] = useState('')

    const inputRef = useRef<InputRef>(null)
    const editInputRef = useRef<InputRef>(null)

    const onNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setName(event.target.value)
    }

    const addItem = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
        e.preventDefault()
        if (!name) return
        if (!items.includes(name)) {
            if (onOptionsChange) {
                onOptionsChange([...items, name])
            } else if (onOptionAdd) {
                onOptionAdd(name)
            } else {
                setInternalItems([...internalItems, name])
            }
        }
        setName('')
        setTimeout(() => {
            inputRef.current?.focus()
        }, 0)
    }

    const deleteItem = (e: React.MouseEvent, itemToDelete: string) => {
        e.preventDefault()
        e.stopPropagation()
        if (onOptionsChange) {
            onOptionsChange(items.filter(item => item !== itemToDelete))
        } else if (onOptionDelete) {
            onOptionDelete(itemToDelete)
        } else {
            setInternalItems(internalItems.filter(item => item !== itemToDelete))
        }
    }

    const startEdit = (e: React.MouseEvent, item: string) => {
        e.preventDefault()
        e.stopPropagation()
        setEditingItem(item)
        setEditValue(item)
        setTimeout(() => {
            editInputRef.current?.focus()
        }, 0)
    }

    const saveEdit = (e: React.MouseEvent | React.KeyboardEvent | React.ChangeEvent) => {
        // e might be propagated from Input onPressEnter
        e.stopPropagation()
        if (editingItem && editValue.trim()) {
            const newValue = editValue.trim()
            // If replacing with same value, do nothing
            if (newValue === editingItem) {
                cancelEdit(e as React.MouseEvent)
                return
            }
            // Check duplications: if new value already exists, just remove the old one (merge) or alert?
            // Simple logic: update the item.
            if (onOptionsChange) {
                const newItems = items.map(item => item === editingItem ? newValue : item)
                // Filter duplicates if any
                onOptionsChange(Array.from(new Set(newItems)))
            } else if (onOptionRename) {
                onOptionRename(editingItem, newValue)
            } else {
                const newItems = internalItems.map(item => item === editingItem ? newValue : item)
                setInternalItems(Array.from(new Set(newItems)))
            }

            setEditingItem(null)
            setEditValue('')
        }
    }

    const cancelEdit = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setEditingItem(null)
        setEditValue('')
    }

    // Ensure the current value is in the options list (and handle transient value display)
    // We treat transient value as a temporary option but not editable unless added to list
    const finalOptions = useMemo(() => {
        const result = [...items]
        if (props.value && !result.includes(props.value)) {
            result.push(props.value)
        }
        return result
    }, [items, props.value])

    const renderOptionLabel = (item: string) => {
        // If this item is being edited
        if (editingItem === item) {
            return (
                <div
                    onClick={e => e.stopPropagation()}
                    onMouseDown={e => e.preventDefault()} // Prevent Select from stealing focus or selecting
                    style={{ display: 'flex', alignItems: 'center', padding: '4px 0' }}
                >
                    <Input
                        ref={editInputRef}
                        size="small"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onPressEnter={saveEdit}
                        style={{ marginRight: 8, flex: 1 }}
                        onClick={e => e.stopPropagation()}
                    />
                    <Button type="text" size="small" icon={<CheckOutlined style={{ color: 'green' }} />} onClick={saveEdit} />
                    <Button type="text" size="small" icon={<CloseOutlined style={{ color: 'red' }} />} onClick={cancelEdit} />
                </div>
            )
        }

        // Normal display
        // Only show edit/delete for items in the managed list. Transient current value is read-only unless added.
        const isManaged = items.includes(item)

        return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item}</span>
                {isManaged && (
                    <Space size={0} className="option-actions">
                        <Tooltip title="重命名">
                            <Button type="text" size="small" icon={<EditOutlined style={{ fontSize: 12 }} />} onClick={(e) => startEdit(e, item)} />
                        </Tooltip>
                        <Tooltip title="删除">
                            <Button type="text" size="small" danger icon={<DeleteOutlined style={{ fontSize: 12 }} />} onClick={(e) => deleteItem(e, item)} />
                        </Tooltip>
                    </Space>
                )}
            </div>
        )
    }

    return (
        <Select
            {...props}
            showSearch
            optionLabelProp="value" // Important: display the plain value string in the selection box, not the complex label node
            options={finalOptions.map((item) => ({
                label: renderOptionLabel(item), // Complex UI in dropdown
                value: item                     // Simple string for form value
            }))}
            dropdownRender={(menu) => (
                <>
                    {menu}
                    <Divider style={{ margin: '8px 0' }} />
                    <Space style={{ padding: '0 8px 4px', width: '100%' }}>
                        <Input
                            placeholder="自定义选项"
                            ref={inputRef}
                            value={name}
                            onChange={onNameChange}
                            onKeyDown={(e) => e.stopPropagation()}
                        />
                        <Button type="text" icon={<PlusOutlined />} onClick={addItem}>
                            添加
                        </Button>
                    </Space>
                </>
            )}
        />
    )
}
