import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, Info, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { apiService } from '../../services/api';
import type { NormativeCurrencyReport } from '../../services/types';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';

interface NormativeStatusIndicatorProps {
  templateId?: number;
}

export const NormativeStatusIndicator: React.FC<NormativeStatusIndicatorProps> = ({
  templateId,
}) => {
  const [report, setReport] = useState<NormativeCurrencyReport | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (templateId) {
      apiService
        .checkTemplateNormativeCurrency(templateId)
        .then((res) => setReport(res))
        .catch((err) => console.error('Error verificando vigencia normativa:', err));
    }
  }, [templateId]);

  if (!report) return null;

  const isCurrent = report.all_current;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg border text-xs font-bold transition-all cursor-pointer select-none',
            isCurrent
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
              : 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100'
          )}
        >
          {isCurrent ? (
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          )}
          <span>{isCurrent ? 'Normativa Legal Vigente' : 'Alerta: Norma Desactualizada'}</span>
          <Info className="w-3.5 h-3.5 opacity-70 ml-0.5" />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 animate-in fade-in duration-150" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-xl border border-slate-200 p-6 z-50 flex flex-col gap-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className={`w-5 h-5 ${isCurrent ? 'text-emerald-600' : 'text-rose-600'}`} />
              <Dialog.Title className="text-base font-bold text-slate-900">
                Verificación de Vigencia Regulatoria
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-xs text-slate-500 leading-relaxed">
            Comprobación algorítmica contra el catálogo del Ministerio de Salud (Res. 1130/2000) e ISO 7396-1:2016.
          </Dialog.Description>

          <div className="flex flex-col gap-2.5 mt-1">
            {report.clauses.map((c) => (
              <div
                key={c.item_id}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-1.5"
              >
                <div className="flex justify-between items-center">
                  <Badge label={c.item_code} variant="slate" size="sm" />
                  <Badge
                    label={c.is_current ? 'Vigente' : 'Superada'}
                    variant={c.is_current ? 'emerald' : 'rose'}
                    size="sm"
                  />
                </div>
                <div className="text-xs font-bold text-blue-700">{c.referencia_normativa}</div>
                <div className="text-xs text-slate-600">{c.status_message}</div>
                {c.suggested_replacement && (
                  <div className="text-xs font-semibold text-rose-700">
                    👉 Reemplazo: {c.suggested_replacement}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
