# onnit-wedding-invitation 저장소 규칙

> 공통 규칙은 agent-config(~/workSpaces/agent-config/rules/global.md)에서 전역으로 로드된다. 이 파일은 이 저장소 고유 규칙만 둔다.

모바일 청첩장 포트폴리오 데모다. 제품 설명과 설계 이유는 `README.md`가 정본이다.

## 구조

- 빌드 없는 정적 HTML이다. `index.html`(랜딩, 유일하게 데스크톱 반응형), `invite.html`(청첩장, 모바일 폭 고정), `make.html`(제작 페이지, 모바일 전용).
- 공통 색·간격은 `css/tokens.css`, 리셋과 진짜 공통 규칙은 `css/base.css`에만 둔다. 페이지마다 `:root` 값을 따로 두지 않는다.
- 청첩장 데이터는 두 경로다. 주소 `#d=`(base64url JSON, 서버 없음)와 Supabase `invitations` 테이블(`?id=`, 카카오 로그인). 설계는 `docs/superpowers/specs/`.
- 하객 경로(`invite.html`)에 라이브러리를 더하지 않는다. `?id=`가 없으면 Supabase를 타지 않는다.
- `ops/keepalive/`는 Supabase 일시정지를 막는 Cloudflare Worker 크론이다. 운영 절차는 그 README.

## 실행·검증

```bash
python3 -m http.server 8080          # make.html 미리보기는 서버가 있어야 뜬다
cd ops/keepalive && npm install && npm run check
cd ops/keepalive && npx wrangler deploy --dry-run --outdir dist
```

- DB 정책 테스트: `supabase/tests/rls_test.sql`. 실행 명령은 미확인.
- 사이트 자동 테스트는 미확인(저장소에 없음). UI 변경은 모바일 폭 브라우저로 직접 확인한다.

## 배포

- 사이트는 Cloudflare Pages다. `main`에 push하면 빌드 없이 그대로 운영(`wedding.onnit.co.kr`)에 나간다. main push는 곧 배포다.
- `ops/keepalive/*`가 바뀐 push는 Workers Builds가 `wrangler deploy`를 돌린다.
- 지금까지 커밋은 main에 바로 들어갔다. main push가 곧 운영 배포이므로 브랜치·PR 규칙(전역)을 특히 지킨다.

## 지켜야 할 것

- 표시 데이터는 전부 가상이다. 실재하는 이름·계좌·후기 수치를 지어 넣지 않는다.
- 비밀값은 `.env`(gitignore)에만 둔다. 브라우저 공개값은 `js/config.js`다. 서비스 키·카카오 시크릿을 페이지 코드에 넣지 않는다.
- 공개 열람은 `get_invitation(id)` RPC 한 건 조회뿐이다. 테이블 읽기를 anon에 여는 변경을 하지 않는다.
- 접근성 기준(포커스 트랩, 탭 패턴, 핀치 줌 허용, `prefers-reduced-motion`)을 되돌리지 않는다.
