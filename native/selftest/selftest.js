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

    /* ---------- version 1.2 ---------- */
    $('#tab-home').click(); await wait(600);
    const pick = async (sel, ms) => { const el = $(sel); if (el) el.click(); await wait(ms || 300); return !!el; };
    /* feeding type: an optional choice when confirming a feed */
    $('.key[data-type="feed"]').click(); await wait(900);
    if (!sheetOpen()) { $('.key[data-type="feed"]').click(); await wait(900); }   /* the very first feed is recorded at once */
    ok(sheetOpen() && !!$('.sheet-wrap.open [data-group="side"] [data-val="B"]'), 'feeding type offered when confirming a feed');
    await pick('.sheet-wrap.open [data-group="side"] [data-val="L"]');
    await mark('STEP feed', 2500);                                     /* screenshot: feeding type */
    await pick('.sheet-wrap.open [data-act="ok"]', 1200);
    ok((mr.derived.latest.feed || {}).side === 'L', 'feeding type saved with the entry');
    /* sleep / wake: always asks, waking chosen */
    $('.key[data-type="sleep"]').click(); await wait(900);
    const wakeOpt = $('.sheet-wrap.open [data-group="phase"] [data-val="wake"]');
    ok(sheetOpen() && !!wakeOpt && wakeOpt.getAttribute('aria-checked') === 'true', 'sleep/wake asks which one, waking chosen');
    await pick('.sheet-wrap.open [data-group="phase"] [data-val="sleep"]');
    await mark('STEP sleep', 2500);                                    /* screenshot: sleep or wake */
    await pick('.sheet-wrap.open [data-act="ok"]', 1500);
    ok((mr.derived.latest.sleep || {}).phase === 'sleep', 'falling asleep recorded');
    mr.state.settings.sleepCalc = true; mr.changed(); await wait(400);
    $('.key[data-type="sleep"]').click(); await wait(900);
    await pick('.sheet-wrap.open [data-act="ok"]', 1500);
    ok((mr.derived.latest.sleep || {}).phase === 'wake' && mr.derived.sleep.periods.length >= 1, 'waking recorded and paired with the sleep');
    /* a second child, its own entries, and switching with a long press on the name */
    const firstKid = mr.state.active;
    mr.openChildProfile(null); await wait(900);
    $('#cName').value = 'Lina'; $('#cBirth').value = mr.dayKey(Date.now() - 200 * 864e5);
    await pick('.sheet-wrap.open [data-act="save"]', 1400);
    ok(mr.state.children.length === 2 && mr.state.active !== firstKid && $('#childName').textContent.trim() === 'Lina', 'second child added and shown at the top');
    $('.key[data-type="change"]').click(); await wait(1000);
    ok(mr.state.records.filter(r => r.cid === mr.state.active).length === 1, 'entries are kept per child');
    const cb = $('#childBtn'), r0 = cb.getBoundingClientRect();
    const pev = t => new PointerEvent(t, { bubbles: true, pointerId: 7, isPrimary: true, pointerType: 'touch', clientX: r0.left + 5, clientY: r0.top + 5 });
    cb.dispatchEvent(pev('pointerdown')); await wait(800); cb.dispatchEvent(pev('pointerup')); await wait(800);
    ok(sheetOpen() && document.querySelectorAll('.sheet-wrap.open [data-pick]').length === 2, 'long press on the name lists the children');
    await mark('STEP children', 2500);                                 /* screenshot: children */
    await pick('.sheet-wrap.open [data-pick="' + firstKid + '"]', 1400);
    ok(mr.state.active === firstKid, 'switched back to the first child');
    /* home designs */
    for (const lay of ['modern', 'calm', 'contrast']) {
      mr.state.settings.look.layout = lay; mr.applyLook(); mr.changed(); await wait(900);
      ok(document.documentElement.getAttribute('data-layout') === lay && document.querySelectorAll('#device [data-type]').length >= 4, 'home design: ' + lay);
      await mark('STEP design-' + lay, 2500);                          /* screenshots: designs */
    }
    mr.state.settings.look.layout = 'classic'; mr.applyLook(); mr.changed(); await wait(800);
    /* health: a vaccination with a reminder, an appointment, phone notifications */
    const LN = P.LocalNotifications;
    ok(!!LN, 'notifications plugin available (reminders)');
    mr.state.vaccines.push(mr.cleanVaccine({ name: 'MMR', dose: '1', due: mr.dayKey(Date.now() + 3 * 864e5), remind: true }, firstKid));
    mr.state.appts.push(mr.cleanAppt({ ts: Date.now() + 26 * 3600e3, title: 'Check-up', doctor: 'Dr. Noor', remind: [1440, 120] }, firstKid));
    mr.changed(); await wait(800);
    mr.showTab('health'); await wait(900);
    ok(document.querySelectorAll('#healthBody [data-vax], #healthBody [data-appt]').length >= 2, 'health tab lists the vaccination and the appointment');
    await mark('STEP health', 2500);                                   /* screenshot: health tab */
    if (LN) {
      const perm = await LN.checkPermissions();
      info('notification permission: ' + perm.display);
      await mr.syncReminders(); await wait(1500);
      if (perm.display === 'granted') {
        const pend = await LN.getPending();
        ok(pend.notifications.length >= 3, 'reminders scheduled as phone notifications (' + pend.notifications.length + ')');
      }
    }
    /* the card reader runs on the phone, without internet */
    const cv = document.createElement('canvas'); cv.width = 1400; cv.height = 760;
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#111';
    g.font = 'bold 46px sans-serif'; g.fillText('Vaccination Card', 70, 90);
    g.font = '40px sans-serif';
    [['BCG', '21/05/2026'], ['Hepatitis B', '21/05/2026'], ['Hexa (6 in 1)', '20/07/2026'], ['MMR', '21/05/2027']]
      .forEach((row, i) => { g.fillText(row[0], 70, 220 + i * 130); g.fillText(row[1], 820, 220 + i * 130); });
    const png = await new Promise(res => cv.toBlob(res, 'image/png'));
    const t1 = Date.now();
    let card = null;
    try { card = await Promise.race([mr.readCard(png, () => {}), wait(240000).then(() => null)]); } catch (e) { info('card reader error: ' + ((e && e.message) || e)); }
    const got = card ? card.items.map(x => x.name + ' ' + (x.given || x.due || '?')).join('; ') : 'nothing';
    ok(!!card && card.items.length >= 3, 'vaccination card read on the phone in ' + Math.round((Date.now() - t1) / 1000) + ' s: ' + got);
    mr.showTab('home'); await wait(600);

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
