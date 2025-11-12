import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const ExamRoom = () => {
  const examInfo = [
    {
      id: '1',
      subject: 'Toán học',
      date: '2025-11-15',
      timeSlot: 'Sáng (7:00 - 9:00)',
      room: 'A101',
      examNumber: 'A101-15',
      supervisors: ['Nguyễn Văn A', 'Trần Thị B'],
    },
    // Add more sample data
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Thông tin phòng thi</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chi tiết phòng thi</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Môn thi</TableHead>
                <TableHead>Ngày thi</TableHead>
                <TableHead>Ca thi</TableHead>
                <TableHead>Phòng thi</TableHead>
                <TableHead>Số báo danh</TableHead>
                <TableHead>Giám thị</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {examInfo.map((exam) => (
                <TableRow key={exam.id}>
                  <TableCell>{exam.subject}</TableCell>
                  <TableCell>
                    {new Date(exam.date).toLocaleDateString('vi-VN')}
                  </TableCell>
                  <TableCell>{exam.timeSlot}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{exam.room}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">{exam.examNumber}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col space-y-1">
                      {exam.supervisors.map((supervisor, index) => (
                        <span key={index} className="text-sm">
                          {supervisor}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExamRoom;