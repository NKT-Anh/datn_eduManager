import { Subject, Teacher } from "@/types/timetable";
import { cn } from "@/lib/utils";

interface TimetableCellProps {
  subject: Subject | null;
  teacher: Teacher | null;
  day: number;
  period: number;
  onDragStart: (day: number, period: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (day: number, period: number) => void;
  isDragging: boolean;
  isFixed?: boolean;
  onEdit?: (day: number, period: number) => void;
}

export const TimetableCell = ({
  subject,
  teacher,
  day,
  period,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
  isFixed = false,
  onEdit,
}: TimetableCellProps) => {
  const handleDragStart = (e: React.DragEvent) => {
    if (isFixed) {
      e.preventDefault();
      return;
    }
    onDragStart(day, period);
    e.currentTarget.classList.add("opacity-50");
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("opacity-50");
  };

  const handleClick = () => {
    if (onEdit && !isFixed) {
      onEdit(day, period);
    }
  };

  return (
    <div
      className={cn(
        "min-h-20 p-2 border border-border rounded-lg transition-all relative",
        subject ? "cursor-move hover:shadow-lg" : "bg-muted/30 hover:bg-muted/50",
        isDragging && "ring-2 ring-primary",
        isFixed && "bg-orange-100 border-orange-300 cursor-default"
      )}
      draggable={!!subject && !isFixed}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={onDragOver}
      onDrop={() => !isFixed && onDrop(day, period)}
      onClick={handleClick}
    >
      {subject && (
        <div
          className={cn(
            "h-full p-2 rounded-md text-white font-medium text-sm flex flex-col gap-1",
            isFixed && "bg-orange-500"
          )}
          style={{ backgroundColor: isFixed ? undefined : subject.color }}
        >
          <div className="font-semibold flex items-center justify-between">
            <span>{subject.name}</span>
            {isFixed && (
              <span className="text-xs bg-orange-600 px-1 rounded">Cố định</span>
            )}
          </div>
          {teacher && (
            <div className="text-xs opacity-90">{teacher.name}</div>
          )}
        </div>
      )}
      {!subject && !isFixed && (
        <div className="text-gray-400 text-xs text-center py-4">
          Kéo môn học vào đây
        </div>
      )}
    </div>
  );
};
