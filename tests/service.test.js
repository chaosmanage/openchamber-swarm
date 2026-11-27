import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import plugin from '../plugin/index.js';
const listen=s=>new Promise(r=>s.listen(0,'127.0.0.1',()=>r(s.address().port)));
const wait=async(fn,ms=6000)=>{const end=Date.now()+ms;while(Date.now()<end){const x=await Promise.resolve().then(fn).catch(()=>null);if(x)return x;await new Promise(r=>setTimeout(r,30));}throw Error('Timed out');};
test('scoped native bridge, implicit context, sleeping wake, busy delivery, monitor and restart',async(t)=>{
 const dir=await mkdtemp(path.join(tmpdir(),'swarm-test-'));const calls=[],statuses=new Map(),nativeCalls=[],contexts=new Map();
 const host=http.createServer(async(req,res)=>{let s='';for await(const c of req)s+=c;const {method,input}=JSON.parse(s);calls.push({method,input});let result={ok:true};if(method==='sessions.status')result={status:statuses.get(input.sessionId)||'idle'};if(method==='sessions.stop'){statuses.set(input.sessionId,'idle');result={stopped:true};}res.setHeader('Content-Type','application/json');res.end(JSON.stringify({result}));});
 const hp=await listen(host);const probe=http.createServer();const port=await listen(probe);await new Promise(r=>probe.close(r));
 const config={...process.env,HOME:dir,OPENCHAMBER_SERVICE_PORT:String(port),OPENCHAMBER_SERVICE_TOKEN:'test-token',OPENCHAMBER_SERVICE_DATA_DIR:dir,OPENCHAMBER_HOST_CALLBACK_URL:'http://127.0.0.1:'+hp,SWARM_TEST_INTERVAL_MS:'150',SWARM_TEST_STALL_MS:'900',SWARM_TEST_REMINDER_MS:'2000'};
 let proc=spawn(process.execPath,['src/service.js'],{env:config,stdio:'ignore'}),quit=false,bridge;
 t.after(async()=>{quit=true;await bridge;proc.kill();await new Promise(r=>host.close(r));await rm(dir,{force:true,recursive:true});});
 const req=async(p,b)=>{const r=await fetch('http://127.0.0.1:'+port+p,{method:b?'POST':'GET',headers:{Authorization:'Bearer test-token','Content-Type':'application/json'},...(b?{body:JSON.stringify(b)}:{})});const v=await r.json();assert.equal(r.status,200,JSON.stringify(v));return v;};
 await wait(()=>req('/health'));
 const agent=(sessionId,action,input)=>req('/agent',{sessionId,action,input});
 const inject=async(id)=>{const context=await req('/context',{sessionId:id,directory:'/repo'});if(!context.text)return null;contexts.set(id,context);await req('/context/ack',{sessionId:id,ids:context.ids});return context;};
 const s=await req('/start',{task:'Implement test',directory:'/repo',sessionId:null});
 const state=async()=> (await req('/list?directory=%2Frepo'))[0];
 const member=async n=>(await state()).members.find(m=>m.name===n);
 assert.equal((await req('/bridge/poll',{directory:'/other-project'})).job,null);
 bridge=(async()=>{while(!quit){try{
  assert.equal((await req('/bridge/poll',{directory:'/other-project'})).job,null);
  const {job}=await req('/bridge/poll',{directory:'/repo'});
  if(job){nativeCalls.push(job);let result;if(job.op==='create'){result={id:job.input.id,model:job.input.model||{providerID:'test',id:'selected'}};statuses.set(result.id,'idle');}else if(job.op==='get'){result={id:job.input.sessionID,model:{providerID:'test',id:'selected'}};}else if(job.op==='switch-model'){result={ok:true};}else if(job.op==='review'){result={text:'Check the remaining verifier report.'};}else{assert.ok(['seed','wake'].includes(job.op));statuses.set(job.input.sessionID,'busy');result={id:job.input.id};}await req('/bridge/result',{id:job.id,result});if(['seed','wake'].includes(job.op))await inject(job.input.sessionID);}
 }catch(e){if(!quit&&e.code==='ERR_ASSERTION')throw e;}await new Promise(r=>setTimeout(r,20));}})();
  const coord=await wait(async()=>{const m=await member('coordinator');return m.state==='active'&&m.pending===0&&m;});
  await wait(()=>contexts.get(coord.sessionId));
 assert.ok(coord.sessionId.startsWith('ses_'));assert.ok(nativeCalls.some(c=>c.op==='seed'&&c.input.sessionID===coord.sessionId&&c.input.text==='Implement test'));assert.equal(coord.model,'test/selected');assert.match(contexts.get(coord.sessionId).text,/Implement test/);
 await agent(coord.sessionId,'add',{name:'fix-1',brief:'Fix issue',paths:['x.js']});
 await agent(coord.sessionId,'add',{name:'verify',brief:'Check work',role:'verifier',deferred:true});
 const w=await wait(async()=>{const m=await member('fix-1');return m?.state==='active'&&m.pending===0&&m;});
 assert.match(contexts.get(w.sessionId).text,/Fix issue/);assert.equal(w.model,'test/selected');assert.ok(nativeCalls.some(c=>c.op==='create'&&c.input.id===w.sessionId&&c.input.parentID===coord.sessionId&&c.input.title==='@fix-1'));
 assert.equal((await member('verify')).sessionId,null);
 assert.deepEqual((await req('/context',{sessionId:w.sessionId,directory:'/other-project'})),{ok:true});
 await agent(coord.sessionId,'post',{text:'@fix-1 Extra acceptance criterion'});
 await wait(async()=> (await member('fix-1')).pending===1);
 const before=nativeCalls.filter(c=>['seed','wake'].includes(c.op)&&c.input.sessionID===w.sessionId).length;
 const busyUpdate=await inject(w.sessionId);assert.match(busyUpdate.text,/Extra acceptance criterion/);assert.equal((await member('fix-1')).pending,0);assert.equal(nativeCalls.filter(c=>['seed','wake'].includes(c.op)&&c.input.sessionID===w.sessionId).length,before);
 const end=async(id)=>{statuses.set(id,'idle');await req('/idle',{sessionId:id,directory:'/repo'});};
 await end(w.sessionId);await end(coord.sessionId);
 await agent(coord.sessionId,'post',{text:'@fix-1 Resume with a second criterion'});
 // Test retry throttling without waiting real 10 seconds: monitor wakes once the grace period expires.
 const wake=await wait(()=>nativeCalls.filter(c=>['seed','wake'].includes(c.op)&&c.input.sessionID===w.sessionId)[1],15000);
 assert.equal(wake.op,'wake');assert.equal(wake.input.resume,true);assert.doesNotMatch(wake.input.text,/second criterion/);await wait(async()=>contexts.get(w.sessionId)?.text.includes('second criterion'));
 assert.equal((await member('fix-1')).sessionId,w.sessionId);
 await agent(w.sessionId,'post',{text:'@coordinator Test result',kind:'done'});
 await end(w.sessionId);
 await wait(()=>nativeCalls.filter(c=>['seed','wake'].includes(c.op)&&c.input.sessionID===coord.sessionId)[1],15000);await wait(async()=>contexts.get(coord.sessionId)?.text.includes('Test result'));
 await agent(coord.sessionId,'post',{text:'@verify Check independently'});
 const verifier=await wait(async()=>{const m=await member('verify');return m?.state==='active'&&m.pending===0&&m;});
 assert.match(contexts.get(verifier.sessionId).text,/Check independently/);
 await end(coord.sessionId);await end(verifier.sessionId);
 await wait(async()=> (await state()).posts.some(p=>p.from==='monitor'&&p.kind==='stall'),6000);
 assert.ok((await state()).monitor.checks>1);assert.ok((await state()).history.some(h=>h.state==='waiting'));
 const stall=(await state()).posts.find(p=>p.from==='monitor'&&p.kind==='stall');
 const monitored=(await state()).members.find(m=>m.name===stall.to[0]);
 await wait(()=>nativeCalls.find(c=>c.op==='wake'&&c.input.sessionID===monitored.sessionId&&c.input.metadata.posts.includes(stall.id)),15000);
 await wait(()=>contexts.get(monitored.sessionId)?.ids.includes(stall.id));
 assert.match(contexts.get(monitored.sessionId).text,/outstanding work/);

 await req('/stop',{id:s.id});assert.equal((await state()).status,'stopped');
 assert.equal(calls.filter(c=>['sessions.start','sessions.send'].includes(c.method)).length,0);
 await req('/settings',{coordinatorModel:'test/lead',workerModel:'test/worker',verifierModel:'test/verifier',monitorModel:'test/supervisor',monitorReasoning:true});
 const second=await req('/start',{task:'Role model settings test',directory:'/repo',sessionId:'ses_role_test',model:'picker/chosen',modelRef:{providerID:'picker',id:'chosen',variant:'high'}});
 const roleState=async()=> (await req('/list?directory=%2Frepo')).find(s=>s.id===second.id);
 const roleMember=async n=>(await roleState()).members.find(m=>m.name===n);
 await wait(async()=>{const m=await roleMember('coordinator');return m.state==='active'&&m.pending===0;});
 assert.equal((await roleMember('coordinator')).model,'test/lead');assert.equal((await roleState()).launchModel,'picker/chosen');
 assert.ok(nativeCalls.some(c=>c.op==='switch-model'&&c.input.model.id==='lead'));
 await agent('ses_role_test','add',{name:'role-worker',brief:'Worker test',role:'worker'});
 await agent('ses_role_test','add',{name:'role-verifier',brief:'Verifier test',role:'verifier'});
 await wait(async()=> (await roleMember('role-worker'))?.pending===0&&(await roleMember('role-verifier'))?.pending===0);
 assert.ok(nativeCalls.some(c=>c.op==='create'&&c.input.model?.id==='worker'));
 assert.ok(nativeCalls.some(c=>c.op==='create'&&c.input.model?.id==='verifier'));
 await end('ses_role_test');await end((await roleMember('role-worker')).sessionId);await end((await roleMember('role-verifier')).sessionId);
 await wait(()=>nativeCalls.find(c=>c.op==='review'&&c.input.model?.id==='supervisor'),6000);
 await wait(async()=> (await roleState()).monitor.review==='Review complete');
 await req('/delete',{id:second.id});
 await req('/settings',{});
 const third=await req('/start',{task:'Picker inheritance',directory:'/repo',sessionId:'ses_picker_test',model:'picker/chosen',modelRef:{providerID:'picker',id:'chosen',variant:'high'}});
 const pickerState=async()=> (await req('/list?directory=%2Frepo')).find(s=>s.id===third.id);
 await wait(async()=>{const m=(await pickerState()).members[0];return m.state==='active'&&m.pending===0;});
 assert.equal((await pickerState()).members[0].model,'picker/chosen');
 assert.ok(nativeCalls.some(c=>c.op==='switch-model'&&c.input.sessionID==='ses_picker_test'&&c.input.model.variant==='high'));
 await agent('ses_picker_test','add',{name:'picker-worker',brief:'Inherit exact variant',role:'worker'});
 await wait(()=>nativeCalls.find(c=>c.op==='create'&&c.input.parentID==='ses_picker_test'&&c.input.model?.id==='chosen'&&c.input.model.variant==='high'));
 await wait(async()=> (await pickerState()).members.find(m=>m.name==='picker-worker')?.state==='active'&&(await pickerState()).members.find(m=>m.name==='picker-worker')?.pending===0);
 // Direct worker-to-worker exchange: neither delivery nor wake requires the coordinator.
 const a=(await pickerState()).members.find(m=>m.name==='picker-worker');
 await agent('ses_picker_test','add',{name:'peer',brief:'Peer communication test',role:'worker'});
 const peer=await wait(async()=>{const m=(await pickerState()).members.find(m=>m.name==='peer');return m?.state==='active'&&m.pending===0&&m;});
 const count=id=>nativeCalls.filter(c=>['seed','wake'].includes(c.op)&&c.input.sessionID===id).length;
 const peerInitial=count(peer.sessionId),aInitial=count(a.sessionId);
 const busyPost=await agent(a.sessionId,'post',{text:'@peer Direct busy handoff: DELTA-42'});
 const received=await inject(peer.sessionId);
 assert.ok(received.ids.includes(busyPost.id));assert.match(received.text,/DELTA-42/);
 assert.equal(count(peer.sessionId),peerInitial);
 await end(peer.sessionId);
 await wait(async()=> (await pickerState()).members.find(m=>m.name==='peer').state==='waiting');
 const sleepPost=await agent(a.sessionId,'post',{text:'@peer Direct sleeping handoff: ECHO-73'});
 await wait(()=>nativeCalls.find(c=>c.op==='wake'&&c.input.sessionID===peer.sessionId&&c.input.metadata.posts.includes(sleepPost.id)),15000);
 await wait(()=>contexts.get(peer.sessionId)?.ids.includes(sleepPost.id));
 assert.match(contexts.get(peer.sessionId).text,/ECHO-73/);
 assert.equal((await pickerState()).members.find(m=>m.name==='peer').sessionId,peer.sessionId);
 await end(a.sessionId);
 const reply=await agent(peer.sessionId,'post',{text:'@picker-worker Direct reply: ACK-73'});
 await wait(()=>nativeCalls.find(c=>c.op==='wake'&&c.input.sessionID===a.sessionId&&c.input.metadata.posts.includes(reply.id)),15000);
 await wait(()=>contexts.get(a.sessionId)?.ids.includes(reply.id));
 assert.match(contexts.get(a.sessionId).text,/ACK-73/);
 assert.equal(count(a.sessionId),aInitial+1);
 assert.equal((await pickerState()).members.find(m=>m.name==='picker-worker').pending,0);
 await req('/delete',{id:third.id});

 quit=true;await bridge;proc.kill();await new Promise(r=>proc.once('exit',r));proc=spawn(process.execPath,['src/service.js'],{env:config,stdio:'ignore'});await wait(()=>req('/health'));assert.equal((await state()).status,'stopped');
 await req('/settings',{workerModel:'test/worker',verifierModel:'test/verifier'});
 assert.equal((await req('/settings')).workerModel,'test/worker');
 const next=await req('/start',{task:'Delete me',directory:'/repo',sessionId:'ses_cleanup',model:'test/selected'});
 await req('/session-deleted',{sessionId:'ses_cleanup',directory:'/repo'});
 assert.ok(!(await req('/list?directory=%2Frepo')).some(s=>s.id===next.id));
 await req('/delete',{id:s.id});assert.equal((await req('/list?directory=%2Frepo')).length,0);
});

// Exercise the real command and bridge against a host fixture. A native command
// itself contributes no user message; session.prompt admits one by message ID.
async function launchFixture(t,{failSeed=false,holdSeed=false}={}){
 const home=await mkdtemp(path.join(tmpdir(),'swarm-launch-')),oldHome=process.env.HOME;
 process.env.HOME=home;
 const statuses=new Map(),host=http.createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=c;const {method,input}=JSON.parse(raw);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({result:method==='sessions.status'?{status:statuses.get(input.sessionId)||'idle'}:{ok:true}}));});
 const hp=await listen(host),probe=http.createServer(),port=await listen(probe);await new Promise(r=>probe.close(r));
 const config={...process.env,HOME:home,OPENCHAMBER_SERVICE_PORT:String(port),OPENCHAMBER_SERVICE_TOKEN:'test-token',OPENCHAMBER_SERVICE_DATA_DIR:home,OPENCHAMBER_HOST_CALLBACK_URL:'http://127.0.0.1:'+hp,SWARM_TEST_INTERVAL_MS:'150',SWARM_TEST_STALL_MS:'600000'};
 const spawnService=()=>spawn(process.execPath,['src/service.js'],{env:config,stdio:'ignore'});
 let proc=spawnService(),cleanup;
 let release;const held=new Promise(r=>release=r);
 const req=async(p,b)=>{const r=await fetch('http://127.0.0.1:'+port+p,{method:b?'POST':'GET',headers:{Authorization:'Bearer test-token','Content-Type':'application/json'},...(b?{body:JSON.stringify(b)}:{})});const v=await r.json();assert.equal(r.status,200,JSON.stringify(v));return v;};
 t.after(async()=>{release();cleanup?.();if(proc.exitCode===null&&proc.signalCode===null){proc.kill();await new Promise(r=>proc.once('exit',r));}process.env.HOME=oldHome;await new Promise(r=>host.close(r));await rm(home,{recursive:true,force:true});});
 await wait(()=>req('/health'));
 const hooks={},commands=[],admissions=new Map(),attempts=[],synthetics=[],contexts=[],turns=[],agentSwitches=[],model={providerID:'picker',id:'chosen',variant:'high'};
 const sessionID='ses_native_launch',task='Build a launch fixture';
 const sessions=new Map([[sessionID,{id:sessionID,agent:'plan',model}]]);
 const runTurn=async({sessionID})=>{
  const {agent,model}=sessions.get(sessionID);
  turns.push({sessionID,agent,model});
  statuses.set(sessionID,'busy');
  const event={sessionID,agent,system:[],messages:[]};
  await hooks.context(event);
  contexts.push(event);
 };
 const ctx={location:{directory:'/repo'},session:{
  hook:async(n,f)=>hooks[n]=f,
  create:async({id,agent='plan',model:selected=model,parentID,title,permissions})=>{
   if(!sessions.has(id))sessions.set(id,{id,agent,model:selected,parentID,title,permissions:permissions??sessions.get(parentID)?.permissions});
   return {...sessions.get(id)};
  },
  get:async({sessionID})=>({...sessions.get(sessionID)}),
  update:async({sessionID,...update})=>{Object.assign(sessions.get(sessionID),update);},
  switchAgent:async input=>{agentSwitches.push(input);sessions.get(input.sessionID).agent=input.agent;},
  switchModel:async({sessionID,model})=>{sessions.get(sessionID).model=model;},
  prompt:async input=>{
   assert.ok(!Object.hasOwn(input,'agent'),'V2 does not accept an agent in prompt input');
   attempts.push(input);
   if(admissions.has(input.id))return admissions.get(input.id);
   const result={id:input.id,sessionID:input.sessionID,type:'user',text:input.text};admissions.set(input.id,result);
   await runTurn(input);
   if(holdSeed){holdSeed=false;await held;}
   if(failSeed){failSeed=false;throw Error('Simulated lost native acknowledgement');}
   return result;
  },
  synthetic:async input=>{
   assert.ok(!Object.hasOwn(input,'agent'),'V2 does not accept an agent in synthetic input');
   synthetics.push(input);
   await runTurn(input);
   return {id:input.id};
  }
 },event:{async *subscribe(){}},experimental:{generate:{text:async()=>({text:'Launch fixture'})}},command:{transform:async f=>f({add:c=>commands.push(c)})},tool:{transform:async f=>f({add(){}})}};
 cleanup=await plugin.setup(ctx);
 const command=()=>commands[0].execute({sessionID,prompt:{text:task},delivery:'queue'});
 const sendFromPlan=async composed=>{
  // OpenChamber applySendSelection persists model and agent before calling session.command.
  const [,name,text]=/^\/(\S+) ([\s\S]*)$/.exec(composed);
  await ctx.session.switchModel({sessionID,model});
  await ctx.session.switchAgent({sessionID,agent:'plan'});
  await commands.find(c=>c.name===name).execute({sessionID,prompt:{text},delivery:'queue'});
 };
 const state=async()=> (await req('/list?directory=%2Frepo'))[0];
 const restart=async(rewrite)=>{proc.kill('SIGKILL');await new Promise(r=>proc.once('exit',r));if(rewrite){const file=path.join(home,'swarms.json'),saved=JSON.parse(await readFile(file,'utf8'));rewrite(saved);await writeFile(file,JSON.stringify(saved));}proc=spawnService();await wait(()=>req('/health'));};
 return {req,command,sendFromPlan,state,sessionID,task,admissions,attempts,synthetics,contexts,statuses,ctx,release,restart,model,turns,agentSwitches};
}

test('compose then send /swarm from Plan launches one visible Build prompt and later resumes board work in Build',async t=>{
 const f=await launchFixture(t);
 // The panel composes "/swarm " + task; OpenChamber dispatches its argument to this native command.
 await f.sendFromPlan('/swarm '+f.task);
 await Promise.all([f.command(),f.command()]);
 const s=await f.state();assert.equal(s.posts.length,1);assert.deepEqual(s.posts.map(p=>[p.from,p.to,p.kind,p.text]),[['user',['coordinator'],'brief',f.task]]);
 await wait(()=>f.admissions.size===1);await wait(async()=> (await f.state()).members[0].seeded);
 assert.equal(f.attempts.length,1);assert.equal(f.attempts[0].text,f.task);assert.equal(f.attempts[0].delivery,'queue');assert.equal(f.attempts[0].metadata.initial,true);
 assert.equal((await f.state()).launchModel,'picker/chosen');assert.equal((await f.state()).launchModelRef.variant,'high');
 assert.deepEqual(f.agentSwitches,[{sessionID:f.sessionID,agent:'plan'},{sessionID:f.sessionID,agent:'build'}]);
 assert.deepEqual(f.turns[0],{sessionID:f.sessionID,agent:'build',model:f.model});
 assert.equal(f.contexts[0].messages.length,0);assert.equal(f.contexts[0].system[0].text.split(f.task).length-1,1);
 assert.ok(f.contexts[0].system[0].text.includes('SwarmActivity('+JSON.stringify(s.id)+')'));
 assert.equal((await f.state()).members[0].pending,0);assert.equal((await f.state()).turns,1);
 f.statuses.set(f.sessionID,'idle');await f.req('/idle',{sessionId:f.sessionID,directory:'/repo'});
 await new Promise(r=>setTimeout(r,350));assert.equal(f.synthetics.length,0);
 // A regular user turn with identical text is a different native message, not a duplicate launch.
 await f.ctx.session.prompt({sessionID:f.sessionID,id:'msg_later_user_turn',text:f.task});
 assert.equal(f.admissions.size,2);assert.equal([...f.admissions.values()].filter(m=>m.text===f.task).length,2);
 // An addressed board post with identical text is also a new event and wakes normally.
 f.statuses.set(f.sessionID,'idle');await f.req('/idle',{sessionId:f.sessionID,directory:'/repo'});
 await f.ctx.session.switchAgent({sessionID:f.sessionID,agent:'plan'});
 await f.req('/message',{id:s.id,to:'coordinator',text:f.task});
 await wait(()=>f.synthetics.length===1,15000);await wait(()=>f.contexts.at(-1)?.system[0]?.text.includes('"kind":"instruction"'));
 assert.deepEqual(f.turns.at(-1),{sessionID:f.sessionID,agent:'build',model:f.model});
 assert.equal((await f.state()).posts.length,2);assert.match(f.contexts.at(-1).system[0].text,/"kind":"instruction"/);
});

test('worker and verifier start in Build with role models and inherited approvals; ordinary Plan is unaffected',async t=>{
 const f=await launchFixture(t);
 const coordinator={providerID:'custom',id:'lead'},worker={providerID:'custom',id:'worker'};
 const permissions=[{action:'shell',resource:'*',effect:'ask'}];
 await f.ctx.session.update({sessionID:f.sessionID,permissions});
 await f.req('/settings',{coordinatorModel:'custom/lead',workerModel:'custom/worker'});
 await f.command();await wait(async()=> (await f.state()).members[0].seeded);
 assert.deepEqual(f.turns[0],{sessionID:f.sessionID,agent:'build',model:coordinator});

 const agent=(action,input)=>f.req('/agent',{sessionId:f.sessionID,action,input});
 await agent('add',{name:'worker',brief:'Make the change',role:'worker'});
 await agent('add',{name:'verify',brief:'Check the change',role:'verifier',deferred:true});
 const member=async name=>(await f.state()).members.find(m=>m.name===name);
 const seeded=async name=>wait(async()=>{const m=await member(name);return m?.seeded&&m;});
 const work=await seeded('worker');
 assert.equal((await member('verify')).sessionId,null);
 await agent('post',{text:'@verify Start independent verification'});
 const verifier=await seeded('verify');
 for(const [m,model] of [[work,worker],[verifier,f.model]]){
  const info=await f.ctx.session.get({sessionID:m.sessionId});
  assert.equal(info.parentID,f.sessionID);assert.deepEqual(info.permissions,permissions);
  assert.deepEqual(f.turns.find(turn=>turn.sessionID===m.sessionId),{sessionID:m.sessionId,agent:'build',model});
 }
 assert.deepEqual(f.agentSwitches,[{sessionID:f.sessionID,agent:'build'}]);
 assert.deepEqual((await f.ctx.session.get({sessionID:f.sessionID})).permissions,permissions);

 f.statuses.set(work.sessionId,'waiting-permission');
 await f.req('/session-events',{event:{id:'approval-1',type:'permission-asked',session:{id:work.sessionId}}});
 await f.req('/message',{id:(await f.state()).id,to:work.name,text:'Resume after approval'});
 const blocked=await member(work.name);
 assert.equal(blocked.state,'blocked');assert.equal(blocked.error,'Tool approval required');
 assert.equal(f.synthetics.length,0);

 const ordinaryID='ses_ordinary_plan';
 await f.ctx.session.create({id:ordinaryID,agent:'plan'});
 await f.ctx.session.prompt({sessionID:ordinaryID,id:'msg_ordinary_plan',text:'Plan a regular task'});
 assert.deepEqual(f.turns.at(-1),{sessionID:ordinaryID,agent:'plan',model:f.model});
 assert.deepEqual(f.contexts.at(-1).system,[]);
 assert.deepEqual(f.agentSwitches,[{sessionID:f.sessionID,agent:'build'}]);
});

test('a lost start acknowledgement can be retried as the same native command',async t=>{
 const f=await launchFixture(t),originalFetch=globalThis.fetch;let drop=true;
 try{
  globalThis.fetch=async(url,options)=>{const response=await originalFetch(url,options);if(drop&&String(url).endsWith('/start')){drop=false;await response.text();throw new TypeError('Simulated lost response');}return response;};
  await assert.rejects(f.command(),/could not be confirmed.*retry the same \/swarm/i);
 }finally{globalThis.fetch=originalFetch;}
 await f.command();
 await wait(()=>f.admissions.size===1);await wait(async()=> (await f.state()).members[0].seeded);
 assert.equal(f.attempts.length,1);assert.equal((await f.state()).turns,1);assert.equal((await f.state()).posts.length,1);
 await assert.rejects(f.req('/start',{sessionId:f.sessionID,directory:'/repo',task:'A different task'}),/already belongs/);
});

test('lost seed acknowledgement blocks with recovery and retry reuses the admitted prompt ID',async t=>{
 const f=await launchFixture(t,{failSeed:true});await f.command();
 const blocked=await wait(async()=>{const s=await f.state();return s.members[0].state==='blocked'&&s;});
 assert.match(blocked.members[0].error,/uncertain.*Retry/);assert.equal(f.admissions.size,1);assert.equal(f.attempts.length,1);assert.equal(blocked.posts.length,1);
 await new Promise(r=>setTimeout(r,350));assert.equal(f.attempts.length,1);
 await f.ctx.session.switchAgent({sessionID:f.sessionID,agent:'plan'});
 f.statuses.set(f.sessionID,'idle');await f.req('/retry',{id:blocked.id,name:'coordinator'});
 await wait(()=>f.attempts.length===2);await wait(async()=> (await f.state()).members[0].seeded);
 assert.equal(f.attempts[0].id,f.attempts[1].id);assert.equal(f.admissions.size,1);assert.equal((await f.state()).turns,1);assert.equal((await f.state()).posts.length,1);assert.equal(f.synthetics.length,0);
 assert.deepEqual(f.agentSwitches.at(-1),{sessionID:f.sessionID,agent:'build'});
});

test('restart after seed admission exposes recovery instead of silently replaying',async t=>{
 const f=await launchFixture(t,{holdSeed:true});await f.command();await wait(()=>f.admissions.size===1);
 await f.restart();const blocked=await wait(async()=>{const s=await f.state();return s.members[0].state==='blocked'&&s;});
 assert.match(blocked.members[0].error,/uncertain.*Retry/);assert.equal(blocked.posts.length,1);
 f.release();await new Promise(r=>setTimeout(r,1200));assert.equal(f.attempts.length,1);
 f.statuses.set(f.sessionID,'idle');await f.req('/retry',{id:blocked.id,name:'coordinator'});
 await wait(()=>f.attempts.length===2);await wait(async()=> (await f.state()).members[0].seeded);
 assert.equal(f.attempts[0].id,f.attempts[1].id);assert.equal(f.admissions.size,1);assert.equal((await f.state()).turns,1);assert.equal(f.synthetics.length,0);
});

test('worker seed retry survives a lost acknowledgement after its brief was consumed',async t=>{
 const f=await launchFixture(t);await f.command();await wait(async()=> (await f.state()).members[0].seeded);
 const original=f.ctx.session.prompt;let failWorker=true;
 f.ctx.session.prompt=async input=>{const result=await original(input);if(failWorker&&input.text.startsWith('Start your worker')){failWorker=false;throw Error('Lost worker acknowledgement');}return result;};
 await f.req('/agent',{sessionId:f.sessionID,action:'add',input:{name:'worker',brief:'Do the worker task',paths:['src/work']}});
 const blocked=await wait(async()=>{const s=await f.state(),m=s.members.find(m=>m.name==='worker');return m?.state==='blocked'&&{s,m};});
 assert.equal(blocked.m.pending,0);assert.match(blocked.m.error,/uncertain.*Retry/);
 const attempts=()=>f.attempts.filter(a=>a.sessionID===blocked.m.sessionId);
 assert.equal(attempts().length,1);f.statuses.set(blocked.m.sessionId,'idle');
 await f.req('/retry',{id:blocked.s.id,name:'worker'});await wait(()=>attempts().length===2);
 await wait(async()=> (await f.state()).members.find(m=>m.name==='worker').seeded);
 assert.equal(attempts()[0].id,attempts()[1].id);assert.equal([...f.admissions.values()].filter(a=>a.sessionID===blocked.m.sessionId).length,1);
 assert.equal((await f.state()).posts.length,2);assert.equal(f.synthetics.length,0);
});

test('legacy launch-brief migration preserves a later identical addressed instruction',async t=>{
 const f=await launchFixture(t);await f.command();await wait(async()=> (await f.state()).members[0].seeded);f.statuses.set(f.sessionID,'idle');
 await f.ctx.session.switchAgent({sessionID:f.sessionID,agent:'plan'});
 await f.restart(saved=>{
  const s=saved.swarms[0],m=s.members[0];delete s.launchPostId;delete m.seeded;
  m.initialized=true;m.state='waiting';m.queue=[1,2];m.acked=[];m.retryAt=0;
  s.posts.push({id:2,at:Date.now(),from:'user',to:['coordinator'],kind:'instruction',text:s.task});
 });
 await wait(()=>f.synthetics.length===1);await wait(()=>f.contexts.at(-1)?.system[0]?.text.includes('"kind":"instruction"'));
 assert.equal(f.turns.at(-1).agent,'build');
 assert.deepEqual(f.synthetics[0].metadata.posts,[2]);assert.equal(f.attempts.length,1);assert.equal((await f.state()).posts.length,2);
});
