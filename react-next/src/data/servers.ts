import { Gamepad2, Tv, Flame, Cpu, Joystick, Globe } from "lucide-react";

export type Status = "online" | "degraded" | "offline";

export interface ServerService {
  id: string;
  name: string;
  icon: string; // lucide icon name
  status: Status;
  uptime: number; // percentage
  latency?: number;
  metricLabel?: string;
  trendLabel?: string;
  trendValueLabel?: string;
  lastIncident?: string;
  // 30-day uptime data (1 = up, 0.5 = degraded, 0 = down)
  uptimeHistory: number[];
  // Response time history (last 24 data points)
  responseHistory: number[];
  // Incidents
  incidents: {
    date: string;
    title: string;
    description: string;
    status: Status;
    duration: string;
  }[];
  // Services breakdown
  services: {
    name: string;
    status: Status;
  }[];
}

export const servers: ServerService[] = [
  {
    id: "overwatch-2",
    name: "Overwatch 2",
    icon: "Gamepad2",
    status: "online",
    uptime: 99.94,
    latency: 24,
    lastIncident: "Feb 18 — Login queue issues resolved",
    uptimeHistory: [1,1,1,1,1,1,1,1,0.5,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    responseHistory: [22,25,23,28,24,21,26,30,45,32,24,22,21,23,25,24,22,26,24,23,21,25,24,22],
    incidents: [
      { date: "Feb 18", title: "Login queue issues", description: "Players experienced extended queue times during peak hours. Issue was resolved by scaling authentication servers.", status: "degraded", duration: "2h 15m" },
      { date: "Feb 10", title: "Match server outage", description: "Competitive matches were temporarily unavailable in EU region.", status: "offline", duration: "45m" },
      { date: "Jan 28", title: "Patch deployment delay", description: "Scheduled maintenance extended due to deployment issues.", status: "degraded", duration: "1h 30m" },
    ],
    services: [
      { name: "Game Servers", status: "online" },
      { name: "Authentication", status: "online" },
      { name: "Matchmaking", status: "online" },
      { name: "Shop & Store", status: "online" },
    ],
  },
  {
    id: "playstation-network",
    name: "PlayStation Network",
    icon: "Tv",
    status: "degraded",
    uptime: 98.7,
    latency: 89,
    lastIncident: "Feb 22 — Store loading slowly",
    uptimeHistory: [1,1,1,0.5,1,1,1,1,1,0.5,0.5,1,1,1,1,0,1,1,1,1,0.5,1,1,1,1,1,1,1,0.5,0.5],
    responseHistory: [45,52,48,120,65,55,50,48,52,110,95,60,55,50,48,55,52,48,65,72,89,95,88,89],
    incidents: [
      { date: "Feb 22", title: "Store loading slowly", description: "PS Store experiencing increased load times. Team is investigating CDN issues.", status: "degraded", duration: "Ongoing" },
      { date: "Feb 16", title: "Sign-in failures", description: "Some users unable to sign into PSN accounts. Fixed by restarting auth cluster.", status: "offline", duration: "3h 20m" },
    ],
    services: [
      { name: "Gaming & Social", status: "online" },
      { name: "Account Management", status: "online" },
      { name: "PlayStation Store", status: "degraded" },
      { name: "PlayStation Video", status: "online" },
    ],
  },
  {
    id: "steam",
    name: "Steam",
    icon: "Flame",
    status: "online",
    uptime: 99.98,
    latency: 12,
    uptimeHistory: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    responseHistory: [11,12,13,12,11,14,12,11,13,12,11,12,13,11,12,14,12,11,13,12,11,12,13,12],
    incidents: [],
    services: [
      { name: "Store", status: "online" },
      { name: "Community", status: "online" },
      { name: "Game Servers", status: "online" },
      { name: "Steam Client", status: "online" },
    ],
  },
  {
    id: "xbox-live",
    name: "Xbox Live",
    icon: "Joystick",
    status: "online",
    uptime: 99.91,
    latency: 31,
    lastIncident: "Feb 12 — Party chat resolved",
    uptimeHistory: [1,1,1,1,1,1,1,1,1,1,0.5,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    responseHistory: [28,32,30,29,35,31,28,30,32,31,45,35,30,29,31,32,28,30,31,29,32,30,31,31],
    incidents: [
      { date: "Feb 12", title: "Party chat issues", description: "Voice chat in parties was intermittently failing. Resolved via server-side fix.", status: "degraded", duration: "1h 45m" },
    ],
    services: [
      { name: "Sign-in", status: "online" },
      { name: "Multiplayer", status: "online" },
      { name: "Cloud Gaming", status: "online" },
      { name: "Store", status: "online" },
    ],
  },
  {
    id: "epic-games",
    name: "Epic Games",
    icon: "Cpu",
    status: "offline",
    uptime: 95.2,
    latency: undefined,
    lastIncident: "Feb 22 — Servers unreachable",
    uptimeHistory: [1,1,1,1,0.5,1,1,0,0,1,1,1,1,0.5,1,1,1,1,1,0,1,1,1,1,1,1,1,1,0,0],
    responseHistory: [35,38,42,40,85,45,38,0,0,42,38,35,40,75,42,38,36,40,38,0,42,38,35,0],
    incidents: [
      { date: "Feb 22", title: "Servers unreachable", description: "All Epic Games services are currently down. Engineers are working to restore service.", status: "offline", duration: "Ongoing" },
      { date: "Feb 19", title: "Fortnite matchmaking", description: "Fortnite matchmaking experiencing high failure rates.", status: "offline", duration: "4h 10m" },
      { date: "Feb 14", title: "Store purchase errors", description: "Users unable to complete purchases in the Epic Store.", status: "degraded", duration: "2h" },
    ],
    services: [
      { name: "Epic Store", status: "offline" },
      { name: "Fortnite", status: "offline" },
      { name: "Authentication", status: "offline" },
      { name: "Social Features", status: "offline" },
    ],
  },
  {
    id: "riot-games",
    name: "Riot Games",
    icon: "Globe",
    status: "online",
    uptime: 99.85,
    latency: 18,
    uptimeHistory: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,0.5,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    responseHistory: [16,18,17,19,18,16,20,18,17,16,18,19,17,18,35,22,18,17,16,18,19,17,18,18],
    incidents: [
      { date: "Feb 14", title: "Valorant ranked queue", description: "Ranked queue temporarily disabled for maintenance.", status: "degraded", duration: "55m" },
    ],
    services: [
      { name: "Valorant", status: "online" },
      { name: "League of Legends", status: "online" },
      { name: "Riot Client", status: "online" },
      { name: "Riot Account", status: "online" },
    ],
  },
];

export const getIconComponent = (iconName: string) => {
  const icons: Record<string, any> = { Gamepad2, Tv, Flame, Cpu, Joystick, Globe };
  return icons[iconName] || Globe;
};
