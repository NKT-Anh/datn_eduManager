import React, { useEffect, useState, useMemo } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  DatePicker,
  Select,
  Space,
  Tag,
  message,
  Typography,
  Popconfirm,
  Card,
  TimePicker,
  Input,
  Empty,
  Tooltip,
  Divider,
} from "antd";
import dayjs from "dayjs";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCcw,
  Zap,
  CalendarDays,
  Clock,
  AlertCircle,
  CheckCircle,
  Printer,
    FileSpreadsheet,
  File,

} from "lucide-react";
import { examScheduleApi } from "@/services/exams/examScheduleApi";
// ✅ Sử dụng hooks thay vì API trực tiếp
import { useSubjects } from "@/hooks";
import ExamScheduleCalendar from "./ExamScheduleCalendar";
import { usePermissions } from "@/hooks/usePermissions";
import pdfMake from "pdfmake/build/pdfmake";
import { vfs } from "pdfmake/build/vfs_fonts";
import { saveAs } from "file-saver";
import settingApi from "@/services/settingApi";
import { toDataURL } from "@/utils/toDataURL";

(pdfMake as any).vfs = vfs;
(pdfMake as any).fonts = {
  Roboto: {
    normal: "Roboto-Regular.ttf",
    bold: "Roboto-Medium.ttf",
    italics: "Roboto-Italic.ttf",
    bolditalics: "Roboto-MediumItalic.ttf",
  },
};

interface ExamSchedulePageProps {
  examId: string;
  exam: any;
}

const { Title, Text } = Typography;
const { Option } = Select;

export default function ExamSchedulePage({ examId, exam }: ExamSchedulePageProps) {
  const { hasPermission, PERMISSIONS } = usePermissions();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  // ✅ Sử dụng hooks
  const { subjects } = useSubjects();
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [formGrade, setFormGrade] = useState<number | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const examGrades = exam?.grades || [10, 11, 12];
const [selectedGrade, setSelectedGrade] = useState<number>(0);
  const [selectedExamType, setSelectedExamType] = useState<string>(exam?.type || "midterm");
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [deleting, setDeleting] = useState(false);


  /* =========================================================
     🧠 Lấy danh sách lịch thi
  ========================================================= */
const fetchSchedules = async () => {
  try {
    setLoading(true);
    const res = await examScheduleApi.getByExam(
      examId,
      selectedGrade === 0 ? undefined : selectedGrade
    );
    const schedulesList = Array.isArray(res) ? res : [];
    setSchedules(schedulesList);
    
    // ✅ Nếu không có dữ liệu, không hiển thị error, chỉ set mảng rỗng
    if (schedulesList.length === 0) {
      // Không hiển thị thông báo lỗi, chỉ để trống
    }
    
    // ✅ Reset selectedRowKeys nếu các lịch đã chọn không còn tồn tại
    setSelectedRowKeys((prev) => {
      const existingIds = schedulesList.map((s: any) => s._id);
      return prev.filter((key) => existingIds.includes(key));
    });
  } catch (err: any) {
    // ✅ Nếu có lỗi thực sự (không phải do không có dữ liệu), chỉ log, không hiển thị toast
    console.error("Lỗi khi tải danh sách lịch thi:", err);
    setSchedules([]);
  } finally {
    setLoading(false);
  }
};


  /* =========================================================
     📚 Lấy danh sách môn học
  ========================================================= */
  // ✅ Không cần fetchSubjects nữa vì đã dùng hooks

useEffect(() => {
  if (examId) fetchSchedules();
}, [examId, selectedGrade]);

useEffect(() => {
  if (exam?.type) {
    setSelectedExamType(exam.type);
  }
}, [exam?.type]);


  /* =========================================================
     🧩 Mở Modal thêm/sửa
  ========================================================= */
  const openModal = (record?: any) => {
    if (record) {
      setEditing(record);
      form.setFieldsValue({
        ...record,
        subject: record.subject?._id || record.subject,
        date: record.date ? dayjs(record.date) : null,
        startTime: record.startTime ? dayjs(record.startTime, "HH:mm") : undefined,
      });
    } else {
      setEditing(null);
      form.resetFields();
      setFormGrade(null);
    }
    setModalOpen(true);
  };

  /* =========================================================
     💾 Lưu lịch thi
  ========================================================= */
const handleSubmit = async (values: any) => {
  try {
    // 🗓️ Kiểm tra ngày thi hợp lệ trong phạm vi kỳ thi
    const examStart = dayjs(exam.startDate);
    const examEnd = dayjs(exam.endDate);
    const examDate = dayjs(values.date);

    if (!examStart.isValid() || !examEnd.isValid()) {
      message.error("⚠️ Kỳ thi chưa có ngày bắt đầu/kết thúc hợp lệ.");
      return;
    }

    if (examDate.isBefore(examStart, "day") || examDate.isAfter(examEnd, "day")) {
      message.warning(
        `❌ Ngày thi phải nằm trong khoảng ${examStart.format("DD/MM/YYYY")} – ${examEnd.format("DD/MM/YYYY")}.`
      );
      return;
    }

    // ✅ Nếu hợp lệ thì tiếp tục tạo/sửa
    const payload = {
      ...values,
      exam: examId,
      date: values.date.toISOString(),
      startTime: values.startTime ? dayjs(values.startTime).format("HH:mm") : "",
    };

    let res;
    if (editing) {
      res = await examScheduleApi.update(editing._id, payload);
      message.success("✅ Cập nhật lịch thi thành công!");
    } else {
      res = await examScheduleApi.create(payload);
      message.success("✅ Tạo lịch thi mới thành công!");
    }

    setModalOpen(false);
    await fetchSchedules();

    // 🔥 Highlight dòng mới hoặc vừa sửa
    setHighlightId(editing ? editing._id : res.data?._id || res._id);
    setTimeout(() => setHighlightId(null), 3000);
  } catch (err: any) {
    console.error("❌ Lỗi lưu lịch thi:", err);
    message.error(err.response?.data?.error || "❌ Không thể lưu lịch thi.");
  }
};

const exportToPDF = async () => {
  try {
    message.loading({ content: "Đang tạo file PDF...", key: "pdf" });

    // 📚 Lấy danh sách lịch thi (đang hiển thị)
    const filteredData =
      selectedGrade === 0
        ? schedules
        : schedules.filter((s) => Number(s.grade) === Number(selectedGrade));

    if (!filteredData.length) {
      message.warning("Không có dữ liệu để xuất PDF");
      return;
    }

    // 🏫 Lấy thông tin trường
    let schoolName = "TRƯỜNG TRUNG HỌC PHỔ THÔNG";
    let schoolAddress = "Bình Dương";
    try {
      const cfg = await settingApi.getSettings();
      if (cfg) {
        schoolName = (cfg.schoolName || cfg.schoolname || schoolName).toUpperCase();
        if (cfg.address) {
          const parts = cfg.address.split(",");
          let province = parts.pop()?.trim() || cfg.address;
          if (/hcm|hồ chí minh/i.test(province)) province = "TP. Hồ Chí Minh";
          if (/bình dương/i.test(province)) province = "Bình Dương";
          if (/hà nội/i.test(province)) province = "Hà Nội";
          schoolAddress = province;
        }
      }
    } catch {}

    // 🖼️ Logo trường
    let logoBase64 = "";
    try {
      logoBase64 = await toDataURL("/assets/logo_school.png");
    } catch {
      logoBase64 = "";
    }

    // 🧾 Chuẩn bị dữ liệu bảng
    const rows = filteredData.map((item, i) => [
      { text: i + 1, alignment: "center" },
      { text: `Khối ${item.grade}`, alignment: "center" },
      { text: item.subject?.name || "-", alignment: "center" },
      { text: dayjs(item.date).format("DD/MM/YYYY"), alignment: "center" },
      { text: `${item.startTime} – ${item.endTime || "?"}`, alignment: "center" },
      { text: `${item.duration} phút`, alignment: "center" },
      {
        text: exam?.type === "final" ? "Cuối kỳ" : exam?.type === "midterm" ? "Giữa kỳ" : "Khác",
        alignment: "center",
      },
      {
        text:
          item.status === "confirmed"
            ? "Đã xác nhận"
            : item.status === "completed"
            ? "Hoàn tất"
            : "Khởi tạo",
        alignment: "center",
      },
    ]);

    const header = [
      { text: "STT", style: "tableHeader" },
      { text: "Khối", style: "tableHeader" },
      { text: "Môn học", style: "tableHeader" },
      { text: "Ngày thi", style: "tableHeader" },
      { text: "Giờ thi", style: "tableHeader" },
      { text: "Thời lượng", style: "tableHeader" },
      { text: "Loại", style: "tableHeader" },
      { text: "Trạng thái", style: "tableHeader" },
    ];

    const tableBody = [header, ...rows];
    const today = new Date();
    const gradeLabel = selectedGrade === 0 ? "TẤT CẢ KHỐI" : `KHỐI ${selectedGrade}`;
    const examName = exam?.name?.toUpperCase() || "KỲ THI";

    // 🧱 Cấu hình PDF
    const docDefinition: any = {
      pageOrientation: "landscape",
      pageSize: "A4",
      pageMargins: [40, 40, 40, 100],
      background: () => ({
        text: "SMART SCHOOL",
        color: "#cccccc",
        opacity: 0.12,
        bold: true,
        italics: true,
        fontSize: 60,
        alignment: "center",
        margin: [0, 200],
      }),
      content: [
        {
          columns: [
            logoBase64
              ? { image: logoBase64, width: 56, margin: [0, 0, 10, 0] }
              : { width: 56, text: "" },
            {
              stack: [
                { text: schoolName, style: "schoolHeader" },
                { text: `BÁO CÁO LỊCH THI - ${examName}`, style: "title" },
                { text: gradeLabel, style: "subtitle", margin: [0, 2, 0, 10] },
              ],
              alignment: "center",
            },
          ],
          columnGap: 10,
        },
        {
          text: `Ngày xuất: ${today.toLocaleDateString("vi-VN")}`,
          alignment: "right",
          fontSize: 10,
          margin: [0, 0, 0, 10],
        },
        {
          table: {
            headerRows: 1,
            widths: [25, 50, "*", 60, 75, 60, 70, 70],
            body: tableBody,
          },
          layout: {
            fillColor: (i: number) =>
              i === 0 ? "#1976d2" : i % 2 === 0 ? "#f9f9f9" : null,
            hLineColor: () => "#ddd",
            vLineColor: () => "#ddd",
          },
        },
      ],
      styles: {
        schoolHeader: { fontSize: 13, bold: true },
        title: { fontSize: 16, bold: true, alignment: "center" },
        subtitle: { fontSize: 11, italics: true, alignment: "center", color: "#555" },
        tableHeader: { bold: true, fontSize: 11, color: "white", alignment: "center" },
      },
      defaultStyle: { font: "Roboto", fontSize: 10 },
      footer: (currentPage: number, pageCount: number) => {
  const today = new Date();
  const footerDateText = `${schoolAddress || "Thủ Dầu Một"}, ngày ${today.getDate()} tháng ${
    today.getMonth() + 1
  } năm ${today.getFullYear()}`;

  // ❗ Chỉ hiển thị ở trang cuối cùng
  if (currentPage !== pageCount) {
    return {
      margin: [40, 0, 40, 30],
      columns: [
        { text: `Trang ${currentPage} / ${pageCount}`, alignment: "right", fontSize: 9, color: "#888" },
      ],
    };
  }

  // 🧾 Footer chỉ ở trang cuối
  return {
    margin: [40, 0, 40, 50],
    fontSize: 10,
    columns: [
      { width: "55%", text: "" },
      {
        width: "45%",
        stack: [
          {
            text: footerDateText,
            italics: true,
            color: "#555555",
            alignment: "center",
            margin: [0, 0, 0, 8],
          },
          {
            text: "NGƯỜI LẬP BÁO CÁO",
            bold: true,
            alignment: "center",
            margin: [0, 0, 0, 4],
          },
          {
            text: "(Ký tên, ghi rõ họ tên)",
            italics: true,
            color: "#555555",
            alignment: "center",
            margin: [0, 0, 0, 20],
          },
          {
            text: `Trang ${currentPage} / ${pageCount}`,
            alignment: "right",
            fontSize: 9,
            color: "#888",
          },
        ],
      },
    ],
  };
},

    };

    // 💾 Xuất file
    const pdfDocGenerator = pdfMake.createPdf(docDefinition);
    pdfDocGenerator.getBlob((blob: Blob) => {
      saveAs(blob, `Lich_thi_${examName}_${gradeLabel}_${Date.now()}.pdf`);
    });

    message.success({ content: "✅ Xuất PDF thành công", key: "pdf" });
  } catch (err) {
    console.error("❌ Lỗi xuất PDF:", err);
    message.error({ content: "❌ Lỗi khi xuất PDF", key: "pdf" });
  }
};

  /* =========================================================
     ⚡ Tự động tạo lịch
  ========================================================= */
  const handleAutoGenerate = async () => {
    try {
      message.loading({ content: "Đang tạo lịch thi tự động...", key: "auto" });
      const res = await examScheduleApi.autoGenerate(examId!, selectedGrade, selectedExamType);
      message.success({
        content: `✅ Tạo ${res.total} lịch thi thành công!`,
        key: "auto",
      });
      fetchSchedules();
    } catch (err: any) {
      message.error(err.response?.data?.error || "Lỗi khi tạo lịch tự động.");
    }
  };

  // Lọc môn học theo khối được chọn trong modal
  const getSubjectsByGrade = (grade: string | number) => {
    if (!grade || grade === "0" || grade === "all") return subjects;
    return subjects.filter((s: any) => {
      const subjectGrades = s.grades || [];
      return subjectGrades.includes(String(grade));
    });
  };

  /* =========================================================
     🗑️ Xóa hàng loạt lịch thi
  ========================================================= */
  const handleDeleteMultiple = async (ids: string[]) => {
    try {
      setDeleting(true);
      await examScheduleApi.deleteMultiple(ids);
      message.success(`✅ Đã xóa ${ids.length} lịch thi thành công.`);
      setSelectedRowKeys([]);
      // ✅ Tự động fetch lại dữ liệu ngay sau khi xóa
      await fetchSchedules();
    } catch (err: any) {
      message.error(err.response?.data?.error || "Lỗi khi xóa lịch thi.");
    } finally {
      setDeleting(false);
    }
  };

  /* =========================================================
     🗑️ Xóa tất cả lịch thi
  ========================================================= */
  const handleDeleteAll = async () => {
    try {
      const allScheduleIds = schedules.map((s) => s._id);
      if (allScheduleIds.length === 0) {
        message.warning("Không có lịch thi nào để xóa.");
        return;
      }
      
      Modal.confirm({
        title: "⚠️ Xác nhận xóa",
        content: `Bạn có chắc chắn muốn xóa tất cả ${allScheduleIds.length} lịch thi? Hành động này không thể hoàn tác.`,
        okText: "Xóa tất cả",
        okType: "danger",
        cancelText: "Hủy",
        onOk: async () => {
          setDeleting(true);
          try {
            await examScheduleApi.deleteMultiple(allScheduleIds);
            message.success(`✅ Đã xóa tất cả ${allScheduleIds.length} lịch thi thành công.`);
            setSelectedRowKeys([]);
            // ✅ Tự động fetch lại dữ liệu ngay sau khi xóa
            await fetchSchedules();
          } catch (err: any) {
            message.error(err.response?.data?.error || "Lỗi khi xóa lịch thi.");
          } finally {
            setDeleting(false);
          }
        },
      });
    } catch (err: any) {
      message.error("Lỗi khi xóa lịch thi.");
    }
  };

  /* =========================================================
     🗑️ Xóa lịch thi (một lịch)
  ========================================================= */
  const handleDelete = async (id: string) => {
    try {
      await examScheduleApi.remove(id);
      message.success("🗑️ Đã xóa lịch thi.");
      // ✅ Tự động fetch lại dữ liệu ngay sau khi xóa
      await fetchSchedules();
    } catch {
      message.error("Xóa thất bại.");
    }
  };

  /* =========================================================
     🔍 Lọc môn học chưa có lịch thi theo khối
  ========================================================= */
  const availableSubjects = useMemo(() => {
    if (!formGrade) return subjects;
    return subjects.filter((sub) => {
      const exists = schedules.some(
        (s) => s.grade === formGrade && s.subject?._id === sub._id
      );
      return !exists;
    });
  }, [subjects, schedules, formGrade]);

  const allSubjectsUsed =
    formGrade && availableSubjects.length === 0 && subjects.length > 0;

  /* =========================================================
     📋 Cột bảng
  ========================================================= */
  const columns = [
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
    },
    {
      title: "Ngày thi",
      dataIndex: "date",
      align: "center" as const,
      render: (v: string) => (
        <Space>
          <CalendarDays size={15} />
          {dayjs(v).format("DD/MM/YYYY")}
        </Space>
      ),
    },
    {
      title: "Giờ",
      dataIndex: "startTime",
      align: "center" as const,
      render: (v: string, r: any) => {
        // ✅ Tính vị trí trên timeline
        const getTimePosition = (timeStr: string) => {
          const [h, m] = timeStr.split(":").map(Number);
          const totalMinutes = h * 60 + m;
          const startMinutes = 7 * 60; // 7h
          const endMinutes = 17 * 60; // 17h
          const range = endMinutes - startMinutes;
          const position = ((totalMinutes - startMinutes) / range) * 100;
          return Math.max(0, Math.min(100, position));
        };

        const startPosition = getTimePosition(v || "07:00");
        const [endH, endM] = (r.endTime || v || "08:00").split(":").map(Number);
        const [startH, startM] = (v || "07:00").split(":").map(Number);
        const endTotalMinutes = endH * 60 + endM;
        const startTotalMinutes = startH * 60 + startM;
        const durationMinutes = endTotalMinutes - startTotalMinutes;
        const widthPercent = (durationMinutes / (17 * 60 - 7 * 60)) * 100;

        return (
          <Tooltip title={`Bắt đầu: ${v} | Kết thúc: ${r.endTime || "?"}`}>
            <Space direction="vertical" size={6} style={{ width: "100%" }}>
              <Space>
                <Clock size={14} />
                <Tag color="orange" style={{ fontWeight: "bold", fontSize: 12 }}>
                  {v} → {r.endTime || "?"}
                </Tag>
              </Space>
              {/* Timeline bar mini - Đẹp hơn */}
              <div style={{ 
                position: "relative", 
                width: "180px", 
                height: "20px", 
                backgroundColor: "#f5f5f5", 
                borderRadius: "10px",
                border: "1px solid #e8e8e8",
                margin: "0 auto",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.05)",
                overflow: "hidden"
              }}>
                <div
                  style={{
                    position: "absolute",
                    left: `${startPosition}%`,
                    width: `${Math.max(5, widthPercent)}%`,
                    height: "100%",
                    background: "linear-gradient(135deg, #1890ff 0%, #096dd9 100%)",
                    borderRadius: "10px",
                    boxShadow: "0 2px 4px rgba(24, 144, 255, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: "40px",
                  }}
                >
                  <Text 
                    style={{ 
                      color: "white", 
                      fontSize: "10px", 
                      fontWeight: "bold",
                      textShadow: "0 1px 2px rgba(0,0,0,0.2)",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {v}
                  </Text>
                </div>
              </div>
            </Space>
          </Tooltip>
        );
      },
    },
    {
      title: "Thời lượng",
      dataIndex: "duration",
      align: "center" as const,
      render: (v: number) => `${v} phút`,
    },
    {
      title: "Loại",
      dataIndex: "examType",
      align: "center" as const,
      render: () => {
        const examType = exam?.type;
        return examType === "final" ? (
          <Tag color="red">Cuối kỳ</Tag>
        ) : examType === "midterm" ? (
          <Tag color="orange">Giữa kỳ</Tag>
        ) : (
          <Tag color="default">Khác</Tag>
        );
      },
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
          {hasPermission(PERMISSIONS.EXAM_UPDATE) && (
            <Tooltip title="Chỉnh sửa lịch thi">
              <Button icon={<Pencil size={16} />} onClick={() => openModal(record)} size="small" />
            </Tooltip>
          )}
          {hasPermission(PERMISSIONS.EXAM_UPDATE) && (
            <Popconfirm title="Xóa lịch thi này?" onConfirm={() => handleDelete(record._id)}>
              <Button danger size="small" icon={<Trash2 size={16} />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  /* =========================================================
     🧱 Render giao diện
  ========================================================= */
  return (
    <Card
      style={{
        borderRadius: 16,
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        padding: 24,
      }}
    >
      <Space style={{ width: "100%", justifyContent: "space-between" }} align="center">
    <Title level={3} style={{ margin: 0 }}>
      Quản lý lịch thi
<Text type="secondary" style={{ fontSize: 14, marginLeft: 8 }}>
  {selectedGrade === 0 ? (
    <Tag color="blue">Đang xem: Tất cả khối</Tag>
  ) : (
    <Tag color="purple">Khối {selectedGrade}</Tag>
  )}
</Text>


    </Title>

        <Space>
<Select
  value={selectedGrade}
  onChange={setSelectedGrade}
  style={{ width: 150 }}
>
  <Option value={0}>Tất cả khối</Option>
  {examGrades.map((g: number) => (
    <Option key={g} value={g}>
      Khối {g}
    </Option>
  ))}
</Select>

<Select
  value={selectedExamType}
  onChange={setSelectedExamType}
  style={{ width: 150 }}
>
  <Option value="midterm">Giữa kỳ</Option>
  <Option value="final">Cuối kỳ</Option>
</Select>



          {hasPermission(PERMISSIONS.EXAM_UPDATE) && (
            <>
              {selectedRowKeys.length > 0 && (
                <Popconfirm
                  title={`Xác nhận xóa ${selectedRowKeys.length} lịch thi đã chọn?`}
                  onConfirm={() => handleDeleteMultiple(selectedRowKeys as string[])}
                  okText="Xóa"
                  okType="danger"
                  cancelText="Hủy"
                >
                  <Button 
                    icon={<Trash2 size={16} />} 
                    danger
                    loading={deleting}
                  >
                    Xóa đã chọn ({selectedRowKeys.length})
                  </Button>
                </Popconfirm>
              )}

              <Button 
                icon={<Trash2 size={16} />} 
                danger
                loading={deleting}
                disabled={schedules.length === 0}
                onClick={handleDeleteAll}
              >
                Xóa tất cả
              </Button>
            </>
          )}

          {hasPermission(PERMISSIONS.EXAM_SCHEDULE_AUTO) && (
            <Button icon={<Zap size={16} />} onClick={handleAutoGenerate} type="primary">
              Tạo tự động
            </Button>
          )}

          {hasPermission(PERMISSIONS.EXAM_UPDATE) && (
            <Button icon={<Plus size={16} />} onClick={() => openModal()}>
              Thêm mới
            </Button>
          )}
          <Button
  icon={<Printer size={16} />} // hoặc <Printer size={16} /> nếu dùng lucide-react
  onClick={exportToPDF }
  style={{ backgroundColor: "#e74c3c", color: "#fff" }}
>
  Xuất PDF
</Button>
          <Button
  icon={<CalendarDays size={16} />}
  onClick={() => setCalendarOpen(true)}
>
  Chế độ Lịch
</Button>

          <Button
            icon={<RefreshCcw size={16} />}
            loading={refreshing}
            onClick={async () => {
              setRefreshing(true);
              await fetchSchedules();
              setRefreshing(false);
            }}
          >
            Làm mới
          </Button>
        </Space>
      </Space>

      <Divider />

      {/* ✅ Timeline với các mốc thời gian */}
      {schedules.length > 0 && (
        <Card size="small" style={{ marginBottom: 16, backgroundColor: "#f5f5f5" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Text strong style={{ marginRight: 8 }}>Mốc thời gian:</Text>
            {["07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "12:30", "13:00", "14:00", "15:00", "16:00", "17:00"].map((time) => {
              // Lấy danh sách schedules đang hiển thị
              const displayedSchedules = selectedGrade === 0
                ? schedules
                : schedules.filter((s) => Number(s.grade) === Number(selectedGrade));
              
              // Kiểm tra xem có schedule nào bắt đầu tại mốc thời gian này không
              const hasSchedule = displayedSchedules.some((s) => {
                const [sh, sm] = (s.startTime || "00:00").split(":").map(Number);
                const [th, tm] = time.split(":").map(Number);
                return sh === th && sm === tm;
              });
              
              return (
                <Tag
                  key={time}
                  color={hasSchedule ? "blue" : "default"}
                  style={{
                    cursor: "default",
                    fontWeight: hasSchedule ? "bold" : "normal",
                  }}
                >
                  {time}
                </Tag>
              );
            })}
          </div>
        </Card>
      )}

<Table
  dataSource={
    selectedGrade === 0
      ? schedules
      : schedules.filter((s) => Number(s.grade) === Number(selectedGrade))
  }
  columns={columns}
  rowKey={(r) => r._id}
  loading={loading}
  rowSelection={{
    selectedRowKeys,
    onChange: (selectedKeys) => {
      setSelectedRowKeys(selectedKeys);
    },
    getCheckboxProps: (record) => ({
      disabled: false,
    }),
  }}
  pagination={{
    pageSizeOptions: ["10", "20", "50", "100"], // ✅ Các lựa chọn
    showSizeChanger: true,                      // ✅ Cho phép đổi
    defaultPageSize: 10,                        // ✅ Mặc định 10
    showTotal: (total) => `Tổng cộng ${total} lịch thi`, // ✅ Hiển thị tổng
  }}
  rowClassName={(record) =>
    record._id === highlightId ? "highlight-row" : ""
  }
  locale={{
    emptyText: (
      <Empty
        description={
          <Space>
            <CalendarDays size={18} />
            <Text type="secondary">Chưa có lịch thi nào</Text>
          </Space>
        }
      />
    ),
  }}
/>


      {/* 💡 CSS cho highlight */}
      <style>
        {`
          .highlight-row {
            animation: highlightFlash 2s ease-in-out;
            background-color: #f6ffed !important;
          }
          @keyframes highlightFlash {
            0% { background-color: #e6fffb; }
            50% { background-color: #f6ffed; }
            100% { background-color: white; }
          }
        `}
      </style>

      {/* Modal */}
      <Modal
        title={editing ? "Cập nhật lịch thi" : "Thêm lịch thi mới"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText="Lưu"
        destroyOnHidden
        okButtonProps={{
          disabled: allSubjectsUsed && !editing,
        }}
      >
        {/* 🗓️ Modal xem lịch */}


<Form
  layout="vertical"
  form={form}
  onFinish={handleSubmit}
  onValuesChange={(changed, allValues) => {
    // 🔄 Khi đổi khối, reset môn
    if ("grade" in changed) {
      setFormGrade(changed.grade);
      form.setFieldValue("subject", undefined);
    }

    // 🧠 Khi chọn môn học → auto set thời lượng mặc định
    if ("subject" in changed && changed.subject) {
      const selected = subjects.find((s) => s._id === changed.subject);
      if (selected && selected.defaultExamDuration) {
        form.setFieldValue("duration", selected.defaultExamDuration);
      } else {
        form.setFieldValue("duration", 90); // fallback
      }
    }
  }}
>
  <Form.Item
    name="grade"
    label="Khối"
    rules={[{ required: true, message: "Chọn khối" }]}
  >
    <Select placeholder="Chọn khối">
      {examGrades.map((g: number) => (
        <Option key={g} value={g}>
          Khối {g}
        </Option>
      ))}
    </Select>
  </Form.Item>

  <Form.Item
    name="subject"
    label="Môn học"
    rules={[{ required: true, message: "Chọn môn học" }]}
  >
    {allSubjectsUsed && !editing ? (
      <Empty
        description={
          <Space>
            <AlertCircle size={16} />
            <Text type="secondary">
              Tất cả môn của khối này đã có lịch thi
            </Text>
          </Space>
        }
      />
    ) : (
      <Select placeholder="Chọn môn học" disabled={!!editing}>
        {availableSubjects.map((s) => (
          <Option key={s._id} value={s._id}>
            {s.name}
          </Option>
        ))}
      </Select>
    )}
  </Form.Item>

  <Space style={{ width: "100%" }} size="large">
    <Form.Item
      name="date"
      label="Ngày thi"
      style={{ flex: 1 }}
      rules={[{ required: true, message: "Chọn ngày thi" }]}
    >
     <DatePicker
  style={{ width: "100%" }}
  format="DD/MM/YYYY"
  disabledDate={(current) =>
    current &&
    (current.isBefore(dayjs(exam.startDate), "day") ||
     current.isAfter(dayjs(exam.endDate), "day"))
  }
/>

    </Form.Item>

    <Form.Item
      name="startTime"
      label="Giờ bắt đầu"
      style={{ flex: 1 }}
      rules={[{ required: true, message: "Chọn giờ bắt đầu" }]}
    >
      <TimePicker 
        format="HH:mm" 
        style={{ width: "100%" }} 
        placeholder="Chọn giờ"
        minuteStep={15} // ✅ Chỉ cho phép chọn 0, 15, 30, 45 phút
        showNow={false}
        size="large"
      />
    </Form.Item>
  </Space>

  {/* 👇 Thời lượng thi tự động cập nhật theo môn học */}
  <Form.Item
    name="duration"
    label="Thời lượng (phút)"
    initialValue={90}
    rules={[
      { required: true, message: "Nhập thời lượng" },
      {
        validator: (_, value) =>
          value >= 15 && value <= 300
            ? Promise.resolve()
            : Promise.reject("Thời lượng phải từ 15–300 phút"),
      },
    ]}
  >
    <Input type="number" placeholder="VD: 90" />
  </Form.Item>

  <Form.Item name="examType" label="Loại bài thi" initialValue={exam?.type || "midterm"}>
    <Select>
      <Option value="midterm">Giữa kỳ</Option>
      <Option value="final">Cuối kỳ</Option>
    </Select>
  </Form.Item>

  <Form.Item name="notes" label="Ghi chú">
    <Input.TextArea rows={2} placeholder="Thêm ghi chú nếu có..." />
  </Form.Item>
</Form>

      </Modal>

      <Modal
  title="Lịch thi trực quan"
  open={calendarOpen}
  onCancel={() => setCalendarOpen(false)}
  footer={null}
  width={1000}
  style={{ top: 20 }}
  destroyOnHidden
>
<ExamScheduleCalendar
  exam={exam}
  schedules={schedules}
  onMoveBatch={async (updates) => {
    console.log("🚀 Gửi batch cập nhật:", updates);

    for (const u of updates) {
      console.log("➡️ Gửi updateDateTime:", u);
      await examScheduleApi.updateDateTime(u.id, {
        date: u.date,
        startTime: u.startTime,
      });
    }

    fetchSchedules();
  }}
/>



</Modal>
    </Card>
  );
}
