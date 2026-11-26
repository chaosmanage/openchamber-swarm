const request=async(route,body,signal)=>{
 const fs=await import('node:fs/promises'), os=await import('node:os'), path=await import('node:path');
 let cfg; try{cfg=JSON.parse(await fs.readFile(path.join(os.homedir(),'.cache','openchamber-swarm','bridge.json'),'utf8'));}catch{throw Error('Swarm service unavailable. Enable Swarm in OpenChamber.');}
 if(!Number.isInteger(cfg.port)||cfg.port<1||cfg.port>65535||typeof cfg.token!=='string')throw Error('Invalid swarm service configuration');
 const r=await fetch('http://127.0.0.1:'+cfg.port+'/' +route,{method:'POST',headers:{Authorization:'Bearer '+cfg.token,'Content-Type':'application/json'},body:JSON.stringify(body),signal});
 const result=await r.json();if(!r.ok)throw Error(result.error||'Swarm request failed');return result;
};
const bridge=async(action,sessionID,input,signal)=>({content:JSON.stringify(await request('agent',{action,sessionId:sessionID,input},signal))});
const string={type:'string'}, boolean={type:'boolean'}, list={type:'array',items:string};
const definitions=[
 ['read','Read latest shared board posts; after is an optional post number.',{after:{type:'integer'}},[]],
 ['status','Read current swarm status, workers, tasks and board.',{},[]],
 ['add','Coordinator only: recruit a named worker or verifier; deferred recruits sleep until mentioned. Assign disjoint relative paths. Models are selected by Swarm settings; do not override them.',{name:string,role:{type:'string',enum:['worker','verifier']},brief:string,paths:list,model:string,deferred:boolean},['name','role','brief']],
 ['post','Post on the shared board; @mentions in text or recipient names wake sleeping recipients. Unaddressed posts are board-only. Use done to report completion, verified/changes for verifier result.',{to:list,text:string,kind:{type:'string',enum:['message','brief','question','report','done','verified','changes','blocker']}},['text']],
 ['retire','Coordinator only: retire a worker.',{name:string},['name']],
 ['finish','Coordinator only: complete the swarm after independent verification, or explicitly report failure.',{summary:string,failed:boolean},['summary']]
];
export default {id:'oc-swarm-tools',async setup(ctx){
 let stopped=false,timer;
 const poll=async()=>{try{
   const {job}=await request('bridge/poll',{directory:ctx.location.directory},AbortSignal.timeout(5000));
   if(job){const execute=async()=>{try{
    const result=job.op==='create'?await ctx.session.create(job.input):job.op==='wake'?await ctx.session.synthetic(job.input):job.op==='get'?await ctx.session.get(job.input):job.op==='switch-model'?(await ctx.session.switchModel(job.input),{ok:true}):job.op==='review'?await ctx.experimental.generate.text(job.input):job.op==='models'?((v)=>{const items=Array.isArray(v)?v:v?.data||[];return items.filter(m=>m.enabled!==false&&(!m.type||m.type==='chat')).map(m=>({id:m.providerID+'/'+(m.id||m.modelID),name:m.name||m.id}));})(await ctx.model.list({types:['chat']})):(()=>{throw Error('Unknown bridge job');})();
    await request('bridge/result',{id:job.id,result},AbortSignal.timeout(5000));
   }catch(e){await request('bridge/result',{id:job.id,error:String(e.message||e)},AbortSignal.timeout(5000)).catch(()=>{});}};
   if(job.op==='review')void execute();else await execute();}

 }catch{}finally{if(!stopped){timer=setTimeout(poll,900);timer.unref?.();}
}};
 // The context hook is called for each model request, including after tool calls.
 // Keep board content out of the user transcript; pass it as internal context.
 await ctx.session.hook('context',async input=>{
  try{
   const snapshot=await request('context',{sessionId:input.sessionID,directory:ctx.location.directory},AbortSignal.timeout(2500));
   if(!snapshot?.text)return;
   input.system.push({type:'text',text:snapshot.text});
   if(snapshot.ids?.length)await request('context/ack',{sessionId:input.sessionID,ids:snapshot.ids},AbortSignal.timeout(2500));
  }catch{}
 });
 await ctx.session.hook('experimental.idle',async input=>{await request('idle',{sessionId:input.sessionID,directory:ctx.location.directory},AbortSignal.timeout(2500)).catch(()=>{});});
 void poll();
 // Native deletion events also cover coordinator deletion from the OpenChamber chat list.
 const deleted=(async()=>{try{for await(const e of ctx.event.subscribe({types:['session.deleted']})){if(stopped)break;await request('session-deleted',{sessionId:e.data.sessionID,directory:e.location?.directory||ctx.location.directory},AbortSignal.timeout(2500)).catch(()=>{});}}catch{}})();

 // Native commands run after the host applies the composer model selection.
 await ctx.command.transform(commands=>commands.add({name:'swarm',description:'Start a collaborative swarm using the selected model',async execute({sessionID,prompt}){
  const task=String(prompt.text||'').trim();if(!task)throw Error('Usage: /swarm <task and acceptance criteria>');
  const info=await ctx.session.get({sessionID});if(!info?.model?.providerID||!info.model.id)throw Error('Choose a model in the chat before starting a swarm.');
  const swarm=await request('start',{task,sessionId:sessionID,directory:ctx.location.directory,model:info.model.providerID+'/'+info.model.id,modelRef:info.model},AbortSignal.timeout(10000));
  await ctx.session.update({sessionID,title:swarm.title});
 }}));
 await ctx.tool.transform(tools=>{for(const [action,description,properties,required] of definitions)tools.add({name:'swarm_'+action,description,options:{codemode:false},input:{type:'object',properties,required,additionalProperties:false},async execute(input,context){return bridge(action,context.sessionID,input,context.signal);}});});
 return ()=>{stopped=true;clearTimeout(timer);};
}};
