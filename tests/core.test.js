import test from 'node:test';
import assert from 'node:assert/strict';
import {createSwarm,addMember,appendPost,delivery,finish} from '../src/core.js';
const make=()=>createSwarm({task:'Test',directory:'/repo',sessionId:'ses_a',number:1});
test('board mention queues messages, including numbered groups and broadcast',()=>{const s=make();const a=addMember(s,{name:'fix-1',brief:'A'}),b=addMember(s,{name:'fix-2',brief:'B'});appendPost(s,'coordinator',['fix'],'work');assert.deepEqual(a.queue,[1]);assert.deepEqual(b.queue,[1]);appendPost(s,'fix-1',['all'],'report');assert.deepEqual(a.queue,[1]);assert.deepEqual(b.queue,[1,2]);assert.match(delivery(s,b),/report/);});
test('deferred members stay idle; retired members do not wake',()=>{const s=make();const a=addMember(s,{name:'verify',role:'verifier',brief:'Check'});appendPost(s,'coordinator',['verify'],'brief','brief',false);assert.equal(a.queue.length,0);appendPost(s,'coordinator',['verify'],'check now');assert.equal(a.queue.length,1);a.state='retired';appendPost(s,'coordinator',['verify'],'again');assert.equal(a.queue.length,1);});
test('reject overlapping ownership',()=>{const s=make();addMember(s,{name:'a',brief:'A',paths:['src']});assert.throws(()=>addMember(s,{name:'b',brief:'B',paths:['src/x.js']}),/Overlapping/);});
test('verify before finish and after new work',()=>{const s=make();addMember(s,{name:'a',brief:'Work'});addMember(s,{name:'verify',role:'verifier',brief:'Check'});assert.throws(()=>finish(s,'done'),/verification/);appendPost(s,'a',['verify'],'done','done');appendPost(s,'verify',['coordinator'],'passed','verified');appendPost(s,'a',['verify'],'new changes','done');assert.throws(()=>finish(s,'done'),/verify again/);appendPost(s,'verify',['coordinator'],'passed again','verified');finish(s,'done');assert.equal(s.status,'done');});
test('implicit @mentions route to exact/group recipients, unknown prose mentions and unaddressed posts do not wake',()=>{const s=make();const a=addMember(s,{name:'fix-1',brief:'A'}),b=addMember(s,{name:'fix-2',brief:'B'});appendPost(s,'coordinator',[],'@fix check, @unknown is not a member');assert.deepEqual(a.queue,[1]);assert.deepEqual(b.queue,[1]);appendPost(s,'coordinator',[],'FYI public board update');assert.deepEqual(a.queue,[1]);appendPost(s,'coordinator',[],'mail me at example@fix.com');assert.deepEqual(a.queue,[1]);});
test('assignment briefs do not notify agents mentioned within assignment text',()=>{
 const s=make();const a=addMember(s,{name:'alpha',brief:'A'}),b=addMember(s,{name:'beta',brief:'B'}),v=addMember(s,{name:'verifier',brief:'Check both',role:'verifier',deferred:true});
 const p=appendPost(s,'coordinator',['beta'],'Send @alpha a report and notify @coordinator when done.','brief');
 assert.deepEqual(p.to,['beta']);assert.deepEqual(a.queue,[]);assert.deepEqual(b.queue,[p.id]);
 const check=appendPost(s,'coordinator',['verifier'],'Check @alpha and @beta.','brief',false);
 assert.deepEqual(check.to,['verifier']);assert.deepEqual(v.queue,[]);assert.equal(v.deferred,true);
});
test('a public launch brief can be recorded without a wake, while identical later instructions still wake',()=>{
 const s=make(),m=s.members[0],brief=appendPost(s,'user',['coordinator'],s.task,'brief',false);
 assert.deepEqual(brief.to,['coordinator']);assert.deepEqual(m.queue,[]);
 const later=appendPost(s,'user',['coordinator'],s.task,'instruction');
 assert.deepEqual(m.queue,[later.id]);assert.equal(s.posts.length,2);
});
