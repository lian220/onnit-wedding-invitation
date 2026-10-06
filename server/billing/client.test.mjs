import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBillingClient } from './client.mjs';
const purchase = { customerRef: 'test-customer', externalOrderId: 'purchase-1', idempotencyKey: 'purchase-1' };
const config = { baseUrl: 'https://billing.example', apiKey: 'server-test-key', serviceId: 'lohtu', priceId: 'test-price' };
const order = { id: 'ord_test', service_id: 'lohtu', environment: 'test', status: 'pending', request: { customer_ref: 'test-customer', external_order_id: 'purchase-1', price_id: 'test-price' }, price: { amount: 3000, currency: 'KRW', amount_unit: 'krw' }, checkout_url: 'https://billing.example/checkout/portone?token=test' };
test('서버 가격과 구매번호를 사용하고 같은 요청의 멱등 키를 유지한다', async () => {
 const calls=[];
 const client=createBillingClient({...config, fetchImpl: async (url, init)=> {calls.push({url,init});return Response.json(order,{status:201});}});
 for(let i=0;i<2;i++) assert.equal((await client.checkout(purchase)).ok,true);
 assert.equal(calls[0].url,'https://billing.example/v1/checkout-sessions');
 assert.deepEqual(calls[0].init.headers,calls[1].init.headers);
 assert.equal(calls[0].init.body,calls[1].init.body);
 assert.equal(calls[0].init.headers.Authorization,'Bearer server-test-key');
 assert.equal(calls[0].init.headers['Idempotency-Key'],'purchase-1');
 assert.deepEqual(JSON.parse(calls[0].init.body),order.request);
});
test('불확실한 응답은 성공 처리하거나 민감한 원문을 반환하지 않는다', async () => {
 for (const [status, body] of [[202,order],[401,{error:'secret'}],[503,{error:'secret'}],[200,{...order,environment:'live'}],[200,{...order,service_id:'other'}],[200,{...order,request:{...order.request,customer_ref:'other'}}]]) {
  const client=createBillingClient({...config,fetchImpl:async()=>Response.json(body,{status})});
  const result=await client.checkout(purchase);
  assert.equal(result.ok,false,`${status} ${body.environment}`);
  assert.equal(JSON.stringify(result).includes('secret'),false);
 }
 const client=createBillingClient({...config,fetchImpl:async()=>{throw new Error('secret');}});
 assert.equal((await client.checkout(purchase)).ok,false);
});
test('상태 확인은 서버 재조회이며 다른 구매와 비정상 금액·상태를 거절한다', async () => {
 const calls=[];
 const paid={...order,status:'paid',total:3000};
 const client=createBillingClient({...config,fetchImpl:async(url,init)=>{calls.push({url,init});return Response.json(paid);}});
 assert.equal((await client.reconcile('ord_test',purchase)).order.status,'paid');
 assert.equal(calls[0].url,'https://billing.example/v1/orders/ord_test/reconcile');
 assert.equal(calls[0].init.redirect,'error');
 assert.ok(calls[0].init.signal);
 for(const patch of [{id:'other'},{status:'unknown'},{price:{...order.price,amount_unit:'lemon_cents'}},{total:1}]) {
  const c=createBillingClient({...config,fetchImpl:async()=>Response.json({...paid,...patch})});
  assert.equal((await c.reconcile('ord_test',purchase)).ok,false);
 }
 assert.equal((await client.reconcile('../events',purchase)).ok,false);
});
test('비밀 전송 주소와 반환 결제창 주소를 제한한다', async () => {
 for(const baseUrl of ['http://public.example','https://billing.example/path','https://user:pass@billing.example']) {
  assert.throws(()=>createBillingClient({...config,baseUrl}));
 }
 for(const checkout_url of ['javascript:alert(1)','https://other.example/checkout/portone','https://billing.example/other']) {
  const c=createBillingClient({...config,fetchImpl:async()=>Response.json({...order,checkout_url})});
  assert.equal((await c.checkout(purchase)).ok,false);
 }
});

test('확인된 결제 실패는 정상 주문으로 반환하되 실패 계약을 검증한다', async () => {
 const failure={code:'authentication_failed',message:'카드 인증값 검증에 실패했습니다. 카드사 인증을 다시 진행해 주세요.',provider:{name:'portone',code:'CC26',transaction_id:'tx-test-1',failed_at:'2026-10-06T12:00:00Z'}};
 const failed={...order,status:'failed',failure};
 const client=createBillingClient({...config,fetchImpl:async()=>Response.json(failed)});
 const result=await client.reconcile('ord_test',purchase);
 assert.equal(result.ok,true);
 assert.deepEqual(result.order.failure,failure);
 const unsafe=createBillingClient({...config,fetchImpl:async()=>Response.json({...failed,failure:{...failure,message:'<script>private upstream</script>',raw:'secret',provider:{...failure.provider,raw:'secret'}}})});
 const normalized=await unsafe.reconcile('ord_test',purchase);
 assert.deepEqual(normalized.order.failure,failure);
 assert.equal(JSON.stringify(normalized).includes('secret'),false);
 for(const bad of [undefined,{...failure,code:'unknown'},{...failure,provider:{...failure.provider,name:'other'}},{...failure,provider:{...failure.provider,transaction_id:''}},{...failure,provider:{...failure.provider,failed_at:'invalid'}},{...failure,provider:{...failure.provider,code:'<secret>'}}]) {
  const c=createBillingClient({...config,fetchImpl:async()=>Response.json({...failed,failure:bad})});
  assert.deepEqual(await c.reconcile('ord_test',purchase),{ok:false,error:'order_mismatch'});
 }
 const stale=createBillingClient({...config,fetchImpl:async()=>Response.json({...order,status:'paid',total:3000,failure})});
 assert.deepEqual(await stale.reconcile('ord_test',purchase),{ok:false,error:'order_mismatch'});
});

test('실패 주문의 재시도 URL도 검증하고 같은 구매 키로 결제창을 갱신한다',async()=>{
 const failure={code:'payment_failed',provider:{name:'portone',transaction_id:'tx-test-2',failed_at:'2026-10-06T12:00:00Z'}};
 const failed={...order,status:'failed',failure};
 for(const checkout_url of ['https://evil.example/checkout/portone','javascript:alert(1)','https://billing.example/other']) {
  const client=createBillingClient({...config,fetchImpl:async()=>Response.json({...failed,checkout_url})});
  assert.deepEqual(await client.checkout(purchase),{ok:false,error:'invalid_checkout_url'});
 }
 const calls=[];
 const client=createBillingClient({...config,fetchImpl:async(url,init)=>{calls.push({url,init});return Response.json({...failed,checkout_url:order.checkout_url+'&refresh='+calls.length});}});
 const first=await client.checkout(purchase),second=await client.checkout(purchase);
 assert.equal(first.ok,true);assert.equal(second.ok,true);
 assert.notEqual(first.order.checkout_url,second.order.checkout_url);
 assert.equal(first.order.id,second.order.id);
 assert.equal(calls[0].init.headers['Idempotency-Key'],calls[1].init.headers['Idempotency-Key']);
 assert.equal(calls[0].init.body,calls[1].init.body);
 const noLink=createBillingClient({...config,fetchImpl:async()=>Response.json({...failed,checkout_url:undefined})});
 assert.equal((await noLink.reconcile('ord_test',purchase)).ok,true);
});
