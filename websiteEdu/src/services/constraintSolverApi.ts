import api from "./axiosInstance";

interface SolvePayload {
  grades: string[];
  year: string;
  semester: string;
}

export const constraintSolverApi = {
  solveWithBacktracking: async ({ grades, year, semester }: SolvePayload) => {
    const res = await api.post("/constraint-solver/backtracking", {
      grades,
      year,
      semester,
    });
    return res.data;
  },
};


