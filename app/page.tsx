import { supabase } from "@/lib/supabase";
import { Activity, CheckCircle2, AlertTriangle, ArrowUpRight, ShieldCheck, RefreshCw } from "lucide-react";

export const revalidate = 60; // ISR cache 60 detik

interface MonitorData {
  id: string;
  name: string;
  url: string;
  isUp: boolean;
  lastLatency: number;
  lastChecked: string;
  uptimePercentage: number;
  recentHeartbeats: boolean[];
}

async function getStatusData(): Promise<{
  allUp: boolean;
  monitors: MonitorData[];
  lastUpdated: string;
}> {
  const { data: monitors } = await supabase
    .from("monitors")
    .select("id, name, url");

  if (!monitors || monitors.length === 0) {
    return { allUp: true, monitors: [], lastUpdated: new Date().toISOString() };
  }

  const monitorResults: MonitorData[] = await Promise.all(
    monitors.map(async (m) => {
      const { data: heartbeats } = await supabase
        .from("heartbeats")
        .select("is_up, latency_ms, checked_at")
        .eq("monitor_id", m.id)
        .order("checked_at", { ascending: false })
        .limit(30);

      const beats = heartbeats || [];
      const latest = beats[0];
      const isUp = latest ? latest.is_up : true;
      const lastLatency = latest ? latest.latency_ms : 0;
      const lastChecked = latest ? latest.checked_at : new Date().toISOString();

      const upCount = beats.filter((b) => b.is_up).length;
      const uptimePercentage = beats.length > 0 ? Math.round((upCount / beats.length) * 100) : 100;

      // Urutan kiri ke kanan: lama ke baru
      const recentHeartbeats = [...beats].reverse().map((b) => b.is_up);

      return {
        id: m.id,
        name: m.name,
        url: m.url,
        isUp,
        lastLatency,
        lastChecked,
        uptimePercentage,
        recentHeartbeats,
      };
    })
  );

  const allUp = monitorResults.every((m) => m.isUp);
  return {
    allUp,
    monitors: monitorResults,
    lastUpdated: new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }),
  };
}

export default async function Page() {
  const { allUp, monitors, lastUpdated } = await getStatusData();

  return (
    <main className="flex-1 max-w-3xl w-full mx-auto px-5 py-12 sm:py-16">
      {/* Top Header */}
      <header className="flex items-center justify-between pb-8 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-sm shadow-sky-400/50" />
            <h1 className="text-lg font-bold tracking-tight text-white font-mono">PYLEXIA STATUS</h1>
          </div>
          <p className="text-xs text-slate-400">
            Real-time uptime monitor & network latency
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono bg-slate-900/80 border border-slate-800 px-2.5 py-1 rounded-lg">
          <RefreshCw size={11} className="text-slate-400" />
          <span>{lastUpdated} WIB</span>
        </div>
      </header>

      {/* Global Status Banner */}
      <div className="my-8">
        <div
          className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border transition-all ${
            allUp
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          {allUp ? (
            <CheckCircle2 size={20} className="shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle size={20} className="shrink-0 text-rose-400" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider">
              {allUp ? "Semua Sistem Beroperasi Normal" : "Sebagian Sistem Mengalami Gangguan"}
            </p>
            <p className="text-[11px] opacity-80 mt-0.5">
              {allUp
                ? "Seluruh layanan web dan API merespons dengan waktu respons stabil."
                : "Tim sedang meninjau kendala pada endpoint yang terdampak."}
            </p>
          </div>
        </div>
      </div>

      {/* Service List */}
      <section className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium px-1 mb-2">
          <span>Layanan ({monitors.length})</span>
          <span>Riwayat Uptime (30 Check)</span>
        </div>

        {monitors.map((m) => {
          // Generate bar minimum 30 titik
          const bars = Array.from({ length: 30 }, (_, i) => {
            const hasData = i < m.recentHeartbeats.length;
            if (!hasData) return "empty";
            return m.recentHeartbeats[i] ? "up" : "down";
          });

          return (
            <article
              key={m.id}
              className="group p-4 rounded-xl bg-slate-900/50 hover:bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 transition-all duration-150"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        m.isUp ? "bg-emerald-400 shadow-xs shadow-emerald-400/50" : "bg-rose-400"
                      }`}
                    />
                    <h2 className="text-sm font-semibold text-slate-100 truncate">{m.name}</h2>
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-500 hover:text-sky-400 transition-colors"
                      title="Buka website"
                    >
                      <ArrowUpRight size={13} />
                    </a>
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate pl-4">
                    {m.url.replace("https://", "")}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-medium text-slate-300">
                    {m.uptimePercentage}%
                  </span>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {m.lastLatency > 0 ? `${m.lastLatency}ms` : "-"}
                  </p>
                </div>
              </div>

              {/* Uptime Bar Blocks */}
              <div className="flex items-center gap-[3px] w-full pt-1">
                {bars.map((status, idx) => (
                  <span
                    key={idx}
                    className={`h-4 flex-1 rounded-[2px] transition-all ${
                      status === "up"
                        ? "bg-emerald-500/80 hover:bg-emerald-400"
                        : status === "down"
                        ? "bg-rose-500"
                        : "bg-slate-800/60"
                    }`}
                    title={status === "up" ? "Normal" : status === "down" ? "Outage" : "No data"}
                  />
                ))}
              </div>
            </article>
          );
        })}
      </section>

      {/* Minimal Footer */}
      <footer className="mt-16 pt-6 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-3">
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={13} className="text-sky-400" />
          <span>Vercel Edge Cron & Supabase</span>
        </div>
        <div>
          <a
            href="https://pylexia.fun"
            className="text-slate-400 hover:text-slate-200 transition-colors underline underline-offset-4"
          >
            ← Kembali ke Portofolio
          </a>
        </div>
      </footer>
    </main>
  );
}
