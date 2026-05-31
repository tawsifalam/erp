import { chakra, type HTMLChakraProps } from "@chakra-ui/react";
import type { ReactElement, ReactNode } from "react";

type SidebarIconProps = HTMLChakraProps<"svg">;

const defaultIconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  boxSize: "1.125rem",
  flexShrink: 0,
} as const;

function SidebarIcon({ children, ...props }: SidebarIconProps & { children: ReactNode }) {
  return (
    <chakra.svg {...defaultIconProps} {...props}>
      {children}
    </chakra.svg>
  );
}

export const DashboardIcon = (props: SidebarIconProps) => (
  <SidebarIcon {...props}>
    <path
      d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"
      stroke="none"
      fill="currentColor"
    />
  </SidebarIcon>
);

export const BuildingIcon = (props: SidebarIconProps) => (
  <SidebarIcon {...props}>
    <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 9h.01M15 9h.01M9 13h.01M15 13h.01" />
  </SidebarIcon>
);

export const UtensilsIcon = (props: SidebarIconProps) => (
  <SidebarIcon {...props}>
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3v7" />
  </SidebarIcon>
);

export const ChefHatIcon = (props: SidebarIconProps) => (
  <SidebarIcon {...props}>
    <path d="M6 13c0-3.3 2.7-6 6-6 2.2 0 4.1 1.2 5.2 3M12 7V3M6 21h12M6 13v8h12v-8" />
  </SidebarIcon>
);

export const PackageIcon = (props: SidebarIconProps) => (
  <SidebarIcon {...props}>
    <path d="M16.5 9.4 7.55 4.24M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.3 7l8.7 5 8.7-5M12 22V12" />
  </SidebarIcon>
);

export const LedgerIcon = (props: SidebarIconProps) => (
  <SidebarIcon {...props}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </SidebarIcon>
);

export const UsersIcon = (props: SidebarIconProps) => (
  <SidebarIcon {...props}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </SidebarIcon>
);

export const ChartIcon = (props: SidebarIconProps) => (
  <SidebarIcon {...props}>
    <path d="M3 3v18h18M7 16l4-4 4 4 5-6" />
  </SidebarIcon>
);

export const SettingsIcon = (props: SidebarIconProps) => (
  <SidebarIcon {...props}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </SidebarIcon>
);

export const ChevronDownIcon = (props: SidebarIconProps) => (
  <SidebarIcon {...props}>
    <path d="m6 9 6 6 6-6" />
  </SidebarIcon>
);

export const ChevronLeftIcon = (props: SidebarIconProps) => (
  <SidebarIcon {...props}>
    <path d="m15 18-6-6 6-6" />
  </SidebarIcon>
);

export const ChevronRightIcon = (props: SidebarIconProps) => (
  <SidebarIcon {...props}>
    <path d="m9 18 6-6-6-6" />
  </SidebarIcon>
);

export const LogOutIcon = (props: SidebarIconProps) => (
  <SidebarIcon {...props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </SidebarIcon>
);

export type SidebarIconComponent = (props: SidebarIconProps) => ReactElement;
