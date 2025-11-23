export interface ExamClass {
  _id: string;
  classId: {
    _id: string;
    name: string;
    code: string;
    yearOfAdmission: string;
    majorId: string;
    degreeId: string;
    totalStudents: number;
    status: 'active' | 'inactive';
  };
  examId: string;
  studentsCount: number;
}