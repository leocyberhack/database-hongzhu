import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Card, Button, InputNumber, Row, Col, message, Spin, Space, DatePicker, Select } from 'antd';
import { LeftOutlined, RightOutlined, DoubleLeftOutlined, DoubleRightOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { apiRequest } from '@/lib/api';

dayjs.extend(isBetween);

const { RangePicker } = DatePicker;
const { Option } = Select;

// ----------------------------------------------------------------------
// Styles (CSS-in-JS)
// ----------------------------------------------------------------------
const styles = {
    container: {
        border: '1px solid #f0f0f0',
        borderRadius: '8px',
        overflow: 'hidden',
        background: 'white',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px',
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
        padding: '12px 0',
        fontWeight: 'bold',
        color: '#333',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
    },
    cell: (isSelected: boolean, isInRange: boolean, isToday: boolean, disabled: boolean) => {
        const style: React.CSSProperties = {
            height: '100px',
            padding: '8px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            backgroundColor: isSelected ? '#e6f7ff' : (isInRange ? '#f0faff' : (isToday ? '#fffbe6' : '#fff')),
            boxSizing: 'border-box',
            transition: 'all 0.2s',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            opacity: disabled ? 0.4 : 1,
        };

        if (isSelected) {
            style.border = '2px solid #1890ff';
            style.zIndex = 1;
        } else {
            style.borderRight = '1px solid #f0f0f0';
            style.borderBottom = '1px solid #f0f0f0';
        }
        return style;
    },
    dateNum: {
        fontSize: '14px',
        fontWeight: 500,
    },
    dataContent: {
        fontSize: '12px',
        textAlign: 'right' as const,
    },
    priceTag: {
        color: '#ff4d4f',
        fontWeight: 'bold',
        display: 'block',
    },
    stockTag: {
        color: '#52c41a',
        display: 'block',
    }
};


// ----------------------------------------------------------------------
// Types & Props
// ----------------------------------------------------------------------
export interface SKUCalendarEditorRef {
    saveToBackend: (skuId: number, channelId: number) => Promise<void>;
}

interface Props {
    skuId?: number; // Check if editing existing SKU
}

interface DayData {
    price?: number;
    stock?: number;
}

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------
const SKUCalendarEditor = forwardRef<SKUCalendarEditorRef, Props>((props, ref) => {
    const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());
    const [selection, setSelection] = useState<{ start: Dayjs | null; end: Dayjs | null }>({ start: null, end: null });
    const [localData, setLocalData] = useState<Record<string, DayData>>({});
    const [loading, setLoading] = useState(false);

    // Inputs
    const [inputPrice, setInputPrice] = useState<number | null>(null);
    const [inputStock, setInputStock] = useState<number | null>(null);

    // Initial load
    useEffect(() => {
        if (props.skuId) {
            fetchData(props.skuId);
        } else {
            setLocalData({});
        }
    }, [props.skuId]);

    // When selection changes via click, update inputs if a single day or range is selected and has data
    useEffect(() => {
        if (selection.start && selection.end && selection.start.isSame(selection.end, 'day')) {
            const dateStr = selection.start.format('YYYY-MM-DD');
            const data = localData[dateStr];
            if (data) {
                setInputPrice(data.price ?? null);
                setInputStock(data.stock ?? null);
                return;
            }
        }
    }, [selection, localData]);


    // ----------------------------------------------------------------------
    // API Actions
    // ----------------------------------------------------------------------
    const fetchData = async (skuId: number) => {
        setLoading(true);
        try {
            const invStep = await apiRequest(`/api/inventory?sku_id=${skuId}&page_size=365`) as any;
            const priceStep = await apiRequest(`/api/prices?sku_id=${skuId}&page_size=100`) as any;

            const newData: Record<string, DayData> = {};

            // Map Inventory
            (invStep.items || []).forEach((item: any) => {
                if (item.inventory_date) {
                    const d = dayjs(item.inventory_date).format('YYYY-MM-DD');
                    if (!newData[d]) newData[d] = {};
                    newData[d].stock = item.total_qty;
                }
            });

            // Map Prices
            (priceStep.items || []).forEach((item: any) => {
                const start = dayjs(item.start_at);
                const end = dayjs(item.end_at);
                const days = end.diff(start, 'day');

                for (let i = 0; i <= days; i++) {
                    const d = start.add(i, 'day').format('YYYY-MM-DD');
                    if (!newData[d]) newData[d] = {};
                    newData[d].price = item.sale_price;
                }
            });

            setLocalData(newData);

        } catch (err) {
            console.error(err);
            message.error("加载价格/库存数据失败");
        } finally {
            setLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({
        saveToBackend: async (skuId: number, channelId: number) => {
            if (!skuId || !channelId) {
                console.error("Missing SKU ID or Channel ID");
                return;
            }

            const dates = Object.keys(localData).sort();
            if (dates.length === 0) return;

            // 1. Group Price Segments
            const priceSegments: { start: string, end: string, price: number }[] = [];
            let currentPriceSeg: { start: string, end: string, price: number } | null = null;

            for (const date of dates) {
                const data = localData[date];
                if (data.price === undefined) continue;

                if (!currentPriceSeg) {
                    currentPriceSeg = { start: date, end: date, price: data.price };
                } else {
                    const nextDate = dayjs(currentPriceSeg.end).add(1, 'day').format('YYYY-MM-DD');
                    if (date === nextDate && data.price === currentPriceSeg.price) {
                        currentPriceSeg.end = date;
                    } else {
                        priceSegments.push(currentPriceSeg);
                        currentPriceSeg = { start: date, end: date, price: data.price };
                    }
                }
            }
            if (currentPriceSeg) priceSegments.push(currentPriceSeg);

            // 2. Group Stock Segments
            const stockSegments: { start: string, end: string, stock: number }[] = [];
            let currentStockSeg: { start: string, end: string, stock: number } | null = null;

            for (const date of dates) {
                const data = localData[date];
                if (data.stock === undefined) continue;

                if (!currentStockSeg) {
                    currentStockSeg = { start: date, end: date, stock: data.stock };
                } else {
                    const nextDate = dayjs(currentStockSeg.end).add(1, 'day').format('YYYY-MM-DD');
                    if (date === nextDate && data.stock === currentStockSeg.stock) {
                        currentStockSeg.end = date;
                    } else {
                        stockSegments.push(currentStockSeg);
                        currentStockSeg = { start: date, end: date, stock: data.stock };
                    }
                }
            }
            if (currentStockSeg) stockSegments.push(currentStockSeg);


            // Save Prices
            for (const seg of priceSegments) {
                await apiRequest('/api/prices', {
                    method: 'POST',
                    body: JSON.stringify({
                        sku_id: skuId,
                        channel_id: channelId,
                        sale_price: seg.price,
                        cost_price: null,
                        start_at: seg.start,
                        end_at: seg.end,
                        status: 'active'
                    })
                });
            }

            // Save Stock
            for (const seg of stockSegments) {
                await apiRequest('/api/inventory/init', {
                    method: 'POST',
                    body: JSON.stringify({
                        sku_id: skuId,
                        start_date: seg.start,
                        end_date: seg.end,
                        total_qty: seg.stock,
                        reason: 'Batch update via SKU Calendar'
                    })
                });
            }
        }
    }));


    // ----------------------------------------------------------------------
    // Event Handlers
    // ----------------------------------------------------------------------

    const handleDateClick = (date: Dayjs) => {
        const str = date.format('YYYY-MM-DD');

        let newStart = selection.start;
        let newEnd = selection.end;

        if (!newStart || (newStart && newEnd && !newStart.isSame(newEnd, 'day'))) {
            // Start new selection
            newStart = date;
            newEnd = date;

            const d = localData[str];
            setInputPrice(d?.price ?? null);
            setInputStock(d?.stock ?? null);
        } else {
            // Extend to range
            if (date.isBefore(newStart)) {
                newEnd = newStart;
                newStart = date;
            } else {
                newEnd = date;
            }
        }

        setSelection({ start: newStart, end: newEnd });
    };

    const handleRangePickerChange = (dates: any) => {
        if (dates && dates[0] && dates[1]) {
            setSelection({ start: dates[0], end: dates[1] });
            // Optionally remove focus or jump view? Let's just update selection.
            // If user selects a far away date, maybe jump view?
            if (!dates[0].isSame(currentDate, 'month') && !dates[0].isSame(currentDate, 'year')) {
                setCurrentDate(dates[0]);
            }
        } else {
            setSelection({ start: null, end: null });
        }
    }

    const handleApplyData = () => {
        if (!selection.start || !selection.end) {
            message.warning("请先在日历选择日期范围");
            return;
        }
        if (inputPrice === null && inputStock === null) {
            message.warning("请输入价格或库存");
            return;
        }

        const newData = { ...localData };
        const diff = selection.end.diff(selection.start, 'day');
        for (let i = 0; i <= diff; i++) {
            const dStr = selection.start.add(i, 'day').format('YYYY-MM-DD');
            if (!newData[dStr]) newData[dStr] = {};

            if (inputPrice !== null) newData[dStr].price = inputPrice;
            if (inputStock !== null) newData[dStr].stock = inputStock;
        }

        setLocalData(newData);
        message.success("设置已应用到选定日期");
    };

    const handleMonthChange = (val: number) => {
        setCurrentDate(currentDate.month(val - 1));
    }

    const handleYearChange = (val: number) => {
        setCurrentDate(currentDate.year(val));
    }

    // ----------------------------------------------------------------------
    // Render Helpers
    // ----------------------------------------------------------------------

    const renderCalendarGrid = () => {
        const startOfMonth = currentDate.startOf('month');
        const endOfMonth = currentDate.endOf('month');

        const startDay = startOfMonth.startOf('week');
        const endDay = endOfMonth.endOf('week');

        const cells = [];
        let day = startDay;

        while (day.isBefore(endDay) || day.isSame(endDay, 'day')) {
            const str = day.format('YYYY-MM-DD');
            const data = localData[str];
            const isCurrentMonth = day.isSame(currentDate, 'month');
            const isSelected = selection.start && selection.end
                ? (day.isSame(selection.start, 'day') || day.isSame(selection.end, 'day'))
                : false;
            const isInRange = selection.start && selection.end
                ? (day.isAfter(selection.start) && day.isBefore(selection.end))
                : false;
            const isToday = day.isSame(dayjs(), 'day');

            const currentDay = day;

            // Apply style dynamically
            const cellStyle = styles.cell(isSelected, isInRange, isToday, !isCurrentMonth);

            cells.push(
                <div
                    key={str}
                    style={cellStyle}
                    onClick={() => handleDateClick(currentDay)}
                >
                    <div style={styles.dateNum}>{day.date()}</div>
                    {data && (
                        <div style={styles.dataContent}>
                            {data.price !== undefined && <span style={styles.priceTag}>¥{data.price}</span>}
                            {data.stock !== undefined && <span style={styles.stockTag}>余 {data.stock}</span>}
                        </div>
                    )}
                </div>
            );
            day = day.add(1, 'day');
        }
        return cells;
    };


    return (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
            {loading && <Spin fullscreen />}

            {/* Control Panel */}
            <Card size="small" title="价格库存设置" styles={{ body: { padding: '16px' } }}>
                <Row gutter={16} align="middle">
                    <Col span={8}>
                        <div>选中时段:</div>
                        <RangePicker
                            value={selection.start && selection.end ? [selection.start, selection.end] : null}
                            onChange={handleRangePickerChange}
                            placeholder={['开始日期', '结束日期']}
                            style={{ width: '100%' }}
                        />
                    </Col>
                    <Col span={5}>
                        <div>销售价格 (¥)</div>
                        <InputNumber
                            style={{ width: '100%' }}
                            min={0}
                            value={inputPrice}
                            onChange={v => setInputPrice(v)}
                            placeholder="不修改"
                        />
                    </Col>
                    <Col span={5}>
                        <div>库存数量</div>
                        <InputNumber
                            style={{ width: '100%' }}
                            min={0}
                            value={inputStock}
                            onChange={v => setInputStock(v)}
                            placeholder="不修改"
                        />
                    </Col>
                    <Col span={6} style={{ textAlign: 'right', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', height: '100%' }}>
                        <Button
                            type="primary"
                            size="large"
                            icon={<SaveOutlined />}
                            onClick={handleApplyData}
                            style={{ marginTop: 20 }}
                        >
                            应用设置到日历
                        </Button>
                    </Col>
                </Row>
                <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
                    提示：可通过上方日期选择器或直接点击日历来选择范围。选择后设置价格/库存并点击“应用”，最后点击底部“保存”。
                </div>
            </Card>

            {/* Custom Calendar */}
            <div style={styles.container}>
                <div style={styles.header}>
                    <Space>
                        <Button icon={<DoubleLeftOutlined />} onClick={() => setCurrentDate(currentDate.add(-1, 'year'))}>上一年</Button>
                        <Button icon={<LeftOutlined />} onClick={() => setCurrentDate(currentDate.add(-1, 'month'))}>上一月</Button>
                    </Space>

                    <Space>
                        <Select value={currentDate.year()} onChange={handleYearChange} style={{ width: 100 }}>
                            {Array.from({ length: 11 }, (_, i) => currentDate.year() - 5 + i).map(year => (
                                <Option key={year} value={year}>{year}年</Option>
                            ))}
                        </Select>
                        <Select value={currentDate.month() + 1} onChange={handleMonthChange} style={{ width: 80 }}>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                <Option key={month} value={month}>{month}月</Option>
                            ))}
                        </Select>
                    </Space>

                    <Space>
                        <Button icon={<RightOutlined />} onClick={() => setCurrentDate(currentDate.add(1, 'month'))}>下一月</Button>
                        <Button icon={<DoubleRightOutlined />} onClick={() => setCurrentDate(currentDate.add(1, 'year'))}>下一年</Button>
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

        </Space>
    );
});

export default SKUCalendarEditor;
