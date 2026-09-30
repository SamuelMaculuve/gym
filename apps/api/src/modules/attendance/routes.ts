import { Router } from 'express';
import { attendanceListQuery, checkInSchema, manualAttendanceSchema } from '@gymflow/shared';
import { getGymContext } from '../../lib/gym';
import { actorOf, currentUser, requirePermission } from '../../middleware/auth';
import { body, query, param } from '../../middleware/validate';
import { checkIn, checkOut, createManualAttendance, findCandidates, listAttendance } from './service';

export const attendanceRouter = Router();

attendanceRouter.get('/', requirePermission('attendance:read'), async (req, res) => {
  const ctx = await getGymContext(currentUser(req).gymId);
  res.json(await listAttendance(ctx, query(req, attendanceListQuery)));
});

attendanceRouter.get('/candidates', requirePermission('attendance:write'), async (req, res) => {
  const ctx = await getGymContext(currentUser(req).gymId);
  res.json(await findCandidates(ctx, String(req.query.q ?? '')));
});

attendanceRouter.post('/check-in', requirePermission('attendance:write'), async (req, res) => {
  const ctx = await getGymContext(currentUser(req).gymId);
  res.json(await checkIn(ctx, body(req, checkInSchema), actorOf(req)));
});

attendanceRouter.post('/:id/check-out', requirePermission('attendance:write'), async (req, res) => {
  const ctx = await getGymContext(currentUser(req).gymId);
  res.json(await checkOut(ctx, param(req, 'id')));
});

attendanceRouter.post('/', requirePermission('attendance:write'), async (req, res) => {
  const ctx = await getGymContext(currentUser(req).gymId);
  res.status(201).json(await createManualAttendance(ctx, body(req, manualAttendanceSchema), actorOf(req)));
});
