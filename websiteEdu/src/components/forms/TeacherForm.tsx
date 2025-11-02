import { useForm, Controller } from "react-hook-form";
import { useEffect } from "react";
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
import { Select, SelectItem, SelectTrigger, SelectContent } from "@/components/ui/select";
import { Teacher } from "@/types/auth";
import { cn } from "@/lib/utils";
import { ClassType, Subject } from "@/types/class";

// ========== Zod Schema ==========
const teacherSchema = z.object({
  name: z.string().min(1, "Tên giáo viên là bắt buộc"),
  phone: z.string().optional(),
  dob: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  profilePhoto: z.string().optional(),
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
    if (val === "" || val == null) return undefined;
    return Number(val);
  }, z.number().optional()),


    status: z.enum(["active", "inactive"]).optional(),
    school: z.string().optional(),
    position: z.string().optional(),  
     maxClasses: z.preprocess((val) => {
    if (val === "" || val == null) return 3; // default = 3
    return Number(val);
  }, z.number().min(1, "Số lớp tối thiểu là 1").optional()),
  });

type TeacherFormData = z.infer<typeof teacherSchema>;

interface TeacherFormProps {
  teacher?: Teacher;
  subjects: Subject[];
  classes: ClassType[];
  onSubmit: (data: Omit<Teacher, "_id">) => void;
  onCancel?: () => void;
}

const renderGenderLabels: Record<string, string> = {
  male: "Nam",
  female:"Nữ",
  other: "Khác",
};

export function TeacherForm({ teacher, subjects, classes, onSubmit, onCancel }: TeacherFormProps) {
  const form = useForm<TeacherFormData>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      name: teacher?.name || "",
      phone: teacher?.phone || "",
      dob: teacher?.dob ? teacher.dob.split("T")[0] : "",
      gender: teacher?.gender || "male",
      profilePhoto: teacher?.profilePhoto || "",
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
      hireYear: teacher?.hireYear || new Date().getFullYear(),
      hireYearInField: teacher?.hireYearInField,
      weeklyLessons: teacher?.weeklyLessons,
      status: teacher?.status || "active",
      school: teacher?.school,
      position: teacher?.position,
       maxClasses: teacher?.maxClasses || 3,
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

    const payload: Omit<Teacher, "_id"> = {
      name: data.name,
      phone: data.phone || undefined,
      dob: data.dob || undefined,
      gender: data.gender,
      profilePhoto: data.profilePhoto,
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

        hireYear: data.hireYear ? Number(data.hireYear) : undefined,
        hireYearInField: data.hireYearInField ? Number(data.hireYearInField) : undefined,
        weeklyLessons: data.weeklyLessons ? Number(data.weeklyLessons) : undefined,

   
      status: data.status,
      school: data.school,
      position: data.position,
      maxClasses: data.maxClasses ? Number(data.maxClasses) : 3,
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
            <FormField control={form.control} name="weeklyLessons" render={({ field }) => (
              <FormItem>
                <FormLabel>Số tiết / tuần</FormLabel>
                <FormControl><Input type="number" {...field} /></FormControl>
                <FormMessage />
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
      />
    </FormControl>
    <FormMessage />
  </FormItem>
)}/>

          </div>

          {/* Thông tin khác: profilePhoto, notes, certifications, teachingExperience */}
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="profilePhoto" render={({ field }) => (
              <FormItem>
                <FormLabel>URL ảnh đại diện</FormLabel>
                <FormControl><Input placeholder="Nhập URL" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}/>
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

          {/* Lớp chủ nhiệm */}
         {/* Lớp chủ nhiệm */}
<FormField
  control={form.control}
  name="homeroomClassIds"
  render={({ field }) => {
    const availableClasses = classes.filter(
      (cls) =>
        !cls.teacherId ||
        (teacher &&
          teacher.homeroomClassIds?.some((c) => c._id === cls._id))
    );

    return (
      <FormItem>
        <FormLabel>Lớp chủ nhiệm</FormLabel>
        <FormControl>
          <Combobox
            options={availableClasses.map((cls) => ({
              label: cls.className,
              value: cls._id!, // dùng id làm value
            }))}
            value={field.value} // value là string[] (ids)
            onChange={(selectedIds: string[]) => {
              field.onChange(selectedIds); // gán thẳng vào form
            }}
          />
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
