#!/usr/bin/env python3
"""storage-cost.md 의 모든 숫자를 다시 계산한다.

단가는 2026-09-03 기준으로 공식 소스에서 뽑은 값이다.
가격이 바뀌면 아래 상수만 고치고 다시 돌리면 된다.

  python3 claudedocs/storage-cost.py
"""

# ── 단가 ────────────────────────────────────────────────────────────
# AWS Price List API: AmazonS3/current/ap-northeast-2, AWSDataTransfer
S3  = dict(st=.025,   out=.126, put=.0045/1000, get=.00035/1000)
# cloud.google.com/storage/pricing (asia-northeast3, 아시아 목적지)
# GCP만 GiB 단위로 고시한다. 아래에서 GB(10진) 기준으로 환산해 비교선을 맞춘다.
GIB = 1.073741824
GCS = dict(st=.023/GIB, out=.12/GIB, put=.01/1000, get=.0004/1000)
# developers.cloudflare.com/r2/pricing
R2  = dict(st=.015,   out=0,    put=.0045/1000, get=.00036/1000,
           free_st=10, free_put=1e6, free_get=1e7)
# backblaze.com/cloud-storage/pricing — 이그레스는 저장량의 3배까지 무료
B2  = dict(st=.00695, out=.01,  free_st=10)
# supabase.com/pricing (Pro)
SB  = dict(base=25, inc_st=100, inc_out=250, over_st=.0213,
           over_out=.09, over_out_cached=.03)

# ── 워크로드 가정 ───────────────────────────────────────────────────
PHOTO_KB   = 250        # 긴 변 1,600px WebP
THUMB_KB   = 30
N_PHOTOS   = 60         # 살롱드레터 상한
GUESTS     = 300
FULL_VIEWS = 10         # 하객 한 명이 원본으로 보는 장수

# 단위는 10진 GB(1GB = 1,000MB = 1,000,000KB)로 통일한다.
# AWS·R2·B2·Supabase 가 이 단위로 청구하고, GCP만 GiB 라 위에서 환산해 두었다.
MB = 1000.0
PER_CARD_GB = (N_PHOTOS * (PHOTO_KB + THUMB_KB)) / MB / MB
PER_GUEST_GB = (N_PHOTOS * THUMB_KB + FULL_VIEWS * PHOTO_KB) / MB / MB
OUT_PER_CARD = GUESTS * PER_GUEST_GB
GET_PER_CARD = GUESTS * (N_PHOTOS + FULL_VIEWS)
PUT_PER_CARD = N_PHOTOS * 2

PRICE_KRW, FX = 14900, 1400     # 살롱드레터 상시 할인가, 환율 가정


def metered(st, out, put, get, p):
    return p['st']*st + p['out']*out + p['put']*put + p['get']*get

def r2(st, out, put, get):
    return (R2['st'] * max(0, st - R2['free_st'])
            + R2['get'] * max(0, get - R2['free_get'])
            + R2['put'] * max(0, put - R2['free_put']))

def b2(st, out):
    return B2['st'] * max(0, st - B2['free_st']) + B2['out'] * max(0, out - 3*st)

def supabase_extra(st, out, cached=False):
    rate = SB['over_out_cached'] if cached else SB['over_out']
    return (SB['over_st'] * max(0, st - SB['inc_st'])
            + rate * max(0, out - SB['inc_out']))

def row(name, st, out, put, get):
    print('  %-14s S3 $%8.2f   GCS $%8.2f   R2 $%7.2f   B2 $%7.2f   SB +$%7.2f' % (
        name, metered(st, out, put, get, S3), metered(st, out, put, get, GCS),
        r2(st, out, put, get), b2(st, out), supabase_extra(st, out)))


def scenario(cards_per_month, months_accumulated):
    """누적 저장량은 지금까지 만든 전체, 이그레스는 이번 달 신규분이 소비한다고 본다."""
    st  = PER_CARD_GB * cards_per_month * months_accumulated
    out = OUT_PER_CARD * cards_per_month
    return st, out, PUT_PER_CARD * cards_per_month, GET_PER_CARD * cards_per_month


if __name__ == '__main__':
    print('1건 = %.1fMB 저장 · %.2fGB 아웃 · GET %s회\n' % (
        PER_CARD_GB * MB, OUT_PER_CARD, f'{GET_PER_CARD:,}'))

    print('=== 규모별 월 비용 ===')
    row('데모 1건',   *scenario(1, 1))
    row('월 100건',   *scenario(100, 12))
    row('월 1,000건', *scenario(1000, 12))

    print('\n=== 민감도 (월 100건, 저장 20GB 고정) ===')
    for name, guests, views, revisit in (
            ('가벼움', 150, 3,  1.0),
            ('기준',   300, 10, 1.0),
            ('무거움', 500, 60, 1.5)):
        per_guest = (N_PHOTOS * THUMB_KB + views * PHOTO_KB) / MB / MB * revisit
        row(name, 20, guests * per_guest * 100, PUT_PER_CARD * 100,
            guests * (N_PHOTOS + views) * revisit * 100)

    print('\n=== 리사이즈를 안 했을 때 (원본 4MB) ===')
    raw_card = (N_PHOTOS * 4000 + N_PHOTOS * THUMB_KB) / MB / MB
    raw_guest = (N_PHOTOS * THUMB_KB + FULL_VIEWS * 4000) / MB / MB
    print('  저장 %.1f배 · 이그레스 %.1f배' % (raw_card / PER_CARD_GB,
                                              raw_guest / PER_GUEST_GB))
    row('원본 100건', raw_card * 100 * 12 / 12, GUESTS * raw_guest * 100,
        PUT_PER_CARD * 100, GET_PER_CARD * 100)

    print('\n=== Supabase Pro 손익분기 ===')
    print('  이그레스 %.0f건/월 · 스토리지 누적 %.0f건' % (
        SB['inc_out'] / OUT_PER_CARD, SB['inc_st'] / PER_CARD_GB))
    for label, n in (('100건', 100), ('1,000건', 1000)):
        st, out, _, _ = scenario(n, 12)
        print('  %-8s +$%.2f  (CDN 캐시가 먹으면 +$%.2f)' % (
            label, supabase_extra(st, out), supabase_extra(st, out, cached=True)))

    print('\n=== 매출 대비 (₩%s/건, ₩%s/$) ===' % (f'{PRICE_KRW:,}', f'{FX:,}'))
    for label, n in (('100건', 100), ('1,000건', 1000)):
        rev = n * PRICE_KRW / FX
        args = scenario(n, 12)
        print('  %-8s 매출 $%-8.0f S3 %.2f%%   R2 %.3f%%' % (
            label, rev, metered(*args, S3) / rev * 100, r2(*args) / rev * 100))
