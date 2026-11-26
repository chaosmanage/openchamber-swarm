// Coordinates depend on the roster, never the current replay frame.
export const VIEW=[0,0,640,324];
const CELLS=[[0,0],[-1,0],[1,-1],[-1,1],[1,0],[0,-1],[0,1],[-2,1],[2,-1],[-2,0],[2,-2],[-1,-1],[1,1]];
export function layoutGraph(roster,hive){
 const positions=new Map(),r=roster.length<=7?53:43;
 if(hive){
  const ordered=[roster.find(m=>m.role==='coordinator'),...roster.filter(m=>m.role!=='coordinator'&&m.role!=='monitor'),roster.find(m=>m.role==='monitor')].filter(Boolean);
  ordered.forEach((m,i)=>{const [q,z]=CELLS[i];positions.set(m.name,[320+1.5*r*q,162+Math.sqrt(3)*r*(z+q/2)]);});
 }else{
  const workers=roster.filter(m=>m.role!=='coordinator'&&m.role!=='monitor'),left=workers.filter((_,i)=>i%2===0),right=workers.filter((_,i)=>i%2===1);
  for(const m of roster){if(m.role==='coordinator')positions.set(m.name,[320,28]);if(m.role==='monitor')positions.set(m.name,[320,296]);}
  for(const [group,x] of [[left,82],[right,558]])group.forEach((m,i)=>{positions.set(m.name,[x,group.length===1?162:162-(group.length-1)*Math.min(108,216/(group.length-1))/2+i*Math.min(108,216/(group.length-1))]);});
 }
 return {positions,r};
}
// Fit the complete roster, including members hidden by replay/filtering.
export function graphCamera(positions,r,hive,zoom=1){
 const points=[...positions.values()];
 if(!points.length)return VIEW.slice();
 const px=hive?r+14:64+12,py=hive?Math.sqrt(3)*r/2+14:13+12;
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const left=Math.min(...xs)-px,right=Math.max(...xs)+px,top=Math.min(...ys)-py,bottom=Math.max(...ys)+py;
 const cx=(left+right)/2,cy=(top+bottom)/2,w=(right-left)/zoom,h=(bottom-top)/zoom;
 return [cx-w/2,cy-h/2,w,h];
}
export function collectEdges(posts,visible){
 const pairs=new Map();
 for(const p of posts)for(const to of p.to){if(p.from===to||!visible.has(p.from)||!visible.has(to))continue;const [a,b]=[p.from,to].sort(),key=JSON.stringify([a,b]);let e=pairs.get(key);if(!e){e={a,b,ab:0,ba:0};pairs.set(key,e);}e[p.from===a?'ab':'ba']++;}
 return [...pairs.values()];
}
// Retain only short-lived event pulses. A newly opened graph and a return to
// Live establish a baseline; neither should animate the existing backlog.
export function graphMotion(previous,swarm,posts,replay,now=Date.now()){
 const count=replay===null?posts.length:Math.max(0,Math.min(replay,posts.length));
 const same=previous?.swarm===swarm,mode=replay===null?'live':'replay';
 let pulses=same?previous.pulses.filter(p=>p.until>now):[];
 if(same&&mode==='replay'&&(previous.mode!=='replay'||previous.count!==count)){
  pulses=count?[{post:posts[count-1],until:now+1400}]:[];
 }else if(same&&mode==='live'&&previous.mode==='replay'){
  pulses=[];
 }else if(same&&mode==='live'){
  const index=previous.lastId==null?-1:posts.findIndex(p=>p.id===previous.lastId);
  if((index>=0||previous.length===0)&&posts.length>previous.length){
   pulses.push(...posts.slice(index+1).map(post=>({post,until:now+1400})));
  }
 }
 return {swarm,mode,count,length:posts.length,lastId:posts.at(-1)?.id??null,pulses};
}
// The symbol makes the cue recognizable without relying on color alone.
export function memberCue(member){
 if(member.state==='blocked')return {label:'Needs attention',symbol:'!'};
 if(member.state==='retired')return {label:'Retired',symbol:'−'};
 if(member.taskState==='verified')return {label:'Verified',symbol:'✓'};
 if(member.taskState==='reported')return {label:'Reported',symbol:'✓'};
 if(member.state==='waiting')return {label:'Standing by',symbol:'Ⅱ'};
 if(member.state==='dispatching')return {label:'Waking',symbol:'◌'};
 if(member.state==='active')return {label:'Working',symbol:'●'};
 return {label:'Standing by',symbol:'Ⅱ'};
}
export function edgeGeometry(from,to,halfWidth=68,halfHeight=16){
 const [x,y]=from,[u,v]=to,dx=u-x,dy=v-y;
 if(dx===0&&halfWidth>=64){
  const side=x<320?1:-1,sign=Math.sign(dy)||1, sx=x+side*halfWidth,sy=y+sign*5,tx=u+side*halfWidth,ty=v-sign*5,bend=sx+side*Math.min(80,26+Math.abs(dy)*.15);
  return {path:'M'+sx+' '+sy+' C'+bend+' '+sy+' '+bend+' '+ty+' '+tx+' '+ty,x:(sx+bend)*.5,y:(sy+ty)*.5};
 }
 const offset=Math.min(halfWidth/(Math.abs(dx)||1e-9),halfHeight/(Math.abs(dy)||1e-9),.40);
 const sx=x+dx*offset,sy=y+dy*offset,tx=u-dx*offset,ty=v-dy*offset;
 return {path:'M'+sx+' '+sy+' L'+tx+' '+ty,x:(sx+tx)/2,y:(sy+ty)/2};
}
