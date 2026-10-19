import {
  IconCalendarCheck,
  IconChecklist,
  IconRepeat,
  IconTarget,
  IconSunHigh,
  IconUser,
  IconUsers,
  type Icon,
} from "@tabler/icons-react"

import type { NavIconName } from "@/config/navigation"

/** `Record` makes TypeScript fail here when a name is added to `NavIconName` without an icon. */
const NAV_ICONS: Record<NavIconName, Icon> = {
  today: IconSunHigh,
  habits: IconRepeat,
  tasks: IconChecklist,
  goals: IconTarget,
  review: IconCalendarCheck,
  account: IconUser,
  members: IconUsers,
}

export function NavIcon({ name }: { name: NavIconName }) {
  const Component = NAV_ICONS[name]
  return <Component aria-hidden className="size-4 shrink-0" />
}
