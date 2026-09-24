// Local-only browser recipe. No Preview, Google provider or real email is contacted.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('/Users/radwan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = 'http://127.0.0.1:3101', api = 'http://127.0.0.1:4105';
const out = __dirname;
const password = 'Local browser recipe passphrase 2026!';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
 const browser = await chromium.launch({headless:true, executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const results = [];
 let contextNumber = 0;
 try {
  for (const [device,width,height,ip] of [['mobile',390,844,'192.0.2.141'],['desktop',1440,900,'192.0.2.142']]) {
   let context, page;
   let mode = 'normal', releaseSave, saveHeld;
   let logoutCalls = 0;
   const apiPaths = [];
   async function openContext() {
    const clientIp = `198.18.${process.pid % 254}.${++contextNumber}`; // Each fresh browser represents a distinct test device; rate limits stay enabled.
    context = await browser.newContext({viewport:{width,height}, colorScheme:'dark'});
    page = await context.newPage();page.setDefaultTimeout(20000);
    await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
    const ownedPage = page;
    await page.route('**/api/**', async route => {
     try {
     const request = route.request(), u = new URL(request.url());
     apiPaths.push(u.pathname);
     if (u.pathname === '/api/v1/onboarding' && request.method() === 'PATCH') {
      if (mode === 'save-failed' || mode === 'conflict') return route.fulfill({status:mode==='conflict'?409:503,contentType:'application/json',body:JSON.stringify({error:{code:mode==='conflict'?'ONBOARDING_REVISION_CONFLICT':'TEST_OFFLINE',message:'Local recipe failure'}})});
      if (mode === 'hold-save') { mode='normal'; saveHeld(); await new Promise(resolve => {releaseSave=resolve}); }
     }
     if (u.pathname === '/api/v1/auth/logout') {
      logoutCalls++;
      if (mode === 'logout-failed') return route.fulfill({status:503,contentType:'application/json',body:'{"error":{"code":"TEST_OFFLINE"}}'});
     }
     const response = await route.fetch({url:api+u.pathname.replace(/^\/api/,'')+u.search,headers:{...request.headers(),'x-forwarded-host':u.host,'x-forwarded-for':clientIp}});
     if (u.pathname === '/api/v1/auth/logout' && mode === 'lost-logout-response') {mode='normal';return route.fulfill({response,body:'{"signedOut":'});}
     await route.fulfill({response});
     } catch (error) { if (!ownedPage.isClosed()) throw error; }
    });
   }
   const profile = () => page.getByRole('button',{name:'Menu du profil',exact:true});
   const signout = () => page.getByRole('button',{name:'Se déconnecter',exact:true});
   async function menu() { const details=page.locator('details').filter({has:profile()}); if(!await details.getAttribute('open').then(v=>v!==null)) await profile().click(); }
   async function login(email) {
    await page.goto(base+'/login');await page.locator('input[name=email]').fill(email);await page.locator('input[name=password]').fill(password);
    await page.getByRole('button',{name:'Se connecter',exact:true}).click();await page.waitForURL('**/onboarding**');await profile().waitFor();
   }
   async function apiRead(url,cookie) { return context.request.get(api+url,{headers:cookie?{cookie}:{cookie:(await context.cookies()).map(c=>`${c.name}=${c.value}`).join('; ')}}); }
   const composer = () => page.locator('.tn-conversation-input textarea');
   const captured = [];
   const shot = async name => { const file=`${device}-${name}.png`;await page.screenshot({path:path.join(out,file),fullPage:true});captured.push(file); };
   const noOverflow = async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   try {
    await openContext();
    const email=`resume-${device}-${Date.now()}@tablenow.test`;
    await page.goto(base+'/register');await page.locator('input[name=email]').fill(email);await page.locator('input[name=password]').fill(password);
    await page.getByRole('button',{name:'S’inscrire',exact:true}).click();await page.getByRole('heading',{name:'Confirmez votre adresse',exact:true}).waitFor();
    const mail=await (await context.request.get(api+'/__test/inbox/'+encodeURIComponent(email))).json();
    const link=new URL(mail.html.match(/href="([^"]+)"/)[1].replaceAll('&amp;','&'));
    await page.goto(base+link.pathname+link.hash);await page.getByRole('heading',{name:/Comment puis-je vous aider/}).waitFor();
    await profile().click();await signout().waitFor();await shot('01-priorities-menu');await page.keyboard.press('Escape');
    const selected=page.waitForResponse(r=>r.url().endsWith('/api/v1/onboarding')&&r.request().method()==='PATCH'&&r.status()===200);
    await page.getByRole('button',{name:"L'équipe",exact:true}).click();await selected;
    mode='hold-save';const held=new Promise(resolve=>{saveHeld=resolve});
    await composer().fill('Mon brouillon initial');await Promise.race([held,delay(10000).then(()=>{throw Error('Autosave not started')})]);
    await composer().fill('Mon brouillon complet, à reprendre');await menu();const previousLogoutCalls=logoutCalls;
    await signout().click();await page.getByRole('button',{name:'Enregistrement et déconnexion…',exact:true}).waitFor();
    assert.equal(logoutCalls,previousLogoutCalls,'No logout while save is pending');
    const oldCookie=(await context.cookies()).map(c=>`${c.name}=${c.value}`).join('; ');
    releaseSave();await page.waitForURL('**/login?onboarding=saved');await page.getByText('Votre progression a été enregistrée.',{exact:true}).waitFor();
    assert.equal((await apiRead('/v1/auth/session',oldCookie)).status(),401);
    assert.equal((await apiRead('/v1/onboarding',oldCookie)).status(),401);
    await page.close();await context.close();await openContext();await login(email);
    assert.equal(await page.getByRole('button',{name:"L'équipe",exact:true}).getAttribute('aria-pressed'),'true');
    assert.equal(await composer().inputValue(),'Mon brouillon complet, à reprendre');
    await noOverflow();await shot('02-priorities-resumed');
    // Sign out while navigation itself is being saved: the destination must be resumed.
    mode='hold-save';const navigationHeld=new Promise(resolve=>{saveHeld=resolve});
    await page.getByRole('button',{name:'Continuer',exact:true}).click();
    await Promise.race([navigationHeld,delay(10000).then(()=>{throw Error('Navigation save not started')})]);
    await menu();await signout().click();await page.getByRole('button',{name:'Enregistrement et déconnexion…',exact:true}).waitFor();
    releaseSave();await page.waitForURL('**/login?onboarding=saved');
    await page.close();await context.close();await openContext();await login(email);
    await page.getByRole('heading',{name:'Bonjour et bienvenue, comment puis-je vous aider ?',exact:true}).waitFor();
    await page.getByRole('button',{name:/manuellement/}).click();
    await page.getByLabel("Nom de l'établissement",{exact:true}).fill('Maison Recette');
    await page.getByLabel('Ville et pays',{exact:true}).fill('Lyon, France');
    await menu();await signout().click();await page.waitForURL('**/login?onboarding=saved');
    await page.close();await context.close();await openContext();await login(email);
    await page.getByRole('heading',{name:'Bonjour et bienvenue, comment puis-je vous aider ?',exact:true}).waitFor();
    assert.equal(await page.getByLabel("Nom de l'établissement",{exact:true}).inputValue(),'Maison Recette');
    assert.equal(await page.getByLabel('Ville et pays',{exact:true}).inputValue(),'Lyon, France');
    await noOverflow();await shot('03-establishment-resumed');
    // Failed save must not revoke the session or erase a field.
    mode='save-failed';await page.getByLabel('Ville et pays',{exact:true}).fill('Lyon, France — texte à conserver');
    await menu();const beforeFailedSave=logoutCalls;await signout().click();
    await page.getByRole('alert').filter({hasText:'La sauvegarde n’a pas abouti.'}).waitFor();
    assert.equal(logoutCalls,beforeFailedSave);assert.equal((await apiRead('/v1/auth/session')).status(),200);
    assert.equal(await page.getByLabel('Ville et pays',{exact:true}).inputValue(),'Lyon, France — texte à conserver');
    await shot('04-save-error');
    mode='conflict';await signout().click();await page.getByRole('alert').filter({hasText:'La sauvegarde n’a pas abouti.'}).waitFor();assert.equal(logoutCalls,beforeFailedSave);
    mode='normal';await signout().click();await page.waitForURL('**/login?onboarding=saved');
    await login(email);
    assert.equal(await page.getByLabel('Ville et pays',{exact:true}).inputValue(),'Lyon, France — texte à conserver');
    // A rejected logout retains the authenticated screen. A lost successful response reconciles.
    mode='logout-failed';await menu();await signout().click();await page.getByRole('alert').filter({hasText:'La déconnexion n’a pas pu être confirmée.'}).waitFor();
    assert.equal((await apiRead('/v1/auth/session')).status(),200);
    mode='lost-logout-response';await signout().click();await page.waitForURL('**/login?onboarding=saved');
    await login(email);
    // Continue through every canonical screen without creating business test tasks.
    await page.getByLabel('Ville et pays',{exact:true}).fill('Lyon, France');
    await page.getByRole('button',{name:'Confirmer ces informations',exact:true}).click();
    await page.getByRole('button',{name:'Continuer',exact:true}).click();
    await menu();await signout().click();await page.waitForURL('**/login?onboarding=saved');
    await page.close();await context.close();await openContext();await login(email);
    assert.equal((await (await apiRead('/v1/onboarding')).json()).answers.presentationStep,'systems');
    await page.getByRole('button',{name:'Je ne les note pas encore',exact:true}).click();
    await page.getByRole('button',{name:'Continuer',exact:true}).click();
    for (const step of ['connections','complements','review']) {
     await page.waitForURL(u=>u.searchParams.get('step')===step);
     await menu();await signout().click();await page.waitForURL('**/login?onboarding=saved');
     await page.close();await context.close();await openContext();await login(email);
     const draft=await (await apiRead('/v1/onboarding')).json();assert.equal(draft.answers.presentationStep,step);
     console.log(JSON.stringify({device,checkpoint:step,result:'PASS'}));
     if(step==='complements') await page.getByRole('button',{name:'J’ai terminé',exact:true}).click();
     else if(step==='connections') await page.getByRole('button',{name:'Continuer',exact:true}).click();
    }
    await page.getByRole('button',{name:'Passer en clair',exact:true}).click();
    await menu();await noOverflow();await shot('05-review-clear');
    assert.ok(!apiPaths.some(p=>p.includes('verify-mfa')));
    assert.equal(apiPaths.filter(p=>p.endsWith('/account/verify-email')).length, 1); // confirmation of signup only; no OTP added on return
    results.push({device,viewport:{width,height},result:'PASS',sessionRevoked:true,newBrowserResume:true,allSixSteps:true,saveDuringLogout:true,latestEditsPreserved:true,formAndComposerPersisted:true,saveFailureAndConflictRetainSession:true,logoutFailureAndLostResponse:true,physicalDevice:false,realEmail:false,realGoogle:false,captures:captured});
    console.log(JSON.stringify(results.at(-1)));
   } catch(e) {await page?.screenshot({path:path.join(out,device+'-failure.png'),fullPage:true});console.error('Scenario:',device,'URL:',page?.url());throw e;}
   finally {await context?.close();}
  }
  fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(results,null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
