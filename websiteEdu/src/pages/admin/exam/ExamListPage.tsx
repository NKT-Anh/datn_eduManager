import React, { useState, useEffect } from "react";
import {
  Button,
  Table,
  Space,
  Popconfirm,
  Spin,
  Tag,
  Card,
  Typography,
  Divider,
  Select,
  Modal,
  Row,
  Col,
  message,
  Input,
} from "antd";
import {
  Plus,
  Eye,
  Edit,
  Trash2,
  FileText,
  BookOpen,
  Lock,
  CalendarDays,
  BarChart3,
  RefreshCw,
  Search,
  FileSpreadsheet,
  File,
} from "lucide-react"; // ✅ thay thế bộ icon 
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

import settingApi from "@/services/settingApi";
import logo from "@/assets/logo_school.png";
import { toDataURL } from "@/utils/toDataURL";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import pdfMake from "pdfmake/build/pdfmake";
import { vfs } from "pdfmake/build/vfs_fonts";
(pdfMake as any).vfs = vfs;
(pdfMake as any).fonts = {
  Roboto: {
    normal: "Roboto-Regular.ttf",
    bold: "Roboto-Medium.ttf",
    italics: "Roboto-Italic.ttf",
    bolditalics: "Roboto-MediumItalic.ttf",
  },
};

import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import { examApi } from "@/services/exams/examApi";
import type { Exam } from "@/services/exams/examApi";
import ExamForm from "./ExamForm";
import schoolConfigApi from "@/services/schoolConfigApi";

const { Title, Text } = Typography;
const { Option } = Select;

/* =========================================================
   📊 Modal thống kê kỳ thi
========================================================= */
function ExamStatsModal({ exam, onClose }: { exam: Exam; onClose: () => void }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await examApi.getStats(exam._id!);
        setStats(res);
      } catch {
        message.error("Không thể tải thống kê kỳ thi");
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, [exam]);

  return (
    <Modal
      open={!!exam}
      onCancel={onClose}
      footer={null}
      title={`📊 Thống kê kỳ thi: ${exam?.name}`}
      width={600}
      destroyOnHidden
    >
      {loading ? (
        <div style={{ textAlign: "center", padding: 24 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {[{ label: "Tổng khối lớp", key: "classes" },
            { label: "Lịch thi", key: "schedules" },
            { label: "Phòng thi", key: "rooms" },
            { label: "Điểm thi", key: "grades" }].map((item) => (
            <Col span={12} key={item.key}>
              <Card bordered>
                <Text type="secondary">{item.label}</Text>
                <Title level={4}>{stats?.[item.key] ?? 0}</Title>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </Modal>
  );
}

/* =========================================================
   🧩 Trang danh sách kỳ thi
========================================================= */
export default function ExamListPage() {
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [statsExam, setStatsExam] = useState<Exam | null>(null);
  const [modalKey, setModalKey] = useState(0);

  const [schoolYears, setSchoolYears] = useState<{ code: string; name: string }[]>([]);
  const [semesters, setSemesters] = useState<{ code: string; name: string }[]>([]);
  const [grades, setGrades] = useState<{ code: string; name: string }[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  /** 🎯 Bộ lọc */
  const [filters, setFilters] = useState({
    year: "Tất cả",
    semester: "Tất cả",
    grade: [] as string[],
    status: "Tất cả",
    keyword: "",
  });

  /** 📦 Lấy danh sách kỳ thi */
const fetchExams = async (page = pagination.current, limit = pagination.pageSize) => {
  setLoading(true);
  try {
    const params: any = { page, limit };

    if (filters.year !== "Tất cả") params.year = filters.year;
    if (filters.semester !== "Tất cả") params.semester = filters.semester;
    if (filters.grade.length) params.grade = filters.grade.map(Number);
    if (filters.status !== "Tất cả") params.status = filters.status;
    if (filters.keyword.trim()) params.keyword = filters.keyword;

    const res = await examApi.getAll(params);

    // ✅ Tự động nhận đúng format dù examApi trả về mảng hoặc object
    const data = Array.isArray(res) ? res : res.data;
    const total = Array.isArray(res) ? res.length : res.total;
    const pageNow = Array.isArray(res) ? 1 : res.page;
    const pageSize = Array.isArray(res) ? limit : res.limit;

    setExams(data);
    setPagination({
      current: pageNow,
      pageSize,
      total,
    });
  } catch (err: any) {
    message.error(err?.message || "Lỗi tải danh sách kỳ thi");
  } finally {
    setLoading(false);
  }
};


  useEffect(() => {
    const timeout = setTimeout(fetchExams, 400);
    return () => clearTimeout(timeout);
  }, [filters]);

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const [yRes, sRes, gRes] = await Promise.all([
          schoolConfigApi.getSchoolYears(),
          schoolConfigApi.getSemesters(),
          schoolConfigApi.getGrades(),
        ]);
        setSchoolYears(yRes.data || []);
        setSemesters(sRes.data || []);
        setGrades(gRes.data || []);
      } catch {
        message.error("Lỗi khi tải cấu hình năm học / học kỳ");
      }
    };
    fetchConfigs();
  }, []);

  /** ✏️ Mở modal thêm/sửa */
  const openModal = (id?: string) => {
    setEditingExamId(id || null);
    setModalKey((prev) => prev + 1);
    setModalOpen(true);
  };

  /** 🗑️ Xóa kỳ thi */
  const deleteExam = async (id: string) => {
    setBusyAction(id);
    try {
      await examApi.remove(id);
      setExams((prev) => prev.filter((x) => x._id !== id));
      message.success("Đã xóa kỳ thi");
    } catch (err: any) {
      message.error(err?.message || "Lỗi khi xóa kỳ thi");
    } finally {
      setBusyAction(null);
    }
  };

  /** 🔒 Cập nhật trạng thái */
  const changeStatus = async (id: string, status: string) => {
    setBusyAction(id);
    try {
      const res = await examApi.update(id, { status });
      const updatedExam = res?.exam || res;
      setExams((prev) => prev.map((x) => (x._id === id ? updatedExam : x)));
      message.success("Đã cập nhật trạng thái");
    } catch {
      message.error("Lỗi khi đổi trạng thái");
    } finally {
      setBusyAction(null);
    }
  };

  const mapType: Record<string, string> = {
    regular: "Chính thức",
    mock: "Thử",
    graduation: "Tốt nghiệp",
  };

  const statusConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
    draft: { color: "default", label: "Khởi tạo", icon: <FileText size={14} /> },
    published: { color: "blue", label: "Đã công bố", icon: <BookOpen size={14} /> },
    locked: { color: "orange", label: "Đã khóa", icon: <Lock size={14} /> },
    archived: { color: "gray", label: "Kết thúc", icon: <CalendarDays size={14} /> },
  };

  /* =========================================================
     📤 Xuất Excel
  ========================================================= */
  const exportToExcel = async () => {
    try {
      message.loading({ content: "Đang tạo file Excel...", key: "excel" });
      const data = await examApi.getAll(filters);
      if (!Array.isArray(data) || !data.length) {
        message.warning("Không có dữ liệu để xuất");
        return;
      }

      const exportData = data.map((exam, i) => ({
        STT: i + 1,
        "Tên kỳ thi": exam.name,
        "Mã kỳ thi": exam.examId,
        "Năm học": exam.year,
        "Học kỳ": exam.semester,
        "Loại": mapType[exam.type || "regular"] || "Không xác định",
        "Khối": exam.grades?.join(", ") || "-",
        "Ngày bắt đầu": exam.startDate ? new Date(exam.startDate).toLocaleDateString("vi-VN") : "-",
        "Ngày kết thúc": exam.endDate ? new Date(exam.endDate).toLocaleDateString("vi-VN") : "-",
        "Trạng thái": statusConfig[exam.status || "draft"]?.label || "Không xác định",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Kỳ thi");
      ws["!cols"] = Array(10).fill({ wch: 20 });

      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const fileName = `Danh_sach_ky_thi_${new Date().toLocaleDateString("vi-VN").replace(/\//g, "-")}.xlsx`;
      saveAs(new Blob([buffer], { type: "application/octet-stream" }), fileName);

      message.success({ content: "✅ Xuất Excel thành công", key: "excel" });
    } catch {
      message.error({ content: "❌ Lỗi khi xuất Excel", key: "excel" });
    }
  };

  /* =========================================================
     🧾 Xuất PDF
  ========================================================= */

const exportToPDF = async () => {
  try {
    message.loading({ content: "Đang tạo file PDF...", key: "pdf" });

    // 1) Lấy dữ liệu kỳ thi
    const data = await examApi.getAll(filters);
    if (!Array.isArray(data) || !data.length) {
      message.warning("Không có dữ liệu để xuất PDF");
      return;
    }

    // 2) Lấy cấu hình trường từ API (schoolName, address, ...)
let schoolName = "TRƯỜNG TRUNG HỌC PHỔ THÔNG";
let schoolAddress = "Bình Dương"; // fallback nếu không có dữ liệu

try {
  const cfg = await settingApi.getSettings();
  if (cfg) {
    // Tên trường
    schoolName = (cfg.schoolName || cfg.schoolname || schoolName).toUpperCase();

    // Lấy tỉnh/thành phố từ địa chỉ
    if (cfg.address) {
      // Cắt phần sau dấu phẩy cuối cùng
      const parts = cfg.address.split(",");
      let province = parts.pop()?.trim() || cfg.address;

      // Chuẩn hoá tên một số trường hợp phổ biến
      if (/hcm|hồ chí minh/i.test(province)) province = "TP. Hồ Chí Minh";
      if (/bình dương/i.test(province)) province = "Bình Dương";
      if (/hà nội/i.test(province)) province = "Hà Nội";

      schoolAddress = province;
    }
  }
} catch (err) {
  console.warn("Không lấy được settings, dùng mặc định", err);
}


    // 3) Logo (nên đặt vào public/assets/logo_school.png)
    let logoBase64 = "";
    try {
      logoBase64 = await toDataURL("/assets/logo_school.png");
    } catch (err) {
      console.warn("Không load được logo, bỏ qua.", err);
      logoBase64 = ""; // pdfMake bỏ qua nếu rỗng
    }

    // 4) Chuẩn hoá dòng dữ liệu bảng (bỏ cột mã kỳ thi)
    const rows = data.map((exam, i) => {
      const cells = [
        i + 1,
        exam?.name ?? "-",
        exam?.year ?? "-",
        exam?.semester ?? "-",
        (typeof mapType !== "undefined" ? mapType[exam?.type ?? "regular"] : (exam?.type ?? "Không xác định")) || "Không xác định",
        Array.isArray(exam?.grades) ? exam.grades.join(", ") : (exam?.grades ? String(exam.grades) : "-"),
        exam?.startDate ? new Date(exam.startDate).toLocaleDateString("vi-VN") : "-",
        exam?.endDate ? new Date(exam.endDate).toLocaleDateString("vi-VN") : "-",
        statusConfig?.[exam?.status ?? "draft"]?.label ?? "Không xác định",
      ];
      return cells.map((c) => ({ text: String(c), alignment: "center" }));
    });

    const header = [
      { text: "STT", style: "tableHeader" },
      { text: "Tên kỳ thi", style: "tableHeader" },
      { text: "Năm học", style: "tableHeader" },
      { text: "Học kỳ", style: "tableHeader" },
      { text: "Loại", style: "tableHeader" },
      { text: "Khối", style: "tableHeader" },
      { text: "Bắt đầu", style: "tableHeader" },
      { text: "Kết thúc", style: "tableHeader" },
      { text: "Trạng thái", style: "tableHeader" },
    ];

    const tableBody = [header, ...rows];

    // 5) docDefinition dùng schoolName và schoolAddress
    const today = new Date();
    const docDefinition: any = {
      pageOrientation: "landscape",
      pageSize: "A4",
      pageMargins: [40, 40, 40, 100], // chừa chỗ cho footer
      background: (currentPage: number) => ({
        text: "SMART SCHOOL",
        color: "#cccccc",
        opacity: 0.12,
        bold: true,
        italics: true,
        fontSize: 64,
        alignment: "center",
        margin: [0, 200],
      }),
      content: [
        // HEADER: logo + school name
        {
          columns: [
            logoBase64
              ? {
                  image: logoBase64,
                  width: 56,
                  margin: [0, 0, 10, 0],
                }
              : { width: 56, text: "" },
            {
              stack: [
                { text: schoolName, style: "schoolHeader" },
                { text: "BÁO CÁO DANH SÁCH KỲ THI", style: "title", margin: [0, 2, 0, 10] },
              ],
              alignment: "center",
            },
          ],
          columnGap: 10,
          margin: [0, 0, 0, 12],
        },

        // DATE LINE (bên phải)
        {
          text: `Ngày xuất: ${today.toLocaleDateString("vi-VN")}`,
          style: "date",
          alignment: "right",
          margin: [0, 0, 0, 8],
        },

        // TABLE
        {
          table: {
            headerRows: 1,
            widths: [25, "*", 70, 60, 70, 60, 70, 70, 70],
            body: tableBody,
          },
          layout: {
            fillColor: (rowIndex: number) =>
              rowIndex === 0 ? "#1976d2" : rowIndex % 2 === 0 ? "#f9f9f9" : null,
            hLineWidth: (i: number) => (i === 0 || i === tableBody.length ? 1 : 0.4),
            vLineWidth: () => 0.4,
            hLineColor: () => "#ddd",
            vLineColor: () => "#ddd",
          },
        },
      ],
      styles: {
        schoolHeader: { fontSize: 13, bold: true, alignment: "center", margin: [0, 0, 0, 5] },
        title: { fontSize: 18, bold: true, alignment: "center" },
        date: { fontSize: 11, italics: true, margin: [0, 0, 0, 10], color: "#333" },
        tableHeader: { bold: true, fontSize: 11, color: "white", alignment: "center" },
      },
      defaultStyle: { font: "Roboto", fontSize: 10 },

      // FOOTER: dùng schoolAddress (nếu cần) và căn phải, đảm bảo xuất luôn
      footer: (currentPage: number, pageCount: number) => {
        const footerDateText = `${schoolAddress || "Thủ Dầu Một"}, ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;

        return {
          margin: [40, 0, 40, 40], // kéo lên 1 chút
          fontSize: 10,
          columns: [
            { width: "55%", text: "" },
            {
              width: "45%",
              stack: [
                { text: footerDateText, italics: true, color: "#555555", alignment: "center", margin: [0, 0, 0, 6] },
                { text: "NGƯỜI LẬP BÁO CÁO", bold: true, alignment: "center", margin: [0, 0, 0, 4] },
                { text: "(Ký tên, ghi rõ họ tên)", italics: true, color: "#555555", alignment: "center" },
                { text: " ", margin: [0, 6, 0, 0] },
                { text: `Trang ${currentPage} / ${pageCount}`, alignment: "right", margin: [0, 6, 0, 0], fontSize: 9, color: "#777" },
              ],
            },
          ],
        };
      },
    };

    // 6) Tạo file PDF bằng pdfMake và download (dùng blob để tránh popup block)
    const pdfDocGenerator = pdfMake.createPdf(docDefinition);
    pdfDocGenerator.getBlob((blob: Blob) => {
      saveAs(blob, `Bao_cao_danh_sach_ky_thi_${Date.now()}.pdf`);
    });

    message.success({ content: "✅ Xuất PDF thành công", key: "pdf" });
  } catch (err) {
    console.error("❌ Lỗi xuất PDF:", err);
    message.error({ content: "❌ Lỗi khi xuất PDF", key: "pdf" });
  }
};





  /** 🧱 Cột bảng */
  const columns: ColumnsType<Exam> = [
    {
      title: <Text strong>Kỳ thi</Text>,
      key: "info",
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 15 }}>{r.name}</Text>
          <Text type="secondary">{r.examId}</Text>
        </Space>
      ),
    },
    {
      title: "Khối",
      dataIndex: "grades",
      align: "center",
      render: (grades?: string[]) =>
        grades?.length
          ? [...grades].sort((a, b) => Number(a) - Number(b)).map((g) => <Tag color="blue" key={g}>{g}</Tag>)
          : <Text type="secondary">-</Text>,
    },
    {
      title: "Năm học",
      dataIndex: "year",
      align: "center",
      render: (v) => <Tag color="purple">{v}</Tag>,
    },
    {
      title: "Học kỳ",
      dataIndex: "semester",
      align: "center",
      render: (v) => <Tag color="volcano">{v}</Tag>,
    },
    
    {
      title: "Loại kỳ thi",
      dataIndex: "type",
      align: "center",
      render: (v) => {
        const map: Record<string, { label: string; color: string }> = {
          regular: { label: "Chính thức", color: "green" },
          mock: { label: "Thử", color: "blue" },
          graduation: { label: "Tốt nghiệp", color: "purple" },
        };
        const info = map[v] || { label: "Không xác định", color: "default" };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
  title: "Thời gian",
  key: "duration",
  align: "center",
  render: (_, record) => {
    const start = record.startDate
      ? new Date(record.startDate).toLocaleDateString("vi-VN")
      : "-";
    const end = record.endDate
      ? new Date(record.endDate).toLocaleDateString("vi-VN")
      : "-";

    return (
      <Tag color="cyan">
        {start} → {end}
      </Tag>
    );
  },
},

    {
  title: "Trạng thái",
  dataIndex: "status",
  align: "center",
  render: (v, r) => {
    const current = v || "draft";
    const disabled = ["locked", "archived"].includes(current);
    const currentStatus = statusConfig[current] || statusConfig.draft;

    return (
      <div className="flex justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              disabled={disabled}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm transition-all border ${
                disabled
                  ? "opacity-60 cursor-not-allowed border-gray-200"
                  : "hover:bg-accent hover:text-accent-foreground border-transparent"
              }`}
              style={{
                backgroundColor:
                  current === "draft"
                    ? "#f5f5f5"
                    : current === "published"
                    ? "#e6f4ff"
                    : current === "locked"
                    ? "#fff3e0"
                    : "#f0f0f0",
              }}
            >
              <span className="flex items-center gap-1">
                {currentStatus.icon}
                <span>{currentStatus.label}</span>
              </span>
            </button>
          </DropdownMenuTrigger>

          {!disabled && (
            <DropdownMenuContent
              side="bottom"
              align="center"
              className="w-48 rounded-lg shadow-lg p-1"
            >
              {Object.entries(statusConfig).map(([key, { label, color, icon }]) => (
                <DropdownMenuItem
                  key={key}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-md cursor-pointer transition-colors text-sm ${
                    key === current
                      ? "bg-accent/70 text-primary font-semibold"
                      : "hover:bg-accent/50"
                  }`}
                  onClick={() => changeStatus(r._id!, key)}
                >
                  <div className="flex items-center gap-2">
                    {icon}
                    <span>{label}</span>
                  </div>
                  {key === current && (
                    <span className="text-primary font-bold text-xs">✓</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          )}
        </DropdownMenu>
      </div>
    );
  },
}
,
    {
      title: "Hành động",
      align: "center",
      width: 280,
      render: (_, r) => (
        <Space wrap>
          <Button size="small"  icon={<BarChart3 size={16} />}  onClick={() => setStatsExam(r)}>
 
          </Button>
          <Button size="small" icon={<Eye size={16} />}  onClick={() => navigate(`/admin/exam/${r._id}`)}>
       
          </Button>
          <Button size="small" type="primary" ghost icon={<Edit  size={16} />}  onClick={() => openModal(r._id)}>
          
          </Button>
          <Popconfirm title="Xóa kỳ thi này?" onConfirm={() => deleteExam(r._id!)} okText="Xóa" cancelText="Hủy">
            <Button size="small" danger icon={<Trash2  size={16} />}  loading={busyAction === r._id}>
              
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card style={{ borderRadius: 16, boxShadow: "0 4px 16px rgba(0,0,0,0.06)", padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col><Title level={3}>Quản lý Kỳ thi</Title></Col>
        <Col>
          <Space>
            <Button icon={<FileSpreadsheet size={16} />} onClick={() => console.log("Excel")} style={{ background: "#28a745", color: "#fff" }}>
              Xuất Excel
            </Button>
            <Button icon={<FileText size={16} />} onClick={() => console.log("PDF")} style={{ background: "#d35400", color: "#fff" }}>
              Xuất PDF
            </Button>
            <Button type="primary" icon={<Plus size={16} />} onClick={() => openModal()} style={{ borderRadius: 8 }}>
              Tạo kỳ thi mới
            </Button>
          </Space>
        </Col>
      </Row>

      {/* 🎛 Bộ lọc */}
      <Space wrap style={{ marginBottom: 16 }}>
        <Select value={filters.year} onChange={(v) => setFilters((f) => ({ ...f, year: v }))} style={{ width: 180 }}>
          <Option value="Tất cả">Tất cả năm học</Option>
          {schoolYears.map((y) => (
            <Option key={y.code} value={y.code}>{y.name}</Option>
          ))}
        </Select>

        <Select value={filters.semester} onChange={(v) => setFilters((f) => ({ ...f, semester: v }))} style={{ width: 140 }}>
          <Option value="Tất cả">Tất cả học kỳ</Option>
          {semesters.map((s) => (
            <Option key={s.code} value={s.code}>{s.name}</Option>
          ))}
        </Select>

        <Select
          mode="multiple"
          value={filters.grade}
          onChange={(v) => {
            if (v.includes("Tất cả")) setFilters((f) => ({ ...f, grade: [] }));
            else setFilters((f) => ({ ...f, grade: v }));
          }}
          style={{ width: 180 }}
          placeholder="Chọn khối học"
        >
          <Option value="Tất cả">Tất cả khối học</Option>
          {grades.map((g) => (
            <Option key={g.code} value={String(g.code)}>
              {g.name}
            </Option>
          ))}
        </Select>

        <Select value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} style={{ width: 160 }}>
          <Option value="Tất cả">Tất cả trạng thái</Option>
          {Object.entries(statusConfig).map(([key, { label }]) => (
            <Option key={key} value={key}>{label}</Option>
          ))}
        </Select>

        <Input
          placeholder="Tìm theo tên kỳ thi..."
          prefix={<Search  />}
          value={filters.keyword}
          onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value }))}
          style={{ width: 220 }}
        />

        <Button
          icon={<RefreshCw  />}
          onClick={() =>
            setFilters({ year: "Tất cả", semester: "Tất cả", grade: [], status: "Tất cả", keyword: "" })
          }
        >
          Làm mới
        </Button>
      </Space>

      <Divider />

      {loading ? (
        <Spin size="large" style={{ display: "block", margin: "60px auto" }} />
      ) : (
<Table<Exam>
  rowKey={(r) => r._id!}
  dataSource={exams}
  columns={columns}
  loading={loading}
  pagination={{
    current: pagination.current,
    pageSize: pagination.pageSize,
    total: pagination.total,
    showSizeChanger: true,
    showTotal: (total, range) =>
      `${range[0]}–${range[1]} trong tổng ${total} kỳ thi`,
  }}
  onChange={(p) => {
    fetchExams(p.current!, p.pageSize!);
  }}
/>


      )}

      <Modal
        key={modalKey}
        open={modalOpen}
        title={editingExamId ? "Chỉnh sửa kỳ thi" : "Tạo kỳ thi mới"}
        footer={null}
        onCancel={() => setModalOpen(false)}
        width={800}
        destroyOnHidden
      >
        <ExamForm
          id={editingExamId || undefined}
          onSuccess={() => {
            message.success("Cập nhật danh sách kỳ thi thành công");
            setModalOpen(false);
            fetchExams();
          }}
        />
      </Modal>

      {statsExam && <ExamStatsModal exam={statsExam} onClose={() => setStatsExam(null)} />}
    </Card>
  );
}
