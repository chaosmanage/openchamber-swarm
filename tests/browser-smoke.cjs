const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
fs.mkdirSync('.dev',{recursive:true});
const now=Date.now(),members=[['coordinator','coordinator','active'],['shell-builder','worker','blocked'],['games-builder','worker','waiting'],['verifier','verifier','waiting']].map(([name,role,state],i)=>({name,role,state,...(state==='blocked'?{error:'Needs a file-system permission before continuing.'}:{}),sessionId:'ses_'+i,model:'gemini/carbon',brief:'Implement and validate the assigned component. Report evidence to the board.',paths:['src/'+name],taskState:i===2?'reported':'working',pending:0,lastPost:i+1,read:2}));
const swarm={id:'test',key:'SWARM-1',title:'Build a playful desktop application',task:'Create a modular application with independent workers and verification.',directory:'/repo',status:'running',members,posts:[{id:1,at:now,from:'coordinator',to:['shell-builder','games-builder'],kind:'brief',text:'Implement isolated components with tests.'},{id:2,at:now+1000,from:'shell-builder',to:['coordinator'],kind:'report',text:'Shell is ready. Verifier can inspect the result.'},{id:3,at:now+2000,from:'games-builder',to:['verifier'],kind:'done',text:'All game tests pass.'}],turns:5};
const tokens=Object.fromEntries('background elevated foreground muted subtle border hover selection focus primary mutedSurface elevatedForeground active selectionForeground primaryForeground primaryText successText warningText errorText infoText success warning error info font mono radius'.split(' ').map(k=>[k,'#121317']));
const fixture='<html><body style="margin:0"><iframe id="guest" src="/panel/index.html" style="border:0;width:100%;height:100vh"></iframe><script>const data='+JSON.stringify(swarm)+';window.fixtureData=data;window.fixtureSwarms=[data];window.fixtureOpenedSessions=[];window.fixtureMessageRequests=0;window.fixtureListRequests=0;window.fixtureFailNextMessage=false;window.fixtureHoldNextMessage=false;window.fixturePendingMessage=null;const addMessage=message=>{const target=window.fixtureSwarms.find(item=>item.id===message.id);if(!target)return;target.posts.push({id:Math.max(0,...target.posts.map(post=>post.id))+1,at:Date.now(),from:"coordinator",to:message.to==="all"?target.members.map(member=>member.name):[message.to],kind:"message",text:message.text});};window.fixtureResolveMessage=()=>{const pending=window.fixturePendingMessage;if(!pending)return;addMessage(pending.message);pending.source.postMessage({channel:pending.channel,v:1,type:"result",id:pending.id,ok:true,payload:{status:200,body:JSON.stringify({ok:true})}},"*");window.fixturePendingMessage=null;};const tokens='+JSON.stringify(tokens)+';window.addEventListener("message",e=>{const d=e.data;if(d.channel!=="openchamber.sdk")return;const send=(type,other)=>e.source.postMessage({channel:d.channel,v:1,type,...other},"*");if(d.type==="hello")send("ready",{payload:{theme:{mode:"dark",tokens},locale:"en",directory:"/repo",session:{id:"ses_0",title:"Demo",busy:false},surface:"panel",connection:{connected:false,account:""},settings:{},item:null}});else if(d.type==="open-session"){window.fixtureOpenedSessions.push(d.payload.sessionId);send("result",{id:d.id,ok:true,payload:{}});}else if(d.type==="service-request"){const p=d.payload.path;let response;if(p==="/settings")response={workerModel:"",verifierModel:""};else if(p==="/models")response=[{id:"test/worker",name:"Worker model"}];else if(p==="/delete")response={ok:true};else if(p==="/message"){const message=JSON.parse(d.payload.body||"{}");window.fixtureMessageRequests++;if(window.fixtureFailNextMessage){window.fixtureFailNextMessage=false;send("result",{id:d.id,ok:true,payload:{status:500,body:JSON.stringify({error:"Test message failure."})}});return;}if(window.fixtureHoldNextMessage){window.fixtureHoldNextMessage=false;window.fixturePendingMessage={source:e.source,channel:d.channel,id:d.id,message};return;}addMessage(message);response={ok:true};}else if(p==="/list"){window.fixtureListRequests++;response=window.fixtureSwarms;}else response=[data];send("result",{id:d.id,ok:true,payload:{status:200,body:JSON.stringify(response)}});}});</script></body></html>';
async function checkOverview(browser,url){
 const page=await browser.newPage({viewport:{width:1000,height:720},reducedMotion:'reduce'});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(url);
  const frame=page.frameLocator('#guest');
  const section=frame.getByRole('region',{name:'Team',exact:true});
  const rows=section.locator('.overview-member');
  const row=name=>rows.filter({has:frame.getByText('@'+name,{exact:true})});
  const shell=row('shell-builder'),games=row('games-builder');
  const shellSummary=shell.locator('summary'),gamesSummary=games.locator('summary');
  const shellChat=shell.getByRole('button',{name:'Open chat'});
  const reason=shell.getByText('Needs a file-system permission before continuing.');
  await shellSummary.getByText('Needs attention',{exact:true}).waitFor();
  assert.equal(await rows.count(),4);
  assert.equal(await rows.and(frame.locator('[open]')).count(),0);
  assert.equal(await reason.isVisible(),false);
  assert.equal(await shellChat.isVisible(),false);
  assert.ok(await shellSummary.getByText('worker',{exact:true}).isVisible());
  await page.screenshot({path:'.dev/overview-compact-desktop.png'});

  await shellSummary.focus();
  await page.keyboard.press('Enter');
  await reason.waitFor();
  assert.ok(await shell.getByRole('heading',{name:'Brief'}).isVisible());
  assert.ok(await shell.getByRole('button',{name:'Retry',exact:true}).isVisible());
  await gamesSummary.click();
  assert.ok(await games.getByText('All game tests pass.').isVisible());
  assert.ok(await reason.isVisible());
  await games.getByRole('button',{name:'Open chat'}).click();
  await page.waitForFunction(()=>window.fixtureOpenedSessions.includes('ses_2'));
  await gamesSummary.click();
  assert.equal(await games.getByText('All game tests pass.').isVisible(),false);
  await shellSummary.press('Space');
  assert.equal(await reason.isVisible(),false);
  await shellSummary.click();
  await page.screenshot({path:'.dev/overview-expanded-desktop.png'});

  await page.setViewportSize({width:360,height:460});
  await shellSummary.evaluate(el=>el.blur());
  const shellPosition=()=>shellSummary.evaluate(el=>el.getBoundingClientRect().top);
  await shellSummary.evaluate(el=>{
   const win=el.ownerDocument.defaultView,sticky=el.ownerDocument.querySelector('.sticky-top');
   win.scrollBy(0,el.getBoundingClientRect().top-sticky.getBoundingClientRect().bottom-6);
  });
  const topBefore=await shellPosition();
  await page.evaluate(()=>{
   const data=window.fixtureData;
   data.summary='A result arriving above the roster should not move the currently read member.';
   data.posts.push({id:4,at:Date.now(),from:'shell-builder',to:['coordinator'],kind:'report',text:'The shell worker posted a fresh update.'});
   document.querySelector('#guest').contentWindow.postMessage({
    channel:'openchamber.sdk',v:1,type:'service-event',payload:{topic:'swarm.changed',data:null},
   },'*');
  });
  await shell.getByText('The shell worker posted a fresh update.').waitFor();
  assert.ok(await reason.isVisible());
  assert.ok(Math.abs(await shellPosition()-topBefore)<2);
  assert.equal(await games.getByText('All game tests pass.').isVisible(),false);

  // A growing post must not push a focused action out of a short mobile pane.
  await page.setViewportSize({width:320,height:460});
  await shellSummary.press('Tab');
  const chatPosition=()=>shellChat.evaluate(el=>{
   const win=el.ownerDocument.defaultView,bounds=el.getBoundingClientRect();
   const header=el.ownerDocument.querySelector('.sticky-top');
   return {
    focused:el===el.ownerDocument.activeElement,
    top:bounds.top,
    visible:bounds.top>=header.getBoundingClientRect().bottom&&bounds.bottom<=win.innerHeight,
   };
  });
  await shellChat.evaluate(el=>{
   const win=el.ownerDocument.defaultView;
   win.scrollBy(0,el.getBoundingClientRect().bottom-win.innerHeight+12);
  });
  const chatBefore=await chatPosition();
  assert.ok(chatBefore.focused&&chatBefore.visible);
  await page.evaluate(()=>{
   window.fixtureData.posts.push({id:5,at:Date.now(),from:'shell-builder',to:['coordinator'],kind:'report',text:[
    'The fixture update deliberately spans several lines.',
    'The keyboard-focused action is below this post.',
    'When the post grows, the action should keep its position.',
    'Remaining visible is important on narrow panes.',
   ].join('\n')});
   document.querySelector('#guest').contentWindow.postMessage({
    channel:'openchamber.sdk',v:1,type:'service-event',payload:{topic:'swarm.changed',data:null},
   },location.origin);
  });
  await shell.getByText(/The fixture update deliberately/).waitFor();
  const chatAfter=await chatPosition();
  assert.ok(chatAfter.focused&&chatAfter.visible,`Focused action left the visible pane: ${JSON.stringify(chatAfter)}`);
  assert.ok(Math.abs(chatAfter.top-chatBefore.top)<2);
  await page.screenshot({path:'.dev/overview-mobile-focused-refresh.png'});
  await shellChat.click();
  await page.waitForFunction(()=>window.fixtureOpenedSessions.includes('ses_1'));

  await page.evaluate(()=>{
   const second=structuredClone(window.fixtureData);
   second.id='test-two';second.key='SWARM-2';second.title='Second test swarm';second.summary='';
   second.task='Confirm compact roster layout. '.repeat(15);
   second.members[1].model='provider/'+'long-model-identifier'.repeat(10);
   second.members[1].paths=['src/'+'long-owned-path'.repeat(16)];
   window.fixtureSwarms.push(second);
  });
  await frame.locator('#refresh').evaluate(el=>el.click());
  const select=frame.locator('#swarmSelect');
  await select.waitFor();
  assert.equal(await select.inputValue(),'test-two');
  assert.equal(await rows.and(frame.locator('[open]')).count(),0);
  await gamesSummary.press('Enter');
  await select.selectOption('test');
  assert.ok(await reason.isVisible());
  assert.equal(await games.getByText('All game tests pass.').isVisible(),false);
  await page.evaluate(()=>document.querySelector('#guest').contentWindow.postMessage({
   channel:'openchamber.sdk',v:1,type:'item',payload:{item:{kind:'link',identifier:'SWARM-2'}},
  },'*'));
  await games.getByText('All game tests pass.').waitFor();
  assert.equal(await select.inputValue(),'test-two');
  assert.equal(await reason.isVisible(),false);
  assert.equal(await shellSummary.evaluate(el=>el===el.ownerDocument.activeElement),false);

  await page.setViewportSize({width:320,height:950});
  await gamesSummary.click();
  await frame.getByText('Read full goal',{exact:true}).click();
  await frame.getByText('Show less',{exact:true}).click();
  await shellSummary.click();
  assert.ok(await reason.isVisible());
  assert.ok((await shellSummary.boundingBox()).height>=44);
  assert.ok((await shellChat.boundingBox()).height>=40);
  assert.ok(await frame.locator('.overview').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  assert.ok(await frame.locator('html').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await frame.locator('body').evaluate(el=>el.ownerDocument.defaultView.scrollTo(0,0));
  await page.screenshot({path:'.dev/overview-expanded-mobile.png'});
  await shellSummary.click();
  await page.screenshot({path:'.dev/overview-compact-mobile.png'});
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
}

(async()=>{const server=http.createServer((req,res)=>{if(req.url==='/'){res.end(fixture);return;}const resource=path.join(process.cwd(),req.url);if(!resource.startsWith(process.cwd()+'/panel/')){res.statusCode=404;return res.end();}const filename=req.url==='/panel/main.js'&&process.env.PANEL_MAIN?process.env.PANEL_MAIN:resource;res.setHeader('Content-Type',filename.endsWith('.js')?'text/javascript':filename.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(filename));});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM?{executablePath:process.env.PLAYWRIGHT_CHROMIUM}:{}),args:['--no-sandbox']});try{const url='http://127.0.0.1:'+server.address().port;await checkOverview(browser,url);const page=await browser.newPage({viewport:{width:660,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);const frame=page.frameLocator('#guest');await frame.getByText('GOAL',{exact:true}).waitFor({timeout:5000});await page.screenshot({path:'.dev/overview.png'});await frame.locator('[data-tab=Board]').click();await frame.getByText('All game tests pass.').waitFor();await page.screenshot({path:'.dev/board.png'});
 // Vim-style navigation is active only while the board itself or a post has focus.
 const boardView=frame.locator('#board-view');await boardView.focus();await page.keyboard.press('j');assert.equal(await frame.locator('.board-post').nth(0).evaluate(el=>el===el.ownerDocument.activeElement),true);await page.keyboard.press('j');assert.equal(await frame.locator('.board-post').nth(1).evaluate(el=>el===el.ownerDocument.activeElement),true);await page.keyboard.press('G');assert.equal(await frame.locator('.board-post').last().evaluate(el=>el===el.ownerDocument.activeElement),true);await page.keyboard.press('g');await page.keyboard.press('o');await page.waitForFunction(()=>window.fixtureOpenedSessions.includes('ses_0'));await page.keyboard.press('Escape');assert.equal(await boardView.evaluate(el=>el===el.ownerDocument.activeElement),true);await page.keyboard.press('f');assert.equal(await frame.locator('#follow').getAttribute('aria-pressed'),'false');
  const modifiedDefaults=await boardView.evaluate(el=>['ctrlKey','metaKey','altKey'].map(key=>{const event=new KeyboardEvent('keydown',{key:'f',bubbles:true,cancelable:true,[key]:true});el.dispatchEvent(event);return event.defaultPrevented;}));assert.deepEqual(modifiedDefaults,[false,false,false]);assert.equal(await frame.locator('#follow').getAttribute('aria-pressed'),'false');
  const postChat=frame.locator('.board-post').first().locator('[data-post-action="chat"]'),postChatId=await postChat.evaluate(el=>el.closest('[data-post-id]').dataset.postId);await postChat.focus();await page.evaluate(()=>{const data=window.fixtureData;data.posts.push({id:Math.max(...data.posts.map(post=>post.id))+1,at:Date.now(),from:'verifier',to:['coordinator'],kind:'report',text:'Focus should stay on the same post action after a live refresh.'});});await frame.locator('#refresh').evaluate(el=>el.click());await frame.getByText('Focus should stay on the same post action after a live refresh.').waitFor();assert.equal(await frame.locator('[data-post-id="'+postChatId+'"] [data-post-action="chat"]').evaluate(el=>el===el.ownerDocument.activeElement),true);await frame.locator('#new-posts').click();
 // Typing shortcut characters into search and compose fields must not trigger board commands.
 await frame.locator('#filter').focus();await frame.locator('#filter').pressSequentially('fjk');assert.equal(await frame.locator('#follow').getAttribute('aria-pressed'),'false');await frame.locator('#filter').fill('');await frame.locator('#message select').selectOption('games-builder');await frame.locator('#message textarea').fill('Draft survives live refresh');await frame.locator('#message textarea').evaluate(el=>el.setSelectionRange(7,14,'backward'));await page.setViewportSize({width:660,height:540});await frame.locator('body').evaluate(el=>el.ownerDocument.defaultView.scrollTo(0,140));
 const readingBefore=await frame.locator('#feed').evaluate(feed=>{const win=feed.ownerDocument.defaultView,post=[...feed.querySelectorAll('[data-post-id]')].find(el=>{const r=el.getBoundingClientRect();return r.bottom>0&&r.top<win.innerHeight;});return {scrollY:win.scrollY,id:post?.dataset.postId,top:post?.getBoundingClientRect().top};});
 await page.evaluate(()=>{const data=window.fixtureData;data.posts.push({id:Math.max(...data.posts.map(post=>post.id))+1,at:Date.now(),from:'verifier',to:['coordinator'],kind:'report',text:'A live arrival should not move the reading position.'});});await frame.locator('#refresh').evaluate(el=>el.click());await frame.getByText('A live arrival should not move the reading position.').waitFor();assert.equal(await frame.locator('#message textarea').inputValue(),'Draft survives live refresh');assert.equal(await frame.locator('#message select').inputValue(),'games-builder');const draftState=await frame.locator('#message textarea').evaluate(el=>({focused:el===el.ownerDocument.activeElement,start:el.selectionStart,end:el.selectionEnd,direction:el.selectionDirection}));assert.deepEqual(draftState,{focused:true,start:7,end:14,direction:'backward'});const readingAfter=await frame.locator('[data-post-id="'+readingBefore.id+'"]').evaluate(el=>el.getBoundingClientRect().top);assert.ok(Math.abs(readingAfter-readingBefore.top)<2);assert.equal(await frame.getByRole('button',{name:'1 new post · Go to latest'}).isVisible(),true);await page.screenshot({path:'.dev/board-unread.png'});await frame.locator('#new-posts').click();assert.equal(await frame.locator('#new-posts').count(),0);assert.equal(await frame.locator('#follow').getAttribute('aria-pressed'),'false');
  await page.evaluate(()=>window.fixtureFailNextMessage=true);await frame.locator('#message textarea').fill('Keep this draft after a failed post.');await frame.locator('#message button').click();await frame.getByText('Test message failure.').waitFor();assert.equal(await frame.locator('#message textarea').inputValue(),'Keep this draft after a failed post.');assert.equal(await frame.locator('#message select').inputValue(),'games-builder');assert.equal(await frame.locator('#message button').isDisabled(),false);
 await frame.locator('#message textarea').fill('A message sent from the board.');await frame.getByRole('button',{name:'Post message'}).click();await frame.getByText('A message sent from the board.').waitFor();assert.equal(await frame.locator('#message textarea').inputValue(),'');assert.equal(await frame.locator('#message select').inputValue(),'games-builder');await frame.getByRole('button',{name:'1 new post · Go to latest'}).waitFor();await frame.locator('#follow').click();assert.equal(await frame.locator('#follow').getAttribute('aria-pressed'),'true');await frame.locator('#message textarea').focus();await frame.locator('#message textarea').pressSequentially('jkfgG');assert.equal(await frame.locator('#follow').getAttribute('aria-pressed'),'true');
  await page.evaluate(()=>window.fixtureHoldNextMessage=true);await frame.locator('#message textarea').fill('In-flight message for the first swarm.');await frame.locator('#message select').selectOption('verifier');const requestsBefore=await page.evaluate(()=>window.fixtureMessageRequests);await frame.locator('#message button').click();await page.waitForFunction(()=>window.fixturePendingMessage!==null);assert.equal(await frame.locator('#message button').isDisabled(),true);await frame.locator('#message').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(await page.evaluate(()=>window.fixtureMessageRequests),requestsBefore+1);
  await frame.locator('#message textarea').fill('Next draft on the first swarm.');await frame.locator('#message select').selectOption('coordinator');await page.evaluate(()=>{const second=JSON.parse(JSON.stringify(window.fixtureData));second.id='test-two';second.key='SWARM-2';second.title='Second test swarm';window.fixtureSwarms.push(second);});await frame.locator('#refresh').evaluate(el=>el.click());await frame.locator('#swarmSelect').waitFor();await frame.locator('#swarmSelect').selectOption('test-two');await frame.locator('#message textarea').fill('Draft for the second swarm.');await frame.locator('#message select').selectOption('shell-builder');const listsBeforeResolve=await page.evaluate(()=>window.fixtureListRequests);await page.evaluate(()=>window.fixtureResolveMessage());await page.waitForFunction(before=>window.fixtureListRequests>before,listsBeforeResolve);await frame.locator('#swarmSelect').selectOption('test');await page.waitForFunction(()=>!document.querySelector('#guest').contentDocument.querySelector('#message button').disabled);assert.equal(await frame.locator('#message textarea').inputValue(),'Next draft on the first swarm.');assert.equal(await frame.locator('#message select').inputValue(),'coordinator');await frame.getByText('In-flight message for the first swarm.').waitFor();await frame.locator('#swarmSelect').selectOption('test-two');assert.equal(await frame.locator('#message textarea').inputValue(),'Draft for the second swarm.');assert.equal(await frame.locator('#message select').inputValue(),'shell-builder');await frame.locator('#swarmSelect').selectOption('test');await page.setViewportSize({width:660,height:900});
 await frame.locator('[data-tab=Members]').click();await frame.getByRole('heading',{name:'Needs attention (1)'}).waitFor();await frame.getByText('Needs a file-system permission before continuing.').waitFor();await page.screenshot({path:'.dev/attention.png'});await frame.locator('.attention-open').click();await page.waitForFunction(()=>window.fixtureOpenedSessions.includes('ses_1'));await frame.getByText('Standing by (2)').waitFor();await frame.locator('[data-tab=Graph]').click();await frame.locator('svg.graph .node').first().waitFor();assert.equal(await frame.locator('svg.graph .node').count(),5);assert.equal(await frame.locator('svg.graph .bee-icon').count(),5);await page.screenshot({path:'.dev/hive.png'});
 const bounds=async()=>{const b=await frame.locator('.replay-post').boundingBox();return {y:b.y,height:b.height};};
 const positions=()=>frame.locator('svg.graph [data-node]').evaluateAll(els=>els.map(el=>[el.dataset.node,el.getAttribute('transform')]));
 const initialPositions=await positions(),initialBounds=await bounds();
 await frame.locator('svg.graph [data-node=coordinator]').evaluate(el=>el.ownerDocument.defaultView.testNode=el);
 await frame.locator('#first').click();assert.deepEqual(await positions(),initialPositions);assert.deepEqual(await bounds(),initialBounds);assert.ok(await frame.getByText('Before the first post').isVisible());
 await frame.locator('#next').click();assert.deepEqual(await positions(),initialPositions);assert.deepEqual(await bounds(),initialBounds);
 await frame.locator('#live').click();assert.deepEqual(await bounds(),initialBounds);
 // No full SVG replacement while stepping, even when edges disappear.
 assert.ok(await frame.locator('svg.graph [data-node=coordinator]').evaluate(el=>el===el.ownerDocument.defaultView.testNode));
 assert.ok((await frame.locator('.graph-canvas').boundingBox()).height<=324);
 const checkZoom=async()=>{
  const geom=()=>frame.locator('svg.graph').evaluate(el=>{const v=el.viewBox.baseVal,c=el.createSVGPoint();c.x=v.x+v.width/2;c.y=v.y+v.height/2;const p=c.matrixTransform(el.getScreenCTM()),b=el.getBoundingClientRect();return {centerX:p.x,centerY:p.y,screenX:b.x+b.width/2,screenY:b.y+b.height/2,width:v.width,height:v.height,viewport:b.height};});
  const before=await geom(),message=await bounds();
  await frame.locator('#plus').click();await frame.locator('#plus').click();
  const zoomed=await geom();assert.ok(zoomed.width<before.width&&zoomed.height<before.height);
  assert.ok(Math.abs(zoomed.centerX-before.centerX)<1&&Math.abs(zoomed.centerY-before.centerY)<1);
  assert.ok(Math.abs(zoomed.centerX-zoomed.screenX)<1&&Math.abs(zoomed.centerY-zoomed.screenY)<1);
  assert.equal(zoomed.viewport,before.viewport);assert.deepEqual(await bounds(),message);
  await frame.locator('#fit').click();assert.deepEqual(await geom(),before);
 };
 await checkZoom();

 await frame.locator('[data-mode=Mentions]').click();await page.screenshot({path:'.dev/mentions.png'});const mentionPositions=await positions(),mentionBounds=await bounds();await frame.locator('#first').click();await frame.locator('#next').click();assert.deepEqual(await positions(),mentionPositions);assert.deepEqual(await bounds(),mentionBounds);await frame.locator('#live').click();assert.deepEqual(await bounds(),mentionBounds);assert.equal(mentionBounds.y,initialBounds.y);await checkZoom();await frame.locator('[data-node=verifier]').click();await frame.getByText('Open conversation',{exact:false}).waitFor();assert.deepEqual(errors,[]);await page.setViewportSize({width:360,height:780});await frame.locator('[data-mode=Hive]').click();await page.screenshot({path:'.dev/mobile-hive.png'});assert.ok((await bounds()).y<700);assert.ok((await frame.locator('.graph-canvas').boundingBox()).height<=260);await checkZoom();await frame.getByRole('button',{name:'Swarm model settings'}).click();for(const role of ['coordinator','worker','verifier','monitor'])await frame.locator('input[name='+role+'Model]').fill('test/'+role);await frame.locator('input[name=monitorReasoning]').check();await page.screenshot({path:'.dev/settings.png'});await frame.getByRole('button',{name:'Save',exact:true}).click();await frame.getByRole('button',{name:'Delete swarm',exact:true}).click();await frame.getByRole('heading',{name:'Delete SWARM-1?'}).waitFor();await frame.getByRole('button',{name:'Cancel',exact:true}).click();await frame.locator('[data-tab=Board]').click();await page.screenshot({path:'.dev/mobile-board.png'});assert.ok(await frame.locator('.board-tools').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await frame.locator('[data-tab=Members]').click();await frame.locator('.attention-open').waitFor();assert.ok((await frame.locator('.attention-open').boundingBox()).height>=40);await page.screenshot({path:'.dev/mobile-attention.png'});await frame.locator('[data-tab=Overview]').click();const sticky=await frame.locator('.sticky-top').evaluate(el=>getComputedStyle(el).position);assert.equal(sticky,'sticky');await frame.locator('body').evaluate(el=>{el.ownerDocument.defaultView.scrollTo(0,300);});await page.waitForTimeout(100);assert.ok((await frame.locator('.sticky-top').boundingBox()).y<5);assert.deepEqual(errors,[]);console.log('Browser smoke passed: settings, deletion confirmation, sticky navigation; overview, board, members, both graphs, node interaction, mobile.');}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exit(1);});
