import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import userApi from '@/services/userApi';
import { getStudents } from '@/services/studentApi';
import { teacherApi } from '@/services/teacherApi';

const BatchAccountPage = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'student' | 'teacher' | 'accounts'>('accounts');
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>({});
  const [alert, setAlert] = useState<{ type: 'error' | 'success'; title: string; message: string } | null>(null);

  // 🧠 Load danh sách tương ứng
  useEffect(() => {
    setSelectedIds([]);
    setAlert(null);
    setSearch('');

    if (activeTab === 'student') {
      getStudents()
        .then(setStudents)
        .catch(() =>
          toast({
            title: 'Lỗi',
            description: 'Không lấy được danh sách học sinh',
            variant: 'destructive',
          })
        );
    } else if (activeTab === 'teacher') {
      teacherApi
        .getAll()
        .then(setTeachers)
        .catch(() =>
          toast({
            title: 'Lỗi',
            description: 'Không lấy được danh sách giáo viên',
            variant: 'destructive',
          })
        );
    } else {
      userApi
        .getAllAccounts()
        .then((res) => setAccounts(res.data || []))
        .catch(() =>
          toast({
            title: 'Lỗi',
            description: 'Không lấy được danh sách tài khoản',
            variant: 'destructive',
          })
        );
    }
  }, [activeTab]);

  // 🔍 Lọc danh sách theo search
  const filteredData = useMemo(() => {
    const lower = search.toLowerCase();
    if (activeTab === 'student')
      return students.filter((s) => s.name?.toLowerCase().includes(lower));
    if (activeTab === 'teacher')
      return teachers.filter((t) => t.name?.toLowerCase().includes(lower));
    return accounts.filter((a) => a.email?.toLowerCase().includes(lower));
  }, [students, teachers, accounts, search, activeTab]);

  // 🧩 Chọn/bỏ chọn
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (activeTab === 'student' || activeTab === 'teacher') {
      if (selectedIds.length === filteredData.length) setSelectedIds([]);
      else setSelectedIds(filteredData.map((x) => x._id));
    }
  };
// 🧩 Reset mật khẩu cho tài khoản (tab accounts)
const handleResetPasswordAccounts = async () => {
  setLoading(true);
  setAlert(null);
  try {
    const res = await userApi.resetPasswords({ accountIds: selectedIds });
    setResult(res);
    setAlert({
      type: 'success',
      title: 'Reset thành công',
      message: `Đã reset ${res.results.length} tài khoản về mật khẩu mặc định: ${res.defaultPassword}`,
    });
  } catch (err: any) {
    setAlert({
      type: 'error',
      title: 'Lỗi',
      message: err.response?.data?.message || err.message,
    });
  } finally {
    setLoading(false);
  }
};

// 🗑️ Xóa tài khoản
const handleDeleteAccounts = async () => {
  if (!window.confirm('Bạn có chắc chắn muốn xóa các tài khoản này?')) return;
  setLoading(true);
  setAlert(null);
  try {
    const res = await userApi.deleteAccounts({ accountIds: selectedIds });
    setAccounts((prev) => prev.filter((a) => !selectedIds.includes(a._id)));
    setSelectedIds([]);
    setAlert({
      type: 'success',
      title: 'Xóa thành công',
      message: `Đã xóa ${res.deletedCount || selectedIds.length} tài khoản.`,
    });
  } catch (err: any) {
    setAlert({
      type: 'error',
      title: 'Lỗi',
      message: err.response?.data?.message || err.message,
    });
  } finally {
    setLoading(false);
  }
};

  // 🧠 Tạo tài khoản hàng loạt
  const handleSubmit = async () => {
    setLoading(true);
    setResult({});
    setAlert(null);
    try {
      let res;
      if (activeTab === 'student') {
        const selectedStudents = students.filter((s) =>
          selectedIds.includes(s._id)
        );
        res = await userApi.createBatchStudents({ students: selectedStudents });
       await userApi.getAllAccounts().then((res) => setAccounts(res.data || []));


      } else {
        const selectedTeachers = teachers.filter((t) =>
          selectedIds.includes(t._id)
        );
        res = await userApi.createBatchTeachers({ teachers: selectedTeachers });
        await userApi.getAllAccounts().then((res) => setAccounts(res.data || []));


      }

      setResult(res);
      setAlert({
        type: 'success',
        title: 'Thành công',
        message: `Đã tạo ${res.createdAccounts?.length || 0} tài khoản mới, ${res.existedAccounts?.length || 0} tài khoản đã tồn tại.`,
      });
    } catch (err: any) {
      setAlert({
        type: 'error',
        title: 'Lỗi',
        message: err.response?.data?.message || err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // 🔁 Reset mật khẩu hàng loạt
  const handleResetPassword = async () => {
    setLoading(true);
    setAlert(null);
    try {
      const res = await userApi.resetPasswords({ accountIds: selectedIds });
      setResult(res);
      setAlert({
        title: 'Reset thành công',
        type: 'success',
        message: `Đã reset ${res.results.length} tài khoản về mật khẩu mặc định: ${res.defaultPassword}`,
      });
    } catch (err: any) {
      setAlert({
        type: 'error',
        title: 'Lỗi',
        message: err.response?.data?.message || err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ Helper: tìm account theo linkedId
// ✅ Helper: tìm account theo linkedId (fix kiểu dữ liệu)
const getAccountByLinkedId = (id: string) => {
  return (
    accounts.find((a) => a.linkedId?.toString() === id?.toString()) || null
  );
};


  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Quản lý tài khoản hàng loạt</h1>

      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList>
          <TabsTrigger value="accounts">Danh sách tài khoản</TabsTrigger>
          <TabsTrigger value="teacher">Giáo viên</TabsTrigger>
          <TabsTrigger value="student">Học sinh</TabsTrigger>
        </TabsList>

        {/* --- Học sinh --- */}
        <TabsContent value="student">
          <div className="flex items-center justify-between my-3">
            <Input
              placeholder="Tìm kiếm theo tên..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <Button
              variant="outline"
              onClick={toggleSelectAll}
              disabled={filteredData.length === 0}
            >
              {selectedIds.length === filteredData.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </Button>
          </div>

          <table className="w-full table-auto border text-sm">
            <thead>
              <tr className="border-b bg-muted">
                <th className="p-2"></th>
                <th className="p-2 text-left">Mã HS</th>
                <th className="p-2 text-left">Tên</th>
                <th className="p-2 text-left">Lớp</th>
                <th className="p-2 text-left">Khối</th>
                <th className="p-2 text-left">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((s) => {
                const acc = getAccountByLinkedId(s._id);
                return (
                  <tr key={s._id} className="border-b hover:bg-accent/30">
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(s._id)}
                        disabled={!!acc}
                        onChange={() => toggleSelect(s._id)}
                      />
                    </td>
                    <td className="p-2">{s.studentCode || '-'}</td>
                    <td className="p-2">{s.name}</td>
                    <td className="p-2">{s.classId?.name || '-'}</td>
                    <td className="p-2">{s.grade}</td>
                    <td className="p-2">
                      {acc ? (
                        <span className="text-green-600 font-medium">
                          ✅ Đã có tài khoản - <span className="text-blue-600">{acc.email}</span>
                        </span>
                      ) : (
                        <span className="text-orange-600">Chưa có</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TabsContent>

        {/* --- Giáo viên --- */}
        <TabsContent value="teacher">
          <div className="flex items-center justify-between my-3">
            <Input
              placeholder="Tìm kiếm theo tên..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <Button
              variant="outline"
              onClick={toggleSelectAll}
              disabled={filteredData.length === 0}
            >
              {selectedIds.length === filteredData.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </Button>
          </div>

          <table className="w-full table-auto border text-sm">
            <thead>
              <tr className="border-b bg-muted">
                <th className="p-2"></th>
                <th className="p-2 text-left">Mã GV</th>
                <th className="p-2 text-left">Tên</th>
                <th className="p-2 text-left">Năm vào trường</th>
                <th className="p-2 text-left">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((t) => {
                const acc = getAccountByLinkedId(t._id);
                return (
                  <tr key={t._id} className="border-b hover:bg-accent/30">
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(t._id)}
                        disabled={!!acc}
                        onChange={() => toggleSelect(t._id)}
                      />
                    </td>
                    <td className="p-2">{t.teacherCode || '-'}</td>
                    <td className="p-2">{t.name}</td>
                    <td className="p-2">{t.hireYear || '-'}</td>
                    <td className="p-2">
                      {acc ? (
                        <span className="text-green-600 font-medium">
                          ✅ Đã có tài khoản - <span className="text-blue-600">{acc.email}</span>
                        </span>
                      ) : (
                        <span className="text-orange-600">Chưa có</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TabsContent>

        {/* --- Danh sách tài khoản --- */}
<TabsContent value="accounts">
  <div className="flex items-center justify-between my-3">
    <Input
      placeholder="Tìm kiếm email..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      className="w-64"
    />

    {/* Nút chọn tất cả */}
    <Button
      variant="outline"
      onClick={() => {
        if (selectedIds.length === filteredData.length) setSelectedIds([]);
        else setSelectedIds(filteredData.map((a) => a._id));
      }}
      disabled={filteredData.length === 0}
    >
      {selectedIds.length === filteredData.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
    </Button>
  </div>

  <table className="w-full table-auto border text-sm">
    <thead>
      <tr className="border-b bg-muted">
        <th className="p-2 text-center w-10"></th>
        <th className="p-2 text-left">Email</th>
        <th className="p-2 text-left">Vai trò</th>
        <th className="p-2 text-left">Liên kết</th>
      </tr>
    </thead>
    <tbody>
      {filteredData.map((a) => (
        <tr key={a._id} className="border-b hover:bg-accent/30">
          <td className="p-2 text-center">
            <input
              type="checkbox"
              checked={selectedIds.includes(a._id)}
              onChange={() => toggleSelect(a._id)}
            />
          </td>
          <td className="p-2">{a.email}</td>
          <td className="p-2 capitalize">{a.role}</td>
          <td className="p-2">{a.linkedName || '-'}</td>
        </tr>
      ))}
    </tbody>
  </table>

  {/* Hành động dưới bảng */}
  <div className="flex gap-3 mt-4">
    <Button
      variant="secondary"
      onClick={handleResetPasswordAccounts}
      disabled={loading || selectedIds.length === 0}
    >
      {loading ? 'Đang reset...' : 'Reset mật khẩu'}
    </Button>
    <Button
      variant="destructive"
      onClick={handleDeleteAccounts}
      disabled={loading || selectedIds.length === 0}
    >
      {loading ? 'Đang xóa...' : 'Xóa tài khoản'}
    </Button>
  </div>
</TabsContent>

      </Tabs>

      {/* Nút hành động */}
      {activeTab !== 'accounts' && (
        <div className="flex gap-3 mt-4">
          <Button onClick={handleSubmit} disabled={loading || selectedIds.length === 0}>
            {loading ? 'Đang tạo...' : 'Tạo tài khoản'}
          </Button>

        </div>
      )}

      {alert && (
        <Alert
          variant={alert.type === 'error' ? 'destructive' : 'default'}
          className="mt-4"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{alert.title}</AlertTitle>
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default BatchAccountPage;
