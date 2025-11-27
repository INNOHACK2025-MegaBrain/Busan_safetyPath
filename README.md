# 프로젝트 세팅 가이드

## 1. Node / NPM 버전 확인

프로젝트는 아래 환경에서 세팅되었습니다.

```bash
# Node 버전 확인
node -v
# 예상 출력: v24.11.1

# NPM 버전 확인
npm -v
# 예상 출력: 11.6.2


# 프로젝트 루트 디렉토리로 이동 후
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 프로덕션 환경 실행
npm run start
```

## 2. Supabase 연결

```bash
# Root 경로에 .env.local 파일 생성

# .env.local 파일에 해당 내용 작성

NEXT_PUBLIC_SUPABASE_URL= url
NEXT_PUBLIC_SUPABASE_ANON_KEY= key

# 작성후 연결 확인
npm run dev
```

## 커밋 주의 사항

프로젝트 관리 및 배포 안정성을 위해 커밋 시 반드시 다음 사항을 준수해야 합니다.

1. **빌드 확인 후 커밋**

   - 커밋 전에 반드시 `npm run build` 등으로 빌드가 성공하는지 확인합니다.
   - 빌드 오류를 해결하지 않고 커밋하면 Vercel 배포가 실패할 수 있습니다.

2. **커밋 메시지 규칙 준수**

   - 커밋 메시지는 의미를 명확히 표현해야 합니다.
   - 예시:
     - `feat`: 새로운 기능 추가
     - `fix`: 버그 수정
     - `style`: 스타일, 디자인 변경
     - `refactor`: 코드 리팩토링
     - `docs`: 문서 수정
   - 메시지 예시:
     ```
     feat: 로그인 페이지 UI 구현
     fix: 버튼 클릭 시 에러 발생 문제 해결
     style: 헤더 폰트 크기 수정
     ```

3. **작은 변경도 즉시 커밋**

   - 기능 하나, 사소한 디자인 변경 하나라도 작업 후 바로 커밋합니다.
   - 변경 사항을 쌓아두지 않고 바로 커밋하면, 추적과 협업이 쉬워집니다.

4. **브랜치 전략**
   - 각자 작업은 반드시 **개인 브랜치**에서 진행합니다.
   - **main 브랜치에는 직접 커밋 금지**.
   - 작업 완료 후 Pull Request(PR)를 통해 main 브랜치에 머지해야 합니다.
5. 개발 완료 시 **feature 브랜치 → main 브랜치 PR 생성**
6. PR 제목/설명:
   - 제목: `[feat] SOS 버튼 구현`
   - 내용: 기능 요약 + 데모 화면 링크 + 확인 방법
7. 리뷰:
   - 팀원 1명 이상 승인 필수
   - 간단히 동작 확인 (지도, SOS, DB 등)
8. 머지:
   - GitHub에서 **“Squash and merge”** 권장 → 커밋 히스토리 깔끔
   - main 브랜치 직접 커밋 금지

---

## 충돌 최소화 전략

- PR 전에 feature 브랜치 최신 main pull 필수

```bash
git checkout feature/sos-button
git fetch origin
git pull origin main
```
