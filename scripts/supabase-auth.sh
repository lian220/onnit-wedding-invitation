#!/usr/bin/env bash
# Supabase Auth 설정을 .env 값으로 맞춘다 — Site URL · Redirect URL · 카카오 provider.
# 대시보드에서 손으로 넣은 것과 같은 결과를 Management API 로 재현한다. 새 환경에서 한 번, 키를 바꿀 때 한 번 돌린다.
#
#   사용:  scripts/supabase-auth.sh          적용
#          scripts/supabase-auth.sh --show   현재 값만 본다 (시크릿은 가려서)
#
# .env 에 필요한 값 (.env.example 참고):
#   SUPABASE_PROJECT_REF     프로젝트 ref
#   SUPABASE_ACCESS_TOKEN    그 계정의 Personal Access Token (대시보드 → Account → Access Tokens)
#                            없으면 ~/.config/supabase-accounts/onnit.token 을 읽는다 (switch-supabase 와 같은 파일)
#   KAKAO_REST_API_KEY       카카오 콘솔 → 앱 → 플랫폼 키 → REST API 키
#   KAKAO_CLIENT_SECRET      같은 키의 더보기 → 수정 → 클라이언트 시크릿 → 카카오 로그인 코드
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo ".env 가 없다. cp .env.example .env 뒤에 채운다" >&2; exit 1; }
set -a; . ./.env; set +a
: "${SUPABASE_ACCESS_TOKEN:=$(cat "$HOME/.config/supabase-accounts/onnit.token" 2>/dev/null || true)}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF 가 비었다}"
: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN 이 비었다}"

API="https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/config/auth"
AUTH=(-H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json")
SHOW='{site_url, uri_allow_list, external_kakao_enabled, external_kakao_client_id, external_kakao_email_optional,
       external_kakao_secret: (if .external_kakao_secret then "(set)" else null end)}'

if [ "${1:-}" = "--show" ]; then
  curl -fsS "$API" "${AUTH[@]}" | jq "$SHOW"; exit 0
fi

: "${KAKAO_REST_API_KEY:?KAKAO_REST_API_KEY 가 비었다}"
: "${KAKAO_CLIENT_SECRET:?KAKAO_CLIENT_SECRET 이 비었다}"

body=$(jq -n --arg id "$KAKAO_REST_API_KEY" --arg secret "$KAKAO_CLIENT_SECRET" '{
  site_url: "https://wedding.onnit.co.kr",
  uri_allow_list: "http://localhost:8080/**,https://wedding.onnit.co.kr/**",
  external_kakao_enabled: true,
  external_kakao_client_id: $id,
  external_kakao_secret: $secret,
  external_kakao_email_optional: true
}')
curl -fsS -X PATCH "$API" "${AUTH[@]}" -d "$body" | jq "$SHOW"
echo "적용됨. 확인: curl -sI \"https://$SUPABASE_PROJECT_REF.supabase.co/auth/v1/authorize?provider=kakao\" → 302 kauth.kakao.com"
