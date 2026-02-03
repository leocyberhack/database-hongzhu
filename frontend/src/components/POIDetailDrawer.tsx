import { Drawer, Tabs, Form, Input, Select, Button, Space, Row, Col, InputNumber } from 'antd'
import type { POI } from '@/types'
import ResourceManager from './ResourceManager'
import ContactTableEditor from './ContactTableEditor'
import POIFileManager from './POIFileManager'
import TicketPoiFields from './TicketPoiFields'
import HotelPoiFields from './HotelPoiFields'
import DiningPoiFields from './DiningPoiFields'
import TransportPoiFields from './TransportPoiFields'

const POI_TYPES = ['景区', '酒店', '餐饮', '交通']

interface RegionOption {
    code: string
    name: string
}

interface POIDetailDrawerProps {
    poi: POI | null
    onClose: () => void
    form: ReturnType<typeof Form.useForm>[0]
    onSave: (values: any) => void
    provinceOptions: RegionOption[]
    editCityOptions: RegionOption[]
    editDistrictOptions: RegionOption[]
    editProvince: string | undefined
    editCity: string | undefined
    onProvinceChange: (value: string) => void
    onCityChange: (value: string) => void
    /** 是否只读模式 */
    readonly?: boolean

    // Custom options handling
    typeOptions?: Record<string, string[]>
    onOptionsChange?: (field: string, newOptions: string[]) => void
    onOptionAdd?: (field: string, val: string) => void
    onOptionDelete?: (field: string, val: string) => void
    onOptionRename?: (field: string, oldVal: string, newVal: string) => void
}

/**
 * POI详情Drawer组件
 * 包含三个Tab：基本信息、详情图管理、关联资源
 */
const POIDetailDrawer: React.FC<POIDetailDrawerProps> = ({
    poi,
    onClose,
    form,
    onSave,
    provinceOptions,
    editCityOptions,
    editDistrictOptions,
    editProvince,
    editCity,
    onProvinceChange,
    onCityChange,
    readonly = false,
    typeOptions,
    onOptionsChange,
    onOptionAdd,
    onOptionDelete,
    onOptionRename
}) => {
    if (!poi) return null

    const tabItems = [
        {
            key: 'basic',
            label: '基本信息',
            children: (
                <div className="glass-card" style={{ padding: '16px' }}>
                    <Form layout="vertical" form={form} onFinish={onSave} disabled={readonly}>
                        <Row gutter={16}>
                            <Col span={10}>
                                <Form.Item name="poi_name" label="名称" rules={[{ required: true }]}>
                                    <Input />
                                </Form.Item>
                            </Col>
                            <Col span={7}>
                                <Form.Item name="poi_code" label="资源编码">
                                    <Input />
                                </Form.Item>
                            </Col>
                            <Col span={7}>
                                <Form.Item name="poi_type" label="资源类型">
                                    <Select disabled>
                                        {POI_TYPES.map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}
                                    </Select>
                                </Form.Item>
                            </Col>
                        </Row>

                        <Row gutter={16}>
                            <Col span={8}>
                                <Form.Item name="province" label="省份" rules={[{ required: true, message: '请选择省份' }]}>
                                    <Select
                                        placeholder="选择省份"
                                        showSearch
                                        optionFilterProp="label"
                                        options={provinceOptions.map((p) => ({ value: p.code, label: p.name }))}
                                        onChange={onProvinceChange}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item name="city" label="城市" rules={[{ required: true, message: '请选择城市' }]}>
                                    <Select
                                        placeholder="选择城市"
                                        showSearch
                                        optionFilterProp="label"
                                        disabled={!editProvince}
                                        options={editCityOptions.map((c) => ({ value: c.code, label: c.name }))}
                                        onChange={onCityChange}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item name="district" label="区/县" rules={[{ required: true, message: '请选择区/县' }]}>
                                    <Select
                                        placeholder="选择区/县"
                                        showSearch
                                        optionFilterProp="label"
                                        disabled={!editCity}
                                        options={editDistrictOptions.map((d) => ({ value: d.code, label: d.name }))}
                                    />
                                </Form.Item>
                            </Col>
                        </Row>

                        <Form.Item name="address" label="地址">
                            <Input />
                        </Form.Item>

                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item name="longitude" label="经度">
                                    <InputNumber style={{ width: '100%' }} step={0.000001} precision={6} min={-180} max={180} />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item name="latitude" label="纬度">
                                    <InputNumber style={{ width: '100%' }} step={0.000001} precision={6} min={-90} max={90} />
                                </Form.Item>
                            </Col>
                        </Row>

                        <div style={{ marginBottom: 16 }}>
                            <h4 style={{ marginBottom: 12 }}>业务对接人信息</h4>
                            <ContactTableEditor
                                name={['attrs', 'business_contacts']}
                                showRemark
                                addLabel="添加对接人"
                                emptyText="暂无对接人信息"
                            />
                        </div>

                        {poi.poi_type === '景区' && <TicketPoiFields />}
                        {poi.poi_type === '酒店' && <HotelPoiFields />}
                        {poi.poi_type === '餐饮' && <DiningPoiFields />}
                        {poi.poi_type === '交通' && <TransportPoiFields />}

                        {!readonly && (
                            <Space style={{ width: '100%', justifyContent: 'flex-end', marginTop: 16 }}>
                                <Button onClick={onClose}>取消</Button>
                                <Button type="primary" htmlType="submit">
                                    保存
                                </Button>
                            </Space>
                        )}
                    </Form>
                </div>
            )
        },
        {
            key: 'files',
            label: '详情图管理',
            children: (
                <POIFileManager
                    poiFolderId={poi.folder_id || null}
                    poiName={poi.poi_name}
                    readonly={readonly}
                />
            )
        },
        {
            key: 'resources',
            label: '关联子资源',
            children: (
                <ResourceManager
                    key={poi.id}
                    poiId={poi.id}
                    mode="embedded"
                    typeOptions={typeOptions}
                    onOptionsChange={onOptionsChange}
                    onOptionAdd={onOptionAdd}
                    onOptionDelete={onOptionDelete}
                    onOptionRename={onOptionRename}
                />
            )
        }
    ]

    return (
        <Drawer
            title={`资源详情: ${poi.poi_name}`}
            open={true}
            width={960}
            onClose={onClose}
        >
            <Tabs defaultActiveKey="basic" items={tabItems} />
        </Drawer>
    )
}

export default POIDetailDrawer
