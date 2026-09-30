import { CameraOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/** Leitor de QR Code pela câmara (traseira no telemóvel). */
export function QrScanner({ onResult, paused }: { onResult: (value: string) => void; paused?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const callback = useRef(onResult);
  callback.current = onResult;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    let scanner: import('qr-scanner').default | null = null;
    let cancelled = false;
    let last = { value: '', at: 0 };
    (async () => {
      const { default: QrScannerLib } = await import('qr-scanner');
      if (cancelled || !videoRef.current) return;
      if (!(await QrScannerLib.hasCamera())) {
        setError('Nenhuma câmara disponível neste dispositivo.');
        return;
      }
      scanner = new QrScannerLib(
        videoRef.current,
        (r) => {
          // Evita leituras repetidas do mesmo código em sequência
          const now = Date.now();
          if (pausedRef.current || (r.data === last.value && now - last.at < 4000)) return;
          last = { value: r.data, at: now };
          callback.current(r.data);
        },
        { preferredCamera: 'environment', highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 5 },
      );
      try {
        await scanner.start();
      } catch {
        setError('Sem acesso à câmara. Autorize o acesso nas definições do browser.');
      }
    })();
    return () => {
      cancelled = true;
      scanner?.destroy();
    };
  }, []);

  if (error) {
    return (
      <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl bg-slate-100 p-6 text-center text-sm text-slate-500 dark:bg-slate-800">
        <CameraOff className="h-6 w-6" />
        {error}
      </div>
    );
  }
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-slate-900">
      <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
    </div>
  );
}
