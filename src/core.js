import { randomUUID } from 'node:crypto';
export const MAX_MEMBERS=12, MAX_POSTS=500, MAX_TURNS=100;
export const COORDINATOR = 'You are @coordinator of a collaborative swarm. Use swarm_add to create 2-4 independently scoped workers and at least one verifier (deferred until needed). Assign nonoverlapping paths and explicit acceptance tests. Use swarm_post for every brief, question, correction and report. Address posts via @mentions in text or the to field. Incoming board posts are injected automatically into your model context; swarm_read is optional for full history. Do not implement yourself. Read swarm_status and swarm_read. Workers sleep when their turn ends; mentioning them wakes them. When all workers report, ask verifier to independently check evidence and tests, route any corrections to owners, and reverify. Call swarm_finish ONLY after verifier has explicitly posted a passing result, or explicitly report unresolved failure. End turns promptly while waiting. Never claim unverified success.';
export const memberPrompt=(s,m)=>'You are @'+m.name+' ('+m.role+') in swarm '+s.key+'. Objective: '+s.task+'\nYour brief: '+m.brief+'\nOwned paths: '+(m.paths.join(', ')||'read-only or as scoped by brief')+'\nBoard mentions are delivered automatically to your context; use swarm_read for history and swarm_post to send messages with recipient names or @mentions in the text, and swarm_status to see members. Post evidence, file paths, tests, and blockers. End the turn after reporting; wait for a new mention. Never edit outside assigned scope or weaken tests. '+(m.role==='verifier'?'Independently check diffs, evidence, and tests. Post kind=verified only if all acceptance criteria pass; otherwise kind=changes with recipients of offending workers. Send the final result to coordinator.':'Send kind=done when work is ready for independent verification, not when the whole swarm is complete.');
export function shortTitle(task){
 const first=String(task).trim().split(/\n|[.!?](?:\s|$)/)[0].trim().replace(/^(?:please\s+)?(?:create|build|make|develop|implement|write|design)\s+(?:me\s+)?(?:a[n]?\s+)?/i,'');
 const t=first.split(/\s+/).slice(0,9).join(' ').slice(0,64).trim()||'Collaborative task';
 return t[0].toUpperCase()+t.slice(1);
}
export function createSwarm({task,directory,sessionId,model,number}){
 if(typeof task!=='string'||!task.trim()||task.length>12000||typeof directory!=='string'||!directory||(sessionId!=null&&typeof sessionId!=='string'))throw Error('Task and project directory are required');
 return {id:randomUUID(),key:'SWARM-'+number,title:shortTitle(task),task:task.trim(),directory,created:Date.now(),updated:Date.now(),status:'running',turns:0,posts:[],seenEvents:[],members:[{name:'coordinator',role:'coordinator',sessionId:sessionId||null,model:model||'',state:'active',brief:task,paths:[],queue:[],lastPost:0,read:0,taskState:'working'}],summary:'',monitorAt:0,monitor:{checks:0,lastCheck:0,nextCheck:0,action:'Starting',lastAction:0},history:[]};
}
export function addMember(s,input){
 const name=String(input.name||'').replace(/^@/,'').toLowerCase();
 if(!/^[a-z][a-z0-9-]{0,29}$/.test(name)||['all','monitor','coordinator','user'].includes(name)||s.members.some(m=>m.name===name))throw Error('Use a unique valid worker name');
 if(s.members.length>=MAX_MEMBERS)throw Error('Member limit reached');
 const role=input.role==='verifier'?'verifier':'worker', brief=String(input.brief||'').trim().slice(0,10000);
 if(!brief)throw Error('Brief required');
 const paths=Array.isArray(input.paths)?input.paths.map(String).slice(0,40):[];
 if(paths.some(p=>p.startsWith('/')||p.split('/').includes('..')||p.includes('\\')))throw Error('Paths must be relative');
 if(role==='worker'&&paths.some(p=>s.members.some(m=>m.role==='worker'&&m.state!=='retired'&&m.paths.some(q=>p===q||p.startsWith(q+'/')||q.startsWith(p+'/')))))throw Error('Overlapping ownership');
 const m={name,role,brief,paths,model:String(input.model||s.members[0].model||''),sessionId:null,state:'waiting',queue:[],lastPost:0,read:0,taskState:'queued',deferred:!!input.deferred};
 s.members.push(m); return m;
}
export function appendPost(s,from,to,text,kind='message',wake=true){
 if(s.posts.length>=MAX_POSTS)throw Error('Board post limit reached');
 if(typeof text!=='string'||!text.trim()||text.length>20000)throw Error('Post must contain 1–20000 characters');
 const explicit=(Array.isArray(to)?to:[to]).filter(Boolean).map(x=>String(x).replace(/^@/,'').toLowerCase());
 const mentions=kind==='brief'?[]:[...text.matchAll(/(?<![\w@])@([a-z][a-z0-9-]{0,29})\b/gi)].map(x=>x[1].toLowerCase()).filter(x=>x==='all'||s.members.some(m=>m.name===x||m.name.startsWith(x+'-')));
 const requested=[...new Set([...explicit,...mentions])];
 const recipients=[...new Set(requested.flatMap(x=>x==='all'?s.members.filter(m=>m.name!==from&&m.state!=='retired').map(m=>m.name):s.members.some(m=>m.name===x)?[x]:s.members.filter(m=>m.name.startsWith(x+'-')).map(m=>m.name)))];
 if(requested.some(x=>x!=='all'&&!s.members.some(m=>m.name===x||m.name.startsWith(x+'-'))))throw Error('Unknown recipient');
 // Unaddressed posts are board-only; no unsolicited wake-ups.
 const p={id:s.posts.length+1,at:Date.now(),from,to:recipients,text:text.trim(),kind}; s.posts.push(p);s.updated=p.at;
 const author=s.members.find(m=>m.name===from); if(author){author.lastPost=p.id;author.read=p.id;if(kind==='done')author.taskState='reported';if(kind==='verified'&&author.role==='verifier')author.taskState='verified';if(kind==='changes'&&author.role==='verifier')author.taskState='changes';}
 if(wake)for(const name of recipients){const m=s.members.find(x=>x.name===name);if(m&&m.name!==from&&m.state!=='retired'){m.queue.push(p.id);m.deferred=false;if(['brief','changes','instruction'].includes(kind)&&m.role!=='coordinator')m.taskState='working';}}
 return p;
}
export const publicSwarm=s=>({...s,seenEvents:undefined,members:s.members.map(({queue,acked,modelRef,...m})=>({...m,pending:queue.length}))});
export function finish(s,summary,failed=false){
 if(!failed){const isVerifier=name=>s.members.some(m=>m.name===name&&m.role==='verifier'),verify=s.posts.findLast(p=>isVerifier(p.from)&&['verified','changes'].includes(p.kind));if(!verify||verify.kind!=='verified')throw Error('Independent verification required');if(s.members.some(m=>m.role==='worker'&&m.state!=='retired'&&m.taskState!=='reported'))throw Error('Workers have not all reported');
  // A verifier's own posts after its verified result (its done summary) are not new work.
  if(s.posts.some(p=>p.id>verify.id&&p.kind==='done'&&!isVerifier(p.from)))throw Error('New work after verification; verify again');}
 s.status=failed?'failed':'done';s.summary=String(summary||'').slice(0,20000);s.updated=Date.now();
}
export function delivery(s,m){return m.queue.map(id=>s.posts.find(p=>p.id===id)).filter(Boolean).map(p=>'#'+p.id+' @'+p.from+' → '+p.to.map(x=>'@'+x).join(', ')+' ['+p.kind+']\n'+p.text).join('\n\n');}

export function recordState(s,m,reason){s.history??=[];const last=s.history.findLast(x=>x.name===m.name);if(last?.state===m.state&&last?.taskState===m.taskState)return;s.history.push({at:Date.now(),post:s.posts.length,name:m.name,state:m.state,taskState:m.taskState,reason});if(s.history.length>3000)s.history.splice(0,s.history.length-3000);}
