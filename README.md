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
