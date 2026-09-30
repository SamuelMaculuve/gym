import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import type { AttendanceListQuery, CheckInInput, ManualAttendanceInput } from '@gymflow/shared';
import { api } from '../../lib/api';
import { qk } from '../../lib/query-keys';
import { useInvalidateBusiness } from '../members/hooks';

export function useAttendance(params: AttendanceListQuery) {
  return useQuery({ queryKey: qk.attendanceList(params), queryFn: () => api.attendance.list(params), placeholderData: keepPreviousData, refetchInterval: 60_000 });
}

export function useCheckIn() {
  const invalidate = useInvalidateBusiness();
  return useMutation({ mutationFn: (input: CheckInInput) => api.attendance.checkIn(input), onSuccess: invalidate });
}

export function useCheckOut() {
  const invalidate = useInvalidateBusiness();
  return useMutation({ mutationFn: (id: string) => api.attendance.checkOut(id), onSuccess: invalidate });
}

export function useManualAttendance() {
  const invalidate = useInvalidateBusiness();
  return useMutation({ mutationFn: (input: ManualAttendanceInput) => api.attendance.createManual(input), onSuccess: invalidate });
}
