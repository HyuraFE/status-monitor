import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendDiscordAlert } from "@/lib/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Monitor {
  id: string;
  name: string;
  url: string;
}

export async function GET(req: NextRequest) {
  // Verifikasi Vercel Cron Secret (opsional di local/dev)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ambil daftar target monitor dari Supabase
  const { data: monitors, error: fetchErr } = await supabase
    .from("monitors")
    .select("id, name, url");

  if (fetchErr || !monitors) {
    return NextResponse.json({ error: "Failed to fetch monitors" }, { status: 500 });
  }

  const results = await Promise.all(
    monitors.map(async (m: Monitor) => {
      const start = performance.now();
      let statusCode = 0;
      let isUp = false;
      let errorMsg = "";

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(m.url, {
          method: "GET",
          headers: { "User-Agent": "Pylexia-Uptime-Bot/1.0" },
          signal: controller.signal,
          cache: "no-store",
        });

        clearTimeout(timeout);
        statusCode = res.status;
        // Status 2xx, 3xx, atau 404 (route terlindungi Clerk) dianggap UP/server hidup
        isUp = (statusCode >= 200 && statusCode < 400) || statusCode === 404;
      } catch (err: any) {
        errorMsg = err.name === "AbortError" ? "Request Timeout (>10s)" : (err.message || "Fetch Failed");
        isUp = false;
      }

      const latency = Math.round(performance.now() - start);

      // Simpan log ke Supabase
      await supabase.from("heartbeats").insert({
        monitor_id: m.id,
        status_code: statusCode,
        latency_ms: latency,
        is_up: isUp,
      });

      // Kirim alert jika service down
      if (!isUp) {
        await sendDiscordAlert({
          monitorName: m.name,
          url: m.url,
          statusCode,
          error: errorMsg,
        });
      }

      return {
        id: m.id,
        name: m.name,
        isUp,
        statusCode,
        latency,
      };
    })
  );

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    checked: results.length,
    results,
  });
}
