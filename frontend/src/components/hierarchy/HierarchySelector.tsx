import React, { useState, useEffect } from 'react';
import {
  Building2,
  Layers,
  Activity,
  PlayCircle,
  Gauge,
  CircleDot,
  Radio,
} from 'lucide-react';
import type { Hospital, Asset, AssetType } from '../../services/types';
import { Card } from '../ui/Card';
import { Badge, type BadgeVariant } from '../ui/Badge';
import { Button } from '../ui/Button';

interface HierarchySelectorProps {
  hospitals: Hospital[];
  loading?: boolean;
  selectedAsset: Asset | null;
  onSelectAsset: (asset: Asset) => void;
  onStartInspection: (asset: Asset) => void;
}

export const HierarchySelector: React.FC<HierarchySelectorProps> = ({
  hospitals,
  loading = false,
  selectedAsset,
  onSelectAsset,
  onStartInspection,
}) => {
  const [selectedHospitalId, setSelectedHospitalId] = useState<number | null>(
    hospitals.length > 0 ? hospitals[0].id : null
  );

  useEffect(() => {
    if (hospitals.length > 0) {
      if (!selectedHospitalId || !hospitals.some((h) => h.id === selectedHospitalId)) {
        setSelectedHospitalId(hospitals[0].id);
        if (hospitals[0].sectors.length > 0) {
          setSelectedSectorId(hospitals[0].sectors[0].id);
        }
      }
    }
  }, [hospitals, selectedHospitalId]);

  const activeHospital = hospitals.find(
    (h) => h.id === (selectedHospitalId ?? (hospitals[0]?.id || null))
  ) || hospitals[0];

  const [selectedSectorId, setSelectedSectorId] = useState<number | null>(
    activeHospital?.sectors[0]?.id || null
  );

  const activeSector = activeHospital?.sectors.find(
    (s) => s.id === (selectedSectorId ?? (activeHospital?.sectors[0]?.id || null))
  ) || activeHospital?.sectors[0];

  const getAssetTypeBadge = (type: AssetType): { label: string; variant: BadgeVariant; icon: React.ReactNode } => {
    switch (type) {
      case 'MANIFOLD':
        return {
          label: 'Manifold Central',
          variant: 'indigo',
          icon: <Activity className="w-3.5 h-3.5 text-indigo-600" />,
        };
      case 'AVSU_VALVE':
        return {
          label: 'Válvula AVSU',
          variant: 'cyan',
          icon: <Radio className="w-3.5 h-3.5 text-cyan-600" />,
        };
      case 'TERMINAL_UNIT':
        return {
          label: 'Boca Terminal',
          variant: 'blue',
          icon: <CircleDot className="w-3.5 h-3.5 text-blue-600" />,
        };
      case 'PRESSURE_REGULATOR':
        return {
          label: 'Regulador Presión',
          variant: 'amber',
          icon: <Gauge className="w-3.5 h-3.5 text-amber-600" />,
        };
      case 'GAS_CYLINDER':
        return {
          label: 'Cilindro / Envase',
          variant: 'emerald',
          icon: <Activity className="w-3.5 h-3.5 text-emerald-600" />,
        };
      case 'PANEL_ALARMA':
        return {
          label: 'Panel de Alarma',
          variant: 'rose',
          icon: <Activity className="w-3.5 h-3.5 text-rose-600" />,
        };
      case 'POLIDUCTO':
        return {
          label: 'Poliducto / Cabecera',
          variant: 'indigo',
          icon: <Activity className="w-3.5 h-3.5 text-indigo-600" />,
        };
      case 'COMPRESOR':
        return {
          label: 'Compresor / Central',
          variant: 'amber',
          icon: <Gauge className="w-3.5 h-3.5 text-amber-600" />,
        };
      default:
        return {
          label: type,
          variant: 'slate',
          icon: <Activity className="w-3.5 h-3.5 text-slate-600" />,
        };
    }
  };

  if (loading) {
    return (
      <Card className="p-8 text-center flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-500">Cargando jerarquía hospitalaria...</p>
      </Card>
    );
  }

  if (!hospitals || hospitals.length === 0) {
    return (
      <Card className="p-8 text-center flex flex-col items-center justify-center gap-2">
        <Building2 className="w-9 h-9 text-slate-400 mb-1" />
        <h3 className="text-base font-bold text-slate-800">No hay datos hospitalarios</h3>
        <p className="text-xs sm:text-sm text-slate-500 max-w-sm">
          Verifique que el backend esté ejecutándose con el script seed de datos cargado.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Selector de Hospital */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          1. Centro Hospitalario
        </span>
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin">
          {hospitals.map((h) => {
            const isSelected = h.id === activeHospital?.id;
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => {
                  setSelectedHospitalId(h.id);
                  if (h.sectors.length > 0) {
                    setSelectedSectorId(h.sectors[0].id);
                  }
                }}
                className={`inline-flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border-1.5 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer select-none ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                    : 'bg-white text-slate-800 border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                }`}
              >
                <Building2 className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-blue-600'}`} />
                <span>{h.name}</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
                >
                  {h.code}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Selector de Sectores */}
      {activeHospital && activeHospital.sectors.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            2. Sector / Servicio Clínico
          </span>
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin">
            {activeHospital.sectors.map((s) => {
              const isSelected = s.id === activeSector?.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSectorId(s.id)}
                  className={`inline-flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border-1.5 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer select-none ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                      : 'bg-white text-slate-800 border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                  }`}
                >
                  <Layers className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-indigo-600'}`} />
                  <div className="text-left">
                    <div>{s.name}</div>
                    {s.floor_level && (
                      <div className={`text-[11px] font-normal ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                        {s.floor_level}
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    }`}
                  >
                    {s.assets.length} activos
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Lista de Activos del Sector */}
      <div className="flex flex-col gap-2.5">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          3. Activos Disponibles en {activeSector?.name || 'el sector'} ({activeSector?.assets.length || 0})
        </span>

        {!activeSector || activeSector.assets.length === 0 ? (
          <Card className="p-6 text-center text-slate-500 text-sm">
            No hay activos registrados en este sector clínico.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeSector.assets.map((asset) => {
              const isSelected = selectedAsset?.id === asset.id;
              const typeInfo = getAssetTypeBadge(asset.asset_type);

              return (
                <div
                  key={asset.id}
                  onClick={() => onSelectAsset(asset)}
                  className={`p-4 rounded-2xl border-1.5 transition-all flex flex-col justify-between gap-3 cursor-pointer select-none ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/50 shadow-sm ring-2 ring-blue-100'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <Badge label={typeInfo.label} variant={typeInfo.variant} icon={typeInfo.icon} size="sm" />
                    <Badge label={asset.tag_code} variant="slate" size="sm" />
                  </div>

                  <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">{asset.name}</h4>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs text-slate-500 font-medium">Operativo en línea</span>
                    </div>

                    <Button
                      title="Auditar / Inspeccionar"
                      size="sm"
                      variant={isSelected ? 'primary' : 'outline'}
                      icon={<PlayCircle className="w-3.5 h-3.5" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartInspection(asset);
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
