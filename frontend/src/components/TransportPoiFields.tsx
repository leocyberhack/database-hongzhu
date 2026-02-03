import React from 'react'

/**
 * 交通POI的通用字段组件
 * 目前交通类POI没有额外的通用属性定义
 */
export default function TransportPoiFields() {
    return (
        <div style={{ marginTop: 16, padding: 12, background: '#f0f0f0', borderRadius: 4, color: '#999', textAlign: 'center', border: '1px dashed #d9d9d9' }}>
            <span style={{ fontSize: 12 }}>🚍 交通类资源暂无特定通用属性，请直接填写基本信息</span>
        </div>
    )
}
