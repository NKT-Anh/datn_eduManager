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
  Space,
} from "antd";
import dayjs from "dayjs";
import { examApi } from "@/services/exams/examApi";
import schoolConfigApi from "@/services/schoolConfigApi";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Title } = Typography;

interface ExamFormProps {
  id?: string;
  onSuccess?: (exam: any) => void;
}

const statusMap: Record<string, { color: string; label: string; desc: string }> = {
  draft: { color: "default", label: "Đang khởi tạo", desc: "Kỳ thi đang được khởi tạo" },
  published: { color: "blue", label: "Đã công bố", desc: "Kỳ thi đã được công bố cho toàn trường" },
  locked: { color: "orange", label: "Khóa", desc: "Kỳ thi đã bị khóa và không thể chỉnh sửa" },
  archived: { color: "gray", label: "Kết thúc", desc: "Kỳ thi đã lưu trữ, chỉ đọc" },
};

// 🧩 Loại kỳ thi
const typeMap: Record<string, { label: string; color: string; desc: string }> = {
  regular: { label: "Chính thức", color: "green", desc: "Kỳ thi chính thức của trường" },
  mock: { label: "Thử", color: "blue", desc: "Kỳ thi thử, dùng để ôn tập hoặc kiểm tra trước kỳ thi chính" },
  graduation: { label: "Tốt nghiệp", color: "purple", desc: "Kỳ thi cuối cùng để xét tốt nghiệp" },
};

export default function ExamForm({ id, onSuccess }: ExamFormProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [years, setYears] = useState<{ code: string; name: string }[]>([]);
  const [semesters, setSemesters] = useState<{ code: string; name: string }[]>([]);
  const [grades, setGrades] = useState<{ code: string; name: string }[]>([]);
  const [currentStatus, setCurrentStatus] = useState<string>("draft");

  // 🏫 Load cấu hình trường học
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const [yRes, sRes, gRes] = await Promise.all([
          schoolConfigApi.getSchoolYears(),
          schoolConfigApi.getSemesters(),
          schoolConfigApi.getGrades(),
        ]);
        setYears(yRes?.data || []);
        setSemesters(sRes?.data || []);
        setGrades(gRes?.data || []);
      } catch (err: any) {
        console.error(err);
        message.error("Không thể tải cấu hình trường học");
      }
    };
    fetchConfig();
  }, []);

  // 📘 Nếu có ID thì load dữ liệu kỳ thi
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    examApi
      .getById(id)
      .then((data) => {
        form.setFieldsValue({
          name: data.name,
          year: data.year,
          semester: data.semester,
          type: data.type || "regular",
          status: data.status,
          grades: data.grades || [],
          dateRange: [
            data.startDate ? dayjs(data.startDate) : null,
            data.endDate ? dayjs(data.endDate) : null,
          ],
        });
        setCurrentStatus(data.status || "draft");
      })
      .catch(() => message.error("Không thể tải dữ liệu kỳ thi"))
      .finally(() => setLoading(false));
  }, [id, form]);

  // 💾 Lưu kỳ thi
  const onFinish = async (values: any) => {
    const payload = {
      name: values.name,
      year: values.year,
      semester: values.semester,
      type: values.type || "regular",
      status: values.status,
       grades: (values.grades || []).map((g: string | number) => Number(g)),
      startDate: values.dateRange?.[0]?.toISOString(),
      endDate: values.dateRange?.[1]?.toISOString(),
    };

    setSaving(true);
    try {
      let result;
      if (id) {
        result = await examApi.update(id, payload);
        message.success("Đã cập nhật kỳ thi");
      } else {
        result = await examApi.create(payload);
        message.success("Đã tạo kỳ thi mới");
      }
      onSuccess?.(result);
    } catch (err: any) {
      console.error(err);
      message.error("Lưu kỳ thi thất bại");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return <Spin size="large" style={{ display: "block", margin: "40px auto" }} />;

  const disabled = ["locked", "archived"].includes(currentStatus);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <Title level={2} style={{ textAlign: "center", marginBottom: 24 }}>
        {id ? "✏️ Cập nhật kỳ thi" : "➕ Tạo kỳ thi mới"}
      </Title>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ status: "draft", type: "regular" }}
      >
        <Row gutter={[16, 16]}>
          {/* Cột trái */}
          <Col xs={24} md={12}>
            <Card bordered>
              <Title level={4}>Thông tin cơ bản</Title>

              <Form.Item
                name="name"
                label="Tên kỳ thi"
                rules={[{ required: true, message: "Vui lòng nhập tên kỳ thi" }]}
              >
                <Input placeholder="VD: Thi cuối kỳ HK1" disabled={disabled} />
              </Form.Item>

              <Form.Item
                name="year"
                label="Năm học"
                rules={[{ required: true, message: "Vui lòng chọn năm học" }]}
              >
                <Select placeholder="Chọn năm học" disabled={disabled}>
                  {years.map((y) => (
                    <Option key={y.code} value={y.code}>
                      {y.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="semester"
                label="Học kỳ"
                rules={[{ required: true, message: "Vui lòng chọn học kỳ" }]}
              >
                <Select placeholder="Chọn học kỳ" disabled={disabled}>
                  {semesters.map((s) => (
                    <Option key={s.code} value={s.code}>
                      {s.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="type"
                label="Loại kỳ thi"
                rules={[{ required: true, message: "Vui lòng chọn loại kỳ thi" }]}
              >
                <Select placeholder="Chọn loại kỳ thi" disabled={disabled}>
                  {Object.entries(typeMap).map(([key, { label, color, desc }]) => (
                    <Option key={key} value={key}>
                      <Tooltip title={desc}>
                        <Tag color={color}>{label}</Tag>
                      </Tooltip>
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item name="grades" label="Các khối áp dụng">
                <Select
                  mode="multiple"
                  placeholder="Chọn khối học"
                  disabled={disabled}
                  allowClear
                >
                  {grades.map((g) => (
                    <Option key={g.code} value={g.code}>
                      {g.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Card>
          </Col>

          {/* Cột phải */}
          <Col xs={24} md={12}>
            <Card bordered>
              <Title level={4}>Thời gian & Trạng thái</Title>

              <Form.Item
                name="dateRange"
                label="Thời gian (bắt đầu - kết thúc)"
                rules={[{ required: true, message: "Vui lòng chọn thời gian" }]}
              >
                <RangePicker
                  style={{ width: "100%" }}
                  disabled={disabled}
                  format="DD/MM/YYYY"
                />
              </Form.Item>

{/* ✅ Trạng thái (DropdownMenu thay Select) */}
<Form.Item label="Trạng thái" name="status">
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        className={`flex items-center justify-between w-full px-3 py-2 rounded-lg border transition-all ${
          ["locked", "archived"].includes(currentStatus)
            ? "cursor-not-allowed opacity-70 bg-muted"
            : "hover:bg-accent hover:text-accent-foreground"
        }`}
        disabled={["locked", "archived"].includes(currentStatus)}
      >
        <Space>
          <Tag
            color={statusMap[currentStatus].color}
            style={{
              margin: 0,
              borderRadius: 6,
              padding: "2px 8px",
              fontSize: 13,
            }}
          >
            {statusMap[currentStatus].label}
          </Tag>
        </Space>
        <span className="text-muted-foreground text-sm">
          {statusMap[currentStatus].desc}
        </span>
      </button>
    </DropdownMenuTrigger>

    {!["locked", "archived"].includes(currentStatus) && (
      <DropdownMenuContent
        align="center"
        className="w-[260px] rounded-lg shadow-lg p-2"
      >
        {Object.entries(statusMap).map(([key, { color, label, desc }]) => (
          <DropdownMenuItem
            key={key}
            className={`flex items-center justify-between px-3 py-1.5 rounded-md transition-colors text-sm cursor-pointer ${
              key === currentStatus
                ? "bg-accent text-primary font-semibold"
                : "hover:bg-accent/50"
            }`}
            onClick={() => {
              form.setFieldValue("status", key);
              setCurrentStatus(key);
            }}
          >
            <Tooltip title={desc}>
              <div className="flex items-center gap-2">
                <Tag
                  color={color}
                  style={{
                    borderRadius: 6,
                    margin: 0,
                    padding: "2px 8px",
                    fontSize: 13,
                  }}
                >
                  {label}
                </Tag>
                <span className="text-xs text-muted-foreground">
                  {desc.split(" ")[0]}
                </span>
              </div>
            </Tooltip>
            {key === currentStatus && (
              <span className="text-primary font-bold text-xs">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    )}
  </DropdownMenu>
</Form.Item>


            </Card>
          </Col>
        </Row>

        <Divider />

        <Form.Item style={{ textAlign: "center", marginTop: 24 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={saving}
            size="large"
            style={{ borderRadius: 8 }}
          >
            {id ? "Lưu thay đổi" : "Tạo kỳ thi mới"}
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
