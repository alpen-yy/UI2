import type { ReactNode } from 'react'
import { DIMS, type Dim } from './data'

export const Icon = ({ d, className = 'w-5 h-5' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)
export const P = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4-4',
  x: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  pin: 'M12 17v5M9 3h6l-1 7 3 3H7l3-3z',
  archive: 'M4 7h16v3H4zM6 10v9h12v-9M10 14h4',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v5H5V6h5',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5',
  check: 'M5 12l5 5 9-10',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
}

export const Chip = ({ dim, children, onRemove }: { dim: Dim; children: ReactNode; onRemove?: () => void }) => (
  <span className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[12px] font-medium ${DIMS[dim].chip}`}>
    {children}
    {onRemove && (
      <button onClick={onRemove} aria-label="移除标签" className="-mr-1 w-4 h-4 grid place-items-center rounded-full hover:bg-black/10">
        <Icon d={P.x} className="w-3 h-3" />
      </button>
    )}
  </span>
)

export const Btn = ({
  children,
  onClick,
  kind = 'text',
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  kind?: 'primary' | 'text' | 'outline' | 'danger'
  disabled?: boolean
}) => {
  const k = {
    primary: 'bg-g-blue text-white hover:bg-g-blue-dark hover:shadow-sm',
    text: 'text-g-blue hover:bg-g-tint',
    outline: 'text-g-blue border border-g-line hover:bg-g-tint',
    danger: 'bg-g-red text-white hover:opacity-90',
  }[kind]
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`h-9 px-4 rounded-full text-[14px] font-medium inline-flex items-center gap-1.5 transition disabled:opacity-40 ${k}`}
    >
      {children}
    </button>
  )
}

export const Switch = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={() => onChange(!on)}
    className={`relative w-9 h-5 rounded-full transition ${on ? 'bg-g-blue' : 'bg-g-mute'}`}
  >
    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
  </button>
)
