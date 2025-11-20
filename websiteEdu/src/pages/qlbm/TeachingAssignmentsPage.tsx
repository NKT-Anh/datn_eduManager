import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks";
import { departmentApi } from "@/services/departmentApi";
import { Teacher } from "@/types/auth";

const TeachingAssignmentsPage = () => {
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

  const handleAssign = (teacherId: string) => {
    // Logic to assign teaching tasks to the selected teacher
    console.log(`Assigning teaching task to teacher with ID: ${teacherId}`);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Teaching Assignments</h1>
      <ul>
        {teachers.map((teacher) => (
          <li key={teacher._id}>
            {teacher.name}
            <button onClick={() => handleAssign(teacher._id)}>Assign</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TeachingAssignmentsPage;