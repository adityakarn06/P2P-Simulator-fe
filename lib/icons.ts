// Central icon re-export.
//
// Never import from "@hugeicons/core-free-icons" directly — that package's
// index is a barrel re-exporting ~6,000 individual icon modules. Importing a
// single named icon from it still pulls the whole module graph into the dev
// module registry, which grows the browser's JS heap on every HMR update.
//
// Deep-import each icon from its own module instead, and add new icons here
// as they're needed. See node_modules/next/dist/docs/01-app/02-guides/local-development.md
// ("Icon libraries" / "Barrel files") for background.
export { default as ActivityIcon } from "@hugeicons/core-free-icons/Activity01Icon";
export { default as Add01Icon } from "@hugeicons/core-free-icons/Add01Icon";
export { default as Alert01Icon } from "@hugeicons/core-free-icons/Alert01Icon";
export { default as Alert02Icon } from "@hugeicons/core-free-icons/Alert02Icon";
export { default as ArrowDown01Icon } from "@hugeicons/core-free-icons/ArrowDown01Icon";
export { default as ArrowLeft01Icon } from "@hugeicons/core-free-icons/ArrowLeft01Icon";
export { default as ArrowRight01Icon } from "@hugeicons/core-free-icons/ArrowRight01Icon";
export { default as ArrowUp01Icon } from "@hugeicons/core-free-icons/ArrowUp01Icon";
export { default as ArrowUpRight01Icon } from "@hugeicons/core-free-icons/ArrowUpRight01Icon";
export { default as AiSparklesIcon } from "@hugeicons/core-free-icons/AiSparklesIcon";
export { default as Cancel01Icon } from "@hugeicons/core-free-icons/Cancel01Icon";
export { default as CheckmarkCircle02Icon } from "@hugeicons/core-free-icons/CheckmarkCircle02Icon";
export { default as CommandIcon } from "@hugeicons/core-free-icons/CommandIcon";
export { default as CpuIcon } from "@hugeicons/core-free-icons/CpuIcon";
export { default as CreditCardIcon } from "@hugeicons/core-free-icons/CreditCardIcon";
export { default as DashboardSquare01Icon } from "@hugeicons/core-free-icons/DashboardSquare01Icon";
export { default as File01Icon } from "@hugeicons/core-free-icons/File01Icon";
export { default as FileEditIcon } from "@hugeicons/core-free-icons/FileEditIcon";
export { default as HelpCircleIcon } from "@hugeicons/core-free-icons/HelpCircleIcon";
export { default as Home01Icon } from "@hugeicons/core-free-icons/Home01Icon";
export { default as InboxIcon } from "@hugeicons/core-free-icons/InboxIcon";
export { default as InformationCircleIcon } from "@hugeicons/core-free-icons/InformationCircleIcon";
export { default as Invoice01Icon } from "@hugeicons/core-free-icons/Invoice01Icon";
export { default as Loading02Icon } from "@hugeicons/core-free-icons/Loading02Icon";
export { default as Loading03Icon } from "@hugeicons/core-free-icons/Loading03Icon";
export { default as Logout01Icon } from "@hugeicons/core-free-icons/Logout01Icon";
export { default as MoreHorizontalCircle01Icon } from "@hugeicons/core-free-icons/MoreHorizontalCircle01Icon";
export { default as MoreVerticalCircle01Icon } from "@hugeicons/core-free-icons/MoreVerticalCircle01Icon";
export { default as MultiplicationSignCircleIcon } from "@hugeicons/core-free-icons/MultiplicationSignCircleIcon";
export { default as Notification03Icon } from "@hugeicons/core-free-icons/Notification03Icon";
export { default as PackageIcon } from "@hugeicons/core-free-icons/PackageIcon";
export { default as PlusSignCircleIcon } from "@hugeicons/core-free-icons/PlusSignCircleIcon";
export { default as ReceiptIcon } from "@hugeicons/core-free-icons/ReceiptIcon";
export { default as RefreshIcon } from "@hugeicons/core-free-icons/RefreshIcon";
export { default as Settings05Icon } from "@hugeicons/core-free-icons/Settings05Icon";
export { default as ShoppingCart01Icon } from "@hugeicons/core-free-icons/ShoppingCart01Icon";
export { default as SidebarLeftIcon } from "@hugeicons/core-free-icons/SidebarLeftIcon";
export { default as Tick02Icon } from "@hugeicons/core-free-icons/Tick02Icon";
export { default as TickDouble01Icon } from "@hugeicons/core-free-icons/TickDouble01Icon";
export { default as UnfoldMoreIcon } from "@hugeicons/core-free-icons/UnfoldMoreIcon";
export { default as UserCircle02Icon } from "@hugeicons/core-free-icons/UserCircle02Icon";
export { default as Wifi01Icon } from "@hugeicons/core-free-icons/Wifi01Icon";
