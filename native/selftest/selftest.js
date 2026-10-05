/* Phone smoke test (CI only — never part of the IPA/APK): drives the real app inside the iPhone simulator
   or the Android emulator and writes PASS/FAIL lines to the app's Library/files folder (selftest-result.txt).
   On Android the workflow watches for "WAIT …" lines and answers them with adb (open a file, press Back). */
(async () => {
  const log = [];
  const ok = (cond, msg) => log.push((cond ? 'PASS ' : 'FAIL ') + msg);
  const info = msg => log.push('INFO ' + msg);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const P = (window.Capacitor && window.Capacitor.Plugins) || {};
  const FS = P.Filesystem;
  const save = () => FS && FS.writeFile({ path: 'selftest-result.txt', data: log.join('\n') + '\n', directory: 'LIBRARY', encoding: 'utf8' }).catch(() => {});
  const mark = async (m, ms) => { log.push(m); await save(); if (ms) await wait(ms); };
  const until = async (fn, secs) => { for (let i = 0; i < secs * 4; i++) { try { if (fn()) return true; } catch (e) { /* not yet */ } await wait(250); } return false; };
  const count = () => window.__mr.state.records.length;
  const sheetOpen = () => !!$('.sheet-wrap.open');
  const closeSheet = async () => { const b = $('.sheet-wrap.open [data-act="done"]') || $('.sheet-wrap.open [data-act="cancel"]'); if (b) b.click(); else history.back(); await wait(900); };
  try {
    await until(() => window.__mr && window.__mr.state, 15);
    await wait(1500);
    const mr = window.__mr, tr = mr.tr;
    /* later launches (restart checks) only report what they see, without touching anything */
    let earlier = '';
    try { earlier = (await FS.readFile({ path: 'selftest-result.txt', directory: 'LIBRARY', encoding: 'utf8' })).data || ''; } catch (e) { earlier = ''; }
    if (/^(DONE|ERROR)/m.test(earlier)) {
      const summary = await until(() => $('.sheet-wrap.open .summary'), 12);
      await FS.writeFile({ path: 'selftest-relaunch.txt', directory: 'LIBRARY', encoding: 'utf8',
        data: 'records ' + count() + '\nsummary ' + (summary ? 'yes' : 'no') + '\nlanguage ' + mr.lang + '\n' }).catch(() => {});
      return;
    }
    const platform = window.Capacitor.getPlatform();
    info('platform ' + platform + ', phone language ' + navigator.language + ', app language ' + mr.lang + ', ' + (navigator.userAgent.match(/(Chrome|Version)\/[\d.]+/) || [''])[0]);
    ok(mr.isNative(), 'running as the native app');
    ok(!!FS && !!P.Share && !!P.App, 'Filesystem, Share and App plugins available');
    ok(!!P.SystemBars, 'SystemBars available (status bar follows the app theme)');
    const want = (navigator.language || '').toLowerCase().split('-')[0];
    ok(mr.lang.split('-')[0] === want || (want === 'iw' && mr.lang === 'he'), 'interface follows the phone language (' + mr.lang + ')');
    ok(document.documentElement.lang === mr.lang && document.documentElement.dir === window.__I18N[mr.lang]._dir, 'page language and direction set (' + document.documentElement.dir + ')');
    ok(getComputedStyle(document.body).fontFamily.includes('Readex'), 'app font applied');

    const n0 = count();
    $('.key[data-type="change"]').click(); await wait(900);
    ok(count() === n0 + 1, 'first press records immediately');
    const f = await FS.readFile({ path: 'murabbiyati-state.json', directory: 'LIBRARY', encoding: 'utf8' });
    ok(JSON.parse(f.data).records.length === n0 + 1, 'state saved to the app file (murabbiyati-state.json)');
    $('.key[data-type="change"]').click(); await wait(900);
    ok(sheetOpen() && $('.sheet-wrap.open').innerText.includes(tr('upd.title.change')), 'confirm dialog before updating');
    await mark('STEP confirm', 4000);                                 /* screenshot: confirm dialog */
    $('.sheet [data-act="ok"]').click(); await wait(1200);
    ok(count() === n0 + 2, 'confirm keeps the old record and adds the new one');

    const csv1 = '﻿Date,Time,Type,Detail,Notes\r\n2026-10-04,09:00,Feed,Right,from the nursery\r\n2026-10-04,09:40,Diaper,Wet,\r\n';
    const csv2 = '﻿التاريخ,الوقت,النوع,التفصيل,ملاحظات\r\n2026-10-04,11:15,نوم,,قيلولة\r\n';
    if (platform === 'android') {
      await FS.writeFile({ path: 'incoming/nursery.csv', data: csv1, directory: 'CACHE', encoding: 'utf8', recursive: true });
      await FS.writeFile({ path: 'incoming/shared.csv', data: csv2, directory: 'CACHE', encoding: 'utf8', recursive: true });
      await FS.writeFile({ path: 'incoming/cold.csv', data: csv2.replace('11:15', '13:30'), directory: 'CACHE', encoding: 'utf8', recursive: true });
      await mark('WAIT view-intent');
      ok(await until(() => count() === n0 + 4, 120), 'CSV opened with the app (VIEW content://) is imported (' + count() + ')');
      ok(await until(() => $('.sheet-wrap.open .summary'), 10), 'import summary shown');
      let still = false; try { await FS.stat({ path: 'incoming/nursery.csv', directory: 'CACHE' }); still = true; } catch (e) { still = false; }
      ok(still, 'the other app\'s file is left alone (content://)');
      await mark('STEP summary', 4000);                               /* screenshot: import summary */
      await closeSheet();
      await mark('WAIT send-intent');
      ok(await until(() => count() === n0 + 5, 120), 'CSV shared to the app (SEND) is imported (' + count() + ')');
      ok(await until(() => $('.sheet-wrap.open .summary'), 10), 'second import summary shown');
      await mark('STEP summary2', 3000);
      await closeSheet();
    } else {
      const w = await FS.writeFile({ path: 'Inbox/سجل الحضانة.csv', data: csv1, directory: 'DOCUMENTS', encoding: 'utf8', recursive: true });
      ok(/^file:/.test(w.uri), 'test file written: ' + w.uri.slice(-40));
      await mr.openNativeFile(w.uri); await wait(1500);
      ok(count() === n0 + 4, 'CSV opened from another app is imported (' + count() + ')');
      ok(!!$('.sheet-wrap.open .summary'), 'import summary shown');
      let gone = false; try { await FS.stat({ path: w.uri }); } catch (e) { gone = true; }
      ok(gone, 'inbox copy removed after import');
      await mark('STEP summary', 4000);                               /* screenshot: import summary */
      await closeSheet();
    }

    $('#tab-share').click(); await wait(500);
    ok($('#exportSave').hidden && !$('#installBanner').offsetParent, 'web install hints hidden in the app');
    const label = tr(platform === 'ios' ? 'share.exportNative' : 'share.export');
    ok($('#exportShare').innerText.trim() === label, 'export button: ' + label);
    if (platform === 'android') ok(!$('#fileIn').hasAttribute('accept'), 'file picker shows every file');

    if (platform === 'android') {
      const ex0 = await FS.readdir({ path: 'exports', directory: 'CACHE' }).catch(() => ({ files: [] }));
      $('#exportShare').click(); await wait(2500);
      const ex = await FS.readdir({ path: 'exports', directory: 'CACHE' }).catch(() => ({ files: [] }));
      ok(ex.files && ex.files.length === (ex0.files || []).length + 1, 'export file prepared for the share sheet');
      await mark('STEP share-sheet');                                 /* workflow: screenshot, then Back */
      await wait(9000);
      const t = $('#toast');
      ok(!(t && t.classList.contains('show') && t.innerText.includes(tr('exp.shareFail'))), 'closing the share sheet shows no error');

      $('#settingsBtn').click(); await wait(700);
      ok(sheetOpen(), 'settings open');
      await mark('WAIT back1');
      ok(await until(() => !sheetOpen(), 60), 'Back closes the open window');
      $('#tab-log').click(); await wait(600);
      await mark('WAIT back2');
      ok(await until(() => $('#tab-home').getAttribute('aria-selected') === 'true', 60), 'Back returns to the home page');
      let wentAway = false;
      document.addEventListener('visibilitychange', () => { if (document.hidden) wentAway = true; });
      const before = count();
      await mark('WAIT back3');
      ok(await until(() => wentAway && !document.hidden, 90), 'Back on the home page leaves the app, and it comes back as it was');
      ok(count() === before, 'nothing lost after leaving with Back');
    } else {
      $('#exportShare').click(); await wait(2500);
      const ex = await FS.readdir({ path: 'exports', directory: 'CACHE' });
      ok(ex.files && ex.files.length === 1, 'export file prepared for the share sheet: ' + (ex.files[0] && (ex.files[0].name || ex.files[0])));
    }

    if (platform === 'android') {
      $('#tab-home').click(); await wait(400);
      mr.setLang(mr.lang === 'ar' ? 'en' : 'ar'); await wait(800);
      ok(document.documentElement.dir === window.__I18N[mr.lang]._dir && $('#tab-home').innerText.trim() === tr('tab.home'), 'language switched in the app (' + mr.lang + ')');
      await mark('STEP language', 4000);                              /* screenshot: the other language */
      mr.setLang('auto'); await wait(500);
    }
    log.push('DONE');
  } catch (e) {
    log.push('ERROR ' + ((e && (e.message || e.errorMessage)) || e));
  }
  await save();
})();
