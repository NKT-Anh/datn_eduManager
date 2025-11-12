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

const SupervisorRooms = () => {
  const assignedRooms = [
    {
      id: '1',
      examName: 'Toán học - Khối 10',
      date: '2025-11-15',
      timeSlot: 'Sáng (7:00 - 9:00)',
      room: 'A101',
      role: 'supervisor1',
      studentCount: 25,
      status: 'upcoming' as const,
    },
    // Add more sample data
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Phòng thi đảm nhận</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách phòng thi được phân công</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Môn thi</TableHead>
                <TableHead>Ngày thi</TableHead>
                <TableHead>Ca thi</TableHead>
                <TableHead>Phòng</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Số lượng thí sinh</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignedRooms.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell>{assignment.examName}</TableCell>
                  <TableCell>
                    {new Date(assignment.date).toLocaleDateString('vi-VN')}
                  </TableCell>
                  <TableCell>{assignment.timeSlot}</TableCell>
                  <TableCell>{assignment.room}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {assignment.role === 'supervisor1' ? 'Giám thị 1' : 'Giám thị 2'}
                    </Badge>
                  </TableCell>
                  <TableCell>{assignment.studentCount}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        assignment.status === 'upcoming' ? 'secondary' :
                        assignment.status === 'in_progress' ? 'default' : 'outline'
                      }
                    >
                      {assignment.status === 'upcoming' ? 'Sắp diễn ra' :
                       assignment.status === 'in_progress' ? 'Đang diễn ra' : 'Đã kết thúc'}
                    </Badge>
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

export default SupervisorRooms;