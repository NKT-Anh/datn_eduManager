import React, { useEffect, useState, useMemo } from "react";
import {
  Table,
  Button,
  Space,
  Tag,
  message,
  Typography,
  Card,
  Input,
  Select,
  DatePicker,
} from "antd";
import dayjs from "dayjs";
import {
  RefreshCcw,
  CalendarDays,
  Search,
  Filter,
} from "lucide-react";
import { examScheduleApi } from "@/services/exams/examScheduleApi";
import { examApi } from "@/services/exams/examApi";
import { useNavigate } from "react-router-dom";

const { Title } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

export default function ExamSchedulePage() {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exams, setExams] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    exam: "",
    grade: "",
    subject: "",
    status: "",
    dateFrom: "",
    dateTo: "",
    keyword: "",
  });

  /* =========================================================
     🧠 Lấy danh sách lịch thi
  ========================================================= */
  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const params: any = {};
      
      if (filters.exam) params.exam = filters.exam;
      if (filters.grade) params.grade = filters.grade;
      if (filters.subject) params.subject = filters.subject;
      if (filters.status && filters.status !== "Tất cả") params.status = filters.status;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.keyword) params.keyword = filters.keyword;

      const res = await examScheduleApi.getAll(params);
      setSchedules(Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
    } catch (err: any) {
      console.error("❌ Lỗi tải lịch thi:", err);
      message.error(err?.response?.data?.error || "Không thể tải danh sách lịch thi.");
    } finally {
      setLoading(false);
    }
  };

  const fetchExams = async () => {
    try {
      const res = await examApi.getAll();
      setExams(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("❌ Lỗi tải kỳ thi:", err);
    }
  };

  useEffect(() => {
    fetchSchedules();
    fetchExams();
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [filters]);

  /* =========================================================
     📋 Cột bảng
  ========================================================= */
  const columns = [
    {
      title: "Kỳ thi",
      dataIndex: ["exam", "name"],
      align: "center" as const,
      render: (text: string, record: any) => (
        <Button
          type="link"
          onClick={() => navigate(`/admin/exam/exam-list`)}
        >
          {text || "-"}
        </Button>
      ),
    },
    {
      title: "Năm học",
      dataIndex: ["exam", "year"],
      align: "center" as const,
      render: (v: string) => v || "-",
    },
    {
      title: "Học kỳ",
      dataIndex: ["exam", "semester"],
      align: "center" as const,
      render: (v: string) => (
        <Tag color={v === "1" ? "blue" : "green"}>
          HK{v || "-"}
        </Tag>
      ),
    },
    {
      title: "Khối",
      dataIndex: "grade",
      align: "center" as const,
      render: (v: number) => <Tag color="blue">Khối {v}</Tag>,
    },
    {
      title: "Môn học",
      dataIndex: ["subject", "name"],
      align: "center" as const,
      render: (text: string) => text || "-",
    },
    {
      title: "Ngày thi",
      dataIndex: "date",
      align: "center" as const,
      render: (v: string) => (
        <Space>
          <CalendarDays size={16} />
          {v ? dayjs(v).format("DD/MM/YYYY") : "-"}
        </Space>
      ),
    },
    {
      title: "Giờ bắt đầu",
      dataIndex: "startTime",
      align: "center" as const,
      render: (v: string) => v || "-",
    },
    {
      title: "Thời lượng (phút)",
      dataIndex: "duration",
      align: "center" as const,
      render: (v: number) => v || "-",
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      align: "center" as const,
      render: (v: string) => {
        const map: Record<string, { color: string; label: string }> = {
          draft: { color: "default", label: "Khởi tạo" },
          confirmed: { color: "blue", label: "Đã xác nhận" },
          completed: { color: "green", label: "Hoàn tất" },
        };
        const info = map[v] || { color: "gray", label: "Không xác định" };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: "Hành động",
      align: "center" as const,
      render: (_: any, record: any) => (
        <Space>
          <Button
            size="small"
            onClick={() => navigate(`/admin/exam/exam-list`)}
          >
            Xem chi tiết
          </Button>
        </Space>
      ),
    },
  ];

  const handleDateRangeChange = (dates: any) => {
    if (dates && dates.length === 2) {
      setFilters({
        ...filters,
        dateFrom: dates[0].format("YYYY-MM-DD"),
        dateTo: dates[1].format("YYYY-MM-DD"),
      });
    } else {
      setFilters({
        ...filters,
        dateFrom: "",
        dateTo: "",
      });
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Title level={2} style={{ margin: 0 }}>
            Quản lý lịch thi
          </Title>
          <p className="text-muted-foreground">
            Xem và quản lý tất cả lịch thi trong hệ thống
          </p>
        </div>
        <Button icon={<RefreshCcw size={16} />} onClick={fetchSchedules}>
          Làm mới
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <div className="flex items-center gap-2">
            <Filter size={16} />
            <span className="font-medium">Bộ lọc</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Kỳ thi</label>
              <Select
                style={{ width: "100%" }}
                placeholder="Chọn kỳ thi"
                allowClear
                value={filters.exam || undefined}
                onChange={(v) => setFilters({ ...filters, exam: v || "" })}
              >
                {exams.map((exam) => (
                  <Option key={exam._id} value={exam._id}>
                    {exam.name}
                  </Option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Khối</label>
              <Select
                style={{ width: "100%" }}
                placeholder="Chọn khối"
                allowClear
                value={filters.grade || undefined}
                onChange={(v) => setFilters({ ...filters, grade: v || "" })}
              >
                <Option value="10">Khối 10</Option>
                <Option value="11">Khối 11</Option>
                <Option value="12">Khối 12</Option>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Trạng thái</label>
              <Select
                style={{ width: "100%" }}
                placeholder="Chọn trạng thái"
                allowClear
                value={filters.status || undefined}
                onChange={(v) => setFilters({ ...filters, status: v || "" })}
              >
                <Option value="Tất cả">Tất cả</Option>
                <Option value="draft">Khởi tạo</Option>
                <Option value="confirmed">Đã xác nhận</Option>
                <Option value="completed">Hoàn tất</Option>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Khoảng thời gian</label>
              <RangePicker
                style={{ width: "100%" }}
                format="DD/MM/YYYY"
                onChange={handleDateRangeChange}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Tìm kiếm</label>
            <Input
              placeholder="Tìm theo môn học, ghi chú..."
              prefix={<Search size={16} />}
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              allowClear
            />
          </div>
        </Space>
      </Card>

      {/* Table */}
      <Card>
        <Table
          dataSource={schedules}
          columns={columns}
          rowKey={(r) => r._id}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>
    </div>
  );
}

