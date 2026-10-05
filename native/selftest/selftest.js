/* Simulator smoke test (CI only — never part of the IPA): drives the real app inside the iOS WKWebView
   and writes PASS/FAIL lines to Library/selftest-result.txt for the workflow to read. */
(async () => {
  const log = [];
  const ok = (cond, msg) => log.push((cond ? 'PASS ' : 'FAIL ') + msg);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const FS = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
  const save = () => FS && FS.writeFile({ path: 'selftest-result.txt', data: log.join('\n') + '\n', directory: 'LIBRARY', encoding: 'utf8' }).catch(() => {});
  try {
    for (let i = 0; i < 50 && !(window.__mr && window.__mr.state); i++) await wait(200);
    await wait(1500);
    ok(window.__mr && window.__mr.isNative(), 'running as the native app');
    ok(!!FS && !!window.Capacitor.Plugins.Share && !!window.Capacitor.Plugins.App, 'Filesystem, Share and App plugins available');
    ok(getComputedStyle(document.body).fontFamily.includes('Readex'), 'Arabic font applied');
    const n0 = window.__mr.state.records.length;
    $('.key[data-type="change"]').click(); await wait(900);
    ok(window.__mr.state.records.length === n0 + 1, 'first press records immediately');
    const f = await FS.readFile({ path: 'murabbiyati-state.json', directory: 'LIBRARY', encoding: 'utf8' });
    ok(JSON.parse(f.data).records.length === n0 + 1, 'state saved to Library/murabbiyati-state.json');
    $('.key[data-type="change"]').click(); await wait(900);
    ok(!!$('.sheet-wrap.open') && $('.sheet-wrap.open').innerText.includes('تحديث وقت التغيير'), 'confirm dialog before updating');
    await save(); await wait(4000);                                   /* screenshot window: confirm dialog */
    $('.sheet [data-act="ok"]').click(); await wait(1200);
    ok(window.__mr.state.records.length === n0 + 2, 'confirm keeps the old record and adds the new one');
    const csv = '﻿التاريخ,الوقت,النوع,التفصيل,ملاحظات\r\n2026-10-04,09:00,رضاعة,يمين,من الحضانة\r\n2026-10-04,09:40,تغيير,بول,\r\n';
    const w = await FS.writeFile({ path: 'Inbox/سجل الحضانة.csv', data: csv, directory: 'DOCUMENTS', encoding: 'utf8', recursive: true });
    ok(/^file:/.test(w.uri), 'test file written: ' + w.uri.slice(-40));
    await window.__mr.openNativeFile(w.uri); await wait(1500);
    ok(window.__mr.state.records.length === n0 + 4, 'CSV opened from another app is imported (' + window.__mr.state.records.length + ')');
    ok(!!$('.sheet-wrap.open .summary'), 'import summary shown');
    let gone = false; try { await FS.stat({ path: w.uri }); } catch (e) { gone = true; }
    ok(gone, 'inbox copy removed after import');
    await save(); await wait(4000);                                   /* screenshot window: import summary */
    $('.sheet [data-act="done"]').click(); await wait(900);
    $('#tab-share').click(); await wait(500);
    ok($('#exportSave').hidden && !$('#installBanner').offsetParent, 'web install hints hidden in the app');
    $('#exportShare').click(); await wait(2500);
    const ex = await FS.readdir({ path: 'exports', directory: 'CACHE' });
    ok(ex.files && ex.files.length === 1, 'export file prepared for the share sheet: ' + (ex.files[0] && (ex.files[0].name || ex.files[0])));
    log.push('DONE');
  } catch (e) {
    log.push('ERROR ' + ((e && (e.message || e.errorMessage)) || e));
  }
  await save();
})();
