#!/usr/bin/env python3
"""storage-cost.md 의 모든 숫자를 계산한다.

단가는 2026-09-03 기준 공식 소스 값이다. 가격이 바뀌면 상수만 고치고 돌리면 된다.

  python3 claudedocs/storage-cost.py

── 3차 모델에서 고친 것 ────────────────────────────────────────────
1·2차는 값이 크게 과대했다. 원인이 셋이다.

  (a) CDN 을 안 넣었다.  가장 큰 오류다. 실무에서 정적 이미지를 CDN 없이
      스토리지에서 직접 내보낼 이유가 없다. CloudFront 는 월 1TB 전송과
      1,000만 요청이 영구 무료이고, S3→CloudFront 오리진 페치는 과금되지 않는다.
      이걸 빼먹어서 S3 가 R2 보다 115배 비싸다는 결론이 나왔다.

  (b) 지연 로딩과 브라우저 캐시가 없었다.  갤러리는 화면에 들어온 썸네일만
      불러오고, 사진 URL 이 정적이라 재방문은 대부분 캐시에서 나온다.
      2차까지는 재방문 횟수를 이그레스에 그대로 곱했다.

  (c) 썸네일을 30KB 로 잡았다.  3열 그리드 240px WebP 는 12KB 쯤이다.
"""

# ── 스토리지 단가 ───────────────────────────────────────────────────
# AWS Price List API: AmazonS3/current/ap-northeast-2
S3 = dict(st=.025, out=.126, put=.0045/1000, get=.00035/1000)
# cloud.google.com/storage/pricing (asia-northeast3). GCP만 GiB 라 GB 로 환산한다.
GIB = 1.073741824
GCS = dict(st=.023/GIB, out=.12/GIB, put=.01/1000, get=.0004/1000)
# developers.cloudflare.com/r2/pricing — 이그레스가 없고 Cloudflare CDN 이 기본이다
R2 = dict(st=.015, out=0, put=.0045/1000, get=.00036/1000,
          free_st=10, free_put=1e6, free_get=1e7)
# backblaze.com/cloud-storage/pricing — Cloudflare 를 앞에 세우면 이그레스 무료
B2 = dict(st=.00695, out=.01, free_st=10)
# supabase.com/pricing (Pro). 자체 CDN 포함.
SB = dict(base=25, inc_st=100, inc_out=250, over_st=.0213,
          over_out=.09, over_out_cached=.03)

# ── CDN 단가 ────────────────────────────────────────────────────────
# AWS Price List API: AmazonCloudFront, location "Asia Pacific" (한국 포함)
# 무료분은 aws.amazon.com/blogs/aws/aws-free-tier-data-transfer-expansion-... 확인
CF = dict(out=.12,               # 첫 10TB. 이후 $0.10 → $0.095 → $0.09
          req=.012/10_000,       # HTTPS GET/HEAD
          free_out=1000,         # 월 1TB, 영구 (12개월 한정 아님)
          free_req=10_000_000,   # 월 1,000만 요청, 영구
          origin_fetch=0)        # AWS 오리진(S3)→CloudFront 는 과금 안 함
# Cloud CDN 아시아 캐시 이그레스는 공식 표에서 확인하지 못했다.
# NA/EU 가 $0.08/GB 이고 아시아가 그보다 비싸다는 것까지만 확인했다. 무료분은 없다.
GCDN = dict(out=.09, free_out=0, req=0, origin_fetch=.01)   # 아시아 $0.09 는 추정치

MB = 1000.0                      # 10진 GB 로 통일. GCP만 위에서 환산했다.

# ── 파일 크기 ───────────────────────────────────────────────────────
PHOTO_KB = 250      # 긴 변 1,600px WebP q80
THUMB_KB = 12       # 3열 그리드용 240px WebP q75
N_PHOTOS = 60       # 살롱드레터 상한

PER_CARD_GB = N_PHOTOS * (PHOTO_KB + THUMB_KB) / MB / MB   # 원본 + 썸네일
PUT_PER_CARD = N_PHOTOS * 2
ORIGIN_GET_PER_CARD = N_PHOTOS * 2      # 캐시 미스. 객체당 최초 1회로 잡는다.

PRICE_KRW, FX = 14900, 1400     # 살롱드레터 상시 할인가, 환율 가정


class Traffic:
    """1건이 만들어 내는 이그레스와 요청.

    invitees   링크를 받는 사람
    open_rate  그중 갤러리까지 스크롤하는 비율
    thumbs     한 명이 실제로 불러오는 썸네일 수 (지연 로딩)
    taps       한 명이 원본으로 여는 장수
    revisit    재방문이 더하는 배수. URL 이 정적이라 대부분 브라우저 캐시에서 나온다.
    """
    def __init__(self, name, invitees, open_rate, thumbs, taps, revisit=1.05):
        self.name, self.viewers = name, invitees * open_rate
        self.thumbs, self.taps, self.revisit = thumbs, taps, revisit

    @property
    def out_gb(self):
        return self.viewers * (self.thumbs*THUMB_KB + self.taps*PHOTO_KB) * self.revisit / MB / MB

    @property
    def reqs(self):
        return self.viewers * (self.thumbs + self.taps) * self.revisit


SCENARIOS = [
    Traffic('가벼움', 200, 0.45, 15, 1),
    Traffic('기준',   300, 0.60, 30, 3),
    Traffic('무거움', 500, 0.80, 60, 15),
    # 참고용 물리적 최대치. 1·2차 분석이 "무거움"이라며 쓴 값이 이것이다.
    Traffic('이론상 최대', 500, 1.00, 60, 60, revisit=1.5),
]
BASE = SCENARIOS[1]


def tier(x, free, rate):
    return max(0, x - free) * rate

def s3_cf(st, out, reqs, put, ogets):
    """S3 + CloudFront. 오리진 페치가 무료라 이그레스는 전부 CloudFront 요금이다."""
    return (S3['st']*st + S3['put']*put + S3['get']*ogets
            + tier(out, CF['free_out'], CF['out'])
            + tier(reqs, CF['free_req'], CF['req']))

def gcs_cdn(st, out, reqs, put, ogets):
    return (GCS['st']*st + GCS['put']*put + GCS['get']*ogets
            + tier(out, GCDN['free_out'], GCDN['out']))

def r2(st, out, reqs, put, ogets):
    return (tier(st, R2['free_st'], R2['st'])
            + tier(reqs, R2['free_get'], R2['get'])
            + tier(put, R2['free_put'], R2['put']))

def b2_cf(st, out, reqs, put, ogets):
    return tier(st, B2['free_st'], B2['st'])      # Cloudflare 경유 이그레스 $0

def supabase(st, out, reqs, put, ogets, cached=True):
    rate = SB['over_out_cached'] if cached else SB['over_out']
    return tier(st, SB['inc_st'], SB['over_st']) + tier(out, SB['inc_out'], rate)


PROVIDERS = [('S3+CF', s3_cf), ('GCS+CDN', gcs_cdn), ('R2', r2),
             ('B2+CF', b2_cf), ('SB추가', supabase)]


def month(cards, months=12, t=BASE):
    """저장은 지금까지 만든 전체가 쌓이고, 이그레스는 이번 달 신규분이 쓴다."""
    return (PER_CARD_GB*cards*months, t.out_gb*cards, t.reqs*cards,
            PUT_PER_CARD*cards, ORIGIN_GET_PER_CARD*cards)

def row(label, args):
    print('  %-13s' % label, '  '.join(
        '%s $%7.2f' % (n, f(*args)) for n, f in PROVIDERS))


if __name__ == '__main__':
    print('1건 저장 %.1fMB · 기준 이그레스 %.0fMB · 요청 %s회\n' % (
        PER_CARD_GB*MB, BASE.out_gb*MB, f'{BASE.reqs:,.0f}'))

    print('=== 규모별 월 비용 (기준 시나리오, CDN 포함) ===')
    for label, n, m in (('데모 1건', 1, 1), ('월 100건', 100, 12),
                        ('월 1,000건', 1000, 12), ('월 10,000건', 10000, 12)):
        row(label, month(n, m))

    print('\n=== 시나리오별 (월 100건) ===')
    for t in SCENARIOS:
        args = month(100, 12, t)
        print('  %-11s 1건 %5.0fMB → 월 %6.0fGB   S3+CF $%6.2f   R2 $%5.2f'
              % (t.name, t.out_gb*MB, t.out_gb*100, s3_cf(*args), r2(*args)))

    print('\n=== CloudFront 무료분이 언제 끝나나 (기준 시나리오) ===')
    print('  전송 1TB     → 월 %.0f건' % (CF['free_out']/BASE.out_gb))
    print('  요청 1,000만 → 월 %.0f건  ← 이쪽이 먼저 막힌다' % (CF['free_req']/BASE.reqs))

    print('\n=== 리사이즈를 안 했을 때 (원본 4MB) ===')
    raw_card = N_PHOTOS*(4000+THUMB_KB)/MB/MB
    raw_out = BASE.viewers*(BASE.thumbs*THUMB_KB + BASE.taps*4000)*BASE.revisit/MB/MB
    print('  저장 %.1f배 · 이그레스 %.1f배' % (raw_card/PER_CARD_GB, raw_out/BASE.out_gb))
    row('원본 100건', (raw_card*100*12, raw_out*100, BASE.reqs*100,
                       PUT_PER_CARD*100, ORIGIN_GET_PER_CARD*100))

    print('\n=== 매출 대비 (₩%s/건, ₩%s/$) ===' % (f'{PRICE_KRW:,}', f'{FX:,}'))
    for label, n in (('100건', 100), ('1,000건', 1000), ('10,000건', 10000)):
        rev, args = n*PRICE_KRW/FX, month(n)
        print('  %-9s 매출 $%-8.0f S3+CF %.3f%% (1건당 ₩%.0f)   R2 %.3f%% (₩%.0f)' % (
            label, rev, s3_cf(*args)/rev*100, s3_cf(*args)/n*FX,
            r2(*args)/rev*100, r2(*args)/n*FX))
