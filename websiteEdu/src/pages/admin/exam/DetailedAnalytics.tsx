import React, { useEffect, useState } from "react";
import {
  Card,
  Row,
  Col,
  Select,
  Button,
  message,
  Typography,
  Space,
  Divider,
} from "antd";
import { DownloadOutlined, FilterOutlined } from "@ant-design/icons";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { examApi } from "@/services/exams/examApi";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const { Title } = Typography;
const { Option } = Select;

export default function DetailedAnalytics() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    grade: "Tất cả",
    type: "Tất cả",
    year: "Tất cả",
    semester: "Tất cả",
  });

  const [yearList, setYearList] = useState<string[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const exams = await examApi.getAll();
      setYearList([...new Set(exams.map((e: any) => e.year))]);

      let filtered = exams;

      if (filters.grade !== "Tất cả")
        filtered = filtered.filter((e: any) => e.grades?.includes(filters.grade));

      if (filters.type !== "Tất cả")
        filtered = filtered.filter((e: any) => e.type === filters.type);

      if (filters.year !== "Tất cả")
        filtered = filtered.filter((e: any) => e.year === filters.year);

      if (filters.semester !== "Tất cả")
        filtered = filtered.filter((e: any) => e.semester === filters.semester);

      // Group theo trạng thái để vẽ biểu đồ
      const grouped = filtered.reduce((acc: any, exam: any) => {
        const key = exam.status || "unknown";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const chartData = Object.entries(grouped).map(([status, count]) => ({
        status,
        count,
      }));
      setData(chartData);
    } catch (err) {
      console.error(err);
      message.error("Không thể tải dữ liệu phân tích");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  // 🧾 Xuất báo cáo PDF
  const exportPDF = async () => {
    const dashboardElement = document.getElementById("analytics-section");
    if (!dashboardElement) return;

    const canvas = await html2canvas(dashboardElement);
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;

    pdf.text("BÁO CÁO PHÂN TÍCH CHI TIẾT KỲ THI", 14, 15);
    pdf.addImage(imgData, "PNG", 10, 25, width - 20, height);
    pdf.save("Exam_Detailed_Analytics.pdf");
  };

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          📈 Phân tích chi tiết kỳ thi
        </Title>
        <Button icon={<DownloadOutlined />} onClick={exportPDF} type="primary">
          Xuất báo cáo PDF
        </Button>
      </Row>

      <Space size="middle" wrap>
        <Select
          value={filters.grade}
          onChange={(v) => setFilters((f) => ({ ...f, grade: v }))}
          style={{ width: 160 }}
        >
          <Option value="Tất cả">Tất cả khối</Option>
          <Option value="10">Khối 10</Option>
          <Option value="11">Khối 11</Option>
          <Option value="12">Khối 12</Option>
        </Select>

        <Select
          value={filters.type}
          onChange={(v) => setFilters((f) => ({ ...f, type: v }))}
          style={{ width: 160 }}
        >
          <Option value="Tất cả">Tất cả loại kỳ thi</Option>
          <Option value="regular">Giữa kỳ</Option>
          <Option value="final">Cuối kỳ</Option>
        </Select>

        <Select
          value={filters.year}
          onChange={(v) => setFilters((f) => ({ ...f, year: v }))}
          style={{ width: 160 }}
        >
          <Option value="Tất cả">Tất cả năm học</Option>
          {yearList.map((y) => (
            <Option key={y} value={y}>
              {y}
            </Option>
          ))}
        </Select>

        <Select
          value={filters.semester}
          onChange={(v) => setFilters((f) => ({ ...f, semester: v }))}
          style={{ width: 160 }}
        >
          <Option value="Tất cả">Tất cả học kỳ</Option>
          <Option value="1">Học kỳ 1</Option>
          <Option value="2">Học kỳ 2</Option>
        </Select>

        <Button
          icon={<FilterOutlined />}
          onClick={loadData}
          loading={loading}
          type="default"
        >
          Áp dụng lọc
        </Button>
      </Space>

      <Divider />

      <div id="analytics-section">
        <Card bordered loading={loading}>
          <Title level={5}>Biểu đồ số lượng kỳ thi theo trạng thái</Title>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data}>
              <XAxis dataKey="status" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#1890ff" name="Số kỳ thi" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
