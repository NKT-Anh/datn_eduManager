import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks";
import { departmentApi } from "@/services/departmentApi";
import { Teacher } from "@/types/auth";

const DepartmentTeachersPage = () => {
  const { backendUser } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchDepartmentTeachers = async () => {
      if (backendUser?.role === "teacher" && backendUser?.teacherFlags?.isDepartmentHead && backendUser?.department) {
        setLoading(true);
        try {
          const deptTeachers = await departmentApi.getTeachers(backendUser.department);
          setTeachers(deptTeachers);
        } catch (error) {
          console.error("Failed to fetch department teachers", error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchDepartmentTeachers();
  }, [backendUser]);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Department Teachers</h1>
      <ul>
        {teachers.map((teacher) => (
          <li key={teacher._id}>{teacher.name}</li>
        ))}
      </ul>
    </div>
  );
};

export default DepartmentTeachersPage;