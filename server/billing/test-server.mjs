// 로컬 수동 검증 전용. 제품 라우터에 등록하거나 공개 서버에 배포하지 않는다.
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createBillingClient} from './client.mjs';
export function createTestServer({client,purchase,persist,label}) {
 let busy=false;
 return createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  const origin=`http://127.0.0.1:${req.socket.localPort}`;
  const reply=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
  if(req.headers.host!==new URL(origin).host) return reply(403,{error:'local_only'});
  if(req.method==='GET'&&req.url==='/') {
   const page=await readFile(new URL('./test-page.html',import.meta.url),'utf8');
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
   return res.end(page.replaceAll('{{label}}',label));
  }
  if(req.method!=='POST'||!['/checkout','/status'].includes(req.url)) return reply(404,{error:'not_found'});
  if(req.headers.origin!==origin) return reply(403,{error:'local_only'});
  if(req.headers['transfer-encoding']||Number(req.headers['content-length']||0)!==0) return reply(400,{error:'body_not_allowed'});
  if(busy) return reply(409,{error:'request_in_progress'});
  busy=true;
  try {
   if(req.url==='/status'&&!purchase.orderId) return reply(200,{status:'not_started'});
   const result=req.url==='/checkout'?await client.checkout(purchase):await client.reconcile(purchase.orderId,purchase);
   if(!result.ok) return reply(result.error==='pending_reconciliation'?202:502,{error:result.error});
   const o=result.order;
   purchase.orderId=o.id;
   await persist(purchase);
   return reply(200,{id:o.id,status:o.status,amount:o.price.amount,currency:o.price.currency,
    ...(req.url==='/checkout'&&o.status==='pending'?{checkoutUrl:o.checkout_url}:{})});
  } catch {return reply(503,{error:'verification_unavailable'});}
  finally {busy=false;}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const stateFile=process.env.BILLING_TEST_STATE_FILE;
 const purchase=JSON.parse(await readFile(stateFile,'utf8'));
 const client=createBillingClient({baseUrl:process.env.BILLING_BASE_URL,apiKey:process.env.BILLING_API_KEY,serviceId:process.env.BILLING_SERVICE_ID,priceId:process.env.BILLING_PRICE_ID});
 const port=Number(process.env.BILLING_TEST_PORT);
 if(!Number.isInteger(port)||port<1024||port>65535) throw new Error('invalid_test_port');
 const label=process.env.BILLING_SERVICE_ID==='lohtu'?'로뚜':'청첩장';
 const server=createTestServer({client,purchase,label,persist:p=>writeFile(stateFile,JSON.stringify(p),{mode:0o600})});
 server.listen(port,'127.0.0.1',()=>console.log(`${label} 테스트: http://127.0.0.1:${port}`));
}
