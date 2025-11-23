import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Edit,
  Save,
  X,
  Camera,
  Hash,
  School,
  Briefcase,
  Users,
  Plus,
} from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import profileApi from "@/services/profileApi";
import { uploadToCloudinary } from "@/services/cloudinary/cloudinaryUpload";
import { Dialog, DialogContent } from "@/components/ui/dialog";

// SỬ DỤNG PROFILE TỪ FILE auth (bạn nói type nằm trong file auth)
import type { Profile } from "@/types/auth";

const roleMap: Record<string, string> = {
  admin: "Quản lý hệ thống",
  student: "Học sinh",
  teacher: "Giáo viên",
  parent: "Phụ huynh",
};

const ProfilePage = () => {
  const { backendUser, setBackendUser } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
const [uploading, setUploading] = useState(false);
const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
const [newPassword, setNewPassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");
const [isChangingPassword, setIsChangingPassword] = useState(false);




const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    setUploading(true);
    const url = await uploadToCloudinary(file);
    await profileApi.updateProfile({ avatarUrl: url });
    const refreshed = await profileApi.getProfile();
    setProfile(refreshed);

    toast({
      title: "🎉 Ảnh đại diện đã được cập nhật!",
      description: "Ảnh mới đã lưu thành công.",
    });
  } catch (err: any) {
    console.error("Upload lỗi:", err);
    toast({
      title: "Lỗi tải ảnh",
      description: err.message || "Không thể tải ảnh lên Cloudinary",
      variant: "destructive",
    });
  } finally {
    setUploading(false);
  }
};

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await profileApi.getProfile();
        setProfile(data);
      } catch (err: any) {
        console.error("Lỗi tải profile:", err);
        toast({
          title: "Lỗi",
          description: "Không thể tải thông tin cá nhân",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [toast]);

const handleSave = async () => {
  if (!profile) return;

  setSaving(true);
  try {
    let updateData: any = {};

    // 🧠 Tùy theo vai trò, build dữ liệu khác nhau
    switch (profile.role) {
      case "student":
        updateData = {
          name: profile.name,
          dob: profile.dob,
          gender: profile.gender,
          phone: profile.phone,
          address: profile.address,
          ethnic: (profile as any).ethnic,
          religion: (profile as any).religion,
          idNumber: (profile as any).idNumber,
          birthPlace: (profile as any).birthPlace,
          hometown: (profile as any).hometown,
          avatarUrl: (profile as any).avatarUrl,
          note: (profile as any).note,
          parents: (profile as any).parents || [],
        };
        break;

case "teacher":
  updateData = {
    name: profile.name,
    phone: profile.phone,
    address: profile.address,
    avatarUrl: (profile as any).avatarUrl,
    qualification: (profile as any).qualification,
    specialization: (profile as any).specialization,
    mainSubject: (profile as any).mainSubject,
    teachingExperience: (profile as any).teachingExperience,
    certifications: (profile as any).certifications,
    school: (profile as any).school,
    position: (profile as any).position,
    weeklyLessons: (profile as any).weeklyLessons,
    hireYear: (profile as any).hireYear,
    hireYearInField: (profile as any).hireYearInField,
    maxClasses: (profile as any).maxClasses,
    notes: (profile as any).notes,
  };
  break;


      case "admin":
        updateData = {
          name: profile.name,
          phone: profile.phone,
          email: (profile as any).email,
          position: (profile as any).position,
          department: (profile as any).department,
          note: (profile as any).note,
          avatarUrl: (profile as any).avatarUrl,
        };
        break;

      default:
        updateData = {
          name: profile.name,
          phone: profile.phone,
          address: profile.address,
          avatarUrl: (profile as any).avatarUrl,
        };
        break;
    }

    // 🛰️ Cập nhật hồ sơ
    await profileApi.updateProfile(updateData);

    // 🔑 Nếu có đổi mật khẩu trong form chỉnh sửa
    if (password) {
      await profileApi.changePassword(password);
      setPassword("");
    }

    // ♻️ Làm mới dữ liệu trên giao diện
    const refreshed = await profileApi.getProfile();
    setProfile(refreshed);
    setBackendUser?.((prev: any) => ({ ...prev, name: refreshed.name }));

    toast({
      title: "✅ Thành công",
      description: "Cập nhật hồ sơ thành công",
    });

    setIsEditing(false);
  } catch (err: any) {
    toast({
      title: "Lỗi",
      description: err?.response?.data?.message || "Cập nhật thất bại",
      variant: "destructive",
    });
  } finally {
    setSaving(false);
  }
};


  const handleCancel = async () => {
    try {
      const refreshed = await profileApi.getProfile();
      setProfile(refreshed);
    } catch {
      /* ignore */
    } finally {
      setIsEditing(false);
      setPassword("");
    }
  };

  const addParent = () => {
    if (!profile) return;
    const p = (profile as any).parents || [];
    (profile as any).parents = [...p, { _id: null, name: "", phone: "", relation: "guardian", occupation: "" }];
    setProfile({ ...profile });
  };

  const removeParent = (idx: number) => {
    if (!profile) return;
    const p = (profile as any).parents || [];
    (profile as any).parents = p.filter((_v: any, i: number) => i !== idx);
    setProfile({ ...profile });
  };

  const updateParent = (idx: number, field: string, value: any) => {
    if (!profile) return;
    const p = (profile as any).parents || [];
    p[idx] = { ...p[idx], [field]: value };
    (profile as any).parents = p;
    setProfile({ ...profile });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Đang tải hồ sơ...</div>;
  }
  if (!profile) {
    return <div className="flex items-center justify-center h-64">Không có dữ liệu hồ sơ</div>;
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Hồ sơ cá nhân</h1>
          <p className="text-muted-foreground">Quản lý và cập nhật thông tin cá nhân</p>
        </div>
{!isEditing ? (
  <div className="flex gap-2">
    <Button onClick={() => setIsEditing(true)}>
      <Edit className="h-4 w-4 mr-2" /> Chỉnh sửa
    </Button>
    <Button
      variant="secondary"
      onClick={() => setIsPasswordModalOpen(true)}
    >
      <User className="h-4 w-4 mr-2" /> Đổi mật khẩu
    </Button>
  </div>
) : (
  <div className="flex gap-2">
    <Button variant="outline" onClick={handleCancel} disabled={saving}>
      <X className="h-4 w-4 mr-2" /> Hủy
    </Button>
    <Button onClick={handleSave} disabled={saving}>
      {saving ? "Đang lưu..." : (<><Save className="h-4 w-4 mr-2" /> Lưu</>)}
    </Button>
  </div>
)}

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* avatar + role */}
        <Card className="text-center">
          <CardContent className="pt-6">
<div className="relative inline-block mb-4">
  {/* Ảnh đại diện */}
  <div
    className="w-32 h-32 bg-muted rounded-full flex items-center justify-center mx-auto overflow-hidden cursor-pointer hover:opacity-90 transition"
    onClick={() => {
      if (profile.avatarUrl) setIsPreviewOpen(true);
    }}
  >
    {profile.avatarUrl ? (
      <img
        src={profile.avatarUrl}
        alt="avatar"
        className="w-full h-full object-cover"
      />
    ) : (
      <User className="h-16 w-16 text-gray-500" />
    )}
  </div>

  {/* Nút thay ảnh */}
  {isEditing && (
    <>
      <input
        type="file"
        id="avatar-upload"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarChange}
      />
      <label htmlFor="avatar-upload">
        <Button
          asChild
          size="icon"
          variant="outline"
          className="absolute -bottom-3 -right-3 cursor-pointer"
          disabled={uploading}
        >
          <span>
            {uploading ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <Camera className="h-5 w-5" />
            )}
          </span>
        </Button>
      </label>
    </>
  )}

  {/* Popup xem ảnh */}
  <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
    <DialogContent className="p-0 bg-transparent border-none shadow-none max-w-4xl flex items-center justify-center">
      <img
        src={profile.avatarUrl}
        alt="avatar preview"
        className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain"
      />
    </DialogContent>
  </Dialog>
</div>


 <h2 className="text-xl font-semibold mb-1">{profile.name}</h2>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="capitalize">
                    {roleMap[profile.role] || profile.role}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  Quyền truy cập:{" "}
                  {profile.role === "admin"
                    ? "Quản trị toàn hệ thống"
                    : "Người dùng tiêu chuẩn"}
                </TooltipContent>
              </Tooltip>

              {profile.status && (
                <div className="mt-2 flex justify-center">
                  <Badge
  variant={profile.status === "active" ? "default" : "destructive"}
  className={`capitalize ${
    profile.status === "active"
      ? "bg-green-500 text-white hover:bg-green-600"
      : ""
  }`}
>
  {profile.status === "active" ? "Đang hoạt động" : "Tạm ngưng"}
</Badge>

                </div>
              )}


            {(profile as any).studentCode || (profile as any).teacherCode ? (
              <div className="mt-2 flex items-center justify-center gap-1 text-sm text-muted-foreground">
                <Hash className="h-3 w-3" />
                <span>{(profile as any).studentCode || (profile as any).teacherCode}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>

{/* personal info */}
{profile.role === "student" && (
  <Card className="lg:col-span-2">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <User className="h-5 w-5" /> Thông tin cá nhân
      </CardTitle>
    </CardHeader>
    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {renderInput("Họ và tên", "name", profile, setProfile, isEditing)}
      {renderInput("Số điện thoại", "phone", profile, setProfile, isEditing)}
      {renderInput("CCCD/CMND", "idNumber", profile, setProfile, isEditing)}
      {renderSelect("Giới tính", "gender", profile, setProfile, isEditing, [
        { value: "male", label: "Nam" },
        { value: "female", label: "Nữ" },
        { value: "other", label: "Khác" },
      ])}
      {renderDate("Ngày sinh", "dob", profile, setProfile, isEditing)}
      {renderInput("Dân tộc", "ethnic", profile, setProfile, isEditing)}
      {renderInput("Tôn giáo", "religion", profile, setProfile, isEditing)}
      {renderInput("Nơi sinh", "birthPlace", profile, setProfile, isEditing)}
      {renderInput("Quê quán", "hometown", profile, setProfile, isEditing)}
      {renderInput("Địa chỉ", "address", profile, setProfile, isEditing)}
      {renderInput("Ghi chú", "note", profile, setProfile, isEditing)}
    </CardContent>
  </Card>
)}

{profile.role === "teacher" && (
  <Card className="lg:col-span-2">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <User className="h-5 w-5" /> Thông tin cá nhân
      </CardTitle>
    </CardHeader>
    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {renderInput("Họ và tên", "name", profile, setProfile, isEditing)}
      {renderInput("Số điện thoại", "phone", profile, setProfile, isEditing)}
      {renderInput("Email", "email", profile, setProfile, isEditing)}
      {renderInput("Địa chỉ", "address", profile, setProfile, isEditing)}
      {renderInput("Ghi chú", "notes", profile, setProfile, isEditing)}
    </CardContent>
  </Card>
)}

{profile.role === "admin" && (
  <Card className="lg:col-span-2">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <User className="h-5 w-5" /> Thông tin cá nhân (Admin)
      </CardTitle>
    </CardHeader>
    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {renderInput("Họ và tên", "name", profile, setProfile, isEditing)}
      {renderInput("Số điện thoại", "phone", profile, setProfile, isEditing)}
      {renderInput("Email", "email", profile, setProfile, isEditing)}

    </CardContent>
  </Card>
)}



        {/* student block */}
        {profile.role === "student" && (
          <>
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><School className="h-5 w-5" /> Thông tin học tập</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {renderReadonly("Mã học sinh", (profile as any).studentCode)}
                {renderReadonly("Lớp", (profile as any).classId ? `${(profile as any).classId.className} - Khối ${(profile as any).classId.grade}` : "Chưa phân lớp")}
                {renderReadonly("Năm nhập học", (profile as any).admissionYear)}
                {renderReadonly("Trạng thái", (profile as any).status === "active" ? "Đang học" : "Nghỉ học")}
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Thông tin phụ huynh</CardTitle>
                  {isEditing && <Button variant="outline" size="sm" onClick={addParent}><Plus className="h-4 w-4 mr-2" /> Thêm phụ huynh</Button>}
                </div>
              </CardHeader>
              <CardContent>
                {(profile as any).parents && (profile as any).parents.length > 0 ? (
                  (profile as any).parents.map((p: any, idx: number) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-3 rounded-lg mb-3">
                      {renderInput("Họ và tên", `parents.${idx}.name`, profile, setProfile, isEditing, (v) => updateParent(idx, "name", v))}
                      {renderSelect("Quan hệ", `parents.${idx}.relation`, profile, setProfile, isEditing, [
                        { value: "father", label: "Cha" },
                        { value: "mother", label: "Mẹ" },
                        { value: "guardian", label: "Người giám hộ" },
                      ], p.relation, (v) => updateParent(idx, "relation", v))}
                      {renderInput("Điện thoại", `parents.${idx}.phone`, profile, setProfile, isEditing, (v) => updateParent(idx, "phone", v))}
                      {renderInput("Nghề nghiệp", `parents.${idx}.occupation`, profile, setProfile, isEditing, (v) => updateParent(idx, "occupation", v))}
                      {isEditing && <Button variant="ghost" size="sm" onClick={() => removeParent(idx)} className="text-red-500 col-span-2">Xóa phụ huynh</Button>}
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-6">{isEditing ? 'Chưa có phụ huynh — bấm Thêm phụ huynh.' : 'Chưa có thông tin phụ huynh.'}</div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* teacher block */}
       {profile.role === "teacher" && (
  <Card className="lg:col-span-3">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Briefcase className="h-5 w-5" /> Thông tin công tác
      </CardTitle>
    </CardHeader>

    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {renderReadonly("Mã giáo viên", (profile as any).teacherCode)}
      {renderReadonly("Trạng thái", (profile as any).status === "active" ? "Đang làm việc" : "Tạm nghỉ")}

      {renderInput("Trường công tác", "school", profile, setProfile, isEditing)}
      {renderInput("Chức vụ", "position", profile, setProfile, isEditing)}

      {renderInput("Bằng cấp / Trình độ", "qualification", profile, setProfile, isEditing)}
      {renderInput("Chuyên ngành đào tạo", "specialization", profile, setProfile, isEditing)}

      {renderInput("Môn giảng dạy chính", "mainSubject", profile, setProfile, isEditing)}
      {renderInput("Chứng chỉ / khóa đào tạo", "certifications", profile, setProfile, isEditing)}

      {renderInput("Số tiết/tuần", "weeklyLessons", profile, setProfile, isEditing)}
      {renderInput("Thâm niên giảng dạy (năm)", "teachingExperience", profile, setProfile, isEditing)}

      {renderInput("Năm vào ngành", "hireYearInField", profile, setProfile, isEditing)}
      {renderInput("Năm về trường", "hireYear", profile, setProfile, isEditing)}

      {renderInput("Số lớp tối đa có thể dạy", "maxClasses", profile, setProfile, isEditing)}

    </CardContent>
  </Card>
)}

        {/* admin block */}
        {profile.role === "admin" && (
          <Card className="lg:col-span-3">
            <CardHeader><CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5" /> Thông tin công việc</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderInput("Chức vụ", "position", profile, setProfile, isEditing)}
              {renderInput("Bộ phận", "department", profile, setProfile, isEditing)}
            </CardContent>
          </Card>
        )}

       <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
  <DialogContent className="max-w-md">
    <Card>
      <CardHeader>
        <CardTitle>Đổi mật khẩu</CardTitle>
        <CardDescription>Vui lòng nhập mật khẩu mới của bạn</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <Label>Mật khẩu mới</Label>
          <Input
            type="password"
            placeholder="Nhập mật khẩu mới"
            value={newPassword}
            disabled={isChangingPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div>
          <Label>Nhập lại mật khẩu</Label>
          <Input
            type="password"
            placeholder="Nhập lại mật khẩu mới"
            value={confirmPassword}
            disabled={isChangingPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
      </CardContent>

      <CardContent className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            if (!isChangingPassword) setIsPasswordModalOpen(false);
          }}
          disabled={isChangingPassword}
        >
          Hủy
        </Button>

        <Button
          disabled={isChangingPassword}
          onClick={async () => {
            if (!newPassword) {
              toast({
                title: "⚠️ Thiếu thông tin",
                description: "Vui lòng nhập mật khẩu mới",
                variant: "destructive",
              });
              return;
            }
            if (newPassword !== confirmPassword) {
              toast({
                title: "❌ Mật khẩu không khớp",
                description: "Vui lòng nhập lại mật khẩu cho trùng khớp.",
                variant: "destructive",
              });
              return;
            }

            try {
              setIsChangingPassword(true); // 🌀 bật loading
              await profileApi.changePassword(newPassword);

              toast({
                title: "✅ Thành công",
                description: "Đổi mật khẩu thành công!",
              });

              setNewPassword("");
              setConfirmPassword("");
              setIsPasswordModalOpen(false);
            } catch (err: any) {
              toast({
                title: "Lỗi",
                description:
                  err?.response?.data?.message || "Không thể đổi mật khẩu",
                variant: "destructive",
              });
            } finally {
              setIsChangingPassword(false); // 🔚 tắt loading
            }
          }}
        >
          {isChangingPassword ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
              Đang đổi mật khẩu...
            </span>
          ) : (
            "Xác nhận"
          )}
        </Button>
      </CardContent>
    </Card>
  </DialogContent>
</Dialog>


      </div>
    </div>
  );
};

export default ProfilePage;
 
/* ---------------- helper render functions ---------------- */

function renderInput(
  label: string,
  field: string,
  profile: any,
  setProfile: any,
  editable: boolean,
  onChangeCustom?: (v: any) => void
) {
  const value = getNested(profile, field);

  // Giới hạn độ dài
  const maxLength =
    field.includes("phone") ? 10 :
    field === "idNumber" ? 12 :
    undefined;

  return (
    <div>
      <Label>{label}</Label>
      <Input
        type={field.includes("phone") || field === "idNumber" ? "tel" : "text"}
        pattern="[0-9]*"
        inputMode={field.includes("phone") || field === "idNumber" ? "numeric" : undefined}
        value={value ?? ""}
        maxLength={maxLength}
        disabled={!editable}
        onChange={(e) => {
          const val = e.target.value;

          // Nếu là số điện thoại hoặc CMND thì chỉ cho nhập số
          if ((field.includes("phone") || field === "idNumber") && !/^\d*$/.test(val)) return;

          if (onChangeCustom) return onChangeCustom(val);
          setNested(profile, field, val);
          setProfile({ ...profile });
        }}
      />
    </div>
  );
}


function renderDate(label: string, field: string, profile: any, setProfile: any, editable: boolean) {
  const value = getNested(profile, field);
  const dateValue = value ? (typeof value === "string" ? value.split("T")[0] : new Date(value).toISOString().split("T")[0]) : "";
  return (
    <div>
      <Label>{label}</Label>
      <Input type="date" value={dateValue} disabled={!editable} onChange={(e) => { setNested(profile, field, e.target.value); setProfile({ ...profile }); }} />
    </div>
  );
}

function renderSelect(label: string, field: string, profile: any, setProfile: any, editable: boolean, options: { value: string; label: string }[], explicitValue?: any, onChangeCustom?: (v: any) => void) {
  const value = explicitValue ?? getNested(profile, field);
  return (
    <div>
      <Label>{label}</Label>
      {editable ? (
        <Select value={value ?? ""} onValueChange={(v) => { if (onChangeCustom) return onChangeCustom(v); setNested(profile, field, v); setProfile({ ...profile }); }}>
          <SelectTrigger><SelectValue placeholder={`Chọn ${label.toLowerCase()}`} /></SelectTrigger>
          <SelectContent>
            {options.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <Input value={options.find(o => o.value === value)?.label ?? (value ?? "Chưa cập nhật")} disabled />
      )}
    </div>
  );
}

function renderReadonly(label: string, value: any) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value ?? "Chưa cập nhật"} disabled className="bg-muted" />
    </div>
  );
}

/* ---------------- small helpers ---------------- */
function getNested(obj: any, path: string) {
  if (!path.includes(".")) return obj?.[path];
  return path.split(".").reduce((s: any, p: string) => (s ? s[p] : undefined), obj);
}
function setNested(obj: any, path: string, value: any) {
  if (!path.includes(".")) { obj[path] = value; return; }
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]]) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}
