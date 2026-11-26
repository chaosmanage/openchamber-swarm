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
export function collectEdges(posts,visible){
 const pairs=new Map();
 for(const p of posts)for(const to of p.to){if(p.from===to||!visible.has(p.from)||!visible.has(to))continue;const [a,b]=[p.from,to].sort(),key=JSON.stringify([a,b]);let e=pairs.get(key);if(!e){e={a,b,ab:0,ba:0};pairs.set(key,e);}e[p.from===a?'ab':'ba']++;}
 return [...pairs.values()];
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
