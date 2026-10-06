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
