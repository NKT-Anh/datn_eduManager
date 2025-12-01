import React, { useState, useEffect, useMemo } from 'react';
import { Card, Table, Button, Space, message, Tag, Modal, Select, Pagination, Empty, Checkbox } from 'antd';
import { DeleteOutlined, UndoOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { adminApi } from '../../services/adminApi';
import { usePermissions } from '../../hooks/usePermissions';

const { Option } = Select;
const { confirm } = Modal;

interface TrashItem {
  _id: string;
  teacherCode?: string;
  studentCode?: string;
  classCode?: string;
  code?: string;
  name: string;
  status?: string;
  grade?: string;
  year?: string;
  grades?: string[];
  departmentId?: { name: string };
  classId?: { className: string; grade: string };
  teacherId?: { name: string; teacherCode: string };
  subjectId?: { name: string; code: string };
  className?: string;
  semester?: string;
}

interface TrashData {
  type: string;
  items: TrashItem[];
  total: number;
}

const TrashPage: React.FC = () => {
  const [selectedType, setSelectedType] = useState<string>('all');
  const [trashData, setTrashData] = useState<TrashData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const { hasPermission } = usePermissions();

  // ✅ Tính toán tất cả items từ tất cả các bảng
  const allItems = useMemo(() => {
    if (!trashData || !Array.isArray(trashData)) return [];
    return trashData.flatMap(data => 
      (data.items || []).map(item => ({ type: data.type, id: item._id, ...item }))
    );
  }, [trashData]);

  // ✅ Kiểm tra xem đã chọn tất cả chưa
  const isAllSelected = useMemo(() => {
    if (allItems.length === 0) return false;
    return selectedRows.length === allItems.length && 
           allItems.every(item => selectedRows.some(selected => selected.id === item.id && selected.type === item.type));
  }, [selectedRows, allItems]);

  // ✅ Hàm chọn tất cả
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allSelected = allItems.map(item => ({ type: item.type, id: item.id }));
      setSelectedRows(allSelected);
      setSelectedRowKeys(allItems.map(item => item.id));
    } else {
      setSelectedRows([]);
      setSelectedRowKeys([]);
    }
  };

  useEffect(() => {
    fetchTrashData();
  }, [selectedType, currentPage]);

  const fetchTrashData = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getTrashData({
        type: selectedType === 'all' ? undefined : selectedType,
        page: currentPage,
        limit: pageSize,
      });
      
      // ✅ Backend trả về { success, data, pagination }
      // Nếu có type thì data là object đơn, không có type thì data là array
      const responseData = response.data?.data || response.data;
      
      // ✅ Nếu là object đơn (khi có type), convert thành array
      if (responseData && !Array.isArray(responseData)) {
        setTrashData([responseData]);
      } else {
        setTrashData(responseData || []);
      }
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu thùng rác:', error);
      message.error('Lỗi khi tải dữ liệu thùng rác');
      setTrashData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (items: any[]) => {
    try {
      await adminApi.restoreMultiple(items);
      message.success('Đã khôi phục thành công');
      fetchTrashData();
      setSelectedRows([]);
      setSelectedRowKeys([]);
    } catch (error) {
      message.error('Lỗi khi khôi phục dữ liệu');
    }
  };

  const handleForceDelete = async (items: any[]) => {
    confirm({
      title: 'Xác nhận xóa vĩnh viễn',
      icon: <ExclamationCircleOutlined />,
      content: `Bạn có chắc chắn muốn xóa vĩnh viễn ${items.length} mục này? Hành động này không thể hoàn tác!`,
      okText: 'Xóa vĩnh viễn',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await adminApi.forceDeleteMultiple(items);
          message.success('Đã xóa vĩnh viễn thành công');
          fetchTrashData();
          setSelectedRows([]);
          setSelectedRowKeys([]);
        } catch (error) {
          message.error('Lỗi khi xóa vĩnh viễn dữ liệu');
        }
      },
    });
  };

  // ✅ Hàm chuyển đổi status sang tiếng Việt
  const translateStatus = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'active': 'Hoạt động',
      'inactive': 'Không hoạt động',
      'locked': 'Đã khóa',
      'unlocked': 'Chưa khóa',
      'pending': 'Đang chờ',
      'approved': 'Đã duyệt',
      'rejected': 'Từ chối',
      'draft': 'Nháp',
      'published': 'Đã xuất bản',
      'archived': 'Đã lưu trữ'
    };
    return statusMap[status?.toLowerCase()] || status;
  };

  const getColumns = (type: string) => {
    switch (type) {
      case 'teacher':
        return [
          { title: 'Mã GV', dataIndex: 'teacherCode', key: 'teacherCode' },
          { title: 'Tên giáo viên', dataIndex: 'name', key: 'name' },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => <Tag color="orange">{translateStatus(status)}</Tag>
          },
          {
            title: 'Tổ bộ môn',
            dataIndex: 'departmentId',
            key: 'departmentId',
            render: (dept: any) => dept?.name || '-'
          },
        ];
      case 'student':
        return [
          { title: 'Mã HS', dataIndex: 'studentCode', key: 'studentCode' },
          { title: 'Tên học sinh', dataIndex: 'name', key: 'name' },
          {
            title: 'Lớp',
            dataIndex: 'classId',
            key: 'classId',
            render: (cls: any) => cls ? `${cls.className} (${cls.grade})` : '-'
          },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => <Tag color="orange">{translateStatus(status)}</Tag>
          },
        ];
      case 'class':
        return [
          { title: 'Mã lớp', dataIndex: 'classCode', key: 'classCode' },
          { title: 'Tên lớp', dataIndex: 'className', key: 'className' },
          { title: 'Khối', dataIndex: 'grade', key: 'grade' },
          { title: 'Năm học', dataIndex: 'year', key: 'year' },
        ];
      case 'subject':
        return [
          { title: 'Mã môn', dataIndex: 'code', key: 'code' },
          { title: 'Tên môn', dataIndex: 'name', key: 'name' },
          {
            title: 'Khối',
            dataIndex: 'grades',
            key: 'grades',
            render: (grades: string[]) => grades?.join(', ') || '-'
          },
        ];
      case 'teachingAssignment':
        return [
          {
            title: 'Giáo viên',
            dataIndex: 'teacherId',
            key: 'teacherId',
            render: (teacher: any) => teacher ? `${teacher.name} (${teacher.teacherCode})` : '-'
          },
          {
            title: 'Môn học',
            dataIndex: 'subjectId',
            key: 'subjectId',
            render: (subject: any) => subject ? `${subject.name} (${subject.code})` : '-'
          },
          {
            title: 'Lớp',
            dataIndex: 'classId',
            key: 'classId',
            render: (cls: any) => cls ? `${cls.className} (${cls.classCode})` : '-'
          },
          { title: 'Học kỳ', dataIndex: 'semester', key: 'semester' },
          { title: 'Năm học', dataIndex: 'year', key: 'year' },
        ];
      case 'department':
        return [
          { title: 'Tên tổ', dataIndex: 'name', key: 'name' },
          { title: 'Mã tổ', dataIndex: 'code', key: 'code' },
          { title: 'Năm học', dataIndex: 'year', key: 'year' },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => <Tag color="orange">{translateStatus(status)}</Tag>
          },
        ];
      case 'schedule':
        return [
          {
            title: 'Lớp',
            dataIndex: 'classId',
            key: 'classId',
            render: (cls: any) => cls ? `${cls.className} (${cls.classCode}) - Khối ${cls.grade}` : '-'
          },
          { title: 'Năm học', dataIndex: 'year', key: 'year' },
          { title: 'Học kỳ', dataIndex: 'semester', key: 'semester' },
          {
            title: 'Trạng thái',
            dataIndex: 'isLocked',
            key: 'isLocked',
            render: (locked: boolean) => <Tag color={locked ? 'green' : 'orange'}>{locked ? 'Đã khóa' : 'Chưa khóa'}</Tag>
          },
        ];
      case 'activity':
        return [
          { title: 'Tiêu đề', dataIndex: 'title', key: 'title' },
          { title: 'Mô tả', dataIndex: 'description', key: 'description', ellipsis: true },
          { title: 'Ngày', dataIndex: 'date', key: 'date' },
        ];
      case 'room':
        return [
          { title: 'Mã phòng', dataIndex: 'roomCode', key: 'roomCode' },
          { title: 'Tên phòng', dataIndex: 'name', key: 'name' },
          { title: 'Loại phòng', dataIndex: 'type', key: 'type' },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => <Tag color="orange">{translateStatus(status)}</Tag>
          },
        ];
      default:
        return [];
    }
  };

  const getTypeName = (type: string) => {
    const names: { [key: string]: string } = {
      teacher: 'Giáo viên',
      student: 'Học sinh',
      class: 'Lớp học',
      subject: 'Môn học',
      teachingAssignment: 'Phân công giảng dạy',
      department: 'Tổ bộ môn',
      schedule: 'Thời khóa biểu',
      activity: 'Hoạt động',
      room: 'Phòng học'
    };
    return names[type] || type;
  };

  const renderTrashTables = () => {
    // ✅ Đảm bảo trashData luôn là array và có cấu trúc đúng
    if (!trashData) {
      return <Empty description="Không có dữ liệu đã xóa" />;
    }
    
    const dataArray = Array.isArray(trashData) 
      ? trashData.filter(d => d && d.type && d.items) // Lọc các item hợp lệ
      : (trashData && trashData.type ? [trashData] : []);
    
    if (selectedType === 'all') {
      if (!dataArray || dataArray.length === 0) {
        return <Empty description="Không có dữ liệu đã xóa" />;
      }
      
      return dataArray.map(data => (
        <Card
          key={data.type}
          title={`${getTypeName(data.type)} đã xóa (${data.total || 0})`}
          style={{ marginBottom: 16 }}
        >
          {data.items && data.items.length > 0 ? (
            <Table
              dataSource={data.items}
              columns={getColumns(data.type)}
              rowKey="_id"
              pagination={false}
              size="small"
              rowSelection={{
                type: 'checkbox',
                selectedRowKeys: selectedRowKeys.filter(key => 
                  data.items.some(item => item._id === key)
                ),
                onChange: (newSelectedRowKeys, selectedRows) => {
                  // ✅ Lấy các items đã chọn từ bảng này
                  const currentSelected = selectedRows.map(row => ({ type: data.type, id: row._id }));
                  
                  // ✅ Xóa các items của type này khỏi selectedRows
                  const otherSelected = selectedRows.filter(s => s.type !== data.type);
                  
                  // ✅ Thêm các items mới được chọn
                  setSelectedRows([...otherSelected, ...currentSelected]);
                  setSelectedRowKeys(newSelectedRowKeys as React.Key[]);
                },
              }}
            />
          ) : (
            <Empty description={`Không có ${getTypeName(data.type).toLowerCase()} đã xóa`} />
          )}
        </Card>
      ));
    } else {
      // ✅ Khi có selectedType, tìm data trong array hoặc dùng trực tiếp nếu là object đơn
      const data = Array.isArray(trashData) 
        ? trashData.find(d => d.type === selectedType)
        : (trashData && trashData.type === selectedType ? trashData : null);
      
      if (!data || !data.items) return <Empty description="Không có dữ liệu" />;

      return (
        <Card title={`${getTypeName(selectedType)} đã xóa (${data.total || 0})`}>
          {data.items && data.items.length > 0 ? (
            <Table
              dataSource={data.items}
              columns={getColumns(selectedType)}
              rowKey="_id"
              pagination={{
                current: currentPage,
                pageSize,
                total: data.total || 0,
                onChange: setCurrentPage,
              }}
              size="small"
              rowSelection={{
                type: 'checkbox',
                selectedRowKeys: selectedRowKeys.filter(key => 
                  data.items.some(item => item._id === key)
                ),
                onChange: (newSelectedRowKeys, selectedRows) => {
                  const currentSelected = selectedRows.map(row => ({ type: selectedType, id: row._id }));
                  
                  // ✅ Xóa các items của type này khỏi selectedRows
                  const otherSelected = selectedRows.filter(s => s.type !== selectedType);
                  
                  // ✅ Thêm các items mới được chọn
                  setSelectedRows([...otherSelected, ...currentSelected]);
                  setSelectedRowKeys(newSelectedRowKeys as React.Key[]);
                },
              }}
            />
          ) : (
            <Empty description={`Không có ${getTypeName(selectedType).toLowerCase()} đã xóa`} />
          )}
        </Card>
      );
    }
  };

  return (
    <div>
      <Card title="Thùng rác - Dữ liệu đã xóa mềm" style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Select
            value={selectedType}
            onChange={(value) => {
              setSelectedType(value);
              setSelectedRows([]);
              setSelectedRowKeys([]);
            }}
            style={{ width: 200 }}
          >
            <Option value="all">Tất cả</Option>
            <Option value="teacher">Giáo viên</Option>
            <Option value="student">Học sinh</Option>
            <Option value="class">Lớp học</Option>
            <Option value="subject">Môn học</Option>
            <Option value="teachingAssignment">Phân công giảng dạy</Option>
            <Option value="department">Tổ bộ môn</Option>
            <Option value="schedule">Thời khóa biểu</Option>
            <Option value="activity">Hoạt động</Option>
            <Option value="room">Phòng học</Option>
          </Select>

          <Checkbox
            checked={isAllSelected}
            indeterminate={selectedRows.length > 0 && !isAllSelected}
            onChange={(e) => handleSelectAll(e.target.checked)}
          >
            Chọn tất cả ({allItems.length})
          </Checkbox>

          {selectedRows.length > 0 && (
            <Space>
              <Button
                type="primary"
                icon={<UndoOutlined />}
                onClick={() => handleRestore(selectedRows)}
                disabled={!hasPermission('ADMIN')}
              >
                Khôi phục ({selectedRows.length})
              </Button>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleForceDelete(selectedRows)}
                disabled={!hasPermission('ADMIN')}
              >
                Xóa vĩnh viễn ({selectedRows.length})
              </Button>
            </Space>
          )}
        </Space>
      </Card>

      {renderTrashTables()}
    </div>
  );
};

export default TrashPage;
