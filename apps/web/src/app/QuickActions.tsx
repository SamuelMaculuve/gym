import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { MemberCreateResponse } from '@gymflow/shared';
import { CheckInPanel } from '../features/attendance/CheckInPanel';
import { MemberCreatedDialog } from '../features/members/MemberCreatedDialog';
import { MemberCreateDrawer } from '../features/members/MemberForm';
import { PaymentDialog } from '../features/payments/PaymentDialog';
import { Modal } from '../components/ui';

interface QuickActions {
  openPayment: (memberId?: string | null) => void;
  openCheckIn: () => void;
  openNewMember: () => void;
}

const Ctx = createContext<QuickActions | null>(null);

/** Acções rápidas da recepção, disponíveis em qualquer página. */
export function QuickActionsProvider({ children }: { children: ReactNode }) {
  const [payment, setPayment] = useState<{ open: boolean; memberId: string | null }>({ open: false, memberId: null });
  const [checkIn, setCheckIn] = useState(false);
  const [newMember, setNewMember] = useState(false);
  const [created, setCreated] = useState<MemberCreateResponse | null>(null);

  const openPayment = useCallback((memberId?: string | null) => {
    setCheckIn(false);
    setPayment({ open: true, memberId: memberId ?? null });
  }, []);
  const value = useMemo<QuickActions>(
    () => ({ openPayment, openCheckIn: () => setCheckIn(true), openNewMember: () => setNewMember(true) }),
    [openPayment],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <PaymentDialog open={payment.open} memberId={payment.memberId} onClose={() => setPayment({ open: false, memberId: null })} />
      <Modal open={checkIn} onClose={() => setCheckIn(false)} title="Check-in rápido" description="QR Code, código de membro, telefone ou nome." size="lg">
        <div className="pb-2">
          <CheckInPanel compact />
        </div>
      </Modal>
      <MemberCreateDrawer
        open={newMember}
        onClose={() => setNewMember(false)}
        onCreated={(r) => {
          setNewMember(false);
          setCreated(r);
        }}
      />
      <MemberCreatedDialog
        result={created}
        onClose={() => setCreated(null)}
        onRegisterPayment={(id) => {
          setCreated(null);
          openPayment(id);
        }}
      />
    </Ctx.Provider>
  );
}

export function useQuickActions() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useQuickActions fora do QuickActionsProvider');
  return ctx;
}
