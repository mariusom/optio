import type { Html, HtmlBuilder } from "foldkit/html";
import type { IconNode } from "lucide";

import { icon as lucideIcon } from "@/lib/icons";

export {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  CodeXml,
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
  Settings2,
  Star,
  Timer,
  Trash2,
  TriangleAlert,
  X,
} from "lucide";

/**
 * App icon: a lucide node rendered as Foldkit VDOM. Decorative by default
 * (aria-hidden); pair with visible text or an aria-label on the control.
 */
export const icon = <M>(h: HtmlBuilder<M>, node: IconNode, className = "size-5 shrink-0"): Html =>
  lucideIcon(h, node, className);
