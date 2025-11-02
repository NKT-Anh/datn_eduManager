// // components/TeachersImport.tsx
// import { useState } from "react";
// import { Button } from "@/components/ui/button";
// import { useToast } from "@/hooks/use-toast";
// import * as XLSX from "xlsx";
// import { teacherApi } from "@/services/teacherApi";
// import { Teacher } from "@/types/auth";
// import { ClassType, Subject } from "@/types/class";

// interface TeachersImportProps {
//   subjects: Subject[];
//   classes: ClassType[];
//   onSuccess?: () => void;
// }

// export function TeachersImport({ subjects, classes, onSuccess }: TeachersImportProps) {
//   const [file, setFile] = useState<File | null>(null);
//   const { toast } = useToast();

//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     if (e.target.files && e.target.files.length > 0) {
//       setFile(e.target.files[0]);
//     }
//   };

//   const handleImport = async () => {
//     if (!file) return;

//     const reader = new FileReader();
//     reader.onload = async (evt) => {
//       const data = evt.target?.result;
//       if (!data) return;

//       const workbook = XLSX.read(data, { type: "binary" });
//       const firstSheetName = workbook.SheetNames[0];
//       const worksheet = workbook.Sheets[firstSheetName];
//       const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);

//       try {
//         const payload: Omit<Teacher, "_id">[] = rawData.map((row) => {
//           // map tên cột Excel với form fields
//           // Ví dụ Excel cột: "Tên", "Mã GV", "SĐT", "Email", "Môn dạy", "Lớp phụ trách", "Năm vào trường", "Thâm niên", "Chứng chỉ"
//           const subjectNames: string[] = row["Môn dạy"] ? String(row["Môn dạy"]).split(",").map((s: string) => s.trim()) : [];
//           const classNames: string[] = row["Lớp phụ trách"] ? String(row["Lớp phụ trách"]).split(",").map((c: string) => c.trim()) : [];

//           const subjectObjects = subjectNames.map((name) => {
//             const sub = subjects.find((s) => s.name === name);
//             return sub ? { subjectId: { _id: sub._id, name: sub.name, code: sub.code }, grades: [] } : null;
//           }).filter(Boolean);

//           const classObjects = classNames.map((name) => {
//             const cls = classes.find((c) => c.className === name);
//             return cls ? cls._id : null;
//           }).filter(Boolean);

//           return {
//             name: row["Tên"] || "",
//             teacherCode: row["Mã GV"] || "",
//             phone: row["SĐT"] || "",
//             profilePhoto: row["URL ảnh đại diện"] || "",
//             gender: row["Giới tính"]?.toLowerCase() || "male",
//             hireYear: row["Năm vào trường"] ? Number(row["Năm vào trường"]) : undefined,
//             hireYearInField: row["Thâm niên"] ? Number(row["Thâm niên"]) : undefined,
//             weeklyLessons: row["Số tiết / tuần"] ? Number(row["Số tiết / tuần"]) : undefined,
//             certifications: row["Chứng chỉ"] ? String(row["Chứng chỉ"]).split(",").map((s: string) => s.trim()) : [],
//             subjects: subjectObjects,
//             classIds: classObjects,
//             homeroomClassIds: [], // để trống, nếu muốn import cũng được
//             status: "active",
//             school: row["Trường"] || "",
//             position: row["Chức vụ"] || "Giáo viên",
//             notes: row["Ghi chú"] || "",
//           };
//         });

//         // gửi lên API
//         for (const t of payload) {
//           await teacherApi.create(t);
//         }

//         toast({ title: "Thành công", description: "Đã import giáo viên từ Excel" });
//         setFile(null);
//         onSuccess?.();
//       } catch (error: any) {
//         console.error(error);
//         toast({ title: "Lỗi", description: error.message || "Import thất bại" });
//       }
//     };

//     reader.readAsBinaryString(file);
//   };

//   return (
//     <div className="flex gap-2 items-center">
//       <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} />
//       <Button onClick={handleImport} disabled={!file}>
//         Import Excel
//       </Button>
//     </div>
//   );
// }
