# dkhc.co.kr 현행 사이트 분석 → 리뉴얼 준비

## Context
(주)대경하이켐 웹사이트 리뉴얼 전, 현행 사이트(http://dkhc.co.kr/ko/) 구조·콘텐츠·기술을 파악. 분석 결과를 리포에 남겨두고, 다음 단계(방향 브레인스토밍)로 넘어가기 위한 계획.

## 분석 결과 요약

### 회사
- (주)대경하이켐 / DaeKyung Hichem — 1990 대경무역 설립, 2010 법인전환. 대표 이병길
- 업종: **첨단소재 수입·수출 무역상사** (일본 소재 메이커 대리 공급 중심)
- 주소 서울 영등포구 양평로12길 17-1 대경빌딩 3층 / Tel 02-3272-9581~5 / info@dkhc.co.kr

### 사이트맵 (KO / EN / JP 3개 언어, 같은 구조)
```
HOME
├─ 회사소개: 개요(개요+연혁) / 인사말 / 협력사(고객사 로고 18개)
├─ 제품
│   ├─ Special Material: Resin · Film · Metal · Machine · Thermal Management
│   ├─ Medical: Absorption · Syringe · Vial · Special Packaging(빈 페이지)
│   └─ Eco-Friendly: Bio Resin · Biodegradable(빈 페이지)
│   (+ 메인 슬라이드의 3D Printing → 외부 dk3d.co.kr, 현재 접속 불가)
└─ 문의하기: 고객문의 / 협력문의 (게시판형 폼 + 캡차)
```
- 제품은 실제로 **"공급사(메이커) 단위"** 로 정리됨: 목록 = 메이커 로고, 상세 = 메이커 소개 → 제품라인(설명/특징)
- 메이커: Kuraray, Mitsui Chemicals, Daicel, Denka, MGC, Maeda, UPM, Sojitz, Kurabo, Chukoh, Kawata 등 ~25개
- 고객사: 삼성전자·전기·디스플레이·메디슨, LG전자·디스플레이·이노텍·화학, 현대모비스, 서울반도체, 대웅·동아·동국제약 등

### 기술
- Classic ASP + IIS(ASP.NET), jQuery(중복 로드 3종), bxSlider, AXISJ, 네이버 SmartEditor — 2018년 제작(copyright 2018)
- HTTPS 없음(https → 404), 기본 UA는 403 차단
- meta description/keywords/OG 전부 비어있음 → SEO 0
- 이미지 파일명 한글·공백(`/upload/prod/덴카 홈페이지 로고.png`)

### 문제점
1. 연혁이 2018에서 멈춤, 빈 카테고리 2개, 죽은 외부 링크(dk3d)
2. 주소 표기 불일치(개요: 당산동6가 346 지번 / 푸터: 양평로 도로명)
3. 문의 폼이 게시판 기반(pw=1111 hidden, 이메일 도메인 선택 목록 구식)
4. 제품 IA가 "카테고리→메이커"라 소재 찾는 고객 입장에서 불편 (메이커 중복: Denka 4곳, Kuraray 2곳)
5. 30년+ 업력·대기업 고객사라는 강점이 메인에서 약하게 표현됨

## 다음 단계 (승인 시)
1. 리포에 `docs/analysis/2026-10-15-current-site.md` 로 위 분석 저장
2. 원본 HTML/이미지 텍스트 아카이브(`docs/analysis/raw/`) — 콘텐츠 이관용
3. 브레인스토밍: 타깃(국내 대기업 구매/R&D vs 해외 메이커), 기술 스택(NEWSCAPE처럼 정적 사이트 vs CMS 필요 여부 — 제품 업데이트 주체가 누구냐가 관건), 다국어 운영 방식

## 검증
- 저장된 문서에 사이트맵·메이커·고객사 목록이 원본과 일치하는지 대조

---

## 레퍼런스: IMCD Korea (https://www.imcd.kr) — 2026-10-15 분석

스크린샷: `docs/analysis/reference-imcd/` (home / products / bpc / suppliers)

### 정체
글로벌 특수화학·원료 유통사(네덜란드 본사). 한국법인 2019 설립. 사업 모델이 대경하이켐과 같음 — 메이커(Principal)의 제품을 고객에 공급. 규모만 다름(제품 10만+, 메이커 수백).

### IA (3축 탐색)
```
                 ┌─ Business Group (8)  : 산업군  ─┐
Our Products ────┼─ Market Segment      : 세부 용도 ├─▶ 제품 카드 목록
                 └─ 검색 (제품/처방/공급사) ────────┘
Our Suppliers ── Business Group ─▶ A–Z 인덱스 ─▶ 공급사 카드(로고 + "N product groups")
Our Knowledge ── 트렌드/컨셉/웨비나 콘텐츠
Company ── About / Investors / HSEQR / Certificates / Careers / News
```
- 핵심: **제품(용도 축)** 과 **공급사(메이커 축)** 를 별도 진입점으로 양립. dkhc 현행은 메이커 축만 있음.
- 헤더에 "market segment 선택 + 검색" 콤보가 상시 노출 → 모든 페이지가 탐색 시작점.

### 제품 카드 구성
```
┌──────────────────────────────────────────────────────┐
│ [Business Group 태그]                    View details │
│ 제품명 (대문자)                            ┌────────┐ │
│ 설명 2~3줄 (말줄임)                        │메이커로고│ │
│                                           │Principal│ │
│ [Download documents] [Request Sample] [Request Quote] │
└──────────────────────────────────────────────────────┘
```
- CTA 3종이 카드 안에 바로 있음 — 문의 폼을 별도 메뉴로 빼지 않음.
- 비로그인은 일부만 노출, 나머지는 블러 + "Login to MyIMCD" (게이팅). dkhc 규모엔 불필요.

### 비주얼
- 폰트 Noto Sans 단일. 메인 네이비(#1a2b6d 계열) + 포인트 블루(#039be5) + BG 그룹별 틴트(뷰티=핑크 그라데이션).
- 카드 기반 레이아웃, 둥근 pill 버튼, 넓은 여백. 사진은 Business Group 썸네일에만 집중 사용.
- 히어로: 풀블리드 사진 + 짧은 카피 + 검색창. 홈 하단: 뉴스/하이라이트/그룹 소개/CTA 배너.

### 기술
- Web Components(Shadow DOM 22개) SPA, GTM. 초기 렌더 수 초 지연 — 검색엔진/첫 로딩에 불리. 따라할 점 아님.

### dkhc 리뉴얼에 가져올 것 / 버릴 것
| 가져올 것 | 버릴 것 |
|---|---|
| 제품 ↔ 공급사 2축 탐색 | MyIMCD 로그인 게이팅 |
| 카드 내 CTA(견적/샘플/자료) | 8개 Business Group 규모의 복잡한 필터 |
| 상시 검색 + 세그먼트 선택 | Careers/Investors 같은 대기업 섹션 |
| 카드 UI + 그룹별 컬러 틴트 | JS 과다 SPA 구조 |
| 메이커 로고 + 제품군 수 표기 | |

### dkhc 맞춤 IA 초안 (IMCD 축소판)
```
제품 ── 분야(3): Special Material / Medical / Eco-Friendly
      └ 용도·소재 태그로 필터 (Resin, Film, Metal, Syringe, Bio Resin…)
      └ 제품 카드: 제품명 · 설명 · 메이커 로고 · [자료요청][견적문의]
공급사 ── A–Z / 국가별 ─▶ 메이커 카드(로고 + 취급 제품 수) ─▶ 메이커 상세 + 제품 목록
```
→ 현행 "Denka 4곳 중복" 문제가 자연 해소됨: 제품은 제품 축, 메이커는 메이커 축.
