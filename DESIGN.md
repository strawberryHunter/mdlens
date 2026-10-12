# MDLens — 설계 메모

> 어떤 MD 엔진의 로그든 끌어다 놓으면, 평형 구간을 자동으로 찾고 논문용 통계와 그래프를 만들어 주는 브라우저 앱.
> 설치하지 않아도 되고, 파일을 업로드하지도 않는다.

## 1. 포지셔닝

- **그래프 그리기 자체는 흔하다.** 엔진별 도구가 이미 있다. NAMD는 VMD의 NAMD Plot, LAMMPS는 LAMMPS-GUI 차트, GROMACS는 xmgrace나 GMXvg가 있고, 파이썬 스크립트도 많다.
- **비어 있는 자리는 세 가지다.**
  1. 여러 엔진을 한 화면에서 같은 이름과 단위로 비교하는 GUI
  2. 평형 자동 판별(Chodera 2016)의 GUI. 지금은 pymbar의 파이썬 함수뿐이다.
  3. 자기상관을 보정한 표준오차를 논문 형식으로 바로 복사하는 기능
- **대상**: GROMACS·NAMD·AMBER·CHARMM·OpenMM·LAMMPS 사용자, 특히 CHARMM-GUI로 여러 엔진용 입력을 만들어 쓰는 사람.

## 2. 핵심 시나리오

1. NAMD 평형화 로그를 드롭한다. 카드로 모든 양의 평형 여부를 한눈에 본다. 부피는 "아직 이완 중"이라고 경고가 뜬다.
2. 같은 계를 OpenMM·AMBER·GROMACS로 돌린 결과를 한꺼번에 드롭한다. 온도와 에너지가 단위가 통일된 채로 겹쳐 그려진다.
3. 레플리카 3개의 RMSD를 평균 ± SD로 합친다. 1단 PNG(300 dpi)를 PPT에 붙이고, `0.22 ± 0.03 nm`를 본문에 복사한다.

## 3. 현재 구현 (v0.2)

- 엔진 자동 인식: GROMACS, NAMD, OpenMM(CSV, 탭 구분), CHARMM, LAMMPS, AMBER, PLUMED, 일반 표 형식
- 엔진별 용어를 하나로 맞추기(Temperature, Potential energy 등)와 단위 변환(시간, 길이, 면적, 부피, 에너지, 힘, 압력, 밀도)
- 평형 자동 판별, 자기상관을 보정한 표준오차, 생산 구간 드리프트
- 대시보드 카드(스파크라인, 평형 상태), 여러 패널을 쌓은 그래프(a/b/c 라벨), 데이터를 피해서 놓는 범례
- 내보내기: SVG(인치 단위), PNG 300/600 dpi(DPI 메타데이터 포함), 클립보드, CSV
- 실제 연구 데이터로 검증: CHARMM-GUI 출력을 포함해 GROMACS 460개, AMBER 584개, OpenMM 21개, CHARMM 7개 파일

## 4. 다음 단계

| 우선순위 | 항목 |
|---|---|
| 1 | 블록 평균 오차 분석, 히스토그램·분포 |
| 2 | `.xpm` 히트맵(자유에너지 지형, DSSP), RMSF 전용 보기 |
| 3 | GROMACS `.edr` 직접 읽기(XDR), 세션 저장·복원 |
| 4 | 한국어 UI, Python/CLI 배치 렌더링 |

## 5. 출시·공모·투고

- **출시**: GitHub Pages(무료). 홍보 채널은 GROMACS 포럼, matsci.org(LAMMPS), NAMD 메일링 리스트, r/comp_chem, X/Bluesky의 #compchem
- **공개SW 개발자대회**: 과거 회차는 6~7월 접수, 9월 제출이었다. 2027년 회차를 목표로 하고, 정확한 일정은 oss.kr 공고를 확인한다.
- **JOSS**: 1인 3개월 이상 작업, 1,000줄 이상 코드, 테스트와 문서를 요구한다. 다중 엔진 지원과 평형 판별이 "minor utility"가 아니라는 근거가 된다. 2027년 초 투고를 목표로 한다.

## 6. 아키텍처

100% 정적 사이트다. 서버, 계정, DB가 없어서 운영비가 0원이다.

```
파일 ─▶ formats/detect.ts ─▶ 엔진별 파서 ─▶ Dataset {quantities[]}
                                              │
                 workspace.ts: 파일 간 같은 양 묶기, 단위 변환, 패널 구성
                                              │
     stats.ts: 평형 판별, 표준오차, LTTB  ─────┼────▶ 카드, 통계표
                                              ▼
                    figure.ts (Observable Plot → SVG) ─▶ export.ts
```

`src/lib`는 DOM에 의존하지 않아서 테스트로 검증할 수 있고, CLI(`scripts/render.ts`)에서도 그대로 쓴다.
