# 产品和SKU资源详情显示功能 - 实现指南

## 概述
为产品中心和商品中心添加资源详细信息展示功能，在查看/编辑/新增产品和SKU时显示关联资源的attrs字段（门票、酒店、餐饮、交通的特定字段）。

## 已完成工作

### 1. 创建通用组件 ✅
- **文件**: `frontend/src/components/ResourceDetailsPanel.tsx`
- **功能**: 根据资源类型动态显示相应的attrs字段详情
- **支持类型**: 门票(20字段)、酒店(24字段)、餐饮(8字段)、交通(6字段)
- **展示方式**: 使用Ant Design的Descriptions组件，结构化显示

### 2. 产品编辑器集成 ✅
- **文件**: `frontend/src/pages/products/editor.tsx`
- **已添加导入**: `import ResourceDetailsPanel from '@/components/ResourceDetailsPanel'`

## 需要完成的工作

### 产品编辑器（editor.tsx）

在资源列表Table中添加expandable配置，显示资源详情：

```tsx
// 在 line 662 附近的Table组件中添加
<Table
    rowKey="key"
    columns={itemColumns}
    dataSource={items}
    pagination={false}
    expandable={{
        expandedRowRender: (record: SelectedResourceItem) => {
            const resource = resourceMap[record.resource_id]
            if (!resource) return <div style={{ padding: 16, color: '#999' }}>加载资源信息...</div>
            return <ResourceDetailsPanel resource={resource} />
        },
        rowExpandable: (record) => !!resourceMap[record.resource_id],
    }}
    footer={() => !isReadOnly ? (
        <Button type="dashed" block icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
            添加资源
        </Button>
    ) : null}
/>
```

### 产品列表（list.tsx）

在产品详情Modal中添加资源详情显示。需要：

1. 创建一个产品详情Modal
2. 在Modal中获取产品的所有资源
3. 为每个资源显示ResourceDetailsPanel

### SKU相关页面

需要查找SKU列表和编辑页面，并添加类似的资源详情展示功能。

## 实现步骤

### Step 1: 修改产品编辑器 (editor.tsx)
位置: 第662行的Table组件

添加expandable属性以支持可展开行。

### Step 2: 修改产品列表页 (list.tsx) 
需要添加：
1. 详情查看Modal
2. 在Modal中展示产品关联的所有资源详情

### Step 3: 查找并修改SKU相关页面
1. 找到SKU列表页面
2. 找到SKU编辑页面
3. 添加类似的资源详情展示

## 注意事项

1. **数据获取**: ResourceDetailsPanel需要完整的Resource对象，确保在使用前已通过API获取
2. **性能优化**: 大量资源时考虑懒加载或分页
3. **用户体验**: 使用可展开行而非新Modal，保持界面简洁
4. **一致性**: 产品和SKU页面使用相同的展示组件和交互方式

## 后续优化建议

1. 添加资源详情的打印导出功能
2. 支持资源详情的快速编辑跳转
3. 添加资源缺失字段的提示
4. 优化移动端显示效果
