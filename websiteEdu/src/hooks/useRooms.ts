import { useQuery } from '@tanstack/react-query';
import axiosClient from '@/services/axiosInstance';

// Room API service
export const roomApi = {
  getRooms: async () => {
    const res = await axiosClient.get('/exam/rooms');
    return res.data;
  },
};

// Room hook
export const useRooms = () => {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: () => roomApi.getRooms(),
  });
};