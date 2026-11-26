import type { H } from "@/lib/view";
import type { IconNode } from "lucide";

import { icon as lucideIcon } from "@/lib/icons";

export {
  ArrowDown,
  ArrowUp,
  ChartBar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  Copy,
  Download,
  Ellipsis,
  FileText,
  History,
  Info,
  LayoutTemplate,
  List,
  ListX,
  Pencil,
  Play,
  Plus,
  Search,
  Settings2,
  Star,
  Timer,
  Trash2,
  TriangleAlert,
  X,
} from "lucide";

/**
 * App icon: a lucide node rendered as Effect UI elements. Decorative by default
 * (aria-hidden); pair with visible text or an aria-label on the control.
 */
export const icon = <M>(h: H<M>, node: IconNode, className = "size-5 shrink-0") =>
  lucideIcon(h, node, className);
