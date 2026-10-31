// Синтетический browser E2E против scripts/qa/gastro_fixture.py; PostgreSQL не подменяет.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = path.join(__dirname, 'output');
fs.mkdirSync(output, { recursive: true });
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const story = ('Синтетическая история: обследование, лечение и результат. Дату не помню.\n').repeat(180);

async function run(browser, longHistory) {
  const context = await browser.newContext({viewport: {width: 390, height: 844}});
  const page = await context.newPage();
  const browserErrors = [];
  page.on('pageerror', e => browserErrors.push(e.message));
  const answer = async (click) => {
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/answer') && r.request().method() === 'POST'), click(),
    ]);
    const next = await response.json();
    assert.equal(response.status(), 200, JSON.stringify(next));
    if (next.completed) await page.getByRole('heading', {name:'Готово!',exact:true}).waitFor();
    else await page.getByRole('heading', {name:next.title,exact:true}).waitFor();
    return next;
  };
  await page.goto('http://127.0.0.1:3017/q/gastro-demo', {waitUntil:'networkidle'});
  await page.getByRole('button', {name:'Ответить',exact:true}).click();
  let current = await answer(() => page.getByRole('button', {name:'Первичный',exact:true}).click());
  await page.screenshot({path:path.join(output, longHistory ? 'history-start.png' : 'simple-start.png'),fullPage:true});
  const seen = [];
  let backChecked = false;
  while (!current.completed && seen.length < 35) {
    seen.push(current.step_key);
    const meta = current.gastro;
    assert.ok(meta, `Missing descriptor at ${current.step_key}`);
    const values = {...meta.values};
    for (const field of meta.fields) {
      if (field.show_when && !(values[field.show_when.key] ?? []).includes(field.show_when.value)) continue;
      const choices = {
        complaints:['heartburn'],symptoms_today:['yes'],heartburn_onset:['months'],
        heartburn_features:['burn'],heartburn_frequency:['weekly'],
        history_mode:[longHistory?'narrative':'skip'],
      };
      if (field.type === 'single' || field.type === 'multi') {
        const desired = choices[field.key] ?? (field.options.some(o=>o.value==='none') ? ['none']
          : field.required ? [field.options[0].value] : null);
        if (!desired) continue;
        const group = page.getByRole('group', {name:new RegExp(escape(field.label))});
        for (const value of desired) {
          const option = field.options.find(o=>o.value===value);
          await group.getByRole(field.type==='single'?'radio':'checkbox',{name:option.label,exact:true}).check();
        }
        values[field.key] = desired;
      } else if (field.key === 'history_narrative' && longHistory) {
        await page.getByLabel(field.label,{exact:true}).fill(story);
        values[field.key] = story;
      } else if (field.key === 'first_name') {
        await page.getByLabel(field.label,{exact:true}).fill('Тестовый пациент');
      } else if (field.type === 'date') {
        await page.getByLabel(field.label,{exact:true}).fill(current.date_min);
      }
    }
    assert.equal(await page.locator('input[type="time"]').count(),0);
    assert.equal(await page.getByLabel(/возраст|дата рождения|год рождения/i).count(),0);
    if (meta.screen === 'questions' && longHistory) {
      await page.getByLabel('Вопрос 1',{exact:true}).fill('Почему симптомы возвращаются?');
      await page.getByRole('button',{name:'Добавить вопрос',exact:true}).click();
      await page.getByLabel('Вопрос 2',{exact:true}).fill('Какой план дальше?');
      if (!backChecked) {
        current = await answer(() => page.getByRole('button',{name:'Назад',exact:true}).click());
        assert.equal(current.gastro.screen,'review');
        current = await answer(() => page.getByRole('button',{name:'Всё верно — к вопросам врачу',exact:true}).click());
        await page.getByLabel('Вопрос 1',{exact:true}).waitFor();
        assert.equal(await page.getByLabel('Вопрос 1',{exact:true}).inputValue(),'Почему симптомы возвращаются?');
        assert.equal(await page.getByLabel('Вопрос 2',{exact:true}).inputValue(),'Какой план дальше?');
        backChecked = true;
      }
      await page.screenshot({path:path.join(output,'patient-questions.png'),fullPage:true});
    }
    if (meta.screen === 'history' && longHistory) await page.screenshot({path:path.join(output,'long-history.png'),fullPage:true});
    const primary = meta.actions?.find(a=>a.primary) ?? meta.actions?.[0];
    const label = primary?.label ?? (meta.screen==='questions'?'Отправить анкету':'Продолжить');
    current = await answer(() => page.getByRole('button',{name:label,exact:true}).click());
  }
  assert.equal(current.completed,true);
  const lastInputStep = seen.at(-1);
  assert.equal(lastInputStep,'gastro_questions');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
  assert.deepEqual(browserErrors,[]);
  await page.screenshot({path:path.join(output,longHistory?'history-done.png':'simple-done.png'),fullPage:true});
  await context.close();
  return {scenario:longHistory?'large history and last-question back':'simple patient',steps:seen,code:current.code,backChecked};
}

(async()=>{
  const channel = process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined);
  const browser = await chromium.launch({channel,headless:true});
  try {
    const result = [await run(browser,false), await run(browser,true)];
    const states = await (await fetch('http://127.0.0.1:8017/qa/sessions')).json();
    const last = states.at(-1);
    assert.equal(last.state.sections.gastro_history.values.history_narrative,story);
    assert.deepEqual(last.structured.patient_questions,['Почему симптомы возвращаются?','Какой план дальше?']);
    assert.ok(!last.structured.complaints.includes('Почему симптомы возвращаются?'));
    fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({result,historyCharacters:story.length},null,2));
    console.log(JSON.stringify({result,historyCharacters:story.length},null,2));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
