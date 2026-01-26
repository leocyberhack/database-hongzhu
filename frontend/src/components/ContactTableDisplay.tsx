import type { ReactNode } from 'react'

interface ContactTableDisplayProps {
    contacts?: Array<{
        name?: string
        phone?: string
        email?: string
        position?: string
        remark?: string
    }>
    showRemark?: boolean
    headerLabels?: string[]
    emptyText?: ReactNode
}

export default function ContactTableDisplay({
    contacts = [],
    showRemark = false,
    headerLabels,
    emptyText = '-',
}: ContactTableDisplayProps) {
    const rows = Array.isArray(contacts) ? contacts : []
    if (rows.length === 0) {
        return <span style={{ color: '#999' }}>{emptyText}</span>
    }

    const gridTemplateColumns = showRemark
        ? '1.1fr 1.1fr 1.5fr 1fr 1.6fr'
        : '1.2fr 1.2fr 1.6fr 1fr'
    const expectedLabelCount = showRemark ? 5 : 4
    const fallbackLabels = showRemark
        ? ['Name', 'Phone', 'Email', 'Position', 'Remark']
        : ['Name', 'Phone', 'Email', 'Position']
    const labels = headerLabels && headerLabels.length === expectedLabelCount
        ? headerLabels
        : fallbackLabels

    return (
        <div
            style={{
                border: '1px solid #e6e9f0',
                borderRadius: 12,
                padding: 12,
                background: 'linear-gradient(180deg, #fbfcff 0%, #ffffff 100%)',
            }}
        >
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns,
                    gap: 12,
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: '#f2f5fb',
                    color: '#495066',
                    fontWeight: 600,
                    fontSize: 12,
                    letterSpacing: 0.4,
                }}
            >
                {labels.map((label, index) => (
                    <span key={`contact-head-${index}`}>{label}</span>
                ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                {rows.map((contact, index) => (
                    <div
                        key={`contact-row-${index}`}
                        style={{
                            display: 'grid',
                            gridTemplateColumns,
                            gap: 12,
                            alignItems: 'center',
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1px solid #edf0f5',
                            background: '#fff',
                            boxShadow: '0 1px 0 rgba(15, 23, 42, 0.03)',
                            fontSize: 12,
                            color: '#2b2f36',
                        }}
                    >
                        <span>{contact?.name || '-'}</span>
                        <span>{contact?.phone || '-'}</span>
                        <span>{contact?.email || '-'}</span>
                        <span>{contact?.position || '-'}</span>
                        {showRemark && <span>{contact?.remark || '-'}</span>}
                    </div>
                ))}
            </div>
        </div>
    )
}
