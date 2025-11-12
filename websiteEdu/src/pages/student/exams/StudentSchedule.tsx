import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExamScheduleTable } from '@/components/exam/ExamScheduleTable';

const StudentSchedule = () => {
  const studentSchedules = [
    {
      id: '1',
      subject: 'Toán học',
      date: '2025-11-15',
      timeSlot: 'Sáng (7:00 - 9:00)',
      room: 'A101',
      status: 'pending' as const,
    },
    // Add more sample data
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Lịch thi</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách lịch thi</CardTitle>
        </CardHeader>
        <CardContent>
          <ExamScheduleTable 
            schedules={studentSchedules}
            showActions={false}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentSchedule;