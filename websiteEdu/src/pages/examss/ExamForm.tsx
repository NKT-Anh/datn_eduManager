import React, { useEffect, useState } from "react";
import {
  Form,
  Input,
  Button,
  DatePicker,
  Select,
  message,
  Spin,
  Card,
  Row,
  Col,
  Typography,
  Divider,
  Tag,
  Tooltip,
} from "antd";
import dayjs from "dayjs";
import * as api from "@/services/examApi";
import schoolConfigApi from "@/services/schoolConfigApi";
import { useIsMobile } from "@/hooks/use-mobile";

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Title } = Typography;

interface ExamFormProps {
  id?: string;
  onSuccess?: (exam: any) => void; // <- trả về exam vừa tạo/cập nhật
}

const statusMap: Record<string, { color: string; label: string; desc: string }> = {
  draft: { color: "default", label: "Đang khởi tạo", desc: "Kỳ thi đang soạn thảo" },
  published: { color: "blue", label: "Đã công bố", desc: "Kỳ thi đã được công bố" },
  locked: { color: "orange", label: "Khóa", desc: "Kỳ thi đã khóa, không thể sửa" },
  archived: { color: "gray", label: "Kết thúc", desc: "Kỳ thi đã lưu trữ" },
};

export default function ExamForm({ id, onSuccess }: ExamFormProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [years, setYears] = useState<{ code: string; name: string }[]>([]);
  const [semesters, setSemesters] = useState<{ code: string; name: string }[]>([]);
  const [grades, setGrades] = useState<{ code: string; name: string }[]>([]);
  const [currentStatus, setCurrentStatus] = useState<string>("draft");

  const isMobile = useIsMobile();

  // ---------- Load config ----------
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const [yRes, sRes, gRes] = await Promise.all([
          schoolConfigApi.getSchoolYears(),
          schoolConfigApi.getSemesters(),
          schoolConfigApi.getGrades(),
        ]);
        setYears(yRes.data);
        setSemesters(sRes.data);
        setGrades(gRes.data);
      } catch (err: any) {
        message.error(err?.message || "Lỗi khi tải cấu hình");
      }
    };
    fetchConfig();
  }, []);

  // ---------- Load exam nếu chỉnh sửa ----------
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.getExamById(id)
      .then(res => {
        const data = res.data;
        form.setFieldsValue({
          name: data.name,
          year: data.year,
          semester: data.semester,
          status: data.status,
          dateRange: [
            data.startDate ? dayjs(data.startDate) : null,
            data.endDate ? dayjs(data.endDate) : null,
          ],
          grades: data.grades || [],
        });
        setCurrentStatus(data.status || "draft");
      })
      .catch(err => message.error(err?.message || "Lỗi khi tải dữ liệu kỳ thi"))
      .finally(() => setLoading(false));
  }, [id, form]);

  // ---------- Submit ----------
  const onFinish = async (values: any) => {
    const payload = {
      name: values.name,
      year: values.year,
      semester: values.semester,
      status: values.status,
      startDate: values.dateRange?.[0]?.toISOString(),
      endDate: values.dateRange?.[1]?.toISOString(),
      grades: values.grades || [],
    };

    setSaving(true);
    try {
      let exam;
      if (id) {
        const res = await api.updateExam(id, payload);
        message.success("Cập nhật kỳ thi thành công");
        exam = res.data;
      } else {
        const res = await api.createExam(payload);
        message.success("Tạo kỳ thi thành công");
        exam = res.data;
      }
      onSuccess?.(exam); // <- trả về exam để cập nhật list ngay lập tức
    } catch (err: any) {
      message.error(err?.message || "Lỗi khi lưu kỳ thi");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: "block", margin: "40px auto" }} />;

  return (
    <div style={{ maxWidth: isMobile ? "95%" : 900, margin: "0 auto" }}>
      <Title level={isMobile ? 3 : 2} style={{ textAlign: "center", marginBottom: 24 }}>
        {id ? "Cập nhật kỳ thi" : "Tạo kỳ thi mới"}
      </Title>

      <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ status: "draft" }}>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Card bordered>
              <Title level={4}>Thông tin cơ bản</Title>
              <Form.Item
                name="name"
                label="Tên kỳ thi"
                rules={[{ required: true, message: "Vui lòng nhập tên kỳ thi" }]}
              >
                <Input placeholder="Ví dụ: Kiểm tra HK1" disabled={["locked", "archived"].includes(currentStatus)} />
              </Form.Item>

              <Form.Item
                name="year"
                label="Năm học"
                rules={[{ required: true, message: "Vui lòng chọn năm học" }]}
              >
                <Select placeholder="Chọn năm học" disabled={["locked", "archived"].includes(currentStatus)}>
                  {years.map(y => <Option key={y.code} value={y.code}>{y.name}</Option>)}
                </Select>
              </Form.Item>

              <Form.Item
                name="semester"
                label="Học kỳ"
                rules={[{ required: true, message: "Vui lòng chọn học kỳ" }]}
              >
                <Select placeholder="Chọn học kỳ" disabled={["locked", "archived"].includes(currentStatus)}>
                  {semesters.map(s => <Option key={s.code} value={s.code}>{s.name}</Option>)}
                </Select>
              </Form.Item>

              <Form.Item name="grades" label="Các khối áp dụng">
                <Select
                  mode="multiple"
                  placeholder="Chọn khối học"
                  disabled={["locked", "archived"].includes(currentStatus)}
                >
                  {grades.map(g => <Option key={g.code} value={g.code}>{g.name}</Option>)}
                </Select>
              </Form.Item>
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card bordered>
              <Title level={4}>Thời gian & Trạng thái</Title>
              <Form.Item
                name="dateRange"
                label="Thời gian (bắt đầu - kết thúc)"
                rules={[{ required: true, message: "Vui lòng chọn thời gian" }]}
              >
                <RangePicker style={{ width: "100%" }} disabled={["locked", "archived"].includes(currentStatus)} />
              </Form.Item>

              <Form.Item name="status" label="Trạng thái">
                <Select
                  placeholder="Chọn trạng thái"
                  value={currentStatus}
                  onChange={(val) => setCurrentStatus(val)}
                  optionLabelProp="label"
                >
                  {Object.entries(statusMap).map(([key, { color, label, desc }]) => (
                    <Option key={key} value={key} label={label}>
                      <Tooltip title={desc}>
                        <Tag
                          color={color}
                          style={{
                            marginRight: 8,
                            transition: "all 0.3s ease",
                            transform: currentStatus === key ? "scale(1.2)" : "scale(1)",
                            opacity: currentStatus === key ? 1 : 0.7,
                            cursor: "pointer",
                          }}
                        >
                          {label}
                        </Tag>
                        {label}
                      </Tooltip>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Card>
          </Col>
        </Row>

        <Divider />

        <Form.Item style={{ textAlign: "center", marginTop: 24 }}>
          <Button type="primary" htmlType="submit" loading={saving} size="large">
            {id ? "Cập nhật" : "Tạo kỳ thi mới"}
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
