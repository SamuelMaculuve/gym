import { chromium } from '/Users/samuelmaculuve/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:4200';
const SHOTS = '/private/tmp/claude-501/-Users-samuelmaculuve-Downloads-gym/566ddb27-e7cb-4a89-9f05-6612681e018e/scratchpad/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const bad = [];
const errors = [];
page.on('response', (r) => r.url().includes('/api/') && r.status() >= 400 && bad.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`));
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('Failed to load resource') && errors.push(m.text()));
let ok = 0, fail = 0;
const check = (cond, label) => { cond ? ok++ : fail++; console.log(`${cond ? '✅' : '❌'} ${label}`); };

// 1. Login pelo formulário
await page.goto(BASE + '/login');
await page.getByLabel('Email').fill('admin@gymflow.co.mz');
await page.getByLabel('Palavra-passe').fill('Admin@2026');
await page.getByRole('button', { name: 'Entrar' }).click();
await page.waitForURL(BASE + '/', { timeout: 20000 });
await page.getByText('Gerir o seu').waitFor();
await page.waitForLoadState('networkidle');
check(page.url() === BASE + '/', 'login → dashboard');
check(await page.getByText('Acções necessárias').isVisible(), 'dashboard carregado com dados');
await page.screenshot({ path: SHOTS + 'e2e-dashboard.png' });

// 2. Todas as páginas
const pages = [
  ['/members', 'Membros'], ['/subscriptions', 'Subscrições'], ['/payments', 'Pagamentos'], ['/attendance', 'Presenças'],
  ['/plans', 'Planos'], ['/reports', 'Relatórios'], ['/notifications', 'Notificações'], ['/users', 'Utilizadores'],
  ['/settings', 'Configurações'], ['/audit', 'Auditoria'],
];
for (const [path, title] of pages) {
  const before = bad.length;
  await page.goto(BASE + path);
  await page.waitForLoadState('networkidle');
  const h1 = await page.locator('h1').first().textContent({ timeout: 10000 }).catch(() => null);
  check(page.url().startsWith(BASE + path) && bad.length === before, `${path} (${h1 ?? 'sem título'})${bad.length > before ? ' erros: ' + bad.slice(before).join(', ') : ''}`);
}

// 3. Detalhe de membro
await page.goto(BASE + '/members');
await page.waitForLoadState('networkidle');
await page.locator('tbody tr').first().click();
await page.waitForURL(/\/members\/.+/);
await page.waitForLoadState('networkidle');
check(/\/members\/.+/.test(page.url()), 'detalhe de membro abre');

// 4. Criar membro pela interface
await page.goto(BASE + '/members');
await page.waitForLoadState('networkidle');
await page.getByRole('button', { name: 'Novo membro' }).first().click();
const phone = '84' + String(Date.now()).slice(-7);
await page.getByLabel('Nome completo').fill('Browser Teste Nhaca');
await page.getByLabel('Número de celular').fill(phone);
await page.getByRole('button', { name: /Cadastrar/ }).click();
await page.getByText('Browser Teste Nhaca').first().waitFor({ timeout: 15000 }).catch(() => undefined);
await page.keyboard.press('Escape');
await page.goto(BASE + '/members');
await page.waitForLoadState('networkidle');
await page.getByPlaceholder(/Nome, telefone/).fill(phone);
await page.waitForTimeout(800);
await page.waitForLoadState('networkidle');
check(await page.getByText('Browser Teste Nhaca').first().waitFor({ timeout: 10000 }).then(() => true, () => false), 'membro criado pela interface aparece na pesquisa');

// 5. Recarregar: a sessão mantém-se
await page.reload();
await page.waitForLoadState('networkidle');
check(!page.url().includes('/login'), 'sessão mantém-se após recarregar');

// 6. Logout
await page.goto(BASE + '/');
await page.waitForLoadState('networkidle');
await page.getByRole('button', { name: 'Menu do utilizador' }).click();
await page.getByRole('button', { name: 'Terminar sessão' }).click();
await page.waitForURL(/\/login/, { timeout: 10000 });
check(page.url().includes('/login'), 'logout → ecrã de login');
await page.goto(BASE + '/members');
await page.waitForLoadState('networkidle');
check(page.url().includes('/login'), 'depois do logout, páginas protegidas pedem login');

// 7. Login outra vez, com outro perfil
await page.getByLabel('Email').fill('recepcao@gymflow.co.mz');
await page.getByLabel('Palavra-passe').fill('Recepcao@2026');
await page.getByRole('button', { name: 'Entrar' }).click();
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }).catch(() => undefined);
await page.waitForLoadState('networkidle');
check(!page.url().includes('/login'), `novo login (recepção) depois do logout → ${new URL(page.url()).pathname}`);
await page.screenshot({ path: SHOTS + 'e2e-relogin.png' });

const hits = await (await fetch(BASE + '/__hits')).json();
console.log('\nPedidos por instância:', hits);
console.log('Respostas de erro da API:', bad.length ? bad : 'nenhuma');
console.log('Erros de JavaScript:', errors.length ? errors : 'nenhum');
console.log(`\n${ok} passaram, ${fail} falharam`);
await browser.close();
