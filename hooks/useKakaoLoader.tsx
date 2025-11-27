import { useKakaoLoader as useKakaoLoaderOrigin } from "react-kakao-maps-sdk";

export default function useKakaoLoader() {
  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Kakao Maps API 키가 설정되지 않았습니다. .env.local 파일에 NEXT_PUBLIC_KAKAO_MAP_API_KEY를 추가하세요."
    );
  }

  useKakaoLoaderOrigin({
    /**
     * ※주의※ appkey의 경우 본인의 appkey를 사용하셔야 합니다.
     * 해당 키는 docs를 위해 발급된 키 이므로, 임의로 사용하셔서는 안됩니다.
     *
     * @참고 https://apis.map.kakao.com/web/guide/
     */
    appkey: apiKey,
    libraries: ["clusterer", "drawing", "services"],
  });
}
