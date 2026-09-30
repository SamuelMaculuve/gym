import { Download, Printer, RefreshCw } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import type { MemberQr } from '@gymflow/shared';
import { useAuth } from '../lib/auth';
import { Button, Skeleton } from './ui';

/** QR Code do membro: contém apenas um identificador aleatório (sem dados pessoais). */
export function QrCodeCard({ qr, onRegenerate, regenerating }: { qr: MemberQr | undefined; onRegenerate?: () => void; regenerating?: boolean }) {
  const { gym } = useAuth();
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!qr) return;
    QRCode.toDataURL(qr.qrValue, { width: 560, margin: 1, errorCorrectionLevel: 'M' }).then(setSrc);
  }, [qr]);

  const download = () => {
    if (!src || !qr) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = `qrcode-${qr.code}.png`;
    a.click();
  };

  const print = () => {
    if (!src || !qr) return;
    const w = window.open('', '_blank', 'width=420,height=600');
    if (!w) return;
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    w.document.write(`<!doctype html><html><head><title>${esc(qr.code)}</title><style>
      body{font-family:system-ui,sans-serif;display:flex;justify-content:center;padding:24px;margin:0}
      .card{border:1px solid #e2e8f0;border-radius:16px;padding:24px;text-align:center;width:300px}
      img{width:240px;height:240px} h1{font-size:16px;margin:12px 0 4px} p{margin:0;color:#475569;font-size:13px}
      .gym{font-weight:700;font-size:14px;margin-bottom:12px;color:#059669}
    </style></head><body><div class="card"><div class="gym">${esc(gym?.name ?? 'GymFlow')}</div>
      <img src="${src}" alt="QR"/><h1>${esc(qr.fullName)}</h1><p>${esc(qr.code)}</p></div>
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700">
        {src ? <img src={src} alt={`QR Code de ${qr?.fullName}`} className="h-52 w-52" /> : <Skeleton className="h-52 w-52" />}
      </div>
      {qr && (
        <div className="text-center">
          <p className="font-semibold text-slate-900 dark:text-white">{qr.fullName}</p>
          <p className="text-sm text-slate-500 tabular">{qr.code}</p>
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} onClick={download} disabled={!src}>
          Descarregar
        </Button>
        <Button variant="outline" size="sm" icon={<Printer className="h-4 w-4" />} onClick={print} disabled={!src}>
          Imprimir
        </Button>
        {onRegenerate && (
          <Button variant="ghost" size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={onRegenerate} loading={regenerating}>
            Gerar novo
          </Button>
        )}
      </div>
    </div>
  );
}
