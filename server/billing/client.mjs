// 서버 전용 테스트 결제 어댑터. 호출자는 인증한 사용자의 구매 식별자를 보관한다.
const identifier = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const states = new Set(['pending', 'failed', 'paid', 'partial_refund', 'refunded']);
const failureMessages = new Map([
  ['payment_failed', '결제 승인이 거절되었습니다. 결제 수단을 확인해 주세요.'],
  ['authentication_failed', '카드 인증값 검증에 실패했습니다. 카드사 인증을 다시 진행해 주세요.'],
]);
function validFailure(failure) {
  const provider = failure?.provider;
  return failureMessages.has(failure?.code) &&
    provider?.name === 'portone' && typeof provider.transaction_id === 'string' && identifier.test(provider.transaction_id) &&
    typeof provider.failed_at === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(provider.failed_at) && Number.isFinite(Date.parse(provider.failed_at)) &&
    (provider.code === undefined || (typeof provider.code === 'string' && /^[a-zA-Z0-9._:-]{1,64}$/.test(provider.code)));
}
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
          (o.status === 'paid' && o.total !== o.price.amount) ||
          (o.status === 'failed' ? !validFailure(o.failure) : o.failure != null)) return { ok: false, error: 'order_mismatch' };
      if (o.status === 'pending') {
        const checkout = new URL(o.checkout_url);
        if (checkout.origin !== base.origin || checkout.pathname !== '/checkout/portone' || checkout.username || checkout.password) return { ok: false, error: 'invalid_checkout_url' };
      }
      if (o.status === 'failed') {
        const failure = o.failure;
        const provider = failure.provider;
        o.failure = { code: failure.code, message: failureMessages.get(failure.code), provider: {
          name: provider.name, transaction_id: provider.transaction_id, failed_at: provider.failed_at,
          ...(provider.code === undefined ? {} : { code: provider.code }),
        } };
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
