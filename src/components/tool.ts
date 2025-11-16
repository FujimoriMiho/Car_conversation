import { tool } from '@openai/agents/realtime';
import { z } from 'zod';
import { getadminkey } from './getadminkey';

// 最寄り施設API のベースURL
const NEARBY_PLACES_API_URL = 'https://script.google.com/macros/s/AKfycbwUZoewo_kXZb4mR5PXqBIuDijnBJ4--WaPO7n9hpfH7kwsyZTriIoFjpLQUhdz4vYLsw/exec';

// 現在位置を取得するヘルパー関数
const getCurrentPosition = (): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
};

// 最寄り施設を取得するツール
export const getNearbyPlaces = tool({
  name: 'get_nearby_places',
  description: '現在地周辺の最寄り施設を取得します。',
  parameters: z.object({
    radius: z.number().optional().default(1000).describe('検索半径(メートル)')
  }),
  async execute({ radius }) {
    try {
      // 1. 現在位置を取得
      const position = await getCurrentPosition();
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      
      // 2. APIキーを取得
      const apiKey = getadminkey();
      
      // 3. 最寄り施設APIを呼び出し
      const apiUrl = `${NEARBY_PLACES_API_URL}?key=${apiKey}&lat=${lat}&lon=${lon}&radius=${radius}`;
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      // 4. 結果を整形して返却
      if (data.status !== 'success' || !data.facilities || data.facilities.length === 0) {
        return '周辺に施設が見つかりませんでした。';
      }
      
      const facilitiesList = data.facilities.map((facility: string, index: number) => {
        return `${index + 1}. ${facility}`;
      }).join('\\n');
      
      return `現在地(緯度: ${lat.toFixed(4)}, 経度: ${lon.toFixed(4)})周辺の施設(${data.count}件):\\n\\n${facilitiesList}`;
      
    } catch (error) {
      if (error instanceof GeolocationPositionError) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            return '位置情報の取得が拒否されました。ブラウザの設定で位置情報へのアクセスを許可してください。';
          case error.POSITION_UNAVAILABLE:
            return '位置情報が利用できません。';
          case error.TIMEOUT:
            return '位置情報の取得がタイムアウトしました。';
          default:
            return '位置情報の取得中にエラーが発生しました。';
        }
      }
      return `エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`;
    }
  },
});

// // Realtime Agentの作成
// const nearbyPlacesAgent = new RealtimeAgent({
//   name: '最寄り施設アシスタント',
//   instructions: 'ユーザーの現在地周辺の施設情報を提供します。',
//   tools: [getNearbyPlaces],
// });

// export default nearbyPlacesAgent;