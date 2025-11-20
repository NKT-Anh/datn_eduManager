import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { mockGrades, mockStudents, mockSubjects, mockClasses } from '@/data/mockData';
import { 
  BarChart3,
  Search,
  Filter,
  Edit,
  Plus,
  User,
  BookOpen,
  TrendingUp,
  Award
} from 'lucide-react';

const GradesPage = () => {
  const { backendUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedSemester, setSelectedSemester] = useState('1');

  const filteredGrades = mockGrades.filter(grade => {
    const student = mockStudents.find(s => s.id === grade.studentId);
    const subject = mockSubjects.find(s => s.id === grade.subjectId);
    
    const matchesSearch = student?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         subject?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = selectedSubject === 'all' || grade.subjectId === selectedSubject;
    const matchesSemester = grade.semester.toString() === selectedSemester;

    if (backendUser?.role === 'student') {
      return grade.studentId === (backendUser.studentId || backendUser._id) && matchesSubject && matchesSemester;
    } else if (backendUser?.role === 'teacher') {
      return backendUser.subjects?.some((s: any) => s.subjectId === grade.subjectId) && matchesSearch && matchesSubject && matchesSemester;
    } else {
      return matchesSearch && matchesSubject && matchesSemester;
    }
  });

  const getStudentName = (studentId: string) => {
    const student = mockStudents.find(s => s.id === studentId);
    return student?.name || 'Unknown';
  };

  const getSubjectName = (subjectId: string) => {
    const subject = mockSubjects.find(s => s.id === subjectId);
    return subject?.name || 'Unknown';
  };

  const calculateAverage = (grade: any) => {
    const scores = [];
    
    // Add oral scores (coefficient 1)
    if (grade.oral1) scores.push(grade.oral1);
    if (grade.oral2) scores.push(grade.oral2);
    if (grade.oral3) scores.push(grade.oral3);
    
    // Add 15-min test scores (coefficient 1)
    if (grade.test15min1) scores.push(grade.test15min1);
    if (grade.test15min2) scores.push(grade.test15min2);
    if (grade.test15min3) scores.push(grade.test15min3);
    
    // Add midterm scores (coefficient 2)
    if (grade.midterm1) scores.push(grade.midterm1, grade.midterm1);
    if (grade.midterm2) scores.push(grade.midterm2, grade.midterm2);
    
    // Add final exam score (coefficient 3)
    if (grade.finalExam) scores.push(grade.finalExam, grade.finalExam, grade.finalExam);
    
    if (scores.length === 0) return 0;
    return (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1);
  };

  const getGradeColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6.5) return 'text-blue-600';
    if (score >= 5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const renderScoreCell = (score: number | undefined) => {
    if (!score) return <span className="text-muted-foreground">-</span>;
    return <span className={getGradeColor(score)}>{score}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {backendUser?.role === 'student' ? 'Điểm số của tôi' : 'Quản lý điểm số'}
          </h1>
          <p className="text-muted-foreground">
            {backendUser?.role === 'student' 
              ? 'Xem điểm số các môn học của bạn'
              : 'Quản lý và nhập điểm cho học sinh'
            }
          </p>
        </div>
        {(backendUser?.role === 'teacher' || backendUser?.role === 'admin') && (
          <Button className="bg-gradient-primary hover:bg-primary-hover">
            <Plus className="h-4 w-4 mr-2" />
            Nhập điểm
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="shadow-card border-border">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {backendUser?.role !== 'student' && (
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm kiếm học sinh hoặc môn học..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
              >
                <option value="all">Tất cả môn</option>
                {mockSubjects
                  .filter(subject => 
                    backendUser?.role === 'student' || 
                    backendUser?.role === 'admin' || 
                    backendUser?.subjects?.some((s: any) => s.subjectId === subject.id)
                  )
                  .map(subject => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))
                }
              </select>
            </div>
            
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
            >
              <option value="1">Học kỳ 1</option>
              <option value="2">Học kỳ 2</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Grades Table */}
      <Card className="shadow-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span>Bảng điểm học kỳ {selectedSemester}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-muted">
                <tr>
                  {backendUser?.role !== 'student' && (
                    <th className="p-3 text-left font-medium text-muted-foreground">Học sinh</th>
                  )}
                  <th className="p-3 text-left font-medium text-muted-foreground">Môn học</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">Miệng 1</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">Miệng 2</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">Miệng 3</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">15p 1</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">15p 2</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">15p 3</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">GK 1</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">GK 2</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">Cuối kỳ</th>
                  <th className="p-3 text-center font-medium text-muted-foreground">TB</th>
                  {(backendUser?.role === 'teacher' || backendUser?.role === 'admin') && (
                    <th className="p-3 text-center font-medium text-muted-foreground">Thao tác</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredGrades.map((grade, index) => (
                  <tr key={grade.id} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                    {backendUser?.role !== 'student' && (
                      <td className="p-3">
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{getStudentName(grade.studentId)}</span>
                        </div>
                      </td>
                    )}
                    <td className="p-3">
                      <div className="flex items-center space-x-2">
                        <BookOpen className="h-4 w-4 text-primary" />
                        <span>{getSubjectName(grade.subjectId)}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">{renderScoreCell(grade.oral1)}</td>
                    <td className="p-3 text-center">{renderScoreCell(grade.oral2)}</td>
                    <td className="p-3 text-center">{renderScoreCell(grade.oral3)}</td>
                    <td className="p-3 text-center">{renderScoreCell(grade.test15min1)}</td>
                    <td className="p-3 text-center">{renderScoreCell(grade.test15min2)}</td>
                    <td className="p-3 text-center">{renderScoreCell(grade.test15min3)}</td>
                    <td className="p-3 text-center">{renderScoreCell(grade.midterm1)}</td>
                    <td className="p-3 text-center">{renderScoreCell(grade.midterm2)}</td>
                    <td className="p-3 text-center">{renderScoreCell(grade.finalExam)}</td>
                    <td className="p-3 text-center">
                      <Badge variant="outline" className={`${getGradeColor(Number(calculateAverage(grade)))} border-current`}>
                        {calculateAverage(grade)}
                      </Badge>
                    </td>
                    {(backendUser?.role === 'teacher' || backendUser?.role === 'admin') && (
                      <td className="p-3 text-center">
                        <Button variant="ghost" size="icon">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {filteredGrades.length === 0 && (
        <Card className="shadow-card border-border">
          <CardContent className="p-12 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Chưa có điểm số</h3>
            <p className="text-muted-foreground">
              {backendUser?.role === 'student' 
                ? 'Điểm số sẽ được cập nhật khi giáo viên nhập điểm.'
                : 'Chưa có điểm số nào được nhập cho tiêu chí tìm kiếm này.'
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Statistics */}
      {backendUser?.role === 'student' && filteredGrades.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="shadow-card border-border">
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">
                {(filteredGrades.reduce((sum, grade) => sum + Number(calculateAverage(grade)), 0) / filteredGrades.length).toFixed(1)}
              </p>
              <p className="text-sm text-muted-foreground">Điểm TB chung</p>
            </CardContent>
          </Card>
          <Card className="shadow-card border-border">
            <CardContent className="p-4 text-center">
              <Award className="h-8 w-8 text-success mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">
                {Math.max(...filteredGrades.map(grade => Number(calculateAverage(grade))))}
              </p>
              <p className="text-sm text-muted-foreground">Điểm cao nhất</p>
            </CardContent>
          </Card>
          <Card className="shadow-card border-border">
            <CardContent className="p-4 text-center">
              <BookOpen className="h-8 w-8 text-warning mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{filteredGrades.length}</p>
              <p className="text-sm text-muted-foreground">Môn học</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default GradesPage;