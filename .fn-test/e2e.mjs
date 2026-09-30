const A = 'http://localhost:4201/api', B = 'http://localhost:4202/api';
let token = null, ok = 0, fail = 0;
const today = new Date().toISOString().slice(0, 10);
async function call(base, method, path, body, expect = 200) {
  const t = Date.now();
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json; try { json = JSON.parse(text); } catch { json = text; }
  const pass = r.status === expect;
  pass ? ok++ : fail++;
  console.log(`${pass ? '✅' : '❌'} [${base === A ? 'A' : 'B'}] ${method} ${path} → ${r.status} (${Date.now() - t} ms)${pass ? '' : ' ' + text.slice(0, 200)}`);
  return json;
}
const login = await call(A, 'POST', '/auth/login', { email: 'admin@gymflow.co.mz', password: 'Admin@2026' });
token = login.token;
await call(B, 'GET', '/auth/me');
const dash = await call(B, 'GET', '/dashboard');
console.log('   membros no dashboard:', dash.totals?.members);
const plans = await call(A, 'GET', '/plans?includeInactive=true');
const created = await call(B, 'POST', '/members', { fullName: 'Teste Demo Silva', phone: '841112233', joinedAt: today, planId: plans[0].id, sendWelcome: false }, 201);
const id = created.member?.id ?? created.id;
const list = await call(A, 'GET', '/members?q=Teste%20Demo');
console.log('   membro criado em B visível em A:', list.items?.some((m) => m.id === id));
await call(A, 'POST', '/payments', { memberId: id, amount: 1500, paymentDate: today, method: 'CASH', sendConfirmation: false }, 201);
const detail = await call(B, 'GET', `/members/${id}`);
console.log('   estado em B após pagamento em A:', detail.subscription?.status ?? detail.member?.status ?? JSON.stringify(detail).slice(0, 80));
await call(B, 'GET', '/attendance?date=' + today);
await call(A, 'GET', '/reports/financial?from=2026-09-01&to=' + today);
await call(B, 'POST', '/auth/logout', null, 204);
await call(A, 'GET', '/auth/me', null, 401);
console.log(`\n${ok} passaram, ${fail} falharam`);
