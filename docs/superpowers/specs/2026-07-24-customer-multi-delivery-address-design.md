# 고객사 다중 납품장소 지원 — 설계

## 배경 / 문제

`생산완료(SalesCompletionModal)`에서 납품장소(`install_address`)를 입력할 때, 고객사 마스터(`tb_customer`)에는 고객사당 주소가 1개만 저장되어 있어 실제로는 같은 고객사가 여러 납품장소(본사, 물류창고, 지점 등)를 갖는 경우를 재사용 가능한 형태로 제안하지 못한다. 반면 발주처 담당자(`tb_customer_manager`)는 이미 고객사당 여러 명을 등록/선택할 수 있는 구조(콤보 선택 + "담당자 관리" 모달)로 되어 있다.

## 목표

생산완료 입력 시, 영업 담당자가 해당 고객사에 등록된 과거 납품장소 여러 개 중에서 선택하거나 새로 등록할 수 있게 한다. 담당자 관리와 동일한 UX 패턴을 재사용해 학습 비용과 구현 복잡도를 최소화한다.

## 스코프

- 포함: `db.js`(신규 테이블 CRUD), `seed.sql`/`supabase-schema.sql`(테이블 생성), `production-request-modal.jsx`(`AddressManageModal` 신규), `production-waiting.jsx`(`SalesCompletionModal` 납품장소 필드 교체)
- 제외: `order-lookup.jsx` 등 조회 전용 화면 — `install_address` 텍스트를 그대로 표시만 하므로 변경 불필요. `tb_customer.address`(고객사 마스터의 단일 주소 필드) 마이그레이션은 하지 않음 — 그대로 유지.

## 데이터 모델

신규 테이블 `tb_customer_address`를 `tb_customer_manager`와 동일한 패턴으로 추가한다.

```sql
CREATE TABLE IF NOT EXISTS tb_customer_address (
  customer_name TEXT    NOT NULL,
  label         TEXT    NOT NULL,   -- 장소 별칭 (예: "본사", "물류창고A")
  address       TEXT    NOT NULL,   -- 우편번호 검색(Daum Postcode)으로 채워진 실제 주소
  is_primary    INTEGER DEFAULT 0,
  PRIMARY KEY (customer_name, label)
);

ALTER TABLE tb_customer_address ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tb_customer_address_anon_all ON tb_customer_address;
CREATE POLICY tb_customer_address_anon_all ON tb_customer_address FOR ALL TO anon USING (true) WITH CHECK (true);
```

- 복합 PK(`customer_name, label`) — `tb_customer_manager(customer_name, name)`와 동일한 이유(별도 FK 없이 이름으로 연결, 로컬 캐시에 합성 id 부여).
- `tb_customer.address`(마스터 테이블의 단일 주소 필드)는 변경하지 않는다. "고객사 추가" 모달에서 빠르게 첫 주소를 입력하는 용도로만 남고, 새 테이블과는 독립적으로 동작한다.
- `seed.sql`(신규 설치용 전체 스크립트)과 `supabase-schema.sql`(기존 운영 DB에 적용할 마이그레이션 전용 섹션) 양쪽에 테이블 생성 DDL을 추가한다.

## db.js API

`tb_customer_manager` 관련 API(`getManagers`, `addManager`, `updateManager`, `deleteManager`)를 그대로 복제한 대칭 API를 추가한다.

```js
PMDB.getAddresses(customer_name)                         // 캐시에서 필터링, 배열 반환
PMDB.addAddress({ customer_name, label, address, is_primary })
PMDB.updateAddress(customer_name, oldLabel, { label, address, is_primary })
PMDB.deleteAddress(customer_name, label)
```

- `loadAll()`의 마스터 로딩 목록에 `tb_customer_address` 조회를 추가하고 `cache.customer_addresses` 배열에 보관한다.
- `is_primary`를 켜면 같은 `customer_name`의 다른 행은 자동으로 0으로 내리는 로직을 `updateManager`/`addManager`와 동일하게 넣는다.
- `updateAddress`는 `label`이 바뀔 수 있으므로(복합 PK 일부) 기존 행을 삭제 후 재삽입하거나, 동일 `customer_name` 내에서 UPDATE 후 PK 변경을 처리하는 `updateManager`의 기존 패턴(`oldName`→새 이름 시 delete+insert)을 그대로 따른다.

## UI 변경

### `AddressManageModal` (신규, `production-request-modal.jsx`에 `ManagerManageModal` 옆에 정의)

`ManagerManageModal`을 구조 그대로 복제한다:
- 목록: 라벨 + 주소 + 대표 배지, 행마다 "대표 지정" / "수정" / "삭제" 버튼
- 추가/수정 폼: 라벨(텍스트 입력, 필수) + 주소(`AddressField` 재사용 — 우편번호 검색) + 대표 지정 체크박스
- `window.PMDB.getAddresses/addAddress/updateAddress/deleteAddress` 호출, `onChanged` 콜백으로 부모의 선택값 갱신

### `SalesCompletionModal`의 납품장소 필드 (`production-waiting.jsx`)

- 기존 "발주처 등록 주소" 칩 제안 블록(단일 `tb_customer.address` 기반, 1개만 표시)을 제거한다.
- `AddressField`(우편번호 검색 input)를 담당자 필드와 동일한 `.mgr-field` 레이아웃으로 감싸고, 옆에 "납품장소 관리" 버튼(아이콘 `truck`)을 추가해 `AddressManageModal`을 연다. 담당자 필드처럼 `form.customer_name`이 없으면 토스트로 안내 후 열지 않는다.
- 필드 아래에 `PMDB.getAddresses(form.customer_name)` 결과를 칩 형태로 표시(여러 개 가능), 대표 주소는 배지로 구분해 맨 앞에 정렬. 칩 클릭 시 `install_address`에 채워진다(기존 클릭 동작과 동일, 소스만 교체).
- `customer_name` 변경 시 `refreshManagers`와 동일하게 `refreshAddresses(customer_name)`를 호출해 목록을 갱신한다.

## 마이그레이션 / 기존 데이터 영향

- 기존 `tb_customer.address` 값은 자동으로 `tb_customer_address`에 백필하지 않는다(스코프 외 — 필요 시 별도 요청으로 처리). 신규 테이블은 빈 상태로 시작하며, 사용자가 "납품장소 관리" 모달에서 필요할 때 직접 등록한다.
- `seed.sql`의 신규 설치 시드 데이터에는 예시로 기존 `tb_customer_manager` 시드와 동일한 고객사(카스, 마이크로 등)에 대해 주소 1~2개씩 샘플 데이터를 추가한다.

## 테스트 / 검증

- `npm test`(역할 권한 테스트)는 이번 변경과 무관하므로 통과 여부만 확인.
- 브라우저 수동 확인 필요 항목(자동화 불가): "납품장소 관리" 모달에서 추가/수정/삭제/대표지정이 실제 DB에 반영되는지, 칩 선택 시 `install_address`가 올바르게 채워지는지, 고객사 전환 시 목록이 갱신되는지.
