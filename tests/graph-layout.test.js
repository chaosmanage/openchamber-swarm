import test from 'node:test';
import assert from 'node:assert/strict';
import {VIEW,layoutGraph,collectEdges,edgeGeometry,graphMotion,memberCue} from '../src/graph-layout.js';
const roster=Array.from({length:13},(_,i)=>({name:'member-'+i,role:i===0?'coordinator':i===12?'monitor':i===11?'verifier':'worker'}));
test('all allowed swarm sizes fit stable non-overlapping graph positions',()=>{
 for(let n=2;n<=13;n++)for(const hive of [true,false]){
  const members=[...roster.slice(0,n-1),roster[12]],{positions,r}=layoutGraph(members,hive);
  assert.equal(positions.size,n);
  assert.deepEqual(layoutGraph(members.map(m=>({...m,state:'retired'})),hive).positions,positions);
  const halfX=hive?r:64,halfY=hive?Math.sqrt(3)*r/2:13;
  for(const [x,y] of positions.values())assert.ok(x-halfX>=0&&x+halfX<=VIEW[2]&&y-halfY>=0&&y+halfY<=VIEW[3],JSON.stringify({n,hive,x,y}));
 }
});
test('opposite mentions aggregate into one connection with independent directional counts',()=>{
 const v=new Set(['a','b']);const edges=collectEdges([{from:'a',to:['b']},{from:'b',to:['a']},{from:'a',to:['b','c','a']}],v);
 assert.deepEqual(edges,[{a:'a',b:'b',ab:2,ba:1}]);
 assert.deepEqual(edgeGeometry([80,50],[560,50]),{path:'M148 50 L492 50',x:320,y:50});
});
test('fit and zoom use the roster bounds and preserve the exact camera center',async()=>{
 const {graphCamera}=await import('../src/graph-layout.js');
 for(let n=2;n<=13;n++)for(const hive of [true,false]){
  const {positions,r}=layoutGraph([...roster.slice(0,n-1),roster[12]],hive);
  const fit=graphCamera(positions,r,hive),zoom=graphCamera(positions,r,hive,1.8);
  const center=v=>[v[0]+v[2]/2,v[1]+v[3]/2];
  assert.ok(center(fit).every((v,i)=>Math.abs(v-center(zoom)[i])<1e-8));
  assert.ok(Math.abs(fit[2]/zoom[2]-1.8)<1e-8);
  for(const [x,y] of positions.values()){
   const hx=hive?r:64,hy=hive?Math.sqrt(3)*r/2:13;
   assert.ok(x-hx>=fit[0]&&x+hx<=fit[0]+fit[2]&&y-hy>=fit[1]&&y+hy<=fit[1]+fit[3]);
  }
 }
});
test('live events pulse once, refreshes do not restart them, and replay never spills into live',()=>{
 const a={id:1,from:'a',to:['b']},b={id:2,from:'b',to:['a','c']},c={id:3,from:'c',to:['a']};
 let state=graphMotion(null,'swarm',[a],null,0);
 assert.deepEqual(state.pulses,[]);
 state=graphMotion(state,'swarm',[a,b],null,100);
 assert.deepEqual(state.pulses,[{post:b,until:1500}]);
 state=graphMotion(state,'swarm',[a,b],null,200);
 assert.deepEqual(state.pulses,[{post:b,until:1500}]);
 state=graphMotion(state,'swarm',[a,b],null,1500);
 assert.deepEqual(state.pulses,[]);
 state=graphMotion(state,'swarm',[a,b],1,1600);
 assert.deepEqual(state.pulses,[{post:a,until:3000}]);
 state=graphMotion(state,'swarm',[a,b,c],1,1700);
 assert.deepEqual(state.pulses,[{post:a,until:3000}]);
 state=graphMotion(state,'swarm',[a,b,c],2,1800);
 assert.deepEqual(state.pulses,[{post:b,until:3200}]);
 state=graphMotion(state,'swarm',[a,b,c],null,1900);
 assert.deepEqual(state.pulses,[]);
 state=graphMotion(state,'swarm',[a,b,c],null,2000);
 assert.deepEqual(state.pulses,[]);
 state=graphMotion(state,'other',[a,b,c],null,2100);
 assert.deepEqual(state.pulses,[]);
});
test('batched new posts each pulse, but a replaced history is a new baseline',()=>{
 const posts=[{id:1},{id:2},{id:3}];
 let state=graphMotion(null,'swarm',[],null,0);
 state=graphMotion(state,'swarm',posts,null,10);
 assert.deepEqual(state.pulses.map(p=>p.post.id),[1,2,3]);
 state=graphMotion(state,'swarm',[{id:4},{id:5},{id:6},{id:7}],null,2000);
 assert.deepEqual(state.pulses,[]);
});
test('state cues remain distinct without color and blocked takes priority over verified',()=>{
 assert.deepEqual(memberCue({state:'waiting'}),{label:'Standing by',symbol:'Ⅱ'});
 assert.deepEqual(memberCue({state:'blocked',taskState:'verified'}),{label:'Needs attention',symbol:'!'});
 assert.deepEqual(memberCue({state:'waiting',taskState:'verified'}),{label:'Verified',symbol:'✓'});
 assert.notEqual(memberCue({state:'waiting',taskState:'changes'}).label,'Verified');
});
test('lifecycle and task state produce realistic completed and exceptional cues',()=>{
 const cases=[
  [{state:'waiting',taskState:'reported'},'Reported'],
  [{state:'active',taskState:'reported'},'Reported'],
  [{state:'waiting',taskState:'verified'},'Verified'],
  [{state:'blocked',taskState:'reported'},'Needs attention'],
  [{state:'blocked',taskState:'verified'},'Needs attention'],
  [{state:'retired',taskState:'reported'},'Retired'],
  [{state:'retired',taskState:'verified'},'Retired'],
  [{state:'waiting',taskState:'working'},'Standing by'],
  [{state:'active',taskState:'working'},'Working'],
  [{state:'dispatching',taskState:'queued'},'Waking']
 ];
 for(const [member,label] of cases)assert.equal(memberCue(member).label,label,JSON.stringify(member));
});
