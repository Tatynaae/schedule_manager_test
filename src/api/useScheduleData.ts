import { useQuery } from '@tanstack/react-query';
import { scheduleActions } from '../store/scheduleStore';
import { datasetKey, fetchSchedule } from './mockApi';

export const scheduleQueryKey = ['schedule'] as const;

export const useScheduleData = () =>
  useQuery({
    queryKey: scheduleQueryKey,
    queryFn: async () => {
      const data = await fetchSchedule();
      // Seed the client-side lesson store before the board renders.
      scheduleActions.hydrate(datasetKey(data), data.lessons);
      return data;
    },
    staleTime: Infinity,
    retry: false,
  });
