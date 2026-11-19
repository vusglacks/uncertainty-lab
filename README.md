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
npm test          # 계산·변환 코드 검증 (engine·stats·calc·graph·report·단위·엑셀 등)
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
  lib/symbolic.js   기호 미분 (편미분식 글자) + 식 정리
  lib/expand.js     계산 블록 이름을 식으로 펼치기 (계산 블록끼리 연결)
  lib/calc.js       계산 블록과 engine.js 연결 (값 하나, 행별 값 목록)
  lib/regression.js 추세선 6종(직선·원점·2차·거듭제곱·지수·로그), R², 표준오차
  lib/graph.js      그래프 자료(점·오차막대·추세선)와 축 눈금
  lib/report.js     내보내기용 표와 그래프 자료
  lib/units.js      단위 글자(m/s², kPa …)를 차원으로 해석
  lib/unitcheck.js  식의 단위 계산(차원 분석)과 단위 경고
  lib/compare.js    손계산 결과와 프로그램 결과 비교
  lib/excel.js      엑셀·CSV 열 찾기, 측정 블록 만들기, .xlsx 시트 자료
  lib/excelIO.js    엑셀 파일 읽기·쓰기 (read-excel-file, write-excel-file)
  lib/guestStorage.js  로그인 없이 쓸 때의 저장소 (이 브라우저)
  App.jsx           화면
test/
  engine.test.js    engine.js 검증 (21개)
  stats.test.js     측정 통계 검증 (33개)
  calc.test.js      계산 블록 연결 검증 (23개)
  graph.test.js     추세선·그래프 자료 검증 (91개)
  report.test.js    내보내기 표 검증 (16개)
  chain.test.js     계산 블록 연결·행별 값·그래프 축 검증 (72개)
  symbolic.test.js  기호 미분을 자동 미분과 대조 (41개)
  explain.test.js   계산 과정(편미분·항·기여율) 검증 (32개)
  funcs.test.js     새 함수·도 단위 역삼각함수 검증 (68개)
  bfactors.test.js  B형 요인 환산·합성 검증 (43개)
  units.test.js     단위 해석·차원 분석·경고 검증 (58개)
  excel.test.js     CSV·열 찾기·.xlsx 쓰고 다시 읽기 검증 (53개)
  compare.test.js   손계산 비교 검증 (31개)
  guest.test.js     손님 모드 저장소 검증 (18개)
  row.test.js       DB 변환 검증 (9개)
docs/
  구조.md            화면·블록 구조 확정본
```

## 문서

- [화면·블록 구조](docs/구조.md)
