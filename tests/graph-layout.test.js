import test from 'node:test';
import assert from 'node:assert/strict';
import {VIEW,layoutGraph,collectEdges,edgeGeometry} from '../src/graph-layout.js';
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
