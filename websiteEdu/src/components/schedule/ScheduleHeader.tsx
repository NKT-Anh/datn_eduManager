import { FC } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicSchoolInfo } from "@/hooks/usePublicSchoolInfo";
import logoSchool from "@/assets/logo_school.png";

export type ScheduleHeaderProps = {
  title: string;
  subtitle?: string;
  description?: string;
};

/**
 * Renders the schedule title together with branding fetched from settings.
 */
const ScheduleHeader: FC<ScheduleHeaderProps> = ({ title, subtitle, description }) => {
  const { info, loading } = usePublicSchoolInfo();
  const logoSrc = info.logoUrl || logoSchool;

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        {loading ? (
          <Skeleton className="h-16 w-16 rounded-md" />
        ) : (
          <img
            src={logoSrc}
            alt={info.name}
            className="h-16 w-16 rounded-md border border-border bg-white p-2 object-contain"
          />
        )}
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            {info.name}
          </p>
          <h1 className="text-2xl font-bold leading-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {subtitle || info.slogan || "Tổ chức thời khóa biểu hiệu quả"}
          </p>
        </div>
      </div>
      {description ? (
        <p className="text-sm text-muted-foreground md:text-right max-w-xl">{description}</p>
      ) : null}
    </div>
  );
};

export default ScheduleHeader;