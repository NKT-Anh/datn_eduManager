import React, { useEffect, useState } from "react";
import {
  Card,
  Row,
  Col,
  Typography,
  Statistic,
  Spin,
  message,
  Divider,
  Select,
  Space,
  Button,
  Tabs,
} from "antd";
import {
  BarChartOutlined,
  FileTextOutlined,
  LockOutlined,
  BookOutlined,
  CalendarOutlined,
  FilterOutlined,
  LineChartOutlined,
  TrophyOutlined,
  PieChartOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { examApi } from "@/services/exams/examApi";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const { Title } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

const COLORS = ["#1890ff", "#52c41a", "#faad14", "#f5222d", "#722ed1"];
const SEMESTER_COLORS = { "1": "#1890ff", "2": "#52c41a" };

export default function ExamDashboard() {
  // === State chung cho Dashboard ===
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any[]>([]);
  const [yearStats, setYearStats] = useState<any[]>([]);
  const [semesterStats, setSemesterStats] = useState<any[]>([]);
  const [filter, setFilter] = useState({
    year: "Tất cả",
    semester: "Tất cả",
    status: "Tất cả",
  });

  const [insight, setInsight] = useState({
    topYear: "-",
    totalHK1: 0,
    totalHK2: 0,
    percentArchived: 0,
  });

  // === Dữ liệu cho Detailed Analytics ===
  const [analysisData, setAnalysisData] = useState<any[]>([]);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisFilters, setAnalysisFilters] = useState({
    grade: "Tất cả",
    type: "Tất cả",
    year: "Tất cả",
    semester: "Tất cả",
  });
  const [yearList, setYearList] = useState<string[]>([]);

  // 🧭 Gọi API thống kê tổng quan
  const loadStats = async () => {
    setLoading(true);
    try {
      const [summaryRes, yearlyRes, allExamsRes] = await Promise.all([
        examApi.getSummary(),
        examApi.getYearlyStats(),
        examApi.getAll({ limit: 1000 }), // Lấy tất cả để thống kê
      ]);

      // ✅ Xử lý response từ getAll() - có thể là object với data property
      const allExams = Array.isArray(allExamsRes) 
        ? allExamsRes 
        : (allExamsRes?.data || []);

      // ✅ Group theo năm học (HK1 / HK2)
      const grouped = allExams.reduce((acc: any, exam: any) => {
        const { year, semester } = exam;
        if (!year) return acc;
        if (!acc[year]) acc[year] = { year, hk1: 0, hk2: 0 };
        if (semester === "1") acc[year].hk1 += 1;
        else if (semester === "2") acc[year].hk2 += 1;
        return acc;
      }, {});
      const semesterData = Object.values(grouped);

      // ✅ Insights nhanh
      const totalHK1 = allExams.filter((e) => e.semester === "1").length;
      const totalHK2 = allExams.filter((e) => e.semester === "2").length;
      const archived = allExams.filter((e) => e.status === "archived").length;
      const percentArchived = allExams.length
        ? Math.round((archived / allExams.length) * 100)
        : 0;
      
      // ✅ Xử lý yearlyRes - có thể là array hoặc object
      const yearlyData = Array.isArray(yearlyRes) ? yearlyRes : [];
      const topYearObj = yearlyData.length > 0
        ? yearlyData.reduce(
            (prev, curr) => (curr.totalExams > prev.totalExams ? curr : prev),
            { totalExams: 0, _id: "-" }
          )
        : { totalExams: 0, _id: "-" };

      setInsight({
        topYear: topYearObj._id || "-",
        totalHK1,
        totalHK2,
        percentArchived,
      });

      setSemesterStats(semesterData);
      setSummary(Array.isArray(summaryRes) ? summaryRes : []);
      setYearStats(yearlyData);
    } catch (err: any) {
      console.error('Error loading exam stats:', err);
      message.error(err?.response?.data?.error || "Không thể tải dữ liệu thống kê kỳ thi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  // ==================== OVERVIEW TAB ====================
  const statusLabel: Record<string, string> = {
    draft: "Khởi tạo",
    published: "Đã công bố",
    locked: "Đã khóa",
    archived: "Kết thúc",
  };
  const statusIcon: Record<string, React.ReactNode> = {
    draft: <FileTextOutlined style={{ color: "#1890ff" }} />,
    published: <BookOutlined style={{ color: "#52c41a" }} />,
    locked: <LockOutlined style={{ color: "#faad14" }} />,
    archived: <CalendarOutlined style={{ color: "#595959" }} />,
  };

  const filteredYearStats =
    filter.year !== "Tất cả"
      ? yearStats.filter((item) => item._id === filter.year)
      : yearStats;

  const filteredSummary =
    filter.status !== "Tất cả"
      ? summary.filter((s) => s._id === filter.status)
      : summary;

  const filteredSemesterStats =
    filter.year !== "Tất cả"
      ? semesterStats.filter((s: any) => s.year === filter.year)
      : semesterStats;

  const totalExams = filteredSummary.reduce(
    (sum, s) => sum + (s.count || 0),
    0
  );

  // Bộ lọc Overview
  const renderFilters = () => (
    <Space size="middle" wrap>
      <Select
        value={filter.year}
        onChange={(v) => setFilter((f) => ({ ...f, year: v }))}
        style={{ width: 180 }}
      >
        <Option value="Tất cả">Tất cả năm học</Option>
        {yearStats.map((y) => (
          <Option key={y._id} value={y._id}>
            {y._id}
          </Option>
        ))}
      </Select>
      <Select
        value={filter.semester}
        onChange={(v) => setFilter((f) => ({ ...f, semester: v }))}
        style={{ width: 180 }}
      >
        <Option value="Tất cả">Tất cả học kỳ</Option>
        <Option value="1">Học kỳ 1</Option>
        <Option value="2">Học kỳ 2</Option>
      </Select>
      <Select
        value={filter.status}
        onChange={(v) => setFilter((f) => ({ ...f, status: v }))}
        style={{ width: 180 }}
      >
        <Option value="Tất cả">Tất cả trạng thái</Option>
        {Object.keys(statusLabel).map((key) => (
          <Option key={key} value={key}>
            {statusLabel[key]}
          </Option>
        ))}
      </Select>
    </Space>
  );

  // ==================== DETAILED ANALYTICS ====================
  const loadDetailedData = async () => {
    setAnalysisLoading(true);
    try {
      const examsRes = await examApi.getAll({ limit: 1000 });
      // ✅ Xử lý response từ getAll() - có thể là object với data property
      const exams = Array.isArray(examsRes) 
        ? examsRes 
        : (examsRes?.data || []);
      
      setYearList([...new Set(exams.map((e: any) => e.year).filter(Boolean))]);

      let filtered = exams;
      if (analysisFilters.grade !== "Tất cả")
        filtered = filtered.filter((e: any) =>
          e.grades?.includes(analysisFilters.grade)
        );
      if (analysisFilters.type !== "Tất cả")
        filtered = filtered.filter((e: any) => e.type === analysisFilters.type);
      if (analysisFilters.year !== "Tất cả")
        filtered = filtered.filter((e: any) => e.year === analysisFilters.year);
      if (analysisFilters.semester !== "Tất cả")
        filtered = filtered.filter(
          (e: any) => e.semester === analysisFilters.semester
        );

      const grouped: Record<string, number> = (filtered as any[]).reduce((acc: Record<string, number>, exam: any) => {
        const key = exam.status || "unknown";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const chartData = Object.entries(grouped).map(([status, count]) => ({
        status,
        count: count as number,
      }));
      setAnalysisData(chartData);
    } catch (err) {
      console.error(err);
      message.error("Không thể tải dữ liệu phân tích chi tiết");
    } finally {
      setAnalysisLoading(false);
    }
  };

  useEffect(() => {
    loadDetailedData();
  }, [analysisFilters]);

  const exportPDF = async () => {
    const el = document.getElementById("detailed-analytics");
    if (!el) return;
    const canvas = await html2canvas(el);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;
    pdf.text("BÁO CÁO PHÂN TÍCH CHI TIẾT KỲ THI", 14, 15);
    pdf.addImage(imgData, "PNG", 10, 25, width - 20, height);
    pdf.save("Exam_Detailed_Analytics.pdf");
  };

  return (
    <div style={{ padding: 24 }}>
      <Tabs defaultActiveKey="overview" type="card">
        {/* TAB 1 - OVERVIEW */}
        <TabPane tab="📊 Tổng quan" key="overview">
          <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
            <Title level={2}>📊 Dashboard Kỳ thi</Title>
            <Space>
              <FilterOutlined style={{ fontSize: 18, color: "#555" }} />
              {renderFilters()}
            </Space>
          </Row>

          {loading ? (
            <div style={{ textAlign: "center", padding: 60 }}>
              <Spin size="large" />
            </div>
          ) : (
            <>
              {/* Mini Insights */}
              <Row gutter={[16, 16]}>
                <Col xs={24} md={6}>
                  <Card bordered>
                    <Statistic
                      title="Năm có nhiều kỳ thi nhất"
                      value={insight.topYear}
                      prefix={<TrophyOutlined style={{ color: "#faad14" }} />}
                    />
                  </Card>
                </Col>
                <Col xs={24} md={6}>
                  <Card bordered>
                    <Statistic
                      title="Tổng kỳ thi học kỳ 1"
                      value={insight.totalHK1}
                      prefix={<BarChartOutlined style={{ color: "#1890ff" }} />}
                    />
                  </Card>
                </Col>
                <Col xs={24} md={6}>
                  <Card bordered>
                    <Statistic
                      title="Tổng kỳ thi học kỳ 2"
                      value={insight.totalHK2}
                      prefix={<LineChartOutlined style={{ color: "#52c41a" }} />}
                    />
                  </Card>
                </Col>
                <Col xs={24} md={6}>
                  <Card bordered>
                    <Statistic
                      title="Tỷ lệ kỳ thi đã kết thúc"
                      value={`${insight.percentArchived}%`}
                      prefix={<CheckCircleOutlined style={{ color: "#595959" }} />}
                    />
                  </Card>
                </Col>
              </Row>

              <Divider />

              {/* Tổng quan trạng thái */}
              <Row gutter={[16, 16]}>
                <Col xs={24} md={6}>
                  <Card bordered style={{ textAlign: "center" }}>
                    <Statistic
                      title="Tổng số kỳ thi"
                      value={totalExams}
                      prefix={<PieChartOutlined />}
                      valueStyle={{ color: "#1890ff" }}
                    />
                  </Card>
                </Col>

                {filteredSummary.map((s, i) => (
                  <Col xs={24} md={6} key={i}>
                    <Card bordered style={{ textAlign: "center" }}>
                      <Statistic
                        title={statusLabel[s._id] || s._id}
                        value={s.count}
                        prefix={statusIcon[s._id] || <FileTextOutlined />}
                        valueStyle={{ color: COLORS[i % COLORS.length] }}
                      />
                    </Card>
                  </Col>
                ))}
              </Row>

              <Divider />

              {/* Biểu đồ */}
              <Row gutter={[24, 24]}>
                {/* Pie Chart */}
                <Col xs={24} md={8}>
                  <Card title="Tỷ lệ kỳ thi theo trạng thái" bordered>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={filteredSummary}
                          dataKey="count"
                          nameKey="_id"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ name, percent }) =>
                            `${statusLabel[name] || name}: ${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {filteredSummary.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>

                {/* Bar Chart */}
                <Col xs={24} md={8}>
                  <Card title="Số kỳ thi theo năm học" bordered>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={filteredYearStats}>
                        <XAxis dataKey="_id" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="totalExams" fill="#1890ff" barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>

                {/* Stacked Bar Chart */}
                <Col xs={24} md={8}>
                  <Card title="Số kỳ thi theo học kỳ (mỗi năm)" bordered>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={filteredSemesterStats}>
                        <XAxis dataKey="year" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar
                          dataKey="hk1"
                          stackId="a"
                          fill={SEMESTER_COLORS["1"]}
                          name="Học kỳ 1"
                        />
                        <Bar
                          dataKey="hk2"
                          stackId="a"
                          fill={SEMESTER_COLORS["2"]}
                          name="Học kỳ 2"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>
              </Row>
            </>
          )}
        </TabPane>

        {/* TAB 2 - DETAILED ANALYTICS */}
        <TabPane tab="📈 Phân tích chi tiết" key="detailed">
          <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
            <Title level={3}>📈 Phân tích chi tiết kỳ thi</Title>
            <Button
              icon={<DownloadOutlined />}
              type="primary"
              onClick={exportPDF}
            >
              Xuất báo cáo PDF
            </Button>
          </Row>

          <Space size="middle" wrap>
            <Select
              value={analysisFilters.grade}
              onChange={(v) => setAnalysisFilters((f) => ({ ...f, grade: v }))}
              style={{ width: 160 }}
            >
              <Option value="Tất cả">Tất cả khối</Option>
              <Option value="10">Khối 10</Option>
              <Option value="11">Khối 11</Option>
              <Option value="12">Khối 12</Option>
            </Select>

            <Select
              value={analysisFilters.type}
              onChange={(v) => setAnalysisFilters((f) => ({ ...f, type: v }))}
              style={{ width: 160 }}
            >
              <Option value="Tất cả">Tất cả loại kỳ thi</Option>
              <Option value="regular">Giữa kỳ</Option>
              <Option value="final">Cuối kỳ</Option>
            </Select>

            <Select
              value={analysisFilters.year}
              onChange={(v) => setAnalysisFilters((f) => ({ ...f, year: v }))}
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
              value={analysisFilters.semester}
              onChange={(v) => setAnalysisFilters((f) => ({ ...f, semester: v }))}
              style={{ width: 160 }}
            >
              <Option value="Tất cả">Tất cả học kỳ</Option>
              <Option value="1">Học kỳ 1</Option>
              <Option value="2">Học kỳ 2</Option>
            </Select>

            <Button
              icon={<FilterOutlined />}
              onClick={loadDetailedData}
              loading={analysisLoading}
            >
              Áp dụng lọc
            </Button>
          </Space>

          <Divider />

          <div id="detailed-analytics">
            <Card bordered loading={analysisLoading}>
              <Title level={5}>Biểu đồ số lượng kỳ thi theo trạng thái</Title>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={analysisData}>
                  <XAxis dataKey="status" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#1890ff" name="Số kỳ thi" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabPane>
      </Tabs>
    </div>
  );
}
