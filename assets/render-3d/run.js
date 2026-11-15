/* اجرای رندرر سه‌بعدی در Chrome هدلس و ذخیره‌ی خروجی‌ها */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const DIR = __dirname;
const OUT = process.argv[2] || path.join(__dirname, '..', '3d');
const PORT = 9363;
const profile = path.join(require('os').tmpdir(), 'adabazi-render-prof-' + Date.now());
fs.mkdirSync(OUT, { recursive: true });

const child = spawn(CHROME, [
  '--headless=new', '--disable-gpu-sandbox', '--no-sandbox', '--hide-scrollbars',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile,
  '--window-size=800,800', 'about:blank'
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  let ws;
  try {
    let target;
    for (let i = 0; i < 60; i++) {
      try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = j.find(t => t.type === 'page'); if (target) break; } catch (e) { }
      await sleep(500);
    }
    ws = new WebSocket(target.webSocketDebuggerUrl);
    let id = 0; const pending = new Map();
    const send = (method, params) => new Promise((res, rej) => { const mid = ++id; pending.set(mid, { res, rej }); ws.send(JSON.stringify({ id: mid, method, params: params || {} })); });
    ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } });
    await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
    await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');
    const logs = [];
    ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (m.params.exceptionDetails.exception || {}).description);
      if (m.method === 'Log.entryAdded') logs.push('LOG ' + m.params.entry.level + ': ' + m.params.entry.text + ' @' + (m.params.entry.url || ''));
      if (m.method === 'Runtime.consoleAPICalled') logs.push('CON ' + m.params.args.map(a => a.value || a.description).join(' '));
      if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) logs.push('HTTP' + m.params.response.status + ' ' + m.params.response.url);
    });
    const evalJS = async (e, byValue = true) => {
      const r = await send('Runtime.evaluate', { expression: e, returnByValue: byValue, awaitPromise: true });
      if (r.exceptionDetails) return { error: r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception || {}).description };
      return r.result.value;
    };

    await send('Page.navigate', { url: 'http://127.0.0.1:8098/index.html' });
    for (let i = 0; i < 90; i++) {
      await sleep(1000);
      const done = await evalJS('!!window.__DONE__');
      if (done === true) break;
      if (i === 4 || i === 14) console.log('LOGS', logs.slice(0, 6).join(' | '));
    }
    const info = await evalJS('JSON.stringify(window.__RENDERED__||{})');
    console.log('META', info);
    const imgs = await evalJS('JSON.stringify((window.__IMAGES__||[]).map(i=>({key:i.key,id:i.id,size:i.size,d:i.dataUrl})))');
    const list = JSON.parse(imgs);
    list.forEach(it => {
      const b64 = it.d.split(',')[1];
      const buf = Buffer.from(b64, 'base64');
      fs.writeFileSync(path.join(OUT, it.key + '.webp'), buf);
      console.log(it.key.padEnd(14), String(Math.round(buf.length / 1024)).padStart(4) + ' KB', it.size + 'px');
    });
    ws.close();
  } catch (e) { console.log('ERR', e.message); }
  finally { try { child.kill(); } catch (e) { } try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { } process.exit(0); }
})();
