import { useForm, Controller } from "react-hook-form";
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Combobox } from "@/components/ui/combobox";
import { Check } from "lucide-react";
import { Select, SelectItem, SelectTrigger, SelectContent, SelectValue } from "@/components/ui/select";
import { Teacher } from "@/types/auth";
import { cn } from "@/lib/utils";
import { ClassType, Subject } from "@/types/class";
import { Department } from "@/types/department";
import settingApi from "@/services/settingApi";

// ========== Zod Schema ==========
const teacherSchema = z.object({
  name: z.string().min(1, "Tên giáo viên là bắt buộc"),
  phone: z.string().optional(),
  dob: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  notes: z.string().optional(),

  teacherCode: z.string().optional(),
  qualification: z.string().optional(),
  specialization: z.string().optional(),
  mainSubject: z.object({
    _id: z.string(),
    name: z.string(),
    code: z.string(),
  }).optional(),
  subjects: z.array(
    z.object({
      subjectId: z.object({
        _id: z.string(),
        name: z.string(),
        code: z.string(),
      }),
      grades: z.array(z.enum(["10", "11", "12"])),
    })
  ).optional(),
  certifications: z.string().optional(), 
  classIds: z.array(z.string()).optional(),
  homeroomClassIds: z.array(z.string()).optional(),
  currentHomeroomClassId: z.string().optional(),
  teachingExperience: z.preprocess((val) => {
  if (val === "" || val == null) return undefined;
    return Number(val);
  }, z.number().optional()),

  hireYear: z.preprocess((val) => {
    if (val === "" || val == null) return undefined;
    return Number(val);
  }, z.number().optional()),

  hireYearInField: z.preprocess((val) => {
    if (val === "" || val == null) return undefined;
    return Number(val);
  }, z.number().optional()),

  weeklyLessons: z.preprocess((val) => {
    if (val === "" || val == null) return 22; // ✅ Mặc định 22 tiết/tuần
    return Number(val);
  }, z.number().min(1, "Số tiết tối thiểu là 1").optional()),

  optionalWeeklyLessons: z.preprocess((val) => {
    if (val === "" || val == null) return 0; // ✅ Mặc định 0 tiết tự chọn
    return Number(val);
  }, z.number().min(0, "Số tiết tự chọn phải >= 0").optional()),

    status: z.enum(["active", "inactive"]).optional(),
    school: z.string().optional(),
    position: z.string().optional(),  
     maxClasses: z.preprocess((val) => {
    if (val === "" || val == null) return 3; // default = 3
    return Number(val);
  }, z.number().min(1, "Số lớp tối thiểu là 1").optional()),
  
  maxClassPerGrade: z.object({
    "10": z.preprocess((val) => {
      if (val === "" || val == null) return 0;
      return Number(val);
    }, z.number().min(0).optional()),
    "11": z.preprocess((val) => {
      if (val === "" || val == null) return 0;
      return Number(val);
    }, z.number().min(0).optional()),
    "12": z.preprocess((val) => {
      if (val === "" || val == null) return 0;
      return Number(val);
    }, z.number().min(0).optional()),
  }).optional(),
  departmentId: z.string().optional(),
  });

type TeacherFormData = z.infer<typeof teacherSchema>;

interface TeacherFormProps {
  teacher?: Teacher;
  subjects: Subject[];
  classes: ClassType[];
  departments?: Department[];
  onSubmit: (data: Omit<Teacher, "_id">) => void;
  onCancel?: () => void;
}

const renderGenderLabels: Record<string, string> = {
  male: "Nam",
  female:"Nữ",
  other: "Khác",
};

export function TeacherForm({ teacher, subjects, classes, departments = [], onSubmit, onCancel }: TeacherFormProps) {
  const [currentSchoolYear, setCurrentSchoolYear] = useState<string>("");

  // ✅ Lấy năm học hiện tại từ settings
  useEffect(() => {
    const fetchCurrentYear = async () => {
      try {
        const settings = await settingApi.getSettings();
        setCurrentSchoolYear(settings?.currentSchoolYear || "");
      } catch (error) {
        console.error("Lỗi lấy năm học hiện tại:", error);
      }
    };
    fetchCurrentYear();
  }, []);

  // ✅ Lọc lớp theo năm học active
  const availableClassesForCurrentYear = classes.filter(
    (cls) => !currentSchoolYear || cls.year === currentSchoolYear || !cls.year
  );

  const form = useForm<TeacherFormData>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      name: teacher?.name || "",
      phone: teacher?.phone || "",
      dob: teacher?.dob ? teacher.dob.split("T")[0] : "",
      gender: teacher?.gender || "male",
      notes: teacher?.notes || "",

      teacherCode: teacher?.teacherCode,
      qualification: teacher?.qualification,
      specialization: teacher?.specialization,
      mainSubject: teacher?.mainSubject,
      subjects: teacher?.subjects || [],
      teachingExperience: teacher?.teachingExperience,
      certifications: teacher?.certifications || "",

      classIds: teacher?.classIds?.map(s => (typeof s === "string" ? s : s._id)) || [],
      homeroomClassIds: teacher?.homeroomClassIds?.map(c => c._id) || [],
      currentHomeroomClassId: teacher?.currentHomeroomClassId 
        ? (typeof teacher.currentHomeroomClassId === "string" 
            ? teacher.currentHomeroomClassId 
            : teacher.currentHomeroomClassId._id)
        : "none",
      hireYear: teacher?.hireYear || new Date().getFullYear(),
      hireYearInField: teacher?.hireYearInField,
      weeklyLessons: teacher?.weeklyLessons || 17, // ✅ Mặc định 17 tiết/tuần (cap limit)
      optionalWeeklyLessons: teacher?.optionalWeeklyLessons || 0, // ✅ Mặc định 0 tiết tự chọn
      status: teacher?.status || "active",
      school: teacher?.school,
      position: teacher?.position,
       maxClasses: teacher?.maxClasses || 3,
      maxClassPerGrade: teacher?.maxClassPerGrade 
        ? (teacher.maxClassPerGrade instanceof Map
            ? {
                "10": teacher.maxClassPerGrade.get("10") || 0,
                "11": teacher.maxClassPerGrade.get("11") || 0,
                "12": teacher.maxClassPerGrade.get("12") || 0,
              }
            : {
                "10": teacher.maxClassPerGrade["10"] || 0,
                "11": teacher.maxClassPerGrade["11"] || 0,
                "12": teacher.maxClassPerGrade["12"] || 0,
              })
        : { "10": 0, "11": 0, "12": 0 },
      departmentId: teacher?.departmentId 
        ? (typeof teacher.departmentId === "string" 
            ? teacher.departmentId 
            : teacher.departmentId._id)
        : undefined,
    },
  });

  useEffect(() => {
    if (teacher && classes.length > 0) {
      form.setValue(
        "classIds",
        teacher.classIds?.map(c => (typeof c === "string" ? c : c._id)) || []
      );
    }
  }, [teacher, classes]);

  const handleSubmit = (data: TeacherFormData) => {
    if (!data.name) return;

    const classObjects = (data.classIds || [])
      .map((id) => classes.find((c) => c._id === id))
      .filter((c): c is ClassType => !!c);
    const homeroomClassObjects = (data.homeroomClassIds || [])
    .map((id) => classes.find((c) => c._id === id))
    .filter((c): c is ClassType => !!c);
    const currentHomeroomClassObject = data.currentHomeroomClassId && data.currentHomeroomClassId !== "none"
      ? classes.find((c) => c._id === data.currentHomeroomClassId)
      : undefined;

    const payload: Omit<Teacher, "_id"> = {
      name: data.name,
      phone: data.phone || undefined,
      dob: data.dob || undefined,
      gender: data.gender,
      notes: data.notes,

      teacherCode: data.teacherCode,
      qualification: data.qualification,
      specialization: data.specialization,
      mainSubject: data.mainSubject
      ? {
          _id: data.mainSubject._id!,
          name: data.mainSubject.name!,
          code: data.mainSubject.code!,
        }
      : undefined,

      subjects: (data.subjects || []).map((s) => ({
      subjectId: {
        _id: s.subjectId._id,
        name: s.subjectId.name,
        code: s.subjectId.code,
      },
      grades: s.grades,
    })),
        teachingExperience: data.teachingExperience ? Number(data.teachingExperience) : undefined,
      certifications: data.certifications || "",

      classIds: classObjects,
      homeroomClassIds: homeroomClassObjects,
      currentHomeroomClassId: currentHomeroomClassObject || undefined, 

        hireYear: data.hireYear ? Number(data.hireYear) : undefined,
        hireYearInField: data.hireYearInField ? Number(data.hireYearInField) : undefined,
        weeklyLessons: data.weeklyLessons ? Number(data.weeklyLessons) : 17, // ✅ Mặc định 17 tiết/tuần (cap limit)
        optionalWeeklyLessons: data.optionalWeeklyLessons ? Number(data.optionalWeeklyLessons) : 0, // ✅ Số tiết tự chọn

   
      status: data.status,
      school: data.school,
      // ✅ Nếu position là "Phó Hiệu trưởng" hoặc "PHT", thay bằng "Giáo viên"
      position: (() => {
        const pos = data.position || 'Giáo viên';
        if (pos && (
          pos.toLowerCase().includes('phó hiệu trưởng') ||
          pos.toLowerCase() === 'pht'
        )) {
          return 'Giáo viên';
        }
        return pos;
      })(),
      maxClasses: data.maxClasses ? Number(data.maxClasses) : 3,
      // ✅ Chỉ gửi maxClassPerGrade nếu có ít nhất một giá trị khác 0
      // Nếu tất cả = 0, không gửi để backend tự động tính toán
      maxClassPerGrade: data.maxClassPerGrade && 
        (data.maxClassPerGrade["10"] > 0 || 
         data.maxClassPerGrade["11"] > 0 || 
         data.maxClassPerGrade["12"] > 0)
        ? new Map([
            ["10", data.maxClassPerGrade["10"] || 0],
            ["11", data.maxClassPerGrade["11"] || 0],
            ["12", data.maxClassPerGrade["12"] || 0],
          ])
        : undefined, // Không gửi nếu tất cả = 0, để backend tự tính
      departmentId: data.departmentId || undefined,
    };

    console.log("✅ Sending payload:", payload);
    onSubmit(payload);
    form.reset();
  };

  return (
    <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{teacher ? "Chỉnh sửa giáo viên" : "Thêm giáo viên mới"}</DialogTitle>
        <DialogDescription>
          {teacher ? "Chỉnh sửa thông tin giáo viên" : "Thêm mới giáo viên"}
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Họ tên */}
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel>Họ tên *</FormLabel>
              <FormControl>
                <Input placeholder="Nhập họ tên giáo viên" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}/>

          {/* Điện thoại & Ngày sinh */}
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel>Số điện thoại</FormLabel>
                <FormControl>
                  <Input placeholder="Nhập số điện thoại" {...field} maxLength={10}/>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}/>
            <FormField control={form.control} name="dob" render={({ field }) => (
              <FormItem>
                <FormLabel>Ngày sinh</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}/>
          </div>

          {/* Giới tính */}
          <Controller control={form.control} name="gender" render={({ field }) => (
            <FormItem>
              <FormLabel>Giới tính</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    {field.value ? renderGenderLabels[field.value] : "Chọn giới tính"}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Nam</SelectItem>
                    <SelectItem value="female">Nữ</SelectItem>
                    <SelectItem value="other">Khác</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}/>
                    {/* Main Subject */}
          <FormField control={form.control} name="mainSubject" render={({ field }) => (
            <FormItem>
              <FormLabel>Môn giảng dạy chính</FormLabel>
              <Select value={field.value?._id || ""} onValueChange={(val)=>{
                const sub = subjects.find(s=>s._id===val);
                if(sub) field.onChange({_id:sub._id,name:sub.name,code:sub.code});
              }}>
                <SelectTrigger className="w-full">{field.value?.name || "Chọn môn chính"}</SelectTrigger>
                <SelectContent>
                  {subjects.map(s=> <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormItem>
          )}/>
          <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="qualification" render={({ field }) => (
            <FormItem>
              <FormLabel>Bằng cấp / Trình độ</FormLabel>
              <FormControl>
                <Input placeholder="Ví dụ: Cử nhân, Thạc sĩ, Giáo viên chính..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}/>

          <FormField control={form.control} name="specialization" render={({ field }) => (
            <FormItem>
              <FormLabel>Chuyên ngành đào tạo</FormLabel>
              <FormControl>
                <Input placeholder="Ví dụ: Toán học, Vật lý..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}/>
        </div>


          {/* Môn học */}
          <FormField control={form.control} name="subjects" render={({ field }) => (
            <FormItem>
              <FormLabel>Môn dạy *</FormLabel>
              <div className="space-y-2">
                {[...subjects].sort((a, b) => a.name.localeCompare(b.name, "vi", { sensitivity: "base" })).map((subject) => {
                  const current = field.value || [];
                  const exist = current.find((s) => s.subjectId._id === subject._id);
                  return (
                    <div key={subject._id} className="border rounded p-2">
                      <div className="font-semibold">{subject.name}</div>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {[...subject.grades].sort((a,b)=>Number(a)-Number(b)).map((grade)=>{
                          const isChecked = exist?.grades.includes(grade);
                          return (
                            <label key={grade} className="flex items-center space-x-2">
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(checked)=>{
                                  let newValue = [...current];
                                  const idx = newValue.findIndex(s=>s.subjectId._id===subject._id);
                                  if(checked){
                                    if(idx>=0){
                                      if(!newValue[idx].grades.includes(grade)){
                                        newValue[idx].grades.push(grade);
                                      }
                                    }else{
                                      newValue.push({subjectId:{_id:subject._id,name:subject.name,code:subject.code},grades:[grade]});
                                    }
                                  }else{
                                    if(idx>=0){
                                      newValue[idx].grades = newValue[idx].grades.filter(g=>g!==grade);
                                      if(newValue[idx].grades.length===0) newValue.splice(idx,1);
                                    }
                                  }
                                  field.onChange(newValue);
                                }}
                              />
                              <span>Khối {grade}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}/>



          {/* Các trường bổ sung: position, school, hireYear, hireYearInField, weeklyLessons */}
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="position" render={({ field }) => (
              <FormItem>
                <FormLabel>Chức vụ</FormLabel>
                <FormControl>
                  <Input placeholder="Ví dụ: Giáo viên, Tổ trưởng..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}/>
            <FormField control={form.control} name="school" render={({ field }) => (
              <FormItem>
                <FormLabel>Trường đang công tác</FormLabel>
                <FormControl>
                  <Input placeholder="Nhập tên trường" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}/>
          </div>
          
          {/* Tổ bộ môn */}
          <FormField control={form.control} name="departmentId" render={({ field }) => (
            <FormItem>
              <FormLabel>Tổ bộ môn</FormLabel>
              <Select
                value={field.value || "none"}
                onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn tổ bộ môn (tùy chọn)" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">Không thuộc tổ nào</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept._id} value={dept._id}>
                      {dept.name} {dept.code && `(${dept.code})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
              <p className="text-xs text-muted-foreground">
                Giáo viên sẽ tự động được thêm vào tổ bộ môn khi tạo mới
              </p>
            </FormItem>
          )}/>
          <div className="grid grid-cols-3 gap-4">
            <FormField control={form.control} name="hireYear" render={({ field }) => (
              <FormItem>
                <FormLabel>Năm về trường</FormLabel>
                <FormControl><Input type="number" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}/>
            <FormField control={form.control} name="hireYearInField" render={({ field }) => (
              <FormItem>
                <FormLabel>Năm vào ngành</FormLabel>
                <FormControl><Input type="number" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}/>
            <FormField control={form.control} name="weeklyLessons" render={({ field }) => {
              // ✅ Tính effectiveWeeklyLessons để hiển thị preview
              const baseWeeklyLessons = 17; // Base theo quy tắc THPT
              const isHomeroom = form.watch("currentHomeroomClassId") && form.watch("currentHomeroomClassId") !== "none";
              const isDepartmentHead = form.watch("departmentId") && form.watch("departmentId") !== "none";
              const reduction = (isHomeroom || isDepartmentHead) ? 3 : 0;
              const optionalLessons = form.watch("optionalWeeklyLessons") || 0;
              const calculatedEffective = Math.max(0, baseWeeklyLessons - reduction) + optionalLessons;
              const capLimit = field.value || 17;
              const effectiveWeeklyLessons = capLimit !== null ? Math.min(calculatedEffective, capLimit) : calculatedEffective;
              
              return (
                <FormItem>
                  <FormLabel>Giới hạn tối đa số tiết/tuần (Cap Limit)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      {...field} 
                      min={1}
                      placeholder="17"
                      value={field.value || 17}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 17)}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    Giới hạn tối đa số tiết/tuần (cap limit). Mặc định: 17 tiết/tuần. 
                    Số tiết thực tế sẽ không vượt quá giá trị này.
                  </p>
                </FormItem>
              );
            }}/>
            <FormField control={form.control} name="optionalWeeklyLessons" render={({ field }) => (
              <FormItem>
                <FormLabel>Số tiết tự chọn bổ sung</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    {...field} 
                    min={0}
                    placeholder="0"
                    value={field.value || 0}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                  />
                </FormControl>
                <FormMessage />
                <p className="text-xs text-muted-foreground">
                  Số tiết tự chọn bổ sung (admin/BGH có thể nhập).
                  {(() => {
                    // ✅ Tính effectiveWeeklyLessons: base (17) - reduction + optional, bị cap bởi weeklyLessons
                    const baseWeeklyLessons = 17; // Base theo quy tắc THPT
                    const isHomeroom = form.watch("currentHomeroomClassId") && form.watch("currentHomeroomClassId") !== "none";
                    const isDepartmentHead = form.watch("departmentId") && form.watch("departmentId") !== "none";
                    const reduction = (isHomeroom || isDepartmentHead) ? 3 : 0;
                    const optionalLessons = field.value || 0;
                    const calculatedEffective = Math.max(0, baseWeeklyLessons - reduction) + optionalLessons;
                    const capLimit = form.watch("weeklyLessons") || 17;
                    const effectiveWeeklyLessons = capLimit !== null ? Math.min(calculatedEffective, capLimit) : calculatedEffective;
                    return ` Số tiết thực tế: ${effectiveWeeklyLessons} tiết/tuần (Base: ${baseWeeklyLessons} - Giảm: ${reduction} + Tự chọn: ${optionalLessons}, Cap: ${capLimit})`;
                  })()}
                </p>
              </FormItem>
            )}/>
            <FormField control={form.control} name="maxClasses" render={({ field }) => (
  <FormItem>
    <FormLabel>Số lớp tối đa có thể dạy</FormLabel>
    <FormControl>
      <Input
        type="number"
        {...field}
        min={1}
        placeholder="Nhập số lớp tối đa"
        value={field.value || 3}
        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 3)}
      />
    </FormControl>
    <FormMessage />
    <p className="text-xs text-muted-foreground">
      Tổng số lớp tối đa giáo viên có thể dạy. Mặc định: 3 lớp
    </p>
  </FormItem>
)}/>

          </div>

          {/* Số lớp tối đa theo khối */}
          <FormField control={form.control} name="maxClassPerGrade" render={({ field }) => (
            <FormItem>
              <FormLabel>Số lớp tối đa theo khối</FormLabel>
              <div className="grid grid-cols-3 gap-4">
                {(["10", "11", "12"] as const).map((grade) => (
                  <div key={grade}>
                    <FormLabel className="text-xs">Khối {grade}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={field.value?.[grade] || 0}
                        onChange={(e) => {
                          const value = e.target.value ? Number(e.target.value) : 0;
                          field.onChange({
                            ...field.value,
                            [grade]: value,
                          });
                        }}
                      />
                    </FormControl>
                  </div>
                ))}
              </div>
              <FormMessage />
              <p className="text-xs text-muted-foreground">
                Số lớp tối đa giáo viên có thể dạy cho từng khối. Mặc định: 0 lớp/khối
              </p>
            </FormItem>
          )}/>

          {/* Thông tin khác: notes, certifications, teachingExperience */}
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="teachingExperience" render={({ field }) => (
              <FormItem>
                <FormLabel>Thâm niên (số năm dạy)</FormLabel>
                <FormControl><Input type="number" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}/>
          </div>

          <FormField
  control={form.control}
  name="certifications"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Chứng chỉ / khóa đào tạo</FormLabel>
      <FormControl>
        <Input
          placeholder="Nhập chứng chỉ / khóa đào tạo"
          {...field}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>



          <FormField control={form.control} name="notes" render={({ field }) => (
            <FormItem>
              <FormLabel>Ghi chú</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}/>

          {/* Lớp phụ trách */}
          <FormField control={form.control} name="classIds" render={({ field }) => {
            const selectedClasses = field.value as string[];
            return (
              <FormItem>
                <FormLabel>Lớp phụ trách</FormLabel>
                <FormControl>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start flex-wrap gap-1">
                        {selectedClasses.length>0
                          ? selectedClasses.map(id=>classes.find(c=>c._id===id)?.className).filter(Boolean).map(label=>(
                              <span key={label} className="inline-flex items-center px-2 py-1 text-sm bg-gray-200 rounded-full">{label}</span>
                            ))
                          : "Chọn lớp..."}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Tìm lớp..." className="h-9" />
                        <CommandList>
                          <CommandEmpty>Không tìm thấy lớp nào.</CommandEmpty>
                          <CommandGroup>
                            {classes.map(cls=>(
                              <CommandItem key={cls._id} value={cls._id!} onSelect={()=>{
                                const isSelected = field.value.includes(cls._id!);
                                const newValue = isSelected ? field.value.filter(id=>id!==cls._id!) : [...field.value, cls._id!];
                                field.onChange(newValue);
                              }}>
                                {cls.className}
                                <Check className={cn("ml-auto", selectedClasses.includes(cls._id!)?"opacity-100":"opacity-0")} />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </FormControl>
                <FormMessage />
              </FormItem>
            )
          }}/>

          {/* Lớp chủ nhiệm hiện tại */}
          <FormField
            control={form.control}
            name="currentHomeroomClassId"
            render={({ field }) => {
              // ✅ Chỉ lấy lớp của năm học active và chưa có giáo viên chủ nhiệm hoặc là lớp hiện tại của giáo viên này
              const availableClasses = availableClassesForCurrentYear.filter(
                (cls) =>
                  !cls.teacherId ||
                  (teacher &&
                    (teacher.currentHomeroomClassId &&
                      (typeof teacher.currentHomeroomClassId === "string"
                        ? teacher.currentHomeroomClassId === cls._id
                        : teacher.currentHomeroomClassId._id === cls._id)))
              );

              return (
                <FormItem>
                  <FormLabel>Lớp chủ nhiệm hiện tại {currentSchoolYear ? `(${currentSchoolYear})` : ""}</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value || "none"}
                      onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn lớp chủ nhiệm hiện tại (tùy chọn)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Không có</SelectItem>
                        {availableClasses.map((cls) => (
                          <SelectItem key={cls._id} value={cls._id!}>
                            {cls.className} (Khối {cls.grade}){cls.year ? ` - ${cls.year}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />



          <DialogFooter>
            {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Hủy</Button>}
            <Button type="submit">{teacher?"Cập nhật":"Thêm mới"}</Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}

export default TeacherForm;
