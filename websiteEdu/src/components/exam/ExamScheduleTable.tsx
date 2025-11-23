import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EyeIcon, FileDownIcon } from 'lucide-react';

interface ExamSchedule {
  id: string;
  subject: string;
  date: string;
  timeSlot: string;
  room: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface ExamScheduleTableProps {
  schedules: ExamSchedule[];
  showActions?: boolean;
  onViewDetails?: (id: string) => void;
  onDownload?: (id: string) => void;
}

export const ExamScheduleTable: React.FC<ExamScheduleTableProps> = ({
  schedules,
  showActions = true,
  onViewDetails,
  onDownload,
}) => {
  const getStatusBadge = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
    };
    const labels = {
      pending: 'Chờ thi',
      in_progress: 'Đang diễn ra',
      completed: 'Đã hoàn thành',
    };
    return (
      <Badge variant="outline" className={colors[status as keyof typeof colors]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Môn thi</TableHead>
          <TableHead>Ngày thi</TableHead>
          <TableHead>Ca thi</TableHead>
          <TableHead>Phòng thi</TableHead>
          <TableHead>Trạng thái</TableHead>
          {showActions && <TableHead>Thao tác</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {schedules.map((schedule) => (
          <TableRow key={schedule.id}>
            <TableCell>{schedule.subject}</TableCell>
            <TableCell>{schedule.date}</TableCell>
            <TableCell>{schedule.timeSlot}</TableCell>
            <TableCell>{schedule.room}</TableCell>
            <TableCell>{getStatusBadge(schedule.status)}</TableCell>
            {showActions && (
              <TableCell>
                <div className="flex space-x-2">
                  {onViewDetails && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onViewDetails(schedule.id)}
                    >
                      <EyeIcon className="h-4 w-4" />
                    </Button>
                  )}
                  {onDownload && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDownload(schedule.id)}
                    >
                      <FileDownIcon className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};