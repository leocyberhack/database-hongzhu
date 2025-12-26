import { Card, Col, Row, Typography } from 'antd'

const { Paragraph } = Typography

export default function DiffViewer({ before, after }: { before: unknown; after: unknown }) {
  return (
    <Row gutter={12}>
      <Col span={12}>
        <Card size="small" title="变更前">
          <Paragraph code style={{ whiteSpace: 'pre-wrap', maxHeight: 360, overflow: 'auto' }}>
            {JSON.stringify(before, null, 2)}
          </Paragraph>
        </Card>
      </Col>
      <Col span={12}>
        <Card size="small" title="变更后" bodyStyle={{ background: '#fff7e6' }}>
          <Paragraph code style={{ whiteSpace: 'pre-wrap', maxHeight: 360, overflow: 'auto' }}>
            {JSON.stringify(after, null, 2)}
          </Paragraph>
        </Card>
      </Col>
    </Row>
  )
}
