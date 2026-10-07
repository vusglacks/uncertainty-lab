# 실험 데이터 처리 및 불확도 자동 계산

대전과학고 정보과학 프로젝트(8차시) · 2307 송하율

실험 보고서의 반복 계산을 자동화하는 웹 서비스. 측정값과 계산식을 입력하면
평균·표준편차·불확도를 계산하고, 유효숫자를 맞춘 표와 오차막대 그래프를 내보낸다.

## 개발

```bash
npm install       # 처음 한 번
npm run dev       # 개발 서버 (http://localhost:5173)
npm run build     # 배포용 빌드 → dist/
npm test          # 계산 엔진(engine.js) 검증
```

## 기술 스택

- **Vite + React** (JavaScript) — 프론트엔드
- **Tailwind CSS** — 스타일
- **Vercel** — 배포 (3차시부터, `main`에 푸시하면 자동 배포)
- **Supabase** — 로그인·저장 (6차시~)

## 폴더

```
src/
  lib/engine.js     수식 파서 + 자동 미분 + 불확도 전파 (직접 구현, 라이브러리 X)
  App.jsx           화면
test/
  engine.test.js    engine.js 검증 (21개)
docs/
  구조.md            화면·블록 구조 확정본
```

## 문서

- [화면·블록 구조](docs/구조.md)
