import {
  Lock,
  ScrollText,
  BookMarked,
  Globe,
  LineChart,
  Leaf,
  Atom,
  Calculator,
  Newspaper,
  FileText,
  PenLine,
  Star,
  Mic,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type CategoryIconConfig = {
  Icon: LucideIcon
  /** Overlay text for numbered GS papers */
  overlay?: string
}

const ICON_MAP: Record<string, CategoryIconConfig> = {
  PERSONAL: { Icon: Lock },
  PRELIMS_POLITY: { Icon: ScrollText },
  PRELIMS_HISTORY: { Icon: BookMarked },
  PRELIMS_GEOGRAPHY: { Icon: Globe },
  PRELIMS_ECONOMY: { Icon: LineChart },
  PRELIMS_ENVIRONMENT: { Icon: Leaf },
  PRELIMS_SCI_TECH: { Icon: Atom },
  PRELIMS_CSAT: { Icon: Calculator },
  PRELIMS_CURRENT_AFFAIRS: { Icon: Newspaper },
  MAINS_GS1: { Icon: FileText, overlay: '1' },
  MAINS_GS2: { Icon: FileText, overlay: '2' },
  MAINS_GS3: { Icon: FileText, overlay: '3' },
  MAINS_GS4: { Icon: FileText, overlay: '4' },
  MAINS_ESSAY: { Icon: PenLine },
  MAINS_OPTIONAL: { Icon: Star },
  INTERVIEW: { Icon: Mic },
  SHARED_WITH_MENTOR: { Icon: Users },
}

const DEFAULT_CONFIG: CategoryIconConfig = { Icon: FileText }

export function getCategoryIcon(category: string): CategoryIconConfig {
  return ICON_MAP[category] ?? DEFAULT_CONFIG
}

interface CategoryIconBadgeProps {
  category: string
  /** diameter of the circle, default 32 */
  size?: number
}

export function CategoryIconBadge({ category, size = 32 }: CategoryIconBadgeProps) {
  const { Icon, overlay } = getCategoryIcon(category)
  const iconSize = Math.round(size * 0.5)

  return (
    <div
      className="relative flex flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Icon size={iconSize} strokeWidth={1.75} />
      {overlay && (
        <span
          className="absolute bottom-0 right-0 flex items-center justify-center rounded-full bg-blue-700 text-white"
          style={{ width: size * 0.38, height: size * 0.38, fontSize: size * 0.22 }}
        >
          {overlay}
        </span>
      )}
    </div>
  )
}
