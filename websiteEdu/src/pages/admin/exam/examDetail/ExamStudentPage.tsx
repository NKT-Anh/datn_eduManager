import React, { useEffect, useState, useMemo } from "react";
import {
  Table,
  Button,
  Space,
  message,
  Modal,
  Select,
  Spin,
  Popconfirm,
  Tag,
  Typography,
  Form,
  Input,
  Card,
  Row,
  Col,
} from "antd";
import {
  ReloadOutlined,
  PlusOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  SearchOutlined,
  UserAddOutlined,
  EditOutlined,
} from "@ant-design/icons";
import { examStudentApi } from "@/services/exams/examStudentApi";
import schoolConfigApi from "@/services/schoolConfigApi";
import { usePermissions } from "@/hooks/usePermissions";

const { Title, Text } = Typography;
const { Option } = Select;

interface ExamStudentPageProps {
  examId: string;
  exam: any;
}

export default function ExamStudentPage({ examId, exam }: ExamStudentPageProps) {
  const { hasPermission, PERMISSIONS } = usePermissions();
  const [data, setData] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingAll, setAddingAll] = useState(false);
  const [stats, setStats] = useState<any>(null);

  // 🔍 Filters
  const [filters, setFilters] = useState({
    grade: "Tất cả",
    status: "Tất cả",
    keyword: "",
  });

  // Modal thêm học sinh
  const [openCreate, setOpenCreate] = useState(false);
  const [createForm] = Form.useForm();

  // Modal thêm hàng loạt
  const [openBulkAdd, setOpenBulkAdd] = useState(false);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [candidateFilters, setCandidateFilters] = useState({
    grade: undefined as number | undefined,
    keyword: "",
  });
  const [addingMultiple, setAddingMultiple] = useState(false);

  // Modal xem chi tiết / cập nhật
  const [openEdit, setOpenEdit] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [editForm] = Form.useForm();

  /** 📋 Lấy danh sách học sinh dự thi */
  const fetchExamStudents = async () => {
    try {
      setLoading(true);
      const res = await examStudentApi.getByExam(examId);
      // ✅ Đảm bảo res là array hoặc object có data
      let studentsData: any[] = [];
      if (Array.isArray(res)) {
        studentsData = res;
      } else if (res?.data && Array.isArray(res.data)) {
        studentsData = res.data;
      } else if (res?.data && !Array.isArray(res.data)) {
        // Nếu data là object, chuyển thành array
        studentsData = [];
      }
      setData(studentsData);
    } catch (err) {
      console.error(err);
      message.error("❌ Không thể tải danh sách học sinh dự thi");
      setData([]); // Set empty array nếu lỗi
    } finally {
      setLoading(false);
    }
  };

  /** 🏫 Lấy danh sách khối học */
  const fetchGrades = async () => {
    try {
      const res = await schoolConfigApi.getGrades();
      setGrades(res.data || res);
    } catch (err) {
      console.error(err);
      message.error("❌ Không thể tải danh sách khối học");
    }
  };

  /** 📊 Lấy thống kê học sinh */
  const fetchStats = async () => {
    try {
      const res = await examStudentApi.getStats(examId);
      setStats(res);
    } catch (err) {
      console.error("Lỗi lấy thống kê:", err);
    }
  };

  useEffect(() => {
    if (examId) {
      fetchExamStudents();
      fetchGrades();
      fetchStats();
    }
  }, [examId]);

  /** ➕ Thêm học sinh của 1 khối vào kỳ thi */
  const handleAddByGrade = async (values: any) => {
    try {
      const payload = {
        examId,
        grade: values.grade,
      };

      await examStudentApi.addOrAssign(payload);

      message.success(`✅ Đã thêm toàn bộ học sinh khối ${values.grade} vào kỳ thi!`);
      setOpenCreate(false);
      createForm.resetFields();
      fetchExamStudents();
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data?.error || "❌ Lỗi khi thêm học sinh");
    }
  };

  /** 📋 Lấy danh sách học sinh đủ điều kiện */
  const fetchCandidates = async () => {
    try {
      setLoadingCandidates(true);
      const res = await examStudentApi.getCandidates(examId, {
        grade: candidateFilters.grade,
        keyword: candidateFilters.keyword || undefined,
        limit: 500, // Lấy tối đa 500 học sinh
      });
      const candidatesData = Array.isArray(res?.data) ? res.data : (res?.data || []);
      setCandidates(candidatesData);
    } catch (err) {
      console.error("Lỗi lấy danh sách học sinh:", err);
      message.error("❌ Không thể tải danh sách học sinh");
      setCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  };

  /** 🔍 Mở modal thêm hàng loạt */
  const handleOpenBulkAdd = () => {
    setOpenBulkAdd(true);
    setSelectedStudentIds([]);
    setCandidateFilters({ grade: undefined, keyword: "" });
    fetchCandidates();
  };

  /** ➕ Thêm nhiều học sinh đã chọn */
  const handleAddMultiple = async () => {
    if (selectedStudentIds.length === 0) {
      message.warning("Vui lòng chọn ít nhất một học sinh");
      return;
    }

    try {
      setAddingMultiple(true);
      const res = await examStudentApi.addMultiple({
        examId,
        studentIds: selectedStudentIds,
      });
      message.success(res.message || `✅ Đã thêm ${res.total || 0} học sinh`);
      if (res.skipped > 0) {
        message.info(`${res.skipped} học sinh đã có trong kỳ thi, đã bỏ qua`);
      }
      if (res.withoutClass > 0) {
        message.warning(`${res.withoutClass} học sinh chưa có lớp, đã bỏ qua. Vui lòng gán lớp cho học sinh trước.`);
      }
      setOpenBulkAdd(false);
      setSelectedStudentIds([]);
      fetchExamStudents();
      fetchStats();
    } catch (err: any) {
      console.error("Lỗi thêm học sinh:", err);
      message.error(err?.response?.data?.error || "❌ Lỗi khi thêm học sinh");
    } finally {
      setAddingMultiple(false);
    }
  };

  /** ➕ Thêm tất cả học sinh theo khối tham gia */
  const handleAddAllStudents = async () => {
    try {
      setAddingAll(true);
      const res = await examStudentApi.addAllStudentsByGrades(examId);
      message.success(res.message || `✅ Đã thêm ${res.added || 0} học sinh mới`);
      fetchExamStudents();
      fetchStats();
    } catch (err: any) {
      console.error("Lỗi thêm học sinh:", err);
      message.error(err?.response?.data?.error || "❌ Lỗi khi thêm học sinh");
    } finally {
      setAddingAll(false);
    }
  };

  /** ✏️ Mở modal cập nhật học sinh */
  const handleOpenEdit = (student: any) => {
    setSelectedStudent(student);
    editForm.setFieldsValue({
      status: student.status || "active",
      note: student.note || "",
    });
    setOpenEdit(true);
  };

  /** ✏️ Cập nhật học sinh */
  const handleUpdate = async (values: any) => {
    if (!selectedStudent) return;
    try {
      await examStudentApi.update(selectedStudent._id, values);
      message.success("✅ Đã cập nhật thông tin học sinh");
      setOpenEdit(false);
      setSelectedStudent(null);
      editForm.resetFields();
      fetchExamStudents();
      fetchStats();
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data?.error || "❌ Lỗi khi cập nhật");
    }
  };

  /** 🗑️ Xóa 1 học sinh khỏi danh sách */
  const handleDelete = async (id: string) => {
    try {
      await examStudentApi.remove(id);
      message.success("🗑️ Đã xóa học sinh khỏi kỳ thi");
      fetchExamStudents();
      fetchStats();
    } catch (err: any) {
      message.error(err?.response?.data?.error || "❌ Lỗi khi xóa");
    }
  };

  /** 📦 Xuất danh sách */
  const handleExport = () => {
    message.info("📄 Tính năng xuất Excel đang được phát triển...");
  };

  /** 🔍 Lọc danh sách học sinh */
  const filteredData = useMemo(() => {
    // ✅ Đảm bảo data là array
    if (!Array.isArray(data)) return [];
    let result = [...data];

    // Lọc theo khối
    if (filters.grade !== "Tất cả") {
      const gradeStr = String(filters.grade);
      result = result.filter((r) => String(r.grade) === gradeStr);
    }

    // Lọc theo trạng thái
    if (filters.status !== "Tất cả") {
      result = result.filter((r) => r.status === filters.status);
    }

    // Tìm kiếm theo keyword
    if (filters.keyword.trim()) {
      const keyword = filters.keyword.toLowerCase();
      result = result.filter(
        (r) =>
          r.student?.name?.toLowerCase().includes(keyword) ||
          r.student?.studentCode?.toLowerCase().includes(keyword) ||
          r.class?.className?.toLowerCase().includes(keyword) || // ✅ Tìm theo ExamStudent.class.className
          r.class?.name?.toLowerCase().includes(keyword) ||
          r.student?.className?.toLowerCase().includes(keyword) ||
          r.sbd?.toLowerCase().includes(keyword)
      );
    }

    return result;
  }, [data, filters]);

  /** 📘 Cột bảng */
  const columns = [
    {
      title: "Mã HS",
      render: (r: any) => r.student?.studentCode || "-",
      align: "center" as const,
    },
    {
      title: "Họ tên",
      render: (r: any) => r.student?.name || "-",
      align: "center" as const,
    },
    {
      title: "Lớp",
      render: (r: any) => r.class?.className || r.class?.name || r.student?.className || "-", // ✅ Ưu tiên ExamStudent.class.className (snapshot tại thời điểm thi)
      align: "center" as const,
    },
    {
      title: "Khối",
      dataIndex: "grade",
      align: "center" as const,
    },
    {
      title: "SBD",
      dataIndex: "sbd",
      align: "center" as const,
      render: (v: string) => v ? <Tag color="cyan">{v}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: "Phòng thi",
      align: "center" as const,
      render: (r: any) => {
        // ✅ room là FixedExamRoom (phòng nhóm), có field code
        if (r.room?.code) {
          return <Tag color="blue">{r.room.code}</Tag>;
        }
        return <Text type="secondary">Chưa xếp phòng</Text>;
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      align: "center" as const,
      render: (v: string) => {
        const statusMap: Record<string, { label: string; color: string }> = {
          active: { label: "Đăng ký", color: "blue" },
          present: { label: "Có mặt", color: "green" },
          absent: { label: "Vắng", color: "red" },
          excluded: { label: "Đình chỉ", color: "orange" },
        };
        const info = statusMap[v || "active"] || statusMap.active;
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: "Thao tác",
      align: "center" as const,
      width: 150,
      render: (r: any) => (
        <Space>
          {hasPermission(PERMISSIONS.EXAM_UPDATE) && (
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleOpenEdit(r)}
              title="Cập nhật"
            />
          )}
          {hasPermission(PERMISSIONS.EXAM_UPDATE) && (
            <Popconfirm
              title="Xóa học sinh này khỏi kỳ thi?"
              onConfirm={() => handleDelete(r._id)}
            >
              <Button danger icon={<DeleteOutlined />} title="Xóa" />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div
      style={{
        borderRadius: 16,
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
        padding: 20,
        background: "#fff",
      }}
    >
      {/* Header */}
      <Space
        direction="vertical"
        style={{ width: "100%", marginBottom: 16 }}
        size="large"
      >
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <div>
            <Title level={3}>Danh sách học sinh dự thi</Title>
            <Text type="secondary">
              {exam?.name} • Năm {exam?.year} • HK{exam?.semester}
            </Text>
          </div>

          <Space>
            {hasPermission(PERMISSIONS.EXAM_UPDATE) && (
              <>
                <Popconfirm
                  title="Thêm tất cả học sinh?"
                  description={`Hệ thống sẽ tự động thêm tất cả học sinh khối ${exam?.grades?.join(", ") || ""} của niên khóa ${exam?.year} vào kỳ thi. Chỉ thêm những học sinh chưa có.`}
                  onConfirm={handleAddAllStudents}
                  okText="Xác nhận"
                  cancelText="Hủy"
                >
                  <Button
                    type="primary"
                    icon={<UserAddOutlined />}
                    loading={addingAll}
                  >
                    ➕ Thêm tất cả học sinh
                  </Button>
                </Popconfirm>
                <Button
                  type="default"
                  icon={<PlusOutlined />}
                  onClick={handleOpenBulkAdd}
                >
                  Thêm hàng loạt
                </Button>
                <Button
                  type="default"
                  icon={<PlusOutlined />}
                  onClick={() => setOpenCreate(true)}
                >
                  Thêm theo khối
                </Button>
              </>
            )}
            <Button icon={<FileExcelOutlined />} onClick={handleExport}>
              Xuất Excel
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchExamStudents}>
              Làm mới
            </Button>
          </Space>
        </Space>
      </Space>

      {/* 📊 Thống kê */}
      {stats && (
        <Card style={{ marginBottom: 16, background: "#e6f7ff", borderColor: "#91d5ff" }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={6}>
              <div style={{ textAlign: "center" }}>
                <Text type="secondary">Tổng số học sinh</Text>
                <div style={{ fontSize: 24, fontWeight: "bold", color: "#1890ff" }}>
                  {stats.total || data.length}
                </div>
              </div>
            </Col>
            {stats.byGrade && Object.keys(stats.byGrade).map((grade) => (
              <Col xs={24} sm={6} key={grade}>
                <div style={{ textAlign: "center" }}>
                  <Text type="secondary">Khối {grade}</Text>
                  <div style={{ fontSize: 20, fontWeight: "bold", color: "#52c41a" }}>
                    {stats.byGrade[grade] || 0}
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* 🔍 Bộ lọc và tìm kiếm */}
      <Card style={{ marginBottom: 16, background: "#fafafa" }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={8} md={6}>
            <Select
              value={filters.grade}
              onChange={(v) => setFilters((f) => ({ ...f, grade: v }))}
              style={{ width: "100%" }}
              placeholder="Lọc theo khối"
            >
              <Option value="Tất cả">Tất cả khối</Option>
              {exam?.grades?.map((g: string | number) => (
                <Option key={String(g)} value={String(g)}>
                  Khối {g}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Select
              value={filters.status}
              onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
              style={{ width: "100%" }}
              placeholder="Lọc theo trạng thái"
            >
              <Option value="Tất cả">Tất cả trạng thái</Option>
              <Option value="active">Đăng ký</Option>
              <Option value="present">Có mặt</Option>
              <Option value="absent">Vắng</Option>
              <Option value="excluded">Đình chỉ</Option>
            </Select>
          </Col>
          <Col xs={24} sm={8} md={12}>
            <Input
              placeholder="Tìm theo tên, mã HS, tên lớp, SBD..."
              prefix={<SearchOutlined />}
              value={filters.keyword}
              onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value }))}
              allowClear
            />
          </Col>
        </Row>
      </Card>

      <Spin spinning={loading}>
        <Table
          dataSource={filteredData}
          columns={columns}
          rowKey={(r) => r._id}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Tổng ${total} học sinh` }}
          bordered
        />
      </Spin>

      {/* Modal thêm học sinh theo khối */}
      <Modal
        open={openCreate}
        title="Thêm học sinh theo khối học"
        onCancel={() => {
          setOpenCreate(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        okText="Thêm"
      >
        <Form form={createForm} layout="vertical" onFinish={handleAddByGrade}>
          <Form.Item
            name="grade"
            label="Chọn khối học"
            rules={[{ required: true, message: "Vui lòng chọn khối học" }]}
            tooltip="Chọn khối để thêm tất cả học sinh của khối đó vào kỳ thi"
          >
            <Select placeholder="Chọn khối...">
              {exam?.grades?.map((g: string | number) => (
                <Option key={String(g)} value={Number(g)}>
                  Khối {g}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal thêm hàng loạt */}
      <Modal
        open={openBulkAdd}
        title="Thêm học sinh hàng loạt"
        width={900}
        onCancel={() => {
          setOpenBulkAdd(false);
          setSelectedStudentIds([]);
          setCandidateFilters({ grade: undefined, keyword: "" });
        }}
        onOk={handleAddMultiple}
        okText={`Thêm ${selectedStudentIds.length} học sinh`}
        okButtonProps={{ disabled: selectedStudentIds.length === 0, loading: addingMultiple }}
        cancelText="Hủy"
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          {/* Bộ lọc */}
          <Card size="small" style={{ background: "#fafafa" }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Select
                  placeholder="Lọc theo khối"
                  style={{ width: "100%" }}
                  allowClear
                  value={candidateFilters.grade}
                  onChange={(v) => {
                    setCandidateFilters((f) => ({ ...f, grade: v }));
                  }}
                >
                  {exam?.grades?.map((g: string | number) => (
                    <Option key={String(g)} value={Number(g)}>
                      Khối {g}
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col xs={24} sm={12}>
                <Input
                  placeholder="Tìm theo tên, mã HS..."
                  prefix={<SearchOutlined />}
                  value={candidateFilters.keyword}
                  onChange={(e) => {
                    setCandidateFilters((f) => ({ ...f, keyword: e.target.value }));
                  }}
                  onPressEnter={fetchCandidates}
                  allowClear
                />
              </Col>
              <Col xs={24}>
                <Button type="primary" icon={<SearchOutlined />} onClick={fetchCandidates}>
                  Tìm kiếm
                </Button>
              </Col>
            </Row>
          </Card>

          {/* Danh sách học sinh */}
          <div>
            <Text strong>
              Đã chọn: {selectedStudentIds.length} học sinh
              {candidates.filter((c) => c.alreadyInExam).length > 0 && (
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  ({candidates.filter((c) => c.alreadyInExam).length} học sinh đã có trong kỳ thi)
                </Text>
              )}
            </Text>
          </div>

          <Spin spinning={loadingCandidates}>
            <Table
              dataSource={candidates}
              rowKey="_id"
              pagination={{ pageSize: 10, showSizeChanger: true }}
              size="small"
              rowSelection={{
                selectedRowKeys: selectedStudentIds,
                onChange: (selectedKeys) => {
                  setSelectedStudentIds(selectedKeys as string[]);
                },
                getCheckboxProps: (record: any) => ({
                  disabled: record.alreadyInExam, // Disable nếu đã có trong kỳ thi
                }),
              }}
              columns={[
                {
                  title: "Mã HS",
                  dataIndex: "studentCode",
                  align: "center" as const,
                },
                {
                  title: "Họ tên",
                  dataIndex: "name",
                },
                {
                  title: "Lớp",
                  align: "center" as const,
                  render: (_, record: any) => {
                    // ✅ Ưu tiên lấy từ classInfo (đã được populate từ student.classId)
                    const className = record.classInfo?.name || 
                                     record.className || 
                                     (record.classId && typeof record.classId === 'object' ? record.classId.name : null) ||
                                     "-";
                    return className;
                  },
                },
                {
                  title: "Khối",
                  dataIndex: "grade",
                  align: "center" as const,
                },
                {
                  title: "Trạng thái",
                  align: "center" as const,
                  render: (_, record: any) => {
                    if (record.alreadyInExam) {
                      return <Tag color="green">Đã có trong kỳ thi</Tag>;
                    }
                    return <Tag color="blue">Có thể thêm</Tag>;
                  },
                },
              ]}
            />
          </Spin>
        </Space>
      </Modal>

      {/* Modal cập nhật học sinh */}
      <Modal
        open={openEdit}
        title={`Cập nhật học sinh: ${selectedStudent?.student?.name || ""}`}
        onCancel={() => {
          setOpenEdit(false);
          setSelectedStudent(null);
          editForm.resetFields();
        }}
        onOk={() => editForm.submit()}
        okText="Cập nhật"
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdate}>
          <Form.Item label="Mã HS">
            <Input value={selectedStudent?.student?.studentCode} disabled />
          </Form.Item>
          <Form.Item label="Họ tên">
            <Input value={selectedStudent?.student?.name} disabled />
          </Form.Item>
          <Form.Item label="SBD">
            <Input value={selectedStudent?.sbd} disabled />
          </Form.Item>
          <Form.Item
            name="status"
            label="Trạng thái"
            rules={[{ required: true, message: "Vui lòng chọn trạng thái" }]}
          >
            <Select>
              <Option value="active">Đăng ký</Option>
              <Option value="present">Có mặt</Option>
              <Option value="absent">Vắng</Option>
              <Option value="excluded">Đình chỉ</Option>
            </Select>
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={3} placeholder="Nhập ghi chú (nếu có)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
