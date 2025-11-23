import { useState } from "react";
import * as XLSX from "xlsx"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "../ui/button";
import { teacherApi } from "@/services/teacherApi";
import { useToast } from "@/hooks/use-toast";
import { Teacher } from "@/types/auth";
import { Subject,ClassType } from "@/types/class";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2,XCircle } from "lucide-react";

interface ImportTeacherDialogProps {
    subjects: Subject[];
    classes : ClassType [];
    onImported?: () => void;
}

export function ImportTeachersDialog({subjects,classes,onImported,}: ImportTeacherDialogProps){
    const [file, setFile] =useState<File | null> (null);
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<{ success: string[]; failed: string[] }>({ success: [], failed: [] });
    const { toast } = useToast();
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) =>{
        if(e.target.files && e.target.files[0]){
            setFile(e.target.files[0]);
            setResults({success:[],failed:[]});
        }
    };
    const handleImport = async () =>{
        if(!file) return toast({ title: "Lỗi", description: "Chưa chọn file" });

        setIsLoading(true);
        const successList : string[] = [];
        const failedList : string [] = [];

        try{    
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const json : any[] = XLSX.utils.sheet_to_json(sheet);

             const payloads: Omit<Teacher, "_id">[] = json.map((row) => {
        const mainSub = subjects.find((s) => s.name === row.mainSubject);

        const subjectsArray = (row.subjects || "")
          .split(",")
          .map((s: string) => {
            const sub = subjects.find((sub) => sub.name === s.trim());
            return sub
              ? {
                  subjectId: { _id: sub._id, name: sub.name, code: sub.code },
                  grades: ["10", "11", "12"],
                }
              : null;
          })
          .filter(Boolean);

        const classObjects = (row.classIds || "")
          .split(",")
          .map((c: string) => classes.find((cls) => cls.className === c.trim()))
          .filter(Boolean);

        const homeroomClassObjects = (row.homeroomClassIds || "")
          .split(",")
          .map((c: string) => classes.find((cls) => cls.className === c.trim()))
          .filter(Boolean);

        return {
          name: row.name,
          phone: row.phone || undefined,
          dob: row.dob || undefined,
          gender: row.gender || "male",
          profilePhoto: row.profilePhoto || "",
          notes: row.notes || "",
          teacherCode: row.teacherCode,
          qualification: row.qualification,
          specialization: row.specialization,
          mainSubject: mainSub
            ? { _id: mainSub._id, name: mainSub.name, code: mainSub.code }
            : undefined,
          subjects: subjectsArray,
          teachingExperience: row.teachingExperience
            ? Number(row.teachingExperience)
            : undefined,
          certifications: row.certifications || "",
          classIds: classObjects,
          homeroomClassIds: homeroomClassObjects,
          hireYear: row.hireYear ? Number(row.hireYear) : undefined,
          hireYearInField: row.hireYearInField
            ? Number(row.hireYearInField)
            : undefined,
          weeklyLessons: row.weeklyLessons
            ? Number(row.weeklyLessons)
            : undefined,
          status: row.status || "active",
          school: row.school,
          position: row.position,
        };
      });

        await Promise.all(
        payloads.map(async (p) => {
          try {
            await teacherApi.create(p);
            successList.push(p.name);
          } catch (err) {
            failedList.push(p.name || "Unknown");
          }
        })
      );

      setResults({ success: successList, failed: failedList });
      onImported?.();
      setFile(null);
    } catch (error: any) {
      console.error(error);
      setResults({ success: [], failed: ["Lỗi đọc file hoặc dữ liệu không hợp lệ"] });
    } finally {
      setIsLoading(false);
    }
  };
return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Import Excel giáo viên</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Import giáo viên từ Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            disabled={isLoading}
          />
          <p className="text-sm text-muted-foreground">
            File Excel phải có các cột: <b>name, phone, dob, gender, teacherCode, qualification, specialization, mainSubject, subjects, classIds, homeroomClassIds, teachingExperience, certifications, school, position, weeklyLessons, hireYear, hireYearInField, notes, profilePhoto</b>
          </p>

          {/* Kết quả */}
          {results.success.length > 0 && (
            <Alert className="border-green-500">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle>Thành công</AlertTitle>
              <AlertDescription>
                Đã import {results.success.length} giáo viên:{" "}
                {results.success.join(", ")}
              </AlertDescription>
            </Alert>
          )}
          {results.failed.length > 0 && (
            <Alert className="border-red-500">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertTitle>Thất bại</AlertTitle>
              <AlertDescription>
                Không import được {results.failed.length} giáo viên:{" "}
                {results.failed.join(", ")}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setFile(null)} disabled={isLoading}>
            Hủy
          </Button>
          <Button onClick={handleImport} disabled={!file || isLoading}>
            {isLoading ? "Đang import..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}