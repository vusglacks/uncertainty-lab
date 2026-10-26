# 실험 데이터 처리 및 불확도 자동 계산

대전과학고 정보과학 프로젝트(6차시) · 2307 송하율

실험 보고서의 반복 계산을 자동화하는 웹 서비스. 측정값과 계산식을 입력하면
평균·표준편차·불확도를 계산하고, 유효숫자를 맞춘 표와 오차막대 그래프를 내보낸다.

## 개발

```bash
npm install       # 처음 한 번
cp .env.example .env   # 처음 한 번 — .env 에 Supabase 주소·키를 채운다 (GitHub에 안 올라감)
npm run dev       # 개발 서버 (http://localhost:5173)
npm run build     # 배포용 빌드 → dist/
npm test          # 계산 코드(engine·stats·calc·row) 검증
```

`.env`를 고치면 개발 서버를 껐다 다시 켜야 반영된다. 배포(Vercel)에는 같은 이름의 값을
Settings → Environment Variables에 넣고 Redeploy한다. DB 표는 `supabase/schema.sql`을 SQL Editor에서 실행해 만든다.

## 기술 스택

- **Vite + React** (JavaScript) — 프론트엔드
- **Tailwind CSS** — 스타일
- **Vercel** — 배포 (`main`에 푸시하면 자동 배포)
- **Supabase** — 로그인(이메일+비밀번호)과 실험 저장 (RLS로 내 실험만 접근)

## 폴더

```
src/
  lib/engine.js     수식 파서 + 자동 미분 + 불확도 전파 (직접 구현, 라이브러리 X)
  lib/stats.js      측정값 평균·표본표준편차·A형/B형/합성 불확도
  lib/calc.js       계산 블록과 engine.js 연결
  App.jsx           화면
test/
  engine.test.js    engine.js 검증 (21개)
  stats.test.js     측정 통계 검증 (33개)
  calc.test.js      계산 블록 연결 검증 (22개)
docs/
  구조.md            화면·블록 구조 확정본
```

## 문서

- [화면·블록 구조](docs/구조.md)
