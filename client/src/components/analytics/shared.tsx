import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  BarChart,
  Bar
} from "recharts";

interface HeaderProps {
  title: string;
  preset: "7d" | "30d" | "90d";
  setPreset: (p: "7d" | "30d" | "90d") => void;
}

export function Header({ title, preset, setPreset }: HeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="inline-flex rounded-xl border p-1 gap-1">
        {(["7d", "30d", "90d"] as const).map(p => (
          <Button
            key={p}
            size="sm"
            variant={preset === p ? "default" : "secondary"}
            onClick={() => setPreset(p)}
            className="rounded-lg"
            data-testid={`button-range-${p}`}
          >
            {p.toUpperCase()}
          </Button>
        ))}
      </div>
    </div>
  );
}

interface KpisProps {
  k: any;
  map: [string, string][];
  loading?: boolean;
}

export function Kpis({ k, map, loading }: KpisProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {map.map(([label, key]) => (
        <Card key={key} className="p-4" data-testid={`kpi-${key}`}>
          <div className="text-xs text-muted-foreground">{label}</div>
          {loading ? (
            <div className="text-sm text-muted-foreground mt-1">Loading...</div>
          ) : (
            <div className="text-2xl font-semibold">
              {Number(k?.[key] || 0).toLocaleString()}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

interface KpisMoneyProps {
  k: any;
  loading?: boolean;
}

export function KpisMoney({ k, loading }: KpisMoneyProps) {
  const money = (c: number) => `$${(c / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <Card className="p-4" data-testid="kpi-revenue">
        <div className="text-xs text-muted-foreground">Revenue</div>
        {loading ? (
          <div className="text-sm text-muted-foreground mt-1">Loading...</div>
        ) : (
          <div className="text-2xl font-semibold">{money(Number(k?.revenue || 0))}</div>
        )}
      </Card>
      <Card className="p-4" data-testid="kpi-orders">
        <div className="text-xs text-muted-foreground">Orders</div>
        {loading ? (
          <div className="text-sm text-muted-foreground mt-1">Loading...</div>
        ) : (
          <div className="text-2xl font-semibold">{Number(k?.orders || 0).toLocaleString()}</div>
        )}
      </Card>
      <Card className="p-4" data-testid="kpi-aov">
        <div className="text-xs text-muted-foreground">AOV</div>
        {loading ? (
          <div className="text-sm text-muted-foreground mt-1">Loading...</div>
        ) : (
          <div className="text-2xl font-semibold">{money(Number(k?.aov || 0))}</div>
        )}
      </Card>
      <Card className="p-4" data-testid="kpi-new-customers">
        <div className="text-xs text-muted-foreground">New Customers</div>
        {loading ? (
          <div className="text-sm text-muted-foreground mt-1">Loading...</div>
        ) : (
          <div className="text-2xl font-semibold">{Number(k?.newCustomers || 0).toLocaleString()}</div>
        )}
      </Card>
      <Card className="p-4" data-testid="kpi-repeat-rate">
        <div className="text-xs text-muted-foreground">Repeat Rate</div>
        {loading ? (
          <div className="text-sm text-muted-foreground mt-1">Loading...</div>
        ) : (
          <div className="text-2xl font-semibold">{((Number(k?.repeatRate || 0)) * 100).toFixed(1)}%</div>
        )}
      </Card>
    </div>
  );
}

interface TwoChartsProps {
  barData: any[];
  lineData: any[];
  lineKeys: [string, string][];
  loading?: boolean;
}

export function TwoCharts({ barData, lineData, lineKeys, loading }: TwoChartsProps) {
  return (
    <>
      <Card className="p-4">
        <div className="font-medium mb-2">Posts vs Published</div>
        {loading ? (
          <div className="h-[280px] flex items-center justify-center">
            <div className="text-sm text-muted-foreground">Loading...</div>
          </div>
        ) : barData.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center">
            <div className="text-sm text-muted-foreground">No data available for this period</div>
          </div>
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="posts" fill="#60a5fa" radius={[4, 4, 0, 0]} name="Posts" />
                <Bar dataKey="published" fill="#34d399" radius={[4, 4, 0, 0]} name="Published" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="font-medium mb-2">Engagement Over Time</div>
        {loading ? (
          <div className="h-[280px] flex items-center justify-center">
            <div className="text-sm text-muted-foreground">Loading...</div>
          </div>
        ) : lineData.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center">
            <div className="text-sm text-muted-foreground">No engagement data available</div>
          </div>
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                {lineKeys.map(([key, color]) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    strokeWidth={2}
                    dot={false}
                    name={key.charAt(0).toUpperCase() + key.slice(1)}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </>
  );
}
