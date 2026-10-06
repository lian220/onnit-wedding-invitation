import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTestServer} from './test-server.mjs';
test('로컬 테스트 요청만 허용하고 준비한 구매 외 주문을 받지 않는다',async(t)=>{
 let calls=0;
 const server=createTestServer({client:{checkout:async()=>{calls++;return {ok:false,error:'pending_reconciliation'};}},purchase:{},persist:async()=>{},port:0,label:'결제 테스트'});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 assert.equal((await fetch(base+'/checkout',{method:'POST',headers:{Origin:'https://evil.example'}})).status,403);
 assert.equal((await fetch(base+'/checkout',{method:'POST',headers:{Origin:base},body:'{"amount":1}'})).status,400);
 assert.equal(calls,0);
 assert.equal((await fetch(base+'/checkout',{method:'POST',headers:{Origin:base}})).status,202);
 assert.equal(calls,1);
 assert.equal((await fetch(base+'/.env')).status,404);
});

test('실패 원인은 검증된 상태 응답에 포함하고 결제창이나 승인으로 표시하지 않는다',async(t)=>{
 const failure={code:'authentication_failed',message:'카드 인증값 검증에 실패했습니다. 카드사 인증을 다시 진행해 주세요.',provider:{name:'portone',code:'CC26',transaction_id:'tx-test-1',failed_at:'2026-10-06T12:00:00Z'}};
 const server=createTestServer({client:{reconcile:async()=>({ok:true,order:{id:'ord_test',status:'failed',price:{amount:3000,currency:'KRW'},failure}})},purchase:{orderId:'ord_test'},persist:async()=>{},label:'결제 테스트'});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 const r=await fetch(base+'/status',{method:'POST',headers:{Origin:base}});
 assert.equal(r.status,200);
 assert.deepEqual(await r.json(),{id:'ord_test',status:'failed',amount:3000,currency:'KRW',failure});
});

test('테스트 화면은 실패 사유와 코드를 텍스트로 표시하고 다음 승인 상태로 갱신한다',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {runInNewContext}=await import('node:vm');
 const page=await readFile(new URL('./test-page.html',import.meta.url),'utf8');
 const nodes=Object.fromEntries(['#status','#link','#checkout','#verify'].map(id=>[id,{textContent:'',disabled:false,replaceChildren(){}}]));
 const document={querySelector:id=>nodes[id],querySelectorAll:()=>[nodes['#checkout'],nodes['#verify']],createElement:()=>({})};
 let response={id:'ord_test',status:'failed',failure:{code:'authentication_failed',message:'카드 인증값 검증에 실패했습니다.',provider:{code:'CC26'}}};
 const context={document,fetch:async()=>({json:async()=>response})};
 runInNewContext(page.match(/<script>([\s\S]*?)<\/script>/)[1],context);
 await nodes['#verify'].onclick();
 assert.match(nodes['#status'].textContent,/결제 실패/);
 assert.match(nodes['#status'].textContent,/카드 인증값/);
 assert.match(nodes['#status'].textContent,/CC26/);
 response={id:'ord_test',status:'paid'};
 await nodes['#verify'].onclick();
 assert.match(nodes['#status'].textContent,/결제 승인 확인 완료/);
 assert.doesNotMatch(nodes['#status'].textContent,/CC26|결제 실패/);
});
