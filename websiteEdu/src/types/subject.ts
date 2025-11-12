export interface Subject {
  _id: string;
  name: string;
  code: string;
  credits: number;
  grades?: Array<'10' | '11' | '12'>;
  description?: string;
  includeInAverage?: boolean;
}