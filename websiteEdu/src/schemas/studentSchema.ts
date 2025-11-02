import * as z from 'zod';

const parentInfoSchema = z.object({
  _id: z.string().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  occupation: z.string().optional(),
  relation: z.enum(['father', 'mother', 'guardian']),
});

export const studentSchema = z.object({
  _id: z.string().optional(),
  studentCode: z.string().optional(),
  name: z.string().min(1, 'Họ tên bắt buộc'),
  dob: z.string().min(1, 'Ngày sinh bắt buộc'),
  gender: z.enum(['male', 'female', 'other']),
  phone: z.string().optional(),
  address: z.string().optional(),
  classId: z.string().optional(),
  admissionYear: z.number(),
  grade: z.enum(['10', '11', '12']),
  status: z.enum(['active', 'inactive']),
  parents: z.array(parentInfoSchema).optional(),
});

export type StudentFormValues = z.infer<typeof studentSchema>;
