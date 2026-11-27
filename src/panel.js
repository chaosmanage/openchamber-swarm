import {connectHost} from '@openchamber/sdk';
import {graphCamera,layoutGraph,collectEdges,edgeGeometry,graphMotion,memberCue} from './graph-layout.js';
const host=connectHost(), root=document.getElementById('app');
let requestedSwarm='';
let lastFeedCount=0;
let boardSwarm='',newPosts=0,followScroll=false,jumpLatest=false,renderedSwarmId='',resetScrollOnRender=false;
const boardDrafts=new Map();
const sendingMessages=new Set();
const overviewDisclosures=new Map();
let directory=null,session=null,swarms=[],selected='',tab='Overview',mode='Hive',filter='',memberFilter='',replay=null,playing=false,timer=null,error='',loading=false,ready=false,graphMember='',follow=true,memberSearch='',hideInactive=false,zoomLevel=1,pace=1,newFormOpen=false,graphExpanded=false,settingsOpen=false,deleteConfirm=false,stopConfirm=false,swarmSettings={coordinatorModel:'',workerModel:'',verifierModel:'',monitorModel:'',monitorReasoning:false},availableModels=[];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=t=>new Date(t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
const blockReason=m=>m.error||m.blockedReason||m.pendingReason||m.lastReply||'This member is blocked and needs intervention.';
const palette=['#f5bb51','#e3cc55','#f47a6b','#b66af0','#68bbd5','#75c47e','#eaa75b','#a5a2ec','#e68aa5','#69c8df','#d5a9df','#b0b9c9'];
const roleColor=(m,i=0)=>m.role==='coordinator'?'#f9be51':m.role==='verifier'?'#7793f9':m.role==='monitor'?'#bd9afa':palette[(i+1)%palette.length];
const glyphs={Overview:'◉',Board:'▤',Members:'♟',Graph:'⬡',coordinator:'♛',monitor:'◈',verifier:'✓',worker:'✦',brief:'▣',done:'✓',verified:'✓',changes:'↺',question:'?',blocker:'!',report:'▤',stall:'◈',instruction:'➜',message:'↗'};
const status=s=>'<span class="pill '+esc(s)+'"><i class="dot"></i>'+esc(({waiting:'Standing by',dispatching:'Waking',active:'Working',retired:'Retired',running:'Live',done:'Complete',blocked:'Needs attention',stopped:'Stopped',paused:'Paused',failed:'Failed'})[s]||s)+'</span>';
function bee(m,i=0,large=false){
 const c=roleColor(m,i),sleep=m.state==='waiting',retired=m.state==='retired',blocked=m.state==='blocked',active=['active','dispatching'].includes(m.state);
 const cls=retired?'retired-bee':sleep?'dozing':blocked?'bee-blocked':active?'flying':'resting';
 return '<svg class="bee-icon '+cls+'" viewBox="0 0 48 42" width="'+(large?64:38)+'" height="'+(large?56:34)+'" aria-hidden="true" shape-rendering="crispEdges"><g class="bee-flight"><g class="bee-wing far"><path fill="#484455" d="M24 17h-4V9h-3V5h3V2h7v3h4v8h-3v5z"/><path fill="#a0b6ce" d="M22 5h4v3h3v5h-5v4h-2V9h-2z"/><path fill="#e3ebfa" d="M23 5h3v3h-3z"/></g><g class="bee-wing near"><path fill="#4b485a" d="M26 17v-6h3V7h4V4h8v3h3v7h-4v4H29z"/><path fill="#c6d9ee" d="M30 12V9h4V6h6v3h2v4h-4v3h-8z"/><path fill="#f2f5ff" d="M34 7h6v3h-6z"/></g><g class="bee-body"><path fill="#27232c" d="M5 16h4v-3h10v2h13v3h5v3h4v8h-4v4h-6v4H12v-3H7v-4H3V20h2z"/><path fill="'+c+'" d="M20 17h11v3h5v3h3v5h-3v3h-6v4H17v-4h3z"/><path fill="#fff1c5" opacity=".6" d="M20 17h11v3h-11z"/><path fill="#40303a" d="M24 20h5v13h-5zM34 21h4v9h-4z"/><path fill="#fff0c5" d="M9 16h9v3h4v10h-4v4H10v-3H6V21h3z"/><path fill="'+c+'" d="M9 17h9v3H9zM11 30h8v3h-8z"/><path fill="#342c36" d="M8 22h4v5H8zM17 22h3v4h-3zM12 29h4v2h-4zM5 13h3v5H5zM2 11h5v3H2zM13 11h3v5h-3zM41 25h4v3h-4z"/><path fill="#fff" d="M9 22h1v2H9z"/><path fill="#d58e54" d="M6 27h4v2H6z"/><path fill="#46323b" d="M12 35h4v3h-4zM27 35h4v3h-4z"/></g>'+(m.role==='coordinator'?'<g class="bee-crown"><path fill="#4e3629" d="M7 4h3v4h4V2h4v6h4V4h3v10H7z"/><path fill="#ffcc63" d="M8 5h2v5h5V3h2v7h5V5h2v7H8z"/><path fill="#fff0b0" d="M9 11h14v2H9z"/></g>':m.role==='verifier'?'<path fill="#96c88b" d="M36 31h9v9h-9z"/><path fill="#203729" d="M37 35h2v2h2v-4h2v5h-6z"/>':m.role==='monitor'?'<path fill="#cbb4ff" d="M38 1h3v3h3v3h-3v3h-3V7h-3V4h3z"/>':'')+'</g>'+(sleep?'<g class="sleep-z" fill="#b4b0ca" font-family="monospace" font-weight="bold"><text x="2" y="9" font-size="8">z</text><text x="10" y="4" font-size="6">z</text></g>':'')+'</svg>';
}
const avatar=(m,i=0)=>'<span class="avatar" style="--role:'+roleColor(m,i)+'">'+bee(m,i)+'</span>';
const icon=(name)=>'<span class="glyph">'+(glyphs[name]||'·')+'</span>';
async function api(path,body,query){const r=await host.serviceRequest({method:body?'POST':'GET',path,...(body?{body:JSON.stringify(body)}:{}),...(query?{query}:{})});const v=JSON.parse(r.body);if(r.status>=400)throw Error(v.error||'Request failed');return v;}
async function launch(task){
 if(!directory)throw Error('Open a project first.');
 if(session?.busy)throw Error('Wait for the current turn to finish.');
 await host.compose({text:'/swarm '+task.trim(),mode:'replace'});
 await host.toast({kind:'info',message:'Send /swarm in the chat with your chosen model.'}).catch(()=>{});
 return true;
}
function current(){return swarms.find(s=>s.id===selected)||swarms[0];}
function saveBoardDraft(swarmId,text,to){
 const previous=boardDrafts.get(swarmId);
 if(previous&&previous.text===text&&previous.to===to)return previous;
 const draft={text,to,revision:(previous?.revision||0)+1};
 boardDrafts.set(swarmId,draft);
 return draft;
}
function boardDraft(swarmId){
 return boardDrafts.get(swarmId)||{text:'',to:'coordinator',revision:0};
}
function trackBoardPosts(previous,updated){
 if(!updated||boardSwarm!==updated.id)return;
 if(previous?.id===updated.id&&updated.posts.length>previous.posts.length){
  if(follow){
   newPosts=0;
   lastFeedCount=updated.posts.length;
   if(tab==='Board')followScroll=true;
  }else newPosts=Math.max(0,updated.posts.length-lastFeedCount);
 }else if(updated.posts.length<lastFeedCount){
  lastFeedCount=updated.posts.length;
  newPosts=0;
 }
}
async function refresh(){if(!ready||loading||(!directory&&!session))return;loading=true;try{const next=await api('/list',null,{directory:directory||'',sessionId:session?.id||''});if(JSON.stringify(next)===JSON.stringify(swarms)&&!error)return;const previous=current(),newSwarm=next.find(s=>!swarms.some(old=>old.id===s.id));swarms=next;if(newSwarm)selected=newSwarm.id;if(requestedSwarm){const match=swarms.find(x=>x.id===requestedSwarm||x.key===requestedSwarm||x.members.some(m=>m.sessionId===requestedSwarm));if(match){selected=match.id;requestedSwarm='';}}if(!swarms.some(s=>s.id===selected))selected=swarms[0]?.id||'';error='';const updated=current();trackBoardPosts(previous,updated);if(tab==='Graph'&&previous&&updated&&previous.id===updated.id&&previous.title===updated.title&&previous.status===updated.status&&previous.members.map(m=>m.name).join('|')===updated.members.map(m=>m.name).join('|')&&!settingsOpen&&!deleteConfirm&&!stopConfirm&&!newFormOpen&&root.querySelector('.graph-view')){const badge=root.querySelector('[data-tab=Board] span');if(badge)badge.textContent=updated.posts.length;const memberBadge=root.querySelector('[data-tab=Members] span');if(memberBadge)memberBadge.textContent=updated.members.filter(m=>m.state!=='retired').length;replayFrame();}else render();}catch(e){error=e.message;render();}finally{loading=false;}}
async function action(path,body){try{error='';const result=await api(path,body);await refresh();return result;}catch(e){error=e.message;render();return null;}}
const short=(t,n=100)=>String(t||'').length>n?String(t).slice(0,n-1)+'…':String(t||'');
const taskLabel=m=>short((m.brief||m.name).split(/[\n.]/)[0],86);
const memberLine=(m,s)=>{const i=s.members.indexOf(m),last=s.posts.findLast(p=>p.from===m.name);return '<div class="member-line '+(m.state==='blocked'?'needs-attention':'')+'" '+(m.sessionId&&m.state!=='blocked'?'data-open="'+esc(m.sessionId)+'" role="button" tabindex="0"':'')+'>'+avatar(m,Math.max(0,i))+'<div class="member-copy"><div class="member-top"><strong>@'+esc(m.name)+'</strong><span class="member-state '+esc(m.state)+'">'+(m.role==='coordinator'?'Coordinator · '+({active:'Working',waiting:'Standing by',dispatching:'Waking',blocked:'Needs attention',retired:'Retired'}[m.state]||m.state):m.role==='monitor'?'Monitor':m.state==='active'?'Working':m.state==='waiting'?'Standing by':m.state==='retired'?'Retired':m.state==='blocked'?'Needs attention':'Waking')+'</span><span class="member-model">'+esc(m.model||'')+(m.pending?' · '+m.pending+' pending':'')+(m.lastPost?' · #'+m.lastPost:'')+'</span></div><div class="member-brief">'+esc(taskLabel(m))+'</div><div class="member-last">'+esc(short(last?.text||m.lastReply||'No posts yet',160))+'</div>'+(m.state==='blocked'?'<div class="attention-reason"><strong>Reason:</strong> '+esc(blockReason(m))+'</div>':m.error?'<div class="error">'+esc(m.error)+'</div>':'')+'</div>'+(m.state==='blocked'&&m.sessionId?'<button type="button" data-open-chat="'+esc(m.sessionId)+'" class="attention-open">Open chat</button>':'')+(m.state==='blocked'&&s.status==='running'?'<button type="button" data-retry="'+esc(m.name)+'" class="subtle-button">Retry</button>':'')+'</div>';};
function monitorStatus(s){
 if(s.status!=='running')return {state:'retired',label:'Stopped'};
 if(s.monitor?.lastCheck&&Date.now()-s.monitor.lastCheck<45000)return {state:'active',label:'Watching'};
 return {state:'waiting',label:'Starting'};
}
function monitorMeta(s){
 const m=s.monitor||{};
 return `<div class="monitor-meta">
  <span>Checks <strong>${Number(m.checks||0)}</strong></span>
  <span>Last <strong>${m.lastCheck?fmt(m.lastCheck):'—'}</strong></span>
  <span>Next <strong>${m.nextCheck&&s.status==='running'?fmt(m.nextCheck):'—'}</strong></span>
  <span>Bridge <strong class="${m.bridgeConnected?'bridge-online':''}">${m.bridgeConnected?'Connected':'Waiting'}</strong></span>
 </div>`;
}
function monitorLine(s){
 const m=s.monitor||{}, {state,label}=monitorStatus(s);
 return '<section class="card monitor-panel"><div class="monitor-head">'+avatar({role:'monitor',state:state==='active'?'active':'waiting'})+'<div><strong>Monitor</strong><div class="muted">'+esc(m.action||'Awaiting first check')+'</div></div><span class="push pill '+state+'"><i class="dot"></i>'+label+'</span></div>'+monitorMeta(s)+(m.errors?.length?'<details class="monitor-errors"><summary>'+m.errors.length+' session check issue(s)</summary>'+m.errors.map(e=>'<p>'+esc(e)+'</p>').join('')+'</details>':'')+'</section>';
}
const isWorking=m=>['active','dispatching'].includes(m.state);
const hasReported=m=>['reported','verified'].includes(m.taskState);
function overviewMemberDetails(m,s){
 const blocked=m.state==='blocked';
 const brief=m.brief===s.task&&m.role==='coordinator'?'':m.brief;
 const reason=blocked?blockReason(m):m.error;
 const last=s.posts.findLast(p=>p.from===m.name),latest=last?.text||m.lastReply;
 const update=latest!==reason&&latest!==m.brief?latest:'';
 const meta=[m.model,m.pending?m.pending+' pending':'',isWorking(m)&&hasReported(m)?memberCue(m).label:''].filter(Boolean);
 const canRetry=blocked&&s.status==='running';
 return `
  ${reason?`<div class="overview-member-context"><h3>${blocked?'Blocked reason':'Error'}</h3><p class="overview-error">${esc(reason)}</p></div>`:''}
  ${brief?`<div class="overview-member-context"><h3>Brief</h3><p>${esc(brief)}</p></div>`:''}
  ${update?`<div class="overview-member-context"><h3>Latest update${last?' · #'+esc(last.id):''}</h3><p>${esc(short(update,240))}</p></div>`:''}
  ${m.paths?.length?`<div class="overview-paths" aria-label="Assigned paths">${m.paths.map(p=>'<code>'+esc(p)+'</code>').join('')}</div>`:''}
  ${meta.length?`<p class="overview-member-meta">${esc(meta.join(' · '))}</p>`:''}
  ${!reason&&!brief&&!update&&!m.paths?.length&&!meta.length&&!m.sessionId?'<p>No additional details yet.</p>':''}
  ${m.sessionId||canRetry?`<div class="overview-member-actions">
   ${m.sessionId?`<button type="button" data-overview-action="chat" data-open-chat="${esc(m.sessionId)}">Open chat <span aria-hidden="true">↗</span></button>`:''}
   ${canRetry?`<button type="button" data-overview-action="retry" data-retry="${esc(m.name)}">Retry</button>`:''}
  </div>`:''}`;
}
function overview(s){
 const open=overviewDisclosures.get(s.id);
 const tasks=s.members.filter(m=>m.role!=='coordinator');
 const reported=tasks.filter(hasReported).length;
 const working=s.members.filter(isWorking).length;
 const blocked=s.members.filter(m=>m.state==='blocked').length;
 const goal=s.task||s.title;
 const longGoal=goal.length>260||goal.split('\n').length>3;
 const monitor=s.monitor||{},monitorCue=monitorStatus(s);
 const row=(m,i,label,tone,body)=>`
  <details class="overview-member" data-overview-item="${esc(m.name)}"${open?.has(m.name)?' open':''}>
   <summary>
    ${avatar(m,i)}
    <span class="overview-member-name"><strong title="${esc(m.name)}">${m.role==='monitor'?'Monitor':'@'+esc(m.name)}</strong><span>${m.role==='monitor'?'Supervisor':esc(m.role)}</span></span>
    <span class="overview-state ${esc(tone)}"><i class="dot" aria-hidden="true"></i>${esc(label)}</span>
    <svg class="overview-chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m6 4 4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
   </summary>
   <div class="overview-member-body">${body}</div>
  </details>`;
 return `<div class="overview">
  <section class="overview-section" aria-labelledby="overview-goal">
   <div class="overview-heading"><h1 id="overview-goal">GOAL</h1><span>${esc(s.key)}</span></div>
   ${longGoal?`<details class="overview-goal-detail" data-overview-item=":goal"${open?.has(':goal')?' open':''}>
    <summary><span class="overview-goal-snippet">${esc(short(goal,260))}</span><span class="overview-goal-more">Read full goal</span><span class="overview-goal-less">Show less</span></summary>
    <p>${esc(goal)}</p>
   </details>`:`<p class="overview-goal-copy">${esc(goal)}</p>`}
   <dl class="overview-metrics" aria-label="Swarm progress">
    <div><dt>Reported or verified</dt><dd>${reported}<span> / ${tasks.length}</span>${tasks.length?`<progress aria-label="Tasks reported or verified" value="${reported}" max="${tasks.length}"></progress>`:''}</dd></div>
    <div><dt>Active now</dt><dd>${working}</dd></div>
    <div${blocked?' class="overview-error"':''}><dt>Needs attention</dt><dd>${blocked}</dd></div>
   </dl>
  </section>
  ${s.summary?`<section class="overview-section overview-result"><div class="overview-heading"><h2>Result</h2></div><p>${esc(s.summary)}</p></section>`:''}
  <section class="overview-section overview-team" aria-labelledby="overview-team">
   <div class="overview-heading"><h2 id="overview-team">Team</h2><span>${s.members.length} ${s.members.length===1?'member':'members'}</span></div>
   ${s.members.map((m,i)=>{
    const reportedWhileIdle=m.state==='waiting'&&hasReported(m);
    const {label}=memberCue({state:m.state,taskState:reportedWhileIdle?m.taskState:undefined});
    return row(m,i,label,reportedWhileIdle?'done':m.state,overviewMemberDetails(m,s));
   }).join('')}
  </section>
  <section class="overview-section overview-supervisor" aria-label="Swarm supervision">
   ${row({name:'monitor',role:'monitor',state:monitorCue.state},0,monitor.errors?.length?`${monitor.errors.length} check issue${monitor.errors.length===1?'':'s'}`:monitorCue.label,monitor.errors?.length?'blocked':monitorCue.state,`
   <div class="overview-member-context"><h3>Latest check</h3><p>${esc(monitor.action||'Awaiting first check')}</p></div>
   ${monitorMeta(s)}
   ${monitor.errors?.length?`<div class="overview-member-context overview-error"><h3>Session check issues</h3>${monitor.errors.map(e=>'<p>'+esc(e)+'</p>').join('')}</div>`:''}`)}
  </section>
 </div>`;
}
const expandedPosts=new Set();
function board(s){
 if(boardSwarm!==s.id){boardSwarm=s.id;lastFeedCount=s.posts.length;newPosts=0;followScroll=follow;jumpLatest=false;}
 const self=s.members.find(m=>m.sessionId===session?.id);let newDivider=false;const posts=s.posts.filter(p=>(!filter||JSON.stringify(p).toLowerCase().includes(filter.toLowerCase()))&&(!memberFilter||p.from===memberFilter||p.to.includes(memberFilter)));
 const openTarget=p=>s.members.find(m=>m.name===p.from&&m.sessionId)||s.members.find(m=>p.to.includes(m.name)&&m.sessionId);
 return '<section id="board-view" class="board-view" tabindex="0" role="region" aria-label="Swarm board" aria-keyshortcuts="j k g G f o Escape"><div class="board-tools"><label class="search-box"><span>⌕</span><input type="search" id="filter" value="'+esc(filter)+'" placeholder="Search posts"></label><select id="memberFilter" aria-label="Filter by member"><option value="">All members</option>'+s.members.map(m=>'<option value="'+esc(m.name)+'" '+(m.name===memberFilter?'selected':'')+'>@'+esc(m.name)+'</option>').join('')+'</select><button id="follow" class="subtle-button" aria-pressed="'+follow+'">'+(follow?'● Follow':'○ Follow')+'</button></div>'+(newPosts?'<button type="button" id="new-posts" class="new-posts">'+newPosts+' new post'+(newPosts===1?'':'s')+' · Go to latest</button>':'')+'<div id="feed">'+(posts.length?posts.map(p=>{const divider=!newDivider&&self&&p.id>self.read?(newDivider=true,'<div class="new-divider">New</div>'):'';const author=s.members.find(m=>m.name===p.from)||{name:p.from,role:p.from==='monitor'?'monitor':'worker',state:'waiting'},target=openTarget(p),full=expandedPosts.has(p.id),long=p.text.length>480;return divider+'<article class="board-post '+(full?'expanded-post':'')+'" data-post-id="'+esc(p.id)+'" tabindex="-1">'+avatar(author,Math.max(0,s.members.indexOf(author)))+'<div class="post-copy"><div class="post-meta"><strong>@'+esc(p.from)+'</strong><span class="post-target">→ '+esc(p.to.map(x=>'@'+x).join(' '))+'</span><span class="post-time">#'+p.id+' · '+fmt(p.at)+'</span></div><div class="text '+(long&&!full?'clamped':'')+'">'+esc(p.text)+'</div><div class="post-actions"><span class="kind-chip '+esc(p.kind)+'">['+esc(p.kind)+']</span>'+(target?'<button type="button" class="subtle-button" data-open-chat="'+esc(target.sessionId)+'" data-post-action="chat">Open chat</button>':'')+(long?'<button type="button" class="subtle-button" data-expand="'+p.id+'" data-post-action="expand">'+(full?'Show less':'Show more')+'</button>':'')+'</div></div></article>';}).join(''):'<p class="muted">No matching posts.</p>')+'</div>'+(s.status==='running'?'<form id="message" class="compose-card"><div class="row"><label>Post to</label><select name="to"><option value="coordinator">@coordinator</option><option value="all">@all</option>'+s.members.filter(m=>m.name!=='coordinator'&&m.state!=='retired').map(m=>'<option value="'+esc(m.name)+'">@'+esc(m.name)+'</option>').join('')+'</select></div><textarea name="text" placeholder="Message the swarm…" required maxlength="20000"></textarea><button class="primary">Post message</button></form>':'')+'</section>';
}
function members(s){
 const groups=[['Needs attention',s.members.filter(m=>m.state==='blocked')],['Coordinator',s.members.filter(m=>m.role==='coordinator'&&m.state!=='blocked')],['Active',s.members.filter(m=>m.role!=='coordinator'&&['active','dispatching'].includes(m.state))],['Standing by',s.members.filter(m=>m.role!=='coordinator'&&m.state==='waiting')],['Retired',s.members.filter(m=>m.role!=='coordinator'&&m.state==='retired')]];
 const query=memberSearch.toLowerCase();
 return '<label class="search-box member-search"><span>⌕</span><input type="search" id="memberSearch" placeholder="Search members" value="'+esc(memberSearch)+'"></label>'+groups.map(([name,items])=>{items=items.filter(m=>!query||m.name.toLowerCase().includes(query)||m.role.toLowerCase().includes(query));if(!items.length)return '';const body=items.map(m=>memberLine(m,s)).join('');return name==='Retired'?'<details class="retired-group"><summary>Retired ('+items.length+')</summary>'+body+'</details>':name==='Coordinator'?'<section class="coordinator-group">'+body+'</section>':'<section class="member-group '+(name==='Needs attention'?'attention-group':'')+'"><h2>'+name+' ('+items.length+')</h2>'+body+'</section>';}).join('')+(!query||'monitor'.includes(query)?'<section class="member-group"><h2>Supervisor</h2>'+memberLine({name:'monitor',role:'monitor',state:s.status==='running'?'waiting':'retired',brief:'Runtime supervisor · detects stalls and wakes members'},s)+monitorLine(s)+'</section>':'');
}
let graphMotionState=null,graphPulseTimer=null;
function scheduleGraphPulseExpiry(){
 clearTimeout(graphPulseTimer);
 if(!graphMotionState?.pulses.length)return;
 const until=Math.min(...graphMotionState.pulses.map(p=>p.until));
 graphPulseTimer=setTimeout(()=>{
  const now=Date.now();
  root.querySelectorAll('.graph-view .message-pulse').forEach(path=>{if(Number(path.dataset.until)<=now)path.remove();});
  if(graphMotionState)graphMotionState.pulses=graphMotionState.pulses.filter(p=>p.until>now);
  scheduleGraphPulseExpiry();
 },Math.max(0,until-Date.now()));
}
function graph(s){
  const count=replay===null?s.posts.length:Math.min(replay,s.posts.length),posts=s.posts.slice(0,count),last=posts.at(-1);
  if(!root.querySelector('.graph-view'))graphMotionState=null;
  graphMotionState=graphMotion(graphMotionState,s.id,s.posts,replay);
  scheduleGraphPulseExpiry();
 const historic=m=>{if(replay===null)return m;const h=(s.history||[]).filter(x=>x.name===m.name&&x.post<=count).at(-1);return h?{...m,state:h.state,taskState:h.taskState}:m;};
 const all=[...s.members.map(historic),{name:'monitor',role:'monitor',state:s.status==='running'?(s.monitor?.bridgeConnected?'active':'waiting'):'retired',brief:'Supervises stalls and wakes members.'}];
 const nodes=all.filter(m=>(replay===null||m.role==='monitor'||m.role==='coordinator'||!(s.history||[]).length||(s.history||[]).some(h=>h.name===m.name&&h.post<=count))&&(!hideInactive||!['waiting','retired'].includes(m.state)||m.role==='coordinator'));
 const isHive=mode==='Hive', {positions:pos,r:hexR}=layoutGraph(all,isHive),view=graphCamera(pos,hexR,isHive,zoomLevel),visible=new Set(nodes.map(m=>m.name));
 const edges=collectEdges(posts,visible);
 const hex=(r)=>Array.from({length:6},(_,i)=>{const a=i*Math.PI/3;return [Math.cos(a)*r,Math.sin(a)*r].join(',');}).join(' ');
  const doneAt=m=>['reported','verified'].includes(m.taskState);
 const done=all.filter(m=>m.role!=='monitor'&&m.role!=='coordinator'&&doneAt(m)).length,total=s.members.filter(m=>m.role!=='coordinator').length;
 let drawing='<defs><marker id="arr" markerUnits="userSpaceOnUse" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto-start-reverse"><path d="M0 0 6 3 0 6" fill="#777980"/></marker><marker id="hot" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto-start-reverse"><path d="M0 0 7 3 0 6" fill="#83a9eb"/></marker></defs>';
 for(const m of all){if(!isHive)break;const [x,y]=pos.get(m.name),finished=m.role==='coordinator'?done===total&&total>0:doneAt(m);
  drawing+='<polygon data-key="cell-'+esc(m.name)+'" class="hive-cell" opacity="'+(visible.has(m.name)?1:0)+'" transform="translate('+x+' '+y+')" points="'+hex(hexR-2)+'" fill="'+(m.state==='blocked'?'#2a1e20':finished?'#20291e':m.role==='coordinator'?'#282118':'#171719')+'" stroke="'+(m.state==='blocked'?'#9a6065':finished?'#7da36e':m.role==='coordinator'?'#876940':'#39393d')+'" stroke-width="'+(finished?1.8:1)+'"/>';}
  for(const e of edges){const {a,b,ab,ba}=e,hotAB=replay!==null&&last?.from===a&&last.to.includes(b),hotBA=replay!==null&&last?.from===b&&last.to.includes(a),hot=hotAB||hotBA,focus=graphMember===a||graphMember===b;if(isHive&&!hot)continue;
 const g=edgeGeometry(pos.get(a),pos.get(b),isHive?20:68,isHive?18:16),width=isHive?1.6:Math.min(2.2,1+(ab+ba)*.15),color=hot?'#83a9eb':focus?'#a5a7ad':'#55585e',showAB=isHive?hotAB:ab>0,showBA=isHive?hotBA:ba>0;
  drawing+='<g data-key="edge-'+esc(a)+'-'+esc(b)+'" class="mention-edge"><title>@'+esc(a)+' → @'+esc(b)+': '+ab+' · reverse: '+ba+'</title><path d="'+g.path+'" fill="none" stroke="'+color+'" stroke-width="'+width+'" opacity="'+(hot||focus?1:.65)+'" '+(showAB?'marker-end="url(#'+(hot?'hot':'arr')+')"':'')+' '+(showBA?'marker-start="url(#'+(hot?'hot':'arr')+')"':'')+'/>'+(!isHive&&(hot||focus)?'<g class="edge-count" transform="translate('+g.x+' '+(g.y-7)+')"><rect x="-18" y="-8" width="36" height="16" rx="5" fill="#1d2026"/><text text-anchor="middle" y="3" fill="#c7c9cd" font-size="9">'+(ab&&ba?ab+' / '+ba:ab+ba)+'</text></g>':'')+'</g>';
  }
  for(const {post,until} of graphMotionState.pulses)for(const to of new Set(post.to)){
   if(post.from===to||!visible.has(post.from)||!visible.has(to))continue;
   const g=edgeGeometry(pos.get(post.from),pos.get(to),isHive?20:68,isHive?18:16);
   drawing+='<path data-key="pulse-'+esc(JSON.stringify([post.id,post.from,to]))+'" data-until="'+until+'" class="message-pulse" style="animation-delay:-'+Math.max(0,1400-(until-Date.now()))+'ms" d="'+g.path+'" pathLength="100" fill="none" stroke="#c1d9ff" stroke-width="2.8" marker-end="url(#hot)"><title>@'+esc(post.from)+' → @'+esc(to)+'</title></path>';
  }
 for(const m of all){const i=all.indexOf(m),[x,y]=pos.get(m.name),c=roleColor(m,i),active=(replay!==null||s.status==='running')&&['active','dispatching'].includes(m.state),finished=doneAt(m),label=short(m.name,16),selected=graphMember===m.name,shown=visible.has(m.name),displayBee={...m,state:['retired','blocked'].includes(m.state)?m.state:active?m.state:finished?'resting':m.state==='waiting'?'waiting':'resting'};
  const cue=m.role==='monitor'?{label:s.status==='running'?(s.monitor?.bridgeConnected?'Watching':'Standing by'):'Stopped',symbol:s.status==='running'&&s.monitor?.bridgeConnected?'●':'Ⅱ'}:memberCue(m);
  const stateLabel=cue.label;
  drawing+='<g data-key="node-'+esc(m.name)+'" class="node '+(m.state==='retired'&&!finished&&s.status==='running'?'inactive-node':'')+'" role="button" tabindex="'+(shown?0:-1)+'" visibility="'+(shown?'visible':'hidden')+'" aria-label="Inspect '+esc(m.name)+' · '+esc(stateLabel)+'" data-node="'+esc(m.name)+'" transform="translate('+x+' '+y+')"><title>@'+esc(m.name)+' · '+esc(stateLabel)+'</title>';
 if(isHive){const title=m.role==='coordinator'?'Coordinator':m.role==='monitor'?'Monitor':short(m.name.replace(/-/g,' '),14);
  drawing+='<polygon points="'+hex(hexR-2)+'" fill="transparent" stroke="'+(selected?'#c9d4e4':'transparent')+'" stroke-width="1.5"/><text y="-20" text-anchor="middle" fill="#e3e3e5" font-size="11" font-weight="600">'+esc(title)+'</text><text y="-8" text-anchor="middle" fill="'+(finished?'#a2c294':'#c1c1c8')+'" font-size="9">'+esc(cue.symbol+' '+stateLabel)+'</text><g transform="translate(-21 -2) scale(.66)">'+bee(displayBee,i,true)+'</g>'+(active?'<circle class="working-dot" cx="22" cy="15" r="2.8" fill="#9cc68b"/>':'');}
  else{drawing+='<rect x="-64" y="-13" width="128" height="26" rx="7" fill="#1b1b1e" stroke="'+(selected?'#a7b9d2':finished?'#526a49':'#393a3e')+'"/><g transform="translate(-58 -10) scale(.56)">'+bee(displayBee,i)+'</g><text x="-35" y="4" font-size="10" fill="#dedee0">'+esc(short(label,10))+'</text><circle class="mention-state-badge" cx="51" cy="0" r="11" fill="'+(m.state==='blocked'?'#402527':finished?'#263526':'#262c36')+'" stroke="'+(m.state==='blocked'?'#b47773':finished?'#71946b':'#7b899f')+'" stroke-width="1"/><text class="mention-state-symbol" x="51" y="8" text-anchor="middle" font-size="23" font-weight="bold" fill="'+(m.state==='blocked'?'#efa49c':finished?'#a9d39b':'#bec9dc')+'">'+esc(cue.symbol)+'</text>';}
 drawing+='</g>';
 }
 const detail=nodes.find(m=>m.name===graphMember);
 return '<div class="graph-view" data-swarm="'+esc(s.id)+'"><section class="graph-shell '+(graphExpanded?'expanded':'')+'"><div class="timeline"><button id="first" aria-label="First post">|‹</button><button id="prev" aria-label="Previous post">‹</button><button id="play" aria-label="Play or pause">'+(playing?'Ⅱ':'▶')+'</button><button id="next" aria-label="Next post">›</button><input id="replay" type="range" min="0" max="'+s.posts.length+'" value="'+count+'" aria-label="Replay timeline"><button id="live" class="'+(replay===null?'live-button':'')+'">● Live</button></div><div class="graph-tools"><span class="counter">'+count+' of '+s.posts.length+(last?' · #'+last.id+' at '+fmt(last.at):'')+'</span><div class="segmented"><button data-mode="Hive" class="'+(isHive?'selected':'')+'">Hive</button><button data-mode="Mentions" class="'+(!isHive?'selected':'')+'">Mentions</button></div></div><div class="graph-tools secondary-tools"><button id="hideInactive" aria-pressed="'+hideInactive+'" class="subtle-button"><span class="switch '+(hideInactive?'on':'')+'"></span> Hide inactive</button><label>Speed <select id="pace"><option value=".5" '+(pace===.5?'selected':'')+'>0.5×</option><option value="1" '+(pace===1?'selected':'')+'>1×</option><option value="2" '+(pace===2?'selected':'')+'>2×</option></select></label><span class="push"></span><button id="minus" aria-label="Zoom out">−</button><button id="plus" aria-label="Zoom in"><svg class="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button><button id="fit" aria-label="Reset graph zoom" title="Fit graph">'+Math.round(zoomLevel*100)+'%</button><button id="zoom" aria-label="Expand">↗</button></div><div class="graph-canvas"><svg class="graph" preserveAspectRatio="xMidYMid meet" viewBox="'+view.join(' ')+'" aria-label="Swarm communication graph">'+drawing+'</svg></div><div class="legend">'+(isHive?'<span><i class="line-key green"></i> Tasks done</span><span><i class="line-key blue"></i> Message just sent</span>':'<span><i class="line-key gray"></i> Connection · arrows show direction</span><span><i class="line-key blue"></i> Latest mention · select for counts</span>')+'</div><small class="graph-note">Post history replay · recorded agent states</small>'+(last?'<article class="replay-post"><div class="post-meta"><strong>'+esc(last.from)+'</strong><span class="post-target">→ '+esc(last.to.map(x=>'@'+x).join(' '))+'</span><span class="post-time">'+fmt(last.at)+'</span></div><div class="text"><span class="kind-chip '+esc(last.kind)+'">['+esc(last.kind)+']</span> '+esc(last.text)+'</div></article>':'<article class="replay-post"><div class="post-meta"><strong>Board message</strong></div><div class="text muted">Before the first post</div></article>')+'</section>'+(detail?'<div class="card member-detail"><div class="row">'+avatar(detail,all.indexOf(detail))+'<strong>@'+esc(detail.name)+'</strong> <span class="pill graph-member-state">'+esc(detail.role==='monitor'?(s.status==='running'?(s.monitor?.bridgeConnected?'Watching':'Standing by'):'Stopped'):memberCue(detail).label)+'</span></div><p>'+esc(detail.brief||'Supervises swarm activity')+'</p>'+(detail.sessionId?'<button data-open="'+esc(detail.sessionId)+'">Open conversation</button>':'')+'</div>':'')+'</div>';
}
function patchGraphElement(old,next){
 if(!old||!next||old.nodeType!==next.nodeType||old.nodeName!==next.nodeName){old?.replaceWith(next.cloneNode(true));return;}
 if(old.nodeType===3||old.nodeType===8){if(old.nodeValue!==next.nodeValue)old.nodeValue=next.nodeValue;return;}
 for(const a of [...old.attributes])if(!next.hasAttribute(a.name))old.removeAttribute(a.name);
  for(const a of [...next.attributes])if(!(a.name==='style'&&old.classList?.contains('message-pulse'))&&old.getAttribute(a.name)!==a.value)old.setAttribute(a.name,a.value);
 if(old.tagName==='INPUT'){old.value=next.value;return;}
 if(old.tagName==='SELECT'){old.value=next.value;return;}
 const keyed=new Map([...old.children].filter(x=>x.hasAttribute('data-key')).map(x=>[x.getAttribute('data-key'),x]));
 if(keyed.size||[...next.children].some(x=>x.hasAttribute('data-key'))){
  const wanted=new Set([...next.children].filter(x=>x.hasAttribute('data-key')).map(x=>x.getAttribute('data-key')));for(const [key,node] of keyed){if(!wanted.has(key)){node.remove();keyed.delete(key);}}
  let cursor=old.firstChild;
  for(const child of [...next.childNodes]){const key=child.nodeType===1&&child.getAttribute('data-key');let node=key?keyed.get(key):cursor&&!cursor.getAttribute?.('data-key')?cursor:null;
   if(!node){node=child.cloneNode(true);old.insertBefore(node,cursor);}else{if(node!==cursor)old.insertBefore(node,cursor);patchGraphElement(node,child);}
   cursor=node.nextSibling;
  }
  while(cursor){const nextSibling=cursor.nextSibling;cursor.remove();cursor=nextSibling;}
 }else{const a=[...old.childNodes],b=[...next.childNodes];for(let i=0;i<b.length;i++){if(a[i])patchGraphElement(a[i],b[i]);else old.append(b[i].cloneNode(true));}for(let i=b.length;i<a.length;i++)a[i].remove();}
}
function replayFrame(){
 const s=current(),old=root.querySelector('.graph-view');if(!s||!old||old.dataset.swarm!==s.id){render();return;}
 const temp=document.createElement('template');temp.innerHTML=graph(s);patchGraphElement(old,temp.content.firstElementChild);old.querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>host.openSession(el.dataset.open).catch(e=>{error=e.message;render();}));
}
function captureRenderState(){
 const doc=root.ownerDocument,win=doc.defaultView;
 const settingsForm=root.querySelector('#swarmSettings');
 if(settingsForm&&settingsOpen){
  const values=Object.fromEntries(new FormData(settingsForm));
  swarmSettings={...values,monitorReasoning:values.monitorReasoning==='on'};
 }
 const startForm=root.querySelector('#start');
 const messageForm=root.querySelector('#message');
 const textarea=messageForm?.querySelector('textarea');
 const recipient=messageForm?.querySelector('select')?.value;
 if(textarea&&renderedSwarmId)saveBoardDraft(renderedSwarmId,textarea.value,recipient||'coordinator');

 const swarm=current(),draft=swarm?boardDraft(swarm.id):{text:'',to:'coordinator'};
 const activeElement=doc.activeElement;
 const activePost=activeElement?.closest?.('[data-post-id]');
 const overviewItems=[...root.querySelectorAll('[data-overview-item]')];
 const activeOverviewItem=activeElement?.closest?.('[data-overview-item]');
 if(overviewItems.length&&renderedSwarmId){
  const open=overviewItems.filter(el=>el.open).map(el=>el.dataset.overviewItem);
  if(open.length)overviewDisclosures.set(renderedSwarmId,new Set(open));
  else overviewDisclosures.delete(renderedSwarmId);
 }
 const readingPost=tab==='Board'?[...root.querySelectorAll('#feed [data-post-id]')].find(el=>{
  const bounds=el.getBoundingClientRect();
  return bounds.bottom>0&&bounds.top<(win?.innerHeight||0);
 }):null;
 const sameSwarm=swarm?.id===renderedSwarmId;
 const switchingOverview=!sameSwarm&&(tab==='Overview'||overviewItems.length>0);
 const preserveScroll=!resetScrollOnRender&&!switchingOverview;
 const headerBottom=root.querySelector('.sticky-top')?.getBoundingClientRect().bottom||0;
 const focusBounds=tab==='Overview'&&preserveScroll&&activeOverviewItem
  ?activeElement.getBoundingClientRect():null;
 const overviewFocusTop=focusBounds&&focusBounds.bottom>headerBottom&&focusBounds.top<win.innerHeight
  ?focusBounds.top:null;
 const overviewAnchor=tab==='Overview'&&preserveScroll&&win?.scrollY&&overviewItems.find(el=>{
  const bounds=el.getBoundingClientRect();
  return bounds.bottom>headerBottom&&bounds.top<win.innerHeight;
 });
 resetScrollOnRender=false;
 return {
  swarm,
  startVisible:newFormOpen,
  startDraft:startForm?.querySelector('textarea')?.value||'',
  draft:draft.text,
  recipient:draft.to,
  focus:{
   id:activeElement?.id,
   field:activeElement?.name,
   formId:activeElement?.form?.id,
   selectionStart:activeElement?.selectionStart??null,
   selectionEnd:activeElement?.selectionEnd??null,
   selectionDirection:activeElement?.selectionDirection??'none',
   postId:activePost?.dataset.postId,
   postAction:activeElement?.matches?.('[data-post-action]')?activeElement.dataset.postAction:null,
   overviewItem:sameSwarm?activeOverviewItem?.dataset.overviewItem:null,
   overviewAction:activeElement?.dataset?.overviewAction,
  },
  scroll:{
   preserve:preserveScroll,
   x:win?.scrollX||0,
   y:win?.scrollY||0,
   feedTop:root.querySelector('#feed')?.scrollTop||0,
   readingAnchor:preserveScroll&&readingPost?{id:readingPost.dataset.postId,top:readingPost.getBoundingClientRect().top}:null,
   overviewFocusTop,
   overviewAnchor:overviewAnchor?{id:overviewAnchor.dataset.overviewItem,top:overviewAnchor.getBoundingClientRect().top}:null,
  },
 };
}
function restoreRenderState(state){
 const {swarm,focus,scroll}=state,doc=root.ownerDocument,win=doc.defaultView;
 const startForm=root.querySelector('#start');
 if(startForm){if(state.startVisible)startForm.hidden=false;startForm.querySelector('textarea').value=state.startDraft;}
 const messageForm=root.querySelector('#message');
 if(messageForm&&swarm){
  const textarea=messageForm.querySelector('textarea'),recipient=messageForm.querySelector('select');
  textarea.value=state.draft;
  recipient.value=state.recipient;
  const submit=messageForm.querySelector('button[type="submit"],button:not([type])');
  if(submit){
   submit.disabled=sendingMessages.has(swarm.id);
   if(submit.disabled)submit.setAttribute('aria-busy','true');
   else submit.removeAttribute('aria-busy');
  }
 }
 const post=focus.postId&&[...root.querySelectorAll('[data-post-id]')].find(el=>el.dataset.postId===focus.postId);
 const postAction=post&&focus.postAction&&[...post.querySelectorAll('[data-post-action]')].find(el=>el.dataset.postAction===focus.postAction);
 const overviewItems=[...root.querySelectorAll('[data-overview-item]')];
 const overviewItem=overviewItems.find(el=>el.dataset.overviewItem===focus.overviewItem);
 const overviewSummary=overviewItem?.querySelector('summary');
 const overviewAction=overviewItem?.open&&[...overviewItem.querySelectorAll('[data-overview-action]')].find(el=>el.dataset.overviewAction===focus.overviewAction);
 const overviewFocusMatch=focus.overviewAction?overviewAction:overviewSummary;
 const focusTarget=overviewFocusMatch||overviewSummary||postAction||post||(focus.id?doc.getElementById(focus.id):focus.formId&&focus.field?doc.getElementById(focus.formId)?.elements.namedItem(focus.field):null);
 if(focusTarget){
  focusTarget.focus({preventScroll:true});
  if(focus.selectionStart!==null&&focusTarget.setSelectionRange){
   try{focusTarget.setSelectionRange(focus.selectionStart,focus.selectionEnd??focus.selectionStart,focus.selectionDirection);}catch{}
  }
 }
 const scrollToLatest=tab==='Board'&&swarm&&(followScroll||jumpLatest);
 if(scrollToLatest){
  root.querySelector('#feed .board-post:last-of-type')?.scrollIntoView({block:'nearest'});
  followScroll=false;
  jumpLatest=false;
 }else if(!scroll.preserve)win?.scrollTo(0,0);
 else if(scroll.readingAnchor){
  const anchor=[...root.querySelectorAll('[data-post-id]')].find(el=>el.dataset.postId===scroll.readingAnchor.id);
  if(anchor)win?.scrollBy(0,anchor.getBoundingClientRect().top-scroll.readingAnchor.top);
  else win?.scrollTo(scroll.x,scroll.y);
 }else if(overviewFocusMatch&&scroll.overviewFocusTop!==null){
  win?.scrollBy(0,overviewFocusMatch.getBoundingClientRect().top-scroll.overviewFocusTop);
 }else if(scroll.overviewAnchor){
  const anchor=overviewItems.find(el=>el.dataset.overviewItem===scroll.overviewAnchor.id);
  if(anchor)win?.scrollBy(0,anchor.getBoundingClientRect().top-scroll.overviewAnchor.top);
  else win?.scrollTo(scroll.x,scroll.y);
 }else win?.scrollTo(scroll.x,scroll.y);
 const feed=root.querySelector('#feed');
 if(feed)feed.scrollTop=scroll.preserve?scroll.feedTop:0;
}
function render(){
 const state=captureRenderState(),s=state.swarm;
 if(tab==='Board'&&s&&jumpLatest){lastFeedCount=s.posts.length;newPosts=0;}
 if(tab==='Board'&&s&&jumpLatest){lastFeedCount=s.posts.length;newPosts=0;}
 root.innerHTML='<div class="sticky-top"><header><div class="header-title">'+bee({role:'coordinator',state:s?.status==='running'?'active':'waiting'})+'<span>'+ (s?esc(s.title):'Swarm')+'</span>'+'</div><div class="header-actions">'+(s?status(s.status):'')+'<button id="settings" class="subtle-button" title="Swarm model settings" aria-label="Swarm model settings"><svg class="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2 2m8.8 8.8 2 2m0-12.8-2 2m-8.8 8.8-2 2"/></svg></button><button id="refresh" class="subtle-button" title="Refresh" aria-label="Refresh"><svg class="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 9a8 8 0 1 0 0 6M20 4v5h-5"/></svg></button>'+(s?'<button id="delete" class="subtle-button" title="Delete swarm" aria-label="Delete swarm"><svg class="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6m4-6v6"/></svg></button><button id="new" class="subtle-button" title="New swarm" aria-label="New swarm">+</button>':'')+(s?.status==='running'?'<button id="stop" class="subtle-button" title="Stop swarm" aria-label="Stop swarm"><svg class="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg></button>':'')+'</div></header>'+(s?'<nav class="tabs">'+['Overview','Board','Members','Graph'].map(t=>'<button data-tab="'+t+'" class="'+(tab===t?'selected':'')+'">'+t+(t==='Board'?'<span>'+s.posts.length+'</span>':t==='Members'?'<span>'+s.members.filter(m=>m.state!=='retired').length+'</span>':'')+'</button>').join('')+'</nav>':'')+'</div>'+(error?'<div class="notice error">'+esc(error)+'</div>':'')+'<main>'+(deleteConfirm&&s?'<section class="card confirm-card"><h2>Delete '+esc(s.key)+'?</h2><p>Stops the swarm and removes its board and graph history. Chat conversations and files are kept.</p><div class="row"><button id="confirmDelete" class="danger-button">Delete swarm</button><button id="cancelDelete">Cancel</button></div></section>':'')+(stopConfirm&&s?'<section class="card confirm-card"><h2>Stop swarm?</h2><p>Interrupts agents and preserves the board.</p><div class="row"><button id="confirmStop" class="danger-button">Stop swarm</button><button id="cancelStop">Cancel</button></div></section>':'')+(settingsOpen?'<form id="swarmSettings" class="card settings-card"><h2>Swarm models</h2><p class="muted">Leave each role blank to inherit the model selected when starting /swarm. Overrides apply to new swarms.</p>'+['coordinator','worker','verifier','monitor'].map(role=>'<label>'+role[0].toUpperCase()+role.slice(1)+' model<input name="'+role+'Model" list="swarm-models" value="'+esc(swarmSettings[role+'Model'])+'" placeholder="Inherit launch model"></label>').join('')+'<label class="monitor-toggle"><input type="checkbox" name="monitorReasoning" '+(swarmSettings.monitorReasoning?'checked':'')+'> AI advisory review when stalled</label><p class="muted">Health checks and wake-ups always run without model calls. Enable advisory review to use the monitor model on a stall.</p><datalist id="swarm-models">'+availableModels.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.name)+'</option>').join('')+'</datalist><div class="row"><button class="primary">Save</button><button type="button" id="cancelSettings">Cancel</button></div></form>':'')+(!s?'<h1>Start a swarm</h1><p class="muted">Choose a model in the chat composer, then send /swarm.</p>':(swarms.length>1?'<div class="swarm-switch"><select id="swarmSelect">'+swarms.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===s.id?'selected':'')+'>'+esc(x.key+' · '+x.title)+'</option>').join('')+'</select></div>':'')+({Overview:overview,Board:board,Members:members,Graph:graph}[tab](s)))+'<form id="start" class="card start-card" '+(s?'hidden':'')+'><h2>New swarm</h2><p class="muted">'+esc(directory||'Open a project')+' · '+esc(session?.title||'New coordinator conversation')+'</p><textarea name="task" required maxlength="12000" placeholder="Describe the task and acceptance criteria"></textarea><button class="primary" '+(!directory||session?.busy?'disabled':'')+'>Prepare /swarm</button>'+(session?.busy?'<small> Wait for current turn to finish.</small>':'')+'</form></main>';
 renderedSwarmId=s?.id||'';
 restoreRenderState(state);
 root.querySelector('#refresh').onclick=refresh;
 root.querySelector('#settings')?.addEventListener('click',async()=>{try{settingsOpen=!settingsOpen;if(settingsOpen){swarmSettings=await api('/settings');render();api('/models',null,{directory:directory||''}).then(models=>{if(Array.isArray(models)){availableModels=models;if(settingsOpen)render();}}).catch(()=>{});}else render();}catch(e){error=e.message;render();}});
 root.querySelector('#cancelSettings')?.addEventListener('click',()=>{settingsOpen=false;render();});
 root.querySelector('#swarmSettings')?.addEventListener('submit',async e=>{e.preventDefault();try{swarmSettings=await api('/settings',Object.fromEntries(new FormData(e.target)));settingsOpen=false;render();}catch(e){error=e.message;render();}});
 root.querySelector('#start').onsubmit=async e=>{e.preventDefault();const task=new FormData(e.target).get('task');let result;try{result=await launch(task);}catch(e){error=e.message;render();}if(result){root.querySelector('#start').reset();newFormOpen=false;root.querySelector('#start').hidden=true;render();}};
 root.querySelector('#new')?.addEventListener('click',()=>{newFormOpen=!newFormOpen;render();if(newFormOpen)root.querySelector('#start textarea').focus();});
 root.querySelector('#swarmSelect')?.addEventListener('change',e=>{clearInterval(timer);playing=false;selected=e.target.value;graphMember='';zoomLevel=1;replay=null;deleteConfirm=false;stopConfirm=false;render();});
 root.querySelector('#stop')?.addEventListener('click',()=>{stopConfirm=!stopConfirm;deleteConfirm=false;render();});
 root.querySelector('#delete')?.addEventListener('click',()=>{deleteConfirm=!deleteConfirm;stopConfirm=false;render();});
 root.querySelector('#cancelDelete')?.addEventListener('click',()=>{deleteConfirm=false;render();});
 root.querySelector('#confirmDelete')?.addEventListener('click',async()=>{deleteConfirm=false;await action('/delete',{id:s.id});render();});
 root.querySelector('#cancelStop')?.addEventListener('click',()=>{stopConfirm=false;render();});
 root.querySelector('#confirmStop')?.addEventListener('click',async()=>{stopConfirm=false;await action('/stop',{id:s.id});render();});
 root.querySelectorAll('[data-tab]').forEach(el=>el.onclick=()=>{clearInterval(timer);playing=false;tab=el.dataset.tab;resetScrollOnRender=true;if(tab==='Board'&&follow)followScroll=true;graphExpanded=false;render();if(tab==='Board')root.querySelector('#board-view')?.focus({preventScroll:true});});
 root.querySelectorAll('[data-mode]').forEach(el=>el.onclick=()=>{mode=el.dataset.mode;render();});
 root.querySelectorAll('[data-node]').forEach(el=>{el.onclick=()=>{graphMember=graphMember===el.dataset.node?'':el.dataset.node;render();};el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}};});
 root.querySelector('#zoom')?.addEventListener('click',()=>{graphExpanded=!graphExpanded;render();});
 root.querySelector('#hideInactive')?.addEventListener('click',()=>{hideInactive=!hideInactive;render();});
 root.querySelector('#minus')?.addEventListener('click',()=>{zoomLevel=Math.max(.6,Math.round((zoomLevel-.2)*10)/10);replayFrame();});
 root.querySelector('#plus')?.addEventListener('click',()=>{zoomLevel=Math.min(2.4,Math.round((zoomLevel+.2)*10)/10);replayFrame();});
 root.querySelector('#fit')?.addEventListener('click',()=>{zoomLevel=1;replayFrame();});
 root.querySelector('#first')?.addEventListener('click',()=>{replay=0;replayFrame();});
 root.querySelector('#pace')?.addEventListener('change',e=>{pace=Number(e.target.value);if(playing){clearInterval(timer);playing=false;}render();});
 root.querySelectorAll('[data-open]').forEach(el=>{el.onclick=e=>{if(e.target.closest('[data-retry],[data-open-chat]'))return;host.openSession(el.dataset.open).catch(e=>{error=e.message;render();});};el.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target===el){e.preventDefault();el.click();}};});
 root.querySelectorAll('[data-open-chat]').forEach(el=>el.onclick=e=>{e.stopPropagation();host.openSession(el.dataset.openChat).catch(e=>{error=e.message;render();});});
 root.querySelectorAll('[data-expand]').forEach(el=>el.onclick=()=>{const id=Number(el.dataset.expand);expandedPosts.has(id)?expandedPosts.delete(id):expandedPosts.add(id);render();});
 root.querySelectorAll('[data-retry]').forEach(el=>el.onclick=()=>action('/retry',{id:s.id,name:el.dataset.retry}));
 root.querySelector('#follow')?.addEventListener('click',()=>{follow=!follow;if(follow&&s){lastFeedCount=s.posts.length;newPosts=0;followScroll=true;}render();});
 root.querySelector('#new-posts')?.addEventListener('click',()=>{jumpLatest=true;render();});
 root.querySelector('#memberSearch')?.addEventListener('input',e=>{memberSearch=e.target.value;render();});
 root.querySelector('#filter')?.addEventListener('input',e=>{filter=e.target.value;render();});
 root.querySelector('#memberFilter')?.addEventListener('change',e=>{memberFilter=e.target.value;render();});
 root.querySelector('#message select')?.addEventListener('change',e=>{
  saveBoardDraft(s.id,root.querySelector('#message textarea')?.value||'',e.target.value);
 });
 root.querySelector('#message textarea')?.addEventListener('input',e=>{
  saveBoardDraft(s.id,e.target.value,root.querySelector('#message select')?.value||'coordinator');
 });
 root.querySelector('#message')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const swarmId=s.id;
  if(sendingMessages.has(swarmId))return;
  const values=new FormData(e.currentTarget);
  const body={id:swarmId,to:values.get('to'),text:values.get('text')};
  if(!body.text.trim())return;
  const submittedDraft=saveBoardDraft(swarmId,body.text,body.to);
  const submit=e.currentTarget.querySelector('button[type="submit"],button:not([type])');
  sendingMessages.add(swarmId);
  if(submit){submit.disabled=true;submit.setAttribute('aria-busy','true');}
  try{
   await api('/message',body);
   if(boardDraft(swarmId).revision===submittedDraft.revision){
    saveBoardDraft(swarmId,'',body.to);
    if(current()?.id===swarmId&&tab==='Board'){
     const textarea=root.querySelector('#message textarea');
     if(textarea&&textarea.value===body.text)textarea.value='';
    }
   }
   error='';
   await refresh();
  }catch(err){error=err.message;render();}
  finally{
   sendingMessages.delete(swarmId);
   if(current()?.id===swarmId){
    const currentSubmit=root.querySelector('#message button[type="submit"],#message button:not([type])');
    if(currentSubmit){currentSubmit.disabled=false;currentSubmit.removeAttribute('aria-busy');}
   }
  }
 });
 root.querySelector('#board-view')?.addEventListener('click',e=>{if(e.target===e.currentTarget){e.currentTarget.focus({preventScroll:true});return;}const post=e.target.closest('.board-post');if(post&&!e.target.closest('button,a,input,select,textarea'))post.focus({preventScroll:true});});
 root.querySelector('#board-view')?.addEventListener('keydown',e=>{
  const boardView=e.currentTarget,target=e.target;
   if(e.ctrlKey||e.metaKey||e.altKey)return;
   if(target.matches('input,textarea,select,button,a,[contenteditable="true"]'))return;
  const posts=[...boardView.querySelectorAll('.board-post')],focused=target.closest('[data-post-id]'),index=posts.indexOf(focused);
  if(e.key==='Escape'){e.preventDefault();boardView.focus({preventScroll:true});return;}
  if(e.key==='f'){e.preventDefault();follow=!follow;if(follow&&s){lastFeedCount=s.posts.length;newPosts=0;followScroll=true;}render();return;}
  if(e.key==='o'){e.preventDefault();(focused||posts.at(-1))?.querySelector('[data-open-chat]')?.click();return;}
  let next=-1;
  if(e.key==='j')next=index<0?0:Math.min(posts.length-1,index+1);
  else if(e.key==='k')next=index<0?posts.length-1:Math.max(0,index-1);
  else if(e.key==='g')next=0;
  else if(e.key==='G')next=posts.length-1;
  if(next>=0&&posts[next]){e.preventDefault();posts[next].focus({preventScroll:true});posts[next].scrollIntoView({block:'nearest'});}
 });
 root.querySelector('#prev')?.addEventListener('click',()=>{replay=Math.max(0,(replay??current().posts.length)-1);replayFrame();});
 root.querySelector('#next')?.addEventListener('click',()=>{replay=Math.min(current().posts.length,(replay??current().posts.length)+1);replayFrame();});
 root.querySelector('#replay')?.addEventListener('input',e=>{clearInterval(timer);playing=false;replay=Number(e.target.value);replayFrame();});
 root.querySelector('#replay')?.addEventListener('change',()=>{clearInterval(timer);playing=false;replayFrame();});
 root.querySelector('#live')?.addEventListener('click',()=>{clearInterval(timer);playing=false;replay=null;replayFrame();});
 root.querySelector('#play')?.addEventListener('click',()=>{if(playing){clearInterval(timer);playing=false;replayFrame();return;}playing=true;if(replay===null||replay>=s.posts.length)replay=0;timer=setInterval(()=>{if(replay>=current().posts.length){clearInterval(timer);playing=false;}else replay++;replayFrame();},800/pace);replayFrame();});
}
function selectItem(item){if(item?.kind==='link')requestedSwarm=item.identifier;else if(item?.kind==='session'||item?.kind==='message')requestedSwarm=item.sessionId;else return;const match=swarms.find(x=>x.id===requestedSwarm||x.key===requestedSwarm||x.members.some(m=>m.sessionId===requestedSwarm));if(match){selected=match.id;requestedSwarm='';render();}else refresh();}
host.onItem(selectItem);
host.onReady(ctx=>{ready=true;directory=ctx.directory;session=ctx.session;document.documentElement.dataset.theme='dark';document.documentElement.style.colorScheme='dark';render();selectItem(ctx.item);refresh();});
host.onDirectory(d=>{directory=d;refresh();});host.onSession(s=>{session=s;const match=swarms.find(x=>x.members.some(m=>m.sessionId===s?.id));if(match)selected=match.id;render();refresh();});host.onServiceEvent(e=>{if(e.topic==='swarm.changed')refresh();});setInterval(refresh,7000);
