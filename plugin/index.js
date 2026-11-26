const bridge=async(action,sessionID,input,signal)=>{
 const fs=await import('node:fs/promises'), os=await import('node:os'), path=await import('node:path');
 let cfg; try{cfg=JSON.parse(await fs.readFile(path.join(os.homedir(),'.cache','openchamber-swarm','bridge.json'),'utf8'));}catch{throw Error('Swarm service unavailable. Enable Swarm in OpenChamber.');}
 if(!Number.isInteger(cfg.port)||cfg.port<1||cfg.port>65535||typeof cfg.token!=='string')throw Error('Invalid swarm service configuration');
 const r=await fetch('http://127.0.0.1:'+cfg.port+'/agent',{method:'POST',headers:{Authorization:'Bearer '+cfg.token,'Content-Type':'application/json'},body:JSON.stringify({action,sessionId:sessionID,input}),signal});
 const result=await r.json();if(!r.ok)throw Error(result.error||'Swarm request failed');return {content:JSON.stringify(result)};
};
const string={type:'string'}, boolean={type:'boolean'}, list={type:'array',items:string};
const definitions=[
 ['read','Read latest shared board posts; after is an optional post number.',{after:{type:'integer'}},[]],
 ['status','Read current swarm status, workers, tasks and board.',{},[]],
 ['add','Coordinator only: recruit a named worker or verifier; deferred recruits sleep until mentioned. Assign disjoint relative paths.',{name:string,role:{type:'string',enum:['worker','verifier']},brief:string,paths:list,model:string,deferred:boolean},['name','role','brief']],
 ['post','Post on the shared board; recipient names or all wake sleeping recipients. Use done to report completion, verified/changes for verifier result.',{to:list,text:string,kind:{type:'string',enum:['message','brief','question','report','done','verified','changes','blocker']}},['to','text']],
 ['retire','Coordinator only: retire a worker.',{name:string},['name']],
 ['finish','Coordinator only: complete the swarm after independent verification, or explicitly report failure.',{summary:string,failed:boolean},['summary']]
];
export default {id:'oc-swarm-tools',async setup(ctx){
 await ctx.tool.transform(tools=>{for(const [action,description,properties,required] of definitions)tools.add({name:'swarm_'+action,description,options:{codemode:false},input:{type:'object',properties,required,additionalProperties:false},async execute(input,context){return bridge(action,context.sessionID,input,context.signal);}});});
}};
