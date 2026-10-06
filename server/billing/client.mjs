// 서버 전용 테스트 결제 어댑터. 호출자는 인증한 사용자의 구매 식별자를 보관한다.
const identifier = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const states = new Set(['pending', 'paid', 'partial_refund', 'refunded']);
export function createBillingClient({ baseUrl, apiKey, serviceId, priceId, fetchImpl = fetch }) {
  const base = new URL(baseUrl);
  if ((base.protocol !== 'https:' && !(base.protocol === 'http:' && base.hostname === '127.0.0.1')) ||
      base.username || base.password || base.pathname !== '/' || base.search || base.hash ||
      !apiKey || !identifier.test(serviceId) || !identifier.test(priceId)) throw new Error('invalid_billing_config');
  baseUrl = base.origin;
  async function request(path, purchase, body, orderId) {
    if (![purchase.customerRef, purchase.externalOrderId, purchase.idempotencyKey].every(v => typeof v === 'string' && identifier.test(v))) {
      return { ok: false, error: 'invalid_purchase' };
    }
    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': purchase.idempotencyKey },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (response.status === 202) return { ok: false, error: 'pending_reconciliation' };
      if (![200, 201].includes(response.status)) return { ok: false, error: 'billing_unavailable' };
      const o = await response.json();
      if (o.environment !== 'test' || o.service_id !== serviceId || !/^ord_[a-zA-Z0-9]+$/.test(o.id) ||
          (orderId && o.id !== orderId) || !states.has(o.status) ||
          o.request?.customer_ref !== purchase.customerRef || o.request?.external_order_id !== purchase.externalOrderId || o.request?.price_id !== priceId ||
          o.price?.currency !== 'KRW' || o.price?.amount_unit !== 'krw' || !Number.isSafeInteger(o.price?.amount) || o.price.amount <= 0 ||
          (o.status === 'paid' && o.total !== o.price.amount)) return { ok: false, error: 'order_mismatch' };
      if (o.status === 'pending') {
        const checkout = new URL(o.checkout_url);
        if (checkout.origin !== base.origin || checkout.pathname !== '/checkout/portone' || checkout.username || checkout.password) return { ok: false, error: 'invalid_checkout_url' };
      }
      return { ok: true, order: o };
    } catch { return { ok: false, error: 'billing_unavailable' }; }
  }
  return {
    checkout: purchase => request('/v1/checkout-sessions', purchase, {
      price_id: priceId, customer_ref: purchase.customerRef, external_order_id: purchase.externalOrderId,
    }),
    reconcile: (id, purchase) => /^ord_[a-zA-Z0-9]+$/.test(id)
      ? request(`/v1/orders/${id}/reconcile`, purchase, undefined, id)
      : Promise.resolve({ ok: false, error: 'invalid_order' }),
  };
}
