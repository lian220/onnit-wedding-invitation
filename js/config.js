/* Supabase 접속 정보.
   publishable 키는 공개용이다 — 정적 파일에 박히고 누구나 가진다. 지키는 것은 RLS 다.
   두 페이지가 같은 값을 쓰므로 한 곳에 둔다. css/tokens.css 를 뺀 이유와 같다.
   비밀값(DB 비밀번호 등)은 여기 두지 않는다. 그건 .env 이고 CLI 만 읽는다. */
window.ONNIT = {
  SUPABASE_URL: 'https://ehzcybacnnhtyikrpsiy.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_kEc93M1vv8SvlXmup3a3Ng_pnThAmK8'
};
