import React, { useEffect, useState, useMemo } from "react";
import {
  Table,
  Button,
  Space,
  message,
  Tag,
  Typography,
  Select,
  Spin,
  Input,
  Card,
  Row,
  Col,
  Modal,
  Space as AntSpace,
  InputNumber,
} from "antd";
import {
  ReloadOutlined,
  SearchOutlined,
  HomeOutlined,
  UserAddOutlined,
  FileExcelOutlined,
} from "@ant-design/icons";
import { examRoomApi } from "@/services/exams/examRoomApi";
import { examStudentApi } from "@/services/exams/examStudentApi";
import { usePermissions } from "@/hooks/usePermissions";

const { Text } = Typography;
const { Option } = Select;

interface FixedExamRoomPageProps {
  examId: string;
  exam: any;
}

export default function FixedExamRoomPage({ examId, exam }: FixedExamRoomPageProps) {
  const { hasPermission, PERMISSIONS } = usePermissions();
  // 🏫 Xem phòng cố định và học sinh
  const [fixedRoomsList, setFixedRoomsList] = useState<any[]>([]);
  const [loadingFixedRoomsList, setLoadingFixedRoomsList] = useState(false);
  const [selectedFixedRoom, setSelectedFixedRoom] = useState<string>("");
  const [fixedRoomStudents, setFixedRoomStudents] = useState<any[]>([]);
  const [loadingFixedRoomStudents, setLoadingFixedRoomStudents] = useState(false);
  const [fixedRoomFilter, setFixedRoomFilter] = useState({ grade: "Tất cả", keyword: "" });
  const [pageSize, setPageSize] = useState(10);

  // 🏫 Phân học sinh vào phòng nhóm modal
  const [openAssignToFixedRooms, setOpenAssignToFixedRooms] = useState(false);
  const [selectedGradeForFixed, setSelectedGradeForFixed] = useState<string>("");
  const [maxStudentsPerRoom, setMaxStudentsPerRoom] = useState<number>(20);
  const [maxRooms, setMaxRooms] = useState<number | undefined>(undefined);
  const [totalAvailableRooms, setTotalAvailableRooms] = useState<number>(0);
  const [loadingAvailableRooms, setLoadingAvailableRooms] = useState(false);
  const [assigningToFixed, setAssigningToFixed] = useState(false);

  // 🔄 Chuyển học sinh sang phòng nhóm khác
  const [openMoveStudent, setOpenMoveStudent] = useState(false);
  const [selectedStudentForMove, setSelectedStudentForMove] = useState<any | null>(null);
  const [targetFixedRoomId, setTargetFixedRoomId] = useState<string>("");
  const [movingStudent, setMovingStudent] = useState(false);
  const [availableFixedRoomsForMove, setAvailableFixedRoomsForMove] = useState<any[]>([]);

  /** 🏫 Lấy danh sách phòng cố định */
  const fetchFixedRoomsList = async () => {
    try {
      setLoadingFixedRoomsList(true);
      const params: any = { examId };
      if (fixedRoomFilter.grade !== "Tất cả") {
        params.grade = fixedRoomFilter.grade;
      }
      const res = await examRoomApi.getFixedRooms(params);
      setFixedRoomsList(res.data || []);
    } catch (err) {
      console.error(err);
      message.error("❌ Không thể tải danh sách phòng cố định");
      setFixedRoomsList([]);
    } finally {
      setLoadingFixedRoomsList(false);
    }
  };

  /** 🏫 Hàm xử lý phân học sinh */
  const handleAssignStudents = async () => {
    try {
      setAssigningToFixed(true);
      const res = await examRoomApi.assignStudentsToFixedRooms({
        examId,
        grade: selectedGradeForFixed,
        maxStudentsPerRoom,
        maxRooms,
      });
      
      const successMessage = res.message || `✅ Đã tự động tạo và phân ${res.total || 0} học sinh vào ${res.rooms || 0} phòng nhóm.`;
      const details = res.details ? (
        <div>
          <p>{successMessage}</p>
          {res.totalAvailableRooms && (
            <p><strong>Tổng số phòng khả dụng:</strong> {res.totalAvailableRooms} phòng</p>
          )}
          {res.morningGrades && res.morningGrades.length > 0 && (
            <p><strong>Các khối học buổi sáng:</strong> {res.morningGrades.join(", ")}</p>
          )}
          {res.details && res.details.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <strong>Chi tiết theo khối:</strong>
              <ul style={{ marginTop: 4, marginBottom: 0 }}>
                {res.details.map((detail: any, idx: number) => (
                  <li key={idx}>
                    Khối {detail.grade}: {detail.total || 0} học sinh → {detail.rooms || 0} phòng
                    {detail.error && <span style={{ color: "#ff4d4f" }}> (Lỗi: {detail.error})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : successMessage;
      
      Modal.success({
        title: "Thành công",
        content: details,
        width: 500,
      });
      setOpenAssignToFixedRooms(false);
      setSelectedGradeForFixed("");
      setMaxStudentsPerRoom(20);
      setMaxRooms(undefined);
      // ✅ Refresh data tự động
      await fetchFixedRoomsList();
      if (selectedFixedRoom) {
        await fetchFixedRoomStudents(selectedFixedRoom);
      }
    } catch (err: any) {
      console.error(err);
      const errorMessage = err?.response?.data?.error || err?.response?.data?.details || err?.message || "❌ Lỗi phân học sinh vào phòng nhóm";
      Modal.error({
        title: "Lỗi",
        content: errorMessage,
        width: 500,
      });
    } finally {
      setAssigningToFixed(false);
    }
  };

  /** 🏫 Lấy danh sách học sinh trong phòng cố định */
  const fetchFixedRoomStudents = async (fixedRoomId: string) => {
    try {
      setLoadingFixedRoomStudents(true);
      const res = await examStudentApi.getByRoom(fixedRoomId);
      const studentsData = Array.isArray(res) ? res : (res?.data || []);
      setFixedRoomStudents(studentsData);
    } catch (err) {
      console.error(err);
      message.error("❌ Không thể tải danh sách học sinh");
      setFixedRoomStudents([]);
    } finally {
      setLoadingFixedRoomStudents(false);
    }
  };

  /** 📄 Xuất danh sách học sinh theo phòng nhóm */
  const handleExportStudents = async () => {
    try {
      // ✅ Lấy danh sách FixedExamRoom đã chọn hoặc tất cả
      const selectedFixedRoomIds = selectedFixedRoom 
        ? [selectedFixedRoom] 
        : fixedRoomsList.map((fr: any) => fr._id);

      if (selectedFixedRoomIds.length === 0) {
        message.warning("Không có phòng nhóm nào để xuất");
        return;
      }

      message.loading({ content: "Đang xuất danh sách...", key: "export", duration: 0 });

      // ✅ Gọi API xuất Excel
      const blob = await examStudentApi.exportByFixedRooms({
        examId,
        fixedRoomIds: selectedFixedRoomIds,
      });

      // ✅ Tạo URL từ blob và download
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Danh_sach_hoc_sinh_phong_nhom_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      message.destroy("export");
      message.success("✅ Đã xuất danh sách học sinh thành công");
    } catch (err: any) {
      message.destroy("export");
      console.error(err);
      message.error(err?.response?.data?.error || "❌ Lỗi khi xuất danh sách học sinh");
    }
  };

  /** 📊 Lấy số phòng khả dụng */
  const fetchAvailableRoomsCount = async () => {
    try {
      setLoadingAvailableRooms(true);
      const res = await examRoomApi.getAvailableRoomsCount();
      setTotalAvailableRooms(res.count || res.totalAvailableRooms || 0);
    } catch (err) {
      console.error("Lỗi lấy số phòng khả dụng:", err);
      setTotalAvailableRooms(0);
    } finally {
      setLoadingAvailableRooms(false);
    }
  };

  useEffect(() => {
    fetchFixedRoomsList();
    fetchAvailableRoomsCount();
  }, [fixedRoomFilter.grade, examId]);

  useEffect(() => {
    if (selectedFixedRoom) {
      fetchFixedRoomStudents(selectedFixedRoom);
    } else {
      setFixedRoomStudents([]);
    }
  }, [selectedFixedRoom]);

  // 🔍 Filtered fixed rooms
  const filteredFixedRooms = useMemo(() => {
    let filtered = fixedRoomsList;
    
    if (fixedRoomFilter.grade !== "Tất cả") {
      filtered = filtered.filter((r) => String(r.grade) === String(fixedRoomFilter.grade));
    }
    
    if (fixedRoomFilter.keyword) {
      const keyword = fixedRoomFilter.keyword.toLowerCase();
      filtered = filtered.filter((r) => 
        r.code?.toLowerCase().includes(keyword)
      );
    }
    
    return filtered;
  }, [fixedRoomsList, fixedRoomFilter]);

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
      <Space direction="vertical" style={{ width: "100%", marginBottom: 16 }} size="large">
        <Space style={{ width: "100%", justifyContent: "space-between" }} align="center">
          <div>
            <Text strong style={{ fontSize: 18 }}>
              <HomeOutlined /> Phòng nhóm
            </Text>
            <br />
            <Text type="secondary">
              {exam?.name} • Năm học {exam?.year} • HK{exam?.semester}
            </Text>
          </div>
          <AntSpace>
            {hasPermission(PERMISSIONS.EXAM_ROOM_AUTO) && (
              <Button 
                icon={<UserAddOutlined />} 
                type="primary"
                onClick={() => setOpenAssignToFixedRooms(true)}
              >
                Phân học sinh vào phòng nhóm
              </Button>
            )}
            <Button 
              icon={<FileExcelOutlined />} 
              onClick={handleExportStudents}
              type="default"
            >
              📄 Xuất danh sách học sinh
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchFixedRoomsList}>
              Làm mới
            </Button>
          </AntSpace>
        </Space>
      </Space>

      {/* 🔍 Bộ lọc */}
      <Card style={{ marginBottom: 16, background: "#fafafa" }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={8} md={6}>
            <Select
              value={fixedRoomFilter.grade}
              onChange={(v) => setFixedRoomFilter((f) => ({ ...f, grade: v }))}
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
          <Col xs={24} sm={8} md={12}>
            <Input
              placeholder="Tìm theo mã phòng cố định..."
              prefix={<SearchOutlined />}
              value={fixedRoomFilter.keyword}
              onChange={(e) => setFixedRoomFilter((f) => ({ ...f, keyword: e.target.value }))}
              allowClear
            />
          </Col>
        </Row>
      </Card>

      {/* Danh sách phòng và học sinh */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
            <Card title="Danh sách phòng nhóm" size="small">
            <Spin spinning={loadingFixedRoomsList}>
              <Table
                dataSource={filteredFixedRooms}
                rowKey="_id"
                pagination={{ pageSize: 10 }}
                size="small"
                onRow={(record) => ({
                  onClick: () => setSelectedFixedRoom(record._id),
                  style: {
                    cursor: "pointer",
                    backgroundColor: selectedFixedRoom === record._id ? "#e6f7ff" : "transparent",
                  },
                })}
                columns={[
                  {
                    title: "Mã phòng",
                    dataIndex: "code",
                    key: "code",
                    render: (code: string) => <Tag color="blue">{code}</Tag>,
                  },
                  {
                    title: "Khối",
                    dataIndex: "grade",
                    key: "grade",
                    align: "center" as const,
                  },
                  {
                    title: "Số HS",
                    key: "studentsCount",
                    align: "center" as const,
                    render: (_: any, record: any) => (
                      <Tag color={record.studentsCount > 0 ? "green" : "default"}>
                        {record.studentsCount || 0}
                      </Tag>
                    ),
                  },
                ]}
              />
            </Spin>
          </Card>
        </Col>
        <Col xs={24} md={16}>
          <Card 
            title={selectedFixedRoom ? `Học sinh trong phòng ${filteredFixedRooms.find(r => r._id === selectedFixedRoom)?.code || ""}` : "Chọn phòng cố định để xem học sinh"}
            size="small"
          >
            <Spin spinning={loadingFixedRoomStudents}>
              {selectedFixedRoom ? (
                <Table
                  dataSource={fixedRoomStudents}
                  rowKey="_id"
                  pagination={{ 
                    pageSize: pageSize,
                    showSizeChanger: true,
                    pageSizeOptions: ['10', '20', '50', '100'],
                    showTotal: (total) => `Tổng ${total} học sinh`,
                    onShowSizeChange: (current, size) => {
                      setPageSize(size);
                    }
                  }}
                  size="small"
                  columns={[
                    {
                      title: "Mã HS",
                      key: "studentCode",
                      align: "center" as const,
                      render: (r: any) => r.student?.studentCode || "-",
                    },
                    {
                      title: "Họ tên",
                      key: "name",
                      render: (r: any) => r.student?.name || "-",
                    },
                    {
                      title: "Lớp",
                      key: "class",
                      align: "center" as const,
                      render: (r: any) => r.class?.className || r.class?.name || r.student?.classId?.name || "-",
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
                      key: "room",
                      align: "center" as const,
                      render: (r: any) => (
                        <Tag color="blue">{r.room?.code || filteredFixedRooms.find(fr => fr._id === selectedFixedRoom)?.code || "-"}</Tag>
                      ),
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
                      key: "actions",
                      align: "center" as const,
                      render: (r: any) => (
                        <Space size="small">
                          {hasPermission(PERMISSIONS.EXAM_UPDATE) && (
                            <Button 
                              type="link" 
                              size="small"
                              onClick={async () => {
                                setSelectedStudentForMove(r);
                                // Lấy danh sách phòng nhóm khác (không bao gồm phòng hiện tại)
                                try {
                                  const res = await examRoomApi.getFixedRooms({ examId, grade: r.grade });
                                  const availableRooms = (res.data || []).filter(
                                    (fr: any) => fr._id !== selectedFixedRoom
                                  );
                                  setAvailableFixedRoomsForMove(availableRooms);
                                } catch (err) {
                                  console.error(err);
                                  message.error("Không thể tải danh sách phòng nhóm");
                                }
                                setOpenMoveStudent(true);
                              }}
                            >
                              Chuyển phòng
                            </Button>
                          )}
                        </Space>
                      ),
                    },
                  ]}
                />
              ) : (
                <div style={{ textAlign: "center", padding: 40 }}>
                  <Text type="secondary">Vui lòng chọn một phòng nhóm để xem danh sách học sinh</Text>
                </div>
              )}
            </Spin>
          </Card>
        </Col>
      </Row>

      {/* 🔄 Modal: Chuyển học sinh sang phòng nhóm khác */}
      <Modal
        title="Chuyển học sinh sang phòng nhóm khác"
        open={openMoveStudent}
        onCancel={() => {
          setOpenMoveStudent(false);
          setSelectedStudentForMove(null);
          setTargetFixedRoomId("");
        }}
        onOk={async () => {
          if (!selectedStudentForMove || !targetFixedRoomId) {
            Modal.warning({
              title: "Thiếu thông tin",
              content: "Vui lòng chọn phòng nhóm đích.",
            });
            return;
          }
          try {
            setMovingStudent(true);
            // Cập nhật ExamStudent.room
            await examStudentApi.update(selectedStudentForMove._id, {
              room: targetFixedRoomId,
            });
            message.success("✅ Đã chuyển học sinh sang phòng nhóm khác");
            setOpenMoveStudent(false);
            setSelectedStudentForMove(null);
            setTargetFixedRoomId("");
            // ✅ Refresh data
            await fetchFixedRoomsList();
            if (selectedFixedRoom) {
              await fetchFixedRoomStudents(selectedFixedRoom);
            }
          } catch (err: any) {
            console.error(err);
            Modal.error({
              title: "Lỗi",
              content: err?.response?.data?.error || "❌ Không thể chuyển học sinh",
            });
          } finally {
            setMovingStudent(false);
          }
        }}
        confirmLoading={movingStudent}
        width={500}
      >
        <AntSpace direction="vertical" style={{ width: "100%" }} size="large">
          <div>
            <Text strong>Học sinh:</Text>
            <br />
            <Text>{selectedStudentForMove?.student?.name} ({selectedStudentForMove?.student?.studentCode})</Text>
          </div>
          <div>
            <Text strong>Phòng nhóm hiện tại:</Text>
            <br />
            <Tag color="blue">
              {fixedRoomsList.find((fr) => fr._id === selectedFixedRoom)?.code || "-"}
            </Tag>
          </div>
          <div>
            <Text strong>Chuyển sang phòng nhóm:</Text>
            <Select
              value={targetFixedRoomId}
              onChange={(value) => setTargetFixedRoomId(value)}
              style={{ width: "100%", marginTop: 8 }}
              placeholder="Chọn phòng nhóm đích"
            >
              {availableFixedRoomsForMove.map((fr) => (
                <Option key={fr._id} value={fr._id}>
                  {fr.code} (Khối {fr.grade} • {fr.capacity || 0} học sinh)
                </Option>
              ))}
            </Select>
          </div>
        </AntSpace>
      </Modal>

      {/* 🏫 Modal: Phân học sinh vào phòng nhóm - TỰ ĐỘNG TẠO VÀ PHÂN */}
      <Modal
        title="Phân học sinh vào phòng nhóm"
        open={openAssignToFixedRooms}
        onCancel={() => {
          setOpenAssignToFixedRooms(false);
          setSelectedGradeForFixed("");
          setMaxStudentsPerRoom(20);
          setMaxRooms(undefined);
        }}
        onOk={async () => {
          if (!selectedGradeForFixed) {
            Modal.warning({
              title: "Thiếu thông tin",
              content: "Vui lòng chọn khối để phân học sinh vào phòng nhóm.",
            });
            return;
          }
          if (!maxStudentsPerRoom || maxStudentsPerRoom < 1) {
            Modal.warning({
              title: "Thiếu thông tin",
              content: "Vui lòng nhập số học sinh tối đa/phòng (ít nhất 1).",
            });
            return;
          }

          try {
            // ✅ Kiểm tra số học sinh và số phòng trước khi phân
            const { examStudentApi } = await import("@/services/exams/examStudentApi");
            const studentsRes = await examStudentApi.getByExam(examId, { 
              grade: selectedGradeForFixed === "all" ? undefined : Number(selectedGradeForFixed) 
            });
            const students = Array.isArray(studentsRes) ? studentsRes : (studentsRes?.data || []);
            const studentsWithoutRoom = students.filter((s: any) => !s.room);
            const totalStudents = studentsWithoutRoom.length;

            if (totalStudents === 0) {
              Modal.info({
                title: "Thông báo",
                content: "Không có học sinh nào cần phân phòng.",
              });
              return;
            }

            // ✅ Tính số phòng cần thiết
            const requiredRooms = Math.ceil(totalStudents / maxStudentsPerRoom);
            // ✅ Số phòng thực tế: nếu có maxRooms thì lấy min(requiredRooms, maxRooms), không thì lấy requiredRooms
            const actualRooms = maxRooms ? Math.min(requiredRooms, maxRooms) : requiredRooms;
            const studentsPerRoomIfLimited = Math.ceil(totalStudents / actualRooms);

            // ✅ Kiểm tra nếu vượt quá giới hạn (khi maxRooms < requiredRooms)
            if (maxRooms && requiredRooms > maxRooms && studentsPerRoomIfLimited > maxStudentsPerRoom) {
              Modal.confirm({
                title: "⚠️ Vượt quá giới hạn",
                content: (
                  <div>
                    <p>
                      <strong>Tổng số học sinh:</strong> {totalStudents}
                    </p>
                    <p>
                      <strong>Số phòng cần thiết:</strong> {requiredRooms} phòng
                    </p>
                    <p>
                      <strong>Giới hạn tối đa:</strong> {maxRooms} phòng
                    </p>
                    <p>
                      <strong>Số phòng sẽ tạo:</strong> {actualRooms} phòng
                    </p>
                    <p>
                      <strong>Số học sinh/phòng sẽ là:</strong> {studentsPerRoomIfLimited} học sinh/phòng
                    </p>
                    <p style={{ color: "#ff4d4f", marginTop: 8 }}>
                      <strong>⚠️ Đã vượt quá số lượng học sinh/phòng đã đặt ({maxStudentsPerRoom} học sinh/phòng).</strong>
                    </p>
                    <p>Bạn có muốn tiếp tục và lưu lại không?</p>
                  </div>
                ),
                okText: "Có, lưu lại",
                cancelText: "Hủy",
                onOk: async () => {
                  await handleAssignStudents();
                },
              });
              return;
            }

            // ✅ Nếu không vượt quá, phân bình thường
            await handleAssignStudents();
          } catch (err: any) {
            console.error(err);
            Modal.error({
              title: "Lỗi",
              content: err?.response?.data?.error || err?.message || "❌ Lỗi khi kiểm tra số học sinh",
              width: 500,
            });
          }
        }}
        confirmLoading={assigningToFixed}
        width={600}
        destroyOnHidden
      >
        <AntSpace direction="vertical" style={{ width: "100%" }} size="large">
          <Card size="small" style={{ background: "#f0f9ff", borderColor: "#91d5ff" }}>
            <Text type="secondary">
              Hệ thống sẽ tự động:
              <ul style={{ marginTop: 8, marginBottom: 0 }}>
                <li>Tạo phòng nhóm cho khối đã chọn (nếu chưa có)</li>
                <li>Phân tất cả học sinh chưa có phòng vào các phòng nhóm (theo thứ tự A-Z)</li>
                <li>Phân bổ đều học sinh vào các phòng nhóm</li>
              </ul>
            </Text>
          </Card>
          <div>
            <Text strong>Chọn khối:</Text>
            <Select
              value={selectedGradeForFixed}
              onChange={(value) => {
                setSelectedGradeForFixed(value);
              }}
              style={{ width: "100%", marginTop: 8 }}
              placeholder="Chọn khối hoặc tất cả"
            >
              <Option value="all">
                <Text strong>📋 Tất cả khối ({exam?.grades?.join(", ") || ""})</Text>
              </Option>
              {exam?.grades?.map((g: string | number) => (
                <Option key={String(g)} value={String(g)}>
                  Khối {g}
                </Option>
              ))}
            </Select>
          </div>
          <div>
            <Text strong>Tối đa học sinh/phòng:</Text>
            <InputNumber
              value={maxStudentsPerRoom}
              onChange={(value) => setMaxStudentsPerRoom(value || 20)}
              min={1}
              max={100}
              style={{ width: "100%", marginTop: 8 }}
              placeholder="Nhập số học sinh tối đa/phòng"
            />
          </div>
          <div>
            <Text strong>Số phòng tối đa (tùy chọn):</Text>
            <InputNumber
              value={maxRooms}
              onChange={(value) => setMaxRooms(value || undefined)}
              min={1}
              style={{ width: "100%", marginTop: 8 }}
              placeholder="Để trống nếu không giới hạn"
            />
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 4 }}>
              💡 Tổng số phòng khả dụng (available + normal): <Text strong>{totalAvailableRooms}</Text> phòng
              {selectedGradeForFixed === "all" && exam?.grades && exam.grades.length > 1 && (
                <div style={{ marginTop: 4 }}>
                  📅 Nếu có nhiều khối học buổi sáng, số phòng sẽ được chia đều cho các khối.
                </div>
              )}
            </Text>
          </div>
        </AntSpace>
      </Modal>
    </div>
  );
}

