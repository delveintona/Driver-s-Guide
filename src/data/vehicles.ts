export type Confidence =
  | 'official_exact'
  | 'official_range'
  | 'secondary_reference'
  | 'measured_in_unit'
  | 'provisional'
  | 'unknown'

export const CONFIDENCE_LABEL: Record<Confidence, { label: string; hint: string; tone: 'ok' | 'warn' | 'bad' }> = {
  official_exact: { label: '공식 확정', hint: '해당 형식의 제조사·교범 자료', tone: 'ok' },
  official_range: { label: '공식 범위', hint: '제조사가 범위로 공개한 값', tone: 'ok' },
  secondary_reference: { label: '2차 자료', hint: '공개 2차 자료 기준, 형식별 확인 필요', tone: 'warn' },
  measured_in_unit: { label: '부대 실측', hint: '부대 실차 측정값', tone: 'ok' },
  provisional: { label: '참고·검증 필요', hint: '대표 참고 조합, 실차 식별 후 교체', tone: 'warn' },
  unknown: { label: '미확인', hint: '확인된 자료 없음', tone: 'bad' },
}

export type VehicleCategory = 'military' | 'commercial'

export interface Vehicle {
  id: string
  displayName: string
  shortName: string
  category: VehicleCategory
  variant: string
  tagline: string
  /** 공개 제원. 모르면 null (추정해서 채우지 않는다) */
  dimensionsMm: {
    length: number
    widthBody: number
    widthIncludingMirrors: number | null
    height: number
    wheelbase: number | null
    frontOverhang: number | null
    rearOverhang: number | null
    frontTrack: number | null
  }
  turning: {
    minimumRadiusM: number | null
    radiusReference: string
    confidence: Confidence
  }
  /**
   * 도식·시뮬레이터 표시 전용 가정값. 공식 제원이 아니며 화면에 "도식용 가정"으로 표시한다.
   * 공식 값이 있으면 그 값이 우선 사용된다.
   */
  illustrative: {
    wheelbaseM: number
    frontOverhangM: number
    cabLengthM: number
    /** 적재함 높이(도식용) */
    cargoHeightM: number
    /** 후사경이 차체 옆면 밖으로 나온 길이(한쪽). 공개 자료 없음 → 도식용 가정 */
    mirrorOutM: number
    /** 운전석 앞에 보닛이 보이는 차량인지(도식용) */
    hood: boolean
    /** 뒤 두 축(탠덤)의 간격. 0이면 뒷축 1개. 공개 자료 없음 → 도식용 가정 */
    tandemM: number
    assumedWheelbase: boolean
    assumedMaxSteerDeg: boolean
  }
  confidence: Confidence
  sourceIds: string[]
  sourceNote: string
  caution: string
  tips: string[]
  lastReviewed: string
  color: string
}

const REVIEWED = '2026-11-09'

export const VEHICLES: Vehicle[] = [
  {
    id: 'k151',
    displayName: 'K151 소형전술차량',
    shortName: 'K151',
    category: 'military',
    variant: '지휘/다목적 계열 대표형 (형식별 범위 확인 필요)',
    tagline: '작아 보여도 승용 SUV가 아니다',
    dimensionsMm: {
      length: 4877,
      widthBody: 2192,
      widthIncludingMirrors: null,
      height: 1986,
      wheelbase: 3300,
      frontOverhang: null,
      rearOverhang: null,
      frontTrack: null,
    },
    turning: {
      minimumRadiusM: 7.8,
      radiusReference: '제조사 공개 최소회전반경. 측정 기준점은 자료에 명시되지 않음',
      confidence: 'official_range',
    },
    illustrative: {
      wheelbaseM: 3.3,
      frontOverhangM: 0.9,
      cabLengthM: 2.6,
      cargoHeightM: 1.4,
      mirrorOutM: 0.25,
      hood: true,
      tandemM: 0,
      assumedWheelbase: false,
      assumedMaxSteerDeg: false,
    },
    confidence: 'secondary_reference',
    sourceIds: ['S5', 'S6'],
    sourceNote:
      'Kia 공식 페이지는 차종별 범위(길이 5,000 mm 이하, 폭 2,204 mm 이하 등)와 최소회전반경 7.8 m를 제공. 화면의 크기는 2차 자료의 대표값이며 공식 범위가 우선. 축거 3,300 mm(단축형)는 나무위키 기준 2차 자료이며 Kia 공식 표에는 없음.',
    caution: '변형·장축형은 별도 모델로 분리해야 한다. 축거 3.3 m는 2차 자료(단축형)이고 장축형은 4.0 m로 전해진다. 앞 오버행은 도식용 가정이다.',
    tips: [
      '차폭이 2.2 m에 가깝다. 승용차 감각으로 좁은 길에 들어가지 않는다.',
      '형식(지휘형·다목적형 등)에 따라 길이·회전반경이 다르다. 배차된 형식을 먼저 확인한다.',
      '후진 전 뒤쪽 사각을 직접 내려서 확인하거나 유도자를 둔다.',
    ],
    lastReviewed: REVIEWED,
    color: '#8a9a5b',
  },
  {
    id: 'mighty',
    displayName: '현대 마이티 2.5톤',
    shortName: '마이티',
    category: 'commercial',
    variant: '2.5톤 카고, 일반캡 장축급 대표 참고형',
    tagline: '짧아 보여도 후륜은 안쪽으로 들어온다',
    dimensionsMm: {
      length: 6210,
      widthBody: 2080,
      widthIncludingMirrors: null,
      height: 2345,
      wheelbase: 3400,
      frontOverhang: null,
      rearOverhang: null,
      frontTrack: null,
    },
    turning: {
      minimumRadiusM: 6.3,
      radiusReference: '구형 EX6 3,400 mm 축거 자료의 값. 국내 해당 연식과 일치한다고 보장할 수 없음',
      confidence: 'provisional',
    },
    illustrative: {
      wheelbaseM: 3.4,
      frontOverhangM: 1.0,
      cabLengthM: 1.9,
      cargoHeightM: 1.7,
      mirrorOutM: 0.25,
      hood: false,
      tandemM: 0,
      assumedWheelbase: false,
      assumedMaxSteerDeg: false,
    },
    confidence: 'provisional',
    sourceIds: ['S7', 'S8'],
    sourceNote: '치수는 현대 2026 국내 카탈로그, 회전반경은 구형 EX6 계열 카탈로그 값을 결합한 대표 참고 조합.',
    caution: '연식·캡·적재함·타이어·브레이크 사양에 따라 차이가 있다. 실차 식별 후 값을 교체해야 한다.',
    tips: [
      '캡 뒤 차체와 적재함 길이를 함께 생각한다. 앞이 지나갔다고 뒤가 지나간 것이 아니다.',
      '조향 시작 타이밍은 차량·코너 형상에 따라 다르다. 한 가지 공식에 의존하지 않는다.',
      '적재 시 높이·후방 돌출을 먼저 확인한다.',
    ],
    lastReviewed: REVIEWED,
    color: '#5b7aa0',
  },
  {
    id: 'k511',
    displayName: 'K511 두돈반',
    shortName: 'K511',
    category: 'military',
    variant: 'K511 계열 군용 카고 (K511/K511A1 구분 확인 필요)',
    tagline: '차폭 2.5 m, 차로를 거의 다 쓴다',
    dimensionsMm: {
      length: 6712,
      widthBody: 2483,
      widthIncludingMirrors: null,
      height: 2845,
      wheelbase: null,
      frontOverhang: null,
      rearOverhang: null,
      frontTrack: null,
    },
    turning: {
      minimumRadiusM: 11.0,
      radiusReference: 'Kia Special Vehicle K511A1 카고 제원표의 11.0 m (전장 6,800 / 전폭 2,500 mm 표기). 기본형 K511과 같은지, 측정 기준점이 무엇인지는 미확인',
      confidence: 'provisional',
    },
    illustrative: {
      wheelbaseM: 3.6,
      frontOverhangM: 1.1,
      cabLengthM: 2.0,
      cargoHeightM: 2.0,
      mirrorOutM: 0.25,
      hood: true,
      tandemM: 1.3,
      assumedWheelbase: true,
      assumedMaxSteerDeg: false,
    },
    confidence: 'secondary_reference',
    sourceIds: ['S3', 'S4', 'S15'],
    sourceNote: '2차 공개 자료 제원. 다른 자료는 6,800×2,500 mm로 반올림해 표기한다. 축거는 미확인. 회전반경 11.0 m는 K511A1 공식 제원표 값(검색 결과로 확인, 원문 표는 직접 열람 못 함).',
    caution: '축거는 도식용 가정값이다. 회전반경 11.0 m는 A1형 기준이라 기본형에는 맞지 않을 수 있다. 교범 또는 부대 실측 전까지 정밀 궤적으로 쓰지 않는다.',
    tips: [
      '좁은 길에서는 전방 장애물뿐 아니라 후사경 끝, 적재함 모서리, 후륜 안쪽 궤적을 확인한다.',
      '장애물을 피하려고 중앙선을 넘는 것을 기본 요령으로 삼지 않는다. 시야·교통이 확보되지 않으면 정지한다.',
      '후진 시 유도자와 시야·신호가 끊기면 즉시 멈춘다.',
    ],
    lastReviewed: REVIEWED,
    color: '#6b7a3a',
  },
  {
    id: 'megatruck',
    displayName: '현대 메가트럭 5톤',
    shortName: '메가트럭',
    category: 'commercial',
    variant: '5톤 초장축 카고, 적재함 6,250 mm, 2015 대표형',
    tagline: '길이 8.7 m, 후륜 내륜차가 크다',
    dimensionsMm: {
      length: 8660,
      widthBody: 2420,
      widthIncludingMirrors: null,
      height: 2660,
      wheelbase: 4895,
      frontOverhang: null,
      rearOverhang: null,
      frontTrack: null,
    },
    turning: {
      minimumRadiusM: null,
      radiusReference: '공식 형식별 최소회전반경 미확인',
      confidence: 'unknown',
    },
    illustrative: {
      wheelbaseM: 4.895,
      frontOverhangM: 1.4,
      cabLengthM: 2.0,
      cargoHeightM: 2.0,
      mirrorOutM: 0.25,
      hood: false,
      tandemM: 0,
      assumedWheelbase: false,
      assumedMaxSteerDeg: true,
    },
    confidence: 'secondary_reference',
    sourceIds: [],
    sourceNote: '상용차 제원 데이터베이스의 특정 연식·형식 값(etrucks 목록 참조). "5톤 메가" 전체로 일반화하지 않는다.',
    caution: '축거가 다른 단축·장축·초장축·특장 모델은 각각 별도 프로필이 필요하다.',
    tips: [
      '차명만 고르지 말고 정확한 축거·차체형을 확인한다.',
      '긴 축거는 후륜이 안쪽으로 크게 들어오고 앞부분은 바깥으로 크게 스윙한다.',
    ],
    lastReviewed: REVIEWED,
    color: '#a0603f',
  },
  {
    id: 'nobus',
    displayName: '타타대우 노부스 5톤',
    shortName: '노부스',
    category: 'commercial',
    variant: '5톤 장축 카고, 2016–2017 대표형',
    tagline: '5톤급 장축, 길이 8.2 m',
    dimensionsMm: {
      length: 8235,
      widthBody: 2495,
      widthIncludingMirrors: null,
      height: 2860,
      wheelbase: 4500,
      frontOverhang: null,
      rearOverhang: null,
      frontTrack: null,
    },
    turning: {
      minimumRadiusM: null,
      radiusReference: '공식 형식별 최소회전반경 미확인',
      confidence: 'unknown',
    },
    illustrative: {
      wheelbaseM: 4.5,
      frontOverhangM: 1.35,
      cabLengthM: 2.0,
      cargoHeightM: 2.0,
      mirrorOutM: 0.25,
      hood: false,
      tandemM: 0,
      assumedWheelbase: false,
      assumedMaxSteerDeg: true,
    },
    confidence: 'secondary_reference',
    sourceIds: [],
    sourceNote: '상용차 제원 데이터베이스의 특정 연식·형식 값(etrucks 목록 참조).',
    caution: '캡·축거·특장 및 차량별 구조변경으로 달라질 수 있다.',
    tips: [
      '차폭 약 2.5 m. 일반 차로(예시 3.0~3.5 m)에서 좌우 여유는 한 뼘 정도뿐이다.',
      '축거·차체형을 정확히 고른 뒤 궤적을 본다.',
    ],
    lastReviewed: REVIEWED,
    color: '#7a5ba0',
  },
]

export const getVehicle = (id: string) => VEHICLES.find((v) => v.id === id)

export const COMMON_TIPS = {
  preDrive: [
    '배차된 차량과 운전 허가·교육 상태가 일치하는지 확인한다.',
    '차폭·높이·후방 돌출·적재 상태와 경로의 제한/장애물을 먼저 확인한다.',
    '후사경·보조 후사경을 조정하고 일상점검을 한다. 이상이 있으면 임의로 운행하지 않고 정비/지휘 절차를 따른다.',
    '후진·좁은 공간에서는 필요 시 유도자를 두고, 시야·신호가 끊기면 즉시 멈춘다.',
    '전·우측 사각지대에 특히 주의한다. 도로교통공단이 조사한 대형 화물차의 우측 사각지대는 약 8.3 m였다(특정 측정 결과, 고정값 아님).',
  ],
  cargo: [
    '출발 전 적재물의 무게 배분, 이동·전도 가능성, 결박·덮개, 높이·폭·후방 돌출을 확인한다.',
    '방지턱·요철·곡선은 화물 움직임을 고려해 부드럽게 통과한다.',
    '법적 근거는 사업용 화물차 규정이다. 군 차량은 군 규정과 교범을 우선한다.',
  ],
  passenger: [
    '탑승·하차 완료, 안전띠, 승차 위치와 지휘관 지시를 확인한다.',
    '급가속·급제동·급회전을 피하고 점진적으로 조작한다.',
    '승차정원, 화물·인원 혼재 여부, 승하차 절차는 군 규정을 따른다.',
  ],
  vip: [
    '급가속·급제동보다 예측 가능한 속도 변화와 자연스러운 조향을 지향한다.',
    '안전에 필요한 속도·차간거리를 희생하면서까지 승차감을 우선하지 않는다.',
    '도어 잠금·해제와 문 열림은 완전 정차 후 주변을 확인하고 부대 의전 절차에 맞춘다.',
  ],
}

export interface Source {
  id: string
  title: string
  kind: 'official' | 'secondary'
  url: string
}

export const SOURCES: Source[] = [
  { id: 'S1', title: '한국도로교통공단 안전운전 통합민원, 군면허 교환발급', kind: 'official', url: 'https://www.safedriving.or.kr/diGuide/selectDiGuide09.do' },
  { id: 'S2', title: '도로교통법 시행규칙 별표 18 (운전할 수 있는 차의 종류)', kind: 'official', url: 'https://www.law.go.kr/LSW/flDownload.do?bylClsCd=110201&flSeq=168509037' },
  { id: 'S3', title: '현대자동차그룹 저널, 기아의 군용 차량 개발 이야기 (2025-08-14)', kind: 'official', url: 'https://www.hyundaimotorgroup.com/ko/story/CONT0000000000183139' },
  { id: 'S4', title: '국방홍보원 해설, 육공트럭의 모든 것', kind: 'secondary', url: 'https://v.daum.net/v/cUAu7LqDsu' },
  { id: 'S5', title: 'Kia Military, KLTV 시리즈 제원', kind: 'official', url: 'https://org-military.kia.com/en/kltv' },
  { id: 'S6', title: 'Kia Military, KLTV 다목적 차량 제원', kind: 'official', url: 'https://org-military.kia.com/en/kltv/multi-purpose-vehicle' },
  { id: 'S7', title: '현대자동차, The New 2027 MIGHTY 국내 카탈로그 제원 PDF', kind: 'official', url: 'https://www.hyundai.com/ccontents/carmng/CP00000003/mighty-2026-08-spec.pdf' },
  { id: 'S8', title: '현대 상용차 글로벌, MIGHTY EX6 Cargo 제원 PDF (국내 동일 사양 보장 아님)', kind: 'official', url: 'https://trucknbus.hyundai.com/global/file/downloadBlb?fil_sn=BF00150074' },
  { id: 'S11', title: '도로교통공단, 대형 화물차 사각지대 (2022-04-22)', kind: 'official', url: 'https://www.koroad.or.kr/main/board/6/7405/board_view.do?&bdNoticeYn=N&bdOpenYn=Y&cp=18&listType=list' },
  { id: 'S12', title: '국토교통부, 화물 제대로 안 묶으면 단속 걸린다 (2024-04-16)', kind: 'official', url: 'https://www.molit.go.kr' },
  { id: 'S13', title: '한국교통안전공단, 사업용 화물차 교통안전관리 매뉴얼', kind: 'official', url: 'https://onlinedti.or.kr/pds_update/file_20211007090454.pdf' },
  { id: 'S14', title: '도로교통공단 교통안전 교육센터', kind: 'official', url: 'https://trafficedu.koroad.or.kr/' },
  { id: 'S15', title: 'Kia Special Vehicle, K511A1 카고 (최소회전반경 11.0 m)', kind: 'official', url: 'https://special.kia.com/kr/kia/vehicles/k51-series/k511a1-cargo-truck.do' },
  { id: 'S16', title: '도로교통법 시행규칙 별표 23 (기능시험코스의 종류·형상 및 구조, 제1종 대형면허, 개정 2026. 2. 24.)', kind: 'official', url: 'https://www.law.go.kr/LSW/flDownload.do?flSeq=168840585' },
  { id: 'X1', title: 'K511 치수 참고 (나무위키)', kind: 'secondary', url: 'https://namu.wiki/w/K-511?from=K511' },
  { id: 'X5', title: 'K151 축거 3.3 m(단축)/4.0 m(장축) 참고 (나무위키)', kind: 'secondary', url: 'https://en.namu.wiki/w/K-151' },
  { id: 'X2', title: 'K511 / K151 치수 참고 (리브레위키)', kind: 'secondary', url: 'https://librewiki.net/wiki/K151' },
  { id: 'X3', title: '메가트럭 5톤 초장축 카고(2015) 제원 (etrucks)', kind: 'secondary', url: 'https://etrucks.co.kr/m/truck/detail.php?idx=885' },
  { id: 'X4', title: '노부스 5톤 장축 카고(2016–2017) 제원 (etrucks)', kind: 'secondary', url: 'https://etrucks.co.kr/m/truck/detail.php?idx=219' },
]

/** 시뮬레이터에서 쓰는 형상. 공식 값이 있으면 우선, 없으면 도식용 가정값 */
export function vehicleGeometry(v: Vehicle) {
  const L = v.dimensionsMm.length / 1000
  const W = v.dimensionsMm.widthBody / 1000
  const H = v.dimensionsMm.height / 1000
  const wheelbase = v.dimensionsMm.wheelbase != null ? v.dimensionsMm.wheelbase / 1000 : v.illustrative.wheelbaseM
  const frontOverhang = v.dimensionsMm.frontOverhang != null ? v.dimensionsMm.frontOverhang / 1000 : v.illustrative.frontOverhangM
  const rearOverhang = L - wheelbase - frontOverhang
  const R = v.turning.minimumRadiusM
  const maxSteerDeg =
    R != null && R > wheelbase ? (Math.asin(wheelbase / R) * 180) / Math.PI : 35
  return {
    L, W, H, wheelbase, frontOverhang, rearOverhang,
    cabLength: v.illustrative.cabLengthM,
    cargoHeight: v.illustrative.cargoHeightM,
    mirrorOut: v.illustrative.mirrorOutM,
    hood: v.illustrative.hood,
    tandem: v.illustrative.tandemM,
    maxSteerDeg,
    wheelbaseAssumed: v.dimensionsMm.wheelbase == null,
    steerAssumed: !(R != null && R > wheelbase),
  }
}
