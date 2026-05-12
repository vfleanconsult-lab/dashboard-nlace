import { useState, useEffect } from 'react'
import { Lock, LockOpen } from 'lucide-react'

const LS_FROZEN_KEY    = 'forecast_frozen'
const LS_FROZEN_AT_KEY = 'forecast_frozen_at'

interface Props {
  onFreezeChange: (frozen: boolean) => void
}

function formatFreezeDate(d: Date): string {
  const date = d.toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
  const time = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
  return `${date} ${time}`
}

export default function ForecastFreezeToggle({ onFreezeChange }: Props) {
  const [isFrozen, setIsFrozen] = useState<boolean>(() =>
    localStorage.getItem(LS_FROZEN_KEY) === 'true'
  )
  const [frozenAt, setFrozenAt] = useState<Date | null>(() => {
    const stored = localStorage.getItem(LS_FROZEN_AT_KEY)
    return stored ? new Date(stored) : null
  })
  const [modal, setModal] = useState<false | 'freeze' | 'unfreeze'>(false)

  useEffect(() => {
    onFreezeChange(isFrozen)
  }, [isFrozen, onFreezeChange])

  const requestToggle = () => setModal(isFrozen ? 'unfreeze' : 'freeze')

  const confirm = () => {
    if (modal === 'freeze') {
      const now = new Date()
      localStorage.setItem(LS_FROZEN_KEY, 'true')
      localStorage.setItem(LS_FROZEN_AT_KEY, now.toISOString())
      setIsFrozen(true)
      setFrozenAt(now)
    } else {
      localStorage.removeItem(LS_FROZEN_KEY)
      localStorage.removeItem(LS_FROZEN_AT_KEY)
      setIsFrozen(false)
      setFrozenAt(null)
    }
    setModal(false)
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={requestToggle}
          className={[
            'flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-[12px] font-body font-medium transition-colors',
            isFrozen
              ? 'bg-nl-danger/10 text-nl-danger hover:bg-nl-danger/20'
              : 'bg-nl-success-dark/10 text-nl-success-dark hover:bg-nl-success-dark/20',
          ].join(' ')}
        >
          {isFrozen ? <Lock size={14} /> : <LockOpen size={14} />}
          {isFrozen ? 'Forecast Congelado' : 'Forecast Activo'}
        </button>

        {isFrozen && frozenAt && (
          <span className="text-[10px] font-body tabular-nums text-nl-400">
            Congelado desde: {formatFreezeDate(frozenAt)}
          </span>
        )}
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-nl-text/20 backdrop-blur-[2px]"
          onClick={() => setModal(false)}
        >
          <div
            className="bg-nl-white rounded-[16px] border border-nl-border-soft shadow-2xl p-6 max-w-sm w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              {modal === 'freeze'
                ? <Lock size={18} className="text-nl-danger shrink-0" />
                : <LockOpen size={18} className="text-nl-primary shrink-0" />}
              <h3 className="font-display font-bold text-[14px] text-nl-text">
                {modal === 'freeze' ? '¿Congelar el forecast?' : '¿Descongelar el forecast?'}
              </h3>
            </div>

            <p className="text-[12px] font-body text-nl-500 mb-6 leading-relaxed">
              {modal === 'freeze'
                ? '¿Seguro que deseas congelar el forecast? No podrás editar hasta que lo descongeles manualmente.'
                : '¿Seguro que deseas descongelar el forecast? Los datos quedarán disponibles para edición.'}
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setModal(false)}
                className="px-4 py-2 rounded-[8px] text-[12px] font-body text-nl-500 hover:bg-nl-bg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirm}
                className={[
                  'px-4 py-2 rounded-[8px] text-[12px] font-body font-medium text-white transition-colors',
                  modal === 'freeze'
                    ? 'bg-nl-danger hover:bg-nl-danger/90'
                    : 'bg-nl-primary hover:bg-nl-primary/90',
                ].join(' ')}
              >
                {modal === 'freeze' ? 'Congelar' : 'Descongelar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
