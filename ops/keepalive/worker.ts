// 일시정지 방지 핑.
// Supabase Free 는 7일 동안 활동이 없으면 프로젝트를 멈추고, 멈추면 발행된 청첩장이 안 열린다.
// get_invitation RPC 는 Postgres 를 실제로 태우므로 활동으로 잡힌다. 없는 id 라 결과는 null 이다.
// 설계: docs/superpowers/specs/2026-09-08-auth-server-storage-design.md §8-③

type Ping =
  | { ok: true; status: number }
  | { ok: false; error: 'HTTP' | 'NETWORK'; detail: string };

async function ping(env: Env): Promise<Ping> {
  try {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_invitation`, {
      method: 'POST',
      headers: { apikey: env.SUPABASE_ANON_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ p_id: 'keepalive' }),
    });
    if (!res.ok) return { ok: false, error: 'HTTP', detail: `${res.status} ${await res.text()}` };
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, error: 'NETWORK', detail: String(e) };
  }
}

export default {
  async scheduled(controller, env) {
    const r = await ping(env);
    console.log(JSON.stringify({ cron: controller.cron, ...r }));
    // 실패는 던진다. 그래야 대시보드의 크론 실행 기록이 에러로 남는다.
    if (!r.ok) throw new Error(`keepalive ${r.error}: ${r.detail}`);
  },
} satisfies ExportedHandler<Env>;
