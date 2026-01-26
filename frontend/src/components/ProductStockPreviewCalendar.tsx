import React, { useState } from 'react';
import { Button, Space } from 'antd';
import { LeftOutlined, RightOutlined, DoubleLeftOutlined, DoubleRightOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';

interface Props {
    stockData: Record<string, number>;
}

const styles = {
    container: {
        border: '1px solid #f0f0f0',
        borderRadius: '8px',
        overflow: 'hidden',
        background: 'white',
        width: '100%',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        background: '#fafafa',
        borderBottom: '1px solid #f0f0f0',
    },
    weekHeader: {
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        textAlign: 'center' as const,
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
    },
    weekItem: {
        padding: '8px 0',
        fontWeight: 'bold',
        color: '#333',
        fontSize: '12px',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        borderBottom: '1px solid #f0f0f0',
    },
    cell: (hasData: boolean, isToday: boolean, isCurrentMonth: boolean) => ({
        height: '80px',
        padding: '4px',
        borderRight: '1px solid #f0f0f0',
        borderBottom: '1px solid #f0f0f0',
        backgroundColor: isToday ? '#fffbe6' : (isCurrentMonth ? '#fff' : '#f9f9f9'),
        opacity: isCurrentMonth ? 1 : 0.5,
        display: 'flex',
        flexDirection: 'column' as const,
        justifyContent: 'space-between',
    }),
    dateNum: {
        fontSize: '14px',
        fontWeight: 500,
        color: '#333',
    },
    stockTag: {
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#52c41a',
        textAlign: 'right' as const,
        marginTop: 'auto'
    },
    noStock: {
        fontSize: '12px',
        color: '#ccc',
        textAlign: 'right' as const,
    }
};

const ProductStockPreviewCalendar: React.FC<Props> = ({ stockData }) => {
    const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());

    const renderCalendarGrid = () => {
        const startOfMonth = currentDate.startOf('month');
        const endOfMonth = currentDate.endOf('month');

        const startDay = startOfMonth.startOf('week');
        const endDay = endOfMonth.endOf('week');

        const cells = [];
        let day = startDay;

        while (day.isBefore(endDay) || day.isSame(endDay, 'day')) {
            const str = day.format('YYYY-MM-DD');
            const stock = stockData[str];
            const isCurrentMonth = day.isSame(currentDate, 'month');
            const isToday = day.isSame(dayjs(), 'day');

            cells.push(
                <div key={str} style={styles.cell(stock !== undefined, isToday, isCurrentMonth)}>
                    <div style={styles.dateNum}>{day.date()}</div>
                    {stock !== undefined ? (
                        <div style={styles.stockTag}>
                            {stock >= 99999 ? '∞' : `余 ${stock}`}
                        </div>
                    ) : (
                        <div style={styles.noStock}>-</div>
                    )}
                </div>
            );
            day = day.add(1, 'day');
        }
        return cells;
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <Space>
                    <Button size="small" icon={<DoubleLeftOutlined />} onClick={() => setCurrentDate(currentDate.add(-1, 'year'))} />
                    <Button size="small" icon={<LeftOutlined />} onClick={() => setCurrentDate(currentDate.add(-1, 'month'))} />
                </Space>

                <Space>
                    <span style={{ fontWeight: 'bold' }}>{currentDate.year()}年 {currentDate.month() + 1}月</span>
                </Space>

                <Space>
                    <Button size="small" icon={<RightOutlined />} onClick={() => setCurrentDate(currentDate.add(1, 'month'))} />
                    <Button size="small" icon={<DoubleRightOutlined />} onClick={() => setCurrentDate(currentDate.add(1, 'year'))} />
                </Space>
            </div>

            <div style={styles.weekHeader}>
                <div style={styles.weekItem}>周日</div>
                <div style={styles.weekItem}>周一</div>
                <div style={styles.weekItem}>周二</div>
                <div style={styles.weekItem}>周三</div>
                <div style={styles.weekItem}>周四</div>
                <div style={styles.weekItem}>周五</div>
                <div style={styles.weekItem}>周六</div>
            </div>

            <div style={styles.grid}>
                {renderCalendarGrid()}
            </div>
        </div>
    );
};

export default ProductStockPreviewCalendar;
