import {
  ArrowDown,
  ArrowUp,
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
  Minus,
  Pencil,
  Play,
  Plus,
  Settings2,
  Star,
  Timer,
  Trash2,
  TriangleAlert,
  X,
  type IconNode,
} from "lucide";
import Alert01Icon from "@hugeicons/core-free-icons/Alert01Icon";
import AlertCircleIcon from "@hugeicons/core-free-icons/AlertCircleIcon";
import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon";
import ArrowUp01Icon from "@hugeicons/core-free-icons/ArrowUp01Icon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import ChevronDownIcon from "@hugeicons/core-free-icons/ChevronDownIcon";
import ChevronLeftIcon from "@hugeicons/core-free-icons/ChevronLeftIcon";
import ChevronRightIcon from "@hugeicons/core-free-icons/ChevronRightIcon";
import Clock01Icon from "@hugeicons/core-free-icons/Clock01Icon";
import Copy01Icon from "@hugeicons/core-free-icons/Copy01Icon";
import Delete02Icon from "@hugeicons/core-free-icons/Delete02Icon";
import Download01Icon from "@hugeicons/core-free-icons/Download01Icon";
import Edit02Icon from "@hugeicons/core-free-icons/Edit02Icon";
import StarIcon from "@hugeicons/core-free-icons/StarIcon";
import File01Icon from "@hugeicons/core-free-icons/File01Icon";
import HistoryIcon from "@hugeicons/core-free-icons/HistoryIcon";
import InformationCircleIcon from "@hugeicons/core-free-icons/InformationCircleIcon";
import LayoutTemplateIcon from "@hugeicons/core-free-icons/LayoutTemplateIcon";
import MinusSignIcon from "@hugeicons/core-free-icons/MinusSignIcon";
import MoreHorizontalIcon from "@hugeicons/core-free-icons/MoreHorizontalIcon";
import PlayIcon from "@hugeicons/core-free-icons/PlayIcon";
import PlusSignIcon from "@hugeicons/core-free-icons/PlusSignIcon";
import Settings02Icon from "@hugeicons/core-free-icons/Settings02Icon";
import Task01Icon from "@hugeicons/core-free-icons/Task01Icon";
import TaskRemove01Icon from "@hugeicons/core-free-icons/TaskRemove01Icon";
import Tick02Icon from "@hugeicons/core-free-icons/Tick02Icon";
import Timer01Icon from "@hugeicons/core-free-icons/Timer01Icon";

export type HugeIconNode = ReadonlyArray<
  readonly [string, Readonly<Record<string, string | number>>]
>;

let currentIconLibrary: "lucide" | "hugeicons" = "hugeicons";

/**
 * Equivalent free Hugeicons for every Lucide glyph currently used by Optio.
 * Unknown/new Lucide nodes intentionally fall back to Lucide instead of rendering
 * a misleading glyph; add them here when adding an app icon.
 */
const hugeiconsByLucideNode = new Map<IconNode, HugeIconNode>([
  [ArrowDown, ArrowDown01Icon],
  [ArrowUp, ArrowUp01Icon],
  [Check, Tick02Icon],
  [ChevronDown, ChevronDownIcon],
  [ChevronLeft, ChevronLeftIcon],
  [ChevronRight, ChevronRightIcon],
  [CircleAlert, AlertCircleIcon],
  [Clock, Clock01Icon],
  [Copy, Copy01Icon],
  [Download, Download01Icon],
  [Ellipsis, MoreHorizontalIcon],
  [FileText, File01Icon],
  [History, HistoryIcon],
  [Info, InformationCircleIcon],
  [LayoutTemplate, LayoutTemplateIcon],
  [List, Task01Icon],
  [ListX, TaskRemove01Icon],
  [Minus, MinusSignIcon],
  [Pencil, Edit02Icon],
  [Play, PlayIcon],
  [Plus, PlusSignIcon],
  [Settings2, Settings02Icon],
  [Star, StarIcon],
  [Timer, Timer01Icon],
  [Trash2, Delete02Icon],
  [TriangleAlert, Alert01Icon],
  [X, Cancel01Icon],
]);

export const setCurrentIconLibrary = (library: "lucide" | "hugeicons") => {
  currentIconLibrary = library;
};

export const iconNodeForCurrentLibrary = (node: IconNode): IconNode | HugeIconNode =>
  currentIconLibrary === "hugeicons" ? (hugeiconsByLucideNode.get(node) ?? node) : node;
